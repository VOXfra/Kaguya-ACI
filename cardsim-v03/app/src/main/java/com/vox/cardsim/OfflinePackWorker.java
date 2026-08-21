package com.vox.cardsim;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.work.ForegroundInfo;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Téléchargement persistant des packs hors ligne.
 *
 * Cette classe ne dépend pas de la WebView ni de l'Activity. Une fois le travail
 * confié à WorkManager, Android peut éteindre l'écran ou mettre l'Activity en
 * arrière-plan : la file reste persistée et le Worker continue en service de
 * premier plan avec une notification de progression.
 */
public final class OfflinePackWorker extends Worker {
    public static final String KEY_SET_ID = "set_id";
    public static final String KEY_FORCE = "force";
    public static final String KEY_ALL = "all";
    public static final String KEY_UPDATE_ONLY = "update_only";
    public static final String KEY_LANG = "lang";

    private static final String CHANNEL = "offline_downloads";
    private static final int NOTIFICATION_ID = 12011;
    private static final String API_ROOT = "https://api.tcgdex.net/v2";
    private static final String[] ENERGY_URLS = new String[] {
            "https://images.pokemontcg.io/sve/1_hires.png", "https://images.pokemontcg.io/sve/1.png",
            "https://images.pokemontcg.io/sve/2_hires.png", "https://images.pokemontcg.io/sve/2.png",
            "https://images.pokemontcg.io/sve/3_hires.png", "https://images.pokemontcg.io/sve/3.png",
            "https://images.pokemontcg.io/sve/4_hires.png", "https://images.pokemontcg.io/sve/4.png",
            "https://images.pokemontcg.io/sve/5_hires.png", "https://images.pokemontcg.io/sve/5.png",
            "https://images.pokemontcg.io/sve/6_hires.png", "https://images.pokemontcg.io/sve/6.png",
            "https://images.pokemontcg.io/sve/7_hires.png", "https://images.pokemontcg.io/sve/7.png",
            "https://images.pokemontcg.io/sve/8_hires.png", "https://images.pokemontcg.io/sve/8.png"
    };

    private final SharedPreferences prefs;

    public OfflinePackWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
        prefs = context.getSharedPreferences("vox_offline", Context.MODE_PRIVATE);
    }

    @NonNull
    @Override
    public Result doWork() {
        ensureChannel();
        try {
            setForegroundAsync(foreground("Préparation des téléchargements hors ligne…", 0, 0)).get();
            if (getInputData().getBoolean(KEY_ALL, false)) {
                return downloadAll();
            }
            String setId = getInputData().getString(KEY_SET_ID);
            if (setId == null || setId.trim().isEmpty()) return Result.failure();
            boolean force = getInputData().getBoolean(KEY_FORCE, false);
            JSONArray urls = readSavedManifest(setId);
            boolean ok = downloadManifest(setId, urls, force, "Collection " + setId, 1, 1);
            return ok ? Result.success() : Result.failure();
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return Result.retry();
        } catch (Exception e) {
            prefs.edit().putString("worker_error", String.valueOf(e.getMessage())).apply();
            return Result.retry();
        }
    }

    private Result downloadAll() throws Exception {
        String lang = getInputData().getString(KEY_LANG);
        if (lang == null || lang.isEmpty()) lang = "fr";
        boolean updateOnly = getInputData().getBoolean(KEY_UPDATE_ONLY, false);
        boolean force = updateOnly;
        JSONObject index = new JSONObject(readAsset("v111_collection_index.json"));
        JSONArray sets = index.optJSONArray("sets");
        if (sets == null) return Result.failure();

        int eligible = 0;
        for (int i = 0; i < sets.length(); i++) {
            JSONObject entry = sets.optJSONObject(i);
            if (entry == null) continue;
            String id = entry.optString("id", "");
            if (id.isEmpty()) continue;
            if (updateOnly && !prefs.getBoolean("pack_" + id, false)) continue;
            if (!updateOnly && prefs.getBoolean("pack_" + id, false)) continue;
            eligible++;
        }

        prefs.edit()
                .putBoolean("bulk_running", true)
                .putBoolean("bulk_update_only", updateOnly)
                .putInt("bulk_total", eligible)
                .putInt("bulk_done", 0)
                .putInt("bulk_failed", 0)
                .putLong("bulk_started_at", System.currentTimeMillis())
                .apply();

        int done = 0, failed = 0;
        for (int i = 0; i < sets.length(); i++) {
            if (isStopped()) break;
            JSONObject entry = sets.optJSONObject(i);
            if (entry == null) continue;
            String id = entry.optString("id", "");
            if (id.isEmpty()) continue;
            if (updateOnly && !prefs.getBoolean("pack_" + id, false)) continue;
            if (!updateOnly && prefs.getBoolean("pack_" + id, false)) continue;

            String name = entry.optString("name", id);
            String file = entry.optString("file", "");
            boolean ok;
            try {
                JSONObject payload = new JSONObject(readAsset("catalog/" + lang + "/" + file));
                JSONArray manifest = buildManifest(lang, id, payload);
                ok = downloadManifest(id, manifest, force, name, done + 1, Math.max(eligible, 1));
            } catch (Exception e) {
                ok = false;
                prefs.edit()
                        .putBoolean("pack_" + id, false)
                        .putString("pack_error_" + id, String.valueOf(e.getMessage()))
                        .putLong("pack_time_" + id, System.currentTimeMillis())
                        .apply();
            }
            done++;
            if (!ok) failed++;
            prefs.edit().putInt("bulk_done", done).putInt("bulk_failed", failed).apply();
            setForegroundAsync(foreground(
                    (updateOnly ? "Mise à jour" : "Téléchargement") + " · " + name,
                    done,
                    Math.max(eligible, 1)
            ));
        }

        boolean stopped = isStopped();
        prefs.edit()
                .putBoolean("bulk_running", false)
                .putInt("bulk_done", done)
                .putInt("bulk_failed", failed)
                .putLong("bulk_finished_at", System.currentTimeMillis())
                .apply();
        if (stopped) return Result.retry();
        return failed == 0 ? Result.success() : Result.failure();
    }

    /** Construit le manifeste réseau à partir du catalogue local généré au build. */
    private JSONArray buildManifest(String lang, String setId, JSONObject payload) throws Exception {
        Set<String> urls = new LinkedHashSet<>();
        JSONObject set = payload.optJSONObject("set");
        if (set != null) addAssetUrl(urls, set.optString("logo", ""), true);
        JSONArray cards = payload.optJSONArray("cards");
        int missing = 0;
        if (cards == null || cards.length() == 0) throw new Exception("Catalogue local vide");
        for (int i = 0; i < cards.length(); i++) {
            JSONObject card = cards.optJSONObject(i);
            if (card == null) continue;
            String id = card.optString("id", "");
            String localId = card.optString("localId", "");
            String image = card.optString("image", "");
            int n = parseCardNumber(localId);
            // Nuit Noire #075-089 possède ses scans FR directement dans l'APK.
            boolean bundledMe05 = "me05".equals(setId) && n >= 75 && n <= 89;
            if (!bundledMe05) {
                if (image.isEmpty()) missing++;
                else addAssetUrl(urls, image, false);
            }
            if (!id.isEmpty()) {
                urls.add(API_ROOT + "/" + lang + "/cards/" + encodePath(id));
            }
        }
        for (String energy : ENERGY_URLS) urls.add(energy);
        if (missing > 0) throw new Exception(missing + " scan(s) sans URL dans le catalogue");
        JSONArray out = new JSONArray();
        for (String url : urls) out.put(url);
        return out;
    }

    private void addAssetUrl(Set<String> out, String base, boolean logo) {
        String value = base == null ? "" : base.trim();
        if (!value.startsWith("https://")) return;
        String lower = value.toLowerCase(Locale.US);
        if (lower.matches(".*\\.(webp|png|jpe?g)(\\?.*)?$")) out.add(value);
        else out.add(value.replaceAll("/+$", "") + (logo ? ".webp" : "/high.webp"));
    }

    private int parseCardNumber(String value) {
        try {
            String head = String.valueOf(value).split("/", 2)[0].replaceFirst("^0+(?!$)", "");
            return Integer.parseInt(head);
        } catch (Exception ignored) {
            return -1;
        }
    }

    private String encodePath(String value) {
        try {
            return java.net.URLEncoder.encode(value, "UTF-8").replace("+", "%20");
        } catch (Exception e) {
            return value;
        }
    }

    private boolean downloadManifest(String setId, JSONArray urls, boolean force, String label, int setIndex, int setTotal) {
        int done = 0, failed = 0;
        long bytes = 0;
        int total = urls.length();
        prefs.edit()
                .putBoolean("pack_" + setId, false)
                .putString("pack_state_" + setId, "running")
                .putInt("pack_total_" + setId, total)
                .putInt("pack_done_" + setId, 0)
                .putInt("pack_failed_" + setId, 0)
                .remove("pack_error_" + setId)
                .apply();

        for (int i = 0; i < total; i++) {
            if (isStopped()) return false;
            String url = urls.optString(i, "");
            if (url.isEmpty()) {
                failed++;
                continue;
            }
            try {
                File target = cacheFileFor(url);
                if (force || !target.exists() || target.length() <= 0) downloadUrl(url, target);
                bytes += Math.max(0, target.length());
                done++;
            } catch (Exception e) {
                failed++;
                prefs.edit().putString("pack_error_" + setId, url + " · " + e.getMessage()).apply();
            }
            if (i % 3 == 0 || i == total - 1) {
                prefs.edit()
                        .putInt("pack_done_" + setId, done)
                        .putInt("pack_failed_" + setId, failed)
                        .putLong("pack_bytes_" + setId, bytes)
                        .apply();
                setForegroundAsync(foreground(
                        label + " · " + done + "/" + total + (failed > 0 ? " · " + failed + " erreur(s)" : ""),
                        setIndex,
                        Math.max(setTotal, 1)
                ));
            }
        }

        boolean installed = failed == 0 && done == total;
        prefs.edit()
                .putBoolean("pack_" + setId, installed)
                .putString("pack_state_" + setId, installed ? "installed" : "error")
                .putLong("pack_time_" + setId, System.currentTimeMillis())
                .putInt("pack_items_" + setId, done)
                .putInt("pack_total_" + setId, total)
                .putInt("pack_done_" + setId, done)
                .putInt("pack_failed_" + setId, failed)
                .putLong("pack_bytes_" + setId, bytes)
                .apply();
        return installed;
    }

    private JSONArray readSavedManifest(String setId) throws Exception {
        File file = new File(new File(getApplicationContext().getFilesDir(), "offline_manifests"), sha256(setId) + ".json");
        if (!file.isFile()) throw new Exception("Manifeste hors ligne absent");
        try (InputStream in = new FileInputStream(file)) {
            return new JSONArray(readFully(in));
        }
    }

    private String readAsset(String path) throws Exception {
        try (InputStream in = getApplicationContext().getAssets().open(path)) {
            return readFully(in);
        }
    }

    private String readFully(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[32768];
        int n;
        while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
        return out.toString("UTF-8");
    }

    private File cacheFileFor(String url) {
        File dir = new File(getApplicationContext().getFilesDir(), "offline_http");
        if (!dir.exists()) dir.mkdirs();
        return new File(dir, sha256(url) + ".cache");
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

    private void downloadUrl(String address, File target) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(address).openConnection();
        conn.setConnectTimeout(20000);
        conn.setReadTimeout(45000);
        conn.setInstanceFollowRedirects(true);
        conn.setRequestProperty("User-Agent", "VOX-CardSim/1.1 Android");
        conn.setRequestProperty("Accept", "image/avif,image/webp,image/png,image/jpeg,application/json,*/*");
        conn.connect();
        int code = conn.getResponseCode();
        if (code < 200 || code >= 300) {
            conn.disconnect();
            throw new Exception("HTTP " + code);
        }
        File tmp = new File(target.getAbsolutePath() + ".part");
        try (InputStream in = new BufferedInputStream(conn.getInputStream());
             BufferedOutputStream out = new BufferedOutputStream(new FileOutputStream(tmp))) {
            byte[] buffer = new byte[65536];
            int n;
            while ((n = in.read(buffer)) != -1) {
                if (isStopped()) throw new InterruptedException("Téléchargement annulé");
                out.write(buffer, 0, n);
            }
        }
        if (target.exists() && !target.delete()) throw new Exception("Impossible de remplacer le cache");
        if (!tmp.renameTo(target)) {
            try (InputStream in = new FileInputStream(tmp);
                 BufferedOutputStream out = new BufferedOutputStream(new FileOutputStream(target))) {
                byte[] buffer = new byte[65536];
                int n;
                while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            }
            if (!tmp.delete()) tmp.deleteOnExit();
        }
        prefs.edit().putString("mime_" + sha256(address), guessMime(address, conn.getContentType())).apply();
        conn.disconnect();
    }

    private String guessMime(String url, String stored) {
        if (stored != null && !stored.isEmpty()) return stored.split(";")[0].trim();
        String u = url.toLowerCase(Locale.US);
        if (u.contains(".webp")) return "image/webp";
        if (u.contains(".png")) return "image/png";
        if (u.contains(".jpg") || u.contains(".jpeg")) return "image/jpeg";
        if (u.contains("/cards/") || u.contains("/sets/")) return "application/json";
        return "application/octet-stream";
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getApplicationContext().getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL,
                    "Téléchargements hors ligne",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Téléchargement des collections VOX Card Sim même écran éteint");
            manager.createNotificationChannel(channel);
        }
    }

    private ForegroundInfo foreground(String text, int done, int total) {
        int percent = total > 0 ? Math.max(0, Math.min(100, (int) Math.round(done * 100.0 / total))) : 0;
        PendingIntent cancel = WorkManager.getInstance(getApplicationContext()).createCancelPendingIntent(getId());
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(getApplicationContext(), CHANNEL)
                : new Notification.Builder(getApplicationContext());
        builder.setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle("VOX Card Sim · hors ligne")
                .setContentText(text)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setProgress(Math.max(total, 1), Math.min(done, Math.max(total, 1)), total <= 0)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Annuler", cancel);
        if (total > 0) builder.setSubText(percent + "%");
        Notification notification = builder.build();
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC : 0;
        return new ForegroundInfo(NOTIFICATION_ID, notification, type);
    }
}
