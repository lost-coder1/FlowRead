/* Free Books Library — Task 15.7 */

var FreeBooksView = (function() {
  var _catalog = null;
  var _langFilter = 'all';
  var _catFilter = 'all';
  var _searchQuery = '';
  var _downloading = {};

  /* ── Catalog ─────────────────────────────────────────────────── */

  async function _loadCatalog() {
    if (_catalog) return _catalog;
    try {
      var res = await fetch('data/free-books.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      _catalog = await res.json();
    } catch (_) {
      _catalog = { books: [] };
    }
    return _catalog;
  }

  /* ── Download state ──────────────────────────────────────────── */

  function _getSavedFileId(bookId) {
    return localStorage.getItem('fr_freebook_' + bookId) || null;
  }

  function _setSavedFileId(bookId, fileId) {
    try { localStorage.setItem('fr_freebook_' + bookId, fileId); } catch (_) {}
  }

  function _getState(book) {
    if (_downloading[book.id]) return 'downloading';
    if (_getSavedFileId(book.id)) return 'downloaded';
    return 'idle';
  }

  /* ── Filtering & sorting ─────────────────────────────────────── */

  function _filtered(books) {
    return books.filter(function(book) {
      if (_langFilter !== 'all' && book.language !== _langFilter) return false;
      if (_catFilter !== 'all' && book.category !== _catFilter) return false;
      if (_searchQuery) {
        var q = _searchQuery.toLowerCase();
        if (book.title.toLowerCase().indexOf(q) === -1 &&
            book.author.toLowerCase().indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  /* India locale → sort social_justice/constitution_law + Hindi entries first */
  function _sorted(books) {
    var lang = (navigator.language || '').toLowerCase();
    var isIndia = lang.startsWith('hi') || lang.indexOf('-in') !== -1;
    if (!isIndia) return books;
    return books.slice().sort(function(a, b) {
      var aScore = (a.category === 'social_justice' || a.category === 'constitution_law' || a.language === 'hi') ? 0 : 1;
      var bScore = (b.category === 'social_justice' || b.category === 'constitution_law' || b.language === 'hi') ? 0 : 1;
      return aScore - bScore;
    });
  }

  function _uniqueCategories(books) {
    var seen = {};
    var cats = [];
    books.forEach(function(b) {
      if (!seen[b.category]) { seen[b.category] = true; cats.push(b.category); }
    });
    return cats;
  }

  function _categoryLabel(cat) {
    var map = {
      'social_justice':   t('freebooks.cat.social_justice'),
      'constitution_law': t('freebooks.cat.constitution_law'),
      'philosophy':       t('freebooks.cat.philosophy'),
      'classics':         t('freebooks.cat.classics'),
      'buddhism':         t('freebooks.cat.buddhism'),
      'biography_history':t('freebooks.cat.biography_history'),
    };
    return map[cat] || cat;
  }

  /* ── Card HTML ───────────────────────────────────────────────── */

  function _actionHtml(state, bookId) {
    if (state === 'downloading') {
      return '<span class="fb-dl-state fb-dl-loading">' + t('freebooks.state.downloading') + '</span>';
    }
    if (state === 'downloaded') {
      return [
        '<span class="fb-dl-state fb-dl-done">' + t('freebooks.state.open') + '</span>',
        '<button class="fb-redl-btn" data-redl-id="' + escapeHtml(bookId) + '" type="button" title="Re-download">↺</button>',
      ].join('');
    }
    return '<span class="fb-dl-state fb-dl-idle">' + t('freebooks.state.download') + '</span>';
  }

  /* Two initials from title for the cover placeholder */
  function _initials(title) {
    return title.split(' ').slice(0, 2).map(function(w) { return w.charAt(0); }).join('').toUpperCase();
  }

  /* Deterministic accent colour from book id */
  var _COVER_COLORS = ['#2a4a3a', '#3a2a4a', '#3a3a2a', '#2a3a4a', '#4a2a3a', '#2a4a4a'];
  function _coverColor(bookId) {
    var hash = 0;
    for (var i = 0; i < bookId.length; i++) hash = (hash * 31 + bookId.charCodeAt(i)) >>> 0;
    return _COVER_COLORS[hash % _COVER_COLORS.length];
  }

  function _cardHtml(book) {
    var state = _getState(book);
    var langLabel = book.language === 'hi' ? 'हिंदी' : 'English';
    var coverHtml;
    if (book.coverImage) {
      /* Show actual cover; on load failure fall back to the initials placeholder */
      coverHtml = [
        '<div class="fb-card-cover fb-card-cover-img" style="background:' + _coverColor(book.id) + '">',
        '<img class="fb-cover-img" src="' + escapeHtml(book.coverImage) + '" alt="" loading="lazy"',
        ' onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">',
        '<span class="fb-card-initials" style="display:none">' + escapeHtml(_initials(book.title)) + '</span>',
        '</div>',
      ].join('');
    } else {
      coverHtml = [
        '<div class="fb-card-cover" style="background:' + _coverColor(book.id) + '">',
        '<span class="fb-card-initials">' + escapeHtml(_initials(book.title)) + '</span>',
        '</div>',
      ].join('');
    }
    return [
      '<div class="fb-card" data-book-id="' + escapeHtml(book.id) + '" role="button" tabindex="0">',
      coverHtml,
      '<div class="fb-card-info">',
      '<p class="fb-card-title">' + escapeHtml(book.title) + '</p>',
      '<p class="fb-card-author">' + escapeHtml(book.author) + '</p>',
      '<div class="fb-card-meta">',
      '<span class="fb-card-lang-tag">' + langLabel + '</span>',
      book.approxLength ? '<span class="fb-card-length">' + escapeHtml(book.approxLength) + '</span>' : '',
      '</div>',
      '</div>',
      '<div class="fb-card-action" data-action-for="' + escapeHtml(book.id) + '">',
      _actionHtml(state, book.id),
      '</div>',
      '</div>',
    ].join('');
  }

  /* ── Partial re-renders ──────────────────────────────────────── */

  function _refreshAction(bookId) {
    var book = _catalog && _catalog.books.find(function(b) { return b.id === bookId; });
    if (!book) return;
    var el = document.querySelector('[data-action-for="' + bookId + '"]');
    if (el) el.innerHTML = _actionHtml(_getState(book), bookId);
  }

  function _renderGrid() {
    var grid = document.getElementById('fb-books-grid');
    if (!grid || !_catalog) return;
    var books = _sorted(_filtered(_catalog.books));
    if (books.length === 0) {
      grid.innerHTML = '<p class="fb-empty">' + t('freebooks.empty') + '</p>';
      return;
    }
    grid.innerHTML = books.map(_cardHtml).join('');
  }

  function _renderLangTabs() {
    document.querySelectorAll('.fb-lang-tab').forEach(function(tab) {
      tab.classList.toggle('fb-lang-tab-active', tab.dataset.lang === _langFilter);
    });
  }

  function _renderCatChips() {
    document.querySelectorAll('.fb-cat-chip').forEach(function(chip) {
      chip.classList.toggle('fb-cat-chip-active', chip.dataset.cat === _catFilter);
    });
  }

  /* ── Download pipeline ───────────────────────────────────────── */

  /* Clear a stale freebook entry — removes both the freebook pointer and library entry */
  function _clearStaleEntry(bookId, fileId) {
    localStorage.removeItem('fr_freebook_' + bookId);
    if (fileId) removeFileFromLibrary(fileId);
  }

  async function _handleCardTap(book) {
    var state = _getState(book);

    if (state === 'downloading') return;

    if (state === 'downloaded') {
      var fileId = _getSavedFileId(book.id);
      var lib = loadLibrary();
      var entry = lib.find(function(item) { return item.id === fileId; });

      if (entry && entry.wordCount > 0) {
        /* Book is in library with real content — open it */
        resumeFromLibrary(entry, 'free-books');
        return;
      }

      /* Entry missing or has 0 words (stale from a previously failed download) —
         clear the bad state and fall through to re-download */
      _clearStaleEntry(book.id, fileId);
    }

    /* Start download */
    _downloading[book.id] = true;
    _refreshAction(book.id);
    showLoading(t('freebooks.loading.downloading', { title: book.title }));

    try {
      var response = await fetch(book.sourceUrl);
      if (!response.ok) throw new Error('HTTP ' + response.status);

      if (book.fileType === 'txt') {
        var text = await response.text();
        await _importTxt(book, text);
      } else {
        var buffer = await response.arrayBuffer();
        await _importPdf(book, buffer);
      }
    } catch (_) {
      hideLoading();
      _downloading[book.id] = false;
      _refreshAction(book.id);
      showToast(t('freebooks.error.download_failed', { title: book.title }));
    }
  }

  async function _importPdf(book, arrayBuffer) {
    window._pdfParseProgress = function(current, total) {
      var msg = document.getElementById('loading-message');
      if (msg) msg.textContent = t('loading.processing_page', { current: current, total: total });
    };

    var storedBuffer = arrayBuffer.slice(0);
    var result = await parsePDF(arrayBuffer.slice(0));

    /* Free Books OCR path: run OCR automatically when any of:
       (a) no text layer at all (scanned PDF),
       (b) text layer exists but uses legacy Indic font encoding detected by heuristics,
       (c) catalog entry explicitly marks requiresOcr:true — for PDFs whose encoding
           evades the heuristics but are known to produce garbage text.
       No paid-access check: OCR add-on gates user-uploaded documents, not curated catalog books. */
    if (!result.metadata.hasTextLayer || result.metadata.hasLegacyEncoding || book.requiresOcr) {
      showLoading(t('loading.running_ocr'));
      showToast(t('toast.ocr_keep_open'));
      acquireWakeLock();
      window._pdfParseProgress = function(current, total) {
        var msg = document.getElementById('loading-message');
        if (msg) msg.textContent = t('loading.ocr_page', { current: current, total: total });
      };

      var ocrResult;
      try {
        ocrResult = await parseScannedPDF(result.pdfDoc, window._pdfParseProgress);
      } catch (_) {
        hideLoading();
        releaseWakeLock();
        _downloading[book.id] = false;
        _refreshAction(book.id);
        showToast(t('freebooks.error.download_failed', { title: book.title }));
        return;
      }
      releaseWakeLock();

      if (!ocrResult.metadata.wordCount) {
        hideLoading();
        _downloading[book.id] = false;
        _refreshAction(book.id);
        showToast(t('freebooks.error.download_failed', { title: book.title }));
        return;
      }

      result.words = ocrResult.words;
      result.pageWordIndex = ocrResult.pageWordIndex;
      result.rawLines = ocrResult.rawLines;
      result.metadata = Object.assign({}, result.metadata, ocrResult.metadata);
    }

    /* Guard: only persist if parsing produced real content */
    if (!result.words || result.words.length === 0) {
      hideLoading();
      _downloading[book.id] = false;
      _refreshAction(book.id);
      showToast(t('freebooks.error.download_failed', { title: book.title }));
      return;
    }

    var fileName = book.title + '.pdf';
    var fileId = generateFileId('freebook', book.id, book.sourceUrl);

    AppState.currentFile = {
      id: fileId,
      kind: 'pdf',
      name: fileName,
      words: result.words,
      pageWordIndex: result.pageWordIndex,
      rawLines: result.rawLines,
      metadata: Object.assign({}, result.metadata, { sourceType: 'pdf' }),
      pdfDoc: result.pdfDoc,
    };
    AppState.currentIndex = loadPosition(fileId);

    /* Persist only after confirming real content — prevents stuck "Open ✓" cards */
    saveFileToLibrary({
      id: fileId,
      kind: 'pdf',
      name: fileName,
      wordCount: result.metadata.wordCount,
      pageCount: result.metadata.pageCount,
      lastOpened: Date.now(),
    });

    await saveFileData(fileId, AppState.currentFile);
    saveRawPdf(fileId, storedBuffer);

    _setSavedFileId(book.id, fileId);
    _downloading[book.id] = false;

    hideLoading();
    AppState.readerSource = 'free-books';
    renderReader({ silentResume: true });
    switchView('view-reader');
  }

  /* Strip Project Gutenberg boilerplate so only the actual book text is read */
  function _stripGutenberg(text) {
    var startRe = /\*{3}\s*START OF (?:THE )?PROJECT GUTENBERG[^\n]*\*{3}/i;
    var endRe   = /\*{3}\s*END OF (?:THE )?PROJECT GUTENBERG[^\n]*/i;

    var startIdx = text.search(startRe);
    if (startIdx !== -1) {
      var lineEnd = text.indexOf('\n', startIdx);
      text = lineEnd !== -1 ? text.slice(lineEnd + 1).trimStart() : text.slice(startIdx).trimStart();
    }

    var endIdx = text.search(endRe);
    if (endIdx !== -1) {
      text = text.slice(0, endIdx).trimEnd();
    }

    return text;
  }

  async function _importTxt(book, text) {
    text = _stripGutenberg(text);
    var encoded = new TextEncoder().encode(text).buffer;
    var result = await parseTXT(encoded);

    /* Guard: only persist if parsing produced real content */
    if (!result.words || result.words.length === 0) {
      hideLoading();
      _downloading[book.id] = false;
      _refreshAction(book.id);
      showToast(t('freebooks.error.download_failed', { title: book.title }));
      return;
    }

    var fileName = book.title + '.txt';
    var fileId = generateFileId('freebook', book.id, book.sourceUrl);

    AppState.currentFile = {
      id: fileId,
      kind: 'txt',
      name: fileName,
      words: result.words,
      pageWordIndex: result.pageWordIndex,
      rawLines: result.rawLines,
      metadata: Object.assign({}, result.metadata, { sourceType: 'txt' }),
      pdfDoc: null,
    };
    AppState.currentIndex = loadPosition(fileId);

    /* Persist only after confirming real content — prevents stuck "Open ✓" cards */
    saveFileToLibrary({
      id: fileId,
      kind: 'txt',
      name: fileName,
      wordCount: result.metadata.wordCount,
      pageCount: result.metadata.pageCount,
      lastOpened: Date.now(),
    });

    await saveFileData(fileId, AppState.currentFile);

    _setSavedFileId(book.id, fileId);
    _downloading[book.id] = false;

    hideLoading();
    AppState.readerSource = 'free-books';
    renderReader({ silentResume: true });
    switchView('view-reader');
  }

  /* ── Event wiring ─────────────────────────────────────────────── */

  function _bindEvents(view) {
    document.getElementById('fb-btn-back').addEventListener('click', function() {
      renderUpload();
      switchView('view-upload');
    });

    view.querySelectorAll('.fb-lang-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        _langFilter = this.dataset.lang;
        _renderLangTabs();
        _renderGrid();
      });
    });

    document.getElementById('fb-cat-chips').addEventListener('click', function(e) {
      var chip = e.target.closest('.fb-cat-chip');
      if (!chip) return;
      _catFilter = chip.dataset.cat;
      _renderCatChips();
      _renderGrid();
    });

    document.getElementById('fb-search').addEventListener('input', function() {
      _searchQuery = this.value.trim();
      _renderGrid();
    });

    /* Event delegation — distinguish ↺ re-download from main card tap */
    document.getElementById('fb-books-grid').addEventListener('click', function(e) {
      /* ↺ re-download button — clear stale entry and re-download fresh */
      var redlBtn = e.target.closest('.fb-redl-btn');
      if (redlBtn) {
        e.stopPropagation();
        var bookId = redlBtn.dataset.redlId;
        var book = _catalog && _catalog.books.find(function(b) { return b.id === bookId; });
        if (!book) return;
        var fileId = _getSavedFileId(bookId);
        _clearStaleEntry(bookId, fileId);
        _refreshAction(bookId);
        _handleCardTap(book);
        return;
      }

      /* Main card tap — open or download */
      var card = e.target.closest('.fb-card');
      if (!card) return;
      var bookId = card.dataset.bookId;
      var book = _catalog && _catalog.books.find(function(b) { return b.id === bookId; });
      if (book) _handleCardTap(book);
    });
  }

  /* ── Public: render ──────────────────────────────────────────── */

  async function render() {
    var view = document.getElementById('view-free-books');
    if (!view) return;

    var catalog = await _loadCatalog();
    var cats = _uniqueCategories(catalog.books);

    view.innerHTML = [
      '<div class="fb-screen">',

      '<header class="fb-header">',
      '<button class="btn btn-ghost fb-back-btn" id="fb-btn-back" type="button">←</button>',
      '<h1 class="fb-heading">' + t('freebooks.title') + '</h1>',
      '</header>',

      '<div class="fb-controls">',

      '<div class="fb-lang-tabs" role="tablist">',
      '<button class="fb-lang-tab' + (_langFilter === 'all' ? ' fb-lang-tab-active' : '') + '" data-lang="all" type="button" role="tab">' + t('freebooks.lang.all') + '</button>',
      '<button class="fb-lang-tab' + (_langFilter === 'en' ? ' fb-lang-tab-active' : '') + '" data-lang="en" type="button" role="tab">English</button>',
      '<button class="fb-lang-tab' + (_langFilter === 'hi' ? ' fb-lang-tab-active' : '') + '" data-lang="hi" type="button" role="tab">हिंदी</button>',
      '</div>',

      '<div class="fb-search-wrap">',
      '<input class="fb-search" id="fb-search" type="search" placeholder="' + t('freebooks.search.placeholder') + '" value="' + escapeHtml(_searchQuery) + '" autocomplete="off" />',
      '</div>',

      '<div class="fb-cat-chips" id="fb-cat-chips">',
      '<button class="fb-cat-chip' + (_catFilter === 'all' ? ' fb-cat-chip-active' : '') + '" data-cat="all" type="button">' + t('freebooks.cat.all') + '</button>',
      cats.map(function(cat) {
        return '<button class="fb-cat-chip' + (_catFilter === cat ? ' fb-cat-chip-active' : '') + '" data-cat="' + escapeHtml(cat) + '" type="button">' + _categoryLabel(cat) + '</button>';
      }).join(''),
      '</div>',

      '</div>',

      '<div class="fb-books-grid" id="fb-books-grid"></div>',

      '<p class="fb-legal">' + t('freebooks.legal') + '</p>',

      '</div>',
    ].join('');

    _renderGrid();
    _bindEvents(view);
  }

  return { render: render };
})();

function renderFreeBooks() {
  FreeBooksView.render();
}
