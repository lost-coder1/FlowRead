/* Daily reading reminder + optional streak-protection nudge
 * - Primary reminder: one per day at user-chosen hour, motivational copy
 *   chosen at schedule time from streak / in-progress / generic pools.
 *   Skipped if the user has already met today's reading threshold.
 * - Streak nudge: 45 min after primary, only when streak >= 3 and user
 *   still hasn't read today. Cancelled the moment they cross the threshold.
 * - Max 2 notifications/day, ever.
 */

const NotificationsFeature = (function() {
  const NOTIF_PRIMARY = 1001;
  const NOTIF_STREAK = 1002;
  const CHANNEL_ID = 'flowread_reminder';
  const STREAK_NUDGE_DELAY_MS = 45 * 60 * 1000;
  const DAILY_WORDS_THRESHOLD = 100;
  const DAILY_DURATION_THRESHOLD_MS = 60 * 1000;
  const STREAK_NUDGE_MIN_STREAK = 3;

  function _plugin() {
    return (typeof Capacitor !== 'undefined' &&
            Capacitor.Plugins &&
            Capacitor.Plugins.LocalNotifications)
      ? Capacitor.Plugins.LocalNotifications : null;
  }

  function _isPrimaryEnabled() {
    return localStorage.getItem('fr_reminder_enabled') !== 'false';
  }

  function _isStreakNudgeEnabled() {
    return localStorage.getItem('fr_notif_streak_nudge') !== 'false';
  }

  /* Returns { hour, minute }. Migrates the legacy `fr_reminder_hour` key
   * (integer hour only) to the new `fr_reminder_time` "HH:MM" format. */
  function _getReminderTime() {
    let raw = localStorage.getItem('fr_reminder_time');
    if (!raw) {
      const legacyHour = localStorage.getItem('fr_reminder_hour');
      if (legacyHour !== null) {
        const h = parseInt(legacyHour, 10);
        if (h >= 0 && h <= 23) {
          raw = String(h).padStart(2, '0') + ':00';
          localStorage.setItem('fr_reminder_time', raw);
          localStorage.removeItem('fr_reminder_hour');
        }
      }
    }
    if (!raw || !/^\d{2}:\d{2}$/.test(raw)) raw = '21:00';
    const parts = raw.split(':');
    return { hour: parseInt(parts[0], 10), minute: parseInt(parts[1], 10) };
  }

  function _todayString() {
    return (typeof todayDateString === 'function') ? todayDateString() : (function() {
      const d = new Date();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return d.getFullYear() + '-' + mm + '-' + dd;
    })();
  }

  /* Has the user read enough today to count as "read"? */
  function _hasReadToday() {
    if (typeof loadReadingSessions !== 'function') return false;
    const today = _todayString();
    const sessions = loadReadingSessions();
    for (var i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      if (!s || s.date !== today) continue;
      if ((s.wordsRead || 0) >= DAILY_WORDS_THRESHOLD) return true;
      if ((s.durationMs || 0) >= DAILY_DURATION_THRESHOLD_MS) return true;
    }
    return false;
  }

  function _currentStreak() {
    if (typeof computeStreak !== 'function' || typeof loadReadingSessions !== 'function') return 0;
    try { return computeStreak(loadReadingSessions()); } catch (_) { return 0; }
  }

  /* Pick the in-progress file most likely to be finished next (highest %, 5–95%) */
  function _activeProgressFile() {
    if (typeof loadLibrary !== 'function' || typeof loadPosition !== 'function') return null;
    const lib = loadLibrary();
    let best = null;
    for (var i = 0; i < lib.length; i++) {
      const item = lib[i];
      if (!item || !item.wordCount) continue;
      const pos = loadPosition(item.id) || 0;
      const pct = Math.round((pos / item.wordCount) * 100);
      if (pct >= 5 && pct < 95) {
        if (!best || pct > best.pct) best = { item: item, pct: pct };
      }
    }
    return best;
  }

  function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function _truncateTitle(s) {
    if (!s) return '';
    return s.length > 40 ? s.slice(0, 37) + '…' : s;
  }

  function _pickPrimaryMessage() {
    const tr = (typeof t === 'function') ? t : function(k) { return k; };
    const streak = _currentStreak();

    if (streak >= 2) {
      const bodyKey = _pick(['notif.streak.1', 'notif.streak.2', 'notif.streak.3']);
      return { title: tr('notif.title.streak'), body: tr(bodyKey, { n: streak, next: streak + 1 }) };
    }
    const progress = _activeProgressFile();
    if (progress) {
      const bodyKey = _pick(['notif.progress.1', 'notif.progress.2', 'notif.progress.3']);
      const title = _truncateTitle(progress.item.name || progress.item.title || '');
      return { title: tr('notif.title.progress'), body: tr(bodyKey, { pct: progress.pct, title: title }) };
    }
    const bodyKey = _pick([
      'notif.generic.1', 'notif.generic.2', 'notif.generic.3',
      'notif.generic.4', 'notif.generic.5', 'notif.generic.6',
    ]);
    return { title: tr('notif.title.generic'), body: tr(bodyKey) };
  }

  function _pickNudgeMessage() {
    const tr = (typeof t === 'function') ? t : function(k) { return k; };
    const streak = _currentStreak();
    const bodyKey = _pick(['notif.nudge.1', 'notif.nudge.2', 'notif.nudge.3']);
    return { title: tr('notif.title.nudge'), body: tr(bodyKey, { n: streak }) };
  }

  /* Next future Date at the given HH:MM (today if not yet passed, else tomorrow) */
  function _nextAt(hour, minute) {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, minute || 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  function _isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
  }

  async function _cancelAll() {
    const p = _plugin();
    if (!p) return;
    try { await p.cancel({ notifications: [{ id: NOTIF_PRIMARY }, { id: NOTIF_STREAK }] }); } catch (_) {}
  }

  async function requestPermission() {
    const p = _plugin();
    if (!p) return false;
    try {
      const r = await p.requestPermissions();
      return !!(r && r.display === 'granted');
    } catch (_) { return false; }
  }

  async function _hasPermission() {
    const p = _plugin();
    if (!p) return false;
    try {
      const r = await p.checkPermissions();
      return !!(r && r.display === 'granted');
    } catch (_) { return false; }
  }

  async function reschedule() {
    const p = _plugin();
    if (!p) return;

    await _cancelAll();

    if (!_isPrimaryEnabled()) return;
    if (!(await _hasPermission())) return;

    const now = new Date();
    const tm = _getReminderTime();
    const primaryAt = _nextAt(tm.hour, tm.minute);
    /* Skip today's primary if user already read enough today */
    const skipPrimary = _isSameDay(primaryAt, now) && _hasReadToday();

    const toSchedule = [];

    if (!skipPrimary) {
      const msg = _pickPrimaryMessage();
      toSchedule.push({
        id: NOTIF_PRIMARY,
        title: msg.title,
        body: msg.body,
        schedule: { at: primaryAt, allowWhileIdle: true },
        channelId: CHANNEL_ID,
        smallIcon: 'ic_stat_notify',
      });
    }

    /* Streak-protection nudge: 45 min after primary, only on the same day,
     * only when streak >= threshold and user hasn't already read today. */
    const streak = _currentStreak();
    if (_isStreakNudgeEnabled() && streak >= STREAK_NUDGE_MIN_STREAK && !_hasReadToday()) {
      const nudgeAt = new Date(primaryAt.getTime() + STREAK_NUDGE_DELAY_MS);
      if (_isSameDay(nudgeAt, primaryAt)) {
        const msg = _pickNudgeMessage();
        toSchedule.push({
          id: NOTIF_STREAK,
          title: msg.title,
          body: msg.body,
          schedule: { at: nudgeAt, allowWhileIdle: true },
          channelId: CHANNEL_ID,
          smallIcon: 'ic_stat_notify',
        });
      }
    }

    if (toSchedule.length) {
      try { await p.schedule({ notifications: toSchedule }); } catch (_) {}
    }
  }

  /* First boot: enable reminder defaults and prompt for permission once.
   * Users can still flip both in Settings → Notifications. */
  async function _ensureFirstBootDefaults() {
    if (localStorage.getItem('fr_notif_first_boot') === 'done') return;

    if (localStorage.getItem('fr_reminder_enabled') === null) {
      localStorage.setItem('fr_reminder_enabled', 'true');
    }
    if (localStorage.getItem('fr_notif_streak_nudge') === null) {
      localStorage.setItem('fr_notif_streak_nudge', 'true');
    }
    if (localStorage.getItem('fr_reminder_time') === null
        && localStorage.getItem('fr_reminder_hour') === null) {
      localStorage.setItem('fr_reminder_time', '21:00');
    }

    await requestPermission();
    localStorage.setItem('fr_notif_first_boot', 'done');
  }

  async function init() {
    const p = _plugin();
    if (!p) return;
    try {
      await p.createChannel({
        id: CHANNEL_ID,
        name: 'Reading reminders',
        description: 'Daily nudge to keep your reading streak going',
        importance: 3,
        visibility: 1,
        vibration: true,
      });
    } catch (_) {}
    await _ensureFirstBootDefaults();
    await reschedule();
  }

  /* Public API. scheduleIfNeeded retained for back-compat with existing callers. */
  return {
    init: init,
    reschedule: reschedule,
    scheduleIfNeeded: reschedule,
    cancel: _cancelAll,
    cancelAll: _cancelAll,
    requestPermission: requestPermission,
  };
})();
