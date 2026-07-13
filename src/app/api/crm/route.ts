import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { communications, companies } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const logs = await db
      .select({
        id: communications.id,
        companyId: communications.companyId,
        channel: communications.channel,
        occurredAt: communications.occurredAt,
        note: communications.bodyText,
        subject: communications.subject,
        companyName: companies.name,
        companyDomain: companies.domain,
        companyWebsite: companies.website,
      })
      .from(communications)
      .innerJoin(companies, eq(communications.companyId, companies.id))
      .where(eq(communications.source, "manual"))
      .orderBy(desc(communications.occurredAt))
      .limit(1000);

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error("API Error in GET /api/crm:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
