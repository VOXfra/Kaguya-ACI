from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SVC = ROOT / "app/src/main/java/fr/vox/chronomarkplus/ChronomarkNativeService.java"


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"v1.0.3 patch: missing {label}")
    return text.replace(old, new, 1)

s = SVC.read_text(encoding="utf-8")

s = replace_once(
    s,
    '    static final String KEY_SERVICE_LAST_MS = "service_last_ms";\n',
    '    static final String KEY_SERVICE_LAST_MS = "service_last_ms";\n'
    '    static final String KEY_PASSIVE_MODE = "passive_mode";\n'
    '    static final String EXTRA_BACKGROUND_RESTART = "background_restart";\n',
    "passive constants",
)

s = replace_once(
    s,
    '''        android.content.SharedPreferences p=getSharedPreferences(PREFS,MODE_PRIVATE);\n        p.edit().putBoolean(KEY_NATIVE_ENABLED,true).apply();\n        boolean forceWeather = intent != null && ACTION_WEATHER_NOW.equals(intent.getAction());\n        boolean requestedWeather = forceWeather || (intent != null && intent.getBooleanExtra(EXTRA_ENABLE_WEATHER, false));\n        if(requestedWeather)p.edit().putBoolean(KEY_WEATHER_ENABLED,true).apply();\n        boolean enableWeather = requestedWeather || p.getBoolean(KEY_WEATHER_ENABLED,false);\n        if (enableWeather) enableWeatherSync(forceWeather);\n        connectSavedWatch();\n        return START_STICKY;\n''',
    '''        android.content.SharedPreferences p=getSharedPreferences(PREFS,MODE_PRIVATE);\n        p.edit().putBoolean(KEY_NATIVE_ENABLED,true).apply();\n        boolean forceWeather = intent != null && ACTION_WEATHER_NOW.equals(intent.getAction());\n        boolean requestedWeather = forceWeather || (intent != null && intent.getBooleanExtra(EXTRA_ENABLE_WEATHER, false));\n        boolean backgroundRestart = intent == null || (intent != null && intent.getBooleanExtra(EXTRA_BACKGROUND_RESTART, false));\n        if(requestedWeather)p.edit().putBoolean(KEY_WEATHER_ENABLED,true).apply();\n        boolean enableWeather = requestedWeather || p.getBoolean(KEY_WEATHER_ENABLED,false);\n        if (enableWeather && (!backgroundRestart || backgroundLocationOk())) enableWeatherSync(forceWeather);\n        else if (enableWeather && backgroundRestart) updateNotification("Companion passif actif / Weather attend localisation Toujours autoriser");\n        connectSavedWatch();\n        return START_STICKY;\n''',
    "background restart weather gate",
)

s = replace_once(
    s,
    '''    private boolean locationOk() {\n        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED ||\n                checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;\n    }\n''',
    '''    private boolean locationOk() {\n        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED ||\n                checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;\n    }\n\n    private boolean backgroundLocationOk() {\n        if (Build.VERSION.SDK_INT < 29) return locationOk();\n        return checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)==PackageManager.PERMISSION_GRANTED;\n    }\n''',
    "background location helper",
)

s = replace_once(
    s,
    '            gatt=d.connectGatt(this,false,cb,BluetoothDevice.TRANSPORT_LE);\n',
    '            gatt=d.connectGatt(this,true,cb,BluetoothDevice.TRANSPORT_LE);\n',
    "BLE autoConnect",
)

old_disconnect = '''            else if(state==BluetoothProfile.STATE_DISCONNECTED){ready=false;setServiceState("disconnected");uartRx=null;uartTx=null;writeBusy=false;writes.clear();nativeMusicOpen=false;nativePhoneOpen=false;weatherSending=false;weatherInFlight=null;try{bg.close();}catch(Exception ignored){}if(gatt==bg)gatt=null;updateNotification("Chronomark deconnectee - reconnexion...");scheduleReconnect();}\n'''
new_disconnect = '''            else if(state==BluetoothProfile.STATE_DISCONNECTED){ready=false;setServiceState("disconnected");uartRx=null;uartTx=null;writeBusy=false;writes.clear();nativeMusicOpen=false;nativePhoneOpen=false;weatherSending=false;weatherInFlight=null;if(gatt==null)gatt=bg;updateNotification("Chronomark hors portee - reconnexion automatique...");h.postDelayed(()->{if(stopping||ready||gatt!=bg)return;try{bg.close();}catch(Exception ignored){}if(gatt==bg)gatt=null;connectSavedWatch();},30000L);}\n'''
s = replace_once(s, old_disconnect, new_disconnect, "BLE disconnect auto reconnect")

s = replace_once(
    s,
    '''    @Override public void onTaskRemoved(Intent rootIntent) {\n        if(!stopping){setServiceState(ready?"ready":"background");scheduleReconnect();}\n        super.onTaskRemoved(rootIntent);\n    }\n''',
    '''    @Override public void onTaskRemoved(Intent rootIntent) {\n        if(!stopping){\n            setServiceState(ready?"ready":"background");\n            getSharedPreferences(PREFS,MODE_PRIVATE).edit().putBoolean(KEY_NATIVE_ENABLED,true).apply();\n            if(gatt==null)connectSavedWatch();\n        }\n        super.onTaskRemoved(rootIntent);\n    }\n''',
    "task removal persistence",
)

s = replace_once(
    s,
    '    private void stopNative(){stopping=true;getSharedPreferences(PREFS,MODE_PRIVATE).edit().putBoolean(KEY_NATIVE_ENABLED,false).apply();setServiceState("stopped");if(weatherSync!=null)weatherSync.stop();stopFindPhone();closeGatt();stopForeground(true);stopSelf();}\n',
    '    private void stopNative(){stopping=true;getSharedPreferences(PREFS,MODE_PRIVATE).edit().putBoolean(KEY_NATIVE_ENABLED,false).putBoolean(KEY_PASSIVE_MODE,false).apply();setServiceState("stopped");if(weatherSync!=null)weatherSync.stop();stopFindPhone();closeGatt();stopForeground(true);stopSelf();}\n',
    "explicit passive stop",
)

SVC.write_text(s, encoding="utf-8")
print("v1.0.3 passive reliability patch applied")
