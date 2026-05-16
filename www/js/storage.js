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
  /* Remove by exact id OR by same name+kind (covers re-import with different lastModified) */
  const lib = loadLibrary().filter(function(item) {
    return item && item.id !== meta.id && !(item.name === meta.name && item.kind === meta.kind);
  });
  lib.unshift({ ...meta });
  localStorage.setItem('fr_library', JSON.stringify(lib));
}

function removeFileFromLibrary(fileId) {
  if (!fileId) return;
  const lib = loadLibrary().filter(function(item) { return item && item.id !== fileId; });
  localStorage.setItem('fr_library', JSON.stringify(lib));
  localStorage.removeItem('fr_pos_' + fileId);
  /* Best-effort cleanup of associated data — fire and forget */
  if (typeof deleteFileData === 'function') deleteFileData(fileId);
  if (typeof deleteRawPdf === 'function') deleteRawPdf(fileId);
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

function saveDeviceSyncedFiles(files) {
  try {
    localStorage.setItem('fr_device_files', JSON.stringify((files || []).filter(Boolean)));
  } catch (_) {}
}

function loadDeviceSyncedFiles() {
  try {
    return JSON.parse(localStorage.getItem('fr_device_files') || '[]').filter(Boolean);
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
  return 'fr_' + _hashSeed(seed);
}

/* FNV-1a 32-bit hash + rolling hash pair to reduce collisions without dependencies. */
function _hashSeed(seed) {
  var input = String(seed || '');
  var fnv = 2166136261;
  var roll = 0;

  for (var i = 0; i < input.length; i++) {
    var code = input.charCodeAt(i);
    fnv ^= code;
    fnv = Math.imul(fnv, 16777619);
    roll = (Math.imul(131, roll) + code) >>> 0;
  }

  var a = (fnv >>> 0).toString(16).padStart(8, '0');
  var b = (roll >>> 0).toString(16).padStart(8, '0');
  return a + b;
}

/* ── File data persistence (Capacitor Filesystem) ───────────── */
/*
  Saves parsed file content (words, pageWordIndex, rawLines, metadata) so the
  user can resume without re-importing. pdfDoc is not serialisable — Normal View
  requires re-import. Filesystem is used on device; localStorage fallback in browser.
*/
async function saveFileData(fileId, fileData) {
  const payloadObj = {
    words: fileData.words,
    pageWordIndex: fileData.pageWordIndex,
    rawLines: fileData.rawLines,
    metadata: fileData.metadata,
  };

  /* Store imageDataUrls if present (image/OCR files) */
  if (fileData.imageDataUrls && fileData.imageDataUrls.length) {
    payloadObj.imageDataUrls = fileData.imageDataUrls;
  }

  const payload = JSON.stringify(payloadObj);

  const Filesystem = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
  if (Filesystem && typeof Filesystem.writeFile === 'function') {
    try {
      await Filesystem.writeFile({
        path: 'flowread/' + fileId + '.json',
        data: payload,
        directory: 'DATA',
        encoding: 'utf8',
        recursive: true,
      });
      return;
    } catch (_) {}
  }

  /* Browser fallback: store in localStorage if under 3 MB */
  try {
    if (payload.length < 3 * 1024 * 1024) {
      localStorage.setItem('fr_filedata_' + fileId, payload);
    }
  } catch (_) {}
}

async function loadFileData(fileId) {
  const Filesystem = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
  if (Filesystem && typeof Filesystem.readFile === 'function') {
    try {
      const result = await Filesystem.readFile({
        path: 'flowread/' + fileId + '.json',
        directory: 'DATA',
        encoding: 'utf8',
      });
      return JSON.parse(result.data);
    } catch (_) {}
  }

  /* Browser fallback */
  try {
    const raw = localStorage.getItem('fr_filedata_' + fileId);
    if (raw) return JSON.parse(raw);
  } catch (_) {}

  return null;
}

async function deleteFileData(fileId) {
  const Filesystem = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
  if (Filesystem && typeof Filesystem.deleteFile === 'function') {
    try {
      await Filesystem.deleteFile({ path: 'flowread/' + fileId + '.json', directory: 'DATA' });
    } catch (_) {}
  }
  localStorage.removeItem('fr_filedata_' + fileId);
}

/* ── Raw PDF binary persistence (PDF only) ──────────────────── */
/*
  pdf.js document objects can't be serialised, but the original binary can.
  We save the raw bytes on first import using IndexedDB — works in webview and
  browser, stores ArrayBuffer natively (no base64), no Capacitor bridge limits.
  On resume, the lazy PDF button re-parses these bytes only when the user taps it.
*/
const _RAW_PDF_DB = 'flowread_rawpdf';
const _RAW_PDF_STORE = 'pdfs';
const _RAW_PDF_FLAG_PREFIX = 'fr_rawpdf_';

function _openRawPdfDb() {
  return new Promise(function(resolve, reject) {
    if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(_RAW_PDF_DB, 1);
    req.onupgradeneeded = function(event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(_RAW_PDF_STORE)) {
        db.createObjectStore(_RAW_PDF_STORE);
      }
    };
    req.onsuccess = function() { resolve(req.result); };
    req.onerror = function() { reject(req.error); };
  });
}

async function saveRawPdf(fileId, arrayBuffer) {
  if (!fileId || !arrayBuffer || !arrayBuffer.byteLength) {
    console.warn('saveRawPdf: missing/empty arrayBuffer for', fileId);
    return false;
  }
  try {
    const db = await _openRawPdfDb();
    await new Promise(function(resolve, reject) {
      const tx = db.transaction([_RAW_PDF_STORE], 'readwrite');
      tx.objectStore(_RAW_PDF_STORE).put(arrayBuffer, fileId);
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function() { reject(tx.error); };
      tx.onabort = function() { reject(tx.error || new Error('IDB tx aborted')); };
    });
    localStorage.setItem(_RAW_PDF_FLAG_PREFIX + fileId, '1');
    return true;
  } catch (e) {
    console.warn('saveRawPdf failed:', e);
    return false;
  }
}

async function loadRawPdf(fileId) {
  try {
    const db = await _openRawPdfDb();
    return await new Promise(function(resolve, reject) {
      const tx = db.transaction([_RAW_PDF_STORE], 'readonly');
      const req = tx.objectStore(_RAW_PDF_STORE).get(fileId);
      req.onsuccess = function() { resolve(req.result || null); };
      req.onerror = function() { reject(req.error); };
    });
  } catch (e) {
    console.warn('loadRawPdf failed:', e);
    return null;
  }
}

function hasRawPdf(fileId) {
  return localStorage.getItem(_RAW_PDF_FLAG_PREFIX + fileId) === '1';
}

async function deleteRawPdf(fileId) {
  localStorage.removeItem(_RAW_PDF_FLAG_PREFIX + fileId);
  try {
    const db = await _openRawPdfDb();
    await new Promise(function(resolve, reject) {
      const tx = db.transaction([_RAW_PDF_STORE], 'readwrite');
      tx.objectStore(_RAW_PDF_STORE).delete(fileId);
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function() { reject(tx.error); };
    });
  } catch (_) {}
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

function saveDevOcrBypass(enabled) {
  if (enabled) {
    localStorage.setItem('fr_purchase_ocr', 'true');
  } else {
    localStorage.removeItem('fr_purchase_ocr');
  }
}

function loadDevOcrBypass() {
  return localStorage.getItem('fr_purchase_ocr') === 'true';
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
