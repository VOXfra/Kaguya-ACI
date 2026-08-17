package fr.vox.chronomarkplus;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
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
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.method.ScrollingMovementMethod;
import android.view.View;
import android.widget.Button;
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

    private static final UUID NUS_SERVICE = UUID.fromString("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID NUS_RX_PHONE_TO_WATCH = UUID.fromString("6e400002-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID NUS_TX_WATCH_TO_PHONE = UUID.fromString("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Set<String> seen = new HashSet<>();
    private final Queue<byte[]> writeQueue = new ArrayDeque<>();
    private final StringBuilder report = new StringBuilder();

    private BluetoothAdapter adapter;
    private BluetoothLeScanner scanner;
    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic uartRx;
    private BluetoothGattCharacteristic uartTx;

    private LinearLayout deviceList;
    private TextView status;
    private TextView log;
    private Button scanButton;
    private Button testButton;
    private Button returnButton;
    private Button infoButton;

    private boolean scanning;
    private boolean consoleReady;
    private boolean writeInFlight;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildUi();

        BluetoothManager manager = getSystemService(BluetoothManager.class);
        adapter = manager != null ? manager.getAdapter() : null;
        if (adapter == null) {
            setStatus("BLUETOOTH UNAVAILABLE");
            scanButton.setEnabled(false);
            return;
        }
        scanner = adapter.getBluetoothLeScanner();
        requestPermissionsIfNeeded();

        append("CHRONOMARK+ v0.4.0 / CONSTELLATION RAM UI LAB");
        append("WATCH STORAGE POLICY: ZERO PERSISTENT WRITES.");
        append("No Storage.write(), erase(), optimise(), save(), reset(), Flash write or DFU operation exists in this build.");
        append("RAM UI test auto-exits to clock.app.js after 15 seconds. BTN2 is an immediate local escape.");
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(18), dp(18), dp(18));
        root.setBackgroundColor(Color.rgb(15, 19, 22));

        TextView title = new TextView(this);
        title.setText("CHRONOMARK+");
        title.setTextColor(Color.rgb(240, 231, 205));
        title.setTextSize(28);
        title.setLetterSpacing(0.08f);
        root.addView(title);

        TextView sub = new TextView(this);
        sub.setText("CONSTELLATION RAM UI LAB / v0.4.0");
        sub.setTextColor(Color.rgb(211, 71, 54));
        sub.setTextSize(12);
        sub.setPadding(0, 0, 0, dp(12));
        root.addView(sub);

        status = new TextView(this);
        status.setText("STATUS / READY");
        status.setTextColor(Color.rgb(122, 198, 190));
        status.setTextSize(13);
        status.setPadding(dp(10), dp(10), dp(10), dp(10));
        status.setBackgroundColor(Color.rgb(27, 34, 38));
        root.addView(status, new LinearLayout.LayoutParams(-1, -2));

        scanButton = button("SCAN FOR CHRONOMARK");
        scanButton.setOnClickListener(v -> startScan());
        LinearLayout.LayoutParams scanLp = new LinearLayout.LayoutParams(-1, dp(48));
        scanLp.setMargins(0, dp(10), 0, dp(8));
        root.addView(scanButton, scanLp);

        root.addView(label("NEARBY BLE DEVICES / TAP CHRONOMARK"));

        ScrollView devicesScroll = new ScrollView(this);
        deviceList = new LinearLayout(this);
        deviceList.setOrientation(LinearLayout.VERTICAL);
        devicesScroll.addView(deviceList);
        root.addView(devicesScroll, new LinearLayout.LayoutParams(-1, dp(125)));

        TextView lab = label("RAM-ONLY WATCH TESTS");
        lab.setPadding(0, dp(8), 0, dp(4));
        root.addView(lab);

        testButton = button("CONSTELLATION UI TEST / 15s");
        testButton.setEnabled(false);
        testButton.setOnClickListener(v -> launchRamUiTest());
        root.addView(testButton, new LinearLayout.LayoutParams(-1, dp(50)));

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setPadding(0, dp(5), 0, dp(5));
        returnButton = button("RETURN TO CLOCK");
        infoButton = button("SYSTEM INFO");
        returnButton.setEnabled(false);
        infoButton.setEnabled(false);
        returnButton.setOnClickListener(v -> returnToClock());
        infoButton.setOnClickListener(v -> systemInfo());
        row.addView(returnButton, new LinearLayout.LayoutParams(0, dp(46), 1f));
        row.addView(infoButton, new LinearLayout.LayoutParams(0, dp(46), 1f));
        root.addView(row);

        TextView safety = label("SAFETY / NO WATCH FILES CREATED OR MODIFIED");
        safety.setTextColor(Color.rgb(122, 198, 190));
        safety.setPadding(0, dp(3), 0, dp(5));
        root.addView(safety);

        log = new TextView(this);
        log.setTextColor(Color.rgb(219, 219, 210));
        log.setTextSize(10);
        log.setTypeface(android.graphics.Typeface.MONOSPACE);
        log.setMovementMethod(new ScrollingMovementMethod());
        log.setPadding(dp(10), dp(10), dp(10), dp(10));
        log.setBackgroundColor(Color.rgb(7, 10, 12));
        root.addView(log, new LinearLayout.LayoutParams(-1, 0, 1f));

        setContentView(root);
    }

    private TextView label(String text) {
        TextView t = new TextView(this);
        t.setText(text);
        t.setTextColor(Color.rgb(164, 169, 167));
        t.setTextSize(11);
        return t;
    }

    private Button button(String text) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextSize(10);
        b.setAllCaps(false);
        return b;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private void requestPermissionsIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED ||
                    checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT}, REQ_BT);
            }
        } else if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, REQ_BT);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_BT) return;
        for (int r : grantResults) {
            if (r != PackageManager.PERMISSION_GRANTED) {
                setStatus("BLUETOOTH PERMISSION REQUIRED");
                return;
            }
        }
        setStatus("READY");
    }

    @SuppressLint("MissingPermission")
    private void startScan() {
        if (!hasBtPermissions()) {
            requestPermissionsIfNeeded();
            return;
        }
        if (!adapter.isEnabled()) {
            Toast.makeText(this, "Active le Bluetooth puis relance le scan.", Toast.LENGTH_LONG).show();
            return;
        }
        if (scanning) {
            stopScan();
            return;
        }
        if (scanner == null) scanner = adapter.getBluetoothLeScanner();
        if (scanner == null) {
            setStatus("BLE SCANNER UNAVAILABLE");
            return;
        }

        deviceList.removeAllViews();
        seen.clear();
        scanning = true;
        scanButton.setText("STOP SCAN");
        setStatus("SCANNING / 15 SECONDS");
        append("\n--- BLE SCAN START ---");
        scanner.startScan(scanCallback);
        handler.postDelayed(this::stopScan, 15000);
    }

    @SuppressLint("MissingPermission")
    private void stopScan() {
        if (!scanning) return;
        scanning = false;
        scanButton.setText("SCAN FOR CHRONOMARK");
        try { if (scanner != null && hasBtPermissions()) scanner.stopScan(scanCallback); } catch (Exception ignored) {}
        setStatus("SCAN COMPLETE / TAP CHRONOMARK");
        append("--- BLE SCAN END ---");
    }

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override public void onScanResult(int callbackType, ScanResult result) { showResult(result); }
        @Override public void onBatchScanResults(List<ScanResult> results) { for (ScanResult r : results) showResult(r); }
        @Override public void onScanFailed(int errorCode) {
            runOnUiThread(() -> {
                setStatus("SCAN FAILED / " + errorCode);
                append("Scan failed: " + errorCode);
            });
        }
    };

    @SuppressLint("MissingPermission")
    private void showResult(ScanResult result) {
        BluetoothDevice device = result.getDevice();
        if (device == null) return;
        String address = device.getAddress();
        if (!seen.add(address)) return;

        String name = null;
        try { name = device.getName(); } catch (Exception ignored) {}
        if ((name == null || name.trim().isEmpty()) && result.getScanRecord() != null) name = result.getScanRecord().getDeviceName();
        if (name == null || name.trim().isEmpty()) name = "Unnamed BLE device";

        final String finalName = name;
        final int rssi = result.getRssi();
        String l = finalName.toLowerCase(Locale.ROOT);
        final boolean chronomark = l.contains("chronomark") || l.contains("dickens") || l.contains("starfield") || l.contains("dfutarg");

        append("FOUND " + finalName + " / " + address + " / RSSI " + rssi + (chronomark ? " / CHRONOMARK FAMILY" : ""));
        runOnUiThread(() -> {
            Button row = button((chronomark ? "★ " : "") + finalName + "\n" + address + "   RSSI " + rssi);
            row.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
            row.setOnClickListener(v -> connect(device, finalName));
            deviceList.addView(row, new LinearLayout.LayoutParams(-1, dp(56)));
        });
    }

    @SuppressLint("MissingPermission")
    private void connect(BluetoothDevice device, String name) {
        stopScan();
        closeGatt();
        consoleReady = false;
        uartRx = null;
        uartTx = null;
        writeQueue.clear();
        writeInFlight = false;
        setControls(false);
        append("\n--- CONNECT " + name + " / " + device.getAddress() + " ---");
        setStatus("CONNECTING / " + name);
        gatt = device.connectGatt(this, false, gattCallback, BluetoothDevice.TRANSPORT_LE);
    }

    private final BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
        @Override
        public void onConnectionStateChange(BluetoothGatt bg, int statusCode, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                append("Connected. GATT status=" + statusCode);
                runOnUiThread(() -> setStatus("CONNECTED / DISCOVERING"));
                try { bg.requestMtu(185); } catch (Exception ignored) {}
                try { bg.discoverServices(); } catch (Exception e) { append("discoverServices error: " + e); }
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                append("Disconnected. GATT status=" + statusCode);
                consoleReady = false;
                runOnUiThread(() -> {
                    setControls(false);
                    setStatus("DISCONNECTED");
                });
            }
        }

        @Override public void onMtuChanged(BluetoothGatt bg, int mtu, int statusCode) { append("MTU " + mtu + " status=" + statusCode); }

        @Override
        public void onServicesDiscovered(BluetoothGatt bg, int statusCode) {
            append("Services discovered. status=" + statusCode + " count=" + bg.getServices().size());
            BluetoothGattService nus = bg.getService(NUS_SERVICE);
            if (nus == null) {
                append("Nordic UART / Espruino service not found.");
                runOnUiThread(() -> setStatus("NOT ESPRUINO / NO NUS"));
                return;
            }
            uartRx = nus.getCharacteristic(NUS_RX_PHONE_TO_WATCH);
            uartTx = nus.getCharacteristic(NUS_TX_WATCH_TO_PHONE);
            if (uartRx == null || uartTx == null) {
                append("NUS characteristics incomplete.");
                return;
            }
            append("NORDIC UART / ESPRUINO DETECTED");
            enableNotifications(bg);
        }

        @Override
        public void onDescriptorWrite(BluetoothGatt bg, BluetoothGattDescriptor descriptor, int statusCode) {
            append("UART CCCD status=" + statusCode);
            if (CCCD.equals(descriptor.getUuid()) && statusCode == BluetoothGatt.GATT_SUCCESS) {
                consoleReady = true;
                runOnUiThread(() -> {
                    setControls(true);
                    setStatus("ESPRUINO READY / RAM ONLY");
                });
                append("ESPRUINO UART READY");
            }
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt bg, BluetoothGattCharacteristic c) {
            handleNotify(c.getValue());
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt bg, BluetoothGattCharacteristic c, byte[] value) {
            handleNotify(value);
        }

        @Override
        public void onCharacteristicWrite(BluetoothGatt bg, BluetoothGattCharacteristic c, int statusCode) {
            writeInFlight = false;
            if (statusCode != BluetoothGatt.GATT_SUCCESS) append("UART write status=" + statusCode);
            writeNext();
        }
    };

    @SuppressLint("MissingPermission")
    private void enableNotifications(BluetoothGatt bg) {
        try {
            boolean ok = bg.setCharacteristicNotification(uartTx, true);
            append("UART local notification enable=" + ok);
            BluetoothGattDescriptor d = uartTx.getDescriptor(CCCD);
            if (d == null) {
                append("UART CCCD missing");
                return;
            }
            if (Build.VERSION.SDK_INT >= 33) {
                int r = bg.writeDescriptor(d, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                append("UART CCCD write queued result=" + r);
            } else {
                d.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                boolean r = bg.writeDescriptor(d);
                append("UART CCCD write queued result=" + r);
            }
        } catch (Exception e) {
            append("Enable notifications error: " + e);
        }
    }

    private void handleNotify(byte[] value) {
        if (value == null || value.length == 0) return;
        String s = new String(value, StandardCharsets.UTF_8);
        append("UART << " + printable(s));
        if (s.contains("VOX_RAM_UI:READY")) runOnUiThread(() -> setStatus("WATCH UI TEST ACTIVE / AUTO RETURN 15s"));
        if (s.contains("VOX_RAM_UI:ERR")) runOnUiThread(() -> setStatus("WATCH UI TEST ERROR / RECOVERING"));
    }

    private void launchRamUiTest() {
        if (!requireConsole()) return;
        append("\n>>> CONSTELLATION RAM UI TEST / ZERO STORAGE WRITE");
        setStatus("SENDING RAM UI TEST");

        String js = "(function(){try{" +
                "if(global.__voxRamTimer)clearTimeout(global.__voxRamTimer);" +
                "if(global.__voxRamDraw)clearInterval(global.__voxRamDraw);" +
                "E.clearWatches();" +
                "if(Dickens.pauseSeconds)Dickens.pauseSeconds();" +
                "var back=function(){try{if(global.__voxRamTimer)clearTimeout(global.__voxRamTimer);if(global.__voxRamDraw)clearInterval(global.__voxRamDraw);}catch(e){}load('clock.app.js');};" +
                "var draw=function(){" +
                "g.reset().clear(1);Dickens.loadSurround();" +
                "g.setColor('#358').fillArc(-0.97,0.97,96).fillArc(Math.PI-0.75,Math.PI+0.75,96).fillRect(37,69,201,69).fillRect(51,186,187,186);" +
                "g.setColor(-1).setBgColor('#358').setFontAlign(0,0).setFontGrotesk16().drawString('CHRONOMARK+',120,55);" +
                "g.setBgColor(0).setColor(-1).setFontGrotesk20().drawString('CONSTELLATION',119,102);" +
                "g.setFontArchitekt15().setColor('#E49E4C').drawString('RAM UI TEST',119,128);" +
                "g.setFontGrotesk14().setColor('#BBB').drawString('NO STORAGE WRITE',119,150);" +
                "Dickens.buttonIcons=['select','back','down','up'];Dickens.loadSurround();g.flip();};" +
                "draw();global.__voxRamDraw=setInterval(draw,1000);" +
                "Bangle.btnWatches=[setWatch(function(){},BTN1,{edge:1}),setWatch(back,BTN2,{edge:1}),setWatch(function(){},BTN3,{edge:1}),setWatch(function(){},BTN4,{edge:1})];" +
                "global.__voxRamTimer=setTimeout(back,15000);print('VOX_RAM_UI:READY');" +
                "}catch(e){print('VOX_RAM_UI:ERR:'+e);setTimeout(function(){load('clock.app.js');},1000);}})();\n";
        sendConsole(js);
    }

    private void returnToClock() {
        if (!requireConsole()) return;
        append("\n>>> RETURN TO ORIGINAL CLOCK / RAM ONLY");
        String js = "try{if(global.__voxRamTimer)clearTimeout(global.__voxRamTimer);if(global.__voxRamDraw)clearInterval(global.__voxRamDraw);}catch(e){}load('clock.app.js');\n";
        sendConsole(js);
        setStatus("RETURN COMMAND SENT / ORIGINAL CLOCK");
    }

    private void systemInfo() {
        if (!requireConsole()) return;
        append("\n>>> SYSTEM INFO / NON-PERSISTENT");
        sendConsole("print('VOX_SYS:'+JSON.stringify({version:process.version,board:process.env.BOARD,free:process.memory().free,usage:process.memory().usage}));\n");
    }

    private boolean requireConsole() {
        if (!consoleReady || gatt == null || uartRx == null) {
            Toast.makeText(this, "Connecte d'abord Chronomark e295.", Toast.LENGTH_SHORT).show();
            return false;
        }
        return true;
    }

    private synchronized void sendConsole(String text) {
        byte[] all = text.getBytes(StandardCharsets.UTF_8);
        for (int off = 0; off < all.length; off += UART_CHUNK) {
            int n = Math.min(UART_CHUNK, all.length - off);
            byte[] part = new byte[n];
            System.arraycopy(all, off, part, 0, n);
            writeQueue.add(part);
        }
        writeNext();
    }

    @SuppressLint("MissingPermission")
    private synchronized void writeNext() {
        if (writeInFlight || writeQueue.isEmpty() || gatt == null || uartRx == null) return;
        byte[] part = writeQueue.poll();
        writeInFlight = true;
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                int r = gatt.writeCharacteristic(uartRx, part, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
                if (r != 0) {
                    append("UART queue error=" + r);
                    writeInFlight = false;
                    handler.postDelayed(this::writeNext, 30);
                }
            } else {
                uartRx.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
                uartRx.setValue(part);
                boolean ok = gatt.writeCharacteristic(uartRx);
                if (!ok) {
                    append("UART queue rejected");
                    writeInFlight = false;
                    handler.postDelayed(this::writeNext, 30);
                }
            }
        } catch (Exception e) {
            append("UART write exception: " + e);
            writeInFlight = false;
        }
    }

    private void setControls(boolean enabled) {
        testButton.setEnabled(enabled);
        returnButton.setEnabled(enabled);
        infoButton.setEnabled(enabled);
    }

    @SuppressLint("MissingPermission")
    private void closeGatt() {
        if (gatt != null) {
            try { gatt.disconnect(); } catch (Exception ignored) {}
            try { gatt.close(); } catch (Exception ignored) {}
            gatt = null;
        }
    }

    private boolean hasBtPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED &&
                    checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        }
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void setStatus(String s) {
        runOnUiThread(() -> status.setText("STATUS / " + s));
    }

    private void append(String s) {
        report.append(s).append('\n');
        runOnUiThread(() -> {
            log.append(s + "\n");
            if (log.getLayout() != null) {
                int scroll = log.getLayout().getLineTop(log.getLineCount()) - log.getHeight();
                if (scroll > 0) log.scrollTo(0, scroll);
            }
        });
    }

    private String printable(String s) {
        return s.replace("\r", "\\r").replace("\n", "\\n");
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopScan();
        closeGatt();
    }
}
