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

function graphemeAt(word, fraction) {
  if (!word) return { before: '', cluster: '', after: '' };
  if (typeof Intl === 'undefined' || !Intl.Segmenter) {
    const i = Math.min(word.length - 1, Math.floor(word.length * fraction));
    return { before: word.slice(0, i), cluster: word[i] || '', after: word.slice(i + 1) };
  }
  const segs = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(word));
  if (!segs.length) return { before: '', cluster: '', after: '' };
  const target = Math.min(segs.length - 1, Math.floor(segs.length * fraction));
  const seg = segs[target];
  const end = seg.index + seg.segment.length;
  return { before: word.slice(0, seg.index), cluster: seg.segment, after: word.slice(end) };
}
