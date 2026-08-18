package fr.vox.chronomarkplus;

import android.Manifest;
import android.annotation.SuppressLint;
import android.location.Address;
import android.location.Geocoder;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.content.pm.PackageManager;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * v0.7.1 weather correction layer.
 * Music Control+ remains the validated v0.7 implementation in MainActivityV07.
 * Weather+ is replaced here without modifying persistent watch storage.
 */
public class MainActivityV071 extends MainActivityV07 {
    private static final int REQ_LOC_FIX = 1701;
    private static final long FIX_TIMEOUT_MS = 10000;
    private static final long MAX_CACHED_AGE_MS = 120000;
    private static final float GOOD_FIX_METERS = 120f;
    private static final float MAX_USABLE_FIX_METERS = 5000f;

    private final Handler fixHandler = new Handler(Looper.getMainLooper());

    private TextView wxStatus;
    private TextView wxSummary;
    private Button wxFetchButton;
    private Button wxLaunchButton;
    private Button syncCurrentButton;
    private Button returnClockButton;

    private FixWeatherData wx;
    private LocationListener freshListener;
    private Location bestFix;
    private long fixStartedElapsed;
    private boolean wxActive;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        patchWeatherUi();
    }

    @Override
    protected void onDestroy() {
        stopFreshLocation();
        super.onDestroy();
    }

    private void patchWeatherUi() {
        View root = getWindow().getDecorView();

        TextView section = findText(root, "WEATHER+ / PHONE DATA");
        if (section != null) section.setText("METEO+ / DONNEES TELEPHONE");

        wxStatus = findText(root, "WEATHER / NOT LOADED");
        if (wxStatus != null) wxStatus.setText("METEO / NON CHARGEE");

        wxSummary = findText(root, "Current + feels-like + rain chance + hourly + sunrise/sunset");
        if (wxSummary != null) wxSummary.setText("Position fraiche + meteo actuelle + 6 prochaines heures + soleil");

        wxFetchButton = findButton(root, "FETCH WEATHER+ FROM PHONE LOCATION");
        if (wxFetchButton != null) {
            wxFetchButton.setText("ACTUALISER METEO+ / POSITION PRECISE");
            wxFetchButton.setOnClickListener(v -> fetchWeatherFixed());
        }

        wxLaunchButton = findButton(root, "LAUNCH WEATHER+ / 120s");
        if (wxLaunchButton != null) {
            wxLaunchButton.setText("LANCER METEO+ / 120s");
            wxLaunchButton.setOnClickListener(v -> launchWeatherFixed());
        }

        syncCurrentButton = findButton(root, "SYNC CURRENT");
        if (syncCurrentButton != null) {
            syncCurrentButton.setText("SYNCHRONISER");
            syncCurrentButton.setOnClickListener(v -> {
                if (wxActive) pushWeatherFixed();
                else invokeParent("syncCurrentMode");
            });
        }

        returnClockButton = findButton(root, "RETURN TO CLOCK");
        if (returnClockButton != null) {
            returnClockButton.setText("RETOUR CADRAN");
            returnClockButton.setOnClickListener(v -> {
                if (wxActive) cleanReturnToClock();
                else invokeParent("returnToClock");
            });
        }
    }

    private void fetchWeatherFixed() {
        if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
                checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION}, REQ_LOC_FIX);
            setWxStatus("METEO / AUTORISATION DE LOCALISATION REQUISE");
            return;
        }

        LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        if (lm == null) {
            setWxStatus("METEO / LOCALISATION INDISPONIBLE");
            return;
        }

        stopFreshLocation();
        bestFix = bestRecentCached(lm);
        fixStartedElapsed = SystemClock.elapsedRealtime();
        setWxStatus("METEO / RECHERCHE D'UNE POSITION FRAICHE...");
        if (wxFetchButton != null) wxFetchButton.setEnabled(false);

        freshListener = new LocationListener() {
            @Override public void onLocationChanged(Location location) {
                if (location == null) return;
                if (bestFix == null || better(location, bestFix)) bestFix = location;
                float acc = location.hasAccuracy() ? location.getAccuracy() : 99999f;
                setWxStatus("METEO / FIX EN COURS / +/-" + Math.round(acc) + " m");
                if (acc <= GOOD_FIX_METERS && ageMs(location) <= 30000) finishLocationFix(location, false);
            }
            @Override public void onProviderEnabled(String provider) {}
            @Override public void onProviderDisabled(String provider) {}
            @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
        };

        try {
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 0, 0, freshListener, Looper.getMainLooper());
            }
            if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 0, 0, freshListener, Looper.getMainLooper());
            }
        } catch (SecurityException e) {
            setWxStatus("METEO / LOCALISATION REFUSEE");
            if (wxFetchButton != null) wxFetchButton.setEnabled(true);
            return;
        }

        fixHandler.postDelayed(() -> {
            if (freshListener == null) return;
            Location candidate = bestFix;
            if (candidate != null && candidate.hasAccuracy() && candidate.getAccuracy() <= MAX_USABLE_FIX_METERS) {
                finishLocationFix(candidate, candidate.getAccuracy() > 1000f);
            } else {
                stopFreshLocation();
                setWxStatus("METEO / PAS DE POSITION ASSEZ PRECISE");
                if (wxSummary != null) wxSummary.setText("Active la localisation precise du telephone puis reessaie.");
                if (wxFetchButton != null) wxFetchButton.setEnabled(true);
            }
        }, FIX_TIMEOUT_MS);
    }

    @SuppressLint("MissingPermission")
    private Location bestRecentCached(LocationManager lm) {
        Location best = null;
        String[] providers = new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER};
        for (String provider : providers) {
            try {
                Location l = lm.getLastKnownLocation(provider);
                if (l == null || ageMs(l) > MAX_CACHED_AGE_MS) continue;
                if (best == null || better(l, best)) best = l;
            } catch (Exception ignored) {}
        }
        return best;
    }

    private boolean better(Location a, Location b) {
        long ageA = ageMs(a), ageB = ageMs(b);
        float accA = a.hasAccuracy() ? a.getAccuracy() : 99999f;
        float accB = b.hasAccuracy() ? b.getAccuracy() : 99999f;
        if (ageA + 15000 < ageB) return true;
        if (ageB + 15000 < ageA) return false;
        return accA < accB;
    }

    private long ageMs(Location l) {
        return Math.max(0, System.currentTimeMillis() - l.getTime());
    }

    private void finishLocationFix(Location location, boolean coarseWarning) {
        if (freshListener == null) return;
        stopFreshLocation();
        float accuracy = location.hasAccuracy() ? location.getAccuracy() : -1f;
        setWxStatus("METEO / POSITION ACQUISE / +/-" + (accuracy >= 0 ? Math.round(accuracy) : "?") + " m");
        fetchWeatherAtFixed(location, coarseWarning);
    }

    private void stopFreshLocation() {
        if (freshListener != null) {
            try {
                LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
                if (lm != null && (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                        checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED)) {
                    lm.removeUpdates(freshListener);
                }
            } catch (Exception ignored) {}
        }
        freshListener = null;
    }

    private void fetchWeatherAtFixed(Location loc, boolean coarseWarning) {
        final double lat = loc.getLatitude();
        final double lon = loc.getLongitude();
        final float accuracy = loc.hasAccuracy() ? loc.getAccuracy() : -1f;
        setWxStatus("METEO / CHARGEMENT DES DONNEES...");

        new Thread(() -> {
            HttpURLConnection con = null;
            try {
                String place = reversePlace(lat, lon);
                String q = "https://api.open-meteo.com/v1/forecast?latitude=" + String.format(Locale.ROOT, "%.5f", lat) +
                        "&longitude=" + String.format(Locale.ROOT, "%.5f", lon) +
                        "&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m" +
                        "&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code" +
                        "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max" +
                        "&forecast_days=3&timezone=auto";
                con = (HttpURLConnection) new URL(q).openConnection();
                con.setConnectTimeout(10000);
                con.setReadTimeout(10000);
                con.setRequestProperty("User-Agent", "ChronomarkPlus/0.7.1");
                int code = con.getResponseCode();
                if (code < 200 || code >= 300) throw new Exception("HTTP " + code);

                BufferedReader br = new BufferedReader(new InputStreamReader(con.getInputStream(), StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) sb.append(line);
                br.close();

                FixWeatherData data = parseWeather(new JSONObject(sb.toString()), lat, lon, accuracy, place);
                runOnUiThread(() -> {
                    wx = data;
                    // Keep the parent's enable/disable logic satisfied without using its old weather renderer.
                    setParentField("weatherData", new MainActivityV07.WeatherData());
                    if (wxLaunchButton != null) wxLaunchButton.setEnabled(true);
                    if (wxFetchButton != null) wxFetchButton.setEnabled(true);
                    String precision = data.accuracy >= 0 ? " +/-" + Math.round(data.accuracy) + " m" : "";
                    setWxStatus("METEO / " + data.place + precision + (coarseWarning ? " / APPROX." : ""));
                    if (wxSummary != null) {
                        wxSummary.setText(String.format(Locale.FRANCE,
                                "%.0f°C • ressenti %.0f°C • %s • pluie %.0f%% • vent %.0f km/h",
                                data.temp, data.feels, data.condition, data.nextRainChance, data.wind));
                    }
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    setWxStatus("METEO / ERREUR DE CHARGEMENT");
                    if (wxSummary != null) wxSummary.setText(e.getClass().getSimpleName() + ": " + e.getMessage());
                    if (wxFetchButton != null) wxFetchButton.setEnabled(true);
                });
            } finally {
                if (con != null) con.disconnect();
            }
        }, "ChronomarkWeather071").start();
    }

    @SuppressWarnings("deprecation")
    private String reversePlace(double lat, double lon) {
        try {
            if (!Geocoder.isPresent()) return coordinateLabel(lat, lon);
            Geocoder geocoder = new Geocoder(this, Locale.FRANCE);
            List<Address> list = geocoder.getFromLocation(lat, lon, 3);
            if (list != null) {
                for (Address a : list) {
                    String[] candidates = new String[]{a.getLocality(), a.getSubLocality(), a.getSubAdminArea(), a.getFeatureName(), a.getAdminArea()};
                    for (String candidate : candidates) {
                        if (candidate != null && !candidate.trim().isEmpty() && !looksLikeStreetNumber(candidate)) return candidate.trim();
                    }
                }
            }
        } catch (Exception ignored) {}
        return coordinateLabel(lat, lon);
    }

    private boolean looksLikeStreetNumber(String s) {
        String t = s.trim();
        if (t.isEmpty()) return true;
        for (int i = 0; i < t.length(); i++) if (!Character.isDigit(t.charAt(i))) return false;
        return true;
    }

    private String coordinateLabel(double lat, double lon) {
        return String.format(Locale.ROOT, "GPS %.3f, %.3f", lat, lon);
    }

    private FixWeatherData parseWeather(JSONObject root, double lat, double lon, float accuracy, String place) throws Exception {
        FixWeatherData w = new FixWeatherData();
        w.lat = lat; w.lon = lon; w.accuracy = accuracy; w.place = place;
        JSONObject cur = root.getJSONObject("current");
        w.currentTime = cur.optString("time", "");
        w.temp = cur.optDouble("temperature_2m", 0);
        w.feels = cur.optDouble("apparent_temperature", w.temp);
        w.humidity = cur.optDouble("relative_humidity_2m", 0);
        w.precip = cur.optDouble("precipitation", 0);
        w.code = cur.optInt("weather_code", 0);
        w.wind = cur.optDouble("wind_speed_10m", 0);
        w.condition = wmoFrench(w.code);

        JSONObject hourly = root.getJSONObject("hourly");
        JSONArray ht = hourly.getJSONArray("time");
        JSONArray htemp = hourly.getJSONArray("temperature_2m");
        JSONArray hpop = hourly.getJSONArray("precipitation_probability");
        int idx = 0;
        String hourKey = w.currentTime.length() >= 13 ? w.currentTime.substring(0, 13) : w.currentTime;
        for (int i = 0; i < ht.length(); i++) {
            if (ht.optString(i, "").startsWith(hourKey)) { idx = i; break; }
        }
        for (int j = 0; j < 6 && idx + j < ht.length(); j++) {
            FixHour h = new FixHour();
            h.time = ht.optString(idx + j, "");
            h.temp = htemp.optDouble(idx + j, 0);
            h.pop = hpop.optDouble(idx + j, 0);
            w.hours.add(h);
        }
        w.nextRainChance = w.hours.isEmpty() ? 0 : w.hours.get(0).pop;

        JSONObject daily = root.getJSONObject("daily");
        w.min = daily.getJSONArray("temperature_2m_min").optDouble(0, w.temp);
        w.max = daily.getJSONArray("temperature_2m_max").optDouble(0, w.temp);
        w.sunrise = shortClock(daily.getJSONArray("sunrise").optString(0, ""));
        w.sunset = shortClock(daily.getJSONArray("sunset").optString(0, ""));
        return w;
    }

    private String wmoFrench(int code) {
        if (code == 0) return "Degage";
        if (code == 1) return "Peu nuageux";
        if (code == 2) return "Partiellement nuageux";
        if (code == 3) return "Couvert";
        if (code == 45 || code == 48) return "Brouillard";
        if (code >= 51 && code <= 57) return "Bruine";
        if (code >= 61 && code <= 67) return "Pluie";
        if (code >= 71 && code <= 77) return "Neige";
        if (code >= 80 && code <= 82) return "Averses";
        if (code >= 85 && code <= 86) return "Averses de neige";
        if (code >= 95) return "Orages";
        return "Meteo";
    }

    private void launchWeatherFixed() {
        if (wx == null) {
            Toast.makeText(this, "Actualise d'abord Meteo+.", Toast.LENGTH_LONG).show();
            fetchWeatherFixed();
            return;
        }
        if (!parentBoolean("consoleReady")) {
            Toast.makeText(this, "Connecte d'abord la Chronomark.", Toast.LENGTH_LONG).show();
            return;
        }
        wxActive = true;
        setParentField("watchMode", "weatherfix");
        pushWeatherFixed();
    }

    private void pushWeatherFixed() {
        if (!wxActive || wx == null || !parentBoolean("consoleReady")) return;

        StringBuilder times = new StringBuilder("[");
        StringBuilder temps = new StringBuilder("[");
        StringBuilder pops = new StringBuilder("[");
        for (int i = 0; i < wx.hours.size(); i++) {
            if (i > 0) { times.append(','); temps.append(','); pops.append(','); }
            times.append(jsQuote(hourLabel(wx.hours.get(i).time)));
            temps.append(Math.round(wx.hours.get(i).temp));
            pops.append(Math.round(wx.hours.get(i).pop));
        }
        times.append(']'); temps.append(']'); pops.append(']');

        String placeWatch = trimWatch(asciiWatch(wx.place).toUpperCase(Locale.ROOT), 20);
        String condWatch = trimWatch(asciiWatch(wx.condition), 24);

        String js = "(function(){try{" +
                "try{if(global.__voxMCTimer)clearInterval(global.__voxMCTimer);if(global.__voxMCAuto)clearTimeout(global.__voxMCAuto);if(global.__voxWXAuto)clearTimeout(global.__voxWXAuto);}catch(e){}" +
                "E.clearWatches();g.reset().clear(1);g.flip();" +
                "var W=global.__voxWX={page:0,place:" + jsQuote(placeWatch) +
                ",temp:" + Math.round(wx.temp) + ",feels:" + Math.round(wx.feels) +
                ",hum:" + Math.round(wx.humidity) + ",pop:" + Math.round(wx.nextRainChance) +
                ",wind:" + Math.round(wx.wind) + ",min:" + Math.round(wx.min) + ",max:" + Math.round(wx.max) +
                ",cond:" + jsQuote(condWatch) + ",sunrise:" + jsQuote(wx.sunrise) + ",sunset:" + jsQuote(wx.sunset) +
                ",times:" + times + ",temps:" + temps + ",pops:" + pops + "};" +
                "global.__voxWXClean=function(){try{if(global.__voxWXAuto)clearTimeout(global.__voxWXAuto);}catch(e){}try{E.clearWatches();}catch(e){}try{g.reset().clear(1);g.flip();}catch(e){}};" +
                "global.__voxWXBack=function(){global.__voxWXClean();print('VOX'+'_WX:EXIT');setTimeout(function(){load('clock.app.js');},80);};" +
                "global.__voxWXDraw=function(){" +
                "g.reset().clear(1);Dickens.buttonIcons=['chart','clock','down','up'];Dickens.loadSurround();" +
                "g.setColor('#358').fillArc(-0.97,0.97,96).fillArc(Math.PI-0.75,Math.PI+0.75,96).fillRect(37,69,201,69).fillRect(51,186,187,186);" +
                "g.setColor('#FFF').setBgColor('#358').setFontAlign(0,0).setFontGrotesk16().drawString('Meteo+',120,55);g.setBgColor(0);" +
                "g.setFontArchitekt10().setFontAlign(0,0).setColor('#9BC').drawString(W.place,120,81);" +
                "if(W.page===0){" +
                "g.setColor('#E49E4C').setFontArchitekt35().drawString(W.temp+'°',120,108);" +
                "g.setColor('#FFF').setFontGrotesk16().drawString(W.cond,120,137);" +
                "g.setFontArchitekt10().setColor('#BBB').drawString('RESS '+W.feels+'°   HUM '+W.hum+'%',120,158);" +
                "g.drawString('PLUIE '+W.pop+'%   VENT '+W.wind+' km/h',120,174);" +
                "g.setColor('#FFF').drawString('MIN '+W.min+'°  MAX '+W.max+'°',120,198);" +
                "g.setColor('#BFD').drawString('SOLEIL '+W.sunrise+'-'+W.sunset,120,212);" +
                "}else{" +
                "g.setColor('#E49E4C').setFontGrotesk16().drawString('6 PROCHAINES H',120,96);g.setFontArchitekt10();" +
                "for(var i=0;i<W.times.length;i++){var y=116+i*14;g.setColor('#AAA').setFontAlign(-1,0).drawString(W.times[i],68,y);g.setColor('#FFF').setFontAlign(0,0).drawString(W.temps[i]+'°',121,y);g.setColor('#0AF').setFontAlign(1,0).drawString(W.pops[i]+'%',172,y);}" +
                "}" +
                "g.flip();};" +
                "var pg=function(d){W.page=(W.page+d+2)%2;global.__voxWXDraw();};" +
                "setWatch(function(){pg(1);},BTN1,{edge:1,repeat:1});setWatch(global.__voxWXBack,BTN2,{edge:1,repeat:1});setWatch(function(){pg(1);},BTN3,{edge:1,repeat:1});setWatch(function(){pg(-1);},BTN4,{edge:1,repeat:1});" +
                "global.__voxWXAuto=setTimeout(global.__voxWXBack,120000);global.__voxWXDraw();print('VOX'+'_WX:READY');" +
                "}catch(e){print('VOX'+'_WX:ERR:'+e);try{g.reset().clear(1);g.flip();}catch(x){}setTimeout(function(){load('clock.app.js');},1200);}})();\n";

        sendConsoleReflect(js);
    }

    private void cleanReturnToClock() {
        wxActive = false;
        setParentField("watchMode", "");
        if (!parentBoolean("consoleReady")) return;
        sendConsoleReflect("try{if(global.__voxWXAuto)clearTimeout(global.__voxWXAuto);if(global.__voxMCTimer)clearInterval(global.__voxMCTimer);if(global.__voxMCAuto)clearTimeout(global.__voxMCAuto);E.clearWatches();g.reset().clear(1);g.flip();}catch(e){}setTimeout(function(){load('clock.app.js');},80);\n");
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_LOC_FIX) {
            if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                    checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                fetchWeatherFixed();
            } else {
                setWxStatus("METEO / LOCALISATION REFUSEE");
            }
        }
    }

    private String shortClock(String iso) {
        int t = iso.indexOf('T');
        return (t >= 0 && iso.length() >= t + 6) ? iso.substring(t + 1, t + 6) : iso;
    }

    private String hourLabel(String iso) {
        int t = iso.indexOf('T');
        if (t >= 0 && iso.length() >= t + 3) return iso.substring(t + 1, t + 3) + "h";
        return iso;
    }

    private String asciiWatch(String in) {
        if (in == null) return "";
        String n = Normalizer.normalize(in, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        return n.replace('’', '\'').replace('–', '-').replace('—', '-');
    }

    private String trimWatch(String s, int max) {
        if (s == null) return "";
        s = s.replace('\n', ' ').replace('\r', ' ').trim();
        return s.length() <= max ? s : s.substring(0, max);
    }

    private String jsQuote(String s) {
        if (s == null) s = "";
        StringBuilder out = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            switch (ch) {
                case '\\': out.append("\\\\"); break;
                case '"': out.append("\\\""); break;
                case '\n': out.append("\\n"); break;
                case '\r': out.append("\\r"); break;
                case '\t': out.append("\\t"); break;
                default:
                    if (ch < 32 || ch > 126) {
                        String hex = Integer.toHexString(ch);
                        out.append("\\u");
                        for (int z = hex.length(); z < 4; z++) out.append('0');
                        out.append(hex);
                    } else out.append(ch);
            }
        }
        return out.append('"').toString();
    }

    private void sendConsoleReflect(String text) {
        try {
            Method m = MainActivityV07.class.getDeclaredMethod("sendConsole", String.class);
            m.setAccessible(true);
            m.invoke(this, text);
        } catch (Exception e) {
            Toast.makeText(this, "Erreur pont Chronomark: " + e.getClass().getSimpleName(), Toast.LENGTH_LONG).show();
        }
    }

    private void invokeParent(String methodName) {
        try {
            Method m = MainActivityV07.class.getDeclaredMethod(methodName);
            m.setAccessible(true);
            m.invoke(this);
        } catch (Exception ignored) {}
    }

    private boolean parentBoolean(String fieldName) {
        try {
            Field f = MainActivityV07.class.getDeclaredField(fieldName);
            f.setAccessible(true);
            return f.getBoolean(this);
        } catch (Exception e) { return false; }
    }

    private void setParentField(String fieldName, Object value) {
        try {
            Field f = MainActivityV07.class.getDeclaredField(fieldName);
            f.setAccessible(true);
            f.set(this, value);
        } catch (Exception ignored) {}
    }

    private void setWxStatus(String text) {
        runOnUiThread(() -> { if (wxStatus != null) wxStatus.setText(text); });
    }

    private TextView findText(View root, String exact) {
        if (root instanceof TextView && exact.contentEquals(((TextView) root).getText())) return (TextView) root;
        if (root instanceof ViewGroup) {
            ViewGroup vg = (ViewGroup) root;
            for (int i = 0; i < vg.getChildCount(); i++) {
                TextView found = findText(vg.getChildAt(i), exact);
                if (found != null) return found;
            }
        }
        return null;
    }

    private Button findButton(View root, String exact) {
        TextView t = findText(root, exact);
        return t instanceof Button ? (Button) t : null;
    }

    static class FixHour {
        String time;
        double temp;
        double pop;
    }

    static class FixWeatherData {
        double lat, lon;
        float accuracy;
        double temp, feels, humidity, precip, wind, nextRainChance, min, max;
        int code;
        String place, condition, currentTime, sunrise, sunset;
        List<FixHour> hours = new ArrayList<>();
    }
}
