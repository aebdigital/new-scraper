/**
 * bulk-directory-match.ts
 *
 * Bulk website discovery: instead of running one web search per company
 * (rate-limited, weeks for the full backlog), harvest entire Slovak business
 * directories and match their records against the companies table offline.
 *
 * Currently supported source: azet.sk katalóg
 *   - category listing pages (~25 firms/page) pair company name + profile URL
 *     + often the website link directly
 *   - profile pages expose the IČO (exact, unambiguous match key)
 *
 * Phases (each resumable, state lives in two side tables in sqlite.db):
 *   harvest   crawl category listings → directory_records (name, website, profile URL)
 *   profiles  fetch profile pages of records that still need an IČO or website
 *   match     match records to companies (IČO first, unique name-slug second),
 *             verify the website against the company (IČO/name on the page),
 *             then write companies.website/domain
 *   stats     show progress of all phases
 *
 * Usage:
 *   npx tsx src/scripts/bulk-directory-match.ts harvest  --max-pages 500 --delay 400
 *   npx tsx src/scripts/bulk-directory-match.ts profiles --limit 2000 --delay 400
 *   npx tsx src/scripts/bulk-directory-match.ts match    --limit 5000 --concurrency 6
 *   npx tsx src/scripts/bulk-directory-match.ts stats
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as cheerio from "cheerio";
import * as schema from "../lib/db/schema";
import { eq } from "drizzle-orm";
import {
  sleep,
  runPool,
  withDbRetry,
  isUniqueViolation,
  nameToSlug,
  extractDomain,
  hostMatches,
  EXTRACT_JUNK,
  fetchPage,
  isParkedPage,
  verifyPageAgainstCompany,
} from "../lib/discovery/helpers";

const client = createClient({ url: "file:sqlite.db" });
const db = drizzle(client, { schema });

const SOURCE = "azet";
const AZET_BASE = "https://www.azet.sk";

// ── Side tables (raw SQL — no drizzle migration needed) ──────────────────────

async function ensureTables() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS directory_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      profile_url TEXT NOT NULL UNIQUE,
      name TEXT,
      ico TEXT,
      website TEXT,
      harvested_at INTEGER,
      profile_fetched INTEGER DEFAULT 0,
      match_status TEXT DEFAULT 'pending',
      matched_company_id INTEGER
    )
  `);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_dir_records_status ON directory_records(match_status)`
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_dir_records_ico ON directory_records(ico)`
  );
  await client.execute(`
    CREATE TABLE IF NOT EXISTS directory_categories (
      source TEXT NOT NULL,
      category_url TEXT NOT NULL,
      next_page INTEGER DEFAULT 1,
      done INTEGER DEFAULT 0,
      PRIMARY KEY (source, category_url)
    )
  `);
  await client.execute(`PRAGMA busy_timeout = 60000`);
}

// ── Azet parsing ─────────────────────────────────────────────────────────────

function normalizeProfileUrl(href: string): string | null {
  // https://www.azet.sk/firma/1005938/pevals-sro/#kontakty-firmy → canonical URL
  const m = href.match(/https?:\/\/www\.azet\.sk\/firma\/(\d+)\/([^/#?]+)/);
  if (!m) return null;
  return `${AZET_BASE}/firma/${m[1]}/${m[2]}/`;
}

function cleanAzetWebsite(href: string): string | null {
  // Website links carry ?utm_source=azet.sk&… — strip the tracking params
  try {
    const url = new URL(href);
    url.search = "";
    const domain = extractDomain(url.toString());
    if (!domain || hostMatches(domain, EXTRACT_JUNK)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

interface ListingResult {
  records: { profileUrl: string; name: string; website: string | null }[];
  categoryLinks: string[];
  hasNextPage: boolean;
}

function parseAzetListing(html: string, currentPage: number): ListingResult {
  const $ = cheerio.load(html);
  const records: ListingResult["records"] = [];

  $("div.record").each((_, rec) => {
    const nameLink = $(rec).find("h2.name a[href*='/firma/']").first();
    const name = nameLink.text().trim();
    const profileUrl = normalizeProfileUrl(nameLink.attr("href") || "");
    if (!name || !profileUrl) return;

    let website: string | null = null;
    const webLink = $(rec).find("a[href*='utm_source=azet']").first();
    if (webLink.length > 0) {
      website = cleanAzetWebsite(webLink.attr("href") || "");
    }

    records.push({ profileUrl, name, website });
  });

  // Sub-category links let the crawl discover the whole catalog tree
  const categoryLinks: string[] = [];
  $("a[href*='azet.sk/katalog/']").each((_, a) => {
    const href = $(a).attr("href") || "";
    const m = href.match(/https?:\/\/www\.azet\.sk\/katalog\/([a-z0-9-_]+)\/?$/);
    if (m) categoryLinks.push(`${AZET_BASE}/katalog/${m[1]}/`);
  });

  const hasNextPage =
    $(`a.page[href*='/${currentPage + 1}/']`).length > 0 ||
    $(`a.page[title='${currentPage + 1}. strana']`).length > 0;

  return { records, categoryLinks: [...new Set(categoryLinks)], hasNextPage };
}

function parseAzetProfile(html: string): { ico: string | null; website: string | null } {
  const $ = cheerio.load(html);

  // <span class="span4 left"><b>IČO:</b></span> <span class="value">43868576</span>
  let ico: string | null = null;
  $("b").each((_, b) => {
    if (ico) return;
    if ($(b).text().trim().toUpperCase().startsWith("IČO")) {
      const value = $(b).closest("div").find("span.value").first().text().trim();
      const digits = value.replace(/\D/g, "");
      if (digits.length >= 6 && digits.length <= 10) ico = digits;
    }
  });
  if (!ico) {
    const m = html.match(/I[ČC]O:?\s*<\/b>\s*<\/span>\s*<span[^>]*>\s*([\d\s]{6,12})</i);
    if (m) {
      const digits = m[1].replace(/\D/g, "");
      if (digits.length >= 6) ico = digits;
    }
  }

  let website: string | null = null;
  const webLink = $("a[href*='utm_medium=profil']").first();
  if (webLink.length > 0) {
    website = cleanAzetWebsite(webLink.attr("href") || "");
  }

  return { ico, website };
}

// ── Paced fetching of azet.sk ────────────────────────────────────────────────

let azetNextAt = 0;
let azetFailStreak = 0;
let azetLock = Promise.resolve();

/** Serialized + paced fetch so azet.sk is never hammered. null = blocked/backoff. */
async function fetchAzet(url: string, delayMs: number): Promise<string | null> {
  const prevLock = azetLock;
  let release: () => void = () => {};
  azetLock = new Promise<void>((r) => (release = r));
  await prevLock;

  try {
    if (azetFailStreak >= 6) return null; // repeatedly blocked — give up this run
    const waitMs = azetNextAt - Date.now();
    if (waitMs > 0) await sleep(waitMs);

    const page = await fetchPage(url, 10000);

    if (page.status === 429 || page.status === 403 || page.status === null) {
      azetFailStreak++;
      const wait = Math.min(10000 * 2 ** azetFailStreak, 5 * 60 * 1000);
      azetNextAt = Date.now() + wait;
      console.log(`[azet] backing off ${(wait / 1000).toFixed(0)}s (streak ${azetFailStreak})`);
      return null;
    }

    azetFailStreak = 0;
    azetNextAt = Date.now() + delayMs;
    return page.ok ? page.html : ""; // "" = page gone (404) — skip, not a block
  } finally {
    release();
  }
}

// ── Phase: harvest ───────────────────────────────────────────────────────────

async function saveRecord(r: { profileUrl: string; name: string; website: string | null }) {
  await withDbRetry(
    () =>
      client.execute({
        sql: `INSERT INTO directory_records (source, profile_url, name, website, harvested_at, profile_fetched)
              VALUES (?, ?, ?, ?, ?, 0)
              ON CONFLICT(profile_url) DO UPDATE SET
                name = excluded.name,
                website = COALESCE(excluded.website, directory_records.website)`,
        args: [SOURCE, r.profileUrl, r.name, r.website, Date.now()],
      }),
    `save record ${r.profileUrl}`
  );
}

async function addCategory(url: string) {
  await withDbRetry(
    () =>
      client.execute({
        sql: `INSERT OR IGNORE INTO directory_categories (source, category_url) VALUES (?, ?)`,
        args: [SOURCE, url],
      }),
    `add category ${url}`
  );
}

async function harvest(maxPages: number, delayMs: number) {
  console.log(`=== Bulk harvest: azet.sk katalóg (max ${maxPages} pages this run) ===`);

  // Seed categories from the catalog root if the queue is empty
  const seeded = await client.execute(
    `SELECT COUNT(*) AS c FROM directory_categories WHERE source = '${SOURCE}'`
  );
  if (Number(seeded.rows[0].c) === 0) {
    console.log("[SEED] fetching catalog root for categories…");
    const rootHtml = await fetchAzet(`${AZET_BASE}/katalog/`, delayMs);
    if (!rootHtml) {
      console.error("Could not fetch catalog root — aborting.");
      return;
    }
    const { categoryLinks } = parseAzetListing(rootHtml, 1);
    for (const link of categoryLinks) await addCategory(link);
    console.log(`[SEED] ${categoryLinks.length} categories queued.`);
  }

  let pagesFetched = 0;
  let recordsSaved = 0;
  let websitesSeen = 0;

  while (pagesFetched < maxPages) {
    const next = await client.execute(
      `SELECT category_url, next_page FROM directory_categories
       WHERE source = '${SOURCE}' AND done = 0 ORDER BY category_url LIMIT 1`
    );
    if (next.rows.length === 0) {
      console.log("All known categories fully harvested.");
      break;
    }

    const categoryUrl = String(next.rows[0].category_url);
    const page = Number(next.rows[0].next_page);
    const pageUrl = page === 1 ? categoryUrl : `${categoryUrl}${page}/`;

    const html = await fetchAzet(pageUrl, delayMs);
    pagesFetched++;

    if (html === null) {
      if (azetFailStreak >= 6) break; // blocked — stop the run, state is saved
      continue; // transient backoff — retry same page next loop
    }

    const { records, categoryLinks, hasNextPage } = parseAzetListing(html, page);

    for (const r of records) {
      await saveRecord(r);
      recordsSaved++;
      if (r.website) websitesSeen++;
    }
    for (const link of categoryLinks) await addCategory(link);

    if (hasNextPage) {
      await client.execute({
        sql: `UPDATE directory_categories SET next_page = ? WHERE source = ? AND category_url = ?`,
        args: [page + 1, SOURCE, categoryUrl],
      });
    } else {
      await client.execute({
        sql: `UPDATE directory_categories SET done = 1 WHERE source = ? AND category_url = ?`,
        args: [SOURCE, categoryUrl],
      });
    }

    if (pagesFetched % 25 === 0) {
      console.log(
        `[HARVEST] ${pagesFetched} pages | +${recordsSaved} records (${websitesSeen} with website) | at: ${pageUrl}`
      );
    }
  }

  console.log(`\n=== Harvest run done ===`);
  console.log(`Pages fetched: ${pagesFetched}, records saved/updated: ${recordsSaved} (${websitesSeen} with website)`);
}

// ── Phase: profiles ──────────────────────────────────────────────────────────

async function profiles(limit: number, delayMs: number) {
  console.log(`=== Profile enrichment: fetching IČO for up to ${limit} records ===`);

  // Prioritize records that already carry a website — those become matches
  // fastest. Records that failed name-matching ('no_company') come first:
  // their IČO unlocks a retry in the match phase.
  const rows = await client.execute(
    `SELECT id, profile_url FROM directory_records
     WHERE source = '${SOURCE}' AND profile_fetched = 0
       AND match_status IN ('pending', 'no_company')
     ORDER BY (match_status != 'no_company'), (website IS NULL), id
     LIMIT ${Math.floor(limit)}`
  );
  console.log(`${rows.rows.length} profiles to fetch.`);

  let fetched = 0;
  let icoFound = 0;

  for (const row of rows.rows) {
    const html = await fetchAzet(String(row.profile_url), delayMs);
    if (html === null) {
      if (azetFailStreak >= 6) break;
      continue;
    }

    const { ico, website } = html ? parseAzetProfile(html) : { ico: null, website: null };
    await withDbRetry(
      () =>
        client.execute({
          sql: `UPDATE directory_records SET profile_fetched = 1, ico = COALESCE(?, ico),
                website = COALESCE(website, ?) WHERE id = ?`,
          args: [ico, website, row.id],
        }),
      `update record ${row.id}`
    );
    fetched++;
    if (ico) icoFound++;

    if (fetched % 50 === 0) {
      console.log(`[PROFILES] ${fetched}/${rows.rows.length} fetched, ${icoFound} IČO found`);
    }
  }

  console.log(`\n=== Profile run done ===`);
  console.log(`Fetched: ${fetched}, IČO found: ${icoFound}`);
}

// ── Phase: match ─────────────────────────────────────────────────────────────

interface CompanyRow {
  id: number;
  name: string;
  ico: string | null;
  domain: string | null;
}

async function match(limit: number, concurrency: number) {
  console.log(`=== Matching up to ${limit} directory records against companies ===`);

  // In-memory lookups over the whole companies table (~1M rows is fine)
  console.log("Loading companies into memory…");
  const all = await client.execute(
    `SELECT id, name, ico, domain FROM companies`
  );
  const byIco = new Map<string, CompanyRow[]>();
  const bySlug = new Map<string, CompanyRow[]>();
  for (const r of all.rows) {
    const row: CompanyRow = {
      id: Number(r.id),
      name: String(r.name),
      ico: r.ico == null ? null : String(r.ico),
      domain: r.domain == null ? null : String(r.domain),
    };
    if (row.ico) {
      const key = row.ico.replace(/\D/g, "");
      if (!byIco.has(key)) byIco.set(key, []);
      byIco.get(key)!.push(row);
    }
    const slug = nameToSlug(row.name);
    if (slug.length >= 4) {
      if (!bySlug.has(slug)) bySlug.set(slug, []);
      bySlug.get(slug)!.push(row);
    }
  }
  console.log(`${byIco.size} IČO keys, ${bySlug.size} name slugs.`);

  // 'no_company' records get another chance once the profiles phase has
  // fetched their IČO — name matching failed but the registry key won't.
  const records = await client.execute(
    `SELECT id, name, ico, website FROM directory_records
     WHERE source = '${SOURCE}' AND website IS NOT NULL
       AND (match_status = 'pending'
            OR (match_status = 'no_company' AND ico IS NOT NULL))
     LIMIT ${Math.floor(limit)}`
  );
  console.log(`${records.rows.length} records with websites to match.\n`);

  let matched = 0;
  let verifyFailed = 0;
  let noCompany = 0;
  let alreadyHadDomain = 0;
  let duplicates = 0;

  const setStatus = (recId: unknown, status: string, companyId?: number) =>
    withDbRetry(
      () =>
        client.execute({
          sql: `UPDATE directory_records SET match_status = ?, matched_company_id = ? WHERE id = ?`,
          args: [status, companyId ?? null, recId as number],
        }),
      `set status for record ${recId}`
    );

  const tasks = records.rows.map((rec) => async () => {
    const recName = String(rec.name || "");
    const recIco = rec.ico == null ? null : String(rec.ico).replace(/\D/g, "");
    const website = String(rec.website);

    // 1. Find the company: IČO exact → unique name slug
    let candidates: CompanyRow[] = [];
    let usedIco = false;
    if (recIco && byIco.has(recIco)) {
      candidates = byIco.get(recIco)!;
      usedIco = true;
    } else {
      const slug = nameToSlug(recName);
      const bySlugHit = slug.length >= 4 ? bySlug.get(slug) || [] : [];
      // Name matching is only safe when it is unambiguous
      if (bySlugHit.length === 1) candidates = bySlugHit;
    }

    if (candidates.length === 0) {
      noCompany++;
      await setStatus(rec.id, "no_company");
      return;
    }

    // Prefer a candidate that still needs a website
    const company = candidates.find((c) => !c.domain) || candidates[0];
    if (company.domain) {
      alreadyHadDomain++;
      await setStatus(rec.id, "company_has_domain", company.id);
      return;
    }

    // 2. Verify the website actually belongs to the company
    const page = await fetchPage(website, 8000);
    if (!page.ok || isParkedPage(page.html)) {
      verifyFailed++;
      await setStatus(rec.id, "verify_failed", company.id);
      return;
    }
    const level = verifyPageAgainstCompany(page.html, company);
    const finalDomain = extractDomain(page.finalUrl) || extractDomain(website);
    // "weak" (a single name token on the page) is only acceptable when the
    // record was matched by IČO — the directory's own assertion plus the exact
    // registry key. For name-slug matches require real proof on the site.
    if (!finalDomain || level === "none" || (level === "weak" && !usedIco)) {
      // Directory said this is their site, but the page shows no trace of the
      // company (renamed business, stale listing, sold domain) — don't trust it
      verifyFailed++;
      await setStatus(rec.id, "verify_failed", company.id);
      return;
    }

    // 3. Save (handle domain uniqueness races like discover-websites does)
    try {
      const existing = await withDbRetry(
        () =>
          db
            .select({ id: schema.companies.id })
            .from(schema.companies)
            .where(eq(schema.companies.domain, finalDomain))
            .limit(1),
        `check domain ${finalDomain}`
      );
      if (existing.length > 0 && existing[0].id !== company.id) {
        duplicates++;
        await setStatus(rec.id, "duplicate_domain", company.id);
        return;
      }

      await withDbRetry(
        () =>
          db
            .update(schema.companies)
            .set({ website: page.finalUrl, domain: finalDomain, googleSearched: 1 })
            .where(eq(schema.companies.id, company.id)),
        `save website for company ${company.id}`
      );
      company.domain = finalDomain; // keep the in-memory view consistent
      matched++;
      await setStatus(rec.id, "matched", company.id);
      console.log(
        `[MATCH] "${recName}" → ${finalDomain} (company ${company.id}, ${recIco ? "ičo" : "name"}, ${level})`
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        duplicates++;
        await setStatus(rec.id, "duplicate_domain", company.id);
        return;
      }
      throw error;
    }
  });

  const start = Date.now();
  const ticker = setInterval(() => {
    const done = matched + verifyFailed + noCompany + alreadyHadDomain + duplicates;
    console.log(
      `\n📊 MATCH: ${done}/${records.rows.length} | ✅ ${matched} matched | ` +
        `🚫 ${verifyFailed} verify-failed | 👻 ${noCompany} no company | ` +
        `↩️ ${alreadyHadDomain} had domain | 🔁 ${duplicates} dup | ` +
        `${((Date.now() - start) / 1000).toFixed(0)}s`
    );
  }, 10000);

  await runPool(tasks, concurrency);
  clearInterval(ticker);

  console.log(`\n=== Match run done ===`);
  console.log(
    `Matched: ${matched} | Verify failed: ${verifyFailed} | No company: ${noCompany} | ` +
      `Company already had domain: ${alreadyHadDomain} | Duplicate domains: ${duplicates}`
  );
}

// ── Phase: stats ─────────────────────────────────────────────────────────────

async function stats() {
  const cats = await client.execute(
    `SELECT COUNT(*) AS total, SUM(done) AS done FROM directory_categories WHERE source = '${SOURCE}'`
  );
  const recs = await client.execute(
    `SELECT COUNT(*) AS total,
            SUM(website IS NOT NULL) AS with_web,
            SUM(ico IS NOT NULL) AS with_ico,
            SUM(profile_fetched) AS profiled
     FROM directory_records WHERE source = '${SOURCE}'`
  );
  const byStatus = await client.execute(
    `SELECT match_status, COUNT(*) AS c FROM directory_records
     WHERE source = '${SOURCE}' GROUP BY match_status ORDER BY c DESC`
  );

  console.log(`=== Bulk directory matcher — ${SOURCE} ===`);
  console.log(`Categories: ${cats.rows[0].done ?? 0}/${cats.rows[0].total} fully harvested`);
  console.log(
    `Records: ${recs.rows[0].total} (${recs.rows[0].with_web} with website, ` +
      `${recs.rows[0].with_ico} with IČO, ${recs.rows[0].profiled} profiles fetched)`
  );
  for (const row of byStatus.rows) {
    console.log(`  ${row.match_status}: ${row.c}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const phase = args[0] || "stats";

  let limit = 2000;
  let delayMs = 400;
  let concurrency = 6;
  let maxPages = 200;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) limit = parseInt(args[++i], 10);
    else if (args[i] === "--delay" && args[i + 1]) delayMs = parseInt(args[++i], 10);
    else if (args[i] === "--concurrency" && args[i + 1]) concurrency = parseInt(args[++i], 10);
    else if (args[i] === "--max-pages" && args[i + 1]) maxPages = parseInt(args[++i], 10);
  }

  await ensureTables();

  if (phase === "harvest") await harvest(maxPages, delayMs);
  else if (phase === "profiles") await profiles(limit, delayMs);
  else if (phase === "match") await match(limit, concurrency);
  else if (phase === "stats") await stats();
  else {
    console.log(`Unknown phase "${phase}". Use: harvest | profiles | match | stats`);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Bulk directory matcher failed:", err);
  process.exit(1);
});
