package fr.vox.chronomarkplus;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import java.lang.reflect.Field;
import java.lang.reflect.Method;

/**
 * v0.7.3: Weather+ follows the phone location instead of freezing one fix.
 * Music Control+ and watch storage policy are unchanged.
 */
public class MainActivityV073 extends MainActivityV072 {
    private static final long TRACK_MIN_TIME_MS = 60_000L;
    private static final float TRACK_MIN_DISTANCE_M = 250f;
    private static final float WEATHER_MOVE_M = 500f;
    private static final float WEATHER_FORCE_MOVE_M = 5000f;
    private static final long WEATHER_MOVE_MIN_INTERVAL_MS = 120_000L;
    private static final long WEATHER_STATIONARY_REFRESH_MS = 900_000L;

    private final Handler trackingHandler = new Handler(Looper.getMainLooper());
    private LocationListener trackingListener;
    private Location lastRequestedWeatherLocation;
    private long lastWeatherRequestElapsed;
    private boolean weatherRequestPending;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        patch073Ui();
        trackingHandler.postDelayed(this::startContinuousTrackingIfAllowed, 1200);
    }

    @Override
    protected void onResume() {
        super.onResume();
        trackingHandler.postDelayed(this::startContinuousTrackingIfAllowed, 500);
    }

    @Override
    protected void onDestroy() {
        stopContinuousTracking();
        trackingHandler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    private void patch073Ui() {
        View root = getWindow().getDecorView();
        TextView version = findTextContains073(root, "MUSIC CONTROL+ / METEO+");
        if (version != null) version.setText("MUSIC CONTROL+ / METEO+ / v0.7.3");

        TextView summary = findTextContains073(root, "Position fraiche");
        if (summary != null) summary.setText("Suivi automatique de la position + meteo locale dynamique");
    }

    @SuppressLint("MissingPermission")
    private void startContinuousTrackingIfAllowed() {
        if (trackingListener != null) return;
        if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
                checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return;

        LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        if (lm == null) return;

        MainActivityV071.FixWeatherData existing = getWx073();
        if (existing != null) {
            Location l = new Location("weather");
            l.setLatitude(existing.lat);
            l.setLongitude(existing.lon);
            lastRequestedWeatherLocation = l;
            lastWeatherRequestElapsed = SystemClock.elapsedRealtime();
        }

        trackingListener = new LocationListener() {
            @Override public void onLocationChanged(Location location) {
                if (location == null) return;
                considerTrackedLocation(location);
            }
            @Override public void onProviderEnabled(String provider) {}
            @Override public void onProviderDisabled(String provider) {}
            @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
        };

        try {
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, TRACK_MIN_TIME_MS,
                        TRACK_MIN_DISTANCE_M, trackingListener, Looper.getMainLooper());
            }
            if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, TRACK_MIN_TIME_MS,
                        TRACK_MIN_DISTANCE_M, trackingListener, Looper.getMainLooper());
            }
        } catch (Exception ignored) {}
    }

    private void stopContinuousTracking() {
        if (trackingListener == null) return;
        try {
            LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
            if (lm != null && (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                    checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED)) {
                lm.removeUpdates(trackingListener);
            }
        } catch (Exception ignored) {}
        trackingListener = null;
    }

    private void considerTrackedLocation(Location location) {
        if (weatherRequestPending) return;

        MainActivityV071.FixWeatherData existing = getWx073();
        if (lastRequestedWeatherLocation == null && existing != null) {
            lastRequestedWeatherLocation = new Location("weather");
            lastRequestedWeatherLocation.setLatitude(existing.lat);
            lastRequestedWeatherLocation.setLongitude(existing.lon);
        }

        long now = SystemClock.elapsedRealtime();
        long elapsed = lastWeatherRequestElapsed == 0 ? Long.MAX_VALUE : now - lastWeatherRequestElapsed;
        float moved = lastRequestedWeatherLocation == null ? Float.MAX_VALUE : lastRequestedWeatherLocation.distanceTo(location);

        boolean noWeatherYet = existing == null;
        boolean farMove = moved >= WEATHER_FORCE_MOVE_M;
        boolean normalMove = moved >= WEATHER_MOVE_M && elapsed >= WEATHER_MOVE_MIN_INTERVAL_MS;
        boolean periodic = elapsed >= WEATHER_STATIONARY_REFRESH_MS;

        if (noWeatherYet || farMove || normalMove || periodic) {
            requestWeatherForTrackedLocation(location);
        }
    }

    private void requestWeatherForTrackedLocation(Location location) {
        weatherRequestPending = true;
        lastWeatherRequestElapsed = SystemClock.elapsedRealtime();
        lastRequestedWeatherLocation = new Location(location);

        invokeV071Fetch(location);
        waitForWeatherResult(location, 0);

        // Safety release if the network request fails silently or takes too long.
        trackingHandler.postDelayed(() -> weatherRequestPending = false, 15_000L);
    }

    private void waitForWeatherResult(Location requested, int attempt) {
        trackingHandler.postDelayed(() -> {
            MainActivityV071.FixWeatherData data = getWx073();
            if (data != null) {
                Location got = new Location("weather-result");
                got.setLatitude(data.lat);
                got.setLongitude(data.lon);
                if (got.distanceTo(requested) < 250f) {
                    weatherRequestPending = false;
                    if (isWatchWeatherActive()) invokeV072Push();
                    return;
                }
            }
            if (attempt < 11) waitForWeatherResult(requested, attempt + 1);
            else weatherRequestPending = false;
        }, 1000L);
    }

    private boolean isWatchWeatherActive() {
        try {
            Field f = MainActivityV07.class.getDeclaredField("watchMode");
            f.setAccessible(true);
            Object v = f.get(this);
            return "weather072".equals(v);
        } catch (Exception e) {
            return false;
        }
    }

    private void invokeV071Fetch(Location location) {
        try {
            Method m = MainActivityV071.class.getDeclaredMethod("fetchWeatherAtFixed", Location.class, boolean.class);
            m.setAccessible(true);
            m.invoke(this, location, false);
        } catch (Exception ignored) {
            weatherRequestPending = false;
        }
    }

    private void invokeV072Push() {
        try {
            Method m = MainActivityV072.class.getDeclaredMethod("pushWeather072");
            m.setAccessible(true);
            m.invoke(this);
        } catch (Exception ignored) {}
    }

    private MainActivityV071.FixWeatherData getWx073() {
        try {
            Field f = MainActivityV071.class.getDeclaredField("wx");
            f.setAccessible(true);
            return (MainActivityV071.FixWeatherData) f.get(this);
        } catch (Exception e) {
            return null;
        }
    }

    private TextView findTextContains073(View root, String needle) {
        if (root instanceof TextView) {
            CharSequence cs = ((TextView) root).getText();
            if (cs != null && cs.toString().contains(needle)) return (TextView) root;
        }
        if (root instanceof ViewGroup) {
            ViewGroup vg = (ViewGroup) root;
            for (int i = 0; i < vg.getChildCount(); i++) {
                TextView t = findTextContains073(vg.getChildAt(i), needle);
                if (t != null) return t;
            }
        }
        return null;
    }
}
