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
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
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
        // Android 13+: READ_EXTERNAL_STORAGE is deprecated; MediaStore.Downloads is open
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
        JSArray extArray = call.getArray("extensions");
        List<String> extensions = new ArrayList<>();
        if (extArray != null) {
            for (int i = 0; i < extArray.length(); i++) {
                String ext = extArray.optString(i, "").trim().toLowerCase(Locale.ROOT);
                if (!ext.isEmpty()) extensions.add(ext);
            }
        }
        if (extensions.isEmpty()) {
            extensions = new ArrayList<>(Arrays.asList(".pdf"));
        }

        List<String> mimeTypes = extensionsToMimeTypes(extensions);

        // Deduplicate results across query sources by absolute path
        Map<String, JSObject> resultMap = new LinkedHashMap<>();

        ContentResolver resolver = getContext().getContentResolver();
        boolean hasStoragePerm = ContextCompat.checkSelfPermission(getContext(),
                Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10+: MediaStore.Downloads is the primary source.
            // On Android 10-12 it needs READ_EXTERNAL_STORAGE for other apps' files;
            // on Android 13+ the permission is deprecated but the Downloads URI still
            // returns indexed documents for the current user session.
            queryUri(MediaStore.Downloads.EXTERNAL_CONTENT_URI, mimeTypes, extensions, resolver, resultMap);

            // Android 10-12: Also scan MediaStore.Files for documents outside Downloads
            // (e.g. cloud sync folders, file manager copies). Needs READ_EXTERNAL_STORAGE.
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU && hasStoragePerm) {
                queryUri(MediaStore.Files.getContentUri("external"), mimeTypes, extensions, resolver, resultMap);
            }
        } else {
            // Android 9 and below: recursive filesystem walk requires READ_EXTERNAL_STORAGE
            if (!hasStoragePerm) {
                JSObject ret = new JSObject();
                ret.put("accessRequired", true);
                ret.put("files", new JSArray());
                call.resolve(ret);
                return;
            }
            File root = Environment.getExternalStorageDirectory();
            scanRecursive(root, root, 0, 4, extensions, new HashSet<String>(), resultMap);
        }

        JSArray files = new JSArray();
        for (JSObject item : resultMap.values()) {
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

    // ── helpers ──────────────────────────────────────────────────────────────

    private void queryUri(
            Uri uri,
            List<String> mimeTypes,
            List<String> extensions,
            ContentResolver resolver,
            Map<String, JSObject> resultMap) {

        // Build OR clauses: MIME type match + extension fallback via _data.
        // The extension fallback catches files where MediaStore didn't detect the MIME type.
        List<String> clauses = new ArrayList<>();
        List<String> args = new ArrayList<>();

        if (!mimeTypes.isEmpty()) {
            StringBuilder mimeClause = new StringBuilder(MediaStore.Files.FileColumns.MIME_TYPE + " IN (");
            for (int i = 0; i < mimeTypes.size(); i++) {
                if (i > 0) mimeClause.append(",");
                mimeClause.append("?");
                args.add(mimeTypes.get(i));
            }
            mimeClause.append(")");
            clauses.add(mimeClause.toString());
        }

        for (String ext : extensions) {
            clauses.add(MediaStore.Files.FileColumns.DATA + " LIKE ?");
            args.add("%" + ext);
        }

        if (clauses.isEmpty()) return;

        StringBuilder selection = new StringBuilder("(");
        for (int i = 0; i < clauses.size(); i++) {
            if (i > 0) selection.append(" OR ");
            selection.append(clauses.get(i));
        }
        selection.append(")");

        String[] projection = {
            MediaStore.Files.FileColumns.DISPLAY_NAME,
            MediaStore.Files.FileColumns.DATA
        };

        try (Cursor cursor = resolver.query(
                uri,
                projection,
                selection.toString(),
                args.toArray(new String[0]),
                MediaStore.Files.FileColumns.DISPLAY_NAME + " ASC")) {

            if (cursor == null) return;

            int nameCol = cursor.getColumnIndex(MediaStore.Files.FileColumns.DISPLAY_NAME);
            int dataCol = cursor.getColumnIndex(MediaStore.Files.FileColumns.DATA);
            if (nameCol < 0) return;

            // Fallback path root when DATA column is unavailable (some Android versions)
            String downloadsRoot = Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_DOWNLOADS).getAbsolutePath();

            while (cursor.moveToNext()) {
                String name = cursor.getString(nameCol);
                if (name == null) continue;

                String path = (dataCol >= 0) ? cursor.getString(dataCol) : null;
                // If DATA is null or missing, try constructing path from Downloads root
                if (path == null || path.isEmpty()) {
                    path = downloadsRoot + File.separator + name;
                }

                if (resultMap.containsKey(path)) continue;

                File file = new File(path);
                if (!file.exists()) continue;

                JSObject item = new JSObject();
                item.put("name", name);
                item.put("path", path);
                item.put("displayPath", formatDisplayPath(path));
                resultMap.put(path, item);
            }
        } catch (Exception ignored) {
            // Silently skip URIs not available on this OS version
        }
    }

    private void scanRecursive(
            File root, File current, int depth, int maxDepth,
            List<String> extensions, Set<String> visited,
            Map<String, JSObject> resultMap) {

        if (current == null || depth > maxDepth) return;

        String canonicalPath;
        try { canonicalPath = current.getCanonicalPath(); } catch (IOException e) { return; }
        if (!visited.add(canonicalPath)) return;
        if (current.isHidden()) return;

        File[] children = current.listFiles();
        if (children == null) return;

        for (File child : children) {
            if (child == null || child.isHidden()) continue;
            if (child.isDirectory()) {
                if (depth < maxDepth) scanRecursive(root, child, depth + 1, maxDepth, extensions, visited, resultMap);
                continue;
            }
            String lowerName = child.getName().toLowerCase(Locale.ROOT);
            boolean matches = false;
            for (String ext : extensions) { if (lowerName.endsWith(ext)) { matches = true; break; } }
            if (!matches) continue;

            String path = child.getAbsolutePath();
            if (resultMap.containsKey(path)) continue;

            JSObject item = new JSObject();
            item.put("name", child.getName());
            item.put("path", path);
            item.put("displayPath", formatDisplayPath(path));
            resultMap.put(path, item);
        }
    }

    private List<String> extensionsToMimeTypes(List<String> extensions) {
        List<String> mimes = new ArrayList<>();
        for (String ext : extensions) {
            switch (ext) {
                case ".pdf":  mimes.add("application/pdf"); break;
                case ".docx": mimes.add("application/vnd.openxmlformats-officedocument.wordprocessingml.document"); break;
                case ".txt":  mimes.add("text/plain"); break;
            }
        }
        return mimes;
    }

    private String formatDisplayPath(String absolutePath) {
        File parent = new File(absolutePath).getParentFile();
        if (parent == null) return "/";
        String rootPath = Environment.getExternalStorageDirectory().getAbsolutePath();
        String parentPath = parent.getAbsolutePath();
        if (parentPath.equals(rootPath)) return "/";
        if (parentPath.startsWith(rootPath + File.separator)) return parentPath.substring(rootPath.length());
        return parentPath;
    }

    private void resolveAccess(PluginCall call, boolean granted, boolean openedSettings) {
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        ret.put("openedSettings", openedSettings);
        call.resolve(ret);
    }

    private byte[] readBytes(File file) throws IOException {
        FileInputStream input = new FileInputStream(file);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        try {
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return output.toByteArray();
        } finally {
            try { input.close(); } catch (IOException ignored) {}
            try { output.close(); } catch (IOException ignored) {}
        }
    }
}
