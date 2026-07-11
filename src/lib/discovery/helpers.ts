/**
 * Shared helpers for website discovery — used by
 * src/scripts/discover-websites.ts (per-company search) and
 * src/scripts/bulk-directory-match.ts (bulk directory harvesting).
 */

import * as cheerio from "cheerio";
import dns from "dns/promises";

// ── Small utilities ──────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runPool<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
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

export function isSqliteBusy(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("SQLITE_BUSY") || message.includes("database is locked");
}

export function isUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("UNIQUE constraint failed");
}

export async function withDbRetry<T>(
  operation: () => Promise<T>,
  label: string,
  maxAttempts = 8
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isSqliteBusy(error) || attempt === maxAttempts) {
        throw error;
      }

      const waitMs = Math.min(500 * attempt, 4000);
      console.log(
        `[DB BUSY] ${label} — retry ${attempt}/${maxAttempts} in ${waitMs}ms`
      );
      await sleep(waitMs);
    }
  }

  throw new Error(`DB retry failed for ${label}`);
}

export async function dnsCheck(host: string): Promise<boolean> {
  try {
    await dns.lookup(host);
    return true;
  } catch {
    return false;
  }
}

// ── Company-name normalization ───────────────────────────────────────────────

export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function cleanCompanyName(name: string): string {
  // Remove legal suffixes for search
  return name
    .replace(/,?\s*s\.?\s*r\.?\s*o\.?\s*/gi, "")
    .replace(/,?\s*spol\.\s*s\s*r\.?\s*o\.?\s*/gi, "")
    .replace(/,?\s*a\.?\s*s\.?\s*/gi, "")
    .replace(/,?\s*k\.?\s*s\.?\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function nameToSlug(name: string): string {
  return stripDiacritics(cleanCompanyName(name).toLowerCase())
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function nameTokens(name: string): string[] {
  const stop = new Set([
    "stav", "stavby", "trade", "group", "plus", "slovakia", "slovensko",
    "spol", "real", "auto", "servis", "service", "company", "holding",
    "invest", "trans", "transport", "system", "market", "shop", "firma",
  ]);
  return [
    ...new Set(
      stripDiacritics(cleanCompanyName(name).toLowerCase())
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 3 && !stop.has(t))
    ),
  ];
}

export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.substring(4);
    return host || null;
  } catch {
    return null;
  }
}

// ── Host classification ──────────────────────────────────────────────────────

// Hosts that are never a company's own website
export const SKIP_HOSTS = [
  "facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com",
  "youtube.com", "tiktok.com", "pinterest.com", "wikipedia.org",
  "google.com", "google.sk", "duckduckgo.com", "bing.com", "maps.google",
  "finstat.sk", "foaf.sk", "orsr.sk", "zivefirmy.sk", "zoznam.sk",
  "firmy.sk", "cylex.sk", "cylex-slovakia.sk", "indexfiriem.sk", "katalogfiriem.sk",
  "azet.sk", "atlas.sk", "zlatestranky.sk", "podnikatel.sk", "123kontakt.sk",
  "obchodnyregister.sk", "registeruz.sk", "indexpodnikatela.sk",
  "europages.com", "dnb.com", "emis.com", "kompass.com", "infobel.com",
  "aktuality.sk", "sme.sk", "pravda.sk", "hnonline.sk", "topky.sk",
  "bisnode.sk", "edb.sk", "ezmluva.sk", "vsetkyfirmy.sk", "superfirmy.sk",
  "industrycontact.sk", "slovakiatrade.sk", "skfirmy.com", "firmyonline.sk",
  "kontakty.sk", "e-firmy.sk",
  // Domain marketplaces / parking services — a "live" page here is a sales
  // page. (No "dan.com": hostMatches is substring-based and would swallow
  // legitimate domains like heridan.com.)
  "hugedomains.com", "sedo.com", "godaddy.com", "afternic.com",
  "domainmarket.com", "namecheap.com", "parkingcrew.net", "bodis.com",
];

// Freemail providers + backend SaaS/infra hosts that are never a company's own
// public website. A "guessed" slug (e.g. "RENDER TRADE" -> render.com) or a
// contact email can accidentally land here, poisoning the company's domain.
// Matched EXACTLY or as a subdomain — never as a substring — so lookalike names
// like "compost.sk" are not swallowed by "post.sk". (Deliberately excludes site
// builders like wix.com/wordpress.com: a "company.wix.com" can be a real site.)
export const FREEMAIL_HOSTS = [
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "ymail.com",
  "hotmail.com", "outlook.com", "live.com", "msn.com", "icloud.com", "me.com",
  "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.net", "mail.com",
  "seznam.cz", "centrum.sk", "centrum.cz", "post.sk", "atlas.sk", "pobox.sk",
  // Backend SaaS / infra products — legitimate senders, never an SMB's own site
  "microsoft.com", "render.com", "netlify.com", "vercel.com", "supabase.com",
  "stripe.com", "github.com", "gitlab.com", "anthropic.com", "openai.com",
  "cloudflare.com", "notion.so", "slack.com", "aioseo.com",
];

export function isFreemailOrSaaS(domain: string): boolean {
  return FREEMAIL_HOSTS.some((s) => domain === s || domain.endsWith(`.${s}`));
}

// Directories that usually display the company's website — worth mining
export const DIRECTORY_HOSTS = [
  "finstat.sk", "zivefirmy.sk", "azet.sk", "zlatestranky.sk", "firmy.sk",
  "cylex.sk", "cylex-slovakia.sk", "edb.sk",
];

// Junk hosts to ignore when extracting links out of a directory page
export const EXTRACT_JUNK = [
  ...SKIP_HOSTS,
  "gstatic.com", "googleapis.com", "googletagmanager.com", "doubleclick.net",
  "cookiebot.com", "onetrust.com", "apple.com", "play.google.com",
  "mapy.cz", "openstreetmap.org", "w3.org", "cdn.", "fonts.",
  "unpkg.com", "mapbox.com", "maxcdn.com", "hithorizons.com",
  "aimg.sk", "ringier.sk",
];

export function hostMatches(domain: string, list: string[]): boolean {
  return list.some((s) => domain === s || domain.endsWith(`.${s}`) || domain.includes(s));
}

export function extractExternalLinks(html: string, sourceHost: string): string[] {
  const $ = cheerio.load(html);
  const found: string[] = [];
  const seen = new Set<string>();

  $("a[href^='http']").each((_, a) => {
    const href = $(a).attr("href");
    if (!href) return;
    const domain = extractDomain(href);
    if (!domain || seen.has(domain)) return;
    if (domain.includes(sourceHost) || hostMatches(domain, EXTRACT_JUNK)) return;
    seen.add(domain);
    found.push(href);
  });

  return found.slice(0, 5);
}

// ── Page fetching ────────────────────────────────────────────────────────────

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface PageResult {
  ok: boolean;
  status: number | null;
  html: string;
  finalUrl: string;
}

export async function fetchPage(url: string, timeoutMs = 8000): Promise<PageResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": BROWSER_UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "sk,cs,en;q=0.9",
      },
    });

    clearTimeout(timeout);
    const html = res.ok ? await res.text() : "";
    return { ok: res.ok, status: res.status, html, finalUrl: res.url || url };
  } catch {
    return { ok: false, status: null, html: "", finalUrl: url };
  }
}

// ── Website ↔ company verification ───────────────────────────────────────────

const PARKING_MARKERS = [
  "domain is for sale", "buy this domain", "domain parking", "parked domain",
  "domena je na predaj", "doména je na predaj", "zaparkovana", "zaparkovaná",
  "tato domena je registrovana", "táto doména je registrovaná",
  "webhosting zadarmo", "domain has been registered", "web hosting and domain",
];

export function isParkedPage(html: string): boolean {
  if (!html) return false;
  const lower = html.toLowerCase();
  return PARKING_MARKERS.some((m) => lower.includes(m));
}

// "strong"  = IČO or the full company-name slug on the page (near-certain match)
// "tokens"  = company name words on the page — also true of directories/news
//             that merely mention the company, so alone it is NOT proof
export type MatchLevel = "strong" | "tokens" | "weak" | "none";

export function verifyPageAgainstCompany(
  html: string,
  company: { name: string; ico: string | null }
): MatchLevel {
  if (!html) return "none";
  const haystack = stripDiacritics(html.toLowerCase());

  // IČO on the page is the gold standard (allow "36 123 456" style spacing)
  if (company.ico) {
    const digits = company.ico.replace(/\D/g, "");
    if (digits.length >= 6) {
      const icoRegex = new RegExp(digits.split("").join("\\s?"));
      if (icoRegex.test(haystack)) return "strong";
    }
  }

  // Full cleaned-name slug appearing in the page text/markup
  const slug = nameToSlug(company.name);
  if (slug.length >= 5 && haystack.replace(/[^a-z0-9]/g, "").includes(slug)) {
    return "strong";
  }

  const tokens = nameTokens(company.name);
  const hits = tokens.filter((t) => haystack.includes(t)).length;
  if (tokens.length >= 2 && hits >= 2) return "tokens";
  if (tokens.length === 1 && tokens[0].length >= 5 && hits === 1) return "tokens";
  if (hits >= 1) return "weak";
  return "none";
}

export function domainMatchesSlug(domain: string, companyName: string): boolean {
  const slug = nameToSlug(companyName);
  if (!slug || slug.length < 4) return false;
  const label = domain.split(".")[0].replace(/-/g, "");
  if (!label || label.length < 4) return false;
  return label === slug || label.includes(slug) || slug.includes(label);
}
