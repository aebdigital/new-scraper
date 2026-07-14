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
    const tag = searchParams.get("tag");
    const marker = searchParams.get("marker");

    if (tag) {
      const allowedTags = new Set(["new_website", "new_site_coming", "no_website"]);
      if (!allowedTags.has(tag)) {
        return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
      }

      await db
        .delete(communications)
        .where(
          and(
            eq(communications.companyId, companyId),
            eq(communications.source, "manual"),
            eq(communications.subject, `[TAG:${tag}]`)
          )
        );

      return NextResponse.json({ success: true });
    }

    if (marker) {
      const markerSql =
        marker === "next_day_lead"
          ? sql`${communications.bodyText} = '[NEXT_DAY_LEAD] New lead'`
          : marker === "new_site_coming_lead"
          ? sql`${communications.bodyText} like '%[STAR:coming]%'`
          : marker === "broken_website_lead"
          ? sql`${communications.bodyText} like '%[HEART:broken]%'`
          : null;

      if (!markerSql) {
        return NextResponse.json({ error: "Invalid marker" }, { status: 400 });
      }

      await db
        .delete(communications)
        .where(
          and(
            eq(communications.companyId, companyId),
            eq(communications.source, "manual"),
            markerSql
          )
        );

      return NextResponse.json({ success: true });
    }

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
    const { commId, note, occurredAt } = body;
    if (!commId || (note === undefined && occurredAt === undefined)) {
      return NextResponse.json({ error: "Missing commId, note, or occurredAt" }, { status: 400 });
    }

    const updateValues: { bodyText?: string; subject?: string; occurredAt?: number } = {};

    if (occurredAt !== undefined) {
      const nextOccurredAt = Number(occurredAt);
      if (!Number.isFinite(nextOccurredAt)) {
        return NextResponse.json({ error: "Invalid occurredAt" }, { status: 400 });
      }
      updateValues.occurredAt = nextOccurredAt;
    }

    if (note !== undefined) {
      const existing = await db
        .select({ subject: communications.subject })
        .from(communications)
        .where(and(eq(communications.id, commId), eq(communications.companyId, companyId)))
        .limit(1);

      const keepSubject = isCrmOutcomeSubject(existing[0]?.subject);
      updateValues.bodyText = note;
      if (!keepSubject) updateValues.subject = note;
    }

    await db
      .update(communications)
      .set(updateValues)
      .where(and(eq(communications.id, commId), eq(communications.companyId, companyId)));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API Error in PATCH /api/companies/[id]/communications:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
