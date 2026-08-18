package fr.vox.chronomarkplus;

import android.Manifest;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.lang.reflect.Method;
import java.util.Locale;

/** Chronomark+ v1.0.1 - native Music/Phone + stock Bethesda Weather GPS sync. */
public class MainActivityV101 extends MainActivityV100 {
    private static final int REQ_WEATHER_GPS = 1101;
    private int pendingGpsAction; // 1=start companion, 2=force weather
    private TextView weatherGpsStatus;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        patchV101Ui();
    }

    @Override protected void onResume() {
        super.onResume();
        refreshWeatherGpsStatus();
    }

    private void patchV101Ui() {
        View root = getWindow().getDecorView();
        TextView version = findContains(root, "v1.0.0 NATIVE");
        if (version != null) version.setText("MUSIC CONTROL+ / PHONE STATUS / v1.0.1 NATIVE");
        TextView safety = findContains(root, "NATIVE INSTALLER / BETHESDA FILES PRESERVED");
        if (safety != null) safety.setText("MUSIC+ / PHONE NATIFS + WEATHER BETHESDA ALIMENTE PAR LE GPS DU TELEPHONE");

        Button start = findButton(root, "ACTIVER LE COMPANION NATIF EN ARRIERE-PLAN");
        if (start != null) {
            start.setText("ACTIVER COMPANION NATIF + GPS WEATHER");
            start.setOnClickListener(v -> startCompanionWithGps());
        }

        TextView logTitle = findContains(root, "LIVE BRIDGE LOG");
        if (logTitle != null && logTitle.getParent() instanceof ViewGroup) {
            ViewGroup parent = (ViewGroup) logTitle.getParent();
            int at = parent.indexOfChild(logTitle);
            TextView section = text("WEATHER BETHESDA / POSITION GPS REELLE", 11, 0xFFA4A9A7);
            section.setPadding(0, dp(14), 0, dp(4));
            parent.addView(section, at++);
            weatherGpsStatus = text("En attente du premier fix GPS...", 12, 0xFF7AC6BE);
            weatherGpsStatus.setPadding(dp(10), dp(8), dp(10), dp(8));
            weatherGpsStatus.setBackgroundColor(0xFF1B2226);
            parent.addView(weatherGpsStatus, at++);
            Button force = button("METTRE A JOUR WEATHER / GPS MAINTENANT");
            force.setOnClickListener(v -> forceWeatherGps());
            parent.addView(force, at, lp(dp(48)));
        }
        refreshWeatherGpsStatus();
    }

    private void startCompanionWithGps() {
        if (!hasLocationPermission()) {
            pendingGpsAction = 1;
            requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION}, REQ_WEATHER_GPS);
            if (weatherGpsStatus != null) weatherGpsStatus.setText("Autorise la localisation : elle sert uniquement a alimenter Weather Bethesda.");
            return;
        }
        invokeParentStartCompanion();
        sendWeatherServiceIntent(false);
        if (weatherGpsStatus != null) weatherGpsStatus.setText("GPS actif / recherche d'une position fraiche...");
    }

    private void forceWeatherGps() {
        if (!hasLocationPermission()) {
            pendingGpsAction = 2;
            requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION}, REQ_WEATHER_GPS);
            return;
        }
        sendWeatherServiceIntent(true);
        if (weatherGpsStatus != null) weatherGpsStatus.setText("Synchronisation forcee / acquisition GPS...");
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_WEATHER_GPS) return;
        int action = pendingGpsAction;
        pendingGpsAction = 0;
        if (hasLocationPermission()) {
            if (action == 1) startCompanionWithGps();
            else if (action == 2) forceWeatherGps();
        } else {
            if (weatherGpsStatus != null) weatherGpsStatus.setText("GPS refuse : Music+ et Phone restent utilisables, Weather ne sera pas actualise.");
            if (action == 1) invokeParentStartCompanion();
        }
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void sendWeatherServiceIntent(boolean force) {
        Intent i = new Intent(this, ChronomarkNativeService.class);
        i.putExtra(ChronomarkNativeService.EXTRA_ENABLE_WEATHER, true);
        if (force) i.setAction(ChronomarkNativeService.ACTION_WEATHER_NOW);
        try {
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i);
        } catch (Exception e) {
            Toast.makeText(this, "Weather GPS: " + e.getClass().getSimpleName(), Toast.LENGTH_LONG).show();
        }
    }

    private void invokeParentStartCompanion() {
        try {
            Method m = MainActivityV100.class.getDeclaredMethod("startNativeCompanion");
            m.setAccessible(true);
            m.invoke(this);
        } catch (Exception e) {
            Toast.makeText(this, "Companion: " + e.getClass().getSimpleName(), Toast.LENGTH_LONG).show();
        }
    }

    private void refreshWeatherGpsStatus() {
        if (weatherGpsStatus == null) return;
        SharedPreferences p = getSharedPreferences(ChronomarkNativeService.PREFS, MODE_PRIVATE);
        String place = p.getString(WeatherSyncEngine.KEY_WEATHER_PLACE, "");
        long when = p.getLong(WeatherSyncEngine.KEY_WEATHER_SYNC_TIME, 0L);
        float accuracy = p.getFloat(WeatherSyncEngine.KEY_WEATHER_ACCURACY, -1f);
        if (place.isEmpty() || when <= 0) {
            weatherGpsStatus.setText(hasLocationPermission() ?
                    "Aucune synchro encore. Active le companion ou force une mise a jour." :
                    "Autorisation GPS requise pour remplacer l'ancienne position Venezia.");
        } else {
            long ageMin = Math.max(0, (System.currentTimeMillis() - when) / 60_000L);
            String acc = accuracy >= 0 ? " / +/-" + Math.round(accuracy) + " m" : "";
            weatherGpsStatus.setText(String.format(Locale.FRANCE, "Derniere synchro : %s%s / il y a %d min", place, acc, ageMin));
        }
    }

    private TextView findContains(View root, String needle) {
        if (root instanceof TextView) {
            CharSequence s = ((TextView) root).getText();
            if (s != null && s.toString().contains(needle)) return (TextView) root;
        }
        if (root instanceof ViewGroup) {
            ViewGroup g = (ViewGroup) root;
            for (int i = 0; i < g.getChildCount(); i++) {
                TextView t = findContains(g.getChildAt(i), needle);
                if (t != null) return t;
            }
        }
        return null;
    }

    private Button findButton(View root, String needle) {
        TextView v = findContains(root, needle);
        return v instanceof Button ? (Button) v : null;
    }

    private TextView text(String s, int sp, int color) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(color);
        return t;
    }

    private Button button(String s) {
        Button b = new Button(this);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextSize(10);
        return b;
    }

    private LinearLayout.LayoutParams lp(int h) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, h);
        p.setMargins(0, dp(3), 0, dp(3));
        return p;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
