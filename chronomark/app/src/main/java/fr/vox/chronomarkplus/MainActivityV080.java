package fr.vox.chronomarkplus;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
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
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Chronomark+ v0.8.0
 * - Music Control+ remains frozen/untouched.
 * - Weather+ clone is retired: a small live-current page fronts Bethesda's ORIGINAL weather.app.js.
 *   BTN1 switches to the original Bethesda graphs, fed from live phone/Open-Meteo data in RAM.
 *   No weather.json or Bethesda storage write is performed.
 * - Phone Status + Find Phone first RAM prototype.
 */
public class MainActivityV080 extends MainActivityV075 {
    private final Handler v08Handler = new Handler(Looper.getMainLooper());
    private final Handler findHandler = new Handler(Looper.getMainLooper());

    private boolean weatherHomeActive;
    private boolean phoneActive;
    private String weatherHomeSignature = "";
    private String phoneSignature = "";

    private TextView phoneUiStatus;
    private Button phoneLaunchButton;
    private Button phoneFindTestButton;

    private FullWeatherData fullWeather;
    private String fullWeatherKey = "";
    private boolean fullWeatherFetching;
    private boolean pendingOpenBethesdaWeather;

    private Ringtone findRingtone;
    private Vibrator findVibrator;
    private boolean findPlaying;

    private final Runnable v08Monitor = new Runnable() {
        @Override public void run() {
            MainActivityV071.FixWeatherData wx = getWeather();
            if (wx != null) {
                String key = weatherLocationKey(wx);
                if (!key.equals(fullWeatherKey) && !fullWeatherFetching) fetchFullWeather(wx, false);
                if (weatherHomeActive) {
                    String sig = weatherHomeSignature(wx);
                    if (!sig.equals(weatherHomeSignature)) {
                        weatherHomeSignature = sig;
                        pushWeatherHome(false);
                    }
                }
            }

            PhoneSnapshot p = readPhoneSnapshot();
            if (phoneUiStatus != null) phoneUiStatus.setText(phoneSummary(p));
            if (phoneActive) {
                String sig = p.signature() + "|" + findPlaying;
                if (!sig.equals(phoneSignature)) {
                    phoneSignature = sig;
                    pushPhoneStatus(false);
                }
            }
            v08Handler.postDelayed(this, 2500L);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        patchV08Ui();
        v08Handler.post(v08Monitor);
    }

    @Override
    protected void onDestroy() {
        v08Handler.removeCallbacksAndMessages(null);
        findHandler.removeCallbacksAndMessages(null);
        stopFindPhone(false);
        super.onDestroy();
    }

    private void patchV08Ui() {
        View root = getWindow().getDecorView();

        TextView version = findTextContains(root, "MUSIC CONTROL+ / METEO+");
        if (version == null) version = findTextContains(root, "MUSIC CONTROL+ / WEATHER+");
        if (version != null) version.setText("MUSIC CONTROL+ / WEATHER / PHONE / v0.8.0");

        TextView weatherSection = findTextContains(root, "METEO+ / DONNEES TELEPHONE");
        if (weatherSection != null) weatherSection.setText("WEATHER / DONNEES TELEPHONE");

        TextView weatherSummary = findTextContains(root, "Position dynamique");
        if (weatherSummary == null) weatherSummary = findTextContains(root, "Suivi automatique");
        if (weatherSummary != null) weatherSummary.setText("Accueil actuel + graphiques Bethesda d'origine / position dynamique");

        Button fetch = findButtonContains(root, "ACTUALISER METEO+");
        if (fetch != null) fetch.setText("ACTUALISER WEATHER / POSITION");

        Button weatherLaunch = findButtonContains(root, "LANCER METEO+");
        if (weatherLaunch != null) {
            weatherLaunch.setText("OUVRIR WEATHER / ACCUEIL + BETHESDA");
            weatherLaunch.setOnClickListener(v -> launchWeatherHome());
        }

        TextView liveLog = findTextContains(root, "LIVE BRIDGE LOG");
        if (liveLog != null && liveLog.getParent() instanceof ViewGroup) {
            ViewGroup parent = (ViewGroup) liveLog.getParent();
            int at = parent.indexOfChild(liveLog);

            TextView section = makeText("PHONE STATUS + FIND PHONE / RAM ONLY", 11, Color.rgb(164,169,167));
            section.setPadding(0, dp(14), 0, dp(4));
            parent.addView(section, at++);

            phoneUiStatus = makeText("Lecture de l'etat du telephone...", 12, Color.rgb(122,198,190));
            phoneUiStatus.setPadding(dp(10), dp(8), dp(10), dp(8));
            phoneUiStatus.setBackgroundColor(Color.rgb(27,34,38));
            parent.addView(phoneUiStatus, at++);

            phoneLaunchButton = new Button(this);
            phoneLaunchButton.setText("OUVRIR PHONE STATUS");
            phoneLaunchButton.setAllCaps(false);
            phoneLaunchButton.setOnClickListener(v -> launchPhoneStatus());
            parent.addView(phoneLaunchButton, at++, lp(dp(50)));

            phoneFindTestButton = new Button(this);
            phoneFindTestButton.setText("TEST FIND PHONE / SONNER");
            phoneFindTestButton.setAllCaps(false);
            phoneFindTestButton.setOnClickListener(v -> toggleFindPhone());
            parent.addView(phoneFindTestButton, at, lp(dp(50)));
        }
    }

    // ---------------------------------------------------------------------
    // Weather: live current page -> exact Bethesda weather.app.js in RAM
    // ---------------------------------------------------------------------

    private void launchWeatherHome() {
        MainActivityV071.FixWeatherData w = getWeather();
        if (w == null) {
            Toast.makeText(this, "Actualise d'abord Weather avec la position du telephone.", Toast.LENGTH_LONG).show();
            Button b = findButtonContains(getWindow().getDecorView(), "ACTUALISER WEATHER");
            if (b != null) b.performClick();
            return;
        }
        if (!parentBoolean("consoleReady")) {
            Toast.makeText(this, "Connecte d'abord la Chronomark.", Toast.LENGTH_LONG).show();
            return;
        }

        phoneActive = false;
        weatherHomeActive = true;
        weatherHomeSignature = weatherHomeSignature(w);
        setParentField("watchMode", "weatherHome");
        pushWeatherHome(true);
        fetchFullWeather(w, false);
    }

    private void pushWeatherHome(boolean full) {
        if (!weatherHomeActive || !parentBoolean("consoleReady")) return;
        MainActivityV071.FixWeatherData w = getWeather();
        if (w == null) return;

        String place = trim(ascii(w.place).toUpperCase(Locale.ROOT), 14);
        String cond = trim(ascii(w.condition).toUpperCase(Locale.ROOT), 28);

        if (!full) {
            sendConsole("(function(){var W=global.__voxWxHome;if(!W||global.__voxActiveApp!=='WXHOME')return;" +
                    "W.place=" + jsQuote(place) + ";W.temp=" + Math.round(w.temp) + ";W.cond=" + jsQuote(cond) +
                    ";W.feels=" + Math.round(w.feels) + ";W.rain=" + Math.round(w.nextRainChance) +
                    ";if(global.__voxWxHomeDraw)global.__voxWxHomeDraw();})();\n");
            return;
        }

        String js = "(function(){try{" + WatchAppContract.suspendBethesdaClockJs() + WatchAppContract.beginSessionJs("WXHOME") +
                "var W=global.__voxWxHome={place:" + jsQuote(place) + ",temp:" + Math.round(w.temp) +
                ",cond:" + jsQuote(cond) + ",feels:" + Math.round(w.feels) + ",rain:" + Math.round(w.nextRainChance) + "};" +
                "global.__voxWxHomeDraw=function(){if(global.__voxActiveApp!=='WXHOME')return;" +
                "g.reset().setClipRect(0,0,239,239).clear(1);Dickens.buttonIcons=['chart','clock',null,null];Dickens.loadSurround();" +
                "g.setColor('#181820').fillCircleAA(119,119,92);g.setClipRect(36,32,202,194);" +
                "g.setFontArchitekt10().setFontAlign(0,0).setColor('#BFC8CC').drawString(W.place,119,45);" +
                "g.setColor('#E49E4C').setFontArchitekt35().drawString(W.temp+'°',119,91);" +
                "g.setColor('#FFF').setFontGrotesk14();var c=W.cond;while(c.length>1&&g.stringWidth(c)>150)c=c.substr(0,c.length-1);g.drawString(c,119,124);" +
                "g.setFontArchitekt10().setColor('#91A0A5').drawString('RESSENTI '+W.feels+'°',119,151);" +
                "g.setColor('#00BCEB').drawString('PLUIE '+W.rain+'%',119,168);" +
                "g.setColor('#AAA').drawString('BTN1  GRAPHIQUES BETHESDA',119,188);g.setClipRect(0,0,239,239);g.flip();};" +
                "setWatch(function(){print('VOX'+'_V08:WEATHER_CHARTS');},BTN1,{edge:1,repeat:1});" +
                "setWatch(function(){print('VOX'+'_V08:WEATHER_EXIT');load('clock.app.js');},BTN2,{edge:1,repeat:1});" +
                "setWatch(function(){print('VOX'+'_V08:WEATHER_SYNC');},BTN3,{edge:1,repeat:1});" +
                "global.__voxWxHomeDraw();print('VOX'+'_V08:WEATHER_HOME_READY');" +
                "}catch(e){print('VOX'+'_V08:WEATHER_HOME_ERR:'+e);load('clock.app.js');}})();\n";
        sendConsole(js);
        setWatchStatus("WATCH / WEATHER ACCUEIL / RAM ONLY");
    }

    private void requestBethesdaWeather() {
        MainActivityV071.FixWeatherData w = getWeather();
        if (w == null) return;
        weatherHomeActive = false;
        setParentField("watchMode", "weatherBase");
        pendingOpenBethesdaWeather = true;

        if (fullWeather != null && weatherLocationKey(w).equals(fullWeatherKey)) {
            pendingOpenBethesdaWeather = false;
            pushOriginalBethesdaWeather(fullWeather);
        } else {
            sendConsole("try{g.reset().setClipRect(0,0,239,239).clear(1);Dickens.loadSurround();g.setColor('#181820').fillCircleAA(119,119,92);g.setFontGrotesk14().setFontAlign(0,0).setColor('#E49E4C').drawString('CHARGEMENT WEATHER...',119,119);g.flip();}catch(e){}\n");
            fetchFullWeather(w, true);
        }
    }

    private void fetchFullWeather(MainActivityV071.FixWeatherData loc, boolean openWhenReady) {
        if (loc == null) return;
        String key = weatherLocationKey(loc);
        if (openWhenReady) pendingOpenBethesdaWeather = true;
        if (fullWeather != null && key.equals(fullWeatherKey)) {
            if (pendingOpenBethesdaWeather) {
                pendingOpenBethesdaWeather = false;
                pushOriginalBethesdaWeather(fullWeather);
            }
            return;
        }
        if (fullWeatherFetching) return;
        fullWeatherFetching = true;

        final double lat = loc.lat, lon = loc.lon;
        final String place = trim(ascii(loc.place).toUpperCase(Locale.ROOT), 14);
        new Thread(() -> {
            HttpURLConnection con = null;
            try {
                String q = "https://api.open-meteo.com/v1/forecast?latitude=" + String.format(Locale.ROOT, "%.5f", lat) +
                        "&longitude=" + String.format(Locale.ROOT, "%.5f", lon) +
                        "&hourly=temperature_2m,relative_humidity_2m,surface_pressure,precipitation_probability,wind_speed_10m,wind_gusts_10m" +
                        "&daily=weather_code&forecast_days=3&timezone=auto";
                con = (HttpURLConnection) new URL(q).openConnection();
                con.setConnectTimeout(10000);
                con.setReadTimeout(10000);
                con.setRequestProperty("User-Agent", "ChronomarkPlus/0.8.0");
                int code = con.getResponseCode();
                if (code < 200 || code >= 300) throw new Exception("HTTP " + code);
                BufferedReader br = new BufferedReader(new InputStreamReader(con.getInputStream(), StandardCharsets.UTF_8));
                StringBuilder raw = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) raw.append(line);
                br.close();
                FullWeatherData data = parseFullWeather(new JSONObject(raw.toString()), place, lat, lon);
                runOnUiThread(() -> {
                    fullWeather = data;
                    fullWeatherKey = key;
                    fullWeatherFetching = false;
                    if (pendingOpenBethesdaWeather && "weatherBase".equals(parentString("watchMode"))) {
                        pendingOpenBethesdaWeather = false;
                        pushOriginalBethesdaWeather(data);
                    }
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    fullWeatherFetching = false;
                    if (pendingOpenBethesdaWeather) {
                        pendingOpenBethesdaWeather = false;
                        Toast.makeText(this, "Impossible de charger les graphes Weather: " + e.getMessage(), Toast.LENGTH_LONG).show();
                        setParentField("watchMode", "");
                        sendConsole(WatchAppContract.exitToClockJs() + "\n");
                    }
                });
            } finally {
                if (con != null) con.disconnect();
            }
        }, "ChronomarkWeatherBase").start();
    }

    private FullWeatherData parseFullWeather(JSONObject root, String place, double lat, double lon) throws Exception {
        FullWeatherData out = new FullWeatherData();
        out.place = place;
        out.lat = lat;
        out.lon = lon;
        int utcOffset = root.optInt("utc_offset_seconds", 0);

        JSONObject h = root.getJSONObject("hourly");
        JSONArray times = h.getJSONArray("time");
        JSONArray temp = h.getJSONArray("temperature_2m");
        JSONArray hum = h.getJSONArray("relative_humidity_2m");
        JSONArray press = h.getJSONArray("surface_pressure");
        JSONArray pop = h.getJSONArray("precipitation_probability");
        JSONArray wind = h.getJSONArray("wind_speed_10m");
        JSONArray gust = h.getJSONArray("wind_gusts_10m");
        int n = Math.min(72, times.length());
        out.temperature = new double[n];
        out.humidity = new double[n];
        out.pressure = new double[n];
        out.precipProb = new double[n];
        out.windSpeed = new double[n];
        out.windGust = new double[n];
        for (int i = 0; i < n; i++) {
            out.temperature[i] = temp.optDouble(i, 0);
            out.humidity[i] = hum.optDouble(i, 0);
            out.pressure[i] = press.optDouble(i, 0);
            out.precipProb[i] = pop.optDouble(i, 0);
            out.windSpeed[i] = wind.optDouble(i, 0);
            out.windGust[i] = gust.optDouble(i, 0);
        }
        if (times.length() > 0) {
            try { out.timestamp = LocalDateTime.parse(times.getString(0)).toEpochSecond(ZoneOffset.ofTotalSeconds(utcOffset)); }
            catch (Exception ignored) { out.timestamp = System.currentTimeMillis() / 1000L; }
        } else out.timestamp = System.currentTimeMillis() / 1000L;

        JSONObject d = root.getJSONObject("daily");
        JSONArray codes = d.getJSONArray("weather_code");
        for (int i = 0; i < Math.min(3, codes.length()); i++) {
            String icon = weatherIconKey(codes.optInt(i, 0));
            out.icons.add(icon);
            out.summaries.add(icon.replace('-', ' '));
        }
        while (out.icons.size() < 3) { out.icons.add("cloudy"); out.summaries.add("cloudy"); }
        return out;
    }

    private void pushOriginalBethesdaWeather(FullWeatherData d) {
        if (!parentBoolean("consoleReady") || d == null) return;
        setWatchStatus("WATCH / WEATHER BETHESDA / LIVE DATA");

        sendConsole("global.__voxWeatherLive={locality:" + jsQuote(d.place) + ",units:'metric',timestamp:" + d.timestamp +
                ",icon:" + jsStringArray(d.icons) + ",summary:" + jsStringArray(d.summaries) +
                ",temperature:[],humidity:[],pressure:[],precipProb:[],windSpeed:[],windGust:[]};\n");
        sendArrayChunks("temperature", d.temperature);
        sendArrayChunks("humidity", d.humidity);
        sendArrayChunks("pressure", d.pressure);
        sendArrayChunks("precipProb", d.precipProb);
        sendArrayChunks("windSpeed", d.windSpeed);
        sendArrayChunks("windGust", d.windGust);

        String js = "(function(){try{" + WatchAppContract.suspendBethesdaClockJs() + WatchAppContract.beginSessionJs("WXBASE") +
                "var live=global.__voxWeatherLive,oldLoad=Dickens.loadWeather;Dickens.loadWeather=function(){return live;};" +
                "try{eval(require('Storage').read('weather.app.js'));}finally{Dickens.loadWeather=oldLoad;}" +
                "global.__voxWeatherLive=undefined;print('VOX'+'_V08:WEATHER_BASE_READY');" +
                "}catch(e){print('VOX'+'_V08:WEATHER_BASE_ERR:'+e);" + WatchAppContract.exitToClockJs() + "}})();\n";
        sendConsole(js);
    }

    private void sendArrayChunks(String field, double[] values) {
        final int CHUNK = 18;
        for (int off = 0; off < values.length; off += CHUNK) {
            StringBuilder s = new StringBuilder("global.__voxWeatherLive.").append(field).append(".push(");
            int end = Math.min(values.length, off + CHUNK);
            for (int i = off; i < end; i++) {
                if (i > off) s.append(',');
                s.append(String.format(Locale.ROOT, "%.2f", values[i]));
            }
            s.append(");\n");
            sendConsole(s.toString());
        }
    }

    // ---------------------------------------------------------------------
    // Phone Status + Find Phone
    // ---------------------------------------------------------------------

    private void launchPhoneStatus() {
        if (!parentBoolean("consoleReady")) {
            Toast.makeText(this, "Connecte d'abord la Chronomark.", Toast.LENGTH_LONG).show();
            return;
        }
        weatherHomeActive = false;
        phoneActive = true;
        setParentField("watchMode", "phone");
        PhoneSnapshot p = readPhoneSnapshot();
        phoneSignature = p.signature() + "|" + findPlaying;
        pushPhoneStatus(true);
    }

    private void pushPhoneStatus(boolean full) {
        if (!phoneActive || !parentBoolean("consoleReady")) return;
        PhoneSnapshot p = readPhoneSnapshot();
        String model = trim(ascii(p.model).toUpperCase(Locale.ROOT), 20);
        String charge = p.charging ? (p.full ? "CHARGE COMPLETE" : "EN CHARGE") : "SUR BATTERIE";
        if (p.plug.length() > 0 && p.charging && !p.full) charge += " / " + p.plug;

        if (!full) {
            sendConsole("(function(){var P=global.__voxPhone;if(!P||global.__voxActiveApp!=='PHONE')return;" +
                    "P.batt=" + p.battery + ";P.charge=" + jsQuote(charge) + ";P.net=" + jsQuote(p.network) +
                    ";P.ring=" + jsQuote(p.ringer) + ";P.find=" + (findPlaying ? "true" : "false") +
                    ";if(global.__voxPhoneDraw)global.__voxPhoneDraw();})();\n");
            return;
        }

        String js = "(function(){try{" + WatchAppContract.suspendBethesdaClockJs() + WatchAppContract.beginSessionJs("PHONE") +
                "var P=global.__voxPhone={batt:" + p.battery + ",charge:" + jsQuote(charge) +
                ",net:" + jsQuote(p.network) + ",ring:" + jsQuote(p.ringer) + ",model:" + jsQuote(model) +
                ",find:" + (findPlaying ? "true" : "false") + "};" +
                "global.__voxPhoneDraw=function(){if(global.__voxActiveApp!=='PHONE')return;" +
                "g.reset().setClipRect(0,0,239,239).clear(1);Dickens.buttonIcons=[null,'clock',null,null];Dickens.loadSurround();" +
                "g.setColor('#181820').fillCircleAA(119,119,92);g.setClipRect(36,32,202,194);" +
                "g.setFontArchitekt10().setFontAlign(0,0).setColor('#BFC8CC').drawString('PHONE STATUS',119,42);" +
                "g.setColor(P.batt<=20?'#E04B3F':'#E49E4C').setFontArchitekt35().drawString(P.batt+'%',119,82);" +
                "var bw=118,bx=119-bw/2;g.setColor('#3A4144').fillRect(bx,108,bx+bw,116);g.setColor(P.batt<=20?'#E04B3F':'#78C6BE').fillRect(bx,108,bx+bw*P.batt/100,116);" +
                "g.setFontArchitekt10().setColor('#FFF').drawString(P.charge,119,132);" +
                "g.setColor('#8FA1A7').drawString('RESEAU',78,151).drawString('SON',160,151);" +
                "g.setColor('#FFF').drawString(P.net,78,165).drawString(P.ring,160,165);" +
                "g.setColor('#9BA4A7').drawString(P.model,119,182);" +
                "g.setColor(P.find?'#E49E4C':'#00BCEB').drawString(P.find?'TELEPHONE SONNE - BTN1 STOP':'BTN1 TROUVER TELEPHONE',119,193);" +
                "g.setClipRect(0,0,239,239);g.flip();};" +
                "setWatch(function(){print('VOX'+'_V08:FIND');},BTN1,{edge:1,repeat:1});" +
                "setWatch(function(){print('VOX'+'_V08:PHONE_EXIT');load('clock.app.js');},BTN2,{edge:1,repeat:1});" +
                "setWatch(function(){print('VOX'+'_V08:PHONE_SYNC');},BTN3,{edge:1,repeat:1});" +
                "global.__voxPhoneDraw();print('VOX'+'_V08:PHONE_READY');" +
                "}catch(e){print('VOX'+'_V08:PHONE_ERR:'+e);load('clock.app.js');}})();\n";
        sendConsole(js);
        setWatchStatus("WATCH / PHONE STATUS / RAM ONLY");
    }

    @Override
    protected void onV08WatchLine(String line) {
        if (line == null) return;
        runOnUiThread(() -> {
            if (line.contains("VOX_V08:FIND")) {
                toggleFindPhone();
            } else if (line.contains("VOX_V08:PHONE_SYNC")) {
                if (phoneActive) pushPhoneStatus(false);
            } else if (line.contains("VOX_V08:PHONE_EXIT")) {
                phoneActive = false;
                phoneSignature = "";
                setParentField("watchMode", "");
                setWatchStatus("WATCH / BETHESDA CLOCK");
            } else if (line.contains("VOX_V08:WEATHER_CHARTS")) {
                requestBethesdaWeather();
            } else if (line.contains("VOX_V08:WEATHER_SYNC")) {
                if (weatherHomeActive) pushWeatherHome(false);
            } else if (line.contains("VOX_V08:WEATHER_EXIT")) {
                weatherHomeActive = false;
                weatherHomeSignature = "";
                setParentField("watchMode", "");
                setWatchStatus("WATCH / BETHESDA CLOCK");
            } else if (line.contains("VOX_V08:WEATHER_BASE_READY")) {
                setWatchStatus("WATCH / WEATHER BETHESDA / LIVE DATA");
            } else if (line.contains("VOX_V08:WEATHER_BASE_ERR:")) {
                setWatchStatus("WATCH / WEATHER BETHESDA ERROR");
            } else if (line.contains("VOX_V08:PHONE_READY")) {
                setWatchStatus("WATCH / PHONE STATUS / RAM ONLY");
            }
        });
    }

    private void toggleFindPhone() {
        if (findPlaying) stopFindPhone(true);
        else startFindPhone();
    }

    private void startFindPhone() {
        try {
            stopFindPhone(false);
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            findRingtone = RingtoneManager.getRingtone(this, uri);
            if (findRingtone == null) {
                uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                findRingtone = RingtoneManager.getRingtone(this, uri);
            }
            if (findRingtone != null) {
                AudioAttributes attrs = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                findRingtone.setAudioAttributes(attrs);
                if (Build.VERSION.SDK_INT >= 28) findRingtone.setLooping(true);
                findRingtone.play();
            }

            findVibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (findVibrator != null && findVibrator.hasVibrator()) {
                long[] pattern = new long[]{0, 450, 250, 450, 700};
                findVibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
            }
            findPlaying = true;
            findHandler.removeCallbacksAndMessages(null);
            findHandler.postDelayed(() -> stopFindPhone(true), 30000L);
            Toast.makeText(this, "Find Phone actif pendant 30 secondes.", Toast.LENGTH_SHORT).show();
            if (phoneActive) pushPhoneStatus(false);
        } catch (Exception e) {
            findPlaying = false;
            Toast.makeText(this, "Find Phone: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void stopFindPhone(boolean updateWatch) {
        try { if (findRingtone != null) findRingtone.stop(); } catch (Exception ignored) {}
        try { if (findVibrator != null) findVibrator.cancel(); } catch (Exception ignored) {}
        findRingtone = null;
        findVibrator = null;
        boolean changed = findPlaying;
        findPlaying = false;
        findHandler.removeCallbacksAndMessages(null);
        if (updateWatch && changed && phoneActive) pushPhoneStatus(false);
    }

    private PhoneSnapshot readPhoneSnapshot() {
        PhoneSnapshot p = new PhoneSnapshot();
        p.model = Build.MANUFACTURER + " " + Build.MODEL;

        try {
            Intent b = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            if (b != null) {
                int level = b.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                int scale = b.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
                p.battery = level < 0 ? 0 : Math.max(0, Math.min(100, Math.round(level * 100f / Math.max(1, scale))));
                int status = b.getIntExtra(BatteryManager.EXTRA_STATUS, BatteryManager.BATTERY_STATUS_UNKNOWN);
                p.charging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL;
                p.full = status == BatteryManager.BATTERY_STATUS_FULL;
                int plugged = b.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0);
                if (plugged == BatteryManager.BATTERY_PLUGGED_USB) p.plug = "USB";
                else if (plugged == BatteryManager.BATTERY_PLUGGED_AC) p.plug = "SECTEUR";
                else if (plugged == BatteryManager.BATTERY_PLUGGED_WIRELESS) p.plug = "SANS FIL";
                else p.plug = "";
            }
        } catch (Exception ignored) {}

        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
            Network n = cm == null ? null : cm.getActiveNetwork();
            NetworkCapabilities c = (cm == null || n == null) ? null : cm.getNetworkCapabilities(n);
            if (c == null) p.network = "HORS LIGNE";
            else if (c.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) p.network = "WIFI";
            else if (c.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) p.network = "MOBILE";
            else if (c.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) p.network = "ETHERNET";
            else if (c.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) p.network = "VPN";
            else p.network = "CONNECTE";
        } catch (Exception e) { p.network = "?"; }

        try {
            AudioManager am = (AudioManager) getSystemService(AUDIO_SERVICE);
            int mode = am == null ? AudioManager.RINGER_MODE_NORMAL : am.getRingerMode();
            if (mode == AudioManager.RINGER_MODE_SILENT) p.ringer = "SILENCE";
            else if (mode == AudioManager.RINGER_MODE_VIBRATE) p.ringer = "VIBREUR";
            else p.ringer = "SONNERIE";
        } catch (Exception e) { p.ringer = "?"; }
        return p;
    }

    // ---------------------------------------------------------------------
    // Shared helpers
    // ---------------------------------------------------------------------

    private MainActivityV071.FixWeatherData getWeather() {
        try {
            Field f = MainActivityV071.class.getDeclaredField("wx");
            f.setAccessible(true);
            return (MainActivityV071.FixWeatherData) f.get(this);
        } catch (Exception e) { return null; }
    }

    private boolean parentBoolean(String name) {
        try {
            Field f = MainActivityV07.class.getDeclaredField(name);
            f.setAccessible(true);
            return f.getBoolean(this);
        } catch (Exception e) { return false; }
    }

    private String parentString(String name) {
        try {
            Field f = MainActivityV07.class.getDeclaredField(name);
            f.setAccessible(true);
            Object v = f.get(this);
            return v == null ? "" : v.toString();
        } catch (Exception e) { return ""; }
    }

    private void setParentField(String name, Object value) {
        try {
            Field f = MainActivityV07.class.getDeclaredField(name);
            f.setAccessible(true);
            f.set(this, value);
        } catch (Exception ignored) {}
    }

    private void setWatchStatus(String s) {
        try {
            Field f = MainActivityV07.class.getDeclaredField("watchStatus");
            f.setAccessible(true);
            TextView t = (TextView) f.get(this);
            if (t != null) t.setText(s);
        } catch (Exception ignored) {}
    }

    private void sendConsole(String text) {
        try {
            Method m = MainActivityV07.class.getDeclaredMethod("sendConsole", String.class);
            m.setAccessible(true);
            m.invoke(this, text);
        } catch (Exception e) {
            Toast.makeText(this, "Erreur pont Chronomark: " + e.getClass().getSimpleName(), Toast.LENGTH_LONG).show();
        }
    }

    private String weatherHomeSignature(MainActivityV071.FixWeatherData w) {
        return w.place + "|" + Math.round(w.temp) + "|" + Math.round(w.feels) + "|" + Math.round(w.nextRainChance) + "|" + w.condition;
    }

    private String weatherLocationKey(MainActivityV071.FixWeatherData w) {
        return String.format(Locale.ROOT, "%.2f|%.2f", w.lat, w.lon);
    }

    private String weatherIconKey(int code) {
        if (code == 0) return "clear-day";
        if (code == 1 || code == 2) return "partly-cloudy-day";
        if (code == 3) return "cloudy";
        if (code == 45 || code == 48) return "fog";
        if (code >= 71 && code <= 77) return "snow";
        if (code >= 85 && code <= 86) return "snow";
        if (code >= 95) return "storm";
        if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
        return "cloudy";
    }

    private String jsStringArray(List<String> in) {
        StringBuilder s = new StringBuilder("[");
        for (int i = 0; i < in.size(); i++) { if (i > 0) s.append(','); s.append(jsQuote(in.get(i))); }
        return s.append(']').toString();
    }

    private String phoneSummary(PhoneSnapshot p) {
        return p.battery + "% / " + (p.charging ? (p.full ? "charge complete" : "en charge") : "batterie") +
                " / " + p.network + " / " + p.ringer + (findPlaying ? " / FIND PHONE ACTIF" : "");
    }

    private String ascii(String s) {
        if (s == null) return "";
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "")
                .replace('’', '\'').replace('–', '-').replace('—', '-');
    }

    private String trim(String s, int max) {
        if (s == null) return "";
        s = s.replace('\n', ' ').replace('\r', ' ').trim();
        return s.length() <= max ? s : s.substring(0, max);
    }

    private String jsQuote(String s) {
        if (s == null) s = "";
        StringBuilder o = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            switch (ch) {
                case '\\': o.append("\\\\"); break;
                case '"': o.append("\\\""); break;
                case '\n': o.append("\\n"); break;
                case '\r': o.append("\\r"); break;
                case '\t': o.append("\\t"); break;
                default:
                    if (ch < 32 || ch > 126) {
                        String h = Integer.toHexString(ch);
                        o.append("\\u");
                        for (int z = h.length(); z < 4; z++) o.append('0');
                        o.append(h);
                    } else o.append(ch);
            }
        }
        return o.append('"').toString();
    }

    private TextView findTextContains(View root, String needle) {
        if (root instanceof TextView) {
            CharSequence t = ((TextView) root).getText();
            if (t != null && t.toString().contains(needle)) return (TextView) root;
        }
        if (root instanceof ViewGroup) {
            ViewGroup g = (ViewGroup) root;
            for (int i = 0; i < g.getChildCount(); i++) {
                TextView found = findTextContains(g.getChildAt(i), needle);
                if (found != null) return found;
            }
        }
        return null;
    }

    private Button findButtonContains(View root, String needle) {
        TextView t = findTextContains(root, needle);
        return t instanceof Button ? (Button) t : null;
    }

    private TextView makeText(String text, int sp, int color) {
        TextView t = new TextView(this);
        t.setText(text);
        t.setTextSize(sp);
        t.setTextColor(color);
        return t;
    }

    private LinearLayout.LayoutParams lp(int h) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, h);
        p.setMargins(0, dp(3), 0, dp(3));
        return p;
    }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    static class PhoneSnapshot {
        int battery;
        boolean charging, full;
        String plug = "", network = "?", ringer = "?", model = "";
        String signature() { return battery + "|" + charging + "|" + full + "|" + plug + "|" + network + "|" + ringer; }
    }

    static class FullWeatherData {
        double lat, lon;
        String place;
        long timestamp;
        double[] temperature, humidity, pressure, precipProb, windSpeed, windGust;
        List<String> icons = new ArrayList<>();
        List<String> summaries = new ArrayList<>();
    }
}
