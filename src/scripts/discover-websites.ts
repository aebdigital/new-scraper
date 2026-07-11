/**
 * discover-websites.ts
 *
 * Discovers websites for companies that don't have one yet.
 * Strategy (in order of precision):
 *   1. Domain guessing (slug.sk, slug.com, hyphenated variants) with content verification
 *   2. Web search (DuckDuckGo + Bing HTML, round-robin with per-source backoff)
 *      - direct results are verified against the company (IČO / name on the page)
 *      - directory results (azet, zivefirmy, zlatestranky…) are mined for the website link
 *   3. Weak fallback: live search result whose domain matches the company slug
 *
 * (FinStat direct lookup by IČO was tried and dropped: the free profile pages
 * do not expose the company website in the HTML.)
 *
 * Companies are only marked google_searched=1 when a search actually ran —
 * transport failures / rate limits leave them queued for the next run.
 *
 * For bulk coverage, run src/scripts/bulk-directory-match.ts first — it
 * harvests business directories wholesale and matches by IČO, leaving this
 * script to mop up the remainder.
 *
 * Usage: npx tsx src/scripts/discover-websites.ts --limit 1000 --delay 600
 *   --concurrency 6     parallel companies (searches are still paced per source)
 *   --sro-only          restrict to s.r.o. companies (default: all legal forms)
 *   --retry-missed      re-attempt companies already marked searched but without a domain
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import {
  sleep,
  runPool,
  withDbRetry,
  isUniqueViolation,
  dnsCheck,
  nameToSlug,
  nameTokens,
  extractDomain,
  SKIP_HOSTS,
  DIRECTORY_HOSTS,
  hostMatches,
  isFreemailOrSaaS,
  extractExternalLinks,
  fetchPage,
  isParkedPage,
  verifyPageAgainstCompany,
  domainMatchesSlug,
  type MatchLevel,
} from "../lib/discovery/helpers";

const client = createClient({ url: "file:sqlite.db" });
const db = drizzle(client, { schema });

// ── Rate-limited search sources (DuckDuckGo, Bing) ───────────────────────────

interface PacedSource {
  name: string;
  nextAt: number;
  failStreak: number;
}

function backoff(source: PacedSource) {
  source.failStreak++;
  const wait = Math.min(15000 * 2 ** source.failStreak, 10 * 60 * 1000);
  source.nextAt = Date.now() + wait;
  console.log(`[${source.name}] backing off ${(wait / 1000).toFixed(0)}s (streak ${source.failStreak})`);
}

function pace(source: PacedSource, delayMs: number) {
  source.failStreak = 0;
  source.nextAt = Date.now() + delayMs;
}

async function searchDuckDuckGo(query: string): Promise<string[] | null> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const page = await fetchPage(url, 8000);

  // null = transport failure / rate limit → caller must NOT treat as "no results"
  // DDG soft-blocks with a 202 challenge page, so only a plain 200 counts
  if (page.status !== 200 || !page.html) return null;
  if (page.html.includes("anomaly") && page.html.includes("detected")) return null;

  const matches: string[] = [];
  const linkRegex = /class="result__a"\s+href="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(page.html)) !== null) matches.push(match[1]);

  const urlRegex = /class="result__url"[^>]*>([^<]+)</g;
  while ((match = urlRegex.exec(page.html)) !== null) {
    const cleaned = match[1].trim();
    if (cleaned && !cleaned.includes("duckduckgo")) {
      matches.push(cleaned.startsWith("http") ? cleaned : `https://${cleaned}`);
    }
  }

  // A 200 with zero parsed results is either a genuine miss or an unrecognized
  // block page — only trust it when DDG's results container is present
  if (matches.length === 0 && !page.html.includes("result")) return null;

  // DDG wraps real links in a redirect (uddg=)
  return matches.map((href) => {
    if (href.includes("uddg=")) {
      const decoded = decodeURIComponent(href.split("uddg=")[1]?.split("&")[0] || "");
      if (decoded) return decoded;
    }
    return href;
  });
}

// Bing wraps results in a tracking redirect: bing.com/ck/a?...&u=a1<base64url>
function decodeBingRedirect(href: string): string {
  try {
    const u = new URL(href).searchParams.get("u");
    if (!u || !u.startsWith("a1")) return href;
    const b64 = u.slice(2).replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(b64, "base64").toString("utf-8");
    return decoded.startsWith("http") ? decoded : href;
  } catch {
    return href;
  }
}

async function searchBing(query: string): Promise<string[] | null> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=sk&cc=sk`;
  const page = await fetchPage(url, 8000);

  if (!page.ok || !page.html) return null;
  if (page.html.includes("b_captcha") || page.html.length < 2000) return null;

  const matches: string[] = [];
  const linkRegex = /<h2[^>]*><a[^>]*href="(https?:\/\/[^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(page.html)) !== null) {
    matches.push(decodeBingRedirect(match[1].replace(/&amp;/g, "&")));
  }
  return matches;
}

const searchSources: (PacedSource & { run: (q: string) => Promise<string[] | null> })[] = [
  { name: "ddg", nextAt: 0, failStreak: 0, run: searchDuckDuckGo },
  { name: "bing", nextAt: 0, failStreak: 0, run: searchBing },
];

let searchLock = Promise.resolve();

/**
 * Runs the query on whichever search source is available soonest.
 * Serialized globally so sources are never hammered in parallel;
 * per-source pacing means DDG and Bing alternate for ~2x throughput.
 * Returns null when every source is failing/backed off (search unavailable).
 */
async function webSearch(query: string, delayMs: number): Promise<string[] | null> {
  const prevLock = searchLock;
  let release: () => void = () => {};
  searchLock = new Promise<void>((r) => (release = r));
  await prevLock;

  try {
    for (let attempt = 0; attempt < searchSources.length; attempt++) {
      const available = [...searchSources].sort((a, b) => a.nextAt - b.nextAt)[0];
      const waitMs = available.nextAt - Date.now();

      // Everything is deep in backoff — report unavailable instead of stalling the pool
      if (waitMs > 60000) return null;
      if (waitMs > 0) await sleep(waitMs);

      const results = await available.run(query);
      if (results === null) {
        backoff(available);
        continue; // try the other source
      }

      pace(available, delayMs);
      return results;
    }
    return null;
  } finally {
    release();
  }
}

// ── Discovery pipeline (per company) ─────────────────────────────────────────

interface Company {
  id: number;
  name: string;
  city: string | null;
  ico: string | null;
}

interface Discovery {
  url: string;
  domain: string;
  via: string;
  confidence: number;
}

type Outcome =
  | { kind: "found"; discovery: Discovery }
  | { kind: "none" }            // genuinely searched, nothing found → mark searched
  | { kind: "unavailable" };    // sources down → leave queued for next run

// Verify a candidate URL by loading it and checking it belongs to the company
async function verifyCandidate(
  url: string,
  company: Company
): Promise<{ level: MatchLevel; finalUrl: string; live: boolean }> {
  const page = await fetchPage(url, 8000);
  if (!page.ok || isParkedPage(page.html)) {
    return { level: "none", finalUrl: url, live: false };
  }
  return {
    level: verifyPageAgainstCompany(page.html, company),
    finalUrl: page.finalUrl,
    live: true,
  };
}

async function discoverCompany(company: Company, delayMs: number): Promise<Outcome> {
  let searchRan = false;
  let fallback: Discovery | null = null;
  const checkedDomains = new Set<string>();

  const tryCandidate = async (
    url: string,
    via: string,
    strongConfidence: number
  ): Promise<Discovery | null> => {
    const domain = extractDomain(url);
    if (!domain || checkedDomains.has(domain) || hostMatches(domain, SKIP_HOSTS) || isFreemailOrSaaS(domain)) return null;
    checkedDomains.add(domain);

    const verdict = await verifyCandidate(url, company);
    if (!verdict.live) return null;

    const finalDomain = extractDomain(verdict.finalUrl) || domain;
    const slugMatch = domainMatchesSlug(finalDomain, company.name);

    if (verdict.level === "strong") {
      return { url: verdict.finalUrl, domain: finalDomain, via, confidence: strongConfidence };
    }

    if (verdict.level === "tokens") {
      // Name words on the page prove ownership only when the source is already
      // company-specific (directory profile, guessed slug domain) or the
      // domain itself matches the name. A random search hit that merely
      // mentions the company (directory, news) must not be accepted outright.
      if (slugMatch || via === "directory" || via === "guess") {
        return {
          url: verdict.finalUrl,
          domain: finalDomain,
          via,
          confidence: strongConfidence - 15,
        };
      }
      if (!fallback) {
        fallback = { url: verdict.finalUrl, domain: finalDomain, via: `${via}-tokens`, confidence: 55 };
      }
      return null;
    }

    // Live but unverified (e.g. JS-rendered site): accept as fallback when the
    // domain itself matches the company name
    if (!fallback && slugMatch) {
      fallback = { url: verdict.finalUrl, domain: finalDomain, via: `${via}-slug`, confidence: 60 };
    }
    return null;
  };

  // 1. Domain guessing — exact and hyphenated slugs
  const slug = nameToSlug(company.name);
  const tokens = nameTokens(company.name);
  const guessSlugs = new Set<string>();
  if (slug.length >= 3) guessSlugs.add(slug);
  if (tokens.length >= 2) guessSlugs.add(tokens.join("-"));

  for (const g of guessSlugs) {
    for (const tld of ["sk", "com"]) {
      const domain = `${g}.${tld}`;
      if (checkedDomains.has(domain)) continue;
      if (!(await dnsCheck(domain))) continue;
      const hit = await tryCandidate(`https://${domain}`, "guess", 85);
      if (hit) return { kind: "found", discovery: hit };
    }
  }

  // 2. Web search
  const query = `${company.name} ${company.city || ""}`.trim();
  const results = await webSearch(query, delayMs);

  if (results !== null) {
    searchRan = true;

    const direct: string[] = [];
    const directoryPages: string[] = [];
    for (const href of results) {
      const domain = extractDomain(href);
      if (!domain) continue;
      if (hostMatches(domain, DIRECTORY_HOSTS)) {
        if (directoryPages.length < 2) directoryPages.push(href);
      } else if (!hostMatches(domain, SKIP_HOSTS)) {
        if (direct.length < 5) direct.push(href);
      }
    }

    // 2a. Direct results, verified against the company
    for (const href of direct) {
      const hit = await tryCandidate(href, "search", 90);
      if (hit) return { kind: "found", discovery: hit };
    }

    // 2b. Mine directory pages for the company's website link
    for (const dirUrl of directoryPages) {
      const dirPage = await fetchPage(dirUrl, 8000);
      if (!dirPage.ok) continue;
      // Only mine the page if it is actually about this company
      if (verifyPageAgainstCompany(dirPage.html, company) === "none") continue;

      const sourceHost = extractDomain(dirUrl) || "";
      for (const link of extractExternalLinks(dirPage.html, sourceHost)) {
        const hit = await tryCandidate(link, "directory", 80);
        if (hit) return { kind: "found", discovery: hit };
      }
    }
  }

  // 3. Weak fallback (live site whose domain matches the company slug)
  if (fallback) return { kind: "found", discovery: fallback };

  return searchRan ? { kind: "none" } : { kind: "unavailable" };
}

// ── DB writes ────────────────────────────────────────────────────────────────

async function markSearched(companyId: number) {
  await withDbRetry(
    () =>
      db
        .update(schema.companies)
        .set({ googleSearched: 1 })
        .where(eq(schema.companies.id, companyId)),
    `mark searched for company ${companyId}`
  );
}

/** Returns false when the domain already belongs to another company. */
async function saveWebsite(company: Company, d: Discovery): Promise<boolean> {
  const existing = await withDbRetry(
    () =>
      db
        .select({ id: schema.companies.id })
        .from(schema.companies)
        .where(eq(schema.companies.domain, d.domain))
        .limit(1),
    `check domain ${d.domain}`
  );
  if (existing.length > 0 && existing[0].id !== company.id) return false;

  try {
    await withDbRetry(
      () =>
        db
          .update(schema.companies)
          .set({ website: d.url, domain: d.domain, googleSearched: 1 })
          .where(eq(schema.companies.id, company.id)),
      `save website for company ${company.id}`
    );
    return true;
  } catch (error) {
    // Concurrent task claimed the same domain between the check and the write
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  let limit = 500;
  let delayMs = 600;
  let concurrency = 6;
  let sroOnly = false;
  let retryMissed = false;

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
    } else if (args[i] === "--sro-only") {
      sroOnly = true;
    } else if (args[i] === "--retry-missed") {
      retryMissed = true;
    }
  }

  console.log(`\n=== 🔍 Eagle Eye Website Discovery ===`);
  console.log(
    `Config: Limit = ${limit}, Delay = ${delayMs}ms, Concurrency = ${concurrency}` +
      `${sroOnly ? ", sro-only" : ""}${retryMissed ? ", retry-missed" : ""}\n`
  );

  await withDbRetry(
    () => client.execute("PRAGMA busy_timeout = 60000"),
    "set busy timeout"
  );

  // All companies without a domain qualify; highest revenue first so the most
  // valuable leads get discovered before the long tail.
  const conditions = [
    isNull(schema.companies.domain),
    eq(schema.companies.googleSearched, retryMissed ? 1 : 0),
  ];
  if (sroOnly) conditions.push(eq(schema.companies.legalFormCode, "sro"));

  const targets: Company[] = await withDbRetry(
    () =>
      db
        .select({
          id: schema.companies.id,
          name: schema.companies.name,
          city: schema.companies.city,
          ico: schema.companies.ico,
        })
        .from(schema.companies)
        .where(and(...conditions))
        .orderBy(sql`${schema.companies.revenue} DESC NULLS LAST, ${schema.companies.id} ASC`)
        .limit(limit),
    "load discovery targets"
  );

  console.log(`Found ${targets.length} companies without websites to search.\n`);

  if (targets.length === 0) {
    console.log("Nothing to do — every queued company has been searched.");
    process.exit(0);
  }

  let processed = 0;
  let found = 0;
  let noResult = 0;
  let unavailable = 0;
  let duplicates = 0;
  const viaCounts: Record<string, number> = {};
  const startTime = Date.now();

  const ticker = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = processed / (elapsed || 1);
    const eta = rate > 0 ? Math.round((targets.length - processed) / rate) : 0;
    console.log(
      `\n📊 PROGRESS: ${processed}/${targets.length} | ✅ ${found} found ` +
        `(${Object.entries(viaCounts).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"}) | ` +
        `❌ ${noResult} none | ⏸ ${unavailable} deferred | ` +
        `⏱️ ${elapsed.toFixed(0)}s | ${rate.toFixed(2)}/s | ETA: ${Math.floor(eta / 60)}m ${eta % 60}s`
    );
  }, 10000);

  const tasks = targets.map((company) => {
    return async () => {
      try {
        const outcome = await discoverCompany(company, delayMs);

        if (outcome.kind === "found") {
          const saved = await saveWebsite(company, outcome.discovery);
          if (saved) {
            found++;
            viaCounts[outcome.discovery.via] = (viaCounts[outcome.discovery.via] || 0) + 1;
            console.log(
              `[FOUND] ID ${company.id}: "${company.name}" → ${outcome.discovery.domain} ` +
                `(via ${outcome.discovery.via}, conf ${outcome.discovery.confidence})`
            );
          } else {
            duplicates++;
            await markSearched(company.id);
            console.log(
              `[DUP] ID ${company.id}: "${company.name}" → ${outcome.discovery.domain} already claimed`
            );
          }
        } else if (outcome.kind === "none") {
          noResult++;
          await markSearched(company.id);
        } else {
          // Sources unavailable — do NOT mark searched; company stays queued
          unavailable++;
        }
      } catch (error: any) {
        unavailable++;
        console.error(`[ERROR] ID ${company.id} "${company.name}":`, error.message || error);
      }
      processed++;
    };
  });

  await runPool(tasks, concurrency);
  clearInterval(ticker);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const attempted = found + noResult + duplicates;
  console.log(`\n=== ✅ Discovery Complete ===`);
  console.log(`Processed: ${processed} companies in ${totalTime}s`);
  console.log(`Found: ${found} websites (${Object.entries(viaCounts).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"})`);
  console.log(`No result: ${noResult} | Duplicate domains: ${duplicates}`);
  console.log(`Deferred (sources unavailable, will retry next run): ${unavailable}`);
  if (attempted > 0) {
    console.log(`Hit rate: ${((found / attempted) * 100).toFixed(1)}%`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Discovery failed:", err);
  process.exit(1);
});
