import * as cheerio from "cheerio";
import { extractContactsFromHtml } from "./contact-extractor";

export interface TechDetectionResult {
  technologies: string[];
  copyrightYear: number | null;
  hasGdpr: boolean;
  emails: string[];
  phones: string[];
}

export function detectTechnologies(
  html: string,
  headers: Record<string, string>
): TechDetectionResult {
  const $ = cheerio.load(html);
  const techs: string[] = [];

  const htmlLower = html.toLowerCase();

  // 1. Meta generator checks
  const generator = $("meta[name='generator']").attr("content") || "";
  const generatorLower = generator.toLowerCase();

  if (generatorLower.includes("wordpress")) techs.push("WordPress");
  else if (htmlLower.includes("wp-content") || htmlLower.includes("wp-includes")) {
    if (!techs.includes("WordPress")) techs.push("WordPress");
  }

  if (generatorLower.includes("webflow") || htmlLower.includes("data-wf-page") || htmlLower.includes("data-wf-site")) {
    techs.push("Webflow");
  }

  if (generatorLower.includes("joomla") || htmlLower.includes("/media/jui/") || htmlLower.includes("com_content")) {
    techs.push("Joomla");
  }

  if (generatorLower.includes("drupal") || htmlLower.includes("sites/all/modules") || htmlLower.includes("sites/default/files")) {
    techs.push("Drupal");
  }

  if (htmlLower.includes("shoptet") || htmlLower.includes("cdn.myshoptet.com")) {
    techs.push("Shoptet (E-shop)");
  }

  if (htmlLower.includes("wix.com") || htmlLower.includes("wix-image") || headers["x-wix-renderer-elapsed"]) {
    techs.push("Wix");
  }

  if (htmlLower.includes("squarespace")) {
    techs.push("Squarespace");
  }

  if (htmlLower.includes("_next/static") || htmlLower.includes("__next_data__")) {
    techs.push("Next.js");
  }

  if (htmlLower.includes("nuxt") || htmlLower.includes("__nuxt")) {
    techs.push("Nuxt.js");
  }

  // 2. Pixels & Analytics detection
  if (htmlLower.includes("googletagmanager.com/gtm.js") || htmlLower.includes("gtm-")) {
    techs.push("Google Tag Manager");
  }

  if (htmlLower.includes("google-analytics.com/analytics.js") || htmlLower.includes("googletagmanager.com/gtag/js") || htmlLower.includes("ga(")) {
    techs.push("Google Analytics");
  }

  if (htmlLower.includes("connect.facebook.net") || htmlLower.includes("fbq(")) {
    techs.push("Facebook Pixel");
  }

  if (htmlLower.includes("hotjar.com") || htmlLower.includes("hj(")) {
    techs.push("Hotjar");
  }

  // CDN / Server signatures
  const serverHeader = (headers["server"] || "").toLowerCase();
  if (serverHeader.includes("cloudflare")) {
    techs.push("Cloudflare");
  } else if (serverHeader.includes("websupport") || htmlLower.includes("websupport.sk")) {
    techs.push("Websupport Hosting");
  } else if (serverHeader.includes("webglobe") || htmlLower.includes("webglobe.sk")) {
    techs.push("Webglobe Hosting");
  }

  // If we found nothing but standard elements, tag as "Custom / Static HTML"
  if (techs.length === 0) {
    techs.push("Custom HTML/PHP");
  }

  // 3. Copyright Year Extraction
  let copyrightYear: number | null = null;
  // Match patterns like © 2023, copyright 2024, © 2018-2026, etc.
  const copyrightRegexes = [
    /(?:©|copyright|cop\.)\s*(?:20\d{2}\s*-\s*)?(20\d{2})/i,
    /(20\d{2})\s*(?:©|copyright|cop\.)/i,
  ];

  // Search in the text of elements likely to contain footers
  const footerText = $("footer, .footer, #footer, [class*='footer']").text() || $("body").text();
  if (footerText) {
    for (const regex of copyrightRegexes) {
      const match = footerText.match(regex);
      if (match && match[1]) {
        const year = parseInt(match[1], 10);
        if (year >= 1995 && year <= new Date().getFullYear() + 2) {
          copyrightYear = year;
          break;
        }
      }
    }
  }

  // 4. GDPR / Privacy Policy check
  // Look for anchors with typical Slovak privacy/cookie policy words
  let hasGdpr = false;
  $("a").each((_, elem) => {
    const text = $(elem).text().toLowerCase();
    const href = $(elem).attr("href") || "";
    if (
      text.includes("ochrana osobných údajov") ||
      text.includes("ochrana udajov") ||
      text.includes("cookies") ||
      text.includes("súkromia") ||
      text.includes("sukromia") ||
      href.includes("gdpr") ||
      href.includes("cookies") ||
      href.includes("ochrana-osobnych-udajov")
    ) {
      hasGdpr = true;
    }
  });

  // 5. Contact extraction
  const contacts = extractContactsFromHtml(html);

  return {
    technologies: Array.from(new Set(techs)),
    copyrightYear,
    hasGdpr,
    emails: contacts.emails,
    phones: contacts.phones,
  };
}

// ── Footer Agency Detection ──────────────────────────────────────────────────

export interface FooterAgencyResult {
  agencyName: string;
  agencyUrl: string | null;
  agencyDomain: string | null;
}

const BLACKLISTED_AGENCY_NAMES = new Set([
  "ochrana osobných údajov",
  "ochrana osobnych udajov",
  "ochrana súkromia",
  "ochrana sukromia",
  "ochrana osobných udajov",
  "ochrana udajov",
  "gdpr",
  "cookies",
  "nastavenia cookies",
  "súkromia",
  "sukromia",
  "všeobecné obchodné podmienky",
  "všeobecné podmienky",
  "všeobecné podmienky používania",
  "všeobecne obchodné podmienky",
  "vop",
  "hlavná stránka",
  "hlavna stranka",
  "domovská stránka",
  "domovska stranka",
  "úvodná stránka",
  "uvodna stranka",
  "úvod",
  "uvod",
  "domov",
  "kontakt",
  "kontakty",
  "mapa stránok",
  "mapa stranok",
  "mapa webu",
  "sitemap",
  "stránok",
  "stránky",
  "stránka",
  "webstránky",
  "webstránka",
  "stavieb",
  "realizacia stavieb",
  "realizácia stavieb",
  "realizacia-stavieb",
  "bezplatná webstránka",
  "bezplatný web",
  "zdarmawebnode",
  "copyright",
  "all rights reserved",
  "tvorba eshopu",
  "tvorba webu",
  "tvorba stránok",
  "webdesign",
  "webdizajn",
  "cstudios",
  "cstudios s.r.o.",
  "prejsť na úvod",
  "vytvoriť web",
  "vytvoriť eshop",
  "vytvoriť stránku",
  "prejsť hore",
  "hore",
  "späť na úvod",
  "späť hore",
  "napíšte nám",
  "zavolajte nám",
  "podmienky",
  "obchodné podmienky",
  "obchodne podmienky",
  "hlásenie chýb",
  "vyhlásenie o prístupnosti",
  "redakčný systém",
  "redakcny system",
  "webmaster",
  "admin",
  "prihlásenie",
  "prihlasenie",
  "hore",
  "zadarmo",
  "webnode",
  "shoptet",
  "wordpress"
]);

const BLACKLISTED_DOMAINS = new Set([
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "youtube.com",
  "google.com",
  "wordpress.org",
  "wordpress.com",
  "wix.com",
  "squarespace.com",
  "shopify.com",
  "webflow.com",
  "cloudflare.com",
  "godaddy.com",
  "freepik.com",
  "elegantthemes.com",
  "themefreesia.com",
  "webnode.sk",
  "webnode.com",
  "shoptet.sk",
  "shoptet.cz",
  "webareal.sk",
  "webareal.cz",
  "estranky.sk",
  "estranky.cz",
  "odoo.com",
  "joomla.org",
  "drupal.org",
  "adobe.com",
  "pinterest.com",
  "tiktok.com",
  "behance.net",
  "dribbble.com",
  "github.com",
  "fb.com",
  "wixsite.com",
  "blogspot.com",
  "google.sk",
  "google.cz",
  "youtube.sk",
  "facebook.sk"
]);

export function isValidAgencyName(name: string): boolean {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");

  if (normalized.length < 2 || normalized.length > 50) return false;

  // Reject if it is just numbers, phone formats, or email addresses
  if (/^[\d\s+\-()]+$/.test(normalized)) return false;
  if (normalized.includes("@")) return false;

  // Reject exact matches from the blacklist
  if (BLACKLISTED_AGENCY_NAMES.has(normalized)) return false;

  // Reject if it matches common noise prefixes
  const badPrefixes = [
    "ochrana ",
    "všeobecné ",
    "všeobecne ",
    "mapa ",
    "hlavná ",
    "hlavna ",
    "domovská ",
    "domovska ",
    "úvodná ",
    "uvodna ",
    "copyright ",
    "vytvoriť ",
    "vytvorit ",
    "prejsť ",
    "prejst ",
    "späť ",
    "spat ",
    "zavolajte ",
    "napíšte ",
    "napiste "
  ];

  if (badPrefixes.some((p) => normalized.startsWith(p))) return false;

  // Reject generic words
  const genericWords = [
    "stránky",
    "stránok",
    "stránka",
    "webstránka",
    "webstránky",
    "web",
    "webová stránka",
    "webové stránky",
    "webova stranka",
    "webove stranky",
    "tvorba webu",
    "tvorba stránok",
    "tvorba webstránok",
    "tvorba e-shopu",
    "tvorba eshopu",
    "vyrobené pre",
    "vyrobene pre",
    "prevádzkovateľ",
    "prevadzkovatel",
    "správca webu",
    "spravca webu"
  ];

  if (genericWords.includes(normalized)) return false;

  return true;
}

export function isValidAgencyDomain(domain: string | null): boolean {
  if (!domain) return false; // In practice, we only want rivals with a domain
  const normalized = domain.trim().toLowerCase();

  if (BLACKLISTED_DOMAINS.has(normalized)) return false;

  // Check if it's one of the skip domains or subdomains of them
  for (const skip of BLACKLISTED_DOMAINS) {
    if (normalized === skip || normalized.endsWith(`.${skip}`)) {
      return false;
    }
  }

  return true;
}

/**
 * Detect the web design agency that built a website by analyzing footer content.
 * Looks for patterns like "Vytvoril: Agency Name", "Made by Agency", etc.
 */
export function detectFooterAgency(
  html: string
): FooterAgencyResult | null {
  const $ = cheerio.load(html);

  // Slovak and English patterns. Consume trailing generic noise words so the actual name/link is matched
  const agencyPatterns = [
    // Slovak: matches "vytvoril", "tvorba webu", "tvorba webových stránok od", "realizácia", etc.
    /(?:vytvoril[ao]?|tvorba|webdesign|webdizajn|realizácia|realizacia|naprogramoval|navrhol)\s+(?:webov(?:ých|ej)?\s+strán(?:ok|ky|ku)?|web\s+strán(?:ok|ky|ku)?|webstrán(?:ok|ky|ku)?|strán(?:ok|ky|ku)?|e-?shop(?:ov|u)?|web(?:u|ov)?|portálu?|projektu?)?\s*(?:od\s+spoločnosti|od\s+firmy|od|by)?\s*[:|\-–—]?\s*/i,
    // English
    /(?:made|powered|built|designed?|created?|developed?|web|site)\s+by\s*[:|\-–—]?\s*/i,
  ];

  const footerSelectors = ["footer", ".footer", "#footer", "[class*='footer']", "[id*='footer']"];
  let footerHtml = "";
  let $footer: cheerio.Cheerio<any> = $("footer");

  for (const sel of footerSelectors) {
    const el = $(sel);
    if (el.length > 0) {
      $footer = el;
      footerHtml = el.html() || "";
      break;
    }
  }

  // If no footer found, check last 20% of body
  if (!footerHtml) {
    const bodyChildren = $("body").children();
    const lastQuarter = bodyChildren.slice(Math.floor(bodyChildren.length * 0.8));
    footerHtml = lastQuarter.html() || "";
    $footer = lastQuarter;
  }

  if (!footerHtml) return null;

  const footerText = $footer.text().trim();

  // Check each pattern against footer text
  for (const pattern of agencyPatterns) {
    const match = footerText.match(pattern);
    if (!match) continue;

    const afterMatch = footerText.substring((match.index || 0) + match[0].length).trim();

    // Find the link closest to this text match
    const allLinks = $footer.find("a");
    let bestLink: { name: string; url: string } | null = null;

    for (const el of allLinks.toArray()) {
      const linkText = $(el).text().trim();
      const href = $(el).attr("href") || "";

      if (!linkText || linkText.length < 2 || linkText.length > 80) continue;
      if (!href || href === "#" || href.startsWith("mailto:") || href.startsWith("tel:")) continue;

      // Check if this link's text appears near the pattern match
      // If afterMatch starts with the linkText (ignoring leading whitespace or non-alphanumeric chars)
      const cleanAfter = afterMatch.toLowerCase().replace(/^[^a-z0-9]+/g, "");
      const cleanLink = linkText.toLowerCase();

      if (cleanAfter.startsWith(cleanLink)) {
        const domain = extractDomainFromHref(href);
        if (domain && isValidAgencyDomain(domain) && isValidAgencyName(linkText)) {
          bestLink = { name: linkText, url: href };
        }
      }
    }

    if (bestLink) {
      const domain = extractDomainFromHref(bestLink.url);
      return {
        agencyName: bestLink.name,
        agencyUrl: bestLink.url.startsWith("http") ? bestLink.url : `https://${bestLink.url}`,
        agencyDomain: domain,
      };
    }

    // No link found, but maybe there's just a text name after the pattern
    const textName = afterMatch.split(/[\n\r|•·,]/)[0]?.trim();
    if (textName && isValidAgencyName(textName)) {
      // Check if there's a nearby link that could be the agency domain
      let nearbyUrl: string | null = null;
      let nearbyDomain: string | null = null;

      allLinks.each((_, el) => {
        const linkText = $(el).text().trim().toLowerCase();
        const href = $(el).attr("href") || "";
        if (
          linkText === textName.toLowerCase() ||
          href.toLowerCase().includes(textName.toLowerCase().replace(/\s+/g, ""))
        ) {
          const domain = extractDomainFromHref(href);
          if (domain && isValidAgencyDomain(domain)) {
            nearbyDomain = domain;
            nearbyUrl = href.startsWith("http") ? href : `https://${href}`;
          }
        }
      });

      // We only return it if we have a valid domain or a highly plausible name
      if (nearbyDomain || textName.includes(".")) {
        return {
          agencyName: textName,
          agencyUrl: nearbyUrl,
          agencyDomain: nearbyDomain,
        };
      }
    }
  }

  // Strategy 2: Look for external links in footer that look like agency sites
  const externalLinks: { name: string; url: string; domain: string }[] = [];

  $footer.find("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim();
    if (!href.startsWith("http")) return;
    if (!text || text.length < 2 || text.length > 50) return;

    const domain = extractDomainFromHref(href);
    if (!domain) return;
    if (!isValidAgencyDomain(domain) || !isValidAgencyName(text)) return;

    // Agency-like keywords in domain or text
    const agencyKeywords = [
      "web", "design", "studio", "digital", "creative", "agency",
      "tvorba", "stránk", "media", "dev", "code", "pixel", "brand",
    ];

    const combined = `${text} ${domain}`.toLowerCase();
    if (agencyKeywords.some((kw) => combined.includes(kw))) {
      externalLinks.push({ name: text, url: href, domain });
    }
  });

  if (externalLinks.length === 1) {
    // Single agency-like link in footer — high confidence
    return {
      agencyName: externalLinks[0].name,
      agencyUrl: externalLinks[0].url,
      agencyDomain: externalLinks[0].domain,
    };
  }

  // Strategy 3: Check if the site is self-built using Wix or Webnode
  const htmlLower = html.toLowerCase();
  const generator = $("meta[name='generator']").attr("content") || "";
  const generatorLower = generator.toLowerCase();

  const isWix =
    htmlLower.includes("wix.com") ||
    htmlLower.includes("wix-image") ||
    generatorLower.includes("wix");

  const isWebnode =
    htmlLower.includes("webnode.sk") ||
    htmlLower.includes("webnode.com") ||
    htmlLower.includes("webnode") ||
    generatorLower.includes("webnode");

  if (isWix || isWebnode) {
    return {
      agencyName: "Self?(Webnode/Wix)",
      agencyUrl: null,
      agencyDomain: null,
    };
  }

  return null;
}

export function extractDomainFromHref(href: string): string | null {
  try {
    const url = href.startsWith("http") ? href : `https://${href}`;
    const parsed = new URL(url);
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.substring(4);
    return host;
  } catch {
    return null;
  }
}
