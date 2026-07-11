import https from "https";
import zlib from "zlib";
import readline from "readline";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "../lib/db/schema";

const RPO_BASE_URL =
  "https://frkqbrydxwdp.compat.objectstorage.eu-frankfurt-1.oraclecloud.com/susr-rpo/batch-init";
const RPO_EXPORT_DATE = "2026-05-02";
const ALL_SECTIONS = new Set("ABCDEFGHIJKLMNOPQRSTU".split(""));

type LegalFormFilter = "all" | "companies" | "sole_traders";

type ImportConfig = {
  batchSize: number;
  dryRun: boolean;
  excludeSections: Set<string>;
  fileIndex: number | null;
  legalForms: LegalFormFilter;
  limit: number;
  sections: Set<string>;
};

type ImportStats = {
  parsed: number;
  matchedNace: number;
  skippedExistingName: number;
  skippedLegalForm: number;
  skippedSection: number;
  inserted: number;
  ignoredByRpoId: number;
};

type CompanyInsert = typeof schema.companies.$inferInsert;

const client = createClient({ url: "file:sqlite.db" });
const db = drizzle(client, { schema });

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
      if (!isSqliteBusy(error) || attempt === maxAttempts) {
        throw error;
      }

      const waitMs = Math.min(500 * attempt, 5000);
      console.log(`[DB BUSY] ${label}: retry ${attempt}/${maxAttempts} in ${waitMs}ms`);
      await wait(waitMs);
    }
  }

  throw new Error(`DB retry failed for ${label}`);
}

function normalizeName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/s\.?\s*r\.?\s*o\.?/gi, "")
    .replace(/a\.?\s*s\.?/gi, "")
    .replace(/spol\.?\s*s\s*r\.?\s*o\.?/gi, "")
    .replace(/k\.?\s*s\.?/gi, "")
    .replace(/v\s*konkurze/gi, "")
    .replace(/zrušená/gi, "")
    .replace(/[^a-z0-9]/gi, "")
    .trim();
}

function sectionFromNace(nace: string): string | null {
  const division = Number.parseInt(nace.substring(0, 2), 10);
  if (Number.isNaN(division)) return null;

  if (division >= 1 && division <= 3) return "A";
  if (division >= 5 && division <= 9) return "B";
  if (division >= 10 && division <= 33) return "C";
  if (division === 35) return "D";
  if (division >= 36 && division <= 39) return "E";
  if (division >= 41 && division <= 43) return "F";
  if (division >= 45 && division <= 47) return "G";
  if (division >= 49 && division <= 53) return "H";
  if (division >= 55 && division <= 56) return "I";
  if (division >= 58 && division <= 63) return "J";
  if (division >= 64 && division <= 66) return "K";
  if (division === 68) return "L";
  if (division >= 69 && division <= 75) return "M";
  if (division >= 77 && division <= 82) return "N";
  if (division === 84) return "O";
  if (division === 85) return "P";
  if (division >= 86 && division <= 88) return "Q";
  if (division >= 90 && division <= 93) return "R";
  if (division >= 94 && division <= 96) return "S";
  if (division >= 97 && division <= 98) return "T";
  if (division === 99) return "U";
  return null;
}

function normalizeNace(rawNace: unknown): string | null {
  if (typeof rawNace !== "string" || rawNace.length < 2) return null;
  const digits = rawNace.replace(/\D/g, "");
  if (digits.length < 2) return null;
  return digits.length === 4 ? `${digits}0` : digits;
}

function getCurrentValue(
  values: { validTo?: string; [key: string]: any }[] | undefined
): { validTo?: string; [key: string]: any } | undefined {
  if (!values || values.length === 0) return undefined;
  return values.find((value) => !value.validTo) || values[0];
}

function mapLegalForm(record: any): "sro" | "sole_trader" {
  const legalFormObj = getCurrentValue(record.legalForms)?.value;
  const legalFormValue = String(legalFormObj?.value || "").toLowerCase();
  const legalFormCode = String(legalFormObj?.code || "");

  if (
    legalFormCode === "112" ||
    legalFormCode === "121" ||
    legalFormCode.startsWith("11") ||
    legalFormCode.startsWith("12") ||
    legalFormValue.includes("sro") ||
    legalFormValue.includes("s.r.o") ||
    legalFormValue.includes("ručením obmedzeným") ||
    legalFormValue.includes("akciová")
  ) {
    return "sro";
  }

  return "sole_trader";
}

function passesLegalFormFilter(legalForm: string, filter: LegalFormFilter): boolean {
  if (filter === "all") return true;
  if (filter === "companies") return legalForm === "sro";
  return legalForm === "sole_trader";
}

function buildAddress(record: any): { city: string | null; address: string | null } {
  const addrObj = getCurrentValue(record.addresses);
  if (!addrObj) return { city: null, address: null };

  const city = addrObj.municipality?.value || null;
  const street = addrObj.street || "";
  const buildingNumber = addrObj.buildingNumber || "";
  const zip = addrObj.postalCodes?.[0] || "";
  const streetPart = street ? `${street} ${buildingNumber}`.trim() : buildingNumber;
  const zipPart = zip ? `${zip} ` : "";
  const cityPart = city || "";
  const address = `${streetPart}, ${zipPart}${cityPart}`.replace(/^,\s*/, "").trim();

  return { city, address: address || null };
}

function parseArgs(): ImportConfig {
  const args = process.argv.slice(2);
  const config: ImportConfig = {
    batchSize: 500,
    dryRun: false,
    excludeSections: new Set(),
    fileIndex: null,
    legalForms: "all",
    limit: Number.POSITIVE_INFINITY,
    sections: new Set(ALL_SECTIONS),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === "--batch-size" && next) {
      config.batchSize = Number.parseInt(next, 10);
      i++;
    } else if (arg === "--dry-run") {
      config.dryRun = true;
    } else if (arg === "--exclude-section" && next) {
      next
        .split(",")
        .map((section) => section.trim().toUpperCase())
        .filter(Boolean)
        .forEach((section) => config.excludeSections.add(section));
      i++;
    } else if (arg === "--file-index" && next) {
      config.fileIndex = Number.parseInt(next, 10);
      i++;
    } else if (arg === "--legal-forms" && next) {
      if (!["all", "companies", "sole_traders"].includes(next)) {
        throw new Error("--legal-forms must be one of: all, companies, sole_traders");
      }
      config.legalForms = next as LegalFormFilter;
      i++;
    } else if (arg === "--limit" && next) {
      config.limit = Number.parseInt(next, 10);
      i++;
    } else if (arg === "--sections" && next) {
      config.sections = new Set(
        next
          .split(",")
          .map((section) => section.trim().toUpperCase())
          .filter((section) => ALL_SECTIONS.has(section))
      );
      i++;
    }
  }

  for (const section of config.excludeSections) {
    config.sections.delete(section);
  }

  return config;
}

async function ensureImportColumns(): Promise<void> {
  await withDbRetry(() => client.execute("PRAGMA busy_timeout = 10000"), "set busy timeout");

  const tableInfo = await client.execute("PRAGMA table_info(companies)");
  const existingColumns = new Set(tableInfo.rows.map((row) => String(row.name)));

  const addColumn = async (name: string, definition: string) => {
    if (existingColumns.has(name)) return;
    await withDbRetry(
      () => client.execute(`ALTER TABLE companies ADD COLUMN ${definition}`),
      `add companies.${name}`
    );
    existingColumns.add(name);
  };

  await addColumn("ico", "ico TEXT");
  await addColumn("rpo_id", "rpo_id INTEGER");
  await addColumn("rpo_imported_at", "rpo_imported_at INTEGER");

  await withDbRetry(
    () =>
      client.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS companies_rpo_id_unique ON companies(rpo_id)"
      ),
    "ensure RPO unique index"
  );
}

async function loadExistingNames(): Promise<Set<string>> {
  const existing = await withDbRetry(
    () => db.select({ name: schema.companies.name }).from(schema.companies),
    "load existing names"
  );

  return new Set(existing.map((company) => normalizeName(company.name)).filter(Boolean));
}

function getFileUrl(fileIndex: number): string {
  const formattedIndex = String(fileIndex).padStart(3, "0");
  return `${RPO_BASE_URL}/init_${RPO_EXPORT_DATE}_${formattedIndex}.json.gz`;
}

async function streamFile(fileIndex: number): Promise<readline.Interface> {
  const fileUrl = getFileUrl(fileIndex);

  return new Promise((resolve, reject) => {
    https
      .get(fileUrl, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download ${fileUrl}: HTTP ${res.statusCode}`));
          res.resume();
          return;
        }

        const gunzip = zlib.createGunzip();
        gunzip.on("error", reject);
        res.on("error", reject);

        resolve(
          readline.createInterface({
            input: res.pipe(gunzip),
            crlfDelay: Infinity,
          })
        );
      })
      .on("error", reject);
  });
}

async function insertBatch(batch: CompanyInsert[], fileIndex: number): Promise<number> {
  if (batch.length === 0) return 0;

  await withDbRetry(
    () =>
      db
        .insert(schema.companies)
        .values(batch)
        .onConflictDoNothing({ target: schema.companies.rpoId }),
    `insert RPO batch from file ${String(fileIndex).padStart(3, "0")}`
  );

  const after = await withDbRetry(
    () => client.execute("SELECT changes() AS changes_count"),
    "read post-insert changes"
  );

  const afterChanges = Number(after.rows[0]?.changes_count || 0);
  return Math.max(afterChanges, 0);
}

async function processFile(
  fileIndex: number,
  config: ImportConfig,
  existingNames: Set<string>,
  stats: ImportStats
): Promise<void> {
  const formattedIndex = String(fileIndex).padStart(3, "0");
  console.log(`\n--- Processing RPO file ${formattedIndex}/023 ---`);
  console.log(`URL: ${getFileUrl(fileIndex)}`);

  const rl = await streamFile(fileIndex);
  const batch: CompanyInsert[] = [];
  let fileParsed = 0;
  let fileInserted = 0;

  const flush = async () => {
    if (config.dryRun) {
      fileInserted += batch.length;
      stats.inserted += batch.length;
      batch.length = 0;
      return;
    }

    const inserted = await insertBatch(batch, fileIndex);
    const ignored = batch.length - inserted;
    fileInserted += inserted;
    stats.inserted += inserted;
    stats.ignoredByRpoId += ignored;
    console.log(
      `[INSERT] File ${formattedIndex}: inserted ${inserted}, ignored ${ignored}. Total inserted: ${stats.inserted}`
    );
    batch.length = 0;
  };

  for await (const line of rl) {
    if (stats.inserted >= config.limit) {
      rl.close();
      break;
    }

    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('{"exportDate"') || trimmed === "]}" || trimmed === "]") {
      continue;
    }

    if (trimmed.startsWith(",")) {
      trimmed = trimmed.substring(1).trim();
    }

    if (!trimmed) continue;

    fileParsed++;
    stats.parsed++;

    if (fileParsed % 25000 === 0) {
      console.log(
        `[FILE ${formattedIndex}] Parsed ${fileParsed}; matched NACE ${stats.matchedNace}; inserted ${stats.inserted}`
      );
    }

    let record: any;
    try {
      record = JSON.parse(trimmed);
    } catch {
      continue;
    }

    const nace = normalizeNace(record.statisticalCodes?.mainActivity?.code);
    if (!nace) continue;

    const section = sectionFromNace(nace);
    if (!section) continue;

    stats.matchedNace++;

    if (!config.sections.has(section)) {
      stats.skippedSection++;
      continue;
    }

    const legalFormCode = mapLegalForm(record);
    if (!passesLegalFormFilter(legalFormCode, config.legalForms)) {
      stats.skippedLegalForm++;
      continue;
    }

    const name = getCurrentValue(record.fullNames)?.value || "";
    if (!name) continue;

    const normalizedName = normalizeName(name);
    if (!normalizedName || existingNames.has(normalizedName)) {
      stats.skippedExistingName++;
      continue;
    }
    existingNames.add(normalizedName);

    const { city, address } = buildAddress(record);
    const rpoId = typeof record.id === "number" ? record.id : Number.parseInt(String(record.id), 10);
    const ico = record.identifiers?.[0]?.value ? String(record.identifiers[0].value) : null;
    const naceDivision = nace.substring(0, 2);

    batch.push({
      address,
      city,
      ico,
      leadScore: 0,
      legalFormCode,
      name,
      nace,
      naceDivision,
      naceSection: section,
      naceSubdivision: nace,
      orsfEnriched: 0,
      rpoId: Number.isFinite(rpoId) ? rpoId : null,
      rpoImportedAt: Date.now(),
      status: "pending",
    });

    if (config.dryRun && batch.length <= 5) {
      console.log(`[DRY-RUN] ${name} (${section}, ${nace}, ${legalFormCode}, ${city || "no city"})`);
    }

    if (stats.inserted + batch.length >= config.limit) {
      await flush();
      rl.close();
      break;
    }

    if (batch.length >= config.batchSize) {
      await flush();
    }
  }

  await flush();
  console.log(`File ${formattedIndex} finished. Parsed: ${fileParsed}, inserted: ${fileInserted}`);
}

async function main(): Promise<void> {
  const config = parseArgs();
  const targetFiles =
    config.fileIndex !== null
      ? [config.fileIndex]
      : Array.from({ length: 23 }, (_, index) => index + 1);

  console.log("=== RPO A-U Importer ===");
  console.log(`Export date: ${RPO_EXPORT_DATE}`);
  console.log(`Sections: ${Array.from(config.sections).join(",")}`);
  console.log(`Legal forms: ${config.legalForms}`);
  console.log(`Limit: ${Number.isFinite(config.limit) ? config.limit : "none"}`);
  console.log(`Batch size: ${config.batchSize}`);
  console.log(`Dry run: ${config.dryRun}`);

  if (!config.dryRun) {
    await ensureImportColumns();
  } else {
    await withDbRetry(() => client.execute("PRAGMA busy_timeout = 10000"), "set busy timeout");
  }

  console.log("Loading existing normalized names...");
  const existingNames = await loadExistingNames();
  console.log(`Loaded ${existingNames.size} existing normalized names.`);

  const stats: ImportStats = {
    ignoredByRpoId: 0,
    inserted: 0,
    matchedNace: 0,
    parsed: 0,
    skippedExistingName: 0,
    skippedLegalForm: 0,
    skippedSection: 0,
  };

  for (const fileIndex of targetFiles) {
    if (stats.inserted >= config.limit) break;

    try {
      await processFile(fileIndex, config, existingNames, stats);
    } catch (error: any) {
      console.error(`Error processing file ${fileIndex}:`, error.message || error);
    }
  }

  console.log("\n=== Import completed ===");
  console.log(`Parsed records: ${stats.parsed}`);
  console.log(`Matched NACE records: ${stats.matchedNace}`);
  console.log(`Skipped sections: ${stats.skippedSection}`);
  console.log(`Skipped legal forms: ${stats.skippedLegalForm}`);
  console.log(`Skipped existing names: ${stats.skippedExistingName}`);
  console.log(`Ignored by RPO ID: ${stats.ignoredByRpoId}`);
  console.log(`Inserted: ${stats.inserted}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
