import { db } from "../lib/db";
import { companies } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function lookupAndEnrichCompany(companyId: number, companyName: string): Promise<boolean> {
  try {
    const searchUrl = `https://api.orsf.sk/v1/search?q=${encodeURIComponent(companyName)}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const hits = searchData.hits || [];
    const bestHit = hits[0];
    const ico = bestHit.ico;

    const detailUrl = `https://api.orsf.sk/v1/companies/${ico}`;
    const detailRes = await fetch(detailUrl);
    const companyData = await detailRes.json();

    const city = companyData.city || companyData.address?.city || null;
    const street = companyData.street || companyData.address?.street || null;
    const zip = companyData.psc || companyData.address?.psc || null;
    let address = null;
    if (street && city) {
      address = `${street}, ${zip ? zip + ' ' : ''}${city}`;
    }

    console.log("Details fetched from ORSF:", { city, address });

    // Update database record
    await db
      .update(companies)
      .set({
        revenue: null,
        profit: null,
        assets: null,
        financialYear: null,
        city: city || undefined,
        address: address || undefined,
      })
      .where(eq(companies.id, companyId));

    console.log("Update succeeded inside test!");
    return true;
  } catch (error: any) {
    console.error("Enrich failed with error:");
    console.error("Message:", error.message);
    console.error("Code:", error.code);
    console.error("Keys of error:", Object.keys(error));
    console.error("Stack:", error.stack);
    console.error("Raw error:", error);
    return false;
  }
}

async function run() {
  await lookupAndEnrichCompany(57, "Slavomír Rusnák - Elektrikár inštalatér NONSTOP");
  process.exit(0);
}

run();
