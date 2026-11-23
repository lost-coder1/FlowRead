/* Paragraph recovery — turns rawLines[] back into paragraph boundaries.

   The parsers split a document into paragraphs and then immediately flatten them
   into lines, so until 2026-11-16 nothing downstream could tell where one
   paragraph ended and the next began. Every engine got a flat word array and
   could only put spaces between words, which is why a page of Wealth of Nations
   read as one unbroken block and chapter titles ran into the prose.

   The parsers now mark the first line of each paragraph (`paraStart`), so for
   anything imported since then this is exact. Books already in the library were
   stored as parsed data and their raw bytes are gone for everything but PDFs
   (storage.js keeps those alone), so they cannot be re-parsed — for those the
   boundaries are inferred from the line lengths that were stored. */

const ParagraphStructure = (function() {
  /* One file at a time is all the reader ever has open. */
  let _cacheFileId = null;
  let _cacheStarts = null;

  /* A line that stops short of the wrap width ended its paragraph — but only if
     it also ends a sentence. Without that second half the rule fires on every
     line that happens to be a few characters short, which on a real book costs
     about fifteen points of precision. `।` is the Devanagari danda (§17). */
  const SENTENCE_END = /[.!?।:;"'’”]\s*$/;
  const WRAP_SLACK = 6;

  /* Word indices at which a paragraph begins, as a Set for O(1) lookup during
     rendering. A 150k-word book holds roughly 2,000 of them. */
  function startsFor(file) {
    if (!file || !Array.isArray(file.rawLines) || file.rawLines.length === 0) {
      return new Set();
    }
    if (file.id && file.id === _cacheFileId && _cacheStarts) return _cacheStarts;

    const starts = _derive(file);
    _cacheFileId = file.id;
    _cacheStarts = starts;
    return starts;
  }

  function _derive(file) {
    const rawLines = file.rawLines;

    /* Parsed since the parsers started recording it — exact, nothing to infer. */
    for (let i = 0; i < rawLines.length; i++) {
      if (rawLines[i] && rawLines[i].paraStart) return _fromFlags(rawLines);
    }

    /* A DOCX line is already a paragraph: mammoth's extractRawText emits one per
       newline, so docx.js never had anything to lose. True of files it parsed
       before the flag existed too. */
    if (file.kind === 'docx') return _everyLine(rawLines);

    /* Everything else arrives hard-wrapped — a TXT at ~74 characters, a PDF at
       whatever the page is wide. If it does not look wrapped, there is no wrap
       width to measure against and each line is its own paragraph. */
    if (!_looksWrapped(rawLines)) return _everyLine(rawLines);
    return _inferFromWrapping(rawLines);
  }

  function _fromFlags(rawLines) {
    const starts = new Set();
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (line && line.paraStart && typeof line.wordIndex === 'number') {
        starts.add(line.wordIndex);
      }
    }
    return starts;
  }

  function _everyLine(rawLines) {
    const starts = new Set();
    for (let i = 0; i < rawLines.length; i++) {
      if (rawLines[i] && typeof rawLines[i].wordIndex === 'number') {
        starts.add(rawLines[i].wordIndex);
      }
    }
    return starts;
  }

  /* Hard-wrapped text piles most of its lines just under the wrap width. If few
     lines sit in that band the document was never wrapped to a column, and the
     short-line rule below would be measuring against a width that isn't there. */
  function _looksWrapped(rawLines) {
    const wrap = _wrapWidth(rawLines);
    if (wrap < 30) return false;
    let nearWrap = 0;
    for (let i = 0; i < rawLines.length; i++) {
      const len = ((rawLines[i] && rawLines[i].text) || '').length;
      if (len >= wrap - 8 && len <= wrap) nearWrap++;
    }
    return nearWrap / rawLines.length >= 0.2;
  }

  /* 95th percentile rather than the maximum, which a stray long line would own. */
  function _wrapWidth(rawLines) {
    const lens = [];
    for (let i = 0; i < rawLines.length; i++) {
      lens.push(((rawLines[i] && rawLines[i].text) || '').length);
    }
    lens.sort(function(a, b) { return a - b; });
    return lens[Math.floor(lens.length * 0.95)] || 0;
  }

  /* A line that is nothing but a number is a paragraph on both sides. It is a
     chapter marker (or a page number the parser kept), never part of the
     sentence above or below it, and without this the number merges into the
     chapter's first paragraph: the chapter detector cannot see it, and Page
     mode's heading range then runs from the number to the end of that whole
     paragraph and styles the lot (§4.1 rule 5). */
  const BARE_NUMERAL = /^[\s.:—-]*([0-9]{1,4}|[\u0966-\u096F]{1,4})[.):]?[\s.:—-]*$/;

  function _inferFromWrapping(rawLines) {
    const shortEnough = _wrapWidth(rawLines) - WRAP_SLACK;
    const starts = new Set();
    if (typeof rawLines[0].wordIndex === 'number') starts.add(rawLines[0].wordIndex);

    for (let i = 1; i < rawLines.length; i++) {
      const prev = (rawLines[i - 1] && rawLines[i - 1].text) || '';
      const line = rawLines[i];
      if (!line || typeof line.wordIndex !== 'number') continue;
      if (prev.length < shortEnough && SENTENCE_END.test(prev)) {
        starts.add(line.wordIndex);
      } else if (BARE_NUMERAL.test(line.text || '') || BARE_NUMERAL.test(prev)) {
        starts.add(line.wordIndex);
      }
    }
    return starts;
  }

  function forget() {
    _cacheFileId = null;
    _cacheStarts = null;
  }

  return { startsFor, forget };
})();
