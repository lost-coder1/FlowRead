/* OcrProgressive — reading the first pages of a scan while the rest is still
   being recognised (Claude.md §16.32, §5)

   A 435-page Hindi scan is about three minutes of spinner before a single word
   can be read, and `free-books.js` runs OCR with no paid-access check, so all 23
   catalogue PDFs — the Ambedkar, Phule, Gandhi, Dhammapada and Nehru titles —
   put that wait on the main free-user path.

   The shape, decided 2026-11-23: **a stable, already-cleaned twenty-page prefix**
   rather than a reader that grows. `_ocrBuild` is a pure function of a page
   array, so pages 1..20 are a whole book to it — cleaned, paragraphed and
   chapter-detected, not raw text that tidies itself under the reader. The rest
   continues behind the reader and is offered as a swap when it lands.

   What this module owns: the offer, the swap, and the translation between two
   numberings. What it deliberately does not own is the parse (ocr-pdf.js) or the
   tips on the wait screen (ocr-wait.js).

   ── The four rules that make it honest ──────────────────────────────────────

   1. **Nothing changes under the reader.** A twenty-page build and a
      four-hundred-page build disagree about furniture, page numbers, paragraph
      starts and chapter headings, because each is a document-wide question
      answered over a different document. So the swap is a tap, never a timer and
      never automatic, and until it is taken the prefix stands exactly as it was.
   2. **Position travels by page, never by word index.** The two builds disagree
      about indices — cleaning keeps a line at 435 pages that it dropped at 20 —
      but `pageWordIndex` is stable: page 7 is page 7 in both. See `_translate`.
   3. **A partial book can never be finished.** `metadata.ocrPartial` is what
      §4.2's completion floor and §8.6's `book_finished` both check. Without it,
      arriving at prefix page 20 marks a 435-page book read and fires an event
      that is gated once per book and sticky forever.
   4. **A killed process must leave something recoverable**, not a twenty-page
      book claiming to be whole. `ocrPartial` is saved with the file and the OCR
      checkpoint is deliberately *not* deleted while a background run owns it. */

const OcrProgressive = (function() {

  /* The background run, while one is in flight. */
  let _run = null;        /* { fileId, promise, getErr } */
  /* The offer on the loading overlay, while one is pending. */
  let _offer = null;      /* { build, pages, pageCount, settle } */
  /* The full result, once it has landed under a reader that has not swapped. */
  let _ready = null;      /* { fileId, result } */

  function _t(key, vars) {
    return (typeof t === 'function') ? t(key, vars) : key;
  }

  /* ── What "partial" means, in one place ──────────────────────────────── */

  function isPartial(file) {
    return !!(file && file.metadata && file.metadata.ocrPartial);
  }

  function partialInfo(file) {
    return isPartial(file) ? file.metadata.ocrPartial : null;
  }

  /* ── The offer on the wait screen ────────────────────────────────────── */

  function offer(o, settle) {
    _offer = { build: o.build, pages: o.pages, pageCount: o.pageCount, settle: settle };
    const btn = qs('#loading-prefix');
    if (!btn) return;
    btn.textContent = _t('ocr.read_first_pages', { n: o.pages });
    btn.onclick = _takeOffer;
    show(btn);
  }

  function hideOffer() {
    const btn = qs('#loading-prefix');
    if (btn) { btn.onclick = null; hide(btn); }
    _offer = null;
  }

  function _takeOffer() {
    if (!_offer) return;
    const pending = _offer;
    hideOffer();
    let built = null;
    try {
      built = pending.build();
    } catch (e) {
      /* The prefix is an offer, not the import. If it cannot be built the run
         carries on and the user waits as they did before — which is why this
         says nothing rather than raising an error about a thing they asked for
         as a shortcut. */
      console.warn('[OCR] prefix build failed:', e);
      return;
    }
    /* A prefix with nothing in it is not worth opening; twenty pages of
       illustrations would do this. Silently stand down (§1.5: the wait screen
       keeps telling the truth about the real run). */
    if (!built || !built.metadata || !built.metadata.wordCount) return;
    pending.settle(built);
  }

  /* ── The background run ──────────────────────────────────────────────── */

  const WAKE_OWNER = 'ocr-background';

  function watch(fileId, promise, getErr) {
    _run = { fileId: fileId, promise: promise, getErr: getErr };
    /* The import flow's own acquireWakeLock() is released the moment it hands
       back the prefix, and the reader's is released on leaving it -- neither
       survives the background run that is still going. A named hold does, and
       it also outranks the five-minute idle release that Page mode can never
       satisfy (§19: Page mode has no playing state). */
    if (typeof holdWakeLock === 'function') holdWakeLock(WAKE_OWNER);
    promise.then(function(result) {
      const err = (typeof getErr === 'function') ? getErr() : null;
      if (err || !result) return _failed(fileId, err);
      _landed(fileId, result);
    });
  }

  /* The run died after the reader was already open. The prefix stays readable
     and the checkpoint stays on disk, so the next open of this book can resume
     rather than start from page one — which is the whole reason the checkpoint
     is not deleted on the early return. Nothing is said: the user is reading,
     and a failure notice about a background job they did not start would
     interrupt exactly the thing this feature exists to protect. */
  function _failed(fileId, err) {
    console.warn('[OCR] background run failed for ' + fileId, err);
    _run = null;
    if (typeof releaseWakeLockHold === 'function') releaseWakeLockHold(WAKE_OWNER);
    _renderPartialBar();
  }

  async function _landed(fileId, result) {
    _run = null;
    if (typeof releaseWakeLockHold === 'function') releaseWakeLockHold(WAKE_OWNER);
    try { await deleteOcrCheckpoint(fileId); } catch (_) {}

    const current = AppState.currentFile;
    if (current && current.id === fileId && AppState.currentView === 'view-reader') {
      /* Reading it right now: offer, never take. */
      _ready = { fileId: fileId, result: result };
      _renderPartialBar();
      return;
    }

    /* Not reading it — so there is no reader to disturb, and the swap can
       simply be taken. The position still has to travel: it was saved against
       the prefix and will next be read by an open that sees the full arrays.
       Order matters here and bit once already: _persist writes whatever the
       live file holds, so the arrays must be swapped in *before* it runs, or
       storage keeps the twenty-page book while memory has the whole one. */
    const live = (current && current.id === fileId) ? current : null;
    if (live) {
      const oldPageWordIndex = live.pageWordIndex;
      const pos = loadPosition(fileId);
      _applyToCurrent(result);
      if (pos > 0) {
        savePosition(fileId, _translate(pos, oldPageWordIndex, result.pageWordIndex,
                                        result.words.length));
      }
    }
    await _persist(fileId, result, live);
  }

  /* ── Translation between the two numberings ──────────────────────────── */

  /* A word index in the prefix, expressed as a word index in the full build.
     Page first, then the offset inside it, clamped to that page's real length.
     The residual error is the handful of furniture lines the two builds disagree
     about on that one page — usually none, and always the right page, which is
     what the reader actually recognises. */
  function _translate(fromIndex, fromPageWordIndex, toPageWordIndex, toTotal) {
    if (!Array.isArray(fromPageWordIndex) || !fromPageWordIndex.length) return 0;
    if (!Array.isArray(toPageWordIndex) || !toPageWordIndex.length) return 0;

    let page = 0;
    for (let i = 0; i < fromPageWordIndex.length; i++) {
      if (fromPageWordIndex[i] <= fromIndex) page = i; else break;
    }
    if (page >= toPageWordIndex.length) page = toPageWordIndex.length - 1;

    const offset = Math.max(0, fromIndex - fromPageWordIndex[page]);
    const start = toPageWordIndex[page];
    const end = (page + 1 < toPageWordIndex.length) ? toPageWordIndex[page + 1] : toTotal;
    const span = Math.max(0, end - start - 1);
    return Math.max(0, Math.min(start + Math.min(offset, span), Math.max(0, toTotal - 1)));
  }

  /* ── The swap ────────────────────────────────────────────────────────── */

  async function swap() {
    if (!_ready) return;
    const full = _ready.result;
    const fileId = _ready.fileId;
    const file = AppState.currentFile;
    if (!file || file.id !== fileId) { _ready = null; return; }

    const oldPageWordIndex = file.pageWordIndex;
    const oldIndex = (_activeEngineIndex() !== null) ? _activeEngineIndex() : loadPosition(fileId);

    /* §19: the session recorder tracks the furthest word reached, so a session
       that straddles two numberings produces a figure where wpm x time no longer
       equals words. Bank the prefix read in its own numbering first. */
    if (typeof _flushSessionIfActive === 'function') _flushSessionIfActive();

    const newIndex = _translate(oldIndex, oldPageWordIndex, full.pageWordIndex,
                                full.words.length);

    /* §26.3: a highlight is two word indices, so it points at the wrong words
       after the arrays change. Same page-and-offset map as the position. */
    _translateHighlights(fileId, oldPageWordIndex, full);

    _applyToCurrent(full);
    savePosition(fileId, newIndex);
    await _persist(fileId, full, AppState.currentFile);

    _ready = null;
    AppState.chapters = detectChapters(AppState.currentFile);
    /* bridgeReturn suppresses a second `book_opened` — this is the same book in
       the same sitting, and counting it would inflate opens (§8.6). */
    renderReader({ startIndex: newIndex, silentResume: true, bridgeReturn: true });
    showToast(_t('ocr.swapped', { n: full.metadata.pageCount }));
  }

  function _activeEngineIndex() {
    try {
      if (typeof _activeEngine !== 'undefined' && _activeEngine
          && typeof _activeEngine.getIndex === 'function') {
        const i = _activeEngine.getIndex();
        if (typeof i === 'number' && i >= 0) return i;
      }
    } catch (_) {}
    return null;
  }

  /* The record shape stays inside highlights.js (§26.3 gives it the store); this
     only supplies the arithmetic. */
  function _translateHighlights(fileId, oldPageWordIndex, full) {
    if (typeof HighlightsFeature === 'undefined'
        || typeof HighlightsFeature.remap !== 'function') return;
    try {
      HighlightsFeature.remap(fileId, function(i) {
        return _translate(i, oldPageWordIndex, full.pageWordIndex, full.words.length);
      });
    } catch (_) {}
  }

  function _applyToCurrent(full) {
    const file = AppState.currentFile;
    if (!file) return;
    file.words = full.words;
    file.pageWordIndex = full.pageWordIndex;
    file.rawLines = full.rawLines;
    /* ocrPartial is dropped by this merge, which is what re-enables completion,
       book_finished and the full page range in Normal view. */
    file.metadata = Object.assign({}, file.metadata, full.metadata);
    delete file.metadata.ocrPartial;
  }

  async function _persist(fileId, full, liveFile) {
    let data = liveFile;
    if (!data) {
      try { data = await loadFileData(fileId); } catch (_) { data = null; }
      if (!data) return;
      data.words = full.words;
      data.pageWordIndex = full.pageWordIndex;
      data.rawLines = full.rawLines;
      data.metadata = Object.assign({}, data.metadata || {}, full.metadata);
      delete data.metadata.ocrPartial;
      /* The saved position was taken against the prefix. Translate it before it
         is read back by an open that will see the full arrays. */
      const pos = loadPosition(fileId);
      if (pos > 0) {
        const prev = (liveFile && liveFile.pageWordIndex) || null;
        if (prev) savePosition(fileId, _translate(pos, prev, full.pageWordIndex, full.words.length));
      }
    }
    try { await saveFileData(fileId, data); } catch (_) {}

    /* The library row carries the counts, and they are the prefix's until this
       runs — so progress would read against twenty pages. */
    try {
      const lib = loadLibrary();
      const item = lib.filter(function(x) { return x && x.id === fileId; })[0];
      if (item) {
        saveFileToLibrary(Object.assign({}, item, {
          wordCount: full.metadata.wordCount,
          pageCount: full.metadata.pageCount,
        }), 'reopen');
      }
    } catch (_) {}
  }

  /* ── The bar in the reader ───────────────────────────────────────────── */

  /* Deliberately a bar and not a modal: §20 allows one modal at a time and this
     would be arriving while the reader is doing something else entirely. It
     states what is true and offers the one action, and when nothing is ready it
     is a plain statement with nothing to tap. */
  function _renderPartialBar() {
    const host = qs('#reader-partial');
    if (!host) return;
    const file = AppState.currentFile;
    if (!isPartial(file)) { hide(host); host.innerHTML = ''; return; }

    const info = partialInfo(file);
    if (_ready && _ready.fileId === file.id) {
      host.innerHTML = '<span class="reader-partial-text">'
        + escapeHtml(_t('ocr.full_ready', { n: info.pageCount })) + '</span>'
        + '<button class="reader-partial-action" id="reader-partial-swap">'
        + escapeHtml(_t('ocr.open_full')) + '</button>';
      const btn = qs('#reader-partial-swap');
      if (btn) btn.onclick = function() { swap(); };
    } else if (_run && _run.fileId === file.id) {
      host.innerHTML = '<span class="reader-partial-text">'
        + escapeHtml(_t('ocr.partial_reading', { done: info.pagesDone, total: info.pageCount }))
        + '</span>';
    } else {
      /* No run in flight and nothing ready: an interrupted import. The
         checkpoint is still on disk, so saying so is actionable rather than an
         apology — but resuming is the import flow's job, not this bar's. */
      host.innerHTML = '<span class="reader-partial-text">'
        + escapeHtml(_t('ocr.partial_paused', { done: info.pagesDone, total: info.pageCount }))
        + '</span>';
    }
    show(host);
  }

  /* Called by the reader on every render, so the bar survives an engine switch
     and a swipe back into the book. */
  function syncReaderChrome() {
    _renderPartialBar();
  }

  return {
    isPartial: isPartial,
    partialInfo: partialInfo,
    offer: offer,
    hideOffer: hideOffer,
    watch: watch,
    swap: swap,
    syncReaderChrome: syncReaderChrome,
    /* Exported for the harness: the one piece of arithmetic here. */
    _translate: _translate,
  };
})();
