/* Target-app selection for the nudge system (Claude.md §9.2 step 1).
 *
 * Owns the list of apps the user wants to be nudged about, the free-vs-subscriber
 * limit on how many, and the picker modal. Detection and triggering live in
 * nudge.js; this module only decides *which* apps are in scope.
 *
 * The selection is kept in localStorage — §21 names "nudge target-app list"
 * explicitly as one of the things localStorage is right for — and mirrored into
 * native prefs via setTargetApps so the accessibility service narrows its own
 * event filter to match.
 */

const NudgeAppsFeature = (function() {
  const KEY_APPS = 'fr_nudge_apps';
  /* §4: free = 1 app, paid = unlimited. Restored to 1 by Task 16.1 (2026-11-01),
     having been temporarily 2 since 2026-09-25 (Q12) only because no purchase
     could lift the gate — at a limit of 1 with nothing to buy, nobody could ever
     select a second app and §9.7's scoped unlock was unreachable. There is now
     something to buy, so §4's rule applies again. */
  const FREE_APP_LIMIT = 1;

  /* Icons are the expensive part of the native call, so the list is fetched
     once per app run and reused for every re-open of the picker. */
  let _cache = null;

  function _plugin() {
    return (typeof Capacitor !== 'undefined' &&
            Capacitor.Plugins &&
            Capacitor.Plugins.FlowReadNudge)
      ? Capacitor.Plugins.FlowReadNudge : null;
  }

  function isAvailable() { return !!_plugin(); }

  function getTargets() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY_APPS) || '[]');
      return Array.isArray(raw) ? raw.filter(function(x) { return typeof x === 'string' && x; }) : [];
    } catch (_) {
      return [];
    }
  }

  /* Either paid tier lifts the limit (§4: as of the 2026-10-30 pricing the
     lifetime purchase includes unlimited nudge apps too). `isPro` is the derived
     "has paid" gate that already answers both — gating on isSubscriber alone
     would refuse the feature to someone who had just paid ₹2,999 for it. */
  function appLimit() {
    return AppState.isPro ? Infinity : FREE_APP_LIMIT;
  }

  async function setTargets(packages) {
    const list = (packages || []).filter(Boolean);
    try { localStorage.setItem(KEY_APPS, JSON.stringify(list)); } catch (_) {}
    const p = _plugin();
    if (p && typeof p.setTargetApps === 'function') {
      try { await p.setTargetApps({ packages: list }); } catch (_) {}
    }
  }

  /* Labels are needed outside the picker (the nudge screen names the app), so
     keep the last known label for each selected package. */
  function labelFor(pkg) {
    try {
      const map = JSON.parse(localStorage.getItem('fr_nudge_app_labels') || '{}');
      if (map && map[pkg]) return map[pkg];
    } catch (_) {}
    return pkg;
  }

  function _rememberLabels(apps) {
    try {
      const map = {};
      const targets = getTargets();
      apps.forEach(function(a) {
        if (targets.indexOf(a.packageName) !== -1) map[a.packageName] = a.label;
      });
      localStorage.setItem('fr_nudge_app_labels', JSON.stringify(map));
    } catch (_) {}
  }

  async function listApps(force) {
    if (_cache && !force) return _cache;
    const p = _plugin();
    if (!p || typeof p.listLaunchableApps !== 'function') return [];
    try {
      const res = await p.listLaunchableApps();
      _cache = (res && res.apps) ? res.apps : [];
      return _cache;
    } catch (_) {
      return [];
    }
  }

  /* ─── Picker modal ─────────────────────────────────────────────────── */

  async function openPicker(onChange) {
    const root = qs('#modal-root');
    if (!root) return;

    closeActiveModal();
    AppState.activeModal = 'nudge-apps';

    root.innerHTML =
      '<div class="modal-backdrop" id="modal-backdrop">' +
        '<div class="modal-card nudge-apps-card" role="dialog" aria-modal="true">' +
          '<h2 class="modal-title">' + t('nudge.picker.title') + '</h2>' +
          '<p class="modal-body">' + t('nudge.picker.subtitle') + '</p>' +
          '<input type="search" id="nudge-app-search" class="nudge-app-search" ' +
            'placeholder="' + t('nudge.picker.search') + '" aria-label="' + t('nudge.picker.search') + '">' +
          '<div class="nudge-app-list" id="nudge-app-list">' +
            '<p class="modal-note">' + t('nudge.picker.loading') + '</p>' +
          '</div>' +
          '<div class="modal-actions">' +
            '<button class="btn btn-primary" id="btn-nudge-apps-done">' + t('btn.done') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    qs('#btn-nudge-apps-done').addEventListener('click', closeActiveModal);
    qs('#modal-backdrop').addEventListener('click', function(event) {
      if (event.target.id === 'modal-backdrop') closeActiveModal();
    });

    const apps = await listApps(false);
    const listEl = qs('#nudge-app-list');
    if (!listEl) return; /* modal closed while we were loading */

    if (!apps.length) {
      listEl.innerHTML = '<p class="modal-note">' + t('nudge.picker.none') + '</p>';
      return;
    }

    function render(filter) {
      const targets = getTargets();
      const needle = (filter || '').trim().toLowerCase();
      /* Selected apps first so the user can always see and undo their choice,
         even when a search filter would otherwise hide it. */
      const shown = apps.filter(function(a) {
        return !needle || a.label.toLowerCase().indexOf(needle) !== -1;
      }).sort(function(a, b) {
        const sa = targets.indexOf(a.packageName) !== -1 ? 0 : 1;
        const sb = targets.indexOf(b.packageName) !== -1 ? 0 : 1;
        return sa !== sb ? sa - sb : 0;
      });

      if (!shown.length) {
        listEl.innerHTML = '<p class="modal-note">' + t('nudge.picker.no_match') + '</p>';
        return;
      }

      listEl.innerHTML = shown.map(function(a) {
        const on = targets.indexOf(a.packageName) !== -1;
        const icon = a.icon
          ? '<img class="nudge-app-icon" src="' + escapeHtml(a.icon) + '" alt="">'
          : '<span class="nudge-app-icon nudge-app-icon-fallback">' +
              escapeHtml((a.label || '?').charAt(0).toUpperCase()) + '</span>';
        return '<button class="nudge-app-row' + (on ? ' selected' : '') + '" ' +
          'data-pkg="' + escapeHtml(a.packageName) + '" ' +
          'role="checkbox" aria-checked="' + (on ? 'true' : 'false') + '">' +
          icon +
          '<span class="nudge-app-label">' + escapeHtml(a.label) + '</span>' +
          '<span class="nudge-app-check">' + (on ? '✓' : '') + '</span>' +
        '</button>';
      }).join('');

      qsa('.nudge-app-row', listEl).forEach(function(row) {
        row.addEventListener('click', async function() {
          const pkg = row.getAttribute('data-pkg');
          const current = getTargets();
          const idx = current.indexOf(pkg);

          if (idx !== -1) {
            current.splice(idx, 1);
          } else {
            /* §4: free tier gets one app, either paid tier gets unlimited.

               N17 said do NOT open a paywall here, because the gate was on
               isSubscriber and nothing on sale could lift it — offering Lifetime
               Pro sold the user something that left them against the same wall,
               the H4 class of defect (§1.5). Task 16.1 removes that reason: both
               paid tiers now include unlimited apps, so the paywall is an honest
               answer to this gate and appLimit() checks the same two flags the
               purchase sets. Reinstated 2026-11-01.

               The paywall replaces the picker rather than stacking on it — never
               more than one modal at a time (§21). */
            if (current.length >= appLimit()) {
              /* The number comes from the constant, not the copy, so the two
                 cannot drift if the limit changes again. */
              const lim = appLimit();
              showToast(t(lim === 1 ? 'nudge.toast.free_limit.one'
                                    : 'nudge.toast.free_limit', { n: lim }));
              if (typeof showProPaywall === 'function') {
                closeActiveModal();
                showProPaywall('nudge-apps');
              }
              return;
            }
            current.push(pkg);
          }

          await setTargets(current);
          _rememberLabels(apps);
          render(qs('#nudge-app-search') ? qs('#nudge-app-search').value : '');
          if (typeof onChange === 'function') onChange(getTargets());
        });
      });
    }

    render('');
    const search = qs('#nudge-app-search');
    if (search) {
      /* `input` alone is not enough here. Android WebView does not fire it
         reliably while an IME is composing, and Samsung Keyboard composes on
         every predictive-text keystroke — so a typed query would sit in the box
         with the list never filtering. Listening broadly and re-rendering from
         the field's current value covers every path; the renders are cheap and
         idempotent, so the overlap costs nothing. */
      let last = '';
      const onType = function() {
        if (search.value === last) return;
        last = search.value;
        render(last);
      };
      ['input', 'keyup', 'change', 'search', 'compositionend'].forEach(function(evt) {
        search.addEventListener(evt, onType);
      });
    }
  }

  /* Keeps native prefs in step with localStorage — they can drift if the app
     data is restored from a backup, or if 16.1 later downgrades a lapsed
     subscriber back to the one-app limit. */
  /* Truncation is not silent (§1.5). Lowering FREE_APP_LIMIT from 2 back to 1
     (Task 16.1) takes an app away from existing free users who had picked two,
     and a nudge that simply stops arriving for an app still listed in Settings
     reads as the feature being broken. Said once, naming the app, and only to
     someone it actually happened to — the flag is keyed to the dropped packages
     so it cannot re-fire every launch, and re-fires if a *different* app is
     later dropped. */
  const KEY_TRIM_NOTICE = 'fr_nudge_apps_trimmed_notice';

  async function syncToNative() {
    const targets = getTargets();
    const limit = appLimit();

    if (targets.length > limit) {
      const kept    = targets.slice(0, limit);
      const dropped = targets.slice(limit);
      await setTargets(kept);
      _noticeTrimmed(dropped);
      return;
    }

    await setTargets(targets);
    try { localStorage.removeItem(KEY_TRIM_NOTICE); } catch (_) {}
  }

  function _noticeTrimmed(dropped) {
    const stamp = dropped.join(',');
    try {
      if (localStorage.getItem(KEY_TRIM_NOTICE) === stamp) return;
      localStorage.setItem(KEY_TRIM_NOTICE, stamp);
    } catch (_) {}

    const labels = dropped.map(labelFor).join(', ');
    /* Deferred so it does not land underneath the boot render, or on top of a
       nudge arriving in the same breath — that screen is the one the user is
       actually there for. */
    setTimeout(function() {
      if (typeof showToast === 'function') {
        showToast(t('nudge.toast.apps_trimmed', { apps: labels }));
      }
    }, 2500);
  }

  return {
    isAvailable: isAvailable,
    getTargets: getTargets,
    setTargets: setTargets,
    labelFor: labelFor,
    listApps: listApps,
    openPicker: openPicker,
    syncToNative: syncToNative,
    appLimit: appLimit,
    FREE_APP_LIMIT: FREE_APP_LIMIT,
  };
})();
