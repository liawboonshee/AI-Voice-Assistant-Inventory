package com.chatgpt.voice.pro;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;

@CapacitorPlugin(name = "InventoryBackup")
public class InventoryBackupPlugin extends Plugin {
    private static final int MAX_BACKUP_BYTES = 32 * 1024 * 1024;

    private File backupDirectory() {
        return new File(getContext().getCacheDir(), "inventory-backups");
    }

    private File prepareBackup(PluginCall call) throws IOException {
        String contents = call.getString("contents");
        String name = call.getString("fileName");
        if (contents == null || contents.isEmpty() || name == null || !name.endsWith(".json") ||
                name.contains("/") || name.contains("\\")) {
            throw new IOException("备份内容或文件名无效");
        }
        byte[] bytes = contents.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_BACKUP_BYTES) throw new IOException("备份超过 32 MB，请先保留旧手机资料");
        File directory = new File(backupDirectory(), UUID.randomUUID().toString());
        if (!directory.mkdirs()) throw new IOException("无法准备备份文件，请检查手机剩余空间");
        File file = new File(directory, name);
        BackupFileIO.writeFile(file, bytes);
        return file;
    }

    @PluginMethod
    public void saveBackup(PluginCall call) {
        try {
            File file = prepareBackup(call);
            call.getData().put("cachePath", file.getAbsolutePath());
            // Persist the small file reference while the picker is open, rather than a large JSON bundle.
            call.getData().remove("contents");
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/json");
            intent.putExtra(Intent.EXTRA_TITLE, file.getName());
            startActivityForResult(call, intent, "saveBackupResult");
        } catch (Exception error) {
            call.reject(error.getMessage(), null, error);
        }
    }

    @ActivityCallback
    private void saveBackupResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK) {
            JSObject response = new JSObject();
            response.put("saved", false);
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        Uri uri = result.getData() != null ? result.getData().getData() : null;
        if (uri == null) {
            call.reject("没有取得保存位置，请改用“分享备份”");
            return;
        }
        ContentResolver resolver = getContext().getContentResolver();
        execute(() -> {
            try {
                String path = call.getString("cachePath");
                if (path == null) throw new IOException("备份准备已失效，请重新导出");
                File source = new File(path);
                if (!source.getCanonicalPath().startsWith(backupDirectory().getCanonicalPath() + File.separator)) {
                    throw new IOException("备份准备已失效，请重新导出");
                }
                byte[] contents;
                try (FileInputStream input = new FileInputStream(source)) {
                    contents = BackupFileIO.read(input, MAX_BACKUP_BYTES);
                }
                // Use the portable write mode supported by document providers.
                try (OutputStream output = resolver.openOutputStream(uri, "w")) {
                    if (output == null) throw new IOException("无法写入所选位置");
                    output.write(contents);
                    output.flush();
                }
                try (InputStream input = resolver.openInputStream(uri)) {
                    BackupFileIO.verify(input, contents);
                }
                JSObject response = new JSObject();
                response.put("saved", true);
                response.put("fileName", displayName(resolver, uri, source.getName()));
                response.put("byteCount", contents.length);
                call.resolve(response);
            } catch (Exception error) {
                call.reject("保存未完成，请改用“分享备份”或“复制备份”", "BACKUP_WRITE_FAILED", error);
            }
        });
    }

    @PluginMethod
    public void shareBackup(PluginCall call) {
        try {
            File file = prepareBackup(call);
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("application/json");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.setClipData(ClipData.newRawUri("库存宝备份", uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, "把库存宝备份传到新手机");
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().runOnUiThread(() -> {
                try {
                    getActivity().startActivity(chooser);
                    JSObject response = new JSObject();
                    response.put("prepared", true);
                    response.put("opened", true);
                    response.put("fileName", file.getName());
                    response.put("byteCount", file.length());
                    call.resolve(response);
                } catch (Exception error) {
                    call.reject("无法打开分享窗口，请使用“复制备份”", null, error);
                }
            });
        } catch (Exception error) {
            call.reject(error.getMessage(), null, error);
        }
    }

    @PluginMethod
    public void copyBackup(PluginCall call) {
        String contents = call.getString("contents");
        if (contents == null || contents.isEmpty()) {
            call.reject("备份内容为空");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                ClipboardManager clipboard = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
                if (clipboard == null) throw new IOException("剪贴板不可用");
                clipboard.setPrimaryClip(ClipData.newPlainText("库存宝备份", contents));
                JSObject response = new JSObject();
                response.put("copied", true);
                call.resolve(response);
            } catch (Exception error) {
                call.reject("复制失败，请用“分享备份”，或展开备份文字长按复制", null, error);
            }
        });
    }

    @PluginMethod
    public void pickBackup(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES,
                new String[] {"application/json", "text/plain", "application/octet-stream"});
        try {
            startActivityForResult(call, intent, "pickBackupResult");
        } catch (Exception error) {
            call.reject("无法打开文件选择窗口，请用“备份文字恢复”", null, error);
        }
    }

    @ActivityCallback
    private void pickBackupResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK) {
            JSObject response = new JSObject();
            response.put("selected", false);
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        Uri uri = result.getData() != null ? result.getData().getData() : null;
        if (uri == null) {
            call.reject("没有取得备份文件");
            return;
        }
        ContentResolver resolver = getContext().getContentResolver();
        execute(() -> {
            try {
                String name = displayName(resolver, uri, "备份文件.json");
                if (!name.toLowerCase(Locale.ROOT).endsWith(".json")) throw new IOException("请选择库存宝的 .json 备份文件");
                byte[] bytes;
                try (InputStream input = resolver.openInputStream(uri)) {
                    bytes = BackupFileIO.read(input, MAX_BACKUP_BYTES);
                }
                JSObject response = new JSObject();
                response.put("selected", true);
                response.put("fileName", name);
                response.put("contents", new String(bytes, StandardCharsets.UTF_8));
                response.put("byteCount", bytes.length);
                call.resolve(response);
            } catch (Exception error) {
                call.reject(error.getMessage(), null, error);
            }
        });
    }

    private String displayName(ContentResolver resolver, Uri uri, String fallback) {
        try (Cursor cursor = resolver.query(uri, new String[] {OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst() && !cursor.isNull(0)) return cursor.getString(0);
        } catch (Exception ignored) { /* the file has already been read or verified */ }
        return fallback;
    }
}
