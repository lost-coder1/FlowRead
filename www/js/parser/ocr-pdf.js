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

/* Pages between checkpoints. Low enough that an interruption costs seconds of
   work, high enough that the writes are a rounding error against OCR itself. */
const OCR_CHECKPOINT_PAGES = 20;

/* opts.resume          a checkpoint from storage.loadOcrCheckpoint()
   opts.onCheckpoint    called with the same shape every OCR_CHECKPOINT_PAGES
   onProgress(page, total, info)  info carries { etaMs, msPerPage } once measured */
async function parseScannedPDF(pdfDoc, onProgress, opts) {
  if (!OCREngine.isAvailable()) throw { type: 'ocr-unavailable', detail: 'OCR not available' };

  const o = opts || {};
  const pageCount = pdfDoc.numPages;
  let words = [];
  let pageWordIndex = [];
  let rawLines = [];
  let startPage = 1;

  /* Resume a run that was interrupted. The three arrays are append-only, so a
     prefix of them is exactly what the first N pages would have produced; the
     checkpoint is trusted only if its page bookkeeping is self-consistent. */
  const resume = o.resume;
  if (resume && resume.pagesDone > 0 && resume.pagesDone < pageCount
      && Array.isArray(resume.words) && Array.isArray(resume.pageWordIndex)
      && Array.isArray(resume.rawLines)
      && resume.pageWordIndex.length === resume.pagesDone
      && resume.pageCount === pageCount) {
    words = resume.words;
    pageWordIndex = resume.pageWordIndex;
    rawLines = resume.rawLines;
    startPage = resume.pagesDone + 1;
    console.log('[OCR] resuming at page ' + startPage + '/' + pageCount
      + ' with ' + words.length + ' words already read');
  }

  /* Per-document state. A scanned book is one script and one set of quirks all
     the way through, so each of these is learned once rather than re-tested on
     every page. */
  let lockedScript = (resume && startPage > 1 && resume.lockedScript) || null;
  const scriptVotes = [];
  let xobjectHelped = false;      /* the embedded-image path has rescued a page */
  let xobjectAttempts = 0;
  let hiresPages = 0, rescuePages = 0, xobjectPages = 0;

  const t0 = Date.now();
  let renderMs = 0, ocrMs = 0;

  /* ETA state. A cumulative mean was swinging between 15 and 5 minutes: the
     first page of a run carries ML Kit's model load and pdf.js's worker
     warmup, and every twentieth page carries a checkpoint write that grows
     with the book. So: measure each page on its own, drop the first one,
     take the median of the recent ones rather than the mean (one slow page
     must not move the figure), and ease the displayed value towards it. */
  const ETA_WINDOW = 12;
  const recentPageMs = [];
  let etaShown = 0;

  function _etaFor(pagesLeft) {
    if (!recentPageMs.length || pagesLeft <= 0) return 0;
    const sorted = recentPageMs.slice().sort(function(a, b) { return a - b; });
    const median = sorted[Math.floor(sorted.length / 2)];
    const estimate = median * pagesLeft;
    etaShown = etaShown > 0 ? (etaShown * 0.7 + estimate * 0.3) : estimate;
    return etaShown;
  }

  /* One render is kept in flight ahead of the loop: page N+1 rasterises and
     encodes while ML Kit is working on page N, which are different threads and
     were previously each idle waiting for the other. */
  let pending = _renderForOcr(pdfDoc, startPage, OCR_LORES);

  for (let p = startPage; p <= pageCount; p++) {
    /* ETA from this run's own measured pages, so it reflects this document's
       page size and script rather than a guess. Blank until there is something
       to measure -- a made-up figure is the §1.5 failure, not a missing one. */
    const pageStart = Date.now();
    if (typeof onProgress === 'function') {
      onProgress(p, pageCount, { etaMs: _etaFor(pageCount - p + 1) });
    }

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

    /* Recorded before the checkpoint below, which is not part of the per-page
       cost and grows with the book -- counting it would make the estimate
       climb as the run progresses. The first page of a run is skipped: it
       carries ML Kit's model load and is not representative of the rest. */
    if (p > startPage) {
      recentPageMs.push(Date.now() - pageStart);
      if (recentPageMs.length > ETA_WINDOW) recentPageMs.shift();
    }

    if (typeof o.onCheckpoint === 'function'
        && p < pageCount
        && (p - startPage + 1) % OCR_CHECKPOINT_PAGES === 0) {
      try {
        await o.onCheckpoint({
          pagesDone: p,
          pageCount: pageCount,
          lockedScript: lockedScript,
          words: words,
          pageWordIndex: pageWordIndex,
          rawLines: rawLines,
        });
      } catch (e) {
        /* A checkpoint that cannot be written is not a failed import. */
        console.warn('[OCR] checkpoint failed:', e);
      }
    }
  }

  const wordCount = words.filter(function(w) { return typeof w === 'string'; }).length;
  const totalMs = Date.now() - t0;
  const pagesThisRun = pageCount - startPage + 1;
  console.log('[OCR] done: ' + pagesThisRun + ' pages in ' + (totalMs / 1000).toFixed(1) + 's'
    + ' (' + Math.round(totalMs / Math.max(1, pagesThisRun)) + 'ms/page)'
    + (startPage > 1 ? ' [resumed at ' + startPage + ' of ' + pageCount + ']' : '')
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
      /* The legacy-encoding flag describes the PDF's own text layer, which this
         result has just replaced. Left true, it merges through into the imported
         file and the reader shows a banner offering to fix the text with OCR --
         the five minutes the user has just waited through. */
      hasLegacyEncoding: false,
      title: '',
    },
  };
}

/* The import flow's single entry point for OCR'ing a scanned PDF.
   Owns the four things every call site needs and none of them should repeat:
   resuming an interrupted run, checkpointing, the overlay's page counter and
   progress bar, and clearing the checkpoint once there is nothing to resume.
   Failures propagate -- the checkpoint is deliberately LEFT behind, since the
   whole point is that the next attempt does not start from page one. */
async function ocrScannedPdf(pdfDoc, fileId) {
  let resume = null;
  if (fileId) {
    try { resume = await loadOcrCheckpoint(fileId); } catch (_) { resume = null; }
  }

  const onProgress = function(current, total, info) {
    const msg = qs('#loading-message');
    if (msg) msg.textContent = t('loading.ocr_page', { current: current, total: total });
    if (typeof setLoadingProgress === 'function') {
      setLoadingProgress((current - 1) / Math.max(1, total), info && info.etaMs);
    }
  };

  try {
    const result = await parseScannedPDF(pdfDoc, onProgress, {
      resume: resume,
      onCheckpoint: fileId ? function(state) { return saveOcrCheckpoint(fileId, state); } : null,
    });
    if (fileId) await deleteOcrCheckpoint(fileId);
    return result;
  } finally {
    if (typeof clearLoadingProgress === 'function') clearLoadingProgress();
  }
}
