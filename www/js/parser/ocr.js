/* OCR engine — wraps @pantrist/capacitor-plugin-ml-kit-text-recognition
   Input:  base64 JPEG string (no data-URL prefix)
   Output: plain text string of recognised content */

const OCREngine = (function() {

  function _plugin() {
    return (typeof Capacitor !== 'undefined' &&
            Capacitor.Plugins &&
            Capacitor.Plugins.CapacitorPluginMlKitTextRecognition)
      ? Capacitor.Plugins.CapacitorPluginMlKitTextRecognition : null;
  }

  function isAvailable() {
    return !!_plugin();
  }

  /* Recognise text from a base64-encoded JPEG string.
     Returns plain text; throws if plugin unavailable or recognition fails. */
  async function recogniseBase64(base64Jpeg) {
    const plugin = _plugin();
    if (!plugin) throw new Error('OCR plugin not available on this platform.');
    const result = await plugin.detectText({ base64Image: base64Jpeg });
    return (result && result.text) ? result.text.trim() : '';
  }

  /* Render a pdf.js page to a canvas and return a base64 JPEG string.
     scale=2 gives ~150 DPI on a 96 DPI screen — good enough for ML Kit. */
  async function pdfPageToBase64(pdfPage) {
    const viewport = pdfPage.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await pdfPage.render({ canvasContext: ctx, viewport: viewport }).promise;
    /* toDataURL returns "data:image/jpeg;base64,<data>" — strip the prefix */
    return canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
  }

  /* Convert an image File/Blob to a base64 JPEG string via canvas.
     Handles JPG, PNG, HEIC, WEBP — anything the browser can decode. */
  async function imageFileToBase64(file) {
    return new Promise(function(resolve, reject) {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = function() {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]);
      };
      img.onerror = function() { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
      img.src = url;
    });
  }

  return { isAvailable, recogniseBase64, pdfPageToBase64, imageFileToBase64 };
})();
