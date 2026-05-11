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
