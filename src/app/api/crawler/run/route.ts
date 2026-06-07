import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { crawlCompany } from "@/lib/crawler/worker";
import { isNull, and, not, eq } from "drizzle-orm";

async function runPool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const active: Promise<any>[] = [];
  const results: Promise<T>[] = [];

  for (const task of tasks) {
    const p = task();
    results.push(p);

    const activePromise = p.then(() => {
      active.splice(active.indexOf(activePromise), 1);
    });
    active.push(activePromise);

    if (active.length >= limit) {
      await Promise.race(active);
    }
  }

  return Promise.all(results);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(parseInt(body.limit || "20", 10), 50); // limit max 50 per api call
    const concurrency = Math.min(parseInt(body.concurrency || "5", 10), 10); // limit max 10 concurrent

    // Fetch pending companies
    const targets = await db
      .select({
        id: companies.id,
        name: companies.name,
        domain: companies.domain,
      })
      .from(companies)
      .where(
        and(
          not(isNull(companies.domain)),
          eq(companies.status, "pending")
        )
      )
      .limit(limit);

    if (targets.length === 0) {
      return NextResponse.json({
        message: "No pending domains to crawl.",
        crawledCount: 0,
      });
    }

    const startTime = Date.now();
    const tasks = targets.map((target) => {
      return async () => {
        if (!target.domain) return false;
        try {
          return await crawlCompany(target.id, target.domain);
        } catch (e) {
          return false;
        }
      };
    });

    const results = await runPool(tasks, concurrency);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const succeeded = results.filter(Boolean).length;

    return NextResponse.json({
      message: `Batch crawl completed in ${duration}s`,
      totalTargeted: targets.length,
      succeededCount: succeeded,
      durationSeconds: parseFloat(duration),
    });
  } catch (error: any) {
    console.error("API Error in POST /api/crawler/run:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
