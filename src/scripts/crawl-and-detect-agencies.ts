/**
 * crawl-and-detect-agencies.ts
 * 
 * Crawls all companies that have a website and detects which web design
 * agency built the site by analyzing footer content.
 * 
 * Creates/updates entries in the `rivals` table and `rival_clients` join table.
 * 
 * Usage: npx tsx src/scripts/crawl-and-detect-agencies.ts --limit 500 --delay 300
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../lib/db/schema";
import { eq, and, isNull, isNotNull, not, sql } from "drizzle-orm";
import { detectFooterAgency, FooterAgencyResult } from "../lib/crawler/detector";

const client = createClient({ url: "file:sqlite.db" });
const db = drizzle(client, { schema });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const schemes = url.startsWith("http") ? [url] : [`https://${url}`, `http://${url}`];

    for (const target of schemes) {
      try {
        const res = await fetch(target, {
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

        if (!res.ok) continue;
        return await res.text();
      } catch {
        continue;
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function findOrCreateRival(agency: FooterAgencyResult): Promise<number> {
  // Check if rival already exists by domain
  if (agency.agencyDomain) {
    const existing = await db
      .select({ id: schema.rivals.id })
      .from(schema.rivals)
      .where(eq(schema.rivals.domain, agency.agencyDomain))
      .limit(1);

    if (existing.length > 0) return existing[0].id;
  }

  // Check by name (fuzzy)
  const byName = await db
    .select({ id: schema.rivals.id })
    .from(schema.rivals)
    .where(eq(schema.rivals.name, agency.agencyName))
    .limit(1);

  if (byName.length > 0) return byName[0].id;

  // Create new rival
  const result = await db.insert(schema.rivals).values({
    name: agency.agencyName,
    website: agency.agencyUrl,
    domain: agency.agencyDomain,
    firstSeen: Date.now(),
    totalClients: 0,
    constructionClients: 0,
  });

  // Get the ID of the inserted rival
  const inserted = await db
    .select({ id: schema.rivals.id })
    .from(schema.rivals)
    .where(
      agency.agencyDomain
        ? eq(schema.rivals.domain, agency.agencyDomain)
        : eq(schema.rivals.name, agency.agencyName)
    )
    .limit(1);

  return inserted[0]?.id || 0;
}

async function updateRivalCounts(rivalId: number): Promise<void> {
  // Count total clients
  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.rivalClients)
    .where(eq(schema.rivalClients.rivalId, rivalId));

  const total = totalResult[0]?.count || 0;

  // Count construction clients (those with nace_section = 'F')
  const constructionResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.rivalClients)
    .innerJoin(schema.companies, eq(schema.rivalClients.companyId, schema.companies.id))
    .where(
      and(
        eq(schema.rivalClients.rivalId, rivalId),
        eq(schema.companies.naceSection, "F")
      )
    );

  const construction = constructionResult[0]?.count || 0;

  await db
    .update(schema.rivals)
    .set({
      totalClients: total,
      constructionClients: construction,
      lastCheckedAt: Date.now(),
    })
    .where(eq(schema.rivals.id, rivalId));
}

async function main() {
  const args = process.argv.slice(2);
  let limit = 500;
  let delayMs = 300;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--delay" && args[i + 1]) {
      delayMs = parseInt(args[i + 1], 10);
      i++;
    }
  }

  console.log(`\n=== 🏗️ Eagle Eye Agency Detection ===`);
  console.log(`Config: Limit = ${limit}, Delay = ${delayMs}ms\n`);

  // Fetch companies WITH a website but NOT yet linked to an agency
  const targets = await db
    .select({
      id: schema.companies.id,
      name: schema.companies.name,
      domain: schema.companies.domain,
      website: schema.companies.website,
    })
    .from(schema.companies)
    .where(
      and(
        isNotNull(schema.companies.domain),
        isNull(schema.companies.websiteAgencyId),
        eq(schema.companies.legalFormCode, "sro")
      )
    )
    .limit(limit);

  console.log(`Found ${targets.length} companies with websites to scan for agencies.\n`);

  if (targets.length === 0) {
    console.log("Nothing to do. All companies have been agency-scanned.");
    process.exit(0);
  }

  let scanned = 0;
  let agencyFound = 0;
  let noAgency = 0;
  let fetchFailed = 0;
  const startTime = Date.now();

  // Progress ticker
  const ticker = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rate = scanned > 0 ? (scanned / (parseFloat(elapsed) || 1)).toFixed(1) : "0";
    console.log(
      `\n📊 PROGRESS: ${scanned}/${targets.length} scanned | ` +
        `🏢 ${agencyFound} agencies detected | ` +
        `❌ ${noAgency} no agency | 🚫 ${fetchFailed} fetch failed | ` +
        `⏱️ ${elapsed}s elapsed | Rate: ${rate}/s`
    );
  }, 10000);

  for (const company of targets) {
    scanned++;

    const url = company.website || `https://${company.domain}`;
    const html = await fetchHtml(url);

    if (!html) {
      fetchFailed++;
      // Mark with agency ID = -1 to indicate "scanned but failed"
      // We'll use 0 to mean "scanned, no agency found"
      // Don't update websiteAgencyId here to allow retry
      if (scanned % 50 === 0) {
        console.log(
          `[FAIL] #${scanned} ID ${company.id}: "${company.name}" → fetch failed`
        );
      }
      await sleep(delayMs);
      continue;
    }

    const agency = detectFooterAgency(html);

    if (agency) {
      agencyFound++;

      // Find or create the rival
      const rivalId = await findOrCreateRival(agency);

      if (rivalId > 0) {
        // Create rival_clients link
        const existingLink = await db
          .select({ id: schema.rivalClients.id })
          .from(schema.rivalClients)
          .where(
            and(
              eq(schema.rivalClients.rivalId, rivalId),
              eq(schema.rivalClients.companyId, company.id)
            )
          )
          .limit(1);

        if (existingLink.length === 0) {
          await db.insert(schema.rivalClients).values({
            rivalId,
            companyId: company.id,
            detectionMethod: "footer",
            confidenceScore: agency.agencyUrl ? 90 : 70,
            firstDetectedAt: Date.now(),
            lastConfirmedAt: Date.now(),
          });
        }

        // Update company's agency reference
        await db
          .update(schema.companies)
          .set({ websiteAgencyId: rivalId })
          .where(eq(schema.companies.id, company.id));

        // Update rival client counts
        await updateRivalCounts(rivalId);

        console.log(
          `[AGENCY] #${scanned} ID ${company.id}: "${company.name}" → Built by "${agency.agencyName}" (${agency.agencyDomain || "no domain"})`
        );
      }
    } else {
      noAgency++;
      // Mark as scanned with no agency (websiteAgencyId = 0 means "checked, none found")
      // We don't set this to avoid confusion with real FK values

      if (scanned % 100 === 0) {
        console.log(
          `[NONE] #${scanned} ID ${company.id}: "${company.name}" → no agency detected`
        );
      }
    }

    await sleep(delayMs);
  }

  clearInterval(ticker);

  // Final stats
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const rivalCount = await db.select({ count: sql<number>`count(*)` }).from(schema.rivals);
  const linkCount = await db.select({ count: sql<number>`count(*)` }).from(schema.rivalClients);

  console.log(`\n=== ✅ Agency Detection Complete ===`);
  console.log(`Scanned: ${scanned} websites in ${totalTime}s`);
  console.log(`Agencies detected: ${agencyFound}`);
  console.log(`No agency: ${noAgency}`);
  console.log(`Fetch failed: ${fetchFailed}`);
  console.log(`Total rivals in DB: ${rivalCount[0]?.count}`);
  console.log(`Total rival-client links: ${linkCount[0]?.count}`);

  // Top agencies
  const topAgencies = await db
    .select({
      name: schema.rivals.name,
      domain: schema.rivals.domain,
      clients: schema.rivals.totalClients,
    })
    .from(schema.rivals)
    .orderBy(sql`total_clients DESC`)
    .limit(10);

  if (topAgencies.length > 0) {
    console.log(`\n🏆 Top Agencies:`);
    topAgencies.forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.name} (${a.domain || "?"}) — ${a.clients} clients`);
    });
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Agency detection failed:", err);
  process.exit(1);
});
