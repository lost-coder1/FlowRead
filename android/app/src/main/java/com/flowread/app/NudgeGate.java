package com.flowread.app;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Process;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;

/**
 * Decides whether being in a target app should produce a nudge.
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
     * The breather after a nudge the time threshold raised.
     *
     * Longer than the grace above because the condition does not go away: once
     * the user is past their minutes for the day they stay past them until they
     * read, so every subsequent tap inside the app would qualify. At one minute
     * a user who ignores the first nudge spends their whole daily cap inside a
     * couple of minutes of scrolling.
     */
    private static final long THRESHOLD_GRACE_MS = 5 * 60_000L;

    /**
     * How far back to look when confirming an app is still in the foreground.
     *
     * Has to cover an entire sitting: the whole point of the timed check is the
     * user who opens one feed and scrolls it for half an hour without producing
     * a single event, and the resume that put them there is the event we are
     * looking for.
     */
    private static final long FOREGROUND_LOOKBACK_MS = 6 * 60 * 60_000L;

    /**
     * The answer to "should this moment produce a nudge", plus the figures that
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
        /* True when the user is already inside the app rather than arriving at
           it. Same distinction, present tense: "still on Reddit, 20 minutes in"
           is a different sentence from "you were on Reddit for 20 minutes". */
        final boolean inSession;

        private Decision(boolean nudge, long minutes, int opens,
                         boolean everyOpen, boolean inSession) {
            this.nudge = nudge;
            this.minutes = minutes;
            this.opens = opens;
            this.everyOpen = everyOpen;
            this.inSession = inSession;
        }

        static final Decision NO = new Decision(false, -1, 0, false, false);
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
            state = rollOver(state);
        }
        if (!state.has("apps")) {
            try { state.put("apps", new JSONObject()); } catch (Exception ignored) {}
        }
        return state;
    }

    /**
     * Start a new day, carrying across only what is not about "today".
     *
     * The counters are the day — they go. suppressUntil is an absolute
     * timestamp, and dropping it meant a 60-minute unlock granted at 23:50 was
     * silently void at midnight, so the user got nudged at 00:01 by the app they
     * had just read for. lastSeen travels for the same reason: a session in
     * progress at midnight is still the same session at 00:01.
     *
     * A live sitting travels too, unchanged — someone scrolling through midnight
     * is still in the same sitting, and it is timed by the wall clock, which
     * does not care that the date changed.
     */
    private static JSONObject rollOver(JSONObject old) {
        JSONObject fresh = new JSONObject();
        long now = System.currentTimeMillis();
        try {
            fresh.put("day", today());
            JSONObject apps = new JSONObject();
            JSONObject oldApps = old.optJSONObject("apps");
            if (oldApps != null) {
                Iterator<String> keys = oldApps.keys();
                while (keys.hasNext()) {
                    String pkg = keys.next();
                    JSONObject was = oldApps.optJSONObject(pkg);
                    if (was == null) continue;
                    JSONObject kept = new JSONObject();
                    long suppressUntil = was.optLong("suppressUntil", 0L);
                    if (suppressUntil > now) kept.put("suppressUntil", suppressUntil);
                    long lastSeen = was.optLong("lastSeen", 0L);
                    if (now - lastSeen <= SESSION_GAP_MS) {
                        kept.put("lastSeen", lastSeen);
                        long sessionStart = was.optLong("sessionStart", 0L);
                        if (sessionStart > 0L) kept.put("sessionStart", sessionStart);
                    }
                    if (kept.length() > 0) apps.put(pkg, kept);
                }
            }
            fresh.put("apps", apps);
        } catch (Exception ignored) {}
        return fresh;
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

    /* ── Usage access ────────────────────────────────────────────────── */

    /**
     * Whether the optional usage-access grant is in place (Claude.md 9.4a).
     *
     * Lives here rather than in the plugin because the gate and the service both
     * need it: without it the minutes trigger cannot work at all, and telling
     * "permission denied" apart from "no time recorded yet" is the difference
     * between falling back honestly and falling back for no reason.
     *
     * checkOpNoThrow is deprecated from API 29 but is the only option below it.
     */
    @SuppressWarnings("deprecation")
    static boolean hasUsageAccess(Context ctx) {
        try {
            AppOpsManager ops = (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
            if (ops == null) return false;
            int mode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                mode = ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,
                        Process.myUid(), ctx.getPackageName());
            } else {
                mode = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,
                        Process.myUid(), ctx.getPackageName());
            }
            if (mode == AppOpsManager.MODE_DEFAULT) {
                return ctx.checkCallingOrSelfPermission(
                        android.Manifest.permission.PACKAGE_USAGE_STATS)
                        == PackageManager.PERMISSION_GRANTED;
            }
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Raw minutes spent in a package today, or -1 when usage access has not been
     * granted. Queried on demand rather than polled, so it costs no battery.
     *
     * -1 means exactly one thing: no permission. An empty result with the
     * permission in place means the device genuinely has nothing recorded for
     * that app, which is 0 — conflating the two made an idle phone look like a
     * denied grant and silently demoted the trigger to counting opens.
     */
    static long foregroundMinutesToday(Context ctx, String pkg) {
        if (pkg == null) return -1;
        if (!hasUsageAccess(ctx)) return -1;
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
            if (stats == null || stats.isEmpty()) return 0;
            UsageStats s = stats.get(pkg);
            if (s == null) return 0;
            return s.getTotalTimeInForeground() / 60000L;
        } catch (Exception e) {
            return -1;
        }
    }

    /**
     * Minutes in the CURRENT sitting — not the day's total.
     *
     * The threshold used to count cumulative time since midnight, which is what
     * 9.3 originally specified. In the field that read as a bug and at small
     * thresholds it was one: past five minutes anywhere in the day you are
     * permanently over, so "After a while in the app" quietly became "every time
     * I open it" — the mode the user had deliberately not chosen. It also made
     * the figure unresettable by anything the user could do, since the number
     * belongs to Android, which is how "you have been on Reddit for 120 minutes"
     * greeted someone who had just pressed Reset.
     *
     * A sitting is what the label promises and what a person means. It is also
     * the only version reading can pay back.
     *
     * Timed by the WALL CLOCK, deliberately, and never by a usage-stats delta.
     *
     * UsageStatsManager.getTotalTimeInForeground() does not tick while you are
     * in the app. The figure comes from the daily interval buckets, and the
     * current session is only added to them once it ends — so for the entire
     * time a user sits in X it reads flat, and then jumps the moment they leave.
     * Measuring a *live* sitting against it means measuring it against a number
     * that is, by construction, standing still: the timed check computes "0
     * minutes in, 5 to go" forever, nothing ever fires, and the nudge lands on
     * the next open instead — which is precisely the bug (N22) this was all
     * supposed to fix. Usage stats are accurate for sessions that are over and
     * useless for the one in progress.
     *
     * The wall clock over-counts a brief switch away that stays inside the
     * session gap. That is a far smaller error than never firing, and
     * isForeground() still has to agree before anything interrupts the user.
     *
     * Always a real number: 0, never a sentinel.
     */
    private static long sessionMinutes(JSONObject app) {
        long sessionStart = app.optLong("sessionStart", 0L);
        if (sessionStart <= 0L) return 0L;
        return Math.max(0L, (System.currentTimeMillis() - sessionStart) / 60000L);
    }

    /** Start the sitting over: on a new open, after a read, and on Reset. */
    private static void anchorSession(JSONObject app) throws Exception {
        app.put("sessionStart", System.currentTimeMillis());
    }

    /**
     * Whether a package is the one the user is looking at right now.
     *
     * The accessibility service is told only about the user's own picks, so it
     * never learns that they left — it would happily raise a nudge about an app
     * closed ten minutes ago. The last resume in the usage-event log settles it.
     *
     * This reads the name of whichever app resumed most recently, which may be
     * an app the user never selected. It is compared and discarded: nothing is
     * stored, logged or sent, and the accessibility service's own package filter
     * is untouched. Logged against Claude.md 9.4a as a deliberate, scoped use of
     * a permission the user granted separately and explicitly.
     */
    @SuppressWarnings("deprecation")
    static boolean isForeground(Context ctx, String pkg) {
        if (pkg == null || !hasUsageAccess(ctx)) return false;
        try {
            UsageStatsManager usm =
                    (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
            if (usm == null) return false;
            long now = System.currentTimeMillis();
            UsageEvents events = usm.queryEvents(now - FOREGROUND_LOOKBACK_MS, now);
            if (events == null) return false;
            final int resumed = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    ? UsageEvents.Event.ACTIVITY_RESUMED
                    : UsageEvents.Event.MOVE_TO_FOREGROUND;
            String last = null;
            UsageEvents.Event e = new UsageEvents.Event();
            while (events.hasNextEvent()) {
                events.getNextEvent(e);
                if (e.getEventType() == resumed) last = e.getPackageName();
            }
            /* "Could not tell" and "they left" both have to answer no, but they
               are different failures and only one of them is normal. An empty
               event stream means the query is not working on this device, and a
               silent no would look identical to a working feature nobody is
               tripping (Claude.md 1.5). One line, at the only moment it matters. */
            if (last == null) {
                Log.d(TAG, "foreground check inconclusive: no resume events in the window");
                return false;
            }
            return pkg.equals(last);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * How long until this app could next produce a nudge from inside a session,
     * or -1 when no timed check is worth scheduling at all.
     *
     * Only the minutes threshold can be crossed while the user sits still —
     * "every open" needs an open and the opens fallback needs a new session — so
     * everything else returns -1 rather than waking up for nothing.
     */
    static long nextCheckDelayMs(Context ctx, String pkg) {
        SharedPreferences p = prefs(ctx);
        if (!isEnabled(p) || !isTarget(p, pkg)) return -1;
        String modes = p.getString(KEY_TRIGGER_MODE, MODE_THRESHOLD);
        if (!modes.contains(MODE_THRESHOLD)) return -1;
        /* The check has to prove the user is still in the app before it fires,
           and isForeground is the only thing that can prove it. Without usage
           access there is no proof, and a timer that nudges anyway is the ambush
           N19 was about. The threshold still works on navigation events, which
           are proof of presence in themselves. */
        if (!hasUsageAccess(ctx)) return -1;
        JSONObject app = appState(loadState(p), pkg);
        if (app.optInt("nudges", 0) >= intPref(p, KEY_DAILY_CAP, DEFAULT_DAILY_CAP)) return -1;
        if (!modes.contains(MODE_EVERY_OPEN) && app.optInt("dismissals", 0)
                >= intPref(p, KEY_BACKOFF_DISMISSALS, DEFAULT_BACKOFF_DISMISSALS)) return -1;
        long untilThreshold = Math.max(0L, intPref(p, KEY_MIN_MINUTES, DEFAULT_MIN_MINUTES)
                - sessionMinutes(app)) * 60_000L;
        long untilFree = Math.max(0L, app.optLong("suppressUntil", 0L) - System.currentTimeMillis());
        return Math.max(untilThreshold, untilFree);
    }

    static Decision decide(Context ctx, String pkg) {
        return decide(ctx, pkg, false);
    }

    /**
     * Called for every window-state change on a target app, and from the timed
     * check for the user who is sitting still. Says whether this moment should
     * produce a nudge, along with the figures the decision was made on.
     *
     * fromTimer events are not user actions: they must not touch lastSeen and
     * must not count as an open, or a long sitting would inflate the open count
     * it is standing in for.
     */
    static Decision decide(Context ctx, String pkg, boolean fromTimer) {
        SharedPreferences p = prefs(ctx);
        if (!isEnabled(p)) return no("nudge is switched off", pkg);
        if (!isTarget(p, pkg)) return no("not a selected app", pkg);

        long now = System.currentTimeMillis();
        JSONObject state = loadState(p);
        JSONObject app = appState(state, pkg);

        try {
            /* Count the open. "Open" means a new session, not a new window. */
            boolean newOpen = false;
            if (!fromTimer) {
                long lastSeen = app.optLong("lastSeen", 0L);
                newOpen = now - lastSeen > SESSION_GAP_MS;
                app.put("lastSeen", now);
                if (newOpen) {
                    app.put("opens", app.optInt("opens", 0) + 1);
                    anchorSession(app);
                }
                saveState(p, state);
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
            long minutes = sessionMinutes(app);
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

            /* "Every open" means what it says: it fires when a session starts and
               never from inside one. */
            boolean overEveryOpen = everyOpen && newOpen;
            /* The minutes threshold is now purely about the sitting, so it can
               only ever fire from inside one — at the moment of opening, the
               sitting is zero minutes old. That makes the two toggles cleanly
               orthogonal: one is about the open, the other about the stretch,
               and neither has anything to say about the other's moment. */
            boolean overMinutes = threshold && !newOpen
                    && minutes >= intPref(p, KEY_MIN_MINUTES, DEFAULT_MIN_MINUTES);
            /* Kept as the open-time half of the same toggle when usage access is
               denied: the wall clock can time a sitting the user is navigating
               around in, but nothing can confirm they are still there when they
               are not, so an ungranted setup still needs something that fires on
               an open. An open count only moves when a session starts. */
            boolean overOpens = threshold && newOpen && !hasUsageAccess(ctx)
                    && opens >= intPref(p, KEY_MIN_OPENS, DEFAULT_MIN_OPENS);
            if (!overEveryOpen && !overMinutes && !overOpens) {
                return no("no trigger met (modes=" + modes + ", fromTimer=" + fromTimer
                        + ", newOpen=" + newOpen
                        + ", minutes=" + minutes + ", opens=" + opens + ")", pkg);
            }

            app.put("nudges", app.optInt("nudges", 0) + 1);
            app.put("lastNudgeAt", now);
            /* The target app keeps emitting window changes while our nudge sits
               on top of it. Without this, one open would burn the whole daily
               cap in a second and the user would be re-nudged mid-decision. */
            /* "Every time I open it" is checked FIRST and wins. The long
               threshold breather is right for a stretch the user is still inside,
               and wrong for an open: with both toggles on it swallowed the next
               open for five minutes, which is the one thing that mode promises
               not to do, and which Settings explicitly tells the user it does. */
            long grace;
            if (overEveryOpen) {
                grace = NUDGE_SHOWN_GRACE_EVERY_OPEN_MS;
            } else if (overMinutes) {
                grace = THRESHOLD_GRACE_MS;
            } else {
                grace = NUDGE_SHOWN_GRACE_MS;
            }
            app.put("suppressUntil", now + grace);
            saveState(p, state);
            Log.d(TAG, "nudging for " + pkg + " (modes=" + modes + ", fromTimer=" + fromTimer
                    + ", inSession=" + !newOpen
                    + ", minutes=" + minutes + ", opens=" + opens + ")");
            return new Decision(true, minutes, opens, everyOpen, !newOpen);
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
            /* Both figures, because the trigger runs on the first and the user's
               own sense of the day runs on the second. Showing only "6 min" to
               someone whose phone says two hours reads as a bug unless the card
               says which is which (Claude.md 1.5). */
            out.put("minutes", sessionMinutes(app));
            out.put("rawMinutes", foregroundMinutesToday(ctx, pkg));
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

    /**
     * Reading pays the clock back: the sitting starts over from zero.
     *
     * The opens fallback is zeroed for the same reason, and the dismissal streak
     * goes because the user engaged.
     *
     * One nudge is refunded against the daily cap (product decision 2026-10-06).
     * Resetting the clock is pointless if the gate has no nudges left to spend
     * on it — the user would read, earn their fresh minutes, and then never be
     * interrupted again however long they stayed. The cap still holds between
     * reads, so the only way past it is to have read.
     */
    static JSONObject creditRead(Context ctx, String pkg) {
        JSONObject out = new JSONObject();
        if (pkg == null) return out;
        SharedPreferences p = prefs(ctx);
        JSONObject state = loadState(p);
        JSONObject app = appState(state, pkg);
        try {
            long credited = sessionMinutes(app);
            anchorSession(app);
            app.put("opens", 0);
            app.put("dismissals", 0);
            app.put("nudges", Math.max(0, app.optInt("nudges", 0) - 1));
            saveState(p, state);
            out.put("creditedMinutes", credited);
            out.put("freshMinutes", intPref(p, KEY_MIN_MINUTES, DEFAULT_MIN_MINUTES));
            Log.d(TAG, "clock credited for " + pkg + " (was " + credited + " min)");
        } catch (Exception ignored) {}
        return out;
    }

    /**
     * Clears one app's counters for today — the escape from a back-off.
     *
     * Dropping the whole entry also drops sessionStart, so the clock really does
     * read zero afterwards and the next event starts a fresh sitting. That was
     * not true while the threshold counted the day: Reset said "Today's counters
     * cleared" and then the gate immediately announced two hours, because the
     * two hours were Android's and nothing here could clear them.
     */
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
