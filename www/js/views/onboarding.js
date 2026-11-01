/* First-run onboarding — Task 16.3, Claude.md §10.
 *
 * Replaces the pre-pivot flow (speed-reading pitch → formats/engines list →
 * limitations wall → RSVP calibration), all four screens of which were built
 * under the identity §0.1 left behind.
 *
 * Four screens, or three when the nudge is skipped or unavailable. Each one has
 * a job and none is a catalogue of features:
 *
 *   intro        what the app is for, plus the language choice
 *   nudge        the mechanic in plain language, then one app to start with
 *   permissions  the grants that mechanic needs (only if an app was chosen)
 *   ready        the daily reminder, then straight into something to read
 *
 * Three deliberate omissions, each reversing something the old flow did:
 *
 *  - No WPM calibration. It tuned RSVP specifically, which a habit-first user
 *    may never open, and asked for a judgement before the user had read a word
 *    to base it on. `defaultWpm` stays at its default and the reader teaches it,
 *    where trying a speed costs one tap and means something.
 *  - No tour of the five engines. §10.1 keeps them but de-emphasised; a list of
 *    modes before the first read is a catalogue, not an onboarding.
 *  - No limitations wall. §1.5 is not weakened — the limitations moved to the
 *    Settings accordion (linked from the last screen) and to the error modals
 *    that already explain scanned PDFs and legacy encodings at the moment they
 *    bite. A caveat read when it is relevant is read; a wall of them on screen
 *    three of four is not.
 *
 * The permission ask is INLINE here rather than deferred to first use
 * (§10.2, owner decision 2026-11-01). That is the higher-conversion and
 * higher-friction choice, so two things are load-bearing: the ask comes *after*
 * the user has named an app, so it can say "to notice when you open Instagram"
 * instead of something abstract; and every route past it is skippable without
 * dead-ending, because a refusal here must not cost the user the rest of the app.
 */

const OnboardingFlow = (function() {

  /* The chosen app is read back from NudgeAppsFeature rather than held here, so
     the picker modal stays the single source of truth for what is selected. */
  function _chosenApp() {
    if (typeof NudgeAppsFeature === 'undefined') return null;
    const targets = NudgeAppsFeature.getTargets();
    return targets.length ? targets[0] : null;
  }

  function _nudgeAvailable() {
    return typeof NudgeFeature !== 'undefined' &&
           typeof NudgeAppsFeature !== 'undefined' &&
           NudgeAppsFeature.isAvailable();
  }

  /* Recomputed on every render instead of being a fixed list, because choosing
     or clearing an app changes how many screens there are. Index-based
     navigation then stays correct in both directions without the caller
     tracking which screens are live. */
  function _sequence() {
    const steps = ['intro'];
    if (_nudgeAvailable()) {
      steps.push('nudge');
      if (_chosenApp()) steps.push('permissions');
    }
    steps.push('ready');
    return steps;
  }

  function _view() { return qs('#view-onboarding'); }

  /* ─── Screens ─────────────────────────────────────────────────────────── */

  function _intro() {
    const lang = (typeof FlowReadI18n !== 'undefined') ? FlowReadI18n.currentLang() : 'en';
    /* An explicit language choice on the first screen, not only locale
       detection. `en-IN` is a very common device locale among Hindi speakers,
       so detection alone silently puts a large part of the India audience into
       English and never offers them anything else (§17). */
    return `
      <div class="onboarding-screen">
        <div class="onboarding-card">
          <p class="onboarding-kicker">${escapeHtml(t('onboarding.intro.kicker'))}</p>
          <h1 class="onboarding-title">${escapeHtml(t('onboarding.intro.title'))}</h1>
          <p class="onboarding-body">${escapeHtml(t('onboarding.intro.body'))}</p>
          <p class="onboarding-note">${escapeHtml(t('onboarding.intro.privacy'))}</p>
          <div class="onboarding-lang" role="radiogroup"
               aria-label="${escapeHtml(t('onboarding.lang.label'))}">
            <button class="onboarding-lang-btn${lang === 'en' ? ' onboarding-lang-on' : ''}"
                    data-lang="en" role="radio" aria-checked="${lang === 'en'}">English</button>
            <button class="onboarding-lang-btn${lang === 'hi' ? ' onboarding-lang-on' : ''}"
                    data-lang="hi" role="radio" aria-checked="${lang === 'hi'}">हिंदी</button>
          </div>
          <div class="onboarding-actions">
            <button class="btn btn-primary" id="btn-onb-next">${escapeHtml(t('btn.continue'))}</button>
          </div>
        </div>
      </div>`;
  }

  function _nudge() {
    const pkg = _chosenApp();
    const label = pkg ? NudgeAppsFeature.labelFor(pkg) : '';

    /* The escape hatch is stated here, in the explanation, not discovered later
       on the nudge screen itself. §9.1's promise is worth more as the first
       thing a stranger hears about the mechanic than as a reassurance offered
       after they already feel interrupted. */
    const chosen = pkg
      ? `<div class="onboarding-chosen">
           <span class="onboarding-chosen-label">${escapeHtml(t('onboarding.nudge.chosen', { app: label }))}</span>
           <button class="btn btn-ghost settings-inline-btn" id="btn-onb-pick">${escapeHtml(t('onboarding.nudge.change_btn'))}</button>
         </div>`
      : `<div class="onboarding-actions-inline">
           <button class="btn btn-ghost" id="btn-onb-pick">${escapeHtml(t('onboarding.nudge.pick_btn'))}</button>
         </div>`;

    return `
      <div class="onboarding-screen">
        <div class="onboarding-card">
          <p class="onboarding-kicker">${escapeHtml(t('onboarding.nudge.kicker'))}</p>
          <h1 class="onboarding-title">${escapeHtml(t('onboarding.nudge.title'))}</h1>
          <p class="onboarding-body">${escapeHtml(t('onboarding.nudge.body'))}</p>
          <p class="onboarding-note">${escapeHtml(t('onboarding.nudge.body2'))}</p>
          <p class="onboarding-pick-label">${escapeHtml(t('onboarding.nudge.pick_label'))}</p>
          ${chosen}
          <div class="onboarding-actions">
            <button class="btn btn-ghost" id="btn-onb-back">${escapeHtml(t('btn.back'))}</button>
            <button class="btn ${pkg ? 'btn-primary' : 'btn-ghost'}" id="btn-onb-next">${
              escapeHtml(pkg ? t('btn.continue') : t('onboarding.btn.skip'))}</button>
          </div>
        </div>
      </div>`;
  }

  /* Rendered from live permission state, so returning from the system settings
     screen shows what actually happened rather than what we hoped. The rows
     call the same NudgeFeature entry points Settings uses — in particular
     openAccessibilitySettings(), which carries N29's prominent-disclosure
     guarantee at the choke point. Onboarding deliberately does NOT restate the
     disclosure: one copy of it, in one place, is the whole point of N29. */
  function _permissions(state) {
    const pkg = _chosenApp();
    const label = pkg ? NudgeAppsFeature.labelFor(pkg) : '';
    const rows = [
      { id: 'accessibility', granted: state.accessibility,
        label: t('settings.nudge.perm_accessibility'),
        note:  t('settings.nudge.perm_accessibility_note') },
      { id: 'overlay', granted: state.overlay,
        label: t('settings.nudge.perm_overlay'),
        note:  t('settings.nudge.perm_overlay_note') },
    ];
    const allGranted = rows.every(function(r) { return r.granted; });

    return `
      <div class="onboarding-screen">
        <div class="onboarding-card">
          <p class="onboarding-kicker">${escapeHtml(t('onboarding.perm.kicker'))}</p>
          <h1 class="onboarding-title">${escapeHtml(t('onboarding.perm.title', { app: label }))}</h1>
          <p class="onboarding-body">${escapeHtml(t('onboarding.perm.body'))}</p>
          <div class="onboarding-perms">
            ${rows.map(function(r) {
              /* Same markup as nudge.js's permission modal, deliberately — the
                 two surfaces should look like one feature, and the note sits as
                 a sibling paragraph there rather than inside the label. */
              return `<div class="settings-row nudge-perm-row">
                  <span class="settings-row-label">${escapeHtml(r.label)}</span>
                  ${r.granted
                    ? `<span class="onboarding-perm-on">${escapeHtml(t('settings.nudge.perm_on'))}</span>`
                    : `<button class="btn btn-ghost settings-inline-btn" data-grant="${r.id}">${
                        escapeHtml(t('settings.nudge.perm_grant'))}</button>`}
                </div>
                <p class="settings-copy text-muted nudge-perm-note">${escapeHtml(r.note)}</p>`;
            }).join('')}
          </div>
          ${allGranted ? `<p class="onboarding-note">${escapeHtml(t('onboarding.perm.granted'))}</p>` : ''}
          <div class="onboarding-actions">
            <button class="btn btn-ghost" id="btn-onb-back">${escapeHtml(t('btn.back'))}</button>
            <button class="btn ${allGranted ? 'btn-primary' : 'btn-ghost'}" id="btn-onb-next">${
              escapeHtml(allGranted ? t('btn.continue') : t('onboarding.btn.not_now'))}</button>
          </div>
        </div>
      </div>`;
  }

  /* No reminder toggle here. `fr_reminder_enabled` is already opt-out, so asking
     the user to confirm something that is on by default is a decision without a
     consequence — and the thing they actually have to answer is Android's own
     permission dialog, which _finish() asks for. Owner decision 2026-11-02; the
     reminder *time* lives in Settings, which is being reworked separately. */
  function _ready() {
    return `
      <div class="onboarding-screen">
        <div class="onboarding-card">
          <p class="onboarding-kicker">${escapeHtml(t('onboarding.ready.kicker'))}</p>
          <h1 class="onboarding-title">${escapeHtml(t('onboarding.ready.title'))}</h1>
          <p class="onboarding-body">${escapeHtml(t('onboarding.ready.body'))}</p>
          <div class="onboarding-actions">
            <button class="btn btn-ghost" id="btn-onb-back">${escapeHtml(t('btn.back'))}</button>
            <button class="btn btn-primary" id="btn-onb-finish">${escapeHtml(t('onboarding.btn.browse'))}</button>
          </div>
          <button class="btn btn-link onboarding-limitations-link" id="btn-onb-limitations">${
            escapeHtml(t('onboarding.ready.limitations'))}</button>
        </div>
      </div>`;
  }

  /* ─── Render and navigation ───────────────────────────────────────────── */

  let _step = 0;

  async function render(step) {
    const view = _view();
    if (!view) return;

    const seq = _sequence();
    _step = Math.max(0, Math.min(step || 0, seq.length - 1));
    const name = seq[_step];

    let html;
    if (name === 'intro')       html = _intro();
    else if (name === 'nudge')  html = _nudge();
    else if (name === 'ready')  html = _ready();
    else {
      /* Permission state is a native round-trip, so the screen is drawn from a
         pessimistic default first if it throws — never left blank (§1.5). */
      let state = { accessibility: false, overlay: false };
      try { state = await NudgeFeature.permissionState(); } catch (_) {}
      html = _permissions(state);
    }

    view.innerHTML = html;
    switchView('view-onboarding');
    _bind(name);
  }

  function _bind(name) {
    const next   = qs('#btn-onb-next');
    const back   = qs('#btn-onb-back');
    const finish = qs('#btn-onb-finish');

    if (next)   next.addEventListener('click', function() { render(_step + 1); });
    if (back)   back.addEventListener('click', function() { render(_step - 1); });
    if (finish) finish.addEventListener('click', _finish);

    if (name === 'intro') {
      qsa('.onboarding-lang-btn', _view()).forEach(function(btn) {
        btn.addEventListener('click', async function() {
          const lang = btn.getAttribute('data-lang');
          if (!lang || lang === FlowReadI18n.currentLang()) return;
          localStorage.setItem('fr_app_language', lang);
          await FlowReadI18n.loadLanguage(lang);
          /* Redraw in the new language immediately — a language choice that only
             takes effect on the next screen reads as not having worked. */
          render(_step);
        });
      });
    }

    if (name === 'nudge') {
      const pick = qs('#btn-onb-pick');
      if (pick) {
        pick.addEventListener('click', function() {
          /* The existing picker modal, not a second inline list: it already
             carries search with the IME handling Samsung Keyboard needs, the
             free-tier limit, and the label cache the nudge screen reads from. */
          NudgeAppsFeature.openPicker(function() {
            closeActiveModal();
            render(_step);
          });
        });
      }
    }

    if (name === 'permissions') {
      qsa('[data-grant]', _view()).forEach(function(btn) {
        btn.addEventListener('click', async function() {
          const id = btn.getAttribute('data-grant');
          btn.disabled = true;
          try {
            if (id === 'accessibility') await NudgeFeature.openAccessibilitySettings();
            else                        await NudgeFeature.openOverlaySettings();
          } catch (_) {}
          /* Backing out of the disclosure or the settings screen resolves false
             and lands here, so re-rendering is what reflects either outcome. */
          render(_step);
        });
      });
    }

    if (name === 'ready') {
      const lim = qs('#btn-onb-limitations');
      if (lim) {
        lim.addEventListener('click', function() {
          /* The limitations did not disappear, they moved (§1.5). Finish first
             so the user is not dropped back into onboarding afterwards. */
          _complete();
          renderSettings();
          switchView('view-settings');
          const toggle = qs('#btn-limitations-toggle');
          if (toggle) {
            toggle.click();
            toggle.scrollIntoView({ block: 'center' });
          }
        });
      }
    }
  }

  /* ─── Finishing ───────────────────────────────────────────────────────── */

  function _complete() {
    saveOnboardingComplete();
    if (typeof logEvent === 'function') logEvent('onboarding_completed');

    /* Grant rate is the only way to judge the inline-vs-deferred decision
       (§10.2), and it cannot be read from `onboarding_completed` alone. Emitted
       from the stored permission state rather than from whether a button was
       pressed, so a grant made by wandering into Settings mid-onboarding counts
       the same as one made here. */
    if (_nudgeAvailable() && typeof logEvent === 'function') {
      NudgeFeature.permissionState().then(function(state) {
        if (state && state.accessibility && state.overlay) {
          logEvent('nudge_permission_granted');
        }
      }).catch(function() {});
    }
  }

  /* Asks for the notification permission and records honestly whether it was
     granted — but NOTHING here is awaited by the handoff.
     
     The first build of this screen awaited it, and on device that stalled
     "Browse books" outright: the plugin promise never settled, so the await
     never returned and the view never switched. There was no error to show
     either, because a promise that never settles is not a rejection — the
     global boundary in app.js had nothing to catch. Finishing onboarding has no
     business depending on the notification subsystem being healthy, so it no
     longer does. */
  function _requestReminderPermission() {
    if (typeof NotificationsFeature === 'undefined') return;
    let settled = false;
    try {
      NotificationsFeature.requestPermission().then(function(granted) {
        settled = true;
        /* §1.5: if the user declines, the stored setting is corrected rather
           than left claiming reminders are on. */
        if (!granted) { localStorage.setItem('fr_reminder_enabled', 'false'); return; }
        localStorage.setItem('fr_reminder_enabled', 'true');
        return NotificationsFeature.reschedule();
      }).catch(function(err) {
        settled = true;
        console.warn('[onboarding] notification permission failed:', err);
      });
    } catch (err) {
      console.warn('[onboarding] notification permission threw:', err);
      return;
    }
    /* A plugin that never answers is not a reason to claim reminders are armed.
       Said only to the log — the user is reading by now and a toast about a
       subsystem they did not ask about would be noise. */
    setTimeout(function() {
      if (!settled) console.warn('[onboarding] notification permission never settled');
    }, 10000);
  }

  function _finish() {
    _requestReminderPermission();
    _complete();
    _handoff();
  }

  /* Ends one tap from reading rather than on an empty import screen (§10.1).
     The view is switched BEFORE rendering, so a catalogue that fails to draw
     still leaves the user somewhere they can act rather than stranded on a
     finished onboarding screen with a dead button. */
  function _handoff() {
    try {
      if (typeof renderFreeBooks === 'function') {
        switchView('view-free-books');
        renderFreeBooks();
        return;
      }
    } catch (err) {
      console.warn('[onboarding] free books handoff failed:', err);
    }
    try {
      renderUpload();
      switchView('view-upload');
    } catch (err) {
      console.warn('[onboarding] upload handoff failed:', err);
    }
  }

  /* Returning from a system settings screen is the only way the permission step
     can change, and it always arrives as a visibility change. Registered once,
     and a no-op unless that exact screen is on display. */
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) return;
    if (AppState.currentView !== 'view-onboarding') return;
    if (_sequence()[_step] !== 'permissions') return;
    render(_step);
  });

  return { render: render };
})();

/* app.js routes first-run here by this name. */
function renderOnboarding(step) {
  OnboardingFlow.render(step || 0);
}
