package com.flowread.app;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Notices when one of the user's chosen apps is in front of them.
 *
 * Configured in res/xml/nudge_accessibility_service.xml with
 * canRetrieveWindowContent="false" and typeWindowStateChanged only, so the only
 * thing it can learn is a package name. The event filter is narrowed further at
 * runtime to exactly the user's chosen packages (applyTargets), which means the
 * system delivers nothing at all about any other app.
 *
 * Window events alone cannot cover the case the whole feature exists for: a user
 * who opens one feed and scrolls it for half an hour produces a single event, at
 * minute zero, before any of the time exists. So one check is kept pending while
 * a target app is in front (scheduleCheck) — one Handler message, never a poll
 * loop (Claude.md 21).
 *
 * Claude.md 9.4, Q8 signed off 2026-09-20.
 */
public class FlowReadNudgeService extends AccessibilityService {

    private static final String TAG = "FlowReadNudge";

    /* Floor and ceiling on the pending check. The floor keeps a just-crossed
       threshold from turning into a tight loop; the ceiling means a long wait is
       re-evaluated a few times rather than trusted to one far-off alarm, which
       also catches the user changing their threshold mid-session. */
    private static final long MIN_CHECK_DELAY_MS = 30_000L;
    private static final long MAX_CHECK_DELAY_MS = 10 * 60_000L;

    /* Lets FlowReadNudgePlugin re-apply the package filter the moment the user
       changes their selection, instead of waiting for the next service restart. */
    private static FlowReadNudgeService instance = null;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable pendingCheck = null;

    static boolean isRunning() {
        return instance != null;
    }

    static void refreshTargets() {
        FlowReadNudgeService s = instance;
        if (s != null) s.applyTargets();
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
        applyTargets();
    }

    @Override
    public void onDestroy() {
        if (instance == this) instance = null;
        cancelCheck();
        super.onDestroy();
    }

    @Override
    public void onInterrupt() { }

    /**
     * Restrict delivery to the user's chosen packages. An empty selection sets a
     * package name that cannot exist, rather than null — null would mean "every
     * app", which is the opposite of what we want.
     */
    private void applyTargets() {
        /* The pending check names a package that may no longer be selected. */
        cancelCheck();
        try {
            AccessibilityServiceInfo info = getServiceInfo();
            if (info == null) return;
            SharedPreferences p = NudgeGate.prefs(this);
            JSONArray arr = new JSONArray(p.getString(NudgeGate.KEY_APPS, "[]"));
            String[] packages;
            if (arr.length() == 0) {
                packages = new String[] { "com.flowread.app.__none__" };
            } else {
                packages = new String[arr.length()];
                for (int i = 0; i < arr.length(); i++) packages[i] = arr.optString(i);
            }
            info.packageNames = packages;
            info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED;
            setServiceInfo(info);
        } catch (Exception e) {
            Log.w(TAG, "could not apply target filter", e);
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) return;
        if (event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return;

        CharSequence pkgSeq = event.getPackageName();
        if (pkgSeq == null) return;
        String pkg = pkgSeq.toString();

        /* Our own windows must never trigger anything. */
        if (getPackageName().equals(pkg)) return;

        NudgeGate.Decision decision = NudgeGate.decide(this, pkg);
        if (decision.nudge) {
            launchNudge(pkg, FlowReadNudgePlugin.labelForPackage(this, pkg), decision);
        }
        /* Either way the user is in there now, so keep one check pending for the
           threshold they may cross without touching anything. */
        scheduleCheck(pkg);
    }

    /* ── The pending in-session check ────────────────────────────────── */

    private void cancelCheck() {
        if (pendingCheck != null) {
            handler.removeCallbacks(pendingCheck);
            pendingCheck = null;
        }
    }

    /**
     * Keep exactly one check pending, aimed at the moment the threshold could
     * next be met. NudgeGate decides whether a check is worth scheduling at all
     * — it is not, for instance, when usage access is missing, when the daily cap
     * is spent, or when only "every open" is switched on.
     */
    private void scheduleCheck(final String pkg) {
        cancelCheck();
        long delay = NudgeGate.nextCheckDelayMs(this, pkg);
        if (delay < 0) return;
        delay = Math.max(MIN_CHECK_DELAY_MS, Math.min(MAX_CHECK_DELAY_MS, delay));
        pendingCheck = new Runnable() {
            @Override
            public void run() {
                pendingCheck = null;
                /* The service is told only about the user's own picks, so it never
                   hears that they left. Confirm it before interrupting anyone —
                   and before spending a nudge from the daily cap. */
                if (!NudgeGate.isForeground(FlowReadNudgeService.this, pkg)) {
                    Log.d(TAG, "timed check dropped: " + pkg + " is not in front");
                    return;
                }
                NudgeGate.Decision d = NudgeGate.decide(FlowReadNudgeService.this, pkg, true);
                if (d.nudge) {
                    launchNudge(pkg,
                            FlowReadNudgePlugin.labelForPackage(FlowReadNudgeService.this, pkg), d);
                }
                /* Still in there: keep one check pending. The chain ends on its
                   own the moment the app is no longer in front, so nothing has to
                   tell us the session is over. */
                scheduleCheck(pkg);
            }
        };
        handler.postDelayed(pendingCheck, delay);
        Log.d(TAG, "next check for " + pkg + " in " + (delay / 1000) + "s");
    }

    private void launchNudge(String pkg, String label, NudgeGate.Decision decision) {
        try {
            /* Handed to JS, which reads it on cold start (no live WebView to
               receive an event), on the hot nudge event, and on every resume.
               Mirrors the fr_pending_pdf_open handoff.

               JSONObject, not string concatenation: a label containing a quote,
               a backslash or a newline would otherwise produce invalid JSON and
               the whole handoff would vanish into a JSON.parse catch. The key is
               "packageName" to match the vocabulary the plugin uses everywhere
               else — a mismatch here is invisible and stops the nudge dead. */
            JSONObject payload = new JSONObject();
            payload.put("packageName", pkg);
            payload.put("label", label);
            payload.put("minutes", decision.minutes);
            payload.put("opens", decision.opens);
            payload.put("everyOpen", decision.everyOpen);
            payload.put("inSession", decision.inSession);
            payload.put("at", System.currentTimeMillis());
            NudgeGate.prefs(this).edit()
                    .putString("fr_pending_nudge", payload.toString())
                    .apply();

            Intent intent = new Intent(this, MainActivity.class);
            intent.setAction(MainActivity.ACTION_NUDGE);
            intent.putExtra(MainActivity.EXTRA_NUDGE_PACKAGE, pkg);
            intent.putExtra(MainActivity.EXTRA_NUDGE_LABEL, label);
            /* SYSTEM_ALERT_WINDOW is what makes this background activity start
               legal from Android 10 onward — without that grant it is dropped. */
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP
                    | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            startActivity(intent);
        } catch (Exception e) {
            Log.w(TAG, "could not show nudge", e);
        }
    }
}
