package fr.vox.chronomarkplus;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Base64;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Queue;
import java.util.Set;
import java.util.UUID;

public class MainActivityV07 extends Activity {
    private static final int REQ_BT = 1001;
    private static final int REQ_LOC = 1002;
    private static final int UART_CHUNK = 96;
    private static final int ART_SIZE = 120;
    private static final int ART_SEND_CHUNK = 420;

    private static final UUID NUS_SERVICE = UUID.fromString("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID NUS_RX = UUID.fromString("6e400002-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID NUS_TX = UUID.fromString("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Set<String> seen = new HashSet<>();
    private final Queue<byte[]> writeQueue = new ArrayDeque<>();
    private final StringBuilder watchRx = new StringBuilder();

    private MediaSessionManager mediaSessionManager;
    private ComponentName listenerComponent;
    private MediaController primaryController;
    private String lastWatchTrackKey = "";
    private long lastWatchStatePush;
    private String watchMode = "";

    private BluetoothAdapter adapter;
    private BluetoothLeScanner scanner;
    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic uartRx;
    private BluetoothGattCharacteristic uartTx;
    private boolean scanning;
    private boolean consoleReady;
    private boolean writeInFlight;

    private WeatherData weatherData;
    private LocationListener oneShotLocationListener;

    private TextView mediaAccessState;
    private ImageView artwork;
    private TextView mediaState;
    private TextView mediaApp;
    private TextView mediaTitle;
    private TextView mediaArtist;
    private TextView mediaTime;
    private TextView weatherStatus;
    private TextView weatherSummary;
    private TextView watchStatus;
    private LinearLayout deviceList;
    private TextView log;
    private Button scanButton;
    private Button musicButton;
    private Button weatherButton;
    private Button syncButton;
    private Button returnButton;
    private Button fetchWeatherButton;

    private boolean running;

    private final Runnable ticker = new Runnable() {
        @Override public void run() {
            if (!running) return;
            MediaSnapshot s = refreshMedia();
            if ("music".equals(watchMode) && consoleReady && s != null) {
                String key = s.packageName + "|" + s.title + "|" + s.artist + "|" + s.durationMs;
                long now = SystemClock.elapsedRealtime();
                if (!key.equals(lastWatchTrackKey)) {
                    lastWatchTrackKey = key;
                    pushFullMusicToWatch(s);
                } else if (now - lastWatchStatePush >= 5000) {
                    pushMusicState(s);
                }
            }
            handler.postDelayed(this, 1000);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mediaSessionManager = (MediaSessionManager) getSystemService(MEDIA_SESSION_SERVICE);
        listenerComponent = new ComponentName(this, MediaProbeNotificationListener.class);

        BluetoothManager manager = getSystemService(BluetoothManager.class);
        adapter = manager == null ? null : manager.getAdapter();
        scanner = adapter == null ? null : adapter.getBluetoothLeScanner();

        buildUi();
        requestBtPermissionsIfNeeded();
        refreshMedia();

        append("CHRONOMARK+ v0.7.0 / MUSIC CONTROL+ + WEATHER+ LAB");
        append("WATCH POLICY: RAM ONLY. NO Storage.write / erase / save / Flash / DFU.");
        append("Music: Bethesda-style layout + full-screen album art + adaptive accent.");
        append("Weather+: live phone location + Open-Meteo bridge prototype.");
    }

    @Override protected void onResume() {
        super.onResume();
        running = true;
        handler.removeCallbacks(ticker);
        handler.post(ticker);
    }

    @Override protected void onPause() {
        running = false;
        handler.removeCallbacks(ticker);
        super.onPause();
    }

    @Override protected void onDestroy() {
        running = false;
        handler.removeCallbacks(ticker);
        stopOneShotLocation();
        closeGatt();
        super.onDestroy();
    }

    private void buildUi() {
        ScrollView outer = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(18), dp(18), dp(24));
        root.setBackgroundColor(Color.rgb(15, 19, 22));
        outer.addView(root);

        TextView title = text("CHRONOMARK+", 30, Color.rgb(240,231,205));
        title.setLetterSpacing(0.08f);
        root.addView(title);
        TextView sub = text("MUSIC CONTROL+ / WEATHER+ / v0.7.0", 13, Color.rgb(211,71,54));
        sub.setPadding(0,0,0,dp(12));
        root.addView(sub);

        TextView safety = text("RAM-ONLY WATCH PROTOTYPES / BETHESDA STORAGE UNTOUCHED", 11, Color.rgb(122,198,190));
        safety.setPadding(dp(10),dp(10),dp(10),dp(10));
        safety.setBackgroundColor(Color.rgb(27,34,38));
        root.addView(safety, lp(-1,-2));

        root.addView(label("ANDROID MEDIA"));
        mediaAccessState = text("CHECKING...", 12, Color.WHITE);
        root.addView(mediaAccessState);
        Button mediaAccess = button("ENABLE MEDIA ACCESS");
        mediaAccess.setOnClickListener(v -> {
            try { startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)); }
            catch (Exception e) { Toast.makeText(this, "Impossible d'ouvrir l'accès aux notifications.", Toast.LENGTH_LONG).show(); }
        });
        root.addView(mediaAccess, lp(-1, dp(46)));

        artwork = new ImageView(this);
        artwork.setAdjustViewBounds(true);
        artwork.setScaleType(ImageView.ScaleType.CENTER_CROP);
        artwork.setBackgroundColor(Color.rgb(7,10,12));
        root.addView(artwork, lp(-1, dp(200)));

        mediaState = text("NO ACTIVE SESSION", 12, Color.rgb(122,198,190));
        mediaState.setPadding(0,dp(8),0,0);
        root.addView(mediaState);
        mediaApp = text("-", 11, Color.rgb(164,169,167));
        root.addView(mediaApp);
        mediaTitle = text("-", 19, Color.rgb(240,231,205));
        mediaTitle.setPadding(0,dp(4),0,0);
        root.addView(mediaTitle);
        mediaArtist = text("-", 14, Color.rgb(228,158,76));
        root.addView(mediaArtist);
        mediaTime = text("00:00 / 00:00", 15, Color.WHITE);
        root.addView(mediaTime);

        root.addView(label("WEATHER+ / PHONE DATA"));
        weatherStatus = text("WEATHER / NOT LOADED", 12, Color.rgb(228,158,76));
        weatherStatus.setPadding(dp(10),dp(8),dp(10),dp(8));
        weatherStatus.setBackgroundColor(Color.rgb(27,34,38));
        root.addView(weatherStatus, lp(-1,-2));
        weatherSummary = text("Current + feels-like + rain chance + hourly + sunrise/sunset", 12, Color.rgb(164,169,167));
        weatherSummary.setPadding(0,dp(6),0,dp(4));
        root.addView(weatherSummary);
        fetchWeatherButton = button("FETCH WEATHER+ FROM PHONE LOCATION");
        fetchWeatherButton.setOnClickListener(v -> fetchWeather());
        root.addView(fetchWeatherButton, lp(-1,dp(48)));

        root.addView(label("CHRONOMARK CONNECTION"));
        watchStatus = text("WATCH / NOT CONNECTED", 12, Color.rgb(228,158,76));
        watchStatus.setPadding(dp(10),dp(8),dp(10),dp(8));
        watchStatus.setBackgroundColor(Color.rgb(27,34,38));
        root.addView(watchStatus, lp(-1,-2));

        scanButton = button("SCAN FOR CHRONOMARK");
        scanButton.setOnClickListener(v -> startScan());
        root.addView(scanButton, lp(-1, dp(48)));

        deviceList = new LinearLayout(this);
        deviceList.setOrientation(LinearLayout.VERTICAL);
        root.addView(deviceList, lp(-1,-2));

        root.addView(label("WATCH PROTOTYPES / RAM ONLY"));
        musicButton = button("LAUNCH MUSIC CONTROL+ / 120s");
        musicButton.setEnabled(false);
        musicButton.setOnClickListener(v -> launchMusicPlus());
        root.addView(musicButton, lp(-1,dp(50)));

        weatherButton = button("LAUNCH WEATHER+ / 120s");
        weatherButton.setEnabled(false);
        weatherButton.setOnClickListener(v -> launchWeatherPlus());
        root.addView(weatherButton, lp(-1,dp(50)));

        LinearLayout controls = new LinearLayout(this);
        controls.setOrientation(LinearLayout.HORIZONTAL);
        syncButton = button("SYNC CURRENT");
        returnButton = button("RETURN TO CLOCK");
        syncButton.setEnabled(false);
        returnButton.setEnabled(false);
        syncButton.setOnClickListener(v -> syncCurrentMode());
        returnButton.setOnClickListener(v -> returnToClock());
        controls.addView(syncButton, new LinearLayout.LayoutParams(0,dp(46),1f));
        controls.addView(returnButton, new LinearLayout.LayoutParams(0,dp(46),1f));
        root.addView(controls);

        TextView controlsHelp = text("MUSIC: BTN1 play/pause • BTN2 clock • BTN3 next/hold vol- • BTN4 previous/hold vol+\nWEATHER+: BTN1 page • BTN2 clock • BTN3/BTN4 page", 10, Color.rgb(164,169,167));
        controlsHelp.setPadding(0,dp(5),0,dp(8));
        root.addView(controlsHelp);

        root.addView(label("LIVE BRIDGE LOG"));
        log = text("", 10, Color.rgb(219,219,210));
        log.setTypeface(android.graphics.Typeface.MONOSPACE);
        log.setPadding(dp(10),dp(10),dp(10),dp(10));
        log.setBackgroundColor(Color.rgb(7,10,12));
        log.setTextIsSelectable(true);
        root.addView(log, lp(-1,dp(330)));

        setContentView(outer);
    }

    private MediaSnapshot refreshMedia() {
        boolean access = isNotificationListenerEnabled();
        mediaAccessState.setText(access ? "ACCESS / ENABLED / MEDIA SESSIONS AVAILABLE" : "ACCESS / REQUIRED");
        mediaAccessState.setTextColor(access ? Color.rgb(122,198,190) : Color.rgb(228,158,76));
        if (!access || mediaSessionManager == null) {
            primaryController = null;
            renderNoMedia("Notification access required.");
            return null;
        }

        List<MediaController> list;
        try { list = mediaSessionManager.getActiveSessions(listenerComponent); }
        catch (Exception e) {
            primaryController = null;
            renderNoMedia("MediaSession error.");
            return null;
        }
        if (list == null || list.isEmpty()) {
            primaryController = null;
            renderNoMedia("No active MediaSession.");
            return null;
        }

        primaryController = choosePrimary(list);
        MediaSnapshot s = snapshot(primaryController);
        renderMedia(s);
        return s;
    }

    private MediaController choosePrimary(List<MediaController> list) {
        for (MediaController c : list) {
            PlaybackState ps = c.getPlaybackState();
            if (ps != null && ps.getState() == PlaybackState.STATE_PLAYING) return c;
        }
        return list.get(0);
    }

    private MediaSnapshot snapshot(MediaController c) {
        MediaSnapshot s = new MediaSnapshot();
        s.packageName = c.getPackageName();
        s.appLabel = getAppLabel(s.packageName);
        MediaMetadata md = c.getMetadata();
        PlaybackState ps = c.getPlaybackState();
        s.title = md == null ? "" : value(md, MediaMetadata.METADATA_KEY_TITLE, MediaMetadata.METADATA_KEY_DISPLAY_TITLE);
        s.artist = md == null ? "" : value(md, MediaMetadata.METADATA_KEY_ARTIST, MediaMetadata.METADATA_KEY_ALBUM_ARTIST, MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE);
        s.album = md == null ? "" : value(md, MediaMetadata.METADATA_KEY_ALBUM);
        s.durationMs = md == null ? 0 : Math.max(0, md.getLong(MediaMetadata.METADATA_KEY_DURATION));
        s.positionMs = estimatePosition(ps);
        s.playing = ps != null && ps.getState() == PlaybackState.STATE_PLAYING;
        s.art = md == null ? null : getArtwork(md);
        if (TextUtils.isEmpty(s.title)) {
            MediaProbeNotificationListener.MediaNotice n = MediaProbeNotificationListener.getNotice(s.packageName);
            if (n != null) {
                s.title = nullToEmpty(n.title);
                if (TextUtils.isEmpty(s.artist)) s.artist = firstNonEmpty(n.text, n.subText);
            }
        }
        if (TextUtils.isEmpty(s.title)) s.title = "Untitled";
        if (TextUtils.isEmpty(s.artist)) s.artist = s.appLabel;
        return s;
    }

    private void renderMedia(MediaSnapshot s) {
        mediaState.setText("ACTIVE / " + (s.playing ? "PLAYING" : "PAUSED / STOPPED"));
        mediaApp.setText(s.appLabel + " / " + s.packageName);
        mediaTitle.setText(s.title);
        mediaArtist.setText(s.artist);
        mediaTime.setText(formatTime(s.positionMs) + " / " + formatTime(s.durationMs));
        if (s.art != null) artwork.setImageBitmap(s.art); else artwork.setImageDrawable(null);
    }

    private void renderNoMedia(String msg) {
        mediaState.setText("NO ACTIVE MEDIA SESSION");
        mediaApp.setText(msg);
        mediaTitle.setText("-");
        mediaArtist.setText("-");
        mediaTime.setText("00:00 / 00:00");
        artwork.setImageDrawable(null);
    }

    private void fetchWeather() {
        if (!hasLocationPermission()) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION}, REQ_LOC);
            weatherStatus.setText("WEATHER / LOCATION PERMISSION REQUIRED");
            return;
        }
        final LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        if (lm == null) {
            weatherStatus.setText("WEATHER / LOCATION SERVICE UNAVAILABLE");
            return;
        }
        weatherStatus.setText("WEATHER / GETTING PHONE LOCATION...");
        Location best = bestLastKnownLocation(lm);
        if (best != null) {
            fetchWeatherAt(best);
            return;
        }
        stopOneShotLocation();
        oneShotLocationListener = new LocationListener() {
            @Override public void onLocationChanged(Location location) {
                stopOneShotLocation();
                fetchWeatherAt(location);
            }
            @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
            @Override public void onProviderEnabled(String provider) {}
            @Override public void onProviderDisabled(String provider) {}
        };
        try {
            if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER))
                lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 0, 0, oneShotLocationListener, Looper.getMainLooper());
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER))
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 0, 0, oneShotLocationListener, Looper.getMainLooper());
        } catch (SecurityException e) {
            weatherStatus.setText("WEATHER / LOCATION DENIED");
            return;
        }
        handler.postDelayed(() -> {
            if (oneShotLocationListener != null) {
                stopOneShotLocation();
                weatherStatus.setText("WEATHER / NO LOCATION FIX / TRY AGAIN");
            }
        }, 12000);
    }

    @SuppressLint("MissingPermission")
    private Location bestLastKnownLocation(LocationManager lm) {
        Location best = null;
        String[] providers = new String[]{LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER, LocationManager.PASSIVE_PROVIDER};
        for (String p : providers) {
            try {
                Location l = lm.getLastKnownLocation(p);
                if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
            } catch (Exception ignored) {}
        }
        return best;
    }

    private void stopOneShotLocation() {
        if (oneShotLocationListener == null) return;
        try {
            LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
            if (lm != null && hasLocationPermission()) lm.removeUpdates(oneShotLocationListener);
        } catch (Exception ignored) {}
        oneShotLocationListener = null;
    }

    private void fetchWeatherAt(Location loc) {
        final double lat = loc.getLatitude();
        final double lon = loc.getLongitude();
        weatherStatus.setText(String.format(Locale.ROOT,"WEATHER / FETCHING %.3f, %.3f",lat,lon));
        fetchWeatherButton.setEnabled(false);
        new Thread(() -> {
            HttpURLConnection con = null;
            try {
                String q = "https://api.open-meteo.com/v1/forecast?latitude=" + String.format(Locale.ROOT,"%.5f",lat) +
                        "&longitude=" + String.format(Locale.ROOT,"%.5f",lon) +
                        "&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m" +
                        "&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code" +
                        "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max" +
                        "&forecast_days=3&timezone=auto";
                con = (HttpURLConnection) new URL(q).openConnection();
                con.setConnectTimeout(10000);
                con.setReadTimeout(10000);
                con.setRequestProperty("User-Agent","ChronomarkPlus/0.7.0");
                int code = con.getResponseCode();
                if (code < 200 || code >= 300) throw new Exception("HTTP " + code);
                BufferedReader br = new BufferedReader(new InputStreamReader(con.getInputStream(), StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) sb.append(line);
                br.close();
                WeatherData wd = parseWeather(new JSONObject(sb.toString()),lat,lon);
                runOnUiThread(() -> {
                    weatherData = wd;
                    weatherStatus.setText("WEATHER / LIVE DATA READY / " + wd.timezone);
                    weatherSummary.setText(String.format(Locale.ROOT,"%.0f°C • feels %.0f°C • %s • rain %.0f%% • wind %.0f km/h",wd.temp,wd.feels,wd.condition,wd.nextRainChance,wd.wind));
                    fetchWeatherButton.setEnabled(true);
                    updateWatchButtons();
                    append("WEATHER READY " + wd.condition + " / " + wd.temp + "C / rain " + wd.nextRainChance + "%");
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    weatherStatus.setText("WEATHER / FETCH ERROR");
                    weatherSummary.setText(e.getClass().getSimpleName() + ": " + e.getMessage());
                    fetchWeatherButton.setEnabled(true);
                    append("WEATHER ERROR " + e);
                });
            } finally {
                if (con != null) con.disconnect();
            }
        },"ChronomarkWeather").start();
    }

    private WeatherData parseWeather(JSONObject root,double lat,double lon) throws Exception {
        WeatherData w = new WeatherData();
        w.lat=lat; w.lon=lon;
        w.timezone=root.optString("timezone","local");
        JSONObject cur=root.getJSONObject("current");
        w.currentTime=cur.optString("time","");
        w.temp=cur.optDouble("temperature_2m",0);
        w.feels=cur.optDouble("apparent_temperature",w.temp);
        w.humidity=cur.optDouble("relative_humidity_2m",0);
        w.precip=cur.optDouble("precipitation",0);
        w.code=cur.optInt("weather_code",0);
        w.wind=cur.optDouble("wind_speed_10m",0);
        w.condition=wmoText(w.code);

        JSONObject hourly=root.getJSONObject("hourly");
        JSONArray ht=hourly.getJSONArray("time");
        JSONArray htemp=hourly.getJSONArray("temperature_2m");
        JSONArray happ=hourly.getJSONArray("apparent_temperature");
        JSONArray hpop=hourly.getJSONArray("precipitation_probability");
        JSONArray hcode=hourly.getJSONArray("weather_code");
        int idx=0;
        String hourKey=w.currentTime.length()>=13?w.currentTime.substring(0,13):w.currentTime;
        for(int i=0;i<ht.length();i++) {
            String t=ht.optString(i,"");
            if(t.startsWith(hourKey)){idx=i;break;}
        }
        for(int j=0;j<6 && idx+j<ht.length();j++) {
            HourPoint hp=new HourPoint();
            hp.time=ht.optString(idx+j,"");
            hp.temp=htemp.optDouble(idx+j,0);
            hp.feels=happ.optDouble(idx+j,hp.temp);
            hp.pop=hpop.optDouble(idx+j,0);
            hp.code=hcode.optInt(idx+j,0);
            w.hours.add(hp);
        }
        w.nextRainChance=w.hours.isEmpty()?0:w.hours.get(0).pop;

        JSONObject daily=root.getJSONObject("daily");
        w.min=daily.getJSONArray("temperature_2m_min").optDouble(0,w.temp);
        w.max=daily.getJSONArray("temperature_2m_max").optDouble(0,w.temp);
        w.sunrise=shortClock(daily.getJSONArray("sunrise").optString(0,""));
        w.sunset=shortClock(daily.getJSONArray("sunset").optString(0,""));
        w.popMax=daily.getJSONArray("precipitation_probability_max").optDouble(0,w.nextRainChance);
        return w;
    }

    private String shortClock(String iso) {
        int t=iso.indexOf('T');
        if(t>=0 && iso.length()>=t+6) return iso.substring(t+1,t+6);
        return iso;
    }

    private String wmoText(int c) {
        if(c==0) return "Clear";
        if(c==1) return "Mostly clear";
        if(c==2) return "Partly cloudy";
        if(c==3) return "Overcast";
        if(c==45||c==48) return "Fog";
        if(c>=51&&c<=57) return "Drizzle";
        if(c>=61&&c<=67) return "Rain";
        if(c>=71&&c<=77) return "Snow";
        if(c>=80&&c<=82) return "Showers";
        if(c>=85&&c<=86) return "Snow showers";
        if(c>=95) return "Thunderstorm";
        return "Weather";
    }

    @SuppressLint("MissingPermission")
    private void startScan() {
        if (!hasBtPermissions()) {
            requestBtPermissionsIfNeeded();
            return;
        }
        if (adapter == null || !adapter.isEnabled()) {
            Toast.makeText(this, "Active le Bluetooth puis relance le scan.", Toast.LENGTH_LONG).show();
            return;
        }
        if (scanner == null) scanner = adapter.getBluetoothLeScanner();
        if (scanner == null) return;
        if (scanning) { stopScan(); return; }
        deviceList.removeAllViews();
        seen.clear();
        scanning = true;
        scanButton.setText("STOP SCAN");
        watchStatus.setText("WATCH / SCANNING 12s");
        scanner.startScan(scanCallback);
        handler.postDelayed(this::stopScan, 12000);
    }

    @SuppressLint("MissingPermission")
    private void stopScan() {
        if (!scanning) return;
        scanning = false;
        scanButton.setText("SCAN FOR CHRONOMARK");
        try { if (scanner != null && hasBtPermissions()) scanner.stopScan(scanCallback); } catch (Exception ignored) {}
        watchStatus.setText(consoleReady ? "WATCH / ESPRUINO READY" : "WATCH / SCAN COMPLETE");
    }

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override public void onScanResult(int callbackType, ScanResult result) { showScan(result); }
        @Override public void onBatchScanResults(List<ScanResult> results) { for (ScanResult r : results) showScan(r); }
        @Override public void onScanFailed(int errorCode) { runOnUiThread(() -> watchStatus.setText("WATCH / SCAN FAILED " + errorCode)); }
    };

    @SuppressLint("MissingPermission")
    private void showScan(ScanResult result) {
        BluetoothDevice d = result.getDevice();
        if (d == null || !seen.add(d.getAddress())) return;
        String name = null;
        try { name = d.getName(); } catch (Exception ignored) {}
        if ((name == null || name.isEmpty()) && result.getScanRecord() != null) name = result.getScanRecord().getDeviceName();
        if (name == null || name.isEmpty()) name = "Unnamed BLE device";
        String low = name.toLowerCase(Locale.ROOT);
        boolean likely = low.contains("chronomark") || low.contains("dickens") || low.contains("dfutarg");
        if (!likely) return;
        final String n = name;
        runOnUiThread(() -> {
            Button b = button("★ " + n + "\n" + d.getAddress() + "   RSSI " + result.getRssi());
            b.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
            b.setOnClickListener(v -> connect(d,n));
            deviceList.addView(b, lp(-1,dp(58)));
        });
    }

    @SuppressLint("MissingPermission")
    private void connect(BluetoothDevice d, String name) {
        stopScan();
        closeGatt();
        consoleReady = false;
        watchMode = "";
        writeQueue.clear();
        writeInFlight = false;
        uartRx = null;
        uartTx = null;
        watchRx.setLength(0);
        updateWatchButtons();
        watchStatus.setText("WATCH / CONNECTING " + name);
        append("CONNECT " + name + " / " + d.getAddress());
        gatt = d.connectGatt(this,false,gattCallback,BluetoothDevice.TRANSPORT_LE);
    }

    private final BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
        @Override public void onConnectionStateChange(BluetoothGatt bg, int status, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                append("BLE connected status=" + status);
                runOnUiThread(() -> watchStatus.setText("WATCH / CONNECTED / DISCOVERING"));
                try { bg.requestMtu(185); } catch (Exception ignored) {}
                try { bg.discoverServices(); } catch (Exception e) { append("discoverServices: " + e); }
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                consoleReady = false;
                watchMode = "";
                append("BLE disconnected status=" + status);
                runOnUiThread(() -> {
                    watchStatus.setText("WATCH / DISCONNECTED");
                    updateWatchButtons();
                });
            }
        }

        @Override public void onMtuChanged(BluetoothGatt bg, int mtu, int status) { append("MTU " + mtu + " status=" + status); }

        @Override public void onServicesDiscovered(BluetoothGatt bg, int status) {
            BluetoothGattService nus = bg.getService(NUS_SERVICE);
            if (nus == null) {
                runOnUiThread(() -> watchStatus.setText("WATCH / NUS NOT FOUND"));
                return;
            }
            uartRx = nus.getCharacteristic(NUS_RX);
            uartTx = nus.getCharacteristic(NUS_TX);
            if (uartRx == null || uartTx == null) {
                runOnUiThread(() -> watchStatus.setText("WATCH / UART INCOMPLETE"));
                return;
            }
            enableNotifications(bg);
        }

        @Override public void onDescriptorWrite(BluetoothGatt bg, BluetoothGattDescriptor descriptor, int status) {
            if (CCCD.equals(descriptor.getUuid()) && status == BluetoothGatt.GATT_SUCCESS) {
                consoleReady = true;
                append("ESPRUINO UART READY");
                runOnUiThread(() -> {
                    watchStatus.setText("WATCH / ESPRUINO READY / RAM ONLY");
                    updateWatchButtons();
                });
            }
        }

        @Override public void onCharacteristicChanged(BluetoothGatt bg, BluetoothGattCharacteristic c) { handleNotify(c.getValue()); }
        @Override public void onCharacteristicChanged(BluetoothGatt bg, BluetoothGattCharacteristic c, byte[] value) { handleNotify(value); }
        @Override public void onCharacteristicWrite(BluetoothGatt bg, BluetoothGattCharacteristic c, int status) {
            writeInFlight = false;
            if (status != BluetoothGatt.GATT_SUCCESS) append("UART write status=" + status);
            writeNext();
        }
    };

    @SuppressLint("MissingPermission")
    private void enableNotifications(BluetoothGatt bg) {
        try {
            bg.setCharacteristicNotification(uartTx,true);
            BluetoothGattDescriptor d = uartTx.getDescriptor(CCCD);
            if (d == null) return;
            if (Build.VERSION.SDK_INT >= 33) bg.writeDescriptor(d,BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
            else {
                d.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                bg.writeDescriptor(d);
            }
        } catch (Exception e) { append("notification enable error " + e); }
    }

    private void launchMusicPlus() {
        if (!requireConsole()) return;
        MediaSnapshot s = refreshMedia();
        if (s == null) {
            Toast.makeText(this,"Lance d'abord un morceau dans TIDAL/Spotify/Deezer.",Toast.LENGTH_LONG).show();
            return;
        }
        watchMode = "music";
        lastWatchTrackKey = s.packageName + "|" + s.title + "|" + s.artist + "|" + s.durationMs;
        pushFullMusicToWatch(s);
    }

    private void pushFullMusicToWatch(MediaSnapshot s) {
        if (!"music".equals(watchMode) || !requireConsoleSilent()) return;
        WatchImage wi = s.art == null ? null : encodeArtwork(s.art, ART_SIZE, ART_SIZE);
        String accent = wi == null ? "#00AAFF" : wi.accentHex;
        long posSec = Math.max(0,s.positionMs/1000);
        long durSec = Math.max(1,s.durationMs/1000);
        float volume = currentVolumeFraction();

        append("MUSIC FULL SYNC / art=" + (wi != null) + " / accent=" + accent);
        watchStatus.setText("WATCH / MUSIC CONTROL+ SENDING");

        sendConsole("try{if(global.__voxMCTimer)clearInterval(global.__voxMCTimer);if(global.__voxMCAuto)clearTimeout(global.__voxMCAuto);E.clearWatches();}catch(e){}global.__voxArtB64='';\n");
        if (wi != null) {
            for (int off=0; off<wi.base64.length(); off+=ART_SEND_CHUNK) {
                String part=wi.base64.substring(off,Math.min(wi.base64.length(),off+ART_SEND_CHUNK));
                sendConsole("global.__voxArtB64+=" + jsQuote(part) + ";\n");
            }
        }

        String imageBuild = wi == null ? "M.img=null;" :
                "M.img={width:"+ART_SIZE+",height:"+ART_SIZE+",bpp:4,palette:new Uint16Array("+toJsArray(wi.palette565)+"),buffer:E.toArrayBuffer(atob(global.__voxArtB64))};global.__voxArtB64='';";

        String js = "(function(){try{" +
                "var M=global.__voxMC={title:" + jsQuote(trimWatch(s.title,64)) +
                ",artist:" + jsQuote(trimWatch(s.artist,52)) +
                ",pos:" + posSec +
                ",dur:" + durSec +
                ",vol:" + String.format(Locale.ROOT,"%.3f",volume) +
                ",playing:" + (s.playing?"true":"false") +
                ",last:getTime(),accent:" + jsQuote(accent) + ",img:null};" + imageBuild +
                "global.__voxMCBack=function(){try{if(global.__voxMCTimer)clearInterval(global.__voxMCTimer);if(global.__voxMCAuto)clearTimeout(global.__voxMCAuto);}catch(e){}print('VOX'+'_MC:EXIT');load('clock.app.js');};" +
                "global.__voxFit=function(str,w){str=str||'';g.setFontGrotesk16();if(g.stringWidth(str)<=w)return str;while(str.length>1&&g.stringWidth(str+'…')>w)str=str.substr(0,str.length-1);return str+'…';};" +
                "global.__voxMCDraw=function(){" +
                "g.reset().clear(1);if(M.img)g.drawImage(M.img,0,0,{scale:2});else g.setColor('#181820').fillRect(0,0,239,239);" +
                "Dickens.loadSurround();if(g.drawTicks)g.drawTicks();if(g.drawBT)g.drawBT();if(g.drawBat)g.drawBat();" +
                "if(M.playing){var n=getTime();M.pos=Math.min(M.dur,M.pos+(n-M.last));M.last=n;}else M.last=getTime();" +
                "var a1=3.912,a2=4.712,f=Math.max(0,Math.min(1,M.pos/M.dur)),am=a2-(a2-a1)*f;g.setColor('#333').drawSlice(a1,am,72,95);g.setColor(M.accent).drawSlice(am,a2,73,94);" +
                "var v1=1.571,v2=2.371,vm=v2-(v2-v1)*Math.max(0,Math.min(1,M.vol));g.setColor('#333').drawSlice(v1,vm,72,95);g.setColor(M.accent).drawSlice(vm,v2,73,94);if(global.icons&&icons.volume)g.drawImage(icons.volume,198,104);" +
                "g.setFontGrotesk16().setFontAlign(0,-1).setColor(M.accent).drawString(global.__voxFit(M.artist,104),120,83);" +
                "var d=Date(),hh=d.getHours().toString().padStart(2,'0'),mm=d.getMinutes().toString().padStart(2,'0');g.setFontArchitekt35().setFontAlign(0,0).setColor('#FFF').drawString(hh+':'+mm,119,115);" +
                "g.setFontGrotesk16().setFontAlign(0,-1).setColor('#DDE6EA').drawString(global.__voxFit(M.title,104),120,139);" +
                "var fs=function(v){v=Math.max(0,v|0);return Math.floor(v/60)+':'+(v%60).toString().padStart(2,'0');};g.setFontArchitekt10().setFontAlign(0,-1).setColor('#DDD').drawString(fs(M.pos),37,107);" +
                "g.setColor(M.accent);var seed=(M.pos|0)%7;for(var i=0;i<3;i++){var h=M.playing?(4+((seed+i*3)%14)):2;g.fillRect(108+i*8,210-h,114+i*8,210);}" +
                "Dickens.buttonIcons=[M.playing?'pause':'play','clock','down','up'];Dickens.loadSurround();g.flip();};" +
                "var p=function(x){print('VOX'+'_MC:'+x);};" +
                "setWatch(function(){p('PLAYPAUSE');},BTN1,{edge:1,repeat:1});" +
                "var p3=function(){var fired=false,t=setTimeout(function(){fired=true;global.__voxV3=setInterval(function(){if(BTN3.read())p('VOLDOWN');else{clearInterval(global.__voxV3);global.__voxV3=0;}},250);},450);setWatch(function(){clearTimeout(t);if(!fired)p('NEXT');},BTN3,{edge:-1});};" +
                "var p4=function(){var fired=false,t=setTimeout(function(){fired=true;global.__voxV4=setInterval(function(){if(BTN4.read())p('VOLUP');else{clearInterval(global.__voxV4);global.__voxV4=0;}},250);},450);setWatch(function(){clearTimeout(t);if(!fired)p('PREV');},BTN4,{edge:-1});};" +
                "setWatch(p3,BTN3,{edge:1,repeat:1});setWatch(p4,BTN4,{edge:1,repeat:1});setWatch(global.__voxMCBack,BTN2,{edge:1,repeat:1});" +
                "global.__voxMCTimer=setInterval(global.__voxMCDraw,1000);global.__voxMCAuto=setTimeout(global.__voxMCBack,120000);global.__voxMCDraw();print('VOX'+'_MC:READY');" +
                "}catch(e){print('VOX'+'_MC:ERR:'+e);setTimeout(function(){load('clock.app.js');},1200);}})();\n";
        sendConsole(js);
        lastWatchStatePush=SystemClock.elapsedRealtime();
    }

    private void pushMusicState(MediaSnapshot s) {
        if (!"music".equals(watchMode) || !requireConsoleSilent()) return;
        long posSec=Math.max(0,s.positionMs/1000);
        long durSec=Math.max(1,s.durationMs/1000);
        float vol=currentVolumeFraction();
        String js="if(global.__voxMC){global.__voxMC.pos="+posSec+";global.__voxMC.dur="+durSec+";global.__voxMC.vol="+String.format(Locale.ROOT,"%.3f",vol)+";global.__voxMC.playing="+(s.playing?"true":"false")+";global.__voxMC.last=getTime();}\n";
        sendConsole(js);
        lastWatchStatePush=SystemClock.elapsedRealtime();
    }

    private void launchWeatherPlus() {
        if (!requireConsole()) return;
        if (weatherData == null) {
            Toast.makeText(this,"Fetch Weather+ first.",Toast.LENGTH_LONG).show();
            fetchWeather();
            return;
        }
        watchMode="weather";
        pushWeatherToWatch(weatherData);
    }

    private void pushWeatherToWatch(WeatherData w) {
        if (!"weather".equals(watchMode) || !requireConsoleSilent()) return;
        StringBuilder times=new StringBuilder("[");
        StringBuilder temps=new StringBuilder("[");
        StringBuilder pops=new StringBuilder("[");
        for(int i=0;i<w.hours.size();i++) {
            if(i>0){times.append(',');temps.append(',');pops.append(',');}
            times.append(jsQuote(hourLabel(w.hours.get(i).time)));
            temps.append(Math.round(w.hours.get(i).temp));
            pops.append(Math.round(w.hours.get(i).pop));
        }
        times.append(']');temps.append(']');pops.append(']');
        String js="(function(){try{"+
                "try{if(global.__voxMCTimer)clearInterval(global.__voxMCTimer);if(global.__voxMCAuto)clearTimeout(global.__voxMCAuto);}catch(e){}E.clearWatches();"+
                "var W=global.__voxWX={page:0,temp:"+Math.round(w.temp)+",feels:"+Math.round(w.feels)+",hum:"+Math.round(w.humidity)+",pop:"+Math.round(w.nextRainChance)+",popmax:"+Math.round(w.popMax)+",wind:"+Math.round(w.wind)+",min:"+Math.round(w.min)+",max:"+Math.round(w.max)+",cond:"+jsQuote(trimWatch(w.condition,24))+",sunrise:"+jsQuote(w.sunrise)+",sunset:"+jsQuote(w.sunset)+",times:"+times+",temps:"+temps+",pops:"+pops+"};"+
                "global.__voxWXBack=function(){try{if(global.__voxWXAuto)clearTimeout(global.__voxWXAuto);}catch(e){}print('VOX'+'_WX:EXIT');load('clock.app.js');};"+
                "global.__voxWXDraw=function(){g.reset().clear(1);Dickens.loadSurround();g.setColor('#358').fillArc(-0.97,0.97,96).fillArc(Math.PI-0.75,Math.PI+0.75,96).fillRect(37,69,201,69).fillRect(51,186,187,186);g.setColor('#FFF').setBgColor('#358').setFontAlign(0,0).setFontGrotesk16().drawString('Weather+',120,55);g.setBgColor(0);"+
                "if(W.page===0){g.setColor('#E49E4C').setFontArchitekt35().drawString(W.temp+'°',120,104);g.setColor('#FFF').setFontGrotesk16().drawString(W.cond,120,135);g.setFontArchitekt10().setColor('#BBB').drawString('FEELS '+W.feels+'°   HUM '+W.hum+'%',120,157);g.drawString('RAIN '+W.pop+'%   WIND '+W.wind+'KPH',120,173);g.setColor('#89A').drawString(W.min+'° / '+W.max+'°   '+W.sunrise+' > '+W.sunset,120,201);}else{g.setColor('#E49E4C').setFontGrotesk16().drawString('NEXT HOURS',120,88);g.setFontArchitekt10();for(var i=0;i<W.times.length;i++){var y=109+i*15;g.setColor('#AAA').setFontAlign(-1,0).drawString(W.times[i],68,y);g.setColor('#FFF').setFontAlign(0,0).drawString(W.temps[i]+'°',121,y);g.setColor('#0AF').setFontAlign(1,0).drawString(W.pops[i]+'%',172,y);}}Dickens.buttonIcons=['chart','clock','down','up'];Dickens.loadSurround();g.flip();};"+
                "var pg=function(d){W.page=(W.page+d+2)%2;global.__voxWXDraw();};setWatch(function(){pg(1);},BTN1,{edge:1,repeat:1});setWatch(global.__voxWXBack,BTN2,{edge:1,repeat:1});setWatch(function(){pg(1);},BTN3,{edge:1,repeat:1});setWatch(function(){pg(-1);},BTN4,{edge:1,repeat:1});global.__voxWXAuto=setTimeout(global.__voxWXBack,120000);global.__voxWXDraw();print('VOX'+'_WX:READY');"+
                "}catch(e){print('VOX'+'_WX:ERR:'+e);setTimeout(function(){load('clock.app.js');},1200);}})();\n";
        sendConsole(js);
        watchStatus.setText("WATCH / WEATHER+ SENDING");
        append("WEATHER+ PUSH / " + w.condition);
    }

    private String hourLabel(String iso) {
        int t=iso.indexOf('T');
        if(t>=0 && iso.length()>=t+6) return iso.substring(t+1,t+6);
        return iso;
    }

    private void syncCurrentMode() {
        if("music".equals(watchMode)) {
            MediaSnapshot s=refreshMedia();
            if(s!=null) pushFullMusicToWatch(s);
        } else if("weather".equals(watchMode) && weatherData!=null) {
            pushWeatherToWatch(weatherData);
        } else {
            Toast.makeText(this,"Launch Music Control+ or Weather+ first.",Toast.LENGTH_SHORT).show();
        }
    }

    private void returnToClock() {
        if (!requireConsole()) return;
        watchMode="";
        sendConsole("try{if(global.__voxMCTimer)clearInterval(global.__voxMCTimer);if(global.__voxMCAuto)clearTimeout(global.__voxMCAuto);if(global.__voxWXAuto)clearTimeout(global.__voxWXAuto);}catch(e){}load('clock.app.js');\n");
        watchStatus.setText("WATCH / RETURNING TO BETHESDA CLOCK");
    }

    private void handleNotify(byte[] data) {
        if(data==null||data.length==0)return;
        String s=new String(data,StandardCharsets.UTF_8);
        synchronized(watchRx){
            watchRx.append(s);
            int nl;
            while((nl=watchRx.indexOf("\n"))>=0){
                String line=watchRx.substring(0,nl).replace("\r","");
                watchRx.delete(0,nl+1);
                handleWatchLine(line);
            }
            if(watchRx.length()>8192)watchRx.delete(0,watchRx.length()-2048);
        }
    }

    private void handleWatchLine(String line) {
        if(line.contains("VOX_MC:READY")) {
            runOnUiThread(() -> watchStatus.setText("WATCH / MUSIC CONTROL+ ACTIVE / RAM ONLY"));
            append("WATCH MUSIC CONTROL+ READY");
        } else if(line.contains("VOX_WX:READY")) {
            runOnUiThread(() -> watchStatus.setText("WATCH / WEATHER+ ACTIVE / RAM ONLY"));
            append("WATCH WEATHER+ READY");
        } else if(line.contains("VOX_MC:ERR:")) {
            append("WATCH MUSIC ERROR " + line.substring(line.indexOf("VOX_MC:ERR:")));
            runOnUiThread(() -> watchStatus.setText("WATCH / MUSIC ERROR / AUTO RECOVERY"));
        } else if(line.contains("VOX_WX:ERR:")) {
            append("WATCH WEATHER ERROR " + line.substring(line.indexOf("VOX_WX:ERR:")));
            runOnUiThread(() -> watchStatus.setText("WATCH / WEATHER ERROR / AUTO RECOVERY"));
        } else if(line.contains("VOX_MC:PLAYPAUSE")) mediaPlayPause();
        else if(line.contains("VOX_MC:NEXT")) mediaNext();
        else if(line.contains("VOX_MC:PREV")) mediaPrev();
        else if(line.contains("VOX_MC:VOLDOWN")) adjustVolume(false);
        else if(line.contains("VOX_MC:VOLUP")) adjustVolume(true);
        else if(line.contains("VOX_MC:EXIT") || line.contains("VOX_WX:EXIT")) {
            watchMode="";
            runOnUiThread(() -> watchStatus.setText("WATCH / BETHESDA CLOCK"));
        }
    }

    private void mediaPlayPause() {
        runOnUiThread(() -> {
            MediaSnapshot s=refreshMedia();
            if(primaryController==null)return;
            try {
                PlaybackState p=primaryController.getPlaybackState();
                if(p!=null && p.getState()==PlaybackState.STATE_PLAYING)primaryController.getTransportControls().pause();
                else primaryController.getTransportControls().play();
                handler.postDelayed(() -> {MediaSnapshot n=refreshMedia();if(n!=null)pushMusicState(n);},250);
            } catch(Exception e){append("MEDIA playpause error "+e);}
        });
    }

    private void mediaNext(){runOnUiThread(() -> {if(primaryController!=null)try{primaryController.getTransportControls().skipToNext();}catch(Exception e){append("MEDIA next error "+e);}});}
    private void mediaPrev(){runOnUiThread(() -> {if(primaryController!=null)try{primaryController.getTransportControls().skipToPrevious();}catch(Exception e){append("MEDIA prev error "+e);}});}

    private void adjustVolume(boolean up) {
        runOnUiThread(() -> {
            try {
                AudioManager am=(AudioManager)getSystemService(AUDIO_SERVICE);
                if(am!=null)am.adjustStreamVolume(AudioManager.STREAM_MUSIC,up?AudioManager.ADJUST_RAISE:AudioManager.ADJUST_LOWER,0);
            } catch(Exception e){append("VOLUME error "+e);}
        });
    }

    private float currentVolumeFraction() {
        try {
            AudioManager am=(AudioManager)getSystemService(AUDIO_SERVICE);
            if(am==null)return 0;
            int max=am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            int now=am.getStreamVolume(AudioManager.STREAM_MUSIC);
            return max<=0?0:Math.max(0,Math.min(1,now/(float)max));
        } catch(Exception e){return 0;}
    }

    private WatchImage encodeArtwork(Bitmap input,int w,int h) {
        Bitmap square;
        int side=Math.min(input.getWidth(),input.getHeight());
        int sx=(input.getWidth()-side)/2, sy=(input.getHeight()-side)/2;
        square=Bitmap.createBitmap(input,sx,sy,side,side);
        Bitmap b=Bitmap.createScaledBitmap(square,w,h,true);
        if(square!=input)square.recycle();
        int[] raw=new int[w*h];
        b.getPixels(raw,0,w,0,0,w,h);
        String accent=dominantAccent(raw);

        int[] px=new int[raw.length];
        for(int i=0;i<raw.length;i++) {
            int r=(int)(Color.red(raw[i])*0.43f);
            int g=(int)(Color.green(raw[i])*0.43f);
            int bl=(int)(Color.blue(raw[i])*0.43f);
            px[i]=Color.rgb(r,g,bl);
        }
        final int k=16;
        int[][] c=new int[k][3];
        for(int i=0;i<k;i++) {
            int col=px[Math.min(px.length-1,(i*px.length)/k)];
            c[i][0]=Color.red(col);c[i][1]=Color.green(col);c[i][2]=Color.blue(col);
        }
        int[] idx=new int[px.length];
        for(int it=0;it<6;it++) {
            long[][] sum=new long[k][3];int[] count=new int[k];
            for(int i=0;i<px.length;i++) {
                int r=Color.red(px[i]),g=Color.green(px[i]),bl=Color.blue(px[i]);
                int best=0;long bestD=Long.MAX_VALUE;
                for(int j=0;j<k;j++) {
                    long dr=r-c[j][0],dg=g-c[j][1],db=bl-c[j][2],d=dr*dr+dg*dg+db*db;
                    if(d<bestD){bestD=d;best=j;}
                }
                idx[i]=best;count[best]++;sum[best][0]+=r;sum[best][1]+=g;sum[best][2]+=bl;
            }
            for(int j=0;j<k;j++)if(count[j]>0){c[j][0]=(int)(sum[j][0]/count[j]);c[j][1]=(int)(sum[j][1]/count[j]);c[j][2]=(int)(sum[j][2]/count[j]);}
        }
        for(int i=0;i<px.length;i++) {
            int r=Color.red(px[i]),g=Color.green(px[i]),bl=Color.blue(px[i]);int best=0;long bestD=Long.MAX_VALUE;
            for(int j=0;j<k;j++){long dr=r-c[j][0],dg=g-c[j][1],db=bl-c[j][2],d=dr*dr+dg*dg+db*db;if(d<bestD){bestD=d;best=j;}}
            idx[i]=best;
        }
        byte[] packed=new byte[(px.length+1)/2];
        for(int i=0;i<px.length;i+=2){int a=idx[i]&15,z=(i+1<px.length)?idx[i+1]&15:0;packed[i/2]=(byte)((a<<4)|z);}
        int[] pal=new int[k];
        for(int j=0;j<k;j++){int r=c[j][0],g=c[j][1],bl=c[j][2];pal[j]=((r>>3)<<11)|((g>>2)<<5)|(bl>>3);}
        b.recycle();
        WatchImage wi=new WatchImage();wi.palette565=pal;wi.base64=Base64.encodeToString(packed,Base64.NO_WRAP);wi.accentHex=accent;return wi;
    }

    private String dominantAccent(int[] px) {
        final int bins=24;
        double[] score=new double[bins];double[] rr=new double[bins],gg=new double[bins],bb=new double[bins],ww=new double[bins];
        float[] hsv=new float[3];
        for(int col:px) {
            int r=Color.red(col),g=Color.green(col),b=Color.blue(col);
            Color.RGBToHSV(r,g,b,hsv);
            float sat=hsv[1],val=hsv[2];
            if(sat<0.22f||val<0.16f||val>0.97f)continue;
            int bin=Math.min(bins-1,(int)(hsv[0]/360f*bins));
            double w=(0.25+sat*sat)*(0.35+val);
            score[bin]+=w;rr[bin]+=r*w;gg[bin]+=g*w;bb[bin]+=b*w;ww[bin]+=w;
        }
        int best=-1;double bs=0;
        for(int i=0;i<bins;i++)if(score[i]>bs){bs=score[i];best=i;}
        if(best<0||ww[best]<1)return "#00AAFF";
        int r=(int)(rr[best]/ww[best]),g=(int)(gg[best]/ww[best]),b=(int)(bb[best]/ww[best]);
        Color.RGBToHSV(r,g,b,hsv);
        hsv[1]=Math.max(0.55f,hsv[1]);hsv[2]=Math.min(0.92f,Math.max(0.62f,hsv[2]));
        int vivid=Color.HSVToColor(hsv);
        return String.format(Locale.ROOT,"#%02X%02X%02X",Color.red(vivid),Color.green(vivid),Color.blue(vivid));
    }

    private String toJsArray(int[] a){StringBuilder s=new StringBuilder("[");for(int i=0;i<a.length;i++){if(i>0)s.append(',');s.append(a[i]);}return s.append(']').toString();}

    private String jsQuote(String s) {
        if(s==null)s="";StringBuilder o=new StringBuilder("\"");
        for(int i=0;i<s.length();i++){
            char ch=s.charAt(i);
            switch(ch){case '\\':o.append("\\\\");break;case '"':o.append("\\\"");break;case '\n':o.append("\\n");break;case '\r':o.append("\\r");break;case '\t':o.append("\\t");break;default:if(ch<32||ch>126){String hex=Integer.toHexString(ch);o.append("\\u");for(int z=hex.length();z<4;z++)o.append('0');o.append(hex);}else o.append(ch);}
        }
        return o.append('"').toString();
    }

    private String trimWatch(String s,int max){if(s==null)return "";s=s.replace('\n',' ').replace('\r',' ').trim();return s.length()<=max?s:s.substring(0,max);}

    private boolean requireConsole(){if(!requireConsoleSilent()){Toast.makeText(this,"Connecte Chronomark e295 d'abord.",Toast.LENGTH_SHORT).show();return false;}return true;}
    private boolean requireConsoleSilent(){return consoleReady&&gatt!=null&&uartRx!=null;}

    private synchronized void sendConsole(String text) {
        byte[] all=text.getBytes(StandardCharsets.UTF_8);
        for(int off=0;off<all.length;off+=UART_CHUNK){int n=Math.min(UART_CHUNK,all.length-off);byte[] p=new byte[n];System.arraycopy(all,off,p,0,n);writeQueue.add(p);}writeNext();
    }

    @SuppressLint("MissingPermission")
    private synchronized void writeNext() {
        if(writeInFlight||writeQueue.isEmpty()||gatt==null||uartRx==null)return;
        byte[] p=writeQueue.poll();writeInFlight=true;
        try {
            if(Build.VERSION.SDK_INT>=33){int r=gatt.writeCharacteristic(uartRx,p,BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);if(r!=0){writeInFlight=false;handler.postDelayed(this::writeNext,30);}}
            else{uartRx.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);uartRx.setValue(p);if(!gatt.writeCharacteristic(uartRx)){writeInFlight=false;handler.postDelayed(this::writeNext,30);}}
        }catch(Exception e){writeInFlight=false;append("UART WRITE ERROR "+e);}
    }

    @SuppressLint("MissingPermission")
    private void closeGatt(){if(gatt!=null){try{gatt.disconnect();}catch(Exception ignored){}try{gatt.close();}catch(Exception ignored){}gatt=null;}consoleReady=false;watchMode="";}

    private void updateWatchButtons(){boolean e=consoleReady;musicButton.setEnabled(e);weatherButton.setEnabled(e&&weatherData!=null);syncButton.setEnabled(e);returnButton.setEnabled(e);}

    private void requestBtPermissionsIfNeeded() {
        if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.S){if(checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)!=PackageManager.PERMISSION_GRANTED||checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.BLUETOOTH_SCAN,Manifest.permission.BLUETOOTH_CONNECT},REQ_BT);}
        else if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION},REQ_BT);
    }

    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grantResults){super.onRequestPermissionsResult(requestCode,permissions,grantResults);if(requestCode==REQ_BT)updateWatchButtons();else if(requestCode==REQ_LOC){if(hasLocationPermission())fetchWeather();else weatherStatus.setText("WEATHER / LOCATION PERMISSION DENIED");}}

    private boolean hasBtPermissions(){if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.S)return checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)==PackageManager.PERMISSION_GRANTED&&checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED;return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED;}
    private boolean hasLocationPermission(){return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED||checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;}

    private boolean isNotificationListenerEnabled(){try{String flat=Settings.Secure.getString(getContentResolver(),"enabled_notification_listeners");return flat!=null&&flat.contains(getPackageName());}catch(Exception e){return false;}}
    private Bitmap getArtwork(MediaMetadata md){Bitmap b=md.getBitmap(MediaMetadata.METADATA_KEY_ART);if(b==null)b=md.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);if(b==null)b=md.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON);return b;}
    private long estimatePosition(PlaybackState s){if(s==null)return 0;long p=Math.max(0,s.getPosition());if(s.getState()==PlaybackState.STATE_PLAYING&&s.getLastPositionUpdateTime()>0){long dt=Math.max(0,SystemClock.elapsedRealtime()-s.getLastPositionUpdateTime());p+=(long)(dt*s.getPlaybackSpeed());}return Math.max(0,p);}

    private String value(MediaMetadata md,String...keys){if(md==null)return "";for(String k:keys){CharSequence t=md.getText(k);if(t!=null&&t.length()>0)return t.toString();String s=md.getString(k);if(!TextUtils.isEmpty(s))return s;}return "";}
    private String getAppLabel(String pkg){try{PackageManager pm=getPackageManager();ApplicationInfo ai=pm.getApplicationInfo(pkg,0);CharSequence l=pm.getApplicationLabel(ai);return l==null?pkg:l.toString();}catch(Exception e){return pkg;}}
    private String firstNonEmpty(String...v){for(String s:v)if(!TextUtils.isEmpty(s))return s;return "";}
    private String nullToEmpty(String s){return s==null?"":s;}
    private String formatTime(long ms){if(ms<=0)return "00:00";long sec=ms/1000,h=sec/3600,m=(sec%3600)/60,s=sec%60;if(h>0)return String.format(Locale.ROOT,"%d:%02d:%02d",h,m,s);return String.format(Locale.ROOT,"%02d:%02d",m,s);}

    private TextView text(String s,int size,int color){TextView t=new TextView(this);t.setText(s);t.setTextSize(size);t.setTextColor(color);return t;}
    private TextView label(String s){TextView t=text(s,11,Color.rgb(164,169,167));t.setPadding(0,dp(14),0,dp(4));return t;}
    private Button button(String s){Button b=new Button(this);b.setText(s);b.setTextSize(10);b.setAllCaps(false);return b;}
    private LinearLayout.LayoutParams lp(int w,int h){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(w,h);p.setMargins(0,dp(3),0,dp(3));return p;}
    private int dp(int v){return Math.round(v*getResources().getDisplayMetrics().density);}
    private void append(String s){runOnUiThread(() -> {if(log==null)return;String old=log.getText().toString();if(old.length()>14000)old=old.substring(old.length()-9000);log.setText(old+(old.isEmpty()?"":"\n")+s);});}

    static class MediaSnapshot {String packageName,appLabel,title,artist,album;long durationMs,positionMs;boolean playing;Bitmap art;}
    static class WatchImage {int[] palette565;String base64;String accentHex;}
    static class HourPoint {String time;double temp,feels,pop;int code;}
    static class WeatherData {double lat,lon,temp,feels,humidity,precip,wind,nextRainChance,min,max,popMax;int code;String condition,currentTime,timezone,sunrise,sunset;List<HourPoint> hours=new ArrayList<>();}
}
