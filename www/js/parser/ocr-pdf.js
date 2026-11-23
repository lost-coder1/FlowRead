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

/* Deciding what scripts a document is written in, before committing to one
   pass per page for the rest of it.

   Both scripts run through the whole window, so nothing in it is lost either
   way -- the window only decides what happens AFTER it. Evidence is taken from
   body pages only: the front of an Indian-published Hindi book is covers, a
   publisher page, an ISBN and a catalogue, which is the only English in the
   book, and judging from those pages calls a Hindi novel bilingual. */
const OCR_DETECT_EVIDENCE_PAGES = 12;
const OCR_DETECT_SKIP_MAX = 8;

/* Evidence that a document contains Devanagari at all. Measured on device: ML
   Kit's Devanagari recognizer reads Latin script as well -- it returned
   'janchetna.books@gmail.com' and 'Website - http://janchetnabooks.org' from a
   Hindi publisher page correctly -- so a document with any Devanagari in it is
   read by that one model, and the Latin pass adds a transliteration of the same
   glyphs. The reverse is not true: the Latin model has no Devanagari glyphs and
   turns a Sanskrit quotation into noise. So Devanagari is the safer primary
   wherever it appears, and 'both' survives only for the case below where the
   Devanagari model is measurably worse on a page's Latin. Two pages, or ten
   words, so that one hallucinated token cannot decide it. */
const OCR_DEV_MIN_PAGES = 2;
const OCR_DEV_MIN_WORDS = 10;

/* A page has to carry at least this many words of a script to count for it. */
const OCR_MIXED_MIN_WORDS_PER_PAGE = 2;

/* On a re-sampled page, how much better the Latin pass has to be before a
   Devanagari-locked document pays for two passes: materially more real Latin
   words than the Devanagari pass found, and enough of them to be a passage
   rather than a caption. */
const OCR_LATIN_BETTER_MARGIN = 1.5;
const OCR_LATIN_BETTER_MIN = 15;

/* Even after locking, one page in this many runs both scripts anyway. The
   quality gate below cannot see a two-line Sanskrit quotation inside a full
   page of English -- the page reads perfectly well, because almost all of it
   did -- so the only way to find a minority script that appears rarely is to
   keep looking. 4% more work, and the upgrade to 'both' is permanent: a
   document is never un-bilingual. */
const OCR_RESAMPLE_EVERY = 25;

function _ocrThin(text) {
  return (text || '').replace(/\s+/g, '').length < OCR_THIN_CHARS;
}

/* Did the locked script actually read this page? Emptiness is not the only way
   a pass fails: the Latin recognizer on a Devanagari page, and the reverse,
   both return plenty of characters of nonsense. So the test is the one
   detection uses -- quality -- and it has to be script-aware, since a perfect
   Devanagari page has no ASCII words and a perfect English one no Devanagari. */
function _needsSecondOpinion(text, script) {
  if (_ocrThin(text)) return true;
  if (script === 'both') return false;       /* both already ran */
  const sc = OCREngine.scoreText(text);
  if (script === 'devanagari') {
    /* Little Devanagari is not itself a problem: this model reads Latin too, so
       an English page inside a Hindi book comes back correct. It is only
       suspicious when what came back is ALSO junk -- then neither script was
       read and the Latin model is worth a try. */
    return sc.devanagariChars < sc.letters * 0.2 && sc.junkRatio > 0.5;
  }
  /* Latin. Sparse pages (a chapter opening) are left alone -- 'few real words'
     is normal there and a second pass on every chapter page is pure cost.
     The threshold is measured, not guessed: clean English prose scores 0.30 on
     this heuristic, because every word under three letters counts against it,
     while Devanagari misread as Latin scores 0.72. Anything near 0.3 would
     re-run half the pages of an English book for nothing. */
  if (sc.tokens < 20) return false;
  return sc.junkRatio > 0.5 || sc.latinWords < 5;
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

/* How many pages the reader is offered before the rest is recognised (§16.32).
   Twenty, and not a number chosen for feel: it is where both cleaning passes
   start working. _ocrRunningLines' threshold is max(3, pages x 0.12), which is
   3 here, so a running head on every page clears it; and OCR_PAGENO_MIN_RUN is
   10, which a numbered twenty-page stretch meets. At ten pages the page-number
   arithmetic would fall below its run and page numbers would survive into the
   prefix only to vanish on the swap -- text changing under the reader, which
   §1.5 forbids. Lowering either threshold to compensate is the mistake §5
   records: loosened numeral rules turned an 86-page book into 61 chapters. */
const OCR_PREFIX_PAGES = 20;

/* Pause between pages while a reader is open. OCR itself is native and off the
   WebView thread, but the pdf.js rasterise before it is not, and it competes
   with Page mode's slab measurement (§4.1 rule 1) in the engine every nudged
   read lands in (§8.5). Measured cost is about 430ms a page, so this roughly
   halves throughput while someone is reading and costs nothing when they are
   not -- and OCR still usually finishes first, since twenty pages is fifteen
   minutes of reading against three minutes of recognising four hundred. */
const OCR_READING_YIELD_MS = 400;

/* Bumped when the checkpoint's shape changes: v1 held the built word arrays,
   v2 the recognised page texts (cleaning happens after the last page), v3 the
   recognised lines with their boxes, which paragraph inference needs. An older
   checkpoint is discarded, costing one interrupted run. */
const OCR_CHECKPOINT_VERSION = 3;

/* opts.resume          a checkpoint from storage.loadOcrCheckpoint()
   opts.onCheckpoint    called with the same shape every OCR_CHECKPOINT_PAGES
   onProgress(page, total, info)  info carries { etaMs, msPerPage } once measured */

/* ── Cleaning OCR output ─────────────────────────────────────
   The text-layer parser strips running headers, footers and page numbers
   (pdf.js §3); the OCR path did none of it, so every scanned book carried its
   furniture in the reading text -- Godaan held 399 footer lines like
   "गोदान / 5" and "6/ गोदान", counted as words and offered to the chapter
   detector as candidates. The frequency test is pdf.js's; what the OCR path
   cannot do is use geometry, because the plugin returns text and no boxes, so
   the header/footer band is the first and last lines of each page in reading
   order rather than a measured strip. */
const OCR_BAND_LINES = 2;
const OCR_RUNNING_SHARE = 0.12;
const OCR_RUNNING_MIN = 3;
const OCR_BAND_MAX_WORDS = 12;

/* A bare numeral is either a page number or a chapter marker, and in a scanned
   book they are the same string. Page numbers are told apart by arithmetic: a
   page-number sequence keeps a constant offset from the page it sits on, while
   Godaan's chapter numbers (2 on page 14, 4 on page 29, 7 on page 83) do not.
   Only the constant-offset ones are stripped; what survives is handed to the
   chapter detector, which checks it forms a sequence of its own. */
/* A constant offset that repeats this many times is page numbering, however
   long the book: an appended catalogue with its own 26 numbered pages is still
   page numbering. Chapter numbers cannot reach it, because pages advance faster
   than chapters do, so every chapter marker sits at its own offset. */
const OCR_PAGENO_MIN_RUN = 10;
const OCR_BARE_NUMERAL = /^[\s.:\u2014-]*([0-9]{1,4}|[\u0966-\u096F]{1,4})[.):]?[\s.:\u2014-]*$/;

/* A page whose text arrived without boxes -- the embedded-image fallback, or a
   merged second script. Such a line cannot start a paragraph by geometry, and
   paragraphs.js's line-length inference is the backstop for the page. */
function _ocrLinesFromText(text) {
  return String(text || '').split('\n')
    .map(function(l) { return { text: l.trim() }; })
    .filter(function(l) { return l.text.length > 0; });
}

function _ocrNumeralValue(text) {
  const m = text.match(OCR_BARE_NUMERAL);
  if (!m) return null;
  let digits = '';
  for (let i = 0; i < m[1].length; i++) {
    const code = m[1].charCodeAt(i);
    digits += (code >= 0x0966 && code <= 0x096F) ? String(code - 0x0966) : m[1].charAt(i);
  }
  const value = parseInt(digits, 10);
  return isNaN(value) ? null : value;
}

/* Lines that recur in the band across the book: the running head and footer. */
function _ocrRunningLines(pages) {
  const freq = {};
  for (let p = 0; p < pages.length; p++) {
    const lines = pages[p];
    for (let i = 0; i < lines.length; i++) {
      const inBand = i < OCR_BAND_LINES || i >= lines.length - OCR_BAND_LINES;
      if (!inBand) continue;
      const text = lines[i].text;
      if (text.split(/\s+/).length > OCR_BAND_MAX_WORDS) continue;
      /* A bare numeral normalises to '#', which recurs on every page that has
         one, so the frequency test would sweep up the chapter markers along
         with the page numbers. Numerals are decided by arithmetic below. */
      if (_ocrNumeralValue(text) !== null) continue;
      const norm = normalizeLine(text);
      if (!norm) continue;
      freq[norm] = (freq[norm] || 0) + 1;
    }
  }
  const threshold = Math.max(OCR_RUNNING_MIN, pages.length * OCR_RUNNING_SHARE);
  const running = new Set();
  Object.keys(freq).forEach(function(norm) {
    if (freq[norm] >= threshold) running.add(norm);
  });
  return running;
}

/* Bare numerals whose value keeps a constant offset from their page number. */
function _ocrPageNumberLines(pages) {
  const byOffset = {};
  const found = [];
  for (let p = 0; p < pages.length; p++) {
    const lines = pages[p];
    for (let i = 0; i < lines.length; i++) {
      const value = _ocrNumeralValue(lines[i].text);
      if (value === null) continue;
      const offset = value - (p + 1);
      found.push({ page: p, line: i, offset: offset });
      byOffset[offset] = (byOffset[offset] || 0) + 1;
    }
  }
  const numbering = {};
  Object.keys(byOffset).forEach(function(offset) {
    if (byOffset[offset] >= OCR_PAGENO_MIN_RUN) numbering[offset] = byOffset[offset];
  });
  const stripped = new Set();
  for (let k = 0; k < found.length; k++) {
    if (numbering[found[k].offset]) stripped.add(found[k].page + ':' + found[k].line);
  }
  console.log('[OCR] page-number lines: ' + stripped.size + ' of ' + found.length
    + ' bare numerals (offsets ' + JSON.stringify(numbering) + ')');
  return stripped;
}

/* Build the reader's arrays from the recognised page texts. Done in one pass at
   the end rather than per page, because "does this line recur across the book?"
   cannot be answered while the book is still being read. */
function _ocrBuild(pageLines) {
  /* A plain loop, not map: a sparse array (a hole from JSON, or a page whose
     render failed) keeps its holes through map and would crash the frequency
     pass. Every page must contribute an entry, even an empty one, because
     pageWordIndex is positional. */
  const pages = [];
  for (let i = 0; i < pageLines.length; i++) {
    const lines = Array.isArray(pageLines[i]) ? pageLines[i] : [];
    const kept = [];
    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      const text = String((line && line.text) || '').trim();
      if (!text) continue;
      kept.push({ text: text, x0: line && line.x0, x1: line && line.x1, y: line && line.y });
    }
    pages.push(kept);
  }

  const running = _ocrRunningLines(pages);
  const pageNumbers = _ocrPageNumberLines(pages);
  console.log('[OCR] running head/foot lines: ' + running.size + ' distinct');

  /* The same two functions the text-layer parser uses, on boxes normalised to
     0..1000 of the page width. One definition of what a paragraph start is
     (§5) -- the OCR path only has to supply x0/x1 and the furniture set. */
  const geom = measureParagraphGeometry(pages.map(function(lines) {
    return { lines: lines };
  }), running);
  /* See _isParagraphStart: a block's extent is not a line of type's extent, so
     some rules written for PDF geometry do not hold on these boxes. */
  if (geom) geom.fromOcr = true;
  console.log('[OCR] paragraph geometry: ' + (geom
    ? ('indent past ' + geom.indentFrom.toFixed(0) + ', short before ' + geom.shortBefore.toFixed(0))
    : 'not measurable, paragraphs will be inferred from line lengths'));

  const words = [];
  const pageWordIndex = [];
  const rawLines = [];
  let dropped = 0;
  let paraStarts = 0;
  /* Carried across the page boundary: a paragraph does not end because a page did. */
  let prevKept = null;

  for (let p = 0; p < pages.length; p++) {
    pageWordIndex.push(words.length);
    const lines = pages[p];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const text = line.text;
      if (running.has(normalizeLine(text))) { dropped++; continue; }
      if (pageNumbers.has(p + ':' + i)) { dropped++; continue; }
      /* isNoiseLine strips every bare numeral, which here would take the
         chapter markers with the page numbers -- those are handled above. */
      if (_ocrNumeralValue(text) === null && isNoiseLine(text)) { dropped++; continue; }

      const lineWordStart = words.length;
      const lineWords = text.split(/\s+/).filter(Boolean);
      for (let w = 0; w < lineWords.length; w++) words.push(lineWords[w]);
      if (lineWords.length > 0) {
        const entry = { text: text, pageIndex: p, wordIndex: lineWordStart };
        /* Only claim paragraph structure when the geometry could be measured.
           paragraphs.js treats a single truthy paraStart anywhere as proof the
           parser recorded them all, so flagging just the first line of an
           unmeasurable book would make the whole book one paragraph -- worse
           than the line-length inference it would have used instead. */
        if (geom) {
          entry.paraStart = _isParagraphStart(line, prevKept, geom, rawLines.length === 0);
          if (entry.paraStart) paraStarts++;
        }
        rawLines.push(entry);
        prevKept = line;
      }
    }
  }

  console.log('[OCR] cleaning dropped ' + dropped + ' lines of furniture; '
    + (geom ? (paraStarts + ' paragraph starts in ' + rawLines.length + ' lines')
            : 'paragraphs left to line-length inference'));

  return { words: words, pageWordIndex: pageWordIndex, rawLines: rawLines };
}

/* The first N pages as a complete, independently cleaned book.

   This needs no second code path because _ocrBuild is a pure function of a page
   array: pages 1..N are a whole book to it, so the prefix is cleaned,
   paragraphed and chapter-detected exactly as a finished book is -- not shown
   raw while cleaning catches up. That is the property the whole feature rests
   on, and it is why the prefix shape was chosen over a reader that grows.

   What it cannot be is *identical* to the same pages inside the full build.
   Every document-wide question gets a different answer from a shorter document:
   a line recurring three times in twenty pages is furniture at threshold 3 and
   is kept by the full build at 52; paragraph geometry measured over front
   matter is not the body's; and §5 rule 5 needs a run of three bare numerals
   before it will call them chapters. All of it resolves at the swap, which is
   why the swap is a deliberate tap and never silent. */
function buildOcrPrefix(pageLines, pages, fullPageCount) {
  const slice = pageLines.slice(0, pages);
  const built = _ocrBuild(slice);
  const wordCount = built.words.filter(function(w) { return typeof w === 'string'; }).length;
  return {
    words: built.words,
    pageWordIndex: built.pageWordIndex,
    rawLines: built.rawLines,
    metadata: {
      pageCount: pages,
      wordCount: wordCount,
      hasTextLayer: true,
      sourceType: 'pdf-ocr',
      hasLegacyEncoding: false,
      hasBrokenGlyphs: false,
      title: '',
      /* The flag every other system keys off. Its presence is what suppresses
         the completion floor (§4.2), keeps book_finished unfired (§8.6) and
         bounds Normal view -- and, saved with the file, what lets a killed
         process be told from a finished import. */
      ocrPartial: { pagesDone: pages, pageCount: fullPageCount },
    },
  };
}

async function parseScannedPDF(pdfDoc, onProgress, opts) {
  if (!OCREngine.isAvailable()) throw { type: 'ocr-unavailable', detail: 'OCR not available' };

  const o = opts || {};
  const pageCount = pdfDoc.numPages;
  /* One array of recognised lines per page, in page order, each line carrying
     its box where the recogniser gave one. The reader's arrays are built from
     these at the end, because the cleaning pass asks whether a line recurs
     across the whole book -- a question that has no answer mid-run -- and the
     paragraph geometry is measured over the whole book too. */
  let pageLines = [];
  let startPage = 1;

  /* Resume a run that was interrupted. A prefix of pageLines is exactly what
     the first N pages produced, and is trusted only if its own bookkeeping
     agrees: the checkpoint format is versioned, so one written by an older
     parser is discarded rather than misread. */
  const resume = o.resume;
  if (resume && resume.v === OCR_CHECKPOINT_VERSION
      && resume.pagesDone > 0 && resume.pagesDone < pageCount
      && Array.isArray(resume.pageLines)
      && resume.pageLines.length === resume.pagesDone
      && resume.pageCount === pageCount) {
    pageLines = resume.pageLines;
    startPage = resume.pagesDone + 1;
    console.log('[OCR] resuming at page ' + startPage + '/' + pageCount);
  }

  /* Per-document state. A scanned book is one script and one set of quirks all
     the way through, so each of these is learned once rather than re-tested on
     every page. */
  let lockedScript = (resume && startPage > 1 && resume.lockedScript) || null;
  /* Evidence for the lock, accumulated over the detection window (body pages). */
  let detectDevWords = 0, detectLatinWords = 0, detectSamples = 0;
  let detectDevPages = 0, detectLatinPages = 0;
  const detectSkipTo = Math.min(OCR_DETECT_SKIP_MAX, Math.floor(pageCount * 0.05));
  const detectFrom = Math.max(startPage, detectSkipTo + 1);
  const detectUntil = Math.min(pageCount, detectFrom + OCR_DETECT_EVIDENCE_PAGES - 1);
  let xobjectHelped = false;      /* the embedded-image path has rescued a page */
  let xobjectAttempts = 0;
  let hiresPages = 0, rescuePages = 0, xobjectPages = 0, resamplePages = 0;

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

  /* The prefix is offered once, the moment enough contiguous pages exist. A
     resumed run may already be past the mark on its first iteration, which is
     why this is tested in the loop rather than counted up to. */
  let prefixOffered = pageCount <= OCR_PREFIX_PAGES;   /* nothing to offer on a short book */
  /* Contiguous pages from the front. Equal to the loop counter in an ordinary
     run and to the resume point in a resumed one, which is why it is tracked
     rather than inferred from pageLines.length -- that array is positional and
     a resumed run fills it from the checkpoint, holes and all. */
  let pagesRecognised = startPage - 1;

  function _maybeOfferPrefix(pagesDone) {
    if (prefixOffered || typeof o.onPrefixReady !== 'function') return;
    if (pagesDone < OCR_PREFIX_PAGES) return;
    prefixOffered = true;
    try {
      o.onPrefixReady({
        firstPages: OCR_PREFIX_PAGES,
        pageCount: pageCount,
        /* A live handle on the run, not a one-shot thunk. The reader can come
           back for more: the owner's point is that the first twenty pages of a
           scan are mostly title, acknowledgements, contents and foreword, so a
           reader skims them in a minute and is back to waiting. `pagesDone`
           reports what the run has reached *now*, and `build` takes any prefix
           of it -- each one a whole book to _ocrBuild, exactly as the first was.
           Nothing is built until it is asked for: a cleaning pass over the
           pages costs real time and most runs are never extended. */
        pagesDone: function() { return pagesRecognised; },
        build: function(n) {
          const upTo = Math.max(1, Math.min(n || OCR_PREFIX_PAGES, pagesRecognised));
          return buildOcrPrefix(pageLines, upTo, pageCount);
        },
      });
    } catch (e) {
      /* An offer that cannot be drawn is not a failed import. */
      console.warn('[OCR] prefix offer failed:', e);
    }
  }

  _maybeOfferPrefix(startPage - 1);

  for (let p = startPage; p <= pageCount; p++) {
    /* Reading is what the wait exists to reach, so it wins the thread. Only
       ever a yield between pages -- never a pause that could strand the run,
       since nothing restarts it but this loop. */
    if (typeof o.shouldYield === 'function' && o.shouldYield()) {
      await new Promise(function(r) { setTimeout(r, OCR_READING_YIELD_MS); });
    }

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
    /* The recognised lines with their boxes, when the pass that produced the
       surviving text also produced geometry. */
    let pageLineObjs = null;
    const oStart = Date.now();
    try {
      if (rendered.base64) {
        /* One page in OCR_RESAMPLE_EVERY keeps checking for the other script. */
        const resampling = !!lockedScript && lockedScript !== 'both'
          && p % OCR_RESAMPLE_EVERY === 0;

        if (lockedScript && lockedScript !== 'both' && !resampling) {
          const single = await OCREngine.recogniseLines(rendered.base64, lockedScript);
          pageText = single.text;
          pageLineObjs = single.lines;
          /* A page the locked script could not read gets the other one, so
             locking can cost time but never a page. This catches a whole page
             in the other script -- the publisher page in a Hindi book, a page
             of Sanskrit in an English one -- and nothing smaller: a two-line
             quotation leaves the page reading well, because almost all of it
             did. That case is OCR_RESAMPLE_EVERY's job, not this gate's. */
          if (_needsSecondOpinion(pageText, lockedScript)) {
            rescuePages++;
            const other = lockedScript === 'latin' ? 'devanagari' : 'latin';
            const rescue = await OCREngine.recogniseLines(rendered.base64, other);
            const merged = lockedScript === 'latin'
              ? OCREngine.combine(rescue.text, pageText)
              : OCREngine.combine(pageText, rescue.text);
            /* Keep the boxes of whichever text survived whole; a merge of both
               has no single geometry, so the page falls back to inference. */
            if (merged === pageText) { /* unchanged */ }
            else if (merged === rescue.text) { pageText = merged; pageLineObjs = rescue.lines; }
            else { pageText = merged; pageLineObjs = null; }
          }
        } else {
          /* Unlocked, locked to 'both', or re-sampling: run both, keep both. */
          const both = await OCREngine.recogniseBoth(rendered.base64);
          pageText = both.text;
          pageLineObjs = both.lines;

          if (resampling) {
            resamplePages++;
            if (lockedScript === 'latin' && both.dev.devWords >= OCR_MIXED_MIN_WORDS_PER_PAGE) {
              /* Devanagari turned up in a document that looked English. Switch
                 to the model that reads both scripts rather than paying for
                 two passes. */
              console.log('[OCR] page ' + p + ' carries ' + both.dev.devWords
                + ' devanagari words - switching to the devanagari pass, which reads both');
              lockedScript = 'devanagari';
            } else if (lockedScript === 'devanagari'
                && both.latin.latinWords >= OCR_LATIN_BETTER_MIN
                && both.latin.latinWords > both.dev.realWords * OCR_LATIN_BETTER_MARGIN) {
              /* The one case that needs two passes: the Devanagari model is
                 under-reading this book's Latin. */
              console.log('[OCR] page ' + p + ': latin pass found '
                + both.latin.latinWords + ' words against ' + both.dev.realWords
                + ' - upgrading to both scripts for the rest of the book');
              lockedScript = 'both';
            }
          }

          if (!lockedScript && p >= detectFrom && !_ocrThin(pageText)) {
            /* Evidence, not a vote: what each script contributed in *real*
               words. A Latin pass reading Devanagari scores almost none, which
               is what separates a bilingual book from a misread monolingual
               one -- and it is counted per page, not per word, so a handful of
               Sanskrit quotations still register. */
            detectDevWords += both.dev.devWords;
            detectLatinWords += both.latin.latinWords;
            if (both.dev.devWords >= OCR_MIXED_MIN_WORDS_PER_PAGE) detectDevPages++;
            if (both.latin.latinWords >= OCR_MIXED_MIN_WORDS_PER_PAGE) detectLatinPages++;
            detectSamples++;
          }
          if (!lockedScript && p >= detectUntil && detectSamples > 0) {
            const devSeen = detectDevPages >= OCR_DEV_MIN_PAGES
              || detectDevWords >= OCR_DEV_MIN_WORDS;
            lockedScript = devSeen ? 'devanagari' : 'latin';
            console.log('[OCR] script locked to ' + lockedScript + ' at page ' + p
              + ' (' + detectSamples + ' body pages sampled from ' + detectFrom
              + ': dev words=' + detectDevWords + ' on ' + detectDevPages + ' pages'
              + ', latin words=' + detectLatinWords + ' on ' + detectLatinPages + ' pages)');
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
            const hiRes = await OCREngine.recogniseBoth(hi.base64);
            if (hiRes.text.length > pageText.length) {
              pageText = hiRes.text;
              pageLineObjs = hiRes.lines;
            }
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
              /* A different image entirely, so its boxes would not line up with
                 the rest of the document's geometry. */
              pageLineObjs = null;
              if (!_ocrThin(altText)) { xobjectHelped = true; xobjectPages++; }
            }
          }
        }
      }
    } catch (err) {
      console.error('OCR page', p, 'failed:', err);
      pageText = '';
      pageLineObjs = null;
    }
    ocrMs += Date.now() - oStart;
    console.log('[OCR] page ' + p + '/' + pageCount + ' chars=' + pageText.length
      + ' in ' + (Date.now() - oStart) + 'ms');

    pageLines[p - 1] = (pageLineObjs && pageLineObjs.length)
      ? pageLineObjs
      : _ocrLinesFromText(pageText);

    /* Recorded before the checkpoint below, which is not part of the per-page
       cost and grows with the book -- counting it would make the estimate
       climb as the run progresses. The first page of a run is skipped: it
       carries ML Kit's model load and is not representative of the rest. */
    if (p > startPage) {
      recentPageMs.push(Date.now() - pageStart);
      if (recentPageMs.length > ETA_WINDOW) recentPageMs.shift();
    }

    pagesRecognised = p;
    _maybeOfferPrefix(p);

    if (typeof o.onCheckpoint === 'function'
        && p < pageCount
        && (p - startPage + 1) % OCR_CHECKPOINT_PAGES === 0) {
      try {
        await o.onCheckpoint({
          v: OCR_CHECKPOINT_VERSION,
          pagesDone: p,
          pageCount: pageCount,
          lockedScript: lockedScript,
          pageLines: pageLines,
        });
      } catch (e) {
        /* A checkpoint that cannot be written is not a failed import. */
        console.warn('[OCR] checkpoint failed:', e);
      }
    }
  }

  const built = _ocrBuild(pageLines);
  const words = built.words;
  const wordCount = words.filter(function(w) { return typeof w === 'string'; }).length;
  const totalMs = Date.now() - t0;
  const pagesThisRun = pageCount - startPage + 1;
  console.log('[OCR] done: ' + pagesThisRun + ' pages in ' + (totalMs / 1000).toFixed(1) + 's'
    + ' (' + Math.round(totalMs / Math.max(1, pagesThisRun)) + 'ms/page)'
    + (startPage > 1 ? ' [resumed at ' + startPage + ' of ' + pageCount + ']' : '')
    + ' | words=' + wordCount
    + ' | script=' + (lockedScript || 'unlocked')
    + ' | render-wait=' + Math.round(renderMs / 1000) + 's ocr=' + Math.round(ocrMs / 1000) + 's'
    + ' | hires-retries=' + hiresPages + ' script-rescues=' + rescuePages
    + ' resamples=' + resamplePages + ' xobject-rescues=' + xobjectPages);

  return {
    words: words,
    pageWordIndex: built.pageWordIndex,
    rawLines: built.rawLines,
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
      hasBrokenGlyphs: false,
      title: '',
    },
  };
}

/* The import flow's single entry point for OCR'ing a scanned PDF.
   Owns the four things every call site needs and none of them should repeat:
   resuming an interrupted run, checkpointing, the overlay's page counter and
   progress bar, the rotating tips that fill the wait (§22), and clearing the
   checkpoint once there is nothing to resume.
   Failures propagate -- the checkpoint is deliberately LEFT behind, since the
   whole point is that the next attempt does not start from page one. */
async function ocrScannedPdf(pdfDoc, fileId) {
  let resume = null;
  if (fileId) {
    try { resume = await loadOcrCheckpoint(fileId); } catch (_) { resume = null; }
  }

  /* Set the moment the reader takes the prefix. After that this run no longer
     owns the loading overlay and must stop writing to it.

     It is a shared, global surface with seven writers -- the OCR counter here,
     free-books.js's download percentage and its page-parse counter, and four in
     upload.js -- and before Phase 2 only one of them could ever be running. A
     background run that keeps painting into it produces two counters
     alternating in one label a few times a second: "page 19", "page 235",
     "page 20". Reported on device against a Hindi book, which is simply where
     scanned books are; nothing about it is Hindi, and nothing about it is the
     page numbering. From here the run reports to the reader's own bar instead,
     which is where a background job's progress belongs. */
  let handedOff = false;

  const onProgress = function(current, total, info) {
    if (handedOff) {
      if (typeof OcrProgressive !== 'undefined') {
        OcrProgressive.onBackgroundProgress(current, total, info);
      }
      return;
    }
    const msg = qs('#loading-message');
    if (msg) msg.textContent = t('loading.ocr_page', { current: current, total: total });
    if (typeof setLoadingProgress === 'function') {
      setLoadingProgress((current - 1) / Math.max(1, total), info && info.etaMs);
    }
  };

  /* Started here rather than at the four call sites: this function exists so
     none of them has to repeat the overlay's bookkeeping, and the tips are more
     of it. Stopped in the finally, so a failed or cancelled import cannot leave
     an interval rotating against a hidden node. */
  if (typeof OcrWaitTips !== 'undefined') OcrWaitTips.start();

  /* ── Reading before the end (§16.32) ──────────────────────────────────
     The whole feature is here, and it is deliberately shaped so that **no call
     site changes**. All four of them do the same thing with what this returns:
     merge it into the file, save it, open the reader. Handing them a twenty-page
     book instead of a four-hundred-page one needs none of that code to know,
     which is worth more than any amount of plumbing -- `free-books.js` and the
     three in `upload.js` diverge afterwards, and four edited copies of a swap
     dance is four places to get it wrong.

     So: one promise with two ways to settle. Whichever of "the user tapped Start
     reading" and "OCR finished" happens first is what the caller receives. If it
     was the prefix, the full run keeps going and OcrProgressive takes ownership
     of it -- including the checkpoint, which must not be deleted while a run is
     still using it. */
  let settlePrefix = null;
  const prefixTap = new Promise(function(resolve) { settlePrefix = resolve; });

  const fullRun = parseScannedPDF(pdfDoc, onProgress, {
    resume: resume,
    onCheckpoint: fileId ? function(state) { return saveOcrCheckpoint(fileId, state); } : null,
    /* Politeness only applies once someone is actually reading. */
    shouldYield: function() {
      return typeof AppState !== 'undefined' && AppState.currentView === 'view-reader';
    },
    onPrefixReady: function(offer) {
      if (typeof OcrProgressive === 'undefined') return;
      OcrProgressive.offer(offer, settlePrefix);
    },
  });

  /* A rejection reaching nobody is an unhandled rejection that can kill the
     background run silently. Attached now, before any await, so the window in
     which that is possible never opens. */
  let fullFailed = null;
  const fullSettled = fullRun.catch(function(err) { fullFailed = err; return null; });

  try {
    const outcome = await Promise.race([
      fullSettled.then(function(r) { return { full: r }; }),
      prefixTap.then(function(r) { return { prefix: r }; }),
    ]);

    if (outcome.prefix) {
      /* Before anything else: the overlay stops being this run's to write to. */
      handedOff = true;
      /* The checkpoint stays: the run that is still going is the one using it,
         and OcrProgressive deletes it when that run lands. */
      OcrProgressive.watch(fileId, fullSettled, function() { return fullFailed; });
      return outcome.prefix;
    }

    if (fullFailed) throw fullFailed;
    if (fileId) await deleteOcrCheckpoint(fileId);
    return outcome.full;
  } finally {
    if (typeof OcrWaitTips !== 'undefined') OcrWaitTips.stop();
    if (typeof clearLoadingProgress === 'function') clearLoadingProgress();
    if (typeof OcrProgressive !== 'undefined') OcrProgressive.hideOffer();
  }
}
