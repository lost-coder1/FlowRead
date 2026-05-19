/* Screen wake lock — prevents screen from dimming during reading */
/* Uses @capacitor-community/keep-awake@5 via Capacitor.Plugins.KeepAwake */

let _wakeLockActive = false;
let _idleReleaseTimer = null;
const IDLE_RELEASE_MS = 5 * 60 * 1000; /* 5 minutes */

function _getPlugin() {
  return window.Capacitor &&
         window.Capacitor.Plugins &&
         window.Capacitor.Plugins.KeepAwake || null;
}

async function acquireWakeLock() {
  try {
    const plugin = _getPlugin();
    if (plugin) {
      await plugin.keepAwake();
    }
    _wakeLockActive = true;
  } catch (e) {
    /* Non-fatal — reading still works without wake lock */
    console.warn('Wake lock acquire failed:', e);
  }
}

async function releaseWakeLock() {
  clearIdleReleaseTimer();
  try {
    const plugin = _getPlugin();
    if (plugin) {
      await plugin.allowSleep();
    }
    _wakeLockActive = false;
  } catch (e) {
    console.warn('Wake lock release failed:', e);
  }
}

/* Start idle timer — releases wake lock after 5min of paused reading */
function startIdleReleaseTimer() {
  clearIdleReleaseTimer();
  _idleReleaseTimer = setTimeout(function() {
    if (!AppState.isPlaying) releaseWakeLock();
  }, IDLE_RELEASE_MS);
}

function clearIdleReleaseTimer() {
  if (_idleReleaseTimer) {
    clearTimeout(_idleReleaseTimer);
    _idleReleaseTimer = null;
  }
}

/* Re-acquire wake lock when app returns to foreground — Android can clear
   FLAG_KEEP_SCREEN_ON on activity recreation or after app-switcher use */
(function() {
  if (typeof Capacitor === 'undefined' || !Capacitor.Plugins || !Capacitor.Plugins.App) return;
  Capacitor.Plugins.App.addListener('appStateChange', function(state) {
    if (state.isActive && _wakeLockActive) acquireWakeLock();
  });
})();
