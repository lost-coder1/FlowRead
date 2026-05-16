/* Speed reading container view — hosts all reading engines */

let _activeEngine = null;
let _sessionState = null; /* { startIndex, startTimeMs } */
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
};

function renderReader(options) {
  const view = qs('#view-reader');
  const file = AppState.currentFile;
  if (!file) return;

  const opts = options || {};
  const startIndex = typeof opts.startIndex === 'number' ? opts.startIndex : loadPosition(file.id);
  const savedEngine = localStorage.getItem('fr_last_engine') || AppState.currentEngine || AppState.settings.defaultMode || 'rsvp';
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
  AppState.chapters = detectChapters(file.rawLines, file.pageWordIndex);
  AppState.isIndexOpen = false;

  view.innerHTML = `
    <div class="progress-bar-track">
      <div class="progress-bar-fill" id="progress-bar-fill"></div>
    </div>

    <div class="reader-header" id="reader-header">
      <button class="btn btn-ghost reader-back" id="btn-reader-back">←</button>
      <p class="reader-filename">${escapeHtml(file.name)}</p>
      <button class="btn btn-ghost reader-calm-toggle" id="btn-reader-calm">Calm</button>
      <button class="btn btn-ghost reader-index-toggle" id="btn-reader-index">Index</button>
    </div>

    <div class="engine-tabs" id="engine-tabs">
      <button class="engine-tab" data-engine="rsvp">RSVP</button>
      <button class="engine-tab" data-engine="chunk">Chunk</button>
      <button class="engine-tab" data-engine="focus">Focus</button>
      <button class="engine-tab" data-engine="scroll">Scroll</button>
    </div>

    <div id="rsvp-container" class="engine-container"></div>
    ${hasPdfBridge ? '<button class="reader-normal-toggle" id="btn-open-normal" title="Open matching PDF page">PDF</button>' : ''}
    ${hasPdfLazy ? '<button class="reader-normal-toggle" id="btn-open-normal-lazy" title="Open matching PDF page">PDF</button>' : ''}
    ${hasPdfDataOnly ? '<button class="reader-normal-toggle reader-normal-toggle-disabled" id="btn-open-normal-hint" title="Re-import PDF to enable Normal View">PDF</button>' : ''}
    ${hasUrlSource ? '<button class="reader-normal-toggle" id="btn-open-source-url" title="Open source article">URL</button>' : ''}
    ${hasImgSource ? '<button class="reader-normal-toggle" id="btn-open-img-viewer" title="View source images">IMG</button>' : ''}

    <aside class="reader-index-panel hidden" id="reader-index-panel">
      <div class="reader-index-head">
        <p class="reader-index-title">Index</p>
        <button class="btn btn-ghost" id="btn-close-index">×</button>
      </div>

      <div class="reader-index-seek">
        <label for="reader-seek-slider">Position</label>
        <input type="range" id="reader-seek-slider" min="0" max="${Math.max(0, file.words.length - 1)}" value="${startIndex}" />
        <div class="reader-index-seek-row">
          <span class="reader-index-seek-text" id="reader-seek-text"></span>
          <button class="btn btn-primary" id="btn-reader-seek-go">Go</button>
        </div>
      </div>

      <div class="reader-index-search">
        <input type="search" id="reader-index-search" class="reader-index-search-input" placeholder="Search chapters" />
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

  _activeEngine = _engineMap[AppState.currentEngine] || RSVPEngine;

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
      if (typeof showErrorCard === 'function') showErrorCard('Something went wrong — please re-import the file.');
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
    showToast('Resuming from word ' + formatNumber(startIndex) + ' — tap Start Over to reset', 5000);
  }

  _bindReaderControls();
  _bindReaderLifecycleHooks();
  _renderIndexList('');
  _syncReaderPosition(startIndex, file.words.length);
  _applyEngineChrome(AppState.currentEngine);
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
    if (src === 'dashboard') {
      renderDashboard();
      switchView('view-dashboard');
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
      showToast('Re-import this PDF to enable Normal View.');
    });
  }

  const normalLazyButton = qs('#btn-open-normal-lazy');
  if (normalLazyButton) {
    normalLazyButton.addEventListener('click', async function() {
      if (_activeEngine) {
        AppState.currentIndex = _activeEngine.getIndex();
        _activeEngine.pause();
      }
      showLoading('Loading PDF…');
      try {
        const buf = await loadRawPdf(AppState.currentFile.id);
        if (!buf) {
          hideLoading();
          showToast('PDF data missing. Please re-import.');
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
        showToast('Could not open PDF. Please re-import.');
      }
    });
  }

  const urlButton = qs('#btn-open-source-url');
  if (urlButton) {
    urlButton.addEventListener('click', function() {
      if (window.Capacitor && Capacitor.isNativePlatform()) {
        window.open(file.sourceUrl, '_system');
      } else {
        window.open(file.sourceUrl, '_blank');
      }
    });
  }

  const imgButton = qs('#btn-open-img-viewer');
  if (imgButton) {
    imgButton.addEventListener('click', function() {
      showImageViewer(file.imageDataUrls);
    });
  }

  qs('#btn-reader-calm').addEventListener('click', function() {
    const next = localStorage.getItem('fr_calm_mode') !== 'true';
    localStorage.setItem('fr_calm_mode', next);
    _applyCalmMode();
  });

  qs('#btn-reader-index').addEventListener('click', _toggleIndexPanel);
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

function _toggleIndexPanel() {
  AppState.isIndexOpen = !AppState.isIndexOpen;
  qs('#reader-index-panel').classList.toggle('hidden', !AppState.isIndexOpen);
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
    list.innerHTML = '<p class="reader-index-empty">No chapters detected for this document.</p>';
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
  const position = qs('#position-display');
  if (position) position.textContent = formatPct(index, total);
  const slider = qs('#reader-seek-slider');
  if (slider) slider.value = index;
  _updateSeekText(index);
}

function _applyEngineChrome(key) {
  const wpmBar = qs('#wpm-bar');
  if (wpmBar) wpmBar.style.display = key === 'scroll' ? 'none' : '';
}

function _applyCalmMode() {
  const calmEnabled = localStorage.getItem('fr_calm_mode') === 'true';
  const reader = qs('#view-reader');
  const calmBtn = qs('#btn-reader-calm');
  if (reader) reader.classList.toggle('reader-calm', calmEnabled);
  if (calmBtn) calmBtn.classList.toggle('active', calmEnabled);
}

function _onEnginePlay() {
  if (_sessionState) return; /* already tracking */
  _sessionState = {
    startIndex: _activeEngine ? _activeEngine.getIndex() : AppState.currentIndex,
    startTimeMs: Date.now(),
  };
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

  const endIndex = _activeEngine ? _activeEngine.getIndex() : AppState.currentIndex;
  const wordsRead = Math.max(0, endIndex - _sessionState.startIndex);
  const durationMs = Date.now() - _sessionState.startTimeMs;

  /* Only record sessions with meaningful content — skip accidental taps */
  if (wordsRead >= 10 && durationMs >= 3000) {
    saveReadingSession({
      date: todayDateString(),
      wordsRead: wordsRead,
      durationMs: durationMs,
      wpm: AppState.wpm,
      fileId: AppState.currentFile.id,
    });
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

  /* Capture previous engine for cancel button — fall back to RSVP if same or unset */
  const prevEngineKey = (AppState.currentEngine && AppState.currentEngine !== key)
    ? AppState.currentEngine : 'rsvp';
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
  const skipLoadingCard = !isHeavyEngine;
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
      if (typeof showErrorCard === 'function') showErrorCard('Something went wrong — please re-import the file.');
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
   Some are engine-specific; the generic ones can appear for any engine. */
const _LOADING_FACTS_GENERIC = [
  'The average adult reads at 200–250 WPM. With training, 400–600 WPM is comfortable.',
  'Speed reading reduces "saccades" — the rapid eye jumps between words that slow you down.',
  'Sub-vocalization (silently saying words in your head) caps you around 300 WPM. Beating it is the next jump.',
  'Comprehension typically drops above 600 WPM. Find your sweet spot.',
  'The Guinness record for reading is over 1,000 WPM with full comprehension.',
  'Only about 4% of your reading time is spent absorbing meaning — the rest is eye movement.',
  'Your eye fixates on a word for ~250ms. Speed reading shortens this window.',
  'Reading in larger chunks (4–7 words at once) can double your speed without losing meaning.',
  'A page of dense prose averages ~250 words. Knowing this helps you pace yourself.',
  'Skimming and speed reading are different — speed reading aims for full comprehension.',
  'The Optimal Recognition Point (ORP) sits at ~33% of each word, where your eye naturally rests.',
  'Most people regress 5–15% of the time, re-reading what they already read. Speed modes prevent this.',
  'Reading on screen is ~25% slower than reading on paper, on average — focus modes close the gap.',
];

const _LOADING_FACTS_FOCUS = [
  'Focus highlights the first 40% of each word — your brain fills in the rest from context.',
  'Bolded prefixes act as visual anchors, helping your eye land precisely on each word.',
  'The first letters of a word carry more information than the last. Focus mode leans into this.',
  'Tap a [Tap to view…] placeholder in Focus to see the original image, table, or equation.',
];

const _LOADING_FACTS_SCROLL = [
  'Scroll mode is a teleprompter — text flows past while your eyes stay still.',
  'The yellow centre line is your fixation point. Let words come to you.',
  'Adjust speed independently of WPM in Scroll mode — handy for skimming.',
  'Scroll uses GPU-accelerated transforms, so it stays smooth even on long documents.',
];

function _pickLoadingFact(engineKey) {
  let pool = _LOADING_FACTS_GENERIC.slice();
  if (engineKey === 'focus') pool = pool.concat(_LOADING_FACTS_FOCUS);
  else if (engineKey === 'scroll') pool = pool.concat(_LOADING_FACTS_SCROLL);
  return pool[Math.floor(Math.random() * pool.length)];
}

function _renderEngineLoadingCard(key, prevKey) {
  const file = AppState.currentFile;
  const titles = {
    focus: 'Building Focus Mode',
    scroll: 'Setting up the teleprompter',
    rsvp: 'Loading RSVP',
    chunk: 'Loading Chunk',
  };
  const subtitles = {
    focus: 'Bolding word anchors and laying out pages…',
    scroll: 'Preparing a continuous text flow for you to glide through…',
    rsvp: '',
    chunk: '',
  };
  const labels = { focus: 'Focus', scroll: 'Scroll', rsvp: 'RSVP', chunk: 'Chunk' };

  const title = titles[key] || 'Loading';
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
        showCancel ? '<button class="engine-loading-cancel" id="engine-loading-cancel" type="button">Cancel — stay in ' + escapeHtml(prevLabel) + '</button>' : '',
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
  title.textContent = 'Source images (' + imageDataUrls.length + ')';

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
    img.alt = 'Image ' + (i + 1);
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
