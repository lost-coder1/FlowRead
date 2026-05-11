/* Guided Highlighting Engine */

const HighlightEngine = (function() {
  let _words = [], _index = 0, _timerId = null;
  let _prevSpan = null;
  let _spanRefs = [];

  function init(words, startIndex) {
    _words = words;
    _index = startIndex || 0;
    _spanRefs = [];
    _prevSpan = null;
    _render();
  }

  function _render() {
    const container = qs('#rsvp-container');
    container.innerHTML = `<div class="gh-scroll-container" id="gh-container"></div>`;
    const ghContainer = qs('#gh-container');
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < _words.length; i++) {
      const span = document.createElement('span');
      span.className = 'gh-word';
      const w = _words[i];
      span.textContent = (typeof w === 'string' ? w : (w && w.label) || '[Content]') + ' ';
      _spanRefs[i] = span;
      fragment.appendChild(span);
    }
    ghContainer.appendChild(fragment);
    if (_spanRefs[_index]) {
      _spanRefs[_index].classList.add('gh-current');
      _prevSpan = _spanRefs[_index];
    }
    requestAnimationFrame(() => _scrollToCurrent());
  }

  function _updateActive() {
    if (_prevSpan) {
      _prevSpan.classList.remove('gh-current');
      _prevSpan.classList.add('gh-past');
    }
    const cur = _spanRefs[_index];
    if (cur) { cur.classList.add('gh-current'); _prevSpan = cur; }
    const fill = qs('#progress-bar-fill');
    if (fill && _words.length) fill.style.width = ((_index / _words.length) * 100) + '%';
  }

  /* Only scroll when word is outside visible area — avoids fighting the timer */
  function _scrollToCurrent() {
    const span = _spanRefs[_index];
    const container = qs('#gh-container');
    if (!span || !container) return;
    const spanRect = span.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    const margin = 80;
    if (spanRect.top < contRect.top + margin || spanRect.bottom > contRect.bottom - margin) {
      span.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  }

  function _schedule() {
    if (!AppState.isPlaying) return;
    _updateActive();
    _scrollToCurrent();
    if (_index % 30 === 0 && AppState.currentFile) savePosition(AppState.currentFile.id, _index);
    const word = _words[_index];
    const base = 60000 / AppState.wpm;
    const last = typeof word === 'string' ? word[word.length - 1] : '';
    const delay = '.!?'.includes(last) ? base * 1.8 : ',;:'.includes(last) ? base * 1.3 : base;
    _timerId = setTimeout(function() {
      _index++;
      if (_index >= _words.length) { _handleEnd(); return; }
      _schedule();
    }, delay);
  }

  function onWPMChange() {
    if (!AppState.isPlaying) return;
    if (_timerId) { clearTimeout(_timerId); _timerId = null; }
    _schedule();
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
  function destroy() {
    pause(); AppState.isPlaying = false;
    _spanRefs = []; _prevSpan = null;
  }
  function getIndex() { return _index; }
  function seekTo(i) {
    _index = Math.max(0, Math.min(_words.length - 1, i));
    if (_prevSpan) { _prevSpan.classList.remove('gh-current'); _prevSpan = null; }
    const cur = _spanRefs[_index];
    if (cur) { cur.classList.add('gh-current'); _prevSpan = cur; }
    _scrollToCurrent();
    if (AppState.currentFile) savePosition(AppState.currentFile.id, _index);
  }

  return { init, play, pause, destroy, getIndex, seekTo, onWPMChange };
})();
