-- Adds the `category` dimension (§8.6, 2026-11-24).
--
-- Not an ALTER TABLE: `category` joins the PRIMARY KEY, and SQLite cannot
-- alter one, so the table is rebuilt. Existing rows carry '' for the new
-- column, which is exactly what they mean — those events were recorded before
-- the dimension existed and never had a category to report. '' is also what a
-- self-imported book stores (§1.4), so the two are indistinguishable in
-- history; that is a reading of the past, not a loss, since no pre-migration
-- row described a catalogue book either.
--
-- Run against the live D1 binding BEFORE deploying the Worker that writes the
-- new column, and before the app build that sends it is uploaded. The policy
-- publish is the third leg and must land first of all.

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS daily_new (
  day         TEXT    NOT NULL,
  event       TEXT    NOT NULL,
  platform    TEXT    NOT NULL DEFAULT '',

  engine      TEXT    NOT NULL DEFAULT '',
  lang        TEXT    NOT NULL DEFAULT '',
  tier        TEXT    NOT NULL DEFAULT '',
  source      TEXT    NOT NULL DEFAULT '',
  tenure      TEXT    NOT NULL DEFAULT '',
  category    TEXT    NOT NULL DEFAULT '',
  is_first    INTEGER NOT NULL DEFAULT 0,

  n           INTEGER NOT NULL DEFAULT 0,
  sum_minutes REAL    NOT NULL DEFAULT 0,
  sum_pages   REAL    NOT NULL DEFAULT 0,
  sum_count   REAL    NOT NULL DEFAULT 0,

  PRIMARY KEY (day, event, platform, engine, lang, tier, source, tenure, category, is_first)
);

INSERT INTO daily_new
  (day, event, platform, engine, lang, tier, source, tenure, category,
   is_first, n, sum_minutes, sum_pages, sum_count)
SELECT
   day, event, platform, engine, lang, tier, source, tenure, '',
   is_first, n, sum_minutes, sum_pages, sum_count
FROM daily;

DROP TABLE daily;
ALTER TABLE daily_new RENAME TO daily;

CREATE INDEX IF NOT EXISTS daily_event_day ON daily (event, day);

PRAGMA foreign_keys = ON;
