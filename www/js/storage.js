/* All persistence — localStorage for UI state, Capacitor Preferences for purchase state */
/* All localStorage keys prefixed fr_ */

/* ── Position & reading state ───────────────────────────────── */
function savePosition(fileId, wordIndex) {
  localStorage.setItem('fr_pos_' + fileId, wordIndex);
}

function loadPosition(fileId) {
  const v = localStorage.getItem('fr_pos_' + fileId);
  return v !== null ? parseInt(v, 10) : 0;
}

function saveWPM(wpm) {
  localStorage.setItem('fr_wpm', wpm);
}

function loadWPM() {
  const v = localStorage.getItem('fr_wpm');
  return v !== null ? parseInt(v, 10) : 260;
}

/* ── File library ───────────────────────────────────────────── */
function saveFileToLibrary(meta) {
  /* meta: { id, name, wordCount, pageCount, lastOpened } */
  const lib = loadLibrary();
  const idx = lib.findIndex(f => f.id === meta.id);
  if (idx >= 0) lib[idx] = { ...lib[idx], ...meta };
  else lib.unshift(meta);
  localStorage.setItem('fr_library', JSON.stringify(lib));
}

function loadLibrary() {
  try {
    return JSON.parse(localStorage.getItem('fr_library') || '[]');
  } catch (_) {
    return [];
  }
}

/* ── Settings ───────────────────────────────────────────────── */
function saveSettings(settings) {
  localStorage.setItem('fr_settings', JSON.stringify(settings));
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem('fr_settings') || '{}');
  } catch (_) {
    return {};
  }
}

/* ── Purchase state (Capacitor Preferences) ─────────────────── */
/* Stubs — wired to real Capacitor Preferences in Phase 9 */
async function savePurchaseState(key, value) {
  /* TODO: replace with Capacitor Preferences in Phase 9 */
  localStorage.setItem('fr_purchase_' + key, value);
}

async function loadPurchaseState(key) {
  /* TODO: replace with Capacitor Preferences in Phase 9 */
  return localStorage.getItem('fr_purchase_' + key);
}

/* ── File ID generation ─────────────────────────────────────── */
function generateFileId(name, size) {
  return btoa(name + size).replace(/[^a-z0-9]/gi, '').slice(0, 16);
}
