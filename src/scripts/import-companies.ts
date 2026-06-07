import * as fs from "fs";
import * as path from "path";
import * as xlsx from "xlsx";
import { db } from "../lib/db";
import { companies } from "../lib/db/schema";
import { eq } from "drizzle-orm";

interface RawImportData {
  name: string;
  city: string | null;
  website: string | null;
  domain: string | null;
  phone: string | null;
  address: string | null;
  emailsFound: string | null;
  source: string;
}

function cleanDomain(urlStr: any): string | null {
  if (!urlStr || typeof urlStr !== "string") return null;
  let str = urlStr.trim();
  if (!str) return null;
  // If it's a social link or email, ignore it
  if (str.includes("mailto:") || str.includes("facebook.com") || str.includes("instagram.com")) {
    return null;
  }
  if (!str.startsWith("http://") && !str.startsWith("https://")) {
    str = "http://" + str;
  }
  try {
    const parsed = new URL(str);
    let domain = parsed.hostname.toLowerCase();
    if (domain.startsWith("www.")) {
      domain = domain.substring(4);
    }
    return domain || null;
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log("Starting import script...");

  const instalaterPath = path.resolve(process.cwd(), "instalater.xlsx");
  const stavebnaPath = path.resolve(process.cwd(), "stavebna_firma_contacts.xlsx");

  const companyMap = new Map<string, RawImportData>();
  const noWebsiteCompanies: RawImportData[] = [];

  // 1. Process instalater.xlsx
  if (fs.existsSync(instalaterPath)) {
    console.log("Reading instalater.xlsx...");
    const workbook = xlsx.readFile(instalaterPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = xlsx.utils.sheet_to_json(sheet);
    console.log(`Found ${rows.length} rows in instalater.xlsx`);

    for (const row of rows) {
      const name = row.business_name || row.company_name || "";
      if (!name) continue;

      const website = row.website || null;
      const domain = cleanDomain(website);
      const city = row.city || null;

      const item: RawImportData = {
        name: String(name).trim(),
        city: city ? String(city).trim() : null,
        website: website ? String(website).trim() : null,
        domain,
        phone: null,
        address: null,
        emailsFound: null,
        source: "instalater",
      };

      if (domain) {
        companyMap.set(domain, item);
      } else {
        noWebsiteCompanies.push(item);
      }
    }
  } else {
    console.log("instalater.xlsx not found!");
  }

  // 2. Process stavebna_firma_contacts.xlsx
  if (fs.existsSync(stavebnaPath)) {
    console.log("Reading stavebna_firma_contacts.xlsx...");
    const workbook = xlsx.readFile(stavebnaPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = xlsx.utils.sheet_to_json(sheet);
    console.log(`Found ${rows.length} rows in stavebna_firma_contacts.xlsx`);

    for (const row of rows) {
      const name = row.company_name || row.business_name || "";
      if (!name) continue;

      const website = row.website || null;
      const domain = cleanDomain(website);
      const city = row.city || null;
      const phone = row.phone || null;
      const address = row.address || null;
      const emailsFound = row.emails_found || null;

      const item: RawImportData = {
        name: String(name).trim(),
        city: city ? String(city).trim() : null,
        website: website ? String(website).trim() : null,
        domain,
        phone: phone ? String(phone).trim() : null,
        address: address ? String(address).trim() : null,
        emailsFound: emailsFound ? String(emailsFound).trim() : null,
        source: "stavebna_firma",
      };

      if (domain) {
        const existing = companyMap.get(domain);
        if (existing) {
          // Merge details (prefer stavebna contacts as they are richer)
          companyMap.set(domain, {
            name: item.name || existing.name,
            city: item.city || existing.city,
            website: item.website || existing.website,
            domain: domain,
            phone: item.phone || existing.phone,
            address: item.address || existing.address,
            emailsFound: item.emailsFound || existing.emailsFound,
            source: `${existing.source}+${item.source}`,
          });
        } else {
          companyMap.set(domain, item);
        }
      } else {
        noWebsiteCompanies.push(item);
      }
    }
  } else {
    console.log("stavebna_firma_contacts.xlsx not found!");
  }

  const uniqueDomainsCount = companyMap.size;
  const noWebsiteCount = noWebsiteCompanies.length;
  console.log(`Parsed total unique domains: ${uniqueDomainsCount}`);
  console.log(`Parsed companies with no website: ${noWebsiteCount}`);

  // 3. Insert into Database in Batches
  const allToInsert = [...companyMap.values(), ...noWebsiteCompanies];
  console.log(`Inserting ${allToInsert.length} total companies into database...`);

  // Clear existing table to ensure clean import
  // (In SQLite, we can just delete from companies)
  try {
    await db.delete(companies);
    console.log("Cleared existing companies table.");
  } catch (e) {
    console.log("Error clearing table, proceeding...", e);
  }

  const batchSize = 200;
  let inserted = 0;

  for (let i = 0; i < allToInsert.length; i += batchSize) {
    const batch = allToInsert.slice(i, i + batchSize).map((item) => {
      // Calculate a default initial lead score
      // "No website" is an immediate high lead signal: +30
      let initialScore = 0;
      let status = "pending";
      if (!item.domain) {
        initialScore = 30; // +30 for no website
        status = "dead";   // No site is effectively a dead site to crawl
      }

      return {
        name: item.name,
        city: item.city,
        website: item.website,
        domain: item.domain, // unique or null
        phone: item.phone,
        address: item.address,
        emailsFound: item.emailsFound,
        leadScore: initialScore,
        status: status,
      };
    });

    try {
      await db.insert(companies).values(batch);
      inserted += batch.length;
      if (inserted % 1000 === 0 || inserted === allToInsert.length) {
        console.log(`Inserted ${inserted} / ${allToInsert.length} companies...`);
      }
    } catch (e) {
      console.error(`Error inserting batch at index ${i}:`, e);
      // Fallback: try inserting one by one in case of single domain conflicts
      for (const item of batch) {
        try {
          await db.insert(companies).values(item);
        } catch (singleErr) {
          // If duplicate domain error, we skip or update
        }
      }
    }
  }

  console.log(`Successfully imported ${inserted} companies into the SQLite database!`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Critical error in main:", err);
  process.exit(1);
});
