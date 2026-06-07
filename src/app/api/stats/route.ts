import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies, websiteSnapshots } from "@/lib/db/schema";
import { eq, and, sql, not, isNull } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    // 1. Total Companies count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(companies);
    const total = totalResult[0]?.count || 0;

    // 2. Pending crawls count
    const pendingResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(companies)
      .where(eq(companies.status, "pending"));
    const pending = pendingResult[0]?.count || 0;

    // 3. No website / Dead count (status = 'dead' or domain is null)
    const deadResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(companies)
      .where(sql`${companies.status} = 'dead' OR ${companies.domain} IS NULL`);
    const dead = deadResult[0]?.count || 0;

    // 4. Live websites count
    const liveResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(companies)
      .where(sql`${companies.status} = 'live'`);
    const live = liveResult[0]?.count || 0;

    // 5. Redirect websites count
    const redirectResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(companies)
      .where(sql`${companies.status} = 'redirect'`);
    const redirect = redirectResult[0]?.count || 0;

    // 6. Lead scoring counts
    const hotResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(companies)
      .where(sql`${companies.leadScore} >= 60`);
    const hot = hotResult[0]?.count || 0;

    const warmResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(companies)
      .where(sql`${companies.leadScore} >= 35 AND ${companies.leadScore} < 60`);
    const warm = warmResult[0]?.count || 0;

    const lowResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(companies)
      .where(sql`${companies.leadScore} < 35 AND ${companies.status} IN ('live', 'redirect')`);
    const low = lowResult[0]?.count || 0;

    // 7. Tech Stack Breakdown (counts in the snapshots table)
    // We select the latest snapshot for each company, then check for technology presence
    const techBreakdown: Record<string, number> = {
      WordPress: 0,
      Webflow: 0,
      Joomla: 0,
      Wix: 0,
      Drupal: 0,
      Shoptet: 0,
      "Next.js": 0,
      "Google Analytics": 0,
      "Facebook Pixel": 0,
      Cloudflare: 0,
    };

    // SQLite query: count how many snapshots contain specific strings in tech_stack JSON
    for (const key of Object.keys(techBreakdown)) {
      const searchKey = key === "Shoptet" ? "Shoptet" : key;
      const techResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(websiteSnapshots)
        .where(sql`tech_stack LIKE ${`%"${searchKey}"%`}`);
      techBreakdown[key] = techResult[0]?.count || 0;
    }

    // 8. Top 5 Cities
    const citiesResult = await db
      .select({
        city: companies.city,
        count: sql<number>`count(*)`,
      })
      .from(companies)
      .groupBy(companies.city)
      .orderBy(sql`count(*) DESC`)
      .limit(6); // fetch 6 in case 'null' is one of them

    const topCities = citiesResult
      .filter((c) => c.city !== null && c.city !== "")
      .slice(0, 5)
      .map((c) => ({
        name: c.city as string,
        count: c.count,
      }));

    return NextResponse.json({
      total,
      pending,
      crawled: total - pending,
      dead,
      live,
      redirect,
      scoring: {
        hot,
        warm,
        low,
      },
      technologies: techBreakdown,
      topCities,
    });
  } catch (error: any) {
    console.error("API Error in GET /api/stats:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
