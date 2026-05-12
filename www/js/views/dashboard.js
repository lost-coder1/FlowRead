/* Dashboard (Pro) — reading stats and KPIs */

function computeStreak(sessions) {
  const dateset = new Set(sessions.map(function(s) { return s.date; }));
  let streak = 0;
  let cursor = new Date();

  for (var i = 0; i < 365; i++) {
    var mm = String(cursor.getMonth() + 1).padStart(2, '0');
    var dd = String(cursor.getDate()).padStart(2, '0');
    var dateStr = cursor.getFullYear() + '-' + mm + '-' + dd;

    if (dateset.has(dateStr)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

function last7DaysAvgWpm(sessions) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  var mm = String(cutoff.getMonth() + 1).padStart(2, '0');
  var dd = String(cutoff.getDate()).padStart(2, '0');
  var cutoffStr = cutoff.getFullYear() + '-' + mm + '-' + dd;

  const recent = sessions.filter(function(s) { return s.date >= cutoffStr && s.wpm > 0; });
  if (recent.length === 0) return 0;

  return Math.round(recent.reduce(function(acc, s) { return acc + s.wpm; }, 0) / recent.length);
}

function formatTotalTime(sessions) {
  const totalMs = sessions.reduce(function(acc, s) { return acc + (s.durationMs || 0); }, 0);
  const totalMin = Math.floor(totalMs / 60000);
  if (totalMin < 60) return totalMin + ' min';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h + 'h ' + m + 'm';
}

function renderDashboard() {
  closeActiveModal();
  const view = qs('#view-dashboard');
  if (!view) return;

  const sessions = loadReadingSessions();
  const lib = loadLibrary();

  const totalWords = sessions.reduce(function(acc, s) { return acc + (s.wordsRead || 0); }, 0);

  const today = todayDateString();
  const todayWords = sessions
    .filter(function(s) { return s.date === today; })
    .reduce(function(acc, s) { return acc + (s.wordsRead || 0); }, 0);

  const streak = computeStreak(sessions);
  const avgWpm = last7DaysAvgWpm(sessions);
  const totalTime = formatTotalTime(sessions);

  view.innerHTML = `
    <div class="dashboard-screen">
      <div class="dashboard-header">
        <button class="btn btn-ghost" id="btn-dashboard-back">←</button>
        <div>
          <p class="settings-kicker">Pro</p>
          <h1 class="settings-title">Dashboard</h1>
        </div>
      </div>

      <div class="dashboard-kpi-grid">
        <div class="dashboard-kpi-card">
          <p class="dashboard-kpi-label">Total words read</p>
          <p class="dashboard-kpi-value">${formatNumber(totalWords)}</p>
        </div>
        <div class="dashboard-kpi-card">
          <p class="dashboard-kpi-label">Today</p>
          <p class="dashboard-kpi-value">${formatNumber(todayWords)} words</p>
        </div>
        <div class="dashboard-kpi-card">
          <p class="dashboard-kpi-label">Current streak</p>
          <p class="dashboard-kpi-value">${streak} day${streak !== 1 ? 's' : ''}</p>
        </div>
        <div class="dashboard-kpi-card">
          <p class="dashboard-kpi-label">Avg WPM (7 days)</p>
          <p class="dashboard-kpi-value">${avgWpm > 0 ? formatWPM(avgWpm) : '—'}</p>
        </div>
        <div class="dashboard-kpi-card dashboard-kpi-card-wide">
          <p class="dashboard-kpi-label">Total reading time</p>
          <p class="dashboard-kpi-value">${totalTime}</p>
        </div>
      </div>

      ${lib.length > 0 ? `
        <section class="dashboard-section">
          <h2 class="library-heading">Your library</h2>
          <div class="library-grid">
            ${lib.map(function(item) {
              const pct = item.wordCount ? Math.min(100, Math.round((loadPosition(item.id) / item.wordCount) * 100)) : 0;
              const kindLabel = item.kind === 'url' ? 'URL' : item.kind ? item.kind.toUpperCase() : 'PDF';
              return [
                '<div class="library-card" data-file-id="' + escapeHtml(item.id) + '">',
                '<span class="library-card-kind">' + escapeHtml(kindLabel) + '</span>',
                '<p class="library-card-name">' + escapeHtml(item.name) + '</p>',
                '<p class="library-card-meta">' + escapeHtml(formatDate(item.lastOpened)) + (pct > 0 ? ' · ' + pct + '%' : '') + '</p>',
                '<div class="library-card-progress"><div class="library-card-progress-fill" style="width:' + pct + '%"></div></div>',
                '</div>',
              ].join('');
            }).join('')}
          </div>
        </section>
      ` : ''}

      ${sessions.length === 0 ? `
        <p class="dashboard-empty">No reading sessions recorded yet. Start reading to see your stats.</p>
      ` : ''}
    </div>
  `;

  qs('#btn-dashboard-back').addEventListener('click', function() {
    renderUpload();
    switchView('view-upload');
  });

  qsa('.library-card[data-file-id]', view).forEach(function(card) {
    card.addEventListener('click', function() {
      const id = card.dataset.fileId;
      const entry = lib.find(function(e) { return e.id === id; });
      if (entry) resumeFromLibrary(entry);
    });
  });
}
