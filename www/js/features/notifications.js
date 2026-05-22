/* Daily reading reminder — schedules one local notification per day */

const NotificationsFeature = (function() {
  const NOTIF_ID = 42; /* fixed ID so rescheduling always replaces, never accumulates */
  const CHANNEL_ID = 'flowread_reminder';

  function _plugin() {
    return (typeof Capacitor !== 'undefined' &&
            Capacitor.Plugins &&
            Capacitor.Plugins.LocalNotifications)
      ? Capacitor.Plugins.LocalNotifications : null;
  }

  function _isEnabled() {
    return localStorage.getItem('fr_reminder_enabled') === 'true';
  }

  function _getHour() {
    return parseInt(localStorage.getItem('fr_reminder_hour') || '20', 10);
  }

  function _unreadCount() {
    const lib = typeof loadLibrary === 'function' ? loadLibrary() : [];
    const isPro = AppState.isPro;
    return lib.filter(function(item) {
      if (!isFileFullyRead(item)) {
        return isPro || item.kind === 'pdf';
      }
      return false;
    }).length;
  }

  /* Returns the next future Date at the given hour (today if not yet passed, else tomorrow) */
  function _nextAt(hour) {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  async function cancel() {
    const p = _plugin();
    if (!p) return;
    try { await p.cancel({ notifications: [{ id: NOTIF_ID }] }); } catch (_) {}
  }

  async function _requestPermission() {
    const p = _plugin();
    if (!p) return false;
    try {
      const result = await p.requestPermissions();
      return result && result.display === 'granted';
    } catch (_) { return false; }
  }

  async function scheduleIfNeeded() {
    const p = _plugin();
    if (!p || !_isEnabled()) { await cancel(); return; }

    const count = _unreadCount();
    if (count === 0) { await cancel(); return; }

    const granted = await _requestPermission();
    if (!granted) return;

    const isPro = AppState.isPro;
    const body = isPro
      ? (count === 1 ? '1 item is waiting to be read.' : count + ' items are waiting to be read.')
      : (count === 1 ? '1 unread PDF is waiting.' : count + ' unread PDFs are waiting.');

    try {
      await cancel();
      await p.schedule({
        notifications: [{
          id: NOTIF_ID,
          title: 'Time to read',
          body: body,
          schedule: { at: _nextAt(_getHour()), allowWhileIdle: true },
          channelId: CHANNEL_ID,
          smallIcon: 'ic_stat_notify',
        }]
      });
    } catch (_) {}
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
    await scheduleIfNeeded();
  }

  return { init, scheduleIfNeeded, cancel };
})();
