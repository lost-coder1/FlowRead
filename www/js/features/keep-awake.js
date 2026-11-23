/* Screen wake lock — prevents screen from dimming during reading */
/* Uses @capacitor-community/keep-awake@5 via Capacitor.Plugins.KeepAwake */

let _wakeLockActive = false;
let _idleReleaseTimer = null;
const IDLE_RELEASE_MS = 5 * 60 * 1000; /* 5 minutes */

/* Holders that must keep the screen awake regardless of what the reader is
   doing (Claude.md §16.32). Two bugs made this necessary and both were latent
   before OCR could run behind a reader:

   1. `_wakeLockActive` is a flag, not a count, so with OCR and the reader both
      holding it, whichever released first took the other's lock with it.
   2. `startIdleReleaseTimer()` releases after five minutes of
      `!AppState.isPlaying`, and **Page mode has no playing state** (§19 says so
      outright) -- so the screen slept five minutes into a prefix read while the
      background run was still going, which is precisely what
      `toast.ocr_keep_open` tells the user not to let happen.

   A named set rather than a counter: an unbalanced acquire then leaks the lock
   forever, where a repeated hold by the same owner is idempotent. */
const _wakeHolders = new Set();

function holdWakeLock(owner) {
  if (!owner) return;
  _wakeHolders.add(owner);
  clearIdleReleaseTimer();
  acquireWakeLock();
}

function releaseWakeLockHold(owner) {
  if (!owner) return;
  _wakeHolders.delete(owner);
  if (!_wakeHolders.size) releaseWakeLock();
}

function wakeLockHeldByOther() {
  return _wakeHolders.size > 0;
}

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
  /* A holder outranks the reader's own release: leaving a reader must not stop
     a background OCR run from finishing with the screen on. */
  if (_wakeHolders.size) return;
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
    if (!AppState.isPlaying && !_wakeHolders.size) releaseWakeLock();
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
