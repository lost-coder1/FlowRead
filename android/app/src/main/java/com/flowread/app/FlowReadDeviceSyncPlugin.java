package com.flowread.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import android.util.Base64;

@CapacitorPlugin(
    name = "FlowReadDeviceSync",
    permissions = {
        @Permission(alias = "storage", strings = { Manifest.permission.READ_EXTERNAL_STORAGE })
    }
)
public class FlowReadDeviceSyncPlugin extends Plugin {

    @PluginMethod
    public void requestAccess(PluginCall call) {
        // Android 13+: MediaStore queries need no runtime permission for documents
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            resolveAccess(call, true, false);
            return;
        }

        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED) {
            resolveAccess(call, true, false);
            return;
        }

        requestPermissionForAlias("storage", call, "storagePermissionCallback");
    }

    @PermissionCallback
    private void storagePermissionCallback(PluginCall call) {
        boolean granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
        resolveAccess(call, granted, false);
    }

    @PluginMethod
    public void scanFiles(PluginCall call) {
        // Android 10-12 requires READ_EXTERNAL_STORAGE for MediaStore document queries
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                JSObject ret = new JSObject();
                ret.put("accessRequired", true);
                ret.put("files", new JSArray());
                call.resolve(ret);
                return;
            }
        }

        JSArray extArray = call.getArray("extensions");
        List<String> extensions = new ArrayList<>();
        if (extArray != null) {
            for (int i = 0; i < extArray.length(); i++) {
                String ext = extArray.optString(i, "").trim().toLowerCase(Locale.ROOT);
                if (!ext.isEmpty()) extensions.add(ext);
            }
        }
        if (extensions.isEmpty()) {
            extensions = new ArrayList<>();
            extensions.add(".pdf");
        }

        // Map file extensions to MIME types
        List<String> mimeTypes = new ArrayList<>();
        for (String ext : extensions) {
            switch (ext) {
                case ".pdf":
                    mimeTypes.add("application/pdf");
                    break;
                case ".docx":
                    mimeTypes.add("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
                    break;
                case ".txt":
                    mimeTypes.add("text/plain");
                    break;
            }
        }

        List<JSObject> results = new ArrayList<>();

        if (!mimeTypes.isEmpty()) {
            // Build IN clause: MIME_TYPE IN (?,?,?)
            StringBuilder selection = new StringBuilder(MediaStore.Files.FileColumns.MIME_TYPE + " IN (");
            String[] selectionArgs = new String[mimeTypes.size()];
            for (int i = 0; i < mimeTypes.size(); i++) {
                if (i > 0) selection.append(",");
                selection.append("?");
                selectionArgs[i] = mimeTypes.get(i);
            }
            selection.append(")");

            String[] projection = {
                MediaStore.Files.FileColumns.DISPLAY_NAME,
                MediaStore.Files.FileColumns.DATA
            };

            Uri collection = MediaStore.Files.getContentUri("external");
            ContentResolver resolver = getContext().getContentResolver();

            try (Cursor cursor = resolver.query(
                    collection,
                    projection,
                    selection.toString(),
                    selectionArgs,
                    MediaStore.Files.FileColumns.DISPLAY_NAME + " ASC")) {

                if (cursor != null) {
                    int nameCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DISPLAY_NAME);
                    int dataCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATA);

                    while (cursor.moveToNext()) {
                        String name = cursor.getString(nameCol);
                        String path = cursor.getString(dataCol);

                        if (name == null || path == null) continue;

                        File file = new File(path);
                        if (!file.exists()) continue;

                        JSObject item = new JSObject();
                        item.put("name", name);
                        item.put("path", path);
                        item.put("displayPath", formatDisplayPath(path));
                        results.add(item);
                    }
                }
            } catch (Exception e) {
                // MediaStore unavailable — return empty list gracefully
            }
        }

        JSArray files = new JSArray();
        for (JSObject item : results) {
            files.put(item);
        }

        JSObject ret = new JSObject();
        ret.put("accessRequired", false);
        ret.put("files", files);
        call.resolve(ret);
    }

    @PluginMethod
    public void readFile(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.trim().isEmpty()) {
            call.reject("Missing file path.");
            return;
        }

        File file = new File(path);
        if (!file.exists() || !file.isFile()) {
            call.reject("File not found.");
            return;
        }

        try {
            byte[] bytes = readBytes(file);
            JSObject ret = new JSObject();
            ret.put("data", Base64.encodeToString(bytes, Base64.NO_WRAP));
            call.resolve(ret);
        } catch (IOException ex) {
            call.reject("Could not read device file.", ex);
        }
    }

    private void resolveAccess(PluginCall call, boolean granted, boolean openedSettings) {
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        ret.put("openedSettings", openedSettings);
        call.resolve(ret);
    }

    private String formatDisplayPath(String absolutePath) {
        File file = new File(absolutePath);
        File parent = file.getParentFile();
        if (parent == null) return "/";

        String rootPath = Environment.getExternalStorageDirectory().getAbsolutePath();
        String parentPath = parent.getAbsolutePath();

        if (parentPath.equals(rootPath)) return "/";
        if (parentPath.startsWith(rootPath + File.separator)) {
            return parentPath.substring(rootPath.length());
        }
        return parentPath;
    }

    private byte[] readBytes(File file) throws IOException {
        FileInputStream input = new FileInputStream(file);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        try {
            while ((count = input.read(buffer)) != -1) {
                output.write(buffer, 0, count);
            }
            return output.toByteArray();
        } finally {
            try { input.close(); } catch (IOException ignored) {}
            try { output.close(); } catch (IOException ignored) {}
        }
    }
}
