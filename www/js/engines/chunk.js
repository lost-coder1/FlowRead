/* Chunk Mode — flashes 2–7 words at a time */

const ChunkEngine = (function() {
  let _words = [], _index = 0, _timerId = null;
  let _chunkSize = 3;

  function init(words, startIndex) {
    _words = words;
    _index = startIndex || 0;
    _chunkSize = parseInt(localStorage.getItem('fr_chunk_size') || '3', 10);
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
    });
    _updateDisplay();
  }

  function _updateDisplay() {
    const el = qs('#chunk-display');
    if (el) {
      const chunkWords = _words.slice(_index, _index + _chunkSize);
      const placeholder = chunkWords.find(w => typeof w === 'object' && w.type === 'placeholder');
      el.textContent = placeholder
        ? (placeholder.label || '[Content]')
        : chunkWords.filter(w => typeof w === 'string').join(' ');
      el.classList.toggle('chunk-placeholder', Boolean(placeholder));
      el.onclick = placeholder ? function() { openObjectPlaceholder(placeholder); } : null;
      /* Auto-shrink font until text fits in a single line */
      let size = 36;
      el.style.fontSize = size + 'px';
      const stage = qs('#chunk-stage');
      if (stage) {
        while (el.scrollWidth > stage.clientWidth - 32 && size > 14) {
          size -= 2;
          el.style.fontSize = size + 'px';
        }
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
    _timerId = setTimeout(function() {
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
    if (_timerId) { clearTimeout(_timerId); _timerId = null; }
    _schedule();
  }

  return { init, play, pause, destroy, getIndex, seekTo, onWPMChange };
})();
