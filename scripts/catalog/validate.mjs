#!/usr/bin/env node
/* Task 16.4 Phase C — the gate in front of the remote catalogue.
 *
 * `catalog.json` is hand-edited on a public repo and read by every install. The
 * app's loader is deliberately silent: a malformed entry is dropped and a
 * malformed file falls back to the bundled 150, because a reader who asked for
 * a library must get one (§1.5). The cost of that, written down in Tasks.md
 * when Phase C was scoped, is that the *owner* gets no feedback either — one
 * trailing comma and the edit simply never appears. This script is that
 * feedback, and it belongs before the commit rather than after the release.
 *
 * It does not have its own opinion about what is valid. The category list comes
 * out of `free-books.js`, the labels out of en.json and hi.json, and the
 * structural rules are the same ones `_cleanEntry()` applies at runtime — so
 * the two cannot drift, which is the failure that put raw slugs on six chips in
 * Phase A. If this passes, the app will render every entry.
 *
 * Usage:
 *   node scripts/catalog/validate.mjs <path>     # a file you are about to commit
 *   node scripts/catalog/validate.mjs --live     # what is published right now
 *
 * Top-level keys it understands: "books" (required), "categories" (optional,
 * so a new genre needs no app release), and Phase D's "dropMonth"/"dropChoices".
 *   node scripts/catalog/validate.mjs <path> --no-net    # skip URL checks
 *   node scripts/catalog/validate.mjs <path> --allow-removals
 *                                                # permit deliberate takedowns
 *   node scripts/catalog/validate.mjs <path> --published <path|url>
 *                                                # compare against that baseline
 *                                                # instead of the published file
 *
 * Exit status is 0 only if the file is safe to publish.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const LOADER   = join(ROOT, 'www/js/views/free-books.js');
const BUNDLED  = join(ROOT, 'www/data/free-books.json');
const EN       = join(ROOT, 'www/i18n/en.json');
const HI       = join(ROOT, 'www/i18n/hi.json');

/* Must match Claude.md §12 and _REMOTE_URL in free-books.js. */
const LIVE_URL =
  'https://raw.githubusercontent.com/lost-coder1/flowread-privacy/main/catalog/v1/catalog.json';

/* The loader's own ceilings. Exceeding either is silent truncation on device. */
const MAX_BOOKS = 500;
const MAX_BYTES = 512 * 1024;
const MAX_CATEGORIES = 24;
const CAT_SLUG = /^[a-z][a-z0-9_]{1,31}$/;

/* The same mirror free-books.js retries through. 127 of the bundled 150 point at
 * www.gutenberg.org, which takes itself down for maintenance — it answered a
 * site-wide 503 during this script's own first run. Without the retry a
 * maintenance window makes the validator declare the whole catalogue broken,
 * which trains the owner to ignore it, and a validator nobody believes is worse
 * than none. A URL is only wrong if both hosts refuse it. */
const PG_HOST   = 'https://www.gutenberg.org';
const PG_MIRROR = 'https://gutenberg.pglaf.org';
const mirrorOf  = (url) => url.startsWith(PG_HOST) ? PG_MIRROR + url.slice(PG_HOST.length) : null;
let pgDown = false;   /* set on the first failure, reported once at the end */

const NET_CONCURRENCY = 6;
const NET_TIMEOUT_MS  = 20000;
const SNIFF_BYTES     = 65536;   /* enough to catch a latin-1 text */

const errors   = [];
const warnings = [];
const err  = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

/* ── What the app considers true ──────────────────────────────────────────── */

/* Read the category list out of the app rather than restating it. A regex over
 * source is ugly; a second copy of the list is worse, because it would be wrong
 * silently and this script exists to stop exactly that. */
function appCategories() {
  const src = readFileSync(LOADER, 'utf8');
  const m = src.match(/var\s+_CATEGORY_KEYS\s*=\s*\[([\s\S]*?)\]/);
  if (!m) {
    err('Could not find _CATEGORY_KEYS in free-books.js — the loader was renamed or restructured, so this script can no longer tell what the app accepts. Fix this before trusting any result below.');
    return [];
  }
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    err(`${label} could not be read: ${e.message}`);
    return null;
  }
}

/* ── Load the file under test ─────────────────────────────────────────────── */

async function loadTarget(args) {
  const live = args.includes('--live');
  const flagValues = new Set();
  args.forEach((a, i) => { if (a === '--published') flagValues.add(args[i + 1]); });
  const path = args.find((a) => !a.startsWith('--') && !flagValues.has(a));

  if (!live && !path) {
    console.error('Give a path to a catalog.json, or --live to check the published one.');
    process.exit(2);
  }

  let text, origin;
  if (live) {
    origin = LIVE_URL;
    const res = await fetch(`${LIVE_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) {
      /* A 404 is not necessarily broken — the loader treats a missing file the
         same as an empty one — but it is never what someone running --live
         meant to find. */
      err(`${LIVE_URL} answered HTTP ${res.status}. Nothing is published at that path.`);
      return { origin, text: null, books: [] };
    }
    text = await res.text();
  } else {
    origin = path;
    try { text = readFileSync(path, 'utf8'); }
    catch (e) { err(`${path}: ${e.message}`); return { origin, text: null, books: [] }; }
  }

  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > MAX_BYTES) {
    err(`The file is ${(bytes / 1024).toFixed(0)} KB. The app refuses anything over ${MAX_BYTES / 1024} KB outright, so none of it would load.`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    /* The single most likely failure, and the one the app cannot report. Point
       at the line, because "Unexpected token }" on one line of 4,000 is not a
       location. */
    const at = /position (\d+)/.exec(e.message);
    let where = '';
    if (at) {
      const upto = text.slice(0, Number(at[1]));
      where = ` — line ${upto.split('\n').length}, column ${upto.length - upto.lastIndexOf('\n')}`;
    }
    err(`Not valid JSON: ${e.message}${where}. On device this means the whole file is ignored and the library silently shows the bundled books only. A trailing comma after the last entry is the usual cause.`);
    return { origin, text, books: [] };
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    err('The top level must be an object, like {"books": [...]}.');
    return { origin, text, books: [] };
  }
  if (!Array.isArray(data.books)) {
    err('There is no "books" array at the top level. The app reads `data.books` and ignores everything else, so nothing would load.');
    return { origin, text, books: [] };
  }
  if (data.books.length > MAX_BOOKS) {
    err(`${data.books.length} books, but the app stops reading at ${MAX_BOOKS}. Everything past that is silently invisible.`);
  }

  return { origin, text, books: data.books, data };
}

/* ── Categories the file declares for itself ─────────────────────────────── */

/* The twelve built in are the floor; a file may declare more so a new genre
   needs no app release. Returns the slugs that will actually work, so the
   entry check can tell "unknown category" from "category you declared". */
function checkCategories(data, builtin) {
  const declared = data && data.categories;
  if (declared === undefined) return new Set();

  if (!declared || typeof declared !== 'object' || Array.isArray(declared)) {
    err('"categories" must be an object of slug -> {"en": "...", "hi": "..."}. As written it is ignored, so every book using a declared category disappears.');
    return new Set();
  }

  const ok = new Set();
  const slugs = Object.keys(declared);
  if (slugs.length > MAX_CATEGORIES) {
    err(`${slugs.length} declared categories, but the app stops at ${MAX_CATEGORIES}.`);
  }

  for (const slug of slugs) {
    const at = `categories["${slug}"]`;
    if (!CAT_SLUG.test(slug)) {
      err(`${at}: not a usable slug. Lowercase letters, digits and underscores, starting with a letter — "self_help", not "self-help" or "Self Help". The app ignores it, so every book using it vanishes.`);
      continue;
    }
    if (builtin.includes(slug)) {
      warn(`${at}: shadows one of the app's own twelve categories, so it is ignored and the app's translated label is used. Harmless; remove it.`);
      ok.add(slug);
      continue;
    }
    const v = declared[slug];
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      err(`${at}: must be an object with at least "en".`);
      continue;
    }
    if (typeof v.en !== 'string' || !v.en) {
      err(`${at}: "en" is required — without a label the chip would read as the raw slug, so the app drops the category and every book in it.`);
      continue;
    }
    if (typeof v.hi !== 'string' || !v.hi) {
      warn(`${at}: no "hi" label, so a Hindi reader sees "${v.en}" on the chip. It still works — the label falls back to English — but §16 wants both.`);
    }
    ok.add(slug);
  }
  return ok;
}

/* ── Entry rules — the same ones _cleanEntry() applies ───────────────────── */

const REQUIRED = ['id', 'title', 'author', 'language', 'category', 'sourceUrl', 'fileType'];
/* Every key the app actually reads. `_cleanEntry()` copies only these, so a key
   outside the list is dropped on the way in — silently, which is why an unknown
   one is worth a warning rather than nothing. */
const KNOWN    = [...REQUIRED, 'coverImage', 'approxLength', 'requiresOcr', 'addedAt'];
/* Past this many entries, arrivals without an addedAt start to crowd the top of
   the grid, because nothing can age them out. */
const ARRIVAL_CROWD = 8;
const isHttps  = (u) => typeof u === 'string' && u.startsWith('https://');

function checkEntries(books, cats, en, hi, bundled, declared) {
  const seenId  = new Map();
  const seenUrl = new Map();
  const missing = { cover: [], length: [] };

  const bundledById  = new Map(bundled.map((b) => [b.id, b]));
  const bundledByUrl = new Map(bundled.map((b) => [b.sourceUrl, b]));

  books.forEach((raw, i) => {
    /* Name the entry the way a human reads the file: its position, and its
       title if it has one worth printing. */
    const at = `books[${i}]` + (typeof raw?.title === 'string' && raw.title ? ` "${raw.title}"` : '');

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      err(`${at}: not an object. The app drops it.`);
      return;
    }

    for (const k of REQUIRED) {
      if (typeof raw[k] !== 'string' || !raw[k]) {
        err(`${at}: "${k}" is required and must be a non-empty string. The app drops the whole entry, so the book never appears.`);
      }
    }

    if (raw.fileType && raw.fileType !== 'pdf' && raw.fileType !== 'txt') {
      err(`${at}: fileType "${raw.fileType}" — only "pdf" and "txt" exist (§12). The library branches on exactly those two and anything else reaches the PDF parser and fails.`);
    }
    if (raw.language && raw.language !== 'en' && raw.language !== 'hi') {
      err(`${at}: language "${raw.language}" — the tabs are English and Hindi, so the book would be unreachable except under "All". The app drops it.`);
    }

    if (raw.category && !cats.includes(raw.category) && !declared.has(raw.category)) {
      err(`${at}: category "${raw.category}" is neither one of the app's twelve nor declared in this file's "categories". The app drops the entry, so the book never appears. Either use one of: ${cats.join(', ')} — or declare it: "categories": { "${raw.category}": { "en": "...", "hi": "..." } }.`);
    } else if (raw.category && cats.includes(raw.category)) {
      /* Catches app-side drift as well as a bad edit: a category in the list
         with no Hindi key renders the raw key to a Hindi reader (§16). */
      for (const [name, dict] of [['en.json', en], ['hi.json', hi]]) {
        if (dict && !dict[`freebooks.cat.${raw.category}`]) {
          err(`${at}: category "${raw.category}" has no "freebooks.cat.${raw.category}" key in ${name}. The chip would render the raw slug.`);
        }
      }
    }

    if (raw.sourceUrl && !isHttps(raw.sourceUrl)) {
      err(`${at}: sourceUrl must be https. The app drops a plaintext or relative URL.`);
    }
    if (raw.coverImage !== undefined && !isHttps(raw.coverImage)) {
      warn(`${at}: coverImage is not an https URL, so it is ignored and the card shows the title's initials instead.`);
    }
    /* Collected rather than reported per book. These two are cosmetic, and one
       line each per entry buries the errors underneath them — which is the
       failure this script exists to prevent, reproduced in its own output. */
    if (raw.coverImage === undefined) missing.cover.push(at);
    if (raw.approxLength === undefined) missing.length.push(at);

    if (raw.addedAt !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(raw.addedAt)) {
      err(`${at}: addedAt must be "YYYY-MM-DD" — ${JSON.stringify(raw.addedAt)} is ignored, so the book stays a new arrival at the top of the grid until someone downloads it.`);
    }
    if (raw.requiresOcr !== undefined && raw.requiresOcr !== true) {
      warn(`${at}: requiresOcr is only honoured when it is exactly \`true\` — ${JSON.stringify(raw.requiresOcr)} is ignored. Remove it rather than setting it false.`);
    }
    if (raw.requiresOcr === true && raw.fileType !== 'pdf') {
      warn(`${at}: requiresOcr on a ${raw.fileType} entry does nothing; only the PDF path consults it.`);
    }
    for (const k of Object.keys(raw)) {
      if (!KNOWN.includes(k)) {
        warn(`${at}: "${k}" is not a key the app reads, so it is dropped on load. Harmless, but if it was meant to do something it will not.`);
      }
    }

    /* Duplicates inside the file. */
    if (raw.id) {
      if (seenId.has(raw.id)) {
        err(`${at}: duplicate id "${raw.id}", also at books[${seenId.get(raw.id)}]. The later one wins on device, which makes the earlier edit look ignored.`);
      } else seenId.set(raw.id, i);
    }
    if (raw.sourceUrl) {
      if (seenUrl.has(raw.sourceUrl)) {
        err(`${at}: the same sourceUrl as books[${seenUrl.get(raw.sourceUrl)}]. A book's identity is its URL, so these two entries are one book on device and share a saved position.`);
      } else seenUrl.set(raw.sourceUrl, i);
    }

    /* Collisions with the bundled catalogue. */
    const clash = raw.id && bundledById.get(raw.id);
    if (clash) {
      if (clash.sourceUrl !== raw.sourceUrl) {
        err(`${at}: id "${raw.id}" already exists in the bundled catalogue with a different sourceUrl. Remote wins, and a book's identity is its URL — so this orphans the saved reading position of everyone who already has it. Add a new entry under a new id instead of re-pointing this one.`);
      } else {
        warn(`${at}: id "${raw.id}" overrides a bundled entry (same file). Intentional edits to a title, author or cover are fine this way.`);
      }
    }
    const urlClash = raw.sourceUrl && bundledByUrl.get(raw.sourceUrl);
    if (urlClash && urlClash.id !== raw.id) {
      err(`${at}: this sourceUrl is already in the bundled catalogue under id "${urlClash.id}". The library would show the same book twice, sharing one position.`);
    }
  });

  const undated = books.filter((b) => b && typeof b === 'object' && b.addedAt === undefined);
  if (books.length > ARRIVAL_CROWD && undated.length) {
    warn(`${undated.length} of ${books.length} entries have no addedAt. A new arrival leads the grid until it is downloaded or ages out, and only addedAt can age it out — so on a file this size the top of the library fills with everything nobody has taken yet. Add "addedAt": "YYYY-MM-DD" to date them.`);
  }

  for (const slug of declared) {
    if (!books.some((b) => b && b.category === slug)) {
      warn(`categories["${slug}"] is declared but no book uses it. The app leaves it off the chip row rather than showing a chip that filters to nothing.`);
    }
  }

  const brief = (list) => list.length <= 3 ? list.join(', ') : `${list.slice(0, 3).join(', ')} and ${list.length - 3} more`;
  if (missing.cover.length) {
    warn(`${missing.cover.length} entr${missing.cover.length === 1 ? 'y has' : 'ies have'} no coverImage, so ${missing.cover.length === 1 ? 'its card falls' : 'their cards fall'} back to initials and the share card has no artwork for ${missing.cover.length === 1 ? 'it' : 'them'} (§14): ${brief(missing.cover)}.`);
  }
  if (missing.length.length) {
    warn(`${missing.length.length} entr${missing.length.length === 1 ? 'y has' : 'ies have'} no approxLength, so no length shows on the card: ${brief(missing.length)}.`);
  }

  return seenId;
}

/* ── Phase D fields, checked if present ──────────────────────────────────── */

function checkDrop(data, ids) {
  if (!data) return;
  const hasMonth   = data.dropMonth !== undefined;
  const hasChoices = data.dropChoices !== undefined;
  if (!hasMonth && !hasChoices) return;

  if (hasMonth !== hasChoices) {
    err('dropMonth and dropChoices go together — one without the other describes a drop the app cannot resolve.');
  }
  if (hasMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(data.dropMonth))) {
    err(`dropMonth "${data.dropMonth}" must look like "2026-12". It is the authority on what month it is — the device clock is never consulted — and the claim key is built from it.`);
  }
  if (hasChoices) {
    if (!Array.isArray(data.dropChoices)) {
      err('dropChoices must be an array of book ids.');
      return;
    }
    if (data.dropChoices.length !== 10) {
      warn(`dropChoices has ${data.dropChoices.length} ids; the mechanic is ten to choose one from.`);
    }
    const seen = new Set();
    data.dropChoices.forEach((id, i) => {
      if (typeof id !== 'string' || !id) { err(`dropChoices[${i}]: not a book id.`); return; }
      if (seen.has(id)) err(`dropChoices[${i}]: "${id}" is listed twice.`);
      seen.add(id);
      if (!ids.has(id)) {
        err(`dropChoices[${i}]: "${id}" is not in this file's books[]. A choice the app cannot resolve is a dead row in the picker.`);
      }
    });
  }
}

/* ── Nothing may vanish from books[] ─────────────────────────────────────── */

async function checkNoDeletions(books, origin, baseline, allowRemovals) {
  const from = baseline || LIVE_URL;
  if (origin === from) return;       /* comparing a file to itself */

  let published;
  try {
    if (/^https?:/.test(from)) {
      const res = await fetch(`${from}?v=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;           /* nothing published yet; nothing to lose */
      published = JSON.parse(await res.text());
    } else {
      published = JSON.parse(readFileSync(from, 'utf8'));
    }
  } catch (_) {
    warn(`Could not read ${from}, so this run cannot tell whether anything was deleted from books[].`);
    return;
  }
  if (!published || !Array.isArray(published.books)) return;

  const now = new Set(books.map((b) => b?.id).filter(Boolean));
  for (const b of published.books) {
    if (b && b.id && !now.has(b.id)) {
      const note = `"${b.id}" is in ${from} but not in this file. Anyone who downloaded it keeps the book, but its cover and any re-download stop resolving.`;
      if (allowRemovals) {
        /* A takedown has to be possible: §12.1 contemplates dropping content
           whose licence is challenged, and that is the one case where removal
           is the correct act rather than an accident. The flag exists so it
           has to be *said* — the default stays a refusal, because the ordinary
           way a book leaves the drops is `dropChoices`, not deletion. */
        warn(`${note} Allowed by --allow-removals.`);
      } else {
        err(`${note} Rotate a book out with dropChoices instead. If you mean to take it down — a licence problem, say — re-run with --allow-removals.`);
      }
    }
  }
}

/* ── URLs actually resolve ───────────────────────────────────────────────── */

async function reach(url) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NET_TIMEOUT_MS);
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal });
    /* Plenty of servers, Gutenberg included, answer HEAD with 403 or 405 while
       serving the same URL happily on GET. */
    if (res.status === 403 || res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
    }
    return res;
  } finally { clearTimeout(timer); }
}

/* Resolves to { ok, status, viaMirror } or throws only if no host answered. */
async function headOrGet(url) {
  const mirror = mirrorOf(url);
  const order  = mirror && pgDown ? [mirror, url] : [url, mirror].filter(Boolean);

  let last;
  for (const candidate of order) {
    try {
      const res = await reach(candidate);
      if (res.ok) return { ok: true, status: res.status, viaMirror: candidate !== url };
      last = { ok: false, status: res.status };
    } catch (e) {
      last = { ok: false, error: e };
    }
    if (candidate === url && mirror) pgDown = true;
  }
  if (last.error) throw last.error;
  return last;
}

/* Gutenberg serves some older texts as latin-1, and a book that decodes wrong
 * is unreadable rather than merely ugly — the same fatal-decoder check Phase B
 * ran at build time. Only the first chunk is read: a mis-encoded text almost
 * always trips inside it, and pulling 150 whole books to find out is not a
 * check anyone would run twice. `stream: true` tolerates the multi-byte
 * character the cut almost certainly lands in the middle of. */
async function sniff(url) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NET_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Range: `bytes=0-${SNIFF_BYTES - 1}` },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (!res.ok && res.status !== 206) return { ok: false, status: res.status };
    const buf = Buffer.from(await res.arrayBuffer());
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buf, { stream: true });
      return { ok: true };
    } catch (_) {
      return { ok: true, badEncoding: true };
    }
  } finally { clearTimeout(timer); }
}

async function decodesAsUtf8(url) {
  const mirror = mirrorOf(url);
  const order  = mirror && pgDown ? [mirror, url] : [url, mirror].filter(Boolean);

  let last;
  for (const candidate of order) {
    try {
      const r = await sniff(candidate);
      if (r.ok) return { ...r, viaMirror: candidate !== url };
      last = r;
    } catch (e) {
      last = { ok: false, error: e };
    }
    if (candidate === url && mirror) pgDown = true;
  }
  if (last.error) throw last.error;
  return last;
}

async function pool(items, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(NET_CONCURRENCY, items.length) }, async () => {
    while (i < items.length) await worker(items[i++]);
  });
  await Promise.all(runners);
}

async function checkUrls(books) {
  const jobs = [];
  books.forEach((b, i) => {
    if (!b || typeof b !== 'object') return;
    const at = `books[${i}]` + (b.title ? ` "${b.title}"` : '');
    if (isHttps(b.sourceUrl)) jobs.push({ at, url: b.sourceUrl, kind: 'source', fileType: b.fileType });
    if (isHttps(b.coverImage)) jobs.push({ at, url: b.coverImage, kind: 'cover' });
  });
  if (!jobs.length) return;

  process.stdout.write(`Checking ${jobs.length} URLs`);
  let done = 0;
  await pool(jobs, async (job) => {
    try {
      if (job.kind === 'source' && job.fileType === 'txt') {
        const r = await decodesAsUtf8(job.url);
        if (!r.ok) {
          err(`${job.at}: sourceUrl answered HTTP ${r.status}. The download fails for every reader who taps it.`);
        } else if (r.badEncoding) {
          err(`${job.at}: the text does not decode as UTF-8. Gutenberg serves some older texts as latin-1, and the reader gets mojibake rather than a book. Look for a utf-8 edition of the same id.`);
        }
      } else {
        const res = await headOrGet(job.url);
        if (!res.ok) {
          const msg = `${job.at}: ${job.kind === 'cover' ? 'coverImage' : 'sourceUrl'} answered HTTP ${res.status}.`;
          if (job.kind === 'cover') warn(`${msg} The card falls back to initials.`);
          else err(`${msg} The download fails for every reader who taps it.`);
        }
      }
    } catch (e) {
      const msg = `${job.at}: ${job.kind === 'cover' ? 'coverImage' : 'sourceUrl'} could not be reached (${e.name === 'AbortError' ? 'timed out' : e.message}).`;
      if (job.kind === 'cover') warn(msg);
      else err(`${msg} If the host is only briefly down, re-run before concluding the entry is wrong.`);
    }
    if (++done % 10 === 0) process.stdout.write('.');
  });
  process.stdout.write('\n');

  if (pgDown) {
    warn(`www.gutenberg.org refused at least one request, so those URLs were checked against ${PG_MIRROR} instead — the same mirror the app falls back to. Nothing here is wrong; the host is having a maintenance window.`);
  }
}

/* ── Run ─────────────────────────────────────────────────────────────────── */

const args  = process.argv.slice(2);
const noNet = args.includes('--no-net');
/* Default is the published file. Overridable so a staged version can be the
   baseline, and so this check can be exercised at all while nothing is
   published yet. */
const baselineAt = args.indexOf('--published');
const baseline   = baselineAt !== -1 ? args[baselineAt + 1] : null;

const cats     = appCategories();
const en       = readJson(EN, 'www/i18n/en.json');
const hi       = readJson(HI, 'www/i18n/hi.json');
const bundledJ = readJson(BUNDLED, 'www/data/free-books.json');
const bundled  = (bundledJ && Array.isArray(bundledJ.books)) ? bundledJ.books : [];

const target = await loadTarget(args);
console.log(`\nCatalogue:  ${target.origin}`);
console.log(`Entries:    ${target.books.length} remote, ${bundled.length} bundled`);
console.log(`Categories: ${cats.length} built into the app` +
  (target.data && target.data.categories
    ? `, ${Object.keys(target.data.categories).length} declared in the file\n`
    : '\n'));

const declared = checkCategories(target.data, cats);
const ids = checkEntries(target.books, cats, en, hi, bundled, declared);
checkDrop(target.data, ids);
if (!noNet) {
  await checkNoDeletions(target.books, target.origin, baseline, args.includes('--allow-removals'));
  await checkUrls(target.books);
} else {
  console.log('Skipping URL and deletion checks (--no-net).\n');
}

if (warnings.length) {
  console.log(`${warnings.length} warning${warnings.length === 1 ? '' : 's'} — the file still works:`);
  for (const w of warnings) console.log(`  · ${w}`);
  console.log('');
}

if (errors.length) {
  console.log(`${errors.length} error${errors.length === 1 ? '' : 's'}:`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  console.log('\nDo not publish this file. On device every one of these is silent.\n');
  process.exit(1);
}

console.log('No errors. Every entry in this file will render, and the app will accept it.\n');
