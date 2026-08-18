package fr.vox.chronomarkplus;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.Address;
import android.location.Geocoder;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Supplies the stock Bethesda Weather app with fresh phone-GPS weather data.
 * The watch UI/app is untouched: only weather.json, the data file Bethesda's
 * original companion used to maintain, is refreshed.
 */
final class WeatherSyncEngine {
    interface Callback {
        void onWeatherPayload(Payload payload);
        void onWeatherStatus(String status);
    }

    static final class Payload {
        final String json;
        final String locality;
        final double latitude;
        final double longitude;
        final float accuracy;
        final long createdAtMs;

        Payload(String json, String locality, double latitude, double longitude, float accuracy) {
            this.json = json;
            this.locality = locality;
            this.latitude = latitude;
            this.longitude = longitude;
            this.accuracy = accuracy;
            this.createdAtMs = System.currentTimeMillis();
        }
    }

    static final String KEY_WEATHER_PLACE = "weather_place";
    static final String KEY_WEATHER_LAT = "weather_lat";
    static final String KEY_WEATHER_LON = "weather_lon";
    static final String KEY_WEATHER_ACCURACY = "weather_accuracy";
    static final String KEY_WEATHER_SYNC_TIME = "weather_sync_time";

    private static final long LOCATION_MIN_TIME_MS = 120_000L;
    private static final float LOCATION_MIN_DISTANCE_M = 250f;
    private static final long PERIODIC_CHECK_MS = 15 * 60_000L;
    private static final long WEATHER_MAX_AGE_MS = 60 * 60_000L;
    private static final long ATTEMPT_THROTTLE_MS = 2 * 60_000L;
    private static final long MAX_CACHED_AGE_MS = 2 * 60_000L;
    private static final float MIN_RECHECK_DISTANCE_M = 500f;
    private static final float FORCE_DISTANCE_M = 5_000f;
    private static final float MAX_USABLE_ACCURACY_M = 5_000f;

    private final Context context;
    private final SharedPreferences prefs;
    private final Callback callback;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService io = Executors.newSingleThreadExecutor();

    private LocationManager locationManager;
    private LocationListener locationListener;
    private Location lastLocation;
    private Location lastEvaluatedLocation;
    private boolean started;
    private boolean fetching;
    private boolean forceNext;
    private long lastAttemptMs;

    private final Runnable periodic = new Runnable() {
        @Override public void run() {
            if (!started) return;
            Location l = lastLocation;
            if (l == null) l = bestRecentCached();
            if (l != null) consider(l, false);
            main.postDelayed(this, PERIODIC_CHECK_MS);
        }
    };

    WeatherSyncEngine(Context context, SharedPreferences prefs, Callback callback) {
        this.context = context.getApplicationContext();
        this.prefs = prefs;
        this.callback = callback;
    }

    boolean hasLocationPermission() {
        return context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @SuppressLint("MissingPermission")
    void start() {
        if (started) return;
        if (!hasLocationPermission()) {
            callback.onWeatherStatus("GPS non autorise");
            return;
        }
        locationManager = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        if (locationManager == null) {
            callback.onWeatherStatus("GPS indisponible");
            return;
        }
        started = true;
        locationListener = new LocationListener() {
            @Override public void onLocationChanged(Location location) {
                if (location == null) return;
                lastLocation = new Location(location);
                consider(lastLocation, false);
            }
            @Override public void onProviderEnabled(String provider) {}
            @Override public void onProviderDisabled(String provider) {}
            @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
        };

        try {
            if (context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED &&
                    locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER,
                        LOCATION_MIN_TIME_MS, LOCATION_MIN_DISTANCE_M, locationListener, Looper.getMainLooper());
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER,
                        LOCATION_MIN_TIME_MS, LOCATION_MIN_DISTANCE_M, locationListener, Looper.getMainLooper());
            }
        } catch (Exception e) {
            callback.onWeatherStatus("GPS: " + e.getClass().getSimpleName());
        }

        Location cached = bestRecentCached();
        if (cached != null) {
            lastLocation = cached;
            consider(cached, false);
        }
        main.removeCallbacks(periodic);
        main.postDelayed(periodic, PERIODIC_CHECK_MS);
    }

    void forceRefresh() {
        forceNext = true;
        if (!started) start();
        Location l = lastLocation;
        if (l == null) l = bestRecentCached();
        if (l != null) consider(l, true);
        else callback.onWeatherStatus("Recherche d'une position GPS fraiche...");
    }

    @SuppressLint("MissingPermission")
    void stop() {
        started = false;
        main.removeCallbacks(periodic);
        if (locationManager != null && locationListener != null && hasLocationPermission()) {
            try { locationManager.removeUpdates(locationListener); } catch (Exception ignored) {}
        }
        locationListener = null;
        locationManager = null;
        io.shutdownNow();
    }

    void markDelivered(Payload payload) {
        if (payload == null) return;
        prefs.edit()
                .putString(KEY_WEATHER_PLACE, payload.locality)
                .putLong(KEY_WEATHER_SYNC_TIME, System.currentTimeMillis())
                .putLong(KEY_WEATHER_LAT, Double.doubleToRawLongBits(payload.latitude))
                .putLong(KEY_WEATHER_LON, Double.doubleToRawLongBits(payload.longitude))
                .putFloat(KEY_WEATHER_ACCURACY, payload.accuracy)
                .apply();
    }

    private void consider(Location location, boolean force) {
        if (!started || location == null) return;
        if (location.hasAccuracy() && location.getAccuracy() > MAX_USABLE_ACCURACY_M) return;

        long now = System.currentTimeMillis();
        boolean explicitForce = force || forceNext;
        if (!explicitForce && now - lastAttemptMs < ATTEMPT_THROTTLE_MS) return;

        if (!explicitForce && lastEvaluatedLocation != null &&
                location.distanceTo(lastEvaluatedLocation) < MIN_RECHECK_DISTANCE_M &&
                now - deliveredTime() < WEATHER_MAX_AGE_MS) return;

        synchronized (this) {
            if (fetching) return;
            fetching = true;
        }
        forceNext = false;
        lastAttemptMs = now;
        lastEvaluatedLocation = new Location(location);
        final Location fix = new Location(location);

        io.execute(() -> {
            try {
                String place = reversePlace(fix.getLatitude(), fix.getLongitude());
                long lastTime = deliveredTime();
                String previousPlace = prefs.getString(KEY_WEATHER_PLACE, "");
                float distance = distanceFromDelivered(fix);
                boolean stale = lastTime <= 0 || System.currentTimeMillis() - lastTime >= WEATHER_MAX_AGE_MS;
                boolean movedFar = distance < 0 || distance >= FORCE_DISTANCE_M;
                boolean placeChanged = !previousPlace.isEmpty() && !samePlace(previousPlace, place);
                boolean first = lastTime <= 0;

                if (explicitForce || first || stale || movedFar || placeChanged) {
                    callback.onWeatherStatus("Meteo GPS: " + place + " / chargement...");
                    Payload payload = fetchBethesdaWeather(fix, place);
                    callback.onWeatherPayload(payload);
                }
            } catch (Exception e) {
                callback.onWeatherStatus("Meteo GPS en attente / " + e.getClass().getSimpleName());
            } finally {
                synchronized (WeatherSyncEngine.this) { fetching = false; }
            }
        });
    }

    private long deliveredTime() {
        return prefs.getLong(KEY_WEATHER_SYNC_TIME, 0L);
    }

    private float distanceFromDelivered(Location now) {
        if (!prefs.contains(KEY_WEATHER_LAT) || !prefs.contains(KEY_WEATHER_LON)) return -1f;
        Location old = new Location("chronomark-weather");
        old.setLatitude(Double.longBitsToDouble(prefs.getLong(KEY_WEATHER_LAT, 0L)));
        old.setLongitude(Double.longBitsToDouble(prefs.getLong(KEY_WEATHER_LON, 0L)));
        return old.distanceTo(now);
    }

    private boolean samePlace(String a, String b) {
        return ascii(a).trim().equalsIgnoreCase(ascii(b).trim());
    }

    @SuppressLint("MissingPermission")
    private Location bestRecentCached() {
        if (locationManager == null || !hasLocationPermission()) return null;
        Location best = null;
        String[] providers = new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER};
        for (String p : providers) {
            try {
                Location l = locationManager.getLastKnownLocation(p);
                if (l == null || System.currentTimeMillis() - l.getTime() > MAX_CACHED_AGE_MS) continue;
                if (best == null || better(l, best)) best = l;
            } catch (Exception ignored) {}
        }
        return best == null ? null : new Location(best);
    }

    private boolean better(Location a, Location b) {
        long ageA = Math.max(0, System.currentTimeMillis() - a.getTime());
        long ageB = Math.max(0, System.currentTimeMillis() - b.getTime());
        if (ageA + 15_000L < ageB) return true;
        if (ageB + 15_000L < ageA) return false;
        float aa = a.hasAccuracy() ? a.getAccuracy() : Float.MAX_VALUE;
        float ab = b.hasAccuracy() ? b.getAccuracy() : Float.MAX_VALUE;
        return aa < ab;
    }

    @SuppressWarnings("deprecation")
    private String reversePlace(double lat, double lon) {
        try {
            if (Geocoder.isPresent()) {
                Geocoder geocoder = new Geocoder(context, Locale.FRANCE);
                List<Address> list = geocoder.getFromLocation(lat, lon, 3);
                if (list != null) {
                    for (Address a : list) {
                        String[] c = new String[]{a.getLocality(), a.getSubLocality(), a.getSubAdminArea(), a.getFeatureName(), a.getAdminArea()};
                        for (String s : c) {
                            if (s != null && !s.trim().isEmpty() && !digitsOnly(s)) return limitAscii(s.trim(), 32);
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
        return String.format(Locale.ROOT, "GPS %.2f %.2f", lat, lon);
    }

    private boolean digitsOnly(String s) {
        String t = s.trim();
        if (t.isEmpty()) return true;
        for (int i = 0; i < t.length(); i++) if (!Character.isDigit(t.charAt(i))) return false;
        return true;
    }

    private String limitAscii(String s, int max) {
        s = ascii(s).replace('\n', ' ').replace('\r', ' ').trim();
        return s.length() <= max ? s : s.substring(0, max);
    }

    private String ascii(String s) {
        if (s == null) return "";
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "")
                .replace('’', '\'').replace('–', '-').replace('—', '-');
    }

    private Payload fetchBethesdaWeather(Location fix, String place) throws Exception {
        double lat = fix.getLatitude(), lon = fix.getLongitude();
        String url = "https://api.open-meteo.com/v1/forecast?latitude=" + String.format(Locale.ROOT, "%.5f", lat) +
                "&longitude=" + String.format(Locale.ROOT, "%.5f", lon) +
                "&hourly=temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_gusts_10m,precipitation_probability,cloud_cover" +
                "&daily=weather_code,sunrise,sunset&forecast_days=15&timezone=auto";

        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setConnectTimeout(12_000);
        con.setReadTimeout(12_000);
        con.setRequestProperty("User-Agent", "ChronomarkPlus/1.0.1");
        try {
            int code = con.getResponseCode();
            if (code < 200 || code >= 300) throw new Exception("HTTP " + code);
            BufferedReader br = new BufferedReader(new InputStreamReader(con.getInputStream(), StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) sb.append(line);
            br.close();
            JSONObject source = new JSONObject(sb.toString());
            String json = buildBethesdaJson(source, fix, place).toString();
            return new Payload(json, place, lat, lon, fix.hasAccuracy() ? fix.getAccuracy() : -1f);
        } finally {
            con.disconnect();
        }
    }

    private JSONObject buildBethesdaJson(JSONObject source, Location fix, String place) throws Exception {
        JSONObject hourly = source.getJSONObject("hourly");
        JSONObject daily = source.getJSONObject("daily");
        JSONArray temps = hourly.getJSONArray("temperature_2m");
        JSONArray hum = hourly.getJSONArray("relative_humidity_2m");
        JSONArray press = hourly.getJSONArray("pressure_msl");
        JSONArray wind = hourly.getJSONArray("wind_speed_10m");
        JSONArray gust = hourly.getJSONArray("wind_gusts_10m");
        JSONArray pop = hourly.getJSONArray("precipitation_probability");
        JSONArray cloud = hourly.getJSONArray("cloud_cover");
        int hourlyCount = Math.min(168, minLength(temps, hum, press, wind, gust, pop, cloud));
        if (hourlyCount < 48) throw new Exception("forecast horaire incomplet");

        JSONArray codes = daily.getJSONArray("weather_code");
        JSONArray sunrises = daily.getJSONArray("sunrise");
        JSONArray sunsets = daily.getJSONArray("sunset");
        if (codes.length() < 7) throw new Exception("forecast journalier incomplet");

        JSONObject out = new JSONObject();
        out.put("locality", limitAscii(place, 32));
        out.put("units", "metric");
        out.put("latitude", fix.getLatitude());
        out.put("longitude", fix.getLongitude());
        out.put("tzoffset", source.optDouble("utc_offset_seconds", 0d) / 3600d);
        out.put("timestamp", System.currentTimeMillis() / 1000L);

        JSONArray sunrise = new JSONArray();
        JSONArray sunset = new JSONArray();
        JSONArray moon = new JSONArray();
        int astronomyDays = Math.min(15, Math.min(sunrises.length(), sunsets.length()));
        for (int i = 0; i < astronomyDays; i++) {
            sunrise.put(shortClock(sunrises.optString(i, "")));
            sunset.put(shortClock(sunsets.optString(i, "")));
            moon.put(String.format(Locale.ROOT, "%.2f", moonPhaseFraction(System.currentTimeMillis() + i * 86_400_000L)));
        }
        out.put("sunrise", sunrise);
        out.put("sunset", sunset);
        out.put("moonPhase", moon);

        JSONArray summary = new JSONArray();
        JSONArray icons = new JSONArray();
        for (int i = 0; i < 7; i++) {
            int c = codes.optInt(i, 0);
            summary.put(wmoSummary(c));
            icons.put(wmoIcon(c));
        }
        out.put("summary", summary);
        out.put("icon", icons);

        out.put("temperature", numericSlice(temps, hourlyCount, 1));
        out.put("humidity", numericSlice(hum, hourlyCount, 1));
        out.put("pressure", numericSlice(press, hourlyCount, 1));
        out.put("windSpeed", numericSlice(wind, hourlyCount, 1));
        out.put("windGust", numericSlice(gust, hourlyCount, 1));
        out.put("precipProb", numericSlice(pop, hourlyCount, 1));
        out.put("cloudCover", numericSlice(cloud, hourlyCount, 1));
        return out;
    }

    private int minLength(JSONArray... arrays) {
        int m = Integer.MAX_VALUE;
        for (JSONArray a : arrays) m = Math.min(m, a.length());
        return m == Integer.MAX_VALUE ? 0 : m;
    }

    private JSONArray numericSlice(JSONArray src, int count, int decimals) {
        JSONArray out = new JSONArray();
        double factor = Math.pow(10, decimals);
        for (int i = 0; i < count; i++) {
            double v = src.isNull(i) ? 0d : src.optDouble(i, 0d);
            out.put(Math.round(v * factor) / factor);
        }
        return out;
    }

    private String shortClock(String iso) {
        int t = iso.indexOf('T');
        return t >= 0 && iso.length() >= t + 6 ? iso.substring(t + 1, t + 6) : iso;
    }

    private String wmoIcon(int c) {
        if (c == 0) return "clear-day";
        if (c == 1 || c == 2) return "partly-cloudy-day";
        if (c == 3) return "cloudy";
        if (c == 45 || c == 48) return "fog";
        if (c >= 51 && c <= 67) return "rain";
        if (c >= 71 && c <= 77) return "snow";
        if (c >= 80 && c <= 82) return "rain";
        if (c >= 85 && c <= 86) return "snow";
        if (c >= 95) return "storm";
        return "cloudy";
    }

    private String wmoSummary(int c) {
        if (c == 0) return "Clear";
        if (c == 1) return "Mostly clear";
        if (c == 2) return "Partially cloudy";
        if (c == 3) return "Overcast";
        if (c == 45 || c == 48) return "Fog";
        if (c >= 51 && c <= 57) return "Drizzle";
        if (c >= 61 && c <= 67) return "Rain";
        if (c >= 71 && c <= 77) return "Snow";
        if (c >= 80 && c <= 82) return "Rain showers";
        if (c >= 85 && c <= 86) return "Snow showers";
        if (c >= 95) return "Thunderstorm";
        return "Cloudy";
    }

    /** 0=new moon, 0.5=full moon, using a stable synodic-month approximation. */
    private double moonPhaseFraction(long epochMs) {
        final double synodicDays = 29.53058867;
        final long knownNewMoon = 947182440000L; // 2000-01-06 18:14 UTC
        double days = (epochMs - knownNewMoon) / 86_400_000d;
        double p = (days / synodicDays) % 1d;
        return p < 0 ? p + 1d : p;
    }
}
