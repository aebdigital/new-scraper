import { createClient } from "@libsql/client";
import {
  mergeEmailList,
  mergePhoneList,
} from "../lib/crawler/contact-extractor";

const client = createClient({ url: "file:sqlite.db" });

type ContactRow = {
  id: number;
  phone: string | null;
  emails_found: string | null;
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

async function main() {
  console.log("=== Clean Contact Fields ===");
  await withDbRetry(() => client.execute("PRAGMA busy_timeout = 10000"), "set busy timeout");

  const result = await withDbRetry(
    () =>
      client.execute(`
        SELECT id, phone, emails_found
        FROM companies
        WHERE phone IS NOT NULL OR emails_found IS NOT NULL
      `),
    "load contacts"
  );

  let changed = 0;
  let phoneChanged = 0;
  let emailChanged = 0;

  for (const row of result.rows as unknown as ContactRow[]) {
    const nextPhone = mergePhoneList(null, (row.phone || "").split(/[,;\n]+/), 3);
    const nextEmails = mergeEmailList(null, (row.emails_found || "").split(/[,;\n]+/), 5);

    if ((nextPhone || null) === (row.phone || null) && (nextEmails || null) === (row.emails_found || null)) {
      continue;
    }

    await withDbRetry(
      () =>
        client.execute({
          sql: "UPDATE companies SET phone = ?, emails_found = ? WHERE id = ?",
          args: [nextPhone, nextEmails, row.id],
        }),
      `clean company ${row.id}`
    );

    changed++;
    if ((nextPhone || null) !== (row.phone || null)) phoneChanged++;
    if ((nextEmails || null) !== (row.emails_found || null)) emailChanged++;

    if (changed % 500 === 0) {
      console.log(`[PROGRESS] Cleaned ${changed}; phone ${phoneChanged}; email ${emailChanged}`);
    }
  }

  console.log("\n=== Contact cleanup complete ===");
  console.log(`Rows changed: ${changed}`);
  console.log(`Phone fields changed: ${phoneChanged}`);
  console.log(`Email fields changed: ${emailChanged}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
