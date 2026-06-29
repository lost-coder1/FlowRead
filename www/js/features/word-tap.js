/* WordTapFeature — configurable word-tap / long-press behaviour across all engines */

const WordTapFeature = (function() {
  const LP_MS = 500;

  function getAction() {
    return localStorage.getItem('fr_word_tap_action') || 'none';
  }

  function isLongpress() {
    /* Default true — long-press mode ON by default */
    return localStorage.getItem('fr_word_tap_longpress') !== 'false';
  }

  function shouldActOnTap() {
    return !isLongpress() && getAction() !== 'none';
  }

  function _trigger(word) {
    if (typeof DictionaryFeature === 'undefined') return;
    const clean = (word || '').trim();
    if (!clean) return;
    const action = getAction();
    if (action === 'lookup_online') {
      document.dispatchEvent(new CustomEvent('fr-reading-pause'));
      DictionaryFeature.openDeviceDictionary(clean);
    } else {
      DictionaryFeature.showDictionaryModal(clean);
    }
  }

  /* Attach click + long-press to a per-word span (Chunk, Scroll, FocusBold).
     The word value is captured at bind time. */
  function bindWord(element, word) {
    let timer = null;
    let lpFired = false;

    element.addEventListener('touchstart', function() {
      lpFired = false;
      if (!isLongpress()) return;
      timer = setTimeout(function() {
        lpFired = true;
        /* Long-press always opens local dictionary regardless of tap action setting */
        if (typeof DictionaryFeature !== 'undefined') DictionaryFeature.showDictionaryModal((word || '').trim());
      }, LP_MS);
    }, { passive: true });

    element.addEventListener('touchend', function() {
      clearTimeout(timer); timer = null;
    }, { passive: true });

    element.addEventListener('touchmove', function() {
      clearTimeout(timer); timer = null;
    }, { passive: true });

    element.addEventListener('click', function(e) {
      if (lpFired) { lpFired = false; return; }
      if (!shouldActOnTap()) return;
      e.stopPropagation();
      _trigger(word);
    });
  }

  return { getAction, isLongpress, shouldActOnTap, bindWord };
})();
