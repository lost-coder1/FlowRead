/* App entry point — runs after all scripts are loaded */

/* Disable pdf.js web worker — web workers with local file:// paths are unreliable
   in Capacitor's Android WebView. Running on main thread is slightly slower but
   fully compatible. For large PDFs the loading indicator keeps UX acceptable. */
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';
}

/* Global error boundaries */
window.onerror = function(msg, src, line, col, err) {
  console.error('Global error:', msg, err);
  showToast('Something went wrong. Please restart the app.');
};

window.addEventListener('unhandledrejection', function(e) {
  console.error('Unhandled rejection:', e.reason);
  showToast('Something went wrong. Please try again.');
  e.preventDefault();
});

/* Boot sequence */
document.addEventListener('DOMContentLoaded', function() {
  const settings = typeof getSettings === 'function' ? getSettings() : {};
  AppState.settings = settings;
  AppState.wpm = settings.defaultWpm || loadWPM();
  AppState.currentEngine = localStorage.getItem('fr_last_engine') || settings.defaultMode || 'rsvp';
  AppState.lastReaderEngine = AppState.currentEngine;

  if (localStorage.getItem('fr_orp_enabled') === null) localStorage.setItem('fr_orp_enabled', settings.orpDefault ? 'true' : 'false');
  if (localStorage.getItem('fr_context_enabled') === null) localStorage.setItem('fr_context_enabled', settings.contextDefault ? 'true' : 'false');
  if (localStorage.getItem('fr_calm_mode') === null) localStorage.setItem('fr_calm_mode', settings.calmModeDefault ? 'true' : 'false');

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && AppState.activeModal) closeActiveModal();
  });

  if (loadOnboardingComplete()) {
    renderUpload();
    switchView('view-upload');
    return;
  }

  renderOnboarding(0);
});
