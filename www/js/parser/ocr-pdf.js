/* OCR-PDF parser — runs ML Kit on each page of a scanned/image-only PDF
   and returns the standard reader data model.
   pdfDoc must be a loaded pdf.js PDFDocumentProxy. */

async function parseScannedPDF(pdfDoc, onProgress) {
  if (!OCREngine.isAvailable()) throw { type: 'ocr-unavailable', detail: 'OCR not available' };

  const pageCount = pdfDoc.numPages;
  const words = [];
  const pageWordIndex = [];
  const rawLines = [];

  for (let p = 1; p <= pageCount; p++) {
    if (typeof onProgress === 'function') onProgress(p, pageCount);

    let pageText = '';
    try {
      const page = await pdfDoc.getPage(p);
      const base64 = await OCREngine.pdfPageToBase64(page);
      pageText = await OCREngine.recogniseBase64(base64);
    } catch (_) {
      pageText = '';
    }

    pageWordIndex.push(words.length);

    const pageLines = pageText.split('\n').filter(function(l) { return l.trim().length > 0; });
    pageLines.forEach(function(line) {
      const lineWordStart = words.length;
      const lineWords = line.trim().split(/\s+/).filter(Boolean);
      lineWords.forEach(function(w) { words.push(w); });
      if (lineWords.length > 0) {
        rawLines.push({ text: line.trim(), pageIndex: p - 1, wordIndex: lineWordStart });
      }
    });
  }

  const wordCount = words.filter(function(w) { return typeof w === 'string'; }).length;

  return {
    words: words,
    pageWordIndex: pageWordIndex,
    rawLines: rawLines,
    metadata: {
      pageCount: pageCount,
      wordCount: wordCount,
      hasTextLayer: true,
      sourceType: 'pdf-ocr',
      title: '',
    },
  };
}
