package com.vox.cardsim;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String SALE_CHANNEL = "market_sales";
    private WebView web;
    private OfflineBridge offlineBridge;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ensureNotificationChannel();

        web = new WebView(this);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(true);
        web.getSettings().setAllowContentAccess(true);
        web.getSettings().setAllowFileAccessFromFileURLs(true);
        web.getSettings().setAllowUniversalAccessFromFileURLs(true);

        offlineBridge = new OfflineBridge();
        web.addJavascriptInterface(offlineBridge, "VOXNative");
        web.setWebViewClient(new CacheWebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.setBackgroundColor(0xFF090C11);
        web.loadUrl("file:///android_asset/index.html");
        setContentView(web);
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            NotificationChannel ch = new NotificationChannel(SALE_CHANNEL, "Ventes du marketplace", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Notifications quand un article VOX Card Sim est vendu");
            nm.createNotificationChannel(ch);
        }
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 406);
        }
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes("UTF-8"));
            StringBuilder out = new StringBuilder();
            for (byte b : bytes) out.append(String.format(Locale.US, "%02x", b));
            return out.toString();
        } catch (Exception e) {
            return Integer.toHexString(value.hashCode());
        }
    }

    private File cacheFileFor(String url) {
        File dir = new File(getFilesDir(), "offline_http");
        if (!dir.exists()) dir.mkdirs();
        return new File(dir, sha256(url) + ".cache");
    }

    private String guessMime(String url, String stored) {
        if (stored != null && !stored.isEmpty()) return stored.split(";")[0].trim();
        String u = url.toLowerCase(Locale.US);
        if (u.contains(".webp")) return "image/webp";
        if (u.contains(".png")) return "image/png";
        if (u.contains(".jpg") || u.contains(".jpeg")) return "image/jpeg";
        if (u.contains(".json") || u.contains("/api/") || u.contains("raw.githubusercontent.com")) return "application/json";
        return "application/octet-stream";
    }

    private class CacheWebViewClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            try {
                if (!"GET".equalsIgnoreCase(request.getMethod())) return null;
                String url = request.getUrl().toString();
                if (!url.startsWith("https://")) return null;
                File file = cacheFileFor(url);
                if (!file.exists() || file.length() <= 0) return null;
                SharedPreferences prefs = getSharedPreferences("vox_offline", MODE_PRIVATE);
                String mime = guessMime(url, prefs.getString("mime_" + sha256(url), null));
                Map<String, String> headers = new HashMap<>();
                headers.put("Access-Control-Allow-Origin", "*");
                headers.put("Cache-Control", "public, max-age=31536000");
                return new WebResourceResponse(mime, mime.startsWith("text/") || mime.contains("json") ? "UTF-8" : null,
                        200, "OK", headers, new FileInputStream(file));
            } catch (Exception ignored) {
                return null;
            }
        }
    }

    public class OfflineBridge {
        private final ExecutorService worker = Executors.newSingleThreadExecutor();
        private final SharedPreferences prefs = getSharedPreferences("vox_offline", MODE_PRIVATE);

        @JavascriptInterface
        public boolean hasPack(String setId) { return prefs.getBoolean("pack_" + setId, false); }

        @JavascriptInterface
        public String packStatus(String setId) {
            try {
                JSONObject o = new JSONObject();
                o.put("installed", prefs.getBoolean("pack_" + setId, false));
                o.put("completedAt", prefs.getLong("pack_time_" + setId, 0));
                o.put("items", prefs.getInt("pack_items_" + setId, 0));
                o.put("bytes", prefs.getLong("pack_bytes_" + setId, 0));
                return o.toString();
            } catch (Exception e) { return "{}"; }
        }

        @JavascriptInterface
        public void setSaleNotifications(boolean enabled) {
            prefs.edit().putBoolean("sale_notifications", enabled).apply();
            if (enabled) runOnUiThread(() -> requestNotificationPermissionIfNeeded());
        }

        @JavascriptInterface
        public void notifySale(String label, int units, double revenue) {
            if (!prefs.getBoolean("sale_notifications", true)) return;
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
            runOnUiThread(() -> {
                Intent intent = new Intent(MainActivity.this, MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                PendingIntent pi = PendingIntent.getActivity(MainActivity.this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                String text = (units > 1 ? units + " × " : "") + label + " · " + String.format(Locale.FRANCE, "%.2f €", revenue);
                Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? new Notification.Builder(MainActivity.this, SALE_CHANNEL) : new Notification.Builder(MainActivity.this);
                b.setSmallIcon(android.R.drawable.star_on)
                        .setContentTitle("Article vendu !")
                        .setContentText(text)
                        .setStyle(new Notification.BigTextStyle().bigText(text))
                        .setAutoCancel(true)
                        .setContentIntent(pi);
                NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                nm.notify((int) (System.currentTimeMillis() & 0x7fffffff), b.build());
            });
        }

        @JavascriptInterface
        public void downloadPack(final String setId, final String urlsJson) {
            worker.execute(() -> {
                int done = 0, failed = 0; long bytes = 0;
                try {
                    JSONArray arr = new JSONArray(urlsJson); int total = arr.length();
                    prefs.edit().putBoolean("pack_" + setId, false).apply();
                    notifyProgress(setId, 0, total, 0, false, 0);
                    for (int i = 0; i < total; i++) {
                        String url = arr.optString(i, "");
                        if (url.isEmpty()) { failed++; continue; }
                        try { File f = cacheFileFor(url); if (!f.exists() || f.length() <= 0) downloadUrl(url, f); bytes += Math.max(0, f.length()); done++; }
                        catch (Exception e) { failed++; }
                        if (i % 2 == 0 || i == total - 1) notifyProgress(setId, done, total, failed, false, bytes);
                    }
                    boolean installed = failed == 0 && done == total;
                    prefs.edit().putBoolean("pack_" + setId, installed).putLong("pack_time_" + setId, System.currentTimeMillis()).putInt("pack_items_" + setId, done).putLong("pack_bytes_" + setId, bytes).putString("pack_manifest_" + setId, urlsJson).apply();
                    notifyProgress(setId, done, total, failed, true, bytes);
                } catch (Exception e) { notifyProgress(setId, done, 0, failed + 1, true, bytes); }
            });
        }

        private void downloadUrl(String address, File target) throws Exception {
            HttpURLConnection conn = (HttpURLConnection) new URL(address).openConnection();
            conn.setConnectTimeout(15000); conn.setReadTimeout(30000); conn.setInstanceFollowRedirects(true); conn.setRequestProperty("User-Agent", "VOX-CardSim/0.6 Android"); conn.connect();
            int code = conn.getResponseCode(); if (code < 200 || code >= 300) throw new Exception("HTTP " + code);
            File tmp = new File(target.getAbsolutePath() + ".part");
            try (InputStream in = new BufferedInputStream(conn.getInputStream()); BufferedOutputStream out = new BufferedOutputStream(new FileOutputStream(tmp))) { byte[] buffer = new byte[32768]; int n; while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n); }
            if (target.exists()) target.delete();
            if (!tmp.renameTo(target)) { try (InputStream in = new FileInputStream(tmp); BufferedOutputStream out = new BufferedOutputStream(new FileOutputStream(target))) { byte[] buffer = new byte[32768]; int n; while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n); } tmp.delete(); }
            prefs.edit().putString("mime_" + sha256(address), guessMime(address, conn.getContentType())).apply(); conn.disconnect();
        }

        private void notifyProgress(String setId, int done, int total, int failed, boolean finished, long bytes) {
            final String js = "window.voxOfflineProgress && window.voxOfflineProgress(" + JSONObject.quote(setId) + "," + done + "," + total + "," + failed + "," + finished + "," + bytes + ");";
            runOnUiThread(() -> web.evaluateJavascript(js, null));
        }
    }
}
