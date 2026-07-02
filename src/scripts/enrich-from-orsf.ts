import { db } from "../lib/db";
import { companies } from "../lib/db/schema";
import { eq, isNull, and, not, sql } from "drizzle-orm";

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

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSqliteBusy(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("SQLITE_BUSY") || message.includes("database is locked");
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
      console.log(`[DB BUSY] ${label} — retry ${attempt}/${maxAttempts} in ${waitMs}ms`);
      await wait(waitMs);
    }
  }

  throw new Error(`DB retry failed for ${label}`);
}

async function lookupAndEnrichCompany(companyId: number, companyName: string): Promise<boolean> {
  const normalizedOriginalName = normalizeName(companyName);
  
  try {
    // 1. Search for company by name on ORSF
    const searchUrl = `https://api.orsf.sk/v1/search?q=${encodeURIComponent(companyName)}`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      console.log(`[ORSF] Search failed for "${companyName}": ${searchRes.statusText}`);
      return false;
    }

    const searchData = await searchRes.json();
    const hits = searchData.hits || [];
    if (hits.length === 0) {
      // No hits on ORSF: mark as enriched so we don't spam it next time
      await withDbRetry(
        () =>
          db
            .update(companies)
            .set({ orsfEnriched: 1 })
            .where(eq(companies.id, companyId)),
        `mark no ORSF hit for company ${companyId}`
      );
      return false;
    }

    // Find first hit that matches normalized name
    let bestHit: any = null;
    for (const hit of hits) {
      if (normalizeName(hit.name) === normalizedOriginalName) {
        bestHit = hit;
        break;
      }
    }

    // Fallback: if no exact normalized match, take the very first hit if it contains the first word of the name
    if (!bestHit && hits.length > 0) {
      const firstWord = normalizedOriginalName.substring(0, 6);
      if (firstWord && normalizeName(hits[0].name).startsWith(firstWord)) {
        bestHit = hits[0];
      }
    }

    if (!bestHit) {
      // No match: mark as enriched so we don't spam it next time
      await withDbRetry(
        () =>
          db
            .update(companies)
            .set({ orsfEnriched: 1 })
            .where(eq(companies.id, companyId)),
        `mark unmatched ORSF hit for company ${companyId}`
      );
      return false;
    }

    const ico = bestHit.ico;
    console.log(`[MATCH] Found IČO ${ico} for "${companyName}" (Hit: "${bestHit.name}")`);

    // 2. Fetch full company details and filings from ORSF
    const detailUrl = `https://api.orsf.sk/v1/companies/${ico}`;
    const detailRes = await fetch(detailUrl);
    if (!detailRes.ok) {
      return false;
    }

    const companyData = await detailRes.json();
    const filings = companyData.filings || [];

    let revenue: number | null = null;
    let profit: number | null = null;
    let assets: number | null = null;
    let financialYear: number | null = null;

    if (filings.length > 0) {
      // Sort filings by period descending to get latest statement
      const sortedFilings = [...filings].sort((a, b) => parseInt(b.period || "0") - parseInt(a.period || "0"));
      
      // Look for the latest filing that contains financialStatement data
      for (const f of sortedFilings) {
        if (f.financialStatement && f.financialStatement.revenue) {
          revenue = parseInt(f.financialStatement.revenue, 10);
          profit = f.financialStatement.netIncome ? parseInt(f.financialStatement.netIncome, 10) : null;
          assets = f.financialStatement.assets ? parseInt(f.financialStatement.assets, 10) : null;
          financialYear = parseInt(f.period, 10);
          break;
        }
      }
    }

    // Address consolidation
    const street = companyData.street || companyData.address?.street || null;
    const city = companyData.city || companyData.address?.city || null;
    const zip = companyData.psc || companyData.address?.psc || null;
    let address = null;
    if (street && city) {
      address = `${street}, ${zip ? zip + ' ' : ''}${city}`;
    }

    // Parse NACE code and legal form
    const nace = companyData.nace || null; // string (e.g. "43210")
    let naceSection = null;
    let naceDivision = null;
    let naceSubdivision = null;

    if (nace && typeof nace === "string" && nace.length >= 2) {
      naceDivision = nace.substring(0, 2);
      naceSubdivision = nace;
      
      const divNum = parseInt(naceDivision, 10);
      if (divNum >= 1 && divNum <= 3) naceSection = "A";
      else if (divNum >= 5 && divNum <= 9) naceSection = "B";
      else if (divNum >= 10 && divNum <= 33) naceSection = "C";
      else if (divNum === 35) naceSection = "D";
      else if (divNum >= 36 && divNum <= 39) naceSection = "E";
      else if (divNum >= 41 && divNum <= 43) naceSection = "F";
      else if (divNum >= 45 && divNum <= 47) naceSection = "G";
      else if (divNum >= 49 && divNum <= 53) naceSection = "H";
      else if (divNum >= 55 && divNum <= 56) naceSection = "I";
      else if (divNum >= 58 && divNum <= 63) naceSection = "J";
      else if (divNum >= 64 && divNum <= 66) naceSection = "K";
      else if (divNum === 68) naceSection = "L";
      else if (divNum >= 69 && divNum <= 75) naceSection = "M";
      else if (divNum >= 77 && divNum <= 82) naceSection = "N";
      else if (divNum === 84) naceSection = "O";
      else if (divNum === 85) naceSection = "P";
      else if (divNum >= 86 && divNum <= 88) naceSection = "Q";
      else if (divNum >= 90 && divNum <= 93) naceSection = "R";
      else if (divNum >= 94 && divNum <= 96) naceSection = "S";
      else if (divNum >= 97 && divNum <= 98) naceSection = "T";
      else if (divNum === 99) naceSection = "U";
    }

    // Determine legal form
    const legalForm = companyData.legalForm || companyData.legalFormCode || null;
    let legalFormCode = "sole_trader";
    if (legalForm) {
      const lf = legalForm.toLowerCase();
      if (lf.includes("sro") || lf.includes("ručením obmedzeným") || lf.includes("akciová") || lf.includes("a.s.") || lf.includes("spoločnosť")) {
        legalFormCode = "sro";
      }
    } else {
      const nameLower = companyName.toLowerCase();
      if (nameLower.includes("s.r.o.") || nameLower.includes("s. r. o.") || nameLower.includes("spol. s r.o.") || nameLower.includes("a.s.")) {
        legalFormCode = "sro";
      }
    }

    // Update database record
    await withDbRetry(
      () =>
        db
          .update(companies)
          .set({
            revenue: isNaN(revenue as any) ? null : revenue,
            profit: isNaN(profit as any) ? null : profit,
            assets: isNaN(assets as any) ? null : assets,
            financialYear: isNaN(financialYear as any) ? null : financialYear,
            city: city || undefined,
            address: address || undefined,
            nace: nace || undefined,
            naceSection: naceSection || undefined,
            naceDivision: naceDivision || undefined,
            naceSubdivision: naceSubdivision || undefined,
            legalFormCode: legalFormCode || undefined,
            orsfEnriched: 1,
          })
          .where(eq(companies.id, companyId)),
      `save ORSF financials for company ${companyId}`
    );

    console.log(`[UPDATE] ID ${companyId}: Rev: ${revenue?.toLocaleString() || 0} €, Profit: ${profit?.toLocaleString() || 0} € (NACE: ${nace})`);
    return true;
  } catch (error: any) {
    console.error(`[ERROR] Failed to enrich "${companyName}":`, error.message || error);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  let limit = 50; // Default limits per run to avoid spamming the public API
  let delayMs = 350; // Rate-limiting delay (approx 3 requests/sec)

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--delay" && args[i + 1]) {
      delayMs = parseInt(args[i + 1], 10);
      i++;
    }
  }

  console.log("=== ORSF Financial Data Enricher ===");
  console.log(`Config: Limit = ${limit}, Delay = ${delayMs}ms`);

  await withDbRetry(
    () => db.run(sql`PRAGMA busy_timeout = 60000`),
    "set busy timeout"
  );

  // Query companies that:
  // - Are of legal form 'sro'
  // - Have not been enriched from ORSF yet
  const targets = await withDbRetry(
    () =>
      db
        .select({
          id: companies.id,
          name: companies.name,
        })
        .from(companies)
        .where(
          and(
            eq(companies.legalFormCode, "sro"),
            eq(companies.orsfEnriched, 0)
          )
        )
        .limit(limit),
    "load ORSF enrichment targets"
  );

  if (targets.length === 0) {
    console.log("No sro companies without revenue data found! Exiting.");
    process.exit(0);
  }

  console.log(`Found ${targets.length} targets for financial enrichment. Running lookup...`);
  let enrichedCount = 0;

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const success = await lookupAndEnrichCompany(target.id, target.name);
    if (success) enrichedCount++;
    
    // Rate-limiting pause
    await wait(delayMs);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Successfully enriched: ${enrichedCount} / ${targets.length} companies.`);
  process.exit(0);
}

main().catch(console.error);
