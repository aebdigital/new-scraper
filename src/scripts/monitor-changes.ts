import { db } from "../lib/db";
import { companies, changeEvents } from "../lib/db/schema";
import { crawlCompany } from "../lib/crawler/worker";
import { isNotNull, and, eq, or, sql, asc } from "drizzle-orm";

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function runBatch(limit: number, concurrency: number) {
  const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;

  // Find companies that are live/redirect (so they have active websites)
  // that haven't been crawled in the last 12 hours (or never crawled)
  // sorted by lastCrawledAt ASC to crawl the oldest first
  const targets = await db
    .select({
      id: companies.id,
      name: companies.name,
      domain: companies.domain,
      lastCrawledAt: companies.lastCrawledAt,
    })
    .from(companies)
    .where(
      and(
        isNotNull(companies.domain),
        or(
          eq(companies.status, "live"),
          eq(companies.status, "redirect")
        ),
        or(
          sql`${companies.lastCrawledAt} IS NULL`,
          sql`${companies.lastCrawledAt} < ${twelveHoursAgo}`
        )
      )
    )
    .orderBy(asc(companies.lastCrawledAt))
    .limit(limit);

  if (targets.length === 0) {
    return 0;
  }

  console.log(`\n[MONITOR] Batch size: ${targets.length} oldest websites. Running crawl...`);
  const batchStartTime = Date.now();

  const tasks = targets.map((target) => {
    return async () => {
      if (!target.domain) return false;
      try {
        const success = await crawlCompany(target.id, target.domain);
        if (!success) return false;

        // Check if a new change event was created during this crawl
        const newEvents = await db
          .select()
          .from(changeEvents)
          .where(
            and(
              eq(changeEvents.companyId, target.id),
              sql`timestamp >= ${batchStartTime}`
            )
          );

        if (newEvents.length > 0) {
          for (const ev of newEvents) {
            console.log(`🔥 [CHANGE DETECTED] for "${target.name}" (${target.domain}):`);
            console.log(`   └─ Type: ${ev.type.toUpperCase()}`);
            console.log(`   └─ Detail: ${ev.description}`);
          }
        } else {
          console.log(`[OK] Checked "${target.name}" (${target.domain}) — no changes.`);
        }
        return true;
      } catch (e: any) {
        console.error(`[MONITOR ERROR] Failed crawling ${target.domain}:`, e.message || e);
        return false;
      }
    };
  });

  const results = await runPool(tasks, concurrency);
  const duration = ((Date.now() - batchStartTime) / 1000).toFixed(1);
  const succeeded = results.filter(Boolean).length;
  console.log(`[MONITOR] Batch finished in ${duration}s. Succeeded: ${succeeded}/${targets.length}`);
  return targets.length;
}

async function main() {
  const args = process.argv.slice(2);
  let batchLimit = 50;
  let concurrency = 5;
  let delayBetweenBatches = 5000;
  let continuous = false;

  try {
    await db.run(sql`PRAGMA busy_timeout = 60000`);
  } catch (err) {
    console.warn("Could not set database busy timeout PRAGMA:", err);
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      batchLimit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--concurrency" && args[i + 1]) {
      concurrency = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--delay" && args[i + 1]) {
      delayBetweenBatches = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--continuous") {
      continuous = true;
    }
  }

  console.log("==================================================");
  console.log("   Eagle Eye Website Change Monitoring System     ");
  console.log("==================================================");
  console.log(`Configuration:`);
  console.log(`- Batch size:   ${batchLimit}`);
  console.log(`- Concurrency:  ${concurrency} parallel connections`);
  console.log(`- Continuous:   ${continuous ? "YES" : "NO (Single Run)"}`);
  if (continuous) {
    console.log(`- Delay:        ${delayBetweenBatches}ms between batches`);
  }
  console.log("==================================================");

  if (continuous) {
    while (true) {
      const count = await runBatch(batchLimit, concurrency);
      if (count === 0) {
        console.log("[MONITOR] All active websites checked in the last 12 hours. Sleeping for 5 minutes...");
        await wait(300000); // 5 minutes
      } else {
        console.log(`[MONITOR] Batch completed. Sleeping for ${delayBetweenBatches}ms before next batch...`);
        await wait(delayBetweenBatches);
      }
    }
  } else {
    await runBatch(batchLimit, concurrency);
    console.log("[MONITOR] Single run complete.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Monitor failed:", err);
  process.exit(1);
});
