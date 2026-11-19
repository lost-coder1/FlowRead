/* CelebrationFeature — the variable reward on a completed nudge-read
   (Claude.md §9.2 step 8, §16, §23)

   The unlock modal is the one moment in this product where the user has
   unambiguously done the thing the app exists for: they were on their way into
   Instagram, and they read instead. Until now it said the same two sentences
   every time, which is how a reward becomes wallpaper.

   The mechanic here is deliberately *variable magnitude*, not variable
   decoration. Rotating copy and a choice of animations are only skins: if every
   unlock celebrates equally hard the user calibrates to it inside a week no
   matter how many skins there are. So the great majority of unlocks are quiet —
   a rotating line, the credit, and the count — and a small minority are
   genuinely bigger, carrying a real milestone and the only animation this
   feature ever draws.

   What makes that honest rather than a dice roll: the big ones fire on measured
   thresholds the user actually crossed, each once ever. Unpredictable to them,
   deterministic in here. Nothing is invented — §24's rule against fabricated
   figures applies to a celebration as much as to a dashboard preview, and
   "you saved 15 minutes of scrolling" is unmeasurable and therefore unsayable.
   What we can say is how many times they chose the book, because we counted.

   What this module owns: the pools, the counters, the tier decision. How the
   modal is drawn stays in features/nudge.js, as the tip line does — the two
   have nothing in common beyond asking this module a question. */

const CelebrationFeature = (function() {

  /* Append-only list of the dates on which a nudge-read was completed. Every
     figure below is *derived* from it, never stored alongside it — the same
     discipline computeStreak() follows in storage.js, and for the same reason:
     a stored total and a stored list can drift apart, and then the celebration
     is congratulating the user on a number nothing can substantiate. */
  const READS_KEY = 'fr_nudge_reads';
  const MILESTONES_KEY = 'fr_nudge_milestones';
  const VARIANT_CURSOR_KEY = 'fr_nudge_celebrate_variant';
  const LAST_PREFIX = 'fr_nudge_celebrate_last_';
  const MAX_READS = 400;

  /* Sizes of the two copy pools. t() returns the key itself when a string is
     missing, which is the only way to detect one — so a locale that is short of
     a few variants narrows its own rotation instead of printing a raw key name.
     The first entry of each pool is the string that shipped before this
     feature existed, deliberately: it is good copy and it keeps the diff on the
     existing keys at nil. */
  const TITLE_COUNT = 8;
  const EARNED_COUNT = 8;
  const COUNT_COUNT = 3;

  /* ── The counters ────────────────────────────────────────────────────── */

  function _reads() {
    try {
      const raw = JSON.parse(localStorage.getItem(READS_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter(Boolean) : [];
    } catch (_) {
      return [];
    }
  }

  function _recordRead() {
    var reads = _reads();
    reads.push((typeof todayDateString === 'function') ? todayDateString() : '');
    if (reads.length > MAX_READS) reads = reads.slice(reads.length - MAX_READS);
    try { localStorage.setItem(READS_KEY, JSON.stringify(reads)); } catch (_) {}
    return reads;
  }

  function _dateString(d) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  /* Monday to today, not a rolling seven days. The copy says "this week", and a
     rolling window would make that quietly false every day of the week bar one
     — the kind of small dishonesty §1.5 exists to stop. A Monday boundary is
     also the one the user can check against their own memory. */
  function _thisWeek(reads) {
    const now = new Date();
    const back = (now.getDay() + 6) % 7;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const floor = _dateString(monday);
    return reads.filter(function(d) { return d >= floor; }).length;
  }

  /* Consecutive days with at least one nudge-read, counting back from today.
     Mirrors computeStreak() rather than reusing it, because that one reads the
     reading-session store and this is a different question: days on which the
     user was offered the app and took the book instead. */
  function _dayRun(reads) {
    const set = {};
    reads.forEach(function(d) { set[d] = true; });
    let run = 0;
    const cursor = new Date();
    for (var i = 0; i < 365; i++) {
      if (!set[_dateString(cursor)]) break;
      run++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return run;
  }

  /* ── Milestones ──────────────────────────────────────────────────────── */

  /* Each fires once ever and is then spent, which is what keeps a milestone a
     milestone. The gate is sticky on purpose, exactly as §9.6's book_finished
     gate is: the question is whether this user has ever reached ten, not how
     many times the counter has passed through ten. */
  const TOTAL_STEPS = [1, 5, 10, 25, 50, 100, 250];
  const RUN_STEPS = [3, 7, 14, 30];

  function _granted() {
    try {
      const raw = JSON.parse(localStorage.getItem(MILESTONES_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (_) {
      return [];
    }
  }

  function _grant(key) {
    const list = _granted();
    if (list.indexOf(key) !== -1) return false;
    list.push(key);
    try { localStorage.setItem(MILESTONES_KEY, JSON.stringify(list)); } catch (_) {}
    return true;
  }

  function _highestReached(steps, value) {
    let hit = 0;
    for (var i = 0; i < steps.length; i++) {
      if (value >= steps[i]) hit = steps[i];
    }
    return hit;
  }

  /* A day run is harder to earn than a count — it cannot be caught up on — so
     when both cross on the same read, the run wins and the count milestone is
     left unspent for the next one. Nothing is lost either way, and two
     celebrations in one modal would be one too many. */
  function _milestone(reads) {
    const run = _dayRun(reads);
    const runStep = _highestReached(RUN_STEPS, run);
    if (runStep && _grant('run.' + runStep)) {
      return { key: 'nudge.celebrate.run.' + runStep, n: runStep };
    }
    const totalStep = _highestReached(TOTAL_STEPS, reads.length);
    if (totalStep && _grant('total.' + totalStep)) {
      return { key: 'nudge.celebrate.total.' + totalStep, n: totalStep };
    }
    return null;
  }

  /* ── Copy rotation ───────────────────────────────────────────────────── */

  /* `probe` is the suffix that makes the key a real one. The body pool's
     entries are pluralised — the caller hands tn() `…celebrate.count.2` and tn()
     appends `.one`/`.other` — so testing the bare stem finds nothing and the
     whole pool collapses to its first entry, silently and in both locales. */
  function _pool(prefix, count, base, probe) {
    const suffix = probe || '';
    const keys = [];
    for (var i = 1; i <= count; i++) {
      const k = (i === 1) ? base : prefix + '.' + i;
      if (t(k + suffix) !== k + suffix) keys.push(k);
    }
    return keys.length ? keys : [base];
  }

  /* Random, not round-robin. §23 reserves round-robin for the tip pool, where
     each entry teaches something different and one nobody sees is a feature
     nobody learns. These lines are interchangeable — they all say "well done" —
     so the only requirement is that consecutive unlocks differ.

     Which is the one thing unseeded random will not promise: with eight entries
     it hands out the same line twice running about one time in eight, and this
     whole module exists because the modal read as a fixed string. So the
     previous pick is excluded rather than merely unlikely. Remembered in
     storage, not in memory — consecutive unlocks are usually separate app
     sessions, which is precisely when a repeat would be most visible. */
  function _pick(keys, memo) {
    let last = null;
    try { last = localStorage.getItem(LAST_PREFIX + memo); } catch (_) {}
    const pool = (keys.length > 1 && last)
      ? keys.filter(function(k) { return k !== last; })
      : keys;
    const key = pool[Math.floor(Math.random() * pool.length)];
    try { localStorage.setItem(LAST_PREFIX + memo, key); } catch (_) {}
    return key;
  }

  /* ── The visual ──────────────────────────────────────────────────────── */

  /* Three restrained variants, §16 palette only, under a second, no bounce.
     Round-robin here and not random, which looks inconsistent with the copy
     above and is not: a milestone is rare — a user may see six in their life —
     so a random pick would plausibly show the same one twice running, and at
     that frequency the repeat is the thing they would notice. */
  const VARIANTS = ['bloom', 'sweep', 'ring'];

  function _nextVariant() {
    let n = 0;
    try { n = parseInt(localStorage.getItem(VARIANT_CURSOR_KEY) || '0', 10) || 0; } catch (_) {}
    const variant = VARIANTS[n % VARIANTS.length];
    try { localStorage.setItem(VARIANT_CURSOR_KEY, String((n + 1) % VARIANTS.length)); } catch (_) {}
    return variant;
  }

  function _reducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (_) {
      return false;
    }
  }

  /* Deliberately a no-op, with the call site already in place (owner,
     2026-11-20). A haptic is confirmation, not reinforcement: vibration has no
     perceptible dynamic range, so it cannot carry the variable-magnitude job
     this module exists to do, and turning it on costs android.permission.VIBRATE
     in the merged manifest forever. Where it would earn that is as punctuation
     on the milestone alone — one short pulse so the moment has physical weight.
     Judge it on a device once the milestone visual is real; switching it on is
     this function body plus the manifest line, and nothing else moves. */
  function _haptic(tier) { /* intentionally empty — see above */ }

  /* ── What the modal asks for ─────────────────────────────────────────── */

  /* Records the read and decides the tier in one call, because the two must not
     be able to disagree: a milestone granted against a count that was never
     written would congratulate the user once and never again. Call exactly once
     per unlock prompt, after the modal has claimed AppState.activeModal — the
     await before it is a window in which a second page turn could arrive. */
  function forUnlock() {
    const reads = _recordRead();
    const milestone = _milestone(reads);
    const tier = milestone ? 'milestone' : 'quiet';
    _haptic(tier);
    return {
      tier: tier,
      /* A milestone states itself in the headline — that is what makes the
         bigger tier legible rather than merely decorated. */
      titleKey: milestone ? milestone.key : _pick(_pool('nudge.unlock.title', TITLE_COUNT, 'nudge.unlock.title'), 'title'),
      /* The benefit in words. The figures are not in here at all: they go in
         one small mono receipt beside it, because a sentence built out of four
         numbers is the same sentence every time however it is worded, which is
         exactly how this reward went stale. §9.2 asks for the reset to be
         *visible*, never for it to be the headline. */
      earnedKey: _pick(_pool('nudge.unlock.earned', EARNED_COUNT, 'nudge.unlock.earned.1'), 'earned'),
      countKey: _pick(_pool('nudge.celebrate.count', COUNT_COUNT, 'nudge.celebrate.count', '.other'), 'count'),
      /* Nothing to count on the very first one, and "1 time this week" reads
         like a system message rather than encouragement. */
      weekCount: _thisWeek(reads),
      total: reads.length,
      variant: (milestone && !_reducedMotion()) ? _nextVariant() : null,
    };
  }

  return {
    forUnlock: forUnlock,
    /* Exposed for the dashboard and any future "time reclaimed" stat (§15):
       these are the only honest nudge-choice figures in the app. */
    stats: function() {
      const reads = _reads();
      return { total: reads.length, thisWeek: _thisWeek(reads), dayRun: _dayRun(reads) };
    },
  };
})();
