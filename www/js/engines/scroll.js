/* Simple Scroll Engine — teleprompter-style continuous scroll via requestAnimationFrame */

const ScrollEngine = (function() {
  let _words = [], _index = 0;
  let _rafId = null, _scrollY = 0, _multiplier = 1.0, _lineThick = 1;
  let _containerEl = null, _lastTs = null;

  const _LINE_THICK_SIZES = [1, 2, 4, 6, 10];

  function init(words, startIndex) {
    _words = words;
    _index = startIndex || 0;
    _multiplier = parseFloat(localStorage.getItem('fr_scroll_mult') || '1.0');
    _lineThick = parseInt(localStorage.getItem('fr_scroll_line') || '1', 10);
    if (!_LINE_THICK_SIZES.includes(_lineThick)) _lineThick = 1;
    _render();
  }

  function _applyLine() {
    const line = qs('.scroll-centre-line');
    if (line) line.style.height = _lineThick + 'px';
  }

  function _render() {
    const container = qs('#rsvp-container');
    container.innerHTML = `
      <div class="scroll-outer" id="scroll-outer">
        <div class="scroll-fade-top"></div>
        <div class="scroll-content" id="scroll-content"></div>
        <div class="scroll-fade-bottom"></div>
        <div class="scroll-centre-line"></div>
      </div>
      <div class="scroll-speed-row" id="scroll-speed-row">
        <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">Speed</span>
        <button class="comfort-btn" id="btn-scroll-dec">−</button>
        <span class="comfort-btn" id="scroll-mult-display" style="cursor:default;pointer-events:none;min-width:44px;text-align:center">${_multiplier.toFixed(2)}×</span>
        <button class="comfort-btn" id="btn-scroll-inc">+</button>
        <div style="width:1px;background:var(--border);align-self:stretch;margin:0 4px"></div>
        <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">Line</span>
        <button class="comfort-btn" id="btn-line-dec">−</button>
        <span class="comfort-btn" id="scroll-line-display" style="cursor:default;pointer-events:none;min-width:44px;text-align:center">${_lineThick}px</span>
        <button class="comfort-btn" id="btn-line-inc">+</button>
      </div>`;

    _containerEl = qs('#scroll-outer');

    const content = qs('#scroll-content');
    _words.forEach(function(w, i) {
      const span = document.createElement('span');
      span.dataset.index = i;
      span.className = 'scroll-word';
      span.textContent = (typeof w === 'string' ? w : (w && w.label) || '[Content]') + ' ';
      content.appendChild(span);
    });

    requestAnimationFrame(function() {
      const target = qs('[data-index="' + _index + '"].scroll-word');
      if (target && _containerEl) {
        _scrollY = target.offsetTop - _containerEl.clientHeight / 2;
        _containerEl.scrollTop = Math.max(0, _scrollY);
      }
    });

    qs('#btn-scroll-dec').addEventListener('click', function() {
      _multiplier = Math.max(0.25, parseFloat((_multiplier - 0.25).toFixed(2)));
      localStorage.setItem('fr_scroll_mult', _multiplier);
      qs('#scroll-mult-display').textContent = _multiplier.toFixed(2) + '×';
    });
    qs('#btn-scroll-inc').addEventListener('click', function() {
      _multiplier = Math.min(4.0, parseFloat((_multiplier + 0.25).toFixed(2)));
      localStorage.setItem('fr_scroll_mult', _multiplier);
      qs('#scroll-mult-display').textContent = _multiplier.toFixed(2) + '×';
    });
    qs('#btn-line-dec').addEventListener('click', function() {
      const idx = _LINE_THICK_SIZES.indexOf(_lineThick);
      if (idx > 0) _lineThick = _LINE_THICK_SIZES[idx - 1];
      localStorage.setItem('fr_scroll_line', _lineThick);
      qs('#scroll-line-display').textContent = _lineThick + 'px';
      _applyLine();
    });
    qs('#btn-line-inc').addEventListener('click', function() {
      const idx = _LINE_THICK_SIZES.indexOf(_lineThick);
      if (idx < _LINE_THICK_SIZES.length - 1) _lineThick = _LINE_THICK_SIZES[idx + 1];
      localStorage.setItem('fr_scroll_line', _lineThick);
      qs('#scroll-line-display').textContent = _lineThick + 'px';
      _applyLine();
    });
    _applyLine();
  }

  function _frame(ts) {
    if (!AppState.isPlaying) return;
    if (_lastTs === null) _lastTs = ts;
    const delta = ts - _lastTs;
    _lastTs = ts;

    const pxPerMs = (AppState.wpm / 60000) * 28 / 8 * _multiplier;
    _scrollY += pxPerMs * delta;
    if (_containerEl) _containerEl.scrollTop = _scrollY;

    _syncIndexFromScroll();

    const fill = qs('#progress-bar-fill');
    if (fill && _words.length) fill.style.width = ((_index / _words.length) * 100) + '%';

    if (_index % 30 === 0 && AppState.currentFile) savePosition(AppState.currentFile.id, _index);

    if (_containerEl && _containerEl.scrollTop + _containerEl.clientHeight >= _containerEl.scrollHeight - 10) {
      _handleEnd(); return;
    }
    _rafId = requestAnimationFrame(_frame);
  }

  function _syncIndexFromScroll() {
    if (!_containerEl) return;
    const mid = _containerEl.scrollTop + _containerEl.clientHeight * 0.4;
    const spans = qsa('.scroll-word');
    for (let i = spans.length - 1; i >= 0; i--) {
      if (spans[i].offsetTop <= mid) {
        _index = parseInt(spans[i].dataset.index, 10);
        break;
      }
    }
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
    _lastTs = null;
    const btn = qs('#btn-play-pause'); if (btn) btn.textContent = '⏸';
    clearIdleReleaseTimer(); acquireWakeLock();
    _rafId = requestAnimationFrame(_frame);
  }
  function pause() {
    AppState.isPlaying = false;
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    _lastTs = null;
    if (AppState.currentFile) savePosition(AppState.currentFile.id, _index);
    startIdleReleaseTimer();
    const btn = qs('#btn-play-pause'); if (btn) btn.textContent = '▶';
  }
  function destroy() { pause(); AppState.isPlaying = false; }
  function getIndex() { return _index; }
  function seekTo(i) {
    _index = Math.max(0, Math.min(_words.length - 1, i));
    const target = qs('[data-index="' + _index + '"].scroll-word');
    if (target && _containerEl) {
      _scrollY = target.offsetTop - _containerEl.clientHeight / 2;
      _containerEl.scrollTop = Math.max(0, _scrollY);
    }
    if (AppState.currentFile) savePosition(AppState.currentFile.id, _index);
  }

  return { init, play, pause, destroy, getIndex, seekTo };
})();
