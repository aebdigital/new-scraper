import { db } from "../db";
import { companies, websiteSnapshots, changeEvents } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { detectTechnologies } from "./detector";
import { calculateLeadScore } from "./scorer";
import * as crypto from "crypto";
import * as zlib from "zlib";

// Set this to bypass SSL certificate validation errors so we can crawl sites with expired/invalid SSL
// and flag them as having SSL issues rather than failing the crawl entirely.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function md5(str: string): string {
  return crypto.createHash("md5").update(str).digest("hex");
}

export interface CrawlResult {
  status: "live" | "dead" | "redirect";
  httpStatus: number | null;
  hasHttps: boolean;
  title: string | null;
  metaDescription: string | null;
  technologies: string[];
  copyrightYear: number | null;
  hasGdpr: boolean;
  emailAddresses: string[];
  htmlHash: string | null;
  cleanedTextContent: string | null;
  rawHtml: string | null;
}

export async function fetchAndAnalyzeDomain(domain: string): Promise<CrawlResult> {
  const timeoutMs = 8000;
  let html = "";
  let httpStatus: number | null = null;
  let finalUrl = "";
  let hasHttps = false;

  // Try HTTPS first, fallback to HTTP
  const schemes = ["https://", "http://"];
  let success = false;
  let errorMsg = "";

  for (const scheme of schemes) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const url = `${scheme}${domain}`;

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 EagleEye/1.0",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "sk,cs,en;q=0.9",
        },
        redirect: "follow",
      });

      clearTimeout(id);
      httpStatus = response.status;
      finalUrl = response.url;
      html = await response.text();
      hasHttps = finalUrl.startsWith("https://");
      success = true;
      break; // Success, exit scheme loop
    } catch (e: any) {
      clearTimeout(id);
      errorMsg = e.message || String(e);
      // Try next scheme
    }
  }

  if (!success) {
    return {
      status: "dead",
      httpStatus: null,
      hasHttps: false,
      title: null,
      metaDescription: null,
      technologies: [],
      copyrightYear: null,
      hasGdpr: false,
      emailAddresses: [],
      htmlHash: null,
      cleanedTextContent: null,
      rawHtml: null,
    };
  }

  // Determine if it was a redirect to a different domain
  let status: "live" | "redirect" = "live";
  try {
    const finalParsed = new URL(finalUrl);
    let finalDomain = finalParsed.hostname.toLowerCase();
    if (finalDomain.startsWith("www.")) {
      finalDomain = finalDomain.substring(4);
    }
    if (finalDomain !== domain) {
      status = "redirect";
    }
  } catch (e) {}

  // Parse HTML
  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);

  // Extract basic tags
  const title = $("title").text().trim() || null;
  const metaDescription = $("meta[name='description']").attr("content")?.trim() || null;

  // Extract cleaned body text content (avoid scripts, styles, header, footer, cookie banners)
  const bodyClone = $("body").clone();
  bodyClone.find("script, style, link, iframe, noscript, svg, header, footer, nav, [class*='cookie'], [id*='cookie'], [class*='popup']").remove();
  const cleanedTextContent = bodyClone.text().replace(/\s+/g, " ").trim() || null;

  // Run detectors
  const detection = detectTechnologies(html, {});
  // Use clean text hash to avoid dynamic elements triggering false positives
  const htmlHash = cleanedTextContent ? md5(cleanedTextContent) : md5(html);

  return {
    status,
    httpStatus,
    hasHttps,
    title,
    metaDescription,
    technologies: detection.technologies,
    copyrightYear: detection.copyrightYear,
    hasGdpr: detection.hasGdpr,
    emailAddresses: detection.emails,
    htmlHash,
    cleanedTextContent,
    rawHtml: html,
  };
}

export async function crawlCompany(companyId: number, domain: string): Promise<boolean> {
  console.log(`[CRAWL] Starting crawl for company ID ${companyId} (${domain})...`);

  try {
    const result = await fetchAndAnalyzeDomain(domain);

    // Fetch previous snapshot to detect changes
    const previousSnapshots = await db
      .select()
      .from(websiteSnapshots)
      .where(eq(websiteSnapshots.companyId, companyId))
      .orderBy(desc(websiteSnapshots.crawledAt))
      .limit(1);

    const prev = previousSnapshots[0] || null;

    // Detect if we should write a full snapshot or heartbeat
    // We write a full snapshot if:
    // 1. There is no previous snapshot
    // 2. The previous snapshot was a heartbeat/empty (was not full)
    // 3. The content hash has changed (prev.htmlHash !== result.htmlHash)
    // 4. The HTTP status changed between online/offline
    let isFull = false;
    if (!prev || prev.isFull === 0) {
      isFull = true;
    } else {
      const statusChanged = (prev.httpStatus === 200) !== (result.httpStatus === 200);
      const hashChanged = prev.htmlHash !== result.htmlHash;
      if (statusChanged || hashChanged) {
        isFull = true;
      }
    }

    // Compress raw HTML if it is a full snapshot
    let compressedHtml: string | null = null;
    if (isFull && result.rawHtml) {
      try {
        compressedHtml = zlib.gzipSync(result.rawHtml).toString("base64");
      } catch (err) {
        console.error(`Failed to compress HTML for ${domain}:`, err);
      }
    }

    // Save snapshot
    const snapshotTime = Date.now();
    await db.insert(websiteSnapshots).values({
      companyId,
      crawledAt: snapshotTime,
      httpStatus: result.httpStatus,
      title: result.title,
      metaDescription: result.metaDescription,
      techStack: JSON.stringify(result.technologies),
      copyrightYear: result.copyrightYear,
      hasHttps: result.hasHttps ? 1 : 0,
      hasGdpr: result.hasGdpr ? 1 : 0,
      emailAddresses: result.emailAddresses.join(", "),
      htmlHash: result.htmlHash,
      cleanedTextContent: isFull ? result.cleanedTextContent : null,
      rawHtml: compressedHtml,
      isFull: isFull ? 1 : 0,
    });

    // Detect Change Events
    if (prev) {
      // 1. Tech/CMS changes
      const prevTechs: string[] = JSON.parse(prev.techStack || "[]");
      const currentTechs = result.technologies;

      const cmsList = ["WordPress", "Webflow", "Joomla", "Drupal", "Shoptet (E-shop)", "Wix", "Squarespace"];
      const prevCMS = prevTechs.find((t) => cmsList.includes(t)) || "None";
      const currCMS = currentTechs.find((t) => cmsList.includes(t)) || "None";

      if (prevCMS !== currCMS) {
        await db.insert(changeEvents).values({
          companyId,
          timestamp: snapshotTime,
          type: "cms_changed",
          description: `CMS changed from ${prevCMS} to ${currCMS}`,
        });
      }

      // 2. Visual / redesign changes
      if (prev.htmlHash && result.htmlHash && prev.htmlHash !== result.htmlHash) {
        // Simple heuristic: if title changed, or layout hashes differ
        const titleChanged = prev.title !== result.title;
        await db.insert(changeEvents).values({
          companyId,
          timestamp: snapshotTime,
          type: "redesign",
          description: titleChanged 
            ? `Site title updated from "${prev.title || ''}" to "${result.title || ''}" (Heuristic redesign)`
            : `HTML structural content change detected (Heuristic redesign)`,
        });
      }

      // 3. Status change
      const prevStatus = prev.httpStatus === 200 ? "live" : "dead";
      const currStatus = result.status;
      if (prevStatus !== currStatus) {
        await db.insert(changeEvents).values({
          companyId,
          timestamp: snapshotTime,
          type: "status_changed",
          description: `Website accessibility changed from ${prevStatus.toUpperCase()} to ${currStatus.toUpperCase()}`,
        });
      }
    }

    // Calculate lead score
    const leadScore = calculateLeadScore({
      status: result.status,
      hasHttps: result.hasHttps,
      copyrightYear: result.copyrightYear,
      hasGdpr: result.hasGdpr,
      technologies: result.technologies,
    });

    // Update Company Record
    // Check if new emails were found that weren't in the original database, append them
    await db
      .update(companies)
      .set({
        status: result.status,
        leadScore,
        lastCrawledAt: snapshotTime,
      })
      .where(eq(companies.id, companyId));

    console.log(`[CRAWL] Finished ID ${companyId} (${domain}). Score: ${leadScore}. Status: ${result.status} (isFull: ${isFull ? 1 : 0})`);
    return true;
  } catch (e: any) {
    console.error(`[CRAWL] Failed for ID ${companyId} (${domain}):`, e.message || e);
    // Do NOT set status to "dead" on system/database write failures!
    return false;
  }
}
