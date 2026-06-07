import * as fs from "fs";
import * as path from "path";
import https from "https";
import zlib from "zlib";
import readline from "readline";
import { db } from "../lib/db";
import { companies } from "../lib/db/schema";
import { eq } from "drizzle-orm";

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

async function processFile(
  fileIndex: number,
  limit: number,
  dryRun: boolean,
  existingNamesSet: Set<string>,
  stats: { totalInserted: number; totalMatched: number }
): Promise<{ parsed: number; matched: number; inserted: number }> {
  const formattedIndex = String(fileIndex).padStart(3, "0");
  const fileUrl = `https://frkqbrydxwdp.compat.objectstorage.eu-frankfurt-1.oraclecloud.com/susr-rpo/batch-init/init_2026-05-02_${formattedIndex}.json.gz`;

  console.log(`\n--- Processing File [${formattedIndex}/023] ---`);
  console.log(`URL: ${fileUrl}`);

  return new Promise((resolve, reject) => {
    https.get(fileUrl, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download file: HTTP ${res.statusCode}`));
        return;
      }

      const gunzip = zlib.createGunzip();
      const rl = readline.createInterface({
        input: res.pipe(gunzip),
        crlfDelay: Infinity,
      });

      let parsedCount = 0;
      let matchedCount = 0;
      let insertedCount = 0;
      const batch: any[] = [];
      const batchSize = 100;

      rl.on("line", async (line) => {
        let trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('{"exportDate"') || trimmed === "]}" || trimmed === "]") {
          return;
        }

        if (trimmed.startsWith(",")) {
          trimmed = trimmed.substring(1).trim();
        }

        if (!trimmed) return;

        parsedCount++;
        
        // Print progress every 15,000 parsed lines
        if (parsedCount % 15000 === 0) {
          console.log(`[FILE ${formattedIndex}] Parsed ${parsedCount} entities... Matched in this file: ${matchedCount} (Total inserted overall: ${stats.totalInserted})`);
        }

        try {
          const record = JSON.parse(trimmed);
          let nace = record.statisticalCodes?.mainActivity?.code || null;
          if (!nace || typeof nace !== "string") return;

          if (!nace.startsWith("41") && !nace.startsWith("42") && !nace.startsWith("43")) {
            return;
          }

          if (nace.length === 4) {
            nace = nace + "0";
          }

          matchedCount++;
          stats.totalMatched++;

          const nameVal = record.fullNames?.[0]?.value || "";
          if (!nameVal) return;

          const normName = normalizeName(nameVal);
          if (existingNamesSet.has(normName)) {
            return;
          }

          existingNamesSet.add(normName);

          const legalFormObj = record.legalForms?.[0]?.value;
          const legalFormVal = legalFormObj?.value || "";
          const legalFormCode = legalFormObj?.code || "";
          
          let mappedLegalForm = "sole_trader";
          if (legalFormCode === "112" || legalFormCode === "121" || legalFormCode.startsWith("11") || legalFormCode.startsWith("12")) {
            mappedLegalForm = "sro";
          } else if (
            legalFormVal.toLowerCase().includes("sro") || 
            legalFormVal.toLowerCase().includes("ručením obmedzeným") ||
            legalFormVal.toLowerCase().includes("akciová")
          ) {
            mappedLegalForm = "sro";
          }

          const addrObj = record.addresses?.[0];
          let city = null;
          let address = null;
          if (addrObj) {
            city = addrObj.municipality?.value || null;
            const street = addrObj.street || "";
            const bldNum = addrObj.buildingNumber || "";
            const zip = addrObj.postalCodes?.[0] || "";
            
            const streetPart = street ? `${street} ${bldNum}`.trim() : bldNum;
            const zipPart = zip ? `${zip} ` : "";
            const cityPart = city || "";
            
            address = `${streetPart}, ${zipPart}${cityPart}`.replace(/^,\s*/, "").trim() || null;
          }

          const naceDivision = nace.substring(0, 2);

          const companyData = {
            name: nameVal,
            city,
            address,
            nace,
            naceSection: "F",
            naceDivision,
            naceSubdivision: nace,
            legalFormCode: mappedLegalForm,
            status: "pending",
            leadScore: 0,
            orsfEnriched: 0,
          };

          if (dryRun) {
            console.log(`[DRY-RUN] File ${formattedIndex} Match: ${nameVal} (NACE: ${nace}, LF: ${mappedLegalForm}, City: ${city})`);
            const totalRemaining = limit - stats.totalInserted;
            if (matchedCount >= totalRemaining) {
              rl.close();
            }
            return;
          }

          batch.push(companyData);

          if (batch.length >= batchSize) {
            rl.pause();
            
            try {
              await db.insert(companies).values(batch);
              insertedCount += batch.length;
              stats.totalInserted += batch.length;
              console.log(`[INSERT] File ${formattedIndex}: Inserted batch of ${batch.length} companies. Total inserted overall: ${stats.totalInserted}`);
              batch.length = 0;
            } catch (err) {
              console.error("Batch insert error:", err);
            }

            rl.resume();

            const totalRemaining = limit - stats.totalInserted;
            if (totalRemaining <= 0) {
              rl.close();
            }
          }
        } catch (e: any) {
          // Silent catch
        }
      });

      rl.on("close", async () => {
        if (batch.length > 0 && !dryRun) {
          try {
            await db.insert(companies).values(batch);
            insertedCount += batch.length;
            stats.totalInserted += batch.length;
            console.log(`[INSERT] File ${formattedIndex}: Inserted final batch of ${batch.length} companies. Total inserted overall: ${stats.totalInserted}`);
          } catch (err) {
            console.error("Final batch insert error:", err);
          }
        }
        resolve({ parsed: parsedCount, matched: matchedCount, inserted: insertedCount });
      });

      rl.on("error", (err) => {
        reject(err);
      });
    }).on("error", (err) => {
      reject(err);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  let limit = Infinity;
  let dryRun = false;
  let fileIndex: number | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--file-index" && args[i + 1]) {
      fileIndex = parseInt(args[i + 1], 10);
      i++;
    }
  }

  console.log("=== RPO Construction Importer ===");
  console.log(`Config: Limit = ${limit === Infinity ? "None" : limit}, DryRun = ${dryRun}, TargetFile = ${fileIndex !== null ? `init_2026-05-02_${String(fileIndex).padStart(3, "0")}.json.gz` : "All 23 Files"}`);

  console.log("Loading existing company names from database...");
  const existingCompanies = await db.select({ name: companies.name }).from(companies);
  const existingNamesSet = new Set<string>();
  for (const c of existingCompanies) {
    existingNamesSet.add(normalizeName(c.name));
  }
  console.log(`Loaded ${existingNamesSet.size} unique normalized names.`);

  const stats = { totalInserted: 0, totalMatched: 0 };

  if (fileIndex !== null) {
    // Process only the single requested file
    const res = await processFile(fileIndex, limit, dryRun, existingNamesSet, stats);
    console.log(`\n=== File ${String(fileIndex).padStart(3, "0")} Finished ===`);
    console.log(`Parsed: ${res.parsed}, Matched Section F: ${res.matched}, Inserted: ${res.inserted}`);
  } else {
    // Process all 23 files
    for (let f = 1; f <= 23; f++) {
      if (stats.totalInserted >= limit) {
        console.log(`Limit of ${limit} reached. Stopping.`);
        break;
      }
      try {
        const res = await processFile(f, limit, dryRun, existingNamesSet, stats);
        console.log(`File ${String(f).padStart(3, "0")} finished. Parsed: ${res.parsed}, Matched: ${res.matched}, Inserted: ${res.inserted}`);
      } catch (err: any) {
        console.error(`Error processing file ${f}:`, err.message || err);
      }
    }
  }

  console.log(`\n=== Import Process Completed ===`);
  console.log(`Total Matched Section F: ${stats.totalMatched}`);
  console.log(`Total Inserted: ${stats.totalInserted}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
