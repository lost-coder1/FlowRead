/* Utility: number and date formatting */

function formatNumber(n) {
  return n.toLocaleString();
}

function formatPct(current, total) {
  if (!total) return '0%';
  return Math.round((current / total) * 100) + '%';
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatWPM(wpm) {
  return wpm + ' WPM';
}

/* Devanagari and other Indic/CJK scripts use multi-codepoint grapheme clusters
   (base char + matra/vowel sign). Splitting in the middle of a cluster across
   two DOM elements breaks OpenType shaping and the browser shows ◌ as a
   placeholder. These helpers respect grapheme boundaries. */
function splitAtGrapheme(word, fraction) {
  if (!word) return ['', ''];
  if (typeof Intl === 'undefined' || !Intl.Segmenter) {
    const i = Math.max(1, Math.ceil(word.length * fraction));
    return [word.slice(0, i), word.slice(i)];
  }
  const segs = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(word));
  if (segs.length <= 1) return [word, ''];
  const target = Math.max(1, Math.ceil(segs.length * fraction));
  const cut = segs[Math.min(target, segs.length - 1)].index;
  return [word.slice(0, cut), word.slice(cut)];
}

/* Expand PDF typographic ligatures so ORP lands on a real visible letter */
function _normalizeLigatures(w) {
  return w
    .replace(/ﬀ/g, 'ff')
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .replace(/ﬃ/g, 'ffi')
    .replace(/ﬄ/g, 'ffl')
    .replace(/ﬅ/g, 'st')
    .replace(/ﬆ/g, 'st');
}

function graphemeAt(word, fraction) {
  if (!word) return { before: '', cluster: '', after: '' };
  const w = _normalizeLigatures(word);
  if (typeof Intl === 'undefined' || !Intl.Segmenter) {
    const i = Math.min(w.length - 1, Math.floor(w.length * fraction));
    return { before: w.slice(0, i), cluster: w[i] || '', after: w.slice(i + 1) };
  }
  const segs = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(w));
  if (!segs.length) return { before: '', cluster: '', after: '' };
  const target = Math.min(segs.length - 1, Math.floor(segs.length * fraction));
  const seg = segs[target];
  const end = seg.index + seg.segment.length;
  return { before: w.slice(0, seg.index), cluster: seg.segment, after: w.slice(end) };
}
