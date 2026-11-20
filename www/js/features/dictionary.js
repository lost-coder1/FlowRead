/* Dictionary Feature — local offline word lookup, free for everyone (§4) */

const DictionaryFeature = (function() {
  let _dict = null;
  let _loadPromise = null;

  /* Letters the lookup key may contain. The asset is English, so the key is
     ASCII — but a word the reader tapped may be anything, and the two must not
     be conflated. See _display(). */
  const KEY_CHARS = /[^a-z'-]/g;

  /* Trim punctuation from both ends while keeping any letter, Latin or
     Devanagari (U+0900–U+097F). Deliberately not a Unicode property escape:
     \p{L} needs a newer WebView than minSdk 24 guarantees (§2.1), and this file
     is on the long-press path for every engine. */
  const DISPLAY_TRIM = /^[^\wऀ-ॿ]+|[^\wऀ-ॿ]+$/g;

  function loadDictionary() {
    if (_dict) return Promise.resolve(_dict);
    if (_loadPromise) return _loadPromise;
    _loadPromise = fetch('assets/dictionary/dict.json')
      .then(function(r) { return r.json(); })
      .then(function(data) { _dict = data; return data; })
      .catch(function() { _dict = {}; return {}; });
    return _loadPromise;
  }

  function _has(word) {
    return !!(_dict && Object.prototype.hasOwnProperty.call(_dict, word));
  }

  /* The dictionary key for a tapped word: lowercased, ASCII letters only.
     Empty for a word with no Latin letters at all, which is how a Hindi word
     is detected — see showDictionaryModal(). */
  function _key(raw) {
    return String(raw || '').toLowerCase().replace(KEY_CHARS, '');
  }

  /* What the reader actually tapped, for the modal title and for Google. */
  function _display(raw) {
    return String(raw || '').trim().replace(DISPLAY_TRIM, '');
  }

  /* The form the dictionary holds for this word, or null. `books` resolves to
     `book` here — without this step every inflected form missed, which is what
     made an 82,559-entry dictionary feel like it was missing simple words. */
  function _resolve(key) {
    if (!key) return null;
    if (typeof Morphology === 'undefined') return _has(key) ? key : null;
    return Morphology.resolve(key, _has);
  }

  /* Definitions for a word, following inflections. Returns null when nothing
     matches, so existing callers behave as before. */
  function lookupWord(raw) {
    if (!_dict) return null;
    const base = _resolve(_key(raw));
    return base ? _dict[base] : null;
  }

  function showDictionaryModal(word) {
    if (AppState.activeModal) return;

    const display = _display(word);
    if (!display) return;

    /* Pause playback while looking up a word */
    document.dispatchEvent(new CustomEvent('fr-reading-pause'));

    /* §23: the tip that teaches this has done its whole job the first time
       someone looks a word up, so retire it here rather than counting shows. */
    if (typeof TipsFeature !== 'undefined') TipsFeature.markDone('dictionary');

    /* A word with no Latin letters cannot be in an English dictionary, and this
       used to return silently: a Hindi reader long-pressing a word got no
       modal, no message and no response at all, while §23's tip told them the
       feature existed. The honest answer names the limitation and still offers
       the route that does work, since Google handles Devanagari fine (§1.5). */
    if (!_key(display)) {
      _renderModal(display, display, null, true);
      return;
    }

    if (!_dict) {
      loadDictionary().then(function() { _open(display); });
    } else {
      _open(display);
    }
  }

  function _open(display) {
    const key = _key(display);
    const base = _resolve(key);
    _renderModal(display, base || key, base ? _dict[base] : null, false);
  }

  /* There was a Pro gate here, and it contradicted the contract: §4 has listed
     the dictionary under the free tier since the pivot's pricing was settled,
     while this function sent every free user to a paywall instead. Removed
     2026-11-20 on the owner's call — the gate was the bug, not the table. The
     online lookup it offered as a consolation is still reachable from the
     modal's own button and from the word-tap setting, so nothing was lost with
     it. */

  function _renderModal(display, base, entries, nonLatin) {
    const root = qs('#modal-root');
    if (!root) return;
    closeActiveModal();
    AppState.activeModal = 'dictionary';

    const POS_LABELS = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };

    let defsHtml = '';
    if (entries && entries.length) {
      const byPos = Object.create(null);
      entries.forEach(function(e) {
        const label = POS_LABELS[e.pos] || e.pos;
        if (!byPos[label]) byPos[label] = [];
        byPos[label].push(e.def);
      });
      defsHtml = Object.keys(byPos).map(function(pos) {
        return '<div class="dict-pos-group">' +
          '<span class="dict-pos-badge">' + escapeHtml(pos) + '</span>' +
          '<ol class="dict-def-list">' +
            byPos[pos].map(function(def) { return '<li>' + escapeHtml(def) + '</li>'; }).join('') +
          '</ol>' +
        '</div>';
      }).join('');
    } else if (nonLatin) {
      defsHtml = '<p class="dict-not-found">' + t('dict.english_only') + '</p>';
    } else {
      defsHtml = '<p class="dict-not-found">' + t('dict.no_definition', { word: display }) + '</p>';
    }

    /* The reader tapped `books`; the entry shown is `book`. Saying so is the
       difference between a dictionary that works and one that looks like it
       answered a different question (§1.5). Only when the two differ. */
    const resolvedNote = (base && base !== _key(display))
      ? '<p class="dict-resolved">' + t('dict.shown_for', { base: escapeHtml(base) }) + '</p>'
      : '';

    /* A definition was found, so the lookup was worth keeping (§27). Saved
       before the modal is drawn so the line below reports the real state. */
    let saved = false;
    if (entries && entries.length && typeof SavedWordsFeature !== 'undefined') {
      const first = entries[0] || {};
      saved = SavedWordsFeature.save({ w: _key(display), base: base, def: first.def, pos: first.pos })
        || SavedWordsFeature.has(_key(display), base);
    }

    const savedHtml = saved
      ? '<p class="dict-saved">' + t('dict.saved') +
        ' <button class="dict-saved-link" id="btn-dict-words" type="button">' + t('dict.view_all') + '</button></p>'
      : '';

    root.innerHTML = '<div class="modal-backdrop" id="modal-backdrop">' +
      '<div class="modal-card dict-modal-card" role="dialog" aria-modal="true">' +
        '<div class="dict-header">' +
          '<h2 class="dict-word-title">' + escapeHtml(display) + '</h2>' +
          '<button class="btn-icon dict-close-btn" id="btn-dict-close" aria-label="' + t('btn.close') + '">✕</button>' +
        '</div>' +
        resolvedNote +
        '<div class="dict-body">' + defsHtml + '</div>' +
        savedHtml +
        '<div class="modal-actions">' +
          '<button class="btn btn-ghost dict-google-btn" id="btn-dict-device">' +
            _searchGlyph() + '<span>' + t('dict.lookup_google') + '</span>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    qs('#btn-dict-close').addEventListener('click', closeActiveModal);

    qs('#btn-dict-device').addEventListener('click', function() {
      /* Choosing to look a word up is intent, so it is kept even with no
         offline definition — that is the second half of §27's save rule, and
         the only route by which a Hindi word is ever saved. */
      if (typeof SavedWordsFeature !== 'undefined') {
        SavedWordsFeature.save({ w: _key(display) || display, base: base, def: '', pos: '' });
      }
      closeActiveModal();
      openDeviceDictionary(display);
    });

    const wordsLink = qs('#btn-dict-words');
    if (wordsLink) {
      wordsLink.addEventListener('click', function() {
        closeActiveModal();
        if (typeof SavedWordsFeature !== 'undefined') SavedWordsFeature.open();
      });
    }

    qs('#modal-backdrop').addEventListener('click', function(e) {
      if (e.target.id === 'modal-backdrop') closeActiveModal();
    });
  }

  /* A monochrome magnifier in §16 colours, not Google's own mark: the real
     multicolour G is a trademark with brand guidelines attached and its four
     brand colours are outside this app's palette. The button names Google in
     words, which is accurate — openDeviceDictionary() goes to Google — and
     costs no palette exception. */
  function _searchGlyph() {
    return '<svg class="dict-google-glyph" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">' +
      '<circle cx="6.8" cy="6.8" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
      '<line x1="10.4" y1="10.4" x2="14.2" y2="14.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
      '</svg>';
  }

  function openDeviceDictionary(word) {
    window.open('https://www.google.com/search?q=define+' + encodeURIComponent(word), '_blank');
  }

  return { loadDictionary, lookupWord, showDictionaryModal, openDeviceDictionary };
})();
