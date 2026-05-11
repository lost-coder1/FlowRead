/* Utility: DOM helpers used throughout the app */

function qs(selector, ctx) {
  return (ctx || document).querySelector(selector);
}

function qsa(selector, ctx) {
  return Array.from((ctx || document).querySelectorAll(selector));
}

function show(el) {
  if (el) el.classList.remove('hidden');
}

function hide(el) {
  if (el) el.classList.add('hidden');
}

/* Switch the visible top-level view. Hides all others. */
function switchView(viewId) {
  qsa('.view').forEach(v => v.classList.add('hidden'));
  const target = qs('#' + viewId);
  if (target) target.classList.remove('hidden');
  AppState.currentView = viewId;
}

/* Show / hide the full-screen loading overlay */
function showLoading(message) {
  const overlay = qs('#loading-overlay');
  const msg = qs('#loading-message');
  if (msg) msg.textContent = message || 'Loading...';
  show(overlay);
}

function hideLoading() {
  hide(qs('#loading-overlay'));
}

/* Show a temporary toast message */
function showToast(message, durationMs) {
  const container = qs('#toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('visible'));
  });
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, durationMs || 3000);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
