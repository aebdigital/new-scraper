import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.substring(4);
    return host || null;
  } catch {
    return null;
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
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const { lastCalledAt, lastCalledNote, lastEmailedAt, lastEmailedNote, website } = body;

    const updateData: any = {};
    if (lastCalledAt !== undefined) updateData.lastCalledAt = lastCalledAt;
    if (lastCalledNote !== undefined) updateData.lastCalledNote = lastCalledNote;
    if (lastEmailedAt !== undefined) updateData.lastEmailedAt = lastEmailedAt;
    if (lastEmailedNote !== undefined) updateData.lastEmailedNote = lastEmailedNote;

    if (website !== undefined) {
      updateData.website = website ? website.trim() : null;
      if (website && website.trim()) {
        const domain = extractDomain(website.trim());
        updateData.domain = domain;
        updateData.status = "pending"; // Reset status so it crawls the website
        updateData.leadScore = 0; // Reset lead score to allow recalculation
      } else {
        updateData.domain = null;
        updateData.status = "pending";
        updateData.leadScore = 0;
      }
    }

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
