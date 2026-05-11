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

    const lines = groupIntoLines(items, pageHeight);
    allPageData.push({ lines, pageHeight });

    /* Emit progress for loading indicator */
    if (typeof window._pdfParseProgress === 'function') {
      window._pdfParseProgress(pageNum, numPages);
    }
  }

  /* ── 3. Detect repeating headers and footers ──────────────── */
  const headerFooterSet = detectHeadersFooters(allPageData, numPages);

  /* ── 4. Build word array with pageWordIndex ───────────────── */
  const words = [];
  const pageWordIndex = [];
  const rawLines = [];

  let totalWordCount = 0;

  for (let i = 0; i < allPageData.length; i++) {
    pageWordIndex.push(words.length);
    const { lines, pageHeight } = allPageData[i];

    for (const line of lines) {
      if (line.isHeader || line.isFooter) continue;
      const normalized = normalizeLine(line.text);
      if (headerFooterSet.has(normalized)) continue;
      if (isNoiseLine(line.text)) continue;

      rawLines.push({ text: line.text, pageIndex: i, wordIndex: words.length });

      const lineWords = line.text.split(/\s+/).filter(w => w.length > 0);
      for (const w of lineWords) {
        words.push(w);
      }
      totalWordCount += lineWords.length;
    }
  }

  /* ── 5. Detect if PDF has a real text layer ───────────────── */
  const avgWordsPerPage = totalWordCount / numPages;
  const hasTextLayer = avgWordsPerPage >= 5;

  /* ── 6. Detect placeholder positions (tables / image gaps) ── */
  insertPlaceholders(words, allPageData, pageWordIndex);

  return {
    words,
    pageWordIndex,
    rawLines,
    metadata: {
      pageCount: numPages,
      wordCount: words.filter(w => typeof w === 'string').length,
      hasTextLayer,
      title: '',
    },
    pdfDoc,
  };
}

/* ── Group text items into lines by y-coordinate ─────────────── */
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
  const yFromTop = pageHeight - y;
  const pctFromTop = yFromTop / pageHeight;
  return {
    text,
    y,
    yPct: pctFromTop,
    isHeader: pctFromTop <= 0.14,
    isFooter: pctFromTop >= 0.86,
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

/* Normalize: lowercase, digits→#, strip punctuation, collapse whitespace */
function normalizeLine(text) {
  return text
    .toLowerCase()
    .replace(/\d+/g, '#')
    .replace(/[^\w\s#]/g, '')
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

/* ── Insert placeholder objects for tables / image gaps ─────── */
/* Simple heuristic: large vertical gaps between lines on a page suggest a figure/table */
function insertPlaceholders(words, allPageData, pageWordIndex) {
  /* Placeholder detection is a best-effort pass.
     We insert placeholder objects into the words array where detected.
     Each placeholder: { type: 'placeholder', label: '...', page: N } */

  for (let pageIdx = 0; pageIdx < allPageData.length; pageIdx++) {
    const { lines } = allPageData[pageIdx];
    let prevY = null;
    const pageHeight = allPageData[pageIdx].pageHeight;

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      if (line.isHeader || line.isFooter) continue;
      if (prevY !== null) {
        const gap = prevY - line.y;
        /* Gap > 15% of page height suggests an image or table */
        if (gap > pageHeight * 0.15 && gap < pageHeight * 0.9) {
          const insertAt = pageWordIndex[pageIdx];
          if (insertAt < words.length) {
            words.splice(insertAt, 0, {
              type: 'placeholder',
              label: '[Image — Tap to View]',
              page: pageIdx + 1,
            });
            /* Shift pageWordIndex for subsequent pages */
            for (let pi = pageIdx + 1; pi < pageWordIndex.length; pi++) {
              pageWordIndex[pi]++;
            }
          }
        }
      }
      prevY = line.y;
    }
  }
}
