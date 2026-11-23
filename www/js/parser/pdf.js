/* PDF text extraction, cleaning, and word array builder */
/* Returns: { words, pageWordIndex, rawLines, metadata } */

async function parsePDF(arrayBuffer) {
  let pdfDoc;

  /* ── 1. Load document ─────────────────────────────────────── */
  try {
    /* Convert ArrayBuffer → Uint8Array — pdf.js 4.x requires typed array */
    const data = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
    pdfDoc = await pdfjsLib.getDocument({ data }).promise;
  } catch (err) {
    console.error('pdfjsLib.getDocument error:', err);
    if (err.name === 'PasswordException' || (err.message && err.message.toLowerCase().includes('password'))) {
      throw { type: 'password' };
    }
    throw { type: 'corrupted', detail: err.message || String(err) };
  }

  const numPages = pdfDoc.numPages;
  const allPageData = []; /* [{ lines: [{text, y, isHeader, isFooter}], pageHeight }] */

  /* ── 2. Extract text items from each page ─────────────────── */
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;
    const content = await page.getTextContent();

    const items = content.items
      .filter(item => item.str && item.str.trim().length > 0)
      .map(item => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width || 0,
      }));

    const pageFontNames = content.items.map(item => item.fontName || '').filter(Boolean);
    const lines = groupIntoLines(items, pageHeight);
    allPageData.push({ lines, pageHeight, fontNames: pageFontNames });

    /* Emit progress for loading indicator */
    if (typeof window._pdfParseProgress === 'function') {
      window._pdfParseProgress(pageNum, numPages);
    }
  }

  /* ── 3. Detect repeating headers and footers ──────────────── */
  const headerFooterSet = detectHeadersFooters(allPageData, numPages);
  console.log('[parsePDF] stripping headers/footers:', Array.from(headerFooterSet));

  /* ── 4. Build word array with pageWordIndex ───────────────── */
  const words = [];
  const pageWordIndex = [];
  const rawLines = [];

  const paraGeom = measureParagraphGeometry(allPageData, headerFooterSet);
  /* The line before this one, carried across page boundaries — a paragraph does
     not end just because a page did. */
  let prevKept = null;
  let totalWordCount = 0;

  for (let i = 0; i < allPageData.length; i++) {
    pageWordIndex.push(words.length);
    const { lines } = allPageData[i];
    const tableRanges = detectTableRanges(lines);
    let tableRangeCursor = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];

      const tableRange = tableRanges[tableRangeCursor];
      if (tableRange && lineIdx >= tableRange.start && lineIdx <= tableRange.end) {
        if (lineIdx === tableRange.start) {
          words.push({
            type: 'placeholder',
            label: '[Table detected — Tap to View]',
            page: i + 1,
          });
        }
        if (lineIdx === tableRange.end) {
          tableRangeCursor++;
        }
        continue;
      }

      const normalized = normalizeLine(line.text);
      if (headerFooterSet.has(normalized)) continue;
      if (isNoiseLine(line.text)) continue;

      const isParaStart = _isParagraphStart(line, prevKept, paraGeom, rawLines.length === 0);
      /* Diagnostic: a paragraph that starts on a short line whose predecessor
         ran the full measure is the symptom reported on English PDFs -- a
         sentence's last word stranded as its own paragraph. Collect the
         geometry of the first few so the cause can be read rather than
         guessed; _paraOddities is logged once at the end of the parse. */
      if (isParaStart && paraGeom && prevKept && _paraOddities.length < 12
          && line.text.split(/\s+/).length <= 3
          && typeof prevKept.x1 === 'number' && prevKept.x1 >= paraGeom.shortBefore) {
        _paraOddities.push({
          text: line.text.slice(0, 30),
          x0: typeof line.x0 === 'number' ? Math.round(line.x0) : null,
          x1: typeof line.x1 === 'number' ? Math.round(line.x1) : null,
          prevX0: typeof prevKept.x0 === 'number' ? Math.round(prevKept.x0) : null,
          prevX1: Math.round(prevKept.x1),
          dy: (typeof line.y === 'number' && typeof prevKept.y === 'number')
            ? Math.round(Math.abs(prevKept.y - line.y) * 10) / 10 : null,
          gap: Math.round(paraGeom.lineGap * 10) / 10,
        });
      }
      rawLines.push({
        text: line.text,
        pageIndex: i,
        wordIndex: words.length,
        paraStart: isParaStart,
      });
      prevKept = line;

      const lineWords = line.text.split(/\s+/).filter(w => w.length > 0);
      for (const w of lineWords) {
        /* Merge punctuation-only tokens (e.g. standalone '?' or ',') with the
           previous word so RSVP never flashes a bare punctuation character */
        if (/^[^\p{L}\p{N}]+$/u.test(w) && words.length > 0 && typeof words[words.length - 1] === 'string') {
          words[words.length - 1] += w;
        } else {
          words.push(w);
        }
      }
      totalWordCount += lineWords.length;
    }
  }

  /* ── 5. Detect if PDF has a real text layer ───────────────── */
  const avgWordsPerPage = totalWordCount / numPages;

  /* Scanner apps embed their own (often garbage) OCR text layer. Detect known
     watermarks AND text-quality signals so we can route to our ML Kit OCR. */
  const SCANNER_WATERMARK = /scanned (with|by|using)|camscanner|adobe scan|office lens|microsoft lens|scanner pro|scanbot|genius scan|tap ?scanner|clear ?scanner|tiny scanner|simple scanner|pdf scanner/i;
  const fullText = rawLines.map(function(l) { return l.text; }).join(' ');
  const hasScannerWatermark = SCANNER_WATERMARK.test(fullText);

  /* Garbage-text heuristic: if most "words" are short/no-vowel/mixed-alnum tokens,
     it's almost certainly low-quality embedded OCR rather than real text. */
  /* Devanagari counts as real text. Scoring "real" as ASCII-with-a-vowel made a
     clean Unicode Hindi text layer score junkRatio 1.00, so textLooksGarbled was
     true, hasTextLayer false, and a perfectly readable Hindi PDF was declared
     scanned -- sent to OCR, which is slower and worse than the text it threw
     away, or to the scanned-PDF modal for a user without OCR. Legacy KrutiDev
     encoding is unaffected: it IS ASCII, so it still scores as junk (and
     hasLegacyEncoding below is computed separately anyway).
     The trade: a garbled *Devanagari* text layer now reads rather than being
     re-OCR'd. That is rarer than a well-made Hindi PDF, which was always
     mis-handled. */
  const DEVANAGARI_RE = /[\u0900-\u097F]/;
  let realWords = 0, junkWords = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (typeof w !== 'string') continue;
    const stripped = w.replace(/[^A-Za-z]/g, '');
    if (stripped.length >= 3 && /[aeiouAEIOU]/.test(stripped)) realWords++;
    else if (w.replace(/[^\u0900-\u097F]/g, '').length >= 2) realWords++;
    else junkWords++;
  }
  const totalTokens = realWords + junkWords;
  const junkRatio = totalTokens > 0 ? junkWords / totalTokens : 0;

  const textLooksGarbled = totalTokens > 0 && junkRatio > 0.55;

  /* Legacy encoding detection — KrutiDev (Hindi) and Moosa-style fonts map
     Devanagari/Indic glyphs onto ASCII including special chars like / { [ @ # ; ^
     These appear INSIDE word tokens — something that almost never happens in real
     English/European prose. Count tokens that contain these chars. */
  /* Chars that KrutiDev/Moosa use to encode Devanagari conjuncts but are
     essentially never embedded inside legitimate English/European words.
     Excluded: ' (apostrophes in contractions), ; (end-of-sentence punctuation),
     % (statistics), & (company names as standalone tokens). */
  /* Two complementary patterns for KrutiDev/Indic legacy encoding:
     A) Special char BETWEEN letters. Includes ; because KrutiDev uses it
        for the "ya" matra (fy;s, cuok;k, O;wg). In English ; is always
        followed by a space — letter;letter without spaces is essentially
        impossible in normal prose.
     B) Word STARTS with /letter: /kEe, /keZ — KrutiDev vowel matras at
        word start. Never occurs in English words.
     Ratio computed against LETTER-CONTAINING tokens only — ignores pure
     digit/dash tokens (---145, 19) that dilute the ratio in TOC-style files. */
  const INDIC_EMBEDDED = /[A-Za-z][\/\{\[\]@#\^\\;][A-Za-z]/;
  const INDIC_LEADING  = /^\/[A-Za-z]/;
  let specialInWordCount = 0;
  let letterTokens = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (typeof w !== 'string' || w.length < 2) continue;
    if (!/[A-Za-z]/.test(w)) continue; /* skip pure digit/dash/symbol tokens */
    letterTokens++;
    if (INDIC_EMBEDDED.test(w) || INDIC_LEADING.test(w)) specialInWordCount++;
  }
  const specialInWordRatio = letterTokens > 20 ? specialInWordCount / letterTokens : 0;
  const hasIndicSpecialChars = specialInWordRatio > 0.06;

  /* Font name check as secondary signal — pdf.js may return PostScript names
     (Moosa-Bold, KrutiDev) or internal resource names; catches what it can. */
  const LEGACY_FONT_RE = /moosa|krishna|krutidev|kruti[\s_-]?dev|devlys|dev[\s_-]?lys|shivaji|akruti|chanakya|walkman/i;
  const allFontNames = allPageData.reduce(function(acc, pd) {
    return acc + ' ' + (pd.fontNames || []).join(' ');
  }, '');
  const hasLegacyFontName = LEGACY_FONT_RE.test(allFontNames);

  const hasLegacyEncoding = hasIndicSpecialChars || hasLegacyFontName;

  /* hasLegacyEncoding intentionally does NOT affect hasTextLayer — forcing OCR
     on a 500-page English PDF is worse UX than showing a banner after the fact.
     Instead, upload.js shows a dismissible banner when hasLegacyEncoding is true. */
  const hasTextLayer = !hasScannerWatermark && !textLooksGarbled && avgWordsPerPage >= 30;

  console.log('[parsePDF] avgWordsPerPage=' + avgWordsPerPage.toFixed(1)
    + ' junkRatio=' + junkRatio.toFixed(2)
    + ' specialInWordRatio=' + specialInWordRatio.toFixed(2)
    + ' hasIndicSpecialChars=' + hasIndicSpecialChars
    + ' hasLegacyFontName=' + hasLegacyFontName
    + ' hasTextLayer=' + hasTextLayer);

  /* ── 6. Detect image-like gaps and insert placeholders ────── */
  insertImagePlaceholders(words, allPageData, pageWordIndex);

  console.log('[pdf] paragraph starts: ' + rawLines.filter(function(l) { return l.paraStart; }).length
    + ' in ' + rawLines.length + ' lines');
  if (_paraOddities.length) {
    console.log('[pdf] short paragraph starts after a full-width line: '
      + JSON.stringify(_paraOddities));
  }

  return {
    words,
    pageWordIndex,
    rawLines,
    metadata: {
      pageCount: numPages,
      wordCount: words.filter(w => typeof w === 'string').length,
      hasTextLayer,
      hasLegacyEncoding,
      title: '',
    },
    pdfDoc,
  };
}

/* ── Group text items into lines by y-coordinate ─────────────── */
/* Where this book's text block actually sits on the page. Both paragraph rules
   are relative to those margins, so they have to be measured from the book
   rather than assumed — margins vary wildly between publishers. */
function measureParagraphGeometry(allPageData, headerFooterSet) {
  _paraOddities = [];
  const lefts = [];
  const rights = [];
  /* Vertical distances between consecutive lines on a page. Most pairs are
     genuine lines, so the median is the document's real line height -- which is
     what tells a line apart from a fragment of one. */
  const gaps = [];

  for (let i = 0; i < allPageData.length; i++) {
    const lines = allPageData[i].lines;
    let prevY = null;
    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      if (typeof line.x0 !== 'number' || typeof line.x1 !== 'number') continue;
      if (headerFooterSet.has(normalizeLine(line.text))) continue;
      if (isNoiseLine(line.text)) continue;
      lefts.push(line.x0);
      rights.push(line.x1);
      if (typeof line.y === 'number') {
        if (prevY !== null) {
          const dy = Math.abs(prevY - line.y);
          /* A page boundary is not a line gap. */
          if (dy > 0 && dy < 200) gaps.push(dy);
        }
        prevY = line.y;
      }
    }
  }
  /* Too little text to tell a margin from an indent; better no paragraphs than
     wrong ones (§1.5). */
  if (lefts.length < 20) return null;

  lefts.sort(function(a, b) { return a - b; });
  rights.sort(function(a, b) { return a - b; });
  const pct = function(arr, p) { return arr[Math.floor(arr.length * p)]; };

  /* Indented first lines sit to the right of the margin, so a low percentile
     finds the margin itself rather than the average of margin and indent. */
  const bodyLeft = pct(lefts, 0.2);
  const bodyRight = pct(rights, 0.8);
  const width = bodyRight - bodyLeft;
  if (width <= 0) return null;
  /* Roughly one character, assuming a 60-ish character measure. */
  const em = Math.max(4, width / 60);

  gaps.sort(function(a, b) { return a - b; });
  const lineGap = gaps.length >= 20 ? gaps[Math.floor(gaps.length / 2)] : 0;

  /* How ragged the right edge is. The whole "a short line ended its paragraph"
     rule assumes justified text, where an interior line reaches the margin and
     only a paragraph's last line falls short. In ragged-right text an interior
     line falls short by as much as the next word is wide, so the same rule
     marks a paragraph every few lines. Logged to be read before it is acted
     on: p50 close to p80 means justified, far from it means ragged. */
  console.log('[pdf] right edge: p20=' + pct(rights, 0.2).toFixed(0)
    + ' p50=' + pct(rights, 0.5).toFixed(0)
    + ' p70=' + pct(rights, 0.7).toFixed(0)
    + ' p80=' + bodyRight.toFixed(0)
    + ' p95=' + pct(rights, 0.95).toFixed(0)
    + ' | left edge: p20=' + bodyLeft.toFixed(0)
    + ' p50=' + pct(lefts, 0.5).toFixed(0)
    + ' p80=' + pct(lefts, 0.8).toFixed(0)
    + ' | lines=' + rights.length);
  console.log('[pdf] paragraph geometry: lineGap=' + lineGap.toFixed(1) + ' bodyLeft=' + bodyLeft.toFixed(0)
    + ' bodyRight=' + bodyRight.toFixed(0) + ' em=' + em.toFixed(1)
    + ' indentFrom=' + (bodyLeft + em * 1.2).toFixed(0)
    + ' shortBefore=' + (bodyRight - em * 3).toFixed(0));
  return {
    em: em,
    lineGap: lineGap,
    indentFrom: bodyLeft + em * 1.2,
    shortBefore: bodyRight - em * 3,
  };
}

/* See the diagnostic in the parse loop. Module-level and reset by
   measureParagraphGeometry, which runs once per document. */
let _paraOddities = [];

/* The same test paragraphs.js's line-length inference uses, for the same
   reason: in prose a paragraph ends where a sentence does. */
const PARA_SENTENCE_END = /[.!?।॥:;"'’”]\s*$/;

function _isParagraphStart(line, prevKept, paraGeom, isFirstLine) {
  if (isFirstLine) return true;
  if (!paraGeom) return false;
  /* A line sharing the previous line's baseline is a fragment of it, not a new
     paragraph. groupIntoLines separates lines on a 3-unit baseline difference,
     which is tight for a text layer whose words carry their own slightly
     different baselines -- as an OCR-produced layer does -- so a single word
     gets lifted out of the middle of its line and becomes a "line" of its own.
     It then sits well right of the margin, the indent test fires, and a
     paragraph appears to begin on one word of a sentence. Measured against the
     document's own line height rather than a fixed figure, because the units
     here are whatever the PDF uses; at well under a line apart, two lines are
     one line. Either half of the split may come first, so the distance is
     absolute, which also makes a page boundary -- a jump of most of a page --
     fall outside it. Cost: a genuine paragraph break between two lines set
     closer than 0.7 of the document's line height is missed, merging two
     paragraphs, the failure §5 already accepts as the lesser one. */
  if (paraGeom.lineGap > 0 && prevKept
      && typeof line.y === 'number' && typeof prevKept.y === 'number'
      && Math.abs(prevKept.y - line.y) < paraGeom.lineGap * 0.7) {
    return false;
  }
  /* The same defect where no baseline is recorded -- the OCR path, whose lines
     come from ML Kit blocks: there a fragment is adjacent to where the previous
     line stopped, since a block splits at a line end rather than mid-line. */
  if (prevKept && typeof line.y !== 'number'
      && typeof line.x0 === 'number' && typeof prevKept.x1 === 'number'
      && line.x0 > paraGeom.indentFrom
      && Math.abs(line.x0 - prevKept.x1) <= paraGeom.em * 2) {
    return false;
  }
  /* A line following one that ran the full measure continues it: what wraps,
     continues. Without this the indent test cannot tell a first-line indent
     from a HANGING indent, where it is the continuation lines that are indented
     so they align under the item's text -- which is how a numbered list set
     this way strands a sentence's last word as its own paragraph:

         (i) Sati or the burning of the widow on the funeral pyre of her deceased
             husband.                     <- indented, but a continuation

     Measured on a device: the line above runs the full measure, and the stranded
     line sits a full line height below it, so neither the fragment test nor an
     adjacency test can reach it. A genuine break is not lost, because a
     paragraph's last line stopping within three characters of the right margin
     is rare in justified text and merges two paragraphs when it happens -- the
     failure §5 already accepts as the lesser one.

     NOT on the OCR path, where this was tried and had to come back out. ML Kit
     reports the extent of a BLOCK, so "reached the right margin" means nothing
     consistent there, and the gate suppressed so many paragraph starts that
     Page mode's chapter headings -- whose range runs from the chapter to the
     next paragraph start (§4.1 rule 5) -- styled the opening pages of a book
     whole. A rule resting on true line extents cannot be applied to boxes that
     are not line extents. */
  if (!paraGeom.fromOcr && prevKept
      && typeof prevKept.x1 === 'number' && prevKept.x1 >= paraGeom.shortBefore) {
    return false;
  }
  /* This line is indented. */
  if (typeof line.x0 === 'number' && line.x0 > paraGeom.indentFrom) return true;
  /* The line before it stopped well short of the right margin, so it ended its
     paragraph rather than wrapping into this one. */
  if (prevKept && typeof prevKept.x1 === 'number' && prevKept.x1 < paraGeom.shortBefore) {
    /* Not evidence on its own where the extents come from OCR: a block ends
       wherever the recogniser grouped, routinely mid-paragraph. Measured at 70%
       of starts following a finished sentence on one book against 14% on
       another, so there the previous line must have finished a sentence too --
       the pairing paragraphs.js's inference already relies on. */
    if (paraGeom.fromOcr && !PARA_SENTENCE_END.test(prevKept.text || '')) return false;
    return true;
  }
  return false;
}

function groupIntoLines(items, pageHeight) {
  if (items.length === 0) return [];

  /* Sort by y descending (top of page first in PDF coordinate space) */
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const Y_TOLERANCE = 3;
  const lines = [];
  let currentLine = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - currentY) <= Y_TOLERANCE) {
      currentLine.push(sorted[i]);
    } else {
      lines.push(finishLine(currentLine, currentY, pageHeight));
      currentLine = [sorted[i]];
      currentY = sorted[i].y;
    }
  }
  if (currentLine.length > 0) {
    lines.push(finishLine(currentLine, currentY, pageHeight));
  }

  return lines;
}

function finishLine(items, y, pageHeight) {
  /* Sort items left to right within the line */
  items.sort((a, b) => a.x - b.x);
  const text = buildLineText(items);
  const lineMetrics = buildLineMetrics(items);
  const yFromTop = pageHeight - y;
  const pctFromTop = yFromTop / pageHeight;
  const firstItem = items[0];
  const lastItem = items[items.length - 1];
  return {
    text,
    y,
    yPct: pctFromTop,
    /* Where the line starts and stops. A PDF carries no paragraph marks, so an
       indent and a line that stops short of the margin are the only evidence
       there is of where one paragraph ends and the next begins. */
    x0: firstItem.x,
    x1: lastItem.x + (lastItem.width || 0),
    isHeader: pctFromTop <= 0.22,
    isFooter: pctFromTop >= 0.78,
    itemCount: items.length,
    wordCount: lineMetrics.wordCount,
    numericTokenCount: lineMetrics.numericTokenCount,
    wideGapCount: lineMetrics.wideGapCount,
    alphaTokenCount: lineMetrics.alphaTokenCount,
    lineSpan: lineMetrics.lineSpan,
  };
}

function buildLineText(items) {
  if (items.length === 0) return '';

  let text = items[0].str || '';

  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const current = items[i];
    const joiner = shouldInsertSpace(prev, current) ? ' ' : '';
    text += joiner + (current.str || '');
  }

  return text.replace(/\s+/g, ' ').trim();
}

function buildLineMetrics(items) {
  const text = items.map(item => item.str || '').join(' ');
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const numericTokenCount = tokens.filter(token => /\d/.test(token)).length;
  const alphaTokenCount = tokens.filter(token => /[A-Za-z]/.test(token)).length;

  let wideGapCount = 0;
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const current = items[i];
    const prevCharWidth = Math.max(0.8, (prev.width || 0) / Math.max((prev.str || '').length, 1));
    const currentCharWidth = Math.max(0.8, (current.width || 0) / Math.max((current.str || '').length, 1));
    const gap = current.x - (prev.x + (prev.width || 0));
    const wideGapThreshold = Math.max(prevCharWidth, currentCharWidth) * 2.2;
    if (gap > wideGapThreshold) {
      wideGapCount++;
    }
  }

  const first = items[0];
  const last = items[items.length - 1];
  const lineSpan = Math.max(0, (last.x + (last.width || 0)) - first.x);

  return {
    wordCount: tokens.length,
    numericTokenCount,
    wideGapCount,
    alphaTokenCount,
    lineSpan,
  };
}

function shouldInsertSpace(prev, current) {
  const prevText = prev.str || '';
  const currentText = current.str || '';
  if (!prevText || !currentText) return true;

  if (/[-/]\s*$/.test(prevText)) return false;
  if (/^[,.;:!?%)\]}/]/.test(currentText)) return false;
  if (/[([{/"'`]$/.test(prevText)) return false;

  const prevCharWidth = Math.max(0.8, (prev.width || 0) / Math.max(prevText.length, 1));
  const currentCharWidth = Math.max(0.8, (current.width || 0) / Math.max(currentText.length, 1));
  const gap = current.x - (prev.x + (prev.width || 0));
  const noSpaceThreshold = Math.max(0.9, Math.min(prevCharWidth, currentCharWidth) * 0.45);

  return gap > noSpaceThreshold;
}

/* ── Detect repeating headers and footers by frequency ──────── */
function detectHeadersFooters(allPageData, numPages) {
  const freq = {};
  const threshold = numPages * 0.12;

  for (const { lines } of allPageData) {
    for (const line of lines) {
      if (!line.isHeader && !line.isFooter) continue;
      /* Headers/footers are short by nature — guard against long body
         paragraphs that occasionally sit in the widened band and would
         otherwise get flagged as recurring content. */
      if (line.wordCount > 12) continue;
      const norm = normalizeLine(line.text);
      if (!norm) continue;
      freq[norm] = (freq[norm] || 0) + 1;
    }
  }

  const recurring = new Set();
  for (const [norm, count] of Object.entries(freq)) {
    if (count >= threshold) recurring.add(norm);
  }
  return recurring;
}

/* Normalize: lowercase, digits→#, strip punctuation, collapse whitespace.
   Devanagari is kept: `\w` is ASCII-only (§5), so stripping everything outside
   it collapsed every Devanagari footer to '' or '#'. Empty normalisations are
   skipped by the caller, so a running footer like "गोदान / 5" was invisible to
   header/footer detection and stayed in the text of every Hindi book. */
function normalizeLine(text) {
  return text
    .toLowerCase()
    .replace(/[\u0966-\u096F]+/g, '#')      /* Devanagari digits ०-९ */
    .replace(/\d+/g, '#')
    .replace(/[^\w\s#\u0900-\u097F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ── Strip noise lines ─────────────────────────────────────── */
function isNoiseLine(text) {
  const t = text.trim();
  /* Standalone page numbers */
  if (/^\d+$/.test(t)) return true;
  /* ISBN / ISSN / DOI */
  if (/^(isbn|issn|doi)[\s:]/i.test(t)) return true;
  /* Bare URLs */
  if (/^https?:\/\/\S+$/.test(t)) return true;
  /* Null bytes / encoding artifacts */
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(t)) return true;
  /* Very short lines that are likely artifacts (1–2 chars) */
  if (t.length <= 1) return true;
  return false;
}

/* ── Insert image placeholders for large visual gaps ────────── */
function insertImagePlaceholders(words, allPageData, pageWordIndex) {
  for (let pageIdx = 0; pageIdx < allPageData.length; pageIdx++) {
    const { lines } = allPageData[pageIdx];
    let prevY = null;
    const pageHeight = allPageData[pageIdx].pageHeight;
    let hasImagePlaceholder = false;

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      if (line.isHeader || line.isFooter) continue;
      if (prevY !== null) {
        const gap = prevY - line.y;
        /* Gap > 15% of page height suggests an image or table */
        if (!hasImagePlaceholder && gap > pageHeight * 0.15 && gap < pageHeight * 0.9) {
          addPagePlaceholder(words, pageWordIndex, pageIdx, '[Image — Tap to View]');
          hasImagePlaceholder = true;
        }
      }
      prevY = line.y;
    }
  }
}

function detectTableRanges(lines) {
  const ranges = [];
  let runStart = -1;
  let runCount = 0;
  let tableScore = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.isHeader || line.isFooter) continue;

    if (isTableLikeLine(line)) {
      if (runStart === -1) runStart = i;
      runCount++;
      tableScore += getTableLineScore(line);
    } else if (runStart !== -1) {
      if (runCount >= 2 && tableScore >= 4) {
        ranges.push({ start: runStart, end: i - 1 });
      }
      runStart = -1;
      runCount = 0;
      tableScore = 0;
    }
  }

  if (runStart !== -1 && runCount >= 2 && tableScore >= 4) {
    ranges.push({ start: runStart, end: lines.length - 1 });
  }

  return ranges;
}

function isTableLikeLine(line) {
  if (!line || !line.text) return false;
  const text = line.text.trim();
  if (!text) return false;

  const hasMultiColumnSpacing = line.itemCount >= 3 && line.wideGapCount >= 2;
  const hasDenseNumericCells = line.itemCount >= 3 && line.numericTokenCount >= 2;
  const hasShortCellLikeWords = line.wordCount >= 3 && line.wordCount <= 18 && line.itemCount >= 3;
  const hasRepeatedCells = /\S+\s{2,}\S+/.test(text) || line.wideGapCount >= 3;
  const isWideHorizontalRow = line.itemCount >= 5 && line.lineSpan >= 280;
  const hasMixedHeaderAndValues = line.alphaTokenCount >= 2 && line.numericTokenCount >= 1;

  if (hasMultiColumnSpacing && (hasDenseNumericCells || hasShortCellLikeWords || hasRepeatedCells)) {
    return true;
  }

  if (isWideHorizontalRow && (hasDenseNumericCells || hasMixedHeaderAndValues)) {
    return true;
  }

  return false;
}

function getTableLineScore(line) {
  let score = 0;
  if (line.wideGapCount >= 2) score += 1;
  if (line.numericTokenCount >= 2) score += 1;
  if (line.itemCount >= 5) score += 1;
  if (line.lineSpan >= 280) score += 1;
  if (line.alphaTokenCount >= 2 && line.numericTokenCount >= 1) score += 1;
  return score;
}

function addPagePlaceholder(words, pageWordIndex, pageIdx, label) {
  const insertAt = pageWordIndex[pageIdx];
  if (insertAt > words.length) return;

  words.splice(insertAt, 0, {
    type: 'placeholder',
    label,
    page: pageIdx + 1,
  });

  for (let pi = pageIdx + 1; pi < pageWordIndex.length; pi++) {
    pageWordIndex[pi]++;
  }
}
