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

  /* fileIds a remote cover has been attempted for this session. The disk flag
     alone is not enough to stop a retry: it is only set once _writeCache
     succeeds, so a device with no writable Filesystem, or a full one, would have
     every Free Books visit re-fetch every cover it already holds in memory. */
  const _remoteTried = {};

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

  /* Decode a data URL and redraw it at TARGET_WIDTH as a JPEG. The source is a
     data URL, so the canvas is same-origin and toDataURL() cannot be tainted —
     which is the reason the fetched bytes are read into one first rather than
     pointing an <img> at the remote URL. */
  function _downscale(dataUrl) {
    return new Promise(function(resolve) {
      const img = new Image();
      img.onerror = function() { resolve(null); };
      img.onload = function() {
        if (!img.naturalWidth || !img.naturalHeight) return resolve(null);
        try {
          const scale = Math.min(1, TARGET_WIDTH / img.naturalWidth);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
        } catch (_) {
          resolve(null);
        }
      };
      img.src = dataUrl;
    });
  }

  function _blobToDataUrl(blob) {
    return new Promise(function(resolve) {
      try {
        const reader = new FileReader();
        reader.onerror = function() { resolve(null); };
        reader.onload = function() { resolve(reader.result || null); };
        reader.readAsDataURL(blob);
      } catch (_) {
        resolve(null);
      }
    });
  }

  /**
   * Store a catalogue cover for a Free Books title under its library file id.
   *
   * Called at download time, when the device is online by definition, so the
   * share card keeps its guarantee of fetching nothing (§15): by the time a card
   * is drawn the artwork is already a data URL on disk, and get() finds it in the
   * cache before it would think about rendering a PDF page. A Free Books TXT has
   * no page to render at all, which is where this matters most.
   *
   * Self-validating and silent: unless the bytes actually decode into an image,
   * nothing is written and the cover falls back to whatever it would have been.
   * Never throws, never blocks the read that triggered it, never surfaces an
   * error — a missing cover is not something to tell the reader about (§1.5).
   */
  async function cacheRemote(fileId, urls) {
    if (!fileId) return false;
    if (localStorage.getItem(FLAG_PREFIX + fileId) === '1') return false;
    if (_memo[fileId]) return false;
    if (_remoteTried[fileId]) return false;
    _remoteTried[fileId] = true;
    const list = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);

    for (let i = 0; i < list.length; i++) {
      try {
        const res = await fetch(list[i]);
        if (!res || !res.ok) continue;
        const raw = await _blobToDataUrl(await res.blob());
        if (!raw) continue;
        const cover = await _downscale(raw);
        if (!cover) continue;          /* not an image we can decode (old WebView, AVIF) */
        await _writeCache(fileId, cover);
        _memo[fileId] = cover;
        return true;
      } catch (_) {
        /* Next mirror, or give up. */
      }
    }
    return false;
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
    delete _remoteTried[fileId];
    localStorage.removeItem(FLAG_PREFIX + fileId);
    const Filesystem = _fs();
    if (Filesystem && typeof Filesystem.deleteFile === 'function') {
      Filesystem.deleteFile({ path: PATH_PREFIX + fileId + '.txt', directory: 'DATA' })
        .catch(function() {});
    }
  }

  return { get: get, getImage: getImage, cacheRemote: cacheRemote, forget: forget };
})();
