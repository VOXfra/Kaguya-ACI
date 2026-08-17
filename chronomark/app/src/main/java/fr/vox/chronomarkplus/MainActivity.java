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
import java.util.Locale;
import java.util.Queue;
import java.util.Set;
import java.util.UUID;

public class MainActivity extends Activity {
    private static final int REQ_BT = 1001;
    private static final UUID NUS_SERVICE = UUID.fromString("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID BATTERY_SERVICE = UUID.fromString("0000180f-0000-1000-8000-00805f9b34fb");
    private static final UUID BATTERY_LEVEL = UUID.fromString("00002a19-0000-1000-8000-00805f9b34fb");

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final StringBuilder report = new StringBuilder();
    private final Set<String> seen = new HashSet<>();
    private final Queue<BluetoothGattCharacteristic> readQueue = new ArrayDeque<>();

    private BluetoothAdapter adapter;
    private BluetoothLeScanner scanner;
    private BluetoothGatt gatt;
    private LinearLayout deviceList;
    private TextView status;
    private TextView log;
    private Button scanButton;
    private Button exportButton;
    private boolean scanning;

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
        append("CHRONOMARK+ v0.1.0 / READ-ONLY BLE SURVEY");
        append("No characteristic will be written and no firmware will be flashed.");
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
        sub.setText("CONSTELLATION DEVICE DIAGNOSTICS / v0.1.0");
        sub.setTextColor(Color.rgb(211, 71, 54));
        sub.setTextSize(12);
        sub.setPadding(0, 0, 0, dp(14));
        root.addView(sub);

        status = new TextView(this);
        status.setText("STATUS / READY");
        status.setTextColor(Color.rgb(122, 198, 190));
        status.setTextSize(14);
        status.setPadding(dp(10), dp(10), dp(10), dp(10));
        status.setBackgroundColor(Color.rgb(27, 34, 38));
        root.addView(status, new LinearLayout.LayoutParams(-1, -2));

        LinearLayout buttons = new LinearLayout(this);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        buttons.setPadding(0, dp(12), 0, dp(8));
        scanButton = button("SCAN FOR CHRONOMARK");
        exportButton = button("EXPORT");
        exportButton.setEnabled(false);
        buttons.addView(scanButton, new LinearLayout.LayoutParams(0, dp(48), 1f));
        buttons.addView(exportButton, new LinearLayout.LayoutParams(0, dp(48), .45f));
        root.addView(buttons);

        TextView found = label("NEARBY BLE DEVICES / TAP TO CONNECT");
        root.addView(found);

        ScrollView devicesScroll = new ScrollView(this);
        deviceList = new LinearLayout(this);
        deviceList.setOrientation(LinearLayout.VERTICAL);
        devicesScroll.addView(deviceList);
        root.addView(devicesScroll, new LinearLayout.LayoutParams(-1, dp(190)));

        TextView telemetry = label("GATT SURVEY / READ ONLY");
        telemetry.setPadding(0, dp(10), 0, dp(5));
        root.addView(telemetry);

        log = new TextView(this);
        log.setTextColor(Color.rgb(219, 219, 210));
        log.setTextSize(11);
        log.setTypeface(android.graphics.Typeface.MONOSPACE);
        log.setMovementMethod(new ScrollingMovementMethod());
        log.setPadding(dp(10), dp(10), dp(10), dp(10));
        log.setBackgroundColor(Color.rgb(7, 10, 12));
        root.addView(log, new LinearLayout.LayoutParams(-1, 0, 1f));

        scanButton.setOnClickListener(v -> startScan());
        exportButton.setOnClickListener(v -> exportReport());
        setContentView(root);
    }

    private TextView label(String s) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextColor(Color.rgb(164, 169, 167));
        t.setTextSize(11);
        return t;
    }

    private Button button(String s) {
        Button b = new Button(this);
        b.setText(s);
        b.setTextSize(11);
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
        if (requestCode == REQ_BT) {
            for (int result : grantResults) {
                if (result != PackageManager.PERMISSION_GRANTED) {
                    setStatus("BLUETOOTH PERMISSION REQUIRED");
                    Toast.makeText(this, "Autorise Appareils à proximité pour scanner la montre.", Toast.LENGTH_LONG).show();
                    return;
                }
            }
            setStatus("READY");
        }
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
        if (scanner == null) scanner = adapter.getBluetoothLeScanner();
        if (scanner == null) {
            setStatus("BLE SCANNER UNAVAILABLE");
            return;
        }
        if (scanning) {
            stopScan();
            return;
        }
        deviceList.removeAllViews();
        seen.clear();
        scanning = true;
        scanButton.setText("STOP SCAN");
        setStatus("SCANNING / 12 SECONDS");
        append("\n--- BLE SCAN START ---");
        scanner.startScan(scanCallback);
        handler.postDelayed(this::stopScan, 12000);
    }

    @SuppressLint("MissingPermission")
    private void stopScan() {
        if (!scanning) return;
        scanning = false;
        scanButton.setText("SCAN FOR CHRONOMARK");
        if (scanner != null && hasBtPermissions()) scanner.stopScan(scanCallback);
        setStatus("SCAN COMPLETE / TAP DEVICE TO CONNECT");
        append("--- BLE SCAN END ---");
    }

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override public void onScanResult(int callbackType, ScanResult result) { showResult(result); }
        @Override public void onBatchScanResults(java.util.List<ScanResult> results) { for (ScanResult r : results) showResult(r); }
        @Override public void onScanFailed(int errorCode) { runOnUiThread(() -> { setStatus("SCAN FAILED / " + errorCode); append("Scan failed: " + errorCode); }); }
    };

    @SuppressLint("MissingPermission")
    private void showResult(ScanResult result) {
        BluetoothDevice d = result.getDevice();
        if (d == null) return;
        String key = d.getAddress();
        if (!seen.add(key)) return;
        String name;
        try { name = d.getName(); } catch (SecurityException e) { name = null; }
        if ((name == null || name.trim().isEmpty()) && result.getScanRecord() != null) name = result.getScanRecord().getDeviceName();
        final String finalName = name == null ? "Unnamed BLE device" : name;
        int rssi = result.getRssi();
        boolean likely = finalName.toLowerCase(Locale.ROOT).contains("chronomark") || finalName.toLowerCase(Locale.ROOT).contains("dickens") || finalName.toLowerCase(Locale.ROOT).contains("starfield");
        append("FOUND " + finalName + " / " + key + " / RSSI " + rssi + (likely ? " / LIKELY CHRONOMARK" : ""));
        runOnUiThread(() -> {
            Button row = button((likely ? "★ " : "") + finalName + "\n" + key + "   RSSI " + rssi);
            row.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
            row.setOnClickListener(v -> connect(d, finalName));
            deviceList.addView(row, new LinearLayout.LayoutParams(-1, dp(58)));
        });
    }

    @SuppressLint("MissingPermission")
    private void connect(BluetoothDevice device, String name) {
        stopScan();
        if (gatt != null) {
            gatt.close();
            gatt = null;
        }
        readQueue.clear();
        setStatus("CONNECTING / " + name);
        append("\n--- CONNECT " + name + " / " + device.getAddress() + " ---");
        gatt = device.connectGatt(this, false, gattCallback, BluetoothDevice.TRANSPORT_LE);
    }

    private final BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
        @Override
        public void onConnectionStateChange(BluetoothGatt g, int statusCode, int newState) {
            if (newState == BluetoothGatt.STATE_CONNECTED) {
                runOnUiThread(() -> setStatus("CONNECTED / DISCOVERING SERVICES"));
                append("Connected. GATT status=" + statusCode);
                try { g.discoverServices(); } catch (SecurityException e) { append("discoverServices permission error: " + e); }
            } else if (newState == BluetoothGatt.STATE_DISCONNECTED) {
                append("Disconnected. GATT status=" + statusCode);
                runOnUiThread(() -> setStatus("DISCONNECTED"));
            }
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt g, int statusCode) {
            append("Services discovered. status=" + statusCode + " count=" + g.getServices().size());
            boolean nus = false;
            for (BluetoothGattService s : g.getServices()) {
                append("SERVICE " + s.getUuid() + uuidHint(s.getUuid()));
                if (NUS_SERVICE.equals(s.getUuid())) nus = true;
                for (BluetoothGattCharacteristic c : s.getCharacteristics()) {
                    append("  CHAR " + c.getUuid() + " props=" + props(c.getProperties()) + uuidHint(c.getUuid()));
                    for (BluetoothGattDescriptor d : c.getDescriptors()) append("    DESC " + d.getUuid());
                    if ((c.getProperties() & BluetoothGattCharacteristic.PROPERTY_READ) != 0) readQueue.add(c);
                }
            }
            append(nus ? "NORDIC UART / ESPRUINO SERVICE DETECTED" : "Nordic UART service not exposed in this GATT table.");
            final boolean nusFound = nus;
            runOnUiThread(() -> setStatus(nusFound ? "CONNECTED / ESPRUINO UART FOUND" : "CONNECTED / GATT MAPPED"));
            readNext(g);
        }

        @Override
        public void onCharacteristicRead(BluetoothGatt g, BluetoothGattCharacteristic c, int statusCode) {
            byte[] value = c.getValue();
            append("READ " + c.getUuid() + " status=" + statusCode + " value=" + decode(value));
            readNext(g);
        }

        @Override
        public void onCharacteristicRead(BluetoothGatt g, BluetoothGattCharacteristic c, byte[] value, int statusCode) {
            append("READ " + c.getUuid() + " status=" + statusCode + " value=" + decode(value));
            readNext(g);
        }
    };

    @SuppressLint("MissingPermission")
    private synchronized void readNext(BluetoothGatt g) {
        BluetoothGattCharacteristic c = readQueue.poll();
        if (c == null) {
            append("--- READ-ONLY GATT SURVEY COMPLETE ---");
            runOnUiThread(() -> { setStatus("SURVEY COMPLETE / EXPORT REPORT"); exportButton.setEnabled(true); });
            return;
        }
        try {
            boolean queued = g.readCharacteristic(c);
            if (!queued) {
                append("READ NOT QUEUED " + c.getUuid());
                handler.post(() -> readNext(g));
            }
        } catch (Exception e) {
            append("READ ERROR " + c.getUuid() + " / " + e.getClass().getSimpleName());
            handler.post(() -> readNext(g));
        }
    }

    private String uuidHint(UUID u) {
        if (NUS_SERVICE.equals(u)) return " [Nordic UART / Espruino]";
        if (BATTERY_SERVICE.equals(u)) return " [Battery Service]";
        if (BATTERY_LEVEL.equals(u)) return " [Battery Level]";
        String s = u.toString().toLowerCase(Locale.ROOT);
        if (s.startsWith("0000180a")) return " [Device Information]";
        if (s.startsWith("00002a26")) return " [Firmware Revision]";
        if (s.startsWith("00002a27")) return " [Hardware Revision]";
        if (s.startsWith("00002a24")) return " [Model Number]";
        if (s.startsWith("00002a29")) return " [Manufacturer]";
        return "";
    }

    private String props(int p) {
        StringBuilder s = new StringBuilder();
        if ((p & BluetoothGattCharacteristic.PROPERTY_READ) != 0) s.append("READ|");
        if ((p & BluetoothGattCharacteristic.PROPERTY_WRITE) != 0) s.append("WRITE|");
        if ((p & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0) s.append("WRITE_NR|");
        if ((p & BluetoothGattCharacteristic.PROPERTY_NOTIFY) != 0) s.append("NOTIFY|");
        if ((p & BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0) s.append("INDICATE|");
        return s.length() == 0 ? "NONE" : s.substring(0, s.length() - 1);
    }

    private String decode(byte[] b) {
        if (b == null) return "<null>";
        StringBuilder hex = new StringBuilder();
        for (byte x : b) hex.append(String.format(Locale.ROOT, "%02X ", x & 0xff));
        String ascii = new String(b, StandardCharsets.UTF_8).replaceAll("[^\\x20-\\x7E]", ".");
        return "HEX[" + hex.toString().trim() + "] ASCII[" + ascii + "]";
    }

    private synchronized void append(String s) {
        report.append(s).append('\n');
        runOnUiThread(() -> {
            log.setText(report.toString());
            log.post(() -> {
                if (log.getLayout() != null) {
                    int scroll = log.getLayout().getLineTop(log.getLineCount()) - log.getHeight();
                    if (scroll > 0) log.scrollTo(0, scroll);
                }
            });
        });
    }

    private void setStatus(String s) { status.setText("STATUS / " + s); }

    private void exportReport() {
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType("text/plain");
        i.putExtra(Intent.EXTRA_SUBJECT, "Chronomark+ BLE Diagnostic");
        i.putExtra(Intent.EXTRA_TEXT, report.toString());
        startActivity(Intent.createChooser(i, "Exporter le diagnostic Chronomark+"));
    }

    private boolean hasBtPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED &&
                    checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        }
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        handler.removeCallbacksAndMessages(null);
        try { if (scanning && scanner != null && hasBtPermissions()) scanner.stopScan(scanCallback); } catch (Exception ignored) {}
        try { if (gatt != null) gatt.close(); } catch (Exception ignored) {}
    }
}
