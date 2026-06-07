import { db } from "../lib/db";
import { companies } from "../lib/db/schema";
import { crawlCompany } from "../lib/crawler/worker";
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

async function main() {
  const args = process.argv.slice(2);
  let limit = 20; // Default crawl batch size
  let concurrency = 5; // Default parallel connections

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--concurrency" && args[i + 1]) {
      concurrency = parseInt(args[i + 1], 10);
      i++;
    }
  }

  console.log(`=== Eagle Eye Crawler Runner ===`);
  console.log(`Config: Batch Limit = ${limit}, Concurrency = ${concurrency}`);

  // Fetch companies to crawl: must have a domain (not null) and not crawled yet (or oldest crawled first)
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
        eq(companies.status, "pending") // focus on pending companies first
      )
    )
    .limit(limit);

  if (targets.length === 0) {
    console.log("No pending companies to crawl! Try resetting company statuses or importing new ones.");
    process.exit(0);
  }

  console.log(`Found ${targets.length} pending domains to crawl. Starting worker pool...`);
  const startTime = Date.now();

  const tasks = targets.map((target) => {
    return async () => {
      if (!target.domain) return false;
      try {
        return await crawlCompany(target.id, target.domain);
      } catch (e) {
        console.error(`Error crawling ${target.domain}:`, e);
        return false;
      }
    };
  });

  const results = await runPool(tasks, concurrency);
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const succeeded = results.filter(Boolean).length;

  console.log(`\nCrawl Completed in ${duration} seconds.`);
  console.log(`Success: ${succeeded} / ${targets.length} domains crawled.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Runner failed:", err);
  process.exit(1);
});
