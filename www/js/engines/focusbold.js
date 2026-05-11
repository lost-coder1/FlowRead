/* Focus Bold Engine — page mode bionic reading.
   Fills the visible area with words (no internal scroll), runs a highlight
   through them at WPM, and only swaps to the next page when the current
   page is finished. Calm, book-like — no continuous motion. */

const FocusBoldEngine = (function() {
  let _words = [], _index = 0, _timerId = null;
  let _pageStart = 0, _pageEnd = 0;
  let _pageSpans = [];     /* spans currently mounted in DOM (this page) */
  let _prevSpan = null;

  function init(words, startIndex) {
    _words = words;
    _index = startIndex || 0;
    _pageStart = _index;
    _pageEnd = _index;
    _pageSpans = [];
    _prevSpan = null;
    _render();
  }

  function _render() {
    const container = qs('#rsvp-container');
    container.innerHTML = `<div class="fb-page-container" id="fb-container"></div>`;
    requestAnimationFrame(() => _buildPage());
  }

  /* Fill the visible container with as many words as fit, starting at _pageStart */
  function _buildPage() {
    const container = qs('#fb-container');
    if (!container) return;
    container.innerHTML = '';
    _pageSpans = [];
    _prevSpan = null;

    const maxCandidates = Math.min(_words.length - _pageStart, 400);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < maxCandidates; i++) {
      const span = _makeSpan(_words[_pageStart + i], _pageStart + i);
      _pageSpans.push(span);
      frag.appendChild(span);
    }
    container.appendChild(frag);

    /* Trim to what actually fits — walk from end, find last span whose bottom is within container */
    const contH = container.clientHeight;
    let lastFitIdx = -1;
    for (let i = 0; i < _pageSpans.length; i++) {
      const s = _pageSpans[i];
      if (s.offsetTop + s.offsetHeight <= contH) {
        lastFitIdx = i;
      } else {
        break;
      }
    }
    if (lastFitIdx < 0) lastFitIdx = 0; /* at least one word */

    /* Remove overflow spans */
    for (let i = _pageSpans.length - 1; i > lastFitIdx; i--) {
      container.removeChild(_pageSpans[i]);
    }
    _pageSpans.length = lastFitIdx + 1;
    _pageEnd = _pageStart + _pageSpans.length;

    /* Clamp _index into the page (e.g. resumed mid-page) */
    if (_index < _pageStart) _index = _pageStart;
    if (_index >= _pageEnd) _index = _pageEnd - 1;

    /* Paint already-passed words within page */
    for (let i = 0; i < _index - _pageStart; i++) {
      _pageSpans[i].classList.add('fb-past');
    }
    const curSpan = _pageSpans[_index - _pageStart];
    if (curSpan) { curSpan.classList.add('fb-current'); _prevSpan = curSpan; }
  }

  function _makeSpan(word, index) {
    const span = document.createElement('span');
    span.className = 'fb-word';
    span.dataset.index = index;
    if (typeof word !== 'string') {
      span.className += ' fb-placeholder';
      span.textContent = (word && word.label) || '[Content]';
      span.addEventListener('click', function() {
        openObjectPlaceholder(word);
      });
      return span;
    }
    const boldLen = Math.max(1, Math.ceil(word.length * 0.4));
    const b = document.createElement('span');
    b.className = 'fb-bold';
    b.textContent = word.slice(0, boldLen);
    const r = document.createElement('span');
    r.className = 'fb-rest';
    r.textContent = word.slice(boldLen);
    span.appendChild(b);
    span.appendChild(r);
    span.appendChild(document.createTextNode(' '));
    return span;
  }

  function _advanceCurrent() {
    if (_prevSpan) {
      _prevSpan.classList.remove('fb-current');
      _prevSpan.classList.add('fb-past');
    }
    const localIdx = _index - _pageStart;
    const cur = _pageSpans[localIdx];
    if (cur) { cur.classList.add('fb-current'); _prevSpan = cur; }
    const fill = qs('#progress-bar-fill');
    if (fill && _words.length) fill.style.width = ((_index / _words.length) * 100) + '%';
    if (typeof _syncReaderPosition === 'function') {
      _syncReaderPosition(_index, _words.length);
    }
  }

  function _schedule() {
    if (!AppState.isPlaying) return;
    _advanceCurrent();
    if (_index % 30 === 0 && AppState.currentFile) savePosition(AppState.currentFile.id, _index);
    const word = _words[_index];
    const base = 60000 / AppState.wpm;
    const last = typeof word === 'string' ? word[word.length - 1] : '';
    const delay = '.!?'.includes(last) ? base * 1.8 : ',;:'.includes(last) ? base * 1.3 : base;
    _timerId = setTimeout(function() {
      _index++;
      if (_index >= _words.length) { _handleEnd(); return; }
      if (_index >= _pageEnd) {
        /* Page complete — pause briefly so reader sees finished page, then swap */
        _pageStart = _index;
        _buildPage();
      }
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
    pause();
    AppState.isPlaying = false;
    _pageSpans = []; _prevSpan = null;
  }
  function getIndex() { return _index; }
  function seekTo(i) {
    _index = Math.max(0, Math.min(_words.length - 1, i));
    _pageStart = _index;
    _buildPage();
    if (typeof _syncReaderPosition === 'function') {
      _syncReaderPosition(_index, _words.length);
    }
    if (AppState.currentFile) savePosition(AppState.currentFile.id, _index);
  }

  return { init, play, pause, destroy, getIndex, seekTo, onWPMChange };
})();
