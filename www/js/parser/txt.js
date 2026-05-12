/* TXT parser — Pro feature */

async function parseTXT(arrayBuffer) {
  /* Decode UTF-8 with lenient error handling */
  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(arrayBuffer));

  if (!decoded || decoded.trim().length === 0) {
    throw { type: 'empty-document' };
  }

  /* Normalize line endings */
  let text = decoded.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  /* Split into paragraph blocks (blank-line delimited) */
  const paragraphs = text
    .split(/\n{2,}/)
    .flatMap(function(block) { return block.split(/\n/); })
    .map(function(line) { return line.trim(); })
    .filter(function(line) { return line.length >= 2; });

  /* Clean paragraphs */
  const cleaned = paragraphs.map(function(p) {
    /* Collapse whitespace */
    p = p.replace(/[ \t]+/g, ' ').trim();
    /* Strip control chars */
    p = p.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    return p;
  });

  /* Filter out page numbers, bare URLs */
  const filtered = cleaned.filter(function(line) {
    if (line.length < 2) return false;
    if (/^\d+$/.test(line)) return false;
    if (/^https?:\/\//.test(line) && line.length < 50) return false;
    return true;
  });

  /* Deduplicate adjacent identical lines */
  const deduplicated = [];
  let lastLine = '';
  filtered.forEach(function(line) {
    if (line !== lastLine) {
      deduplicated.push(line);
      lastLine = line;
    }
  });

  /* Build rawLines and words */
  const rawLines = [];
  const words = [];
  let wordIndex = 0;
  const PAGE_SIZE = 300;
  const pageWordIndex = [0];
  let syntheticPage = 0;

  deduplicated.forEach(function(line) {
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

      /* Track page boundaries */
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
      hasTextLayer: true,
      title: '',
    },
    pdfDoc: null,
  };
}
