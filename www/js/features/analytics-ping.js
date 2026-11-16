/* Anonymous, non-personal usage pings (Claude.md §9.6).
 *
 * The one deliberate exception to §1.1's offline-first rule, and it is kept
 * deliberately thin:
 *   - No device id, no user id, no file name, no reading content, ever (§1.4).
 *   - Fire-and-forget. Nothing here is ever awaited by a user-facing path, so a
 *     dead endpoint, a captive portal or airplane mode cannot slow down or break
 *     anything the user is doing.
 *   - Silent on failure by design. This is the one place in the app where
 *     swallowing an error is correct: there is nothing the user could do about
 *     it and nothing of theirs is lost.
 *
 * The receiver is the Worker in worker/ (Cloudflare + D1), live 2026-11-17. It
 * stores aggregate counters only, never per-event rows, and never reads, stores
 * or logs the request IP — see worker/src/index.js, which states those rules at
 * the top. Emptying ENDPOINT below makes this module inert again and is the
 * single-constant kill switch.
 */

const AnalyticsPing = (function() {
  /* MUST be https when it is finally set. Play Console's Data safety declaration
   * answers "encrypted in transit: yes" on this module's behalf, and that answer
   * was filed long before this constant had a value — so a plain-http endpoint
   * would silently make a filed compliance answer false, with nothing in the
   * code to connect the two. Also keep it a first-party Worker: "not shared
   * with third parties" rests on the receiver being a processor acting for us.
   *
   * Live since 2026-11-17. Set this back to '' to make the whole module inert
   * again — that is the kill switch, and it needs no other change. */
  const ENDPOINT = 'https://flowread-analytics.flowread-android.workers.dev/e';

  /* The user's opt-out (§1.4). Read on every call rather than cached, because
   * the Settings toggle has to take effect immediately — a privacy switch that
   * waits for a restart is not one. Absent means opted in, matching the Data
   * safety declaration of optional-and-on-by-default; any throw (private mode,
   * blocked site data) is treated as opted OUT, because failing closed is the
   * only safe direction for a consent check. */
  function _optedOut() {
    try { return localStorage.getItem('fr_analytics_opt_out') === 'true'; }
    catch (_) { return true; }
  }

  /* Only these may be sent. An unlisted name is dropped rather than forwarded,
   * so a future caller cannot quietly widen what we collect. */
  const ALLOWED = [
    'app_opened',
    'nudge_shown',
    'nudge_read_started',
    'nudge_read_completed',
    'nudge_skipped',
    'free_book_downloaded',
    'pro_purchased',
    'subscription_started',
    'subscription_cancelled',
    /* Added 2026-09-25 (Q11, product-owner approved) to measure §22's
     * distribution question: how often a stats card is actually shared. Carries
     * only which entry point was used — never the book, the stat or the app the
     * user shared to. */
    'stats_shared',
    /* Added 2026-11-01 (product-owner approved) for Task 16.3. §10.2's inline
     * permission ask was chosen to maximise grant rates, and a grant rate has a
     * denominator — without these two there is no way to tell whether that
     * choice was right, and §10.1 asks for it to be testable rather than
     * assumed. A decline needs no event of its own: it is completed minus
     * granted. Neither carries any parameter. */
    'onboarding_completed',
    'nudge_permission_granted',
    /* Phase 1, added 2026-11-16 (product-owner selected). The twelve events
     * above could say that nudges fired and books downloaded, and nothing at
     * all about whether anyone read: the product's core action was the one
     * thing unmeasured, which made §4's monthly-drops question and §22's
     * engine question both unanswerable. Each of these four is a denominator
     * something already-collected was missing.
     *
     *   read_session_ended  the core action. engine answers where people read
     *                       now Page mode is the default (16.13); source
     *                       separates a nudged read from a chosen one, which
     *                       is the pivot's own question.
     *   book_opened         the denominator free_book_downloaded lacks. A
     *                       catalogue that is downloaded and never opened is
     *                       an argument against paying to curate drops.
     *   paywall_shown       the denominator pro_purchased lacks; without it
     *                       conversion is not merely unknown but unknowable.
     *   import_completed    is this a Free Books app or a bring-your-own-PDF
     *                       app? Decides where the next phase goes.
     */
    'read_session_ended',
    /* Added 2026-11-16 with the Phase 1 set. The hero stat of the share card
     * and the thing the catalogue exists to produce, and nothing recorded it.
     * `source` separates reading to the end ('read') from the Mark read button
     * ('marked'). */
    'book_finished',
    'book_opened',
    'paywall_shown',
    'import_completed',
  ];

  /* Meta is whitelisted to non-identifying scalars. Anything else — a filename,
   * a book title, a package name, an object — is dropped. Package names are
   * excluded on purpose: "user watches Instagram" is a personal detail. */
  const ALLOWED_META = [
  'count', 'minutes', 'pages', 'engine', 'lang', 'tier', 'source',
  /* Added 2026-11-16 with the Phase 1 events.
   *
   * tenure — how long after install an open happened, as a coarse bucket. It
   * is what makes a retention curve possible with no identifier at all: the
   * count of opens at bucket '8-30' against bucket '0' is a curve, and no row
   * is linkable to another. A persistent install id would answer the same
   * question and is refused — it is exactly the "device identifier" §9.6
   * rules out, and it would flip the Play declaration to collecting one.
   *
   * first — true on the sender's first ever event of that name, set from
   * `firstTag` below. Lets an aggregate count of events answer "how many
   * people", which bare counts cannot. */
  'tenure', 'first',
];

  /* One-shot local flags, for `firstTag` (see logEvent). Consumed only when a
   * ping is actually about to be sent — resolving it earlier would spend a
   * user's "first" on a ping that opt-out then discarded, and they would never
   * be counted at all. */
  function _consumeFirst(tag) {
    const key = 'fr_an_first_' + tag;
    try {
      if (localStorage.getItem(key) === '1') return false;
      localStorage.setItem(key, '1');
      return true;
    } catch (_) {
      /* Cannot remember, so cannot claim a first. Undercounts rather than
       * over-counts, which is the right way round for a reach figure. */
      return false;
    }
  }

  /* Days since first launch, bucketed. Buckets rather than a number because a
   * precise day count alongside the day of the ping reveals an install date,
   * and an install date is a weak per-device fingerprint — the thing day
   * granularity elsewhere in this module exists to avoid. */
  function _tenureBucket() {
    try {
      const today = (typeof todayDateString === 'function') ? todayDateString() : '';
      if (!today) return '';
      let first = localStorage.getItem('fr_first_launch_day');
      if (!first) {
        /* Backfilled for everyone already on an older build, so their first
         * recorded open is bucket 0 even though it is not their real first.
         * The curve is therefore only honest for installs from this build
         * onward — worth knowing when reading the first month of it. */
        first = today;
        localStorage.setItem('fr_first_launch_day', first);
      }
      const ms = Date.parse(today + 'T00:00:00Z') - Date.parse(first + 'T00:00:00Z');
      if (!isFinite(ms)) return '';
      const d = Math.max(0, Math.round(ms / 86400000));
      if (d === 0) return '0';
      if (d === 1) return '1';
      if (d <= 3) return '2-3';
      if (d <= 7) return '4-7';
      if (d <= 30) return '8-30';
      return '31+';
    } catch (_) { return ''; }
  }

  function _clean(meta) {
    const out = {};
    if (!meta || typeof meta !== 'object') return out;
    for (var i = 0; i < ALLOWED_META.length; i++) {
      const k = ALLOWED_META[i];
      const v = meta[k];
      if (typeof v === 'number' && isFinite(v)) out[k] = v;
      else if (typeof v === 'string' && v.length <= 32) out[k] = v;
      else if (typeof v === 'boolean') out[k] = v;
    }
    return out;
  }

  function logEvent(name, meta) {
    try {
      if (!ENDPOINT) return;
      if (_optedOut()) return;
      if (ALLOWED.indexOf(name) === -1) return;

      /* `firstTag` is resolved here, after the opt-out and allowlist gates, so
       * a flag is never spent on a ping that is not sent. */
      if (meta && meta.firstTag) {
        meta = Object.assign({}, meta, { first: _consumeFirst(String(meta.firstTag)) });
      }
      if (name === 'app_opened') {
        meta = Object.assign({}, meta || {}, { tenure: _tenureBucket() });
      }

      const body = JSON.stringify({
        event: name,
        /* Day granularity, not a timestamp — a precise clock reading across
         * several events is itself a weak fingerprint. */
        day: (typeof todayDateString === 'function') ? todayDateString() : '',
        platform: (window.Capacitor && window.Capacitor.getPlatform)
          ? window.Capacitor.getPlatform() : 'web',
        meta: _clean(meta),
      });

      /* keepalive lets the ping survive the app being backgrounded mid-request,
       * which is the common case for nudge events. */
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
      }).catch(function() {});
    } catch (_) {}
  }

  return { logEvent: logEvent, optedOut: _optedOut };
})();

/* Short global alias — these calls are sprinkled across features. */
function logEvent(name, meta) { AnalyticsPing.logEvent(name, meta); }
