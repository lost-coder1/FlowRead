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
  /* Restore saved WPM */
  AppState.wpm = loadWPM();

  /* Render the upload (home) screen */
  renderUpload();

  /* Show the upload view */
  switchView('view-upload');
});
