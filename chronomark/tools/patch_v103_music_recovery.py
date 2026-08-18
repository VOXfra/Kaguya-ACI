from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SVC = ROOT / "app/src/main/java/fr/vox/chronomarkplus/ChronomarkNativeService.java"


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"v1.0.3 music recovery: missing {label}")
    return text.replace(old, new, 1)

s = SVC.read_text(encoding="utf-8")

# Never let Weather compete with an open native app. Music artwork / commands
# and Phone Status have priority over background Weather maintenance.
s = replace_once(
    s,
    '    private void flushWeather() {\n        if(!ready||weatherSending||weatherLatest==null)return;\n',
    '    private void flushWeather() {\n        if(!ready||weatherSending||weatherLatest==null||nativeMusicOpen||nativePhoneOpen)return;\n',
    "Weather priority gate",
)

# A successfully ACKed payload is consumed. The v1.0.1 implementation kept it
# in weatherLatest, so poll() resent and rewrote the exact same weather.json
# every 1.5 seconds forever, saturating UART and starving Music Control+.
s = replace_once(
    s,
'''        else if(line.contains("VOX_V08:WEATHER_SYNC_OK")){\n            WeatherSyncEngine.Payload p=weatherInFlight;\n            weatherSending=false;weatherInFlight=null;\n            if(p!=null&&weatherSync!=null){weatherSync.markDelivered(p);updateNotification("Companion actif / Meteo "+p.locality);}\n            if(weatherLatest!=p)flushWeather();\n        }\n''',
'''        else if(line.contains("VOX_V08:WEATHER_SYNC_OK")){\n            WeatherSyncEngine.Payload p=weatherInFlight;\n            weatherSending=false;weatherInFlight=null;\n            if(weatherLatest==p)weatherLatest=null;\n            if(p!=null&&weatherSync!=null){weatherSync.markDelivered(p);updateNotification("Companion actif / Meteo "+p.locality);}\n            if(weatherLatest!=null)flushWeather();\n        }\n''',
    "Weather ACK consume",
)

# Do not hammer a failing watch write every 1.5 seconds either. Retry once a
# minute, and still respect the native-app priority gate.
s = replace_once(
    s,
    '        else if(line.contains("VOX_V08:WEATHER_SYNC_ERR")){weatherSending=false;weatherInFlight=null;updateNotification("Companion actif / erreur synchro meteo");}\n',
'''        else if(line.contains("VOX_V08:WEATHER_SYNC_ERR")){\n            WeatherSyncEngine.Payload failed=weatherInFlight;\n            weatherSending=false;weatherInFlight=null;weatherLatest=null;\n            updateNotification("Companion actif / erreur synchro meteo");\n            if(failed!=null)h.postDelayed(()->{if(!stopping){weatherLatest=failed;flushWeather();}},60000L);\n        }\n''',
    "Weather error throttle",
)

# Once the user leaves a native screen, a pending Weather payload may proceed.
s = replace_once(
    s,
    '        else if(line.contains("VOX_V08:NATIVE_MUSIC_CLOSE")){nativeMusicOpen=false;lastTrackKey="";}\n',
    '        else if(line.contains("VOX_V08:NATIVE_MUSIC_CLOSE")){nativeMusicOpen=false;lastTrackKey="";flushWeather();}\n',
    "Music close Weather resume",
)
s = replace_once(
    s,
    '        else if(line.contains("VOX_V08:NATIVE_PHONE_CLOSE")){nativePhoneOpen=false;}\n',
    '        else if(line.contains("VOX_V08:NATIVE_PHONE_CLOSE")){nativePhoneOpen=false;flushWeather();}\n',
    "Phone close Weather resume",
)

SVC.write_text(s, encoding="utf-8")
print("v1.0.3 Music recovery applied: Weather ACK consumption + native-app priority")
