import { createClient } from "@libsql/client";
import {
  extractContactsFromHtml,
  mergeEmailList,
  mergePhoneList,
} from "../lib/crawler/contact-extractor";

const client = createClient({ url: "file:sqlite.db" });

type TargetRow = {
  id: number;
  name: string;
  domain: string;
  phone: string | null;
  emails_found: string | null;
};

type EnrichResult = {
  emails: string[];
  phones: string[];
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSqliteBusy(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("SQLITE_BUSY") || message.includes("database is locked");
}

async function withDbRetry<T>(
  operation: () => Promise<T>,
  label: string,
  maxAttempts = 12
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isSqliteBusy(error) || attempt === maxAttempts) throw error;
      const waitMs = Math.min(500 * attempt, 5000);
      console.log(`[DB BUSY] ${label}: retry ${attempt}/${maxAttempts} in ${waitMs}ms`);
      await wait(waitMs);
    }
  }

  throw new Error(`DB retry failed for ${label}`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = 500;
  let concurrency = 4;
  let delayMs = 150;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = Number.parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--concurrency" && args[i + 1]) {
      concurrency = Number.parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--delay" && args[i + 1]) {
      delayMs = Number.parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { concurrency, delayMs, limit };
}

async function ensureColumns(): Promise<void> {
  await withDbRetry(() => client.execute("PRAGMA busy_timeout = 10000"), "set busy timeout");

  const tableInfo = await client.execute("PRAGMA table_info(companies)");
  const columns = new Set(tableInfo.rows.map((row) => String(row.name)));

  if (!columns.has("contact_searched")) {
    await withDbRetry(
      () => client.execute("ALTER TABLE companies ADD COLUMN contact_searched INTEGER NOT NULL DEFAULT 0"),
      "add companies.contact_searched"
    );
  }

  if (!columns.has("contact_searched_at")) {
    await withDbRetry(
      () => client.execute("ALTER TABLE companies ADD COLUMN contact_searched_at INTEGER"),
      "add companies.contact_searched_at"
    );
  }
}

function absoluteUrl(baseUrl: string, href: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function findContactLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1] || "";
    const text = (match[2] || "").replace(/<[^>]+>/g, " ").toLowerCase();
    const combined = `${href} ${text}`.toLowerCase();

    if (
      combined.includes("kontakt") ||
      combined.includes("contact") ||
      combined.includes("kontakty") ||
      combined.includes("napiste") ||
      combined.includes("napíšte") ||
      combined.includes("o-nas") ||
      combined.includes("o nas")
    ) {
      const url = absoluteUrl(baseUrl, href);
      if (url && !url.startsWith("mailto:") && !url.startsWith("tel:")) {
        links.add(url);
      }
    }

    if (links.size >= 4) break;
  }

  return Array.from(links);
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 EagleEyeContactBot/1.0",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "sk,cs,en;q=0.9",
      },
    });
    clearTimeout(timeout);

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("text/html")) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function enrichDomain(domain: string): Promise<EnrichResult> {
  const emails = new Set<string>();
  const phones = new Set<string>();
  let homepageHtml: string | null = null;
  let homepageUrl = "";

  for (const scheme of ["https://", "http://"]) {
    const url = `${scheme}${domain}`;
    homepageHtml = await fetchHtml(url);
    if (homepageHtml) {
      homepageUrl = url;
      break;
    }
  }

  if (!homepageHtml || !homepageUrl) return { emails: [], phones: [] };

  const homeContacts = extractContactsFromHtml(homepageHtml);
  homeContacts.emails.forEach((email) => emails.add(email));
  homeContacts.phones.forEach((phone) => phones.add(phone));

  const contactLinks = findContactLinks(homepageHtml, homepageUrl);
  for (const url of contactLinks) {
    const html = await fetchHtml(url);
    if (!html) continue;
    const contacts = extractContactsFromHtml(html);
    contacts.emails.forEach((email) => emails.add(email));
    contacts.phones.forEach((phone) => phones.add(phone));
    if (emails.size >= 5 && phones.size >= 3) break;
  }

  return {
    emails: Array.from(emails).slice(0, 5),
    phones: Array.from(phones).slice(0, 3),
  };
}

async function loadTargets(limit: number): Promise<TargetRow[]> {
  const result = await withDbRetry(
    () =>
      client.execute({
        sql: `
          SELECT id, name, domain, phone, emails_found
          FROM companies
          WHERE
            domain IS NOT NULL
            AND domain <> ''
            AND COALESCE(contact_searched, 0) = 0
            AND (phone IS NULL OR phone = '' OR emails_found IS NULL OR emails_found = '')
          ORDER BY
            CASE WHEN legal_form_code = 'sro' THEN 0 ELSE 1 END,
            id
          LIMIT ?
        `,
        args: [limit],
      }),
    "load contact targets"
  );

  return result.rows as unknown as TargetRow[];
}

async function runPool<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const active: Promise<void>[] = [];
  const results: Promise<T>[] = [];

  for (const task of tasks) {
    const p = task();
    results.push(p);

    const activePromise = p.then(
      () => {
        active.splice(active.indexOf(activePromise), 1);
      },
      () => {
        active.splice(active.indexOf(activePromise), 1);
      }
    );
    active.push(activePromise);

    if (active.length >= concurrency) {
      await Promise.race(active);
    }
  }

  return Promise.all(results);
}

async function main(): Promise<void> {
  const { concurrency, delayMs, limit } = parseArgs();
  console.log("=== Eagle Eye Contact Enricher ===");
  console.log(`Config: Limit = ${limit}, Concurrency = ${concurrency}, Delay = ${delayMs}ms`);

  await ensureColumns();
  const targets = await loadTargets(limit);
  console.log(`Found ${targets.length} websites missing contacts.`);

  let searched = 0;
  let updated = 0;
  let emailHits = 0;
  let phoneHits = 0;

  const tasks = targets.map((target) => async () => {
    await wait(delayMs);
    const contacts = await enrichDomain(target.domain);
    const nextEmails = contacts.emails.length
      ? mergeEmailList(target.emails_found, contacts.emails, 5)
      : target.emails_found;
    const nextPhone = contacts.phones.length
      ? mergePhoneList(target.phone, contacts.phones, 3)
      : target.phone;
    const now = Date.now();

    await withDbRetry(
      () =>
        client.execute({
          sql: `
            UPDATE companies
            SET phone = ?, emails_found = ?, contact_searched = 1, contact_searched_at = ?
            WHERE id = ?
          `,
          args: [nextPhone, nextEmails, now, target.id],
        }),
      `save contacts for company ${target.id}`
    );

    searched++;
    if (nextEmails && nextEmails !== target.emails_found) emailHits++;
    if (nextPhone && nextPhone !== target.phone) phoneHits++;
    if (nextEmails !== target.emails_found || nextPhone !== target.phone) updated++;

    if (searched % 25 === 0 || contacts.emails.length || contacts.phones.length) {
      console.log(
        `[CONTACT] ${searched}/${targets.length} ID ${target.id} ${target.domain}: emails ${contacts.emails.length}, phones ${contacts.phones.length}. Updated: ${updated}`
      );
    }

    return true;
  });

  await runPool(tasks, concurrency);

  console.log("\n=== Contact enrichment complete ===");
  console.log(`Searched: ${searched}`);
  console.log(`Updated companies: ${updated}`);
  console.log(`Email hits: ${emailHits}`);
  console.log(`Phone hits: ${phoneHits}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
