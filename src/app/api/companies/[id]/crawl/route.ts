import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies, websiteSnapshots, changeEvents, communications } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
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
      .select()
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
      .select()
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
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    const company = companyData[0];
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
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
