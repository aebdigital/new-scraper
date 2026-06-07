import { db } from "../lib/db";
import { companies } from "../lib/db/schema";
import { eq, and, sql, not, isNull } from "drizzle-orm";

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // Clear terminal
  console.clear();
  console.log("==================================================");
  console.log("    Eagle Eye Crawler Live Progress Monitor       ");
  console.log("==================================================");

  // Total domains with websites in database
  const totalDomainsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(companies)
    .where(not(isNull(companies.domain)));
  const totalDomains = totalDomainsResult[0]?.count || 0;

  while (true) {
    try {
      // Succeeded/failed crawls (status is no longer pending)
      const crawledResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(companies)
        .where(
          and(
            not(isNull(companies.domain)),
            not(eq(companies.status, "pending"))
          )
        );
      const crawled = crawledResult[0]?.count || 0;

      // Pending crawls
      const pendingResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(companies)
        .where(
          and(
            not(isNull(companies.domain)),
            eq(companies.status, "pending")
          )
        );
      const pending = pendingResult[0]?.count || 0;

      // Status breakdowns
      const liveResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(companies)
        .where(eq(companies.status, "live"));
      const live = liveResult[0]?.count || 0;

      const deadResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(companies)
        .where(and(eq(companies.status, "dead"), not(isNull(companies.domain))));
      const dead = deadResult[0]?.count || 0;

      const redirectResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(companies)
        .where(eq(companies.status, "redirect"));
      const redirect = redirectResult[0]?.count || 0;

      // Lead quality breakdowns
      const hotResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(companies)
        .where(and(not(isNull(companies.domain)), sql`${companies.leadScore} >= 60`));
      const hot = hotResult[0]?.count || 0;

      const warmResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(companies)
        .where(and(not(isNull(companies.domain)), sql`${companies.leadScore} >= 35 AND ${companies.leadScore} < 60`));
      const warm = warmResult[0]?.count || 0;

      const progress = ((crawled / totalDomains) * 100).toFixed(1);

      // Render progress in console
      process.stdout.write("\x1B[H\x1B[2J"); // cursor to home and clear screen
      console.log("==================================================");
      console.log("    Eagle Eye Crawler Live Progress Monitor       ");
      console.log("==================================================");
      console.log(`Progress:     ${progress}%`);
      console.log(`Total Sites:  ${totalDomains}`);
      console.log(`Audited:      ${crawled}`);
      console.log(`Remaining:    ${pending}`);
      console.log("--------------------------------------------------");
      console.log(`Live:         ${live} sites`);
      console.log(`Dead/Down:    ${dead} sites`);
      console.log(`Redirects:    ${redirect} sites`);
      console.log("--------------------------------------------------");
      console.log(`🔥 Hot Leads:  ${hot}`);
      console.log(`🟡 Warm Leads: ${warm}`);
      console.log("==================================================");
      console.log("Press Ctrl+C to exit monitor. Crawl runs in bg.");

      if (pending === 0) {
        console.log("\n[CRAWL COMPLETED SUCCESSFULY!]");
        break;
      }
    } catch (e: any) {
      console.log("Error querying progress: ", e.message || e);
    }
    await wait(1500);
  }
}

main().catch(console.error);
