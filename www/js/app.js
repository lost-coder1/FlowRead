/* App entry point — runs after all scripts are loaded */

/* Disable pdf.js web worker — web workers with local file:// paths are unreliable
   in Capacitor's Android WebView. Running on main thread is slightly slower but
   fully compatible. For large PDFs the loading indicator keeps UX acceptable. */
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';
}

/* Shows a persistent error card with a Go Home button — used for unrecoverable failures */
function showErrorCard(message) {
  const existing = document.getElementById('error-card-overlay');
  if (existing) existing.remove();

  document.querySelectorAll('.view').forEach(function(v) { v.classList.add('hidden'); });

  const overlay = document.createElement('div');
  overlay.id = 'error-card-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:var(--bg);z-index:9999;padding:24px;';
  overlay.innerHTML = [
    '<div style="max-width:360px;width:100%;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:24px;text-align:center;">',
    '<p style="font-family:var(--font-display);font-size:20px;color:var(--text);margin:0 0 12px;">' + t('error_card.title') + '</p>',
    '<p style="font-family:var(--font-body);font-size:15px;color:var(--text-muted);margin:0 0 24px;line-height:1.5;">' + (message || t('error_card.default_msg')) + '</p>',
    '<button id="error-card-home-btn" style="font-family:var(--font-mono);font-size:13px;padding:10px 24px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;color:var(--text);cursor:pointer;">' + t('error_card.btn.go_home') + '</button>',
    '</div>',
  ].join('');
  document.body.appendChild(overlay);

  document.getElementById('error-card-home-btn').addEventListener('click', function() {
    overlay.remove();
    try { renderUpload(); switchView('view-upload'); } catch (_) { location.reload(); }
  });
}

/* Global error boundaries */
window.onerror = function(msg, src, line, col, err) {
  console.error('Global error:', msg, err);
  showErrorCard(t('global_error.generic'));
};

window.addEventListener('unhandledrejection', function(e) {
  console.error('Unhandled rejection:', e.reason);
  showErrorCard(t('global_error.generic'));
  e.preventDefault();
});

/* Boot sequence */
document.addEventListener('DOMContentLoaded', async function() {
  await FlowReadI18n.init();

  /* Update the static loading overlay text that was rendered before i18n loaded */
  const loadingMsg = document.getElementById('loading-message');
  if (loadingMsg) loadingMsg.textContent = t('loading.default');

  const settings = typeof getSettings === 'function' ? getSettings() : {};
  AppState.settings = settings;
  AppState.wpm = settings.defaultWpm || loadWPM();
  AppState.currentEngine = localStorage.getItem('fr_last_engine') || settings.defaultMode || 'rsvp';
  AppState.lastReaderEngine = AppState.currentEngine;

  try {
    if (typeof initIAP === 'function') {
      initIAP().catch(function() {});
    }
    if (typeof hasProAccess === 'function') {
      await hasProAccess();
    } else {
      AppState.isPro = false;
    }
  } catch (_) {
    AppState.isPro = false;
  }

  if (typeof applyTheme === 'function') {
    applyTheme(settings.theme);
  }

  if (typeof applyTypography === 'function') {
    applyTypography(settings.fontPreset);
  }

  if (localStorage.getItem('fr_orp_enabled') === null) localStorage.setItem('fr_orp_enabled', settings.orpDefault ? 'true' : 'false');
  if (localStorage.getItem('fr_context_enabled') === null) localStorage.setItem('fr_context_enabled', settings.contextDefault ? 'true' : 'false');
  if (localStorage.getItem('fr_calm_mode') === null) localStorage.setItem('fr_calm_mode', settings.calmModeDefault ? 'true' : 'false');

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && AppState.activeModal) closeActiveModal();
  });

  try {
    if (loadOnboardingComplete()) {
      renderUpload();
      switchView('view-upload');
    } else {
      renderOnboarding(0);
    }
  } catch (err) {
    console.error('Boot error:', err);
    showErrorCard(t('global_error.boot_failed'));
    return;
  }

  if (typeof initShareHandler === 'function') initShareHandler();
  if (typeof NotificationsFeature !== 'undefined') NotificationsFeature.init();

  /* Android hardware/gesture back button */
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    window.Capacitor.Plugins.App.addListener('backButton', function() {
      /* 1. Close any open modal first */
      if (AppState.activeModal) { closeActiveModal(); return; }

      const view = AppState.currentView;

      /* 2. Inside reader — if Calm mode is on, back deactivates it first
            (like exiting fullscreen before exiting the view). Second press
            then exits the reader normally. */
      if (view === 'view-reader') {
        if (localStorage.getItem('fr_calm_mode') === 'true') {
          localStorage.setItem('fr_calm_mode', 'false');
          const readerEl = document.getElementById('view-reader');
          if (readerEl) readerEl.classList.remove('reader-calm');
          const calmBtn = document.getElementById('btn-reader-calm');
          if (calmBtn) calmBtn.classList.remove('active');
          return;
        }
        const backBtn = document.getElementById('btn-reader-back');
        if (backBtn) { backBtn.click(); return; }
      }

      /* 3. Normal PDF viewer — go back to reader */
      if (view === 'view-normal') {
        const backBtn = document.getElementById('btn-normal-back');
        if (backBtn) { backBtn.click(); return; }
      }

      /* 4. Settings or Dashboard — return to home */
      if (view === 'view-settings' || view === 'view-dashboard') {
        renderUpload();
        switchView('view-upload');
        return;
      }

      /* 5. Home screen — minimize the app (standard Android behaviour) */
      if (view === 'view-upload') {
        window.Capacitor.Plugins.App.minimizeApp();
        return;
      }
    });
  }

  /* Dismiss splash after boot — fade out then remove from DOM */
  const splash = document.getElementById('app-splash');
  if (splash) {
    splash.classList.add('splash-hiding');
    splash.addEventListener('transitionend', function() { splash.remove(); }, { once: true });
  }
});
