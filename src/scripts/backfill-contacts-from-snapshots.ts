import zlib from "zlib";
import { createClient } from "@libsql/client";
import {
  extractContactsFromHtml,
  extractContactsFromText,
  mergeEmailList,
  mergePhoneList,
} from "../lib/crawler/contact-extractor";

const client = createClient({ url: "file:sqlite.db" });

type SnapshotRow = {
  company_id: number;
  phone: string | null;
  emails_found: string | null;
  email_addresses: string | null;
  cleaned_text_content: string | null;
  raw_html: string | null;
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
  let limit = 10000;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = Number.parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { limit };
}

function decodeRawHtml(rawHtml: string | null): string | null {
  if (!rawHtml) return null;

  try {
    return zlib.gunzipSync(Buffer.from(rawHtml, "base64")).toString("utf8");
  } catch {
    return rawHtml;
  }
}

async function main() {
  const { limit } = parseArgs();
  console.log("=== Backfill Contacts From Existing Snapshots ===");
  console.log(`Limit: ${limit}`);

  await withDbRetry(() => client.execute("PRAGMA busy_timeout = 10000"), "set busy timeout");

  const result = await withDbRetry(
    () =>
      client.execute({
        sql: `
          SELECT
            c.id AS company_id,
            c.phone,
            c.emails_found,
            s.email_addresses,
            s.cleaned_text_content,
            s.raw_html
          FROM companies c
          JOIN (
            SELECT company_id, MAX(crawled_at) AS crawled_at
            FROM website_snapshots
            GROUP BY company_id
          ) latest ON latest.company_id = c.id
          JOIN website_snapshots s
            ON s.company_id = latest.company_id
           AND s.crawled_at = latest.crawled_at
          WHERE
            (c.phone IS NULL OR c.phone = '' OR c.emails_found IS NULL OR c.emails_found = '')
            AND (
              s.email_addresses IS NOT NULL
              OR s.raw_html IS NOT NULL
              OR s.cleaned_text_content IS NOT NULL
            )
          LIMIT ?
        `,
        args: [limit],
      }),
    "load snapshot contact targets"
  );

  let updated = 0;
  let withEmail = 0;
  let withPhone = 0;

  for (const row of result.rows as unknown as SnapshotRow[]) {
    const html = decodeRawHtml(row.raw_html);
    const fromHtml = html ? extractContactsFromHtml(html) : { emails: [], phones: [] };
    const fromText =
      !html && row.cleaned_text_content
        ? extractContactsFromText(row.cleaned_text_content)
        : { emails: [], phones: [] };
    const snapshotEmails = (row.email_addresses || "")
      .split(/[,;\n]+/)
      .map((email) => email.trim())
      .filter(Boolean);

    const emails = [...snapshotEmails, ...fromHtml.emails, ...fromText.emails];
    const phones = [...fromHtml.phones, ...fromText.phones];

    const nextEmails = emails.length
      ? mergeEmailList(row.emails_found, emails, 5)
      : row.emails_found;
    const nextPhone = phones.length ? mergePhoneList(row.phone, phones, 3) : row.phone;

    if (nextEmails === row.emails_found && nextPhone === row.phone) {
      continue;
    }

    await withDbRetry(
      () =>
        client.execute({
          sql: "UPDATE companies SET emails_found = ?, phone = ? WHERE id = ?",
          args: [nextEmails, nextPhone, row.company_id],
        }),
      `update company ${row.company_id}`
    );

    updated++;
    if (nextEmails && nextEmails !== row.emails_found) withEmail++;
    if (nextPhone && nextPhone !== row.phone) withPhone++;

    if (updated % 250 === 0) {
      console.log(`[PROGRESS] Updated ${updated}; emails ${withEmail}; phones ${withPhone}`);
    }
  }

  console.log("\n=== Snapshot contact backfill complete ===");
  console.log(`Updated companies: ${updated}`);
  console.log(`Emails added/merged: ${withEmail}`);
  console.log(`Phones added/merged: ${withPhone}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
