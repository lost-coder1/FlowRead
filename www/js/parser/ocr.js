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
    return (await _detectFull(base64Image, script)).text;
  }

  /* The plugin's whole answer: the text, and the per-line boxes the parser needs
     to tell an indented first line from a wrapped one. Coordinates are
     normalised to 0..1000 of the page width here, because a page re-rendered at
     the hi-res fallback reports the same layout in different pixels. */
  async function _detectFull(base64Image, script) {
    const plugin = _plugin();
    if (!plugin) throw new Error('OCR plugin not available on this platform.');
    const res = await plugin.detectText({ base64Image: base64Image, script: script });
    const text = (res && res.text) ? res.text.trim() : '';
    const width = (res && res.width) || 0;
    const height = (res && res.height) || 0;
    const lines = [];
    const raw = (res && res.lines) || [];
    for (let i = 0; i < raw.length; i++) {
      const line = raw[i];
      const lineText = (line && line.text) ? String(line.text).trim() : '';
      if (!lineText) continue;
      const entry = { text: lineText };
      /* The line's vertical centre, so the parser can tell a fragment of a line
         from a line: a block boundary can split one the way a PDF's baseline
         noise does. Normalised against the page's own height, which is what
         makes it comparable across a hi-res retry. */
      if (height > 0 && typeof line.top === 'number' && typeof line.bottom === 'number') {
        entry.y = Math.round(((line.top + line.bottom) / 2 / height) * 1000);
      }
      if (width > 0 && typeof line.left === 'number' && typeof line.right === 'number') {
        /* Rounded, because full double precision is 18 characters of digits per
           coordinate for no gain: on this 0..1000 scale the indent test works
           in units of an em, which is about 13. The saving is in what crosses
           the bridge and what every checkpoint has to serialise, both of which
           are main-thread work competing with the next page's render. */
        entry.x0 = Math.round((line.left / width) * 1000);
        entry.x1 = Math.round((line.right / width) * 1000);
      }
      lines.push(entry);
    }
    return { text: text, lines: lines };
  }

  /* Hindi books carry English -- page numbers, publisher pages, quoted titles --
     so when both passes found something real, both are kept. Devanagari leads
     because it is the body text; the Latin pass's reading of Devanagari is
     transliteration noise, so it is only appended when it found real words of
     its own. One copy of this rule, used by detection and by the rescue. */
  function combine(devText, latinText) {
    const dev = _scoreText(devText);
    const lat = _scoreText(latinText);
    if (!devText) return latinText || '';
    if (!latinText) return devText;
    if (dev.devanagariChars > 0) {
      /* The Devanagari recognizer reads Latin as well, so on a Hindi page the
         Latin pass is a transliteration of the same glyphs -- "गोदान / 35" comes
         back as "TGIT / 35", and those tokens have vowels in them, so counting
         real words is not enough to tell them from English. The Latin text is
         therefore kept only when it found materially more Latin than the
         Devanagari pass did AND does not itself look like junk (measured:
         English prose scores 0.24 on this ratio, Devanagari-as-Latin 0.57). */
      const addsLatin = lat.latinWords >= dev.latinWords + 8 && lat.junkRatio < 0.5;
      return addsLatin ? (devText + '\n' + latinText).trim() : devText;
    }
    return lat.realWords > dev.realWords ? latinText : devText;
  }

  /* Both scripts on one image, with the scores, for the caller that has to
     decide what this *document* is rather than what this page says. */
  async function recogniseBoth(base64Image) {
    const latin = await _detectFull(base64Image, 'latin');
    let dev = { text: '', lines: [] };
    try { dev = await _detectFull(base64Image, 'devanagari'); }
    catch (e) { console.warn('[OCR] devanagari attempt failed:', e); }
    const text = combine(dev.text, latin.text);
    /* Whichever text was kept, its own lines come with it. A merge keeps the
       Devanagari pass's boxes and appends the Latin lines without any, so a
       line whose geometry is unknown simply cannot start a paragraph. */
    let lines;
    if (text === dev.text) lines = dev.lines;
    else if (text === latin.text) lines = latin.lines;
    else lines = dev.lines.concat(latin.lines.map(function(l) { return { text: l.text }; }));
    return {
      latinText: latin.text,
      devText: dev.text,
      text: text,
      lines: lines,
      latin: _scoreText(latin.text),
      dev: _scoreText(dev.text),
    };
  }

  /* One script, with its lines. */
  async function recogniseLines(base64Image, script) {
    return _detectFull(base64Image, script);
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
      if (latinScore.latinWords >= 3 && devScore.devanagariChars > 0) {
        return { text: combine(devText, latinText), script: 'both' };
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
    if (script === 'both') return (await recogniseBoth(base64Image)).text;
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
    let devWords = 0;
    for (let j = 0; j < tokens.length; j++) {
      const stripped = tokens[j].replace(/[^A-Za-z]/g, '');
      if (stripped.length >= 3 && /[aeiouAEIOU]/.test(stripped)) realWords++;
      /* A Devanagari word is real text, not junk. Without this a perfect
         Devanagari page scores junkRatio 1.00, so any caller asking "did this
         pass read the page properly?" is told no for every Hindi page there is. */
      else if (tokens[j].replace(/[^\u0900-\u097F]/g, '').length >= 2) { realWords++; devWords++; }
      else if (tokens[j].length > 0) junkWords++;
    }
    const total = realWords + junkWords;
    return {
      realWords: realWords,
      devWords: devWords,
      latinWords: realWords - devWords,
      tokens: tokens.length,
      junkRatio: total > 0 ? junkWords / total : 0,
      devanagariChars: devanagariChars,
      letters: text.replace(/\s+/g, '').length,
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

  return { isAvailable, recogniseBase64, recogniseAuto, recogniseBoth, recogniseLines, combine,
           scoreText: _scoreText, pdfPageToBase64, imageFileToBase64 };
})();
