import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const companyId = parseInt(resolvedParams.id, 10);
    if (isNaN(companyId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const { lastCalledAt, lastCalledNote, lastEmailedAt, lastEmailedNote } = body;

    const updateData: any = {};
    if (lastCalledAt !== undefined) updateData.lastCalledAt = lastCalledAt;
    if (lastCalledNote !== undefined) updateData.lastCalledNote = lastCalledNote;
    if (lastEmailedAt !== undefined) updateData.lastEmailedAt = lastEmailedAt;
    if (lastEmailedNote !== undefined) updateData.lastEmailedNote = lastEmailedNote;

    await db
      .update(companies)
      .set(updateData)
      .where(eq(companies.id, companyId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API Error in PATCH /api/companies/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
