/* OCR-PDF parser — runs ML Kit on each page of a scanned/image-only PDF
   and returns the standard reader data model.
   pdfDoc must be a loaded pdf.js PDFDocumentProxy. */

/* Pull the largest image XObject off a page. For scanner PDFs whose embedded
   image format isn't fully supported by pdf.js's renderer, the decoded bitmap
   on page.objs is often still usable via canvas drawImage. */
async function _extractLargestImage(page) {
  try {
    const opList = await page.getOperatorList();
    const OPS = (typeof pdfjsLib !== 'undefined' && pdfjsLib.OPS) ? pdfjsLib.OPS : null;
    if (!OPS) return null;
    const imageOps = [OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintJpegXObject];
    const names = [];
    for (let i = 0; i < opList.fnArray.length; i++) {
      if (imageOps.indexOf(opList.fnArray[i]) !== -1) {
        const arg = opList.argsArray[i] && opList.argsArray[i][0];
        if (typeof arg === 'string') names.push(arg);
      }
    }
    if (!names.length) { console.log('[OCR] no image XObjects on page'); return null; }

    let best = null;
    for (let j = 0; j < names.length; j++) {
      const name = names[j];
      let obj = null;
      try {
        obj = await new Promise(function(resolve) {
          try { page.objs.get(name, function(o) { resolve(o); }); }
          catch (_) { resolve(null); }
        });
      } catch (_) { obj = null; }
      if (!obj) continue;
      const w = obj.width || (obj.bitmap && obj.bitmap.width) || 0;
      const h = obj.height || (obj.bitmap && obj.bitmap.height) || 0;
      const area = w * h;
      if (!best || area > best.area) best = { obj: obj, w: w, h: h, area: area, name: name };
    }
    if (!best || !best.w || !best.h) { console.log('[OCR] image XObjects not decodable'); return null; }

    const canvas = document.createElement('canvas');
    canvas.width = best.w;
    canvas.height = best.h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, best.w, best.h);
    const drawable = best.obj.bitmap || best.obj.data || best.obj;
    try {
      if (drawable instanceof ImageBitmap || drawable instanceof HTMLImageElement || drawable instanceof HTMLCanvasElement) {
        ctx.drawImage(drawable, 0, 0);
      } else if (drawable && drawable.constructor && /Uint8/.test(drawable.constructor.name)) {
        /* Raw pixel data */
        const imgData = ctx.createImageData(best.w, best.h);
        if (drawable.length === imgData.data.length) {
          imgData.data.set(drawable);
        } else {
          /* RGB → RGBA conversion */
          let di = 0;
          for (let si = 0; si < drawable.length; si += 3) {
            imgData.data[di++] = drawable[si];
            imgData.data[di++] = drawable[si + 1];
            imgData.data[di++] = drawable[si + 2];
            imgData.data[di++] = 255;
          }
        }
        ctx.putImageData(imgData, 0, 0);
      } else {
        console.log('[OCR] image XObject unknown type:', typeof drawable);
        return null;
      }
    } catch (drawErr) {
      console.log('[OCR] drawImage from XObject failed:', drawErr);
      return null;
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    console.log('[OCR] extracted XObject ' + best.w + 'x' + best.h + ', jpeg bytes=' + dataUrl.length);
    window._lastOcrPagePreview = dataUrl;
    return dataUrl.split(',')[1];
  } catch (e) {
    console.log('[OCR] _extractLargestImage exception:', e);
    return null;
  }
}

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
      /* Primary path: render full page via pdf.js */
      const base64 = await OCREngine.pdfPageToBase64(page);
      pageText = await OCREngine.recogniseBase64(base64);
      console.log('[OCR] page ' + p + ' primary result chars=' + pageText.length);

      /* Fallback: if primary returned almost nothing, try extracting embedded image XObjects
         directly. Many scanner PDFs (JBIG2/JP2-encoded) render blank via pdf.js but the
         underlying ImageBitmap on page.objs is still decodable by canvas drawImage. */
      if (pageText.replace(/\s+/g, '').length < 20) {
        const imgBase64 = await _extractLargestImage(page);
        if (imgBase64) {
          const altText = await OCREngine.recogniseBase64(imgBase64);
          console.log('[OCR] page ' + p + ' fallback image result chars=' + altText.length);
          if (altText.length > pageText.length) pageText = altText;
        }
      }
    } catch (err) {
      console.error('OCR page', p, 'failed:', err);
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
  console.log('[OCR] total wordCount after OCR=' + wordCount);

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
