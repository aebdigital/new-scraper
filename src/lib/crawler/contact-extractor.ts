import * as cheerio from "cheerio";

export interface ContactExtractionResult {
  emails: string[];
  phones: string[];
}

const BAD_EMAIL_SUFFIXES = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js"];
const BAD_EMAIL_PARTS = [
  "example@",
  "@example.",
  "@yoursite.",
  "@yourwebsite.",
  "@email.",
  "sentry.io",
  "wixpress.com",
  "domain.com",
];
const COMMON_EMAIL_ALIASES = [
  "info",
  "kontakt",
  "office",
  "servis",
  "predaj",
  "obchod",
  "faktury",
  "faktúry",
  "sekretariat",
  "recepcia",
  "support",
];
const COMMON_TLDS = [".sk", ".com", ".eu", ".cz", ".net", ".org", ".biz", ".info"];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeEmail(value: string): string | null {
  let email = value
    .toLowerCase()
    .replace(/^mailto:/, "")
    .split("?")[0]
    .trim()
    .replace(/[),.;:]+$/, "");

  if (!email.includes("@")) return null;

  const atIndex = email.indexOf("@");
  const domainPart = email.slice(atIndex);
  const tldMatches = COMMON_TLDS
    .map((tld) => {
      const index = domainPart.indexOf(tld);
      return index >= 0 ? atIndex + index + tld.length : -1;
    })
    .filter((index) => index > atIndex);
  if (tldMatches.length > 0) {
    email = email.slice(0, Math.min(...tldMatches));
  }

  const [rawLocal, domain] = email.split("@");
  if (!rawLocal || !domain || !domain.includes(".")) return null;

  const alias = COMMON_EMAIL_ALIASES.find((candidate) => rawLocal.endsWith(candidate));
  const local = alias && rawLocal !== alias ? alias : rawLocal;
  email = `${local}@${domain}`;

  if (BAD_EMAIL_SUFFIXES.some((suffix) => email.endsWith(suffix))) return null;
  if (BAD_EMAIL_PARTS.some((part) => email.includes(part))) return null;

  return email;
}

export function normalizePhone(value: string): string | null {
  const raw = value
    .replace(/^tel:/i, "")
    .replace(/%20/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/[^\d+]/g, "");

  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  let national: string | null = null;
  if (digits.startsWith("421")) {
    national = digits.slice(3);
  } else if (digits.startsWith("0")) {
    national = digits.slice(1);
  } else if (digits.length === 9) {
    national = digits;
  }

  if (!national || national.length !== 9) return null;

  const first = national[0];
  if (!["2", "3", "4", "5", "8", "9"].includes(first)) return null;

  return `+421 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6, 9)}`;
}

function addPhoneCandidate(phones: Set<string>, value: string): void {
  const normalized = normalizePhone(value);
  if (!normalized) return;

  const digits = normalized.replace(/\D/g, "");
  if (/^0+$/.test(digits)) return;
  phones.add(normalized);
}

export function mergeContactList(
  existing: string | null | undefined,
  discovered: string[],
  limit = 5
): string | null {
  const values = new Set<string>();

  for (const value of (existing || "").split(/[,;\n]+/)) {
    const cleaned = normalizeWhitespace(value);
    if (cleaned) values.add(cleaned);
  }

  for (const value of discovered) {
    const cleaned = normalizeWhitespace(value);
    if (cleaned) values.add(cleaned);
  }

  return Array.from(values).slice(0, limit).join(", ") || null;
}

export function mergeEmailList(
  existing: string | null | undefined,
  discovered: string[],
  limit = 5
): string | null {
  const normalized = [
    ...(existing || "").split(/[,;\n]+/),
    ...discovered,
  ]
    .map((email) => normalizeEmail(email))
    .filter((email): email is string => Boolean(email));

  return Array.from(new Set(normalized)).slice(0, limit).join(", ") || null;
}

export function mergePhoneList(
  existing: string | null | undefined,
  discovered: string[],
  limit = 3
): string | null {
  const normalized = [
    ...(existing || "").split(/[,;\n]+/),
    ...discovered,
  ]
    .map((phone) => normalizePhone(phone))
    .filter((phone): phone is string => Boolean(phone));

  return Array.from(new Set(normalized)).slice(0, limit).join(", ") || null;
}

export function extractContactsFromHtml(html: string): ContactExtractionResult {
  const $ = cheerio.load(html);
  const emails = new Set<string>();
  const phones = new Set<string>();

  const bodyText = $("body").text();
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emailMatches = bodyText.match(emailRegex) || [];
  for (const match of emailMatches) {
    const normalized = normalizeEmail(match);
    if (normalized) emails.add(normalized);
  }

  $("a[href^='mailto:']").each((_, elem) => {
    const normalized = normalizeEmail($(elem).attr("href") || "");
    if (normalized) emails.add(normalized);
  });

  $("a[href^='tel:']").each((_, elem) => {
    addPhoneCandidate(phones, $(elem).attr("href") || "");
  });

  const searchableText = bodyText
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ");

  const phoneRegex = /(?:\+421|00421|0)[\s()./-]*(?:\d[\s()./-]*){8,11}/g;
  let phoneMatch: RegExpExecArray | null;
  while ((phoneMatch = phoneRegex.exec(searchableText)) !== null) {
    const start = Math.max(0, phoneMatch.index - 25);
    const end = Math.min(searchableText.length, phoneMatch.index + phoneMatch[0].length + 25);
    const context = searchableText.slice(start, end).toLowerCase();
    if (/(ičo|ico|dič|dic|ič dph|ic dph|iban|účet|ucet|bank|fakt[uú]ra|variabiln|copyright)/i.test(context)) {
      continue;
    }

    addPhoneCandidate(phones, phoneMatch[0]);
  }

  return {
    emails: Array.from(emails).slice(0, 5),
    phones: Array.from(phones).slice(0, 5),
  };
}

export function extractContactsFromText(text: string): ContactExtractionResult {
  return extractContactsFromHtml(`<body>${text}</body>`);
}
