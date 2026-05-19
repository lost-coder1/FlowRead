package com.flowread.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.ClipData;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Holds a URL received while the app was already running (onNewIntent).
    // Fired in onResume so the WebView is guaranteed to be active.
    private String pendingHotShareText = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FlowReadDeviceSyncPlugin.class);
        registerPlugin(FlowReadOcrPlugin.class);
        registerPlugin(FlowReadIapPlugin.class);
        super.onCreate(savedInstanceState);
        // Cold start from share sheet — write to Preferences so JS reads it
        // after DOMContentLoaded (bridge isn't safe to evaluate JS yet here).
        String sharedText = extractSharedText(getIntent());
        if (sharedText != null) {
            storePendingShare(sharedText);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String sharedText = extractSharedText(intent);
        if (sharedText != null) {
            // Store first, then let JS read from Preferences in one code path for
            // both cold and hot share flows.
            storePendingShare(sharedText);
            pendingHotShareText = sharedText;
        }
    }

    @Override
    public void     onResume() {
        super.onResume();
        if (pendingHotShareText != null) {
            pendingHotShareText = null;
            // Post to WebView's queue so JS is executing before the event fires
            getBridge().getWebView().post(new Runnable() {
                @Override
                public void run() {
                    fireShareEvent();
                }
            });
        }
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
}
