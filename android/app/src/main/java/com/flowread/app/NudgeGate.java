package com.flowread.app;

import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;
import java.util.Map;

/**
 * Decides whether opening a target app should produce a nudge.
 *
 * Plain Java on purpose: FlowReadNudgeService runs whether or not the WebView is
 * alive, so the rules cannot live in JS. State is kept in the same
 * "CapacitorStorage" SharedPreferences the JS side reads through Capacitor
 * Preferences, so both halves share one source of truth rather than drifting.
 *
 * Claude.md 9.3 (dynamic triggering), 9.7 (scoped unlock).
 */
final class NudgeGate {

    static final String PREFS = "CapacitorStorage";

    /* Settings, written by JS. Defaults here must match nudge.js. */
    static final String KEY_ENABLED = "fr_nudge_enabled";
    static final String KEY_APPS = "fr_nudge_apps";
    static final String KEY_MIN_MINUTES = "fr_nudge_min_minutes";
    static final String KEY_MIN_OPENS = "fr_nudge_min_opens";
    static final String KEY_DAILY_CAP = "fr_nudge_daily_cap";
    static final String KEY_BACKOFF_DISMISSALS = "fr_nudge_backoff_dismissals";

    /* Rolling per-day counters, written by both sides. */
    static final String KEY_STATE = "fr_nudge_state";

    static final int DEFAULT_MIN_MINUTES = 15;
    static final int DEFAULT_MIN_OPENS = 3;
    static final int DEFAULT_DAILY_CAP = 3;
    static final int DEFAULT_BACKOFF_DISMISSALS = 3;

    /**
     * Two window-state changes for the same app land within milliseconds of each
     * other on most launchers, so without this every open would count several times.
     */
    private static final long OPEN_DEBOUNCE_MS = 2000L;

    /**
     * How long a raised nudge stays on screen before the app could legitimately
     * nudge again. Overwritten by the real suppression as soon as the user
     * picks an outcome, so this only covers the undecided window.
     */
    private static final long NUDGE_SHOWN_GRACE_MS = 60_000L;

    private NudgeGate() {}

    static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new java.util.Date());
    }

    private static int intPref(SharedPreferences p, String key, int fallback) {
        try {
            String raw = p.getString(key, null);
            if (raw == null || raw.length() == 0) return fallback;
            int v = Integer.parseInt(raw.trim());
            return v > 0 ? v : fallback;
        } catch (Exception e) {
            return fallback;
        }
    }

    static boolean isEnabled(SharedPreferences p) {
        /* Absent means on: the user only reaches this after opting in via setup. */
        return !"false".equals(p.getString(KEY_ENABLED, "true"));
    }

    static boolean isTarget(SharedPreferences p, String pkg) {
        if (pkg == null) return false;
        try {
            JSONArray arr = new JSONArray(p.getString(KEY_APPS, "[]"));
            for (int i = 0; i < arr.length(); i++) {
                if (pkg.equals(arr.optString(i))) return true;
            }
        } catch (Exception ignored) {}
        return false;
    }

    /** Whole state object, reset when the calendar day rolls over. */
    private static JSONObject loadState(SharedPreferences p) {
        JSONObject state;
        try {
            state = new JSONObject(p.getString(KEY_STATE, "{}"));
        } catch (Exception e) {
            state = new JSONObject();
        }
        if (!today().equals(state.optString("day", ""))) {
            state = new JSONObject();
            try {
                state.put("day", today());
                state.put("apps", new JSONObject());
            } catch (Exception ignored) {}
        }
        if (!state.has("apps")) {
            try { state.put("apps", new JSONObject()); } catch (Exception ignored) {}
        }
        return state;
    }

    private static void saveState(SharedPreferences p, JSONObject state) {
        p.edit().putString(KEY_STATE, state.toString()).apply();
    }

    private static JSONObject appState(JSONObject state, String pkg) {
        JSONObject apps = state.optJSONObject("apps");
        JSONObject app = apps != null ? apps.optJSONObject(pkg) : null;
        if (app == null) {
            app = new JSONObject();
            try {
                if (apps != null) apps.put(pkg, app);
            } catch (Exception ignored) {}
        }
        return app;
    }

    /**
     * Minutes spent in a package today, or -1 when usage access has not been
     * granted. Queried on demand rather than polled, so it costs no battery.
     */
    static long foregroundMinutesToday(Context ctx, String pkg) {
        try {
            UsageStatsManager usm =
                    (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
            if (usm == null) return -1;
            Calendar c = Calendar.getInstance();
            c.set(Calendar.HOUR_OF_DAY, 0);
            c.set(Calendar.MINUTE, 0);
            c.set(Calendar.SECOND, 0);
            c.set(Calendar.MILLISECOND, 0);
            long start = c.getTimeInMillis();
            long now = System.currentTimeMillis();
            Map<String, UsageStats> stats = usm.queryAndAggregateUsageStats(start, now);
            if (stats == null || stats.isEmpty()) return -1;
            UsageStats s = stats.get(pkg);
            if (s == null) return 0;
            return s.getTotalTimeInForeground() / 60000L;
        } catch (Exception e) {
            return -1;
        }
    }

    /**
     * Called for every window-state change on a target app. Records the open and
     * returns true when this one should produce a nudge.
     */
    static boolean shouldNudge(Context ctx, String pkg) {
        SharedPreferences p = prefs(ctx);
        if (!isEnabled(p) || !isTarget(p, pkg)) return false;

        long now = System.currentTimeMillis();
        JSONObject state = loadState(p);
        JSONObject app = appState(state, pkg);

        try {
            /* Count the open, debounced. */
            long lastSeen = app.optLong("lastSeen", 0L);
            boolean newOpen = now - lastSeen > OPEN_DEBOUNCE_MS;
            app.put("lastSeen", now);
            if (newOpen) app.put("opens", app.optInt("opens", 0) + 1);
            saveState(p, state);
            if (!newOpen) return false;

            /* Suppressed: the user either just unlocked this app by reading, or
               just chose to continue anyway. Either way, leave them alone. */
            if (now < app.optLong("suppressUntil", 0L)) return false;

            /* Claude.md 9.3: a daily cap, and back off entirely after repeated
               dismissals — a user saying no three times has answered. */
            if (app.optInt("nudges", 0) >= intPref(p, KEY_DAILY_CAP, DEFAULT_DAILY_CAP)) return false;
            if (app.optInt("dismissals", 0)
                    >= intPref(p, KEY_BACKOFF_DISMISSALS, DEFAULT_BACKOFF_DISMISSALS)) return false;

            /* Preferred trigger is real time-in-app; open count is the fallback
               when the user has not granted usage access (Claude.md 1.5 — the
               feature degrades honestly rather than silently doing nothing). */
            long minutes = foregroundMinutesToday(ctx, pkg);
            boolean over = (minutes >= 0)
                    ? minutes >= intPref(p, KEY_MIN_MINUTES, DEFAULT_MIN_MINUTES)
                    : app.optInt("opens", 0) >= intPref(p, KEY_MIN_OPENS, DEFAULT_MIN_OPENS);
            if (!over) return false;

            app.put("nudges", app.optInt("nudges", 0) + 1);
            app.put("lastNudgeAt", now);
            /* The target app keeps emitting window changes while our nudge sits
               on top of it. Without this, one open would burn the whole daily
               cap in a second and the user would be re-nudged mid-decision. */
            app.put("suppressUntil", now + NUDGE_SHOWN_GRACE_MS);
            saveState(p, state);
            return true;
        } catch (Exception e) {
            Log.w("FlowReadNudge", "gate failed", e);
            return false;
        }
    }

    /** Stop nudging this one app for a while. Other targets are untouched (9.7). */
    static void suppress(Context ctx, String pkg, long millis, boolean countDismissal) {
        if (pkg == null) return;
        SharedPreferences p = prefs(ctx);
        JSONObject state = loadState(p);
        JSONObject app = appState(state, pkg);
        try {
            app.put("suppressUntil", System.currentTimeMillis() + millis);
            if (countDismissal) {
                app.put("dismissals", app.optInt("dismissals", 0) + 1);
            } else {
                /* Reading resets the streak — they engaged, so the next nudge
                   should start from a clean slate. */
                app.put("dismissals", 0);
            }
            saveState(p, state);
        } catch (Exception ignored) {}
    }
}
