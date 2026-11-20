/* HighlightsFeature — the reader's own marks (Claude.md §26.3)

   The second half of the investment phase. Saved words (§26.1) accrue by
   themselves; a highlight is something the reader deliberately puts in, and it
   is the only thing in this app that makes a *finished* book worth reopening,
   where §4.2 otherwise treats finishing as the end of a book's life.

   This module owns three things: the store, the mode state machine, and the
   range lookup an engine needs while it draws. Where a highlight is *made* and
   *shown* belongs to the engines and the reader, because those surfaces have
   nothing in common beyond asking this module a question.

   Why no native text selection — the decision everything else rests on:
   `user-select: none` is global on `body`, `word-tap.js` owns long-press for the
   dictionary (free since 2026-11-20 precisely so it gets used), and in Page mode
   the horizontal drag is the page turn, so drag-to-select and swipe-to-turn are
   the same gesture in the default engine where every nudged read lands (§8.5).
   The §6 Normal view is canvas with no text layer, so there is nothing there to
   select at all. Tapping two words costs one more tap than a press-and-drag and
   gives up none of that.

   Three properties that must hold:

   1. **A highlight is two word indices.** That is what carries it across a page
      turn mid-highlight (a quote routinely straddles a break), the §4.1 rule 3
      renumber, a font-scale change and a different screen. A character offset or
      a page anchor would land somewhere else on all four.
   2. **The stored text is a cache, not the identity.** It is kept so the §14
      share card and the reader list can show a quote without loading the book,
      and it is capped. The indices are the truth; if the two ever disagree, the
      indices win.
   3. **Drawing a highlight may not occupy vertical space.** Engines apply a
      background tint to spans they already build. Anything with height would
      change what fits on a page, which means a layout-version bump and, worse, a
      page that reflows the moment it is highlighted (§4.1). */

const HighlightsFeature = (function() {

  const PREFIX = 'fr_highlights_';

  /* Enough for a long quotation and short enough that a book's worth of them is
     a few KB. The share card caps again at its own width (§14). */
  const TEXT_CAP = 400;

  /* A runaway guard, not a product limit — see §26.1's MAX for the same
     reasoning. Oldest goes, because the newest mark is the one just made. */
  const MAX_PER_BOOK = 500;

  /* ── Store ─────────────────────────────────────────────────────────────
     One key per book: a reader with forty books should not pay to parse
     thirty-nine of them to draw one page. */

  function _key(fileId) {
    return PREFIX + fileId;
  }

  function _read(fileId) {
    if (!fileId) return [];
    try {
      const raw = JSON.parse(localStorage.getItem(_key(fileId)) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw
        .filter(function(h) { return h && typeof h.s === 'number' && typeof h.e === 'number'; })
        .sort(function(a, b) { return a.s - b.s; });
    } catch (_) {
      return [];
    }
  }

  function _write(fileId, list) {
    try {
      if (!list.length) localStorage.removeItem(_key(fileId));
      else localStorage.setItem(_key(fileId), JSON.stringify(list));
      return true;
    } catch (_) {
      return false;
    }
  }

  function forFile(fileId) {
    return _read(fileId);
  }

  function count(fileId) {
    return _read(fileId).length;
  }

  /* The words of a range, joined. Placeholders (§5's table/image/equation
     chips) carry a label rather than a string, and a quote reading
     "[Table] [Table]" is not a quote — so a range is only given text from the
     words that have any. */
  function textOf(words, start, end) {
    if (!words) return '';
    const out = [];
    for (let i = start; i <= end && i < words.length; i++) {
      const w = words[i];
      if (typeof w === 'string') out.push(w);
    }
    let text = out.join(' ').replace(/\s+/g, ' ').trim();
    if (text.length > TEXT_CAP) text = text.slice(0, TEXT_CAP).replace(/\s+\S*$/, '') + '…';
    return text;
  }

  /* Adds a range, or null if it was refused. Overlapping an existing highlight
     merges with it rather than stacking: two tints over one word is a rendering
     the span cannot express, and the reader's intent is one mark either way. */
  function add(fileId, from, to, words) {
    if (!fileId || typeof from !== 'number' || typeof to !== 'number') return null;

    let start = Math.min(from, to);
    let end = Math.max(from, to);
    const total = (words && words.length) || 0;
    if (total) {
      start = Math.max(0, Math.min(start, total - 1));
      end = Math.max(0, Math.min(end, total - 1));
    }
    if (end < start) return null;

    const list = _read(fileId);
    const kept = [];
    for (let i = 0; i < list.length; i++) {
      const h = list[i];
      /* Touching counts as overlapping: two marks that meet at a word boundary
         read as one mark on screen, so they are one. */
      if (h.e + 1 < start || h.s > end + 1) {
        kept.push(h);
        continue;
      }
      start = Math.min(start, h.s);
      end = Math.max(end, h.e);
    }

    const entry = { s: start, e: end, t: textOf(words, start, end), ts: Date.now() };
    kept.push(entry);
    kept.sort(function(a, b) { return a.s - b.s; });
    while (kept.length > MAX_PER_BOOK) kept.shift();

    return _write(fileId, kept) ? entry : null;
  }

  /* Removal is by start index, which is unique after the merge above. */
  function remove(fileId, start) {
    const list = _read(fileId).filter(function(h) { return h.s !== start; });
    _write(fileId, list);
  }

  /* The highlight covering a word, or null. Engines call this per word while
     building markup, so it is a plain scan over a short, sorted list — a book
     has tens of highlights, not thousands, and an index would cost more to keep
     correct than it saves. */
  function at(list, wordIndex) {
    for (let i = 0; i < list.length; i++) {
      if (wordIndex < list[i].s) return null;      /* sorted: no later one can match */
      if (wordIndex <= list[i].e) return list[i];
    }
    return null;
  }

  /* ── Mode ──────────────────────────────────────────────────────────────
     Deliberately short-lived: it ends itself on the second tap, so there is
     never a mode left on and never a mode plus a modal (§20). */

  let _mode = null;   /* { fileId, words, anchor, onChange, onExit } */

  function begin(opts) {
    if (!opts || !opts.fileId) return false;
    _mode = {
      fileId: opts.fileId,
      words: opts.words || [],
      anchor: -1,
      onChange: typeof opts.onChange === 'function' ? opts.onChange : function() {},
      onExit: typeof opts.onExit === 'function' ? opts.onExit : function() {},
    };
    _mode.onChange();
    return true;
  }

  function active() {
    return !!_mode;
  }

  function anchor() {
    return _mode ? _mode.anchor : -1;
  }

  function cancel() {
    if (!_mode) return;
    const exit = _mode.onExit;
    const changed = _mode.onChange;
    _mode = null;
    changed();
    exit();
  }

  /* An engine hands over the word that was tapped and gets back what happened,
     so it can redraw and the reader can update its instruction line.
     'anchored' — first tap taken. 'committed' — highlight made, mode over.
     A backwards second tap is fine and normalises, because catching the start
     of a sentence often means swiping back a page first. */
  function tapWord(wordIndex) {
    if (!_mode || typeof wordIndex !== 'number' || wordIndex < 0) return 'ignored';

    if (_mode.anchor < 0) {
      _mode.anchor = wordIndex;
      _mode.onChange();
      return 'anchored';
    }

    const made = add(_mode.fileId, _mode.anchor, wordIndex, _mode.words);
    const exit = _mode.onExit;
    const changed = _mode.onChange;
    _mode = null;
    changed();
    exit();
    return made ? 'committed' : 'ignored';
  }

  /* The last mark made, so the reader can offer an Undo without the engine
     having to remember what it just did. */
  function undoLast(fileId) {
    const list = _read(fileId);
    if (!list.length) return false;
    let newest = list[0];
    for (let i = 1; i < list.length; i++) {
      if ((list[i].ts || 0) > (newest.ts || 0)) newest = list[i];
    }
    remove(fileId, newest.s);
    return true;
  }

  /* ── Sentence marking, for the engines with no text on screen ──────────
     RSVP and Chunk show one word or a few, so there is nothing to tap twice.
     Offering them nothing would be worse than offering a different gesture:
     RSVP is where a reader moves fastest and is most likely to pass something
     they wanted (§26.3). The sentence around the current word is the honest
     unit — the same punctuation these engines already pause on (§4). */
  function markSentence(fileId, words, index) {
    if (!words || !words.length) return null;
    const i = Math.max(0, Math.min(index, words.length - 1));

    const ENDS = /[.!?।]$/;
    let start = i;
    while (start > 0) {
      const prev = words[start - 1];
      if (typeof prev === 'string' && ENDS.test(prev)) break;
      start--;
    }
    let end = i;
    while (end < words.length - 1) {
      const w = words[end];
      if (typeof w === 'string' && ENDS.test(w)) break;
      end++;
    }
    return add(fileId, start, end, words);
  }

  /* ── For the share card (§14) ──────────────────────────────────────────
     Every highlight across the library, newest first, each carrying the book it
     came from. Reads one key per book in the library rather than scanning
     localStorage, so a stale key from a deleted book cannot surface a quote
     from a book the reader no longer has. */
  function allWithBooks() {
    let lib = [];
    try {
      lib = loadLibrary() || [];
    } catch (_) {
      return [];
    }

    const out = [];
    for (let i = 0; i < lib.length; i++) {
      const item = lib[i];
      const list = _read(item.id);
      for (let j = 0; j < list.length; j++) {
        if (!list[j].t) continue;         /* no text, nothing to quote */
        out.push({
          text: list[j].t,
          start: list[j].s,
          ts: list[j].ts || 0,
          fileId: item.id,
          book: item.name || '',
          author: item.author || '',
        });
      }
    }
    return out.sort(function(a, b) { return b.ts - a.ts; });
  }

  /* Every highlight the reader has, grouped by the book it was made in and
     carrying its library entry, so the screen can open the book without
     looking it up again. Newest book first, newest mark first inside it.

     Grouped, and that is the whole condition on this screen existing (§26.3):
     an ungrouped stream of quotes from six books is a feed, and a feed is the
     thing that was rejected. Under a book title it is a collection of what the
     reader kept from *that* read, with one way in instead of six. */
  function allGrouped() {
    let lib = [];
    try {
      lib = loadLibrary() || [];
    } catch (_) {
      return [];
    }

    const groups = [];
    for (let i = 0; i < lib.length; i++) {
      const item = lib[i];
      const list = _read(item.id);
      if (!list.length) continue;

      /* Which book first is recency — the read you were just in is the one you
         are looking for. Inside a book it is *reading* order, the store's own
         order, which is also what the reader's panel list shows: marks from one
         book are read the way the book is, and two made in the same
         millisecond would otherwise order themselves arbitrarily. */
      let newest = 0;
      for (let j = 0; j < list.length; j++) {
        if ((list[j].ts || 0) > newest) newest = list[j].ts || 0;
      }

      groups.push({
        entry: item,
        fileId: item.id,
        book: item.name || '',
        newest: newest,
        marks: list,
      });
    }

    return groups.sort(function(a, b) { return b.newest - a.newest; });
  }

  function totalCount() {
    const groups = allGrouped();
    let n = 0;
    for (let i = 0; i < groups.length; i++) n += groups[i].marks.length;
    return n;
  }

  /* ── The screen ────────────────────────────────────────────────────────
     Reached from its own row on home, like saved words (§26.1), and for the
     same reason: an investment nobody can watch accumulating is not felt. */

  function render() {
    const view = qs('#view-highlights');
    if (!view) return;

    const groups = allGrouped();
    const out = [
      '<div class="words-screen">',
      '<header class="words-header">',
      '<button class="btn btn-ghost words-back-btn" id="btn-highlights-back" type="button">\u2190</button>',
      '<h1 class="words-heading">' + t('highlights.title') + '</h1>',
      '</header>',
    ];

    if (!groups.length) {
      /* The empty state names the gesture, because nothing else in the app
         does and a reader who has never found the button is exactly who
         arrives here (§1.5). */
      out.push(
        '<div class="words-empty">',
        '<p class="words-empty-title">' + t('highlights.empty.title') + '</p>',
        '<p class="words-empty-body">' + t('highlights.empty.body') + '</p>',
        '</div>',
        '</div>'
      );
      view.innerHTML = out.join('');
      _bindScreen();
      return;
    }

    out.push('<p class="words-count">' + tn('highlights.count', totalCount()) + '</p>');

    for (let g = 0; g < groups.length; g++) {
      const group = groups[g];
      out.push('<section class="words-group">');
      out.push(
        '<h2 class="words-group-title">' + escapeHtml(displayTitle(group.book)) +
        '<span class="hl-group-count">' + tn('library.item.highlights', group.marks.length) + '</span>' +
        '</h2>'
      );
      out.push('<ul class="words-list">');

      for (let i = 0; i < group.marks.length; i++) {
        const mark = group.marks[i];
        const text = mark.t
          ? escapeHtml(mark.t)
          : t('highlights.no_text');
        out.push(
          '<li class="words-item hl-item" data-file="' + escapeHtml(group.fileId) + '" data-start="' + mark.s + '">',
          '<div class="words-item-main hl-quote">' + text + '</div>',
          '<button class="btn-icon words-remove hl-remove" data-file="' + escapeHtml(group.fileId) + '" data-start="' + mark.s + '" type="button" aria-label="' + t('btn.remove') + '">\u2715</button>',
          '</li>'
        );
      }

      out.push('</ul>');
      out.push('</section>');
    }

    out.push('</div>');
    view.innerHTML = out.join('');
    _bindScreen();
  }

  function _bindScreen() {
    const back = qs('#btn-highlights-back');
    if (back) {
      back.addEventListener('click', function() {
        renderUpload();
        switchView('view-upload');
      });
    }

    qsa('#view-highlights .hl-remove').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        remove(btn.getAttribute('data-file'), parseInt(btn.getAttribute('data-start'), 10));
        render();
      });
    });

    /* Tapping a quote opens its book *at that word*. This is the payoff the
       whole phase is for — §4.2 otherwise treats a finished book as done, and
       a highlight is the one thing that gives it a reason to be reopened. The
       word index is the same seam the §6 bridge and chapter nav jump through. */
    qsa('#view-highlights .hl-quote').forEach(function(el) {
      el.addEventListener('click', function() {
        const li = el.closest('.hl-item');
        if (!li) return;
        const fileId = li.getAttribute('data-file');
        const start = parseInt(li.getAttribute('data-start'), 10);
        let entry = null;
        try {
          entry = (loadLibrary() || []).filter(function(it) { return it.id === fileId; })[0] || null;
        } catch (_) {}
        if (!entry) {
          showToast(t('toast.file_not_cached'));
          return;
        }
        resumeFromLibrary(entry, 'highlights', { startIndex: isNaN(start) ? 0 : start });
      });
    });
  }

  function open() {
    if (typeof TipsFeature !== 'undefined') TipsFeature.markDone('highlights');
    render();
    switchView('view-highlights');
  }

  function removeAllFor(fileId) {
    try { localStorage.removeItem(_key(fileId)); } catch (_) {}
  }

  return {
    forFile, count, add, remove, at, textOf,
    begin, cancel, active, anchor, tapWord, undoLast,
    markSentence, allWithBooks, removeAllFor,
    allGrouped, totalCount, render, open,
  };
})();
