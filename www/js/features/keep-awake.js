/* Screen wake lock — prevents screen from dimming during reading */
/* Uses @capacitor-community/keep-awake@5 */

let _wakeLockActive = false;
let _idleReleaseTimer = null;
const IDLE_RELEASE_MS = 5 * 60 * 1000; /* 5 minutes */

async function acquireWakeLock() {
  try {
    if (typeof CapacitorKeepAwake !== 'undefined') {
      await CapacitorKeepAwake.KeepAwake.keepAwake();
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
    if (typeof CapacitorKeepAwake !== 'undefined') {
      await CapacitorKeepAwake.KeepAwake.allowSleep();
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
