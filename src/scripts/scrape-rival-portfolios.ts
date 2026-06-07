/**
 * scrape-rival-portfolios.ts
 * 
 * Scrapes portfolio/references pages of discovered web design agencies (rivals)
 * to find more client websites and cross-reference with our companies DB.
 * 
 * Usage: npx tsx src/scripts/scrape-rival-portfolios.ts --limit 100 --delay 500
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../lib/db/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";

const client = createClient({ url: "file:sqlite.db" });
const db = drizzle(client, { schema });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.substring(4);
    return host;
  } catch {
    return null;
  }
}

// Patterns for finding portfolio pages
const PORTFOLIO_PATTERNS = [
  /portfolio/i,
  /referencie/i,
  /referenc/i,
  /projekty/i,
  /naše\s*práce/i,
  /nase\s*prace/i,
  /our\s*work/i,
  /showcase/i,
  /clients/i,
  /case\s*stud/i,
  /realizácie/i,
  /realizacie/i,
];

const SKIP_DOMAINS = [
  "facebook.com", "instagram.com", "linkedin.com", "twitter.com",
  "youtube.com", "google.com", "pinterest.com", "tiktok.com",
  "behance.net", "dribbble.com", "github.com",
];

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "sk,cs,en;q=0.9",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function findPortfolioUrl(agencyDomain: string, html: string): Promise<string | null> {
  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);

  // Look for links that match portfolio patterns
  const links: { href: string; score: number }[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim().toLowerCase();
    const fullText = `${text} ${href}`;

    for (const pattern of PORTFOLIO_PATTERNS) {
      if (pattern.test(fullText)) {
        let fullUrl = href;
        if (href.startsWith("/")) {
          fullUrl = `https://${agencyDomain}${href}`;
        } else if (!href.startsWith("http")) {
          fullUrl = `https://${agencyDomain}/${href}`;
        }
        links.push({ href: fullUrl, score: 1 });
        break;
      }
    }
  });

  // Return the first matching portfolio link
  return links.length > 0 ? links[0].href : null;
}

async function extractOutboundDomains(html: string, agencyDomain: string): Promise<string[]> {
  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);

  const domains = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (!href.startsWith("http")) return;

    const domain = extractDomain(href);
    if (!domain) return;

    // Skip self-references, social media, directories
    if (domain === agencyDomain) return;
    if (domain.includes(agencyDomain)) return;
    if (SKIP_DOMAINS.some((s) => domain.includes(s))) return;

    domains.add(domain);
  });

  return Array.from(domains);
}

async function main() {
  const args = process.argv.slice(2);
  let limit = 100;
  let delayMs = 500;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--delay" && args[i + 1]) {
      delayMs = parseInt(args[i + 1], 10);
      i++;
    }
  }

  console.log(`\n=== 📋 Eagle Eye Portfolio Scraper ===`);
  console.log(`Config: Limit = ${limit}, Delay = ${delayMs}ms\n`);

  // Fetch rivals that have a domain but haven't had portfolio checked recently
  const targets = await db
    .select()
    .from(schema.rivals)
    .where(isNotNull(schema.rivals.domain))
    .limit(limit);

  console.log(`Found ${targets.length} agencies to check for portfolios.\n`);

  if (targets.length === 0) {
    console.log("No agencies with domains found.");
    process.exit(0);
  }

  let scanned = 0;
  let portfoliosFound = 0;
  let newLinks = 0;
  let upgradedLinks = 0;
  const startTime = Date.now();

  const ticker = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(
      `\n📊 PROGRESS: ${scanned}/${targets.length} | ` +
        `📋 ${portfoliosFound} portfolios found | ` +
        `🔗 ${newLinks} new links | ⬆️ ${upgradedLinks} upgraded | ` +
        `⏱️ ${elapsed}s`
    );
  }, 10000);

  for (const rival of targets) {
    scanned++;

    if (!rival.domain) continue;

    // Step 1: Fetch the agency homepage
    const homepageUrl = `https://${rival.domain}`;
    const homepageHtml = await fetchHtml(homepageUrl);

    if (!homepageHtml) {
      console.log(`[SKIP] #${scanned} "${rival.name}" → homepage fetch failed`);
      await sleep(delayMs);
      continue;
    }

    // Step 2: Find the portfolio page URL
    let portfolioUrl = rival.portfolioUrl;

    if (!portfolioUrl) {
      portfolioUrl = await findPortfolioUrl(rival.domain, homepageHtml);
    }

    if (portfolioUrl) {
      portfoliosFound++;

      // Save the portfolio URL
      await db
        .update(schema.rivals)
        .set({ portfolioUrl, lastCheckedAt: Date.now() })
        .where(eq(schema.rivals.id, rival.id));

      // Step 3: Fetch the portfolio page
      const portfolioHtml = await fetchHtml(portfolioUrl);
      await sleep(delayMs);

      if (portfolioHtml) {
        // Step 4: Extract outbound domains
        const outboundDomains = await extractOutboundDomains(portfolioHtml, rival.domain);

        console.log(
          `[PORTFOLIO] #${scanned} "${rival.name}" → ${portfolioUrl} → ${outboundDomains.length} outbound domains`
        );

        // Step 5: Cross-reference with our companies DB
        for (const domain of outboundDomains) {
          const matchingCompanies = await db
            .select({ id: schema.companies.id, name: schema.companies.name })
            .from(schema.companies)
            .where(eq(schema.companies.domain, domain))
            .limit(1);

          if (matchingCompanies.length > 0) {
            const company = matchingCompanies[0];

            // Check if link already exists
            const existingLink = await db
              .select({ id: schema.rivalClients.id, detectionMethod: schema.rivalClients.detectionMethod })
              .from(schema.rivalClients)
              .where(
                and(
                  eq(schema.rivalClients.rivalId, rival.id),
                  eq(schema.rivalClients.companyId, company.id)
                )
              )
              .limit(1);

            if (existingLink.length > 0) {
              // Upgrade to "both" if it was only "footer" before
              if (existingLink[0].detectionMethod === "footer") {
                await db
                  .update(schema.rivalClients)
                  .set({
                    detectionMethod: "both",
                    confidenceScore: 100,
                    lastConfirmedAt: Date.now(),
                  })
                  .where(eq(schema.rivalClients.id, existingLink[0].id));

                upgradedLinks++;
                console.log(
                  `  [UPGRADE] "${company.name}" (${domain}) → confidence upgraded to 100% (both)`
                );
              }
            } else {
              // Create new link from portfolio detection
              await db.insert(schema.rivalClients).values({
                rivalId: rival.id,
                companyId: company.id,
                detectionMethod: "portfolio",
                confidenceScore: 80,
                firstDetectedAt: Date.now(),
                lastConfirmedAt: Date.now(),
              });

              newLinks++;
              console.log(
                `  [NEW LINK] "${company.name}" (${domain}) → linked via portfolio`
              );
            }
          }
        }

        // Update rival client counts
        const totalResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.rivalClients)
          .where(eq(schema.rivalClients.rivalId, rival.id));

        const constructionResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.rivalClients)
          .innerJoin(schema.companies, eq(schema.rivalClients.companyId, schema.companies.id))
          .where(
            and(
              eq(schema.rivalClients.rivalId, rival.id),
              eq(schema.companies.naceSection, "F")
            )
          );

        await db
          .update(schema.rivals)
          .set({
            totalClients: totalResult[0]?.count || 0,
            constructionClients: constructionResult[0]?.count || 0,
          })
          .where(eq(schema.rivals.id, rival.id));
      }
    } else {
      console.log(`[NO PORTFOLIO] #${scanned} "${rival.name}" → no portfolio page found`);
    }

    await sleep(delayMs);
  }

  clearInterval(ticker);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== ✅ Portfolio Scraping Complete ===`);
  console.log(`Scanned: ${scanned} agencies in ${totalTime}s`);
  console.log(`Portfolios found: ${portfoliosFound}`);
  console.log(`New links created: ${newLinks}`);
  console.log(`Links upgraded: ${upgradedLinks}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Portfolio scraping failed:", err);
  process.exit(1);
});
