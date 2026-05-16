/* Upload / Home screen */

function renderUpload() {
  closeActiveModal();
  const view = qs('#view-upload');
  view.innerHTML = `
    <div class="upload-screen">
      <header class="upload-header upload-header-wide">
        <div>
          <h1 class="app-name">FlowRead</h1>
          <p class="app-tagline">Read everything faster</p>
        </div>
        <div class="upload-header-actions">
          <button class="btn btn-ghost" id="btn-open-settings-top" type="button">Settings</button>
        </div>
      </header>

      <div class="import-grid" id="import-grid">
        <button class="import-card import-card-featured" id="upload-zone" role="button" tabindex="0" aria-label="Open PDF">
          <span class="import-card-head">
            <strong>PDF Reader</strong>
            <span class="import-badge">Free</span>
          </span>
          <span class="import-card-body">
            <div class="upload-zone-icon" style="margin: 0 auto 8px; display: block; width: 32px; height: 32px;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <polyline points="9,15 12,12 15,15"/>
              </svg>
            </div>
            Tap to open PDF files. All 4 reading engines included.
          </span>
        </button>

        <button class="import-card" id="btn-paste-reader" type="button">
          <span class="import-card-head">
            <strong>Paste Text</strong>
            <span class="import-badge">Free</span>
          </span>
          <span class="import-card-body">Paste or type any text and read it with all 4 engines.</span>
        </button>

        <button class="import-card" id="btn-url-reader" type="button">
          <span class="import-card-head">
            <strong>URL Reader</strong>
            <span class="import-badge" id="url-reader-badge">Pro</span>
          </span>
          <span class="import-card-body">Paste an article URL. Requires internet.</span>
        </button>

        <button class="import-card import-card-locked" id="btn-docx-reader" type="button">
          <span class="import-card-head">
            <strong>DOCX Import</strong>
            <span class="import-badge">Pro</span>
          </span>
          <span class="import-card-body">Word documents with the same reading engines.</span>
        </button>

        <button class="import-card import-card-locked" id="btn-txt-reader" type="button">
          <span class="import-card-head">
            <strong>TXT Import</strong>
            <span class="import-badge">Pro</span>
          </span>
          <span class="import-card-body">Plain text import for notes and drafts.</span>
        </button>

        <button class="import-card import-card-locked" id="btn-image-reader" type="button">
          <span class="import-card-head">
            <strong>Image / Scan</strong>
            <span class="import-badge">OCR Vision</span>
          </span>
          <span class="import-card-body">Take a photo or pick images. OCR extracts the text on-device.</span>
        </button>

        <button class="import-card import-card-featured import-card-locked" id="btn-dashboard" type="button">
          <span class="import-card-head">
            <strong>Dashboard</strong>
            <span class="import-badge">Pro</span>
          </span>
          <span class="import-card-body">Reading stats, streaks, and future analytics.</span>
        </button>
      </div>

      <section class="url-panel hidden" id="url-panel">
        <label class="url-panel-label" for="url-input">Paste article URL</label>
        <div class="url-panel-row">
          <input class="url-input" id="url-input" type="url" inputmode="url" placeholder="https://example.com/article" />
          <button class="btn btn-primary" id="btn-import-url" type="button">Import</button>
        </div>
        <p class="url-panel-note">Pro feature. Requires internet. Parsing stays on this device.</p>
      </section>

      <input type="file" id="file-input" accept=".pdf" style="display:none" />
      <input type="file" id="file-input-docx" accept=".docx" style="display:none" />
      <input type="file" id="file-input-txt" accept=".txt" style="display:none" />
      <input type="file" id="file-input-image" accept="image/*" multiple style="display:none" />

      <div id="upload-error" class="hidden" style="margin: 0 24px; width: 100%; max-width: 680px;"></div>

      <div id="library-section" class="library-section">
        <!-- Populated by renderLibrary() -->
      </div>

      <footer class="upload-footer">
        <button class="btn btn-ghost" id="btn-sync-files">Sync files</button>
        <button class="btn btn-ghost" id="btn-open-settings">Settings</button>
        <button class="btn btn-ghost" id="btn-open-limitations">Limitations</button>
      </footer>
    </div>
  `;

  const uploadZone = qs('#upload-zone');
  if (uploadZone) {
    uploadZone.addEventListener('click', function() { qs('#file-input').click(); });
    uploadZone.addEventListener('keydown', function(event) {
      if (event.key === 'Enter' || event.key === ' ') qs('#file-input').click();
    });
  }
  qs('#file-input').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) handleFileSelect(file);
    event.target.value = '';
  });

  qs('#file-input-docx').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) handleDocxSelect(file);
    event.target.value = '';
  });

  qs('#file-input-txt').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) handleTxtSelect(file);
    event.target.value = '';
  });

  qs('#file-input-image').addEventListener('change', function(event) {
    const files = event.target.files;
    if (files && files.length) handleImageSelect(files);
    event.target.value = '';
  });

  qs('#btn-sync-files').addEventListener('click', syncDeviceFiles);
  qs('#btn-open-settings').addEventListener('click', renderSettings);
  qs('#btn-open-settings-top').addEventListener('click', renderSettings);
  qs('#btn-open-limitations').addEventListener('click', function() {
    renderSettings();
    const section = qs('.settings-limitations');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  qs('#btn-paste-reader').addEventListener('click', openPasteText);
  qs('#btn-url-reader').addEventListener('click', openUrlReader);
  qs('#btn-docx-reader').addEventListener('click', openDocxReader);
  qs('#btn-txt-reader').addEventListener('click', openTxtReader);
  qs('#btn-dashboard').addEventListener('click', openDashboard);
  qs('#btn-image-reader').addEventListener('click', openImageReader);
  qs('#btn-import-url').addEventListener('click', function() {
    handleUrlImport(qs('#url-input').value);
  });
  qs('#url-input').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') handleUrlImport(this.value);
  });

  hydrateUploadSurface();
  renderLibrary();
}

async function hydrateUploadSurface() {
  const pro = await hasProAccess();
  const badge = qs('#url-reader-badge');
  const panel = qs('#url-panel');
  const button = qs('#btn-url-reader');

  if (!button || !badge || !panel) return;

  if (pro) {
    badge.textContent = 'Requires internet';
    button.classList.add('import-card-live');
  } else {
    badge.textContent = 'Pro';
    panel.classList.add('hidden');
    button.classList.remove('import-card-live');
  }

  /* Stats bar — shown only for Pro users; always refreshed so stats are current */
  const existingBar = qs('#home-stats-bar');
  if (pro) {
    const sessions = loadReadingSessions();
    const streak = computeStreak(sessions);
    const today = todayDateString();
    const todayWords = sessions
      .filter(function(s) { return s.date === today; })
      .reduce(function(acc, s) { return acc + (s.wordsRead || 0); }, 0);
    const avgWpm = last7DaysAvgWpm(sessions);

    const statsHtml = [
      '<div class="home-stat"><span class="home-stat-value">' + streak + '</span><span class="home-stat-label">day streak</span></div>',
      '<div class="home-stat"><span class="home-stat-value">' + formatNumber(todayWords) + '</span><span class="home-stat-label">words today</span></div>',
      '<div class="home-stat"><span class="home-stat-value">' + (avgWpm > 0 ? formatWPM(avgWpm) : '—') + '</span><span class="home-stat-label">avg WPM</span></div>',
    ].join('');

    if (existingBar) {
      existingBar.innerHTML = statsHtml;
    } else {
      const bar = document.createElement('div');
      bar.id = 'home-stats-bar';
      bar.className = 'home-stats-bar';
      bar.innerHTML = statsHtml;
      const libSection = qs('#library-section');
      if (libSection) libSection.before(bar);
    }
  } else if (existingBar) {
    existingBar.remove();
  }

  /* Unlock DOCX and TXT cards when Pro is active */
  const docxCard = qs('#btn-docx-reader');
  const txtCard = qs('#btn-txt-reader');
  const dashboardCard = qs('#btn-dashboard');
  const imageCard = qs('#btn-image-reader');
  const ocr = pro ? await hasOcrAccess() : false;

  if (pro) {
    if (docxCard) {
      docxCard.classList.remove('import-card-locked');
      docxCard.classList.add('import-card-live');
      const badge = docxCard.querySelector('.import-badge');
      if (badge) badge.textContent = 'Word documents';
    }
    if (txtCard) {
      txtCard.classList.remove('import-card-locked');
      txtCard.classList.add('import-card-live');
      const badge = txtCard.querySelector('.import-badge');
      if (badge) badge.textContent = 'Plain text';
    }
    if (dashboardCard) {
      dashboardCard.classList.remove('import-card-locked');
      dashboardCard.classList.add('import-card-live');
      const badge = dashboardCard.querySelector('.import-badge');
      if (badge) badge.textContent = 'Analytics';
    }
  } else {
    if (docxCard) docxCard.classList.add('import-card-locked');
    if (txtCard) txtCard.classList.add('import-card-locked');
    if (dashboardCard) dashboardCard.classList.add('import-card-locked');
  }

  if (imageCard) {
    if (ocr) {
      imageCard.classList.remove('import-card-locked');
      imageCard.classList.add('import-card-live');
      const badge = imageCard.querySelector('.import-badge');
      if (badge) badge.textContent = 'On-device OCR';
    } else {
      imageCard.classList.add('import-card-locked');
    }
  }
}

function openPasteText() {
  const modalHTML = `
    <div class="paste-modal-overlay" id="paste-modal-overlay">
      <div class="paste-modal">
        <div class="paste-modal-header">
          <p class="paste-modal-title">Paste or type text</p>
          <button class="btn btn-ghost paste-modal-close" id="paste-modal-close" type="button">×</button>
        </div>
        <div class="paste-modal-body">
          <input type="text" id="paste-title-input" class="paste-title-input" placeholder="Untitled paste (optional)" />
          <textarea id="paste-text-input" class="paste-text-input" placeholder="Paste or type text here…" spellcheck="true"></textarea>
        </div>
        <div class="paste-modal-footer">
          <button class="btn btn-secondary" id="paste-modal-cancel" type="button">Cancel</button>
          <button class="btn btn-primary" id="paste-modal-read" type="button">Read Now</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
  const overlay = qs('#paste-modal-overlay');
  const titleInput = qs('#paste-title-input');
  const textInput = qs('#paste-text-input');

  function closeModal() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  qs('#paste-modal-close').addEventListener('click', closeModal);
  qs('#paste-modal-cancel').addEventListener('click', closeModal);

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeModal();
  });

  qs('#paste-modal-read').addEventListener('click', function() {
    const title = titleInput.value.trim() || 'Pasted text';
    const text = textInput.value.trim();

    if (text.length < 10) {
      showToast('Please paste at least 10 characters to read.');
      return;
    }

    closeModal();
    handlePasteTextImport(title, text);
  });

  titleInput.focus();
}

async function openUrlReader() {
  const pro = await hasProAccess();
  const panel = qs('#url-panel');
  const input = qs('#url-input');

  if (!pro) {
    showProPaywall('url-reader');
    return;
  }

  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden') && input) {
    input.focus();
  }
}

async function handleFileSelect(file) {
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    showUploadError('Unsupported file', 'Please select a PDF file (.pdf).');
    return;
  }

  clearUploadError();
  showLoading('Reading PDF...');

  window._pdfParseProgress = function(current, total) {
    const msg = qs('#loading-message');
    if (msg) msg.textContent = 'Processing page ' + current + ' of ' + total + '...';
  };

  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    /* Make an independent copy BEFORE parsePDF — pdf.js may transfer ownership of
       the underlying buffer (detaching it), which would corrupt the raw save. */
    const arrayBufferForStorage = arrayBuffer.slice(0);
    const result = await parsePDF(arrayBuffer);

    if (!result.metadata.hasTextLayer) {
      const ocrAccess = await hasOcrAccess();
      if (!ocrAccess) {
        hideLoading();
        showUploadError(
          'Scanned PDF',
          'This appears to be a scanned PDF. OCR Vision can extract the text on-device — no internet required.',
          { actionLabel: 'Unlock OCR Vision', action: function() { showOcrPaywall('scanned-pdf'); } }
        );
        return;
      }
      /* Run OCR on the scanned PDF */
      showLoading('Running OCR…');
      window._pdfParseProgress = function(current, total) {
        const msg = qs('#loading-message');
        if (msg) msg.textContent = 'OCR page ' + current + ' of ' + total + '…';
      };
      let ocrResult;
      try {
        ocrResult = await parseScannedPDF(result.pdfDoc, window._pdfParseProgress);
      } catch (ocrErr) {
        hideLoading();
        window._pdfParseProgress = null;
        showUploadError('OCR failed', 'Could not extract text from this PDF. Try a higher-quality scan or re-import.');
        return;
      }
      if (!ocrResult.metadata.wordCount) {
        hideLoading();
        window._pdfParseProgress = null;
        showUploadError('No text found', 'OCR ran but could not find readable text. The scan may be too low quality.');
        return;
      }
      /* Swap in OCR result and continue the normal import flow */
      result.words = ocrResult.words;
      result.pageWordIndex = ocrResult.pageWordIndex;
      result.rawLines = ocrResult.rawLines;
      result.metadata = Object.assign({}, result.metadata, ocrResult.metadata);
    }

    const fileId = generateFileId(file.name, file.size, file.lastModified || result.metadata.pageCount);
    AppState.currentFile = {
      id: fileId,
      kind: 'pdf',
      name: file.name,
      words: result.words,
      pageWordIndex: result.pageWordIndex,
      rawLines: result.rawLines,
      metadata: Object.assign({}, result.metadata, { sourceType: 'pdf' }),
      pdfDoc: result.pdfDoc,
    };
    AppState.currentIndex = loadPosition(fileId);

    saveFileToLibrary({
      id: fileId,
      kind: 'pdf',
      name: file.name,
      wordCount: result.metadata.wordCount,
      pageCount: result.metadata.pageCount,
      lastOpened: Date.now(),
    });

    /* Save parsed content for resume (pdfDoc excluded — not serialisable) */
    saveFileData(fileId, AppState.currentFile);
    /* Also persist the raw PDF binary so Normal View remains available across restarts.
       Use the pre-parse copy in case pdf.js detached the original. */
    saveRawPdf(fileId, arrayBufferForStorage).then(function(ok) {
      if (!ok) console.warn('Raw PDF save failed for', fileId);
    });

    hideLoading();
    window._pdfParseProgress = null;
    renderReader();
    switchView('view-reader');
  } catch (err) {
    hideLoading();
    window._pdfParseProgress = null;
    console.error('PDF parse error — type:', err && err.type, '| detail:', err && err.detail, '| raw:', err);

    if (err && err.type === 'password') {
      showUploadError('Password-protected PDF', 'This PDF is password-protected. Please remove the password and re-import.');
      return;
    }

    if (err && err.type === 'corrupted') {
      showUploadError('Corrupted PDF', 'This file appears to be damaged. Try opening it in another PDF viewer to confirm it is readable. Detail: ' + (err.detail || 'unknown') + '.');
      return;
    }

    showUploadError('PDF import failed', 'Could not read this PDF. Error: ' + (err && (err.message || err.detail || JSON.stringify(err))));
  }
}

async function handleUrlImport(rawUrl) {
  clearUploadError();

  let parsedUrl;
  try {
    parsedUrl = validateArticleUrl(rawUrl);
  } catch (err) {
    showUploadError('Invalid URL', err.message);
    return;
  }

  if (navigator.onLine === false) {
    showUploadError('No internet connection', 'URL Reader requires internet for the initial fetch. Connect to the internet and try again.');
    return;
  }

  showLoading('Fetching article...');

  try {
    const article = await fetchReadableArticle(parsedUrl);
    const fileId = generateFileId('url', article.sourceUrl, article.wordCount);
    AppState.currentFile = {
      id: fileId,
      kind: 'url',
      name: article.title,
      words: article.words,
      pageWordIndex: [0],
      rawLines: article.rawLines,
      sourceUrl: article.sourceUrl,
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
    AppState.currentIndex = loadPosition(fileId);
    savePosition(fileId, 0);
    AppState.currentIndex = 0;

    saveFileToLibrary({
      id: fileId,
      kind: 'url',
      name: article.title,
      wordCount: article.wordCount,
      pageCount: 1,
      sourceUrl: article.sourceUrl,
      lastOpened: Date.now(),
    });

    await saveFileData(fileId, AppState.currentFile);

    hideLoading();
    renderReader({ silentResume: true });
    switchView('view-reader');
  } catch (err) {
    hideLoading();
    const failure = normalizeUrlImportError(err);
    showUploadError(failure.title, failure.message);
  }
}

function validateArticleUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL((rawUrl || '').trim());
  } catch (_) {
    throw new Error('Enter a full article URL that starts with http:// or https://.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// article URLs are supported.');
  }

  return parsed.toString();
}

async function fetchReadableArticle(url) {
  /* On native (Android/iOS), use CapacitorHttp which makes requests at the
     native layer and bypasses WebView CORS restrictions entirely.
     In browser/desktop, fall back to fetch() with CORS mode. */
  const CapHttp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp;

  if (CapHttp && typeof CapHttp.get === 'function') {
    return _fetchViaCapacitor(url, CapHttp);
  }
  return _fetchViaBrowser(url);
}

async function _fetchViaCapacitor(url, CapHttp) {
  try {
    const response = await CapHttp.get({
      url: url,
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
      },
      connectTimeout: 15000,
      readTimeout: 15000,
    });
    if (response.status === 401) throw { code: 'login-required' };
    if (response.status === 402) throw { code: 'paywalled' };
    if (response.status === 403 || response.status === 429) throw { code: 'blocked' };
    if (response.status < 200 || response.status >= 300) throw { code: 'unsupported-structure', detail: 'HTTP ' + response.status };
    return extractReadableArticle(response.data || '', url);
  } catch (err) {
    if (err && err.code) throw err;
    /* Network errors on native surface as generic errors */
    throw { code: 'timed-out' };
  }
}

async function _fetchViaBrowser(url) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(function() { controller.abort(); }, 15000) : null;
  try {
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: { Accept: 'text/html,application/xhtml+xml' },
      signal: controller ? controller.signal : undefined,
    });
    if (response.status === 401) throw { code: 'login-required' };
    if (response.status === 402) throw { code: 'paywalled' };
    if (response.status === 403 || response.status === 429) throw { code: 'blocked' };
    if (!response.ok) throw { code: 'unsupported-structure', detail: 'HTTP ' + response.status };
    const html = await response.text();
    return extractReadableArticle(html, url);
  } catch (err) {
    if (err && err.name === 'AbortError') throw { code: 'timed-out' };
    if (err && err.code) throw err;
    if (err instanceof TypeError) throw { code: 'blocked' };
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function extractReadableArticle(html, sourceUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const bodyText = normalizeWhitespace(doc.body ? doc.body.textContent : '');
  const title = normalizeWhitespace(doc.title || extractMetaContent(doc, 'property', 'og:title') || extractMetaContent(doc, 'name', 'twitter:title') || 'Imported article');

  if (!bodyText) throw { code: 'empty-extraction' };
  if (containsLoginLanguage(bodyText)) throw { code: 'login-required' };
  if (containsPaywallLanguage(bodyText)) throw { code: 'paywalled' };

  qsa('script,style,noscript,svg,canvas,form,nav,aside,footer,header', doc).forEach(function(node) {
    node.remove();
  });

  const candidateSelectors = [
    'article',
    'main',
    '[role="main"]',
    '.article-body',
    '.post-content',
    '.entry-content',
    '.story-body',
    '.article-content',
    '.post-body',
    '.blog-post',
    '.blog-content',
    '.single-post',
    '.content',
    '#content',
    '#main',
  ];

  let candidate = null;
  for (let i = 0; i < candidateSelectors.length; i += 1) {
    candidate = qs(candidateSelectors[i], doc);
    if (candidate) break;
  }

  if (!candidate) candidate = doc.body;

  /* Lower min-length to 20 to capture short sentences in small blogs */
  const paragraphs = qsa('p, h1, h2, h3, li, blockquote', candidate)
    .map(function(node) { return normalizeWhitespace(node.textContent); })
    .filter(function(text) { return text.length > 20; });

  const articleText = paragraphs.join('\n\n');
  if (articleText.length < 80 && bodyText.length < 80) throw { code: 'empty-extraction' };
  /* Lowered from 220 — small personal blogs have shorter total text */
  if (articleText.length < 100) throw { code: 'unsupported-structure' };

  return buildImportedArticle(title, sourceUrl, articleText);
}

function buildImportedArticle(title, sourceUrl, articleText) {
  const lines = [title].concat(articleText.split(/\n+/)).map(function(line) {
    return normalizeWhitespace(line);
  }).filter(Boolean);

  const words = [];
  lines.forEach(function(line) {
    line.split(/\s+/).forEach(function(word) {
      if (word) words.push(word);
    });
  });

  if (words.length < 80) throw { code: 'empty-extraction' };

  return {
    title: title,
    sourceUrl: sourceUrl,
    rawLines: lines.map(function(line, index) {
      return { page: 1, text: line, lineIndex: index };
    }),
    words: words,
    wordCount: words.length,
  };
}

function normalizeWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function extractMetaContent(doc, attribute, key) {
  const node = qs('meta[' + attribute + '="' + key + '"]', doc);
  return node ? node.getAttribute('content') : '';
}

function containsPaywallLanguage(text) {
  const value = (text || '').toLowerCase();
  return [
    'subscribe to continue',
    'subscribe now',
    'subscription required',
    'become a subscriber',
    'remaining article',
    'unlock this article',
    'purchase a subscription',
    'member-only',
  ].some(function(phrase) {
    return value.includes(phrase);
  });
}

function containsLoginLanguage(text) {
  const value = (text || '').toLowerCase();
  return [
    'sign in to continue',
    'log in to continue',
    'please sign in',
    'please log in',
    'create an account to continue',
    'members sign in',
  ].some(function(phrase) {
    return value.includes(phrase);
  });
}

function normalizeUrlImportError(err) {
  const code = err && err.code;

  if (code === 'timed-out') {
    return {
      title: 'Request timed out',
      message: 'The site took too long to respond. Try again on a stronger connection or try a different article.',
    };
  }

  if (code === 'blocked') {
    return {
      title: 'Blocked by site',
      message: 'This site denied direct fetching from the app, or the WebView could not access it. Some sites block import even when internet is available.',
    };
  }

  if (code === 'paywalled') {
    return {
      title: 'Paywalled article',
      message: 'This article appears to be behind a paywall or subscriber gate, so FlowRead cannot import the readable text.',
    };
  }

  if (code === 'login-required') {
    return {
      title: 'Login required',
      message: 'This page appears to require signing in before the article text is available.',
    };
  }

  if (code === 'unsupported-structure') {
    return {
      title: 'Unsupported page structure',
      message: 'FlowRead fetched the page but could not find a stable article body to import. Some site layouts are not supported yet.',
    };
  }

  if (code === 'empty-extraction') {
    return {
      title: 'No readable article text found',
      message: 'The page loaded, but FlowRead could not extract enough readable text to start the reader.',
    };
  }

  return {
    title: 'URL import failed',
    message: 'FlowRead could not import this URL. Try another article or a direct article page instead.',
  };
}

function readFileAsArrayBuffer(file) {
  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.onload = function(event) { resolve(event.target.result); };
    reader.onerror = function(event) { reject(new Error('FileReader error: ' + event.target.error)); };
    reader.readAsArrayBuffer(file);
  });
}

function showUploadError(title, message, options) {
  const container = qs('#upload-error');
  if (!container) return;

  const actionHtml = options && options.actionLabel
    ? `<button class="btn btn-primary" id="upload-error-action">${escapeHtml(options.actionLabel)}</button>`
    : '';

  container.innerHTML = `
    <div class="error-card">
      <p class="error-card-title">${escapeHtml(title)}</p>
      <p>${escapeHtml(message)}</p>
      <div class="error-card-actions">
        ${actionHtml}
        <button class="btn btn-ghost error-dismiss" id="btn-upload-error-dismiss">Dismiss</button>
      </div>
    </div>
  `;
  show(container);

  qs('#btn-upload-error-dismiss').addEventListener('click', clearUploadError);
  if (options && typeof options.action === 'function') {
    qs('#upload-error-action').addEventListener('click', options.action);
  }
}

function clearUploadError() {
  const container = qs('#upload-error');
  if (container) {
    container.innerHTML = '';
    hide(container);
  }
}

async function openDocxReader() {
  const pro = await hasProAccess();
  if (!pro) {
    showProPaywall('docx-import');
    return;
  }
  qs('#file-input-docx').click();
}

async function openTxtReader() {
  const pro = await hasProAccess();
  if (!pro) {
    showProPaywall('txt-import');
    return;
  }
  qs('#file-input-txt').click();
}

async function openDashboard() {
  const pro = await hasProAccess();
  if (!pro) {
    showProPaywall('dashboard');
    return;
  }
  renderDashboard();
  switchView('view-dashboard');
}

async function handleDocxSelect(file) {
  if (!file.name.toLowerCase().endsWith('.docx') && file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    showUploadError('Unsupported file', 'Please select a .docx file.');
    return;
  }

  clearUploadError();
  showLoading('Reading DOCX...');

  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const result = await parseDOCX(arrayBuffer);

    if (!result.metadata.hasTextLayer) {
      hideLoading();
      showUploadError('Empty document', 'This DOCX appears to contain no readable text.');
      return;
    }

    const fileId = generateFileId(file.name, file.size, file.lastModified || result.metadata.wordCount);
    AppState.currentFile = {
      id: fileId,
      kind: 'docx',
      name: file.name,
      words: result.words,
      pageWordIndex: result.pageWordIndex,
      rawLines: result.rawLines,
      metadata: Object.assign({}, result.metadata, { sourceType: 'docx' }),
      pdfDoc: null,
    };
    AppState.currentIndex = loadPosition(fileId);

    saveFileToLibrary({
      id: fileId,
      kind: 'docx',
      name: file.name,
      wordCount: result.metadata.wordCount,
      pageCount: result.metadata.pageCount,
      lastOpened: Date.now(),
    });

    saveFileData(fileId, AppState.currentFile);

    hideLoading();
    renderReader();
    switchView('view-reader');
  } catch (err) {
    hideLoading();
    if (err && err.type === 'empty-document') {
      showUploadError('Empty document', 'This DOCX contains no readable text.');
      return;
    }
    showUploadError('DOCX import failed', 'Could not read this file. ' + ((err && err.detail) || (err && err.message) || ''));
  }
}

async function handleTxtSelect(file) {
  if (!file.name.toLowerCase().endsWith('.txt') && file.type !== 'text/plain') {
    showUploadError('Unsupported file', 'Please select a .txt file.');
    return;
  }

  clearUploadError();
  showLoading('Reading TXT...');

  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const result = await parseTXT(arrayBuffer);

    const fileId = generateFileId(file.name, file.size, file.lastModified || result.metadata.wordCount);
    AppState.currentFile = {
      id: fileId,
      kind: 'txt',
      name: file.name,
      words: result.words,
      pageWordIndex: result.pageWordIndex,
      rawLines: result.rawLines,
      metadata: Object.assign({}, result.metadata, { sourceType: 'txt' }),
      pdfDoc: null,
    };
    AppState.currentIndex = loadPosition(fileId);

    saveFileToLibrary({
      id: fileId,
      kind: 'txt',
      name: file.name,
      wordCount: result.metadata.wordCount,
      pageCount: result.metadata.pageCount,
      lastOpened: Date.now(),
    });

    saveFileData(fileId, AppState.currentFile);

    hideLoading();
    renderReader();
    switchView('view-reader');
  } catch (err) {
    hideLoading();
    if (err && err.type === 'empty-document') {
      showUploadError('Empty file', 'This TXT file contains no readable text.');
      return;
    }
    showUploadError('TXT import failed', 'Could not read this file. ' + ((err && err.detail) || (err && err.message) || ''));
  }
}

async function openImageReader() {
  const pro = await hasProAccess();
  const ocr = await hasOcrAccess();
  if (!pro || !ocr) {
    showOcrPaywall('image-scan');
    return;
  }

  const sheetHTML = `
    <div class="action-sheet-overlay" id="action-sheet-overlay">
      <div class="action-sheet">
        <button class="action-sheet-item" id="action-take-photo" type="button">
          <span>📷 Take Photo</span>
        </button>
        <button class="action-sheet-item" id="action-choose-gallery" type="button">
          <span>🖼 Choose from Gallery</span>
        </button>
        <button class="action-sheet-cancel" id="action-cancel" type="button">Cancel</button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', sheetHTML);
  const overlay = qs('#action-sheet-overlay');

  function closeSheet() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  qs('#action-cancel').addEventListener('click', closeSheet);

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeSheet();
  });

  qs('#action-choose-gallery').addEventListener('click', function() {
    closeSheet();
    qs('#file-input-image').click();
  });

  qs('#action-take-photo').addEventListener('click', async function() {
    closeSheet();
    await capturePhotoWithCamera();
  });
}

async function capturePhotoWithCamera() {
  if (!window.Capacitor || !Capacitor.isNativePlatform()) {
    showToast('Camera is only available on native devices.');
    return;
  }

  try {
    const { Camera } = Capacitor.Plugins;
    if (!Camera || typeof Camera.getPhoto !== 'function') {
      showToast('Camera plugin not available. Choose from Gallery instead.');
      return;
    }

    const photo = await Camera.getPhoto({
      resultType: 'dataUrl',
      source: 'CAMERA',
      quality: 90,
      width: 2000,
      height: 2000,
      correctOrientation: true,
    });

    if (!photo || !photo.dataUrl) {
      showToast('Failed to capture photo.');
      return;
    }

    /* Convert dataUrl to File-like object */
    const blob = dataUrlToBlob(photo.dataUrl);
    const file = new File([blob], 'photo-' + Date.now() + '.jpg', { type: 'image/jpeg' });
    handleImageSelect([file]);
  } catch (err) {
    if (err && err.message && err.message.includes('User cancelled')) {
      /* User cancelled, no error message */
      return;
    }
    console.error('Camera error:', err);
    showToast('Could not capture photo.');
  }
}

function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)[1];
  const binary = atob(parts[1]);
  const array = [];
  for (let i = 0; i < binary.length; i++) {
    array.push(binary.charCodeAt(i));
  }
  return new Blob([new Uint8Array(array)], { type: mime });
}

async function handlePasteTextImport(title, text) {
  clearUploadError();
  showLoading('Processing text…');

  try {
    /* Normalize line endings */
    let normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    /* Split into paragraph blocks (blank-line delimited) */
    const paragraphs = normalized
      .split(/\n{2,}/)
      .flatMap(function(block) { return block.split(/\n/); })
      .map(function(line) { return line.trim(); })
      .filter(function(line) { return line.length >= 2; });

    /* Clean paragraphs */
    const cleaned = paragraphs.map(function(p) {
      p = p.replace(/[ \t]+/g, ' ').trim();
      p = p.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
      return p;
    });

    /* Filter out page numbers, bare URLs */
    const filtered = cleaned.filter(function(line) {
      if (line.length < 2) return false;
      if (/^\d+$/.test(line)) return false;
      if (/^https?:\/\//.test(line) && line.length < 50) return false;
      return true;
    });

    /* Deduplicate adjacent identical lines */
    const deduplicated = [];
    let lastLine = '';
    filtered.forEach(function(line) {
      if (line !== lastLine) {
        deduplicated.push(line);
        lastLine = line;
      }
    });

    /* Build rawLines and words */
    const rawLines = [];
    const words = [];
    const pageWordIndex = [0];
    const PAGE_SIZE = 250;
    let wordIndex = 0;
    let syntheticPage = 0;

    deduplicated.forEach(function(line) {
      rawLines.push(line);
      const lineWords = line.split(/\s+/);
      lineWords.forEach(function(word) {
        words.push(word);
        wordIndex++;

        while (Math.floor(wordIndex / PAGE_SIZE) > syntheticPage) {
          syntheticPage++;
          pageWordIndex.push(wordIndex);
        }
      });
    });

    if (words.length < 10) {
      hideLoading();
      showUploadError('Not enough text', 'Please paste at least 10 words to read.');
      return;
    }

    const fileId = generateFileId('paste', title, words.length);

    AppState.currentFile = {
      id: fileId,
      kind: 'paste',
      name: title,
      words: words,
      pageWordIndex: pageWordIndex,
      rawLines: rawLines,
      metadata: {
        sourceType: 'paste',
        title: title,
        wordCount: words.length,
        pageCount: pageWordIndex.length,
        hasTextLayer: true,
      },
      pdfDoc: null,
    };
    AppState.currentIndex = 0;

    saveFileToLibrary({
      id: fileId,
      kind: 'paste',
      name: title,
      wordCount: words.length,
      pageCount: pageWordIndex.length,
      lastOpened: Date.now(),
    });
    saveFileData(fileId, AppState.currentFile);

    hideLoading();
    renderReader();
    switchView('view-reader');
  } catch (err) {
    hideLoading();
    showUploadError('Error', 'Could not process the pasted text.');
  }
}

async function handleImageSelect(files) {
  if (!files || files.length === 0) return;
  const fileList = Array.prototype.slice.call(files);

  clearUploadError();
  showLoading('Running OCR…');

  window._pdfParseProgress = function(current, total) {
    const msg = qs('#loading-message');
    if (msg) msg.textContent = 'Processing image ' + current + ' of ' + total + '…';
  };

  try {
    // Read image files as dataURLs for later viewing
    const imageDataUrls = await Promise.all(fileList.map(f => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.readAsDataURL(f);
    })));

    const result = await parseImages(fileList, window._pdfParseProgress);
    window._pdfParseProgress = null;

    if (!result.metadata.wordCount) {
      hideLoading();
      showUploadError('No text found', 'OCR could not find readable text in the selected image(s). Try a clearer photo.');
      return;
    }

    const firstName = fileList[0].name;
    const name = fileList.length === 1 ? firstName : fileList.length + ' images';
    const fileId = generateFileId('img', firstName, fileList.length + result.metadata.wordCount);

    AppState.currentFile = {
      id: fileId,
      kind: 'image',
      name: name,
      words: result.words,
      pageWordIndex: result.pageWordIndex,
      rawLines: result.rawLines,
      imageDataUrls: imageDataUrls,
      metadata: Object.assign({}, result.metadata, { sourceType: 'image' }),
      pdfDoc: null,
      pdfRawAvailable: false,
    };
    AppState.currentIndex = 0;

    saveFileToLibrary({
      id: fileId,
      kind: 'image',
      name: name,
      wordCount: result.metadata.wordCount,
      pageCount: result.metadata.pageCount,
      lastOpened: Date.now(),
    });
    saveFileData(fileId, AppState.currentFile);

    hideLoading();
    renderReader();
    switchView('view-reader');
  } catch (err) {
    hideLoading();
    window._pdfParseProgress = null;
    if (err && err.type === 'ocr-unavailable') {
      showUploadError('OCR not available', 'On-device OCR is not available on this device.');
      return;
    }
    showUploadError('Image import failed', 'Could not process the image(s). ' + ((err && err.detail) || (err && err.message) || ''));
  }
}

async function renderLibrary() {
  const section = qs('#library-section');
  if (!section) return;

  const lib = loadLibrary();
  const deviceFiles = loadDeviceSyncedFiles();
  if (lib.length === 0 && deviceFiles.length === 0) {
    section.innerHTML = '';
    return;
  }

  const pro = await hasProAccess();
  const recentLib = lib.filter(function(item) { return !isFileFullyRead(item); });
  const readLib = lib.filter(function(item) { return isFileFullyRead(item); });
  const readCollapsed = localStorage.getItem('fr_read_section_collapsed') !== 'false';
  const deviceCollapsed = localStorage.getItem('fr_device_section_collapsed') !== 'false';
  const sections = [];

  if (pro) {
    if (recentLib.length > 0) {
      sections.push('<section class="library-subsection"><h2 class="library-heading">Recent</h2><div class="library-grid" id="recent-library-grid"></div></section>');
    }
  } else {
    if (recentLib.length > 0) {
      sections.push('<section class="library-subsection">' + [
        '<h2 class="library-heading">Recent</h2>',
        '<ul class="library-list">',
        recentLib.map(function(item) {
          const pct = getFileProgress(item);
          const kindLabel = item.kind === 'url' ? 'URL' : item.kind ? item.kind.toUpperCase() : 'PDF';
          const meta = kindLabel + ' · ' + formatDate(item.lastOpened) + (pct > 0 ? ' · ' + pct + '%' : '');
          return [
            '<li class="library-item" data-id="' + escapeHtml(item.id) + '">',
            '<div class="library-item-info">',
            '<p class="library-item-name">' + escapeHtml(item.name) + '</p>',
            '<p class="library-item-meta">' + escapeHtml(meta) + '</p>',
            '</div>',
            '<div class="library-item-progress"><div class="library-progress-bar">',
            '<div class="library-progress-fill" style="width:' + pct + '%"></div>',
            '</div></div>',
            '<div class="library-item-actions">',
            '<button class="btn btn-ghost btn-mark-read" type="button" data-mark-read-id="' + escapeHtml(item.id) + '" data-mark-read-wc="' + (item.wordCount || 0) + '">Mark read</button>',
            '<button class="btn btn-ghost btn-remove-file" type="button" data-remove-id="' + escapeHtml(item.id) + '">Remove</button>',
            '</div>',
            '</li>',
          ].join('');
        }).join(''),
        '</ul>',
      ].join('') + '</section>');
    }
  }

  if (readLib.length > 0) {
    sections.push('<section class="library-subsection library-subsection-read">' + [
      '<button class="library-collapse-toggle" id="btn-read-toggle" type="button" aria-expanded="' + (!readCollapsed) + '">',
      '<span class="library-heading">Read</span>',
      '<span class="library-collapse-count">' + formatNumber(readLib.length) + '</span>',
      '<span class="library-collapse-icon">' + (readCollapsed ? '▸' : '▾') + '</span>',
      '</button>',
      '<div id="read-content"' + (readCollapsed ? ' class="hidden"' : '') + '>',
      pro ? '<div class="library-grid" id="read-library-grid"></div>' : '',
      !pro ? [
        '<ul class="library-list">',
        readLib.map(function(item) {
          const pct = getFileProgress(item);
          const kindLabel = item.kind === 'url' ? 'URL' : item.kind ? item.kind.toUpperCase() : 'PDF';
          const meta = kindLabel + ' · ' + formatDate(item.lastOpened) + (pct > 0 ? ' · ' + pct + '%' : '');
          return [
            '<li class="library-item" data-id="' + escapeHtml(item.id) + '">',
            '<div class="library-item-info">',
            '<p class="library-item-name">' + escapeHtml(item.name) + '</p>',
            '<p class="library-item-meta">' + escapeHtml(meta) + '</p>',
            '</div>',
            '<div class="library-item-progress"><div class="library-progress-bar">',
            '<div class="library-progress-fill" style="width:' + pct + '%"></div>',
            '</div></div>',
            '<div class="library-item-actions"><button class="btn btn-ghost btn-mark-unread" type="button" data-mark-unread-id="' + escapeHtml(item.id) + '">Mark unread</button></div>',
            '</li>',
          ].join('');
        }).join(''),
        '</ul>',
      ].join('') : '',
      '</div>',
    ].join('') + '</section>');
  }

  if (deviceFiles.length > 0) {
    sections.push('<section class="library-subsection library-subsection-device">' + [
      '<button class="library-collapse-toggle" id="btn-device-toggle" type="button" aria-expanded="' + (!deviceCollapsed) + '">',
      '<span class="library-heading">Readable files on device</span>',
      '<span class="library-collapse-count">' + formatNumber(deviceFiles.length) + '</span>',
      '<span class="library-collapse-icon">' + (deviceCollapsed ? '▸' : '▾') + '</span>',
      '</button>',
      '<div id="device-content"' + (deviceCollapsed ? ' class="hidden"' : '') + '>',
      '<ul class="library-list" id="device-files-list">',
      deviceFiles.map(function(file, index) {
        const ext = file.name.split('.').pop().toUpperCase();
        const meta = (file.displayPath || file.dir || '/') + ' · ' + ext;
        return [
          '<li class="library-item" data-device-file-idx="' + index + '">',
          '<div class="library-item-info">',
          '<p class="library-item-name">' + escapeHtml(file.name) + '</p>',
          '<p class="library-item-meta">' + escapeHtml(meta) + '</p>',
          '</div>',
          '</li>',
        ].join('');
      }).join(''),
      '</ul>',
      '</div>',
    ].join('') + '</section>');
  }

  section.innerHTML = sections.join('');

  if (pro && recentLib.length > 0) {
    const grid = qs('#recent-library-grid', section);
    recentLib.forEach(function(item) {
      const pct = getFileProgress(item);
      const kindLabel = item.kind === 'url' ? 'URL' : item.kind ? item.kind.toUpperCase() : 'PDF';
      const card = document.createElement('div');
      card.className = 'library-card';
      card.dataset.id = item.id;
      card.innerHTML = [
        '<span class="library-card-kind">' + escapeHtml(kindLabel) + '</span>',
        '<p class="library-card-name">' + escapeHtml(item.name) + '</p>',
        '<p class="library-card-meta">' + escapeHtml(formatDate(item.lastOpened)) + (pct > 0 ? ' · ' + pct + '%' : '') + '</p>',
        '<div class="library-card-progress"><div class="library-card-progress-fill" style="width:' + pct + '%"></div></div>',
        '<div class="library-item-actions">',
        '<button class="btn btn-ghost btn-mark-read" type="button" data-mark-read-id="' + escapeHtml(item.id) + '" data-mark-read-wc="' + (item.wordCount || 0) + '">Mark read</button>',
        '<button class="btn btn-ghost btn-remove-file" type="button" data-remove-id="' + escapeHtml(item.id) + '">Remove</button>',
        '</div>',
      ].join('');
      card.addEventListener('click', function() { resumeFromLibrary(item); });
      const markReadBtn = qs('[data-mark-read-id]', card);
      if (markReadBtn) {
        markReadBtn.addEventListener('click', function(event) {
          event.stopPropagation();
          markFileAsRead(item.id, item.wordCount || 0);
        });
      }
      const removeBtn = qs('[data-remove-id]', card);
      if (removeBtn) {
        removeBtn.addEventListener('click', function(event) {
          event.stopPropagation();
          _confirmRemoveFile(item.id);
        });
      }
      grid.appendChild(card);
    });
  }

  if (pro && readLib.length > 0) {
    const readGrid = qs('#read-library-grid', section);
    if (readGrid) {
      readLib.forEach(function(item) {
        const pct = getFileProgress(item);
        const kindLabel = item.kind === 'url' ? 'URL' : item.kind ? item.kind.toUpperCase() : 'PDF';
        const card = document.createElement('div');
        card.className = 'library-card';
        card.dataset.id = item.id;
        card.innerHTML = [
          '<span class="library-card-kind">' + escapeHtml(kindLabel) + '</span>',
          '<p class="library-card-name">' + escapeHtml(item.name) + '</p>',
          '<p class="library-card-meta">' + escapeHtml(formatDate(item.lastOpened)) + (pct > 0 ? ' · ' + pct + '%' : '') + '</p>',
          '<div class="library-card-progress"><div class="library-card-progress-fill" style="width:' + pct + '%"></div></div>',
          '<div class="library-item-actions"><button class="btn btn-ghost btn-mark-unread" type="button" data-mark-unread-id="' + escapeHtml(item.id) + '">Mark unread</button></div>',
        ].join('');
        card.addEventListener('click', function() { resumeFromLibrary(item); });
        const unreadBtn = qs('[data-mark-unread-id]', card);
        if (unreadBtn) {
          unreadBtn.addEventListener('click', function(event) {
            event.stopPropagation();
            markLibraryItemUnread(item.id);
          });
        }
        readGrid.appendChild(card);
      });
    }
  }

  qsa('.library-item[data-id]', section).forEach(function(el) {
    el.addEventListener('click', function() {
      const id = this.dataset.id;
      const entry = lib.find(function(r) { return r.id === id; });
      if (!entry) return;
      resumeFromLibrary(entry);
    });
  });

  qsa('[data-mark-unread-id]', section).forEach(function(btn) {
    btn.addEventListener('click', function(event) {
      event.stopPropagation();
      markLibraryItemUnread(btn.dataset.markUnreadId);
    });
  });

  qsa('[data-mark-read-id]', section).forEach(function(btn) {
    btn.addEventListener('click', function(event) {
      event.stopPropagation();
      markFileAsRead(btn.dataset.markReadId, parseInt(btn.dataset.markReadWc, 10) || 0);
    });
  });

  qsa('[data-remove-id]', section).forEach(function(btn) {
    btn.addEventListener('click', function(event) {
      event.stopPropagation();
      _confirmRemoveFile(btn.dataset.removeId);
    });
  });

  qsa('.library-item[data-device-file-idx]', section).forEach(function(el) {
    el.addEventListener('click', function() {
      const idx = parseInt(this.dataset.deviceFileIdx, 10);
      if (Number.isNaN(idx) || !deviceFiles[idx]) return;
      _importSyncedFile(deviceFiles[idx]);
    });
  });

  const readToggle = qs('#btn-read-toggle', section);
  if (readToggle) {
    readToggle.addEventListener('click', function() {
      const content = qs('#read-content', section);
      if (!content) return;
      const nextCollapsed = !content.classList.contains('hidden');
      content.classList.toggle('hidden', nextCollapsed);
      localStorage.setItem('fr_read_section_collapsed', nextCollapsed ? 'true' : 'false');
      readToggle.setAttribute('aria-expanded', nextCollapsed ? 'false' : 'true');
      const icon = qs('.library-collapse-icon', readToggle);
      if (icon) icon.textContent = nextCollapsed ? '▸' : '▾';
    });
  }

  const deviceToggle = qs('#btn-device-toggle', section);
  if (deviceToggle) {
    deviceToggle.addEventListener('click', function() {
      const content = qs('#device-content', section);
      if (!content) return;
      const nextCollapsed = !content.classList.contains('hidden');
      content.classList.toggle('hidden', nextCollapsed);
      localStorage.setItem('fr_device_section_collapsed', nextCollapsed ? 'true' : 'false');
      deviceToggle.setAttribute('aria-expanded', nextCollapsed ? 'false' : 'true');
      const icon = qs('.library-collapse-icon', deviceToggle);
      if (icon) icon.textContent = nextCollapsed ? '▸' : '▾';
    });
  }
}

function markLibraryItemUnread(fileId) {
  if (!fileId) return;
  savePosition(fileId, 0);
  renderLibrary();
}

function markFileAsRead(fileId, wordCount) {
  if (!fileId || !wordCount) return;
  savePosition(fileId, wordCount);
  renderLibrary();
}

function _confirmRemoveFile(fileId) {
  if (!fileId) return;
  /* Inline confirm: replace the item with a confirmation row, avoid modal */
  const item = qs('[data-id="' + fileId + '"]') || qs('[data-remove-id="' + fileId + '"]');
  const row = item && item.closest('.library-item, .library-card');
  if (!row) {
    removeFileFromLibrary(fileId);
    renderLibrary();
    return;
  }
  row.innerHTML = '<div class="library-item-confirm"><span>Remove this file?</span>' +
    '<button class="btn btn-ghost btn-confirm-yes" type="button">Yes, remove</button>' +
    '<button class="btn btn-ghost btn-confirm-no" type="button">Cancel</button></div>';

  qs('.btn-confirm-yes', row).addEventListener('click', function(event) {
    event.stopPropagation(); /* prevent bubbling to parent library-item click handler */
    removeFileFromLibrary(fileId);
    renderLibrary();
  });
  qs('.btn-confirm-no', row).addEventListener('click', function(event) {
    event.stopPropagation();
    renderLibrary();
  });
}

async function resumeFromLibrary(entry, source) {
  AppState.readerSource = source || 'upload';
  showLoading('Loading ' + entry.name + '...');
  try {
    const data = await loadFileData(entry.id);
    if (!data || !data.words || data.words.length === 0) {
      hideLoading();
      showToast('File not cached — please re-import to read.');
      return;
    }

    /* Update lastOpened in library */
    saveFileToLibrary(Object.assign({}, entry, { lastOpened: Date.now() }));

    AppState.currentFile = {
      id: entry.id,
      kind: entry.kind,
      name: entry.name,
      words: data.words,
      pageWordIndex: data.pageWordIndex,
      rawLines: data.rawLines,
      metadata: data.metadata,
      pdfDoc: null, /* not serialisable — re-parsed lazily from raw bytes if needed */
      /* If we have the raw PDF on disk, Normal View can be opened on demand */
      pdfRawAvailable: entry.kind === 'pdf' && hasRawPdf(entry.id),
    };
    const savedPos = loadPosition(entry.id);
    /* If the file was completed, start from the beginning on re-open */
    AppState.currentIndex = savedPos >= data.words.length ? 0 : savedPos;

    hideLoading();
    renderReader();
    switchView('view-reader');
  } catch (_) {
    hideLoading();
    showToast('Could not load file — please re-import.');
  }
}

function getFileProgress(fileMeta) {
  if (!fileMeta.wordCount) return 0;
  const pos = loadPosition(fileMeta.id);
  return Math.min(100, Math.round((pos / fileMeta.wordCount) * 100));
}

function isFileFullyRead(fileMeta) {
  if (!fileMeta || !fileMeta.wordCount) return false;
  const pos = loadPosition(fileMeta.id);
  return pos >= fileMeta.wordCount;
}

/* ── Device file sync ────────────────────────────────────────── */

async function _scanDirRecursive(Filesystem, dirPath, directory, extensions, depth, maxDepth, found) {
  if (depth > maxDepth) return;

  let entries;
  try {
    const result = await Filesystem.readdir({ path: dirPath, directory: directory });
    entries = result.files || [];
  } catch (_) {
    return;
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const entryName = typeof entry === 'string' ? entry : (entry.name || '');
    if (!entryName || entryName.startsWith('.')) continue;

    const entryPath = dirPath ? (dirPath + '/' + entryName) : entryName;
    const lower = entryName.toLowerCase();
    const isDir = (typeof entry === 'object' && entry.type === 'directory') || !lower.includes('.');

    let matched = false;
    for (let e = 0; e < extensions.length; e++) {
      if (lower.endsWith(extensions[e])) {
        found.push({ name: entryName, dir: directory, path: entryPath, displayPath: entryPath });
        matched = true;
        break;
      }
    }

    if (!matched && isDir && depth < maxDepth) {
      await _scanDirRecursive(Filesystem, entryPath, directory, extensions, depth + 1, maxDepth, found);
    }
  }
}

async function syncDeviceFiles() {
  const pro = await hasProAccess();
  const Filesystem = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
  const DeviceSync = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.FlowReadDeviceSync;

  if (DeviceSync && typeof DeviceSync.scanFiles === 'function') {
    await _syncDeviceFilesNative(DeviceSync, pro);
    return;
  }

  if (!Filesystem || typeof Filesystem.readdir !== 'function') {
    showToast('File scanning is only available on device — use the file picker instead.');
    return;
  }

  // Request storage permission if available (Android ≤ 12). On Android 13+
  // READ_EXTERNAL_STORAGE no longer exists for documents — the dialog won't appear,
  // so we proceed regardless and silently skip any inaccessible directories.
  try {
    if (typeof Filesystem.requestPermissions === 'function') {
      await Filesystem.requestPermissions();
    }
  } catch (_) {}

  showLoading('Scanning device files…');

  const extensions = pro ? ['.pdf', '.docx', '.txt'] : ['.pdf'];
  const found = [];

  // Well-known user-facing directories under external storage.
  // Root scanning is restricted on Android 11+, so target specific folders.
  const knownPaths = [
    'Download', 'Downloads',
    'Documents',
    'Books', 'Ebooks', 'PDF', 'PDFs', 'Files',
    // WhatsApp document locations (old and new Android storage layout)
    'WhatsApp/Media/WhatsApp Documents',
    'Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Documents',
  ];
  for (let i = 0; i < knownPaths.length; i++) {
    await _scanDirRecursive(Filesystem, knownPaths[i], 'EXTERNAL_STORAGE', extensions, 0, 3, found);
  }
  // App-specific external dir — no permission needed on any Android version
  await _scanDirRecursive(Filesystem, '', 'EXTERNAL', extensions, 0, 3, found);
  // App's internal documents directory
  await _scanDirRecursive(Filesystem, '', 'DOCUMENTS', extensions, 0, 3, found);

  hideLoading();

  if (found.length === 0) {
    showToast('No files found. Check that PDFs are in Downloads or Documents.');
    return;
  }

  localStorage.setItem('fr_device_section_collapsed', 'true');
  saveDeviceSyncedFiles(found);
  renderLibrary();
  showToast(formatNumber(found.length) + ' readable file' + (found.length === 1 ? '' : 's') + ' added to home.');
}

async function _syncDeviceFilesNative(DeviceSync, pro) {
  const extensions = pro ? ['.pdf', '.docx', '.txt'] : ['.pdf'];

  try {
    const access = await DeviceSync.requestAccess();
    if (access && access.openedSettings && !access.granted) {
      showToast('Allow file access in Android settings, then tap Sync files again.');
      return;
    }

    if (access && access.granted === false) {
      showToast('File access is required to scan device storage.');
      return;
    }
  } catch (_) {
    showToast('Could not request file access.');
    return;
  }

  showLoading('Scanning device files…');

  try {
    const result = await DeviceSync.scanFiles({
      maxDepth: 4,
      extensions: extensions,
    });

    hideLoading();

    if (result && result.accessRequired) {
      showToast('Allow file access in Android settings, then tap Sync files again.');
      return;
    }

    const found = (result && result.files) ? result.files : [];
    if (!found.length) {
      showToast('No matching files found in accessible device storage.');
      return;
    }

    localStorage.setItem('fr_device_section_collapsed', 'true');
    saveDeviceSyncedFiles(found);
    renderLibrary();
    showToast(formatNumber(found.length) + ' readable file' + (found.length === 1 ? '' : 's') + ' added to home.');
  } catch (err) {
    hideLoading();
    console.error('Native device sync failed:', err);
    showToast('Could not scan device storage.');
  }
}

function _showSyncSheet(files, isPro) {
  const existing = qs('#sync-sheet');
  if (existing) existing.remove();

  const sheet = document.createElement('div');
  sheet.id = 'sync-sheet';
  sheet.className = 'sync-sheet';

  const itemsHtml = files.map(function(f, i) {
    return [
      '<li class="sync-sheet-item" data-idx="' + i + '">',
      '<span class="sync-sheet-name">' + escapeHtml(f.name) + '</span>',
      '<span class="sync-sheet-dir">' + escapeHtml(f.displayPath || f.dir) + '</span>',
      '</li>',
    ].join('');
  }).join('');

  const hasNonPdf = files.some(function(f) { return !f.name.toLowerCase().endsWith('.pdf'); });
  const noteHtml = (!isPro && hasNonPdf)
    ? '<p class="sync-sheet-note">DOCX and TXT files require Pro.</p>'
    : '';

  sheet.innerHTML = [
    '<div class="sync-sheet-backdrop"></div>',
    '<div class="sync-sheet-panel">',
    '<div class="sync-sheet-header">',
    '<p class="sync-sheet-title">Files found on device</p>',
    '<button class="btn btn-ghost" id="btn-sync-close">✕</button>',
    '</div>',
    '<ul class="sync-sheet-list">' + itemsHtml + '</ul>',
    noteHtml,
    '</div>',
  ].join('');

  document.body.appendChild(sheet);

  qs('#btn-sync-close', sheet).addEventListener('click', function() { sheet.remove(); });
  qs('.sync-sheet-backdrop', sheet).addEventListener('click', function() { sheet.remove(); });

  qsa('.sync-sheet-item', sheet).forEach(function(item) {
    item.addEventListener('click', function() {
      const idx = parseInt(item.dataset.idx, 10);
      sheet.remove();
      _importSyncedFile(files[idx]);
    });
  });
}

async function _importSyncedFile(fileDesc) {
  const Filesystem = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
  const DeviceSync = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.FlowReadDeviceSync;
  if (!Filesystem && !(DeviceSync && typeof DeviceSync.readFile === 'function')) {
    showToast('Filesystem not available.');
    return;
  }

  showLoading('Reading ' + fileDesc.name + '…');
  try {
    let result;
    if (fileDesc.path && !fileDesc.dir && DeviceSync && typeof DeviceSync.readFile === 'function') {
      result = await DeviceSync.readFile({ path: fileDesc.path });
    } else {
      result = await Filesystem.readFile({ path: fileDesc.path, directory: fileDesc.dir });
    }
    const binary = atob(result.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const arrayBuffer = bytes.buffer;
    const ext = fileDesc.name.split('.').pop().toLowerCase();
    const blob = new Blob([arrayBuffer]);
    const syntheticFile = new File([blob], fileDesc.name);
    hideLoading();

    if (ext === 'pdf') handleFileSelect(syntheticFile);
    else if (ext === 'docx') handleDocxSelect(syntheticFile);
    else if (ext === 'txt') handleTxtSelect(syntheticFile);
    else showToast('Unsupported file type: ' + ext);
  } catch (_) {
    hideLoading();
    showToast('Could not read file: ' + fileDesc.name);
  }
}
