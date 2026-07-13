import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq, and, not } from "drizzle-orm";

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
  let body: any = null;
  try {
    const resolvedParams = await params;
    const companyId = parseInt(resolvedParams.id, 10);
    if (isNaN(companyId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    body = await request.json();
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
    const msg = error.message || String(error);
    if (msg.includes("UNIQUE constraint failed: companies.domain") || msg.includes("companies.domain")) {
      try {
        const dupDomain = extractDomain(body.website || "");
        if (dupDomain) {
          const existing = await db
            .select({ id: companies.id, name: companies.name })
            .from(companies)
            .where(eq(companies.domain, dupDomain))
            .limit(1);
          if (existing.length > 0) {
            return NextResponse.json(
              { error: `Tento web už patrí inej firme: ${existing[0].name} (ID: ${existing[0].id})` },
              { status: 409 }
            );
          }
        }
      } catch (e) {
        console.error("Error finding duplicate company:", e);
      }
      return NextResponse.json({ error: "Táto doména/webstránka už patrí inej firme v databáze." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
