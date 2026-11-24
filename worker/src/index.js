/* FlowRead anonymous usage pings — Cloudflare Worker (Claude.md §9.6).
 *
 * Two routes:
 *   POST /e      one ping from the app. Increments a counter. Always 204.
 *   GET  /stats  the owner's read-out. Requires STATS_TOKEN.
 *
 * ── The rules this file exists to enforce ──────────────────────────────────
 *
 * 1. THE REQUEST IP IS NEVER READ, NEVER STORED, NEVER LOGGED. Cloudflare
 *    hands us `CF-Connecting-IP`, `request.cf.country`, ASN and more for free,
 *    and writing any of it would turn an anonymous count into personal data
 *    silently — with nothing in analytics-ping.js to connect the change to the
 *    privacy policy that promises otherwise. This file therefore touches
 *    neither. If country is ever wanted, the client already sends `lang`.
 *    `console.log` is also avoided on the ingest path: a Worker log line
 *    carries the client IP in its metadata whether or not we asked for it.
 *
 * 2. THE SERVER RE-VALIDATES THE ALLOWLIST. The client drops unlisted events
 *    already, but a client can be modified and the point of a closed list is
 *    that it holds anyway. ALLOWED/DIMS below must stay in step with
 *    analytics-ping.js — and adding to either is a product decision (§9.6).
 *
 * 3. NO PACKAGE NAMES, EVER. Nothing in DIMS can carry one, which is what
 *    keeps the filed Play accessibility declaration ("no sensitive data
 *    collected", §9.4a) true. Accepting a free-text dimension here would
 *    quietly make it false.
 *
 * 4. NOTHING IS STORED PER EVENT. See schema.sql — rows are counters, so no
 *    query can reconstruct one person's sequence of actions.
 */

/* The owner-facing dashboard, served from this Worker rather than published
 * anywhere: a page served from any other origin cannot read /stats without
 * either opening CORS on it or handing the token to a third party, and a
 * sandboxed page cannot reach this host at all. Same-origin keeps the token in
 * one place and the data in none. */
import DASH_HTML from './dash.html';

/* Mirrors analytics-ping.js ALLOWED. */
const ALLOWED = new Set([
  'app_opened',
  'nudge_shown',
  'nudge_read_started',
  'nudge_read_completed',
  'nudge_skipped',
  'free_book_downloaded',
  /* §12's monthly drops, added 2026-11-24 (product-owner approved). */
  'drop_claimed',
  'pro_purchased',
  'subscription_started',
  'subscription_cancelled',
  'stats_shared',
  'onboarding_completed',
  'nudge_permission_granted',
  /* Phase 1 */
  'read_session_ended',
  'book_finished',
  'book_opened',
  'paywall_shown',
  'import_completed',
]);

/* String dimensions, each capped and lower-cased into a column. */
/* `category` added 2026-11-24: which shelf a free book came from. A catalogue
   slug only — never a title, an id or a file name, and never present for a
   book the user imported themselves (the client omits it; see §1.4). It is a
   column like every other dimension, so it is enumerable by construction and
   cannot smuggle free text into a counter row. Receiver rule 3 is unaffected:
   no dimension may carry a package name, and a shelf label is not one. */
const DIMS = ['engine', 'lang', 'tier', 'source', 'tenure', 'category'];
/* Numeric meta, summed rather than dimensioned (schema.sql). */
const SUMS = ['minutes', 'pages', 'count'];

const PLATFORMS = new Set(['android', 'ios', 'web']);

const MAX_BODY = 2048; /* A legitimate ping is ~150 bytes. */

function noContent() {
  /* 204 with no body: there is nothing a client should do with the answer, and
   * the app never reads it (fire-and-forget). */
  return new Response(null, { status: 204, headers: cors() });
}

function cors() {
  /* The app's WebView origin is https://localhost, and a JSON content-type
   * triggers a preflight — so OPTIONS must be answered or the POST never
   * leaves the device. Wide-open is correct here: the endpoint accepts only
   * counter increments and returns nothing. */
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function dim(v) {
  if (typeof v === 'string') return v.slice(0, 32).toLowerCase();
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number' && isFinite(v)) return String(v).slice(0, 32);
  return '';
}

function num(v) {
  if (typeof v !== 'number' || !isFinite(v)) return 0;
  /* Clamped, so a bad clock or a tampered client cannot poison an average
   * beyond recovery. Negative is always wrong for a duration or a page count. */
  return Math.min(Math.max(v, 0), 1e6);
}

/* The client's local day is trusted only within a day of ours. A device with a
 * wrong clock would otherwise scatter rows across years and quietly corrupt
 * every per-day figure; clamping keeps the damage to one adjacent bucket. */
function dayOrNull(v, nowMs) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const sent = Date.parse(v + 'T00:00:00Z');
  if (!isFinite(sent)) return null;
  if (Math.abs(sent - nowMs) > 36 * 3600 * 1000) return null;
  return v;
}

async function ingest(request, env) {
  if (!env.DB) return noContent();

  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BODY) return noContent();

  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return noContent();
    body = JSON.parse(text);
  } catch (_) {
    return noContent();
  }
  if (!body || typeof body !== 'object') return noContent();

  const event = typeof body.event === 'string' ? body.event : '';
  if (!ALLOWED.has(event)) return noContent();

  const day = dayOrNull(body.day, Date.now());
  if (!day) return noContent();

  const platform = PLATFORMS.has(body.platform) ? body.platform : '';
  const meta = (body.meta && typeof body.meta === 'object') ? body.meta : {};

  const cols = {};
  for (const k of DIMS) cols[k] = dim(meta[k]);
  const isFirst = meta.first === true ? 1 : 0;

  const sums = {};
  for (const k of SUMS) sums[k] = num(meta[k]);

  /* One statement: insert the counter or increment the existing one. */
  await env.DB.prepare(
    `INSERT INTO daily
       (day, event, platform, engine, lang, tier, source, tenure, category,
        is_first, n, sum_minutes, sum_pages, sum_count)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, ?11, ?12, ?13)
     ON CONFLICT (day, event, platform, engine, lang, tier, source, tenure, category, is_first)
     DO UPDATE SET
       n           = n + 1,
       sum_minutes = sum_minutes + ?11,
       sum_pages   = sum_pages   + ?12,
       sum_count   = sum_count   + ?13`
  ).bind(
    day, event, platform,
    cols.engine, cols.lang, cols.tier, cols.source, cols.tenure, cols.category,
    isFirst, sums.minutes, sums.pages, sums.count
  ).run();

  return noContent();
}

/* ── Read-out ───────────────────────────────────────────────────────────────
 * Deliberately a handful of named questions rather than arbitrary SQL. An
 * open query endpoint on a privacy-positioned product is an own goal, and the
 * questions below are the ones §22 and §4 actually turn on. */
async function stats(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  if (!env.STATS_TOKEN || token !== env.STATS_TOKEN) {
    return new Response('not found', { status: 404 });
  }
  if (!env.DB) return new Response('{}', { status: 200 });

  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 1), 365);
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const q = (sql, ...bind) => env.DB.prepare(sql).bind(...bind).all();

  const [totals, byDay, shares, finishes, funnel, engines, tenure] = await Promise.all([
    q(`SELECT event, SUM(n) AS n,
              SUM(sum_minutes) AS minutes, SUM(sum_pages) AS pages
         FROM daily WHERE day >= ?1 GROUP BY event ORDER BY n DESC`, from),
    q(`SELECT day, event, SUM(n) AS n
         FROM daily WHERE day >= ?1 GROUP BY day, event ORDER BY day DESC`, from),
    /* "How many of them have shared a card" — is_first = 1 is one distinct
     * device's first ever share, so SUM(n) over it counts people who have
     * ever shared, without anything identifying having been stored. */
    q(`SELECT source,
              SUM(CASE WHEN is_first = 1 THEN n ELSE 0 END) AS first_time_sharers,
              SUM(n) AS shares
         FROM daily WHERE event = 'stats_shared' AND day >= ?1
         GROUP BY source ORDER BY shares DESC`, from),
    /* "How many people have ever finished a book" — the same is_first trick as
     * sharing, split by whether they read to the end ('read') or used the Mark
     * read button ('marked'), which are different claims. */
    q(`SELECT source,
              SUM(CASE WHEN is_first = 1 THEN n ELSE 0 END) AS first_time_finishers,
              SUM(n) AS books_finished
         FROM daily WHERE event = 'book_finished' AND day >= ?1
         GROUP BY source ORDER BY books_finished DESC`, from),
    q(`SELECT event, SUM(n) AS n FROM daily
         WHERE day >= ?1 AND event IN
           ('nudge_shown','nudge_read_started','nudge_read_completed','nudge_skipped',
            'paywall_shown','pro_purchased','subscription_started',
            'free_book_downloaded','book_opened','book_finished','onboarding_completed',
            'nudge_permission_granted')
         GROUP BY event`, from),
    q(`SELECT engine, SUM(n) AS sessions,
              SUM(sum_minutes) AS minutes, SUM(sum_pages) AS pages
         FROM daily WHERE event = 'read_session_ended' AND day >= ?1
         GROUP BY engine ORDER BY sessions DESC`, from),
    /* Retention curve with no identifier: counts of app opens by how long
     * after install they happened (§9.6, tenure buckets). */
    q(`SELECT tenure, SUM(n) AS opens FROM daily
         WHERE event = 'app_opened' AND day >= ?1 GROUP BY tenure ORDER BY tenure`, from),
  ]);

  return Response.json({
    since: from,
    days: days,
    totals: totals.results,
    by_day: byDay.results,
    sharing: shares.results,
    finishing: finishes.results,
    funnel: funnel.results,
    engines: engines.results,
    tenure: tenure.results,
  });
}

/* The dashboard page. Gated on the same token as /stats and 404s identically
 * without it, so the two cannot drift apart. The page is static markup plus the
 * token; every figure on it is fetched client-side from /stats, which means this
 * route reads nothing from the database itself. */
function dash(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  if (!env.STATS_TOKEN || token !== env.STATS_TOKEN) {
    return new Response('not found', { status: 404 });
  }
  /* Attribute-context escape. The token is our own hex secret, so this is
   * belt-and-braces rather than a live injection path — but the page would be
   * the place one could exist, and a rotated token is not guaranteed to stay
   * hex. */
  const safe = token.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* split/join, not replace(): a string replace swaps only the first match, so
   * a second mention of the placeholder anywhere in the page would ship raw. */
  return new Response(DASH_HTML.split('__STATS_TOKEN__').join(safe), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      /* Never cached anywhere: the response embeds the token. */
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors() });
    }
    if (request.method === 'POST' && (url.pathname === '/e' || url.pathname === '/')) {
      try {
        return await ingest(request, env);
      } catch (_) {
        /* A storage failure must not be distinguishable from a success: the app
         * does not read the response, and an error page would only invite
         * probing. Nothing is logged here (rule 1). */
        return noContent();
      }
    }
    if (request.method === 'GET' && url.pathname === '/stats') {
      return stats(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/dash') {
      return dash(request, env);
    }
    return new Response('not found', { status: 404 });
  },
};
