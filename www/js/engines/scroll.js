/* Simple Scroll Engine — teleprompter via CSS transform (GPU-composited, no layout reflow) */

const ScrollEngine = (function() {
  let _words = [], _index = 0;
  let _rafId = null, _scrollY = 0, _maxScrollY = 0, _multiplier = 1.0, _lineThick = 1;
  let _outerEl = null, _trackEl = null, _lastTs = null;
  let _spanTops = [], _lastIndexSyncTs = 0, _lastSavedIndex = -1;

  /* DOM cache — preserves all word spans between engine switches for the same file */
  let _domCache = null;
  let _cacheFileId = null;
  let _abortBuild = false;
  let _buildComplete = false;

  const _LINE_THICK_SIZES = [1, 2, 4, 6, 10];

  function init(words, startIndex) {
    _words = words;
    _index = startIndex || 0;
    _abortBuild = false;
    _buildComplete = false;
    _multiplier = parseFloat(localStorage.getItem('fr_scroll_mult') || '1.0');
    _lineThick = parseInt(localStorage.getItem('fr_scroll_line') || '1', 10);
    if (!_LINE_THICK_SIZES.includes(_lineThick)) _lineThick = 1;

    const fileId = AppState.currentFile && AppState.currentFile.id;
    const container = qs('#rsvp-container');

    /* Cache hit: restore DOM, re-acquire refs, seek to position */
    if (fileId && fileId === _cacheFileId && _domCache) {
      _clearEngineContent(container);
      while (_domCache.firstChild) {
        container.appendChild(_domCache.firstChild);
      }
      _domCache = null;
      _outerEl = qs('#scroll-outer');
      _trackEl = qs('#scroll-track');
      if (!_outerEl || !_trackEl) {
        _buildComplete = false;
        _render();
        return;
      }
      /* Keep cache-restore hidden until index re-seek completes.
         Prevents visible "start of page then jump to saved index" flash. */
      _outerEl.style.visibility = 'hidden';
      _buildComplete = true;
      _applyLine();
      if (typeof _updateEngineLoadingProgress === 'function') {
        _updateEngineLoadingProgress(92);
      }
      requestAnimationFrame(function() {
        _cacheSpanPositions();
        if (_outerEl && _trackEl) {
          _maxScrollY = Math.max(0, _trackEl.offsetHeight - _outerEl.clientHeight);
        }
        const target = qs('[data-index="' + _index + '"].scroll-word');
        if (target && _outerEl) {
          _scrollY = Math.max(0, target.offsetTop - _outerEl.clientHeight / 2);
          _applyTransform();
        }
        if (_outerEl) _outerEl.style.visibility = '';
        if (typeof _updateEngineLoadingProgress === 'function') {
          _updateEngineLoadingProgress(100);
        }
        _removeLoadingSpinner(container);
      });
      return;
    }

    _domCache = null;
    _cacheFileId = fileId;
    _render();
  }

  function _applyLine() {
    const line = qs('.scroll-centre-line');
    if (line) line.style.height = _lineThick + 'px';
  }

  function _clearEngineContent(container) {
    if (!container) return;
    Array.prototype.slice.call(container.children).forEach(function(child) {
      if (!(child.classList && child.classList.contains('engine-loading'))) {
        container.removeChild(child);
      }
    });
  }

  function _removeLoadingSpinner(container) {
    const spinner = container && container.querySelector('.engine-loading');
    if (spinner) spinner.remove();
  }

  function _applyTransform() {
    if (_trackEl) _trackEl.style.transform = 'translateY(-' + _scrollY.toFixed(2) + 'px)';
  }

  function _render() {
    const container = qs('#rsvp-container');
    _clearEngineContent(container);

    /* Append scroll structure WITHOUT clearing container — keeps the loading spinner
       (set up in _switchEngine) overlaying our build until we're ready to show. */
    container.insertAdjacentHTML('beforeend',
      '<div class="scroll-outer" id="scroll-outer">' +
        '<div class="scroll-track" id="scroll-track">' +
          '<div class="scroll-content" id="scroll-content"></div>' +
        '</div>' +
        '<div class="scroll-fade-top"></div>' +
        '<div class="scroll-fade-bottom"></div>' +
        '<div class="scroll-centre-line"></div>' +
      '</div>' +
      '<div class="scroll-speed-row" id="scroll-speed-row">' +
        '<span style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">Speed</span>' +
        '<button class="comfort-btn" id="btn-scroll-dec">−</button>' +
        '<span class="comfort-btn" id="scroll-mult-display" style="cursor:default;pointer-events:none;min-width:44px;text-align:center">' + _multiplier.toFixed(2) + '×</span>' +
        '<button class="comfort-btn" id="btn-scroll-inc">+</button>' +
        '<div style="width:1px;background:var(--border);align-self:stretch;margin:0 4px"></div>' +
        '<span style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">Line</span>' +
        '<button class="comfort-btn" id="btn-line-dec">−</button>' +
        '<span class="comfort-btn" id="scroll-line-display" style="cursor:default;pointer-events:none;min-width:44px;text-align:center">' + _lineThick + 'px</span>' +
        '<button class="comfort-btn" id="btn-line-inc">+</button>' +
      '</div>');

    _outerEl = qs('#scroll-outer');
    _trackEl = qs('#scroll-track');

    const content = qs('#scroll-content');

    /* Chunk span creation so the spinner keeps animating during the slow build */
    const CHUNK_SIZE = 4000;
    const total = _words.length;
    let i = 0;

    function buildChunk() {
      if (_abortBuild) return;

      const frag = document.createDocumentFragment();
      const end = Math.min(i + CHUNK_SIZE, total);
      for (; i < end; i++) {
        const w = _words[i];
        const span = document.createElement('span');
        span.dataset.index = i;
        span.className = 'scroll-word';
        if (typeof w === 'string') {
          span.textContent = w + ' ';
          (function(captured) {
            span.addEventListener('click', function(e) {
              e.stopPropagation();
              if (typeof DictionaryFeature !== 'undefined') DictionaryFeature.showDictionaryModal(captured);
            });
          })(w);
        } else {
          span.textContent = ((w && w.label) || '[Content]') + ' ';
          span.classList.add('scroll-placeholder');
          (function(captured) {
            span.addEventListener('click', function() { openObjectPlaceholder(captured); });
          })(w);
        }
        frag.appendChild(span);
      }
      content.appendChild(frag);

      /* Reserve last 5% for position caching */
      if (typeof _updateEngineLoadingProgress === 'function') {
        _updateEngineLoadingProgress((i / total) * 95);
      }

      if (i < total) {
        requestAnimationFrame(buildChunk);
      } else {
        requestAnimationFrame(function() {
          if (_abortBuild) return;
          _cacheSpanPositions();
          if (_outerEl) {
            _maxScrollY = Math.max(0, (_trackEl ? _trackEl.offsetHeight : 0) - _outerEl.clientHeight);
          }
          const target = qs('[data-index="' + _index + '"].scroll-word');
          if (target && _outerEl) {
            _scrollY = Math.max(0, target.offsetTop - _outerEl.clientHeight / 2);
            _applyTransform();
          }
          if (typeof _updateEngineLoadingProgress === 'function') {
            _updateEngineLoadingProgress(100);
          }
          _buildComplete = true;
          _removeLoadingSpinner(container);
        });
      }
    }

    buildChunk();

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
    const delta = Math.min(ts - _lastTs, 50); /* cap at 50ms to avoid big jumps after tab switch */
    _lastTs = ts;

    const pxPerMs = (AppState.wpm / 60000) * 28 / 8 * _multiplier;
    _scrollY += pxPerMs * delta;
    _applyTransform();

    if (ts - _lastIndexSyncTs >= 80) {
      _syncIndexFromScroll();
      _lastIndexSyncTs = ts;
    }

    const fill = qs('#progress-bar-fill');
    if (fill && _words.length) fill.style.width = ((_index / _words.length) * 100) + '%';
    if (typeof _syncReaderPosition === 'function') _syncReaderPosition(_index, _words.length);

    if (AppState.currentFile && _index !== _lastSavedIndex && _index % 30 === 0) {
      savePosition(AppState.currentFile.id, _index);
      _lastSavedIndex = _index;
    }

    /* End detection: scrolled past content */
    if (_maxScrollY > 0 && _scrollY >= _maxScrollY) {
      _handleEnd();
      return;
    }

    _rafId = requestAnimationFrame(_frame);
  }

  function _syncIndexFromScroll() {
    if (_spanTops.length === 0 || !_outerEl) return;
    /* Centre of the viewport in content-space */
    const mid = _scrollY + _outerEl.clientHeight * 0.4;
    let lo = 0, hi = _spanTops.length - 1, best = 0;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (_spanTops[m] <= mid) { best = m; lo = m + 1; } else { hi = m - 1; }
    }
    _index = best;
  }

  function _cacheSpanPositions() {
    _spanTops = qsa('.scroll-word').map(function(span) { return span.offsetTop; });
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
    _lastTs = null;
    _lastIndexSyncTs = 0;
    /* Recompute max scroll in case layout changed */
    if (_outerEl && _trackEl) {
      _maxScrollY = Math.max(0, _trackEl.offsetHeight - _outerEl.clientHeight);
    }
    const btn = qs('#btn-play-pause');
    if (btn) btn.textContent = '⏸';
    clearIdleReleaseTimer();
    acquireWakeLock();
    _rafId = requestAnimationFrame(_frame);
  }

  function pause() {
    AppState.isPlaying = false;
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    _lastTs = null;
    if (AppState.currentFile) savePosition(AppState.currentFile.id, _index);
    startIdleReleaseTimer();
    const btn = qs('#btn-play-pause');
    if (btn) btn.textContent = '▶';
  }

  function destroy() {
    pause();
    _abortBuild = true;
    /* Move DOM to cache so re-switching to Scroll for the same file is near-instant.
       Event listeners on word spans survive the move — no rebinding needed. */
    const container = qs('#rsvp-container');
    if (container && _cacheFileId && _buildComplete) {
      _domCache = document.createElement('div');
      Array.prototype.slice.call(container.children).forEach(function(child) {
        if (!(child.classList && child.classList.contains('engine-loading'))) {
          _domCache.appendChild(child);
        }
      });
    } else {
      _domCache = null;
    }
    if (!_buildComplete) _domCache = null;
    _spanTops = [];
    _outerEl = null;
    _trackEl = null;
  }

  function getIndex() { return _index; }

  function seekTo(i) {
    _index = Math.max(0, Math.min(_words.length - 1, i));
    const target = qs('[data-index="' + _index + '"].scroll-word');
    if (target && _outerEl) {
      _scrollY = Math.max(0, target.offsetTop - _outerEl.clientHeight / 2);
      _applyTransform();
    }
    if (typeof _syncReaderPosition === 'function') _syncReaderPosition(_index, _words.length);
    if (AppState.currentFile) savePosition(AppState.currentFile.id, _index);
  }

  function onWPMChange() {
    /* No restart needed — pxPerMs is read live from AppState.wpm each frame */
  }

  function hasCache(fileId) {
    return !!(fileId && fileId === _cacheFileId && _domCache && _buildComplete);
  }

  return { init, play, pause, destroy, getIndex, seekTo, onWPMChange, hasCache };
})();
