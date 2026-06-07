import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../lib/db/schema";
import { eq, isNull, and, sql } from "drizzle-orm";
import { isValidAgencyName, isValidAgencyDomain } from "../lib/crawler/detector";

const client = createClient({ url: "file:sqlite.db" });
const db = drizzle(client, { schema });

async function withDbRetry<T>(fn: () => Promise<T>, label: string, retries = 5): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (err?.code === "SQLITE_BUSY" && i < retries - 1) {
        const delay = Math.random() * 500 + 200;
        console.log(`[BUSY] DB locked during "${label}". Retrying in ${delay.toFixed(0)}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Failed after ${retries} retries`);
}

async function main() {
  console.log("=== 🧹 Eagle Eye Rivals Database Cleanup ===");
  
  // Set busy timeout to allow SQLite to wait for locks
  await db.run(sql`PRAGMA busy_timeout = 5000`);
  
  // 1. Fetch all rivals
  const allRivals = await db.select().from(schema.rivals);
  console.log(`Loaded ${allRivals.length} rivals from database.`);

  let deletedCount = 0;
  let resetCompaniesCount = 0;

  for (const rival of allRivals) {
    const isNameValid = isValidAgencyName(rival.name);
    const isDomainValid = rival.domain ? isValidAgencyDomain(rival.domain) : false;
    
    // We reject if the name is invalid, or if the domain is invalid
    // If it has no domain at all, we also reject it unless we explicitly want name-only rivals.
    // However, our detector needs a domain for it to be a real rival. 
    // And name-only rivals like "stránok" or "Hlavná stránka" are all junk anyway.
    const shouldDelete = !isNameValid || !rival.domain || !isDomainValid;

    if (shouldDelete) {
      console.log(`[JUNK] Rival: "${rival.name}" | Domain: "${rival.domain || "none"}" | Clients: ${rival.totalClients}`);
      
      // Update companies that reference this rival
      const affectedCompanies = await withDbRetry(
        () =>
          db
            .select({ id: schema.companies.id })
            .from(schema.companies)
            .where(eq(schema.companies.websiteAgencyId, rival.id)),
        `select affected companies for rival ${rival.id}`
      );

      if (affectedCompanies.length > 0) {
        const companyIds = affectedCompanies.map((c) => c.id);
        
        // Update companies: set websiteAgencyId to null
        await withDbRetry(
          () =>
            db
              .update(schema.companies)
              .set({ websiteAgencyId: null })
              .where(eq(schema.companies.websiteAgencyId, rival.id)),
          `reset companies for rival ${rival.id}`
        );
          
        resetCompaniesCount += companyIds.length;
        console.log(`  -> Reset websiteAgencyId to null for ${companyIds.length} companies.`);
      }

      // Delete from rival_clients join table
      await withDbRetry(
        () =>
          db
            .delete(schema.rivalClients)
            .where(eq(schema.rivalClients.rivalId, rival.id)),
        `delete client links for rival ${rival.id}`
      );

      // Delete from rivals table
      await withDbRetry(
        () =>
          db
            .delete(schema.rivals)
            .where(eq(schema.rivals.id, rival.id)),
        `delete rival ${rival.id}`
      );

      deletedCount++;
    }
  }

  console.log("\n=== Cleanup Summary ===");
  console.log(`Deleted ${deletedCount} invalid/false positive rivals.`);
  console.log(`Reset ${resetCompaniesCount} companies to be re-scanned.`);
  
  // Also count remaining rivals and client links
  const rivalsCount = await db.select({ count: sql<number>`count(*)` }).from(schema.rivals);
  const linksCount = await db.select({ count: sql<number>`count(*)` }).from(schema.rivalClients);
  
  console.log(`Remaining rivals in DB: ${rivalsCount[0]?.count}`);
  console.log(`Remaining rival-client links in DB: ${linksCount[0]?.count}`);
  
  process.exit(0);
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
