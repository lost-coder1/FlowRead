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
    '<p style="font-family:var(--font-display);font-size:20px;color:var(--text);margin:0 0 12px;">Something went wrong</p>',
    '<p style="font-family:var(--font-body);font-size:15px;color:var(--text-muted);margin:0 0 24px;line-height:1.5;">' + (message || 'An unexpected error occurred.') + '</p>',
    '<button id="error-card-home-btn" style="font-family:var(--font-mono);font-size:13px;padding:10px 24px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;color:var(--text);cursor:pointer;">Go Home</button>',
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
  showErrorCard('Please re-import your file or restart the app.');
};

window.addEventListener('unhandledrejection', function(e) {
  console.error('Unhandled rejection:', e.reason);
  showErrorCard('Please re-import your file or restart the app.');
  e.preventDefault();
});

/* Boot sequence */
document.addEventListener('DOMContentLoaded', async function() {
  const settings = typeof getSettings === 'function' ? getSettings() : {};
  AppState.settings = settings;
  AppState.wpm = settings.defaultWpm || loadWPM();
  AppState.currentEngine = localStorage.getItem('fr_last_engine') || settings.defaultMode || 'rsvp';
  AppState.lastReaderEngine = AppState.currentEngine;

  try {
    if (typeof hasProAccess === 'function') {
      await hasProAccess();
    } else {
      AppState.isPro = typeof loadDevProBypass === 'function' ? loadDevProBypass() : false;
    }
  } catch (_) {
    AppState.isPro = false;
  }

  if (typeof applyTheme === 'function') {
    applyTheme(settings.theme);
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
    showErrorCard('The app failed to start. Please restart.');
    return;
  }

  if (typeof initShareHandler === 'function') initShareHandler();
});
