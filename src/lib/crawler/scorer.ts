export interface ScoreInput {
  status: string; // 'live', 'dead', 'redirect', 'pending'
  hasHttps: boolean;
  copyrightYear: number | null;
  hasGdpr: boolean;
  technologies: string[];
}

export function calculateLeadScore(input: ScoreInput): number {
  let score = 0;

  // 1. Core availability / status
  if (input.status === "dead") {
    // If the site is dead (or no website), it's a huge opportunity
    score += 35;
    return Math.min(score, 100);
  }

  if (input.status === "redirect") {
    // Redirect means they might have merged or changed domain
    score += 15;
  }

  // 2. SSL Security
  if (!input.hasHttps) {
    score += 20; // Massive security warning
  }

  // 3. GDPR Compliance (EU legal risk)
  if (!input.hasGdpr) {
    score += 15; // Legal liability hook for outreach
  }

  // 4. Outdated content / copyright year
  if (input.copyrightYear) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - input.copyrightYear;
    if (age >= 5) {
      score += 20; // Very old site (>= 5 years out of date)
    } else if (age >= 3) {
      score += 15; // 3-4 years old
    } else if (age >= 1) {
      score += 5;  // 1-2 years old
    }
  } else {
    // No copyright year detected usually means bad layout or outdated format
    score += 8;
  }

  // 5. Technology Stack Quality
  const techs = input.technologies;

  // Detect outdated/bad CMSs
  if (techs.includes("Joomla") || techs.includes("Drupal")) {
    score += 20; // Outdated, heavy, hard to manage CMS -> great Webflow/WordPress target
  }

  // If they are on Wix or Squarespace
  if (techs.includes("Wix") || techs.includes("Squarespace")) {
    score += 10; // Simple builders, might want a professional custom/WordPress site
  }

  // Check if they are missing any marketing analytics (meaning no active advertising)
  const hasAnalytics = techs.some((t) =>
    ["Google Tag Manager", "Google Analytics", "Facebook Pixel"].includes(t)
  );
  if (!hasAnalytics) {
    score += 10; // No marketing pixels -> good marketing/SEO pitch lead
  }

  // Redesign discount (If they use Webflow or Next.js, it's probably modern)
  if (techs.includes("Webflow") || techs.includes("Next.js") || techs.includes("Nuxt.js")) {
    score -= 15; // Low opportunity for web design agency
  }

  // Clamping score between 0 and 100
  return Math.max(0, Math.min(score, 100));
}

export function getLeadLabel(score: number, status: string): string {
  if (status === "pending") return "Pending";
  if (status === "dead") return "No Website / Dead";
  if (score >= 60) return "Hot Lead";
  if (score >= 35) return "Warm Opportunity";
  return "Low Priority";
}
