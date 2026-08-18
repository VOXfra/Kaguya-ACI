package fr.vox.chronomarkplus;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

/** Restarts the native companion after a phone reboot/app update when the user enabled passive mode. */
public class ChronomarkBootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        SharedPreferences p = context.getSharedPreferences(ChronomarkNativeService.PREFS, Context.MODE_PRIVATE);
        if (!p.getBoolean(ChronomarkNativeService.KEY_NATIVE_ENABLED, false)) return;

        Intent service = new Intent(context, ChronomarkNativeService.class);
        service.putExtra("background_restart", true);
        service.putExtra(ChronomarkNativeService.EXTRA_ENABLE_WEATHER,
                p.getBoolean(ChronomarkNativeService.KEY_WEATHER_ENABLED, false));
        try {
            if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(service);
            else context.startService(service);
        } catch (Exception ignored) {
            // Android may defer background starts in exceptional system states.
            // START_STICKY / the next foreground launch will recover the service.
        }
    }
}
