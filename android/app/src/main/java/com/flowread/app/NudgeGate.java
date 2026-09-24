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
    static final String KEY_TRIGGER_MODE = "fr_nudge_trigger_mode";

    /* Nudge once the user is past a threshold, or on every open of the app. */
    static final String MODE_THRESHOLD = "threshold";
    static final String MODE_EVERY_OPEN = "every_open";

    /* Rolling per-day counters, written by both sides. */
    static final String KEY_STATE = "fr_nudge_state";

    static final int DEFAULT_MIN_MINUTES = 15;
    static final int DEFAULT_MIN_OPENS = 3;
    static final int DEFAULT_DAILY_CAP = 3;
    static final int DEFAULT_BACKOFF_DISMISSALS = 3;

    /**
     * What separates "opened the app" from "moved around inside it".
     *
     * TYPE_WINDOW_STATE_CHANGED cannot tell those apart on its own: opening a
     * post, an image or a video inside Reddit fires exactly the same event as
     * launching Reddit did. The signal that would distinguish them is the
     * previously-foregrounded package, and we deliberately cannot see it —
     * packageNames is narrowed to the user's own picks (Claude.md 9.4a), which
     * is both the privacy guarantee and the Play Console justification. Widening
     * it to watch every app would buy accuracy at exactly the cost that scope
     * was chosen to avoid.
     *
     * So a session is approximated by quiet: the first window change after the
     * app has been silent for this long counts as an open, and everything inside
     * that window is navigation. lastSeen is refreshed on every event, so
     * continuous use keeps extending the same session.
     *
     * Known limitation: sitting on one screen longer than this and then tapping
     * through reads as a new open. Three minutes is long enough that ordinary
     * browsing does not trip it and short enough that genuinely leaving and
     * coming back does.
     */
    private static final long SESSION_GAP_MS = 3 * 60_000L;

    /**
     * How long a raised nudge stays on screen before the app could legitimately
     * nudge again. Overwritten by the real suppression as soon as the user
     * picks an outcome, so this only covers the undecided window.
     *
     * Much shorter in "every open" mode: a minute there means the very next
     * open — the thing the user explicitly asked to be nudged on — is swallowed.
     */
    private static final long NUDGE_SHOWN_GRACE_MS = 60_000L;
    private static final long NUDGE_SHOWN_GRACE_EVERY_OPEN_MS = 10_000L;

    /**
     * The answer to "should this open produce a nudge", plus the figures that
     * produced it. The screen names the real number (Claude.md 1.5), and these
     * are the values the decision was actually made on — re-querying from JS
     * would return a slightly different one for no benefit.
     */
    static final class Decision {
        final boolean nudge;
        final long minutes;   /* -1 when usage access has not been granted */
        final int opens;
        /* Which trigger fired. The screen asks a different question for each:
           "before you open this" reads wrong when what actually happened is
           that the user has been in there for an hour, and vice versa. */
        final boolean everyOpen;

        private Decision(boolean nudge, long minutes, int opens, boolean everyOpen) {
            this.nudge = nudge;
            this.minutes = minutes;
            this.opens = opens;
            this.everyOpen = everyOpen;
        }

        static final Decision NO = new Decision(false, -1, 0, false);
    }

    private static final String TAG = "FlowReadNudge";

    /**
     * Every "no" is silent from outside the phone, which made "I opened the app
     * and nothing happened" impossible to tell apart from a broken trigger.
     * One line per decision, at debug level:  adb logcat -s FlowReadNudge
     */
    private static Decision no(String reason, String pkg) {
        Log.d(TAG, "no nudge for " + pkg + ": " + reason);
        return Decision.NO;
    }

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
     * says whether this one should produce a nudge, along with the figures the
     * decision was made on.
     */
    static Decision decide(Context ctx, String pkg) {
        SharedPreferences p = prefs(ctx);
        if (!isEnabled(p)) return no("nudge is switched off", pkg);
        if (!isTarget(p, pkg)) return no("not a selected app", pkg);

        long now = System.currentTimeMillis();
        JSONObject state = loadState(p);
        JSONObject app = appState(state, pkg);

        try {
            /* Count the open. "Open" means a new session, not a new window. */
            long lastSeen = app.optLong("lastSeen", 0L);
            boolean newOpen = now - lastSeen > SESSION_GAP_MS;
            app.put("lastSeen", now);
            if (newOpen) app.put("opens", app.optInt("opens", 0) + 1);
            saveState(p, state);
            if (!newOpen) {
                return no("still the same session (" + ((now - lastSeen) / 1000) + "s in)", pkg);
            }

            /* Suppressed: the user either just unlocked this app by reading, or
               just chose to continue anyway. Either way, leave them alone. */
            long suppressUntil = app.optLong("suppressUntil", 0L);
            if (now < suppressUntil) {
                return no("suppressed for another " + ((suppressUntil - now) / 1000) + "s", pkg);
            }

            /* Claude.md 9.3: a daily cap, and back off entirely after repeated
               dismissals — a user saying no three times has answered. These hold
               in every trigger mode; without them "on every open" would be the
               wall 9.1 forbids rather than a nudge. */
            if (app.optInt("nudges", 0) >= intPref(p, KEY_DAILY_CAP, DEFAULT_DAILY_CAP)) {
                return no("daily cap reached (" + app.optInt("nudges", 0) + ")", pkg);
            }
            /* Preferred trigger is real time-in-app; open count is the fallback
               when the user has not granted usage access (Claude.md 1.5 — the
               feature degrades honestly rather than silently doing nothing).
               The minutes figure is read either way, because the screen names it. */
            long minutes = foregroundMinutesToday(ctx, pkg);
            int opens = app.optInt("opens", 0);
            String modes = p.getString(KEY_TRIGGER_MODE, MODE_THRESHOLD);
            boolean everyOpen = modes.contains(MODE_EVERY_OPEN);
            boolean threshold = modes.contains(MODE_THRESHOLD);

            /* The dismissal back-off reads a repeated "no" as an answer (9.3).
               That inference does not hold in "every open" mode: the user has
               already declared, in Settings, that they want the prompt on every
               open — skipping one is not a retraction of that. The daily cap and
               the always-visible escape hatch remain, so this is still a nudge
               and not the wall 9.1 forbids. Deviation from 9.3, logged. */
            if (!everyOpen && app.optInt("dismissals", 0)
                    >= intPref(p, KEY_BACKOFF_DISMISSALS, DEFAULT_BACKOFF_DISMISSALS)) {
                return no("backed off after " + app.optInt("dismissals", 0) + " dismissals", pkg);
            }
            /* Whichever triggers are on, any one of them firing is enough. */
            boolean over = everyOpen || (threshold && ((minutes >= 0)
                    ? minutes >= intPref(p, KEY_MIN_MINUTES, DEFAULT_MIN_MINUTES)
                    : opens >= intPref(p, KEY_MIN_OPENS, DEFAULT_MIN_OPENS)));
            if (!over) {
                return no("no trigger met (modes=" + modes
                        + ", minutes=" + minutes + ", opens=" + opens + ")", pkg);
            }

            app.put("nudges", app.optInt("nudges", 0) + 1);
            app.put("lastNudgeAt", now);
            /* The target app keeps emitting window changes while our nudge sits
               on top of it. Without this, one open would burn the whole daily
               cap in a second and the user would be re-nudged mid-decision. */
            app.put("suppressUntil", now
                    + (everyOpen ? NUDGE_SHOWN_GRACE_EVERY_OPEN_MS : NUDGE_SHOWN_GRACE_MS));
            saveState(p, state);
            Log.d(TAG, "nudging for " + pkg + " (modes=" + modes
                    + ", minutes=" + minutes + ", opens=" + opens + ")");
            return new Decision(true, minutes, opens, everyOpen);
        } catch (Exception e) {
            Log.w(TAG, "gate failed", e);
            return Decision.NO;
        }
    }

    /**
     * What the gate currently thinks about one app. Settings renders this: every
     * "no" above is otherwise invisible, and a user who has been skipping nudges
     * has no way to know the back-off has quietly silenced the app for the day
     * (Claude.md 1.5 — never silently do nothing).
     */
    static JSONObject statusFor(Context ctx, String pkg) {
        SharedPreferences p = prefs(ctx);
        JSONObject app = appState(loadState(p), pkg);
        JSONObject out = new JSONObject();
        try {
            long suppressUntil = app.optLong("suppressUntil", 0L);
            out.put("nudges", app.optInt("nudges", 0));
            out.put("dismissals", app.optInt("dismissals", 0));
            out.put("opens", app.optInt("opens", 0));
            out.put("minutes", foregroundMinutesToday(ctx, pkg));
            out.put("dailyCap", intPref(p, KEY_DAILY_CAP, DEFAULT_DAILY_CAP));
            out.put("backoffAt", intPref(p, KEY_BACKOFF_DISMISSALS, DEFAULT_BACKOFF_DISMISSALS));
            out.put("minMinutes", intPref(p, KEY_MIN_MINUTES, DEFAULT_MIN_MINUTES));
            out.put("minOpens", intPref(p, KEY_MIN_OPENS, DEFAULT_MIN_OPENS));
            out.put("suppressedSeconds",
                    Math.max(0L, (suppressUntil - System.currentTimeMillis()) / 1000L));
            String modes = p.getString(KEY_TRIGGER_MODE, MODE_THRESHOLD);
            out.put("modes", modes);
            /* Settings needs this to know whether the back-off line applies. */
            out.put("everyOpen", modes.contains(MODE_EVERY_OPEN));
        } catch (Exception ignored) {}
        return out;
    }

    /** Clears one app's counters for today — the escape from a back-off. */
    static void resetApp(Context ctx, String pkg) {
        if (pkg == null) return;
        SharedPreferences p = prefs(ctx);
        JSONObject state = loadState(p);
        JSONObject apps = state.optJSONObject("apps");
        if (apps != null) apps.remove(pkg);
        saveState(p, state);
        Log.d(TAG, "counters reset for " + pkg);
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
