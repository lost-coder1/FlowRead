/* TipsFeature — rotating feature discovery (Claude.md §23)

   The problem this solves is that most of what FlowRead can do has no surface
   that teaches it. Onboarding (§10) deliberately leads with the habit pitch and
   ends in the Free Books library, so a user can read for weeks without learning
   that their own PDFs work, that long-pressing a word looks it up, or that a PDF
   can be read against its original pages (§7). None of those have a home in the
   UI, and none of them justifies one.

   What this module owns: the pool, which tip comes next, and the bookkeeping
   that stops a tip outliving its usefulness. Where a tip is *shown* belongs to
   the surface showing it — features/nudge.js draws the one surface there is.

   **The nudge unlock modal is the only place a tip appears** (owner,
   2026-11-20). Two rules behind that, and they are easy to erode:

   1. **Nothing goes on the nudge screen itself.** That screen has exactly two
      actions and they are deliberate peers: Start reading, and the escape hatch
      (§9.1, and the §21 UX rule that makes it a product rule rather than a style
      one). A third thing to look at — worse, a third thing to tap — makes the
      escape hatch one of three, which is how a nudge starts reading as a wall.
      The unlock modal is after the threshold is met: nothing is being held back
      and nothing is interrupted, and the user has just succeeded.
   2. **A tip is inert text.** The one thing the unlock modal is for is the
      choice between the book and the app the user just earned, and navigating
      off it would throw away what they read for. A home strip with tappable
      tips was built and then dropped; if a surface where nothing is pending is
      ever added back, a tap there may do the thing the sentence describes, but
      not here. */

const TipsFeature = (function() {

  /* Three shows and a tip is spent whether or not the user acted on it. A tip
     that keeps arriving after being understood and declined is the nagging §1.6
     rules out, and the pool is large enough that three shows is over a month of
     days. */
  const MAX_SHOWS = 3;

  const CURSOR_KEY = 'fr_tips_cursor';
  const SHOWN_PREFIX = 'fr_tips_shown_';
  const DONE_PREFIX = 'fr_tips_done_';

  /* ── Eligibility helpers ─────────────────────────────────────────────
     All of these must be synchronous and cheap: the home strip is decided
     during a home render, and §21 does not allow a JSON.parse of the library
     per tip. They each run once, behind a filter, on a screen that is already
     parsing the library for its own reasons. */

  /* The set of file ids that came from the catalogue. free-books.js records one
     `fr_freebook_<bookId>` key per download, which makes this derivable rather
     than something saveFileToLibrary() has to remember — `origin` is passed to
     it for §9.6's event and is deliberately not persisted on the item. */
  function _catalogueIds() {
    const ids = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('fr_freebook_') === 0) {
          var v = localStorage.getItem(k);
          if (v) ids[v] = true;
        }
      }
    } catch (_) {}
    return ids;
  }

  function _hasOwnImport() {
    const cat = _catalogueIds();
    return _library().some(function(item) { return item && !cat[item.id]; });
  }

  function _hasCatalogueBook() {
    for (var id in _catalogueIds()) return true;
    return false;
  }

  let _libCache = null;
  function _library() {
    if (_libCache) return _libCache;
    _libCache = (typeof loadLibrary === 'function') ? loadLibrary() : [];
    return _libCache;
  }

  /* loadLibrary() sorts by lastOpened descending, so this is the book the user
     was last in — the same definition the nudge uses for "current book"
     (§9.2). */
  function _lastKind() {
    const lib = _library();
    return (lib.length && lib[0] && lib[0].kind) ? lib[0].kind : '';
  }

  /* Whether the user has ever deliberately chosen an engine. reader.js writes
     fr_last_engine on every switch, so a value that differs from the default
     they were handed is proof of a switch; absent, or equal to it, is not. This
     under-counts a user who switched away and back, which costs them a tip they
     did not need. */
  function _switchedEngine() {
    try {
      const last = localStorage.getItem('fr_last_engine');
      if (!last) return false;
      const def = (typeof getSettings === 'function') ? getSettings().defaultMode : 'page';
      return last !== def;
    } catch (_) {
      return false;
    }
  }

  function _nudgeConfigured() {
    if (typeof NudgeAppsFeature === 'undefined') return false;
    try {
      const apps = NudgeAppsFeature.getTargets();
      return !!(apps && apps.length);
    } catch (_) {
      return false;
    }
  }

  function _hasSomethingToShare() {
    if (typeof ShareStats === 'undefined' || typeof ShareStats.hasSomethingToShare !== 'function') return false;
    try { return !!ShareStats.hasSomethingToShare(); } catch (_) { return false; }
  }

  /* ── The pool ────────────────────────────────────────────────────────

     `when` is the relevance gate: false means this user has no use for the tip,
     which is a different thing from having outgrown it. A tip with no `when`
     applies to everyone and is retired by the show cap alone.

     Nothing here may teach a locked feature to a user who does not have it: the
     DOCX/TXT cards and Scan are Pro (§4), so `import` names PDF, which is free
     for everyone, and `scan` is gated on Pro. */
  const TIPS = [
    {
      id: 'import',
      key: 'tip.import',
      when: function() { return !_hasOwnImport(); },
    },
    {
      id: 'freebooks',
      key: 'tip.freebooks',
      when: function() { return !_hasCatalogueBook(); },
    },
    {
      id: 'dictionary',
      key: 'tip.dictionary',
      /* Ungated on purpose (owner, 2026-11-20), and the one tip in the pool
         that can reach a user who cannot yet act on it:
         DictionaryFeature.showDictionaryModal() gates the lookup itself on
         AppState.isPro and shows a Pro gate, while §4 lists the dictionary
         under the free tier. The owner's call is that the tip is right for both
         tiers — so if the free user following it still meets a paywall, the
         thing to change is that gate, not this line. */
    },
    {
      id: 'bridge',
      key: 'tip.bridge',
      when: function() { return _lastKind() === 'pdf'; },
    },
    {
      id: 'engines',
      key: 'tip.engines',
      when: function() { return !_switchedEngine(); },
    },
    {
      id: 'chapters',
      key: 'tip.chapters',
      when: function() { return _library().length > 0; },
    },
    {
      id: 'calm',
      key: 'tip.calm',
    },
    {
      id: 'offline',
      key: 'tip.offline',
    },
    {
      id: 'paste',
      key: 'tip.paste',
    },
    {
      id: 'share',
      key: 'tip.share',
      when: _hasSomethingToShare,
    },
    {
      id: 'nudge_settings',
      key: 'tip.nudge_settings',
      when: _nudgeConfigured,
    },
    {
      id: 'scan',
      key: 'tip.scan',
      /* AppState.isPro is written by hasProAccess(), which app.js awaits on
         boot, so it is settled long before any nudge. Read rather than
         re-queried because the gate must stay synchronous. */
      when: function() { return AppState.isPro === true; },
    },
  ];

  /* ── Bookkeeping ─────────────────────────────────────────────────────── */

  function _num(key) {
    try { return parseInt(localStorage.getItem(key) || '0', 10) || 0; } catch (_) { return 0; }
  }

  function isDone(id) {
    try { return localStorage.getItem(DONE_PREFIX + id) === '1'; } catch (_) { return false; }
  }

  /* Called from the feature itself the first time the user does the thing — the
     dictionary modal opening, a bridge jump. Cheap enough to call
     unconditionally from a hot path; it is a single localStorage read once the
     flag is set. */
  function markDone(id) {
    if (!id || isDone(id)) return;
    try { localStorage.setItem(DONE_PREFIX + id, '1'); } catch (_) {}
  }

  function _eligible(tip) {
    if (!tip) return false;
    if (isDone(tip.id)) return false;
    if (_num(SHOWN_PREFIX + tip.id) >= MAX_SHOWS) return false;
    /* A key missing from the active locale renders as the key name — i18n.js has
       no English fallback (§17) — so an untranslated tip is skipped rather than
       shown raw. A short pool in one language narrows the rotation; it never
       leaks a key name. */
    if (typeof t === 'function' && t(tip.key) === tip.key) return false;
    try { if (tip.when && !tip.when()) return false; } catch (_) { return false; }
    return true;
  }

  /* Round-robin from a stored cursor, not random. Random is right for the
     nudge's six interchangeable subtitles and wrong here: with a dozen distinct
     tips it repeats one three times before another is ever seen, and a tip
     nobody sees is a feature nobody learns. */
  function _next() {
    const start = _num(CURSOR_KEY);
    for (var i = 0; i < TIPS.length; i++) {
      const idx = (start + i) % TIPS.length;
      const tip = TIPS[idx];
      if (!_eligible(tip)) continue;
      try { localStorage.setItem(CURSOR_KEY, String((idx + 1) % TIPS.length)); } catch (_) {}
      return tip;
    }
    return null;
  }

  function _markShown(id) {
    try { localStorage.setItem(SHOWN_PREFIX + id, String(_num(SHOWN_PREFIX + id) + 1)); } catch (_) {}
  }

  /* ── Selection ───────────────────────────────────────────────────────── */

  /* The unlock modal needs no throttle of its own, which is most of why it is
     the only surface: it exists only after someone met a read threshold (§9.2
     step 8), so it is rare and earned and rations itself. One tip per unlock,
     and the show cap is what eventually retires each one. */
  function pickForUnlock() {
    const tip = _next();
    if (!tip) return null;
    _markShown(tip.id);
    return tip;
  }

  /* The library read is cached for the duration of one selection pass, so a
     surface that renders twice does not re-parse it. Dropped afterwards because
     an import can land between renders. */
  function _withFreshState(fn) {
    _libCache = null;
    try { return fn(); } finally { _libCache = null; }
  }

  return {
    pickForUnlock: function() { return _withFreshState(pickForUnlock); },
    markDone: markDone,
    isDone: isDone,
  };
})();
