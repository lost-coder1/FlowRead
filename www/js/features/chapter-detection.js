/* Chapter detection from cleaned PDF lines */

function detectChapters(rawLines, pageWordIndex) {
  if (!Array.isArray(rawLines) || rawLines.length === 0) return [];

  const chapters = [];

  for (const line of rawLines) {
    const text = (line.text || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;

    const chapter = classifyChapterLine(text, line, pageWordIndex);
    if (chapter) chapters.push(chapter);
  }

  return dedupeChapters(chapters);
}

function classifyChapterLine(text, line, pageWordIndex) {
  const page = (line.pageIndex || 0) + 1;
  const wordIndex = typeof line.wordIndex === 'number' ? line.wordIndex : pageToWordIndex(page);

  if (/^(chapter|part)\s+([a-z0-9ivxlcdm]+)/i.test(text)) {
    return { title: text, depth: 1, page, wordIndex };
  }

  if (/^\d+(\.\d+){0,3}\s+[A-Z][\w'’,:;()/-]*(\s+[A-Z][\w'’,:;()/-]*)*$/.test(text)) {
    const depth = Math.min(4, (text.match(/\./g) || []).length + 1);
    return { title: text, depth, page, wordIndex };
  }

  if (text.length <= 60 && /^[A-Z0-9\s&:,'’()-]+$/.test(text) && /[A-Z]/.test(text)) {
    return { title: text, depth: 2, page, wordIndex };
  }

  if (
    text.length <= 72 &&
    /^[A-Z][A-Za-z0-9'’&:(),/-]*(\s+[A-Z][A-Za-z0-9'’&:(),/-]*){1,7}$/.test(text) &&
    !/[.!?]$/.test(text)
  ) {
    return { title: text, depth: 3, page, wordIndex };
  }

  return null;
}

function dedupeChapters(chapters) {
  const seen = new Set();
  const deduped = [];

  for (const chapter of chapters) {
    const key = [chapter.title.toLowerCase(), chapter.page, chapter.wordIndex].join('::');
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(chapter);
  }

  return deduped.sort(function(a, b) {
    return a.wordIndex - b.wordIndex;
  });
}
