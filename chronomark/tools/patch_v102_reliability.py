from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WX = ROOT / "app/src/main/java/fr/vox/chronomarkplus/WeatherSyncEngine.java"
SVC = ROOT / "app/src/main/java/fr/vox/chronomarkplus/ChronomarkNativeService.java"
ACT = ROOT / "app/src/main/java/fr/vox/chronomarkplus/MainActivityV101.java"


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"v1.0.2 patch: missing {label}")
    return text.replace(old, new, 1)

# -----------------------------------------------------------------------------
# WeatherSyncEngine: use the compact forecast format already supported natively
# by Dickens.loadWeather(), persist the last ACKed payload for self-repair, and
# align the 168-hour block with the current hour rather than midnight.
# -----------------------------------------------------------------------------
w = WX.read_text(encoding="utf-8")
w = replace_once(w,
    "import android.os.Looper;\n",
    "import android.os.Looper;\nimport android.util.Base64;\n",
    "WeatherSyncEngine Base64 import")
w = replace_once(w,
    "import java.net.URL;\nimport java.nio.charset.StandardCharsets;\n",
    "import java.net.URL;\nimport java.nio.ByteBuffer;\nimport java.nio.ByteOrder;\nimport java.nio.charset.StandardCharsets;\n",
    "WeatherSyncEngine ByteBuffer imports")
w = replace_once(w,
    '    static final String KEY_WEATHER_SYNC_TIME = "weather_sync_time";\n',
    '    static final String KEY_WEATHER_SYNC_TIME = "weather_sync_time";\n    static final String KEY_WEATHER_JSON = "weather_json_last_good";\n',
    "Weather cached key")
w = replace_once(w,
    "                .putFloat(KEY_WEATHER_ACCURACY, payload.accuracy)\n                .apply();\n    }\n",
    "                .putFloat(KEY_WEATHER_ACCURACY, payload.accuracy)\n                .putString(KEY_WEATHER_JSON, payload.json)\n                .apply();\n    }\n\n    Payload cachedPayload() {\n        String json = prefs.getString(KEY_WEATHER_JSON, \"\");\n        String place = prefs.getString(KEY_WEATHER_PLACE, \"\");\n        if (json.isEmpty() || place.isEmpty() || !prefs.contains(KEY_WEATHER_LAT) || !prefs.contains(KEY_WEATHER_LON)) return null;\n        double lat = Double.longBitsToDouble(prefs.getLong(KEY_WEATHER_LAT, 0L));\n        double lon = Double.longBitsToDouble(prefs.getLong(KEY_WEATHER_LON, 0L));\n        float acc = prefs.getFloat(KEY_WEATHER_ACCURACY, -1f);\n        return new Payload(json, place, lat, lon, acc);\n    }\n",
    "Weather cached payload")
w = replace_once(w,
    '                "&longitude=" + String.format(Locale.ROOT, "%.5f", lon) +\n                "&hourly=temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_gusts_10m,precipitation_probability,cloud_cover" +\n',
    '                "&longitude=" + String.format(Locale.ROOT, "%.5f", lon) +\n                "&current=temperature_2m" +\n                "&hourly=temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_gusts_10m,precipitation_probability,cloud_cover" +\n',
    "Weather current hour request")
w = replace_once(w,
    '        JSONArray temps = hourly.getJSONArray("temperature_2m");\n        JSONArray hum = hourly.getJSONArray("relative_humidity_2m");\n',
    '        JSONArray times = hourly.getJSONArray("time");\n        JSONArray temps = hourly.getJSONArray("temperature_2m");\n        JSONArray hum = hourly.getJSONArray("relative_humidity_2m");\n',
    "Weather hourly times")
w = replace_once(w,
    '        int hourlyCount = Math.min(168, minLength(temps, hum, press, wind, gust, pop, cloud));\n        if (hourlyCount < 48) throw new Exception("forecast horaire incomplet");\n',
    '        int totalHourly = minLength(times, temps, hum, press, wind, gust, pop, cloud);\n        int startHour = 0;\n        JSONObject current = source.optJSONObject("current");\n        String currentTime = current == null ? "" : current.optString("time", "");\n        String hourKey = currentTime.length() >= 13 ? currentTime.substring(0, 13) : currentTime;\n        if (!hourKey.isEmpty()) {\n            for (int i = 0; i < times.length(); i++) {\n                if (times.optString(i, "").startsWith(hourKey)) { startHour = i; break; }\n            }\n        }\n        int hourlyCount = Math.min(168, Math.max(0, totalHourly - startHour));\n        if (hourlyCount < 168) throw new Exception("forecast horaire incomplet");\n',
    "Weather 168h aligned slice")
w = replace_once(w,
    '        out.put("temperature", numericSlice(temps, hourlyCount, 1));\n        out.put("humidity", numericSlice(hum, hourlyCount, 1));\n        out.put("pressure", numericSlice(press, hourlyCount, 1));\n        out.put("windSpeed", numericSlice(wind, hourlyCount, 1));\n        out.put("windGust", numericSlice(gust, hourlyCount, 1));\n        out.put("precipProb", numericSlice(pop, hourlyCount, 1));\n        out.put("cloudCover", numericSlice(cloud, hourlyCount, 1));\n        return out;\n',
    '        out.put("forecast", packForecast(temps, press, hum, pop, cloud, wind, gust, startHour, hourlyCount));\n        return out;\n',
    "Weather compact forecast")
marker = '''    private int minLength(JSONArray... arrays) {\n'''
insert = '''    private String packForecast(JSONArray temps, JSONArray press, JSONArray hum, JSONArray pop, JSONArray cloud,\n                                JSONArray wind, JSONArray gust, int start, int count) {\n        ByteBuffer b = ByteBuffer.allocate(count * 9).order(ByteOrder.LITTLE_ENDIAN);\n        for (int i = 0; i < count; i++) b.putShort((short) clampSigned16(Math.round((float) temps.optDouble(start + i, 0d) * 10f)));\n        for (int i = 0; i < count; i++) b.putShort((short) (clampUnsigned16((int) Math.round(press.optDouble(start + i, 0d))) & 0xFFFF));\n        for (int i = 0; i < count; i++) b.put((byte) clampByte((int) Math.round(hum.optDouble(start + i, 0d))));\n        for (int i = 0; i < count; i++) b.put((byte) clampByte((int) Math.round(pop.optDouble(start + i, 0d))));\n        for (int i = 0; i < count; i++) b.put((byte) clampByte((int) Math.round(cloud.optDouble(start + i, 0d))));\n        for (int i = 0; i < count; i++) b.put((byte) clampByte((int) Math.round(wind.optDouble(start + i, 0d))));\n        for (int i = 0; i < count; i++) b.put((byte) clampByte((int) Math.round(gust.optDouble(start + i, 0d))));\n        return Base64.encodeToString(b.array(), Base64.NO_WRAP);\n    }\n\n    private int clampByte(int v) { return Math.max(0, Math.min(255, v)); }\n    private int clampUnsigned16(int v) { return Math.max(0, Math.min(65535, v)); }\n    private int clampSigned16(int v) { return Math.max(-32768, Math.min(32767, v)); }\n\n'''
w = replace_once(w, marker, insert + marker, "Weather forecast packer")
WX.write_text(w, encoding="utf-8")

# -----------------------------------------------------------------------------
# Native service: persist ownership/state, resume Weather after START_STICKY,
# self-repair an invalid weather.json from the last ACKed payload, and validate
# a new file on-watch before reporting success.
# -----------------------------------------------------------------------------
s = SVC.read_text(encoding="utf-8")
s = replace_once(s,
    '    static final String EXTRA_ENABLE_WEATHER = "enable_weather_gps";\n',
    '    static final String EXTRA_ENABLE_WEATHER = "enable_weather_gps";\n    static final String KEY_NATIVE_ENABLED = "native_enabled";\n    static final String KEY_WEATHER_ENABLED = "weather_enabled";\n    static final String KEY_SERVICE_STATE = "service_state";\n    static final String KEY_SERVICE_LAST_MS = "service_last_ms";\n',
    "Service persistent keys")
s = replace_once(s,
    '        mediaSessions = (MediaSessionManager)getSystemService(MEDIA_SESSION_SERVICE);\n',
    '        setServiceState("starting");\n        mediaSessions = (MediaSessionManager)getSystemService(MEDIA_SESSION_SERVICE);\n',
    "Service onCreate state")
s = replace_once(s,
'''        boolean forceWeather = intent != null && ACTION_WEATHER_NOW.equals(intent.getAction());\n        boolean enableWeather = forceWeather || (intent != null && intent.getBooleanExtra(EXTRA_ENABLE_WEATHER, false));\n        if (enableWeather) enableWeatherSync(forceWeather);\n        connectSavedWatch();\n        return START_STICKY;\n''',
'''        android.content.SharedPreferences p=getSharedPreferences(PREFS,MODE_PRIVATE);\n        p.edit().putBoolean(KEY_NATIVE_ENABLED,true).apply();\n        boolean forceWeather = intent != null && ACTION_WEATHER_NOW.equals(intent.getAction());\n        boolean requestedWeather = forceWeather || (intent != null && intent.getBooleanExtra(EXTRA_ENABLE_WEATHER, false));\n        if(requestedWeather)p.edit().putBoolean(KEY_WEATHER_ENABLED,true).apply();\n        boolean enableWeather = requestedWeather || p.getBoolean(KEY_WEATHER_ENABLED,false);\n        if (enableWeather) enableWeatherSync(forceWeather);\n        connectSavedWatch();\n        return START_STICKY;\n''',
    "Service sticky Weather resume")
s = replace_once(s,
    '        closeGatt();\n        super.onDestroy();\n',
    '        closeGatt();\n        setServiceState(stopping ? "stopped" : "destroyed");\n        super.onDestroy();\n',
    "Service destroy state")
s = replace_once(s,
    '    private void updateNotification(String text) {\n',
'''    private void setServiceState(String state) {\n        getSharedPreferences(PREFS,MODE_PRIVATE).edit()\n                .putString(KEY_SERVICE_STATE,state)\n                .putLong(KEY_SERVICE_LAST_MS,System.currentTimeMillis())\n                .apply();\n    }\n\n    @Override public void onTaskRemoved(Intent rootIntent) {\n        if(!stopping){setServiceState(ready?"ready":"background");scheduleReconnect();}\n        super.onTaskRemoved(rootIntent);\n    }\n\n    private void updateNotification(String text) {\n''',
    "Service state helper")
s = replace_once(s,
    '        if (stopping || !btOk() || gatt != null) return;\n',
    '        if (stopping || !btOk() || gatt != null) return;\n        setServiceState("connecting");\n',
    "Service connecting state")
s = replace_once(s,
    '            if(state==BluetoothProfile.STATE_CONNECTED){gatt=bg;try{bg.requestMtu(185);}catch(Exception ignored){}try{bg.discoverServices();}catch(Exception ignored){}updateNotification("Chronomark connectee");}\n            else if(state==BluetoothProfile.STATE_DISCONNECTED){ready=false;uartRx=null;uartTx=null;writeBusy=false;writes.clear();nativeMusicOpen=false;nativePhoneOpen=false;weatherSending=false;weatherInFlight=null;try{bg.close();}catch(Exception ignored){}if(gatt==bg)gatt=null;updateNotification("Chronomark deconnectee - reconnexion...");scheduleReconnect();}\n',
    '            if(state==BluetoothProfile.STATE_CONNECTED){gatt=bg;setServiceState("connected");try{bg.requestMtu(185);}catch(Exception ignored){}try{bg.discoverServices();}catch(Exception ignored){}updateNotification("Chronomark connectee");}\n            else if(state==BluetoothProfile.STATE_DISCONNECTED){ready=false;setServiceState("disconnected");uartRx=null;uartTx=null;writeBusy=false;writes.clear();nativeMusicOpen=false;nativePhoneOpen=false;weatherSending=false;weatherInFlight=null;try{bg.close();}catch(Exception ignored){}if(gatt==bg)gatt=null;updateNotification("Chronomark deconnectee - reconnexion...");scheduleReconnect();}\n',
    "Service BLE state")
s = replace_once(s,
'''                ready=true;\n                updateNotification("Companion natif actif");\n                sendConsole("print('VOX_V08:ACTIVE:'+(global.__voxActiveApp||''));\\n");\n                flushWeather();\n''',
'''                ready=true;\n                setServiceState("ready");\n                updateNotification("Companion natif actif");\n                sendConsole("print('VOX_V08:ACTIVE:'+(global.__voxActiveApp||''));\\n");\n                sendConsole("(function(){var S=require('Storage'),w=S.readJSON('weather.json',1);print('VOX_V08:WEATHER_STATE:'+((w&&w.icon&&w.icon.length&&(w.forecast||(w.temperature&&w.temperature.length)))?'OK':'BAD'));})();\\n");\n                flushWeather();\n''',
    "Service ready Weather validation")
s = replace_once(s,
    '    private void stopNative(){stopping=true;if(weatherSync!=null)weatherSync.stop();stopFindPhone();closeGatt();stopForeground(true);stopSelf();}\n',
    '    private void stopNative(){stopping=true;getSharedPreferences(PREFS,MODE_PRIVATE).edit().putBoolean(KEY_NATIVE_ENABLED,false).apply();setServiceState("stopped");if(weatherSync!=null)weatherSync.stop();stopFindPhone();closeGatt();stopForeground(true);stopSelf();}\n',
    "Service explicit stop")
s = replace_once(s,
'''        else if(line.contains("VOX_V08:WEATHER_SYNC_ERR")){weatherSending=false;weatherInFlight=null;updateNotification("Companion actif / erreur synchro meteo");}\n''',
'''        else if(line.contains("VOX_V08:WEATHER_SYNC_ERR")){weatherSending=false;weatherInFlight=null;updateNotification("Companion actif / erreur synchro meteo");}\n        else if(line.contains("VOX_V08:WEATHER_STATE:BAD")){\n            if(weatherLatest==null&&weatherSync!=null)weatherLatest=weatherSync.cachedPayload();\n            if(weatherLatest!=null){updateNotification("Companion actif / reparation Weather...");flushWeather();}\n        }\n''',
    "Service Weather self repair")
s = replace_once(s,
'''        sendConsole("(function(){try{var S=require('Storage');S.write('weather.json',atob(global.__voxWeatherB64));global.__voxWeatherB64='';print('VOX_V08:WEATHER_SYNC_OK');}catch(e){global.__voxWeatherB64='';print('VOX_V08:WEATHER_SYNC_ERR:'+e);}})();\\n");\n''',
'''        sendConsole("(function(){try{var S=require('Storage'),n=atob(global.__voxWeatherB64);global.__voxWeatherB64='';var ok=S.write('weather.json',n),v=S.readJSON('weather.json',1);if(ok&&v&&v.icon&&v.icon.length&&(v.forecast||(v.temperature&&v.temperature.length)))print('VOX_V08:WEATHER_SYNC_OK');else{var b=S.read('weather.vox.bak');if(b)S.write('weather.json',b);print('VOX_V08:WEATHER_SYNC_ERR:validation');}}catch(e){global.__voxWeatherB64='';print('VOX_V08:WEATHER_SYNC_ERR:'+e);}})();\\n");\n''',
    "Service Weather validated write")
SVC.write_text(s, encoding="utf-8")

# -----------------------------------------------------------------------------
# Activity: the base v0.7 UI only knows its own GATT connection. When the native
# service owns the watch, show that state instead of the misleading NOT CONNECTED.
# -----------------------------------------------------------------------------
a = ACT.read_text(encoding="utf-8")
a = replace_once(a,
    '        refreshWeatherGpsStatus();\n    }\n\n    private void patchV101Ui() {\n',
    '        refreshWeatherGpsStatus();\n        refreshNativeConnectionStatus();\n    }\n\n    private void patchV101Ui() {\n',
    "Activity resume native state")
a = replace_once(a,
    '        if (version != null) version.setText("MUSIC CONTROL+ / PHONE STATUS / v1.0.1 NATIVE");\n',
    '        if (version != null) version.setText("MUSIC CONTROL+ / PHONE STATUS / v1.0.2 NATIVE");\n',
    "Activity version")
a = replace_once(a,
    '        refreshWeatherGpsStatus();\n    }\n\n    private void startCompanionWithGps() {\n',
    '        refreshWeatherGpsStatus();\n        refreshNativeConnectionStatus();\n    }\n\n    private void startCompanionWithGps() {\n',
    "Activity initial native state")
marker = '''    private void refreshWeatherGpsStatus() {\n'''
method = '''    private void refreshNativeConnectionStatus() {\n        SharedPreferences p = getSharedPreferences(ChronomarkNativeService.PREFS, MODE_PRIVATE);\n        String state = p.getString(ChronomarkNativeService.KEY_SERVICE_STATE, "");\n        long age = Math.max(0, System.currentTimeMillis() - p.getLong(ChronomarkNativeService.KEY_SERVICE_LAST_MS, 0L));\n        if (state.isEmpty() || age > 120_000L) return;\n        TextView ws = findWatchStatus(getWindow().getDecorView());\n        if (ws == null) return;\n        if ("ready".equals(state)) ws.setText("WATCH / CONNECTED VIA NATIVE COMPANION");\n        else if ("connected".equals(state)) ws.setText("WATCH / NATIVE CONNECTED / UART SETUP");\n        else if ("connecting".equals(state) || "background".equals(state)) ws.setText("WATCH / NATIVE COMPANION / RECONNECTING");\n        else if ("disconnected".equals(state)) ws.setText("WATCH / NATIVE DISCONNECTED / AUTO RECONNECT");\n    }\n\n    private TextView findWatchStatus(View root) {\n        if (root instanceof TextView) {\n            CharSequence s = ((TextView) root).getText();\n            if (s != null && s.toString().startsWith("WATCH /")) return (TextView) root;\n        }\n        if (root instanceof ViewGroup) {\n            ViewGroup g = (ViewGroup) root;\n            for (int i = 0; i < g.getChildCount(); i++) {\n                TextView t = findWatchStatus(g.getChildAt(i));\n                if (t != null) return t;\n            }\n        }\n        return null;\n    }\n\n'''
a = replace_once(a, marker, method + marker, "Activity native connection method")
ACT.write_text(a, encoding="utf-8")

print("Chronomark+ v1.0.2 reliability patch applied")
