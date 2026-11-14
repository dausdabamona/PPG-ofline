package id.ppgsorong.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        ubahKirimJadiBuka(getIntent());
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        ubahKirimJadiBuka(intent);
        super.onNewIntent(intent);
    }

    /**
     * Berkas yang "dikirim" (ACTION_SEND, mis. dari WhatsApp) ke PPG Sorong diperlakukan sama dengan
     * "Buka dengan" (ACTION_VIEW), sehingga plugin App meneruskannya ke peristiwa appUrlOpen / getLaunchUrl
     * dan aplikasi web membukanya dengan bukaBerkasApaSaja.
     */
    @SuppressWarnings("deprecation")
    private static void ubahKirimJadiBuka(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        Uri uri;
        if (Build.VERSION.SDK_INT >= 33) {
            uri = intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
        } else {
            uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        }
        if (uri == null) return;
        String jenis = intent.getType();
        intent.setAction(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, jenis != null ? jenis : "application/octet-stream");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    }
}
