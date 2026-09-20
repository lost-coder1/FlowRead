package com.flowread.app;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;

import org.json.JSONArray;

/**
 * Notices when one of the user's chosen apps comes to the front.
 *
 * Configured in res/xml/nudge_accessibility_service.xml with
 * canRetrieveWindowContent="false" and typeWindowStateChanged only, so the only
 * thing it can learn is a package name. The event filter is narrowed further at
 * runtime to exactly the user's chosen packages (applyTargets), which means the
 * system delivers nothing at all about any other app.
 *
 * Claude.md 9.4, Q8 signed off 2026-09-20.
 */
public class FlowReadNudgeService extends AccessibilityService {

    private static final String TAG = "FlowReadNudge";

    /* Lets FlowReadNudgePlugin re-apply the package filter the moment the user
       changes their selection, instead of waiting for the next service restart. */
    private static FlowReadNudgeService instance = null;

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

        if (!NudgeGate.shouldNudge(this, pkg)) return;

        String label = FlowReadNudgePlugin.labelForPackage(this, pkg);
        launchNudge(pkg, label);
    }

    private void launchNudge(String pkg, String label) {
        try {
            /* Handed to JS on cold start, where there is no live WebView to
               receive an event. Mirrors the fr_pending_pdf_open handoff. */
            NudgeGate.prefs(this).edit()
                    .putString("fr_pending_nudge",
                            "{\"package\":\"" + pkg.replace("\"", "")
                                    + "\",\"label\":\"" + label.replace("\"", "")
                                    + "\",\"at\":" + System.currentTimeMillis() + "}")
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
