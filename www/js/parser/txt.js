/* TXT parser — Pro feature */

async function parseTXT(arrayBuffer) {
  /* Decode UTF-8 with lenient error handling */
  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(arrayBuffer));

  if (!decoded || decoded.trim().length === 0) {
    throw { type: 'empty-document' };
  }

  /* Normalize line endings */
  let text = decoded.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  /* Split into paragraph blocks (blank-line delimited), then into the lines each
     block was hard-wrapped into. Which line opened a block is the only record of
     where a paragraph begins — a plain text file has no other marker — so it is
     carried through as `firstOfBlock` rather than flattened away. Losing it here
     is what made every engine render a book as one unbroken wall of words. */
  const paragraphs = [];
  text.split(/\n{2,}/).forEach(function(block) {
    block.split(/\n/).forEach(function(line, i) {
      const trimmed = line.trim();
      if (trimmed.length >= 2) paragraphs.push({ text: trimmed, firstOfBlock: i === 0 });
    });
  });

  /* Clean paragraphs */
  const cleaned = paragraphs.map(function(p) {
    /* Collapse whitespace */
    let text = p.text.replace(/[ \t]+/g, ' ').trim();
    /* Strip control chars */
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    return { text: text, firstOfBlock: p.firstOfBlock };
  });

  /* Filter out page numbers, bare URLs */
  const filtered = cleaned.filter(function(p) {
    const line = p.text;
    if (line.length < 2) return false;
    if (/^\d+$/.test(line)) return false;
    if (/^https?:\/\//.test(line) && line.length < 50) return false;
    return true;
  });

  /* Deduplicate adjacent identical lines */
  const deduplicated = [];
  let lastLine = '';
  filtered.forEach(function(p) {
    if (p.text !== lastLine) {
      deduplicated.push(p);
      lastLine = p.text;
    }
  });

  /* Build rawLines and words */
  const rawLines = [];
  const words = [];
  let wordIndex = 0;
  const PAGE_SIZE = 300;
  const pageWordIndex = [0];
  let syntheticPage = 0;

  let first = true;
  deduplicated.forEach(function(p) {
    const lineWords = p.text.split(/\s+/).filter(Boolean);
    if (lineWords.length === 0) return;

    rawLines.push({
      text: p.text,
      pageIndex: Math.floor(wordIndex / PAGE_SIZE),
      wordIndex: wordIndex,
      /* The opening line of the document starts a paragraph whatever the source
         did, so a reader never lands on a continuation. */
      paraStart: p.firstOfBlock || first,
    });
    first = false;

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
