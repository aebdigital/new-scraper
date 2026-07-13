import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { communications } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

const isCrmOutcomeSubject = (value: string | null | undefined) => {
  const text = (value || "").toLowerCase();
  return (
    text.startsWith("[crm:") ||
    text.includes("zavolať znova") ||
    text.includes("pripomenúť ďalší deň") ||
    text.includes("nezdvihol") ||
    text.includes("nový záujem")
  );
};

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
    const { channel, occurredAt, note, outcome } = body;

    if (!channel || (channel !== "call" && channel !== "email" && channel !== "view")) {
      return NextResponse.json({ error: "Invalid channel (must be call, email, or view)" }, { status: 400 });
    }

    const inserted = await db
      .insert(communications)
      .values({
        companyId,
        channel,
        direction: "out",
        occurredAt: occurredAt || Date.now(),
        subject: outcome ? `[CRM:${outcome}]` : note || `${channel === "call" ? "Call" : channel === "email" ? "Email" : "CRM Tracker"} log`,
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
    const allForDate = searchParams.get("allForDate");

    if (allForDate) {
      const dateParts = allForDate.split("-");
      if (dateParts.length === 3) {
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const day = parseInt(dateParts[2], 10);

        const startOfDay = new Date(year, month, day, 0, 0, 0, 0).getTime();
        const endOfDay = new Date(year, month, day, 23, 59, 59, 999).getTime();

        await db
          .delete(communications)
          .where(
            and(
              eq(communications.companyId, companyId),
              eq(communications.source, "manual"),
              sql`${communications.occurredAt} >= ${startOfDay} AND ${communications.occurredAt} <= ${endOfDay}`
            )
          );

        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ error: "Invalid date format (must be YYYY-MM-DD)" }, { status: 400 });
    }

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

export async function PATCH(
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
    const { commId, note } = body;
    if (!commId || note === undefined) {
      return NextResponse.json({ error: "Missing commId or note" }, { status: 400 });
    }

    const existing = await db
      .select({ subject: communications.subject })
      .from(communications)
      .where(and(eq(communications.id, commId), eq(communications.companyId, companyId)))
      .limit(1);

    const keepSubject = isCrmOutcomeSubject(existing[0]?.subject);

    await db
      .update(communications)
      .set(keepSubject ? { bodyText: note } : { bodyText: note, subject: note })
      .where(and(eq(communications.id, commId), eq(communications.companyId, companyId)));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API Error in PATCH /api/companies/[id]/communications:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
