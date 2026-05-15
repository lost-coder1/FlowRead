/* Chunk Mode — flashes 2–7 words at a time */

const ChunkEngine = (function() {
  let _words = [], _index = 0, _timerId = null, _generation = 0;
  let _chunkSize = 3;
  let _stageWidth = 0;
  let _fontSizeCache = Object.create(null);
  let _measureCanvas = null;
  let _measureContext = null;

  function _getReadingFontFamily() {
    if (!document.body || !window.getComputedStyle) return '"Roboto", "Helvetica Neue", Arial, sans-serif';
    const family = window.getComputedStyle(document.body).getPropertyValue('--font-body').trim();
    return family || '"Roboto", "Helvetica Neue", Arial, sans-serif';
  }

  function init(words, startIndex) {
    _words = words;
    _index = startIndex || 0;
    _chunkSize = parseInt(localStorage.getItem('fr_chunk_size') || String((AppState.settings && AppState.settings.defaultChunkSize) || 3), 10);
    _fontSizeCache = Object.create(null);
    _render();
  }

  function _render() {
    const container = qs('#rsvp-container');
    container.innerHTML = `
      <div class="rsvp-layout">
        <div class="rsvp-stage" id="chunk-stage">
          <div class="rsvp-word-wrap" id="chunk-display" style="font-size:36px;text-align:center;color:var(--rsvp-text);white-space:nowrap;line-height:1.3;width:100%"></div>
        </div>
        <div class="rsvp-progress-text" id="chunk-progress"></div>
        <div class="rsvp-comfort-controls">
          <label style="font-family:var(--font-mono);font-size:12px;color:var(--text-muted)">Chunk size</label>
          <select id="chunk-size-select" style="background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;font-family:var(--font-mono);font-size:13px">
            ${[2,3,4,5,7].map(n => `<option value="${n}"${n===_chunkSize?' selected':''}>${n} words</option>`).join('')}
          </select>
        </div>
      </div>`;
    qs('#chunk-size-select').addEventListener('change', function() {
      _chunkSize = parseInt(this.value, 10);
      localStorage.setItem('fr_chunk_size', _chunkSize);
      _fontSizeCache = Object.create(null);
      _updateDisplay();
    });
    requestAnimationFrame(function() {
      const stage = qs('#chunk-stage');
      _stageWidth = stage ? Math.max(120, stage.clientWidth - 32) : 0;
      _updateDisplay();
    });
    _updateDisplay();
  }

  function _updateDisplay() {
    const el = qs('#chunk-display');
    if (el) {
      const chunkWords = _words.slice(_index, _index + _chunkSize);
      const placeholder = chunkWords.find(w => typeof w === 'object' && w.type === 'placeholder');
      const text = placeholder
        ? (placeholder.label || '[Content]')
        : chunkWords.filter(w => typeof w === 'string').join(' ');

      el.classList.toggle('chunk-placeholder', Boolean(placeholder));
      el.style.fontSize = _resolveChunkFontSize(text) + 'px';

      if (placeholder) {
        el.textContent = text;
        el.onclick = function() { openObjectPlaceholder(placeholder); };
      } else {
        el.innerHTML = '';
        el.onclick = null;
        const stringWords = chunkWords.filter(w => typeof w === 'string');
        stringWords.forEach(function(w, i) {
          const span = document.createElement('span');
          span.className = 'chunk-word';
          span.textContent = w + (i < stringWords.length - 1 ? ' ' : '');
          span.addEventListener('click', function(e) {
            e.stopPropagation();
            if (typeof DictionaryFeature !== 'undefined') DictionaryFeature.showDictionaryModal(w);
          });
          el.appendChild(span);
        });
      }
    }
    const prog = qs('#chunk-progress');
    if (prog) prog.textContent = formatNumber(_index) + ' / ' + formatNumber(_words.length);
    if (typeof _syncReaderPosition === 'function') {
      _syncReaderPosition(_index, _words.length);
    }
    const fill = qs('#progress-bar-fill');
    if (fill && _words.length) fill.style.width = ((_index / _words.length) * 100) + '%';
  }

  function _schedule() {
    if (!AppState.isPlaying) return;
    _updateDisplay();
    if (_index % 30 === 0 && AppState.currentFile) savePosition(AppState.currentFile.id, _index);
    const lastWord = _words[Math.min(_index + _chunkSize - 1, _words.length - 1)];
    const base = (60000 / AppState.wpm) * _chunkSize;
    const last = typeof lastWord === 'string' ? lastWord[lastWord.length - 1] : '';
    const delay = '.!?'.includes(last) ? base * 1.8 : ',;:'.includes(last) ? base * 1.3 : base;
    const gen = _generation;
    _timerId = setTimeout(function() {
      if (gen !== _generation) return; /* stale — a pause/seek invalidated this chain */
      _index = Math.min(_index + _chunkSize, _words.length - 1);
      if (_index >= _words.length - 1) { _handleEnd(); return; }
      _schedule();
    }, delay);
  }

  function _handleEnd() {
    AppState.isPlaying = false;
    if (AppState.currentFile) savePosition(AppState.currentFile.id, 0);
    showToast('Finished!');
    const btn = qs('#btn-play-pause'); if (btn) btn.textContent = '▶';
  }

  function play() {
    if (AppState.isPlaying) return;
    AppState.isPlaying = true;
    const btn = qs('#btn-play-pause'); if (btn) btn.textContent = '⏸';
    clearIdleReleaseTimer(); acquireWakeLock();
    _schedule();
  }
  function pause() {
    AppState.isPlaying = false;
    _generation++;
    if (_timerId) { clearTimeout(_timerId); _timerId = null; }
    if (AppState.currentFile) savePosition(AppState.currentFile.id, _index);
    startIdleReleaseTimer();
    const btn = qs('#btn-play-pause'); if (btn) btn.textContent = '▶';
  }
  function destroy() { pause(); AppState.isPlaying = false; }
  function getIndex() { return _index; }
  function seekTo(i) {
    _index = Math.max(0, Math.min(_words.length - 1, i));
    _updateDisplay();
    if (AppState.currentFile) savePosition(AppState.currentFile.id, _index);
  }

  function onWPMChange() {
    if (!AppState.isPlaying) return;
    _generation++;
    if (_timerId) { clearTimeout(_timerId); _timerId = null; }
    _schedule();
  }

  function _resolveChunkFontSize(text) {
    if (!text) return 36;
    if (!_measureCanvas) {
      _measureCanvas = document.createElement('canvas');
      _measureContext = _measureCanvas.getContext('2d');
    }

    if (!_stageWidth) {
      const stage = qs('#chunk-stage');
      _stageWidth = stage ? Math.max(120, stage.clientWidth - 32) : 320;
    }

    const cacheKey = text + '::' + _stageWidth;
    if (_fontSizeCache[cacheKey]) return _fontSizeCache[cacheKey];

    let low = 14;
    let high = 36;
    let best = 14;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      _measureContext.font = '400 ' + mid + 'px ' + _getReadingFontFamily();
      const width = _measureContext.measureText(text).width;
      if (width <= _stageWidth) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    _fontSizeCache[cacheKey] = best;
    return best;
  }

  return { init, play, pause, destroy, getIndex, seekTo, onWPMChange };
})();
