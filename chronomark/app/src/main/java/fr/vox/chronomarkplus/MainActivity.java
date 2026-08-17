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
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.method.ScrollingMovementMethod;
import android.util.Base64;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Queue;
import java.util.Set;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public class MainActivity extends Activity {
    private static final int REQ_BT = 1001;
    private static final int REQ_SAVE_ZIP = 2001;
    private static final int READ_CHUNK = 256;
    private static final int UART_WRITE_CHUNK = 96;

    private static final UUID NUS_SERVICE = UUID.fromString("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID NUS_TX = UUID.fromString("6e400002-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID NUS_RX = UUID.fromString("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final StringBuilder report = new StringBuilder();
    private final StringBuilder uartText = new StringBuilder();
    private final Set<String> seen = new HashSet<>();
    private final Queue<byte[]> uartWriteQueue = new ArrayDeque<>();
    private final List<BackupItem> backupItems = new ArrayList<>();

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
    private Button infoButton;
    private Button indexButton;
    private Button backupButton;
    private Button saveButton;

    private boolean scanning;
    private boolean consoleReady;
    private boolean uartWriteInFlight;
    private boolean backupRunning;

    private String connectedName = "";
    private String connectedAddress = "";
    private String firmware = "";
    private String board = "";
    private String serial = "";
    private long storageFree = -1;

    private int backupIndex = -1;
    private BackupItem currentItem;
    private int currentOffset;
    private byte[] backupZipBytes;

    private static class BackupItem {
        final String name;
        final boolean storageFile;
        final ByteArrayOutputStream data = new ByteArrayOutputStream();
        int expectedLength = -1;
        String error = "";

        BackupItem(String name, boolean storageFile) {
            this.name = name;
            this.storageFile = storageFile;
        }
    }

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

        append("CHRONOMARK+ v0.3.0 / BETHESDA STORAGE BACKUP");
        append("WATCH STORAGE POLICY: READ ONLY.");
        append("No Storage.write(), erase(), optimise(), save(), reset(), Flash write or DFU operation exists in this build.");
        append("Backup data is assembled on the Android phone only.");
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
        sub.setText("CONSTELLATION ARCHIVE TOOL / v0.3.0");
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

        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setPadding(0, dp(10), 0, dp(7));

        scanButton = button("SCAN");
        exportButton = button("EXPORT LOG");
        top.addView(scanButton, new LinearLayout.LayoutParams(0, dp(46), 1f));
        top.addView(exportButton, new LinearLayout.LayoutParams(0, dp(46), .7f));
        root.addView(top);

        TextView found = label("NEARBY BLE DEVICES / TAP CHRONOMARK");
        root.addView(found);

        ScrollView devicesScroll = new ScrollView(this);
        deviceList = new LinearLayout(this);
        deviceList.setOrientation(LinearLayout.VERTICAL);
        devicesScroll.addView(deviceList);
        root.addView(devicesScroll, new LinearLayout.LayoutParams(-1, dp(120)));

        TextView tools = label("READ-ONLY ESPRUINO TOOLS");
        tools.setPadding(0, dp(8), 0, dp(4));
        root.addView(tools);

        LinearLayout inspect = new LinearLayout(this);
        inspect.setOrientation(LinearLayout.HORIZONTAL);
        infoButton = button("SYSTEM INFO");
        indexButton = button("STORAGE INDEX");
        inspect.addView(infoButton, new LinearLayout.LayoutParams(0, dp(46), 1f));
        inspect.addView(indexButton, new LinearLayout.LayoutParams(0, dp(46), 1f));
        root.addView(inspect);

        LinearLayout archive = new LinearLayout(this);
        archive.setOrientation(LinearLayout.HORIZONTAL);
        archive.setPadding(0, dp(5), 0, dp(5));
        backupButton = button("BACKUP BETHESDA STORAGE");
        saveButton = button("SAVE ZIP");
        archive.addView(backupButton, new LinearLayout.LayoutParams(0, dp(48), 1.25f));
        archive.addView(saveButton, new LinearLayout.LayoutParams(0, dp(48), .55f));
        root.addView(archive);

        setConsoleControls(false);
        saveButton.setEnabled(false);

        TextView telemetry = label("DEVICE / UART / BACKUP LOG");
        telemetry.setPadding(0, dp(5), 0, dp(4));
        root.addView(telemetry);

        log = new TextView(this);
        log.setTextColor(Color.rgb(219, 219, 210));
        log.setTextSize(10);
        log.setTypeface(android.graphics.Typeface.MONOSPACE);
        log.setMovementMethod(new ScrollingMovementMethod());
        log.setPadding(dp(10), dp(10), dp(10), dp(10));
        log.setBackgroundColor(Color.rgb(7, 10, 12));
        root.addView(log, new LinearLayout.LayoutParams(-1, 0, 1f));

        scanButton.setOnClickListener(v -> startScan());
        exportButton.setOnClickListener(v -> exportReport());
        infoButton.setOnClickListener(v -> inspectSystem());
        indexButton.setOnClickListener(v -> inspectStorage());
        backupButton.setOnClickListener(v -> startBackup());
        saveButton.setOnClickListener(v -> saveBackup());

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

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void setConsoleControls(boolean enabled) {
        if (infoButton != null) infoButton.setEnabled(enabled);
        if (indexButton != null) indexButton.setEnabled(enabled);
        if (backupButton != null) backupButton.setEnabled(enabled);
    }

    private void requestPermissionsIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED ||
                    checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[] {
                        Manifest.permission.BLUETOOTH_SCAN,
                        Manifest.permission.BLUETOOTH_CONNECT
                }, REQ_BT);
            }
        } else if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.ACCESS_FINE_LOCATION }, REQ_BT);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_BT) return;

        for (int result : grantResults) {
            if (result != PackageManager.PERMISSION_GRANTED) {
                setStatus("BLUETOOTH PERMISSION REQUIRED");
                Toast.makeText(this, "Autorise Appareils a proximite pour utiliser la Chronomark.", Toast.LENGTH_LONG).show();
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
        if (backupRunning) {
            Toast.makeText(this, "Un backup est en cours.", Toast.LENGTH_SHORT).show();
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
        scanButton.setText("STOP");
        setStatus("SCANNING / 15 SECONDS");
        append("\n--- BLE SCAN START ---");
        scanner.startScan(scanCallback);
        handler.postDelayed(this::stopScan, 15000);
    }

    @SuppressLint("MissingPermission")
    private void stopScan() {
        if (!scanning) return;
        scanning = false;
        scanButton.setText("SCAN");
        try {
            if (scanner != null && hasBtPermissions()) scanner.stopScan(scanCallback);
        } catch (Exception ignored) {}
        setStatus("SCAN COMPLETE / TAP DEVICE");
        append("--- BLE SCAN END ---");
    }

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            showResult(result);
        }

        @Override
        public void onBatchScanResults(List<ScanResult> results) {
            for (ScanResult result : results) showResult(result);
        }

        @Override
        public void onScanFailed(int errorCode) {
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
        try { name = device.getName(); } catch (SecurityException ignored) {}
        if ((name == null || name.trim().isEmpty()) && result.getScanRecord() != null) {
            name = result.getScanRecord().getDeviceName();
        }
        if (name == null || name.trim().isEmpty()) name = "Unnamed BLE device";

        final String finalName = name;
        final int rssi = result.getRssi();
        String lower = finalName.toLowerCase(Locale.ROOT);
        final boolean chronomark = lower.contains("chronomark") ||
                lower.contains("dickens") ||
                lower.contains("starfield") ||
                lower.contains("dfutarg");

        append("FOUND " + finalName + " / " + address + " / RSSI " + rssi +
                (chronomark ? " / CHRONOMARK FAMILY" : ""));

        runOnUiThread(() -> {
            Button row = button((chronomark ? "★ " : "") + finalName + "\n" + address + "   RSSI " + rssi);
            row.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
            row.setOnClickListener(v -> connect(device, finalName, address));
            deviceList.addView(row, new LinearLayout.LayoutParams(-1, dp(56)));
        });
    }

    @SuppressLint("MissingPermission")
    private void connect(BluetoothDevice device, String name, String address) {
        stopScan();
        closeGatt();

        connectedName = name;
        connectedAddress = address;
        consoleReady = false;
        nusTx = null;
        nusRx = null;
        uartWriteQueue.clear();
        uartWriteInFlight = false;
        backupRunning = false;
        backupZipBytes = null;
        setConsoleControls(false);
        saveButton.setEnabled(false);

        append("\n--- CONNECT " + name + " / " + address + " ---");
        setStatus("CONNECTING / " + name);
        gatt = device.connectGatt(this, false, gattCallback, BluetoothDevice.TRANSPORT_LE);
    }

    private final BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
        @Override
        public void onConnectionStateChange(BluetoothGatt bg, int statusCode, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                append("Connected. GATT status=" + statusCode);
                runOnUiThread(() -> setStatus("CONNECTED / DISCOVERING SERVICES"));
                try { bg.requestMtu(185); } catch (Exception ignored) {}
                try { bg.discoverServices(); } catch (Exception e) { append("discoverServices error: " + e); }
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                append("Disconnected. GATT status=" + statusCode);
                consoleReady = false;
                runOnUiThread(() -> {
                    setConsoleControls(false);
                    setStatus("DISCONNECTED");
                });
                if (backupRunning) abortBackup("Bluetooth disconnected during backup");
            }
        }

        @Override
        public void onMtuChanged(BluetoothGatt bg, int mtu, int statusCode) {
            append("MTU " + mtu + " status=" + statusCode);
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt bg, int statusCode) {
            append("Services discovered. status=" + statusCode + " count=" + bg.getServices().size());

            BluetoothGattService nus = bg.getService(NUS_SERVICE);
            if (nus == null) {
                append("Nordic UART / Espruino service NOT FOUND.");
                runOnUiThread(() -> setStatus("NOT A CHRONOMARK ESPRUINO CONSOLE"));
                return;
            }

            nusTx = nus.getCharacteristic(NUS_TX);
            nusRx = nus.getCharacteristic(NUS_RX);
            if (nusTx == null || nusRx == null) {
                append("Nordic UART characteristics incomplete.");
                runOnUiThread(() -> setStatus("UART CHARACTERISTICS MISSING"));
                return;
            }

            append("NORDIC UART / ESPRUINO SERVICE DETECTED");
            append("  TX phone->watch " + nusTx.getUuid());
            append("  RX watch->phone " + nusRx.getUuid());

            enableUartNotifications(bg);
        }

        @Override
        public void onDescriptorWrite(BluetoothGatt bg, BluetoothGattDescriptor descriptor, int statusCode) {
            append("UART CCCD write status=" + statusCode);
            if (CCCD.equals(descriptor.getUuid()) && statusCode == BluetoothGatt.GATT_SUCCESS) {
                consoleReady = true;
                runOnUiThread(() -> {
                    setConsoleControls(true);
                    exportButton.setEnabled(true);
                    setStatus("ESPRUINO READY / READ ONLY");
                });
                sendCommand("echo(0);print(\"VOX_READY\");\n");
            }
        }

        @Override
        public void onCharacteristicWrite(BluetoothGatt bg, BluetoothGattCharacteristic characteristic, int statusCode) {
            synchronized (MainActivity.this) {
                uartWriteInFlight = false;
                if (statusCode != BluetoothGatt.GATT_SUCCESS) {
                    append("UART write failed status=" + statusCode);
                    uartWriteQueue.clear();
                    if (backupRunning) abortBackup("UART write failed: " + statusCode);
                    return;
                }
                sendNextUartChunk();
            }
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt bg, BluetoothGattCharacteristic characteristic) {
            byte[] value = characteristic.getValue();
            receiveUart(value);
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt bg, BluetoothGattCharacteristic characteristic, byte[] value) {
            receiveUart(value);
        }
    };

    @SuppressLint("MissingPermission")
    private void enableUartNotifications(BluetoothGatt bg) {
        try {
            boolean local = bg.setCharacteristicNotification(nusRx, true);
            append("UART local notification enable=" + local);

            BluetoothGattDescriptor descriptor = nusRx.getDescriptor(CCCD);
            if (descriptor == null) {
                append("UART CCCD descriptor missing.");
                setStatus("UART CCCD MISSING");
                return;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                int result = bg.writeDescriptor(descriptor, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                append("UART CCCD write queued result=" + result);
            } else {
                descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                boolean queued = bg.writeDescriptor(descriptor);
                append("UART CCCD write queued=" + queued);
            }
        } catch (Exception e) {
            append("UART notification setup error: " + e);
            setStatus("UART SETUP ERROR");
        }
    }

    private synchronized void sendCommand(String command) {
        if (!consoleReady || gatt == null || nusTx == null) {
            append("Command rejected: console not ready.");
            return;
        }

        byte[] all = command.getBytes(StandardCharsets.UTF_8);
        int offset = 0;
        while (offset < all.length) {
            int length = Math.min(UART_WRITE_CHUNK, all.length - offset);
            byte[] part = new byte[length];
            System.arraycopy(all, offset, part, 0, length);
            uartWriteQueue.add(part);
            offset += length;
        }
        sendNextUartChunk();
    }

    @SuppressLint("MissingPermission")
    private synchronized void sendNextUartChunk() {
        if (uartWriteInFlight || uartWriteQueue.isEmpty() || gatt == null || nusTx == null) return;

        byte[] part = uartWriteQueue.poll();
        uartWriteInFlight = true;

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                int result = gatt.writeCharacteristic(
                        nusTx,
                        part,
                        BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                );
                if (result != 0) {
                    uartWriteInFlight = false;
                    append("UART write queue result=" + result);
                    if (backupRunning) abortBackup("UART queue error " + result);
                }
            } else {
                nusTx.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
                nusTx.setValue(part);
                boolean queued = gatt.writeCharacteristic(nusTx);
                if (!queued) {
                    uartWriteInFlight = false;
                    append("UART write not queued.");
                    if (backupRunning) abortBackup("UART write not queued");
                }
            }
        } catch (Exception e) {
            uartWriteInFlight = false;
            append("UART write exception: " + e);
            if (backupRunning) abortBackup("UART exception");
        }
    }

    private void receiveUart(byte[] value) {
        if (value == null || value.length == 0) return;

        String text = new String(value, StandardCharsets.UTF_8);
        synchronized (uartText) {
            uartText.append(text.replace("\r", ""));
            int newline;
            while ((newline = uartText.indexOf("\n")) >= 0) {
                String line = uartText.substring(0, newline);
                uartText.delete(0, newline + 1);
                handleUartLine(line);
            }
        }
    }

    private void handleUartLine(String line) {
        if (line == null) return;
        String clean = line.trim();
        if (clean.isEmpty()) return;

        if (clean.startsWith("VOX_")) {
            append("UART << " + clean);
        }

        try {
            if (clean.startsWith("VOX_HEAD:")) {
                JSONObject head = new JSONObject(clean.substring("VOX_HEAD:".length()));
                firmware = head.optString("v", "");
                board = head.optString("b", "");
                serial = head.optString("s", "");
                storageFree = head.optLong("f", -1);
                if (backupRunning) requestBackupList();
                return;
            }

            if (clean.startsWith("VOX_LIST:")) {
                if (!backupRunning) return;
                parseBackupList(new JSONObject(clean.substring("VOX_LIST:".length())));
                return;
            }

            if (clean.startsWith("VOX_META:")) {
                if (!backupRunning || currentItem == null) return;
                int length = Integer.parseInt(clean.substring("VOX_META:".length()).trim());
                currentItem.expectedLength = length;
                currentOffset = 0;

                if (length < 0) {
                    currentItem.error = "File not readable through expected Storage API";
                    finishCurrentFile();
                } else if (length == 0) {
                    finishCurrentFile();
                } else {
                    requestNextFileChunk();
                }
                return;
            }

            if (clean.startsWith("VOX_CHUNK:")) {
                if (!backupRunning || currentItem == null) return;
                String payload = clean.substring("VOX_CHUNK:".length()).trim();
                byte[] bytes = payload.isEmpty()
                        ? new byte[0]
                        : Base64.decode(payload, Base64.DEFAULT);

                if (bytes.length == 0 && currentOffset < currentItem.expectedLength) {
                    currentItem.error = "Unexpected end of file at offset " + currentOffset;
                    finishCurrentFile();
                    return;
                }

                currentItem.data.write(bytes, 0, bytes.length);
                currentOffset += bytes.length;

                if (currentOffset >= currentItem.expectedLength) {
                    if (currentOffset != currentItem.expectedLength) {
                        currentItem.error = "Length mismatch expected=" + currentItem.expectedLength + " got=" + currentOffset;
                    }
                    finishCurrentFile();
                } else {
                    updateBackupProgress();
                    requestNextFileChunk();
                }
            }
        } catch (Exception e) {
            append("Parser error for marker: " + e);
            if (backupRunning) abortBackup("Parser error: " + e.getClass().getSimpleName());
        }
    }

    private void inspectSystem() {
        if (!consoleReady || backupRunning) return;
        append("\n>>> SYSTEM INFO / NON-PERSISTENT");
        sendCommand(
                "print(\"VOX_INFO:\"+JSON.stringify({v:process.version,e:process.env,m:process.memory()}));\n"
        );
    }

    private void inspectStorage() {
        if (!consoleReady || backupRunning) return;
        append("\n>>> STORAGE INDEX / NON-PERSISTENT");
        sendCommand(
                "var S=require(\"Storage\");print(\"VOX_INDEX:\"+JSON.stringify({free:S.getFree(),normal:S.list(undefined,{sf:false}),sf:S.list(undefined,{sf:true})}));\n"
        );
    }

    private void startBackup() {
        if (!consoleReady || backupRunning) return;

        backupRunning = true;
        backupZipBytes = null;
        backupItems.clear();
        backupIndex = -1;
        currentItem = null;
        currentOffset = 0;
        saveButton.setEnabled(false);
        setConsoleControls(false);
        scanButton.setEnabled(false);

        firmware = "";
        board = "";
        serial = "";
        storageFree = -1;

        append("\n=== BETHESDA STORAGE BACKUP START ===");
        append("Read-only watch operations only. ZIP will be created on Android.");
        setStatus("BACKUP / READING DEVICE INFO");

        sendCommand(
                "print(\"VOX_HEAD:\"+JSON.stringify({v:process.version,b:process.env.BOARD,s:process.env.SERIAL,f:require(\"Storage\").getFree()}));\n"
        );
    }

    private void requestBackupList() {
        setStatus("BACKUP / INVENTORY");
        sendCommand(
                "var S=require(\"Storage\");print(\"VOX_LIST:\"+JSON.stringify({n:S.list(undefined,{sf:false}),f:S.list(undefined,{sf:true})}));\n"
        );
    }

    private void parseBackupList(JSONObject list) {
        backupItems.clear();

        JSONArray normal = list.optJSONArray("n");
        if (normal != null) {
            for (int i = 0; i < normal.length(); i++) {
                String name = normal.optString(i, "");
                if (!name.isEmpty()) backupItems.add(new BackupItem(name, false));
            }
        }

        JSONArray sf = list.optJSONArray("f");
        if (sf != null) {
            for (int i = 0; i < sf.length(); i++) {
                String name = sf.optString(i, "");
                if (!name.isEmpty()) backupItems.add(new BackupItem(name, true));
            }
        }

        append("Backup inventory: " + backupItems.size() + " logical files.");
        backupIndex = -1;
        startNextFile();
    }

    private void startNextFile() {
        backupIndex++;
        if (backupIndex >= backupItems.size()) {
            finishBackup();
            return;
        }

        currentItem = backupItems.get(backupIndex);
        currentOffset = 0;
        updateBackupProgress();

        String quoted = JSONObject.quote(currentItem.name);
        if (currentItem.storageFile) {
            sendCommand(
                    "global.__voxBackupRead=require(\"Storage\").open(" + quoted + ",\"r\");print(\"VOX_META:\"+__voxBackupRead.getLength());\n"
            );
        } else {
            sendCommand(
                    "var q=require(\"Storage\").read(" + quoted + ");print(\"VOX_META:\"+(q===undefined?-1:q.length));\n"
            );
        }
    }

    private void requestNextFileChunk() {
        if (currentItem == null) return;

        if (currentItem.storageFile) {
            sendCommand(
                    "var q=__voxBackupRead.read(" + READ_CHUNK + ")||\"\";print(\"VOX_CHUNK:\"+btoa(q));\n"
            );
        } else {
            String quoted = JSONObject.quote(currentItem.name);
            sendCommand(
                    "var q=require(\"Storage\").read(" + quoted + "," + currentOffset + "," + READ_CHUNK + ")||\"\";print(\"VOX_CHUNK:\"+btoa(q));\n"
            );
        }
    }

    private void finishCurrentFile() {
        if (currentItem == null) return;

        int got = currentItem.data.size();
        if (currentItem.expectedLength >= 0 &&
                got != currentItem.expectedLength &&
                currentItem.error.isEmpty()) {
            currentItem.error = "Length mismatch expected=" + currentItem.expectedLength + " got=" + got;
        }

        append("FILE " + (backupIndex + 1) + "/" + backupItems.size() + " " +
                printableName(currentItem.name) +
                " type=" + (currentItem.storageFile ? "StorageFile" : "normal") +
                " bytes=" + got +
                (currentItem.error.isEmpty() ? " OK" : " ERROR " + currentItem.error));

        currentItem = null;
        currentOffset = 0;
        startNextFile();
    }

    private void updateBackupProgress() {
        if (currentItem == null) return;

        int total = Math.max(1, backupItems.size());
        int overall = (int) (((backupIndex + 0.0) / total) * 100.0);
        int filePercent = currentItem.expectedLength > 0
                ? Math.min(100, (currentOffset * 100) / currentItem.expectedLength)
                : 0;

        setStatus("BACKUP " + (backupIndex + 1) + "/" + total +
                " / " + printableName(currentItem.name) +
                " / " + filePercent + "% / TOTAL " + overall + "%");
    }

    private void finishBackup() {
        try {
            if (consoleReady) sendCommand("delete global.__voxBackupRead;print(\"VOX_BACKUP_SESSION_CLEAN\");\n");

            backupZipBytes = createBackupZip();
            backupRunning = false;

            append("=== BACKUP COMPLETE ===");
            append("ZIP bytes on phone: " + backupZipBytes.length);
            append("No persistent watch data was changed by the backup routine.");

            runOnUiThread(() -> {
                saveButton.setEnabled(true);
                setConsoleControls(consoleReady);
                scanButton.setEnabled(true);
                setStatus("BACKUP COMPLETE / SAVE ZIP");
            });
        } catch (Exception e) {
            abortBackup("ZIP creation failed: " + e.getClass().getSimpleName());
        }
    }

    private void abortBackup(String reason) {
        if (!backupRunning) return;
        backupRunning = false;
        append("=== BACKUP ABORTED === " + reason);
        runOnUiThread(() -> {
            setConsoleControls(consoleReady);
            scanButton.setEnabled(true);
            setStatus("BACKUP ABORTED / " + reason);
        });
    }

    private byte[] createBackupZip() throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();

        JSONObject manifest = new JSONObject();
        manifest.put("format", "ChronomarkPlus Bethesda Storage Backup");
        manifest.put("formatVersion", 1);
        manifest.put("createdAtEpochMs", System.currentTimeMillis());
        manifest.put("appVersion", "0.3.0");
        manifest.put("deviceName", connectedName);
        manifest.put("deviceAddress", connectedAddress);
        manifest.put("firmware", firmware);
        manifest.put("board", board);
        manifest.put("serial", serial);
        manifest.put("storageFreeAtStart", storageFree);
        manifest.put("watchWritePolicy", "READ_ONLY_NO_PERSISTENT_WRITES");

        JSONArray files = new JSONArray();

        ZipOutputStream zip = new ZipOutputStream(bytes);
        Set<String> usedPaths = new HashSet<>();

        for (BackupItem item : backupItems) {
            byte[] data = item.data.toByteArray();
            String folder = item.storageFile ? "storagefile/" : "storage/";
            String path = uniqueZipPath(folder + safeZipName(item.name), usedPaths);

            JSONObject f = new JSONObject();
            f.put("name", item.name);
            f.put("storageType", item.storageFile ? "StorageFile" : "normal");
            f.put("expectedLength", item.expectedLength);
            f.put("capturedLength", data.length);
            f.put("sha256", sha256(data));
            f.put("zipPath", path);
            f.put("ok", item.error.isEmpty());
            if (!item.error.isEmpty()) f.put("error", item.error);
            files.put(f);

            if (item.error.isEmpty()) {
                ZipEntry entry = new ZipEntry(path);
                zip.putNextEntry(entry);
                zip.write(data);
                zip.closeEntry();
            }
        }

        manifest.put("files", files);

        ZipEntry manifestEntry = new ZipEntry("manifest.json");
        zip.putNextEntry(manifestEntry);
        zip.write(manifest.toString(2).getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();

        ZipEntry logEntry = new ZipEntry("chronomarkplus-log.txt");
        zip.putNextEntry(logEntry);
        zip.write(report.toString().getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();

        ZipEntry readmeEntry = new ZipEntry("README.txt");
        zip.putNextEntry(readmeEntry);
        zip.write((
                "Chronomark+ v0.3.0 read-only backup.\n" +
                "Files in storage/ came from normal Espruino Storage entries.\n" +
                "Files in storagefile/ came from Espruino StorageFile entries opened with mode 'r'.\n" +
                "manifest.json preserves exact original names, types, lengths and SHA-256 hashes.\n" +
                "This archive is a backup artifact only; v0.3.0 contains no restore/write routine.\n"
        ).getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();

        zip.finish();
        zip.close();
        return bytes.toByteArray();
    }

    private String uniqueZipPath(String desired, Set<String> used) {
        if (used.add(desired)) return desired;

        int dot = desired.lastIndexOf('.');
        String base = dot > desired.lastIndexOf('/') ? desired.substring(0, dot) : desired;
        String ext = dot > desired.lastIndexOf('/') ? desired.substring(dot) : "";

        int i = 2;
        while (true) {
            String candidate = base + "_" + i + ext;
            if (used.add(candidate)) return candidate;
            i++;
        }
    }

    private String safeZipName(String name) {
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < name.length(); i++) {
            char c = name.charAt(i);
            if (c < 32 || c == 127 || c == '/' || c == '\\' || c == ':') {
                out.append(String.format(Locale.ROOT, "%%%02X", (int) c));
            } else {
                out.append(c);
            }
        }
        return out.length() == 0 ? "_unnamed" : out.toString();
    }

    private String printableName(String name) {
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < name.length(); i++) {
            char c = name.charAt(i);
            if (c < 32 || c == 127) {
                out.append(String.format(Locale.ROOT, "\\x%02X", (int) c));
            } else {
                out.append(c);
            }
        }
        return out.toString();
    }

    private String sha256(byte[] data) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(data);
        StringBuilder out = new StringBuilder();
        for (byte b : hash) out.append(String.format(Locale.ROOT, "%02x", b & 0xff));
        return out.toString();
    }

    private void saveBackup() {
        if (backupZipBytes == null || backupZipBytes.length == 0) {
            Toast.makeText(this, "Aucun backup termine.", Toast.LENGTH_SHORT).show();
            return;
        }

        String safeDevice = connectedName.replaceAll("[^A-Za-z0-9._-]+", "_");
        String stamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.ROOT).format(new Date());
        String filename = "Chronomark_" + safeDevice + "_Bethesda_Backup_" + stamp + ".zip";

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/zip");
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(intent, REQ_SAVE_ZIP);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_SAVE_ZIP || resultCode != RESULT_OK || data == null) return;

        Uri uri = data.getData();
        if (uri == null || backupZipBytes == null) return;

        try (OutputStream out = getContentResolver().openOutputStream(uri, "w")) {
            if (out == null) throw new IllegalStateException("No output stream");
            out.write(backupZipBytes);
            out.flush();
            append("Backup ZIP saved through Android document picker.");
            setStatus("BACKUP SAVED");
            Toast.makeText(this, "Backup Chronomark enregistre.", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            append("Backup save error: " + e);
            setStatus("SAVE ERROR");
            Toast.makeText(this, "Erreur pendant l'enregistrement du ZIP.", Toast.LENGTH_LONG).show();
        }
    }

    private void exportReport() {
        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_SUBJECT, "Chronomark+ v0.3.0 diagnostic");
        intent.putExtra(Intent.EXTRA_TEXT, report.toString());
        startActivity(Intent.createChooser(intent, "Exporter le diagnostic Chronomark+"));
    }

    private synchronized void append(String text) {
        report.append(text).append('\n');
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

    private void setStatus(String text) {
        runOnUiThread(() -> status.setText("STATUS / " + text));
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
