import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies, websiteSnapshots } from "@/lib/db/schema";
import { eq, and, sql, not, isNull } from "drizzle-orm";

let cachedStats: any = null;
let lastFetched = 0;
let isRevalidating = false;
const CACHE_TTL = 3 * 60 * 1000; // Cache TTL of 3 minutes

async function computeStats() {
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
  // Execute a single pass query on website_snapshots to count all technologies at once
  const techResult = await db.all<any>(sql`
    SELECT 
      SUM(CASE WHEN tech_stack LIKE '%"WordPress"%' THEN 1 ELSE 0 END) AS WordPress,
      SUM(CASE WHEN tech_stack LIKE '%"Webflow"%' THEN 1 ELSE 0 END) AS Webflow,
      SUM(CASE WHEN tech_stack LIKE '%"Joomla"%' THEN 1 ELSE 0 END) AS Joomla,
      SUM(CASE WHEN tech_stack LIKE '%"Wix"%' THEN 1 ELSE 0 END) AS Wix,
      SUM(CASE WHEN tech_stack LIKE '%"Drupal"%' THEN 1 ELSE 0 END) AS Drupal,
      SUM(CASE WHEN tech_stack LIKE '%"Shoptet"%' THEN 1 ELSE 0 END) AS Shoptet,
      SUM(CASE WHEN tech_stack LIKE '%"Next.js"%' THEN 1 ELSE 0 END) AS NextJs,
      SUM(CASE WHEN tech_stack LIKE '%"Google Analytics"%' THEN 1 ELSE 0 END) AS GoogleAnalytics,
      SUM(CASE WHEN tech_stack LIKE '%"Facebook Pixel"%' THEN 1 ELSE 0 END) AS FacebookPixel,
      SUM(CASE WHEN tech_stack LIKE '%"Cloudflare"%' THEN 1 ELSE 0 END) AS Cloudflare
    FROM website_snapshots;
  `);

  const row = techResult[0] || {};

  const techBreakdown: Record<string, number> = {
    WordPress: Number(row.WordPress || 0),
    Webflow: Number(row.Webflow || 0),
    Joomla: Number(row.Joomla || 0),
    Wix: Number(row.Wix || 0),
    Drupal: Number(row.Drupal || 0),
    Shoptet: Number(row.Shoptet || 0),
    "Next.js": Number(row.NextJs || 0),
    "Google Analytics": Number(row.GoogleAnalytics || 0),
    "Facebook Pixel": Number(row.FacebookPixel || 0),
    Cloudflare: Number(row.Cloudflare || 0),
  };

  // 8. Top 5 Cities
  const citiesResult = await db
    .select({
      city: companies.city,
      count: sql<number>`count(*)`,
    })
    .from(companies)
    .groupBy(companies.city)
    .orderBy(sql`count(*) DESC`)
    .limit(6);

  const topCities = citiesResult
    .filter((c) => c.city !== null && c.city !== "")
    .slice(0, 5)
    .map((c) => ({
      name: c.city as string,
      count: c.count,
    }));

  return {
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
  };
}

export async function GET(request: NextRequest) {
  const now = Date.now();

  // If cache is fresh, return it
  if (cachedStats && (now - lastFetched < CACHE_TTL)) {
    return NextResponse.json(cachedStats);
  }

  // If already revalidating in background, return stale cache
  if (cachedStats && isRevalidating) {
    return NextResponse.json(cachedStats);
  }

  // Stale-While-Revalidate: return stale data, trigger background update
  if (cachedStats) {
    isRevalidating = true;
    computeStats()
      .then((stats) => {
        cachedStats = stats;
        lastFetched = Date.now();
        isRevalidating = false;
      })
      .catch((err) => {
        console.error("Error background revalidating stats:", err);
        isRevalidating = false;
      });
    return NextResponse.json(cachedStats);
  }

  // First page load: wait for it
  try {
    isRevalidating = true;
    const stats = await computeStats();
    cachedStats = stats;
    lastFetched = Date.now();
    isRevalidating = false;
    return NextResponse.json(stats);
  } catch (error: any) {
    isRevalidating = false;
    console.error("API Error in GET /api/stats:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

