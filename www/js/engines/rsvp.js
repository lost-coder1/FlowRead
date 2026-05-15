/* RSVP Engine — Rapid Serial Visual Presentation */
/* Exports: init(words, startIndex), play(), pause(), destroy(), getIndex() */

const RSVPEngine = (function() {
  let _words = [];
  let _index = 0;
  let _timerId = null;

  /* DOM refs — built once at init, mutated during playback */
  let _stageEl = null;
  let _beforeEl = null;
  let _orpEl = null;
  let _afterEl = null;
  let _contextEl = null;
  let _progressTextEl = null;
  let _progressFillEl = null;

  /* Settings (loaded from storage at init) */
  let _orpEnabled = true;
  let _contextEnabled = false;
  let _calmEnabled = false;
  let _fontSize = 48;

  function init(words, startIndex) {
    _words = words;
    _index = startIndex || 0;
    _orpEnabled = localStorage.getItem('fr_orp_enabled') !== 'false';
    _contextEnabled = localStorage.getItem('fr_context_enabled') === 'true';
    _calmEnabled = localStorage.getItem('fr_calm_mode') === 'true';
    _fontSize = parseInt(localStorage.getItem('fr_font_size') || '48', 10);
    _render();
  }

  function _render() {
    const container = qs('#rsvp-container');
    if (!container) return;

    container.innerHTML = `
      <div class="rsvp-layout${_calmEnabled ? ' calm' : ''}">

        <div class="rsvp-context-line${_contextEnabled ? '' : ' hidden'}" id="rsvp-context"></div>

        <div class="rsvp-stage" id="rsvp-stage">
          <div class="rsvp-word-wrap">
            <span class="rsvp-word-before" id="rsvp-before"></span><span
              class="rsvp-word-orp" id="rsvp-orp"></span><span
              class="rsvp-word-after" id="rsvp-after"></span>
          </div>
        </div>

        <div class="rsvp-progress-text" id="rsvp-progress-text"></div>

        <div class="rsvp-comfort-controls" id="rsvp-comfort">
          <button class="comfort-btn" id="btn-font-dec" title="Smaller">A−</button>
          <button class="comfort-btn" id="btn-font-inc" title="Larger">A+</button>
          <button class="comfort-btn${_orpEnabled ? ' active' : ''}" id="btn-orp">ORP</button>
          <button class="comfort-btn${_contextEnabled ? ' active' : ''}" id="btn-context">Context</button>
        </div>

      </div>
    `;

    _stageEl = qs('#rsvp-stage');
    _beforeEl = qs('#rsvp-before');
    _orpEl = qs('#rsvp-orp');
    _afterEl = qs('#rsvp-after');
    _contextEl = qs('#rsvp-context');
    _progressTextEl = qs('#rsvp-progress-text');

    _applyFontSize();
    _applyOrpStyle();
    _displayWord(_words[_index]);
    _updateProgress();
    if (typeof _syncReaderPosition === 'function') {
      _syncReaderPosition(_index, _words.length);
    }
    _bindComfortControls();
  }

  function _bindComfortControls() {
    qs('#btn-font-dec').addEventListener('click', function() {
      _fontSize = Math.max(24, _fontSize - 4);
      localStorage.setItem('fr_font_size', _fontSize);
      _applyFontSize();
    });
    qs('#btn-font-inc').addEventListener('click', function() {
      _fontSize = Math.min(80, _fontSize + 4);
      localStorage.setItem('fr_font_size', _fontSize);
      _applyFontSize();
    });
    qs('#btn-orp').addEventListener('click', function() {
      _orpEnabled = !_orpEnabled;
      localStorage.setItem('fr_orp_enabled', _orpEnabled);
      this.classList.toggle('active', _orpEnabled);
      _applyOrpStyle();
      _displayWord(_words[_index]);
    });
    qs('#btn-context').addEventListener('click', function() {
      _contextEnabled = !_contextEnabled;
      localStorage.setItem('fr_context_enabled', _contextEnabled);
      this.classList.toggle('active', _contextEnabled);
      _contextEl && _contextEl.classList.toggle('hidden', !_contextEnabled);
      if (_contextEnabled) _updateContext();
    });
  }

  function _applyFontSize() {
    /* Must target .rsvp-word-wrap, not the stage — the wrap has its own CSS font-size
       which beats inherited values from the parent */
    const wrap = qs('.rsvp-word-wrap');
    if (wrap) wrap.style.fontSize = _fontSize + 'px';
  }

  function _applyOrpStyle() {
    if (!_orpEl) return;
    _orpEl.style.color = _orpEnabled ? 'var(--rsvp-orp)' : 'var(--rsvp-text)';
  }

  function _displayWord(word) {
    if (!_beforeEl) return;

    const wrap = _stageEl && _stageEl.querySelector('.rsvp-word-wrap');

    /* Placeholder object */
    if (word && typeof word === 'object' && word.type === 'placeholder') {
      _beforeEl.textContent = '';
      _orpEl.textContent = '';
      _afterEl.textContent = word.label || '[Content]';
      _afterEl.style.color = 'var(--accent)';
      _afterEl.style.fontSize = '';
      if (wrap) wrap.style.fontSize = Math.min(_fontSize, 22) + 'px';
      if (wrap) wrap.classList.add('placeholder-mode');
      _stageEl.onclick = function() { openObjectPlaceholder(word); };
      _stageEl.style.cursor = 'pointer';
      return;
    }

    if (wrap) wrap.classList.remove('placeholder-mode');
    if (wrap) wrap.style.fontSize = _fontSize + 'px';
    _stageEl.onclick = function() {
      const word = (_beforeEl.textContent || '') + (_orpEl.textContent || '') + (_afterEl.textContent || '');
      if (typeof DictionaryFeature !== 'undefined') DictionaryFeature.showDictionaryModal(word.trim());
    };
    _stageEl.style.cursor = 'pointer';
    _afterEl.style.color = '';
    _afterEl.style.fontSize = '';

    const w = (word || '').toString();
    if (!w) {
      _beforeEl.textContent = '';
      _orpEl.textContent = '';
      _afterEl.textContent = '';
      return;
    }

    if (_orpEnabled) {
      const orpIdx = Math.floor(w.length * 0.33);
      _beforeEl.textContent = w.slice(0, orpIdx);
      _orpEl.textContent = w[orpIdx] || '';
      _afterEl.textContent = w.slice(orpIdx + 1);
    } else {
      _beforeEl.textContent = '';
      _orpEl.textContent = '';
      _afterEl.textContent = w;
    }
  }

  function _updateContext() {
    if (!_contextEl || !_contextEnabled) return;
    const start = Math.max(0, _index - 4);
    const contextWords = _words.slice(start, _index)
      .filter(w => typeof w === 'string')
      .join(' ');
    _contextEl.textContent = contextWords || '';
  }

  function _updateProgress() {
    const total = _words.length;
    if (_progressTextEl) {
      _progressTextEl.textContent = formatNumber(_index) + ' / ' + formatNumber(total);
    }
    if (typeof _syncReaderPosition === 'function') {
      _syncReaderPosition(_index, total);
    }
    /* Progress bar fill (lives in reader view, not rsvp-container) */
    const fill = qs('#progress-bar-fill');
    if (fill && total > 0) {
      fill.style.width = ((_index / total) * 100) + '%';
    }
  }

  function _computeDelay(word) {
    const wpm = AppState.wpm;
    const base = 60000 / wpm;
    if (!word || typeof word !== 'string') return base * 2;
    const last = word[word.length - 1];
    if ('.!?'.includes(last)) return base * 1.8;
    if (',;:'.includes(last)) return base * 1.3;
    return base;
  }

  function _scheduleNext() {
    if (!AppState.isPlaying) return;
    const word = _words[_index];
    _displayWord(word);
    _updateContext();
    _updateProgress();

    /* Save position every ~30 words */
    if (_index % 30 === 0 && AppState.currentFile) {
      savePosition(AppState.currentFile.id, _index);
    }

    const delay = _computeDelay(word);
    _timerId = setTimeout(function() {
      _index++;
      if (_index >= _words.length) {
        _handleEnd();
        return;
      }
      _scheduleNext();
    }, delay);
  }

  function _handleEnd() {
    AppState.isPlaying = false;
    if (AppState.currentFile) savePosition(AppState.currentFile.id, 0);
    showToast('Finished! Position reset to beginning.');
    _updatePlayPauseBtn();
  }

  function play() {
    if (AppState.isPlaying) return;
    AppState.isPlaying = true;
    clearIdleReleaseTimer();
    acquireWakeLock();
    _updatePlayPauseBtn();
    _scheduleNext();
  }

  function pause() {
    AppState.isPlaying = false;
    if (_timerId) { clearTimeout(_timerId); _timerId = null; }
    if (AppState.currentFile) savePosition(AppState.currentFile.id, _index);
    startIdleReleaseTimer();
    _updatePlayPauseBtn();
  }

  function destroy() {
    pause();
    AppState.isPlaying = false;
  }

  function getIndex() { return _index; }

  function seekTo(index) {
    _index = Math.max(0, Math.min(_words.length - 1, index));
    _displayWord(_words[_index]);
    _updateContext();
    _updateProgress();
    if (AppState.currentFile) savePosition(AppState.currentFile.id, _index);
  }

  function _updatePlayPauseBtn() {
    const btn = qs('#btn-play-pause');
    if (btn) btn.textContent = AppState.isPlaying ? '⏸' : '▶';
  }

  function onWPMChange() {
    if (!AppState.isPlaying) return;
    if (_timerId) { clearTimeout(_timerId); _timerId = null; }
    _scheduleNext();
  }

  return { init, play, pause, destroy, getIndex, seekTo, onWPMChange };
})();
