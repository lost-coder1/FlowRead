/* Handles URLs shared to FlowRead from the Android share sheet.
   Two paths:
   - Cold start: URL stored in Preferences by MainActivity.onCreate, read here on boot.
   - Hot start (app already open): window event fired by MainActivity.onNewIntent. */

function initShareHandler() {
  _checkPendingShare();

  window.addEventListener('flowreadShareIntent', async function() {
    await _checkPendingShare();
  });
}

async function _checkPendingShare() {
  const Preferences = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences;
  if (!Preferences) return;
  try {
    const result = await Preferences.get({ key: 'fr_pending_share' });
    if (!result || !result.value) return;
    const url = result.value;
    await Preferences.remove({ key: 'fr_pending_share' });
    await _handleShareUrl(url);
  } catch (_) {}
}

/* Browsers sometimes share "Page Title\nhttps://..." — extract the URL portion. */
function _extractUrl(text) {
  if (!text) return '';
  const trimmed = text.trim();
  if (/^https?:\/\//i.test(trimmed)) return _sanitizeSharedUrl(trimmed);
  const match = trimmed.match(/https?:\/\/[^\s]+/i);
  return match ? _sanitizeSharedUrl(match[0]) : trimmed;
}

function _sanitizeSharedUrl(url) {
  return String(url || '').trim().replace(/[)\],:;"'!?]+$/g, '');
}

async function _handleShareUrl(rawText) {
  const rawUrl = _extractUrl(rawText);

  const pro = await hasProAccess();
  if (!pro) {
    showProPaywall('share');
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = validateArticleUrl(rawUrl);
  } catch (_) {
    _showShareError('Shared link is not a valid article URL.');
    return;
  }

  if (navigator.onLine === false) {
    showToast('No internet connection — article not saved.');
    return;
  }

  showLoading('Saving article…');

  try {
    const article = await fetchReadableArticle(parsedUrl);
    const fileId = generateFileId('url', article.sourceUrl, article.wordCount);
    savePosition(fileId, 0);

    saveFileToLibrary({
      id: fileId,
      kind: 'url',
      name: article.title,
      wordCount: article.wordCount,
      pageCount: 1,
      sourceUrl: article.sourceUrl,
      lastOpened: Date.now(),
    });

    await saveFileData(fileId, {
      id: fileId,
      name: article.title,
      words: article.words,
      pageWordIndex: [0],
      rawLines: article.rawLines,
      metadata: {
        sourceType: 'url',
        title: article.title,
        sourceUrl: article.sourceUrl,
        wordCount: article.wordCount,
        pageCount: 1,
        hasTextLayer: true,
      },
      pdfDoc: null,
    });

    hideLoading();
    AppState.currentFile = {
      id: fileId,
      name: article.title,
      words: article.words,
      pageWordIndex: [0],
      rawLines: article.rawLines,
      metadata: {
        sourceType: 'url',
        title: article.title,
        sourceUrl: article.sourceUrl,
        wordCount: article.wordCount,
        pageCount: 1,
        hasTextLayer: true,
      },
      pdfDoc: null,
    };
    AppState.currentIndex = 0;

    const defaultMode = (AppState.settings && AppState.settings.defaultMode) || 'rsvp';
    AppState.currentEngine = defaultMode;
    AppState.lastReaderEngine = defaultMode;
    localStorage.setItem('fr_last_engine', defaultMode);

    renderReader({ startIndex: 0, silentResume: true });
    switchView('view-reader');
  } catch (err) {
    hideLoading();
    console.error('Share handler fetch failed:', err);
    const failure = typeof normalizeUrlImportError === 'function'
      ? normalizeUrlImportError(err)
      : { message: 'Could not fetch article — try opening it in the app.' };
    _showShareError(failure.message);
  }
}

function _showShareError(message) {
  if ((AppState.currentView === 'view-upload' || AppState.currentView === 'view-dashboard') && typeof showUploadError === 'function') {
    showUploadError('Shared URL import failed', message);
    return;
  }

  showToast(message, 5000);
}
