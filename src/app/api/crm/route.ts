import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { communications, companies } from "@/lib/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";

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
        commCount: sql<number>`(SELECT COUNT(*) FROM communications WHERE company_id = ${companies.id} AND channel = 'email')`,
      })
      .from(communications)
      .innerJoin(companies, eq(communications.companyId, companies.id))
      .where(and(eq(communications.source, "manual"), sql`coalesce(${communications.subject}, '') not like '[TAG:%'`))
      .orderBy(desc(communications.occurredAt))
      .limit(1000);

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error("API Error in GET /api/crm:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
