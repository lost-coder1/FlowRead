/* Speed reading container view — hosts all 5 engines */

let _activeEngine = null;

function renderReader() {
  const view = qs('#view-reader');
  const file = AppState.currentFile;
  if (!file) return;

  view.innerHTML = `
    <!-- 2px progress bar pinned to top -->
    <div class="progress-bar-track">
      <div class="progress-bar-fill" id="progress-bar-fill"></div>
    </div>

    <!-- Header bar -->
    <div class="reader-header" id="reader-header">
      <button class="btn btn-ghost reader-back" id="btn-reader-back">←</button>
      <p class="reader-filename">${escapeHtml(file.name)}</p>
      <div style="width:44px"></div><!-- spacer -->
    </div>

    <!-- Engine tab bar -->
    <div class="engine-tabs" id="engine-tabs">
      <button class="engine-tab active" data-engine="rsvp">RSVP</button>
      <button class="engine-tab" data-engine="chunk">Chunk</button>
      <button class="engine-tab" data-engine="focus">Focus</button>
      <button class="engine-tab" data-engine="scroll">Scroll</button>
    </div>

    <!-- Engine render target -->
    <div id="rsvp-container" class="engine-container"></div>

    <!-- WPM control bar -->
    <div class="wpm-bar" id="wpm-bar">
      <button class="btn btn-ghost wpm-btn" id="btn-wpm-dec">−</button>
      <input type="range" id="wpm-slider" min="60" max="800" step="10" value="${AppState.wpm}" />
      <button class="btn btn-ghost wpm-btn" id="btn-wpm-inc">+</button>
      <span class="wpm-display" id="wpm-display">${AppState.wpm} WPM</span>
    </div>

    <!-- Playback controls bar -->
    <div class="playback-bar" id="playback-bar">
      <button class="btn btn-ghost control-btn" id="btn-skip-back50" title="−50">«</button>
      <button class="btn btn-ghost control-btn" id="btn-skip-back10" title="−10">‹</button>
      <button class="btn btn-ghost control-btn control-play" id="btn-play-pause">▶</button>
      <button class="btn btn-ghost control-btn" id="btn-skip-fwd10" title="+10">›</button>
      <button class="btn btn-ghost control-btn" id="btn-skip-fwd50" title="+50">»</button>
      <span class="position-display" id="position-display"></span>
    </div>
  `;

  /* Wire engine */
  const startIndex = loadPosition(file.id);
  AppState.currentIndex = startIndex;
  _activeEngine = RSVPEngine;
  _activeEngine.init(file.words, startIndex);

  /* Show resume toast if not starting from 0 */
  if (startIndex > 0) {
    showToast('Resuming from word ' + formatNumber(startIndex) +
      ' — tap Start Over to reset', 5000);
  }

  _bindReaderControls();
  acquireWakeLock();
}

function _bindReaderControls() {
  /* Back button */
  qs('#btn-reader-back').addEventListener('click', function() {
    if (_activeEngine) _activeEngine.pause();
    releaseWakeLock();
    switchView('view-upload');
  });

  /* Play / Pause */
  qs('#btn-play-pause').addEventListener('click', function() {
    if (AppState.isPlaying) {
      _activeEngine.pause();
    } else {
      _activeEngine.play();
    }
  });

  /* Skip buttons */
  qs('#btn-skip-back50').addEventListener('click', function() { _skip(-50); });
  qs('#btn-skip-back10').addEventListener('click', function() { _skip(-10); });
  qs('#btn-skip-fwd10').addEventListener('click', function() { _skip(10); });
  qs('#btn-skip-fwd50').addEventListener('click', function() { _skip(50); });

  /* WPM slider */
  const slider = qs('#wpm-slider');
  slider.addEventListener('input', function() { _setWPM(parseInt(this.value, 10)); });
  qs('#btn-wpm-dec').addEventListener('click', function() {
    _setWPM(Math.max(60, AppState.wpm - 10));
  });
  qs('#btn-wpm-inc').addEventListener('click', function() {
    _setWPM(Math.min(800, AppState.wpm + 10));
  });

  /* Engine tab switching */
  qsa('.engine-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      const engineKey = this.dataset.engine;
      if (engineKey === AppState.currentEngine) return;
      _switchEngine(engineKey);
    });
  });

  /* Calm mode tap-to-reveal */
  qs('#reader-header').addEventListener('click', function() {
    if (!localStorage.getItem('fr_calm_mode') === 'true') return;
    this.classList.add('calm-peek');
    setTimeout(() => this.classList.remove('calm-peek'), 2000);
  });
}

function _skip(delta) {
  const wasPlaying = AppState.isPlaying;
  if (wasPlaying) _activeEngine.pause();
  _activeEngine.seekTo(_activeEngine.getIndex() + delta);
  if (wasPlaying) _activeEngine.play();
}

function _setWPM(wpm) {
  AppState.wpm = wpm;
  saveWPM(wpm);
  const slider = qs('#wpm-slider');
  if (slider) slider.value = wpm;
  const display = qs('#wpm-display');
  if (display) display.textContent = wpm + ' WPM';
  if (_activeEngine && typeof _activeEngine.onWPMChange === 'function') {
    _activeEngine.onWPMChange();
  }
}

const _engineMap = {
  rsvp:   RSVPEngine,
  chunk:  ChunkEngine,
  focus:  FocusBoldEngine,
  scroll: ScrollEngine,
};

function _switchEngine(key) {
  const engine = _engineMap[key];
  if (!engine) return;

  /* Save position and stop current engine */
  const currentIndex = _activeEngine ? _activeEngine.getIndex() : AppState.currentIndex;
  if (_activeEngine) _activeEngine.destroy();
  AppState.isPlaying = false;

  /* Update tabs */
  qsa('.engine-tab').forEach(t => t.classList.toggle('active', t.dataset.engine === key));
  AppState.currentEngine = key;
  localStorage.setItem('fr_last_engine', key);

  /* Hide WPM bar for scroll (has its own speed control) */
  const wpmBar = qs('#wpm-bar');
  if (wpmBar) wpmBar.style.display = key === 'scroll' ? 'none' : '';

  /* Init new engine at preserved index */
  _activeEngine = engine;
  _activeEngine.init(AppState.currentFile.words, currentIndex);
}
