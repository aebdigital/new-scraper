import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rivals, rivalClients, companies } from "@/lib/db/schema";
import { eq, like, sql, desc, asc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sortBy") || "clients_desc";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = (page - 1) * limit;

  try {
    // Build conditions
    const conditions: any[] = [];
    if (search) {
      conditions.push(like(rivals.name, `%${search}%`));
    }

    // Determine sort
    let orderByClause;
    switch (sortBy) {
      case "clients_asc":
        orderByClause = asc(rivals.totalClients);
        break;
      case "clients_desc":
        orderByClause = desc(rivals.totalClients);
        break;
      case "name_asc":
        orderByClause = asc(rivals.name);
        break;
      case "name_desc":
        orderByClause = desc(rivals.name);
        break;
      case "recent":
        orderByClause = desc(rivals.firstSeen);
        break;
      default:
        orderByClause = desc(rivals.totalClients);
    }

    // Count total
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(rivals)
      .where(conditions.length > 0 ? conditions[0] : undefined);

    const total = countResult[0]?.count || 0;

    // Fetch rivals
    let query = db
      .select()
      .from(rivals)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    if (conditions.length > 0) {
      query = query.where(conditions[0]) as any;
    }

    const data = await query;

    return NextResponse.json({
      rivals: data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("Error fetching rivals:", error);
    return NextResponse.json(
      { error: "Failed to fetch rivals" },
      { status: 500 }
    );
  }
}
