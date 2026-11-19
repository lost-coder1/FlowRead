/* Dictionary Feature — local offline word lookup, free for everyone (§4) */

const DictionaryFeature = (function() {
  let _dict = null;
  let _loadPromise = null;

  function loadDictionary() {
    if (_dict) return Promise.resolve(_dict);
    if (_loadPromise) return _loadPromise;
    _loadPromise = fetch('assets/dictionary/dict.json')
      .then(function(r) { return r.json(); })
      .then(function(data) { _dict = data; return data; })
      .catch(function() { _dict = {}; return {}; });
    return _loadPromise;
  }

  function lookupWord(raw) {
    if (!_dict) return null;
    const word = raw.toLowerCase().replace(/[^a-z'-]/g, '');
    return _dict[word] || null;
  }

  function showDictionaryModal(word) {
    if (AppState.activeModal) return;
    const cleanWord = (word || '').toLowerCase().replace(/[^a-z'-]/g, '');
    if (!cleanWord) return;

    /* Pause playback while looking up a word */
    document.dispatchEvent(new CustomEvent('fr-reading-pause'));

    /* §23: the tip that teaches this has done its whole job the first time
       someone looks a word up, so retire it here rather than counting shows. */
    if (typeof TipsFeature !== 'undefined') TipsFeature.markDone('dictionary');

    if (!_dict) {
      loadDictionary().then(function() { _renderModal(cleanWord); });
    } else {
      _renderModal(cleanWord);
    }
  }

  /* There was a Pro gate here, and it contradicted the contract: §4 has listed
     the dictionary under the free tier since the pivot's pricing was settled,
     while this function sent every free user to a paywall instead. Removed
     2026-11-20 on the owner's call — the gate was the bug, not the table. The
     online lookup it offered as a consolation is still reachable from the
     modal's own button and from the word-tap setting, so nothing was lost with
     it. */

  function _renderModal(cleanWord) {
    const entries = lookupWord(cleanWord);
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
    } else {
      defsHtml = '<p class="dict-not-found">No definition found.</p>';
    }

    root.innerHTML = '<div class="modal-backdrop" id="modal-backdrop">' +
      '<div class="modal-card dict-modal-card" role="dialog" aria-modal="true">' +
        '<div class="dict-header">' +
          '<h2 class="dict-word-title">' + escapeHtml(cleanWord) + '</h2>' +
          '<button class="btn-icon dict-close-btn" id="btn-dict-close" aria-label="Close">✕</button>' +
        '</div>' +
        '<div class="dict-body">' + defsHtml + '</div>' +
        '<div class="modal-actions">' +
          '<button class="btn btn-ghost" id="btn-dict-device">Look up online</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    qs('#btn-dict-close').addEventListener('click', closeActiveModal);
    qs('#btn-dict-device').addEventListener('click', function() {
      closeActiveModal(); openDeviceDictionary(cleanWord);
    });
    qs('#modal-backdrop').addEventListener('click', function(e) {
      if (e.target.id === 'modal-backdrop') closeActiveModal();
    });
  }

  function openDeviceDictionary(word) {
    window.open('https://www.google.com/search?q=define+' + encodeURIComponent(word), '_blank');
  }

  return { loadDictionary, lookupWord, showDictionaryModal, openDeviceDictionary };
})();
