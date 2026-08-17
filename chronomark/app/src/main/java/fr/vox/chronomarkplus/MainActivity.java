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
import java.util.Locale;
import java.util.Queue;
import java.util.Set;
import java.util.UUID;

public class MainActivity extends Activity {
    private static final int REQ_BT = 1001;

    private static final UUID NUS_SERVICE = UUID.fromString("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID NUS_TX = UUID.fromString("6e400002-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID NUS_RX = UUID.fromString("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    private static final UUID BATTERY_SERVICE = UUID.fromString("0000180f-0000-1000-8000-00805f9b34fb");
    private static final UUID BATTERY_LEVEL = UUID.fromString("00002a19-0000-1000-8000-00805f9b34fb");

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final StringBuilder report = new StringBuilder();
    private final Set<String> seen = new HashSet<>();
    private final Queue<BluetoothGattCharacteristic> readQueue = new ArrayDeque<>();
    private final Queue<byte[]> uartWriteQueue = new ArrayDeque<>();

    private BluetoothAdapter adapter;
    private BluetoothLeScanner scanner;
    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic nusTx;
    private BluetoothGattCharacteristic nusRx;

    private LinearLayout deviceList;
    private TextView status;
    private TextView log;
    private Button scanButton;
    private Button exportButton;
    private Button systemButton;
    private Button storageButton;
    private Button globalsButton;

    private boolean scanning;
    private boolean consoleReady;
    private boolean uartWriteInFlight;
    private boolean enableNusAfterReads;

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
        append("CHRONOMARK+ v0.2.0 / SAFE ESPRUINO INSPECTOR");
        append("Persistent storage writes are disabled in this build.");
        append("Allowed actions: BLE discovery, GATT reads, enabling UART notifications, non-persistent inspection commands.");
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
        sub.setText("CONSTELLATION DEVICE INSPECTOR / v0.2.0");
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

        LinearLayout topButtons = new LinearLayout(this);
        topButtons.setOrientation(LinearLayout.HORIZONTAL);
        topButtons.setPadding(0, dp(12), 0, dp(8));
        scanButton = button("SCAN FOR CHRONOMARK");
        exportButton = button("EXPORT");
        exportButton.setEnabled(false);
        topButtons.addView(scanButton, new LinearLayout.LayoutParams(0, dp(48), 1f));
        topButtons.addView(exportButton, new LinearLayout.LayoutParams(0, dp(48), .45f));
        root.addView(topButtons);

        TextView found = label("NEARBY BLE DEVICES / TAP TO CONNECT");
        root.addView(found);

        ScrollView devicesScroll = new ScrollView(this);
        deviceList = new LinearLayout(this);
        deviceList.setOrientation(LinearLayout.VERTICAL);
        devicesScroll.addView(deviceList);
        root.addView(devicesScroll, new LinearLayout.LayoutParams(-1, dp(150)));

        TextView inspector = label("ESPRUINO INSPECTION / NON-PERSISTENT");
        inspector.setPadding(0, dp(10), 0, dp(5));
        root.addView(inspector);

        LinearLayout inspectButtons = new LinearLayout(this);
        inspectButtons.setOrientation(LinearLayout.HORIZONTAL);
        systemButton = button("SYSTEM INFO");
        storageButton = button("STORAGE INDEX");
        globalsButton = button("GLOBALS");
        setInspectorEnabled(false);
        inspectButtons.addView(systemButton, new LinearLayout.LayoutParams(0, dp(48), 1f));
        inspectButtons.addView(storageButton, new LinearLayout.LayoutParams(0, dp(48), 1f));
        inspectButtons.addView(globalsButton, new LinearLayout.LayoutParams(0, dp(48), 1f));
        root.addView(inspectButtons);

        TextView telemetry = label("DEVICE + UART LOG");
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
        systemButton.setOnClickListener(v -> inspectSystem());
        storageButton.setOnClickListener(v -> inspectStorage());
        globalsButton.setOnClickListener(v -> inspectGlobals());

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
        b.setTextSize(10);
        b.setAllCaps(false);
        return b;
    }

    private void setInspectorEnabled(boolean enabled) {
        if (systemButton != null) systemButton.setEnabled(enabled);
        if (storageButton != null) storageButton.setEnabled(enabled);
        if (globalsButton != null) globalsButton.setEnabled(enabled);
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
                    Toast.makeText(this, "Autorise Appareils a proximite pour scanner la montre.", Toast.LENGTH_LONG).show();
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
        if (scanner != null && hasBtPermissions()) scanner.stopScan(scanCallback);
        setStatus("SCAN COMPLETE / TAP DEVICE TO CONNECT");
        append("--- BLE SCAN END ---");
    }

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override public void onScanResult(int callbackType, ScanResult result) { showResult(result); }
        @Override public void onBatchScanResults(java.util.List<ScanResult> results) { for (ScanResult r : results) showResult(r); }
        @Override public void onScanFailed(int errorCode) {
            runOnUiThread(() -> {
                setStatus("SCAN FAILED / " + errorCode);
                append("Scan failed: " + errorCode);
            });
        }
    };

    @SuppressLint("MissingPermission")
    private void showResult(ScanResult result) {
        BluetoothDevice d = result.getDevice();
        if (d == null) return;
        String key = d.getAddress();
        if (!seen.add(key)) return;

        String name;
        try { name = d.getName(); } catch (SecurityException e) { name = null; }
        if ((name == null || name.trim().isEmpty()) && result.getScanRecord() != null) {
            name = result.getScanRecord().getDeviceName();
        }
        final String finalName = name == null ? "Unnamed BLE device" : name;
        final int rssi = result.getRssi();
        String lower = finalName.toLowerCase(Locale.ROOT);
        final boolean likely = lower.contains("chronomark") || lower.contains("dickens") || lower.contains("starfield") || lower.contains("dfutarg");

        append("FOUND " + finalName + " / " + key + " / RSSI " + rssi + (likely ? " / CHRONOMARK FAMILY" : ""));
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
        closeGatt();
        readQueue.clear();
        uartWriteQueue.clear();
        nusTx = null;
        nusRx = null;
        consoleReady = false;
        uartWriteInFlight = false;
        enableNusAfterReads = false;
        setInspectorEnabled(false);
        exportButton.setEnabled(false);

        setStatus("CONNECTING / " + name);
        append("\n--- CONNECT " + name + " / " + device.getAddress() + " ---");
        gatt = device.connectGatt(this, false, gattCallback, BluetoothDevice.TRANSPORT_LE);
    }

    private final BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
        @Override
        public void onConnectionStateChange(BluetoothGatt g, int statusCode, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                append("Connected. GATT status=" + statusCode);
                runOnUiThread(() -> setStatus("CONNECTED / DISCOVERING SERVICES"));
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) g.requestMtu(185);
                } catch (Exception ignored) {}
                try { g.discoverServices(); }
                catch (SecurityException e) { append("discoverServices permission error: " + e); }
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                append("Disconnected. GATT status=" + statusCode);
                consoleReady = false;
                runOnUiThread(() -> {
                    setInspectorEnabled(false);
                    setStatus("DISCONNECTED");
                });
            }
        }

        @Override
        public void onMtuChanged(BluetoothGatt g, int mtu, int statusCode) {
            append("MTU " + mtu + " status=" + statusCode);
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

                    if (NUS_TX.equals(c.getUuid())) nusTx = c;
                    if (NUS_RX.equals(c.getUuid())) nusRx = c;
                    if ((c.getProperties() & BluetoothGattCharacteristic.PROPERTY_READ) != 0) readQueue.add(c);
                }
            }

            append(nus ? "NORDIC UART / ESPRUINO SERVICE DETECTED" : "Nordic UART service not exposed in this GATT table.");
            enableNusAfterReads = nusTx != null && nusRx != null;
            runOnUiThread(() -> setStatus(enableNusAfterReads ? "CONNECTED / ESPRUINO DETECTED" : "CONNECTED / GATT MAPPED"));
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

        @Override
        public void onDescriptorWrite(BluetoothGatt g, BluetoothGattDescriptor descriptor, int statusCode) {
            if (CCCD.equals(descriptor.getUuid()) && nusRx != null && descriptor.getCharacteristic().getUuid().equals(nusRx.getUuid())) {
                if (statusCode == BluetoothGatt.GATT_SUCCESS) {
                    consoleReady = true;
                    append("ESPRUINO UART NOTIFICATIONS ENABLED");
                    runOnUiThread(() -> {
                        setInspectorEnabled(true);
                        exportButton.setEnabled(true);
                        setStatus("ESPRUINO READY / SAFE INSPECTION");
                    });
                } else {
                    append("Failed to enable UART notifications. status=" + statusCode);
                    runOnUiThread(() -> setStatus("ESPRUINO DETECTED / NOTIFY FAILED"));
                }
            }
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic c) {
            handleUartNotification(c.getUuid(), c.getValue());
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic c, byte[] value) {
            handleUartNotification(c.getUuid(), value);
        }

        @Override
        public void onCharacteristicWrite(BluetoothGatt g, BluetoothGattCharacteristic c, int statusCode) {
            if (NUS_TX.equals(c.getUuid())) {
                synchronized (MainActivity.this) {
                    uartWriteInFlight = false;
                }
                if (statusCode != BluetoothGatt.GATT_SUCCESS) append("UART WRITE FAILED status=" + statusCode);
                writeNextUartChunk();
            }
        }
    };

    @SuppressLint("MissingPermission")
    private synchronized void readNext(BluetoothGatt g) {
        BluetoothGattCharacteristic c = readQueue.poll();
        if (c == null) {
            append("--- GATT READ SURVEY COMPLETE ---");
            if (enableNusAfterReads) {
                enableNusAfterReads = false;
                enableNusNotifications(g);
            } else {
                runOnUiThread(() -> {
                    exportButton.setEnabled(true);
                    setStatus("SURVEY COMPLETE / NO ESPRUINO UART");
                });
            }
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

    @SuppressLint("MissingPermission")
    private void enableNusNotifications(BluetoothGatt g) {
        if (nusRx == null) return;
        try {
            boolean local = g.setCharacteristicNotification(nusRx, true);
            append("UART local notification enable=" + local);
            BluetoothGattDescriptor cccd = nusRx.getDescriptor(CCCD);
            if (cccd == null) {
                append("UART CCCD missing");
                runOnUiThread(() -> setStatus("ESPRUINO DETECTED / CCCD MISSING"));
                return;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                int result = g.writeDescriptor(cccd, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                append("UART CCCD write queued result=" + result);
            } else {
                cccd.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                boolean queued = g.writeDescriptor(cccd);
                append("UART CCCD write queued=" + queued);
            }
        } catch (Exception e) {
            append("UART notification setup error: " + e.getClass().getSimpleName());
            runOnUiThread(() -> setStatus("ESPRUINO DETECTED / NOTIFY ERROR"));
        }
    }

    private void inspectSystem() {
        sendInspection("SYSTEM INFO",
                "print('VOX_SYS:'+JSON.stringify({version:process.version,env:process.env,memory:process.memory()}));\n");
    }

    private void inspectStorage() {
        sendInspection("STORAGE INDEX",
                "var __voxS=require('Storage');print('VOX_STORAGE:'+JSON.stringify({free:__voxS.getFree(),files:__voxS.list()}));\n");
    }

    private void inspectGlobals() {
        sendInspection("GLOBALS",
                "print('VOX_GLOBALS:'+JSON.stringify(Object.keys(global).sort()));\n");
    }

    private void sendInspection(String label, String command) {
        if (!consoleReady || gatt == null || nusTx == null) {
            Toast.makeText(this, "La console Espruino n'est pas prete.", Toast.LENGTH_SHORT).show();
            return;
        }
        append("\n>>> " + label + " / NON-PERSISTENT");
        queueUart(command.getBytes(StandardCharsets.UTF_8));
    }

    private synchronized void queueUart(byte[] data) {
        final int chunkSize = 20;
        for (int offset = 0; offset < data.length; offset += chunkSize) {
            int len = Math.min(chunkSize, data.length - offset);
            byte[] chunk = new byte[len];
            System.arraycopy(data, offset, chunk, 0, len);
            uartWriteQueue.add(chunk);
        }
        writeNextUartChunk();
    }

    @SuppressLint("MissingPermission")
    private synchronized void writeNextUartChunk() {
        if (uartWriteInFlight || gatt == null || nusTx == null) return;
        byte[] chunk = uartWriteQueue.poll();
        if (chunk == null) {
            runOnUiThread(() -> {
                if (consoleReady) setStatus("ESPRUINO READY / WAITING RESPONSE");
            });
            return;
        }

        uartWriteInFlight = true;
        runOnUiThread(() -> setStatus("ESPRUINO / SENDING INSPECTION"));
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                int result = gatt.writeCharacteristic(nusTx, chunk, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
                if (result != BluetoothGatt.GATT_SUCCESS) {
                    uartWriteInFlight = false;
                    append("UART enqueue failed result=" + result);
                    handler.post(this::writeNextUartChunk);
                }
            } else {
                nusTx.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
                nusTx.setValue(chunk);
                boolean queued = gatt.writeCharacteristic(nusTx);
                if (!queued) {
                    uartWriteInFlight = false;
                    append("UART enqueue failed");
                    handler.post(this::writeNextUartChunk);
                }
            }
        } catch (Exception e) {
            uartWriteInFlight = false;
            append("UART write exception: " + e.getClass().getSimpleName());
            handler.post(this::writeNextUartChunk);
        }
    }

    private void handleUartNotification(UUID uuid, byte[] value) {
        if (!NUS_RX.equals(uuid) || value == null) return;
        String text = printableUart(value);
        if (!text.isEmpty()) append("UART << " + text);
        runOnUiThread(() -> setStatus("ESPRUINO READY / RESPONSE RECEIVED"));
    }

    private String printableUart(byte[] value) {
        String raw = new String(value, StandardCharsets.UTF_8);
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < raw.length(); i++) {
            char c = raw.charAt(i);
            if (c == '\r') continue;
            if (c == '\n' || c == '\t' || (c >= 32 && c < 127)) out.append(c);
            else out.append(String.format(Locale.ROOT, "<%02X>", (int)c & 0xff));
        }
        return out.toString();
    }

    private String uuidHint(UUID u) {
        if (NUS_SERVICE.equals(u)) return " [Nordic UART / Espruino]";
        if (NUS_TX.equals(u)) return " [Espruino RX / phone writes]";
        if (NUS_RX.equals(u)) return " [Espruino TX / phone receives]";
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

    private void setStatus(String s) {
        status.setText("STATUS / " + s);
    }

    private void exportReport() {
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType("text/plain");
        i.putExtra(Intent.EXTRA_SUBJECT, "Chronomark+ v0.2.0 Diagnostic");
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

    @SuppressLint("MissingPermission")
    private void closeGatt() {
        try {
            if (gatt != null) {
                gatt.disconnect();
                gatt.close();
            }
        } catch (Exception ignored) {}
        gatt = null;
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        handler.removeCallbacksAndMessages(null);
        try {
            if (scanning && scanner != null && hasBtPermissions()) scanner.stopScan(scanCallback);
        } catch (Exception ignored) {}
        closeGatt();
    }
}
