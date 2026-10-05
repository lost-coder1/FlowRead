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
 * ENDPOINT is empty until the Cloudflare Worker exists. While empty this module
 * is inert — every call is a no-op, which is the desired shipping state.
 */

const AnalyticsPing = (function() {
  const ENDPOINT = '';

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
  ];

  /* Meta is whitelisted to non-identifying scalars. Anything else — a filename,
   * a book title, a package name, an object — is dropped. Package names are
   * excluded on purpose: "user watches Instagram" is a personal detail. */
  const ALLOWED_META = ['count', 'minutes', 'pages', 'engine', 'lang', 'tier', 'source'];

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
      if (ALLOWED.indexOf(name) === -1) return;

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

  return { logEvent: logEvent };
})();

/* Short global alias — these calls are sprinkled across features. */
function logEvent(name, meta) { AnalyticsPing.logEvent(name, meta); }
