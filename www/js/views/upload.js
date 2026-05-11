/* Upload / Home screen */

function renderUpload() {
  const view = qs('#view-upload');
  view.innerHTML = `
    <div class="upload-screen">
      <header class="upload-header">
        <h1 class="app-name">FlowRead</h1>
        <p class="app-tagline">Read everything faster</p>
      </header>

      <div class="upload-zone" id="upload-zone" role="button" tabindex="0" aria-label="Open PDF">
        <div class="upload-zone-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <polyline points="9,15 12,12 15,15"/>
          </svg>
        </div>
        <p class="upload-zone-label">Tap to open a PDF</p>
        <p class="upload-zone-hint">Your files never leave this device</p>
      </div>

      <input type="file" id="file-input" accept=".pdf" style="display:none" />

      <div id="upload-error" class="hidden" style="margin: 0 24px; width: 100%; max-width: 340px;"></div>

      <div id="library-section" class="library-section">
        <!-- Populated by renderLibrary() -->
      </div>
    </div>
  `;

  qs('#upload-zone').addEventListener('click', () => qs('#file-input').click());
  qs('#upload-zone').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') qs('#file-input').click();
  });
  qs('#file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handleFileSelect(file);
    e.target.value = '';
  });

  renderLibrary();
}

async function handleFileSelect(file) {
  /* Validate file type */
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    showUploadError('Please select a PDF file (.pdf).');
    return;
  }

  clearUploadError();
  showLoading('Reading PDF...');

  /* Track parse progress */
  window._pdfParseProgress = function(current, total) {
    const msg = qs('#loading-message');
    if (msg) msg.textContent = 'Processing page ' + current + ' of ' + total + '...';
  };

  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const result = await parsePDF(arrayBuffer);

    /* Check for scanned / no text layer */
    if (!result.metadata.hasTextLayer) {
      hideLoading();
      showUploadError(
        'This appears to be a scanned PDF. The free version reads only digital PDFs ' +
        '(ones where you can highlight text). Scanned pages require the OCR Vision upgrade.',
        true /* showOcrButton */
      );
      return;
    }

    /* Store in app state */
    const fileId = generateFileId(file.name, file.size);
    AppState.currentFile = {
      id: fileId,
      name: file.name,
      words: result.words,
      pageWordIndex: result.pageWordIndex,
      rawLines: result.rawLines,
      metadata: result.metadata,
      pdfDoc: result.pdfDoc,
    };
    AppState.currentIndex = loadPosition(fileId);

    /* Persist metadata to library */
    saveFileToLibrary({
      id: fileId,
      name: file.name,
      wordCount: result.metadata.wordCount,
      pageCount: result.metadata.pageCount,
      lastOpened: Date.now(),
    });

    hideLoading();

    /* Go to reader */
    renderReader();
    switchView('view-reader');

  } catch (err) {
    hideLoading();
    window._pdfParseProgress = null;
    console.error('PDF parse error — type:', err && err.type, '| detail:', err && err.detail, '| raw:', err);

    if (err && err.type === 'password') {
      showUploadError(
        'This PDF is password-protected. Please remove the password in a PDF editor and try again.'
      );
    } else if (err && err.type === 'corrupted') {
      showUploadError(
        'This file appears to be damaged. Try opening it in another PDF viewer to confirm it\'s readable. (Detail: ' + (err.detail || 'unknown') + ')'
      );
    } else {
      showUploadError('Could not read this PDF. Error: ' + (err && (err.message || err.detail || JSON.stringify(err))));
    }
  }
}

/* FileReader-based fallback — more reliable than file.arrayBuffer() in Android WebView */
function readFileAsArrayBuffer(file) {
  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.onload = function(e) { resolve(e.target.result); };
    reader.onerror = function(e) { reject(new Error('FileReader error: ' + e.target.error)); };
    reader.readAsArrayBuffer(file);
  });
}

function showUploadError(message, showOcrButton) {
  const container = qs('#upload-error');
  if (!container) return;

  const ocrHtml = showOcrButton
    ? `<button class="btn btn-primary" style="margin-top:8px" onclick="showOcrUpsell()">
         Learn about OCR Vision
       </button>`
    : '';

  container.innerHTML = `
    <div class="error-card">
      <p>${message}</p>
      ${ocrHtml}
      <button class="btn btn-ghost error-dismiss" onclick="clearUploadError()">Dismiss</button>
    </div>
  `;
  show(container);
}

function clearUploadError() {
  const container = qs('#upload-error');
  if (container) {
    container.innerHTML = '';
    hide(container);
  }
}

function showOcrUpsell() {
  /* Phase 9 stub */
  showToast('OCR Vision add-on coming soon.');
}

/* ── File library ────────────────────────────────────────────── */
function renderLibrary() {
  const section = qs('#library-section');
  if (!section) return;
  const lib = loadLibrary();
  if (lib.length === 0) {
    section.innerHTML = '';
    return;
  }
  section.innerHTML = `
    <h2 class="library-heading">Recent</h2>
    <ul class="library-list">
      ${lib.map(f => `
        <li class="library-item" data-id="${f.id}">
          <div class="library-item-info">
            <p class="library-item-name">${escapeHtml(f.name)}</p>
            <p class="library-item-meta">${f.pageCount || '?'} pages &middot; ${formatDate(f.lastOpened)}</p>
          </div>
          <div class="library-item-progress">
            <div class="library-progress-bar">
              <div class="library-progress-fill" style="width:${getFileProgress(f)}%"></div>
            </div>
          </div>
        </li>
      `).join('')}
    </ul>
  `;
}

function getFileProgress(f) {
  if (!f.wordCount) return 0;
  const pos = loadPosition(f.id);
  return Math.min(100, Math.round((pos / f.wordCount) * 100));
}

/* escapeHtml lives in utils/dom.js */
