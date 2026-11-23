/* OCR-PDF parser — runs ML Kit on each page of a scanned/image-only PDF
   and returns the standard reader data model.
   pdfDoc must be a loaded pdf.js PDFDocumentProxy. */

/* Pull the largest image XObject off a page. For scanner PDFs whose embedded
   image format isn't fully supported by pdf.js's renderer, the decoded bitmap
   on page.objs is often still usable via canvas drawImage. */
async function _extractLargestImage(page) {
  try {
    const opList = await page.getOperatorList();
    const OPS = (typeof pdfjsLib !== 'undefined' && pdfjsLib.OPS) ? pdfjsLib.OPS : null;
    if (!OPS) return null;
    const imageOps = [OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintJpegXObject];
    const names = [];
    for (let i = 0; i < opList.fnArray.length; i++) {
      if (imageOps.indexOf(opList.fnArray[i]) !== -1) {
        const arg = opList.argsArray[i] && opList.argsArray[i][0];
        if (typeof arg === 'string') names.push(arg);
      }
    }
    if (!names.length) { console.log('[OCR] no image XObjects on page'); return null; }

    let best = null;
    for (let j = 0; j < names.length; j++) {
      const name = names[j];
      let obj = null;
      try {
        obj = await new Promise(function(resolve) {
          try { page.objs.get(name, function(o) { resolve(o); }); }
          catch (_) { resolve(null); }
        });
      } catch (_) { obj = null; }
      if (!obj) continue;
      const w = obj.width || (obj.bitmap && obj.bitmap.width) || 0;
      const h = obj.height || (obj.bitmap && obj.bitmap.height) || 0;
      const area = w * h;
      if (!best || area > best.area) best = { obj: obj, w: w, h: h, area: area, name: name };
    }
    if (!best || !best.w || !best.h) { console.log('[OCR] image XObjects not decodable'); return null; }

    const canvas = document.createElement('canvas');
    canvas.width = best.w;
    canvas.height = best.h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, best.w, best.h);
    const drawable = best.obj.bitmap || best.obj.data || best.obj;
    try {
      if (drawable instanceof ImageBitmap || drawable instanceof HTMLImageElement || drawable instanceof HTMLCanvasElement) {
        ctx.drawImage(drawable, 0, 0);
      } else if (drawable && drawable.constructor && /Uint8/.test(drawable.constructor.name)) {
        /* Raw pixel data */
        const imgData = ctx.createImageData(best.w, best.h);
        if (drawable.length === imgData.data.length) {
          imgData.data.set(drawable);
        } else {
          /* RGB → RGBA conversion */
          let di = 0;
          for (let si = 0; si < drawable.length; si += 3) {
            imgData.data[di++] = drawable[si];
            imgData.data[di++] = drawable[si + 1];
            imgData.data[di++] = drawable[si + 2];
            imgData.data[di++] = 255;
          }
        }
        ctx.putImageData(imgData, 0, 0);
      } else {
        console.log('[OCR] image XObject unknown type:', typeof drawable);
        return null;
      }
    } catch (drawErr) {
      console.log('[OCR] drawImage from XObject failed:', drawErr);
      return null;
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    console.log('[OCR] extracted XObject ' + best.w + 'x' + best.h + ', jpeg bytes=' + dataUrl.length);
    window._lastOcrPagePreview = dataUrl;
    return dataUrl.split(',')[1];
  } catch (e) {
    console.log('[OCR] _extractLargestImage exception:', e);
    return null;
  }
}

/* Render settings. LORES is the default pass; a page whose text comes back thin
   is re-rendered at HIRES and tried again, so the cheap setting costs accuracy
   only on pages where it demonstrably did not work. */
const OCR_LORES = { scale: 2.0, maxSide: 2000, quality: 0.85 };
const OCR_HIRES = { scale: 3.0, maxSide: 3000, quality: 0.92 };

/* Under this many non-space characters, a page is treated as "nothing came back"
   and the rescue paths are considered. */
const OCR_THIN_CHARS = 20;

/* A JPEG this lean for its pixel count means pdf.js drew a white page — the
   signature of an image format it cannot decode (JBIG2/JP2). It separates
   "rendering failed, try the embedded image" from "this page really is blank",
   which is what stops a 100-page scan paying for the XObject path on every
   chapter divider. */
const OCR_BLANK_BYTES_PER_MP = 30000;

function _ocrThin(text) {
  return (text || '').replace(/\s+/g, '').length < OCR_THIN_CHARS;
}

async function _renderForOcr(pdfDoc, pageNum, opts) {
  try {
    const page = await pdfDoc.getPage(pageNum);
    const info = {};
    const base64 = await OCREngine.pdfPageToBase64(page, Object.assign({}, opts, { info: info }));
    return { page: page, base64: base64, info: info };
  } catch (err) {
    console.error('[OCR] render failed for page', pageNum, err);
    return { page: null, base64: null, info: {}, error: err };
  }
}

async function parseScannedPDF(pdfDoc, onProgress) {
  if (!OCREngine.isAvailable()) throw { type: 'ocr-unavailable', detail: 'OCR not available' };

  const pageCount = pdfDoc.numPages;
  const words = [];
  const pageWordIndex = [];
  const rawLines = [];

  /* Per-document state. A scanned book is one script and one set of quirks all
     the way through, so each of these is learned once rather than re-tested on
     every page. */
  let lockedScript = null;        /* 'latin' | 'devanagari' | 'both' */
  const scriptVotes = [];
  let xobjectHelped = false;      /* the embedded-image path has rescued a page */
  let xobjectAttempts = 0;
  let hiresPages = 0, rescuePages = 0, xobjectPages = 0;

  const t0 = Date.now();
  let renderMs = 0, ocrMs = 0;

  /* One render is kept in flight ahead of the loop: page N+1 rasterises and
     encodes while ML Kit is working on page N, which are different threads and
     were previously each idle waiting for the other. */
  let pending = _renderForOcr(pdfDoc, 1, OCR_LORES);

  for (let p = 1; p <= pageCount; p++) {
    if (typeof onProgress === 'function') onProgress(p, pageCount);

    const rStart = Date.now();
    const rendered = await pending;
    renderMs += Date.now() - rStart;
    pending = (p < pageCount) ? _renderForOcr(pdfDoc, p + 1, OCR_LORES) : null;

    let pageText = '';
    const oStart = Date.now();
    try {
      if (rendered.base64) {
        if (lockedScript) {
          pageText = await OCREngine.recogniseBase64(rendered.base64, { script: lockedScript });
          /* Rescue: a page the locked script cannot read gets the full two-script
             treatment, so locking can only ever cost time, never text. */
          if (_ocrThin(pageText)) {
            rescuePages++;
            const auto = await OCREngine.recogniseAuto(rendered.base64);
            if (auto.text.length > pageText.length) pageText = auto.text;
          }
        } else {
          const auto = await OCREngine.recogniseAuto(rendered.base64);
          pageText = auto.text;
          if (!_ocrThin(pageText)) {
            scriptVotes.push(auto.script);
            /* Two pages agreeing is enough; three pages is the cap either way. */
            if (scriptVotes.length >= 2 && scriptVotes[scriptVotes.length - 1] === scriptVotes[scriptVotes.length - 2]) {
              lockedScript = auto.script;
            } else if (scriptVotes.length >= 3) {
              lockedScript = scriptVotes.indexOf('both') !== -1 ? 'both' : auto.script;
            }
            if (lockedScript) console.log('[OCR] script locked to ' + lockedScript + ' at page ' + p);
          }
        }

        /* Thin and the page is not blank — the cheap render may simply be too
           small for this scan's print size. Re-render it properly. */
        const looksBlank = typeof rendered.info.bytesPerMP === 'number'
          && rendered.info.bytesPerMP < OCR_BLANK_BYTES_PER_MP;
        if (_ocrThin(pageText) && !looksBlank) {
          const hi = await _renderForOcr(pdfDoc, p, OCR_HIRES);
          if (hi.base64) {
            hiresPages++;
            const hiText = (await OCREngine.recogniseAuto(hi.base64)).text;
            if (hiText.length > pageText.length) pageText = hiText;
          }
        }

        /* Last resort: pull the embedded image off the page. Many scanner PDFs
           (JBIG2/JP2) render blank through pdf.js but the decoded bitmap on
           page.objs is still drawable. Gated, because it is the most expensive
           path in here: tried on the first couple of thin pages so a document
           with this defect is spotted early, and afterwards only when it has
           already worked or the render looks blank. */
        if (_ocrThin(pageText) && rendered.page &&
            (xobjectHelped || looksBlank || xobjectAttempts < 2)) {
          xobjectAttempts++;
          const imgBase64 = await _extractLargestImage(rendered.page);
          if (imgBase64) {
            const altText = await OCREngine.recogniseBase64(imgBase64);
            if (altText.length > pageText.length) {
              pageText = altText;
              if (!_ocrThin(altText)) { xobjectHelped = true; xobjectPages++; }
            }
          }
        }
      }
    } catch (err) {
      console.error('OCR page', p, 'failed:', err);
      pageText = '';
    }
    ocrMs += Date.now() - oStart;
    console.log('[OCR] page ' + p + '/' + pageCount + ' chars=' + pageText.length
      + ' in ' + (Date.now() - oStart) + 'ms');

    pageWordIndex.push(words.length);

    const pageLines = pageText.split('\n').filter(function(l) { return l.trim().length > 0; });
    pageLines.forEach(function(line) {
      const lineWordStart = words.length;
      const lineWords = line.trim().split(/\s+/).filter(Boolean);
      lineWords.forEach(function(w) { words.push(w); });
      if (lineWords.length > 0) {
        rawLines.push({ text: line.trim(), pageIndex: p - 1, wordIndex: lineWordStart });
      }
    });
  }

  const wordCount = words.filter(function(w) { return typeof w === 'string'; }).length;
  const totalMs = Date.now() - t0;
  console.log('[OCR] done: ' + pageCount + ' pages in ' + (totalMs / 1000).toFixed(1) + 's'
    + ' (' + Math.round(totalMs / pageCount) + 'ms/page)'
    + ' | words=' + wordCount
    + ' | script=' + (lockedScript || 'unlocked')
    + ' | render-wait=' + Math.round(renderMs / 1000) + 's ocr=' + Math.round(ocrMs / 1000) + 's'
    + ' | hires-retries=' + hiresPages + ' script-rescues=' + rescuePages + ' xobject-rescues=' + xobjectPages);

  return {
    words: words,
    pageWordIndex: pageWordIndex,
    rawLines: rawLines,
    metadata: {
      pageCount: pageCount,
      wordCount: wordCount,
      hasTextLayer: true,
      sourceType: 'pdf-ocr',
      title: '',
    },
  };
}
