#!/usr/bin/env node
/* Task 16.4 Phase B — one-time batch that grows www/data/free-books.json from 88
 * to ~150 entries for free users (Tasks.md). Run it, review the output, commit the
 * result; it is not shipped in the app.
 *
 * Source is Project Gutenberg's own catalogue feed rather than Gutendex, which
 * Tasks.md named: gutendex.com resolves but times out behind Cloudflare, and the
 * feed is the same data one hop closer to the publisher. Both are §13.2 public
 * domain, linked and not re-hosted, so the legal position is unchanged.
 *
 * The curated list below is hand-written — a title, an author surname to
 * disambiguate it, a category and a final slug. The script's job is only to
 * resolve each one to a Gutenberg id, prove the .txt it will link decodes as
 * UTF-8, and measure it. It never picks books. A dump of the 61,977 English
 * texts would make the region-aware sort in _sorted() meaningless and would bloat
 * an APK-bundled file; a curated shelf is the feature.
 *
 * Usage:
 *   node scripts/build-gutenberg-batch.mjs            # resolve + verify, print entries
 *   node scripts/build-gutenberg-batch.mjs --write    # also merge into free-books.json
 *   node scripts/build-gutenberg-batch.mjs --catalog <path to pg_catalog.csv>
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOGUE = join(ROOT, 'www/data/free-books.json');
const CACHE_DIR = join(ROOT, '.cache');
const CATALOG_URL = 'https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv.gz';

/* ── The curated batch ──────────────────────────────────────────────────────
 * Weighted to fill the thin genres rather than to chase popularity. The
 * existing 88 are 38 classics against one drama, one essay and one strategy
 * title, so this adds 10 science fiction and 7 drama but only 3 more classics.
 * Indian titles are kept coming in every genre that has one, because that is
 * the character of the shelf the first 88 built.
 *
 * `author` is a surname used only to disambiguate the title during resolution —
 * the display title and author come from the catalogue feed, cleaned. A fifth
 * element overrides either where the feed's own wording is worse than useless
 * on a card ("Gilbert, Olive; Truth, Sojourner" for a book by Sojourner Truth). */
const CURATED = [
  /* science_fiction — 2 → 12 */
  ['the_invisible_man',      'The Invisible Man',                   'Wells',      'science_fiction'],
  ['island_of_doctor_moreau','The Island of Doctor Moreau',         'Wells',      'science_fiction', { title: 'The Island of Doctor Moreau' }],
  ['twenty_thousand_leagues','Twenty Thousand Leagues under the Sea','Verne',     'science_fiction'],
  ['journey_centre_earth',   'A Journey to the Centre of the Earth','Verne',      'science_fiction'],
  ['around_the_world_80',    'Around the World in Eighty Days',     'Verne',      'science_fiction'],
  ['flatland',               'Flatland',                            'Abbott',     'science_fiction'],
  ['princess_of_mars',       'A Princess of Mars',                  'Burroughs',  'science_fiction', { title: 'A Princess of Mars' }],
  ['the_lost_world',         'The Lost World',                      'Doyle',      'science_fiction'],
  ['erewhon',                'Erewhon',                             'Butler',     'science_fiction'],
  ['looking_backward',       'Looking Backward, 2000 to 1887',      'Bellamy',    'science_fiction'],

  /* drama — 1 → 8 */
  ['hamlet',                 'Hamlet',                              'Shakespeare','drama'],
  ['macbeth',                'Macbeth',                             'Shakespeare','drama'],
  ['romeo_and_juliet',       'Romeo and Juliet',                    'Shakespeare','drama'],
  ['dolls_house',            "A Doll's House",                      'Ibsen',      'drama'],
  ['importance_earnest',     'The Importance of Being Earnest',     'Wilde',      'drama'],
  ['pygmalion',              'Pygmalion',                           'Shaw',       'drama', { author: 'George Bernard Shaw' }],
  ['post_office_tagore',     'The Post Office',                     'Tagore',     'drama'],

  /* philosophy — 7 → 14 */
  ['beyond_good_and_evil',   'Beyond Good and Evil',                'Nietzsche',  'philosophy', { author: 'Friedrich Nietzsche' }],
  ['enchiridion_epictetus',  'The Enchiridion',                     'Epictetus',  'philosophy'],
  ['tao_te_ching',           'The Tao Teh King',                    'Laozi',      'philosophy', { title: 'The Tao Teh King' }],
  ['analects_confucius',     'The Analects of Confucius',           'Confucius',  'philosophy'],
  ['song_celestial_gita',    'The Song Celestial',                  'Arnold',     'philosophy'],
  ['leviathan_hobbes',       'Leviathan',                           'Hobbes',     'philosophy'],
  ['on_liberty_mill',        'On Liberty',                          'Mill',       'philosophy'],

  /* essays — 1 → 7 */
  ['emerson_essays',         'Essays',                              'Emerson',    'essays', { title: 'Essays, First Series' }],
  ['civil_disobedience',     'On the Duty of Civil Disobedience',   'Thoreau',    'essays'],
  ['montaigne_essays',       'Essays of Michel de Montaigne',       'Montaigne',  'essays', { title: 'Essays of Michel de Montaigne' }],
  ['bacon_essays',           'The Essays or Counsels, Civil and Moral','Bacon',    'essays'],
  ['unto_this_last',         'Unto This Last',                      'Ruskin',     'essays', { title: 'Unto This Last' }],
  ['heretics_chesterton',    'Heretics',                            'Chesterton', 'essays'],

  /* biography_history — 4 → 10 */
  ['franklin_autobiography', 'The Autobiography of Benjamin Franklin','Franklin', 'biography_history'],
  ['up_from_slavery',        'Up from Slavery',                     'Washington', 'biography_history'],
  ['incidents_slave_girl',   'Incidents in the Life of a Slave Girl','Jacobs',    'biography_history', { title: 'Incidents in the Life of a Slave Girl' }],
  ['twelve_years_a_slave',   'Twelve Years a Slave',                'Northup',    'biography_history'],
  ['confessions_augustine',  'The Confessions of St. Augustine',    'Augustine',  'biography_history', { author: 'Saint Augustine' }],
  ['eminent_victorians',     'Eminent Victorians',                  'Strachey',   'biography_history'],

  /* poetry — 6 → 12 */
  ['rubaiyat',               'The Rubaiyat of Omar Khayyam',        'Khayyam',    'poetry', { author: 'Omar Khayyam' }],
  ['dickinson_poems',        'Poems',                               'Dickinson',  'poetry', { title: 'Poems of Emily Dickinson' }],
  ['songs_innocence',        'Songs of Innocence and of Experience','Blake',      'poetry'],
  ['poe_raven',              'The Raven',                           'Poe',        'poetry'],
  ['lyrical_ballads',        'Lyrical Ballads',                     'Wordsworth', 'poetry', { title: 'Lyrical Ballads, Volume 1' }],
  ['golden_threshold_naidu', 'The Golden Threshold',                'Naidu',      'poetry'],

  /* history_politics — 6 → 11 */
  ['areopagitica',           'Areopagitica',                        'Milton',     'history_politics', { title: 'Areopagitica' }],
  ['common_sense_paine',     'Common Sense',                        'Paine',      'history_politics'],
  ['social_contract',        'The Social Contract',                 'Rousseau',   'history_politics', { title: 'The Social Contract' }],
  ['democracy_in_america',   'Democracy in America',                'Tocqueville','history_politics'],
  ['peloponnesian_war',      'The History of the Peloponnesian War','Thucydides', 'history_politics'],

  /* social_justice — 12 → 16 */
  ['rights_of_woman',        'A Vindication of the Rights of Woman','Wollstonecraft','social_justice'],
  ['subjection_of_women',    'The Subjection of Women',             'Mill',       'social_justice'],
  ['sojourner_truth',        'The Narrative of Sojourner Truth',    'Truth',      'social_justice', { author: 'Sojourner Truth' }],
  ['the_jungle_sinclair',    'The Jungle',                          'Sinclair',   'social_justice'],

  /* classics — 38 → 41 */
  ['don_quixote',            'Don Quixote',                         'Cervantes',  'classics', { author: 'Miguel de Cervantes' }],
  ['anna_karenina',          'Anna Karenina',                       'Tolstoy',    'classics'],
  ['dorian_gray',            'The Picture of Dorian Gray',          'Wilde',      'classics'],

  /* strategy — 1 → 5 */
  ['on_war_clausewitz',      'On War',                              'Clausewitz', 'strategy'],
  ['wealth_of_nations',      'An Inquiry into the Nature and Causes of the Wealth of Nations','Smith','strategy', { title: 'The Wealth of Nations' }],
  ['self_help_smiles',       'Self-Help',                           'Smiles',     'strategy'],
  ['24_hours_a_day',         'How to Live on 24 Hours a Day',       'Bennett',    'strategy'],

  /* buddhism — 8 → 10 */
  ['gospel_of_buddha',       'The Gospel of Buddha',                'Carus',      'buddhism', { title: 'The Gospel of Buddha' }],
  ['buddhist_psalms',        'Buddhist Psalms',                     'Shinran',    'buddhism', { title: 'Buddhist Psalms' }],

  /* constitution_law — 2 → 4 */
  ['federalist_papers',      'The Federalist Papers',               'Hamilton',   'constitution_law'],
  ['second_treatise_locke',  'Second Treatise of Government',       'Locke',      'constitution_law'],
];

/* ── Catalogue feed ─────────────────────────────────────────────────────────── */

async function loadFeed(explicitPath) {
  if (explicitPath) return readFileSync(explicitPath, 'utf8');

  const cached = join(CACHE_DIR, 'pg_catalog.csv');
  if (existsSync(cached)) return readFileSync(cached, 'utf8');

  process.stderr.write('Downloading pg_catalog.csv.gz…\n');
  const res = await fetch(CATALOG_URL);
  if (!res.ok) throw new Error(`catalogue feed: HTTP ${res.status}`);
  const csv = gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8');
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cached, csv);
  return csv;
}

/* RFC4180 enough for this feed: quoted fields, doubled quotes, embedded commas
 * and newlines. Worth the 20 lines — a split(',') silently truncates the
 * Subjects column, which is what the category sanity check reads. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }

  const header = rows.shift();
  return rows.filter(r => r.length === header.length)
             .map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

/* ── Resolution ─────────────────────────────────────────────────────────────── */

const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/* "Tagore, Rabindranath, 1861-1941" → "Rabindranath Tagore". The feed stores
 * authors surname-first with life dates, may list several separated by ';', and
 * expands initials parenthetically ("H. G. (Herbert George) Wells"). All of that
 * is cataloguing apparatus, and the existing 88 show none of it on a card. */
function displayAuthor(field) {
  const first = field.split(';')[0].trim();
  if (!first) return 'Unknown';

  /* Life dates, including the BCE forms ("552 BCE-480 BCE", "456? BCE-396 BCE")
   * that a plain four-digit pattern walks straight past. */
  const dated = first.replace(/,\s*[\d?]+\s*(BCE|CE)?\s*-\s*[\d?]*\s*(BCE|CE)?\s*$/i, '');

  const bits = dated.split(',');
  const name = bits.length > 1 ? `${bits[1].trim()} ${bits[0].trim()}` : bits[0].trim();

  return name
    .replace(/\s*\([^)]*\)/g, '')      // the expanded initials
    .replace(/\b([A-Z])\.\s+(?=[A-Z]\.)/g, '$1.')  // "H. G." → "H.G.", as the 88 write it
    .replace(/\s+/g, ' ').trim();
}

/* The feed carries subtitles on a second line, after a colon or semicolon, and
 * in brackets. A card has one line for a title and the reader is scanning for
 * the name of the book, so everything after the name goes. A "— Volume N" tail
 * is deliberately kept: that one is not decoration, it is what they are getting. */
function displayTitle(raw) {
  return raw.split(/[\r\n]/)[0]
            .split(/\s*[;:]\s*/)[0]
            .replace(/\s*\([^)]*\)\s*$/, '')
            .replace(/[,\s]+$/, '')
            .trim();
}

function resolve(rows, title, surname) {
  const wantTitle = norm(title), wantAuthor = norm(surname);

  const pool = rows.filter(r =>
    r.Type === 'Text' && r.Language === 'en' &&
    norm(r.Authors).includes(wantAuthor));

  /* Exact title first, then a prefix match — the feed often carries a subtitle
   * ("Leviathan; Or, The Matter, Forme & Power of a Commonwealth"). Never a
   * substring match in the other direction, which matches anthologies. */
  const exact  = pool.filter(r => norm(r.Title) === wantTitle);
  const prefix = pool.filter(r => norm(r.Title).startsWith(wantTitle));
  const hits = exact.length ? exact : prefix;
  if (!hits.length) return null;

  /* A "— Complete" edition wins outright where one exists. Gutenberg splits long
   * works into numbered volumes that sort *before* the collected edition, so the
   * id rule below would otherwise hand the reader volume 1 of Montaigne's 19 and
   * call it his Essays. Where there is no complete edition (Tocqueville is two
   * volumes and nothing else), the volume is kept and its title says so. */
  const complete = hits.filter(r => /\bcomplete\b/i.test(r.Title));
  const pool2 = complete.length ? complete : hits;

  /* Then lowest id: Gutenberg numbers by date added, so the oldest entry for a
   * work is the long-established, most-proofread text rather than a later
   * illustrated re-issue. */
  pool2.sort((a, b) => Number(a['Text#']) - Number(b['Text#']));
  return pool2[0];
}

/* ── Verification ───────────────────────────────────────────────────────────── */

/* Gutenberg serves some older texts as latin-1. A fatal decoder is the whole
 * check: anything that is not valid UTF-8 would reach the reader as mojibake on
 * every accented character, silently. */
async function verify(id) {
  const url = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`;
  const res = await fetch(url);
  if (!res.ok) return { ok: false, why: `HTTP ${res.status}` };

  const buf = Buffer.from(await res.arrayBuffer());
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return { ok: false, why: 'not UTF-8 (latin-1?)' };
  }

  /* Measure the book, not Gutenberg's licence boilerplate. */
  const start = text.indexOf('*** START'), end = text.indexOf('*** END');
  const body = text.slice(start === -1 ? 0 : text.indexOf('\n', start) + 1,
                          end === -1 ? undefined : end);
  const words = (body.match(/\S+/g) || []).length;
  return { ok: true, url, words };
}

/* Match the existing file's register: round numbers, never false precision. */
function approxLength(words) {
  const pages = Math.max(10, Math.round(words / 300 / 10) * 10);
  return `~${pages} pages`;
}

/* ── Main ───────────────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const write = args.includes('--write');
const catalogArg = args.includes('--catalog') ? args[args.indexOf('--catalog') + 1] : null;

const rows = parseCsv(await loadFeed(catalogArg));
process.stderr.write(`Feed: ${rows.length} records\n`);

const existing = JSON.parse(readFileSync(CATALOGUE, 'utf8'));
const haveIds = new Set(existing.books.map(b => b.id));
const haveSources = new Set(existing.books.map(b => b.sourceUrl));

const entries = [], failures = [];

for (const [id, title, surname, category, override = {}] of CURATED) {
  if (haveIds.has(id)) { failures.push([id, 'slug already in catalogue']); continue; }

  const row = resolve(rows, title, surname);
  if (!row) { failures.push([id, `unresolved: "${title}" / ${surname}`]); continue; }

  const pg = row['Text#'];
  const check = await verify(pg);
  if (!check.ok) { failures.push([id, `pg${pg}: ${check.why}`]); continue; }
  if (haveSources.has(check.url)) { failures.push([id, `pg${pg} already linked`]); continue; }

  entries.push({
    id,
    title: override.title || displayTitle(row.Title),
    author: override.author || displayAuthor(row.Authors),
    language: 'en',
    category,
    coverImage: `https://www.gutenberg.org/cache/epub/${pg}/pg${pg}.cover.medium.jpg`,
    sourceUrl: check.url,
    fileType: 'txt',
    approxLength: approxLength(check.words),
  });
  process.stderr.write(`  ok  ${id} → pg${pg} (${check.words} words)\n`);
}

if (failures.length) {
  process.stderr.write(`\n${failures.length} FAILED — fix the curated list, do not ship a short batch:\n`);
  for (const [id, why] of failures) process.stderr.write(`  ✗ ${id}: ${why}\n`);
}

if (write) {
  if (failures.length) {
    process.stderr.write('\nRefusing --write while anything failed.\n');
    process.exit(1);
  }
  existing.books.push(...entries);
  writeFileSync(CATALOGUE, JSON.stringify(existing, null, 2) + '\n');
  process.stderr.write(`\nWrote ${entries.length} entries — catalogue is now ${existing.books.length}.\n`);
} else {
  process.stdout.write(JSON.stringify(entries, null, 2) + '\n');
}
