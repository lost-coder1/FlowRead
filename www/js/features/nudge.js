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
  const UNLOCK_SUPPRESS_MINUTES = 60;

  let _pending = null;   /* { packageName, label } awaiting a nudge screen */

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

  /* ─── Incoming nudge ───────────────────────────────────────────────── */

  async function _readPending() {
    const p = _plugin();
    if (!p || typeof p.consumePendingNudge !== 'function') return null;
    try {
      const res = await p.consumePendingNudge();
      if (!res || !res.pending) return null;
      const parsed = JSON.parse(res.pending);
      if (!parsed || !parsed.packageName) return null;
      /* A stale handoff from a previous run would drop the user into a nudge
         for an app they are no longer in. Anything older than a minute is junk. */
      if (parsed.at && Date.now() - parsed.at > 60000) return null;
      return { packageName: parsed.packageName, label: parsed.label || parsed.packageName };
    } catch (_) {
      return null;
    }
  }

  async function _handleIncoming() {
    const pending = await _readPending();
    if (!pending) return;
    _pending = pending;
    renderNudge(pending.packageName, pending.label);
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
        await p.launchApp({
          packageName: ctx.packageName,
          suppressMinutes: DISMISS_SUPPRESS_MINUTES,
          dismissed: true,
        });
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
        return;
      } catch (_) {}
    }
    showToast(t('nudge.toast.unlocked', { app: ctx.label }));
  }

  /* Called from page.js on every page turn while a nudged read is in progress. */
  function onPageTurn(pageIndex) {
    const ctx = AppState.nudgeContext;
    if (!ctx) return;
    /* Anchor one page behind the first turn we see: that turn is itself a page
       read, so counting from pageIndex here would demand unlockPages + 1. */
    if (typeof ctx.startPage !== 'number') ctx.startPage = pageIndex - 1;
    const turned = pageIndex - ctx.startPage;
    if (turned < settings().unlockPages) return;
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
      /* §9.5: land in Page mode, without overwriting the user's own default. */
      await resumeFromLibrary(book.item, 'nudge', { forceEngine: 'page' });
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

  function renderNudge(packageName, label) {
    const view = qs('#view-nudge');
    if (!view) return;
    _pending = { packageName: packageName, label: label || packageName };
    logEvent('nudge_shown');

    const safeLabel = escapeHtml(_pending.label);

    /* Calm, not alarming (§16). No countdown, no streak-at-risk framing, no
       guilt copy — the escape hatch is a peer of the primary action, not a
       de-emphasised afterthought. */
    view.innerHTML =
      '<div class="nudge-screen">' +
        '<div class="nudge-body">' +
          '<p class="nudge-kicker">' + t('nudge.screen.kicker') + '</p>' +
          '<h1 class="nudge-title">' + t('nudge.screen.title', { app: safeLabel }) + '</h1>' +
          '<p class="nudge-sub">' + t('nudge.screen.subtitle') + '</p>' +
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
  }

  /* ─── Boot ─────────────────────────────────────────────────────────── */

  async function init() {
    if (!isAvailable()) return;
    _pushSettings();
    try { await NudgeAppsFeature.syncToNative(); } catch (_) {}

    /* Hot path: the service launched us while the WebView was already alive. */
    window.addEventListener('flowreadNudge', function() { _handleIncoming(); });

    /* Cold path: the service wrote the handoff before this process existed. */
    await _handleIncoming();
  }

  return {
    init: init,
    isAvailable: isAvailable,
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    settings: settings,
    setSetting: setSetting,
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
    leaveNudgedRead: leaveNudgedRead,
  };
})();

/* Global, matching the render* convention used by every other view. */
function renderNudge(packageName, label) { NudgeFeature.renderNudge(packageName, label); }
