/* Chapter detection.

   This classifies *paragraphs*, not lines. Until 2026-11-16 it ran over
   rawLines[], which are wrapped fragments, so a sentence that happened to begin
   with the word "part" matched the chapter rule and a heading that wrapped onto
   a second line was indexed as two entries. On Wealth of Nations that produced
   207 "chapters" for a book that has about 65, and 99 of them were pieces of
   prose. Paragraph boundaries are now recoverable (features/paragraphs.js), and
   with them the right question becomes askable: a heading is a short, standalone
   paragraph, not a line that starts like one. */

/* Two length gates. A paragraph that opens with a heading word and an ordinal
   ("CHAPTER V. OF THE REAL AND NOMINAL PRICE OF COMMODITIES, OR OF THEIR PRICE
   IN LABOUR, AND THEIR PRICE IN MONEY.") is unambiguous however long it runs,
   and 18th-century books are full of them. Everything else is a guess from
   capitalisation alone, and there length is most of what separates a heading
   from a sentence — so the guesses keep the tight bound. */
const CH_MAX_CHARS = 110;
const CH_MAX_WORDS = 18;
const CH_MAX_CHARS_ANCHORED = 250;
const CH_MAX_WORDS_ANCHORED = 40;

const CH_KEYWORD = /^(chapter|book|part|canto|act|scene|section|letter|volume)\b/i;
const CH_FRONT_MATTER =
  /^(epilogue|prologue|preface|introduction|foreword|afterword|appendix|conclusion|contents|dedication)\b/i;

/* What may follow "Chapter": a numeral, a roman numeral, a spelled-out number,
   or "the First". Without this, "Part of the produce of his own labour" is a
   chapter — which is exactly what used to happen. */
const CH_ORDINAL = new RegExp(
  '^[\\s.:—-]*(' +
  '[0-9]+|[IVXLCDM]+\\b' +
  '|the\\s+\\w+' +
  '|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen' +
  '|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty' +
  '|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last' +
  ')\\b', 'i');

const CH_NUMBERED = /^\d+(\.\d+){0,3}[.):]?\s+\S/;
const CH_ROMAN_ONLY = /^[IVXLCDM]+\.?$/;
/* No `\b` here: JavaScript's word boundary is ASCII-only and never matches
   against a Devanagari letter, so `\b` would make this rule dead. The
   lookahead does the same job — the keyword must be a whole word. */
const CH_DEVANAGARI_HEAD = /^(अध्याय|भाग|खण्ड|परिच्छेद|प्रस्तावना|उपसंहार)(?![\u0900-\u097F])/;
const CH_DEVANAGARI_PART = /^(भाग|खण्ड)/;
const CH_HAS_DEVANAGARI = /[ऀ-ॿ]/;

/* A paragraph that is nothing but a number. On its own this is worthless -- a
   page number looks exactly the same -- so it is never classified as a heading
   by shape. It is resolved document-wide instead, by _numeralSequenceHits:
   Premchand's Godaan, and a great many Hindi and Urdu books, mark chapters with
   a bare numeral and no word at all, which every rule here used to miss. */
const CH_BARE_NUMERAL = /^[\s.:—-]*([0-9]{1,4}|[\u0966-\u096F]{1,4})[.):]?[\s.:—-]*$/;

/* What makes a run of bare numerals a chapter list rather than a coincidence:
   it ascends, it does not skip far (an OCR'd number can be lost, two cannot),
   each marker is a chapter's worth of text from the last, and there are enough
   of them to be a structure. The gap is what rejects a numbered list inside the
   text and the back-matter catalogue, whose entries sit a few words apart. */
const CH_SEQUENCE_MAX_STEP = 3;
const CH_SEQUENCE_MIN_GAP = 400;
const CH_SEQUENCE_MIN_RUN = 3;

/* A verified run this long is the book's structure, so the shape-based guesses
   go, exactly as _dropWeakRules does for a book that numbers its chapters with
   a word. Godaan's 34 markers against 149 short-Devanagari guesses is the case:
   without this the real index is buried in dialogue fragments. */
const CH_SEQUENCE_DOMINANT = 5;

/* And what disqualifies a run: values that keep a constant offset from the page
   they sit on are page numbering, not chapters. Scanned books imported before
   the OCR parser learned to strip page numbers still carry them, and a 1,2,3
   per page run otherwise reads as a perfect chapter sequence -- an 86-page book
   produced 61 "chapters" that way. Real chapter numbers advance far slower than
   pages do, so their offsets scatter. */
const CH_SEQUENCE_MAX_PAGENO_SHARE = 0.5;

/* A real sentence boundary: two or more letters, a stop, then more text.
   "Chapter I. The Twin-Verses" is not one — the token before the stop is a
   numeral, which is how a heading numbers itself, not how a sentence ends.
   `।` is the Devanagari danda (§17). */
const CH_PROSE_BREAK = /[a-zऀ-ॿ]{2}[.!?।]["”\s]+\S/;

/* "Language: English", "Credits: ...", "Title: ..." — a label and its value is
   never a heading. Heading keywords are tested first, so "Part I: ..." and
   "Introduction: ..." are unaffected. */
const CH_LABEL = /^[A-Za-z]+\s*:/;

const CH_OPENS_LIKE_HEADING = /^[\wऀ-ॿ"“(]/;

const CH_STOPWORDS = [
  'a', 'an', 'the', 'of', 'and', 'or', 'in', 'on', 'to', 'for',
  'with', 'at', 'by', 'from', 'is', 'his', 'her', 'its'
];

/* The shape rules guess from capitalisation alone, so they are only trusted when
   nothing stronger carried the book — see _dropWeakRules. */
const CH_STRONG_RULES = ['keyword', 'numbered', 'devanagari-keyword', 'numeral-sequence'];
const CH_WEAK_RULES = ['all-caps', 'title-case', 'roman', 'devanagari-short'];
const CH_STRONG_ENOUGH = 5;

/* How far into a book the front matter can reach, for duplicate suppression. */
const CH_FRONT_MATTER_SHARE = 0.1;

function detectChapters(file) {
  if (!file || !Array.isArray(file.rawLines) || file.rawLines.length === 0) return [];

  const paragraphs = _chapterParagraphs(file);
  const totalWords = (file.words && file.words.length) || 0;

  let hits = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const text = para.text.replace(/\s+/g, ' ').trim();
    const rule = classifyChapterLine(text);
    if (!rule) continue;
    hits.push({
      title: text,
      rule: rule.rule,
      depth: rule.depth,
      page: (para.pageIndex || 0) + 1,
      wordIndex: para.wordIndex
    });
  }

  const sequence = _numeralSequenceHits(file.rawLines);
  hits = hits.concat(sequence);
  hits = (sequence.length >= CH_SEQUENCE_DOMINANT)
    ? hits.filter(function(hit) { return CH_WEAK_RULES.indexOf(hit.rule) === -1; })
    : _dropWeakRules(hits);
  hits = _dedupeChapters(hits);
  hits = _dropFrontDuplicates(hits, totalWords);

  return hits.sort(function(a, b) { return a.wordIndex - b.wordIndex; });
}

/* Join each paragraph's wrapped lines back together. A heading that wraps is one
   candidate, not two fragments. */
function _chapterParagraphs(file) {
  const starts = (typeof ParagraphStructure !== 'undefined')
    ? ParagraphStructure.startsFor(file)
    : null;
  const rawLines = file.rawLines;
  const paragraphs = [];
  let current = null;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const text = (line && line.text) || '';
    if (!text) continue;
    const wordIndex = typeof line.wordIndex === 'number' ? line.wordIndex : 0;
    const isStart = !current || !starts || starts.has(wordIndex);

    if (isStart) {
      if (current) paragraphs.push(current);
      current = { text: text, wordIndex: wordIndex, pageIndex: line.pageIndex || 0 };
    } else {
      current.text += ' ' + text;
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs;
}

/* Gates every rule has to pass. A heading is a short, self-contained paragraph —
   never a fragment of a longer one. */
function _isHeadingShaped(text, maxChars, maxWords) {
  if (!text) return false;
  if (text.length > maxChars) return false;
  if (text.split(/\s+/).length > maxWords) return false;

  const first = text.charAt(0);
  /* Starts mid-sentence. Devanagari has no case, so this only rejects Latin. */
  if (first.toLowerCase() === first && first.toUpperCase() !== first) return false;

  /* Headings open with a word or a quote, never with punctuation or a marker
     like "*** START OF THE PROJECT GUTENBERG EBOOK ***". */
  if (!CH_OPENS_LIKE_HEADING.test(text)) return false;

  if (/[,;:—-]$/.test(text)) return false;     /* ends mid-sentence */
  if (CH_PROSE_BREAK.test(text)) return false;      /* contains a sentence end */
  return true;
}

function classifyChapterLine(text) {
  if (!_isHeadingShaped(text, CH_MAX_CHARS_ANCHORED, CH_MAX_WORDS_ANCHORED)) return null;

  /* Resolved across the document, not here (see CH_BARE_NUMERAL). */
  if (CH_BARE_NUMERAL.test(text)) return null;

  if (CH_DEVANAGARI_HEAD.test(text)) {
    return { rule: 'devanagari-keyword', depth: CH_DEVANAGARI_PART.test(text) ? 1 : 2 };
  }

  const keyword = text.match(CH_KEYWORD);
  if (keyword && CH_ORDINAL.test(text.slice(keyword[0].length))) {
    const word = keyword[1].toLowerCase();
    const isVolume = word === 'book' || word === 'part' || word === 'volume';
    return { rule: 'keyword', depth: isVolume ? 1 : 2 };
  }

  /* Past here every rule is a guess from shape, so the tight bound applies. */
  if (!_isHeadingShaped(text, CH_MAX_CHARS, CH_MAX_WORDS)) return null;

  if (CH_FRONT_MATTER.test(text)) return { rule: 'front-matter', depth: 1 };

  if (CH_LABEL.test(text)) return null;

  if (CH_NUMBERED.test(text)) {
    const lead = text.split(/\s+/)[0];
    return { rule: 'numbered', depth: Math.min(4, (lead.match(/\./g) || []).length + 1) };
  }

  if (CH_ROMAN_ONLY.test(text)) return { rule: 'roman', depth: 2 };

  /* Devanagari has no case, so neither case rule below can apply to it. */
  if (CH_HAS_DEVANAGARI.test(text)) {
    if (!/।$/.test(text) && text.split(/\s+/).length <= 8) {
      return { rule: 'devanagari-short', depth: 3 };
    }
    return null;
  }

  if (_isAllCaps(text)) return { rule: 'all-caps', depth: 2 };
  if (_isTitleCase(text)) return { rule: 'title-case', depth: 3 };

  return null;
}

function _isAllCaps(text) {
  let letters = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i);
    const lower = c.toLowerCase();
    const upper = c.toUpperCase();
    if (lower === upper) continue;       /* not a cased letter */
    if (c !== upper) return false;
    letters++;
  }
  return letters >= 2;
}

function _isTitleCase(text) {
  const words = text.split(/\s+/);
  if (words.length < 2 || words.length > 10) return false;
  if (!/^[A-Z]/.test(text)) return false;
  if (/[.!?]$/.test(text)) return false;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (/^[A-Z0-9(“"']/.test(word)) continue;
    if (CH_STOPWORDS.indexOf(word.toLowerCase().replace(/^[.,]+|[.,]+$/g, '')) !== -1) continue;
    return false;
  }
  return true;
}

/* Bare numerals, resolved as a document-wide sequence. One "7" proves nothing;
   7 after 6 after 5, each a chapter's worth of words later, is a chapter list.
   The longest such run wins, so a book's real markers outvote the stray
   numbers around them.

   This one rule reads rawLines rather than paragraphs, against the discipline
   at the top of this file, and deliberately: a bare numeral IS a standalone
   line, and paragraph inference merges it into the chapter's first paragraph
   (the numeral ends no sentence, so the next line does not start one), which
   is where it became invisible. The fragment problem that moved everything
   else to paragraphs cannot arise here -- a fragment of prose is not a bare
   number -- and the sequence test is a far stronger guard than any shape. */
function _numeralSequenceHits(lines) {
  const candidates = [];
  for (let i = 0; i < lines.length; i++) {
    const text = String((lines[i] && lines[i].text) || '').replace(/\s+/g, ' ').trim();
    const match = text.match(CH_BARE_NUMERAL);
    if (!match) continue;
    let digits = '';
    for (let c = 0; c < match[1].length; c++) {
      const code = match[1].charCodeAt(c);
      digits += (code >= 0x0966 && code <= 0x096F) ? String(code - 0x0966) : match[1].charAt(c);
    }
    const value = parseInt(digits, 10);
    if (isNaN(value) || value === 0) continue;
    if (typeof lines[i].wordIndex !== 'number') continue;
    candidates.push({
      value: value,
      title: text,
      page: (lines[i].pageIndex || 0) + 1,
      wordIndex: lines[i].wordIndex,
    });
  }
  if (candidates.length < CH_SEQUENCE_MIN_RUN) return [];

  /* Longest ascending run, by the four tests above. */
  const best = [];
  const from = [];
  let endOfBest = -1;
  for (let i = 0; i < candidates.length; i++) {
    best[i] = 1;
    from[i] = -1;
    for (let j = 0; j < i; j++) {
      const step = candidates[i].value - candidates[j].value;
      const gap = candidates[i].wordIndex - candidates[j].wordIndex;
      if (step < 1 || step > CH_SEQUENCE_MAX_STEP) continue;
      if (gap < CH_SEQUENCE_MIN_GAP) continue;
      if (best[j] + 1 > best[i]) { best[i] = best[j] + 1; from[i] = j; }
    }
    if (endOfBest === -1 || best[i] > best[endOfBest]) endOfBest = i;
  }
  if (endOfBest === -1 || best[endOfBest] < CH_SEQUENCE_MIN_RUN) return [];

  const run = [];
  for (let k = endOfBest; k !== -1; k = from[k]) run.unshift(candidates[k]);

  const offsets = {};
  let commonest = 0;
  for (let i = 0; i < run.length; i++) {
    const offset = run[i].value - run[i].page;
    offsets[offset] = (offsets[offset] || 0) + 1;
    if (offsets[offset] > commonest) commonest = offsets[offset];
  }
  if (commonest / run.length > CH_SEQUENCE_MAX_PAGENO_SHARE) {
    console.log('[chapters] numeral sequence of ' + run.length
      + ' rejected: it tracks the page number (' + commonest + ' at one offset)');
    return [];
  }

  console.log('[chapters] numeral sequence: ' + run.length + ' markers, '
    + run[0].value + ' to ' + run[run.length - 1].value);
  return run.map(function(c) {
    return { title: c.title, rule: 'numeral-sequence', depth: 2, page: c.page, wordIndex: c.wordIndex };
  });
}

/* If a book numbers its chapters, that is its structure, and the shape-based
   guesses are redundant — they only add things that merely look like headings:
   an all-caps line inside a story, a centred name under a poem. A book of fairy
   tales or poems has its titles in exactly those shapes and nothing stronger, so
   the guesses are only dropped where the numbered structure dominates. */
function _dropWeakRules(hits) {
  let strong = 0;
  let weak = 0;
  for (let i = 0; i < hits.length; i++) {
    if (CH_STRONG_RULES.indexOf(hits[i].rule) !== -1) strong++;
    else if (CH_WEAK_RULES.indexOf(hits[i].rule) !== -1) weak++;
  }
  if (strong < CH_STRONG_ENOUGH || strong <= weak) return hits;
  return hits.filter(function(hit) { return CH_WEAK_RULES.indexOf(hit.rule) === -1; });
}

function _dedupeChapters(hits) {
  const seen = new Set();
  const deduped = [];
  for (let i = 0; i < hits.length; i++) {
    const key = hits[i].title.toLowerCase() + '::' + hits[i].wordIndex;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(hits[i]);
  }
  return deduped;
}

/* A contents page lists the same headings the body does, so each chapter is
   found twice and the index shows it twice. When every earlier copy of a title
   sits in the opening tenth of the book, those are the listing and the last one
   is the chapter — which is also the one worth navigating to. A title that
   repeats deeper in (the roman numerals inside a poetry collection) is left
   alone, because there it is genuinely a repeated marker. */
function _dropFrontDuplicates(hits, totalWords) {
  if (!totalWords) return hits;
  const cutoff = totalWords * CH_FRONT_MATTER_SHARE;

  const groups = new Map();
  for (let i = 0; i < hits.length; i++) {
    const key = hits[i].title.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(hits[i]);
  }

  const dropped = new Set();
  groups.forEach(function(group) {
    if (group.length < 2) return;
    group.sort(function(a, b) { return a.wordIndex - b.wordIndex; });
    for (let i = 0; i < group.length - 1; i++) {
      if (group[i].wordIndex >= cutoff) return;
    }
    for (let i = 0; i < group.length - 1; i++) dropped.add(group[i]);
  });

  return hits.filter(function(hit) { return !dropped.has(hit); });
}
