package com.flowread.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.ClipData;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

public class MainActivity extends BridgeActivity {

    // Nudge handoff from FlowReadNudgeService (Claude.md section 9).
    public static final String ACTION_NUDGE = "com.flowread.app.ACTION_NUDGE";
    public static final String EXTRA_NUDGE_PACKAGE = "fr_nudge_package";
    public static final String EXTRA_NUDGE_LABEL = "fr_nudge_label";

    // Pending hot-share text — fired in onResume once WebView is ready.
    private String pendingHotShareText = null;

    // Pending hot nudge — fired in onResume once WebView is ready.
    private boolean pendingHotNudge = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FlowReadDeviceSyncPlugin.class);
        registerPlugin(FlowReadOcrPlugin.class);
        registerPlugin(FlowReadIapPlugin.class);
        registerPlugin(FlowReadNudgePlugin.class);
        super.onCreate(savedInstanceState);
        Intent intent = getIntent();
        // Cold start from share sheet — store so JS reads after DOMContentLoaded.
        String sharedText = extractSharedText(intent);
        if (sharedText != null) {
            storePendingShare(sharedText);
        }
        // Cold start from "Open with" — copy PDF off main thread.
        // JS reads fr_pending_pdf_open from prefs after DOMContentLoaded loads.
        if (isPdfViewIntent(intent)) {
            copyPdfInBackground(intent.getData(), false);
        }
        // Cold nudge. Record that the service's activity start actually landed —
        // see markNudgeDelivered.
        if (intent != null && ACTION_NUDGE.equals(intent.getAction())) {
            markNudgeDelivered();
        }
    }

    /** The nudge service writes fr_pending_nudge and then starts this activity.
     *  The write always succeeds; the start does not — Android drops background
     *  activity starts without SYSTEM_ALERT_WINDOW, and restricts them further on
     *  newer releases. An undelivered handoff must not be banked and shown the
     *  next time the user opens FlowRead themselves (N19), so only a real
     *  ACTION_NUDGE arrival marks it deliverable. FlowReadNudgePlugin reports the
     *  flag to JS and clears it alongside the handoff. */
    private void markNudgeDelivered() {
        try {
            NudgeGate.prefs(this).edit().putBoolean("fr_nudge_delivered", true).apply();
        } catch (Exception e) {
            Log.w("FlowRead", "could not mark nudge delivered", e);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String sharedText = extractSharedText(intent);
        if (sharedText != null) {
            storePendingShare(sharedText);
            pendingHotShareText = sharedText;
        }
        // Hot start — copy off main thread; fire event from background thread when done.
        if (isPdfViewIntent(intent)) {
            copyPdfInBackground(intent.getData(), true);
        }
        // Hot nudge. The service already wrote fr_pending_nudge for the cold-start
        // case, so here we only need to wake the WebView, which happens in onResume.
        if (intent != null && ACTION_NUDGE.equals(intent.getAction())) {
            pendingHotNudge = true;
            markNudgeDelivered();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (pendingHotShareText != null) {
            pendingHotShareText = null;
            getBridge().getWebView().post(new Runnable() {
                @Override
                public void run() {
                    fireShareEvent();
                }
            });
        }
        if (pendingHotNudge) {
            pendingHotNudge = false;
            getBridge().getWebView().post(new Runnable() {
                @Override
                public void run() {
                    fireNudgeEvent();
                }
            });
        }
    }

    private boolean isPdfViewIntent(Intent intent) {
        if (intent == null) return false;
        if (!Intent.ACTION_VIEW.equals(intent.getAction())) return false;
        Uri data = intent.getData();
        if (data == null) return false;
        String type = intent.getType();
        if (type != null && type.equals("application/pdf")) return true;
        // Some apps don't set MIME type — fall back to checking the URI path/extension.
        String path = data.getPath();
        return path != null && path.toLowerCase().endsWith(".pdf");
    }

    /* Copies the incoming PDF URI to cache on a background thread so the main
       thread is never blocked. For hot start (app already running), fires the
       JS event directly once the copy is complete. For cold start, JS reads
       fr_pending_pdf_open from SharedPreferences after DOMContentLoaded. */
    private void copyPdfInBackground(final Uri uri, final boolean isHotStart) {
        if (uri == null) return;
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    String fileName = resolveFileName(uri);
                    File dest = new File(getCacheDir(), "flowread_open_with.pdf");
                    InputStream in = getContentResolver().openInputStream(uri);
                    if (in == null) return;
                    FileOutputStream out = new FileOutputStream(dest);
                    byte[] buf = new byte[65536];
                    int len;
                    while ((len = in.read(buf)) != -1) out.write(buf, 0, len);
                    in.close();
                    out.close();
                    SharedPreferences prefs = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
                    String json = "{\"path\":\"" + dest.getAbsolutePath() + "\",\"name\":\""
                            + fileName.replace("\"", "") + "\"}";
                    prefs.edit().putString("fr_pending_pdf_open", json).apply();
                    // Hot start: JS is already running — fire event now that file is ready.
                    // Cold start: JS will read from prefs in initShareHandler (runs after
                    // DOMContentLoaded, well after this thread finishes).
                    if (isHotStart) {
                        getBridge().getWebView().post(new Runnable() {
                            @Override
                            public void run() {
                                firePdfOpenEvent();
                            }
                        });
                    }
                } catch (Exception e) {
                    android.util.Log.e("FlowRead", "copyPdfInBackground failed", e);
                }
            }
        }).start();
    }

    private String resolveFileName(Uri uri) {
        // Try ContentResolver display name first (works for content:// URIs).
        try {
            Cursor cursor = getContentResolver().query(uri,
                    new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null);
            if (cursor != null) {
                try {
                    if (cursor.moveToFirst()) {
                        String name = cursor.getString(0);
                        if (name != null && !name.isEmpty()) return name;
                    }
                } finally {
                    cursor.close();
                }
            }
        } catch (Exception ignored) {}
        // Fall back to last path segment.
        String path = uri.getLastPathSegment();
        if (path != null && !path.isEmpty()) return path;
        return "document.pdf";
    }

    private String extractSharedText(Intent intent) {
        if (intent == null) return null;
        if (!Intent.ACTION_SEND.equals(intent.getAction())) return null;
        String type = intent.getType();
        if (type == null || !type.startsWith("text/")) return null;
        String text = extractSharedPayload(intent);
        if (text == null || text.isEmpty()) return null;
        return text.trim();
    }

    private String extractSharedPayload(Intent intent) {
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text != null && !text.trim().isEmpty()) return text;

        ClipData clipData = intent.getClipData();
        if (clipData != null && clipData.getItemCount() > 0) {
            for (int i = 0; i < clipData.getItemCount(); i++) {
                ClipData.Item item = clipData.getItemAt(i);
                if (item == null) continue;

                CharSequence itemText = item.getText();
                if (itemText != null && itemText.toString().trim().length() > 0) {
                    return itemText.toString();
                }

                Uri uri = item.getUri();
                if (uri != null) {
                    return uri.toString();
                }
            }
        }

        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        if (subject != null && !subject.trim().isEmpty()) return subject;

        return null;
    }

    private void storePendingShare(String url) {
        // Capacitor Preferences reads from "CapacitorStorage" SharedPreferences,
        // keyed by the raw string — JS Preferences.get({ key: 'fr_pending_share' })
        // will find this value on the next DOMContentLoaded.
        SharedPreferences prefs = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
        prefs.edit().putString("fr_pending_share", url).apply();
    }

    private void fireShareEvent() {
        getBridge().triggerWindowJSEvent("flowreadShareIntent");
    }

    private void firePdfOpenEvent() {
        getBridge().triggerWindowJSEvent("flowreadPdfOpen");
    }

    private void fireNudgeEvent() {
        getBridge().triggerWindowJSEvent("flowreadNudge");
    }
}
