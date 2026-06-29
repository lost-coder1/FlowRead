/* Page Engine — reflowed, paginated, swipe-driven reading.
   The fifth engine. NOT the existing Normal PDF view (which renders the true PDF page
   and remains the destination for [Table — Tap to View] placeholders and the bridge).
   Page mode renders the same cleaned word stream as the other engines, but as a
   swipeable, fixed-pagination view for users who want a non-speed-reading experience.

   Pagination: DOM-measured word-fill-until-overflow, same pattern as FocusBold.
   Navigation: horizontal swipe + a custom bottom nav bar (first/prev/indicator/next/last).
   Wake lock: acquired on init, released via idle timer on destroy. */

const PageEngine = (function() {
  let _words = [];
  let _index = 0;
  let _pages = [];          /* [{ startIndex, endIndex, el }] */
  let _pageIndex = 0;
  let _navBar = null;
  let _swipeState = null;
  let _swipeTouchHandlers = null;
  let _chromeHideTimer = null;
  let _abortBuild = false;
  let _buildComplete = false;

  /* DOM cache survives engine destroy so re-entry skips re-pagination. */
  let _domCache = null;
  let _cacheKey = null;       /* `${fileId}|${fontPreset}|${fontScale}|${vw}x${vh}` */
  let _cacheFileId = null;    /* used by hasCache() — looser match (file only) */

  /* ── Cache key ───────────────────────────────────────────────── */

  function _currentCacheKey() {
    const fileId = AppState.currentFile && AppState.currentFile.id;
    const preset = (AppState.settings && AppState.settings.fontPreset) || 'roboto';
    const scale = (AppState.settings && AppState.settings.fontScale) || 1;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return fileId + '|' + preset + '|' + scale + '|' + vw + 'x' + vh;
  }

  /* ── Init ────────────────────────────────────────────────────── */

  function init(words, startIndex) {
    _words = words;
    _index = Math.max(0, startIndex || 0);
    _pageIndex = 0;
    _abortBuild = false;
    _buildComplete = false;

    const container = qs('#rsvp-container');
    const key = _currentCacheKey();

    document.body.classList.add('engine-page');
    acquireWakeLock();
    /* Page mode has no play button — start the reader's reading-session timer here
       so streak/heatmap stats include pages read in this mode. The session is
       flushed by reader.js on engine switch, view exit, visibilitychange, etc. */
    if (typeof _onEnginePlay === 'function') _onEnginePlay();

    /* Cache hit: same file + same typography + same viewport — restore DOM */
    if (key === _cacheKey && _domCache && _pages.length > 0) {
      _clearEngineContent(container);
      while (_domCache.firstChild) {
        container.appendChild(_domCache.firstChild);
      }
      _domCache = null;
      _buildComplete = true;
      _pageIndex = _pageForIndex(_index);
      _layoutPages();
      _ensureNavBar();
      _updateNav();
      _attachSwipeListeners();
      _attachChromeToggleListener();
      _removeLoadingSpinner(container);
      _syncReaderPosition(_index, _words.length);
      return;
    }

    _pages = [];
    _domCache = null;
    _cacheKey = key;
    _cacheFileId = AppState.currentFile && AppState.currentFile.id;
    _render();
  }

  function _render() {
    const container = qs('#rsvp-container');
    _clearEngineContent(container);

    const shell = document.createElement('div');
    shell.className = 'page-shell';
    shell.id = 'page-shell';
    shell.style.setProperty('--font-scale', String((AppState.settings && AppState.settings.fontScale) || 1));
    container.appendChild(shell);

    /* Off-screen measurement page — auto-height (NOT absolute inset:0), positioned
       far off-screen. Width set inline so word wrap matches the visible leaves.
       offsetHeight then reflects actual content height (including the leaf's own
       padding), and we compare it against shell.clientHeight to detect overflow. */
    const tempPage = document.createElement('div');
    tempPage.className = 'page-leaf page-leaf-measure';
    shell.appendChild(tempPage);

    /* Allow the browser to apply CSS to the empty shell before we start filling it,
       so shell.clientWidth/clientHeight are accurate. */
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        if (_abortBuild) return;
        tempPage.style.width = shell.clientWidth + 'px';
        _buildPagesFromWords(shell, tempPage, container);
      });
    });
  }

  function _buildPagesFromWords(shell, tempPage, container) {
    const containerH = shell.clientHeight || window.innerHeight;
    /* If layout hasn't settled, fall back to a fixed word count per page rather
       than letting the measurement loop produce one-word pages. */
    if (containerH < 200) {
      tempPage.remove();
      _paginateByWordCount(shell);
      _finalizeBuild(container);
      return;
    }
    /* offsetHeight of the auto-sized tempPage includes its padding (same padding as
       the visible leaves), so overflow happens exactly when offsetHeight > shell height. */
    const usableH = containerH;
    const total = _words.length;
    const CHUNK = 250; /* words per rAF yield — keeps the spinner animating */

    let pageStart = 0;
    let buffer = []; /* spans currently in tempPage */
    let i = 0;

    function flushPage(endIdx) {
      _appendPage(shell, pageStart, endIdx, buffer.slice());
      pageStart = endIdx + 1;
      buffer = [];
      tempPage.innerHTML = '';
    }

    function step() {
      if (_abortBuild) return;
      const end = Math.min(i + CHUNK, total);
      for (; i < end; i++) {
        const span = _makeWordSpan(_words[i], i);
        tempPage.appendChild(span);
        buffer.push(span);

        if (tempPage.offsetHeight > usableH && buffer.length > 1) {
          tempPage.removeChild(span);
          buffer.pop();
          flushPage(i - 1);
          tempPage.appendChild(span);
          buffer.push(span);
        }
      }

      if (typeof _updateEngineLoadingProgress === 'function') {
        _updateEngineLoadingProgress(total ? (i / total) * 95 : 95);
      }

      if (i < total) {
        requestAnimationFrame(step);
      } else {
        if (pageStart < total) flushPage(total - 1);
        tempPage.remove();
        _finalizeBuild(container);
      }
    }

    step();
  }

  function _paginateByWordCount(shell) {
    const wordsPerPage = 180;
    const total = _words.length;
    let i = 0;
    while (i < total) {
      const end = Math.min(i + wordsPerPage, total) - 1;
      const spans = [];
      for (let j = i; j <= end; j++) spans.push(_makeWordSpan(_words[j], j));
      _appendPage(shell, i, end, spans);
      i = end + 1;
    }
  }

  function _finalizeBuild(container) {
    const shell = qs('#page-shell');
    if (_pages.length === 0) {
      _appendPage(shell, 0, Math.max(0, _words.length - 1), []);
    }
    _buildComplete = true;
    _pageIndex = _pageForIndex(_index);
    _layoutPages();
    _ensureNavBar();
    _updateNav();
    _attachSwipeListeners();
    _attachChromeToggleListener();
    if (typeof _updateEngineLoadingProgress === 'function') {
      _updateEngineLoadingProgress(100);
    }
    _removeLoadingSpinner(container);
    _syncReaderPosition(_index, _words.length);
  }

  function _appendPage(shell, startIdx, endIdx, spans) {
    const leaf = document.createElement('div');
    leaf.className = 'page-leaf';
    for (let j = 0; j < spans.length; j++) {
      leaf.appendChild(spans[j]);
    }
    shell.appendChild(leaf);
    _pages.push({ startIndex: startIdx, endIndex: endIdx, el: leaf });
  }

  function _makeWordSpan(word, index) {
    const span = document.createElement('span');
    span.className = 'page-word';
    span.dataset.index = index;

    if (word && typeof word === 'object' && word.type === 'placeholder') {
      span.className += ' page-placeholder';
      span.textContent = word.label || '[Content]';
      (function(w) {
        span.addEventListener('click', function(e) {
          e.stopPropagation();
          openObjectPlaceholder(w);
        });
      })(word);
      span.appendChild(document.createTextNode(' '));
      return span;
    }

    span.textContent = typeof word === 'string' ? word : '';
    span.appendChild(document.createTextNode(' '));
    if (typeof word === 'string' && typeof WordTapFeature !== 'undefined') {
      WordTapFeature.bindWord(span, word);
    }
    return span;
  }

  /* ── Layout (3-slot sliding window) ──────────────────────────── */

  function _layoutPages() {
    /* Three slots: prev (translateX -100%), current (0%), next (+100%).
       Other pages stay parked off-screen at +/- 200%. */
    const w = window.innerWidth;
    for (let i = 0; i < _pages.length; i++) {
      const el = _pages[i].el;
      if (!el) continue;
      const offset = i - _pageIndex;
      if (offset === 0) {
        el.style.transform = 'translateX(0)';
        el.classList.add('page-leaf-current');
      } else if (offset === -1) {
        el.style.transform = 'translateX(-' + w + 'px)';
        el.classList.remove('page-leaf-current');
      } else if (offset === 1) {
        el.style.transform = 'translateX(' + w + 'px)';
        el.classList.remove('page-leaf-current');
      } else {
        /* Hide far pages; keep them in DOM so spans stay alive */
        el.style.transform = 'translateX(' + (offset > 0 ? 2 : -2) * w + 'px)';
        el.classList.remove('page-leaf-current');
      }
    }
  }

  function _pageForIndex(idx) {
    for (let i = 0; i < _pages.length; i++) {
      if (idx >= _pages[i].startIndex && idx <= _pages[i].endIndex) return i;
    }
    return _pages.length > 0 ? _pages.length - 1 : 0;
  }

  function _gotoPage(newIdx, animate) {
    if (newIdx < 0 || newIdx >= _pages.length || newIdx === _pageIndex) {
      /* Still snap back into place if a swipe was cancelled */
      _animateLayout(animate !== false);
      return;
    }
    _pageIndex = newIdx;
    _index = _pages[_pageIndex].startIndex;
    _animateLayout(animate !== false);
    _updateNav();
    if (AppState.currentFile) savePosition(AppState.currentFile.id, _index);
    _syncReaderPosition(_index, _words.length);
  }

  function _animateLayout(animate) {
    const shell = qs('#page-shell');
    if (!shell) return;
    if (animate) shell.classList.add('page-shell-animating');
    else shell.classList.remove('page-shell-animating');
    _layoutPages();
    if (animate) {
      clearTimeout(shell._animClear);
      shell._animClear = setTimeout(function() {
        shell.classList.remove('page-shell-animating');
      }, 280);
    }
  }

  /* ── Swipe gesture ───────────────────────────────────────────── */

  function _attachSwipeListeners() {
    const shell = qs('#page-shell');
    if (!shell) return;
    _detachSwipeListeners(); /* idempotent */

    const onStart = function(e) {
      if (!e.touches || e.touches.length !== 1) return;
      const t = e.touches[0];
      _swipeState = {
        startX: t.clientX,
        startY: t.clientY,
        startTime: Date.now(),
        lastX: t.clientX,
        moved: false,
        cancelled: false,
      };
      shell.classList.remove('page-shell-animating');
    };

    const onMove = function(e) {
      if (!_swipeState || !e.touches || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - _swipeState.startX;
      const dy = t.clientY - _swipeState.startY;

      /* Cancel as a swipe if user moves vertically more than horizontally —
         lets the system back-edge swipe and any future vertical gestures win. */
      if (!_swipeState.moved && Math.abs(dy) > Math.abs(dx) + 8) {
        _swipeState.cancelled = true;
        return;
      }
      if (_swipeState.cancelled) return;
      if (Math.abs(dx) > 6) _swipeState.moved = true;
      _swipeState.lastX = t.clientX;

      /* Drag the slot row by dx, with edge damping at the corpus boundary. */
      const w = window.innerWidth;
      let drag = dx;
      if (_pageIndex === 0 && drag > 0) drag = drag * 0.35; /* pull right at start */
      if (_pageIndex === _pages.length - 1 && drag < 0) drag = drag * 0.35; /* pull left at end */

      const current = _pages[_pageIndex];
      const prev = _pages[_pageIndex - 1];
      const next = _pages[_pageIndex + 1];
      if (current && current.el) current.el.style.transform = 'translateX(' + drag + 'px)';
      if (prev && prev.el) prev.el.style.transform = 'translateX(' + (drag - w) + 'px)';
      if (next && next.el) next.el.style.transform = 'translateX(' + (drag + w) + 'px)';
    };

    const onEnd = function() {
      if (!_swipeState) return;
      const dx = _swipeState.lastX - _swipeState.startX;
      const dt = Math.max(1, Date.now() - _swipeState.startTime);
      const velocity = dx / dt;
      const moved = _swipeState.moved;
      const cancelled = _swipeState.cancelled;
      _swipeState = null;

      if (!moved || cancelled) {
        _animateLayout(true);
        return;
      }

      const w = window.innerWidth;
      const displacementOk = Math.abs(dx) > w * 0.25;
      const velocityOk = Math.abs(velocity) > 0.5;

      if ((displacementOk || velocityOk) && dx < 0 && _pageIndex < _pages.length - 1) {
        _gotoPage(_pageIndex + 1, true);
      } else if ((displacementOk || velocityOk) && dx > 0 && _pageIndex > 0) {
        _gotoPage(_pageIndex - 1, true);
      } else {
        _animateLayout(true);
      }
    };

    shell.addEventListener('touchstart', onStart, { passive: true });
    shell.addEventListener('touchmove', onMove, { passive: true });
    shell.addEventListener('touchend', onEnd, { passive: true });
    shell.addEventListener('touchcancel', onEnd, { passive: true });

    _swipeTouchHandlers = { shell: shell, onStart: onStart, onMove: onMove, onEnd: onEnd };
  }

  function _detachSwipeListeners() {
    if (!_swipeTouchHandlers) return;
    const h = _swipeTouchHandlers;
    if (h.shell) {
      h.shell.removeEventListener('touchstart', h.onStart);
      h.shell.removeEventListener('touchmove', h.onMove);
      h.shell.removeEventListener('touchend', h.onEnd);
      h.shell.removeEventListener('touchcancel', h.onEnd);
    }
    _swipeTouchHandlers = null;
  }

  /* ── Tap-to-toggle chrome ────────────────────────────────────── */

  function _attachChromeToggleListener() {
    const shell = qs('#page-shell');
    if (!shell) return;
    shell.addEventListener('click', _onShellClick);
    /* Auto-hide is reserved for calm mode — otherwise chrome stays visible until
       the user taps to hide. */
    if (_calmModeOn()) _scheduleChromeAutoHide();
  }

  function _calmModeOn() {
    return localStorage.getItem('fr_calm_mode') === 'true';
  }

  function _onShellClick(e) {
    /* Placeholder chips stop propagation themselves; word-tap binding only triggers
       on long-press by default, so plain taps fall through here. */
    if (e.target && e.target.closest && e.target.closest('.page-placeholder')) return;
    /* Chrome toggling is calm-mode only. Outside calm mode, the tabs/nav stay
       visible permanently so users always have one-tap access to mode switching
       and page navigation. */
    if (!_calmModeOn()) return;
    const reader = qs('#view-reader');
    if (!reader) return;
    reader.classList.toggle('page-chrome-hidden');
    _scheduleChromeAutoHide();
  }

  function _scheduleChromeAutoHide() {
    clearTimeout(_chromeHideTimer);
    if (!_calmModeOn()) return;
    _chromeHideTimer = setTimeout(function() {
      const reader = qs('#view-reader');
      if (reader && !reader.classList.contains('page-chrome-hidden')) {
        reader.classList.add('page-chrome-hidden');
      }
    }, 4000);
  }

  /* ── Bottom nav bar ──────────────────────────────────────────── */

  function _ensureNavBar() {
    if (_navBar && document.body.contains(_navBar)) return;
    const view = qs('#view-reader');
    if (!view) return;

    /* If a floating bridge button exists (PDF / URL / IMG), put a labelled
       equivalent in the nav bar that proxies the click — keeps the existing
       handler bindings in reader.js intact. */
    const bridge = _findBridgeButton();
    const bridgeHtml = bridge
      ? '<button class="btn btn-ghost page-nav-btn page-nav-bridge" id="page-nav-bridge" title="' + bridge.title + '">' + bridge.label + '</button>'
      : '<span class="page-nav-bridge-spacer"></span>';

    const bar = document.createElement('div');
    bar.className = 'page-engine-nav';
    bar.id = 'page-engine-nav';
    bar.innerHTML =
      '<button class="btn btn-ghost page-nav-btn" id="page-nav-first" title="First">⏮</button>' +
      '<button class="btn btn-ghost page-nav-btn" id="page-nav-prev" title="Previous">‹</button>' +
      '<span class="page-nav-indicator" id="page-nav-indicator">— / —</span>' +
      '<button class="btn btn-ghost page-nav-btn" id="page-nav-next" title="Next">›</button>' +
      '<button class="btn btn-ghost page-nav-btn" id="page-nav-last" title="Last">⏭</button>' +
      bridgeHtml;
    view.appendChild(bar);
    _navBar = bar;

    qs('#page-nav-first').addEventListener('click', function() { _gotoPage(0, true); });
    qs('#page-nav-prev').addEventListener('click', function() { _gotoPage(_pageIndex - 1, true); });
    qs('#page-nav-next').addEventListener('click', function() { _gotoPage(_pageIndex + 1, true); });
    qs('#page-nav-last').addEventListener('click', function() { _gotoPage(_pages.length - 1, true); });

    const bridgeBtn = qs('#page-nav-bridge');
    if (bridgeBtn && bridge) {
      bridgeBtn.addEventListener('click', function() {
        const target = document.getElementById(bridge.id);
        if (target) target.click();
      });
    }
  }

  /* Pick whichever bridge button is present on this reader instance. */
  function _findBridgeButton() {
    const candidates = [
      { id: 'btn-open-normal',       label: 'PDF', title: 'Open PDF view at current page' },
      { id: 'btn-open-normal-lazy',  label: 'PDF', title: 'Open PDF view at current page' },
      { id: 'btn-open-normal-hint',  label: 'PDF', title: 'Re-import the file to view the original PDF' },
      { id: 'btn-open-source-url',   label: 'URL', title: 'Open source article' },
      { id: 'btn-open-img-viewer',   label: 'IMG', title: 'View original images' },
    ];
    for (let i = 0; i < candidates.length; i++) {
      if (document.getElementById(candidates[i].id)) return candidates[i];
    }
    return null;
  }

  function _updateNav() {
    const ind = qs('#page-nav-indicator');
    if (ind) ind.textContent = (_pageIndex + 1) + ' / ' + Math.max(1, _pages.length);
    const first = qs('#page-nav-first');
    const prev = qs('#page-nav-prev');
    const next = qs('#page-nav-next');
    const last = qs('#page-nav-last');
    const atStart = _pageIndex <= 0;
    const atEnd = _pageIndex >= _pages.length - 1;
    if (first) first.disabled = atStart;
    if (prev) prev.disabled = atStart;
    if (next) next.disabled = atEnd;
    if (last) last.disabled = atEnd;
    const fill = qs('#progress-bar-fill');
    if (fill && _words.length) {
      fill.style.width = ((_index / _words.length) * 100) + '%';
    }
  }

  /* ── Lifecycle ───────────────────────────────────────────────── */

  function _removeLoadingSpinner(container) {
    const spinner = container && container.querySelector('.engine-loading');
    if (spinner) spinner.remove();
  }

  function _clearEngineContent(container) {
    if (!container) return;
    Array.prototype.slice.call(container.children).forEach(function(child) {
      if (!(child.classList && child.classList.contains('engine-loading'))) {
        container.removeChild(child);
      }
    });
  }

  function _removeChrome() {
    document.body.classList.remove('engine-page');
    const reader = qs('#view-reader');
    if (reader) reader.classList.remove('page-chrome-hidden');
    clearTimeout(_chromeHideTimer);
    _chromeHideTimer = null;
    if (_navBar && _navBar.parentNode) _navBar.parentNode.removeChild(_navBar);
    _navBar = null;
  }

  /* ── Public API ──────────────────────────────────────────────── */

  function play() { /* no-op: Page mode has no playback timer */ }

  function pause() {
    if (AppState.currentFile) savePosition(AppState.currentFile.id, _index);
  }

  function destroy() {
    _abortBuild = true;
    _detachSwipeListeners();
    const shell = qs('#page-shell');
    if (shell) shell.removeEventListener('click', _onShellClick);
    _removeChrome();
    startIdleReleaseTimer();

    const container = qs('#rsvp-container');
    if (container && _pages.length > 0 && _buildComplete) {
      _domCache = document.createElement('div');
      Array.prototype.slice.call(container.children).forEach(function(child) {
        if (!(child.classList && child.classList.contains('engine-loading'))) {
          _domCache.appendChild(child);
        }
      });
    } else {
      _domCache = null;
      _pages = [];
      _cacheKey = null;
      _cacheFileId = null;
    }
  }

  function getIndex() { return _index; }

  function seekTo(index) {
    _index = Math.max(0, Math.min(Math.max(0, _words.length - 1), index));
    const target = _pageForIndex(_index);
    if (target !== _pageIndex) {
      _pageIndex = target;
      _index = _pages[_pageIndex].startIndex;
      _animateLayout(false);
      _updateNav();
    } else {
      _updateNav();
    }
    if (AppState.currentFile) savePosition(AppState.currentFile.id, _index);
  }

  function onWPMChange() { /* no-op: Page mode ignores WPM */ }

  function hasCache(fileId) {
    return !!(fileId && fileId === _cacheFileId && _domCache && _pages.length > 0
              && _buildComplete && _cacheKey === _currentCacheKey());
  }

  return { init, play, pause, destroy, getIndex, seekTo, onWPMChange, hasCache };
})();
