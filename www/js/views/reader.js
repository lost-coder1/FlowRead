/* Speed reading container view — hosts all reading engines */

let _activeEngine = null;
let _sessionState = null; /* { startIndex, maxIndex, lastMoveMs, activeMs } */
let _readerLifecycleBound = false;
let _swipeState = null;
let _swipeBackHandler = null;
let _swipeBackBound = false;
let _engineTransitionToken = 0;
let _engineTransitionInFlight = false;

const _engineMap = {
  rsvp: RSVPEngine,
  chunk: ChunkEngine,
  focus: FocusBoldEngine,
  scroll: ScrollEngine,
  page: PageEngine,
};

function renderReader(options) {
  const view = qs('#view-reader');
  const file = AppState.currentFile;
  if (!file) return;

  const opts = options || {};
  const startIndex = typeof opts.startIndex === 'number' ? opts.startIndex : loadPosition(file.id);
  /* forceEngine opens in a specific engine for this read only. The nudge flow
     (Claude.md §9.5) always lands in Page mode, but must not overwrite the
     user's own default the way share-handler.js does by writing fr_last_engine. */
  const savedEngine = opts.forceEngine
    || localStorage.getItem('fr_last_engine')
    || AppState.currentEngine || AppState.settings.defaultMode || 'page';
  const hasPdfBridge = file.kind === 'pdf' && !!(file.pdfDoc && file.pageWordIndex && file.pageWordIndex.length);
  /* Raw PDF on disk but not yet re-parsed — show active button, lazy-load on tap */
  const hasPdfLazy = file.kind === 'pdf' && !file.pdfDoc && !!(file.pdfRawAvailable && file.pageWordIndex && file.pageWordIndex.length);
  /* Parsed data only (e.g. browser fallback, raw bytes missing) — disabled button hints to re-import */
  const hasPdfDataOnly = file.kind === 'pdf' && !file.pdfDoc && !file.pdfRawAvailable && !!(file.pageWordIndex && file.pageWordIndex.length);
  const hasUrlSource = file.kind === 'url' && !!file.sourceUrl;
  const hasImgSource = file.kind === 'image' && file.imageDataUrls && file.imageDataUrls.length;

  AppState.currentIndex = startIndex;
  AppState.currentEngine = savedEngine;
  AppState.lastReaderEngine = savedEngine;
  AppState.chapters = detectChapters(file);
  AppState.isIndexOpen = false;

  /* §9.6. The denominator free_book_downloaded lacks — a catalogue book that
     is downloaded and never opened argues against paying to curate drops
     (§4). `bridgeReturn` excludes the §7 round-trip from Normal view: that is
     the same book in the same sitting, and counting it would inflate opens by
     however often someone used the bridge. */
  if (!opts.bridgeReturn && typeof logEvent === 'function') {
    logEvent('book_opened', {
      source: AppState.readerSource || 'upload',
      engine: savedEngine,
    });
  }

  view.innerHTML = `
    <div class="progress-bar-track">
      <div class="progress-bar-fill" id="progress-bar-fill"></div>
    </div>

    <div class="reader-header" id="reader-header">
      <button class="btn btn-ghost reader-back" id="btn-reader-back">←</button>
      <p class="reader-filename">${escapeHtml(displayTitle(file.name))}</p>
      <button class="btn btn-ghost reader-calm-toggle" id="btn-reader-calm">${t('reader.btn.calm')}</button>
      <!-- Highlighting (§26.3). Glyph rather than a word, because this row does
           not wrap: back + Calm + Index + a label would squeeze the filename to
           nothing, and unlike the home header it truncates instead of breaking,
           so the cost of one compact button is a shorter filename. -->
      <!-- Drawn, not a font glyph. Unicode has no highlighter: U+25AE was a
           vertical bar that read as a cursor or a stop button, a pencil would
           promise the notes §26.3 deliberately left out, and a marker emoji
           breaks §15's monochrome palette and cannot be trusted to exist on a
           minSdk 24 WebView. Inline SVG is the same answer dictionary.js's
           _searchGlyph() reached for the same reasons, and currentColor means
           the .active accent state costs no extra CSS. The band beneath the
           nib is what separates "highlighter" from "pen" at this size. -->
      <button class="btn btn-ghost reader-hl-toggle" id="btn-reader-highlight" title="${t('reader.hl.title')}" aria-label="${t('reader.hl.title')}"><svg class="reader-hl-glyph" viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" focusable="false"><line x1="3.2" y1="16" x2="14.8" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.55"/><polygon points="6.06,9.26 8.74,11.94 6.72,13.32 4.68,11.28" fill="currentColor"/><polygon points="13.66,1.66 16.34,4.34 8.74,11.94 6.06,9.26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></button>
      <!-- The cross is drawn, not a font glyph, for §26.3's reasons, and the
           label stays in the DOM beneath it rather than being swapped out: it
           is what gives this button its width, and the reader header does not
           wrap, so a button that changes size on a tap shifts the filename and
           the highlighter beside it. The cross overlays the label instead, so
           the box is identical in both states. -->
      <button class="btn btn-ghost reader-index-toggle" id="btn-reader-index" aria-expanded="false" aria-label="${t('reader.btn.index')}" title="${t('reader.btn.index')}"><span class="reader-index-label">${t('reader.btn.index')}</span><span class="reader-index-x"><svg viewBox="0 0 18 18" width="14" height="14" aria-hidden="true" focusable="false"><line x1="4" y1="4" x2="14" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="14" y1="4" x2="4" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span></button>
    </div>

    <div class="engine-tabs" id="engine-tabs">
      <button class="engine-tab" data-engine="page">${t('reader.engine.page')}</button>
      <button class="engine-tab" data-engine="rsvp">${t('reader.engine.rsvp')}</button>
      <button class="engine-tab" data-engine="chunk">${t('reader.engine.chunk')}</button>
      <button class="engine-tab" data-engine="focus">${t('reader.engine.focus')}</button>
      <button class="engine-tab" data-engine="scroll">${t('reader.engine.scroll')}</button>
    </div>

    <!-- A scan still being OCR'd (§16.32). Between the tabs and the stage, so
         it reads as a statement about the book rather than a control of the
         engine. A bar and not a modal: §20 allows one modal at a time and this
         arrives while the reader is doing something else entirely. Empty and
         hidden for every ordinary book, so it costs no vertical space -- which
         matters, because anything that does changes what fits on a page. -->
    <div id="reader-partial" class="reader-partial hidden"></div>

    <div id="rsvp-container" class="engine-container"></div>
    ${hasPdfBridge ? '<button class="reader-normal-toggle" id="btn-open-normal" title="' + t('reader.btn.pdf.title') + '">PDF</button>' : ''}
    ${hasPdfLazy ? '<button class="reader-normal-toggle" id="btn-open-normal-lazy" title="' + t('reader.btn.pdf.title') + '">PDF</button>' : ''}
    ${hasPdfDataOnly ? '<button class="reader-normal-toggle reader-normal-toggle-disabled" id="btn-open-normal-hint" title="' + t('reader.btn.pdf_hint.title') + '">PDF</button>' : ''}
    ${hasUrlSource ? '<button class="reader-normal-toggle" id="btn-open-source-url" title="' + t('reader.btn.url.title') + '">URL</button>' : ''}
    ${hasImgSource ? '<button class="reader-normal-toggle" id="btn-open-img-viewer" title="' + t('reader.btn.img.title') + '">IMG</button>' : ''}

    <!-- Shown only while a highlight is being made. Carries the instruction and
         the way out; the two taps happen on the text itself (§26.3). -->
    <div class="reader-hl-bar hidden" id="reader-hl-bar">
      <span class="reader-hl-bar-text" id="reader-hl-bar-text"></span>
      <button class="btn btn-ghost reader-hl-bar-cancel" id="btn-reader-hl-cancel">${t('btn.cancel')}</button>
    </div>

    <aside class="reader-index-panel hidden" id="reader-index-panel">
      <div class="reader-index-head">
        <p class="reader-index-title">${t('reader.index.title')}</p>
        <button class="btn btn-ghost" id="btn-close-index">×</button>
      </div>

      <div class="reader-index-seek">
        <label for="reader-seek-slider">${t('reader.index.position_label')}</label>
        <input type="range" id="reader-seek-slider" min="0" max="${Math.max(0, file.words.length - 1)}" value="${startIndex}" />
        <div class="reader-index-seek-row">
          <span class="reader-index-seek-text" id="reader-seek-text"></span>
          <button class="btn btn-primary" id="btn-reader-seek-go">${t('reader.index.btn.go')}</button>
        </div>
      </div>

      <!-- Highlights share this panel rather than earning a sixth chrome button:
           it is the same kind of thing, a list you jump from, and the panel
           already exists for exactly that (§26.3). Above the chapter search,
           because a book with 65 chapters would bury it below. Rendered only
           when the book has any. -->
      <div class="reader-hl-section hidden" id="reader-hl-section"></div>

      <div class="reader-index-search">
        <input type="search" id="reader-index-search" class="reader-index-search-input" placeholder="${t('reader.index.search.placeholder')}" />
      </div>

      <div class="reader-index-list" id="reader-index-list"></div>
    </aside>

    <div class="wpm-bar" id="wpm-bar">
      <button class="btn btn-ghost wpm-btn" id="btn-wpm-dec">−</button>
      <input type="range" id="wpm-slider" min="60" max="800" step="10" value="${AppState.wpm}" />
      <button class="btn btn-ghost wpm-btn" id="btn-wpm-inc">+</button>
      <span class="wpm-display" id="wpm-display">${formatWPM(AppState.wpm)}</span>
    </div>

    <div class="playback-bar" id="playback-bar">
      <button class="btn btn-ghost control-btn" id="btn-skip-back50" title="−50">«</button>
      <button class="btn btn-ghost control-btn" id="btn-skip-back10" title="−10">‹</button>
      <button class="btn btn-ghost control-btn control-play" id="btn-play-pause">▶</button>
      <button class="btn btn-ghost control-btn" id="btn-skip-fwd10" title="+10">›</button>
      <button class="btn btn-ghost control-btn" id="btn-skip-fwd50" title="+50">»</button>
      <span class="position-display" id="position-display"></span>
    </div>
  `;

  qsa('.engine-tab').forEach(function(tab) {
    tab.classList.toggle('active', tab.dataset.engine === AppState.currentEngine);
  });

  _applyCalmMode();

  _activeEngine = _engineMap[AppState.currentEngine] || PageEngine;

  /* Decide whether to show the loading card. Heavy engines (Focus/Scroll) without
     a cache hit need the card; instant engines and cache hits skip it. */
  const isHeavyEngine = typeof _activeEngine.hasCache === 'function';
  const hasCacheHit = isHeavyEngine && _activeEngine.hasCache(file.id);
  const skipLoadingCard = !isHeavyEngine || hasCacheHit;

  const initEngineAndAutoPlay = function() {
    try {
      _activeEngine.init(file.words, startIndex);
    } catch (err) {
      console.error('Engine init failed:', err);
      if (typeof showErrorCard === 'function') showErrorCard(t('reader.error.engine_failed'));
      return;
    }
    if (opts.autoPlay) {
      _activeEngine.play();
    }
  };

  if (skipLoadingCard) {
    initEngineAndAutoPlay();
  } else {
    const loadingContainer = qs('#rsvp-container');
    if (loadingContainer) {
      /* prevKey null → no cancel button (there's no "previous" to fall back to on direct entry) */
      loadingContainer.innerHTML = _renderEngineLoadingCard(AppState.currentEngine, null);
    }
    setTimeout(initEngineAndAutoPlay, 0);
  }

  if (startIndex > 0 && !opts.silentResume) {
    showToast(t('toast.resume', {n: formatNumber(startIndex)}), 5000);
  }

  _bindReaderControls();
  _bindReaderLifecycleHooks();
  _renderIndexList('');
  _syncReaderPosition(startIndex, file.words.length);
  _applyEngineChrome(AppState.currentEngine);
  /* Drawn on every render so it survives an engine switch and a swipe back
     into the book, not only the open that created it (§16.32). */
  if (typeof OcrProgressive !== 'undefined') OcrProgressive.syncReaderChrome();
  acquireWakeLock();
  /* Preload dictionary in background so first tap has no delay */
  if (AppState.isPro && typeof DictionaryFeature !== 'undefined') {
    DictionaryFeature.loadDictionary();
  }
}

function _bindReaderLifecycleHooks() {
  if (_readerLifecycleBound) return;
  _readerLifecycleBound = true;

  /* Pause active engine when dictionary requests it */
  document.addEventListener('fr-reading-pause', function() {
    if (_activeEngine && AppState.isPlaying) _activeEngine.pause();
  });

  /* Capture reading sessions when app is backgrounded or page is hidden. */
  document.addEventListener('visibilitychange', function() {
    if (document.hidden && AppState.currentView === 'view-reader') {
      _flushSessionIfActive();
    }
  });

  window.addEventListener('pagehide', function() {
    if (AppState.currentView === 'view-reader') {
      _flushSessionIfActive();
    }
  });
}

/* A book opened from the Free Books library or the dashboard returns *there*,
   not to home — and `checkMilestones()` is called from `renderUpload()` alone.
   So finishing a catalogue book queued its celebration until the user next
   happened to land on home, which in practice was their next app launch. That
   is precisely the "I get the share prompt the next time I open it" report, and
   it reproduced on catalogue books while working correctly on imported ones.

   The engines now ask at the moment they finish (§15), so this is the backstop
   for everything they cannot catch — a streak that crossed during the read, or
   a book whose session ended without the engine reaching the end. */
function _checkMilestonesOffHome() {
  if (typeof ShareStats !== 'undefined') ShareStats.checkMilestones();
}

function _bindReaderControls() {
  const backHandler = function() {
    if (_activeEngine) {
      _activeEngine.pause();
      /* Call destroy() so heavy engines (Focus/Scroll) populate their DOM cache.
         When the user re-opens the same file, init() will hit that cache instead
         of rebuilding from scratch. */
      _activeEngine.destroy();
    }
    _flushSessionIfActive();
    releaseWakeLock();
    const src = AppState.readerSource || 'upload';
    AppState.readerSource = 'upload';
    if (src === 'nudge') {
      /* Backing out of a nudged read is not a failure and must not trap the
         user (§9.1). Send them where they were going in the first place. */
      AppState.readerSource = 'upload';
      if (AppState.nudgeContext && typeof NudgeFeature !== 'undefined') {
        NudgeFeature.leaveNudgedRead();
        return;
      }
      renderUpload();
      switchView('view-upload');
    } else if (src === 'dashboard') {
      /* Reachable by a lapsed subscriber who opened a book from the dashboard
         while it was still unlocked, so the gate is re-read rather than
         assumed. */
      renderDashboard({ locked: !AppState.isPro });
      switchView('view-dashboard');
      _checkMilestonesOffHome();
    } else if (src === 'free-books') {
      renderFreeBooks();
      switchView('view-free-books');
      _checkMilestonesOffHome();
    } else {
      renderUpload();
      switchView('view-upload');
    }
  };

  qs('#btn-reader-back').addEventListener('click', backHandler);
  _bindSwipeBackGesture(backHandler);

  const normalButton = qs('#btn-open-normal');
  if (normalButton) {
    normalButton.addEventListener('click', function() {
      if (_activeEngine) {
        AppState.currentIndex = _activeEngine.getIndex();
        _activeEngine.pause();
      }
      openNormalAtCurrentWord();
    });
  }

  const normalHintButton = qs('#btn-open-normal-hint');
  if (normalHintButton) {
    normalHintButton.addEventListener('click', function() {
      showToast(t('toast.reimport_normal_view'));
    });
  }

  const normalLazyButton = qs('#btn-open-normal-lazy');
  if (normalLazyButton) {
    normalLazyButton.addEventListener('click', async function() {
      if (_activeEngine) {
        AppState.currentIndex = _activeEngine.getIndex();
        _activeEngine.pause();
      }
      showLoading(t('loading.loading_pdf'));
      try {
        const buf = await loadRawPdf(AppState.currentFile.id);
        if (!buf) {
          hideLoading();
          showToast(t('toast.pdf_missing'));
          return;
        }
        const result = await parsePDF(buf);
        AppState.currentFile.pdfDoc = result.pdfDoc;
        /* Swap the lazy button for the active one so subsequent taps skip re-parsing */
        normalLazyButton.id = 'btn-open-normal';
        hideLoading();
        openNormalAtCurrentWord();
      } catch (err) {
        console.error('Lazy PDF load failed:', err);
        hideLoading();
        showToast(t('toast.pdf_open_failed'));
      }
    });
  }

  const urlButton = qs('#btn-open-source-url');
  if (urlButton) {
    urlButton.addEventListener('click', function(e) {
      e.stopPropagation();
      if (_activeEngine && AppState.isPlaying) {
        AppState.currentIndex = _activeEngine.getIndex();
        _activeEngine.pause();
      }
      /* AppState.currentFile is used here — file is not in scope (_bindReaderControls is separate from renderReader) */
      const url = AppState.currentFile && AppState.currentFile.sourceUrl;
      if (!url) { showToast(t('toast.source_url_unavailable')); return; }
      window.open(url, '_blank');
    });
  }

  const imgButton = qs('#btn-open-img-viewer');
  if (imgButton) {
    imgButton.addEventListener('click', function(e) {
      e.stopPropagation();
      if (_activeEngine && AppState.isPlaying) {
        AppState.currentIndex = _activeEngine.getIndex();
        _activeEngine.pause();
      }
      const urls = AppState.currentFile && AppState.currentFile.imageDataUrls;
      if (!urls || !urls.length) { showToast(t('toast.images_unavailable')); return; }
      showImageViewer(urls);
    });
  }

  qs('#btn-reader-calm').addEventListener('click', function() {
    const next = localStorage.getItem('fr_calm_mode') !== 'true';
    localStorage.setItem('fr_calm_mode', next);
    _applyCalmMode();
  });

  qs('#btn-reader-index').addEventListener('click', _toggleIndexPanel);

  qs('#btn-reader-highlight').addEventListener('click', _onHighlightButton);
  qs('#btn-reader-hl-cancel').addEventListener('click', function() {
    if (typeof HighlightsFeature === 'undefined') return;
    /* Two states, one button: it cancels a highlight being made, and undoes one
       just made. Never both at once — the mode is over before the Undo appears. */
    if (this.dataset.mode === 'undo') {
      if (AppState.currentFile) HighlightsFeature.undoLast(AppState.currentFile.id);
      _hideHighlightUndo();
      _refreshHighlightSurfaces();
      return;
    }
    HighlightsFeature.cancel();
  });

  /* One delegated listener for the engines whose spans carry a word index
     (Focus Bold, Simple Scroll). Page mode has its own, because its spans are
     matched by position rather than an attribute, and RSVP and Chunk never need
     one — they mark a sentence instead (§26.3). Capture phase, so it beats both
     the word-tap dictionary binding and anything underneath. */
  qs('#view-reader').addEventListener('click', function(e) {
    if (typeof HighlightsFeature === 'undefined' || !HighlightsFeature.active()) return;
    const span = e.target && e.target.closest
      ? e.target.closest('.fb-word[data-index], .scroll-word[data-index]')
      : null;
    if (!span) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    const index = parseInt(span.dataset.index, 10);
    if (!isNaN(index)) HighlightsFeature.tapWord(index);
  }, true);
  qs('#btn-close-index').addEventListener('click', _toggleIndexPanel);

  qs('#btn-play-pause').addEventListener('click', function() {
    if (AppState.isPlaying) {
      _activeEngine.pause();
      _onEnginePause();
    } else {
      _onEnginePlay();
      _activeEngine.play();
    }
  });

  qs('#btn-skip-back50').addEventListener('click', function() { _skip(-50); });
  qs('#btn-skip-back10').addEventListener('click', function() { _skip(-10); });
  qs('#btn-skip-fwd10').addEventListener('click', function() { _skip(10); });
  qs('#btn-skip-fwd50').addEventListener('click', function() { _skip(50); });

  qs('#btn-reader-seek-go').addEventListener('click', function() {
    _seekReaderTo(parseInt(qs('#reader-seek-slider').value, 10));
  });

  qs('#reader-seek-slider').addEventListener('input', function() {
    _updateSeekText(parseInt(this.value, 10));
  });

  qs('#reader-index-search').addEventListener('input', function() {
    _renderIndexList(this.value);
  });

  const slider = qs('#wpm-slider');
  slider.addEventListener('input', function() { _setWPM(parseInt(this.value, 10)); });
  qs('#btn-wpm-dec').addEventListener('click', function() {
    _setWPM(Math.max(60, AppState.wpm - 10));
  });
  qs('#btn-wpm-inc').addEventListener('click', function() {
    _setWPM(Math.min(800, AppState.wpm + 10));
  });

  qsa('.engine-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      const engineKey = this.dataset.engine;
      if (engineKey === AppState.currentEngine) return;
      _switchEngine(engineKey);
    });
  });

  const engineContainer = qs('#rsvp-container');
  if (engineContainer) engineContainer.addEventListener('click', function() {
    if (localStorage.getItem('fr_calm_mode') !== 'true') return;
    const readerView = qs('#view-reader');
    if (!readerView) return;
    readerView.classList.add('calm-peek');
    clearTimeout(readerView._calmPeekTimer);
    readerView._calmPeekTimer = setTimeout(function() {
      readerView.classList.remove('calm-peek');
    }, 1800);
  });
}

function _bindSwipeBackGesture(backHandler) {
  _swipeBackHandler = backHandler;
  if (_swipeBackBound) return;
  _swipeBackBound = true;

  const edgeStartPx = 28;
  const armDx = 14;
  const minDx = 72;
  const maxDy = 42;
  const maxGestureMs = 700;

  function clearSwipeState() {
    _swipeState = null;
  }

  function isInteractiveTarget(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return !!target.closest('button, input, select, textarea, a, label, [role="button"]');
  }

  function shouldTrackSwipe(event) {
    return AppState.currentView === 'view-reader' && event && event.touches && event.touches.length === 1;
  }

  document.addEventListener('touchstart', function(event) {
    if (!shouldTrackSwipe(event)) {
      clearSwipeState();
      return;
    }

    const t = event.touches[0];
    if (!t || isInteractiveTarget(event.target)) {
      clearSwipeState();
      return;
    }

    if (t.clientX > edgeStartPx) {
      clearSwipeState();
      return;
    }

    _swipeState = {
      id: t.identifier,
      startX: t.clientX,
      startY: t.clientY,
      startTime: Date.now(),
      armed: false,
      consumed: false,
    };
  }, { passive: true, capture: true });

  document.addEventListener('touchmove', function(event) {
    if (!_swipeState || !event.changedTouches) return;

    for (let i = 0; i < event.changedTouches.length; i++) {
      const t = event.changedTouches[i];
      if (t.identifier !== _swipeState.id) continue;

      const dx = t.clientX - _swipeState.startX;
      const dy = t.clientY - _swipeState.startY;
      const elapsed = Date.now() - _swipeState.startTime;

      if (elapsed > maxGestureMs || Math.abs(dy) > maxDy * 2 || dx < -12) {
        clearSwipeState();
        return;
      }

      if (Math.abs(dx) > armDx && Math.abs(dx) > Math.abs(dy)) {
        _swipeState.armed = true;
      }

      if (_swipeState.armed && dx > minDx && Math.abs(dy) < maxDy && !_swipeState.consumed) {
        _swipeState.consumed = true;
        clearSwipeState();
        if (typeof _swipeBackHandler === 'function') {
          _swipeBackHandler();
        }
      }
      return;
    }
  }, { passive: true, capture: true });

  document.addEventListener('touchend', clearSwipeState, { passive: true, capture: true });
  document.addEventListener('touchcancel', clearSwipeState, { passive: true, capture: true });
}

/* ── Highlighting (Claude.md §26.3) ──────────────────────────────────────
   The reader owns the chrome and the instruction line; HighlightsFeature owns
   the store and the mode; the engine owns the tint. */

/* Which engines can take two taps on words, and which have no text to tap. */
function _engineHasTappableText() {
  return AppState.currentEngine === 'page'
    || AppState.currentEngine === 'focus'
    || AppState.currentEngine === 'scroll';
}

function _onHighlightButton() {
  if (typeof HighlightsFeature === 'undefined' || !AppState.currentFile) return;

  if (HighlightsFeature.active()) { HighlightsFeature.cancel(); return; }

  /* RSVP and Chunk show one word or a few, so there is nothing to tap twice.
     Marking the sentence the reader is on is the honest substitute — offering
     them nothing would be worse, since RSVP is where a reader moves fastest and
     is most likely to pass something they wanted. */
  if (!_engineHasTappableText()) {
    const made = HighlightsFeature.markSentence(
      AppState.currentFile.id,
      AppState.currentFile.words,
      _activeEngine && typeof _activeEngine.getIndex === 'function' ? _activeEngine.getIndex() : 0
    );
    if (!made) { showToast(t('reader.hl.failed')); return; }
    if (typeof TipsFeature !== 'undefined') TipsFeature.markDone('highlights');
    _refreshHighlightSurfaces();
    _showHighlightUndo();
    return;

  }

  /* onExit fires on a commit and on a cancel alike, so the Undo offer is decided
     by whether the count actually moved rather than by which path got here. */
  const before = HighlightsFeature.count(AppState.currentFile.id);

  HighlightsFeature.begin({
    fileId: AppState.currentFile.id,
    words: AppState.currentFile.words,
    onChange: _refreshHighlightSurfaces,
    onExit: function() {
      const file = AppState.currentFile;
      if (file && HighlightsFeature.count(file.id) !== before) {
        /* §22: the tip's whole job is done the first time a highlight is made,
           so retire it here rather than counting shows. Called from the feature
           as dictionary.js and bridge.js do, never from the strip. */
        if (typeof TipsFeature !== 'undefined') TipsFeature.markDone('highlights');
        _showHighlightUndo();
      } else {
        _hideHighlightUndo();
      }
    },
  });
  _syncHighlightChrome();
}

/* Repaint whatever is on screen, plus the chrome and the panel list. Called on
   every mode change — an anchor is drawn too, so the reader can see which word
   they picked. */
function _refreshHighlightSurfaces() {
  if (_activeEngine && typeof _activeEngine.refreshHighlights === 'function') {
    try { _activeEngine.refreshHighlights(); } catch (_) {}
  }
  _syncHighlightChrome();
  _renderHighlightList();
}

function _syncHighlightChrome() {
  const bar = qs('#reader-hl-bar');
  const text = qs('#reader-hl-bar-text');
  const btn = qs('#btn-reader-highlight');
  if (!bar || !text) return;

  const active = typeof HighlightsFeature !== 'undefined' && HighlightsFeature.active();
  if (btn) btn.classList.toggle('active', active);

  /* Leave the bar alone while it is showing an Undo: that state is owned by
     _showHighlightUndo and its timer, and the mode is already over. */
  if (bar.classList.contains('reader-hl-bar-done') && !active) return;

  bar.classList.toggle('hidden', !active);
  if (!active) return;

  text.textContent = HighlightsFeature.anchor() < 0
    ? t('reader.hl.tap_first')
    : t('reader.hl.tap_last');
}

/* A committed highlight is offered back for one tap, because the commit *is*
   the second tap — there is no confirm step, which is what keeps a highlight at
   two taps instead of four, so a mis-tap must cost one action and not a trip to
   the list. The bar is reused rather than a toast, because showToast() carries
   no action and an Undo the user cannot press is not an Undo. */
let _hlUndoTimer = null;

function _showHighlightUndo() {
  const bar = qs('#reader-hl-bar');
  const text = qs('#reader-hl-bar-text');
  const cancel = qs('#btn-reader-hl-cancel');
  if (!bar || !text || !cancel) return;

  clearTimeout(_hlUndoTimer);
  bar.classList.remove('hidden');
  bar.classList.add('reader-hl-bar-done');
  text.textContent = t('reader.hl.saved');
  cancel.textContent = t('reader.hl.undo');
  cancel.dataset.mode = 'undo';

  _hlUndoTimer = setTimeout(_hideHighlightUndo, 5000);
}

function _hideHighlightUndo() {
  clearTimeout(_hlUndoTimer);
  const bar = qs('#reader-hl-bar');
  const cancel = qs('#btn-reader-hl-cancel');
  if (cancel) {
    cancel.textContent = t('btn.cancel');
    delete cancel.dataset.mode;
  }
  if (bar) {
    bar.classList.remove('reader-hl-bar-done');
    /* Only hide if no new mode started in the meantime. */
    if (typeof HighlightsFeature === 'undefined' || !HighlightsFeature.active()) {
      bar.classList.add('hidden');
    }
  }
}

function _renderHighlightList() {
  const section = qs('#reader-hl-section');
  if (!section || typeof HighlightsFeature === 'undefined') return;

  const file = AppState.currentFile;
  const list = file ? HighlightsFeature.forFile(file.id) : [];
  if (!list.length) {
    section.innerHTML = '';
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  section.innerHTML =
    '<p class="reader-hl-section-title">' + tn('reader.hl.count', list.length) + '</p>' +
    list.map(function(h) {
      return '<div class="reader-hl-item" data-start="' + h.s + '">' +
        '<button class="reader-hl-item-go" data-go="' + h.s + '">' +
          escapeHtml(h.t || t('reader.hl.no_text')) +
        '</button>' +
        '<button class="reader-hl-item-del" data-del="' + h.s + '" aria-label="' + t('btn.remove') + '">✕</button>' +
      '</div>';
    }).join('');

  qsa('#reader-hl-section .reader-hl-item-go').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const start = parseInt(btn.dataset.go, 10);
      if (!isNaN(start)) _seekReaderTo(start);
    });
  });
  qsa('#reader-hl-section .reader-hl-item-del').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const start = parseInt(btn.dataset.del, 10);
      if (isNaN(start) || !AppState.currentFile) return;
      HighlightsFeature.remove(AppState.currentFile.id, start);
      _refreshHighlightSurfaces();
    });
  });
}

function _toggleIndexPanel() {
  AppState.isIndexOpen = !AppState.isIndexOpen;
  qs('#reader-index-panel').classList.toggle('hidden', !AppState.isIndexOpen);
  /* The same control closes the panel, and nothing said so -- the owner was
     tapping "Index" again on a hunch rather than on an affordance (§1.5: a
     control whose state is invisible is a silent failure). Every open and close
     funnels through here, including the two callers that close it on a chapter
     or highlight jump, so this is the one place that needs to know. */
  const btn = qs('#btn-reader-index');
  if (btn) {
    const label = AppState.isIndexOpen ? t('reader.index.close') : t('reader.btn.index');
    btn.classList.toggle('open', AppState.isIndexOpen);
    btn.setAttribute('aria-expanded', AppState.isIndexOpen ? 'true' : 'false');
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
  }
  if (AppState.isIndexOpen) _renderHighlightList();
}

function _skip(delta) {
  const wasPlaying = AppState.isPlaying;
  if (wasPlaying) _activeEngine.pause();
  _activeEngine.seekTo(_activeEngine.getIndex() + delta);
  _syncReaderPosition(_activeEngine.getIndex(), AppState.currentFile.words.length);
  if (wasPlaying) _activeEngine.play();
}

function _seekReaderTo(index) {
  const wasPlaying = AppState.isPlaying;
  if (wasPlaying) _activeEngine.pause();
  _activeEngine.seekTo(index);
  _syncReaderPosition(_activeEngine.getIndex(), AppState.currentFile.words.length);
  if (wasPlaying) _activeEngine.play();
  if (AppState.isIndexOpen) _toggleIndexPanel();
}

function _setWPM(wpm) {
  AppState.wpm = wpm;
  saveWPM(wpm);
  const slider = qs('#wpm-slider');
  if (slider) slider.value = wpm;
  const display = qs('#wpm-display');
  if (display) display.textContent = formatWPM(wpm);
  if (_activeEngine && typeof _activeEngine.onWPMChange === 'function') {
    _activeEngine.onWPMChange();
  }
}

function _renderIndexList(query) {
  const list = qs('#reader-index-list');
  if (!list) return;

  const needle = (query || '').trim().toLowerCase();
  const chapters = AppState.chapters.filter(function(chapter) {
    return !needle || chapter.title.toLowerCase().includes(needle);
  });

  if (chapters.length === 0) {
    list.innerHTML = '<p class="reader-index-empty">' + t('reader.index.empty') + '</p>';
    return;
  }

  list.innerHTML = chapters.map(function(chapter) {
    return `
      <button class="reader-index-item depth-${chapter.depth}" data-word-index="${chapter.wordIndex}">
        <span class="reader-index-item-title">${escapeHtml(chapter.title)}</span>
        <span class="reader-index-item-meta">p.${chapter.page} · ${formatPct(chapter.wordIndex, AppState.currentFile.words.length)}</span>
      </button>
    `;
  }).join('');

  qsa('.reader-index-item', list).forEach(function(item) {
    item.addEventListener('click', function() {
      _seekReaderTo(parseInt(this.dataset.wordIndex, 10));
      if (AppState.isIndexOpen) _toggleIndexPanel();
    });
  });
}

function _updateSeekText(index) {
  const text = qs('#reader-seek-text');
  const file = AppState.currentFile;
  if (!text || !file) return;
  let pageStr = '';
  const pwi = file.pageWordIndex;
  if (pwi && pwi.length) {
    let page = 1;
    for (let i = 0; i < pwi.length; i++) {
      if (pwi[i] <= index) page = i + 1;
      else break;
    }
    pageStr = ' · p.' + page + '/' + pwi.length;
  }
  text.textContent = formatPct(index, file.words.length) + pageStr + ' · word ' + formatNumber(index);
}

function _syncReaderPosition(index, total) {
  AppState.currentIndex = index;
  _noteSessionProgress(index);
  const position = qs('#position-display');
  if (position) position.textContent = formatPct(index, total);
  const slider = qs('#reader-seek-slider');
  if (slider) slider.value = index;
  _updateSeekText(index);
}

function _applyEngineChrome(key) {
  const wpmBar = qs('#wpm-bar');
  if (wpmBar) wpmBar.style.display = key === 'scroll' ? 'none' : '';
  /* Page mode hides #wpm-bar + #playback-bar entirely (handled in CSS via body class)
     and renders its own bottom nav bar. Toggle the class here so the standard bars
     don't flash on the first frame before PageEngine.init() runs. */
  document.body.classList.toggle('engine-page', key === 'page');
}

function _applyCalmMode() {
  const calmEnabled = localStorage.getItem('fr_calm_mode') === 'true';
  const reader = qs('#view-reader');
  const calmBtn = qs('#btn-reader-calm');
  if (reader) {
    reader.classList.toggle('reader-calm', calmEnabled);
    /* Page mode's chrome auto-hide is calm-mode-only — when the user turns calm
       mode off, restore chrome immediately so tabs/nav are accessible. */
    if (!calmEnabled) reader.classList.remove('page-chrome-hidden');
  }
  if (calmBtn) calmBtn.classList.toggle('active', calmEnabled);
}

/* A session's duration is the time the reader spent moving through the book, not
   the wall clock from open to close. Page mode is why this has to be said: it has
   no pause button, so page.js starts the session on init and nothing stops it
   until the view is left. A reader who put the phone down with Page mode open
   would otherwise bank the whole absence as reading time — and since wpm is now
   derived from this figure, that absence would drag the measured rate toward
   zero as well. So each gap between position changes is counted up to this cap
   and no further: longer than any real page read, short enough that a walk-away
   cannot poison the figure. */
const IDLE_GAP_CAP_MS = 3 * 60 * 1000;

/* No human reads this fast, so a session claiming to is not a reading rate — it
   is a forward *jump* (the seek box, the §7 bridge, a chapter tap) being counted
   as words read. The words still count, because the reader did move through the
   book; the rate is dropped, because `last7DaysAvgWpm` filters on wpm > 0 and a
   single six-figure outlier would otherwise own the dashboard average. The WPM
   slider itself tops out at 800. */
const MAX_PLAUSIBLE_WPM = 2000;

function _onEnginePlay() {
  if (_sessionState) return; /* already tracking */
  const at = _activeEngine ? _activeEngine.getIndex() : AppState.currentIndex;
  const now = Date.now();
  _sessionState = {
    startIndex: at,
    /* The furthest word reached, not the last one — see _flushSessionIfActive. */
    maxIndex: at,
    lastMoveMs: now,
    activeMs: 0,
  };
}

/* Called from _syncReaderPosition, which every engine already goes through on
   every position change — the same reasoning that put the nudge's progress
   counter on savePosition(). Cheap enough to sit on RSVP's per-word path: two
   number comparisons and an add, no parse and no DOM. */
function _noteSessionProgress(index) {
  const s = _sessionState;
  if (!s) return;
  if (typeof index === 'number' && isFinite(index) && index > s.maxIndex) s.maxIndex = index;
  const now = Date.now();
  s.activeMs += Math.min(now - s.lastMoveMs, IDLE_GAP_CAP_MS);
  s.lastMoveMs = now;
}

function _onEnginePause() {
  _flushSessionIfActive();
}

function _flushSessionIfActive() {
  if (!_sessionState) return;
  if (!AppState.currentFile) {
    _sessionState = null;
    return;
  }

  /* The furthest point reached, not the point they happened to stop on.
     Measuring end-minus-start made the whole session a net figure, so paging
     back subtracted what had been read — and a backward jump past the opening
     position (the "first page" button, a §7 bridge round-trip, the seek box)
     clamped to zero, which falls under the floor just below and discarded the
     session outright. Reading five pages and then turning back to check something
     earlier recorded nothing at all: no words, no time, and no streak day.
     Re-reading a passage still counts once, which is the honest answer to "how
     far through the book did this session get". */
  const endIndex = _activeEngine ? _activeEngine.getIndex() : AppState.currentIndex;
  const furthest = Math.max(_sessionState.maxIndex, endIndex);
  const wordsRead = Math.max(0, furthest - _sessionState.startIndex);
  const durationMs = _sessionState.activeMs;

  /* Only record sessions with meaningful content — skip accidental taps */
  if (wordsRead >= 10 && durationMs >= 3000) {
    /* §9.6. The same threshold the local recorder uses, so the ping and the
       dashboard can never disagree about what counted as a session. Read
       `readerSource` here rather than in the back handler: the handler resets
       it to 'upload' immediately after calling us, and a nudged read that
       reported itself as a chosen one would make the pivot look like it was
       working when it was not. Minutes and pages are rounded — the Worker sums
       them for a mean and nothing finer is wanted. */
    if (typeof logEvent === 'function') {
      logEvent('read_session_ended', {
        minutes: Math.round(durationMs / 60000),
        pages: Math.round(wordsRead / 220),
        engine: AppState.currentEngine || '',
        source: AppState.readerSource || 'upload',
      });
    }
    /* Measured, not the WPM slider's setting. Stamping AppState.wpm made the
       dashboard's "avg WPM" an average of a slider position rather than a
       reading rate — and in Page mode, where the WPM bar is hidden and the
       number means nothing, it stamped whatever the slider was last left at.
       Zero when the implied rate is impossible, which the dashboard reads as
       "no rate for this session" rather than as a slow one. */
    const measuredWpm = Math.round(wordsRead / (durationMs / 60000));
    saveReadingSession({
      date: todayDateString(),
      wordsRead: wordsRead,
      durationMs: durationMs,
      wpm: measuredWpm <= MAX_PLAUSIBLE_WPM ? measuredWpm : 0,
      fileId: AppState.currentFile.id,
    });
    /* Reschedule reminders — may cancel today's primary/nudge if user crossed
     * today's threshold, or pick fresher progress/streak copy for tomorrow. */
    if (typeof NotificationsFeature !== 'undefined') {
      try { NotificationsFeature.reschedule(); } catch (_) {}
    }
  }

  _sessionState = null;
}

function _nextFrame() {
  return new Promise(function(resolve) {
    requestAnimationFrame(function() { resolve(); });
  });
}

function _clearReaderEngineContent(container) {
  if (!container) return;
  Array.prototype.slice.call(container.children).forEach(function(child) {
    if (!(child.classList && child.classList.contains('engine-loading'))) {
      container.removeChild(child);
    }
  });
}

function _switchEngine(key) {
  const engine = _engineMap[key];
  if (!engine) return;

  /* Capture previous engine for cancel button — fall back to the default if
     same or unset */
  const prevEngineKey = (AppState.currentEngine && AppState.currentEngine !== key)
    ? AppState.currentEngine : 'page';
  const previousEngine = _activeEngine;

  const currentIndex = previousEngine ? previousEngine.getIndex() : AppState.currentIndex;
  _onEnginePause();
  AppState.isPlaying = false;

  qsa('.engine-tab').forEach(function(tab) {
    tab.classList.toggle('active', tab.dataset.engine === key);
  });

  AppState.currentEngine = key;
  AppState.lastReaderEngine = key;
  localStorage.setItem('fr_last_engine', key);
  _applyEngineChrome(key);

  const fileId = AppState.currentFile && AppState.currentFile.id;
  /* "Heavy" engines (Focus, Scroll) expose hasCache(). Light engines (RSVP, Chunk) don't —
     their init is fast enough that the loading card would just flash unnecessarily. */
  const isHeavyEngine = typeof engine.hasCache === 'function';
  /* Ask the engine, the way renderReader does. Without this the tab path showed
     the loading card on every switch even when the engine had nothing to build. */
  const skipLoadingCard = !isHeavyEngine || engine.hasCache(fileId);
  const transitionToken = ++_engineTransitionToken;
  _engineTransitionInFlight = true;
  const loaderShownAt = Date.now();
  const minLoaderMs = 180;
  const container = qs('#rsvp-container');

  if (!skipLoadingCard && container) {
    /* Paint loading UI first; heavy destroy/init starts on later frames. */
    _showEngineLoadingCard(container, key, prevEngineKey);
    const cancelBtn = qs('#engine-loading-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        if (transitionToken !== _engineTransitionToken) return;
        _engineTransitionToken += 1;
        _engineTransitionInFlight = false;
        _switchEngine(prevEngineKey);
      });
    }
  }

  (async function runTransition() {
    if (!skipLoadingCard) {
      await _nextFrame(); /* let spinner render before teardown */
    }
    if (transitionToken !== _engineTransitionToken) return;

    try {
      if (previousEngine && typeof previousEngine.destroy === 'function') {
        previousEngine.destroy();
      }
      _clearReaderEngineContent(container);
    } catch (err) {
      console.error('Engine destroy failed:', err);
    }

    if (transitionToken !== _engineTransitionToken) return;

    if (!skipLoadingCard) {
      await _nextFrame(); /* avoid back-to-back long tasks on same frame */
    }
    if (transitionToken !== _engineTransitionToken) return;

    try {
      _activeEngine = engine;
      _activeEngine.init(AppState.currentFile.words, currentIndex);
      _syncReaderPosition(currentIndex, AppState.currentFile.words.length);
    } catch (err) {
      console.error('Engine switch failed:', err);
      if (typeof showErrorCard === 'function') showErrorCard(t('reader.error.engine_failed'));
      return;
    } finally {
      if (skipLoadingCard) {
        _engineTransitionInFlight = false;
        return;
      }
      const elapsed = Date.now() - loaderShownAt;
      const remain = Math.max(0, minLoaderMs - elapsed);
      setTimeout(function() {
        if (transitionToken !== _engineTransitionToken) return;
        _engineTransitionInFlight = false;
      }, remain);
    }
  })();
}

function _showEngineLoadingCard(container, key, prevKey) {
  const existing = container.querySelector('.engine-loading');
  if (existing) existing.remove();
  container.insertAdjacentHTML('beforeend', _renderEngineLoadingCard(key, prevKey));
}

/* Rotating speed-reading facts shown during the first-build wait.
   Indices into the i18n loading_fact.N keys below. */
const _LOADING_FACT_GENERIC_INDICES = [0,1,2,3,4,5,6,7,8,9,10,11,12];
const _LOADING_FACT_FOCUS_INDICES   = [13,14,15,16];
const _LOADING_FACT_SCROLL_INDICES  = [17,18,19,20];

function _pickLoadingFact(engineKey) {
  let pool = _LOADING_FACT_GENERIC_INDICES.slice();
  if (engineKey === 'focus') pool = pool.concat(_LOADING_FACT_FOCUS_INDICES);
  else if (engineKey === 'scroll') pool = pool.concat(_LOADING_FACT_SCROLL_INDICES);
  return t('loading_fact.' + pool[Math.floor(Math.random() * pool.length)]);
}

function _renderEngineLoadingCard(key, prevKey) {
  const file = AppState.currentFile;
  const titles = {
    focus: t('engine_loading.title.focus'),
    scroll: t('engine_loading.title.scroll'),
    rsvp: t('engine_loading.title.rsvp'),
    chunk: t('engine_loading.title.chunk'),
    page: t('engine_loading.title.page'),
  };
  const subtitles = {
    focus: t('engine_loading.subtitle.focus'),
    scroll: t('engine_loading.subtitle.scroll'),
    rsvp: '',
    chunk: '',
    page: t('engine_loading.subtitle.page'),
  };
  const labels = {
    focus: t('reader.engine.focus'),
    scroll: t('reader.engine.scroll'),
    rsvp: t('reader.engine.rsvp'),
    chunk: t('reader.engine.chunk'),
    page: t('reader.engine.page'),
  };

  const title = titles[key] || t('engine_loading.title.default');
  const subtitle = subtitles[key] || '';
  const tip = _pickLoadingFact(key);
  const pageCount = (file && file.metadata && file.metadata.pageCount) || 0;
  const wordCount = (file && file.words && file.words.length) || 0;
  const stats = wordCount
    ? (pageCount ? formatNumber(pageCount) + ' pages · ' : '') + formatNumber(wordCount) + ' words'
    : '';
  const prevLabel = labels[prevKey] || 'previous mode';
  const showCancel = prevKey && prevKey !== key;

  return [
    '<div class="engine-loading">',
      '<div class="engine-loading-card">',
        '<div class="engine-loading-spinner"></div>',
        '<div class="engine-loading-title">' + escapeHtml(title) + '</div>',
        subtitle ? '<div class="engine-loading-subtitle">' + escapeHtml(subtitle) + '</div>' : '',
        stats ? '<div class="engine-loading-stats">' + escapeHtml(stats) + '</div>' : '',
        '<div class="engine-loading-progress-track">',
          '<div class="engine-loading-progress-fill" id="engine-loading-progress-fill"></div>',
        '</div>',
        '<div class="engine-loading-pct" id="engine-loading-pct">0%</div>',
        tip ? '<div class="engine-loading-tip">' + escapeHtml(tip) + '</div>' : '',
        showCancel ? '<button class="engine-loading-cancel" id="engine-loading-cancel" type="button">' + escapeHtml(t('engine_loading.cancel', {prevLabel: prevLabel})) + '</button>' : '',
      '</div>',
    '</div>',
  ].join('');
}

/* Global helper — engines call this between chunks to update the progress bar */
function _updateEngineLoadingProgress(pct) {
  const fill = document.getElementById('engine-loading-progress-fill');
  if (fill) fill.style.width = pct + '%';
  const pctText = document.getElementById('engine-loading-pct');
  if (pctText) pctText.textContent = Math.round(pct) + '%';
}

function showImageViewer(imageDataUrls) {
  if (!imageDataUrls || !imageDataUrls.length) return;

  function removeModal() {
    if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
  }

  const modal = document.createElement('div');
  modal.className = 'img-viewer-modal';
  modal.id = 'img-viewer-modal';

  const header = document.createElement('div');
  header.className = 'img-viewer-header';

  const title = document.createElement('p');
  title.className = 'img-viewer-title';
  title.textContent = t('image_viewer.title', {n: imageDataUrls.length});

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-ghost img-viewer-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', removeModal);

  header.appendChild(title);
  header.appendChild(closeBtn);

  const container = document.createElement('div');
  container.className = 'img-viewer-container';

  const scroll = document.createElement('div');
  scroll.className = 'img-viewer-scroll';

  imageDataUrls.forEach(function(url, i) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = t('image_viewer.img.alt', {n: i + 1});
    img.className = 'img-viewer-image';
    scroll.appendChild(img);
  });

  container.appendChild(scroll);
  modal.appendChild(header);
  modal.appendChild(container);
  document.body.appendChild(modal);

  modal.addEventListener('click', function(e) {
    if (e.target === modal) removeModal();
  });
}
