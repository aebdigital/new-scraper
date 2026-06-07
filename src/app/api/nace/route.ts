import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const division = searchParams.get("division") || "";

  try {
    if (!division) {
      return NextResponse.json({ error: "Missing division parameter" }, { status: 400 });
    }

    // Fetch unique subdivisions present in the DB for this division
    const result = await db
      .select({
        code: companies.naceSubdivision,
      })
      .from(companies)
      .where(
        and(
          eq(companies.naceDivision, division),
          isNotNull(companies.naceSubdivision)
        )
      )
      .groupBy(companies.naceSubdivision)
      .orderBy(companies.naceSubdivision);

    const codes = result
      .map((r) => r.code)
      .filter(Boolean) as string[];

    return NextResponse.json({ subdivisions: codes });
  } catch (error: any) {
    console.error("Error fetching NACE subdivisions:", error);
    return NextResponse.json({ error: "Failed to fetch NACE subdivisions" }, { status: 500 });
  }
}
