/* Reading habit interception — the "nudge" (Claude.md §9).
 *
 * A nudge is NOT a block (§1.6, §9.1). Every nudge screen carries a visible,
 * one-tap "Continue to <app> anyway" that is never hidden, never delayed behind
 * a timer, and never costs the user anything. §21 calls this a product/legal
 * rule rather than a style preference: do not let a later change weaken it
 * without a logged product-owner decision.
 *
 * Detection lives in FlowReadNudgeService, which decides whether to nudge using
 * NudgeGate — in Java, because the service must work when this WebView is dead.
 * The rules are mirrored in DEFAULTS below purely so Settings can show and edit
 * them; the native side is the one that actually enforces them.
 */

const NudgeFeature = (function() {
  const KEY_ENABLED = 'fr_nudge_enabled';
  const KEY_MIN_MINUTES = 'fr_nudge_min_minutes';
  const KEY_MIN_OPENS = 'fr_nudge_min_opens';
  const KEY_DAILY_CAP = 'fr_nudge_daily_cap';
  const KEY_BACKOFF = 'fr_nudge_backoff_dismissals';
  const KEY_UNLOCK_PAGES = 'fr_nudge_unlock_pages';
  const KEY_DISCLOSED = 'fr_nudge_disclosed';
  const KEY_TRIGGER_MODE = 'fr_nudge_trigger_mode';
  const KEY_PROMPTED = 'fr_nudge_prompted';

  /* The two triggers are independent, not a choice between them: a user can
     have either, both, or neither. Stored as a comma-separated list, which
     NudgeGate reads from the shared prefs store and is the side that enforces.
     Note that with both on, "every open" subsumes the threshold — every open
     already includes the opens that happen past it. */
  const MODE_THRESHOLD = 'threshold';
  const MODE_EVERY_OPEN = 'every_open';

  /* Q2 starting values, signed off 2026-09-20. All are settings, none are
     hardcoded at the call site — §9.2 step 5 is explicit about that. */
  const DEFAULTS = {
    minMinutes: 15,
    minOpens: 3,
    dailyCap: 3,
    backoffDismissals: 3,
    unlockPages: 2,
  };

  /* How long a given app stays un-nudged after each outcome. Dismissing buys a
     short breather; reading to the threshold buys a proper session (§9.7). */
  const DISMISS_SUPPRESS_MINUTES = 10;

  /* Escaping in every-open mode cannot suppress for long — the next open is the
     whole point of the mode — but it cannot suppress for nothing either: the
     app coming back to the front IS a window-state change, so a zero window
     re-nudges instantly and traps the user in a loop. Just long enough to cover
     the return to the app they asked to be let into. */
  const EVERY_OPEN_SKIP_SUPPRESS_MINUTES = 2;
  const UNLOCK_SUPPRESS_MINUTES = 60;

  /* How old a handoff may be before it is junk rather than a live interception. */
  const STALE_AFTER_MS = 120000;

  let _pending = null;   /* { packageName, label, minutes, opens } awaiting a screen */
  let _incomingInFlight = false;  /* one render at a time across the three paths */

  function _plugin() {
    return (typeof Capacitor !== 'undefined' &&
            Capacitor.Plugins &&
            Capacitor.Plugins.FlowReadNudge)
      ? Capacitor.Plugins.FlowReadNudge : null;
  }

  function isAvailable() { return !!_plugin(); }

  function isEnabled() { return localStorage.getItem(KEY_ENABLED) !== 'false'; }

  function setEnabled(on) {
    localStorage.setItem(KEY_ENABLED, on ? 'true' : 'false');
    _pushSettings();
  }

  function hasSeenDisclosure() { return localStorage.getItem(KEY_DISCLOSED) === 'true'; }

  function getSetting(key, fallback) {
    const raw = localStorage.getItem(key);
    const n = parseInt(raw, 10);
    return (raw !== null && isFinite(n) && n > 0) ? n : fallback;
  }

  function settings() {
    return {
      minMinutes: getSetting(KEY_MIN_MINUTES, DEFAULTS.minMinutes),
      minOpens: getSetting(KEY_MIN_OPENS, DEFAULTS.minOpens),
      dailyCap: getSetting(KEY_DAILY_CAP, DEFAULTS.dailyCap),
      backoffDismissals: getSetting(KEY_BACKOFF, DEFAULTS.backoffDismissals),
      unlockPages: getSetting(KEY_UNLOCK_PAGES, DEFAULTS.unlockPages),
    };
  }

  /* A legacy single value ("threshold") parses as a one-item list unchanged. */
  function triggers() {
    const raw = localStorage.getItem(KEY_TRIGGER_MODE);
    if (raw === null) return [MODE_THRESHOLD];
    const list = raw.split(',').map(function(x) { return x.trim(); })
      .filter(function(x) { return x === MODE_THRESHOLD || x === MODE_EVERY_OPEN; });
    return list;
  }

  function hasTrigger(mode) { return triggers().indexOf(mode) !== -1; }

  function setTrigger(mode, on) {
    const list = triggers().filter(function(x) { return x !== mode; });
    if (on) list.push(mode);
    localStorage.setItem(KEY_TRIGGER_MODE, list.join(','));
    _pushSettings();
  }

  function setSetting(key, value) {
    localStorage.setItem(key, String(value));
    _pushSettings();
  }

  /* The Java gate reads these from the same prefs store, so writing them here is
     enough — there is no separate native setter to keep in step. */
  function _pushSettings() {
    const prefs = (window.Capacitor && window.Capacitor.Plugins &&
                   window.Capacitor.Plugins.Preferences) || null;
    if (!prefs) return;
    const s = settings();
    const write = {};
    write[KEY_ENABLED] = isEnabled() ? 'true' : 'false';
    write[KEY_MIN_MINUTES] = String(s.minMinutes);
    write[KEY_MIN_OPENS] = String(s.minOpens);
    write[KEY_DAILY_CAP] = String(s.dailyCap);
    write[KEY_BACKOFF] = String(s.backoffDismissals);
    write[KEY_TRIGGER_MODE] = triggers().join(',');
    Object.keys(write).forEach(function(k) {
      prefs.set({ key: k, value: write[k] }).catch(function() {});
    });
  }

  /* ─── Permissions ──────────────────────────────────────────────────── */

  async function permissionState() {
    const p = _plugin();
    if (!p) return { accessibility: false, overlay: false, usageAccess: false, available: false };
    try {
      const s = await p.getPermissionState();
      return {
        available: true,
        accessibility: !!(s && s.accessibility),
        overlay: !!(s && s.overlay),
        usageAccess: !!(s && s.usageAccess),
      };
    } catch (_) {
      return { accessibility: false, overlay: false, usageAccess: false, available: true };
    }
  }

  /* Accessibility and overlay are both required; usage access only upgrades the
     trigger from "Nth open today" to "minutes in app today", so its absence is
     reported plainly rather than treated as a failure (§1.5). */
  function isFullyConfigured(state) {
    return !!(state && state.accessibility && state.overlay
              && NudgeAppsFeature.getTargets().length > 0);
  }

  async function openAccessibilitySettings() {
    const p = _plugin();
    if (!p) return false;
    try {
      const r = await p.openAccessibilitySettings();
      return !!(r && r.opened);
    } catch (_) { return false; }
  }

  async function openOverlaySettings() {
    const p = _plugin();
    if (!p) return false;
    try {
      const r = await p.openOverlaySettings();
      return !!(r && r.opened);
    } catch (_) { return false; }
  }

  async function openUsageAccessSettings() {
    const p = _plugin();
    if (!p) return false;
    try {
      const r = await p.openUsageAccessSettings();
      return !!(r && r.opened);
    } catch (_) { return false; }
  }

  /* ─── Diagnostics ──────────────────────────────────────────────────── */

  /* Every reason the gate declines to nudge is invisible from the outside, and
     the back-off is the worst of them: three skips silences an app for the rest
     of the day with nothing on screen saying so. Settings shows this (§1.5). */
  async function statusFor(packageName) {
    const p = _plugin();
    if (!p || typeof p.getNudgeStatus !== 'function' || !packageName) return null;
    try {
      const s = await p.getNudgeStatus({ packageName: packageName });
      return (s && typeof s.nudges === 'number') ? s : null;
    } catch (_) { return null; }
  }

  async function resetState(packageName) {
    const p = _plugin();
    if (!p || typeof p.resetNudgeState !== 'function' || !packageName) return;
    try { await p.resetNudgeState({ packageName: packageName }); } catch (_) {}
  }

  /* ─── Disclosure ───────────────────────────────────────────────────── */

  /* Play policy requires a prominent disclosure before the accessibility grant,
     and §10.1 requires the *why* before any permission ask regardless. This is
     the one screen that must not be skippable on the way to the grant. */
  function showDisclosure(onAccept) {
    const root = qs('#modal-root');
    if (!root) return;
    closeActiveModal();
    AppState.activeModal = 'nudge-disclosure';

    root.innerHTML =
      '<div class="modal-backdrop" id="modal-backdrop">' +
        '<div class="modal-card nudge-disclosure-card" role="dialog" aria-modal="true">' +
          '<p class="modal-kicker">' + t('nudge.disclosure.kicker') + '</p>' +
          '<h2 class="modal-title">' + t('nudge.disclosure.title') + '</h2>' +
          '<p class="modal-body">' + t('nudge.disclosure.body') + '</p>' +
          '<ul class="modal-feature-list">' +
            '<li>' + t('nudge.disclosure.point1') + '</li>' +
            '<li>' + t('nudge.disclosure.point2') + '</li>' +
            '<li>' + t('nudge.disclosure.point3') + '</li>' +
          '</ul>' +
          '<p class="modal-note">' + t('nudge.disclosure.off') + '</p>' +
          '<div class="modal-actions">' +
            '<button class="btn btn-ghost" id="btn-nudge-disclosure-cancel">' + t('btn.not_now') + '</button>' +
            '<button class="btn btn-primary" id="btn-nudge-disclosure-ok">' + t('nudge.disclosure.btn_continue') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    qs('#btn-nudge-disclosure-cancel').addEventListener('click', closeActiveModal);
    qs('#modal-backdrop').addEventListener('click', function(event) {
      if (event.target.id === 'modal-backdrop') closeActiveModal();
    });
    qs('#btn-nudge-disclosure-ok').addEventListener('click', function() {
      localStorage.setItem(KEY_DISCLOSED, 'true');
      closeActiveModal();
      if (typeof onAccept === 'function') onAccept();
    });
  }

  /* ─── Asking for permissions at the moment they mean something ──────── */

  /* Each grant is a trip to a system settings page, so asking for all three up
     front is the worst version of this — it is three interruptions before the
     feature has done anything (§9.4a). Instead each is requested when the
     choice that needs it is made: accessibility and overlay when the nudge is
     switched on at all, usage access only when the time-based trigger is turned
     on, because that is the only thing that needs it.
     Everything is skippable: "Later" leaves the controls in Settings. */
  async function promptMissingPermissions(opts) {
    const state = await permissionState();
    if (!state.available) return;
    const rows = [];
    if (!state.accessibility) {
      rows.push({ id: 'accessibility', open: openAccessibilitySettings,
                  label: t('settings.nudge.perm_accessibility'),
                  note: t('settings.nudge.perm_accessibility_note') });
    }
    if (!state.overlay) {
      rows.push({ id: 'overlay', open: openOverlaySettings,
                  label: t('settings.nudge.perm_overlay'),
                  note: t('settings.nudge.perm_overlay_note') });
    }
    if (opts && opts.usageAccess && !state.usageAccess) {
      rows.push({ id: 'usage', open: openUsageAccessSettings,
                  label: t('settings.nudge.perm_usage'),
                  note: t('settings.nudge.perm_usage_note') });
    }
    if (!rows.length) return;
    _showPermissionModal(rows);
  }

  /* One button per grant rather than a forced chain: the user can take them in
     any order, or none, and come back to whichever they skipped. */
  function _showPermissionModal(rows) {
    const root = qs('#modal-root');
    if (!root) return;
    closeActiveModal();
    AppState.activeModal = 'nudge-permissions';

    root.innerHTML =
      '<div class="modal-backdrop" id="modal-backdrop">' +
        '<div class="modal-card nudge-perm-card" role="dialog" aria-modal="true">' +
          '<h2 class="modal-title">' + t('nudge.perm_prompt.title') + '</h2>' +
          '<p class="modal-body">' + t('nudge.perm_prompt.body') + '</p>' +
          rows.map(function(r) {
            return '<div class="settings-row nudge-perm-row">' +
                '<span class="settings-row-label">' + r.label + '</span>' +
                '<button class="btn btn-ghost settings-inline-btn" data-grant="' + r.id + '">' +
                  t('settings.nudge.perm_grant') + '</button>' +
              '</div>' +
              '<p class="settings-copy text-muted nudge-perm-note">' + r.note + '</p>';
          }).join('') +
          '<div class="modal-actions">' +
            '<button class="btn btn-ghost" id="btn-nudge-perm-later">' +
              t('nudge.perm_prompt.btn_later') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    qs('#btn-nudge-perm-later').addEventListener('click', closeActiveModal);
    qs('#modal-backdrop').addEventListener('click', function(event) {
      if (event.target.id === 'modal-backdrop') closeActiveModal();
    });
    qsa('[data-grant]').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        const row = rows.filter(function(r) { return r.id === btn.getAttribute('data-grant'); })[0];
        if (!row) return;
        closeActiveModal();
        const opened = await row.open();
        if (!opened) showToast(t('settings.nudge.perm_no_screen'));
      });
    });
  }

  /* ─── Incoming nudge ───────────────────────────────────────────────── */

  /* Reads without clearing. Three paths pull the handoff — cold start, the hot
     flowreadNudge event, and every resume — so that none of them has to win a
     race. Clearing on read would put that race straight back. */
  async function _readPending() {
    const p = _plugin();
    if (!p) return null;
    const read = (typeof p.peekPendingNudge === 'function')
      ? p.peekPendingNudge()
      : (typeof p.consumePendingNudge === 'function' ? p.consumePendingNudge() : null);
    if (!read) return null;
    try {
      const res = await read;
      if (!res || !res.pending) return null;
      /* N19. The handoff is written before the activity start, and that start can
         be dropped (no SYSTEM_ALERT_WINDOW, or Android simply refusing a
         background launch). An undelivered handoff must not sit in prefs waiting
         to ambush the user the next time they open FlowRead for their own
         reasons — by then they have long since left the app it was about.
         MainActivity sets "delivered" only on a real ACTION_NUDGE arrival.

         Older builds of the plugin do not report the field at all; treating
         undefined as delivered keeps them working rather than silently killing
         every nudge. */
      if (res.delivered === false) { _clearPending(); return null; }
      const parsed = JSON.parse(res.pending);
      /* "package" is what builds before this fix wrote. Accepting both means an
         update does not strand a handoff written by the older service. */
      const pkg = parsed && (parsed.packageName || parsed.package);
      /* Unusable rather than absent: drop it, or it is re-read on every resume
         for the rest of the session. */
      if (!pkg) { _clearPending(); return null; }
      /* A stale handoff from a previous run would drop the user into a nudge for
         an app they are no longer in. Two minutes is comfortably longer than a
         cold boot (i18n, IAP, library) on a slow device and far too short to
         resurrect anything from an earlier session. */
      if (parsed.at && Date.now() - parsed.at > STALE_AFTER_MS) { _clearPending(); return null; }
      return {
        packageName: pkg,
        label: parsed.label || pkg,
        minutes: typeof parsed.minutes === 'number' ? parsed.minutes : -1,
        opens: typeof parsed.opens === 'number' ? parsed.opens : 0,
        everyOpen: !!parsed.everyOpen,
      };
    } catch (_) {
      _clearPending();
      return null;
    }
  }

  function _clearPending() {
    const p = _plugin();
    if (p && typeof p.clearPendingNudge === 'function') {
      p.clearPendingNudge().catch(function() {});
    }
  }

  /* Safe to call any number of times, from any path, in any order. Resolves
     true when a nudge was actually put on screen. */
  async function _handleIncoming() {
    if (_incomingInFlight) return false;
    _incomingInFlight = true;
    try {
      const pending = await _readPending();
      if (!pending) return false;
      /* Already showing this exact interception — do not re-render underneath
         the user. Checked after the read, not before: a genuinely new handoff
         for a different app must still win, and renderNudge() clears the
         handoff anyway, so a repeat read normally finds nothing. */
      if (AppState.currentView === 'view-nudge' && _pending
          && _pending.packageName === pending.packageName) return false;
      renderNudge(pending.packageName, pending.label, pending);
      return true;
    } finally {
      _incomingInFlight = false;
    }
  }

  /* ─── Outcomes ─────────────────────────────────────────────────────── */

  /* The escape hatch. Always available, never penalised (§9.1, §9.2 step 7). */
  async function continueToApp() {
    const ctx = _pending;
    if (!ctx) { _goHome(); return; }
    _pending = null;
    AppState.nudgeContext = null;
    logEvent('nudge_skipped');
    const p = _plugin();
    if (p && typeof p.launchApp === 'function') {
      try {
        /* "Every time I open it" means exactly that: skipping this one cannot
           buy ten minutes of silence, or the next open — the one the user asked
           to be nudged on — is swallowed. The daily cap still bounds it. */
        const everyOpen = hasTrigger(MODE_EVERY_OPEN);
        await p.launchApp({
          packageName: ctx.packageName,
          suppressMinutes: everyOpen
            ? EVERY_OPEN_SKIP_SUPPRESS_MINUTES : DISMISS_SUPPRESS_MINUTES,
          dismissed: !everyOpen,
        });
        /* N20. The nudge view is still what FlowRead is showing — we handed the
           user to another app, we did not navigate. Leave it up and the next
           manual return to FlowRead lands on a spent nudge screen the user has
           to back out of. Nothing re-rendered it; it simply never went away.
           Reset to home behind them so returning lands somewhere sensible. */
        _goHome();
        return;
      } catch (_) {}
    }
    /* Could not launch it — never strand the user on the nudge screen. */
    showToast(t('nudge.toast.could_not_open', { app: ctx.label }));
    _goHome();
  }

  /* Reading to the threshold unlocks ONLY the app that was asked for; every
     other target keeps its own independent counters (§9.7). */
  async function _unlockAndReturn() {
    const ctx = AppState.nudgeContext;
    if (!ctx) return;
    AppState.nudgeContext = null;
    logEvent('nudge_read_completed', { pages: settings().unlockPages });
    const p = _plugin();
    if (p && typeof p.launchApp === 'function') {
      try {
        await p.launchApp({
          packageName: ctx.packageName,
          suppressMinutes: UNLOCK_SUPPRESS_MINUTES,
          dismissed: false,
        });
        /* Deliberately NOT _goHome() here, unlike the escape path. The view left
           behind is the reader, not a spent nudge screen — the user was reading,
           and N2's rule is that someone returning to a book is exactly who must
           not be bounced out of it. */
        return;
      } catch (_) {}
    }
    showToast(t('nudge.toast.unlocked', { app: ctx.label }));
  }

  /* Called from page.js on every page turn while a nudged read is in progress.
     Page mode knows where its real page boundaries are, so when it is the engine
     in use this is the exact count; every other engine goes through
     onReadProgress below. */
  function onPageTurn(pageIndex) {
    const ctx = AppState.nudgeContext;
    if (!ctx || ctx.done) return;
    /* Anchor one page behind the first turn we see: that turn is itself a page
       read, so counting from pageIndex here would demand unlockPages + 1. */
    if (typeof ctx.startPage !== 'number') ctx.startPage = pageIndex - 1;
    const turned = pageIndex - ctx.startPage;
    if (turned < settings().unlockPages) return;
    ctx.done = true;
    _showUnlockPrompt(ctx);
  }

  /* Called from savePosition() — the one seam every engine already goes through
     — so a nudged read counts in RSVP, Chunk, Scroll and Focus Bold too, not
     only in Page mode. Without this, reading in any other engine could never
     reach the unlock and the user was left waiting for something that was never
     going to happen (§1.5).

     "Pages" is the unit the user set, so other engines convert: a Page-mode page
     on a phone runs roughly this many words. It is an approximation by nature —
     the point is that the effort asked for is the same size, not that the two
     paths agree to the word. */
  const WORDS_PER_PAGE = 220;

  function onReadProgress(wordIndex) {
    const ctx = AppState.nudgeContext;
    if (!ctx || ctx.done) return;
    if (typeof wordIndex !== 'number' || !isFinite(wordIndex)) return;
    if (typeof ctx.startWord !== 'number') { ctx.startWord = wordIndex; return; }
    /* Jumping backwards (a re-read, or the bridge) re-anchors rather than going
       negative and quietly stalling the counter. */
    if (wordIndex < ctx.startWord) { ctx.startWord = wordIndex; return; }
    if (wordIndex - ctx.startWord < settings().unlockPages * WORDS_PER_PAGE) return;
    ctx.done = true;
    _showUnlockPrompt(ctx);
  }

  /* Offer the return, never force it — a user enjoying the book should not be
     ejected back into the app they were trying to avoid. */
  function _showUnlockPrompt(ctx) {
    if (AppState.activeModal === 'nudge-unlock') return;
    const root = qs('#modal-root');
    if (!root) return;
    closeActiveModal();
    AppState.activeModal = 'nudge-unlock';

    root.innerHTML =
      '<div class="modal-backdrop" id="modal-backdrop">' +
        '<div class="modal-card nudge-unlock-card" role="dialog" aria-modal="true">' +
          '<h2 class="modal-title">' + t('nudge.unlock.title') + '</h2>' +
          '<p class="modal-body">' + t('nudge.unlock.body', { app: escapeHtml(ctx.label) }) + '</p>' +
          '<div class="modal-actions">' +
            '<button class="btn btn-ghost" id="btn-nudge-keep-reading">' + t('nudge.unlock.keep_reading') + '</button>' +
            '<button class="btn btn-primary" id="btn-nudge-go">' +
              t('nudge.unlock.go', { app: escapeHtml(ctx.label) }) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    qs('#btn-nudge-keep-reading').addEventListener('click', function() {
      closeActiveModal();
      /* They chose the book. Stop counting and stop asking for this read. */
      AppState.nudgeContext = null;
      const p = _plugin();
      if (p && typeof p.suppressApp === 'function') {
        p.suppressApp({
          packageName: ctx.packageName,
          minutes: UNLOCK_SUPPRESS_MINUTES,
          dismissed: false,
        }).catch(function() {});
      }
    });
    qs('#btn-nudge-go').addEventListener('click', function() {
      closeActiveModal();
      AppState.nudgeContext = ctx;
      _unlockAndReturn();
    });
  }

  /* ─── Start reading ────────────────────────────────────────────────── */

  /* Highest-percentage in-progress book, same rule notifications.js already
     uses to decide what to nudge about. */
  function _inProgressBook() {
    if (typeof loadLibrary !== 'function') return null;
    const lib = loadLibrary();
    let best = null;
    for (var i = 0; i < lib.length; i++) {
      const item = lib[i];
      if (!item || !item.wordCount) continue;
      const pos = loadPosition(item.id) || 0;
      const pct = Math.round((pos / item.wordCount) * 100);
      if (pct >= 5 && pct < 95) {
        if (!best || pct > best.pct) best = { item: item, pct: pct };
      }
    }
    /* Nothing part-read: fall back to anything unfinished at all rather than
       sending someone who has a library straight to Free Books. */
    if (!best) {
      for (var j = 0; j < lib.length; j++) {
        const it = lib[j];
        if (!it || !it.wordCount) continue;
        if ((loadPosition(it.id) || 0) < it.wordCount) return { item: it, pct: 0 };
      }
    }
    return best;
  }

  async function startReading() {
    const ctx = _pending;
    _pending = null;
    if (ctx) {
      AppState.nudgeContext = {
        packageName: ctx.packageName,
        label: ctx.label,
        startPage: null,
      };
    }
    logEvent('nudge_read_started');

    const book = _inProgressBook();
    if (book && typeof resumeFromLibrary === 'function') {
      /* §9.5 specifies Page mode here, on the reasoning that RSVP is too
         high-effort right after an interception. Temporarily overridden
         2026-09-21: Page mode's first paint is slow enough that the user is
         left staring at a loading state at exactly the moment the nudge is
         trying to be frictionless, which costs more than the engine choice
         gains. Landing in whatever engine they actually read in is the
         interim rule. Restore the §9.5 behaviour once Page-mode load time is
         addressed. */
      await resumeFromLibrary(book.item, 'nudge');
      return;
    }

    /* No book in progress — Free Books, never an empty import screen (§9.5). */
    if (typeof renderFreeBooks === 'function') {
      AppState.readerSource = 'nudge';
      renderFreeBooks();
      switchView('view-free-books');
      return;
    }
    _goHome();
  }

  /* Leaving a nudged read early. Not a dismissal — they did engage — so the
     dismissal streak is left alone and they simply land back home. */
  function leaveNudgedRead() {
    const ctx = AppState.nudgeContext;
    AppState.nudgeContext = null;
    if (ctx) {
      const p = _plugin();
      if (p && typeof p.suppressApp === 'function') {
        p.suppressApp({
          packageName: ctx.packageName,
          minutes: DISMISS_SUPPRESS_MINUTES,
          dismissed: false,
        }).catch(function() {});
      }
    }
    _goHome();
  }

  function _goHome() {
    if (typeof renderUpload === 'function') {
      renderUpload();
      switchView('view-upload');
    }
  }

  /* ─── Nudge screen ─────────────────────────────────────────────────── */

  /* The headline names what actually happened. "Read a bit before Reddit?" is
     abstract; "You've been on Reddit for 18 minutes" is the thing the user can
     check against their own sense of the last hour. The figures come from the
     handoff, so they are the ones the gate decided on rather than a second
     query giving a slightly different answer. */
  function _headline(label, meta) {
    const pages = settings().unlockPages;
    /* The interception happened at the moment of opening, so the question is
       about what comes next — naming how long they were in there earlier today
       is both irrelevant and faintly accusing. */
    if (meta && meta.everyOpen) {
      return t('nudge.screen.title_before', { app: label, pages: pages });
    }
    if (meta && meta.minutes >= 1) {
      return t('nudge.screen.title_minutes', { app: label, n: meta.minutes, pages: pages });
    }
    /* Usage access denied, or under a minute in: the open count is all we know,
       and saying so is better than inventing precision (§1.5). */
    if (meta && meta.opens >= 2) {
      return t('nudge.screen.title_opens', { app: label, n: meta.opens, pages: pages });
    }
    return t('nudge.screen.title', { app: label });
  }

  /* A rotating line under the headline. The headline states the fact; this is
     where the point of the feature gets made — that this is how a reading habit
     is built. Rotating so it does not become wallpaper.

     §9.1 governs every one of these: no guilt, no shame, no "you've already
     failed" framing, nothing that implies skipping costs the user something.
     Warm and a little wry is the register; scolding is not. */
  const SUBTITLE_COUNT = 6;

  function _subtitle() {
    const keys = [];
    for (var i = 1; i <= SUBTITLE_COUNT; i++) {
      const k = 'nudge.screen.sub.' + i;
      /* t() returns the key itself when it is missing, which is the only way to
         tell — so a short pool in one locale simply narrows the rotation rather
         than printing a raw key name. */
      if (t(k) !== k) keys.push(k);
    }
    if (!keys.length) return t('nudge.screen.subtitle');
    return t(keys[Math.floor(Math.random() * keys.length)]);
  }

  function renderNudge(packageName, label, meta) {
    const view = qs('#view-nudge');
    if (!view) return;
    _pending = {
      packageName: packageName,
      label: label || packageName,
      minutes: meta && typeof meta.minutes === 'number' ? meta.minutes : -1,
      opens: meta && typeof meta.opens === 'number' ? meta.opens : 0,
      everyOpen: !!(meta && meta.everyOpen),
    };
    logEvent('nudge_shown');

    const safeLabel = escapeHtml(_pending.label);

    /* Calm, not alarming (§16). No countdown, no streak-at-risk framing, no
       guilt copy — the escape hatch is a peer of the primary action, not a
       de-emphasised afterthought. */
    view.innerHTML =
      '<div class="nudge-screen">' +
        '<div class="nudge-body">' +
          '<p class="nudge-kicker">' + t('nudge.screen.kicker') + '</p>' +
          '<h1 class="nudge-title">' + _headline(safeLabel, _pending) + '</h1>' +
          '<p class="nudge-sub">' + _subtitle() + '</p>' +
        '</div>' +
        '<div class="nudge-actions">' +
          '<button class="btn btn-primary nudge-primary" id="btn-nudge-read">' +
            t('nudge.screen.btn_read') + '</button>' +
          '<button class="btn btn-ghost nudge-escape" id="btn-nudge-continue">' +
            t('nudge.screen.btn_continue', { app: safeLabel }) + '</button>' +
        '</div>' +
      '</div>';

    qs('#btn-nudge-read').addEventListener('click', startReading);
    qs('#btn-nudge-continue').addEventListener('click', continueToApp);

    switchView('view-nudge');
    /* Only now. Clearing any earlier means a path that fails part-way through
       has thrown the interception away with nothing to show for it. */
    _clearPending();
  }

  /* ─── Boot ─────────────────────────────────────────────────────────── */

  /* Called by app.js on every foreground transition, ahead of its own
     stale-view routing, so a nudge arriving on this resume always wins. */
  async function handleResume() {
    if (!isAvailable()) return false;

    /* A freshly delivered interception always wins. */
    if (await _handleIncoming()) return true;

    /* N21. Nothing new arrived, but a nudge screen is still what FlowRead is
       showing. That screen belongs to a moment that has passed: the user left it
       unanswered, went wherever they were going, and has now come back to
       FlowRead on their own terms. Putting it in front of them again is not a
       nudge, it is a queue — and it made the app look stuck, since backing out
       was the only way to reach home.

       The handoff was already cleared when the screen rendered, so this is the
       stale VIEW, not a repeat delivery. Reset it and let them land on home. */
    if (AppState.currentView === 'view-nudge') {
      _pending = null;
      _clearPending();
      _goHome();
      return true;
    }

    return false;
  }

  async function init() {
    if (!isAvailable()) return;
    _pushSettings();
    try { await NudgeAppsFeature.syncToNative(); } catch (_) {}

    /* Hot path: the service launched us while the WebView was already alive.
       This event can fire before init() runs — it is late in the boot sequence —
       which is why the resume pull in app.js exists as well. */
    window.addEventListener('flowreadNudge', function() { _handleIncoming(); });

    /* Cold path: the service wrote the handoff before this process existed. */
    await _handleIncoming();
  }

  /* ─── First-run setup prompt (N4) ──────────────────────────────────── */

  /* Deliberately one card, not a first-boot walk through three system settings
     screens — §9.4a made usage access optional to avoid exactly that friction.
     Whether the ask belongs in onboarding at all is Q3 / Task 16.3; that rebuild
     should absorb or replace this. */
  function shouldPromptSetup() {
    if (!isAvailable()) return false;
    if (localStorage.getItem(KEY_PROMPTED) === 'true') return false;
    if (typeof NudgeAppsFeature === 'undefined') return false;
    return NudgeAppsFeature.getTargets().length === 0;
  }

  function markPrompted() {
    localStorage.setItem(KEY_PROMPTED, 'true');
  }

  /* Reuses the Settings chain rather than growing a second permission flow. */
  function startSetup(onDone) {
    markPrompted();
    const afterDisclosure = function() {
      setEnabled(true);
      NudgeAppsFeature.openPicker(function() {
        promptMissingPermissions({ usageAccess: hasTrigger(MODE_THRESHOLD) });
      });
      if (typeof onDone === 'function') onDone();
    };
    if (!hasSeenDisclosure()) showDisclosure(afterDisclosure);
    else afterDisclosure();
  }

  return {
    init: init,
    isAvailable: isAvailable,
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    settings: settings,
    setSetting: setSetting,
    triggers: triggers,
    hasTrigger: hasTrigger,
    setTrigger: setTrigger,
    statusFor: statusFor,
    promptMissingPermissions: promptMissingPermissions,
    resetState: resetState,
    MODE_THRESHOLD: MODE_THRESHOLD,
    MODE_EVERY_OPEN: MODE_EVERY_OPEN,
    DEFAULTS: DEFAULTS,
    KEY_MIN_MINUTES: KEY_MIN_MINUTES,
    KEY_MIN_OPENS: KEY_MIN_OPENS,
    KEY_DAILY_CAP: KEY_DAILY_CAP,
    KEY_UNLOCK_PAGES: KEY_UNLOCK_PAGES,
    permissionState: permissionState,
    isFullyConfigured: isFullyConfigured,
    hasSeenDisclosure: hasSeenDisclosure,
    showDisclosure: showDisclosure,
    openAccessibilitySettings: openAccessibilitySettings,
    openOverlaySettings: openOverlaySettings,
    openUsageAccessSettings: openUsageAccessSettings,
    renderNudge: renderNudge,
    startReading: startReading,
    continueToApp: continueToApp,
    onPageTurn: onPageTurn,
    onReadProgress: onReadProgress,
    leaveNudgedRead: leaveNudgedRead,
    handleResume: handleResume,
    shouldPromptSetup: shouldPromptSetup,
    markPrompted: markPrompted,
    startSetup: startSetup,
  };
})();

/* Global, matching the render* convention used by every other view. */
function renderNudge(packageName, label, meta) {
  NudgeFeature.renderNudge(packageName, label, meta);
}
