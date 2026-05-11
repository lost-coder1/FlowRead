/* Speed reading container view — hosts all reading engines */

let _activeEngine = null;

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
  const savedEngine = localStorage.getItem('fr_last_engine') || AppState.currentEngine || 'rsvp';

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
    <button class="reader-normal-toggle" id="btn-open-normal" title="Open matching PDF page">PDF</button>

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
  _activeEngine.init(file.words, startIndex);

  if (startIndex > 0 && !opts.silentResume) {
    showToast('Resuming from word ' + formatNumber(startIndex) + ' — tap Start Over to reset', 5000);
  }

  _bindReaderControls();
  _renderIndexList('');
  _syncReaderPosition(startIndex, file.words.length);
  _applyEngineChrome(AppState.currentEngine);
  acquireWakeLock();

  if (opts.autoPlay) {
    _activeEngine.play();
  }
}

function _bindReaderControls() {
  qs('#btn-reader-back').addEventListener('click', function() {
    if (_activeEngine) _activeEngine.pause();
    releaseWakeLock();
    switchView('view-upload');
  });

  qs('#btn-open-normal').addEventListener('click', function() {
    if (_activeEngine) {
      AppState.currentIndex = _activeEngine.getIndex();
      _activeEngine.pause();
    }
    openNormalAtCurrentWord();
  });

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
    } else {
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

  qs('#view-reader').addEventListener('click', function() {
    if (localStorage.getItem('fr_calm_mode') !== 'true') return;
    this.classList.add('calm-peek');
    clearTimeout(this._calmPeekTimer);
    this._calmPeekTimer = setTimeout(() => this.classList.remove('calm-peek'), 1800);
  });
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
  if (!text || !AppState.currentFile) return;
  text.textContent = formatPct(index, AppState.currentFile.words.length) + ' · word ' + formatNumber(index);
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

function _switchEngine(key) {
  const engine = _engineMap[key];
  if (!engine) return;

  const currentIndex = _activeEngine ? _activeEngine.getIndex() : AppState.currentIndex;
  if (_activeEngine) _activeEngine.destroy();
  AppState.isPlaying = false;

  qsa('.engine-tab').forEach(function(tab) {
    tab.classList.toggle('active', tab.dataset.engine === key);
  });

  AppState.currentEngine = key;
  AppState.lastReaderEngine = key;
  localStorage.setItem('fr_last_engine', key);
  _applyEngineChrome(key);

  _activeEngine = engine;
  _activeEngine.init(AppState.currentFile.words, currentIndex);
  _syncReaderPosition(currentIndex, AppState.currentFile.words.length);
}
