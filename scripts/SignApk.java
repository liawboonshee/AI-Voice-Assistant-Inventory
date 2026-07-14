import com.android.apksig.ApkSigner;
import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class SignApk {
  public static void main(String[] args) throws Exception {
    if (args.length != 7) {
      throw new IllegalArgumentException(
          "usage: SignApk INPUT OUTPUT KEYSTORE STORE_PASSWORD ALIAS KEY_PASSWORD MIN_SDK");
    }

    File input = new File(args[0]);
    File output = new File(args[1]);
    File keystoreFile = new File(args[2]);
    char[] storePassword = args[3].toCharArray();
    String alias = args[4];
    char[] keyPassword = args[5].toCharArray();
    int minSdk = Integer.parseInt(args[6]);

    KeyStore keystore = KeyStore.getInstance("JKS");
    try (FileInputStream stream = new FileInputStream(keystoreFile)) {
      keystore.load(stream, storePassword);
    }

    PrivateKey privateKey = (PrivateKey) keystore.getKey(alias, keyPassword);
    if (privateKey == null) throw new IllegalStateException("private key not found");

    Certificate[] chain = keystore.getCertificateChain(alias);
    List<X509Certificate> certificates = new ArrayList<>();
    for (Certificate certificate : chain) certificates.add((X509Certificate) certificate);

    ApkSigner.SignerConfig signer =
        new ApkSigner.SignerConfig.Builder(alias, privateKey, certificates).build();

    new ApkSigner.Builder(Collections.singletonList(signer))
        .setInputApk(input)
        .setOutputApk(output)
        .setMinSdkVersion(minSdk)
        .setV1SigningEnabled(true)
        .setV2SigningEnabled(true)
        .setV3SigningEnabled(true)
        .build()
        .sign();
  }
}
