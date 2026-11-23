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
  clearLoadingProgress();
  /* The OCR run's own finally stops this too; here for the paths that hide the
     overlay without one, so a rotation can never outlive the screen it is on. */
  if (typeof OcrWaitTips !== 'undefined') OcrWaitTips.stop();
}

/* Determinate progress for a long job on the loading overlay.
   fraction 0..1; remainingMs 0 or absent leaves the time blank rather than
   printing a figure nothing has measured yet (§1.5). */
function setLoadingProgress(fraction, remainingMs) {
  const wrap = qs('#loading-progress');
  const fill = qs('.loading-progress-fill');
  const eta = qs('#loading-progress-eta');
  if (!wrap || !fill) return;
  show(wrap);
  const pct = Math.max(0, Math.min(1, fraction || 0)) * 100;
  fill.style.width = pct.toFixed(1) + '%';
  if (eta) eta.textContent = remainingMs > 0 ? '~' + formatRemaining(remainingMs) : '';
}

function clearLoadingProgress() {
  const wrap = qs('#loading-progress');
  const fill = qs('.loading-progress-fill');
  const eta = qs('#loading-progress-eta');
  if (fill) fill.style.width = '0';
  if (eta) eta.textContent = '';
  if (wrap) hide(wrap);
}

/* m:ss, or h:mm:ss past an hour. Digits only -- no words, so no translation. */
function formatRemaining(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = function(n) { return n < 10 ? '0' + n : String(n); };
  return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
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
