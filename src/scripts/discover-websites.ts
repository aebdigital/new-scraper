/**
 * discover-websites.ts
 * 
 * Discovers websites for companies that don't have one yet.
 * Strategy:
 *   1. Search DuckDuckGo HTML for the company name
 *   2. Fallback: try common .sk domain patterns
 *   3. Validate found URLs with a HEAD request
 *   4. Update DB with discovered website + domain
 * 
 * Usage: npx tsx src/scripts/discover-websites.ts --limit 1000 --delay 600
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import dns from "dns/promises";

const client = createClient({ url: "file:sqlite.db" });
const db = drizzle(client, { schema });

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function runPool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const active: Promise<any>[] = [];
  const results: Promise<T>[] = [];

  for (const task of tasks) {
    const p = task();
    results.push(p);

    const activePromise = p.then(() => {
      active.splice(active.indexOf(activePromise), 1);
    });
    active.push(activePromise);

    if (active.length >= limit) {
      await Promise.race(active);
    }
  }

  return Promise.all(results);
}

function isSqliteBusy(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("SQLITE_BUSY") || message.includes("database is locked");
}

async function dnsCheck(host: string): Promise<boolean> {
  try {
    await dns.lookup(host);
    return true;
  } catch {
    return false;
  }
}

async function withDbRetry<T>(
  operation: () => Promise<T>,
  label: string,
  maxAttempts = 8
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isSqliteBusy(error) || attempt === maxAttempts) {
        throw error;
      }

      const waitMs = Math.min(500 * attempt, 4000);
      console.log(
        `[DB BUSY] ${label} — retry ${attempt}/${maxAttempts} in ${waitMs}ms`
      );
      await sleep(waitMs);
    }
  }

  throw new Error(`DB retry failed for ${label}`);
}

function cleanCompanyName(name: string): string {
  // Remove legal suffixes for search
  return name
    .replace(/,?\s*s\.?\s*r\.?\s*o\.?\s*/gi, "")
    .replace(/,?\s*spol\.\s*s\s*r\.?\s*o\.?\s*/gi, "")
    .replace(/,?\s*a\.?\s*s\.?\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nameToSlug(name: string): string {
  return cleanCompanyName(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.substring(4);
    return host;
  } catch {
    return null;
  }
}

// ── DuckDuckGo HTML Search ───────────────────────────────────────────────────

async function searchDuckDuckGo(query: string): Promise<string | null> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "sk,cs,en;q=0.9",
      },
    });

    clearTimeout(timeout);

    if (!res.ok) return null;

    const html = await res.text();

    // Parse result links from DuckDuckGo HTML
    // DDG HTML results have links in <a class="result__a" href="...">
    const linkRegex = /class="result__a"\s+href="([^"]+)"/g;
    const matches: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null) {
      matches.push(match[1]);
    }

    // Also try the result__url spans
    const urlRegex = /class="result__url"[^>]*>([^<]+)</g;
    while ((match = urlRegex.exec(html)) !== null) {
      const cleaned = match[1].trim();
      if (cleaned && !cleaned.includes("duckduckgo")) {
        matches.push(cleaned.startsWith("http") ? cleaned : `https://${cleaned}`);
      }
    }

    // Filter out noise: social media, directories, government sites
    const skipDomains = [
      "facebook.com", "instagram.com", "linkedin.com", "twitter.com",
      "youtube.com", "tiktok.com", "pinterest.com",
      "finstat.sk", "foaf.sk", "orsr.sk", "zivefirmy.sk",
      "firmy.sk", "cylex.sk", "indexfiriem.sk", "katalogfiriem.sk",
      "europages.com", "dnb.com", "emis.com",
      "wikipedia.org", "google.com", "duckduckgo.com",
    ];

    for (const href of matches) {
      try {
        // DDG sometimes URL-encodes the actual link inside a redirect
        let actualUrl = href;
        if (href.includes("uddg=")) {
          const decoded = decodeURIComponent(href.split("uddg=")[1]?.split("&")[0] || "");
          if (decoded) actualUrl = decoded;
        }

        const domain = extractDomain(actualUrl);
        if (!domain) continue;
        if (skipDomains.some((s) => domain.includes(s))) continue;

        // Return the first non-directory, non-social result
        return actualUrl.startsWith("http") ? actualUrl : `https://${actualUrl}`;
      } catch {
        continue;
      }
    }

    return null;
  } catch {
    return null;
  }
}

let ddgLock = Promise.resolve();

async function searchDuckDuckGoLocked(query: string, delayMs: number): Promise<string | null> {
  const currentLock = ddgLock;
  let release: () => void = () => {};
  ddgLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await currentLock;
  try {
    const result = await searchDuckDuckGo(query);
    await sleep(delayMs);
    return result;
  } finally {
    release();
  }
}

// ── Domain Guessing ──────────────────────────────────────────────────────────

async function tryDomainGuess(companyName: string): Promise<string | null> {
  const slug = nameToSlug(companyName);
  if (!slug || slug.length < 3) return null;

  const candidates = [
    `${slug}.sk`,
    `${slug}.com`,
    `www.${slug}.sk`,
  ];

  for (const domain of candidates) {
    // Fast DNS lookup check to skip connection timeouts for inactive domains
    const hasDns = await dnsCheck(domain);
    if (!hasDns) continue;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`https://${domain}`, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; EagleEyeBot/1.0)",
        },
      });

      clearTimeout(timeout);

      if (res.ok || res.status === 301 || res.status === 302) {
        return `https://${domain}`;
      }
    } catch {
      // Domain doesn't exist or validation failed
    }
  }

  return null;
}

// ── URL Validation ───────────────────────────────────────────────────────────

async function validateUrl(url: string): Promise<boolean> {
  try {
    const domain = extractDomain(url);
    if (!domain) return false;

    // Fast DNS check before full HTTP validation
    const hasDns = await dnsCheck(domain);
    if (!hasDns) return false;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EagleEyeBot/1.0)",
      },
    });

    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  let limit = 500;
  let delayMs = 600; // ms between searches
  let concurrency = 8; // default concurrency

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--delay" && args[i + 1]) {
      delayMs = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--concurrency" && args[i + 1]) {
      concurrency = parseInt(args[i + 1], 10);
      i++;
    }
  }

  console.log(`\n=== 🔍 Eagle Eye Website Discovery ===`);
  console.log(`Config: Limit = ${limit}, Delay = ${delayMs}ms, Concurrency = ${concurrency}\n`);

  await withDbRetry(
    () => client.execute("PRAGMA busy_timeout = 60000"),
    "set busy timeout"
  );

  // Fetch companies without a website that haven't been searched yet
  const targets = await withDbRetry(
    () =>
      db
        .select({
          id: schema.companies.id,
          name: schema.companies.name,
          city: schema.companies.city,
        })
        .from(schema.companies)
        .where(
          and(
            isNull(schema.companies.domain),
            eq(schema.companies.googleSearched, 0),
            eq(schema.companies.legalFormCode, "sro"),
            eq(schema.companies.orsfEnriched, 1),
            sql`${schema.companies.revenue} > 0`
          )
        )
        .limit(limit),
    "load discovery targets"
  );

  console.log(`Found ${targets.length} companies without websites to search.\n`);

  if (targets.length === 0) {
    console.log("Nothing to do — all s.r.o. companies have been searched.");
    process.exit(0);
  }

  let searched = 0;
  let found = 0;
  let failed = 0;
  let ddgHits = 0;
  let guessHits = 0;
  const startTime = Date.now();

  // Progress ticker
  const ticker = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rate = searched > 0 ? (searched / (parseFloat(elapsed) || 1)).toFixed(1) : "0";
    const remaining = targets.length - searched;
    const eta = searched > 0 ? Math.round(remaining / parseFloat(rate)) : 0;
    const etaMin = Math.floor(eta / 60);
    const etaSec = eta % 60;
    console.log(
      `\n📊 PROGRESS: ${searched}/${targets.length} searched | ` +
      `✅ ${found} found (DDG: ${ddgHits}, Guess: ${guessHits}) | ` +
      `❌ ${failed} no result | ` +
      `⏱️ ${elapsed}s elapsed | Rate: ${rate}/s | ETA: ${etaMin}m ${etaSec}s`
    );
  }, 10000);

  const tasks = targets.map((company) => {
    return async () => {
      // Strategy 1: DuckDuckGo search (locked/sequenced)
      const searchQuery = `${company.name} ${company.city || ""} slovensko`;
      let discoveredUrl = await searchDuckDuckGoLocked(searchQuery, delayMs);
      let method = "ddg";

      // Strategy 2: Domain guessing
      if (!discoveredUrl) {
        discoveredUrl = await tryDomainGuess(company.name);
        method = "guess";
      }

      if (discoveredUrl) {
        // Validate the URL
        const valid = await validateUrl(discoveredUrl);

        if (valid) {
          const domain = extractDomain(discoveredUrl);
          if (domain) {
            // Check if domain already exists in DB (avoid unique constraint violations)
            const existing = await withDbRetry(
              () =>
                db
                  .select({ id: schema.companies.id })
                  .from(schema.companies)
                  .where(eq(schema.companies.domain, domain))
                  .limit(1),
              `check domain ${domain}`
            );

            if (existing.length === 0) {
              await withDbRetry(
                () =>
                  db
                    .update(schema.companies)
                    .set({
                      website: discoveredUrl,
                      domain: domain,
                      googleSearched: 1,
                    })
                    .where(eq(schema.companies.id, company.id)),
                `save website for company ${company.id}`
              );

              found++;
              if (method === "ddg") ddgHits++;
              else guessHits++;

              console.log(
                `[FOUND] #${searched + 1} ID ${company.id}: "${company.name}" → ${domain} (via ${method})`
              );
            } else {
              // Domain taken by another company, mark as searched
              await withDbRetry(
                () =>
                  db
                    .update(schema.companies)
                    .set({ googleSearched: 1 })
                    .where(eq(schema.companies.id, company.id)),
                `mark duplicate domain for company ${company.id}`
              );
              failed++;
              console.log(
                `[SKIP] #${searched + 1} ID ${company.id}: "${company.name}" → ${domain} already in DB`
              );
            }
          }
        } else {
          // URL didn't validate
          await withDbRetry(
            () =>
              db
                .update(schema.companies)
                .set({ googleSearched: 1 })
                .where(eq(schema.companies.id, company.id)),
            `mark invalid website for company ${company.id}`
          );
          failed++;
          console.log(
            `[INVALID] #${searched + 1} ID ${company.id}: "${company.name}" → ${discoveredUrl} (failed validation)`
          );
        }
      } else {
        // No result found
        await withDbRetry(
          () =>
            db
              .update(schema.companies)
              .set({ googleSearched: 1 })
              .where(eq(schema.companies.id, company.id)),
          `mark no result for company ${company.id}`
        );
        failed++;

        if ((searched + 1) % 50 === 0) {
          console.log(
            `[MISS] #${searched + 1} ID ${company.id}: "${company.name}" — no website found`
          );
        }
      }

      searched++;
    };
  });

  await runPool(tasks, concurrency);

  clearInterval(ticker);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== ✅ Discovery Complete ===`);
  console.log(`Searched: ${searched} companies in ${totalTime}s`);
  console.log(`Found: ${found} websites (DDG: ${ddgHits}, Guess: ${guessHits})`);
  console.log(`No result: ${failed}`);
  console.log(`Hit rate: ${((found / searched) * 100).toFixed(1)}%`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Discovery failed:", err);
  process.exit(1);
});
