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
  const lib = loadLibrary().filter(function(item) {
    return item && item.id !== meta.id;
  });
  lib.unshift({ ...meta });
  localStorage.setItem('fr_library', JSON.stringify(lib));
}

function loadLibrary() {
  try {
    return JSON.parse(localStorage.getItem('fr_library') || '[]')
      .filter(Boolean)
      .sort(function(a, b) {
        return (b.lastOpened || 0) - (a.lastOpened || 0);
      });
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

function saveOnboardingComplete() {
  localStorage.setItem('fr_onboarding_complete', 'true');
}

function loadOnboardingComplete() {
  return localStorage.getItem('fr_onboarding_complete') === 'true';
}

/* ── Purchase state (Capacitor Preferences) ─────────────────── */
async function savePurchaseState(key, value) {
  const stringValue = String(value);
  const preferences = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences;
  if (preferences && typeof preferences.set === 'function') {
    await preferences.set({
      key: 'fr_purchase_' + key,
      value: stringValue,
    });
    return;
  }
  localStorage.setItem('fr_purchase_' + key, stringValue);
}

async function loadPurchaseState(key) {
  /* Check localStorage first (dev/test bypass uses localStorage) */
  const localValue = localStorage.getItem('fr_purchase_' + key);
  if (localValue) return localValue;

  /* Fall back to Capacitor Preferences (real device) */
  const preferences = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences;
  if (preferences && typeof preferences.get === 'function') {
    const result = await preferences.get({ key: 'fr_purchase_' + key });
    return result && result.value;
  }

  return null;
}

/* ── File ID generation ─────────────────────────────────────── */
function generateFileId(primary, secondary, tertiary) {
  const seed = [primary || '', secondary || '', tertiary || ''].join('::');
  return btoa(seed).replace(/[^a-z0-9]/gi, '').slice(0, 24);
}

/* ── Dev test bypass (localStorage, test-only) ──────────────── */
/* Uses localStorage instead of Capacitor Preferences so it's clearly separate from real purchases. */
function saveDevProBypass(enabled) {
  if (enabled) {
    localStorage.setItem('fr_purchase_pro', 'true');
  } else {
    localStorage.removeItem('fr_purchase_pro');
  }
}

function loadDevProBypass() {
  return localStorage.getItem('fr_purchase_pro') === 'true';
}

/* ── Reading stats (append-only array, max 500 sessions) ────── */
/* Session shape: { date: 'YYYY-MM-DD', wordsRead, durationMs, wpm, fileId } */
function saveReadingSession(session) {
  var sessions = loadReadingSessions();
  sessions.push(session);
  if (sessions.length > 500) {
    sessions = sessions.slice(sessions.length - 500);
  }
  localStorage.setItem('fr_stats', JSON.stringify(sessions));
}

function loadReadingSessions() {
  try {
    return JSON.parse(localStorage.getItem('fr_stats') || '[]').filter(Boolean);
  } catch (_) {
    return [];
  }
}

function todayDateString() {
  var d = new Date();
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  var dd = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + mm + '-' + dd;
}
