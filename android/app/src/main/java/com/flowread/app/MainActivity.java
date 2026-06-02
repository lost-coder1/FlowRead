package com.flowread.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.ClipData;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

public class MainActivity extends BridgeActivity {

    // Pending hot-share/open payloads — fired in onResume once WebView is ready.
    private String pendingHotShareText = null;
    private boolean pendingHotPdf = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FlowReadDeviceSyncPlugin.class);
        registerPlugin(FlowReadOcrPlugin.class);
        registerPlugin(FlowReadIapPlugin.class);
        super.onCreate(savedInstanceState);
        Intent intent = getIntent();
        // Cold start from share sheet — store so JS reads after DOMContentLoaded.
        String sharedText = extractSharedText(intent);
        if (sharedText != null) {
            storePendingShare(sharedText);
        }
        // Cold start from "Open with" — copy PDF to cache, store path for JS.
        if (isPdfViewIntent(intent)) {
            storePendingPdf(intent.getData());
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
        if (isPdfViewIntent(intent)) {
            storePendingPdf(intent.getData());
            pendingHotPdf = true;
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
        if (pendingHotPdf) {
            pendingHotPdf = false;
            getBridge().getWebView().post(new Runnable() {
                @Override
                public void run() {
                    firePdfOpenEvent();
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

    private void storePendingPdf(Uri uri) {
        if (uri == null) return;
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
            // Store as simple JSON so JS can parse path + name without extra deps.
            String json = "{\"path\":\"" + dest.getAbsolutePath() + "\",\"name\":\""
                    + fileName.replace("\"", "") + "\"}";
            prefs.edit().putString("fr_pending_pdf_open", json).apply();
        } catch (Exception e) {
            android.util.Log.e("FlowRead", "storePendingPdf failed", e);
        }
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
}
