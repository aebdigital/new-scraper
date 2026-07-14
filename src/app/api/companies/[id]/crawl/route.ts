import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies, websiteSnapshots, changeEvents, communications } from "@/lib/db/schema";
import { eq, desc, sql, getTableColumns } from "drizzle-orm";
import { crawlCompany } from "@/lib/crawler/worker";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const companyId = parseInt(resolvedParams.id, 10);
    if (isNaN(companyId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const companyData = await db
      .select({
        ...getTableColumns(companies),
        commCount: sql<number>`(SELECT COUNT(*) FROM communications WHERE company_id = ${companies.id} AND channel = 'email')`,
        hasWarning: sql<number>`EXISTS (SELECT 1 FROM communications WHERE company_id = ${companies.id} AND source = 'manual' AND subject = '[CRM:warning]')`,
      })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    const company = companyData[0];
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    if (!company.domain) {
      return NextResponse.json(
        { error: "Company has no website to crawl" },
        { status: 400 }
      );
    }

    // Execute crawl synchronously for this single request
    const success = await crawlCompany(company.id, company.domain);

    // Fetch updated company and its latest snapshot and events
    const updatedCompany = await db
      .select({
        ...getTableColumns(companies),
        commCount: sql<number>`(SELECT COUNT(*) FROM communications WHERE company_id = ${companies.id} AND channel = 'email')`,
        hasWarning: sql<number>`EXISTS (SELECT 1 FROM communications WHERE company_id = ${companies.id} AND source = 'manual' AND subject = '[CRM:warning]')`,
      })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    const latestSnapshots = await db
      .select()
      .from(websiteSnapshots)
      .where(eq(websiteSnapshots.companyId, companyId))
      .orderBy(desc(websiteSnapshots.crawledAt))
      .limit(1);

    const events = await db
      .select()
      .from(changeEvents)
      .where(eq(changeEvents.companyId, companyId))
      .orderBy(desc(changeEvents.timestamp))
      .limit(10);

    return NextResponse.json({
      success,
      company: updatedCompany[0],
      snapshot: latestSnapshots[0] || null,
      events,
    });
  } catch (error: any) {
    console.error("API Error in POST /api/companies/[id]/crawl:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Fetch single company details (with its latest snapshot & events)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const companyId = parseInt(resolvedParams.id, 10);
    if (isNaN(companyId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const companyData = await db
      .select({
        ...getTableColumns(companies),
        commCount: sql<number>`(SELECT COUNT(*) FROM communications WHERE company_id = ${companies.id} AND channel = 'email')`,
        hasWarning: sql<number>`EXISTS (SELECT 1 FROM communications WHERE company_id = ${companies.id} AND source = 'manual' AND subject = '[CRM:warning]')`,
      })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    const company = companyData[0];
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Fetch and cache historical financial charts from FinStat on-the-fly if missing
    if (company.ico && !company.financialHistory) {
      try {
        const url = `https://finstat.sk/${company.ico}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 seconds timeout max

        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const html = await res.text();

          const chartRegex = /\.finstatChart\((.*?)\);/g;
          let match;
          let zisk = null;
          let trzby = null;

          while ((match = chartRegex.exec(html)) !== null) {
            try {
              const parsed = JSON.parse(match[1]);
              if (parsed.title === "Zisk") {
                zisk = {
                  categories: parsed.categories,
                  values: parsed.series[0]?.data.map((d: any) => d.y) || []
                };
              } else if (parsed.title === "Tržby" || parsed.title === "Tr\u017eby") {
                trzby = {
                  categories: parsed.categories,
                  values: parsed.series[0]?.data.map((d: any) => d.y) || []
                };
              }
            } catch (e) {
              // Ignored
            }
          }

          if (zisk || trzby) {
            const history = JSON.stringify({ zisk, trzby });
            await db
              .update(companies)
              .set({ financialHistory: history })
              .where(eq(companies.id, companyId));

            company.financialHistory = history;
          }
        }
      } catch (err) {
        console.error(`Failed to fetch FinStat history for ICO ${company.ico}:`, err);
      }
    }

    const latestSnapshots = await db
      .select()
      .from(websiteSnapshots)
      .where(eq(websiteSnapshots.companyId, companyId))
      .orderBy(desc(websiteSnapshots.crawledAt))
      .limit(1);

    const events = await db
      .select()
      .from(changeEvents)
      .where(eq(changeEvents.companyId, companyId))
      .orderBy(desc(changeEvents.timestamp))
      .limit(10);

    const comms = await db
      .select()
      .from(communications)
      .where(eq(communications.companyId, companyId))
      .orderBy(desc(communications.occurredAt))
      .limit(200);

    return NextResponse.json({
      company,
      snapshot: latestSnapshots[0] || null,
      events,
      communications: comms,
    });
  } catch (error: any) {
    console.error("API Error in GET /api/companies/[id]/crawl:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
