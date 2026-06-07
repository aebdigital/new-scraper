import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies, websiteSnapshots } from "@/lib/db/schema";
import { eq, like, or, and, desc, asc, sql, not, isNull } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const search = searchParams.get("search") || "";
  const city = searchParams.get("city") || "";
  const status = searchParams.get("status") || "";
  const tag = searchParams.get("tag") || "";
  const tech = searchParams.get("tech") || "";
  const sortBy = searchParams.get("sortBy") || "score_desc";
  const naceSection = searchParams.get("naceSection") || "";
  const naceDivision = searchParams.get("naceDivision") || "";
  const naceSubdivision = searchParams.get("naceSubdivision") || "";
  const legalForm = searchParams.get("legalForm") || "";

  const offset = (page - 1) * limit;

  // Build filters
  const filters: any[] = [];

  if (search) {
    filters.push(
      or(
        like(companies.name, `%${search}%`),
        like(companies.domain, `%${search}%`),
        like(companies.website, `%${search}%`)
      )
    );
  }

  if (city) {
    filters.push(eq(companies.city, city));
  }

  if (status) {
    filters.push(eq(companies.status, status));
  }

  if (naceSection) {
    filters.push(eq(companies.naceSection, naceSection));
  }

  if (naceDivision) {
    filters.push(eq(companies.naceDivision, naceDivision));
  }

  if (naceSubdivision) {
    filters.push(eq(companies.naceSubdivision, naceSubdivision));
  }

  if (legalForm) {
    filters.push(eq(companies.legalFormCode, legalForm));
  }

  if (tag) {
    if (tag === "hot") {
      filters.push(sql`${companies.leadScore} >= 60`);
    } else if (tag === "warm") {
      filters.push(sql`${companies.leadScore} >= 35 AND ${companies.leadScore} < 60`);
    } else if (tag === "low") {
      filters.push(sql`${companies.leadScore} < 35`);
    } else if (tag === "no_website") {
      filters.push(isNull(companies.domain));
    }
  }

  // Sorting
  let orderByClause: any = desc(companies.leadScore);
  if (sortBy === "score_desc") {
    orderByClause = desc(companies.leadScore);
  } else if (sortBy === "score_asc") {
    orderByClause = asc(companies.leadScore);
  } else if (sortBy === "name_asc") {
    orderByClause = asc(companies.name);
  } else if (sortBy === "last_crawled_desc") {
    orderByClause = desc(companies.lastCrawledAt);
  } else if (sortBy === "revenue_desc") {
    orderByClause = desc(companies.revenue);
  } else if (sortBy === "revenue_asc") {
    orderByClause = asc(companies.revenue);
  }

  try {
    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    // Fetch data
    const data = await db
      .select()
      .from(companies)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // Fetch total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(companies)
      .where(whereClause);
    const totalCount = countResult[0]?.count || 0;

    return NextResponse.json({
      companies: data,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    console.error("API Error in GET /api/companies:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
