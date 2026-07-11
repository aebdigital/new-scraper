#!/usr/bin/env python3
"""
Import a Gmail Takeout .mbox ("Pošta") into the CMS `communications` table.

Streaming, headers-only: never loads message bodies/attachments into memory, so
a multi-GB mailbox imports quickly. Extracts sender/recipients/date/subject,
decides direction (out = from one of our @aebdig.com addresses), picks the
counterparty, and links each message to a company by domain, then by contact email.

Idempotent: re-running skips already-imported messages (unique Message-ID).

Usage:  python3 src/scripts/import-mbox.py [path-to.mbox]
"""
import glob, os, re, sys, sqlite3, email, hashlib
from email.utils import getaddresses, parsedate_to_datetime
from email.header import decode_header, make_header

OWNER_DOMAINS = ("aebdig.com",)  # addresses we own -> messages from these are "out"
DB = "sqlite.db"

# Freemail + backend SaaS/infra domains that are never a company's own site.
# Kept in sync with FREEMAIL_HOSTS in src/lib/discovery/helpers.ts. We never link
# a message to a company by these domains (a company holding one is bad data).
BLOCK_DOMAINS = {
    "gmail.com", "googlemail.com", "google.com", "yahoo.com", "yahoo.co.uk",
    "ymail.com", "hotmail.com", "outlook.com", "live.com", "msn.com",
    "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com",
    "gmx.com", "gmx.net", "mail.com", "seznam.cz", "centrum.sk", "centrum.cz",
    "post.sk", "atlas.sk", "pobox.sk", "zoznam.sk", "azet.sk",
    "microsoft.com", "render.com", "netlify.com", "vercel.com", "supabase.com",
    "stripe.com", "github.com", "gitlab.com", "anthropic.com", "openai.com",
    "cloudflare.com", "notion.so", "slack.com", "aioseo.com",
}

CREATE_SQL = """
CREATE TABLE IF NOT EXISTS communications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  direction TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  counterparty_email TEXT,
  counterparty_domain TEXT,
  counterparty_name TEXT,
  owner_email TEXT,
  subject TEXT,
  body_text TEXT,
  duration_sec INTEGER,
  message_id TEXT UNIQUE,
  source TEXT NOT NULL DEFAULT 'gmail_mbox',
  created_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_comm_company  ON communications(company_id);
CREATE INDEX IF NOT EXISTS idx_comm_domain   ON communications(counterparty_domain);
CREATE INDEX IF NOT EXISTS idx_comm_occurred ON communications(occurred_at);
"""


def dec(v):
    if not v:
        return None
    try:
        return str(make_header(decode_header(v))).strip()
    except Exception:
        return v.strip()


def is_owner(addr):
    return any(addr.endswith("@" + d) for d in OWNER_DOMAINS)


def _decode_part(part):
    try:
        payload = part.get_payload(decode=True)
        if payload is None:
            return None
        charset = part.get_content_charset() or "utf-8"
        return payload.decode(charset, "replace")
    except Exception:
        return None


def _strip_html(html):
    html = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", html)
    html = re.sub(r"(?s)<[^>]+>", " ", html)
    for a, b in (("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&#39;", "'"), ("&quot;", '"')):
        html = html.replace(a, b)
    html = re.sub(r"[ \t]+", " ", html)
    return html


def extract_body(msg):
    """First text/plain part (falling back to stripped text/html), attachments skipped."""
    text = html = None
    parts = msg.walk() if msg.is_multipart() else [msg]
    for part in parts:
        if part.is_multipart():
            continue
        if "attachment" in str(part.get("Content-Disposition") or "").lower():
            continue
        ctype = part.get_content_type()
        if ctype == "text/plain" and text is None:
            text = _decode_part(part)
        elif ctype == "text/html" and html is None:
            html = _decode_part(part)
    body = text if text else (_strip_html(html) if html else None)
    if body:
        body = re.sub(r"\n[ \t]*\n[ \t]*\n+", "\n\n", body).strip()[:40000]
    return body or None


def process(header_bytes, rows):
    if not header_bytes:
        return
    msg = email.message_from_bytes(header_bytes)
    frm = msg.get("From", "")
    subj = dec(msg.get("Subject"))
    mid = msg.get("Message-ID") or msg.get("Message-Id")
    date = msg.get("Date")
    try:
        ts = int(parsedate_to_datetime(date).timestamp() * 1000) if date else None
    except Exception:
        ts = None
    if ts is None:
        return  # undateable -> useless as a timeline entry

    from_addrs = getaddresses([frm])
    to_addrs = getaddresses([msg.get("To", "")]) + getaddresses([msg.get("Cc", "")])
    from_emails = [a.lower() for _, a in from_addrs if "@" in a]
    sent = any(is_owner(a) for a in from_emails)
    direction = "out" if sent else "in"

    owner_email = cp_email = cp_name = None
    if sent:
        owner_email = next((a for a in from_emails if is_owner(a)), None)
        for name, a in to_addrs:  # first external recipient
            al = a.lower()
            if "@" in al and not is_owner(al):
                cp_email, cp_name = al, dec(name)
                break
        if not cp_email and to_addrs:  # internal-only mail
            name, a = to_addrs[0]
            cp_email, cp_name = a.lower(), dec(name)
    else:
        if from_addrs:
            name, a = from_addrs[0]
            cp_email, cp_name = a.lower(), dec(name)
        owner_email = next((a.lower() for _, a in to_addrs if is_owner(a.lower())), None)

    cp_domain = cp_email.split("@")[1] if cp_email and "@" in cp_email else None
    body = extract_body(msg)
    if not mid:
        mid = "synth:" + hashlib.sha1(
            f"{date}|{subj}|{cp_email}|{direction}".encode("utf-8", "replace")
        ).hexdigest()

    rows.append(
        (direction, ts, cp_email, cp_domain, cp_name, owner_email, subj, body, mid)
    )


def parse_mbox(path):
    """Stream full messages (mboxrd: a 'From ' delimiter is preceded by a blank line)."""
    rows = []
    buf = bytearray()
    first = True
    prev_blank = True  # start of file counts as preceded by a blank line
    with open(path, "rb") as fh:
        for raw in fh:
            if raw.startswith(b"From ") and prev_blank and b"@" in raw:
                if not first:
                    process(bytes(buf), rows)
                buf = bytearray()
                first = False
                prev_blank = False
                continue
            buf += raw
            prev_blank = raw in (b"\n", b"\r\n")
        if not first:
            process(bytes(buf), rows)
    return rows


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else None
    if not path:
        cands = glob.glob("*.mbox")
        if not cands:
            sys.exit("No .mbox file found in current directory.")
        path = max(cands, key=os.path.getsize)
    print(f"Parsing: {path}  ({os.path.getsize(path)/1e9:.1f} GB)")

    rows = parse_mbox(path)
    print(f"Parsed {len(rows)} dateable messages.")

    con = sqlite3.connect(DB, timeout=60)
    con.execute("PRAGMA busy_timeout=60000")
    con.executescript(CREATE_SQL)
    # Backfill the body_text column onto a pre-existing table (CREATE ... IF NOT EXISTS
    # won't add columns to a table made before this column existed).
    cols = {r[1] for r in con.execute("PRAGMA table_info(communications)")}
    if "body_text" not in cols:
        con.execute("ALTER TABLE communications ADD COLUMN body_text TEXT")

    before = con.execute("SELECT COUNT(*) FROM communications").fetchone()[0]
    # Upsert: new messages inserted; already-imported ones get their body/subject
    # backfilled WITHOUT touching a company_id we may have cleaned up.
    con.executemany(
        """INSERT INTO communications
             (direction, channel, occurred_at, counterparty_email, counterparty_domain,
              counterparty_name, owner_email, subject, body_text, message_id, source, created_at)
           VALUES (?, 'email', ?, ?, ?, ?, ?, ?, ?, ?, 'gmail_mbox',
                   CAST(strftime('%s','now') AS INTEGER)*1000)
           ON CONFLICT(message_id) DO UPDATE SET
             body_text = excluded.body_text,
             subject   = COALESCE(excluded.subject, communications.subject)""",
        rows,
    )
    con.commit()
    inserted = con.execute("SELECT COUNT(*) FROM communications").fetchone()[0] - before
    print(f"Inserted {inserted} new rows; backfilled bodies on {len(rows)-inserted} existing.")

    # --- Match by exact domain (companies.domain is UNIQUE + indexed) ---
    # Skip freemail/SaaS domains: linking by these produces false positives.
    cur = con.cursor()
    ph = ",".join("?" * len(BLOCK_DOMAINS))
    cur.execute(
        f"""UPDATE communications
              SET company_id = (SELECT c.id FROM companies c
                                 WHERE c.domain = communications.counterparty_domain)
            WHERE company_id IS NULL AND counterparty_domain IS NOT NULL
              AND counterparty_domain NOT IN ({ph})
              AND EXISTS (SELECT 1 FROM companies c
                           WHERE c.domain = communications.counterparty_domain)""",
        tuple(BLOCK_DOMAINS),
    )
    n_dom = cur.rowcount
    con.commit()

    # --- Match remaining by contact email (companies.emails_found) ---
    email2id = {}
    for cid, ef in con.execute(
        "SELECT id, emails_found FROM companies WHERE emails_found IS NOT NULL AND emails_found != ''"
    ):
        for tok in re.split(r"[,;\s]+", ef.lower()):
            tok = tok.strip()
            if "@" in tok and tok not in email2id:
                email2id[tok] = cid
    updates = []
    for cid_row in con.execute(
        "SELECT id, counterparty_email FROM communications "
        "WHERE company_id IS NULL AND counterparty_email IS NOT NULL AND source='gmail_mbox'"
    ):
        hit = email2id.get(cid_row[1])
        if hit:
            updates.append((hit, cid_row[0]))
    cur.executemany("UPDATE communications SET company_id=? WHERE id=?", updates)
    n_email = len(updates)
    con.commit()

    # --- Report ---
    q = lambda s: con.execute(s).fetchone()[0]
    total = q("SELECT COUNT(*) FROM communications WHERE source='gmail_mbox'")
    linked = q("SELECT COUNT(*) FROM communications WHERE source='gmail_mbox' AND company_id IS NOT NULL")
    out = q("SELECT COUNT(*) FROM communications WHERE source='gmail_mbox' AND direction='out'")
    companies_hit = q("SELECT COUNT(DISTINCT company_id) FROM communications WHERE source='gmail_mbox' AND company_id IS NOT NULL")
    print("\n=== Import summary ===")
    print(f"Total email rows      : {total}")
    print(f"  sent / received     : {out} / {total-out}")
    print(f"Linked to a company   : {linked}  (by domain {n_dom}, by email {n_email})")
    print(f"Distinct companies    : {companies_hit}")
    print("\n=== Top 15 companies by message volume ===")
    for name, city, cnt in con.execute(
        """SELECT c.name, COALESCE(c.city,''), COUNT(*) n
             FROM communications m JOIN companies c ON c.id=m.company_id
            WHERE m.source='gmail_mbox'
            GROUP BY c.id ORDER BY n DESC LIMIT 15"""
    ):
        print(f"  {cnt:4d}  {name}  ({city})")
    con.close()


if __name__ == "__main__":
    main()
