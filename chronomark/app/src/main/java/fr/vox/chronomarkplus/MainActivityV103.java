package fr.vox.chronomarkplus;

import android.Manifest;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

/** Chronomark+ v1.0.3 - passive companion setup. */
public class MainActivityV103 extends MainActivityV101 {
    private static final int REQ_BG_LOCATION = 1103;
    private TextView passiveStatus;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        addPassiveUi();
    }

    @Override protected void onResume() {
        super.onResume();
        refreshPassiveStatus();
    }

    private void addPassiveUi() {
        View root = getWindow().getDecorView();
        TextView version = findContains(root, "v1.0.1 NATIVE");
        if (version != null) version.setText("MUSIC CONTROL+ / PHONE STATUS / v1.0.3 PASSIVE");

        TextView logTitle = findContains(root, "LIVE BRIDGE LOG");
        if (logTitle != null && logTitle.getParent() instanceof ViewGroup) {
            ViewGroup parent = (ViewGroup) logTitle.getParent();
            int at = parent.indexOfChild(logTitle);

            TextView section = text("MODE PASSIF / APPLI FERMEE", 11, 0xFFA4A9A7);
            section.setPadding(0, dp(14), 0, dp(4));
            parent.addView(section, at++);

            passiveStatus = text("Verification du companion...", 12, 0xFF7AC6BE);
            passiveStatus.setPadding(dp(10), dp(8), dp(10), dp(8));
            passiveStatus.setBackgroundColor(0xFF1B2226);
            parent.addView(passiveStatus, at++);

            Button passive = button("ACTIVER MODE PASSIF COMPLET");
            passive.setOnClickListener(v -> enablePassiveMode());
            parent.addView(passive, at++, lp(dp(50)));

            Button loc = button("LOCALISATION EN ARRIERE-PLAN / PARAMETRES");
            loc.setOnClickListener(v -> openAppSettings());
            parent.addView(loc, at, lp(dp(46)));
        }
        refreshPassiveStatus();
    }

    private void enablePassiveMode() {
        SharedPreferences p = getSharedPreferences(ChronomarkNativeService.PREFS, MODE_PRIVATE);
        String mac = p.getString(ChronomarkNativeService.KEY_MAC, "");
        if (mac.isEmpty()) {
            Toast.makeText(this, "Active d'abord le companion natif une fois avec la montre connectee.", Toast.LENGTH_LONG).show();
            return;
        }

        p.edit().putBoolean("passive_mode", true).apply();
        Intent service = new Intent(this, ChronomarkNativeService.class);
        service.putExtra(ChronomarkNativeService.EXTRA_ENABLE_WEATHER, true);
        try {
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(service); else startService(service);
        } catch (Exception e) {
            Toast.makeText(this, "Companion passif: " + e.getClass().getSimpleName(), Toast.LENGTH_LONG).show();
        }

        if (!hasBackgroundLocation()) {
            if (Build.VERSION.SDK_INT == 29) {
                requestPermissions(new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION}, REQ_BG_LOCATION);
            } else if (Build.VERSION.SDK_INT >= 30) {
                Toast.makeText(this,
                        "Pour Weather en permanence: Parametres > Autorisations > Localisation > Toujours autoriser.",
                        Toast.LENGTH_LONG).show();
                openAppSettings();
            }
        }
        refreshPassiveStatus();
    }

    private boolean hasBackgroundLocation() {
        if (Build.VERSION.SDK_INT < 29) return true;
        return checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void openAppSettings() {
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + getPackageName()));
            startActivity(i);
        } catch (Exception e) {
            Toast.makeText(this, "Impossible d'ouvrir les parametres Android.", Toast.LENGTH_LONG).show();
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_BG_LOCATION) refreshPassiveStatus();
    }

    private void refreshPassiveStatus() {
        if (passiveStatus == null) return;
        SharedPreferences p = getSharedPreferences(ChronomarkNativeService.PREFS, MODE_PRIVATE);
        boolean nativeEnabled = p.getBoolean(ChronomarkNativeService.KEY_NATIVE_ENABLED, false);
        boolean passive = p.getBoolean("passive_mode", false);
        String state = p.getString(ChronomarkNativeService.KEY_SERVICE_STATE, "stopped");
        boolean bgLoc = hasBackgroundLocation();
        if (!nativeEnabled) {
            passiveStatus.setText("Companion non active. Connecte la montre puis active le companion natif.");
        } else if (!passive) {
            passiveStatus.setText("Companion actif / mode passif complet non configure.");
        } else if (!bgLoc) {
            passiveStatus.setText("PASSIF BLE ACTIF / Weather apres redemarrage exige Localisation > Toujours autoriser.");
        } else {
            passiveStatus.setText("PASSIF COMPLET ACTIF / BLE + Music + Phone + Weather / service: " + state.toUpperCase());
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
