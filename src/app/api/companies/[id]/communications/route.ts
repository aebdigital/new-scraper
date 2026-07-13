import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { communications } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const companyId = parseInt(resolvedParams.id, 10);
    if (isNaN(companyId)) {
      return NextResponse.json({ error: "Invalid Company ID" }, { status: 400 });
    }

    const body = await request.json();
    const { channel, occurredAt, note } = body;

    if (!channel || (channel !== "call" && channel !== "email")) {
      return NextResponse.json({ error: "Invalid channel (must be call or email)" }, { status: 400 });
    }

    const inserted = await db
      .insert(communications)
      .values({
        companyId,
        channel,
        direction: "out",
        occurredAt: occurredAt || Date.now(),
        subject: note || `${channel === "call" ? "Call" : "Email"} log`,
        bodyText: note || "",
        source: "manual",
      })
      .returning();

    return NextResponse.json({ success: true, communication: inserted[0] });
  } catch (error: any) {
    console.error("API Error in POST /api/companies/[id]/communications:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const companyId = parseInt(resolvedParams.id, 10);
    if (isNaN(companyId)) {
      return NextResponse.json({ error: "Invalid Company ID" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const commIdStr = searchParams.get("commId");
    if (!commIdStr) {
      return NextResponse.json({ error: "Missing commId parameter" }, { status: 400 });
    }
    const commId = parseInt(commIdStr, 10);
    if (isNaN(commId)) {
      return NextResponse.json({ error: "Invalid commId" }, { status: 400 });
    }

    await db
      .delete(communications)
      .where(and(eq(communications.id, commId), eq(communications.companyId, companyId)));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API Error in DELETE /api/companies/[id]/communications:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
