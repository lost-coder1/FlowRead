/* Free Books Library — Task 15.7 */

var FreeBooksView = (function() {
  var _catalog = null;
  /* Default language tab: India → All (mixed); non-India → English (Hindi editions
     are still available via the Hindi tab). Once the user changes tabs the choice
     persists for the session. */
  var _langFilter = (function() {
    var lang = (navigator.language || '').toLowerCase();
    var isIndia = lang.startsWith('hi') || lang.indexOf('-in') !== -1;
    return isIndia ? 'all' : 'en';
  })();
  var _catFilter = 'all';
  var _searchQuery = '';
  var _downloading = {};

  /* ── Gutenberg mirror ────────────────────────────────────────────
     127 of the 150 catalogue entries point at www.gutenberg.org, which takes
     itself down for maintenance — on 2026-11-16 it answered a site-wide 503 and
     most of the free library became undownloadable and coverless at once.
     gutenberg.pglaf.org is official Project Gutenberg infrastructure serving the
     identical /cache/epub tree over https (the other public mirrors carry only
     /files and 404 on these paths), so a failed request is retried there.

     The catalogue's own sourceUrl is never rewritten. generateFileId() hashes
     it, so a book's identity *is* its URL, and editing one orphans the saved
     position of every reader who already has it (Tasks.md, 2026-11-03). Only
     the fetch moves; what we store stays what we shipped. */
  var _PG_HOST   = 'https://www.gutenberg.org';
  var _PG_MIRROR = 'https://gutenberg.pglaf.org';

  /* Set the first time the main host fails, so the rest of the session goes
     straight to the mirror instead of paying a dead round trip per request. It
     matters most for a grid of 127 covers, each of which would otherwise wait
     for its own 503 before retrying; on a 2 MB book the saving is noise.

     Deliberately not persisted: the mirror is slower and is someone else's
     courtesy bandwidth, so the preference dies with the session and the app
     goes back to the main host on the next launch, which is how it finds out
     that maintenance has ended. */
  var _pgDown = false;

  function _mirrorUrl(url) {
    return url.indexOf(_PG_HOST) === 0 ? _PG_MIRROR + url.slice(_PG_HOST.length) : null;
  }

  /* Called by the cover <img> onerror, which is usually what fails first —
     covers load on opening the library, long before anyone taps Download. */
  function noteHostDown() { _pgDown = true; }

  /* Resolves to a good response or throws. The thrown error carries `reason`,
     because "the server answered badly" and "nothing answered" need different
     words in front of the user (§1.5) — telling someone to check a connection
     that is working sends them to fix the wrong thing. */
  async function _fetchBook(url) {
    var mirror = _mirrorUrl(url);
    var attempts = mirror
      ? (_pgDown ? [mirror, url] : [url, mirror])   /* known-down host goes last */
      : [url];

    var reason = 'network';
    for (var i = 0; i < attempts.length; i++) {
      try {
        var res = await fetch(attempts[i]);
        if (res.ok) return res;
        reason = 'server';
      } catch (_) {
        reason = 'network';
      }
      if (attempts[i] !== mirror) _pgDown = true;
    }

    var err = new Error('download failed (' + reason + ')');
    err.reason = reason;
    throw err;
  }

  /* ── Catalog ─────────────────────────────────────────────────── */

  /* ── Remote catalogue (16.4 Phase C) ─────────────────────────────
     Books added after a build shipped come from one hand-edited public file.
     Three properties, in the order they matter:

     1. **The bundled file is the offline floor and is never replaced** (§1.1).
        The remote file only ever *adds*; a fresh install with no network has
        the whole 150-book library. Every failure here is silent, because the
        reader asked for a library and got one — there is nothing to report.
     2. **The remote fetch is never in the paint path.** The library renders
        from the bundled file plus whatever the last fetch cached, which needs
        no network at all, and the refresh runs behind it and re-renders only
        if the file actually changed. An awaited fetch would mean a spinner on
        a screen that already has 150 books to show, and a dead network would
        hold it there. It also means the timeout below not biting costs
        nothing, which matters because `CapacitorHttp` routes fetch through
        native and may ignore an AbortSignal.
     3. **The worst a bad edit can do is not appear.** The file is hand-edited,
        so every entry is re-validated on the way in and on the way out of the
        cache — a malformed one is dropped rather than rendered half-built
        (§1.5). The owner's feedback path is `scripts/catalog/validate.mjs`
        before committing, not the app after.

     The URL may never move; `Claude.md` §12 carries the contract, and `v1/` is
     the only escape hatch for a shape change. */
  var _REMOTE_URL =
    'https://raw.githubusercontent.com/lost-coder1/flowread-privacy/main/catalog/v1/catalog.json';
  var _REMOTE_CACHE_KEY   = 'fr_remote_catalog';
  var _REMOTE_TIMEOUT_MS  = 8000;
  var _REMOTE_MAX_BOOKS   = 500;
  var _REMOTE_MAX_CATEGORIES = 24;
  var _DROP_MAX_CHOICES = 12;   /* §3 ships three; the cap is a quota guard. */
  var _REMOTE_MAX_BYTES   = 512 * 1024;

  var _bundled   = null;   /* the floor, kept so a refresh can re-merge */
  var _remoteSig = null;   /* what the last applied remote list looked like */
  var _refreshed = false;  /* one fetch per app session, not per render */
  var _drop  = null;       /* this month's offer, or null for no section */
  var _claim = null;       /* { month, bookId } — what has been claimed */
  var _pendingClaimId = null;  /* a claim awaiting its inline confirmation */

  function _isHttpsUrl(url) {
    return typeof url === 'string' && url.indexOf('https://') === 0;
  }

  /* A catalogue entry the renderer can rely on, or null. Every field the card,
     the filters, the sort and the download path read is checked here, so none
     of them has to. Unknown language is dropped for the same reason as unknown
     category: the tabs offer en and hi, so anything else is unreachable except
     under "All" and is far more likely to be a typo than an intention. */
  function _cleanEntry(raw, declared) {
    if (!raw || typeof raw !== 'object') return null;

    var required = ['id', 'title', 'author', 'language', 'category', 'sourceUrl', 'fileType'];
    var out = {};
    for (var i = 0; i < required.length; i++) {
      var v = raw[required[i]];
      if (typeof v !== 'string' || !v) return null;
      out[required[i]] = v;
    }

    /* §12: `free-books.js` branches on exactly these two, and an `html` entry
       would reach the PDF parser and fail. */
    if (out.fileType !== 'pdf' && out.fileType !== 'txt') return null;
    if (out.language !== 'en' && out.language !== 'hi') return null;
    if (!_isKnownCategory(out.category, declared)) return null;
    if (!_isHttpsUrl(out.sourceUrl)) return null;

    if (_isHttpsUrl(raw.coverImage)) out.coverImage = raw.coverImage;
    if (typeof raw.approxLength === 'string') out.approxLength = raw.approxLength;
    /* Optional `YYYY-MM-DD`, and the only thing that can expire a new arrival's
       place at the top of the grid. Read against the *device* clock, which §12
       forbids for `dropMonth` — the difference is that `dropMonth` gates an
       entitlement, where this decides a sort order, so a wrong clock costs a
       book its position and nothing else. */
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw.addedAt)) out.addedAt = raw.addedAt;

    /* Forces the OCR path for a PDF whose text layer extracts as mojibake —
       the legacy Devanagari font encodings §5 describes. It must be carried
       across: an entry that loses it is handed to the text-layer parser, which
       returns unreadable text rather than an error, and the reader is told
       nothing (§1.5). Strictly `true`, so the string "false" cannot enable it.

       This is the field that proves the rule for anything added later — a key
       the app reads and `_cleanEntry` does not copy is a silent downgrade, so
       both lists have to be extended together. */
    if (raw.requiresOcr === true) out.requiresOcr = true;

    /* Subscription content (§3). Marked on the *entry*, not derived from
       membership of `dropChoices`, because the two answer different questions:
       `drop` says this book is never part of the free 150, and `dropChoices`
       says which drop books are on offer *this month*. Derived from the
       month's list alone, last month's titles would fall into the free grid
       the moment the month rolled over — §3's one paid differentiator giving
       itself away on a timer. */
    if (raw.drop === true) out.drop = true;

    return out;
  }

  function _cleanList(list, declared) {
    var out = [];
    if (!Array.isArray(list)) return out;
    for (var i = 0; i < list.length && out.length < _REMOTE_MAX_BOOKS; i++) {
      var entry = _cleanEntry(list[i], declared);
      if (entry) out.push(entry);
    }
    return out;
  }

  /* Only the categories a surviving book actually uses. A declared category
     with nothing in it would otherwise put an empty chip on the row, which
     filters to "no books found" — a dead control (§1.5). */
  /* The month's offer. Returns null — never a partial drop — because every
     failure here lands on §1.1's silent fallback: no section at all is correct
     and quiet, where half a section is a subscriber staring at two cards
     wondering where the third went.

     A choice must name an entry that survived `_cleanEntry` *and* carries
     `drop: true`. An id matching a free catalogue book is ignored rather than
     promoted, or a hand-edit on a public repo could pull any of the 150 behind
     the paywall §23 says may never touch them. */
  function _cleanDrop(raw, books) {
    if (!raw || typeof raw !== 'object') return null;
    var month = raw.dropMonth;
    if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
    if (!Array.isArray(raw.dropChoices) || !raw.dropChoices.length) return null;

    var byId = {};
    for (var i = 0; i < books.length; i++) byId[books[i].id] = books[i];

    var ids = [];
    for (var j = 0; j < raw.dropChoices.length && ids.length < _DROP_MAX_CHOICES; j++) {
      var id = raw.dropChoices[j];
      if (typeof id !== 'string') continue;
      var book = byId[id];
      if (!book || !book.drop) continue;
      if (ids.indexOf(id) === -1) ids.push(id);
    }
    return ids.length ? { month: month, choices: ids } : null;
  }

  /* ── The claim ───────────────────────────────────────────────
     In Capacitor Preferences, not localStorage. §20 reserves Preferences for
     purchase state, and a claim is downstream of one: it is the thing the
     subscription actually bought this month. In localStorage it would also be
     cleared by the same "clear site data" that costs a user nothing else,
     handing back a claim they had already spent.

     One key, `month:bookId`, so the month the claim belongs to travels with
     it. A claim from a previous month is not migrated or cleared — it simply
     does not match, which is what makes the rollover free. */
  var _CLAIM_KEY = 'drop_claim';

  async function _loadClaim() {
    _claim = null;
    try {
      var raw = await loadPurchaseState(_CLAIM_KEY);
      if (typeof raw !== 'string') return;
      var cut = raw.indexOf(':');
      if (cut === -1) return;
      var month = raw.slice(0, cut), bookId = raw.slice(cut + 1);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !bookId) return;
      _claim = { month: month, bookId: bookId };
    } catch (_) { _claim = null; }
  }

  async function _saveClaim(month, bookId) {
    _claim = { month: month, bookId: bookId };
    try { await savePurchaseState(_CLAIM_KEY, month + ':' + bookId); } catch (_) {}
  }

  /* Claimed *this* month. A claim for an older month is spent history. */
  function _claimedThisMonth() {
    if (!_drop || !_claim) return null;
    return _claim.month === _drop.month ? _claim.bookId : null;
  }

  /* The month's books, in the order the catalogue lists them. */
  function _dropBooks() {
    if (!_drop || !_catalog) return [];
    var byId = {};
    _catalog.books.forEach(function(b) { byId[b.id] = b; });
    return _drop.choices.map(function(id) { return byId[id]; })
                        .filter(function(b) { return !!b; });
  }

  function _usedCategories(books, declared) {
    var out = {};
    for (var i = 0; i < books.length; i++) {
      var cat = books[i].category;
      if (declared[cat] && !out[cat]) out[cat] = declared[cat];
    }
    return out;
  }

  /* Remote wins on a shared `id`, and wins *in place* so the bundled order —
     which the region-aware sort is layered on top of — does not shuffle just
     because a book was re-described. New books append. */
  function _merge(bundled, remote) {
    var books = bundled.slice();
    var at = {};
    for (var i = 0; i < books.length; i++) at[books[i].id] = i;
    for (var j = 0; j < remote.length; j++) {
      var b = remote[j];
      if (at[b.id] !== undefined) {
        /* An override is a book the reader may already have — a corrected
           title or cover is not an arrival, and calling it one would send a
           familiar book back to the top of the grid. */
        books[at[b.id]] = b;
      } else {
        /* Marked here because this is the only place that knows the difference
           between "the remote file contains it" and "the app did not ship it".
           Set on the merged copy, never on what `_writeRemoteCache` stores, so
           it cannot be persisted and go stale. */
        b = _assign({}, b);
        b._arrival = true;
        at[b.id] = books.length;
        books.push(b);
      }
    }
    return books;
  }

  /* minSdk 24 WebViews predate Object.assign in some builds (§2). */
  function _assign(target, src) {
    var keys = Object.keys(src);
    for (var i = 0; i < keys.length; i++) target[keys[i]] = src[keys[i]];
    return target;
  }

  /* Re-validated on read, not trusted because we wrote it: the rules can
     tighten in a later build while a cache written by an older one survives. */
  function _readRemoteCache() {
    try {
      var raw = localStorage.getItem(_REMOTE_CACHE_KEY);
      if (!raw) return { books: [], categories: {}, drop: null };
      var data = JSON.parse(raw);
      var cats = _cleanCategories(data && data.categories);
      var books = _cleanList(data && data.books, cats);
      return {
        books: books,
        categories: _usedCategories(books, cats),
        /* Re-validated on the way out, like everything else here: the rules can
           tighten in a later build while an older build's cache survives. */
        drop: _cleanDrop(data && data.drop, books),
      };
    } catch (_) { return { books: [], categories: {}, drop: null }; }
  }

  function _writeRemoteCache(result) {
    try {
      localStorage.setItem(_REMOTE_CACHE_KEY, JSON.stringify({
        books: result.books, categories: result.categories, at: Date.now(),
        /* Stored under the same key names the remote file uses, so the cache
           and the network answer to one validator. */
        drop: result.drop
          ? { dropMonth: result.drop.month, dropChoices: result.drop.choices }
          : null,
      }));
    } catch (_) {}   /* a full quota costs freshness, nothing else */
  }

  async function _fetchRemote() {
    var ctrl  = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function() { ctrl.abort(); }, _REMOTE_TIMEOUT_MS) : null;
    try {
      /* `?v=` defeats the WebView's own HTTP cache. It does **not** defeat
         GitHub's: raw.githubusercontent normalises the query string away, so
         the same ETag comes back on a HIT and an edit takes up to five minutes
         to reach a device however the request is spelled. Measured, not
         assumed — three app launches inside that window on 2026-11-24 read a
         stale body and dropped the entry it described. Nothing in the client
         can shorten it, so the rule is a human one: after editing the
         catalogue, wait five minutes before concluding anything — and wait it
         *on the device*. The window is per edge node, so a `curl` from a dev
         machine returning the new file proves only that one POP has it; the
         phone sat on another and read the old body for minutes longer. That
         is what made this look twice like a bug in the loader.

         On GET, `CapacitorHttp` does not route through native at all: it
         rewrites the URL to `localhost/_capacitor_http_interceptor_?u=…` and
         uses the WebView's own fetch, so the signal below is honoured here
         even though the native path may ignore one. */
      var opts = { cache: 'no-store' };
      if (ctrl) opts.signal = ctrl.signal;
      var res = await fetch(_REMOTE_URL + '?v=' + Date.now(), opts);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var text = await res.text();
      if (text.length > _REMOTE_MAX_BYTES) throw new Error('catalogue too large');
      var data = JSON.parse(text);
      if (!data || !Array.isArray(data.books)) throw new Error('catalogue shape');

      /* Categories first: a book's category is validated against them. */
      var cats  = _cleanCategories(data.categories);
      var books = _cleanList(data.books, cats);
      return {
        books: books,
        categories: _usedCategories(books, cats),
        drop: _cleanDrop(data, books),
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /* Fire-and-forget. Never awaited, never reported, never retried within a
     session: the next launch is the retry, and the reader is already reading. */
  async function _refreshRemote() {
    if (_refreshed) return;
    _refreshed = true;

    var fresh;
    try { fresh = await _fetchRemote(); } catch (_) { return; }

    var sig = JSON.stringify(fresh);
    if (sig === _remoteSig) return;   /* unchanged: no write, no re-render */
    _remoteSig = sig;
    _writeRemoteCache(fresh);

    if (!_bundled) return;
    _remoteCategories = fresh.categories;
    _drop = fresh.drop;
    _catalog = { books: _merge(_bundled, fresh.books) };

    /* Not a full render(): that would clear the search box and the scroll
       position under a reader who is mid-browse. The grid and the chip row
       instead — the chips because a remotely-declared category is a chip that
       was not on screen a moment ago. (Before categories could be declared,
       all twelve were in the bundled catalogue and the row could not change.)
       Both are delegated-listener containers, so replacing their markup keeps
       the handlers bound. */
    _rebuildCatChips();
    _renderGrid();
  }

  async function _loadCatalog() {
    if (_catalog) return _catalog;

    var bundled = [];
    try {
      var res = await fetch('data/free-books.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      if (data && Array.isArray(data.books)) bundled = data.books;
    } catch (_) {}

    _bundled = bundled;
    var cached = _readRemoteCache();
    _remoteSig = JSON.stringify(cached);
    _remoteCategories = cached.categories;
    _drop = cached.drop;
    _catalog = { books: _merge(bundled, cached.books) };

    /* Awaited, unlike the refresh: the claim decides whether the section draws
       a claim button or a spent state, and a section that renders unclaimed
       and corrects itself a tick later tells a subscriber they have a claim
       they have already spent (§1.5). It is a Preferences read with no
       network, so it cannot hang the way the catalogue fetch could. */
    await _loadClaim();

    _refreshRemote();   /* deliberately not awaited */
    return _catalog;
  }

  /* ── Download state ──────────────────────────────────────────── */

  function _getSavedFileId(bookId) {
    return localStorage.getItem('fr_freebook_' + bookId) || null;
  }

  function _setSavedFileId(bookId, fileId) {
    try { localStorage.setItem('fr_freebook_' + bookId, fileId); } catch (_) {}
  }

  /* Keep the catalogue cover for the share card (§15). Done here, at download
     time, because the device is online by definition at this moment — the share
     card itself must fetch nothing. A Free Books TXT has no page one to render a
     cover from, so for two thirds of the catalogue this is the only artwork
     there is. Fire-and-forget: it must not delay opening the book, and a cover
     that fails to arrive is not worth a word to the reader (§1.5). */
  function _keepCover(book, fileId) {
    if (!book || !book.coverImage || !fileId) return;
    if (typeof BookCover === 'undefined' || typeof BookCover.cacheRemote !== 'function') return;
    var mirror = _mirrorUrl(book.coverImage);
    var order = (mirror && _pgDown) ? [mirror, book.coverImage] : [book.coverImage, mirror];
    BookCover.cacheRemote(fileId, order).catch(function() {});
  }

  function _getState(book) {
    if (_downloading[book.id]) return 'downloading';
    if (_getSavedFileId(book.id)) return 'downloaded';
    return 'idle';
  }

  /* ── Filtering & sorting ─────────────────────────────────────── */

  function _filtered(books) {
    return books.filter(function(book) {
      /* §23: a drop card may never be mixed into the catalogue grid, or §3's
         "the **entire** library is free" stops being true on the one screen
         that proves it. Excluded by the entry's own `drop` flag rather than by
         this month's `dropChoices`, so a title stays out of the free grid
         after its month ends (see `_cleanEntry`). */
      if (book.drop) return false;
      if (_langFilter !== 'all' && book.language !== _langFilter) return false;
      if (_catFilter !== 'all' && book.category !== _catFilter) return false;
      if (_searchQuery) {
        var q = _searchQuery.toLowerCase();
        if (book.title.toLowerCase().indexOf(q) === -1 &&
            book.author.toLowerCase().indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function _isIndiaLocale() {
    var lang = (navigator.language || '').toLowerCase();
    return lang.startsWith('hi') || lang.indexOf('-in') !== -1;
  }

  /* One ordering for everyone (owner, 2026-11-24). An India locale used to get
     social_justice, constitution_law and every Hindi title first — a promo-era
     weighting that opened a global library on nine caste titles in its first
     ten cards. Those books already have their own chip for anyone who wants
     them, which is the right place for a subject to be surfaced on request
     rather than by default.

     Region now decides exactly one thing, and it is about language, not
     subject: outside India, Hindi titles sort after English, because 141 of the
     150 are English and the tab defaults to English there anyway. Inside India
     they are mixed in, since the tab defaults to All.

     Nothing is ranked *down* on subject either — social_justice and
     constitution_law sit mid-table, so the shelf is neutral rather than
     inverted (the old non-India branch put them 10th and 11th of twelve, which
     was the same editorial thumb pressing the other way).

     This array is the whole ordering. Edit it to re-weight the shelf; a
     remotely-declared category (§12) is not in it and sorts after everything
     named here. */
  var _CATEGORY_ORDER = [
    'classics', 'philosophy', 'poetry', 'biography_history',
    'history_politics', 'social_justice', 'constitution_law', 'drama',
    'essays', 'science_fiction', 'buddhism', 'strategy',
  ];

  function _categoryRank(cat) {
    var i = _CATEGORY_ORDER.indexOf(cat);
    return i === -1 ? _CATEGORY_ORDER.length : i;
  }

  /* How long a new arrival keeps the top of the grid, when the entry carries an
     `addedAt` to count from. */
  var _ARRIVAL_DAYS = 30;

  /* A book added after this build shipped, which the reader has not taken yet.
     Two ways it stops being one, because one is not enough:

     - **They downloaded it.** It is theirs; holding it at the top is telling
       someone about a book they are already reading.
     - **It aged out**, where `addedAt` says when it arrived. Without that the
       entry stays an arrival until taken — forgiving, since the field is easy
       to forget, but it means a file nobody downloads from eventually leads
       with everything in it. The date is the lever, and the validator says so
       once the file is big enough for it to matter. */
  function _isArrival(book) {
    if (!book._arrival) return false;
    if (_getSavedFileId(book.id)) return false;
    if (book.addedAt) {
      var added = Date.parse(book.addedAt + 'T00:00:00');
      if (!isNaN(added) && (Date.now() - added) > _ARRIVAL_DAYS * 86400000) return false;
    }
    return true;
  }

  function _sorted(books) {
    var mixHindi = _isIndiaLocale();
    return books.slice().sort(function(a, b) {
      /* Arrivals lead, ahead of the language rule as well as the category one:
         a book added this week is the one thing on this screen the reader has
         not already had the chance to see, and it is why the remote catalogue
         exists. Without this a new classic landed at card 42 of 151 and a new
         Hindi title at 143 — added, and effectively invisible. */
      var aNew = _isArrival(a), bNew = _isArrival(b);
      if (aNew !== bNew) return aNew ? -1 : 1;

      if (!mixHindi && a.language !== b.language) return a.language === 'hi' ? 1 : -1;
      return _categoryRank(a.category) - _categoryRank(b.category);
    });
  }

  /* In `_CATEGORY_ORDER`, not in catalogue order. The grid was reordered to open
     on classics while the chip row still led with SOCIAL JUSTICE, because this
     walked the books array and the bundled file happens to start there — the
     same promo-era ordering surviving in the one place nobody re-read. The row
     and the grid now answer to one array. */
  function _uniqueCategories(books) {
    var seen = {};
    var cats = [];
    books.forEach(function(b) {
      if (!seen[b.category]) { seen[b.category] = true; cats.push(b.category); }
    });
    return cats.sort(function(a, b) { return _categoryRank(a) - _categoryRank(b); });
  }

  /* The categories the app can actually render. One list, because three things
     have to agree about it: this label lookup, `_CATEGORY_ORDER`, and the
     `freebooks.cat.*` keys in en.json and hi.json. It was two lists once
     and six of the twelve chips rendered as raw slugs (Phase A).

     It is also why a category cannot be introduced remotely: a book in an
     unknown one would draw its slug on a chip and sort last by accident, and no
     remote file can add an i18n key. `_cleanEntry()` drops such an entry and
     `scripts/catalog/validate.mjs` refuses to let one be committed, so a new
     category is an app release — deliberately. */
  var _CATEGORY_KEYS = [
    'social_justice', 'constitution_law', 'philosophy', 'classics',
    'buddhism', 'biography_history', 'poetry', 'history_politics',
    'science_fiction', 'drama', 'essays', 'strategy',
  ];

  /* Categories the remote file declares for itself, slug -> { en, hi }. The
     twelve above are the offline floor — the bundled books use them and they
     have real i18n keys — and this is how the catalogue grows a genre without
     an app release, which is the whole point of a remote file. A book may use
     either.

     The label lives in the data rather than en.json because a release is
     exactly what it must not need. §16 still governs app chrome; a category
     name is catalogue metadata that arrives with the catalogue. */
  var _remoteCategories = {};

  /* Lowercase slug, matching the twelve. Bounded because it reaches a DOM
     attribute and a filter comparison. */
  var _CAT_SLUG = /^[a-z][a-z0-9_]{1,31}$/;

  function _isKnownCategory(cat, declared) {
    if (_CATEGORY_KEYS.indexOf(cat) !== -1) return true;
    return !!(declared && Object.prototype.hasOwnProperty.call(declared, cat));
  }

  function _categoryLabel(cat) {
    if (_CATEGORY_KEYS.indexOf(cat) !== -1) return t('freebooks.cat.' + cat);

    var declared = _remoteCategories[cat];
    if (declared) {
      /* `hi` is optional and falls back to `en`: a Hindi reader seeing an
         English chip is a small wrong, where refusing the entry outright
         would hide the book from everyone (§1.5). The validator warns. */
      var lang = (typeof FlowReadI18n !== 'undefined' && FlowReadI18n.currentLang)
        ? FlowReadI18n.currentLang() : 'en';
      return declared[lang] || declared.en || cat;
    }
    return cat;
  }

  /* A declared category is kept only if it can be *labelled*. Without a label
     the chip would read as a raw slug, which is the Phase A defect arriving by
     a new route. A slug that shadows one of the twelve is ignored, so the
     app's own translated label always wins. */
  function _cleanCategories(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;

    var slugs = Object.keys(raw);
    var kept = 0;
    for (var i = 0; i < slugs.length && kept < _REMOTE_MAX_CATEGORIES; i++) {
      var slug = slugs[i];
      if (!_CAT_SLUG.test(slug)) continue;
      if (_CATEGORY_KEYS.indexOf(slug) !== -1) continue;

      var v = raw[slug];
      if (!v || typeof v !== 'object') continue;
      if (typeof v.en !== 'string' || !v.en) continue;

      var entry = { en: v.en };
      if (typeof v.hi === 'string' && v.hi) entry.hi = v.hi;
      out[slug] = entry;
      kept++;
    }
    return out;
  }

  /* ── Card HTML ───────────────────────────────────────────────── */

  function _actionHtml(state, bookId) {
    if (state === 'downloading') {
      return '<span class="fb-dl-state fb-dl-loading">' + t('freebooks.state.downloading') + '</span>';
    }
    if (state === 'downloaded') {
      return [
        '<span class="fb-dl-state fb-dl-done">' + t('freebooks.state.open') + '</span>',
        '<button class="fb-redl-btn" data-redl-id="' + escapeHtml(bookId) + '" type="button" title="Re-download">↺</button>',
      ].join('');
    }
    return '<span class="fb-dl-state fb-dl-idle">' + t('freebooks.state.download') + '</span>';
  }

  /* Two initials from title for the cover placeholder */
  function _initials(title) {
    return title.split(' ').slice(0, 2).map(function(w) { return w.charAt(0); }).join('').toUpperCase();
  }

  /* Deterministic accent colour from book id */
  var _COVER_COLORS = ['#2a4a3a', '#3a2a4a', '#3a3a2a', '#2a3a4a', '#4a2a3a', '#2a4a4a'];
  function _coverColor(bookId) {
    var hash = 0;
    for (var i = 0; i < bookId.length; i++) hash = (hash * 31 + bookId.charCodeAt(i)) >>> 0;
    return _COVER_COLORS[hash % _COVER_COLORS.length];
  }

  function _cardHtml(book) {
    var state = _getState(book);
    var langLabel = book.language === 'hi' ? 'हिंदी' : 'English';
    var coverHtml;
    if (book.coverImage) {
      /* Show actual cover; retry once against the mirror, then fall back to the
         initials placeholder. An <img> never goes through fetch(), so it cannot
         use _fetchBook() and needs its own hop — without it a Gutenberg outage
         leaves 127 of 150 cards blank even though the mirror has every cover. */
      var coverMirror = _mirrorUrl(book.coverImage);
      /* Once the host is known down, later cards go straight to the mirror —
         otherwise every one of them waits for its own 503 first. */
      var coverSrc = (coverMirror && _pgDown) ? coverMirror : book.coverImage;
      coverHtml = [
        '<div class="fb-card-cover fb-card-cover-img" style="background:' + _coverColor(book.id) + '">',
        '<img class="fb-cover-img" src="' + escapeHtml(coverSrc) + '" alt="" loading="lazy"',
        (coverMirror && coverSrc !== coverMirror) ? ' data-mirror="' + escapeHtml(coverMirror) + '"' : '',
        ' onerror="if(this.dataset.mirror){var m=this.dataset.mirror;this.removeAttribute(\'data-mirror\');FreeBooksView.noteHostDown();this.src=m;}',
        'else{this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';}">',
        '<span class="fb-card-initials" style="display:none">' + escapeHtml(_initials(book.title)) + '</span>',
        '</div>',
      ].join('');
    } else {
      coverHtml = [
        '<div class="fb-card-cover" style="background:' + _coverColor(book.id) + '">',
        '<span class="fb-card-initials">' + escapeHtml(_initials(book.title)) + '</span>',
        '</div>',
      ].join('');
    }
    return [
      '<div class="fb-card" data-book-id="' + escapeHtml(book.id) + '" role="button" tabindex="0">',
      coverHtml,
      '<div class="fb-card-info">',
      '<p class="fb-card-title">' + escapeHtml(book.title) + '</p>',
      '<p class="fb-card-author">' + escapeHtml(book.author) + '</p>',
      '<div class="fb-card-meta">',
      '<span class="fb-card-lang-tag">' + langLabel + '</span>',
      book.approxLength ? '<span class="fb-card-length">' + escapeHtml(book.approxLength) + '</span>' : '',
      '</div>',
      '</div>',
      '<div class="fb-card-action" data-action-for="' + escapeHtml(book.id) + '">',
      _actionHtml(state, book.id),
      '</div>',
      '</div>',
    ].join('');
  }

  /* ── The monthly drop section (§12, §23) ─────────────────────
     Three states, and the difference between them is `AppState.isPro` —
     *either* paid tier (owner, 2026-11-24, reversing the original
     subscriber-only gate). A lifetime purchase is the cash that funds the
     project now, so it buys the monthly books too; the subscription keeps no
     exclusive of its own, which §3 records as a deliberate, temporary cost.
     The tag therefore says `Pro`, not `Plus` — the old rule said the exact
     opposite, for the opposite gate.

     Free        — real cards, muted, tagged `Pro`, tap opens the paywall.
                   Nothing blurred and nothing invented (§23 rule 2); a muted
                   card that does nothing is the silent failure rule 1 exists
                   to stop.
     Subscriber  — the same cards tagged `New`, one claimable.
     Claimed     — the claimed card behaves like any catalogue card (download,
                   open, re-download); the others state the claim is spent
                   rather than going dead.

     The section hides itself whenever a filter or search is active: it is not
     part of the grid being filtered, and leaving it pinned above a search for
     something else reads as a result. */

  function _dropTagHtml(book, claimedId) {
    if (!AppState.isPro) {
      return '<span class="fb-drop-tag fb-drop-tag-plus">' + t('freebooks.drops.tag_locked') + '</span>';
    }
    /* §12: the `New` tag retires on download, and on the month rolling over —
       which `_claimedThisMonth` already encodes, since a claim from an older
       month does not match. A permanent tag is noise within a week. */
    if (claimedId === book.id || _getSavedFileId(book.id)) return '';
    return '<span class="fb-drop-tag fb-drop-tag-new">' + t('freebooks.drops.tag_new') + '</span>';
  }

  function _dropActionHtml(book, claimedId) {
    if (!AppState.isPro) {
      return '<span class="fb-dl-state fb-dl-idle">' + t('freebooks.drops.claim') + '</span>';
    }
    if (claimedId === book.id) return _actionHtml(_getState(book), book.id);
    if (claimedId) return '<span class="fb-dl-state fb-dl-spent">' + t('freebooks.drops.spent') + '</span>';
    return '<span class="fb-dl-state fb-dl-idle">' + t('freebooks.drops.claim') + '</span>';
  }

  function _dropCardHtml(book, claimedId) {
    var muted = !AppState.isPro || (claimedId && claimedId !== book.id);
    var html = _cardHtml(book);
    /* Built from the ordinary card so the cover, title, author and language
       tag have exactly one implementation — these are real catalogue entries
       and must look like them. Only the wrapper class, the tag and the action
       differ. */
    html = html.replace('class="fb-card"', 'class="fb-card fb-drop-card' + (muted ? ' fb-drop-card-muted' : '') + '"');
    html = html.replace('<div class="fb-card-info">',
                        _dropTagHtml(book, claimedId) + '<div class="fb-card-info">');
    var actionOpen = '<div class="fb-card-action" data-action-for="' + escapeHtml(book.id) + '">';
    var cut = html.indexOf(actionOpen);
    if (cut !== -1) {
      html = html.slice(0, cut) + actionOpen + _dropActionHtml(book, claimedId) + '</div></div>';
    }
    return html;
  }

  /* The benefit line. §12 forbids a hardcoded count — `3` written into
     `en.json` is a confident wrong number (§1.5) the first month a drop ships
     short, and a translated one cannot be corrected without a release. The
     figure comes from what is actually on offer, or the line omits it. */
  function _dropBenefitHtml(books, claimedId) {
    /* The claim confirms here rather than in a modal. §20 allows one modal at
       a time and this screen already opens one for the paywall; more to the
       point, a claim is a card-level act and the benefit line is the only
       full-width space the section owns, so the question can be asked in full
       without truncating the title (§22 rule 4's reasoning). Cancel leaves no
       trace, which is what makes a single tap safe to commit from. */
    if (_pendingClaimId) {
      var pending = books.find(function(b) { return b.id === _pendingClaimId; });
      if (pending) {
        return [
          '<div class="fb-drop-confirm">',
          '<p class="fb-drop-benefit">',
          escapeHtml(t('freebooks.drops.confirm').replace('{title}', pending.title)),
          '</p>',
          '<div class="fb-drop-confirm-actions">',
          '<button class="btn btn-primary fb-drop-yes" type="button">' + t('freebooks.drops.claim') + '</button>',
          '<button class="btn btn-ghost fb-drop-no" type="button">' + t('btn.cancel') + '</button>',
          '</div>',
          '</div>',
        ].join('');
      }
    }
    if (!AppState.isPro) {
      return '<p class="fb-drop-benefit">' + t('freebooks.drops.benefit_free') + '</p>';
    }
    if (claimedId) return '<p class="fb-drop-benefit">' + t('freebooks.drops.spent') + '</p>';
    return '<p class="fb-drop-benefit">' +
      t('freebooks.drops.benefit_sub').replace('{count}', String(books.length)) + '</p>';
  }

  function _renderDrops() {
    var host = document.getElementById('fb-drops');
    if (!host) return;

    var books = _dropBooks();
    var filtering = _searchQuery || _catFilter !== 'all' || _langFilter !== 'all';
    if (!books.length || filtering) { host.innerHTML = ''; return; }

    var claimedId = _claimedThisMonth();
    host.innerHTML = [
      '<h2 class="fb-drop-heading">' + t('freebooks.drops.heading') + '</h2>',
      _dropBenefitHtml(books, claimedId),
      '<div class="fb-books-grid fb-drop-grid">',
      books.map(function(b) { return _dropCardHtml(b, claimedId); }).join(''),
      '</div>',
    ].join('');
  }

  /* ── Partial re-renders ──────────────────────────────────────── */

  function _refreshAction(bookId) {
    var book = _catalog && _catalog.books.find(function(b) { return b.id === bookId; });
    if (!book) return;
    var el = document.querySelector('[data-action-for="' + bookId + '"]');
    if (el) el.innerHTML = book.drop
      ? _dropActionHtml(book, _claimedThisMonth())
      : _actionHtml(_getState(book), bookId);
  }

  function _renderGrid() {
    var grid = document.getElementById('fb-books-grid');
    if (!grid || !_catalog) return;
    var books = _sorted(_filtered(_catalog.books));
    var head = document.getElementById('fb-free-heading');
    if (books.length === 0) {
      grid.innerHTML = '<p class="fb-empty">' + t('freebooks.empty') + '</p>';
      /* No heading over an empty grid: "0 books, free to read" is a worse
         answer than the empty-state sentence (§1.5). */
      if (head) head.hidden = true;
      return;
    }
    if (head) {
      /* Counted off what is actually on screen, so it stays true under a
         filter or a search rather than promising 150 and showing twelve. The
         remote catalogue can also push the figure past 150 at any time, so it
         may never be written into a string (§12). Through `tn`, because a
         search for one rare title would otherwise render "1 books". */
      head.textContent = tn('freebooks.free_heading', books.length,
        { count: String(books.length) });
      head.hidden = false;
    }
    grid.innerHTML = books.map(_cardHtml).join('');
  }

  function _renderLangTabs() {
    document.querySelectorAll('.fb-lang-tab').forEach(function(tab) {
      tab.classList.toggle('fb-lang-tab-active', tab.dataset.lang === _langFilter);
    });
  }

  /* The chip row, built in one place because two callers need it: the first
     render and a refresh that brought a category the row has never shown.

     `_categoryLabel` can now return owner-supplied text from a public repo, so
     it is escaped here — `t()` strings never needed it, and that is exactly
     how an escape gets forgotten when the source of a string changes.

     If the active filter's category disappeared, the filter falls back to
     "all" rather than leaving an empty grid with no chip lit (§1.5). */
  function _rebuildCatChips() {
    var row = document.getElementById('fb-cat-chips');
    if (!row || !_catalog) return;

    var cats = _uniqueCategories(_catalog.books);
    if (_catFilter !== 'all' && cats.indexOf(_catFilter) === -1) _catFilter = 'all';

    row.innerHTML = [
      '<button class="fb-cat-chip' + (_catFilter === 'all' ? ' fb-cat-chip-active' : '') +
        '" data-cat="all" type="button">' + escapeHtml(t('freebooks.cat.all')) + '</button>',
      cats.map(function(cat) {
        return '<button class="fb-cat-chip' + (_catFilter === cat ? ' fb-cat-chip-active' : '') +
          '" data-cat="' + escapeHtml(cat) + '" type="button">' +
          escapeHtml(_categoryLabel(cat)) + '</button>';
      }).join(''),
    ].join('');
  }

  function _renderCatChips() {
    document.querySelectorAll('.fb-cat-chip').forEach(function(chip) {
      chip.classList.toggle('fb-cat-chip-active', chip.dataset.cat === _catFilter);
    });
  }

  /* ── Download pipeline ───────────────────────────────────────── */

  /* Clear a stale freebook entry — removes both the freebook pointer and library entry */
  function _clearStaleEntry(bookId, fileId) {
    localStorage.removeItem('fr_freebook_' + bookId);
    if (fileId) removeFileFromLibrary(fileId);
  }

  /* A tap on a drop card. Four outcomes, and the first is the one §23 rule 1
     exists for: a muted card that does nothing is both a silent failure and
     the best-timed paywall in the app thrown away — the user has just pointed
     at exactly what they would be buying. */
  async function _handleDropTap(book) {
    if (!AppState.isPro) {
      showPaywall('book-drop');
      return;
    }

    var claimedId = _claimedThisMonth();

    /* Already theirs: an ordinary catalogue card from here on — download,
       open, re-download. A claimed book is kept for good (§12), so nothing
       about this path checks the subscription again. */
    if (claimedId === book.id) { _handleCardTap(book); return; }

    /* Spent on something else this month. Said plainly rather than left as a
       dead card (§1.5); the section already says so in the benefit line. */
    if (claimedId) { showToast(t('freebooks.drops.spent')); return; }

    _pendingClaimId = book.id;
    _renderDrops();
  }

  async function _claimBook(book) {
    if (!_drop || !AppState.isPro || _claimedThisMonth()) return;

    /* Recorded before the download, not after. A download can fail or be
       interrupted; the claim is the entitlement and the card must come back as
       theirs either way, with the ordinary re-download path to retry. The
       reverse order loses the claim to a dropped connection. */
    await _saveClaim(_drop.month, book.id);
    _renderDrops();

    logEvent('drop_claimed', {
      lang: book.language || '',
      category: book.category || '',
    });

    _handleCardTap(book);   /* downloads it, with the usual progress states */
  }

  async function _handleCardTap(book) {
    var state = _getState(book);

    if (state === 'downloading') return;

    if (state === 'downloaded') {
      var fileId = _getSavedFileId(book.id);
      var lib = loadLibrary();
      var entry = lib.find(function(item) { return item.id === fileId; });

      if (entry && entry.wordCount > 0) {
        /* Book is in library with real content — open it */
        resumeFromLibrary(entry, 'free-books');
        return;
      }

      /* Entry missing or has 0 words (stale from a previously failed download) —
         clear the bad state and fall through to re-download */
      _clearStaleEntry(book.id, fileId);
    }

    /* Start download */
    _downloading[book.id] = true;
    _refreshAction(book.id);
    showLoading(t('freebooks.loading.downloading', { title: book.title }));

    try {
      var response = await _fetchBook(book.sourceUrl);

      var buffer = await _readWithProgress(response, book);

      if (book.fileType === 'txt') {
        var text = new TextDecoder('utf-8').decode(buffer);
        await _importTxt(book, text);
      } else {
        await _importPdf(book, buffer);
      }
    } catch (e) {
      hideLoading();
      _downloading[book.id] = false;
      _refreshAction(book.id);
      /* Only a fetch sets `reason`; a parse failure keeps the generic message. */
      showToast(t(e && e.reason === 'server'
        ? 'freebooks.error.download_server'
        : 'freebooks.error.download_failed', { title: book.title }));
    }
  }

  /* Stream response body, updating loading message with download progress.
     Falls back to arrayBuffer() if streaming unavailable (older WebViews). */
  async function _readWithProgress(response, book) {
    var msg = document.getElementById('loading-message');
    var lenHeader = response.headers.get('Content-Length');
    var total = lenHeader ? parseInt(lenHeader, 10) : 0;

    if (!response.body || !response.body.getReader) {
      return await response.arrayBuffer();
    }

    var reader = response.body.getReader();
    var chunks = [];
    var received = 0;
    var lastUpdate = 0;

    while (true) {
      var res = await reader.read();
      if (res.done) break;
      chunks.push(res.value);
      received += res.value.length;

      var now = Date.now();
      if (msg && now - lastUpdate > 100) {
        lastUpdate = now;
        if (total > 0) {
          var pct = Math.min(99, Math.floor((received / total) * 100));
          msg.textContent = t('freebooks.loading.downloading_pct', { title: book.title, pct: pct });
        } else {
          var mb = (received / (1024 * 1024)).toFixed(1);
          msg.textContent = t('freebooks.loading.downloading_mb', { title: book.title, mb: mb });
        }
      }
    }

    var buffer = new Uint8Array(received);
    var offset = 0;
    for (var i = 0; i < chunks.length; i++) {
      buffer.set(chunks[i], offset);
      offset += chunks[i].length;
    }
    return buffer.buffer;
  }

  async function _importPdf(book, arrayBuffer) {
    window._pdfParseProgress = function(current, total) {
      var msg = document.getElementById('loading-message');
      if (msg) msg.textContent = t('loading.processing_page', { current: current, total: total });
    };

    var storedBuffer = arrayBuffer.slice(0);
    var result = await parsePDF(arrayBuffer.slice(0));

    /* Derived before OCR, not after: it is the key an interrupted OCR run is
       checkpointed under, so it has to exist before the first page is read. */
    var fileName = book.title + '.pdf';
    var fileId = generateFileId('freebook', book.id, book.sourceUrl);

    /* Free Books OCR path: run OCR automatically when any of:
       (a) no text layer at all (scanned PDF),
       (b) text layer exists but uses legacy Indic font encoding detected by heuristics,
       (c) catalog entry explicitly marks requiresOcr:true — for PDFs whose encoding
           evades the heuristics but are known to produce garbage text,
       (d) the text layer is Unicode but a measurable share of it is outside the
           scripts this catalogue is written in — वीजा का इंतजार emits a raw glyph
           code for every conjunct, so the page reads `मु摯戠ण` for `मुद्रण` (16.35).
           OCR reads the printed glyphs, which are correct.
       No paid-access check: OCR add-on gates user-uploaded documents, not curated catalog books. */
    if (!result.metadata.hasTextLayer || result.metadata.hasLegacyEncoding
        || result.metadata.hasBrokenGlyphs || book.requiresOcr) {
      showLoading(t('loading.running_ocr'));
      showToast(t('toast.ocr_keep_open'));
      acquireWakeLock();
      var ocrResult;
      try {
        ocrResult = await ocrScannedPdf(result.pdfDoc, fileId);
      } catch (_) {
        hideLoading();
        releaseWakeLock();
        _downloading[book.id] = false;
        _refreshAction(book.id);
        showToast(t('freebooks.error.download_failed', { title: book.title }));
        return;
      }
      releaseWakeLock();

      if (!ocrResult.metadata.wordCount) {
        hideLoading();
        _downloading[book.id] = false;
        _refreshAction(book.id);
        showToast(t('freebooks.error.download_failed', { title: book.title }));
        return;
      }

      result.words = ocrResult.words;
      result.pageWordIndex = ocrResult.pageWordIndex;
      result.rawLines = ocrResult.rawLines;
      result.metadata = Object.assign({}, result.metadata, ocrResult.metadata);
    }

    /* Guard: only persist if parsing produced real content */
    if (!result.words || result.words.length === 0) {
      hideLoading();
      _downloading[book.id] = false;
      _refreshAction(book.id);
      showToast(t('freebooks.error.download_failed', { title: book.title }));
      return;
    }

    AppState.currentFile = {
      id: fileId,
      kind: 'pdf',
      name: fileName,
      words: result.words,
      pageWordIndex: result.pageWordIndex,
      rawLines: result.rawLines,
      metadata: Object.assign({}, result.metadata, { sourceType: 'pdf' }),
      pdfDoc: result.pdfDoc,
    };
    AppState.currentIndex = loadPosition(fileId);

    /* Persist only after confirming real content — prevents stuck "Open ✓" cards.
       Saved as 'catalogue' so it is not counted as an import (§9.6): it has
       free_book_downloaded of its own, and the two must not conflate. */
    saveFileToLibrary({
      id: fileId,
      kind: 'pdf',
      name: fileName,
      /* Kept for the share card's typographic cover (§15): a TXT book has no
         page to render one from, so the catalogue's author line is the only
         thing that makes the placeholder look like a book rather than a box. */
      author: book.author || '',
      /* The catalogue's shelf label, carried onto the library entry so
         `book_opened` can report which *kind* of free book gets read without
         loading the catalogue (§8.6). Only a catalogue download writes it, so
         a self-imported file has no `category` at all — absent, not blank,
         which is the §1.4 line. */
      category: book.category || '',
      wordCount: result.metadata.wordCount,
      pageCount: result.metadata.pageCount,
      lastOpened: Date.now(),
    }, 'catalogue');

    await saveFileData(fileId, AppState.currentFile);
    saveRawPdf(fileId, storedBuffer);

    _setSavedFileId(book.id, fileId);
    _keepCover(book, fileId);
    _downloading[book.id] = false;
    /* `category` added 2026-11-24 (owner): which *kinds* of free book get
       taken. A catalogue slug is public — it is printed on a chip in a library
       anyone can open — and never a title or an id (§8.6). */
    logEvent('free_book_downloaded', {
      lang: book.language || '',
      category: book.category || '',
    });

    hideLoading();
    AppState.readerSource = 'free-books';
    renderReader({ silentResume: true });
    switchView('view-reader');
  }

  /* Strip Project Gutenberg boilerplate so only the actual book text is read */
  function _stripGutenberg(text) {
    var startRe = /\*{3}\s*START OF (?:THE )?PROJECT GUTENBERG[^\n]*\*{3}/i;
    var endRe   = /\*{3}\s*END OF (?:THE )?PROJECT GUTENBERG[^\n]*/i;

    var startIdx = text.search(startRe);
    if (startIdx !== -1) {
      var lineEnd = text.indexOf('\n', startIdx);
      text = lineEnd !== -1 ? text.slice(lineEnd + 1).trimStart() : text.slice(startIdx).trimStart();
    }

    var endIdx = text.search(endRe);
    if (endIdx !== -1) {
      text = text.slice(0, endIdx).trimEnd();
    }

    return text;
  }

  async function _importTxt(book, text) {
    text = _stripGutenberg(text);
    var encoded = new TextEncoder().encode(text).buffer;
    var result = await parseTXT(encoded);

    /* Guard: only persist if parsing produced real content */
    if (!result.words || result.words.length === 0) {
      hideLoading();
      _downloading[book.id] = false;
      _refreshAction(book.id);
      showToast(t('freebooks.error.download_failed', { title: book.title }));
      return;
    }

    var fileName = book.title + '.txt';
    var fileId = generateFileId('freebook', book.id, book.sourceUrl);

    AppState.currentFile = {
      id: fileId,
      kind: 'txt',
      name: fileName,
      words: result.words,
      pageWordIndex: result.pageWordIndex,
      rawLines: result.rawLines,
      metadata: Object.assign({}, result.metadata, { sourceType: 'txt' }),
      pdfDoc: null,
    };
    AppState.currentIndex = loadPosition(fileId);

    /* Persist only after confirming real content — prevents stuck "Open ✓" cards.
       Saved as 'catalogue' so it is not counted as an import (§9.6): it has
       free_book_downloaded of its own, and the two must not conflate. */
    saveFileToLibrary({
      id: fileId,
      kind: 'txt',
      name: fileName,
      /* Kept for the share card's typographic cover (§15): a TXT book has no
         page to render one from, so the catalogue's author line is the only
         thing that makes the placeholder look like a book rather than a box. */
      author: book.author || '',
      /* The catalogue's shelf label, carried onto the library entry so
         `book_opened` can report which *kind* of free book gets read without
         loading the catalogue (§8.6). Only a catalogue download writes it, so
         a self-imported file has no `category` at all — absent, not blank,
         which is the §1.4 line. */
      category: book.category || '',
      wordCount: result.metadata.wordCount,
      pageCount: result.metadata.pageCount,
      lastOpened: Date.now(),
    }, 'catalogue');

    await saveFileData(fileId, AppState.currentFile);

    _setSavedFileId(book.id, fileId);
    _keepCover(book, fileId);
    _downloading[book.id] = false;
    logEvent('free_book_downloaded', { lang: book.language || '' });

    hideLoading();
    AppState.readerSource = 'free-books';
    renderReader({ silentResume: true });
    switchView('view-reader');
  }

  /* ── Event wiring ─────────────────────────────────────────────── */

  function _bindEvents(view) {
    document.getElementById('fb-btn-back').addEventListener('click', function() {
      renderUpload();
      switchView('view-upload');
    });

    view.querySelectorAll('.fb-lang-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        _langFilter = this.dataset.lang;
        _renderLangTabs();
        _renderDrops();
        _renderGrid();
      });
    });

    document.getElementById('fb-cat-chips').addEventListener('click', function(e) {
      var chip = e.target.closest('.fb-cat-chip');
      if (!chip) return;
      _catFilter = chip.dataset.cat;
      _renderCatChips();
      _renderDrops();
      _renderGrid();
    });

    document.getElementById('fb-search').addEventListener('input', function() {
      _searchQuery = this.value.trim();
      _renderDrops();   /* the section hides while a search is active */
      _renderGrid();
    });

    /* The drop section is its own delegated surface. It sits outside
       `fb-books-grid` deliberately (§23: never mixed into the catalogue grid),
       so it needs its own listener rather than a wider selector that would
       quietly re-admit drop cards to the grid's handler. */
    document.getElementById('fb-drops').addEventListener('click', function(e) {
      if (e.target.closest('.fb-drop-yes')) {
        var book = _dropBooks().find(function(b) { return b.id === _pendingClaimId; });
        _pendingClaimId = null;
        if (book) _claimBook(book);
        else _renderDrops();
        return;
      }
      if (e.target.closest('.fb-drop-no')) {
        _pendingClaimId = null;
        _renderDrops();
        return;
      }

      var redl = e.target.closest('.fb-redl-btn');
      if (redl) {
        e.stopPropagation();
        var rid = redl.dataset.redlId;
        var rbook = _catalog && _catalog.books.find(function(b) { return b.id === rid; });
        if (!rbook) return;
        _clearStaleEntry(rid, _getSavedFileId(rid));
        _renderDrops();
        _handleCardTap(rbook);
        return;
      }

      var dcard = e.target.closest('.fb-drop-card');
      if (!dcard) return;
      var dbook = _dropBooks().find(function(b) { return b.id === dcard.dataset.bookId; });
      if (dbook) _handleDropTap(dbook);
    });

    /* Event delegation — distinguish ↺ re-download from main card tap */
    document.getElementById('fb-books-grid').addEventListener('click', function(e) {
      /* ↺ re-download button — clear stale entry and re-download fresh */
      var redlBtn = e.target.closest('.fb-redl-btn');
      if (redlBtn) {
        e.stopPropagation();
        var bookId = redlBtn.dataset.redlId;
        var book = _catalog && _catalog.books.find(function(b) { return b.id === bookId; });
        if (!book) return;
        var fileId = _getSavedFileId(bookId);
        _clearStaleEntry(bookId, fileId);
        _refreshAction(bookId);
        _handleCardTap(book);
        return;
      }

      /* Main card tap — open or download */
      var card = e.target.closest('.fb-card');
      if (!card) return;
      var bookId = card.dataset.bookId;
      var book = _catalog && _catalog.books.find(function(b) { return b.id === bookId; });
      if (book) _handleCardTap(book);
    });
  }

  /* ── Public: render ──────────────────────────────────────────── */

  async function render() {
    var view = document.getElementById('view-free-books');
    if (!view) return;

    var catalog = await _loadCatalog();

    view.innerHTML = [
      '<div class="fb-screen">',

      '<header class="fb-header">',
      '<button class="btn btn-ghost fb-back-btn" id="fb-btn-back" type="button">←</button>',
      '<h1 class="fb-heading">' + t('freebooks.title') + '</h1>',
      '</header>',

      '<div class="fb-controls">',

      '<div class="fb-lang-tabs" role="tablist">',
      '<button class="fb-lang-tab' + (_langFilter === 'all' ? ' fb-lang-tab-active' : '') + '" data-lang="all" type="button" role="tab">' + t('freebooks.lang.all') + '</button>',
      '<button class="fb-lang-tab' + (_langFilter === 'en' ? ' fb-lang-tab-active' : '') + '" data-lang="en" type="button" role="tab">English</button>',
      '<button class="fb-lang-tab' + (_langFilter === 'hi' ? ' fb-lang-tab-active' : '') + '" data-lang="hi" type="button" role="tab">हिंदी</button>',
      '</div>',

      '<div class="fb-search-wrap">',
      '<input class="fb-search" id="fb-search" type="search" placeholder="' + t('freebooks.search.placeholder') + '" value="' + escapeHtml(_searchQuery) + '" autocomplete="off" />',
      '</div>',

      '<div class="fb-cat-chips" id="fb-cat-chips"></div>',

      '</div>',

      /* Above the 150 and outside their grid (§23). */
      '<div class="fb-drops" id="fb-drops"></div>',

      /* The 150 had no label at all, while the Pro picks above them carried a
         heading — so the one screen that proves §3's "the entire library is
         free" said so nowhere, and the muted cards were the only thing on it
         that named a tier. Asked for as a "free" filter chip; a chip would
         have had to sit in the row of *subject* chips, where it implies the
         other twelve are something else. A heading states it once, for
         everyone, and cannot be left switched on. */
      '<h2 class="fb-free-heading" id="fb-free-heading" hidden></h2>',
      '<div class="fb-books-grid" id="fb-books-grid"></div>',

      '<p class="fb-legal">' + t('freebooks.legal') + '</p>',

      '</div>',
    ].join('');

    _rebuildCatChips();
    _renderDrops();
    _renderGrid();
    _bindEvents(view);
    _backfillCovers(catalog.books);
  }

  /* Books downloaded before covers were kept have none, and the share card
     cannot go and get one — it fetches nothing by design (§15). This screen is
     the one place the reader is both looking at the catalogue and online, so it
     is where the gap can be closed, for the handful of titles they actually
     downloaded rather than all 150.

     Only where there is no cover at all: a PDF already carrying a rendered page
     one has a cover of the real edition, and replacing it every visit would be
     churn in exchange for a thumbnail. */
  function _backfillCovers(books) {
    if (typeof BookCover === 'undefined' || typeof BookCover.cacheRemote !== 'function') return;
    (books || []).forEach(function(book) {
      var fileId = _getSavedFileId(book.id);
      if (fileId) _keepCover(book, fileId);
    });
  }

  /* Author for a library file that came from the catalogue.
     
     Books downloaded before the author was persisted on the library item have
     nothing to put on the share card's typographic cover (§15). The bookId →
     fileId map is still there, so the catalogue can be walked backwards rather
     than asking the user to download the book again. */
  async function authorForFileId(fileId) {
    if (!fileId) return '';
    try {
      const catalog = await _loadCatalog();
      const books = (catalog && catalog.books) || [];
      for (var i = 0; i < books.length; i++) {
        if (_getSavedFileId(books[i].id) === fileId) return books[i].author || '';
      }
    } catch (_) {}
    return '';
  }

  return { render: render, authorForFileId: authorForFileId, noteHostDown: noteHostDown };
})();

function renderFreeBooks() {
  FreeBooksView.render();
}
