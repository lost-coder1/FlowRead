/* Bi-directional page/word bridge between speed modes and Normal PDF view */

function pageToWordIndex(pageNumber) {
  const file = AppState.currentFile;
  if (!file || !Array.isArray(file.pageWordIndex) || file.pageWordIndex.length === 0) {
    return 0;
  }

  const pageCount = file.pageWordIndex.length;
  const safePage = Math.max(1, Math.min(pageCount, pageNumber || 1));
  return file.pageWordIndex[safePage - 1] || 0;
}

function wordIndexToPage(wordIndex) {
  const file = AppState.currentFile;
  if (!file || !Array.isArray(file.pageWordIndex) || file.pageWordIndex.length === 0) {
    return 1;
  }

  const target = Math.max(0, wordIndex || 0);
  let resolvedPage = 1;
  for (let i = 0; i < file.pageWordIndex.length; i++) {
    if (file.pageWordIndex[i] <= target) {
      resolvedPage = i + 1;
    } else {
      break;
    }
  }
  return resolvedPage;
}

function openNormalAtPage(pageNumber) {
  const page = Math.max(1, pageNumber || 1);
  if (typeof _activeEngine !== 'undefined' && _activeEngine && typeof _activeEngine.pause === 'function') {
    _activeEngine.pause();
  }
  AppState.normalPage = page;
  switchView('view-normal');
  renderNormal(page);
}

function openNormalAtCurrentWord() {
  openNormalAtPage(wordIndexToPage(AppState.currentIndex));
}

function jumpReaderToPage(pageNumber, options) {
  const wordIndex = pageToWordIndex(pageNumber);
  jumpReaderToWord(wordIndex, options);
}

function jumpReaderToWord(wordIndex, options) {
  const opts = options || {};
  AppState.currentIndex = Math.max(0, wordIndex || 0);
  renderReader({
    startIndex: AppState.currentIndex,
    autoPlay: opts.autoPlay === true,
    silentResume: opts.silentResume !== false,
  });
  switchView('view-reader');
}

async function openObjectPlaceholder(word) {
  if (!word || typeof word !== 'object' || word.type !== 'placeholder') return;

  const file = AppState.currentFile;
  const targetPage = word.page || wordIndexToPage(AppState.currentIndex);

  /* pdfDoc is not serialisable — on a resumed session it is null until loaded */
  if (file && !file.pdfDoc && file.pdfRawAvailable) {
    showLoading('Loading PDF…');
    try {
      const buf = await loadRawPdf(file.id);
      if (!buf) {
        hideLoading();
        showToast('PDF data missing. Please re-import.');
        return;
      }
      const data = new Uint8Array(buf);
      file.pdfDoc = await pdfjsLib.getDocument({ data }).promise;
      hideLoading();
    } catch (err) {
      hideLoading();
      showToast('Could not open PDF. Please re-import.');
      return;
    }
  }

  if (file && !file.pdfDoc) {
    showToast('Re-import this PDF to view inline content.');
    return;
  }

  openNormalAtPage(targetPage);
}
