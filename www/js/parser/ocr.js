/* OCR engine — wraps @pantrist/capacitor-plugin-ml-kit-text-recognition
   Input:  base64 JPEG string (no data-URL prefix)
   Output: plain text string of recognised content */

const OCREngine = (function() {

  function _plugin() {
    return (typeof Capacitor !== 'undefined' &&
            Capacitor.Plugins &&
            Capacitor.Plugins.FlowReadOcr)
      ? Capacitor.Plugins.FlowReadOcr : null;
  }

  function isAvailable() {
    return !!_plugin();
  }

  async function _detect(base64Image, script) {
    const plugin = _plugin();
    if (!plugin) throw new Error('OCR plugin not available on this platform.');
    const res = await plugin.detectText({ base64Image: base64Image, script: script });
    return (res && res.text) ? res.text.trim() : '';
  }

  /* Recognise with both scripts and report which one won, so a caller processing a
     whole document can stop paying for two passes per page (see ocr-pdf.js). */
  async function recogniseAuto(base64Image) {
    const latinText = await _detect(base64Image, 'latin');
    const latinScore = _scoreText(latinText);

    /* Skip Devanagari attempt if Latin produced clearly good output */
    if (latinScore.realWords >= 15 && latinScore.junkRatio < 0.3) {
      return { text: latinText, script: 'latin' };
    }

    let devText = '';
    try {
      devText = await _detect(base64Image, 'devanagari');
    } catch (e) {
      console.warn('[OCR] devanagari attempt failed:', e);
    }
    const devScore = _scoreText(devText);
    console.log('[OCR] latin realWords=' + latinScore.realWords + ' junk=' + latinScore.junkRatio.toFixed(2)
      + ' | dev realWords=' + devScore.realWords + ' chars=' + devText.length);

    /* Devanagari script returns non-Latin characters — count any Devanagari unicode block */
    if (devText.length > latinText.length || devScore.devanagariChars > 0) {
      /* Merge both — Hindi docs sometimes have English headers/page numbers */
      if (latinScore.realWords >= 3 && devScore.devanagariChars > 0) {
        return { text: (devText + '\n' + latinText).trim(), script: 'both' };
      }
      return { text: devText, script: 'devanagari' };
    }
    return { text: latinText, script: 'latin' };
  }

  /* Recognise text from a base64 image.
     With no opts: tries Latin first and falls back to Devanagari (the original
     behaviour — image.js and the per-page rescue path rely on it).
     opts.script pins the pass(es) to run: 'latin', 'devanagari' or 'both'. */
  async function recogniseBase64(base64Image, opts) {
    const script = opts && opts.script;
    if (script === 'latin' || script === 'devanagari') return _detect(base64Image, script);
    if (script === 'both') {
      const latinText = await _detect(base64Image, 'latin');
      let devText = '';
      try { devText = await _detect(base64Image, 'devanagari'); }
      catch (e) { console.warn('[OCR] devanagari attempt failed:', e); }
      if (!devText) return latinText;
      if (!latinText) return devText;
      return (devText + '\n' + latinText).trim();
    }
    return (await recogniseAuto(base64Image)).text;
  }

  /* Cheap text quality heuristic — used to decide whether to retry with another script. */
  function _scoreText(text) {
    if (!text) return { realWords: 0, junkRatio: 0, devanagariChars: 0 };
    let realWords = 0, junkWords = 0, devanagariChars = 0;
    /* Devanagari Unicode block: U+0900–U+097F */
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code >= 0x0900 && code <= 0x097F) devanagariChars++;
    }
    const tokens = text.split(/\s+/).filter(Boolean);
    for (let j = 0; j < tokens.length; j++) {
      const stripped = tokens[j].replace(/[^A-Za-z]/g, '');
      if (stripped.length >= 3 && /[aeiouAEIOU]/.test(stripped)) realWords++;
      else if (tokens[j].length > 0) junkWords++;
    }
    const total = realWords + junkWords;
    return {
      realWords: realWords,
      junkRatio: total > 0 ? junkWords / total : 0,
      devanagariChars: devanagariChars,
    };
  }

  /* Render a pdf.js page to a canvas and return a base64 JPEG string.
     scale=2 / 2000px long edge is ~190 DPI, which ML Kit reads book text from
     reliably, and it is the cheapest lever there is: the JPEG encode here is
     synchronous on the main thread, the base64 crosses the bridge as JSON, and
     native decodes it back to a bitmap — all three scale with pixel count, so
     3000px cost 2.25x of each. ocr-pdf.js re-renders a page at HIRES when the
     text comes back thin, so dense scans are not left on the cheap setting.

     opts exists for the cover thumbnails (book-cover.js), which want the same
     render at a fraction of the size and none of the OCR diagnostics. Defaults
     are the OCR values, so callers that pass nothing are unaffected. */
  async function pdfPageToBase64(pdfPage, opts) {
    const o = opts || {};
    const targetScale = typeof o.scale === 'number' ? o.scale : 2.0;
    const quality = typeof o.quality === 'number' ? o.quality : 0.85;
    const diagnostics = o.diagnostics !== false;
    const baseViewport = pdfPage.getViewport({ scale: 1.0 });
    const MAX_SIDE = typeof o.maxSide === 'number' ? o.maxSide : 2000;
    const rawMax = Math.max(baseViewport.width, baseViewport.height) * targetScale;
    const scale = rawMax > MAX_SIDE
      ? (MAX_SIDE / Math.max(baseViewport.width, baseViewport.height))
      : targetScale;
    const viewport = pdfPage.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    /* White background — some scanned PDFs render with transparent bg, hurting OCR contrast */
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pdfPage.render({ canvasContext: ctx, viewport: viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64 = dataUrl.split(',')[1];
    /* Bytes per megapixel is how ocr-pdf.js tells "pdf.js drew nothing" (a JBIG2/JP2
       scan renders white) from "this page is genuinely blank or sparse". */
    if (o.info && typeof o.info === 'object') {
      o.info.width = canvas.width;
      o.info.height = canvas.height;
      o.info.bytes = base64.length;
      o.info.bytesPerMP = base64.length / Math.max(0.01, (canvas.width * canvas.height) / 1e6);
    }
    if (diagnostics) {
      /* Diagnostic: tiny payload means pdf.js failed to draw the embedded image (e.g. JBIG2/JP2 not decoded) */
      console.log('[OCR] rendered page ' + canvas.width + 'x' + canvas.height + ', jpeg bytes=' + base64.length);
      /* Stash page 1 so user can inspect what ML Kit sees */
      if (!window._lastOcrPagePreview) window._lastOcrPagePreview = dataUrl;
    }
    return base64;
  }

  /* Convert an image File to a base64 string by reading raw file bytes.
     Avoids canvas entirely — no memory blowup on 12MP photos.
     ML Kit on Android accepts JPEG, PNG, and WEBP natively. */
  async function imageFileToBase64(file) {
    return new Promise(function(resolve, reject) {
      const reader = new FileReader();
      reader.onload = function() {
        const dataUrl = reader.result;
        const comma = dataUrl.indexOf(',');
        if (comma === -1) { reject(new Error('FileReader returned unexpected format')); return; }
        resolve(dataUrl.slice(comma + 1));
      };
      reader.onerror = function() { reject(new Error('FileReader failed: ' + (reader.error && reader.error.message))); };
      reader.readAsDataURL(file);
    });
  }

  return { isAvailable, recogniseBase64, recogniseAuto, pdfPageToBase64, imageFileToBase64 };
})();
