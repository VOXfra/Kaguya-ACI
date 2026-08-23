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
 * V1.2.5 — téléchargements de scans hors ligne finis et reprenables.
 *
 * Le catalogue, la collation et les métadonnées sont déjà dans l'APK. Une panne de
 * CDN ne doit donc jamais mettre WorkManager dans une boucle de retry ni rendre une
 * collection inutilisable. Les scans manquants restent simplement à compléter.
 */
public final class OfflinePackWorker extends Worker {
    public static final String KEY_SET_ID = "set_id";
    public static final String KEY_FORCE = "force";
    public static final String KEY_ALL = "all";
    public static final String KEY_UPDATE_ONLY = "update_only";
    public static final String KEY_LANG = "lang";

    private static final String CHANNEL = "offline_downloads";
    private static final int NOTIFICATION_ID = 12011;
    private final SharedPreferences prefs;

    private static final class ManifestInfo {
        final JSONArray urls;
        final int sourceMissing;
        ManifestInfo(JSONArray urls, int sourceMissing) {
            this.urls = urls;
            this.sourceMissing = Math.max(0, sourceMissing);
        }
    }

    public OfflinePackWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
        prefs = context.getSharedPreferences("vox_offline", Context.MODE_PRIVATE);
    }

    @NonNull
    @Override
    public Result doWork() {
        ensureChannel();
        try {
            setForegroundAsync(foreground("Préparation…", 0, 0)).get();
            return getInputData().getBoolean(KEY_ALL, false) ? downloadAll() : downloadOne();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Result.failure();
        } catch (Exception e) {
            prefs.edit().putString("worker_error", safeMessage(e)).apply();
            return Result.failure();
        }
    }

    private Result downloadOne() throws Exception {
        String setId = getInputData().getString(KEY_SET_ID);
        if (setId == null || setId.trim().isEmpty()) return Result.failure();
        JSONObject entry = findEntry(index(), setId);
        if (entry == null) return Result.failure();
        try {
            JSONObject payload = payload(language(), entry);
            ManifestInfo manifest = buildManifest(setId, payload);
            downloadManifest(
                    setId,
                    manifest,
                    getInputData().getBoolean(KEY_FORCE, false) || needsCatalogUpdate(entry),
                    entry.optString("name", setId),
                    entry.optString("contentHash", ""),
                    1,
                    1
            );
            // Les données locales sont valides : les éventuels scans ratés sont un
            // état partiel à compléter, pas un échec WorkManager à relancer en boucle.
            return Result.success();
        } catch (Exception e) {
            prefs.edit()
                    .putBoolean("pack_" + setId, false)
                    .putString("pack_state_" + setId, "error")
                    .putString("pack_error_" + setId, "Catalogue local : " + safeMessage(e))
                    .putLong("pack_time_" + setId, System.currentTimeMillis())
                    .apply();
            return Result.failure();
        }
    }

    private Result downloadAll() throws Exception {
        String lang = language();
        boolean updateOnly = getInputData().getBoolean(KEY_UPDATE_ONLY, false);
        JSONArray sets = index().optJSONArray("sets");
        if (sets == null) return Result.failure();

        int eligible = 0;
        for (int i = 0; i < sets.length(); i++) {
            JSONObject entry = sets.optJSONObject(i);
            if (entry != null && eligible(entry, updateOnly)) eligible++;
        }
        prefs.edit()
                .putBoolean("bulk_running", true)
                .putBoolean("bulk_update_only", updateOnly)
                .putInt("bulk_total", eligible)
                .putInt("bulk_done", 0)
                .putInt("bulk_failed", 0)
                .putLong("bulk_started_at", System.currentTimeMillis())
                .apply();

        int done = 0;
        int localFailures = 0;
        for (int i = 0; i < sets.length() && !isStopped(); i++) {
            JSONObject entry = sets.optJSONObject(i);
            if (entry == null || !eligible(entry, updateOnly)) continue;
            String id = entry.optString("id", "");
            String name = entry.optString("name", id);
            try {
                JSONObject payload = payload(lang, entry);
                downloadManifest(
                        id,
                        buildManifest(id, payload),
                        needsCatalogUpdate(entry),
                        name,
                        entry.optString("contentHash", ""),
                        done + 1,
                        Math.max(eligible, 1)
                );
            } catch (Exception e) {
                localFailures++;
                prefs.edit()
                        .putBoolean("pack_" + id, false)
                        .putString("pack_state_" + id, "error")
                        .putString("pack_error_" + id, "Catalogue local : " + safeMessage(e))
                        .putLong("pack_time_" + id, System.currentTimeMillis())
                        .apply();
            }
            done++;
            prefs.edit().putInt("bulk_done", done).putInt("bulk_failed", localFailures).apply();
            setForegroundAsync(foreground(
                    (updateOnly ? "Mise à jour" : "Téléchargement") + " · " + name,
                    done,
                    Math.max(eligible, 1)
            ));
        }

        prefs.edit()
                .putBoolean("bulk_running", false)
                .putInt("bulk_done", done)
                .putInt("bulk_failed", localFailures)
                .putLong("bulk_finished_at", System.currentTimeMillis())
                .apply();
        return localFailures == 0 ? Result.success() : Result.failure();
    }

    private String language() {
        String lang = getInputData().getString(KEY_LANG);
        return lang == null || lang.trim().isEmpty() ? "fr" : lang.trim().toLowerCase(Locale.US);
    }

    private boolean eligible(JSONObject entry, boolean updateOnly) {
        String id = entry.optString("id", "");
        if (id.isEmpty()) return false;
        String status = entry.optString("status", "ready").toLowerCase(Locale.US);
        if ("failed".equals(status) || "error".equals(status)) return false;
        // Même une source 100 % sans scans peut être marquée "partielle" : le JSON
        // local reste utile et le worker doit pouvoir enregistrer cet état proprement.
        boolean installed = prefs.getBoolean("pack_" + id, false);
        boolean retryable = prefs.getBoolean("pack_retryable_" + id, false);
        if (updateOnly) return installed && (needsCatalogUpdate(entry) || retryable);
        return !installed || needsCatalogUpdate(entry) || retryable;
    }

    private boolean needsCatalogUpdate(JSONObject entry) {
        String id = entry.optString("id", "");
        if (id.isEmpty() || !prefs.getBoolean("pack_" + id, false)) return false;
        String current = entry.optString("contentHash", "");
        String installed = prefs.getString("pack_catalog_hash_" + id, "");
        return !current.isEmpty() && !current.equals(installed);
    }

    private JSONObject index() throws Exception {
        return new JSONObject(readAsset("v111_collection_index.json"));
    }

    private JSONObject findEntry(JSONObject index, String id) {
        JSONArray sets = index.optJSONArray("sets");
        if (sets == null) return null;
        for (int i = 0; i < sets.length(); i++) {
            JSONObject entry = sets.optJSONObject(i);
            if (entry != null && id.equals(entry.optString("id", ""))) return entry;
        }
        return null;
    }

    private JSONObject payload(String lang, JSONObject entry) throws Exception {
        String file = entry.optString("file", "");
        if (file.isEmpty()) throw new Exception("Fichier catalogue absent");
        JSONObject payload = new JSONObject(readAsset("catalog/" + lang + "/" + file));
        String expected = entry.optString("contentHash", "");
        String got = payload.optString("contentHash", "");
        if (!expected.isEmpty() && !expected.equals(got)) throw new Exception("Catalogue local incohérent");
        JSONArray cards = payload.optJSONArray("cards");
        if (cards == null || cards.length() == 0) throw new Exception("Catalogue local vide");
        return payload;
    }

    private ManifestInfo buildManifest(String setId, JSONObject payload) throws Exception {
        Set<String> urls = new LinkedHashSet<>();
        JSONArray cards = payload.optJSONArray("cards");
        if (cards == null || cards.length() == 0) throw new Exception("Catalogue local vide");
        int missing = 0;
        for (int i = 0; i < cards.length(); i++) {
            JSONObject card = cards.optJSONObject(i);
            if (card == null) continue;
            int n = parseCardNumber(card.optString("localId", ""));
            if ("me05".equals(setId) && n >= 75 && n <= 89) continue; // scans APK
            String image = card.optString("image", "");
            if (image.isEmpty()) {
                missing++;
                continue;
            }
            addAssetUrl(urls, image, false);
        }
        // Le logo passe en dernier : un CDN de logo lent ne peut plus donner
        // l'impression que le pack entier reste bloqué à 0/N.
        JSONObject set = payload.optJSONObject("set");
        if (set != null) addAssetUrl(urls, set.optString("logo", ""), true);
        JSONArray out = new JSONArray();
        for (String url : urls) out.put(url);
        return new ManifestInfo(out, missing);
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

    private void downloadManifest(
            String setId,
            ManifestInfo manifest,
            boolean force,
            String label,
            String contentHash,
            int setIndex,
            int setTotal
    ) {
        JSONArray urls = manifest.urls;
        int total = urls.length();
        int done = 0;
        int failed = 0;
        int attempted = 0;
        int consecutiveFailures = 0;
        long bytes = 0;
        String lastError = "";
        long started = System.currentTimeMillis();

        prefs.edit()
                .putBoolean("pack_" + setId, true) // le JSON local est déjà utilisable
                .putString("pack_state_" + setId, "running")
                .putLong("pack_started_at_" + setId, started)
                .putLong("pack_heartbeat_" + setId, started)
                .putInt("pack_total_" + setId, total)
                .putInt("pack_done_" + setId, 0)
                .putInt("pack_attempted_" + setId, 0)
                .putInt("pack_failed_" + setId, 0)
                .putInt("pack_source_missing_" + setId, manifest.sourceMissing)
                .putBoolean("pack_retryable_" + setId, false)
                .remove("pack_error_" + setId)
                .apply();

        for (int i = 0; i < total; i++) {
            if (isStopped()) {
                failed += Math.max(0, total - attempted);
                lastError = "Téléchargement interrompu";
                break;
            }
            String url = urls.optString(i, "");
            if (url.isEmpty()) continue;
            attempted++;
            prefs.edit()
                    .putInt("pack_attempted_" + setId, attempted)
                    .putLong("pack_heartbeat_" + setId, System.currentTimeMillis())
                    .apply();
            try {
                File target = cacheFileFor(url);
                if (force || !target.exists() || target.length() <= 0) downloadUrlSmart(url, target);
                if (!target.exists() || target.length() <= 0) throw new Exception("fichier vide");
                bytes += target.length();
                done++;
                consecutiveFailures = 0;
            } catch (Exception e) {
                failed++;
                consecutiveFailures++;
                lastError = safeMessage(e);
            }
            prefs.edit()
                    .putInt("pack_done_" + setId, done)
                    .putInt("pack_attempted_" + setId, attempted)
                    .putInt("pack_failed_" + setId, failed)
                    .putLong("pack_bytes_" + setId, bytes)
                    .putLong("pack_heartbeat_" + setId, System.currentTimeMillis())
                    .apply();

            setForegroundAsync(foreground(
                    label + " · " + attempted + "/" + total + (failed > 0 ? " · " + failed + " à compléter" : ""),
                    setIndex,
                    Math.max(setTotal, 1)
            ));

            // Si le CDN entier est indisponible, on ne bloque pas Android pendant
            // des dizaines de minutes à essayer 100+ URL qui échoueront pareil.
            if (consecutiveFailures >= 3 && done == 0) {
                failed += Math.max(0, total - attempted);
                lastError = "CDN indisponible · réessaie plus tard";
                break;
            }
        }

        boolean complete = failed == 0 && manifest.sourceMissing == 0;
        boolean retryable = failed > 0;
        String state = complete ? "installed" : "partial";
        StringBuilder note = new StringBuilder();
        if (manifest.sourceMissing > 0) {
            note.append(manifest.sourceMissing).append(" scan(s) absent(s) de la source");
        }
        if (failed > 0) {
            if (note.length() > 0) note.append(" · ");
            note.append(failed).append(" scan(s) à compléter");
            if (!lastError.isEmpty()) note.append(" · ").append(lastError);
        }

        SharedPreferences.Editor editor = prefs.edit()
                .putBoolean("pack_" + setId, true)
                .putString("pack_state_" + setId, state)
                .putBoolean("pack_retryable_" + setId, retryable)
                .putLong("pack_time_" + setId, System.currentTimeMillis())
                .putLong("pack_heartbeat_" + setId, System.currentTimeMillis())
                .putInt("pack_items_" + setId, done)
                .putInt("pack_total_" + setId, total)
                .putInt("pack_done_" + setId, done)
                .putInt("pack_attempted_" + setId, attempted)
                .putInt("pack_failed_" + setId, failed)
                .putInt("pack_source_missing_" + setId, manifest.sourceMissing)
                .putLong("pack_bytes_" + setId, bytes);
        if (contentHash != null && !contentHash.isEmpty()) editor.putString("pack_catalog_hash_" + setId, contentHash);
        if (note.length() > 0) editor.putString("pack_error_" + setId, note.toString());
        else editor.remove("pack_error_" + setId);
        editor.apply();
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

    private String safeMessage(Exception e) {
        if (e == null || e.getMessage() == null || e.getMessage().trim().isEmpty()) return "Erreur réseau";
        return e.getMessage().trim();
    }

    private void downloadUrlSmart(String original, File target) throws Exception {
        Exception first;
        try {
            downloadUrlOnce(original, target, original);
            return;
        } catch (Exception e) {
            first = e;
        }
        String fallback = lowResolutionFallback(original);
        if (!fallback.equals(original)) {
            try {
                // Le contenu basse résolution est volontairement stocké sous la clé
                // du scan HD demandé : hors ligne, cardImg() retrouve ainsi l'image.
                downloadUrlOnce(fallback, target, original);
                return;
            } catch (Exception ignored) {}
        } else {
            try {
                downloadUrlOnce(original, target, original);
                return;
            } catch (Exception ignored) {}
        }
        throw first;
    }

    private String lowResolutionFallback(String url) {
        String value = String.valueOf(url);
        return value.replace("/high.webp", "/low.webp");
    }

    private void downloadUrlOnce(String address, File target, String cacheKeyUrl) throws Exception {
        HttpURLConnection conn = null;
        File tmp = new File(target.getAbsolutePath() + ".part");
        try {
            conn = (HttpURLConnection) new URL(address).openConnection();
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(12000);
            conn.setInstanceFollowRedirects(true);
            conn.setRequestProperty("User-Agent", "VOX-CardSim/1.2.5 Android");
            conn.setRequestProperty("Accept", "image/webp,image/png,image/jpeg,*/*");
            conn.connect();
            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) throw new Exception("HTTP " + code);
            String type = conn.getContentType();
            if (type != null && type.toLowerCase(Locale.US).startsWith("text/")) throw new Exception("Réponse non-image");

            if (tmp.exists()) tmp.delete();
            try (InputStream in = new BufferedInputStream(conn.getInputStream());
                 BufferedOutputStream out = new BufferedOutputStream(new FileOutputStream(tmp))) {
                byte[] buffer = new byte[65536];
                int n;
                while ((n = in.read(buffer)) != -1) {
                    if (isStopped()) throw new InterruptedException("Téléchargement annulé");
                    out.write(buffer, 0, n);
                }
            }
            if (!tmp.exists() || tmp.length() < 128) throw new Exception("Fichier image invalide");
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
            prefs.edit().putString("mime_" + sha256(cacheKeyUrl), guessMime(address, type)).apply();
        } finally {
            if (conn != null) conn.disconnect();
            if (tmp.exists() && (!target.exists() || target.length() <= 0)) tmp.delete();
        }
    }

    private String guessMime(String url, String stored) {
        if (stored != null && !stored.isEmpty()) return stored.split(";")[0].trim();
        String u = url.toLowerCase(Locale.US);
        if (u.contains(".webp")) return "image/webp";
        if (u.contains(".png")) return "image/png";
        if (u.contains(".jpg") || u.contains(".jpeg")) return "image/jpeg";
        return "application/octet-stream";
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getApplicationContext().getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Téléchargements hors ligne", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Téléchargement des collections même écran éteint");
            manager.createNotificationChannel(channel);
        }
    }

    private ForegroundInfo foreground(String text, int done, int total) {
        int safeTotal = Math.max(total, 1);
        int safeDone = Math.max(0, Math.min(done, safeTotal));
        int percent = total > 0 ? (int) Math.round(safeDone * 100.0 / safeTotal) : 0;
        PendingIntent cancel = WorkManager.getInstance(getApplicationContext()).createCancelPendingIntent(getId());
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(getApplicationContext(), CHANNEL)
                : new Notification.Builder(getApplicationContext());
        builder.setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle("VOX Card Sim · hors ligne")
                .setContentText(text)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setProgress(safeTotal, safeDone, total <= 0)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Annuler", cancel);
        if (total > 0) builder.setSubText(percent + "%");
        Notification notification = builder.build();
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC : 0;
        return new ForegroundInfo(NOTIFICATION_ID, notification, type);
    }
}
