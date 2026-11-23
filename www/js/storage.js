/* All persistence — localStorage for UI state, Capacitor Preferences for purchase state */
/* All localStorage keys prefixed fr_ */

/* ── Position & reading state ───────────────────────────────── */
function savePosition(fileId, wordIndex) {
  localStorage.setItem('fr_pos_' + fileId, wordIndex);
  /* Every engine saves position, so this is the one place a nudged read can be
     counted regardless of which engine it happens in (Claude.md §9.2 step 5). */
  if (typeof NudgeFeature !== 'undefined' && AppState.nudgeContext) {
    NudgeFeature.onReadProgress(wordIndex);
  }
  /* And the one place reaching the end can be counted, for the same reason.
     Compared against AppState rather than looked up in the library: this runs
     on the playback path (§21 forbids work here), and a JSON.parse of the whole
     library per saved word is exactly the kind of cost that rule is about. The
     id check is what keeps it honest when the current file is not the one being
     written — markFileAsRead() writes another file's position from the
     library. */
  if (AppState.currentFile && AppState.currentFile.id === fileId &&
      AppState.currentFile.words && wordIndex >= AppState.currentFile.words.length) {
    _logBookFinished(fileId, 'read');
  }
}

/* §9.6. Finishing a book is the product's defining moment and was the one thing
   unmeasured: read_session_ended says people read, never that anyone reached an
   end.
   Gated once per book, because §5.2 makes completion *derived* from position —
   page back off the last page and the book un-finishes, so without this the
   event would fire again on every re-crossing and the count would drift. The
   gate is deliberately sticky across "mark unread" and re-reads: the question is
   how many books were ever finished, not how many times.
   The opt-out is checked *before* the gate is consumed, so a user who opts in
   later still has their next finish counted rather than having spent it while
   nothing was being sent. */
function _logBookFinished(fileId, source) {
  if (!fileId || typeof logEvent !== 'function') return;
  if (typeof AnalyticsPing !== 'undefined' && AnalyticsPing.optedOut()) return;
  const key = 'fr_an_done_' + fileId;
  try {
    if (localStorage.getItem(key) === '1') return;
    localStorage.setItem(key, '1');
  } catch (_) { return; }
  /* firstTag is the device's first ever finish, which is a different question
     from this book's: it answers how many *people* have finished anything. */
  logEvent('book_finished', { source: source, firstTag: 'finish' });
}

function loadPosition(fileId) {
  const v = localStorage.getItem('fr_pos_' + fileId);
  return v !== null ? parseInt(v, 10) : 0;
}

/* ── Page-mode layout cache ─────────────────────────────────── */
/* Page mode paginates by DOM measurement, and that measurement is the expensive
   part of opening it. What it produces is only word-index boundaries — integers,
   never reading content — so it is cached here and a later open of the same book
   measures nothing at all. The key carries the typography and the viewport as
   well as the file, so a rotation or a font change misses cleanly instead of
   restoring a grid that no longer fits the screen. */
const PAGE_LAYOUT_PREFIX = 'fr_page_layout_';
const PAGE_LAYOUT_MAX = 10;

function savePageLayout(key, starts, wordCount) {
  try {
    localStorage.setItem(PAGE_LAYOUT_PREFIX + key, JSON.stringify({
      v: 4, starts: starts, words: wordCount, ts: Date.now(),
    }));
  } catch (e) {
    /* Quota, or storage blocked entirely. This is a cache: losing it costs one
       re-measure and nothing the user should ever be told about (§1.5). */
  }
  _evictPageLayouts();
}

function loadPageLayout(key, wordCount) {
  const entry = _readPageLayout(key, wordCount);
  if (!entry) return null;
  /* Touch recency so the books actually being read outlive the ones that aren't. */
  try {
    entry.ts = Date.now();
    localStorage.setItem(PAGE_LAYOUT_PREFIX + key, JSON.stringify(entry));
  } catch (e) { /* recency is a nicety, not a requirement */ }
  return entry.starts;
}

function _readPageLayout(key, wordCount) {
  try {
    const raw = localStorage.getItem(PAGE_LAYOUT_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    /* Each version changed what occupies vertical space, so every earlier grid
       describes a layout that no longer exists: v2 added paragraph breaks, v3
       added chapter headings, v4 made a bare numeral its own paragraph (which
       moves an indent, and gives scanned books their chapter headings). Each
       moves page boundaries through the book. */
    if (!entry || entry.v !== 4 || !Array.isArray(entry.starts) || entry.starts.length === 0) return null;
    /* A file re-imported under the same id can hold different text, and the
       stored boundaries would then point into the wrong words. */
    if (typeof wordCount === 'number' && entry.words !== wordCount) return null;
    return entry;
  } catch (e) {
    return null;
  }
}

function _evictPageLayouts() {
  try {
    const entries = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k.indexOf(PAGE_LAYOUT_PREFIX) !== 0) continue;
      let ts = 0;
      try { ts = (JSON.parse(localStorage.getItem(k)) || {}).ts || 0; } catch (e) { ts = 0; }
      entries.push({ key: k, ts: ts });
    }
    if (entries.length <= PAGE_LAYOUT_MAX) return;
    entries.sort(function(a, b) { return a.ts - b.ts; });
    for (let i = 0; i < entries.length - PAGE_LAYOUT_MAX; i++) {
      localStorage.removeItem(entries[i].key);
    }
  } catch (e) { /* if we cannot enumerate storage there is nothing to evict */ }
}

/* ── Reader profile ─────────────────────────────────────────── */
/* How the reader described themselves at onboarding: 'light', 'medium' or
   'heavy'. A self-description, not a derived value — it records what they said,
   so hand-tuning the nudge sliders afterwards does not make it wrong. The
   settings it seeds are theirs to move from then on.

   Deliberately not a nudge-specific key. Task 16.18's reading plans use this
   same light/medium/hard taxonomy for a daily page target, so one answer can
   seed both rather than asking the same question twice in different words.
   nudge.js owns what a profile means for nudging; this owns only the fact. */
const READER_PROFILES = ['light', 'medium', 'heavy'];

function loadReaderProfile() {
  const v = localStorage.getItem('fr_reader_profile');
  return READER_PROFILES.indexOf(v) !== -1 ? v : null;
}

function saveReaderProfile(name) {
  if (READER_PROFILES.indexOf(name) === -1) return;
  localStorage.setItem('fr_reader_profile', name);
}

function saveWPM(wpm) {
  localStorage.setItem('fr_wpm', wpm);
}

function loadWPM() {
  const v = localStorage.getItem('fr_wpm');
  return v !== null ? parseInt(v, 10) : 260;
}

/* ── File library ───────────────────────────────────────────── */
/* `origin` is 'import' (the default) or 'catalogue' for a Free Books download.
   It exists only so §9.6's import_completed can tell the two apart: the whole
   point of that event is "is this a Free Books app or a bring-your-own-PDF
   app", and a catalogue book counted as an import answers neither. */
function saveFileToLibrary(meta, origin) {
  /* Remove by exact id OR by same name+kind (covers re-import with different lastModified) */
  const before = loadLibrary();
  const lib = before.filter(function(item) {
    return item && item.id !== meta.id && !(item.name === meta.name && item.kind === meta.kind);
  });
  lib.unshift({ ...meta });
  localStorage.setItem('fr_library', JSON.stringify(lib));

  /* Only a file that was not already in the library is an import. Re-opening
     one comes through here too (it rewrites lastOpened), and counting that
     would make the figure a measure of reading, not of importing. */
  if ((origin || 'import') === 'import' &&
      lib.length !== before.length &&
      typeof logEvent === 'function') {
    logEvent('import_completed', { source: meta.kind || '' });
  }
}

function removeFileFromLibrary(fileId) {
  if (!fileId) return;
  const lib = loadLibrary().filter(function(item) { return item && item.id !== fileId; });
  localStorage.setItem('fr_library', JSON.stringify(lib));
  localStorage.removeItem('fr_pos_' + fileId);
  /* Best-effort cleanup of associated data — fire and forget */
  if (typeof deleteFileData === 'function') deleteFileData(fileId);
  if (typeof deleteRawPdf === 'function') deleteRawPdf(fileId);
  if (typeof BookCover !== 'undefined') BookCover.forget(fileId);
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

  /* Store sourceUrl for URL files so the URL button works after app restart */
  if (fileData.sourceUrl) {
    payloadObj.sourceUrl = fileData.sourceUrl;
  }

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

/* ── OCR checkpoints ─────────────────────────────────────────
   A scanned book is OCR'd a page at a time and nothing was written down until
   the last page finished, so a phone call at page 300 of 355 discarded all of
   it. The checkpoint holds the recognised lines of each finished page, boxes and
   all, which the parser turns into the reader's arrays once the last page is in
   (cleaning and paragraph geometry both need the whole book), plus the page the
   next run should start from. It carries the
   parser's format version, so a checkpoint from an older build is discarded
   rather than misread.

   It is deliberately NOT the file data itself and the book is not in the library
   until OCR completes: a half-OCR'd book would report a word count that is a
   fraction of the real one, which is what §4.2 derives "finished" from. */

function _ocrCheckpointPath(fileId) {
  return 'flowread/' + fileId + '.ocr.json';
}

async function saveOcrCheckpoint(fileId, state) {
  if (!fileId || !state) return false;
  const payload = JSON.stringify({
    v: state.v,
    pagesDone: state.pagesDone,
    pageCount: state.pageCount,
    lockedScript: state.lockedScript || null,
    pageLines: state.pageLines,
    savedAt: Date.now(),
  });

  const Filesystem = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
  if (Filesystem && typeof Filesystem.writeFile === 'function') {
    try {
      await Filesystem.writeFile({
        path: _ocrCheckpointPath(fileId),
        data: payload,
        directory: 'DATA',
        encoding: 'utf8',
        recursive: true,
      });
      return true;
    } catch (e) {
      console.warn('saveOcrCheckpoint failed:', e);
      return false;
    }
  }

  /* Browser fallback. A long book's words can exceed the localStorage quota, and
     a failed checkpoint is not a failed import -- OCR simply starts over. */
  try {
    if (payload.length < 3 * 1024 * 1024) {
      localStorage.setItem('fr_ocrckpt_' + fileId, payload);
      return true;
    }
  } catch (_) {}
  return false;
}

async function loadOcrCheckpoint(fileId) {
  if (!fileId) return null;
  const Filesystem = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
  if (Filesystem && typeof Filesystem.readFile === 'function') {
    try {
      const result = await Filesystem.readFile({
        path: _ocrCheckpointPath(fileId),
        directory: 'DATA',
        encoding: 'utf8',
      });
      const parsed = JSON.parse(result.data);
      if (parsed && Array.isArray(parsed.pageLines) && parsed.pagesDone > 0) return parsed;
      return null;
    } catch (_) {}
  }
  try {
    const raw = localStorage.getItem('fr_ocrckpt_' + fileId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.pageLines) && parsed.pagesDone > 0) return parsed;
    }
  } catch (_) {}
  return null;
}

async function deleteOcrCheckpoint(fileId) {
  if (!fileId) return;
  const Filesystem = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
  if (Filesystem && typeof Filesystem.deleteFile === 'function') {
    try {
      await Filesystem.deleteFile({ path: _ocrCheckpointPath(fileId), directory: 'DATA' });
    } catch (_) {}
  }
  try { localStorage.removeItem('fr_ocrckpt_' + fileId); } catch (_) {}
}

async function deleteFileData(fileId) {
  /* A deleted book must not leave a resumable OCR run behind it. */
  await deleteOcrCheckpoint(fileId);

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

/* Consecutive days with at least one session, counting back from today.
   Derived from the session store rather than stored, so it can never drift out
   of sync with it. Shared by the dashboard and the share card. */
/* A streak is alive if it was fed today *or* yesterday.

   Counting back from today alone meant that at every local midnight the streak
   read 0 until the user next read — a twelve-day run reported as nothing all
   morning, which is the silent failure §1.5 forbids. It does not stay on the
   home screen either: the dashboard, the streak notification and §14's share
   card all read this, and the card is an image that leaves the device with the
   number on it.

   Local-time keys throughout, matching §8.3's local-midnight boundary. */
function computeStreak(sessions) {
  const dateset = new Set(sessions.map(function(s) { return s.date; }));
  let streak = 0;
  let cursor = new Date();

  /* A today with no reading yet is a day still in progress, not a broken
     streak, so the walk starts at yesterday. If yesterday is missing too the
     loop fails its first test and returns 0, which is the real broken streak. */
  if (!dateset.has(_dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  for (var i = 0; i < 365; i++) {
    if (!dateset.has(_dateKey(cursor))) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

/* One place that turns a Date into the YYYY-MM-DD key `fr_stats` is keyed by,
   so the streak walk and today's lookup cannot disagree about a date. */
function _dateKey(d) {
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  var dd = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + mm + '-' + dd;
}

function todayDateString() {
  return _dateKey(new Date());
}
