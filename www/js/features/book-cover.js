/* Cover thumbnails for the share card (Claude.md §15).
 *
 * Offline by construction (§1.1): a PDF carries its own cover on page one and
 * the raw bytes are already in IndexedDB, so nothing is fetched. Anything else —
 * TXT, DOCX, a URL import — has no artwork to find, and the caller draws a
 * typographic cover instead of this module inventing one.
 *
 * Rendering a page costs a few hundred milliseconds, and the share sheet redraws
 * its preview on every toggle, so results are cached twice: in memory for the
 * session and on disk for every session after it.
 */

const BookCover = (function() {
  /* Enough for a 320px-wide panel on a 1080px card, at 2× for safety. The
     cover is decoration beside the title, not something to read. */
  const TARGET_WIDTH = 640;
  const JPEG_QUALITY = 0.8;

  const FLAG_PREFIX = 'fr_cover_';
  const PATH_PREFIX = 'flowread/covers/';

  /* fileId → data URL, or null for "asked and there is none". */
  const _memo = {};

  function _fs() {
    const C = window.Capacitor;
    return (C && C.Plugins && C.Plugins.Filesystem) || null;
  }

  async function _readCache(fileId) {
    if (localStorage.getItem(FLAG_PREFIX + fileId) !== '1') return null;
    const Filesystem = _fs();
    if (!Filesystem || typeof Filesystem.readFile !== 'function') return null;
    try {
      const res = await Filesystem.readFile({
        path: PATH_PREFIX + fileId + '.txt',
        directory: 'DATA',
        encoding: 'utf8',
      });
      return res && res.data ? res.data : null;
    } catch (_) {
      /* Cache gone (cleared data, restored backup) — the flag is now a lie. */
      localStorage.removeItem(FLAG_PREFIX + fileId);
      return null;
    }
  }

  async function _writeCache(fileId, dataUrl) {
    const Filesystem = _fs();
    if (!Filesystem || typeof Filesystem.writeFile !== 'function') return;
    try {
      await Filesystem.writeFile({
        path: PATH_PREFIX + fileId + '.txt',
        data: dataUrl,
        directory: 'DATA',
        encoding: 'utf8',
        recursive: true,
      });
      localStorage.setItem(FLAG_PREFIX + fileId, '1');
    } catch (_) {
      /* A missing cache costs a re-render, not a missing cover. */
    }
  }

  /* Page one of the PDF, from the bytes kept for the lazy-PDF button. */
  async function _renderPdfFirstPage(fileId) {
    if (typeof hasRawPdf !== 'function' || !hasRawPdf(fileId)) return null;
    if (typeof pdfjsLib === 'undefined' || typeof OCREngine === 'undefined') return null;
    let pdfDoc = null;
    try {
      const buffer = await loadRawPdf(fileId);
      if (!buffer || !buffer.byteLength) return null;
      const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      pdfDoc = await pdfjsLib.getDocument({ data }).promise;
      const page = await pdfDoc.getPage(1);
      const width = page.getViewport({ scale: 1.0 }).width || TARGET_WIDTH;
      const base64 = await OCREngine.pdfPageToBase64(page, {
        scale: TARGET_WIDTH / width,
        quality: JPEG_QUALITY,
        maxSide: TARGET_WIDTH * 2,
        diagnostics: false,
      });
      return base64 ? 'data:image/jpeg;base64,' + base64 : null;
    } catch (_) {
      return null;
    } finally {
      /* pdf.js holds a worker per document; a share sheet opened repeatedly
         would otherwise leak one each time. */
      if (pdfDoc && typeof pdfDoc.destroy === 'function') {
        try { pdfDoc.destroy(); } catch (_) {}
      }
    }
  }

  /**
   * A cover for a library item, or null when the file has no artwork to take
   * one from. Never throws and never blocks on the network.
   */
  async function get(fileId) {
    if (!fileId) return null;
    if (Object.prototype.hasOwnProperty.call(_memo, fileId)) return _memo[fileId];

    let cover = await _readCache(fileId);
    if (!cover) {
      cover = await _renderPdfFirstPage(fileId);
      if (cover) await _writeCache(fileId, cover);
    }
    _memo[fileId] = cover || null;
    return _memo[fileId];
  }

  /** Decoded <img>, ready to draw. Null whenever get() is null or decoding fails. */
  async function getImage(fileId) {
    const dataUrl = await get(fileId);
    if (!dataUrl) return null;
    return new Promise(function(resolve) {
      const img = new Image();
      img.onload = function() { resolve(img); };
      img.onerror = function() { resolve(null); };
      img.src = dataUrl;
    });
  }

  function forget(fileId) {
    delete _memo[fileId];
    localStorage.removeItem(FLAG_PREFIX + fileId);
    const Filesystem = _fs();
    if (Filesystem && typeof Filesystem.deleteFile === 'function') {
      Filesystem.deleteFile({ path: PATH_PREFIX + fileId + '.txt', directory: 'DATA' })
        .catch(function() {});
    }
  }

  return { get: get, getImage: getImage, forget: forget };
})();
