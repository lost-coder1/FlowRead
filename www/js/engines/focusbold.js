/* Focus Bold Engine — page-mode bionic reading.
   Full screen of text with the first ~40% of each word bolded.
   Pages are pre-built once on init; playback is pure class-toggling — no DOM writes during playback. */

const FocusBoldEngine = (function() {
  let _words = [];
  let _index = 0;
  let _timerId = null;
  let _pages = [];      /* [{ startIndex, endIndex, el }] */
  let _pageIndex = 0;
  let _allSpans = [];   /* flat array indexed by word index */

  /* DOM cache — keeps built shell alive between engine switches for the same file,
     so re-switching skips the expensive span-creation + layout-measurement phase. */
  let _domCache = null;   /* detached <div> holding the shell when engine is inactive */
  let _cacheFileId = null;
  let _abortBuild = false; /* set true on destroy() to short-circuit in-progress chunked build */

  /* ── Init ─────────────────────────────────────────────────── */

  function init(words, startIndex) {
    _words = words;
    _index = Math.max(0, startIndex || 0);
    _timerId = null;
    _pageIndex = 0;
    _abortBuild = false;

    const fileId = AppState.currentFile && AppState.currentFile.id;
    const container = qs('#rsvp-container');

    /* Cache hit: same file, pages already built — restore DOM and seek */
    if (fileId && fileId === _cacheFileId && _domCache && _pages.length > 0) {
      /* Clear whatever's in the container (previous engine's DOM, or a spinner)
         before re-attaching the cached shell. Otherwise both engines' content
         would coexist and overlap. */
      container.innerHTML = '';
      while (_domCache.firstChild) {
        container.appendChild(_domCache.firstChild);
      }
      _domCache = null;
      _showPage(_pageForIndex(_index));
      _paintCurrent();
      if (typeof _syncReaderPosition === 'function') {
        _syncReaderPosition(_index, _words.length);
      }
      return;
    }

    _pages = [];
    _allSpans = [];
    _domCache = null;
    _cacheFileId = fileId;
    _render();
  }

  function _render() {
    const container = qs('#rsvp-container');

    /* IMPORTANT: do NOT clear the container with innerHTML — that would remove the
       loading spinner set up in reader.js _switchEngine. Append the shell alongside
       the spinner; the spinner overlays it (CSS z-index) until we're ready to show. */
    const shell = document.createElement('div');
    shell.className = 'fb-focus-shell';
    shell.id = 'fb-shell';
    container.appendChild(shell);

    const tempPage = document.createElement('div');
    tempPage.className = 'fb-page fb-page-visible';
    tempPage.style.visibility = 'hidden';
    shell.appendChild(tempPage);

    _allSpans = [];

    /* Chunk the span creation: yield to the browser between batches so the spinner
       animation keeps running. Synchronous creation of 50k+ spans freezes the UI. */
    const CHUNK_SIZE = 4000;
    const total = _words.length;
    let i = 0;

    function buildChunk() {
      if (_abortBuild) return; /* user cancelled / switched engines mid-build */

      const frag = document.createDocumentFragment();
      const end = Math.min(i + CHUNK_SIZE, total);
      for (; i < end; i++) {
        const span = _makeWordSpan(_words[i], i);
        _allSpans.push(span);
        frag.appendChild(span);
      }
      tempPage.appendChild(frag);

      /* Reserve last 10% for pagination phase */
      if (typeof _updateEngineLoadingProgress === 'function') {
        _updateEngineLoadingProgress((i / total) * 90);
      }

      if (i < total) {
        requestAnimationFrame(buildChunk); /* yield — browser paints spinner */
      } else {
        if (typeof _updateEngineLoadingProgress === 'function') {
          _updateEngineLoadingProgress(95);
        }
        /* All spans built. Two rAF for layout settle, then paginate and reveal. */
        requestAnimationFrame(function() {
          if (_abortBuild) return;
          requestAnimationFrame(function() {
            if (_abortBuild) return;
            _paginateFromDOM(tempPage, shell);
            _showPage(_pageForIndex(_index));
            _paintCurrent();
            if (typeof _updateEngineLoadingProgress === 'function') {
              _updateEngineLoadingProgress(100);
            }
            _removeLoadingSpinner(container);
            if (typeof _syncReaderPosition === 'function') {
              _syncReaderPosition(_index, _words.length);
            }
          });
        });
      }
    }

    buildChunk();
  }

  function _removeLoadingSpinner(container) {
    const spinner = container && container.querySelector('.engine-loading');
    if (spinner) spinner.remove();
  }

  function _paginateFromDOM(tempPage, shell) {
    /* clientHeight of the shell (= rsvp-container height) */
    const containerH = (shell.parentElement && shell.parentElement.clientHeight)
      || shell.clientHeight
      || window.innerHeight;

    /* .fb-page has padding var(--space-xl) ≈ 32px top+bottom each → 64px total overhead.
       Use 90% of available height to give a comfortable margin. */
    const usableH = Math.max(80, (containerH - 64) * 0.90);

    /* If layout hasn't settled (clientHeight === 0), fall back to word-count estimate */
    if (containerH < 50) {
      _paginateByWordCount();
      tempPage.remove();
      return;
    }

    /* Snapshot all offsetTop/offsetHeight values BEFORE any spans are moved.
       appendChild() removes a node from its current parent, which would invalidate
       subsequent measurements on spans still in tempPage. */
    const rects = _allSpans.map(function(span) {
      return { top: span.offsetTop, bottom: span.offsetTop + span.offsetHeight };
    });

    let pageStart = 0;
    let pageBaseTop = rects.length > 0 ? rects[0].top : 0;

    for (let i = 0; i < rects.length; i++) {
      const relBottom = rects[i].bottom - pageBaseTop;

      if (relBottom > usableH && i > pageStart) {
        /* Span overflows — end current page at i-1 */
        _buildPage(pageStart, i - 1, shell);
        pageStart = i;
        pageBaseTop = rects[i].top;
      }
    }

    /* Last page */
    if (pageStart < _allSpans.length) {
      _buildPage(pageStart, _allSpans.length - 1, shell);
    }

    tempPage.remove();

    /* Fallback: if pagination produced nothing, one page for all */
    if (_pages.length === 0) {
      _paginateByWordCount();
    }
  }

  /* Reliable fallback: fixed word count per page based on screen height */
  function _paginateByWordCount() {
    const shell = qs('#fb-shell');
    if (!shell) return;
    /* Estimate: ~22px font, 1.85 line-height = ~41px/line, ~8 words/line.
       padding overhead ≈ 64px. */
    const h = window.innerHeight;
    const lines = Math.max(8, Math.floor((h - 64) / 41));
    const wordsPerPage = Math.max(60, lines * 8);

    let i = 0;
    while (i < _allSpans.length) {
      const end = Math.min(i + wordsPerPage, _allSpans.length) - 1;
      _buildPage(i, end, shell);
      i = end + 1;
    }

    if (_pages.length === 0 && _allSpans.length > 0) {
      _buildPage(0, _allSpans.length - 1, shell);
    }
  }

  function _buildPage(startIdx, endIdx, shell) {
    const page = document.createElement('div');
    page.className = 'fb-page';
    for (let j = startIdx; j <= endIdx; j++) {
      page.appendChild(_allSpans[j]);
    }
    shell.appendChild(page);
    _pages.push({ startIndex: startIdx, endIndex: endIdx, el: page });
  }

  function _makeWordSpan(word, index) {
    const span = document.createElement('span');
    span.className = 'fb-word';
    span.dataset.index = index;

    if (typeof word !== 'string') {
      span.className += ' fb-placeholder';
      span.textContent = (word && word.label) || '[Content]';
      span.addEventListener('click', function() { openObjectPlaceholder(word); });
      span.appendChild(document.createTextNode(' '));
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

  /* ── Page navigation ──────────────────────────────────────── */

  function _pageForIndex(idx) {
    for (let i = 0; i < _pages.length; i++) {
      if (idx >= _pages[i].startIndex && idx <= _pages[i].endIndex) return i;
    }
    return _pages.length > 0 ? _pages.length - 1 : 0;
  }

  function _showPage(pageIdx) {
    if (pageIdx < 0 || pageIdx >= _pages.length) return;
    if (_pageIndex !== pageIdx) {
      const oldEl = _pages[_pageIndex] && _pages[_pageIndex].el;
      if (oldEl) oldEl.classList.remove('fb-page-visible');
      _pageIndex = pageIdx;
    }
    const newEl = _pages[_pageIndex] && _pages[_pageIndex].el;
    if (newEl) newEl.classList.add('fb-page-visible');
  }

  /* ── Painting ─────────────────────────────────────────────── */

  function _paintCurrent() {
    const page = _pages[_pageIndex];
    if (!page) return;

    for (let i = page.startIndex; i <= page.endIndex; i++) {
      const span = _allSpans[i];
      if (!span) continue;
      span.classList.toggle('fb-past', i < _index);
      span.classList.toggle('fb-current', i === _index);
    }

    if (typeof _syncReaderPosition === 'function') {
      _syncReaderPosition(_index, _words.length);
    }

    const fill = qs('#progress-bar-fill');
    if (fill && _words.length) {
      fill.style.width = ((_index / _words.length) * 100) + '%';
    }
  }

  /* ── Scheduling ───────────────────────────────────────────── */

  function _schedule() {
    if (!AppState.isPlaying) return;

    _paintCurrent();

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

      /* Page crossfade when we step past the current page boundary */
      const page = _pages[_pageIndex];
      if (page && _index > page.endIndex) {
        /* Mark old page words as past */
        for (let i = page.startIndex; i <= page.endIndex; i++) {
          const s = _allSpans[i];
          if (s) { s.classList.remove('fb-current'); s.classList.add('fb-past'); }
        }
        _showPage(_pageIndex + 1);
      }

      _schedule();
    }, delay);
  }

  function _handleEnd() {
    AppState.isPlaying = false;
    if (AppState.currentFile) savePosition(AppState.currentFile.id, 0);
    showToast('Finished!');
    const btn = qs('#btn-play-pause');
    if (btn) btn.textContent = '▶';
  }

  /* ── Public API ───────────────────────────────────────────── */

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
    if (_timerId) { clearTimeout(_timerId); _timerId = null; }
    if (AppState.currentFile) savePosition(AppState.currentFile.id, _index);
    startIdleReleaseTimer();
    const btn = qs('#btn-play-pause');
    if (btn) btn.textContent = '▶';
  }

  function destroy() {
    pause();
    _abortBuild = true; /* short-circuit any in-progress chunked build */
    /* Move built DOM to cache before the container is overwritten by the next engine.
       Keeps _pages and _allSpans intact so restore skips full rebuild. */
    const container = qs('#rsvp-container');
    if (container && _pages.length > 0 && _cacheFileId) {
      /* Strip fb-page-visible from ALL pages so the cache is in a clean "no page visible"
         state — otherwise the old visible page would still show alongside the new one
         on cache restore, causing text-over-text overlap. */
      for (let i = 0; i < _pages.length; i++) {
        if (_pages[i].el) _pages[i].el.classList.remove('fb-page-visible');
      }
      _domCache = document.createElement('div');
      while (container.firstChild) {
        _domCache.appendChild(container.firstChild);
      }
    } else {
      _domCache = null;
      _pages = [];
      _allSpans = [];
    }
  }

  function getIndex() { return _index; }

  function seekTo(index) {
    _index = Math.max(0, Math.min(_words.length - 1, index));
    const targetPage = _pageForIndex(_index);
    if (targetPage !== _pageIndex) {
      _showPage(targetPage);
    }
    _paintCurrent();
    if (AppState.currentFile) savePosition(AppState.currentFile.id, _index);
  }

  function onWPMChange() {
    if (!AppState.isPlaying) return;
    if (_timerId) { clearTimeout(_timerId); _timerId = null; }
    _schedule();
  }

  function hasCache(fileId) {
    return !!(fileId && fileId === _cacheFileId && _domCache && _pages.length > 0);
  }

  return { init, play, pause, destroy, getIndex, seekTo, onWPMChange, hasCache };
})();
