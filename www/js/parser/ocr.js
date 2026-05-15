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

  /* Recognise text from a base64 image. Tries Latin first; if the result is
     thin or looks like junk, tries Devanagari (Hindi) and keeps the better one. */
  async function recogniseBase64(base64Image) {
    const plugin = _plugin();
    if (!plugin) throw new Error('OCR plugin not available on this platform.');

    const latin = await plugin.detectText({ base64Image: base64Image, script: 'latin' });
    const latinText = (latin && latin.text) ? latin.text.trim() : '';
    const latinScore = _scoreText(latinText);

    /* Skip Devanagari attempt if Latin produced clearly good output */
    if (latinScore.realWords >= 15 && latinScore.junkRatio < 0.3) {
      return latinText;
    }

    let devText = '';
    try {
      const dev = await plugin.detectText({ base64Image: base64Image, script: 'devanagari' });
      devText = (dev && dev.text) ? dev.text.trim() : '';
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
        return (devText + '\n' + latinText).trim();
      }
      return devText;
    }
    return latinText;
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
     scale=3 gives ~288 DPI on a 96 DPI screen — enough for ML Kit on dense text.
     Max side capped at 3000px to avoid WebView OOM on very large page sizes. */
  async function pdfPageToBase64(pdfPage) {
    const baseViewport = pdfPage.getViewport({ scale: 1.0 });
    const MAX_SIDE = 3000;
    const rawMax = Math.max(baseViewport.width, baseViewport.height) * 3.0;
    const scale = rawMax > MAX_SIDE ? (MAX_SIDE / Math.max(baseViewport.width, baseViewport.height)) : 3.0;
    const viewport = pdfPage.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    /* White background — some scanned PDFs render with transparent bg, hurting OCR contrast */
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pdfPage.render({ canvasContext: ctx, viewport: viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const base64 = dataUrl.split(',')[1];
    /* Diagnostic: tiny payload means pdf.js failed to draw the embedded image (e.g. JBIG2/JP2 not decoded) */
    console.log('[OCR] rendered page ' + canvas.width + 'x' + canvas.height + ', jpeg bytes=' + base64.length);
    /* Stash page 1 so user can inspect what ML Kit sees */
    if (!window._lastOcrPagePreview) window._lastOcrPagePreview = dataUrl;
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

  return { isAvailable, recogniseBase64, pdfPageToBase64, imageFileToBase64 };
})();
