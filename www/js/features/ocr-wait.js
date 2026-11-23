/* OcrWaitTips — rotating tips on the OCR progress overlay (Claude.md §22, §5)

   Importing a scanned book is the longest wait in the app: a 435-page Hindi
   scan is a little over three minutes, and the 23 catalogue PDFs that run OCR
   automatically are free for everyone, so this screen is on the main free-user
   path rather than an edge case. Until now it held a page counter, a bar and an
   ETA — three honest numbers and nothing to read.

   What this module owns: the rotation on that one surface. Which tip comes next
   belongs to TipsFeature, which owns the pool and the bookkeeping for every
   surface (§22) — this file asks it a question and draws the answer.

   Three rules it inherits, and one it sets:

   1. **Inert, never tappable.** Same as the unlock modal (§22.3) and for a
      sibling reason: the one thing this screen is for is the import finishing,
      and a tap that navigated away would abandon it mid-run.
   2. **Never truncated** (§22.4). A Hindi tip routinely runs longer than its
      English twin and a slot whose whole job is to explain something cannot
      clip the explanation. The line wraps to as many lines as it needs, and the
      overlay is a centred flex column, so growing it pushes nothing off screen.
   3. **It spends no show cap** — TipsFeature.poolForWait() carries that
      reasoning, since it is a decision about the pool rather than about this
      surface.
   4. **The rotation stops when the overlay goes.** The timer is cleared from
      ocrScannedPdf's `finally`, so a failed or cancelled import cannot leave an
      interval running against a hidden node. */

const OcrWaitTips = (function() {

  /* Long enough to read the longest line in the pool without hurrying — the
     longest Hindi tip is just over 100 characters, which is two or three lines
     on a phone. Short enough that a three-minute wait is a rotation rather than
     a slideshow of two. */
  const ROTATE_MS = 9000;

  /* Matches §15's 0.3s view transition: the tip is replacing a whole thought,
     not reacting to a hover. */
  const FADE_MS = 300;

  let _timer = null;
  let _fadeTimer = null;
  let _pool = [];
  let _at = 0;

  function _node() {
    return qs('#loading-tip');
  }

  /* The pool is walked in order and then walked again. A wait long enough to
     exhaust it has earned the repeat, and the alternative — stopping on the
     last tip — leaves the screen looking stuck. */
  function _advance() {
    const el = _node();
    if (!el || !_pool.length) return;
    const tip = _pool[_at % _pool.length];
    _at++;

    const text = t(tip.key);
    /* i18n.js has no English fallback, so a key missing from the active locale
       renders as its own name (§16). TipsFeature already filters those out, so
       this is the second line of defence rather than the first — but a key name
       on a screen the user is staring at for three minutes is worse than a
       blank line. */
    if (!text || text === tip.key) return;

    el.textContent = text;
    show(el);
    /* Re-trigger the fade without re-parenting the node: toggling the class off
       and back on inside one frame is collapsed by the style resolver, so the
       second write is deferred. */
    el.classList.remove('is-in');
    if (_fadeTimer) clearTimeout(_fadeTimer);
    _fadeTimer = setTimeout(function() { el.classList.add('is-in'); }, 20);
  }

  /* Called once per OCR run, from the single entry point every import shares.
     Safe to call when there is nothing to show: an empty pool simply leaves the
     overlay as it was. */
  function start() {
    stop();
    if (typeof TipsFeature === 'undefined') return;
    try { _pool = TipsFeature.poolForWait() || []; } catch (_) { _pool = []; }
    if (!_pool.length) return;
    _at = 0;
    _advance();
    _timer = setInterval(_advance, ROTATE_MS);
  }

  function stop() {
    if (_timer) { clearInterval(_timer); _timer = null; }
    if (_fadeTimer) { clearTimeout(_fadeTimer); _fadeTimer = null; }
    const el = _node();
    if (el) {
      el.classList.remove('is-in');
      el.textContent = '';
      hide(el);
    }
    _pool = [];
    _at = 0;
  }

  return { start: start, stop: stop, ROTATE_MS: ROTATE_MS, FADE_MS: FADE_MS };
})();
