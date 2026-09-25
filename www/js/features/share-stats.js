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
  const KEY_CELEBRATED_BOOKS = 'fr_share_celebrated_books';
  const KEY_CELEBRATED_STREAKS = 'fr_share_celebrated_streaks';
  const KEY_SEEDED = 'fr_share_seeded';

  /* Product decision 2026-09-25: book completion AND streak milestones. Kept
     sparse on purpose — a prompt at every streak day would be nagging. */
  const STREAK_MILESTONES = [7, 30, 100];

  /* 1080² is the safe square for every major destination and stays legible
     when a chat app downscales it to a thumbnail. */
  const CARD_SIZE = 1080;
  const PAD = 88;

  /* Palette is §16 verbatim. Do not introduce new colours here — the card is
     the most public surface the app has and must read as the same product. */
  const COLORS = {
    bg: '#0d0d0d',
    panel: '#141414',
    border: '#2a2a2a',
    accent: '#e8c547',
    text: '#e8e4dc',
    muted: '#6b6660',
  };

  const FONT_DISPLAY = "'Roboto', 'Noto Sans Devanagari', 'Helvetica Neue', Arial, sans-serif";
  const FONT_MONO = "'DM Mono', 'Noto Sans Devanagari', 'Courier New', monospace";

  let _model = null;   /* the stats behind the currently open sheet */
  let _selection = null;

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
          name: item.name,
          days: _daysToFinish(sessions, item.id),
          lastOpened: item.lastOpened || 0,
        };
      })
      .sort(function(a, b) { return b.lastOpened - a.lastOpened; });
  }

  function collectStats() {
    const sessions = loadReadingSessions();
    const lib = loadLibrary();

    return {
      streak: computeStreak(sessions),
      totalWords: sessions.reduce(function(acc, s) { return acc + (s.wordsRead || 0); }, 0),
      totalMinutes: Math.floor(sessions.reduce(function(acc, s) { return acc + (s.durationMs || 0); }, 0) / 60000),
      finished: _finishedBooks(lib, sessions),
    };
  }

  /* Candidate heroes, strongest first. A finished book names something real and
     is far more shareable than a number, so it always outranks the counters. */
  function _heroOptions(stats) {
    const out = [];

    stats.finished.slice(0, 5).forEach(function(book) {
      out.push({
        id: 'book:' + book.id,
        label: t('share.item.book', { book: book.name }),
        text: book.days > 0
          ? t('share.hero.book_days', { book: book.name, n: book.days })
          : t('share.hero.book', { book: book.name }),
      });
    });

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

    return out;
  }

  /* Supporting lines. Deliberately a flat, ordered list of rows rather than a
     fixed layout: §15 asks that a future "time reclaimed" stat — the nudge
     counters in NudgeGate already hold the data — can be added as one more
     entry here without the card being redrawn from scratch. Not in v1. */
  function _extraOptions(stats, heroId) {
    const out = [];

    if (heroId !== 'streak' && stats.streak >= 2) {
      out.push({ id: 'streak', label: t('share.item.streak', { n: stats.streak }), text: t('share.line.streak', { n: stats.streak }) });
    }
    if (heroId !== 'words' && stats.totalWords > 0) {
      out.push({ id: 'words', label: t('share.item.words', { n: formatNumber(stats.totalWords) }), text: t('share.line.words', { n: formatNumber(stats.totalWords) }) });
    }
    if (stats.totalMinutes >= 60) {
      const h = Math.floor(stats.totalMinutes / 60);
      out.push({ id: 'time', label: t('share.item.time', { n: h }), text: t('share.line.time', { n: h }) });
    }
    if (stats.finished.length > 1) {
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
    const words = String(text).split(' ');
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
     be truncated — the title is the most shareable part of the card. */
  function _fitHero(ctx, text, maxWidth, maxLines) {
    for (var size = 76; size >= 40; size -= 4) {
      ctx.font = '700 ' + size + 'px ' + FONT_DISPLAY;
      const lines = _wrap(ctx, text, maxWidth);
      if (lines.length <= maxLines) return { size: size, lines: lines };
    }
    ctx.font = '700 40px ' + FONT_DISPLAY;
    return { size: 40, lines: _wrap(ctx, text, maxWidth).slice(0, maxLines) };
  }

  async function drawCard(hero, extras) {
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
       looking top-heavy and a three-line card looking cramped. */
    const fit = _fitHero(ctx, hero, contentWidth, 3);
    const lineHeight = Math.round(fit.size * 1.22);
    const heroBlockHeight = fit.lines.length * lineHeight;

    const rows = extras.slice(0, 3);
    const EXTRA_GAP = 72;
    const EXTRA_ROW = 54;
    const extrasHeight = rows.length ? EXTRA_GAP + (rows.length * EXTRA_ROW) : 0;

    const BAND_TOP = 236;
    const BAND_BOTTOM = 852;
    const blockTop = Math.round(
      BAND_TOP + ((BAND_BOTTOM - BAND_TOP) - (heroBlockHeight + extrasHeight)) / 2
    );

    ctx.fillStyle = COLORS.text;
    ctx.font = '700 ' + fit.size + 'px ' + FONT_DISPLAY;
    fit.lines.forEach(function(line, i) {
      ctx.fillText(line, left, blockTop + (i * lineHeight) + fit.size);
    });

    /* Supporting rows. Adding a future row — §15's "time reclaimed" — costs one
       entry in the array and nothing here changes.

       Drawn as --text at reduced opacity rather than flat --text-muted: muted
       is tuned for 12–14px UI text on a screen the reader is holding, and this
       image gets downscaled into someone else's feed. Same palette token, more
       of it (§16 — no new colours). */
    let y = blockTop + heroBlockHeight + EXTRA_GAP;
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
    const text = t('share.sheet.text');

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

    drawCard(hero.text, extras.map(function(e) { return e.text; })).then(function(canvas) {
      /* The sheet may have been closed while the fonts settled. */
      const target = qs('#share-preview');
      if (!target) return;
      canvas.className = 'share-preview-canvas';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', hero.text);
      target.innerHTML = '';
      target.appendChild(canvas);
    });
  }

  function _renderExtras() {
    const box = qs('#share-extras');
    if (!box || !_model) return;

    const extras = _model.extrasFor(_selection.heroId);
    /* Dropping the hero from the list can orphan a checked extra. */
    _selection.extras = _selection.extras.filter(function(id) {
      return extras.some(function(e) { return e.id === id; });
    });

    const label = qs('#share-extras-label');
    if (label) label.hidden = extras.length === 0;

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

    _model = {
      stats: stats,
      heroes: heroes,
      extrasFor: function(id) { return _extraOptions(stats, id); },
    };
    _selection = {
      heroId: heroId,
      extras: _model.extrasFor(heroId).slice(0, 2).map(function(e) { return e.id; }),
    };

    closeActiveModal();
    AppState.activeModal = 'share-stats';

    root.innerHTML = `
      <div class="modal-backdrop" id="share-backdrop">
        <div class="modal-card share-card" role="dialog" aria-modal="true">
          <p class="modal-kicker">${t('share.sheet.kicker')}</p>
          <h2 class="modal-title">${t('share.sheet.title')}</h2>
          <div class="share-preview" id="share-preview"></div>
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
        _renderExtras();
        _renderPreview();
      });
    });

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
        const canvas = await drawCard(hero.text, extras);
        await _shareCanvas(canvas);
        /* Q11, approved 2026-09-25. Entry point only — never which book, which
           stat, or which app it went to (§1.4). Fire-and-forget, after the
           share has actually completed. */
        if (typeof AnalyticsPing !== 'undefined') {
          AnalyticsPing.logEvent('stats_shared', { source: opts.source || 'unknown' });
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

  /* Called when the user lands on home — never mid-read. Position is sacred
     (§21) and a modal over a reader is the wrong moment for a celebration. */
  function checkMilestones() {
    try {
      if (AppState.activeModal) return;

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
    hasSomethingToShare: hasSomethingToShare,
    collectStats: collectStats,
  };
})();
