/* SavedWordsFeature — the words a reader looked up, kept (Claude.md §27)

   This is the Hooked *investment* phase, taken at its cheapest point. The
   dictionary already exists, is already free (§4, fixed 2026-11-20), is already
   bound in all five engines, and lookups are already happening — the app simply
   threw the result away. Keeping them costs no new gesture, no text selection
   and no new storage model, and unlike highlights it works identically in RSVP
   and Chunk, where there is nothing on screen to select.

   What makes it an investment rather than a log: it accrues, it is the user's
   own, and the count is visible on a screen they already open (§27 — an
   investment nobody can watch accumulating is not felt).

   Two rules from the design discussion:

   1. **A word is only kept when the lookup was worth something** — a definition
      was found, or the user chose to look it up on Google. The list therefore
      cannot fill with OCR noise or with "no definition found" rows, so it is
      honest by construction rather than by filtering at render time (§1.5).
   2. **Grouped by the book it was read in.** A word looked up while reading
      Ambedkar belongs to that read; grouping is what makes the list feel like
      something the reader built rather than a history file.

   Storage is localStorage, consistent with `fr_library` — the same decision for
   the same reason. These are small records, not file data, and §21 reserves
   Capacitor Preferences for purchase state alone. */

const SavedWordsFeature = (function() {

  const KEY = 'fr_saved_words';

  /* A thousand words is around 100 KB and roughly a decade of ordinary reading.
     The cap exists so a runaway caller cannot fill the quota, not as a product
     limit, which is why it drops the oldest rather than refusing the newest:
     silently losing the word just looked up would be the visible failure. */
  const MAX = 1000;

  function _read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(raw) ? raw.filter(Boolean) : [];
    } catch (_) {
      return [];
    }
  }

  function _write(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return true;
    } catch (_) {
      return false;
    }
  }

  /* The dictionary resolves `books` to `book` (features/morphology.js), and the
     identity of a saved word is the form the dictionary knows — otherwise
     `books`, `book` and `book's` become three entries for one word. */
  function _keyOf(entry) {
    return String(entry.base || entry.w || '').toLowerCase();
  }

  function all() {
    return _read();
  }

  function count() {
    return _read().length;
  }

  function has(word, base) {
    const key = String(base || word || '').toLowerCase();
    if (!key) return false;
    const list = _read();
    for (let i = 0; i < list.length; i++) {
      if (_keyOf(list[i]) === key) return true;
    }
    return false;
  }

  /* entry: { w, base, def, pos } — w is the form the reader tapped, base the
     form the dictionary held, def/pos optional (absent for a Google lookup of a
     word with no offline definition). The book is read from AppState here
     rather than passed in, so no caller has to remember to attribute it. */
  function save(entry) {
    if (!entry || !entry.w) return false;

    const key = _keyOf(entry);
    if (!key) return false;

    const list = _read();
    for (let i = 0; i < list.length; i++) {
      /* First save wins. A word met again in a second book stays attributed to
         where it was first met, which is the read the reader will remember. */
      if (_keyOf(list[i]) === key) return false;
    }

    const file = (typeof AppState !== 'undefined' && AppState.currentFile) || null;

    list.push({
      w: String(entry.w).toLowerCase(),
      base: entry.base ? String(entry.base).toLowerCase() : '',
      def: entry.def || '',
      pos: entry.pos || '',
      fid: (file && file.id) || '',
      book: (file && file.name) || '',
      ts: Date.now(),
    });

    while (list.length > MAX) list.shift();

    return _write(list);
  }

  function remove(word, base) {
    const key = String(base || word || '').toLowerCase();
    if (!key) return;
    const list = _read().filter(function(e) { return _keyOf(e) !== key; });
    _write(list);
  }

  function clear() {
    _write([]);
  }

  /* ── The Words screen ──────────────────────────────────────────────────
     Grouped by book, newest group first, and newest word first inside a
     group. A word looked up outside any book — from Paste Text, or before a
     file was open — groups under its own heading rather than being dropped. */

  function _groups(list) {
    const byBook = {};
    const order = [];

    for (let i = list.length - 1; i >= 0; i--) {
      const entry = list[i];
      const id = entry.fid || '';
      if (!byBook[id]) {
        byBook[id] = { id: id, book: entry.book || '', words: [] };
        order.push(id);
      }
      byBook[id].words.push(entry);
    }

    return order.map(function(id) { return byBook[id]; });
  }

  function render() {
    const view = qs('#view-words');
    if (!view) return;

    const list = _read();
    const groups = _groups(list);

    const head = [
      '<div class="words-screen">',
      '<header class="words-header">',
      '<button class="btn btn-ghost words-back-btn" id="btn-words-back" type="button">←</button>',
      '<h1 class="words-heading">' + t('words.title') + '</h1>',
      '</header>',
    ];

    if (!list.length) {
      /* The empty state explains the mechanism, because nothing else does: a
         user arriving here before their first lookup needs to know what fills
         it, not that it is empty. */
      head.push(
        '<div class="words-empty">',
        '<p class="words-empty-title">' + t('words.empty.title') + '</p>',
        '<p class="words-empty-body">' + t('words.empty.body') + '</p>',
        '</div>',
        '</div>'
      );
      view.innerHTML = head.join('');
      _bind();
      return;
    }

    head.push('<p class="words-count">' + tn('words.count', list.length) + '</p>');

    for (let g = 0; g < groups.length; g++) {
      const group = groups[g];
      const label = group.book
        ? escapeHtml(displayTitle(group.book))
        : t('words.no_book');

      head.push('<section class="words-group">');
      head.push('<h2 class="words-group-title">' + label + '</h2>');
      head.push('<ul class="words-list">');

      for (let i = 0; i < group.words.length; i++) {
        const entry = group.words[i];
        const term = escapeHtml(entry.base || entry.w);
        const def = entry.def
          ? '<p class="words-def">' + escapeHtml(entry.def) + '</p>'
          : '<p class="words-def words-def-none">' + t('words.looked_up_online') + '</p>';
        const pos = entry.pos
          ? '<span class="words-pos">' + escapeHtml(entry.pos) + '</span>'
          : '';

        head.push(
          '<li class="words-item" data-word="' + escapeHtml(entry.base || entry.w) + '">',
          '<div class="words-item-main">',
          '<p class="words-term">' + term + pos + '</p>',
          def,
          '</div>',
          '<button class="btn-icon words-remove" data-remove="' + escapeHtml(entry.base || entry.w) + '" type="button" aria-label="' + t('btn.remove') + '">✕</button>',
          '</li>'
        );
      }

      head.push('</ul>');
      head.push('</section>');
    }

    head.push('</div>');
    view.innerHTML = head.join('');
    _bind();
  }

  function _bind() {
    const back = qs('#btn-words-back');
    if (back) {
      back.addEventListener('click', function() {
        renderUpload();
        switchView('view-upload');
      });
    }

    qsa('#view-words .words-remove').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        remove('', btn.getAttribute('data-remove'));
        render();
      });
    });

    /* Tapping a word re-opens the dictionary on it — the list is a way back to
       the meaning, not an archive to read once. */
    qsa('#view-words .words-item-main').forEach(function(main) {
      main.addEventListener('click', function() {
        const item = main.closest('.words-item');
        if (!item) return;
        const word = item.getAttribute('data-word');
        if (word && typeof DictionaryFeature !== 'undefined') {
          DictionaryFeature.showDictionaryModal(word);
        }
      });
    });
  }

  function open() {
    /* §23: the tip exists only to reveal that words are being kept, so arriving
       here is the whole of its job. */
    if (typeof TipsFeature !== 'undefined') TipsFeature.markDone('words');
    render();
    switchView('view-words');
  }

  return { all, count, has, save, remove, clear, render, open };
})();
