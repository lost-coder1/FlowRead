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

  /* Page boundaries survive engine destroy so re-entry skips re-measurement, and
     are persisted by storage.js so a later launch skips it too. The leaves do NOT
     survive: they are rebuilt from _words on demand (_ensureLeaf), because a leaf
     costs four event listeners per word and most of a book is never looked at. */
  let _cacheKey = null;       /* `${fileId}|${fontPreset}|${fontScale}|${vw}x${vh}` */
  let _leafLru = [];          /* page indices holding a live .el, oldest first */
  const LEAF_LRU_MAX = 5;

  /* Word indices where a paragraph begins (features/paragraphs.js). Null until
     init resolves it for the current file. */
  let _paraStarts = null;

  /* Chapter headings as word ranges — [{ start, end, depth }], end exclusive,
     disjoint and sorted by start, so _headingAt can binary-search them. Built
     from AppState.chapters, which features/chapter-detection.js derives from the
     same paragraph boundaries _paraStarts holds (§6.2). */
  let _headings = [];

  /* False while a background pass is still measuring. The grid on screen is then
     real but incomplete, so the page numbers next to it are estimates. */
  let _pagesExact = true;

  /* Completion is derived from the saved position — `loadPosition(id) >=
     item.wordCount` is what isFileFullyRead() asks (views/upload.js) — so
     reaching the end of a book has to be expressed as a position, which is what
     RSVP's _handleEnd already does by saving _words.length. Page mode had no
     equivalent, so a reader who turned to the last page was left marking the
     book read by hand.

     _index stays the honest word the reader is on, because the §7 bridge reads
     it; this is the floor every save is lifted to while the last page is open.
     Turning away from the last page clears it, so the position is the position
     again — the same way seeking backwards after finishing in RSVP does. */
  let _endFloor = 0;
  let _finishOffer = null;

  /* A fresh open must not mark a book read merely because it resumed on the last
     page. Only a deliberate turn to the end counts. */
  let _turnedThisSession = false;
  let _estWordsPerPage = 0;

  /* Measurement tuning. A slab is laid out in one pass and read with offsetTop;
     the budget keeps the frame responsive without making the frame count itself
     the bottleneck, which is what a fixed words-per-frame chunk did. */
  const SLAB_WORDS = 3000;
  const FRAME_BUDGET_MS = 12;

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
    _endFloor = 0;
    _turnedThisSession = false;
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

    /* Same file, same typography, same viewport — the boundaries from the last
       visit still describe this screen, so there is nothing to measure. Either
       they are still in memory, or storage.js has them from an earlier launch. */
    const reusable = (key === _cacheKey && _buildComplete && _pagesExact && _pages.length > 0)
      ? _pages.map(function(p) { return p.startIndex; })
      : loadPageLayout(key, _words.length);

    /* Resolve before any measuring: paragraph breaks change where pages end, so
       a grid measured without them does not describe this layout. */
    _paraStarts = (typeof ParagraphStructure !== 'undefined')
      ? ParagraphStructure.startsFor(AppState.currentFile)
      : null;
    _headings = _buildHeadings();

    _pages = [];
    _leafLru = [];
    _pagesExact = true;
    _estWordsPerPage = 0;
    _cacheKey = key;

    if (reusable && reusable.length > 0) {
      _createShell(container);
      _adoptStarts(reusable);
      _finalizeBuild(container, false);
      return;
    }
    _render(container);
  }

  /* Turn a boundary list back into pages. Only the first word of each page is
     stored, so the end of one is the word before the start of the next. */
  function _adoptStarts(starts) {
    const total = _words.length;
    for (let i = 0; i < starts.length; i++) {
      const start = starts[i];
      const end = (i + 1 < starts.length ? starts[i + 1] - 1 : total - 1);
      if (start > end || start < 0 || end >= total) continue;
      _pages.push({ startIndex: start, endIndex: end, el: null });
    }
  }

  let _highlightTapHandler = null;

  function _createShell(container) {
    _clearEngineContent(container);
    /* The previous shell carried the capture listener and has just been removed
       with it, so the guard in _attachHighlightTapListener has to be cleared or
       the new shell never gets one. */
    _highlightTapHandler = null;
    const shell = document.createElement('div');
    shell.className = 'page-shell';
    shell.id = 'page-shell';
    shell.style.setProperty('--font-scale', String((AppState.settings && AppState.settings.fontScale) || 1));
    container.appendChild(shell);
    return shell;
  }

  function _render(container) {
    const shell = _createShell(container);

    /* The nav bar goes up before anything is measured, not after. It is an
       ordinary flex item (engines.css: .page-engine-nav, flex-shrink 0, no
       positioning), so adding it shrinks the shell by its own height — measure
       first and every page is sized for a stage ~65px taller than the one it
       will be rendered into, and the text creeps into the strip the bar is
       supposed to have to itself. It also means the §7 bridge button on the bar
       is there from the first frame rather than only once pagination ends. */
    _ensureNavBar();
    _updateNav();
    _attachHighlightTapListener();

    /* Off-screen measurement page — auto-height (NOT absolute inset:0), positioned
       far off-screen. Width set inline so word wrap matches the visible leaves.
       Auto height is what lets a whole slab lay out at once, and the page breaks
       are then read off each word's offsetTop against the shell's content box. */
    const tempPage = document.createElement('div');
    tempPage.className = 'page-leaf page-leaf-measure';
    shell.appendChild(tempPage);

    /* Allow the browser to apply CSS to the empty shell before we start filling it,
       so shell.clientWidth/clientHeight are accurate. */
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        if (_abortBuild) return;
        tempPage.style.width = shell.clientWidth + 'px';
        _measurePages(shell, tempPage, container);
      });
    });
  }

  /* Pagination measures in slabs, not word by word.

     The old loop appended one span and then read tempPage.offsetHeight, which
     forces a synchronous layout — per word, on a container that grows as the page
     fills. That is what made opening a book scale with its length. Here a slab of
     ~3000 words is written in a single innerHTML assignment, laid out once, and
     then read with offsetTop, which is free as long as nothing mutates the DOM
     in between. Same pattern as FocusBold's _paginateFromDOM, but slab by slab so
     the whole corpus is never in the document at once. */
  function _measurePages(shell, tempPage, container) {
    const containerH = shell.clientHeight || window.innerHeight;
    /* If layout hasn't settled, fall back to a fixed word count per page rather
       than letting the measurement loop produce one-word pages. */
    if (containerH < 200) {
      tempPage.remove();
      _paginateByWordCount();
      _finalizeBuild(container, false);
      return;
    }

    /* The measure leaf carries the same padding as a visible leaf, and offsetTop
       is read from the padding edge, so the content box is what has to fit. */
    const cs = window.getComputedStyle(tempPage);
    const padT = parseFloat(cs.paddingTop) || 0;
    const padB = parseFloat(cs.paddingBottom) || 0;
    const lineH = parseFloat(cs.lineHeight) || ((parseFloat(cs.fontSize) || 17) * 1.7);
    const ctx = {
      temp: tempPage,
      usableH: Math.max(lineH, containerH - padT - padB),
      lineH: lineH,
    };
    const total = _words.length;

    /* Phase A — measure one slab starting where the reader actually is, and paint
       that. First paint then costs the same on a forty-page pamphlet and on War
       and Peace, because it no longer depends on what comes before or after. */
    const anchor = Math.max(0, Math.min(_index, Math.max(0, total - 1)));
    _runMeasure(ctx, _pages, anchor, SLAB_WORDS, 0);
    _estWordsPerPage = _averageWordsPerPage();
    /* Exact already if that one slab happened to be the whole book — a short
       article, or an empty one, needs no second pass. */
    _pagesExact = total === 0 || (_pages.length > 0
      && _pages[0].startIndex === 0
      && _pages[_pages.length - 1].endIndex >= total - 1);

    _finalizeBuild(container, _pagesExact);

    if (_pagesExact) {
      tempPage.remove();
      return;
    }
    _startBackgroundPass(ctx, anchor);
  }

  /* Phase B — the grid for the whole book, measured across idle frames while the
     user reads. Anchored at word 0 the visible array simply grows; anchored
     anywhere else the pages on screen started mid-book and so cannot be numbered,
     and a grid measured from word 0 replaces them once it is complete. */
  function _startBackgroundPass(ctx, anchor) {
    const total = _words.length;
    const fromZero = anchor > 0;
    const out = fromZero ? [] : _pages;
    let cursor = fromZero
      ? 0
      : (_pages.length > 0 ? _pages[_pages.length - 1].endIndex + 1 : 0);

    function step() {
      if (_abortBuild) return;
      cursor = _runMeasure(ctx, out, cursor, Infinity, FRAME_BUDGET_MS);

      if (cursor < total) {
        if (!fromZero) {
          /* The visible grid grew: the estimate and the end-of-book state move
             with it, so the nav bar has to follow. */
          _estWordsPerPage = _averageWordsPerPage();
          _updateNav();
        }
        requestAnimationFrame(step);
        return;
      }

      if (fromZero) _swapInGrid(out);
      _pagesExact = true;
      _estWordsPerPage = _averageWordsPerPage();
      _layoutPages();
      _updateNav();
      ctx.temp.remove();
      _persistLayout();
    }

    requestAnimationFrame(step);
  }

  /* Put the canonical grid in place without moving the reader: _index is the
     position and the page number is derived from it, never the other way round
     (§21 — reading position is sacred). */
  function _swapInGrid(pages) {
    for (let i = 0; i < _pages.length; i++) _releaseLeaf(i);
    _leafLru = [];
    _pages = pages;
    _pageIndex = _pageForIndex(_index);
  }

  /* Measure forward from `from`, appending pages to `out`, stopping after
     `limitWords` have been covered or the frame budget has run out — whichever
     comes first. Returns the word the next call should resume from, which is
     always the start of a page, so a resumed pass never splits one. */
  function _runMeasure(ctx, out, from, limitWords, budgetMs) {
    const started = Date.now();
    const total = _words.length;
    const stopAt = Math.min(total, from + limitWords);
    let cursor = from;
    let slab = SLAB_WORDS;

    /* Time-budgeted rather than fixed-size: a fast device gets through several
       slabs in one frame instead of being held to one slab per frame. */
    while (cursor < total && cursor < stopAt
           && (!budgetMs || Date.now() - started < budgetMs)) {
      const end = Math.min(cursor + slab, total);
      const breaks = _measureSlab(ctx.temp, cursor, end, ctx.usableH, ctx.lineH);

      if (breaks.length === 0) {
        if (end >= total) {
          out.push({ startIndex: cursor, endIndex: total - 1, el: null });
          cursor = total;
        } else {
          /* A whole slab fitted on one page — a large screen with a small font
             can do this. Widen rather than emit a page we haven't seen the end of. */
          slab = slab * 2;
        }
        continue;
      }

      for (let i = 0; i < breaks.length; i++) {
        out.push({ startIndex: cursor, endIndex: breaks[i] - 1, el: null });
        cursor = breaks[i];
      }
      slab = SLAB_WORDS;
      /* Whatever follows the last break is not a full page yet, so it carries
         into the next slab — which is why cursor lands on it, not past it. */
      if (end >= total && cursor < total) {
        out.push({ startIndex: cursor, endIndex: total - 1, el: null });
        cursor = total;
      }
    }
    return cursor;
  }

  function _averageWordsPerPage() {
    if (_pages.length === 0) return 0;
    const covered = _pages[_pages.length - 1].endIndex - _pages[0].startIndex + 1;
    return covered / _pages.length;
  }

  /* The markup for a run of words — the single source of truth for what a page
     looks like. Measurement and the visible leaves both go through here, because
     the moment they build their own markup they can disagree about where a page
     ends, and then pages overflow or come up short.

     Interactivity is deliberately not in here: it is bound onto the spans
     afterwards by _bindLeaf, so measurement pays nothing for listeners it is
     going to throw away. Exactly one .page-word per word, so that binding can
     match spans to words by position. */
  function _wordsHtml(from, to) {
    const html = [];
    let openHeading = null;

    /* Read once per slab rather than per word: this runs for every measured
       slab as well as every visible leaf (§4.1 rule 4), and localStorage is not
       free. A tint is background only, so it adds no height and the cached
       layout grid stays valid — highlighting a page must never reflow it. */
    const marks = (typeof HighlightsFeature !== 'undefined' && _fileId())
      ? HighlightsFeature.forFile(_fileId())
      : [];

    for (let i = from; i < to; i++) {
      const w = _words[i];
      const heading = _headingAt(i);
      const marked = marks.length
        ? !!HighlightsFeature.at(marks, i)
        : false;
      const anchored = (typeof HighlightsFeature !== 'undefined')
        && HighlightsFeature.active() && HighlightsFeature.anchor() === i;

      /* A range can open or close mid-slab, because a slab boundary has nothing
         to do with where a chapter starts. Reopening the wrapper is what keeps a
         heading that straddles the boundary looking like one heading. */
      if (heading !== openHeading) {
        if (openHeading) html.push('</b>');
        if (heading) html.push('<b class="page-heading page-h' + heading.depth + '">');
        openHeading = heading;
      }

      /* A heading is already a block and sets its own spacing, so it takes
         neither the paragraph break nor the first-line indent — indenting a
         heading is exactly what a printed book does not do. */
      if (!heading && _paraStarts && _paraStarts.has(i)) {
        /* A zero-height block splits the inline flow onto a new line without
           adding vertical space; the indent on the first word is what marks the
           paragraph, the way a printed book does. */
        html.push('<b class="page-pb"></b>');
      }
      const indent = (!heading && _paraStarts && _paraStarts.has(i)) ? ' page-para-first' : '';
      const mark = (marked ? ' fr-hl' : '') + (anchored ? ' fr-hl-anchor' : '');
      if (w && typeof w === 'object' && w.type === 'placeholder') {
        html.push('<span class="page-word page-placeholder' + indent + mark + '">' + escapeHtml(w.label || '[Content]') + ' </span>');
      } else {
        html.push('<span class="page-word' + indent + mark + '">' + escapeHtml(typeof w === 'string' ? w : '') + ' </span>');
      }
    }
    if (openHeading) html.push('</b>');
    return html.join('');
  }

  /* A heading occupies a whole paragraph, so its word range runs from the
     chapter's wordIndex to the next paragraph start. The detector's title is the
     joined paragraph text, so its word count is the same span — it is the
     fallback for a file with no paragraph information at all. */
  function _buildHeadings() {
    const chapters = (AppState && AppState.chapters) || [];
    if (!chapters.length) return [];

    const paraStarts = _paraStarts ? Array.from(_paraStarts).sort(function(a, b) { return a - b; }) : [];
    const ranges = [];

    for (let i = 0; i < chapters.length; i++) {
      const start = chapters[i].wordIndex;
      if (typeof start !== 'number' || start < 0 || start >= _words.length) continue;

      const titleWords = String(chapters[i].title || '').split(/\s+/).filter(Boolean).length;
      let end = _nextAbove(paraStarts, start);
      if (end === -1) end = titleWords ? start + titleWords : start + 1;

      end = Math.min(end, _words.length);
      if (end <= start) continue;

      /* Disjoint by construction, but a malformed chapter list must not produce
         overlapping ranges — _wordsHtml would emit unbalanced markup. */
      const prev = ranges[ranges.length - 1];
      if (prev && start < prev.end) continue;

      ranges.push({ start: start, end: end, depth: chapters[i].depth || 2 });
    }
    return ranges;
  }

  function _nextAbove(sorted, value) {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] <= value) lo = mid + 1;
      else hi = mid;
    }
    return lo < sorted.length ? sorted[lo] : -1;
  }

  /* The heading range containing this word index, or null. */
  function _headingAt(index) {
    let lo = 0;
    let hi = _headings.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const h = _headings[mid];
      if (index < h.start) hi = mid - 1;
      else if (index >= h.end) lo = mid + 1;
      else return h;
    }
    return null;
  }

  /* Lay out one slab and return the word indices a page must break at. */
  function _measureSlab(tempPage, from, to, usableH, lineH) {
    tempPage.innerHTML = _wordsHtml(from, to);

    /* Word spans only — the paragraph breaks are not words and must not be
       counted as ones, or the break indices would be off by however many
       paragraphs the slab contains. */
    const spans = tempPage.querySelectorAll('.page-word');
    const breaks = [];
    if (spans.length === 0) return breaks;

    /* This first read is the one forced layout for the whole slab. Every read
       after it is served from clean layout, because nothing below mutates. */
    let baseTop = spans[0].offsetTop;
    let pageStart = 0;

    for (let i = 0; i < spans.length; i++) {
      const top = spans[i].offsetTop;
      /* offsetHeight of an inline span is its font box, which is shorter than the
         line it sits on — so the line height is the floor. A placeholder chip can
         be taller than a line, and then its own height is what matters. */
      const h = Math.max(lineH, spans[i].offsetHeight);
      if (top - baseTop + h > usableH && i > pageStart) {
        let breakWord = _pullBackOrphanHeading(from + i, from + pageStart, from);
        breaks.push(breakWord);
        pageStart = breakWord - from;
        baseTop = spans[pageStart].offsetTop;
      }
    }

    tempPage.innerHTML = '';
    return breaks;
  }

  /* A heading stranded at the foot of a page, with the text it introduces
     overleaf, is the one thing worse than no heading styling at all — so when a
     page would end inside a heading, or on its last word with no body text
     after it, the whole heading moves to the next page instead.

     Only ever backwards, never past the start of the page being closed, so the
     page cannot come out empty and the caller's loop still terminates: the next
     break can no longer be pulled to the same heading. */
  function _pullBackOrphanHeading(breakWord, pageFirstWord, slabFirstWord) {
    const heading = _headingAt(breakWord - 1);
    if (!heading) return breakWord;
    /* Fully on the page with body text after it — nothing to fix. */
    if (heading.end < breakWord) return breakWord;
    if (heading.start <= pageFirstWord || heading.start <= slabFirstWord) return breakWord;
    return heading.start;
  }

  function _paginateByWordCount() {
    const wordsPerPage = 180;
    const total = _words.length;
    for (let i = 0; i < total; i += wordsPerPage) {
      _pages.push({ startIndex: i, endIndex: Math.min(i + wordsPerPage, total) - 1, el: null });
    }
  }

  function _finalizeBuild(container, measured) {
    if (_pages.length === 0) {
      _pages.push({ startIndex: 0, endIndex: Math.max(0, _words.length - 1), el: null });
    }
    _buildComplete = true;
    /* Nav bar before layout: it is a flex item, so raising it shrinks the shell,
       and laying leaves out first would make them reflow the moment it appears. */
    _ensureNavBar();
    /* Also here, not only in _render: a cached layout (§4.1) skips _render
       entirely, and without this the engine would open with no way to highlight. */
    _attachHighlightTapListener();
    _pageIndex = _pageForIndex(_index);
    _layoutPages();
    _updateNav();
    /* A reader who swiped to the end while the grid was still estimating was on
       the last page of a slab, not of the book, so _noteEndReached refused then.
       Now that the grid is real, the same question has a real answer. */
    if (measured && _turnedThisSession) _noteEndReached();
    _attachSwipeListeners();
    _attachChromeToggleListener();
    if (typeof _updateEngineLoadingProgress === 'function') {
      _updateEngineLoadingProgress(100);
    }
    _removeLoadingSpinner(container);
    _syncReaderPosition(_index, _words.length);
    if (measured) _persistLayout();
  }

  function _persistLayout() {
    if (!_cacheKey || _pages.length === 0) return;
    /* Only a grid covering the whole book is worth storing — a partial one would
       be restored as though it were complete. */
    if (_pages[0].startIndex !== 0) return;
    if (_pages[_pages.length - 1].endIndex < _words.length - 1) return;
    const starts = [];
    for (let i = 0; i < _pages.length; i++) starts.push(_pages[i].startIndex);
    savePageLayout(_cacheKey, starts, _words.length);
  }

  /* ── Leaves, built on demand ─────────────────────────────────── */

  /* A leaf costs a span and four word-tap listeners per word (word-tap.js), so
     building every page of a book up front was most of the cold-start cost and
     all of its memory. Only the pages inside the slide window exist as DOM; the
     rest are a pair of word indices until the user comes near them. */
  function _ensureLeaf(i) {
    const page = _pages[i];
    if (!page) return null;
    if (page.el) { _touchLeaf(i); return page.el; }

    const shell = qs('#page-shell');
    if (!shell) return null;

    const leaf = document.createElement('div');
    leaf.className = 'page-leaf';
    leaf.innerHTML = _wordsHtml(page.startIndex, page.endIndex + 1);
    _bindLeaf(leaf, page.startIndex);
    /* Park it off-screen until _layoutPages places it, so a leaf built mid-swipe
       never flashes over the page being read. */
    leaf.style.transform = 'translateX(' + (2 * window.innerWidth) + 'px)';
    shell.appendChild(leaf);
    page.el = leaf;

    _touchLeaf(i);
    return leaf;
  }

  function _touchLeaf(i) {
    const at = _leafLru.indexOf(i);
    if (at !== -1) _leafLru.splice(at, 1);
    _leafLru.push(i);
    _evictLeaves();
  }

  function _evictLeaves() {
    /* The window is three pages and the cap is five, so the guard can only be hit
       by a corrupt list — but an unbounded loop here would hang the reader. */
    let guard = _leafLru.length + 1;
    while (_leafLru.length > LEAF_LRU_MAX && guard-- > 0) {
      const victim = _leafLru.shift();
      if (Math.abs(victim - _pageIndex) <= 1) { _leafLru.push(victim); continue; }
      _releaseLeaf(victim);
    }
  }

  function _releaseLeaf(i) {
    const page = _pages[i];
    const at = _leafLru.indexOf(i);
    if (at !== -1) _leafLru.splice(at, 1);
    if (!page || !page.el) return;
    if (page.el.parentNode) page.el.parentNode.removeChild(page.el);
    page.el = null;
  }

  function _fileId() {
    return (AppState && AppState.currentFile && AppState.currentFile.id) || '';
  }

  /* ── Highlighting (§26.3) ──────────────────────────────────────────────
     Tap the first word, tap the last. Bound once on the shell in the capture
     phase rather than per word, for two reasons: it has to beat both the
     word-tap dictionary binding and the chrome toggle underneath, and a leaf
     released by the LRU must not take the handler with it.

     Swipe is deliberately left alone — a quote routinely straddles a page
     break, so the reader must be able to turn the page between the two taps,
     and the anchor is a word index that no longer cares which page it is on. */
  function _attachHighlightTapListener() {
    const shell = qs('#page-shell');
    if (!shell || _highlightTapHandler) return;

    _highlightTapHandler = function(e) {
      if (typeof HighlightsFeature === 'undefined' || !HighlightsFeature.active()) return;
      const span = e.target && e.target.closest && e.target.closest('.page-word');
      if (!span) return;

      /* Nothing else may act on this tap: not the dictionary, not the chrome. */
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

      const index = _wordIndexOfSpan(span);
      if (index < 0) return;
      HighlightsFeature.tapWord(index);
    };

    shell.addEventListener('click', _highlightTapHandler, true);
  }

  /* The leaf's own start index plus the span's position inside it — the same
     one-span-per-word correspondence _bindLeaf relies on. A linear scan over
     one page's words, on a tap, which is nothing. */
  function _wordIndexOfSpan(span) {
    const leaf = span.closest('.page-leaf');
    if (!leaf) return -1;
    let start = -1;
    for (let i = 0; i < _pages.length; i++) {
      if (_pages[i].el === leaf) { start = _pages[i].startIndex; break; }
    }
    if (start < 0) return -1;
    const spans = leaf.querySelectorAll('.page-word');
    for (let n = 0; n < spans.length; n++) {
      if (spans[n] === span) return start + n;
    }
    return -1;
  }

  /* Repaint the live leaves after a highlight is made, removed or anchored.
     Only the markup changes — the page boundaries are untouched, because a tint
     has no height (§4.1) — so this rebuilds each leaf's HTML in place and does
     not re-measure or re-lay out anything. */
  function refreshHighlights() {
    for (let i = 0; i < _pages.length; i++) {
      const page = _pages[i];
      if (!page || !page.el) continue;
      page.el.innerHTML = _wordsHtml(page.startIndex, page.endIndex + 1);
      _bindLeaf(page.el, page.startIndex);
    }
  }

  /* Word tap, long-press dictionary and placeholder chips, bound onto the markup
     _wordsHtml produced. Spans map to words by position — _wordsHtml emits
     exactly one .page-word per word — which is why the paragraph breaks it also
     emits carry a different element and class. */
  function _bindLeaf(leaf, startIndex) {
    const spans = leaf.querySelectorAll('.page-word');
    for (let n = 0; n < spans.length; n++) {
      const word = _words[startIndex + n];
      const span = spans[n];

      if (word && typeof word === 'object' && word.type === 'placeholder') {
        (function(w) {
          span.addEventListener('click', function(e) {
            e.stopPropagation();
            openObjectPlaceholder(w);
          });
        })(word);
        continue;
      }
      if (typeof word === 'string' && typeof WordTapFeature !== 'undefined') {
        WordTapFeature.bindWord(span, word);
      }
    }
  }

  /* ── Layout (3-slot sliding window) ──────────────────────────── */

  function _layoutPages() {
    /* Three slots: prev (translateX -100%), current (0%), next (+100%).
       Those three are also the only pages that exist as DOM — anything the user
       cannot see or reach with one swipe is released (_evictLeaves). */
    const w = window.innerWidth;
    _ensureLeaf(_pageIndex - 1);
    _ensureLeaf(_pageIndex + 1);
    _ensureLeaf(_pageIndex);   /* last, so the current page is the newest in the LRU */

    const live = _leafLru.slice();
    for (let n = 0; n < live.length; n++) {
      const i = live[n];
      const el = _pages[i] && _pages[i].el;
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
        /* Still held by the LRU but outside the window — park it off-screen. */
        el.style.transform = 'translateX(' + (offset > 0 ? 2 : -2) * w + 'px)';
        el.classList.remove('page-leaf-current');
      }
    }
  }

  /* Every save in this engine goes through here, so the completion floor cannot
     be undone by whichever of pause/seek/turn happens to fire last. */
  function _savePos() {
    if (!AppState.currentFile) return;
    savePosition(AppState.currentFile.id, Math.max(_index, _endFloor));
  }

  /* The last page of the whole book — not merely the last page measured so far.
     During the background pass _pages covers one slab, and its final entry is
     nowhere near the end (§5.1 rule 3), so without _pagesExact this would
     declare a book finished a few pages into it. */
  function _atLastPage() {
    return _pagesExact && _buildComplete && _pages.length > 0
      && _pageIndex === _pages.length - 1;
  }

  function _noteEndReached() {
    if (!_atLastPage()) { _endFloor = 0; _removeFinishOffer(); return; }
    if (_endFloor) return;                /* already marked, don't re-toast */
    _endFloor = _words.length;
    _savePos();
    showToast(t('reader.page.finished'));
    _showFinishOffer();
  }

  /* The share offer for a finished book, as a tappable line rather than a modal
     (owner, 2026-11-20). Every other engine asks outright at `_handleEnd()`,
     because playback running past the last word proves every word was on
     screen. Page mode has no such proof: the reader has *arrived* at the last
     page and how long it takes them to read it is unknowable, so a modal here
     would land on top of the page they are still reading. An offer they reach
     when they are actually done costs nothing if ignored.

     Positioned absolutely over the stage, never added to the flow — anything
     occupying vertical space changes what fits on a page, which would mean a
     layout-version bump (§5.1) and, worse, a book whose last page reflows the
     moment it is reached. */
  function _showFinishOffer() {
    if (_finishOffer) return;
    const file = AppState.currentFile;
    if (!file || typeof ShareStats === 'undefined') return;
    if (!ShareStats.shouldOfferBookFinished(file.id)) return;

    const shell = qs('#page-shell');
    if (!shell || !shell.parentNode) return;

    const bar = document.createElement('div');
    bar.className = 'page-finish-offer';
    bar.innerHTML =
      '<button class="page-finish-share" type="button">' + t('reader.page.share_finish') + '</button>' +
      '<button class="page-finish-dismiss" type="button" aria-label="' + escapeHtml(t('btn.not_now')) + '">×</button>';

    bar.querySelector('.page-finish-share').addEventListener('click', function() {
      _removeFinishOffer();
      ShareStats.openSheetForBook(file.id);
    });
    /* Dismissing retires the offer for this read only. It is not marked
       celebrated: home's own check is the backstop, and silently spending the
       one offer because the user tidied the screen would be the §1.5 failure. */
    bar.querySelector('.page-finish-dismiss').addEventListener('click', _removeFinishOffer);

    shell.parentNode.appendChild(bar);
    _finishOffer = bar;
  }

  function _removeFinishOffer() {
    if (_finishOffer && _finishOffer.parentNode) _finishOffer.parentNode.removeChild(_finishOffer);
    _finishOffer = null;
  }

  function _pageForIndex(idx) {
    if (_pages.length === 0) return 0;
    /* Binary search, not a scan: a long book is thousands of pages and this runs
       on every seek and every position sync. */
    let lo = 0;
    let hi = _pages.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (idx < _pages[mid].startIndex) hi = mid - 1;
      else if (idx > _pages[mid].endIndex) lo = mid + 1;
      else return mid;
    }
    return Math.max(0, Math.min(_pages.length - 1, lo));
  }

  function _gotoPage(newIdx, animate) {
    if (newIdx < 0 || newIdx >= _pages.length || newIdx === _pageIndex) {
      /* Still snap back into place if a swipe was cancelled */
      _animateLayout(animate !== false);
      return;
    }
    const fromIdx = _pageIndex;
    _pageIndex = newIdx;
    _index = _pages[_pageIndex].startIndex;
    _animateLayout(animate !== false);
    _updateNav();
    _turnedThisSession = true;
    /* Before the save, so the floor it sets is the value written. */
    _noteEndReached();
    _savePos();
    _syncReaderPosition(_index, _words.length);
    /* Page mode is where a nudged read happens (§9.5), and it has no completion
       event, so the scoped-unlock counter rides on the page turn itself. Both
       pages travel, because only this function knows which way the reader went
       — and the nudge counter must not credit a backward turn or a jump. The
       page numbers themselves are not durable (the background measure pass
       renumbers them, §5.1 rule 3), so the pair is read as a delta here and
       never stored. */
    if (typeof NudgeFeature !== 'undefined') NudgeFeature.onPageTurn(_pageIndex, fromIdx);
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
    if (ind) {
      if (_pagesExact) {
        ind.textContent = (_pageIndex + 1) + ' / ' + Math.max(1, _pages.length);
      } else {
        /* Still measuring, so both numbers come from the words-per-page seen so
           far. The tildes say they are estimates rather than letting a guess pass
           for a count (§1.5); they disappear when the real grid lands. */
        const avg = _estWordsPerPage || 180;
        const cur = Math.max(1, Math.round(_index / avg) + 1);
        ind.textContent = '~' + cur + ' / ~' + Math.max(cur, Math.ceil(_words.length / avg));
      }
    }
    const first = qs('#page-nav-first');
    const prev = qs('#page-nav-prev');
    const next = qs('#page-nav-next');
    const last = qs('#page-nav-last');
    /* While a grid anchored mid-book is on screen, the pages before the anchor do
       not exist yet, and the last page is not known until the pass finishes. Both
       buttons come back a moment later rather than jumping somewhere wrong. */
    const haveBookStart = _pages.length > 0 && _pages[0].startIndex === 0;
    const atStart = _pageIndex <= 0;
    const atLastBuilt = _pageIndex >= _pages.length - 1;
    if (first) first.disabled = atStart || !haveBookStart;
    if (prev) prev.disabled = atStart;
    if (next) next.disabled = atLastBuilt;
    if (last) last.disabled = !_pagesExact || atLastBuilt;
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
    _removeFinishOffer();
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
    _savePos();
  }

  function destroy() {
    _abortBuild = true;
    _detachSwipeListeners();
    const shell = qs('#page-shell');
    if (shell) shell.removeEventListener('click', _onShellClick);
    _removeChrome();
    startIdleReleaseTimer();

    /* Drop the leaves and their per-word listeners, but keep the boundaries:
       re-entry then rebuilds three leaves instead of re-measuring the book. A
       build that never finished is kept too — _persistLayout is what decides
       whether a grid is complete enough to store. */
    for (let i = 0; i < _pages.length; i++) _pages[i].el = null;
    _leafLru = [];
    _clearEngineContent(qs('#rsvp-container'));
    if (!_buildComplete) {
      _pages = [];
      _cacheKey = null;
    }
  }

  function getIndex() { return _index; }

  function seekTo(index) {
    _index = Math.max(0, Math.min(Math.max(0, _words.length - 1), index));
    /* Keep the exact word. Snapping _index to the page start used to round a
       bridge round-trip (§7) back to the top of the page the user came from. Only
       an explicit page turn moves the position, and that is _gotoPage's job. */
    const target = _pageForIndex(_index);
    if (target !== _pageIndex) {
      _pageIndex = target;
      _animateLayout(false);
    }
    _updateNav();
    _savePos();
  }

  function onWPMChange() { /* no-op: Page mode ignores WPM */ }

  /* Diagnostics seam. Everything that makes Page mode correct lives in boundaries
     that nothing on screen spells out, so this is how the grid is inspected from
     DevTools on a device, and how the headless harness checks it. Read-only apart
     from reset(), which drops the in-memory grid to stand in for a cold start. */
  function _debugState() {
    return {
      pages: _pages,
      pageIndex: _pageIndex,
      index: _index,
      exact: _pagesExact,
      wordsPerPage: _estWordsPerPage,
      leaves: _leafLru.slice(),
      gotoPage: function(i, animate) { _gotoPage(i, animate); },
      reset: function() {
        _pages = [];
        _leafLru = [];
        _cacheKey = null;
        _buildComplete = false;
        _pagesExact = true;
      },
    };
  }

  /* No hasCache(), deliberately. reader.js reads its absence as "this engine
     opens fast enough that a loading card would only flash" — which is now true
     of Page mode: first paint is one slab, whatever the length of the book. */
  return { init, play, pause, destroy, getIndex, seekTo, onWPMChange, refreshHighlights, _debugState };
})();
