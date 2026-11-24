-- FlowRead analytics aggregate store (Claude.md §9.6).
--
-- There is deliberately no per-event table. A row here is a COUNTER for one
-- (day, event, platform, dimensions) combination, incremented on arrival, so
-- the database physically cannot hold a sequence of one person's actions —
-- which is what a raw event log is, identifier or no identifier. Aggregating
-- at write time is the storage-level half of §1.4: the privacy property does
-- not depend on anyone remembering not to run the wrong query later.
--
-- Numeric meta is summed rather than dimensioned. minutes/pages/count are
-- high-cardinality and would explode the primary key; n + sum_* gives means,
-- which is all they were ever wanted for.

CREATE TABLE IF NOT EXISTS daily (
  day         TEXT    NOT NULL,          -- YYYY-MM-DD, the client's local day
  event       TEXT    NOT NULL,
  platform    TEXT    NOT NULL DEFAULT '',

  -- Low-cardinality string/bool dimensions. Empty string = not sent.
  engine      TEXT    NOT NULL DEFAULT '',
  lang        TEXT    NOT NULL DEFAULT '',
  tier        TEXT    NOT NULL DEFAULT '',
  source      TEXT    NOT NULL DEFAULT '',
  tenure      TEXT    NOT NULL DEFAULT '',
  -- Which catalogue shelf a free book came from (§8.6, added 2026-11-24).
  -- A slug from the library's own chip row, never a title or an id, and empty
  -- for a book the user imported themselves — the client omits it, and §1.4
  -- turns on it staying omitted.
  category    TEXT    NOT NULL DEFAULT '',
  is_first    INTEGER NOT NULL DEFAULT 0, -- 1 = the sender's first ever such event

  n           INTEGER NOT NULL DEFAULT 0,
  sum_minutes REAL    NOT NULL DEFAULT 0,
  sum_pages   REAL    NOT NULL DEFAULT 0,
  sum_count   REAL    NOT NULL DEFAULT 0,

  PRIMARY KEY (day, event, platform, engine, lang, tier, source, tenure, category, is_first)
);

CREATE INDEX IF NOT EXISTS daily_event_day ON daily (event, day);
