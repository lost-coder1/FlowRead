/* Image parser — runs OCR on one or more image files and returns the
   standard reader data model { words, pageWordIndex, rawLines, metadata } */

async function parseImages(files, onProgress) {
  if (!files || files.length === 0) throw { type: 'empty', detail: 'No images provided' };
  if (!OCREngine.isAvailable()) throw { type: 'ocr-unavailable', detail: 'OCR not available' };

  const words = [];
  const pageWordIndex = [];
  const rawLines = [];

  for (let i = 0; i < files.length; i++) {
    if (typeof onProgress === 'function') onProgress(i + 1, files.length);

    let pageText = '';
    try {
      const base64 = await OCREngine.imageFileToBase64(files[i]);
      pageText = await OCREngine.recogniseBase64(base64);
    } catch (_) {
      /* Non-fatal — blank page placeholder keeps page count correct */
      pageText = '';
    }

    pageWordIndex.push(words.length);
    const lineStart = words.length;

    const pageLines = pageText.split('\n').filter(function(l) { return l.trim().length > 0; });
    pageLines.forEach(function(line) {
      const lineWordStart = words.length;
      const lineWords = line.trim().split(/\s+/).filter(Boolean);
      lineWords.forEach(function(w) { words.push(w); });
      if (lineWords.length > 0) {
        rawLines.push({ text: line.trim(), pageIndex: i, wordIndex: lineWordStart });
      }
    });
  }

  const wordCount = words.filter(function(w) { return typeof w === 'string'; }).length;

  return {
    words: words,
    pageWordIndex: pageWordIndex,
    rawLines: rawLines,
    metadata: {
      pageCount: files.length,
      wordCount: wordCount,
      hasTextLayer: true, /* OCR result treated as text layer */
      sourceType: 'image',
      title: files.length === 1 ? files[0].name : files.length + ' images',
    },
  };
}
