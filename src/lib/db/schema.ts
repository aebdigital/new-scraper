import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// Companies Table
export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ico: text("ico"), // Slovak company identifier from RPO/ORSF when known
  rpoId: integer("rpo_id"), // Stable source record id from the official RPO bulk export
  rpoImportedAt: integer("rpo_imported_at"), // Timestamp (ms) when imported from RPO bulk data
  name: text("name").notNull(),
  city: text("city"),
  website: text("website"),
  domain: text("domain").unique(), // Cleaned & normalized unique domain
  phone: text("phone"),
  address: text("address"),
  emailsFound: text("emails_found"), // Original emails from Excel
  leadScore: integer("lead_score").default(0).notNull(),
  status: text("status").default("pending").notNull(), // 'pending', 'live', 'dead', 'redirect'
  revenue: integer("revenue"), // FinStat Tržby in EUR
  profit: integer("profit"),   // FinStat Zisk in EUR
  assets: integer("assets"),   // FinStat Aktíva in EUR
  financialYear: integer("financial_year"), // Financial year of data
  finstatRank: integer("finstat_rank"), // Rank in FinStat Top 200 (1-200)
  lastCrawledAt: integer("last_crawled_at"), // Timestamp (ms)
  orsfEnriched: integer("orsf_enriched").default(0).notNull(), // Track if ORSF lookup has run
  nace: text("nace"), // Raw 5-digit NACE code (e.g. "43210")
  naceSection: text("nace_section"), // NACE letter section (e.g. "F")
  naceDivision: text("nace_division"), // NACE 2-digit division (e.g. "43")
  naceSubdivision: text("nace_subdivision"), // NACE full subdivision (e.g. "43210")
  legalFormCode: text("legal_form_code"), // 'sro' or 'sole_trader'
  googleSearched: integer("google_searched").default(0).notNull(), // Track if website search has run
  contactSearched: integer("contact_searched").default(0).notNull(), // Track if contact extraction has run
  contactSearchedAt: integer("contact_searched_at"), // Timestamp (ms) when contact extraction last ran
  websiteAgencyId: integer("website_agency_id"), // FK to rivals table (who built their website)
  createdAt: integer("created_at").$defaultFn(() => Date.now()),
});

// Website Snapshots Table (Historical records)
export const websiteSnapshots = sqliteTable("website_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  crawledAt: integer("crawled_at").notNull(),
  httpStatus: integer("http_status"),
  title: text("title"),
  metaDescription: text("meta_description"),
  techStack: text("tech_stack"), // JSON-serialized array of detected techs (e.g. ["WordPress", "Google Analytics"])
  copyrightYear: integer("copyright_year"),
  hasHttps: integer("has_https"), // 0 or 1
  hasGdpr: integer("has_gdpr"), // 0 or 1 (cookies/privacy policy checks)
  emailAddresses: text("email_addresses"), // Found during crawl (comma-separated)
  htmlHash: text("html_hash"), // To compare visual/structural content changes
  screenshotUrl: text("screenshot_url"),
  cleanedTextContent: text("cleaned_text_content"),
  rawHtml: text("raw_html"),
  isFull: integer("is_full").default(0).notNull(),
});

// Change Events Table (Triggered when changes are detected)
export const changeEvents = sqliteTable("change_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  timestamp: integer("timestamp").notNull(),
  type: text("type").notNull(), // 'cms_changed', 'redesign', 'status_changed', 'new_email'
  description: text("description").notNull(),
});

// Communications Table — Past email/call history with companies (imported from Gmail Takeout mbox, carrier call logs, etc.)
export const communications = sqliteTable("communications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").references(() => companies.id, {
    onDelete: "set null",
  }), // Nullable: a message we couldn't match to a known company is still kept
  channel: text("channel").notNull().default("email"), // 'email' | 'call'
  direction: text("direction").notNull(), // 'in' | 'out'
  occurredAt: integer("occurred_at").notNull(), // Timestamp (ms) the message was sent/received
  counterpartyEmail: text("counterparty_email"), // The other party's address
  counterpartyDomain: text("counterparty_domain"), // Domain of the other party (matching key)
  counterpartyName: text("counterparty_name"), // Display name if present
  ownerEmail: text("owner_email"), // Which of our @aebdig.com addresses was involved
  subject: text("subject"),
  bodyText: text("body_text"), // Decoded plain-text body of the email (attachments stripped)
  durationSec: integer("duration_sec"), // For calls
  messageId: text("message_id").unique(), // RFC Message-ID (or synthesized) — dedupe key for idempotent re-import
  source: text("source").notNull().default("gmail_mbox"), // Provenance: 'gmail_mbox' | 'carrier_calls' | ...
  createdAt: integer("created_at").$defaultFn(() => Date.now()),
});

// Rivals Table — Web design agencies that build client websites
export const rivals = sqliteTable("rivals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  website: text("website"),
  domain: text("domain").unique(),
  city: text("city"),
  phone: text("phone"),
  email: text("email"),
  totalClients: integer("total_clients").default(0).notNull(),
  constructionClients: integer("construction_clients").default(0).notNull(),
  portfolioUrl: text("portfolio_url"), // Their /portfolio or /referencie page
  status: text("status").default("active").notNull(), // 'active' | 'inactive'
  firstSeen: integer("first_seen").$defaultFn(() => Date.now()),
  lastCheckedAt: integer("last_checked_at"),
});

// Rival Clients — Many-to-many: which rival made which company's website
export const rivalClients = sqliteTable("rival_clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rivalId: integer("rival_id")
    .notNull()
    .references(() => rivals.id, { onDelete: "cascade" }),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  detectionMethod: text("detection_method").notNull(), // 'footer' | 'portfolio' | 'both'
  confidenceScore: integer("confidence_score").default(75).notNull(), // 0-100
  firstDetectedAt: integer("first_detected_at").$defaultFn(() => Date.now()),
  lastConfirmedAt: integer("last_confirmed_at"),
});

// Relations
export const companiesRelations = relations(companies, ({ many, one }) => ({
  snapshots: many(websiteSnapshots),
  events: many(changeEvents),
  rivalLinks: many(rivalClients),
  communications: many(communications),
  builtBy: one(rivals, {
    fields: [companies.websiteAgencyId],
    references: [rivals.id],
  }),
}));

export const communicationsRelations = relations(communications, ({ one }) => ({
  company: one(companies, {
    fields: [communications.companyId],
    references: [companies.id],
  }),
}));

export const websiteSnapshotsRelations = relations(websiteSnapshots, ({ one }) => ({
  company: one(companies, {
    fields: [websiteSnapshots.companyId],
    references: [companies.id],
  }),
}));

export const changeEventsRelations = relations(changeEvents, ({ one }) => ({
  company: one(companies, {
    fields: [changeEvents.companyId],
    references: [companies.id],
  }),
}));

export const rivalsRelations = relations(rivals, ({ many }) => ({
  clients: many(rivalClients),
}));

export const rivalClientsRelations = relations(rivalClients, ({ one }) => ({
  rival: one(rivals, {
    fields: [rivalClients.rivalId],
    references: [rivals.id],
  }),
  company: one(companies, {
    fields: [rivalClients.companyId],
    references: [companies.id],
  }),
}));
