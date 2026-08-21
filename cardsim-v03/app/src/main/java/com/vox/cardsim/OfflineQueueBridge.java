package com.vox.cardsim;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.JavascriptInterface;

import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

/** Pont WebView dédié aux téléchargements hors ligne persistants V1.1. */
public final class OfflineQueueBridge {
    private static final String AUTO_WORK = "vox-offline-auto-update";
    private final Activity activity;
    private final Context appContext;
    private final SharedPreferences prefs;
    private final WorkManager workManager;

    public OfflineQueueBridge(Activity activity) {
        this.activity = activity;
        this.appContext = activity.getApplicationContext();
        this.prefs = appContext.getSharedPreferences("vox_offline", Context.MODE_PRIVATE);
        this.workManager = WorkManager.getInstance(appContext);
        refreshAutoSchedule();
    }

    @JavascriptInterface
    public void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33
                && activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            activity.runOnUiThread(() -> activity.requestPermissions(
                    new String[]{Manifest.permission.POST_NOTIFICATIONS}, 407));
        }
    }

    /**
     * Lit un fichier JSON du catalogue directement depuis les assets de l'APK.
     *
     * Le runtime V1.1 charge les vieilles collections à la demande pour ne pas
     * garder 20 000+ cartes en RAM. `fetch(file:///android_asset/...)` n'est pas
     * fiable selon les versions de WebView ; ce pont supprime cette dépendance.
     * Les deux paramètres sont strictement validés afin qu'aucun chemin arbitraire
     * des assets Android ne puisse être lu depuis JavaScript.
     */
    @JavascriptInterface
    public String readCatalogFile(String lang, String fileName) {
        try {
            String language = lang == null ? "" : lang.trim().toLowerCase(Locale.US);
            String file = fileName == null ? "" : fileName.trim();
            if (!language.matches("^[a-z]{2}(?:-[a-z]{2})?$")) return "";
            if (!file.matches("^[A-Za-z0-9._-]+\\.json$")) return "";

            String assetPath = "catalog/" + language + "/" + file;
            try (InputStream in = appContext.getAssets().open(assetPath);
                 ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[16384];
                int n;
                while ((n = in.read(buffer)) != -1) {
                    out.write(buffer, 0, n);
                    if (out.size() > 8 * 1024 * 1024) return "";
                }
                return out.toString("UTF-8");
            }
        } catch (Exception e) {
            return "";
        }
    }

    @JavascriptInterface
    public void downloadPack(String setId, String urlsJson, boolean force) {
        try {
            if (setId == null || setId.trim().isEmpty()) return;
            new JSONArray(urlsJson); // refuse un manifeste tronqué avant mise en file
            File dir = new File(appContext.getFilesDir(), "offline_manifests");
            if (!dir.exists() && !dir.mkdirs()) throw new Exception("Dossier de manifestes inaccessible");
            File target = new File(dir, sha256(setId) + ".json");
            try (FileOutputStream out = new FileOutputStream(target, false)) {
                out.write(urlsJson.getBytes("UTF-8"));
                out.flush();
            }
            prefs.edit()
                    .putString("pack_state_" + setId, "queued")
                    .putInt("pack_done_" + setId, 0)
                    .putInt("pack_failed_" + setId, 0)
                    .remove("pack_error_" + setId)
                    .apply();

            Constraints constraints = networkConstraints();
            Data input = new Data.Builder()
                    .putString(OfflinePackWorker.KEY_SET_ID, setId)
                    .putString(OfflinePackWorker.KEY_LANG, "fr")
                    .putBoolean(OfflinePackWorker.KEY_FORCE, force)
                    .build();
            OneTimeWorkRequest work = new OneTimeWorkRequest.Builder(OfflinePackWorker.class)
                    .setConstraints(constraints)
                    .setInputData(input)
                    .addTag("vox-offline")
                    .addTag("vox-offline-" + setId)
                    .build();
            workManager.enqueueUniqueWork("vox-offline-pack-" + sha256(setId), ExistingWorkPolicy.REPLACE, work);
        } catch (Exception e) {
            prefs.edit()
                    .putString("pack_state_" + setId, "error")
                    .putString("pack_error_" + setId, String.valueOf(e.getMessage()))
                    .apply();
        }
    }

    @JavascriptInterface
    public void downloadAll(String lang, boolean updateOnly) {
        enqueueAll(lang, updateOnly, true);
    }

    private void enqueueAll(String lang, boolean updateOnly, boolean replace) {
        String language = (lang == null || lang.trim().isEmpty()) ? "fr" : lang.trim().toLowerCase(Locale.US);
        prefs.edit()
                .putBoolean("bulk_running", true)
                .putBoolean("bulk_update_only", updateOnly)
                .putInt("bulk_done", 0)
                .putInt("bulk_failed", 0)
                .putLong("bulk_started_at", System.currentTimeMillis())
                .apply();
        Data input = new Data.Builder()
                .putBoolean(OfflinePackWorker.KEY_ALL, true)
                .putBoolean(OfflinePackWorker.KEY_UPDATE_ONLY, updateOnly)
                .putString(OfflinePackWorker.KEY_LANG, language)
                .build();
        OneTimeWorkRequest work = new OneTimeWorkRequest.Builder(OfflinePackWorker.class)
                .setConstraints(networkConstraints())
                .setInputData(input)
                .addTag("vox-offline")
                .addTag("vox-offline-all")
                .build();
        workManager.enqueueUniqueWork(
                "vox-offline-all",
                replace ? ExistingWorkPolicy.REPLACE : ExistingWorkPolicy.KEEP,
                work
        );
    }

    @JavascriptInterface
    public boolean autoUpdateEnabled() {
        return prefs.getBoolean("auto_update", false);
    }

    @JavascriptInterface
    public void setAutoUpdate(boolean enabled) {
        prefs.edit().putBoolean("auto_update", enabled).apply();
        refreshAutoSchedule();
        if (enabled) {
            requestNotificationPermission();
            // Premier contrôle immédiatement ; les suivants sont quotidiens.
            enqueueAll("fr", true, false);
        }
    }

    private void refreshAutoSchedule() {
        if (!prefs.getBoolean("auto_update", false)) {
            workManager.cancelUniqueWork(AUTO_WORK);
            return;
        }
        Data input = new Data.Builder()
                .putBoolean(OfflinePackWorker.KEY_ALL, true)
                .putBoolean(OfflinePackWorker.KEY_UPDATE_ONLY, true)
                .putString(OfflinePackWorker.KEY_LANG, "fr")
                .build();
        PeriodicWorkRequest periodic = new PeriodicWorkRequest.Builder(OfflinePackWorker.class, 24, TimeUnit.HOURS)
                .setConstraints(networkConstraints())
                .setInputData(input)
                .addTag("vox-offline")
                .addTag("vox-offline-auto")
                .build();
        workManager.enqueueUniquePeriodicWork(AUTO_WORK, ExistingPeriodicWorkPolicy.UPDATE, periodic);
    }

    private Constraints networkConstraints() {
        // CONNECTED autorise Wi-Fi et données mobiles. L'utilisateur peut toujours
        // couper les mises à jour auto ; les transferts restent reprenables par Android.
        return new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
    }

    @JavascriptInterface
    public String packStatus(String setId) {
        try {
            JSONObject o = new JSONObject();
            o.put("installed", prefs.getBoolean("pack_" + setId, false));
            o.put("state", prefs.getString("pack_state_" + setId, "idle"));
            o.put("completedAt", prefs.getLong("pack_time_" + setId, 0));
            o.put("items", prefs.getInt("pack_items_" + setId, 0));
            o.put("done", prefs.getInt("pack_done_" + setId, 0));
            o.put("total", prefs.getInt("pack_total_" + setId, 0));
            o.put("failed", prefs.getInt("pack_failed_" + setId, 0));
            o.put("bytes", prefs.getLong("pack_bytes_" + setId, 0));
            o.put("catalogHash", prefs.getString("pack_catalog_hash_" + setId, ""));
            o.put("error", prefs.getString("pack_error_" + setId, ""));
            return o.toString();
        } catch (Exception e) {
            return "{}";
        }
    }

    @JavascriptInterface
    public String bulkStatus() {
        try {
            JSONObject o = new JSONObject();
            o.put("running", prefs.getBoolean("bulk_running", false));
            o.put("updateOnly", prefs.getBoolean("bulk_update_only", false));
            o.put("done", prefs.getInt("bulk_done", 0));
            o.put("total", prefs.getInt("bulk_total", 0));
            o.put("failed", prefs.getInt("bulk_failed", 0));
            o.put("startedAt", prefs.getLong("bulk_started_at", 0));
            o.put("finishedAt", prefs.getLong("bulk_finished_at", 0));
            return o.toString();
        } catch (Exception e) {
            return "{}";
        }
    }

    @JavascriptInterface
    public void cancelAll() {
        workManager.cancelAllWorkByTag("vox-offline");
        prefs.edit().putBoolean("bulk_running", false).apply();
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
}
