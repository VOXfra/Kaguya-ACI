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

import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Queue;
import java.util.Set;
import java.util.UUID;

public class MainActivity extends Activity {
    private static final int REQ_BT = 1001;
    private static final int UART_CHUNK = 96;
    private static final int ART_SIZE = 84;

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
    private boolean bridgeActive;

    private BluetoothAdapter adapter;
    private BluetoothLeScanner scanner;
    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic uartRx;
    private BluetoothGattCharacteristic uartTx;
    private boolean scanning;
    private boolean consoleReady;
    private boolean writeInFlight;

    private TextView mediaAccessState;
    private ImageView artwork;
    private TextView mediaState;
    private TextView mediaApp;
    private TextView mediaTitle;
    private TextView mediaArtist;
    private TextView mediaTime;
    private TextView watchStatus;
    private LinearLayout deviceList;
    private TextView log;
    private Button scanButton;
    private Button launchButton;
    private Button syncButton;
    private Button returnButton;

    private boolean running;

    private final Runnable ticker = new Runnable() {
        @Override public void run() {
            if (!running) return;
            MediaSnapshot s = refreshMedia();
            if (bridgeActive && consoleReady && s != null) {
                String key = s.packageName + "|" + s.title + "|" + s.artist + "|" + s.durationMs;
                long now = SystemClock.elapsedRealtime();
                if (!key.equals(lastWatchTrackKey)) {
                    lastWatchTrackKey = key;
                    pushFullMusicToWatch(s);
                } else if (now - lastWatchStatePush >= 5000) {
                    pushStateToWatch(s);
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
        requestPermissionsIfNeeded();
        refreshMedia();

        append("CHRONOMARK+ v0.6.0 / MUSIC CONTROL+ LIVE BRIDGE");
        append("WATCH POLICY: RAM ONLY. NO Storage.write / erase / save / Flash / DFU.");
        append("Music Control+ auto-returns to Bethesda clock after 120 seconds in this test build.");
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
        TextView sub = text("MUSIC CONTROL+ LIVE / v0.6.0", 13, Color.rgb(211,71,54));
        sub.setPadding(0,0,0,dp(12));
        root.addView(sub);

        TextView safety = text("RAM-ONLY WATCH PROTOTYPE / BETHESDA STORAGE UNTOUCHED", 11, Color.rgb(122,198,190));
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
        root.addView(artwork, lp(-1, dp(210)));

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

        root.addView(label("MUSIC CONTROL+ / RAM ONLY"));
        launchButton = button("LAUNCH MUSIC CONTROL+ / 120s");
        launchButton.setEnabled(false);
        launchButton.setOnClickListener(v -> launchMusicPlus());
        root.addView(launchButton, lp(-1,dp(50)));

        LinearLayout controls = new LinearLayout(this);
        controls.setOrientation(LinearLayout.HORIZONTAL);
        syncButton = button("SYNC NOW");
        returnButton = button("RETURN TO CLOCK");
        syncButton.setEnabled(false);
        returnButton.setEnabled(false);
        syncButton.setOnClickListener(v -> {
            MediaSnapshot s = refreshMedia();
            if (s != null) pushFullMusicToWatch(s);
        });
        returnButton.setOnClickListener(v -> returnToClock());
        controls.addView(syncButton, new LinearLayout.LayoutParams(0,dp(46),1f));
        controls.addView(returnButton, new LinearLayout.LayoutParams(0,dp(46),1f));
        root.addView(controls);

        TextView controlsHelp = text("WATCH: BTN1 play/pause • BTN2 clock • BTN3 next / hold volume- • BTN4 previous / hold volume+", 10, Color.rgb(164,169,167));
        controlsHelp.setPadding(0,dp(5),0,dp(8));
        root.addView(controlsHelp);

        root.addView(label("LIVE BRIDGE LOG"));
        log = text("", 10, Color.rgb(219,219,210));
        log.setTypeface(android.graphics.Typeface.MONOSPACE);
        log.setPadding(dp(10),dp(10),dp(10),dp(10));
        log.setBackgroundColor(Color.rgb(7,10,12));
        log.setTextIsSelectable(true);
        root.addView(log, lp(-1,dp(300)));

        TextView footer = text("Next module after this Music Control+ validation: Weather+ using the same Bethesda/Dickens visual language.", 10, Color.rgb(164,169,167));
        footer.setPadding(0,dp(10),0,0);
        root.addView(footer);

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

    @SuppressLint("MissingPermission")
    private void startScan() {
        if (!hasBtPermissions()) {
            requestPermissionsIfNeeded();
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
        bridgeActive = false;
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
                bridgeActive = false;
                append("BLE disconnected status=" + status);
                runOnUiThread(() -> {
                    watchStatus.setText("WATCH / DISCONNECTED");
                    updateWatchButtons();
                });
            }
        }

        @Override public void onMtuChanged(BluetoothGatt bg, int mtu, int status) {
            append("MTU " + mtu + " status=" + status);
        }

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

        @Override public void onCharacteristicChanged(BluetoothGatt bg, BluetoothGattCharacteristic c) {
            handleNotify(c.getValue());
        }

        @Override public void onCharacteristicChanged(BluetoothGatt bg, BluetoothGattCharacteristic c, byte[] value) {
            handleNotify(value);
        }

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
        } catch (Exception e) {
            append("notification enable error " + e);
        }
    }

    private void launchMusicPlus() {
        if (!requireConsole()) return;
        MediaSnapshot s = refreshMedia();
        if (s == null) {
            Toast.makeText(this,"Lance d'abord un morceau dans TIDAL/Spotify/Deezer.",Toast.LENGTH_LONG).show();
            return;
        }
        bridgeActive = true;
        lastWatchTrackKey = "";
        lastWatchStatePush = 0;
        append("LAUNCH MUSIC CONTROL+ / RAM ONLY");
        pushFullMusicToWatch(s);
        watchStatus.setText("WATCH / MUSIC CONTROL+ SENDING");
    }

    private void pushFullMusicToWatch(MediaSnapshot s) {
        if (!bridgeActive || !requireConsoleSilent()) return;
        WatchImage wi = s.art == null ? null : encodeArtwork(s.art, ART_SIZE, ART_SIZE);
        String paletteJs = wi == null ? "null" : toJsArray(wi.palette565);
        String artB64 = wi == null ? "" : wi.base64;

        long posSec = Math.max(0,s.positionMs/1000);
        long durSec = Math.max(1,s.durationMs/1000);
        String js = "(function(){try{" +
                "if(global.__voxMCTimer)clearInterval(global.__voxMCTimer);" +
                "if(global.__voxMCAuto)clearTimeout(global.__voxMCAuto);" +
                "E.clearWatches();" +
                "var M=global.__voxMC={title:" + jsQuote(trimWatch(s.title,44)) +
                ",artist:" + jsQuote(trimWatch(s.artist,36)) +
                ",app:" + jsQuote(trimWatch(s.appLabel,20)) +
                ",pos:" + posSec +
                ",dur:" + durSec +
                ",playing:" + (s.playing ? "true" : "false") +
                ",last:getTime(),img:null};" +
                (wi == null ? "" :
                        "M.img={width:" + ART_SIZE + ",height:" + ART_SIZE + ",bpp:4,palette:new Uint16Array(" + paletteJs + "),buffer:E.toArrayBuffer(atob(" + jsQuote(artB64) + "))};") +
                "global.__voxMCBack=function(){try{if(global.__voxMCTimer)clearInterval(global.__voxMCTimer);if(global.__voxMCAuto)clearTimeout(global.__voxMCAuto);}catch(e){}print('VOX'+'_MC:EXIT');load('clock.app.js');};" +
                "global.__voxMCDraw=function(){" +
                "g.reset().clear(1);Dickens.loadSurround();" +
                "g.setColor('#358').fillArc(-0.97,0.97,96).fillArc(Math.PI-0.75,Math.PI+0.75,96).fillRect(37,69,201,69).fillRect(51,186,187,186);" +
                "g.setColor(-1).setBgColor('#358').setFontAlign(0,0).setFontGrotesk16().drawString('Music Control+',120,55);g.setBgColor(0);" +
                "if(M.img){g.setColor('#E49E4C').fillRect(76,76,163,163);g.drawImage(M.img,78,78);}else{g.setColor('#181820').fillRect(78,78,161,161);g.setColor('#358').drawCircle(120,120,29).drawCircle(120,120,31);g.setFontArchitekt15().setFontAlign(0,0).setColor('#E49E4C').drawString('MUSIC',120,120);}" +
                "g.setFontGrotesk14().setFontAlign(0,0).setColor('#FFF').drawString(M.title.length>26?M.title.substr(0,25)+'…':M.title,120,174);" +
                "g.setFontArchitekt10().setColor('#E49E4C').drawString(M.artist.length>28?M.artist.substr(0,27)+'…':M.artist,120,191);" +
                "Dickens.buttonIcons=[M.playing?'pause':'play','clock','down','up'];Dickens.loadSurround();global.__voxMCDyn();g.flip();};" +
                "global.__voxMCDyn=function(){if(M.playing){var n=getTime();M.pos=Math.min(M.dur,M.pos+(n-M.last));M.last=n;}else M.last=getTime();" +
                "var f=Math.max(0,Math.min(1,M.pos/M.dur)),a1=3.912,a2=4.712,am=a2-(a2-a1)*f;" +
                "g.setColor('#333').drawSlice(a1,am,72,95);g.setColor('#BBB').drawSlice(am,a2,73,94);" +
                "var fs=function(v){v=Math.max(0,v|0);return Math.floor(v/60)+':'+(v%60).toString().padStart(2,'0');};" +
                "g.setColor(0).fillRect(65,202,175,216);g.setFontArchitekt10().setFontAlign(0,0).setColor('#BBB').drawString(fs(M.pos)+' / '+fs(M.dur),120,208);g.flip();};" +
                "var p=function(x){print('VOX'+'_MC:'+x);};" +
                "setWatch(function(){p('PLAYPAUSE');},BTN1,{edge:1,repeat:1});" +
                "var press3=function(){var fired=false,t=setTimeout(function(){fired=true;global.__voxV3=setInterval(function(){if(BTN3.read())p('VOLDOWN');else{clearInterval(global.__voxV3);global.__voxV3=0;}},250);},450);setWatch(function(){clearTimeout(t);if(!fired)p('NEXT');},BTN3,{edge:-1});};" +
                "var press4=function(){var fired=false,t=setTimeout(function(){fired=true;global.__voxV4=setInterval(function(){if(BTN4.read())p('VOLUP');else{clearInterval(global.__voxV4);global.__voxV4=0;}},250);},450);setWatch(function(){clearTimeout(t);if(!fired)p('PREV');},BTN4,{edge:-1});};" +
                "setWatch(press3,BTN3,{edge:1,repeat:1});setWatch(press4,BTN4,{edge:1,repeat:1});setWatch(global.__voxMCBack,BTN2,{edge:1,repeat:1});" +
                "global.__voxMCTimer=setInterval(global.__voxMCDyn,1000);global.__voxMCAuto=setTimeout(global.__voxMCBack,120000);" +
                "global.__voxMCDraw();print('VOX'+'_MC:READY');" +
                "}catch(e){print('VOX'+'_MC:ERR:'+e);setTimeout(function(){load('clock.app.js');},1000);}})();\n";
        sendConsole(js);
        lastWatchStatePush = SystemClock.elapsedRealtime();
    }

    private void pushStateToWatch(MediaSnapshot s) {
        if (!bridgeActive || !requireConsoleSilent()) return;
        long posSec = Math.max(0,s.positionMs/1000);
        long durSec = Math.max(1,s.durationMs/1000);
        String js = "if(global.__voxMC){global.__voxMC.pos=" + posSec +
                ";global.__voxMC.dur=" + durSec +
                ";global.__voxMC.playing=" + (s.playing ? "true" : "false") +
                ";global.__voxMC.last=getTime();Dickens.buttonIcons=[global.__voxMC.playing?'pause':'play','clock','down','up'];if(global.__voxMCDyn)global.__voxMCDyn();}\n";
        sendConsole(js);
        lastWatchStatePush = SystemClock.elapsedRealtime();
    }

    private void returnToClock() {
        if (!requireConsole()) return;
        bridgeActive = false;
        lastWatchTrackKey = "";
        sendConsole("try{if(global.__voxMCTimer)clearInterval(global.__voxMCTimer);if(global.__voxMCAuto)clearTimeout(global.__voxMCAuto);}catch(e){}load('clock.app.js');\n");
        watchStatus.setText("WATCH / RETURNING TO BETHESDA CLOCK");
    }

    private void handleNotify(byte[] value) {
        if (value == null || value.length == 0) return;
        String s = new String(value,StandardCharsets.UTF_8);
        synchronized (watchRx) {
            watchRx.append(s);
            int nl;
            while ((nl = indexOfNewline(watchRx)) >= 0) {
                String line = watchRx.substring(0,nl).replace("\r","").trim();
                watchRx.delete(0,nl+1);
                if (!line.isEmpty()) processWatchLine(line);
            }
            if (watchRx.length() > 2048) watchRx.delete(0,watchRx.length()-512);
        }
    }

    private int indexOfNewline(StringBuilder b) {
        for (int i=0;i<b.length();i++) if (b.charAt(i)=='\n') return i;
        return -1;
    }

    private void processWatchLine(String line) {
        if (line.length() < 96 && line.contains("VOX_MC:")) {
            int p = line.indexOf("VOX_MC:");
            String cmd = line.substring(p+7).trim();
            append("WATCH >> " + cmd);
            runOnUiThread(() -> handleWatchCommand(cmd));
        }
    }

    private void handleWatchCommand(String cmd) {
        if ("READY".equals(cmd)) {
            watchStatus.setText("WATCH / MUSIC CONTROL+ ACTIVE / RAM");
            return;
        }
        if ("EXIT".equals(cmd)) {
            bridgeActive = false;
            lastWatchTrackKey = "";
            watchStatus.setText("WATCH / BETHESDA CLOCK");
            return;
        }
        if (cmd.startsWith("ERR:")) {
            bridgeActive = false;
            watchStatus.setText("WATCH / MUSIC+ ERROR / RECOVERING");
            return;
        }
        refreshMedia();
        MediaController c = primaryController;
        if (c == null) return;
        try {
            PlaybackState ps = c.getPlaybackState();
            if ("PLAYPAUSE".equals(cmd)) {
                if (ps != null && ps.getState() == PlaybackState.STATE_PLAYING) c.getTransportControls().pause();
                else c.getTransportControls().play();
            } else if ("NEXT".equals(cmd)) {
                c.getTransportControls().skipToNext();
            } else if ("PREV".equals(cmd)) {
                c.getTransportControls().skipToPrevious();
            } else if ("VOLUP".equals(cmd)) {
                c.adjustVolume(AudioManager.ADJUST_RAISE,0);
            } else if ("VOLDOWN".equals(cmd)) {
                c.adjustVolume(AudioManager.ADJUST_LOWER,0);
            }
            handler.postDelayed(() -> {
                MediaSnapshot n = refreshMedia();
                if (n != null && bridgeActive) pushStateToWatch(n);
            },300);
        } catch (Exception e) {
            append("MEDIA COMMAND ERROR " + e);
        }
    }

    private WatchImage encodeArtwork(Bitmap input, int w, int h) {
        Bitmap b = Bitmap.createScaledBitmap(input,w,h,true);
        int[] px = new int[w*h];
        b.getPixels(px,0,w,0,0,w,h);
        final int k = 16;
        int[][] c = new int[k][3];
        for (int i=0;i<k;i++) {
            int col = px[Math.min(px.length-1,(i*px.length)/k)];
            c[i][0]=Color.red(col); c[i][1]=Color.green(col); c[i][2]=Color.blue(col);
        }
        int[] idx = new int[px.length];
        for (int it=0;it<7;it++) {
            long[][] sum = new long[k][3];
            int[] count = new int[k];
            for (int i=0;i<px.length;i++) {
                int r=Color.red(px[i]), g=Color.green(px[i]), bl=Color.blue(px[i]);
                int best=0; long bestD=Long.MAX_VALUE;
                for (int j=0;j<k;j++) {
                    long dr=r-c[j][0], dg=g-c[j][1], db=bl-c[j][2];
                    long d=dr*dr+dg*dg+db*db;
                    if (d<bestD){bestD=d;best=j;}
                }
                idx[i]=best; count[best]++;
                sum[best][0]+=r; sum[best][1]+=g; sum[best][2]+=bl;
            }
            for (int j=0;j<k;j++) {
                if (count[j]>0) {
                    c[j][0]=(int)(sum[j][0]/count[j]);
                    c[j][1]=(int)(sum[j][1]/count[j]);
                    c[j][2]=(int)(sum[j][2]/count[j]);
                } else {
                    int col=px[(j*997)%px.length];
                    c[j][0]=Color.red(col);c[j][1]=Color.green(col);c[j][2]=Color.blue(col);
                }
            }
        }
        for (int i=0;i<px.length;i++) {
            int r=Color.red(px[i]), g=Color.green(px[i]), bl=Color.blue(px[i]);
            int best=0; long bestD=Long.MAX_VALUE;
            for (int j=0;j<k;j++) {
                long dr=r-c[j][0], dg=g-c[j][1], db=bl-c[j][2];
                long d=dr*dr+dg*dg+db*db;
                if (d<bestD){bestD=d;best=j;}
            }
            idx[i]=best;
        }

        byte[] packed = new byte[(px.length+1)/2];
        for (int i=0;i<px.length;i+=2) {
            int a=idx[i]&15;
            int z=(i+1<px.length)?idx[i+1]&15:0;
            packed[i/2]=(byte)((a<<4)|z);
        }
        int[] pal = new int[k];
        for (int j=0;j<k;j++) {
            int r=c[j][0], g=c[j][1], bl=c[j][2];
            pal[j]=((r>>3)<<11)|((g>>2)<<5)|(bl>>3);
        }
        WatchImage wi = new WatchImage();
        wi.palette565 = pal;
        wi.base64 = Base64.encodeToString(packed,Base64.NO_WRAP);
        if (b != input) b.recycle();
        return wi;
    }

    private String toJsArray(int[] a) {
        StringBuilder s=new StringBuilder("[");
        for (int i=0;i<a.length;i++) {
            if (i>0) s.append(',');
            s.append(a[i]);
        }
        return s.append(']').toString();
    }

    private String jsQuote(String s) {
        if (s == null) s="";
        StringBuilder o=new StringBuilder("\"");
        for (int i=0;i<s.length();i++) {
            char ch=s.charAt(i);
            switch(ch) {
                case '\\': o.append("\\\\"); break;
                case '"': o.append("\\\""); break;
                case '\n': o.append("\\n"); break;
                case '\r': o.append("\\r"); break;
                case '\t': o.append("\\t"); break;
                default:
                    if (ch < 32 || ch > 126) {
                        String hex=Integer.toHexString(ch);
                        o.append("\\u");
                        for (int z=hex.length();z<4;z++) o.append('0');
                        o.append(hex);
                    } else o.append(ch);
            }
        }
        return o.append('"').toString();
    }

    private String trimWatch(String s, int max) {
        if (s==null) return "";
        s=s.replace('\n',' ').replace('\r',' ').trim();
        return s.length()<=max?s:s.substring(0,max);
    }

    private boolean requireConsole() {
        if (!requireConsoleSilent()) {
            Toast.makeText(this,"Connecte Chronomark e295 d'abord.",Toast.LENGTH_SHORT).show();
            return false;
        }
        return true;
    }

    private boolean requireConsoleSilent() {
        return consoleReady && gatt != null && uartRx != null;
    }

    private synchronized void sendConsole(String text) {
        byte[] all=text.getBytes(StandardCharsets.UTF_8);
        for (int off=0;off<all.length;off+=UART_CHUNK) {
            int n=Math.min(UART_CHUNK,all.length-off);
            byte[] p=new byte[n];
            System.arraycopy(all,off,p,0,n);
            writeQueue.add(p);
        }
        writeNext();
    }

    @SuppressLint("MissingPermission")
    private synchronized void writeNext() {
        if (writeInFlight || writeQueue.isEmpty() || gatt==null || uartRx==null) return;
        byte[] p=writeQueue.poll();
        writeInFlight=true;
        try {
            if (Build.VERSION.SDK_INT>=33) {
                int r=gatt.writeCharacteristic(uartRx,p,BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
                if (r!=0) { writeInFlight=false; handler.postDelayed(this::writeNext,30); }
            } else {
                uartRx.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
                uartRx.setValue(p);
                if (!gatt.writeCharacteristic(uartRx)) {
                    writeInFlight=false;
                    handler.postDelayed(this::writeNext,30);
                }
            }
        } catch (Exception e) {
            writeInFlight=false;
            append("UART WRITE ERROR " + e);
        }
    }

    @SuppressLint("MissingPermission")
    private void closeGatt() {
        if (gatt!=null) {
            try { gatt.disconnect(); } catch(Exception ignored){}
            try { gatt.close(); } catch(Exception ignored){}
            gatt=null;
        }
        consoleReady=false;
        bridgeActive=false;
    }

    private void updateWatchButtons() {
        boolean e=consoleReady;
        launchButton.setEnabled(e);
        syncButton.setEnabled(e);
        returnButton.setEnabled(e);
    }

    private void requestPermissionsIfNeeded() {
        if (Build.VERSION.SDK_INT>=Build.VERSION_CODES.S) {
            if (checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)!=PackageManager.PERMISSION_GRANTED ||
                    checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.BLUETOOTH_SCAN,Manifest.permission.BLUETOOTH_CONNECT},REQ_BT);
            }
        } else if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION},REQ_BT);
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grantResults) {
        super.onRequestPermissionsResult(requestCode,permissions,grantResults);
        if (requestCode==REQ_BT) updateWatchButtons();
    }

    private boolean hasBtPermissions() {
        if (Build.VERSION.SDK_INT>=Build.VERSION_CODES.S) {
            return checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)==PackageManager.PERMISSION_GRANTED &&
                    checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED;
        }
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED;
    }

    private boolean isNotificationListenerEnabled() {
        try {
            String flat=Settings.Secure.getString(getContentResolver(),"enabled_notification_listeners");
            return flat!=null && flat.contains(getPackageName());
        } catch(Exception e){ return false; }
    }

    private Bitmap getArtwork(MediaMetadata md) {
        Bitmap b=md.getBitmap(MediaMetadata.METADATA_KEY_ART);
        if (b==null) b=md.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);
        if (b==null) b=md.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON);
        return b;
    }

    private long estimatePosition(PlaybackState s) {
        if (s==null) return 0;
        long p=Math.max(0,s.getPosition());
        if (s.getState()==PlaybackState.STATE_PLAYING && s.getLastPositionUpdateTime()>0) {
            long dt=Math.max(0,SystemClock.elapsedRealtime()-s.getLastPositionUpdateTime());
            p+=(long)(dt*s.getPlaybackSpeed());
        }
        return Math.max(0,p);
    }

    private String value(MediaMetadata md,String...keys) {
        if (md==null) return "";
        for(String k:keys){
            CharSequence t=md.getText(k);
            if(t!=null && t.length()>0) return t.toString();
            String s=md.getString(k);
            if(!TextUtils.isEmpty(s)) return s;
        }
        return "";
    }

    private String getAppLabel(String pkg) {
        try {
            PackageManager pm=getPackageManager();
            ApplicationInfo ai=pm.getApplicationInfo(pkg,0);
            CharSequence l=pm.getApplicationLabel(ai);
            return l==null?pkg:l.toString();
        } catch(Exception e){ return pkg; }
    }

    private String firstNonEmpty(String...v) {
        for(String s:v) if(!TextUtils.isEmpty(s)) return s;
        return "";
    }

    private String nullToEmpty(String s){return s==null?"":s;}

    private String formatTime(long ms) {
        if (ms<=0) return "00:00";
        long sec=ms/1000;
        long h=sec/3600, m=(sec%3600)/60, s=sec%60;
        if(h>0) return String.format(Locale.ROOT,"%d:%02d:%02d",h,m,s);
        return String.format(Locale.ROOT,"%02d:%02d",m,s);
    }

    private TextView text(String s,int size,int color) {
        TextView t=new TextView(this);
        t.setText(s);t.setTextSize(size);t.setTextColor(color);
        return t;
    }

    private TextView label(String s) {
        TextView t=text(s,11,Color.rgb(164,169,167));
        t.setPadding(0,dp(12),0,dp(5));
        return t;
    }

    private Button button(String s) {
        Button b=new Button(this);
        b.setText(s);b.setTextSize(10);b.setAllCaps(false);
        return b;
    }

    private LinearLayout.LayoutParams lp(int w,int h){return new LinearLayout.LayoutParams(w,h);}
    private int dp(int v){return Math.round(v*getResources().getDisplayMetrics().density);}

    private void append(String s) {
        runOnUiThread(() -> {
            String old=log==null?"":log.getText().toString();
            if(old.length()>10000) old=old.substring(old.length()-7000);
            if(log!=null) log.setText(old + (old.isEmpty()?"":"\n") + s);
        });
    }

    private static class MediaSnapshot {
        String packageName="",appLabel="",title="",artist="",album="";
        long positionMs,durationMs;
        boolean playing;
        Bitmap art;
    }

    private static class WatchImage {
        int[] palette565;
        String base64;
    }
}
