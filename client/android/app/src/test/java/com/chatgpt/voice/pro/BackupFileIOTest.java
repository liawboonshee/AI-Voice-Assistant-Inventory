package com.chatgpt.voice.pro;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertThrows;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public class BackupFileIOTest {
    @Rule public TemporaryFolder temporary = new TemporaryFolder();

    @Test public void realFilePreservesChineseAndFractionalWeights() throws Exception {
        byte[] data = "{\"customers\":[{\"name\":\"阿明\",\"debt\":100}],\"weight\":0.01}".getBytes(StandardCharsets.UTF_8);
        File file = temporary.newFile("库存宝备份.json");
        BackupFileIO.writeFile(file, data);
        try (FileInputStream input = new FileInputStream(file)) {
            assertArrayEquals(data, BackupFileIO.read(input, 32 * 1024 * 1024));
        }
    }

    @Test public void zeroByteFileCannotPassVerification() {
        byte[] expected = "{\"inventory\":\"资料\"}".getBytes(StandardCharsets.UTF_8);
        assertThrows(IOException.class, () -> BackupFileIO.verify(new ByteArrayInputStream(new byte[0]), expected));
        assertThrows(IOException.class, () -> BackupFileIO.read(new ByteArrayInputStream(new byte[0]), 1024));
    }

    @Test public void truncatedOrChangedBytesCannotPassVerification() {
        byte[] expected = new byte[] {1, 2, 3};
        assertThrows(IOException.class, () -> BackupFileIO.verify(new ByteArrayInputStream(new byte[] {1, 2}), expected));
        assertThrows(IOException.class, () -> BackupFileIO.verify(new ByteArrayInputStream(new byte[] {1, 9, 3}), expected));
    }

    @Test public void snapshotLargerThanAnActivityBundleIsStoredAsACompleteFile() throws Exception {
        byte[] data = new byte[2 * 1024 * 1024 + 13];
        for (int i = 0; i < data.length; i++) data[i] = (byte) (i % 251);
        File file = temporary.newFile("large.json");
        BackupFileIO.writeFile(file, data);
        try (FileInputStream input = new FileInputStream(file)) {
            assertArrayEquals(data, BackupFileIO.read(input, 32 * 1024 * 1024));
        }
    }

    @Test public void oversizedImportIsRejectedBeforeRestoringAnything() {
        assertThrows(IOException.class, () -> BackupFileIO.read(new ByteArrayInputStream(new byte[10]), 9));
    }
}
