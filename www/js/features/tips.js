/* TipsFeature — rotating feature discovery (Claude.md §23)

   The problem this solves is that most of what FlowRead can do has no surface
   that teaches it. Onboarding (§10) deliberately leads with the habit pitch and
   ends in the Free Books library, so a user can read for weeks without learning
   that their own PDFs work, that long-pressing a word looks it up, or that a PDF
   can be read against its original pages (§7). None of those have a home in the
   UI, and none of them justifies one.

   What this module owns: the pool, which tip comes next, and the bookkeeping
   that stops a tip outliving its usefulness. Where a tip is *shown* belongs to
   the surface showing it — the home strip is in views/upload.js, the unlock line
   in features/nudge.js — because those two have nothing in common beyond asking
   this module a question.

   Two rules from the design discussion are load-bearing and easy to erode:

   1. **Nothing goes on the nudge screen itself.** That screen has exactly two
      actions and they are deliberate peers: Start reading, and the escape hatch
      (§9.1, and the §21 UX rule that makes it a product rule rather than a style
      one). A third thing to look at — worse, a third thing to tap — makes the
      escape hatch one of three, which is how a nudge starts reading as a wall.
      The unlock modal is the nudge-path home for a tip: the user has already met
      the threshold, so nothing is being held back and nothing is interrupted.
   2. **A tip is tappable only where nothing else is pending.** On the home
      strip, a tap does the thing it describes. In the unlock modal it is inert
      text, because the one thing that modal is for is the choice between the
      book and the app the user just earned — navigating off it would throw away
      what they read for. */

const TipsFeature = (function() {

  /* Three shows and a tip is spent whether or not the user acted on it. A tip
     that keeps arriving after being understood and declined is the nagging §1.6
     rules out, and the pool is large enough that three shows is over a month of
     days. */
  const MAX_SHOWS = 3;

  const CURSOR_KEY = 'fr_tips_cursor';
  const HOME_KEY = 'fr_tips_home';
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

     `go` is what a tap does on the home strip. Omit it for anything that can
     only happen inside a reader — sending someone into a book to demonstrate a
     long-press would be a navigation they did not ask for.

     Nothing here may teach a locked feature to a user who does not have it: the
     DOCX/TXT cards and Scan are Pro (§4), so `import` names PDF, which is free
     for everyone, and `scan` is gated on Pro. */
  const TIPS = [
    {
      id: 'import',
      key: 'tip.import',
      when: function() { return !_hasOwnImport(); },
      go: function() { const el = qs('#file-input'); if (el) el.click(); },
    },
    {
      id: 'freebooks',
      key: 'tip.freebooks',
      when: function() { return !_hasCatalogueBook(); },
      go: function() { renderFreeBooks(); switchView('view-free-books'); },
    },
    {
      id: 'dictionary',
      key: 'tip.dictionary',
      /* Ungated, and the gate it used to mirror is gone too: the dictionary
         was Pro in code against §4, which lists it under the free tier, and
         that was fixed rather than described (2026-11-20). Every user can act
         on this tip. */
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
      go: function() { openPasteText(); },
    },
    {
      /* The share-sheet route is the least discoverable thing the app does:
         nothing in FlowRead tells you it appears in the browser's own share
         menu, and nothing in the browser explains what sharing to a reading app
         would do. The URL card on home is the half a user can stumble on; this
         is the half nobody finds.

         Pro, like `scan` — `_handleShareUrl()` and the URL card both gate on
         `hasProAccess()`, and §23 does not allow a tip to teach a locked
         feature. */
      id: 'url',
      key: 'tip.url',
      when: function() { return AppState.isPro === true; },
      /* Focuses the card that does the same job in-app, since no tap in here can
         open another app's share sheet. */
      go: function() {
        const el = qs('#url-input');
        if (!el) return;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.focus();
      },
    },
    {
      id: 'share',
      key: 'tip.share',
      when: _hasSomethingToShare,
      go: function() { ShareStats.openSheet({ source: 'home' }); },
    },
    {
      id: 'nudge_settings',
      key: 'tip.nudge_settings',
      when: _nudgeConfigured,
      go: function() { renderSettings(); },
    },
    {
      id: 'scan',
      key: 'tip.scan',
      /* AppState.isPro is written by hasProAccess(), which the home screen
         awaits before this is consulted. Read rather than re-queried because
         the gate must stay synchronous. */
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
     dictionary modal opening, a bridge jump — and by the strip's dismiss. Both
     mean the same thing to this module: stop offering it. Cheap enough to call
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

  function _byId(id) {
    for (var i = 0; i < TIPS.length; i++) if (TIPS[i].id === id) return TIPS[i];
    return null;
  }

  /* Round-robin from a stored cursor, not random. Random is right for the
     nudge's six interchangeable subtitles and wrong here: with a dozen distinct
     tips it repeats one three times before another is ever seen, and a tip
     nobody sees is a feature nobody learns. */
  function _next(skipId) {
    const start = _num(CURSOR_KEY);
    for (var i = 0; i < TIPS.length; i++) {
      const idx = (start + i) % TIPS.length;
      const tip = TIPS[idx];
      if (tip.id === skipId) continue;
      if (!_eligible(tip)) continue;
      try { localStorage.setItem(CURSOR_KEY, String((idx + 1) % TIPS.length)); } catch (_) {}
      return tip;
    }
    return null;
  }

  function _markShown(id) {
    try { localStorage.setItem(SHOWN_PREFIX + id, String(_num(SHOWN_PREFIX + id) + 1)); } catch (_) {}
  }

  function _homeState() {
    try { return JSON.parse(localStorage.getItem(HOME_KEY) || '{}') || {}; } catch (_) { return {}; }
  }

  function _saveHomeState(state) {
    try { localStorage.setItem(HOME_KEY, JSON.stringify(state)); } catch (_) {}
  }

  /* ── Selection ───────────────────────────────────────────────────────── */

  /* One tip per calendar day, and the same one all day. Picking per render would
     reshuffle it every time the user backs out of a reader, which reads as a
     glitch rather than a rotation — and would spend the show cap in an
     afternoon. The day's choice is re-validated rather than trusted: a tip the
     user acted on at lunchtime is gone by the evening. */
  function pickForHome() {
    const today = (typeof todayDateString === 'function') ? todayDateString() : '';
    const state = _homeState();

    if (state.day === today) {
      /* Dismissed today means nothing more today. Offering a replacement the
         moment one is waved away is whack-a-mole, not a rotation. */
      if (state.dismissed) return null;
      const held = _byId(state.id);
      if (held && _eligible(held)) return held;
      /* The held tip has since been acted on or outgrown. Let the day stand as
         spent rather than reaching for another — same reason as above. */
      return null;
    }

    const tip = _next();
    if (!tip) {
      _saveHomeState({ day: today, id: '', dismissed: true });
      return null;
    }
    _markShown(tip.id);
    _saveHomeState({ day: today, id: tip.id, dismissed: false });
    return tip;
  }

  function dismissHome() {
    const state = _homeState();
    /* Retires the tip, not the strip: the user has told us about this one tip,
       and tomorrow's is a different proposition. */
    if (state.id) markDone(state.id);
    state.dismissed = true;
    _saveHomeState(state);
  }

  /* The unlock modal needs no throttle of its own. It only exists after someone
     met a read threshold (§9.2 step 8), which is rare and earned, so the surface
     rations itself. The day's home tip is skipped so the two surfaces do not say
     the same thing within a few minutes of each other. */
  function pickForUnlock() {
    const state = _homeState();
    const today = (typeof todayDateString === 'function') ? todayDateString() : '';
    const tip = _next(state.day === today ? state.id : null);
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
    pickForHome: function() { return _withFreshState(pickForHome); },
    pickForUnlock: function() { return _withFreshState(pickForUnlock); },
    dismissHome: dismissHome,
    markDone: markDone,
    isDone: isDone,
  };
})();
