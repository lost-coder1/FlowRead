package com.flowread.app;

import android.app.AppOpsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

/**
 * JS bridge for the reading-habit nudge (Claude.md section 9).
 *
 * Owns the three permission checks, the installed-app list the picker renders,
 * and the scoped unlock/dismissal writes. The detection itself lives in
 * FlowReadNudgeService, which runs independently of the WebView.
 */
@CapacitorPlugin(name = "FlowReadNudge")
public class FlowReadNudgePlugin extends Plugin {

    private static final int ICON_PX = 96;

    /* ── Installed apps ──────────────────────────────────────────────── */

    /**
     * Launchable apps only. This resolves through the <queries> element in the
     * manifest, deliberately NOT QUERY_ALL_PACKAGES — that is a Play-sensitive
     * permission needing a declaration form, and this app already carries one
     * policy rejection (Claude.md section 18).
     */
    @PluginMethod
    public void listLaunchableApps(PluginCall call) {
        try {
            Context ctx = getContext();
            PackageManager pm = ctx.getPackageManager();
            Intent launcher = new Intent(Intent.ACTION_MAIN, null);
            launcher.addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> resolved = queryLaunchers(pm, launcher);

            List<JSObject> out = new ArrayList<>();
            String self = ctx.getPackageName();
            for (ResolveInfo ri : resolved) {
                if (ri == null || ri.activityInfo == null) continue;
                String pkg = ri.activityInfo.packageName;
                if (pkg == null || pkg.equals(self)) continue;

                JSObject o = new JSObject();
                o.put("packageName", pkg);
                CharSequence label = ri.loadLabel(pm);
                o.put("label", label != null ? label.toString() : pkg);
                o.put("system", isSystemApp(ri.activityInfo.applicationInfo));
                o.put("icon", encodeIcon(ri.loadIcon(pm)));
                out.add(o);
            }

            /* De-duplicate packages exposing several launcher activities. */
            List<JSObject> unique = new ArrayList<>();
            List<String> seen = new ArrayList<>();
            for (JSObject o : out) {
                String pkg = o.getString("packageName");
                if (seen.contains(pkg)) continue;
                seen.add(pkg);
                unique.add(o);
            }

            Collections.sort(unique, new Comparator<JSObject>() {
                @Override
                public int compare(JSObject a, JSObject b) {
                    String la = a.getString("label", "");
                    String lb = b.getString("label", "");
                    return la.compareToIgnoreCase(lb);
                }
            });

            JSObject ret = new JSObject();
            ret.put("apps", new JSArray(unique));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not read the list of installed apps.", e);
        }
    }

    /* The int-flag overloads are deprecated from API 33; minSdk is 24, so both
       paths have to stay. */
    @SuppressWarnings("deprecation")
    private static List<ResolveInfo> queryLaunchers(PackageManager pm, Intent launcher) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return pm.queryIntentActivities(launcher,
                    PackageManager.ResolveInfoFlags.of(0));
        }
        return pm.queryIntentActivities(launcher, 0);
    }

    @SuppressWarnings("deprecation")
    private static ApplicationInfo applicationInfo(PackageManager pm, String pkg)
            throws PackageManager.NameNotFoundException {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return pm.getApplicationInfo(pkg, PackageManager.ApplicationInfoFlags.of(0));
        }
        return pm.getApplicationInfo(pkg, 0);
    }

    private boolean isSystemApp(ApplicationInfo info) {
        if (info == null) return false;
        return (info.flags & ApplicationInfo.FLAG_SYSTEM) != 0
                && (info.flags & ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) == 0;
    }

    /** Small PNG data URI. Returns "" rather than failing the whole list. */
    private String encodeIcon(Drawable icon) {
        try {
            if (icon == null) return "";
            Bitmap bmp;
            if (icon instanceof BitmapDrawable && ((BitmapDrawable) icon).getBitmap() != null) {
                bmp = Bitmap.createScaledBitmap(
                        ((BitmapDrawable) icon).getBitmap(), ICON_PX, ICON_PX, true);
            } else {
                bmp = Bitmap.createBitmap(ICON_PX, ICON_PX, Bitmap.Config.ARGB_8888);
                Canvas canvas = new Canvas(bmp);
                icon.setBounds(0, 0, ICON_PX, ICON_PX);
                icon.draw(canvas);
            }
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.PNG, 100, baos);
            return "data:image/png;base64,"
                    + Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) {
            return "";
        }
    }

    static String labelForPackage(Context ctx, String pkg) {
        try {
            PackageManager pm = ctx.getPackageManager();
            ApplicationInfo info = applicationInfo(pm, pkg);
            CharSequence label = pm.getApplicationLabel(info);
            if (label != null && label.length() > 0) return label.toString();
        } catch (Exception ignored) {}
        return pkg;
    }

    /* ── Target selection ────────────────────────────────────────────── */

    /**
     * Persists the chosen packages and re-narrows the accessibility filter
     * immediately, so the service never watches an app the user just removed.
     */
    @PluginMethod
    public void setTargetApps(PluginCall call) {
        try {
            JSArray packages = call.getArray("packages");
            JSONArray arr = packages != null ? new JSONArray(packages.toList()) : new JSONArray();
            NudgeGate.prefs(getContext()).edit()
                    .putString(NudgeGate.KEY_APPS, arr.toString()).apply();
            FlowReadNudgeService.refreshTargets();
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not save the selected apps.", e);
        }
    }

    /* ── Permissions ─────────────────────────────────────────────────── */

    @PluginMethod
    public void getPermissionState(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("accessibility", isAccessibilityEnabled());
        ret.put("overlay", hasOverlay());
        ret.put("usageAccess", hasUsageAccess());
        call.resolve(ret);
    }

    /**
     * Read from the system setting rather than the static instance: the service
     * may be enabled but not yet connected right after the user returns from
     * Settings, and the static would still be null.
     */
    private boolean isAccessibilityEnabled() {
        try {
            Context ctx = getContext();
            String expected = ctx.getPackageName() + "/" + FlowReadNudgeService.class.getName();
            String enabled = Settings.Secure.getString(ctx.getContentResolver(),
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            if (TextUtils.isEmpty(enabled)) return false;
            for (String part : enabled.split(":")) {
                if (expected.equalsIgnoreCase(part.trim())) return true;
            }
        } catch (Exception ignored) {}
        return false;
    }

    private boolean hasOverlay() {
        try {
            return Settings.canDrawOverlays(getContext());
        } catch (Exception e) {
            return false;
        }
    }

    /* checkOpNoThrow is deprecated from API 29 but is the only option below it. */
    @SuppressWarnings("deprecation")
    private boolean hasUsageAccess() {
        try {
            Context ctx = getContext();
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

    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        openSettings(call, new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
    }

    @PluginMethod
    public void openUsageAccessSettings(PluginCall call) {
        openSettings(call, new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS));
    }

    @PluginMethod
    public void openOverlaySettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getContext().getPackageName()));
        openSettings(call, i);
    }

    /**
     * Resolves { opened } rather than rejecting when no such settings screen
     * exists — some OEM builds hide them, and Claude.md 1.5 wants that explained
     * rather than surfaced as a crash.
     */
    private void openSettings(PluginCall call, Intent intent) {
        JSObject ret = new JSObject();
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            ret.put("opened", true);
        } catch (Exception e) {
            ret.put("opened", false);
        }
        call.resolve(ret);
    }

    /* ── Nudge outcomes ──────────────────────────────────────────────── */

    /**
     * The escape hatch, and the reward for reading. Both suppress this one
     * package only — every other target keeps its own counters (section 9.7).
     */
    @PluginMethod
    public void launchApp(PluginCall call) {
        String pkg = call.getString("packageName");
        if (pkg == null || pkg.isEmpty()) {
            call.reject("No app was specified.");
            return;
        }
        int minutes = call.getInt("suppressMinutes", 10);
        boolean dismissed = Boolean.TRUE.equals(call.getBoolean("dismissed", Boolean.TRUE));
        NudgeGate.suppress(getContext(), pkg, minutes * 60_000L, dismissed);

        try {
            Intent launch = getContext().getPackageManager().getLaunchIntentForPackage(pkg);
            if (launch == null) {
                call.reject("That app could not be opened.");
                return;
            }
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(launch);
            call.resolve();
        } catch (Exception e) {
            call.reject("That app could not be opened.", e);
        }
    }

    /** Suppress without launching — used when the user reads on past the threshold. */
    @PluginMethod
    public void suppressApp(PluginCall call) {
        String pkg = call.getString("packageName");
        if (pkg == null || pkg.isEmpty()) { call.resolve(); return; }
        int minutes = call.getInt("minutes", 60);
        boolean dismissed = Boolean.TRUE.equals(call.getBoolean("dismissed", Boolean.FALSE));
        NudgeGate.suppress(getContext(), pkg, minutes * 60_000L, dismissed);
        call.resolve();
    }

    @PluginMethod
    public void getForegroundMinutesToday(PluginCall call) {
        String pkg = call.getString("packageName");
        JSObject ret = new JSObject();
        ret.put("minutes", pkg == null ? -1 : NudgeGate.foregroundMinutesToday(getContext(), pkg));
        call.resolve(ret);
    }

    /** Clears the cold-start handoff once JS has consumed it. */
    @PluginMethod
    public void consumePendingNudge(PluginCall call) {
        SharedPreferences p = NudgeGate.prefs(getContext());
        String raw = p.getString("fr_pending_nudge", null);
        p.edit().remove("fr_pending_nudge").apply();
        JSObject ret = new JSObject();
        ret.put("pending", raw);
        call.resolve(ret);
    }
}
