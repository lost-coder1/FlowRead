/* Shareable reading-stats card (Claude.md §15).
 *
 * Prioritised as a DISTRIBUTION mechanic, not a retention one (§22), which
 * decides two things about it:
 *
 *   1. It is free for everyone. The dashboard it nominally lives on is
 *      Pro-gated, and a sharer who cannot share is a channel we closed off
 *      ourselves. Product-owner decision, 2026-09-25. Hence the home-screen
 *      entry point alongside the dashboard one.
 *   2. The card is one hero stat, never a data dump (§15). Everything else is
 *      a supporting line the user can switch off before sharing.
 *
 * The image is drawn on a Canvas on the device and written to the app cache.
 * Nothing is uploaded and no server is involved (§1.4) — the native share sheet
 * hands the file straight to whichever app the user picks.
 */

const ShareStats = (function() {
  /* One entry per book/streak we have already offered to celebrate, so a
     milestone prompt appears once and never nags (§9.1's tone applies here
     too — a share is an offer, not a chore). */
  /* What a quote hero may hold in total — the quote *and* its attribution
     (§26.3). The number is not taste; it is what keeps the attribution on the
     card.

     A quote hero always carries its book's cover, so it wraps into the 496px
     side column with heroMaxLines 6. _fitHero steps the face down to 30px and,
     if even that overflows, ellipsises the **last** line — which in this hero is
     "— Book Name". An unattributed quotation of someone else's words is the one
     outcome this feature may not produce.

     Budgeting the quote alone is not enough, and testing caught it: 140
     characters plus "Hind Swaraj" fits in six lines at 32px, while the same
     quote plus "The Wealth of Nations, Volume One" runs to seven and loses the
     attribution. So the title is charged against the same budget, and a long
     title simply means a shorter quote qualifies. */
  const QUOTE_BUDGET_CHARS = 150;

  const KEY_CELEBRATED_BOOKS = 'fr_share_celebrated_books';
  const KEY_CELEBRATED_STREAKS = 'fr_share_celebrated_streaks';
  const KEY_SEEDED = 'fr_share_seeded';
  /* Debug only (§25), written by resetCelebrations() and consumed by the next
     checkMilestones() — see both for why one home render has to be skipped. */
  const KEY_DEBUG_SKIP = 'fr_debug_milestone_skip';

  /* Product decision 2026-09-25: book completion AND streak milestones. Kept
     sparse on purpose — a prompt at every streak day would be nagging. */
  const STREAK_MILESTONES = [7, 30, 100];

  /* 1080² is the safe square for every major destination and stays legible
     when a chat app downscales it to a thumbnail. */
  const CARD_SIZE = 1080;
  /* Kept beside purchase.js's subscription-management URL, which uses the same
     applicationId. Not localised — Play serves the listing in the reader's own
     language from this one link. */
  const STORE_URL = 'https://play.google.com/store/apps/details?id=com.flowread.app';
  const PAD = 88;

  /* Palette is §16 verbatim. Do not introduce new colours here — the card is
     the most public surface the app has and must read as the same product. */
  const COLORS = {
    bg: '#0d0d0d',
    panel: '#141414',
    /* --surface-2: the cover sits on the inner panel, so it needs its own step. */
    panelRaised: '#1c1c1c',
    border: '#2a2a2a',
    accent: '#e8c547',
    accent2: '#c47a3a',
    text: '#e8e4dc',
    muted: '#6b6660',
  };

  const FONT_DISPLAY = "'Roboto', 'Noto Sans Devanagari', 'Helvetica Neue', Arial, sans-serif";
  const FONT_MONO = "'DM Mono', 'Noto Sans Devanagari', 'Courier New', monospace";

  let _model = null;   /* the stats behind the currently open sheet */
  let _selection = null;
  /* What the last preview render resolved: which cover layout the card is in,
     and the books available to the picker. Known only after the covers have
     been fetched, which is why the editor's second section is decided here
     rather than when the sheet is built. */
  let _coverState = { mode: 'none', pool: [] };

  /* ── Stats ─────────────────────────────────────────────────── */

  function _dateStrOf(ms) {
    const d = new Date(ms);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  /* Days from the first session on a book to the last, inclusive — "finished it
     in 4 days" as a reader would say it, not the number of days they sat down. */
  function _daysToFinish(sessions, fileId) {
    const dates = sessions
      .filter(function(s) { return s.fileId === fileId && s.date; })
      .map(function(s) { return s.date; })
      .sort();
    if (dates.length === 0) return 0;
    const first = new Date(dates[0] + 'T00:00:00');
    const last = new Date(dates[dates.length - 1] + 'T00:00:00');
    const days = Math.round((last - first) / 86400000) + 1;
    return days > 0 ? days : 1;
  }

  function _finishedBooks(lib, sessions) {
    return lib
      .filter(function(item) { return isFileFullyRead(item); })
      .map(function(item) {
        return {
          id: item.id,
          /* The stored name is a filename; ".pdf" is not part of a book's
             title and this card is read by people who have never seen the
             app (§15). Display only — storage keeps the real name. */
          name: displayTitle(item.name),
          author: item.author || '',
          days: _daysToFinish(sessions, item.id),
          lastOpened: item.lastOpened || 0,
        };
      })
      .sort(function(a, b) { return b.lastOpened - a.lastOpened; });
  }

  /* ── Recap windows ─────────────────────────────────────────────
     Finishing a book is rare and a streak builds slowly, so for most of the
     year the card has nothing new to say. "What I read last week" renews every
     week, which is the only share occasion here that does — and §22 puts this
     product in a distribution bottleneck, not a retention one.

     Offered, never prompted (owner, 2026-11-20): these appear as choices in the
     sheet and nothing goes looking for the user. A recap that arrives
     unbidden in a week when they read nothing is the guilt framing §9.1 rules
     out, and there is no honest version of it.

     "This year" rather than "last year", also deliberate. Last year is empty
     for every current user and would stay empty for eleven months — shipping a
     surface that is broken until December is how it gets forgotten. Year to
     date is true from the first day and becomes a year in review on its own. */
  const WINDOWS = [
    { id: 'week',  days: 7 },
    { id: 'month', days: 30 },
    { id: 'year',  ytd: true },
  ];

  function _windowFloor(win) {
    const now = new Date();
    if (win.ytd) return now.getFullYear() + '-01-01';
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (win.days - 1));
    return _dateStrOf(from.getTime());
  }

  /* A finished book has no recorded finish date — §5.2 makes completion a
     *position*, so there is no event to stamp. The last session on the book is
     the closest honest proxy, and the copy says "finished" rather than claiming
     a date. A re-read moves it, which over-counts the recent window by a book
     someone revisited; the alternative is storing a finish timestamp, which
     would be a new piece of state that disagrees with the derived completion
     the moment a reader pages backwards off the end. */
  function _lastSessionDate(sessions, fileId) {
    let latest = '';
    for (var i = 0; i < sessions.length; i++) {
      const sess = sessions[i];
      if (sess.fileId === fileId && sess.date && sess.date > latest) latest = sess.date;
    }
    return latest;
  }

  /* The substance gate (owner, 2026-11-20). A window is offered only when it
     holds something a stranger would find worth reading: a finished book, three
     days of reading, or an hour. The first gate was `days >= 2`, which let
     through "1,200 words in the last 7 days" — true, and a card nobody shares.

     The owner's first proposal was to require a 7-day streak or a finished
     book, and this is the counter that was accepted: a streak is *consecutive*
     days, so it measures consistency when the card is about volume — someone
     who read four days this week with two hours logged has a good recap and may
     never string seven days together. Milestones were also the wrong thing to
     hang it on mechanically: they are celebrate-once and carry spent-flag sets,
     where a recap is an always-available option.

     If this needs tightening later, these three numbers are the lever. */
  const RECAP_MIN_DAYS = 3;
  const RECAP_MIN_MINUTES = 60;

  function _worthRecapping(recap) {
    return recap.books > 0
      || recap.days >= RECAP_MIN_DAYS
      || recap.minutes >= RECAP_MIN_MINUTES;
  }

  function _recaps(sessions, finished) {
    return WINDOWS.map(function(win) {
      const floor = _windowFloor(win);
      const inWindow = sessions.filter(function(sess) { return sess.date && sess.date >= floor; });
      const recap = {
        id: win.id,
        words: inWindow.reduce(function(acc, sess) { return acc + (sess.wordsRead || 0); }, 0),
        minutes: Math.floor(inWindow.reduce(function(acc, sess) { return acc + (sess.durationMs || 0); }, 0) / 60000),
        bookList: finished.filter(function(book) {
          const when = _lastSessionDate(sessions, book.id);
          return when && when >= floor;
        }),
        days: new Set(inWindow.map(function(sess) { return sess.date; })).size,
      };
      recap.books = recap.bookList.length;
      return recap;
    });
  }

  function collectStats() {
    const sessions = loadReadingSessions();
    const lib = loadLibrary();
    const finished = _finishedBooks(lib, sessions);

    return {
      streak: computeStreak(sessions),
      totalWords: sessions.reduce(function(acc, s) { return acc + (s.wordsRead || 0); }, 0),
      totalMinutes: Math.floor(sessions.reduce(function(acc, s) { return acc + (s.durationMs || 0); }, 0) / 60000),
      finished: finished,
      recaps: _recaps(sessions, finished),
    };
  }

  /* Candidate heroes, strongest first. A finished book names something real and
     is far more shareable than a number, so it always outranks the counters. */
  function _heroOptions(stats) {
    const out = [];

    /* Two, not five. The list is sorted by lastOpened, so past the recent
       couple nobody is reading down a radio list to find a book — and five book
       rows plus the counters plus the recaps was most of why the sheet read as a
       configuration exercise rather than an offer. */
    stats.finished.slice(0, 2).forEach(function(book) {
      out.push({
        id: 'book:' + book.id,
        book: book,
        label: t('share.item.book', { book: book.name }),
        /* "in 1 days" on the one surface strangers see. The single-day case is
           also the most impressive one, so it gets its own sentence. */
        text: book.days > 1
          ? t('share.hero.book_days', { book: book.name, n: book.days })
          : (book.days === 1
              ? t('share.hero.book_one_day', { book: book.name })
              : t('share.hero.book', { book: book.name })),
      });
    });

    /* A quote the reader kept (§26.3), ranked directly under a named finished
       book. A line from a book is the most shareable thing this card can carry
       and the most on-brand — §21 puts the product in a distribution bottleneck
       — but a finished book is still the bigger claim, so it does not displace
       one.

       Capped here rather than when the highlight is made: people highlight
       whole paragraphs, and §14 forbids truncating the thing a slot exists to
       show, so a long highlight is simply not offered as a quote instead of
       being ellipsised onto the card. Two at most, like the books, so the sheet
       stays an offer rather than a configuration exercise.

       The book name is part of the hero text, not a supporting line: a card
       carrying someone else's words must say whose they are, and a supporting
       line can be switched off or dropped by the collage layout. */
    if (typeof HighlightsFeature !== 'undefined') {
      const quotes = HighlightsFeature.allWithBooks()
        .filter(function(q) {
          if (!q.text) return false;
          /* The attribution is charged against the same budget — see
             QUOTE_BUDGET_CHARS. +2 for the "— " that precedes the title. */
          return q.text.length + displayTitle(q.book).length + 2 <= QUOTE_BUDGET_CHARS;
        })
        .slice(0, 2);

      quotes.forEach(function(q) {
        const title = displayTitle(q.book);
        out.push({
          id: 'quote:' + q.fileId + ':' + q.start,
          /* Gives the quote its book's cover through the existing panel — the
             shape _coverOf and _drawCover already expect. */
          book: { id: q.fileId, name: q.book, author: q.author, days: 0, lastOpened: 0 },
          label: t('share.item.quote', { book: title }),
          text: t('share.hero.quote', { quote: q.text, book: title }),
        });
      });
    }

    /* The all-time count, as a hero rather than a footnote. It existed only as
       a supporting line, so a user who had finished four books was told "4 books
       finished" in 34px grey and given no way to make the card about it — and
       the collage was unreachable unless a recap window happened to qualify.
       Reported from use.

       After the named books (§15 ranks a named book above any number) and before
       the counters, because it is still about books. */
    if (stats.finished.length > 1) {
      out.push({
        id: 'finished',
        bookList: stats.finished,
        label: t('share.item.finished', { n: stats.finished.length }),
        text: tn('share.hero.finished', stats.finished.length, { n: stats.finished.length }),
      });
    }

    if (stats.streak >= 2) {
      out.push({
        id: 'streak',
        label: t('share.item.streak', { n: stats.streak }),
        text: t('share.hero.streak', { n: stats.streak }),
      });
    }

    if (stats.totalWords > 0) {
      out.push({
        id: 'words',
        label: t('share.item.words', { n: formatNumber(stats.totalWords) }),
        text: t('share.hero.words', { n: formatNumber(stats.totalWords) }),
      });
    }

    /* Recaps last: a named book still outranks any number (§15), and the whole
       point of a recap is that it is there on the ordinary weeks when nothing
       was finished. One strong stat each, by what the window actually holds —
       books finished, then hours, then words. A window with a single day's
       reading in it is skipped: "1 day of reading this year" is a true sentence
       nobody wants on a card. */
    const recapRows = [];
    (stats.recaps || []).forEach(function(recap) {
      if (!_worthRecapping(recap)) return;
      const hours = Math.floor(recap.minutes / 60);
      let text = null;
      if (recap.books > 0) {
        text = tn('share.hero.recap_books.' + recap.id, recap.books, { n: recap.books });
      } else if (hours >= 1) {
        text = tn('share.hero.recap_time.' + recap.id, hours, { n: hours });
      } else if (recap.words > 0) {
        text = t('share.hero.recap_words.' + recap.id, { n: formatNumber(recap.words) });
      }
      if (!text) return;
      recapRows.push({
        id: 'recap:' + recap.id,
        recap: recap,
        /* Normalised to the top level so every multi-book hero is read the same
           way — _coversFor and _coverPool must not have to know which kind of
           hero they were handed. */
        bookList: recap.bookList,
        label: t('share.item.recap.' + recap.id),
        text: text,
      });
    });

    /* At most two windows, and never three. All three offered at once is the
       same redundancy the hero list already had: "finished a book in the last 7
       days", "2 books in the last 30 days" and "3 books this year" are three
       phrasings of one claim, and a chooser full of near-duplicates is what made
       this sheet feel like a form. The shortest substantial window is the most
       current thing the user has, the longest is the most impressive, and the
       middle one is always between two things that say it better. A window whose
       card text is identical to a shorter one's is dropped outright. */
    if (recapRows.length > 2) {
      recapRows.splice(1, recapRows.length - 2);
    }
    /* Deduped on the *figures*, not the rendered sentence. Early on every window
       holds the same reading — a user four days in has read as much this year as
       they have this week — so the two rows are one card with two captions, and
       the longer window is the one that says less about now. Comparing the text
       misses this, because the captions differ by construction. */
    const seen = {};
    recapRows.forEach(function(row) {
      const shape = row.recap.books + '/' + row.recap.minutes + '/' + row.recap.words;
      if (seen[shape]) return;
      seen[shape] = true;
      out.push(row);
    });

    /* One hero per distinct book count. In a user's first year "this year" holds
       every book they have finished, so the all-time hero and the year recap are
       two rows making one claim — the same redundancy the recap windows are
       already deduped for.

       The survivor is the **narrowest window**, not the earliest row. For an
       equal count a tighter window is strictly the better claim: four books in
       the last 7 days says more than four books ever, and if every book a reader
       has finished was finished this week, that is the thing worth putting on the
       card. The first version of this kept display order and so threw the good
       sentence away in favour of the weak one — the all-time hero is the fallback
       for when no window qualifies or the counts genuinely differ, not the
       preferred phrasing. Display order itself is unchanged. */
    const RANK = { 'recap:week': 0, 'recap:month': 1, 'recap:year': 2, finished: 3 };
    const best = {};
    out.forEach(function(row) {
      const n = row.bookList ? row.bookList.length : 0;
      if (!n) return;
      const rank = RANK[row.id];
      if (rank === undefined) return;
      if (best[n] === undefined || rank < best[n]) best[n] = rank;
    });
    return out.filter(function(row) {
      const n = row.bookList ? row.bookList.length : 0;
      if (!n) return true;
      const rank = RANK[row.id];
      return rank === undefined || rank === best[n];
    });
  }

  /* Supporting lines. Deliberately a flat, ordered list of rows rather than a
     fixed layout: §15 asks that a future "time reclaimed" stat — the nudge
     counters in NudgeGate already hold the data — can be added as one more
     entry here without the card being redrawn from scratch. Not in v1. */
  function _extraOptions(stats, heroId) {
    const out = [];

    /* A recap hero takes its supporting lines from the same window, not from
       all time: "4 hours last week" under a headline about last week, followed
       by a lifetime total, reads as two unrelated cards. The streak is the one
       global figure that still belongs, because it is the thing the window is
       evidence of. */
    const recapId = (heroId.indexOf('recap:') === 0) ? heroId.slice(6) : null;
    if (recapId) {
      const recap = (stats.recaps || []).find(function(r) { return r.id === recapId; });
      if (recap) {
        const hours = Math.floor(recap.minutes / 60);
        if (recap.books > 0) {
          out.push({ id: 'w-books', label: t('share.item.finished', { n: recap.books }), text: tn('share.line.recap_books.' + recapId, recap.books, { n: recap.books }) });
        }
        if (hours >= 1) {
          out.push({ id: 'w-time', label: tn('share.item.time', hours, { n: hours }), text: tn('share.line.recap_time.' + recapId, hours, { n: hours }) });
        }
        if (recap.words > 0) {
          out.push({ id: 'w-words', label: t('share.item.words', { n: formatNumber(recap.words) }), text: t('share.line.recap_words.' + recapId, { n: formatNumber(recap.words) }) });
        }
        if (recap.days >= 2) {
          out.push({ id: 'w-days', label: tn('share.item.days', recap.days, { n: recap.days }), text: tn('share.line.recap_days.' + recapId, recap.days, { n: recap.days }) });
        }
        if (stats.streak >= 2) {
          out.push({ id: 'streak', label: t('share.item.streak', { n: stats.streak }), text: t('share.line.streak', { n: stats.streak }) });
        }
        /* The hero's own stat is already the headline. */
        return out.filter(function(e) {
          if (recap.books > 0) return e.id !== 'w-books';
          if (hours >= 1) return e.id !== 'w-time';
          return e.id !== 'w-words';
        });
      }
    }

    if (heroId !== 'streak' && stats.streak >= 2) {
      out.push({ id: 'streak', label: t('share.item.streak', { n: stats.streak }), text: t('share.line.streak', { n: stats.streak }) });
    }
    if (heroId !== 'words' && stats.totalWords > 0) {
      out.push({ id: 'words', label: t('share.item.words', { n: formatNumber(stats.totalWords) }), text: t('share.line.words', { n: formatNumber(stats.totalWords) }) });
    }
    if (stats.totalMinutes >= 60) {
      const h = Math.floor(stats.totalMinutes / 60);
      out.push({ id: 'time', label: tn('share.item.time', h), text: tn('share.line.time', h) });
    }
    if (heroId !== 'finished' && stats.finished.length > 1) {
      out.push({ id: 'finished', label: t('share.item.finished', { n: stats.finished.length }), text: t('share.line.finished', { n: stats.finished.length }) });
    }

    return out;
  }

  function hasSomethingToShare() {
    try {
      return _heroOptions(collectStats()).length > 0;
    } catch (_) {
      return false;
    }
  }

  /* ── Card drawing ──────────────────────────────────────────── */

  /* Breaks mid-word when a single word is wider than the card. Titles are user
     data and some of them have no spaces in them; overflowing off the edge of a
     shared image is not a failure we can fix after the fact. */
  function _breakWord(ctx, word, maxWidth) {
    const parts = [];
    let chunk = '';
    for (var i = 0; i < word.length; i++) {
      if (ctx.measureText(chunk + word[i]).width > maxWidth && chunk) {
        parts.push(chunk);
        chunk = word[i];
      } else {
        chunk += word[i];
      }
    }
    if (chunk) parts.push(chunk);
    return parts;
  }

  function _wrap(ctx, text, maxWidth) {
    /* An explicit newline is a line break the caller meant. Canvas fillText
       does not interpret one — it would measure as part of a word and draw as a
       stray glyph — so a multi-line hero has to be wrapped segment by segment.
       Added for §26.3's quote hero, whose attribution belongs on its own line;
       a string with no newline behaves exactly as before. */
    const text_ = String(text);
    if (text_.indexOf('\n') !== -1) {
      const out = [];
      const segments = text_.split('\n');
      for (var seg = 0; seg < segments.length; seg++) {
        if (!segments[seg]) { out.push(''); continue; }
        const wrapped = _wrap(ctx, segments[seg], maxWidth);
        for (var k = 0; k < wrapped.length; k++) out.push(wrapped[k]);
      }
      return out;
    }

    const words = text_.split(' ');
    const lines = [];
    let line = '';

    for (var i = 0; i < words.length; i++) {
      let word = words[i];

      if (ctx.measureText(word).width > maxWidth) {
        if (line) { lines.push(line); line = ''; }
        const parts = _breakWord(ctx, word, maxWidth);
        for (var j = 0; j < parts.length - 1; j++) lines.push(parts[j]);
        word = parts[parts.length - 1];
      }

      const candidate = line ? line + ' ' + word : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  /* Shrink the hero until it fits the space it has. A long book title must not
     be truncated — the title is the most shareable part of the card.

     Beside a cover the column is barely half as wide, so the line count alone
     stopped being a usable limit: a long title fitted in four lines only by
     losing its last word. Height is the real constraint, and allowing more
     lines of smaller text keeps the whole title on the card. */
  function _fitHero(ctx, text, maxWidth, maxLines, maxHeight) {
    const ceiling = typeof maxHeight === 'number' ? maxHeight : Infinity;
    for (var size = 76; size >= 30; size -= 4) {
      ctx.font = '700 ' + size + 'px ' + FONT_DISPLAY;
      const lines = _wrap(ctx, text, maxWidth);
      if (lines.length <= maxLines && (lines.length * Math.round(size * 1.22)) <= ceiling) {
        return { size: size, lines: lines };
      }
    }
    ctx.font = '700 30px ' + FONT_DISPLAY;
    /* Genuinely out of room. Cutting silently would publish a title that is not
       the book's, so say that it was cut. */
    const lines = _wrap(ctx, text, maxWidth);
    if (lines.length <= maxLines) return { size: 30, lines: lines };
    const kept = lines.slice(0, maxLines);
    kept[kept.length - 1] = kept[kept.length - 1].replace(/\s+\S*$/, '') + '…';
    return { size: 30, lines: kept };
  }

  /* Cover panel. Portrait, because that is the shape of a book and because the
     text column needs the rest of the width to stay legible when downscaled
     into someone else's feed. */
  const COVER_W = 320;
  const COVER_MAX_H = 440;
  const COVER_GAP = 40;
  /* A fan shows "a few books" at a glance; a collage shows *which* books, and
     the owner wanted the second once there are enough to be worth seeing.

     **One row of four, and the reason is vertical space.** The hero band is
     616px tall and a book cover is 1.375× as tall as it is wide, so two rows of
     three only fit by shrinking each tile to ~132px — at which point nobody can
     see which books they are, and the collage has defeated its own purpose. Four
     across at 199×274 is legible and leaves the headline its two lines. A fifth
     book is not drawn: the headline states the real number ("Finished 6 books
     this year"), so the grid is a sampler rather than an inventory, and a
     "+2 more" line would only restate the headline minus four.

     _collageFootprint clamps to the height it is given regardless, so a later
     change to the band or the row count cannot silently overflow the card —
     which is exactly what the first version of this did. */
  const COLLAGE_MAX = 4;
  const COLLAGE_COLS = 4;
  const COLLAGE_GAP = 20;
  const FAN_MAX = 3;
  const FAN_SCALE = 0.72;
  const FAN_STEP_X = 45;
  const FAN_STEP_Y = 30;
  /* A collage is a visual device, so below two real images the fan is drawn
     instead. Covers are cached on disk, so a given user gets the same layout
     every time rather than one that flickers between the two.

     **Which books can actually be coverless is narrower than §15 once implied.**
     All 150 catalogue entries carry a `coverImage`, TXT included (127 of them),
     and `BookCover.cacheRemote()` stores it at download time — so every Free
     Books title has real artwork, and a self-imported PDF has its page one. The
     only coverless book is a self-imported DOCX or TXT. An earlier version of
     this comment blamed "two thirds of the catalogue is TXT with no page one",
     which was true before catalogue covers shipped and is not true now. */
  const COLLAGE_MIN_IMAGES = 2;
  const COVER_TIMEOUT_MS = 4000;

  /* Resolved covers, keyed by hero id, for the lifetime of one sheet — the
     preview redraws on every toggle and re-rendering a PDF page each time would
     be felt. */
  let _covers = {};

  /**
   * What to draw beside the hero, or null for a text-only card.
   *
   * A PDF has its own cover on page one. Nothing else does, so the rest get a
   * typographic one drawn from the title — never a fetched image: §1.1 keeps
   * this path offline, and the share card must work on a plane.
   */
  /* One book's cover. `deadline` is an absolute timestamp, not a per-cover
     duration, and that is the whole point of it: a recap collage asks for six
     of these, and six four-second races run one after another is a share button
     that hangs for twenty-four seconds. They are resolved in parallel against a
     single budget, and whatever has arrived when it expires is what gets drawn
     (§21 — the card is still a card with typographic covers). */
  async function _coverOf(book, deadline) {
    if (!book) return null;
    if (Object.prototype.hasOwnProperty.call(_covers, book.id)) return _covers[book.id];
    let img = null;
    try {
      if (typeof BookCover !== 'undefined') {
        const left = Math.max(0, deadline - Date.now());
        img = await Promise.race([
          BookCover.getImage(book.id),
          new Promise(function(resolve) { setTimeout(function() { resolve(null); }, left); }),
        ]);
      }
    } catch (_) {}
    let author = book.author || '';
    /* Books downloaded before the author was stored on the library item: the
       catalogue still knows, and only the placeholder cover needs it. */
    if (!author && !img && typeof FreeBooksView !== 'undefined'
        && typeof FreeBooksView.authorForFileId === 'function') {
      try { author = await FreeBooksView.authorForFileId(book.id); } catch (_) {}
    }
    _covers[book.id] = { id: book.id, img: img, title: book.name || '', author: author };
    return _covers[book.id];
  }

  /* The covers a hero wants, in the order they should be drawn. A book hero
     wants its own; a recap hero wants the books finished inside its window,
     most recently read first (`_finishedBooks` is sorted by lastOpened), capped
     at what a collage can show. Everything else wants none — a streak and a
     word count are not about a book, and an empty panel beside them would be
     worse than no panel. */
  async function _coversFor(hero) {
    if (!hero) return [];
    if (hero.book) {
      /* A single book keeps its typographic cover when it has no artwork — that
         is §15's design, and initials work when they are *that book's*
         identity. */
      const one = await _coverOf(hero.book, Date.now() + COVER_TIMEOUT_MS).catch(function() { return null; });
      return one ? [one] : [];
    }

    const list = hero.bookList || [];
    if (list.length === 0) return [];

    /* Every book in the window is resolved, not just the first four: which ones
       are worth drawing is not known until it is known which have artwork. The
       deadline is shared, so asking for twelve costs the same wall-clock as
       asking for one. */
    const deadline = Date.now() + COVER_TIMEOUT_MS;
    const resolved = (await Promise.all(list.map(function(book) {
      return _coverOf(book, deadline).catch(function() { return null; });
    }))).filter(Boolean);

    /* A multi-book card prefers books that have real covers, and drops the rest
       (owner, 2026-11-20). Asked for as a "hide books without covers" option and
       built as a rule instead: nobody would ever switch that option *on*, since
       a grid of initial-boxes says nothing about what was read — so it is a
       defect with a workaround attached rather than a preference. Honest because
       the covers were always a sampler: the headline says "9 books this year" and
       shows four, so showing two of five is the same kind of claim. If none have
       artwork the card carries no covers at all, which is the clean version of
       what was asked for. */
    const withArt = resolved.filter(function(cover) { return !!cover.img; });
    if (!withArt.length) return [];

    /* An explicit choice wins; absent one, the most recently finished four. */
    const chosen = (_selection && _selection.books) || null;
    if (chosen) {
      const picked = withArt.filter(function(cover) { return chosen.indexOf(cover.id) !== -1; });
      if (picked.length) return picked.slice(0, COLLAGE_MAX);
    }
    return withArt.slice(0, COLLAGE_MAX);
  }

  /* Every book in a recap window that has real artwork — the pool the picker
     offers and `_coversFor` draws the default four from. */
  function _coverPool(hero) {
    if (!hero || hero.book || !hero.bookList) return [];
    return hero.bookList.filter(function(book) {
      const cover = _covers[book.id];
      return cover && cover.img;
    });
  }

  /* Two initials, the same shape the Free Books catalogue placeholder uses. */
  function _initials(title) {
    return String(title || '')
      .split(/\s+/).filter(Boolean).slice(0, 2)
      .map(function(w) { return w.charAt(0); })
      .join('')
      .toUpperCase();
  }

  /* Deterministic, but only ever between the two §16 accents — the catalogue's
     own placeholder palette is outside the card's allowed colours (§15). */
  function _accentFor(title) {
    let hash = 0;
    const str = String(title || '');
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    return (hash % 2 === 0) ? COLORS.accent : COLORS.accent2;
  }

  /* Draws the cover and returns the height it took, so the caller can centre
     the text column against it. */
  function _drawCover(ctx, cover, x, top) {
    let w = COVER_W;
    let h = COVER_MAX_H;
    if (cover.img && cover.img.width > 0 && cover.img.height > 0) {
      /* Contain, never crop: a cropped cover loses the title on it. */
      const ratio = Math.min(COVER_W / cover.img.width, COVER_MAX_H / cover.img.height);
      w = Math.round(cover.img.width * ratio);
      h = Math.round(cover.img.height * ratio);
    }

    ctx.fillStyle = COLORS.panelRaised;
    ctx.fillRect(x, top, w, h);

    if (cover.img) {
      ctx.drawImage(cover.img, x, top, w, h);
    } else {
      /* Typographic cover: initials, a short accent rule, author if we have one. */
      const accent = _accentFor(cover.title);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.text;
      ctx.font = '700 104px ' + FONT_DISPLAY;
      ctx.fillText(_initials(cover.title) || '…', x + (w / 2), top + (h / 2) + 20);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x + (w / 2) - 36, top + (h / 2) + 60);
      ctx.lineTo(x + (w / 2) + 36, top + (h / 2) + 60);
      ctx.stroke();
      if (cover.author) {
        ctx.fillStyle = COLORS.muted;
        ctx.font = '400 24px ' + FONT_DISPLAY;
        ctx.fillText(_wrap(ctx, cover.author, w - 48)[0] || '', x + (w / 2), top + h - 44);
      }
      ctx.restore();
    }

    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, top, w, h);
    return { width: w, height: h };
  }

  /* Scaled copy of _drawCover for the fan and the collage, which both need an
     explicit box rather than the fixed cover column. Kept separate from
     _drawCover so the single-cover layout — the common case, and the one §15
     describes — cannot be broken by a change made for a collage. */
  function _drawCoverIn(ctx, cover, x, top, boxW, boxH) {
    const w = boxW;
    const h = boxH;
    /* The frame is the box, always, and artwork is contained *inside* it rather
       than shrinking it. _drawCover does the opposite — correctly, because a
       lone cover has nothing to line up with. In a grid it matters: a contained
       image makes its own tile narrower than a typographic one, so a collage
       mixing real covers with initials came out with ragged gaps and tiles of
       three different widths. Uniform frames also simply read better: a shelf,
       not a pile. */
    ctx.fillStyle = COLORS.panelRaised;
    ctx.fillRect(x, top, w, h);
    if (cover.img && cover.img.width > 0 && cover.img.height > 0) {
      const ratio = Math.min(w / cover.img.width, h / cover.img.height);
      const iw = Math.round(cover.img.width * ratio);
      const ih = Math.round(cover.img.height * ratio);
      ctx.drawImage(cover.img,
        x + Math.round((w - iw) / 2), top + Math.round((h - ih) / 2), iw, ih);
    } else {
      /* Same typographic cover, sized off the box so initials in a collage tile
         are not the 104px of a full-size panel. */
      const scale = w / COVER_W;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.text;
      ctx.font = '700 ' + Math.round(104 * scale) + 'px ' + FONT_DISPLAY;
      ctx.fillText(_initials(cover.title) || '…', x + (w / 2), top + (h / 2) + Math.round(20 * scale));
      ctx.strokeStyle = _accentFor(cover.title);
      ctx.lineWidth = Math.max(2, Math.round(4 * scale));
      ctx.beginPath();
      ctx.moveTo(x + (w / 2) - (36 * scale), top + (h / 2) + (60 * scale));
      ctx.lineTo(x + (w / 2) + (36 * scale), top + (h / 2) + (60 * scale));
      ctx.stroke();
      if (cover.author && scale > 0.6) {
        ctx.fillStyle = COLORS.muted;
        ctx.font = '400 ' + Math.round(24 * scale) + 'px ' + FONT_DISPLAY;
        ctx.fillText(_wrap(ctx, cover.author, w - (48 * scale))[0] || '', x + (w / 2), top + h - (44 * scale));
      }
      ctx.restore();
    }
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, top, w, h);
    return { width: w, height: h };
  }

  /* Two or three books, overlapped inside the ordinary cover column so the
     side-by-side layout §15 describes is untouched. Drawn back to front, so
     the most recently finished book is the one on top. */
  function _fanFootprint(count) {
    const n = Math.min(count, FAN_MAX);
    const w = Math.round(COVER_W * FAN_SCALE);
    const h = Math.round(COVER_MAX_H * FAN_SCALE);
    return {
      width: w + ((n - 1) * FAN_STEP_X),
      height: h + ((n - 1) * FAN_STEP_Y),
      tileW: w,
      tileH: h,
      count: n,
    };
  }

  function _drawFan(ctx, covers, x, top) {
    const box = _fanFootprint(covers.length);
    for (var i = box.count - 1; i >= 0; i--) {
      _drawCoverIn(ctx, covers[i], x + (i * FAN_STEP_X), top + (i * FAN_STEP_Y), box.tileW, box.tileH);
    }
    return box;
  }

  function _collageFootprint(count, width, maxHeight) {
    const n = Math.min(count, COLLAGE_MAX);
    const cols = Math.min(COLLAGE_COLS, n);
    const rows = Math.ceil(n / cols);
    /* A book is taller than it is wide; 1.375 is the ratio the single cover box
       already uses (440/320), so a tile is the same shape as a full panel. The
       tile is sized by whichever of width and height binds — sizing on width
       alone is what put a 768px grid in a 616px band. */
    const byWidth = Math.floor((width - ((cols - 1) * COLLAGE_GAP)) / cols);
    const ratio = COVER_MAX_H / COVER_W;
    const byHeight = maxHeight
      ? Math.floor(((maxHeight - ((rows - 1) * COLLAGE_GAP)) / rows) / ratio)
      : byWidth;
    const tileW = Math.max(1, Math.min(byWidth, byHeight));
    const tileH = Math.round(tileW * ratio);
    return {
      width: (cols * tileW) + ((cols - 1) * COLLAGE_GAP),
      height: (rows * tileH) + ((rows - 1) * COLLAGE_GAP),
      tileW: tileW,
      tileH: tileH,
      cols: cols,
      rows: rows,
      count: n,
    };
  }

  function _drawCollage(ctx, covers, x, top, box) {
    for (var i = 0; i < box.count; i++) {
      const col = i % box.cols;
      const row = Math.floor(i / box.cols);
      /* A last row with fewer tiles than the others is centred under them — two
         tiles left-aligned beneath three reads as a layout that ran out. */
      const inRow = Math.min(box.cols, box.count - (row * box.cols));
      const rowWidth = (inRow * box.tileW) + ((inRow - 1) * COLLAGE_GAP);
      const rowX = x + Math.round((box.width - rowWidth) / 2);
      _drawCoverIn(ctx, covers[i],
        rowX + (col * (box.tileW + COLLAGE_GAP)),
        top + (row * (box.tileH + COLLAGE_GAP)),
        box.tileW, box.tileH);
    }
    return box;
  }

  /* Which of the three layouts a set of covers gets. */
  function _coverMode(covers) {
    if (!covers || covers.length === 0) return 'none';
    if (covers.length === 1) return 'single';
    if (covers.length < 4) return 'fan';
    const real = covers.filter(function(c) { return !!c.img; }).length;
    return (real >= COLLAGE_MIN_IMAGES) ? 'collage' : 'fan';
  }

  async function drawCard(hero, extras, covers) {
    /* Webfonts are not guaranteed to be resident when the canvas draws, and a
       card that silently falls back to Arial is the one thing we cannot fix
       after it has been shared. */
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    } catch (_) {}

    const canvas = document.createElement('canvas');
    canvas.width = CARD_SIZE;
    canvas.height = CARD_SIZE;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

    /* Inner panel, one hairline border. §16: radius 2–4px, nothing rounded. */
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(PAD / 2, PAD / 2, CARD_SIZE - PAD, CARD_SIZE - PAD);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(PAD / 2, PAD / 2, CARD_SIZE - PAD, CARD_SIZE - PAD);

    const left = PAD + 24;
    const contentWidth = CARD_SIZE - (left * 2);

    /* Kicker */
    ctx.fillStyle = COLORS.accent;
    ctx.font = '500 26px ' + FONT_MONO;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(t('share.card.kicker').toUpperCase(), left, PAD + 92);

    /* Hero and its supporting rows are centred as ONE block in the band between
       the kicker and the footer. Centring the hero alone leaves a one-line card
       looking top-heavy and a three-line card looking cramped.

       With a cover, the hero shares that band with it: the cover takes a fixed
       column on the left and the headline gets what is left. A narrower column
       costs font size rather than overflow, because _fitHero steps down until
       the text fits. One more line is allowed there for the same reason. */
    /* One cover, a fan of two or three, or a collage of four or more — see
       _coverMode. The first two share the side-by-side layout §15 describes; a
       collage is wide by nature and takes the headline above it instead, with
       no supporting rows, because a card carrying six covers and three lines of
       statistics is the data dump §15 rules out. The headline already states
       the count. */
    const list = Array.isArray(covers) ? covers : (covers ? [covers] : []);
    const mode = _coverMode(list);
    /* The band the hero block is centred in: below the kicker, above the
       footer rule. Declared here rather than further down because the collage
       clamp below needs it — a `const` used before its declaration in the same
       block is a ReferenceError, not a hoist. */
    const BAND_TOP = 236;
    const BAND_BOTTOM = 852;

    /* The grid gets what the band has left after a two-line headline and the gap
       below it — computed here rather than assumed, so the clamp has a real
       number to work with. */
    const COLLAGE_GAP_Y = 56;
    const COLLAGE_HERO_RESERVE = 190;
    const collage = (mode === 'collage')
      ? _collageFootprint(list.length, contentWidth,
          (BAND_BOTTOM - BAND_TOP) - COLLAGE_HERO_RESERVE - COLLAGE_GAP_Y)
      : null;
    const sideBox = (mode === 'fan') ? _fanFootprint(list.length) : null;
    const sideWidth = collage ? 0 : (sideBox ? sideBox.width : (mode === 'single' ? COVER_W : 0));

    const textLeft = sideWidth ? left + sideWidth + COVER_GAP : left;
    const textWidth = sideWidth ? contentWidth - sideWidth - COVER_GAP : contentWidth;
    const heroMaxLines = collage ? 2 : (sideWidth ? 6 : 3);
    const fit = _fitHero(ctx, hero, textWidth, heroMaxLines,
      sideWidth ? COVER_MAX_H : (collage ? 200 : undefined));
    const lineHeight = Math.round(fit.size * 1.22);
    const heroBlockHeight = fit.lines.length * lineHeight;

    const rows = collage ? [] : extras.slice(0, 3);
    const EXTRA_GAP = 72;
    const EXTRA_ROW = 54;
    const extrasHeight = rows.length ? EXTRA_GAP + (rows.length * EXTRA_ROW) : 0;

    /* Measured, not assumed: a contained cover is shorter than the box when the
       page is wide, and the block has to be centred on what was actually drawn.
       So the cover is drawn once off-screen-cheaply at a provisional top and the
       text is placed against the height it reports. */
    const single = (mode === 'single') ? list[0] : null;
    const coverHeight = single
      ? (single.img && single.img.width > 0
          ? Math.round(single.img.height * Math.min(COVER_W / single.img.width, COVER_MAX_H / single.img.height))
          : COVER_MAX_H)
      : (sideBox ? sideBox.height : 0);
    const topBlockHeight = Math.max(heroBlockHeight, coverHeight);

    /* A collage stacks instead of sitting beside: headline, gap, grid. */
    const blockHeight = collage
      ? heroBlockHeight + COLLAGE_GAP_Y + collage.height
      : topBlockHeight + extrasHeight;
    const blockTop = Math.round(BAND_TOP + ((BAND_BOTTOM - BAND_TOP) - blockHeight) / 2);

    if (single) {
      _drawCover(ctx, single, left, blockTop + Math.round((topBlockHeight - coverHeight) / 2));
    } else if (sideBox) {
      _drawFan(ctx, list, left, blockTop + Math.round((topBlockHeight - sideBox.height) / 2));
    } else if (collage) {
      _drawCollage(ctx, list, left + Math.round((contentWidth - collage.width) / 2),
        blockTop + heroBlockHeight + COLLAGE_GAP_Y, collage);
    }

    /* Centred against the cover rather than hung from its top edge: a one-line
       headline pinned to the top of a 440px cover reads as a mistake. */
    const heroTop = collage
      ? blockTop
      : blockTop + Math.round((topBlockHeight - heroBlockHeight) / 2);
    ctx.fillStyle = COLORS.text;
    ctx.font = '700 ' + fit.size + 'px ' + FONT_DISPLAY;
    fit.lines.forEach(function(line, i) {
      ctx.fillText(line, textLeft, heroTop + (i * lineHeight) + fit.size);
    });

    /* Supporting rows. Adding a future row — §15's "time reclaimed" — costs one
       entry in the array and nothing here changes.

       Drawn as --text at reduced opacity rather than flat --text-muted: muted
       is tuned for 12–14px UI text on a screen the reader is holding, and this
       image gets downscaled into someone else's feed. Same palette token, more
       of it (§16 — no new colours). */
    let y = blockTop + topBlockHeight + EXTRA_GAP;
    ctx.font = '400 34px ' + FONT_DISPLAY;
    ctx.fillStyle = COLORS.text;
    ctx.globalAlpha = 0.6;
    rows.forEach(function(line) {
      const first = _wrap(ctx, line, contentWidth)[0];
      if (first) ctx.fillText(first, left, y);
      y += EXTRA_ROW;
    });
    ctx.globalAlpha = 1;

    /* Branding: small and quiet (§15 — tasteful, not a loud ad). */
    const footY = CARD_SIZE - PAD - 56;
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(left, footY - 44);
    ctx.lineTo(left + 72, footY - 44);
    ctx.stroke();

    ctx.fillStyle = COLORS.text;
    ctx.font = '700 30px ' + FONT_DISPLAY;
    /* Measure while the bold face is still active — measuring afterwards reads
       the lighter font and the tagline lands on top of the wordmark. */
    const brandWidth = ctx.measureText('FlowRead').width;
    ctx.fillText('FlowRead', left, footY);

    ctx.fillStyle = COLORS.muted;
    ctx.font = '400 26px ' + FONT_DISPLAY;
    ctx.fillText(t('share.card.tagline'), left + brandWidth + 28, footY);

    return canvas;
  }

  /* ── Sharing ───────────────────────────────────────────────── */

  function _base64Of(canvas) {
    const url = canvas.toDataURL('image/png');
    return url.substring(url.indexOf(',') + 1);
  }

  async function _shareCanvas(canvas) {
    const plugins = (window.Capacitor && window.Capacitor.Plugins) || {};
    const Share = plugins.Share;
    const Filesystem = plugins.Filesystem;
    /* The message that travels with the image, and the one place a download
       link belongs. §15 keeps the *card* tasteful and small — "not a loud ad" —
       and this is not the card: it is the text a recipient reads beside it, and
       until now it named the app without saying where to get it. §22 calls this
       product distribution-bound and §15 prioritised this feature partly for
       reach, so a card that reaches a non-user and leaves them nowhere to go was
       the whole mechanic stopping one step short.

       Appended rather than put in the string: a translator must not be able to
       drop or mistype the URL, and it is the same URL in every language. */
    const text = t('share.sheet.text') + '\n' + STORE_URL;

    if (Share && Filesystem && typeof Filesystem.writeFile === 'function') {
      const name = 'flowread-' + Date.now() + '.png';
      await Filesystem.writeFile({ path: name, data: _base64Of(canvas), directory: 'CACHE' });
      const uri = await Filesystem.getUri({ path: name, directory: 'CACHE' });
      await Share.share({ title: t('share.sheet.title'), text: text, files: [uri.uri] });
      return true;
    }

    /* Browser fallback so the feature is testable outside a device build. */
    const blob = await new Promise(function(resolve) { canvas.toBlob(resolve, 'image/png'); });
    if (!blob) return false;

    const file = new File([blob], 'flowread.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: t('share.sheet.title'), text: text, files: [file] });
      return true;
    }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'flowread.png';
    a.click();
    setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
    return true;
  }

  /* ── Sheet ─────────────────────────────────────────────────── */

  function _renderPreview() {
    const wrap = qs('#share-preview');
    if (!wrap || !_model) return;

    const hero = _model.heroes.find(function(h) { return h.id === _selection.heroId; });
    if (!hero) return;

    const extras = _model.extrasFor(_selection.heroId)
      .filter(function(e) { return _selection.extras.indexOf(e.id) !== -1; });

    _coversFor(hero).then(function(covers) {
      /* Recorded before the draw, so the editor can decide whether its second
         section is the stat toggles or the cover picker. */
      const mode = _coverMode(covers);
      const pool = _coverPool(hero);
      const changed = (mode !== _coverState.mode) || (pool.length !== _coverState.pool.length);
      _coverState = { mode: mode, pool: pool };
      if (changed) _renderExtras();
      return drawCard(hero.text, extras.map(function(e) { return e.text; }), covers);
    }).then(function(canvas) {
      /* The sheet may have been closed while the fonts settled. */
      const target = qs('#share-preview');
      if (!target) return;
      /* A late redraw must not land on top of a newer selection. */
      if (_selection.heroId !== hero.id) return;
      canvas.className = 'share-preview-canvas';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', hero.text);
      target.innerHTML = '';
      target.appendChild(canvas);
    });
  }

  /* The editor's second section. In collage mode it is the cover picker, not the
     stat toggles — and that is a bug fix as much as a feature: `drawCard` drops
     the supporting lines when it draws a collage, so the toggles were still being
     offered while the card ignored them, which is the silent failure §1.5
     forbids. The slot was dead in exactly that mode, so the picker costs no new
     group of controls; as a third group under the hero radios it would have been
     the "too many choices" problem over again. Below four books there is nothing
     to pick, since every cover is already drawn. */
  function _renderCoverPicker(box) {
    const pool = _coverState.pool;
    const label = qs('#share-extras-label');
    if (label) {
      label.hidden = false;
      label.textContent = t('share.sheet.covers_label');
    }

    if (!_selection.books) {
      _selection.books = pool.slice(0, COLLAGE_MAX).map(function(book) { return book.id; });
    }

    box.innerHTML = pool.map(function(book) {
      const checked = _selection.books.indexOf(book.id) !== -1 ? ' checked' : '';
      return '<label class="share-toggle"><input type="checkbox" data-book-id="' +
        escapeHtml(book.id) + '"' + checked + '> <span>' + escapeHtml(book.name) + '</span></label>';
    }).join('') +
      '<p class="share-covers-hint" id="share-covers-hint">' +
        t('share.sheet.covers_hint', { n: _selection.books.length, max: COLLAGE_MAX }) + '</p>';

    qsa('input[data-book-id]', box).forEach(function(input) {
      input.addEventListener('change', function() {
        const id = input.dataset.bookId;
        const at = _selection.books.indexOf(id);
        if (input.checked && at === -1) {
          _selection.books.push(id);
          /* At capacity, the longest-standing choice drops out. A fifth tick has
             to *do* something visible — ignoring it, or greying the remaining
             boxes, is the silent refusal §1.5 rules out, and the user can see
             exactly which cover they traded. */
          while (_selection.books.length > COLLAGE_MAX) _selection.books.shift();
        }
        if (!input.checked && at !== -1) _selection.books.splice(at, 1);
        /* Never zero: an empty pick would draw a card with no covers, which the
           hero radios already offer as a plain stat card. */
        if (_selection.books.length === 0) _selection.books = [id];
        _renderExtras();
        _renderPreview();
      });
    });
  }

  function _renderExtras() {
    const box = qs('#share-extras');
    if (!box || !_model) return;

    /* Gated on the pool — what this hero *could* draw — and never on the mode
       the current pick happens to produce. _coverMode reads the covers actually
       drawn, so unticking a fourth book turned the card into a fan and took the
       picker away with it, leaving no control able to tick anything back: the
       section removed itself in response to being used, which is the silent
       failure §1.5 forbids (the only way out was switching hero and back, which
       silently reset the pick). The pool does not move when a box is ticked, so
       the section stays put while the selection changes underneath it. Below
       four there is still nothing to pick, since every cover is already drawn. */
    if (_coverState.pool.length >= COLLAGE_MAX) {
      _renderCoverPicker(box);
      return;
    }

    const extras = _model.extrasFor(_selection.heroId);
    /* Dropping the hero from the list can orphan a checked extra. */
    _selection.extras = _selection.extras.filter(function(id) {
      return extras.some(function(e) { return e.id === id; });
    });

    const label = qs('#share-extras-label');
    if (label) {
      label.hidden = extras.length === 0;
      label.textContent = t('share.sheet.extras_label');
    }

    box.innerHTML = extras.length === 0 ? '' : extras.map(function(e) {
      const checked = _selection.extras.indexOf(e.id) !== -1 ? ' checked' : '';
      return '<label class="share-toggle"><input type="checkbox" data-extra-id="' + escapeHtml(e.id) + '"' + checked + '> <span>' + escapeHtml(e.label) + '</span></label>';
    }).join('');

    qsa('input[data-extra-id]', box).forEach(function(input) {
      input.addEventListener('change', function() {
        const id = input.dataset.extraId;
        const at = _selection.extras.indexOf(id);
        if (input.checked && at === -1) _selection.extras.push(id);
        if (!input.checked && at !== -1) _selection.extras.splice(at, 1);
        _renderPreview();
      });
    });
  }

  function openSheet(options) {
    const opts = options || {};
    const root = qs('#modal-root');
    if (!root) return;

    const stats = collectStats();
    const heroes = _heroOptions(stats);

    if (heroes.length === 0) {
      showToast(t('share.toast.nothing_yet'));
      return;
    }

    /* A milestone prompt names the thing being celebrated, so open on it. */
    let heroId = heroes[0].id;
    if (opts.preferHeroId && heroes.some(function(h) { return h.id === opts.preferHeroId; })) {
      heroId = opts.preferHeroId;
    }

    /* One sheet, one set of resolved covers — keyed by book id rather than by
       hero, so switching between a book hero and a recap that contains the same
       book does not render its page one twice. */
    _covers = {};

    _model = {
      stats: stats,
      heroes: heroes,
      extrasFor: function(id) { return _extraOptions(stats, id); },
    };
    _selection = {
      heroId: heroId,
      extras: _model.extrasFor(heroId).slice(0, 2).map(function(e) { return e.id; }),
      books: null,
    };
    _coverState = { mode: 'none', pool: [] };

    /* §15 requires the card be editable before sharing, and it still is — but
       the editing is behind one tap rather than in front of the card. The sheet
       used to open as a form of up to seven hero radios and four checkboxes,
       which asked the user to decide something the product already has a
       considered opinion about (§15 ranks the heroes: a named book, then the
       streak, then the numbers). Reported as "too many choices", correctly.
       Default path is now open → look → share. */
    const hasChoices = heroes.length > 1 || _model.extrasFor(heroId).length > 0;

    closeActiveModal();
    AppState.activeModal = 'share-stats';

    root.innerHTML = `
      <div class="modal-backdrop" id="share-backdrop">
        <div class="modal-card share-card" role="dialog" aria-modal="true">
          <p class="modal-kicker">${t('share.sheet.kicker')}</p>
          <h2 class="modal-title">${t('share.sheet.title')}</h2>
          <div class="share-preview" id="share-preview"></div>
          ${hasChoices ? `
            <button class="share-edit-toggle" id="btn-share-edit" type="button" aria-expanded="false">
              ${t('share.sheet.edit')}
            </button>
          ` : ''}
          <div class="share-editor" id="share-editor" hidden>
            ${heroes.length > 1 ? `
              <p class="share-group-label">${t('share.sheet.hero_label')}</p>
              <div class="share-options" id="share-heroes">
                ${heroes.map(function(h) {
                  const checked = h.id === heroId ? ' checked' : '';
                  return '<label class="share-toggle"><input type="radio" name="share-hero" data-hero-id="' + escapeHtml(h.id) + '"' + checked + '> <span>' + escapeHtml(h.label) + '</span></label>';
                }).join('')}
              </div>
            ` : ''}
            <p class="share-group-label" id="share-extras-label">${t('share.sheet.extras_label')}</p>
            <div class="share-options" id="share-extras"></div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-ghost" id="btn-share-close" type="button">${t('btn.not_now')}</button>
            <button class="btn btn-primary" id="btn-share-go" type="button">${t('share.sheet.btn_share')}</button>
          </div>
        </div>
      </div>
    `;

    qsa('input[data-hero-id]').forEach(function(input) {
      input.addEventListener('change', function() {
        _selection.heroId = input.dataset.heroId;
        _selection.extras = _model.extrasFor(_selection.heroId).slice(0, 2).map(function(e) { return e.id; });
        /* The books belonged to the window that was selected, so a different
           hero re-derives them rather than carrying a stale pick across. */
        _selection.books = null;
        _coverState = { mode: 'none', pool: [] };
        _renderExtras();
        _renderPreview();
      });
    });

    const editToggle = qs('#btn-share-edit');
    if (editToggle) {
      editToggle.addEventListener('click', function() {
        const editor = qs('#share-editor');
        if (!editor) return;
        const opening = editor.hidden;
        editor.hidden = !opening;
        editToggle.setAttribute('aria-expanded', String(opening));
        /* Two states, never removed. It first shipped hiding itself on the
           grounds that "change what's on it" above its own contents says
           nothing — which left no way back to the card, and on a phone the open
           editor pushes the preview off screen, so collapsing is exactly when it
           is wanted. Reported from use. */
        editToggle.textContent = opening ? t('share.sheet.edit_done') : t('share.sheet.edit');
      });
    }

    qs('#btn-share-close').addEventListener('click', closeActiveModal);
    qs('#share-backdrop').addEventListener('click', function(event) {
      if (event.target.id === 'share-backdrop') closeActiveModal();
    });

    qs('#btn-share-go').addEventListener('click', async function() {
      const hero = _model.heroes.find(function(h) { return h.id === _selection.heroId; });
      if (!hero) return;
      const extras = _model.extrasFor(_selection.heroId)
        .filter(function(e) { return _selection.extras.indexOf(e.id) !== -1; })
        .map(function(e) { return e.text; });

      showLoading(t('share.loading'));
      try {
        const canvas = await drawCard(hero.text, extras, await _coversFor(hero));
        await _shareCanvas(canvas);
        /* Q11, approved 2026-09-25. Entry point only — never which book, which
           stat, or which app it went to (§1.4). Fire-and-forget, after the
           share has actually completed. */
        if (typeof AnalyticsPing !== 'undefined') {
          /* firstTag makes an aggregate count answer "how many people have
             ever shared a card", which a bare share count cannot: the Worker
             counts the events flagged first, and that is one per device. No
             identifier is stored to get it — see worker/README.md for the two
             limits (a reinstall counts twice; a first share made while opted
             out is counted at the second instead). */
          AnalyticsPing.logEvent('stats_shared', {
            source: opts.source || 'unknown',
            firstTag: 'share',
          });
        }
        closeActiveModal();
      } catch (err) {
        /* A cancelled share sheet rejects too, and that is not an error the
           user needs told about (§21 — never raw exception text either). */
        const message = String((err && err.message) || '');
        if (!/cancel|abort|dismiss/i.test(message)) {
          showToast(t('share.toast.failed'));
        }
        console.warn('share-stats: share failed', err);
      } finally {
        hideLoading();
      }
    });

    _renderExtras();
    _renderPreview();
  }

  /* ── Milestones ────────────────────────────────────────────── */

  function _loadSet(key) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (_) {
      return [];
    }
  }

  function _markCelebrated(key, value) {
    const set = _loadSet(key);
    if (set.indexOf(value) === -1) set.push(value);
    /* Bounded — a library can grow indefinitely and this is only a "seen" set. */
    localStorage.setItem(key, JSON.stringify(set.slice(-200)));
  }

  function _showMilestone(title, body, heroId, celebrate) {
    const root = qs('#modal-root');
    if (!root || AppState.activeModal) return false;

    /* Marked before the user answers: the offer has been made, and re-offering
       because they said no is exactly the nagging §9.1 rules out. */
    celebrate();

    AppState.activeModal = 'share-milestone';
    root.innerHTML = `
      <div class="modal-backdrop" id="milestone-backdrop">
        <div class="modal-card" role="dialog" aria-modal="true">
          <p class="modal-kicker">${t('share.milestone.kicker')}</p>
          <h2 class="modal-title">${escapeHtml(title)}</h2>
          <p class="modal-body">${escapeHtml(body)}</p>
          <div class="modal-actions">
            <button class="btn btn-ghost" id="btn-milestone-close" type="button">${t('btn.not_now')}</button>
            <button class="btn btn-primary" id="btn-milestone-share" type="button">${t('share.sheet.btn_share')}</button>
          </div>
        </div>
      </div>
    `;

    qs('#btn-milestone-close').addEventListener('click', closeActiveModal);
    qs('#milestone-backdrop').addEventListener('click', function(event) {
      if (event.target.id === 'milestone-backdrop') closeActiveModal();
    });
    qs('#btn-milestone-share').addEventListener('click', function() {
      closeActiveModal();
      openSheet({ preferHeroId: heroId, source: 'milestone' });
    });

    return true;
  }

  /* ── Finishing a book, at the moment it happens ──────────────────────
     §15 originally fired every milestone prompt from home and nowhere else,
     because "a celebration mid-read is an interruption". That holds for a
     streak, which crosses at an arbitrary moment in the middle of a chapter. It
     does not hold for finishing a book: the reading is over, and there is
     nothing left to interrupt. Reported from use — the prompt was arriving on
     the *next* app launch, by which time the moment had gone and it read as a
     bug (see the Free Books return path, which was the direct cause).

     The rule that replaces it: **a completion prompt may interrupt only where
     the engine can prove the reading is done.** RSVP, Chunk, Scroll and Focus
     Bold can — `_handleEnd()` means playback ran past the last word, so every
     word has been on screen. Page mode cannot: arriving on the last page is not
     reading it (owner, 2026-11-20), and how long that page takes is unknowable.
     So Page mode offers instead of asking, with a tappable line at the foot of
     the final page, and this function is never called from it. */
  function shouldOfferBookFinished(fileId) {
    try {
      if (!fileId) return false;
      if (!localStorage.getItem(KEY_SEEDED)) return false;
      if (_loadSet(KEY_CELEBRATED_BOOKS).indexOf(fileId) !== -1) return false;
      return collectStats().finished.some(function(book) { return book.id === fileId; });
    } catch (_) {
      return false;
    }
  }

  /* The ask, for an engine that has proven the end. Returns whether it showed,
     so the caller can fall back to its own quieter acknowledgement. */
  function offerBookFinished(fileId) {
    try {
      if (!shouldOfferBookFinished(fileId)) return false;
      const book = collectStats().finished.find(function(b) { return b.id === fileId; });
      if (!book) return false;
      return _showMilestone(
        t('share.milestone.book.title', { book: book.name }),
        t('share.milestone.book.body'),
        'book:' + book.id,
        function() { _markCelebrated(KEY_CELEBRATED_BOOKS, book.id); }
      );
    } catch (err) {
      console.warn('share-stats: finish offer failed', err);
      return false;
    }
  }

  /* Page mode's tap. Straight to the sheet, no intermediate modal — the user
     has already answered the question the modal would have asked. Marked
     celebrated either way, so home does not ask again a minute later. */
  function openSheetForBook(fileId) {
    try {
      _markCelebrated(KEY_CELEBRATED_BOOKS, fileId);
      openSheet({ preferHeroId: 'book:' + fileId, source: 'milestone' });
    } catch (err) {
      console.warn('share-stats: finish share failed', err);
    }
  }

  /* Streak milestones, and any book completion the reader did not catch — a
     book marked read from the library, or finished in a session that ended
     without the engine reaching the end. Position is sacred (§21), so this
     still never runs over a reader. */
  /* Debug only (§25) — forget which books and streaks have been celebrated, so
     a completion prompt can be seen again.

     Without this the feature is effectively untestable, which is the same hole
     the forced-free flag was built to close. Two things make a book stop
     offering, both deliberate and both permanent: first-run seeding marks every
     *already* finished book as history rather than news, and an offer is spent
     when it is shown (§15 — made, not accepted), so finishing one book across
     five engines spends it on whichever engine got there first. Correct in
     production, impossible to re-check on a device.

     It only clears FlowRead's own bookkeeping — no position, no library, no
     session — so the worst it can do is re-offer a share. The caller is gated
     on isDebugBuild(); this is also, so it cannot be reached by a release build
     even if something calls it. */
  function resetCelebrations() {
    if (typeof isDebugBuild !== 'function' || !isDebugBuild()) return false;
    try {
      localStorage.removeItem(KEY_CELEBRATED_BOOKS);
      localStorage.removeItem(KEY_CELEBRATED_STREAKS);

      /* KEY_SEEDED is deliberately left set. Clearing it looks right and is
         worse: the next home render would re-seed every finished book straight
         back into the celebrated set, undoing the reset before the tester could
         reach a book.

         The skip flag solves the other half of the same problem. Home is the
         backstop for a finished book (§15), so the walk back from Settings to a
         book goes Settings → home → reader, and home's own check would show the
         milestone modal and spend the offer en route. One render is skipped so
         the next prompt is the one the reader itself raises, which is the path
         being tested. */
      localStorage.setItem(KEY_DEBUG_SKIP, '1');
      return true;
    } catch (_) {
      return false;
    }
  }

  function checkMilestones() {
    try {
      if (AppState.activeModal) return;

      /* Consumed once, and only in a debug build — a release build cannot write
         this key, so a stray copy of it does nothing (the same belt-and-braces
         as debugForcedFree(), §25). */
      if (typeof isDebugBuild === 'function' && isDebugBuild()
          && localStorage.getItem(KEY_DEBUG_SKIP)) {
        localStorage.removeItem(KEY_DEBUG_SKIP);
        return;
      }

      const stats = collectStats();
      const books = _loadSet(KEY_CELEBRATED_BOOKS);
      const streaks = _loadSet(KEY_CELEBRATED_STREAKS);

      /* First run: everything already achieved is history, not news. */
      if (!localStorage.getItem(KEY_SEEDED)) {
        localStorage.setItem(KEY_SEEDED, '1');
        localStorage.setItem(KEY_CELEBRATED_BOOKS, JSON.stringify(stats.finished.map(function(b) { return b.id; })));
        localStorage.setItem(KEY_CELEBRATED_STREAKS, JSON.stringify(
          STREAK_MILESTONES.filter(function(m) { return stats.streak >= m; })
        ));
        return;
      }

      const newBook = stats.finished.find(function(b) { return books.indexOf(b.id) === -1; });
      if (newBook) {
        _showMilestone(
          t('share.milestone.book.title', { book: newBook.name }),
          t('share.milestone.book.body'),
          'book:' + newBook.id,
          function() { _markCelebrated(KEY_CELEBRATED_BOOKS, newBook.id); }
        );
        return;
      }

      /* Highest milestone reached but not yet offered — so a user who installs,
         reads for 40 days and only then opens this sees 30, not 7. */
      const due = STREAK_MILESTONES
        .filter(function(m) { return stats.streak >= m && streaks.indexOf(m) === -1; })
        .pop();

      if (due) {
        _showMilestone(
          t('share.milestone.streak.title', { n: due }),
          t('share.milestone.streak.body'),
          'streak',
          function() {
            STREAK_MILESTONES.forEach(function(m) {
              if (stats.streak >= m) _markCelebrated(KEY_CELEBRATED_STREAKS, m);
            });
          }
        );
      }
    } catch (err) {
      /* A celebration must never be able to break the home screen. */
      console.warn('share-stats: milestone check failed', err);
    }
  }

  return {
    openSheet: openSheet,
    checkMilestones: checkMilestones,
    shouldOfferBookFinished: shouldOfferBookFinished,
    resetCelebrations: resetCelebrations,
    offerBookFinished: offerBookFinished,
    openSheetForBook: openSheetForBook,
    hasSomethingToShare: hasSomethingToShare,
    collectStats: collectStats,
  };
})();
