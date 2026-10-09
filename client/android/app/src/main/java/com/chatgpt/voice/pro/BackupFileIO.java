package com.chatgpt.voice.pro;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;

final class BackupFileIO {
    private BackupFileIO() {}

    static void writeFile(File file, byte[] contents) throws IOException {
        if (contents.length == 0) throw new IOException("备份内容为空");
        try (FileOutputStream output = new FileOutputStream(file)) {
            output.write(contents);
            output.flush();
        }
        try (FileInputStream input = new FileInputStream(file)) {
            verify(input, contents);
        }
    }

    static void verify(InputStream input, byte[] expected) throws IOException {
        if (input == null || expected.length == 0) throw new IOException("备份文件没有内容");
        byte[] buffer = new byte[8192];
        int offset = 0;
        int count;
        while ((count = input.read(buffer)) != -1) {
            if (count > expected.length - offset) throw new IOException("备份文件大小不一致");
            for (int index = 0; index < count; index++) {
                if (buffer[index] != expected[offset + index]) throw new IOException("备份文件内容不一致");
            }
            offset += count;
        }
        if (offset != expected.length) throw new IOException("备份文件为空或不完整");
    }

    static byte[] read(InputStream input, int maxBytes) throws IOException {
        if (input == null) throw new IOException("无法读取备份文件");
        try (ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (count > maxBytes - bytes.size()) throw new IOException("请选择库存宝生成的完整 JSON 备份文件");
                bytes.write(buffer, 0, count);
            }
            if (bytes.size() == 0) throw new IOException("这个文件没有备份内容，请在旧手机重新导出或分享备份");
            return bytes.toByteArray();
        }
    }
}
