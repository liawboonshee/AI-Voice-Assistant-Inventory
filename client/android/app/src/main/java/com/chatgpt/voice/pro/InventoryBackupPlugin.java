package com.chatgpt.voice.pro;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

@CapacitorPlugin(name = "InventoryBackup")
public class InventoryBackupPlugin extends Plugin {
    @PluginMethod
    public void saveBackup(PluginCall call) {
        String contents = call.getString("contents");
        String fileName = call.getString("fileName");
        if (contents == null || contents.isEmpty() || fileName == null || !fileName.endsWith(".json")) {
            call.reject("备份内容或文件名无效");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, fileName);

        try {
            startActivityForResult(call, intent, "saveBackupResult");
        } catch (Exception error) {
            call.reject("无法打开手机的保存窗口，请检查文件管理应用", null, error);
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

        Intent resultData = result.getData();
        Uri uri = resultData != null ? resultData.getData() : null;
        if (uri == null) {
            call.reject("没有取得备份保存位置");
            return;
        }

        ContentResolver resolver = getContext().getContentResolver();
        // Document providers can perform slow I/O; keep it off the activity thread.
        getBridge().execute(() -> writeAndVerify(call, resolver, uri));
    }

    private void writeAndVerify(PluginCall call, ContentResolver resolver, Uri uri) {
        String contents = call.getString("contents");
        if (contents == null) {
            call.reject("备份内容已失效，请重新导出");
            return;
        }
        byte[] bytes = contents.getBytes(StandardCharsets.UTF_8);
        try {
            try (OutputStream output = resolver.openOutputStream(uri, "wt")) {
                if (output == null) throw new IOException("无法写入所选位置");
                output.write(bytes);
                output.flush();
            }

            // Read back the completed file so an empty or partial write is not reported as success.
            try (InputStream input = resolver.openInputStream(uri);
                 ByteArrayOutputStream verified = new ByteArrayOutputStream(bytes.length)) {
                if (input == null) throw new IOException("无法验证已保存的文件");
                byte[] buffer = new byte[8192];
                int length;
                while ((length = input.read(buffer)) != -1) {
                    verified.write(buffer, 0, length);
                }
                if (!Arrays.equals(bytes, verified.toByteArray())) {
                    throw new IOException("已保存文件不完整");
                }
            }

            String fileName = call.getString("fileName");
            try (Cursor cursor = resolver.query(uri,
                    new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
                if (cursor != null && cursor.moveToFirst() && !cursor.isNull(0)) {
                    fileName = cursor.getString(0);
                }
            } catch (Exception ignored) {
                // The read-back verification succeeded; the requested name remains a valid fallback.
            }

            JSObject response = new JSObject();
            response.put("saved", true);
            response.put("fileName", fileName);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("备份未保存完整，请重新导出并选择其他保存位置", null, error);
        }
    }
}
