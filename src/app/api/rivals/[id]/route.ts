import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rivals, rivalClients, companies } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rivalId = parseInt(id, 10);

  if (isNaN(rivalId)) {
    return NextResponse.json({ error: "Invalid rival ID" }, { status: 400 });
  }

  try {
    // Fetch the rival
    const rivalData = await db
      .select()
      .from(rivals)
      .where(eq(rivals.id, rivalId))
      .limit(1);

    if (rivalData.length === 0) {
      return NextResponse.json({ error: "Rival not found" }, { status: 404 });
    }

    // Fetch all clients of this rival with company details
    const clientsData = await db
      .select({
        linkId: rivalClients.id,
        detectionMethod: rivalClients.detectionMethod,
        confidenceScore: rivalClients.confidenceScore,
        firstDetectedAt: rivalClients.firstDetectedAt,
        lastConfirmedAt: rivalClients.lastConfirmedAt,
        companyId: companies.id,
        companyName: companies.name,
        companyDomain: companies.domain,
        companyWebsite: companies.website,
        companyCity: companies.city,
        companyRevenue: companies.revenue,
        companyProfit: companies.profit,
        companyNace: companies.nace,
        companyNaceSection: companies.naceSection,
        companyLegalFormCode: companies.legalFormCode,
      })
      .from(rivalClients)
      .innerJoin(companies, eq(rivalClients.companyId, companies.id))
      .where(eq(rivalClients.rivalId, rivalId))
      .orderBy(sql`companies.revenue DESC NULLS LAST`);

    return NextResponse.json({
      rival: rivalData[0],
      clients: clientsData,
    });
  } catch (error: any) {
    console.error("Error fetching rival details:", error);
    return NextResponse.json(
      { error: "Failed to fetch rival details" },
      { status: 500 }
    );
  }
}
