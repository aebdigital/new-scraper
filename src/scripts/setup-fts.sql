-- Full-text search index for fast, punctuation/diacritics-insensitive company search.
-- External-content FTS5 table over companies(name, domain, website): no data is
-- duplicated, the index just points at company rows by id. The unicode61 tokenizer
-- folds diacritics (remove_diacritics 2) so "zvarova" matches "Zvarová" and splits on
-- punctuation so "s.r.o." / "spol. s r.o." become ignorable short tokens.
--
-- Re-runnable: drop + recreate keeps it in sync with schema changes.
-- Run:  sqlite3 sqlite.db < src/scripts/setup-fts.sql
PRAGMA busy_timeout = 120000;

DROP TRIGGER IF EXISTS companies_fts_ai;
DROP TRIGGER IF EXISTS companies_fts_ad;
DROP TRIGGER IF EXISTS companies_fts_au;
DROP TABLE IF EXISTS companies_fts;

CREATE VIRTUAL TABLE companies_fts USING fts5(
  name, domain, website,
  content='companies',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

-- Populate from the content table (efficient bulk build).
INSERT INTO companies_fts(companies_fts) VALUES('rebuild');

-- Keep the index in sync. The UPDATE trigger fires ONLY when a searchable column
-- changes, so the crawler's frequent status/score updates don't touch the index.
CREATE TRIGGER companies_fts_ai AFTER INSERT ON companies BEGIN
  INSERT INTO companies_fts(rowid, name, domain, website)
  VALUES (new.id, new.name, new.domain, new.website);
END;

CREATE TRIGGER companies_fts_ad AFTER DELETE ON companies BEGIN
  INSERT INTO companies_fts(companies_fts, rowid, name, domain, website)
  VALUES('delete', old.id, old.name, old.domain, old.website);
END;

CREATE TRIGGER companies_fts_au AFTER UPDATE OF name, domain, website ON companies BEGIN
  INSERT INTO companies_fts(companies_fts, rowid, name, domain, website)
  VALUES('delete', old.id, old.name, old.domain, old.website);
  INSERT INTO companies_fts(rowid, name, domain, website)
  VALUES (new.id, new.name, new.domain, new.website);
END;
