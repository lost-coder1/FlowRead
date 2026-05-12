/* Focus Bold Engine — centered reading lane.
   Keeps the eyes in a narrow horizontal band instead of making them
   traverse a full page and jump back from bottom-right to top-left. */

const FocusBoldEngine = (function() {
  let _words = [];
  let _index = 0;
  let _timerId = null;
  let _lineStart = 0;
  let _lineEnd = 0;
  let _lineSpans = [];
  let _prevSpan = null;

  function init(words, startIndex) {
    _words = words;
    _index = startIndex || 0;
    _lineStart = Math.max(0, _index - 2);
    _lineEnd = _lineStart;
    _lineSpans = [];
    _prevSpan = null;
    _render();
  }

  function _render() {
    const container = qs('#rsvp-container');
    container.innerHTML = `
      <div class="fb-focus-shell">
        <div class="fb-focus-kicker">Focus Bold</div>
        <div class="fb-focus-stage" id="fb-stage">
          <div class="fb-focus-line" id="fb-line"></div>
        </div>
      </div>
    `;
    requestAnimationFrame(function() {
      _buildLine();
    });
  }

  function _buildLine() {
    const line = qs('#fb-line');
    if (!line) return;

    line.innerHTML = '';
    _lineSpans = [];
    _prevSpan = null;

    const maxCandidates = Math.min(_words.length - _lineStart, 28);
    if (maxCandidates <= 0) {
      /* End of document */
      _lineEnd = _lineStart;
      _index = Math.max(0, _lineStart - 1);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < maxCandidates; i += 1) {
      const span = _makeSpan(_words[_lineStart + i], _lineStart + i);
      _lineSpans.push(span);
      fragment.appendChild(span);
    }
    line.appendChild(fragment);

    while (_lineSpans.length > 1 && line.scrollWidth > line.clientWidth) {
      const removed = _lineSpans.pop();
      line.removeChild(removed);
    }

    _lineEnd = _lineStart + _lineSpans.length;
    if (_index < _lineStart) _index = _lineStart;
    if (_index >= _lineEnd) _index = _lineEnd - 1;

    _paintLine();
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
    const bold = document.createElement('span');
    bold.className = 'fb-bold';
    bold.textContent = word.slice(0, boldLen);
    const rest = document.createElement('span');
    rest.className = 'fb-rest';
    rest.textContent = word.slice(boldLen);

    span.appendChild(bold);
    span.appendChild(rest);
    span.appendChild(document.createTextNode(' '));
    return span;
  }

  function _paintLine() {
    _lineSpans.forEach(function(span, localIndex) {
      const globalIndex = _lineStart + localIndex;
      span.classList.toggle('fb-past', globalIndex < _index);
      span.classList.toggle('fb-current', globalIndex === _index);
    });

    const current = _lineSpans[_index - _lineStart];
    if (current) _prevSpan = current;

    if (typeof _syncReaderPosition === 'function') {
      _syncReaderPosition(_index, _words.length);
    }

    const fill = qs('#progress-bar-fill');
    if (fill && _words.length) {
      fill.style.width = ((_index / _words.length) * 100) + '%';
    }
  }

  function _maybeShiftLine() {
    if (_index < _lineStart || _index >= _lineEnd - 2) {
      _lineStart = Math.max(0, _index - 2);
      _buildLine();
      return;
    }

    _paintLine();
  }

  function _schedule() {
    if (!AppState.isPlaying) return;

    _paintLine();
    if (_index % 30 === 0 && AppState.currentFile) {
      savePosition(AppState.currentFile.id, _index);
    }

    const word = _words[_index];
    const base = 60000 / AppState.wpm;
    const last = typeof word === 'string' ? word[word.length - 1] : '';
    const delay = '.!?'.includes(last) ? base * 1.8 : ',;:'.includes(last) ? base * 1.3 : base;

    _timerId = setTimeout(function() {
      _index += 1;
      if (_index >= _words.length) {
        _handleEnd();
        return;
      }
      _maybeShiftLine();
      _schedule();
    }, delay);
  }

  function onWPMChange() {
    if (!AppState.isPlaying) return;
    if (_timerId) {
      clearTimeout(_timerId);
      _timerId = null;
    }
    _schedule();
  }

  function _handleEnd() {
    AppState.isPlaying = false;
    if (AppState.currentFile) savePosition(AppState.currentFile.id, 0);
    showToast('Finished!');
    const btn = qs('#btn-play-pause');
    if (btn) btn.textContent = '▶';
  }

  function play() {
    if (AppState.isPlaying) return;
    AppState.isPlaying = true;
    const btn = qs('#btn-play-pause');
    if (btn) btn.textContent = '⏸';
    clearIdleReleaseTimer();
    acquireWakeLock();
    _schedule();
  }

  function pause() {
    AppState.isPlaying = false;
    if (_timerId) {
      clearTimeout(_timerId);
      _timerId = null;
    }
    if (AppState.currentFile) savePosition(AppState.currentFile.id, _index);
    startIdleReleaseTimer();
    const btn = qs('#btn-play-pause');
    if (btn) btn.textContent = '▶';
  }

  function destroy() {
    pause();
    _lineSpans = [];
    _prevSpan = null;
  }

  function getIndex() {
    return _index;
  }

  function seekTo(index) {
    _index = Math.max(0, Math.min(_words.length - 1, index));
    _lineStart = Math.max(0, _index - 2);
    _buildLine();
    if (AppState.currentFile) savePosition(AppState.currentFile.id, _index);
  }

  return { init, play, pause, destroy, getIndex, seekTo, onWPMChange };
})();
