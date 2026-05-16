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

function lastNSessions(sessions, n) {
  return sessions.slice(-n);
}

function completionStats(lib) {
  let completed = 0;
  const byKind = { pdf: 0, docx: 0, txt: 0, url: 0 };

  lib.forEach(function(item) {
    const pos = loadPosition(item.id);
    if (item.wordCount && pos >= item.wordCount) {
      completed++;
      const kind = item.kind || 'pdf';
      byKind[kind] = (byKind[kind] || 0) + 1;
    }
  });

  return { completed, byKind };
}

function mostRecentFile(lib) {
  if (lib.length === 0) return null;
  const sorted = lib.slice().sort(function(a, b) { return b.lastOpened - a.lastOpened; });
  const item = sorted[0];
  return {
    fileId: item.id,
    name: item.name,
    wordCount: item.wordCount,
    position: loadPosition(item.id)
  };
}

function timeToComplete(mostRecentFileData, avgWpm) {
  if (!mostRecentFileData || !avgWpm || avgWpm <= 0) return '—';

  const wordsRemaining = Math.max(0, mostRecentFileData.wordCount - mostRecentFileData.position);
  if (wordsRemaining <= 0) return 'You\'ve finished this one!';

  const minutesNeeded = Math.round(wordsRemaining / avgWpm);
  if (minutesNeeded < 60) return '~' + minutesNeeded + ' min';
  const h = Math.floor(minutesNeeded / 60);
  const m = minutesNeeded % 60;
  return '~' + h + 'h ' + m + 'm';
}

function getHeatmapIntensity(words) {
  if (words === 0) return 0;
  if (words < 500) return 1;
  if (words < 2000) return 2;
  return 3;
}

function buildHeatmapData(sessions) {
  const result = [];
  const wordsByDate = {};

  sessions.forEach(function(s) {
    if (!wordsByDate[s.date]) wordsByDate[s.date] = 0;
    wordsByDate[s.date] += s.wordsRead || 0;
  });

  const today = new Date();
  for (var i = 90; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = d.getFullYear() + '-' + mm + '-' + dd;
    const words = wordsByDate[dateStr] || 0;
    const isToday = i === 0;

    result.push({
      date: dateStr,
      words: words,
      level: getHeatmapIntensity(words),
      isToday: isToday,
      dayOfWeek: d.getDay()
    });
  }

  return result;
}

function wpmTrend(sessions) {
  if (sessions.length < 2) return 'steady';

  const first3 = sessions.slice(0, Math.min(3, sessions.length));
  const last3 = sessions.slice(Math.max(0, sessions.length - 3));

  const firstAvg = first3.reduce(function(acc, s) { return acc + s.wpm; }, 0) / first3.length;
  const lastAvg = last3.reduce(function(acc, s) { return acc + s.wpm; }, 0) / last3.length;

  const diff = lastAvg - firstAvg;
  if (diff > 5) return 'up';
  if (diff < -5) return 'down';
  return 'steady';
}

function renderWpmChartSvg(sessions) {
  if (sessions.length === 0) {
    return '<p class="dashboard-chart-empty">Not enough sessions yet — keep reading to see your trend.</p>';
  }

  const data = sessions.map(function(s) { return s.wpm; });
  const minWpm = Math.min.apply(null, data);
  const maxWpm = Math.max.apply(null, data);
  const range = maxWpm - minWpm || 1;

  const width = 300;
  const height = 80;
  const padding = 8;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  const points = data.map(function(wpm, idx) {
    const x = padding + (idx / (data.length - 1 || 1)) * graphWidth;
    const y = height - padding - ((wpm - minWpm) / range) * graphHeight;
    return { x: x, y: y, wpm: wpm };
  });

  let polylinePath = points.map(function(p, i) { return (i === 0 ? 'M' : 'L') + ' ' + p.x + ' ' + p.y; }).join(' ');
  const areaPath = polylinePath + ' L ' + points[points.length - 1].x + ' ' + height + ' L ' + padding + ' ' + height + ' Z';

  const trend = wpmTrend(sessions);
  const trendLabels = { up: '↑ Improving', down: '↓ Declining', steady: '→ Steady' };

  return `
    <div class="dashboard-chart-container">
      <svg class="dashboard-chart-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="wpm-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#e8c547" stop-opacity="0.3" />
            <stop offset="100%" stop-color="#e8c547" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path d="${areaPath}" fill="url(#wpm-gradient)" />
        <polyline points="${points.map(function(p) { return p.x + ',' + p.y; }).join(' ')}" stroke="#e8c547" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        ${points.map(function(p) { return '<circle cx="' + p.x + '" cy="' + p.y + '" r="3" fill="#e8c547" stroke="#1c1c1c" stroke-width="2" />'; }).join('')}
      </svg>
      <p class="dashboard-chart-trend dashboard-chart-trend--${trend}">${trendLabels[trend]}</p>
    </div>
  `;
}

function renderHeatmapHtml(heatmapData) {
  const heatmapHtml = heatmapData.map(function(day) {
    const todayClass = day.isToday ? ' dashboard-heatmap-today' : '';
    return '<div class="dashboard-heatmap-cell' + todayClass + '" data-level="' + day.level + '" title="' + day.date + ': ' + day.words + ' words"></div>';
  }).join('');

  return `
    <div class="dashboard-heatmap-scroll">
      <div class="dashboard-heatmap-grid">
        ${heatmapHtml}
      </div>
      <p class="dashboard-heatmap-legend">Green intensity shows reading activity. Darker = more words read.</p>
    </div>
  `;
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

  const last7 = lastNSessions(sessions, 7);
  const completion = completionStats(lib);
  const mostRecent = mostRecentFile(lib);
  const timeEstimate = timeToComplete(mostRecent, avgWpm);
  const heatmapData = buildHeatmapData(sessions);
  const heatmapHtml = renderHeatmapHtml(heatmapData);
  const wpmChartHtml = renderWpmChartSvg(last7);

  const totalCompleted = completion.completed;
  const completedByKind = completion.byKind;
  const totalCompletedBooks = Object.values(completedByKind).reduce(function(a, b) { return a + b; }, 0);

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
        <div class="dashboard-kpi-card">
          <p class="dashboard-kpi-label">Total reading time</p>
          <p class="dashboard-kpi-value">${totalTime}</p>
        </div>
        <div class="dashboard-kpi-card dashboard-kpi-card-wide">
          <p class="dashboard-kpi-label">Time to complete current file</p>
          <p class="dashboard-kpi-value">${mostRecent ? timeEstimate + (timeEstimate !== '—' && timeEstimate !== 'You\'ve finished this one!' ? ' in ' + escapeHtml(mostRecent.name.length > 20 ? mostRecent.name.substring(0, 17) + '...' : mostRecent.name) : '') : '—'}</p>
        </div>
      </div>

      ${sessions.length > 0 ? `
        <section class="dashboard-section">
          <h2 class="section-heading">WPM Progress (Last 7 Sessions)</h2>
          ${wpmChartHtml}
        </section>
      ` : ''}

      ${lib.length > 0 ? `
        <section class="dashboard-section">
          <h2 class="section-heading">Books Completed</h2>
          ${totalCompletedBooks > 0 ? `
            <div class="dashboard-completion-card">
              <p class="dashboard-completion-label">${totalCompletedBooks} completed</p>
              <div class="dashboard-completion-bar">
                ${completedByKind.pdf > 0 ? '<div class="dashboard-completion-segment" style="flex: ' + completedByKind.pdf + '; background: var(--accent);"></div>' : ''}
                ${completedByKind.docx > 0 ? '<div class="dashboard-completion-segment" style="flex: ' + completedByKind.docx + '; background: var(--accent-2);"></div>' : ''}
                ${completedByKind.txt > 0 ? '<div class="dashboard-completion-segment" style="flex: ' + completedByKind.txt + '; background: var(--text-muted);"></div>' : ''}
                ${completedByKind.url > 0 ? '<div class="dashboard-completion-segment" style="flex: ' + completedByKind.url + '; background: var(--text-dim);"></div>' : ''}
              </div>
              <div class="dashboard-completion-legend">
                ${completedByKind.pdf > 0 ? '<span><span class="legend-dot" style="background: var(--accent);"></span>PDF (' + completedByKind.pdf + ')</span>' : ''}
                ${completedByKind.docx > 0 ? '<span><span class="legend-dot" style="background: var(--accent-2);"></span>DOCX (' + completedByKind.docx + ')</span>' : ''}
                ${completedByKind.txt > 0 ? '<span><span class="legend-dot" style="background: var(--text-muted);"></span>TXT (' + completedByKind.txt + ')</span>' : ''}
                ${completedByKind.url > 0 ? '<span><span class="legend-dot" style="background: var(--text-dim);"></span>URL (' + completedByKind.url + ')</span>' : ''}
              </div>
            </div>
          ` : `
            <p class="dashboard-empty-section">No files completed yet. Finish a file to see your progress.</p>
          `}
        </section>
      ` : ''}

      ${sessions.length > 0 ? `
        <section class="dashboard-section">
          <h2 class="section-heading">Reading Streak Heatmap (Last 91 Days)</h2>
          ${heatmapHtml}
        </section>
      ` : ''}

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
