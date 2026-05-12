/* DOCX parser — Pro feature */

async function parseDOCX(arrayBuffer) {
  if (!window.mammoth) {
    throw { type: 'parse-error', detail: 'mammoth.js library not loaded' };
  }

  let extracted;
  try {
    extracted = await window.mammoth.extractRawText({ arrayBuffer });
  } catch (err) {
    throw { type: 'parse-error', detail: err.message || 'Failed to parse DOCX' };
  }

  const rawText = extracted.value || '';

  if (!rawText || rawText.trim().length === 0) {
    throw { type: 'empty-document' };
  }

  /* Split into paragraphs */
  const paragraphs = rawText
    .split(/\n+/)
    .map(function(p) { return p.trim(); })
    .filter(function(p) { return p.length >= 2; });

  /* Clean each paragraph */
  const cleaned = paragraphs.map(function(p) {
    /* Collapse internal whitespace */
    p = p.replace(/[ \t]+/g, ' ').trim();
    /* Strip control chars */
    p = p.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    return p;
  });

  /* Filter out page numbers, bare URLs, very short lines */
  const filtered = cleaned.filter(function(line) {
    if (line.length < 2) return false;
    if (/^\d+$/.test(line)) return false; /* pure numeric = page number */
    if (/^https?:\/\//.test(line) && line.length < 50) return false; /* bare URL */
    return true;
  });

  /* Build rawLines and words */
  const rawLines = [];
  const words = [];
  let wordIndex = 0;
  const PAGE_SIZE = 300;
  const pageWordIndex = [0];
  let syntheticPage = 0;

  filtered.forEach(function(line) {
    const lineWords = line.split(/\s+/).filter(Boolean);
    if (lineWords.length === 0) return;

    rawLines.push({
      text: line,
      pageIndex: Math.floor(wordIndex / PAGE_SIZE),
      wordIndex: wordIndex,
    });

    lineWords.forEach(function(word) {
      words.push(word);
      wordIndex++;

      /* Track page boundaries (every 300 words) */
      while (Math.floor(wordIndex / PAGE_SIZE) > syntheticPage) {
        syntheticPage++;
        pageWordIndex.push(wordIndex);
      }
    });
  });

  if (words.length < 10) {
    throw { type: 'empty-document' };
  }

  return {
    words: words,
    pageWordIndex: pageWordIndex,
    rawLines: rawLines,
    metadata: {
      pageCount: pageWordIndex.length,
      wordCount: words.length,
      hasTextLayer: words.length > 0,
      title: '',
    },
    pdfDoc: null,
  };
}
