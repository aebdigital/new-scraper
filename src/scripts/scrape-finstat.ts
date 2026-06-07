import * as cheerio from "cheerio";
import { db } from "../lib/db";
import { companies } from "../lib/db/schema";
import { eq } from "drizzle-orm";

function parseMoney(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^\d-]/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function normalizeName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/s\.?\s*r\.?\s*o\.?/gi, "")
    .replace(/a\.?\s*s\.?/gi, "")
    .replace(/spol\.?\s*s\s*r\.?\s*o\.?/gi, "")
    .replace(/k\.?\s*s\.?/gi, "")
    .replace(/v\s*konkurze/gi, "")
    .replace(/zrušená/gi, "")
    .replace(/[^a-z0-9]/gi, "")
    .trim();
}

async function scrapeFinStatPage(page: number): Promise<any[]> {
  // We use sales-desc (highest revenue first) as requested by the user
  const url = `https://finstat.sk/databaza-financnych-udajov?Sort=sales-desc&page=${page}&Activity=stavebn%C3%ADctvo`;
  console.log(`[SCRAPE] Fetching FinStat page ${page} (sales-desc)...`);

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch FinStat page ${page}: ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const pageCompanies: any[] = [];

  const table = $("table#screener-table");
  if (table.length === 0) {
    console.log(`[SCRAPE] No table found on page ${page}`);
    return [];
  }

  table.find("tbody tr").each((rowIndex, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 5) return;

    const nameLink = $(tds[0]).find("a").first();
    const name = nameLink.text().trim();
    const href = nameLink.attr("href") || "";
    const ico = href.replace("/", "").trim();

    const yearText = $(tds[1]).text().trim();
    const year = parseInt(yearText, 10);

    const revenueText = $(tds[2]).text().trim();
    const profitText = $(tds[3]).text().trim();
    const assetsText = $(tds[4]).text().trim();

    const revenue = parseMoney(revenueText);
    const profit = parseMoney(profitText);
    const assets = parseMoney(assetsText);

    // Calculate global rank (20 items per page)
    const rank = (page - 1) * 20 + rowIndex + 1;

    if (name) {
      pageCompanies.push({
        name,
        ico,
        year: isNaN(year) ? null : year,
        revenue,
        profit,
        assets,
        rank
      });
    }
  });

  console.log(`[SCRAPE] Extracted ${pageCompanies.length} companies from page ${page}`);
  return pageCompanies;
}

async function main() {
  console.log("=== FinStat Top 200 Revenue Scraper & Database Enricher ===");

  const allScraped: any[] = [];

  try {
    // Crawl from page 1 up to page 10
    for (let p = 1; p <= 10; p++) {
      const pageData = await scrapeFinStatPage(p);
      allScraped.push(...pageData);
      // Brief rate-limiting delay between pages
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  } catch (err) {
    console.error("Scraping failed:", err);
    process.exit(1);
  }

  console.log(`\nTotal scraped companies: ${allScraped.length}`);
  console.log("Enriching local database and matching records...");

  // Load all current companies in the DB to match in memory
  const dbCompanies = await db.select({
    id: companies.id,
    name: companies.name,
  }).from(companies);

  // Map normalized names to DB IDs
  const dbNormalizedMap = new Map<string, number>();
  for (const c of dbCompanies) {
    dbNormalizedMap.set(normalizeName(c.name), c.id);
  }

  let matchedCount = 0;
  let insertedCount = 0;
  let updatedCount = 0;

  for (const scraped of allScraped) {
    const normScraped = normalizeName(scraped.name);
    const matchedId = dbNormalizedMap.get(normScraped);

    if (matchedId) {
      matchedCount++;
      console.log(`[MATCH] Rank #${scraped.rank}: "${scraped.name}" -> DB ID ${matchedId}`);
      try {
        await db
          .update(companies)
          .set({
            revenue: scraped.revenue,
            profit: scraped.profit,
            assets: scraped.assets,
            financialYear: scraped.year,
            finstatRank: scraped.rank,
          })
          .where(eq(companies.id, matchedId));
        updatedCount++;
      } catch (dbErr) {
        console.error(`Error updating ID ${matchedId}:`, dbErr);
      }
    } else {
      // If it doesn't exist, we insert it as a new company record!
      console.log(`[NEW] Rank #${scraped.rank}: Scraped company "${scraped.name}" not in DB. Inserting as new company.`);
      try {
        await db.insert(companies).values({
          name: scraped.name,
          revenue: scraped.revenue,
          profit: scraped.profit,
          assets: scraped.assets,
          financialYear: scraped.year,
          finstatRank: scraped.rank,
          status: "pending",
          leadScore: 0,
        });
        insertedCount++;
      } catch (insertErr) {
        console.error(`Error inserting new company "${scraped.name}":`, insertErr);
      }
    }
  }

  console.log("\n=============================================");
  console.log(`Matched & Updated: ${updatedCount} companies`);
  console.log(`Created (New):     ${insertedCount} companies`);
  console.log(`Total Handled:     ${updatedCount + insertedCount} / ${allScraped.length}`);
  console.log("=============================================");
  process.exit(0);
}

main().catch(console.error);
