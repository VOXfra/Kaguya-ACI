package fr.vox.chronomarkplus;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.text.TextUtils;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.List;
import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ChronomarkNativeService extends Service {
    static final String PREFS = "chronomark_native";
    static final String KEY_MAC = "watch_mac";
    static final String ACTION_STOP = "fr.vox.chronomarkplus.STOP_NATIVE";
    static final String ACTION_WEATHER_NOW = "fr.vox.chronomarkplus.WEATHER_NOW";
    static final String EXTRA_ENABLE_WEATHER = "enable_weather_gps";

    private static final String CHANNEL = "chronomark_native";
    private static final int NOTIF_ID = 2188;
    private static final int UART_CHUNK = 96;
    private static final int ART_CHUNK = 420;
    private static final int WEATHER_CHUNK = 420;
    private static final UUID NUS_SERVICE = UUID.fromString("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID NUS_RX = UUID.fromString("6e400002-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID NUS_TX = UUID.fromString("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
    private static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private final Handler h = new Handler(Looper.getMainLooper());
    private final Queue<byte[]> writes = new ArrayDeque<>();
    private final StringBuilder rx = new StringBuilder();
    private final ExecutorService artExecutor = Executors.newSingleThreadExecutor();

    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic uartRx, uartTx;
    private boolean ready, writeBusy, stopping;
    private boolean nativeMusicOpen, nativePhoneOpen;
    private String lastTrackKey = "";
    private int artGeneration;
    private boolean findPlaying;
    private Ringtone findRingtone;
    private Vibrator vibrator;
    private MediaSessionManager mediaSessions;
    private ComponentName listenerComponent;

    private WeatherSyncEngine weatherSync;
    private WeatherSyncEngine.Payload weatherLatest;
    private WeatherSyncEngine.Payload weatherInFlight;
    private boolean weatherSending;
    private boolean weatherLocationForeground;

    private final Runnable poll = new Runnable() {
        @Override public void run() {
            if (stopping) return;
            if (ready) {
                if (nativeMusicOpen) syncArtwork(false);
                if (nativePhoneOpen) pushPhoneStatus();
                flushWeather();
            }
            h.postDelayed(this, 1500L);
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        mediaSessions = (MediaSessionManager)getSystemService(MEDIA_SESSION_SERVICE);
        listenerComponent = new ComponentName(this, MediaProbeNotificationListener.class);
        createChannel();
        startForegroundConnected("Demarrage du companion natif...");
        weatherSync = new WeatherSyncEngine(this, getSharedPreferences(PREFS, MODE_PRIVATE), new WeatherSyncEngine.Callback() {
            @Override public void onWeatherPayload(WeatherSyncEngine.Payload payload) {
                h.post(() -> {
                    weatherLatest = payload;
                    flushWeather();
                });
            }
            @Override public void onWeatherStatus(String status) {
                h.post(() -> updateNotification("Companion natif / " + status));
            }
        });
        h.post(poll);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopNative();
            return START_NOT_STICKY;
        }
        boolean forceWeather = intent != null && ACTION_WEATHER_NOW.equals(intent.getAction());
        boolean enableWeather = forceWeather || (intent != null && intent.getBooleanExtra(EXTRA_ENABLE_WEATHER, false));
        if (enableWeather) enableWeatherSync(forceWeather);
        connectSavedWatch();
        return START_STICKY;
    }

    @Override public void onDestroy() {
        stopping = true;
        h.removeCallbacksAndMessages(null);
        artExecutor.shutdownNow();
        if (weatherSync != null) weatherSync.stop();
        stopFindPhone();
        closeGatt();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel c = new NotificationChannel(CHANNEL,"Chronomark+ companion",NotificationManager.IMPORTANCE_LOW);
            c.setDescription("Connexion native Music Control+ / Phone Status / Weather GPS");
            NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
            if(nm!=null)nm.createNotificationChannel(c);
        }
    }

    private Notification notification(String text) {
        Notification.Builder b = Build.VERSION.SDK_INT>=26 ? new Notification.Builder(this,CHANNEL) : new Notification.Builder(this);
        return b.setContentTitle("Chronomark+").setContentText(text).setSmallIcon(android.R.drawable.stat_sys_data_bluetooth).setOngoing(true).build();
    }

    private void startForegroundConnected(String text) {
        Notification n = notification(text);
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
        } else {
            startForeground(NOTIF_ID, n);
        }
    }

    private boolean locationOk() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED ||
                checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;
    }

    private void enableWeatherSync(boolean force) {
        if (!locationOk()) {
            updateNotification("Companion actif / GPS non autorise");
            return;
        }
        if (!weatherLocationForeground && Build.VERSION.SDK_INT >= 29) {
            try {
                startForeground(NOTIF_ID, notification("Companion natif / GPS Weather actif"),
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE | ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
                weatherLocationForeground = true;
            } catch (Exception e) {
                updateNotification("Companion actif / GPS indisponible");
                return;
            }
        } else if (Build.VERSION.SDK_INT < 29) {
            weatherLocationForeground = true;
        }
        if (weatherSync != null) {
            weatherSync.start();
            if (force) weatherSync.forceRefresh();
        }
    }

    private void updateNotification(String text) {
        NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        if(nm!=null)nm.notify(NOTIF_ID,notification(text));
    }

    private boolean btOk() {
        return Build.VERSION.SDK_INT < 31 || checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED;
    }

    private void connectSavedWatch() {
        if (stopping || !btOk() || gatt != null) return;
        String mac=getSharedPreferences(PREFS,MODE_PRIVATE).getString(KEY_MAC,"");
        if(mac.isEmpty()){updateNotification("Aucune Chronomark enregistree");return;}
        try {
            BluetoothManager bm=(BluetoothManager)getSystemService(BLUETOOTH_SERVICE);
            BluetoothAdapter a=bm==null?null:bm.getAdapter();
            BluetoothDevice d=a==null?null:a.getRemoteDevice(mac);
            if(d==null){updateNotification("Chronomark introuvable");return;}
            updateNotification("Connexion a la Chronomark...");
            gatt=d.connectGatt(this,false,cb,BluetoothDevice.TRANSPORT_LE);
        } catch(Exception e) { gatt=null; updateNotification("Connexion impossible"); scheduleReconnect(); }
    }

    private final BluetoothGattCallback cb = new BluetoothGattCallback() {
        @Override public void onConnectionStateChange(BluetoothGatt bg,int status,int state) {
            if(state==BluetoothProfile.STATE_CONNECTED){gatt=bg;try{bg.requestMtu(185);}catch(Exception ignored){}try{bg.discoverServices();}catch(Exception ignored){}updateNotification("Chronomark connectee");}
            else if(state==BluetoothProfile.STATE_DISCONNECTED){ready=false;uartRx=null;uartTx=null;writeBusy=false;writes.clear();nativeMusicOpen=false;nativePhoneOpen=false;weatherSending=false;weatherInFlight=null;try{bg.close();}catch(Exception ignored){}if(gatt==bg)gatt=null;updateNotification("Chronomark deconnectee - reconnexion...");scheduleReconnect();}
        }
        @Override public void onServicesDiscovered(BluetoothGatt bg,int status) {
            BluetoothGattService s=bg.getService(NUS_SERVICE);if(s==null)return;uartRx=s.getCharacteristic(NUS_RX);uartTx=s.getCharacteristic(NUS_TX);if(uartRx==null||uartTx==null)return;
            try{bg.setCharacteristicNotification(uartTx,true);BluetoothGattDescriptor d=uartTx.getDescriptor(CCCD);if(d==null)return;if(Build.VERSION.SDK_INT>=33)bg.writeDescriptor(d,BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);else{d.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);bg.writeDescriptor(d);}}catch(Exception ignored){}
        }
        @Override public void onDescriptorWrite(BluetoothGatt bg,BluetoothGattDescriptor d,int status) {
            if(CCCD.equals(d.getUuid())&&status==BluetoothGatt.GATT_SUCCESS){
                ready=true;
                updateNotification("Companion natif actif");
                sendConsole("print('VOX_V08:ACTIVE:'+(global.__voxActiveApp||''));\n");
                flushWeather();
            }
        }
        @Override public void onCharacteristicChanged(BluetoothGatt bg,BluetoothGattCharacteristic c){handle(c.getValue());}
        @Override public void onCharacteristicChanged(BluetoothGatt bg,BluetoothGattCharacteristic c,byte[] v){handle(v);}
        @Override public void onCharacteristicWrite(BluetoothGatt bg,BluetoothGattCharacteristic c,int status){synchronized(writes){writeBusy=false;}writeNext();}
    };

    private void scheduleReconnect(){if(stopping)return;h.postDelayed(this::connectSavedWatch,5000L);}

    private void closeGatt(){ready=false;if(gatt!=null){try{gatt.disconnect();}catch(Exception ignored){}try{gatt.close();}catch(Exception ignored){}gatt=null;}}

    private void stopNative(){stopping=true;if(weatherSync!=null)weatherSync.stop();stopFindPhone();closeGatt();stopForeground(true);stopSelf();}

    private void handle(byte[] data) {
        if(data==null||data.length==0)return;String s=new String(data,StandardCharsets.UTF_8);
        synchronized(rx){rx.append(s);int n;while((n=rx.indexOf("\n"))>=0){String line=rx.substring(0,n).replace("\r","");rx.delete(0,n+1);handleLine(line);}if(rx.length()>8192)rx.delete(0,rx.length()-2048);}
    }

    private void handleLine(String line) {
        if(line.contains("VOX_V08:NATIVE_MUSIC_OPEN")){nativeMusicOpen=true;nativePhoneOpen=false;lastTrackKey="";syncArtwork(true);}
        else if(line.contains("VOX_V08:NATIVE_MUSIC_CLOSE")){nativeMusicOpen=false;lastTrackKey="";}
        else if(line.contains("VOX_V08:NATIVE_TRACK")){lastTrackKey="";syncArtwork(true);}
        else if(line.contains("VOX_V08:NATIVE_PHONE_OPEN")){nativePhoneOpen=true;nativeMusicOpen=false;pushPhoneStatus();}
        else if(line.contains("VOX_V08:NATIVE_PHONE_CLOSE")){nativePhoneOpen=false;}
        else if(line.contains("VOX_V08:NATIVE_FIND")){toggleFindPhone();pushPhoneStatus();}
        else if(line.contains("VOX_V08:ACTIVE:NATIVE_MUSIC")){nativeMusicOpen=true;lastTrackKey="";syncArtwork(true);}
        else if(line.contains("VOX_V08:ACTIVE:NATIVE_PHONE")){nativePhoneOpen=true;pushPhoneStatus();}
        else if(line.contains("VOX_V08:WEATHER_SYNC_OK")){
            WeatherSyncEngine.Payload p=weatherInFlight;
            weatherSending=false;weatherInFlight=null;
            if(p!=null&&weatherSync!=null){weatherSync.markDelivered(p);updateNotification("Companion actif / Meteo "+p.locality);}
            if(weatherLatest!=p)flushWeather();
        }
        else if(line.contains("VOX_V08:WEATHER_SYNC_ERR")){weatherSending=false;weatherInFlight=null;updateNotification("Companion actif / erreur synchro meteo");}
    }

    private static final class MediaSnap {String key;Bitmap art;}

    private MediaSnap media() {
        if(mediaSessions==null)return null;List<MediaController> list;
        try{list=mediaSessions.getActiveSessions(listenerComponent);}catch(Exception e){return null;}
        if(list==null||list.isEmpty())return null;MediaController c=list.get(0);
        for(MediaController x:list){PlaybackState p=x.getPlaybackState();if(p!=null&&p.getState()==PlaybackState.STATE_PLAYING){c=x;break;}}
        MediaMetadata m=c.getMetadata();if(m==null)return null;String title=text(m,MediaMetadata.METADATA_KEY_TITLE,MediaMetadata.METADATA_KEY_DISPLAY_TITLE);String artist=text(m,MediaMetadata.METADATA_KEY_ARTIST,MediaMetadata.METADATA_KEY_ALBUM_ARTIST,MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE);long dur=Math.max(0,m.getLong(MediaMetadata.METADATA_KEY_DURATION));Bitmap art=m.getBitmap(MediaMetadata.METADATA_KEY_ART);if(art==null)art=m.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);if(art==null)art=m.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON);MediaSnap s=new MediaSnap();s.key=c.getPackageName()+"|"+title+"|"+artist+"|"+dur;s.art=art;return s;
    }

    private String text(MediaMetadata m,String...keys){for(String k:keys){CharSequence t=m.getText(k);if(t!=null&&t.length()>0)return t.toString();String s=m.getString(k);if(!TextUtils.isEmpty(s))return s;}return "";}

    private void syncArtwork(boolean force) {
        if(!ready||!nativeMusicOpen)return;MediaSnap s=media();if(s==null)return;if(!force&&s.key.equals(lastTrackKey))return;lastTrackKey=s.key;final int gen=++artGeneration;
        sendConsole("if(global.__voxNativeMusicClearArt)global.__voxNativeMusicClearArt();\n");
        if(s.art==null)return;Bitmap copy=s.art.copy(Bitmap.Config.ARGB_8888,false);
        artExecutor.execute(() -> {
            NativeArtCodec.Result r=null;try{r=NativeArtCodec.encode(copy);}finally{try{copy.recycle();}catch(Exception ignored){}}
            if(r==null||gen!=artGeneration||!nativeMusicOpen||!ready)return;sendArtwork(r);
        });
    }

    private void sendArtwork(NativeArtCodec.Result r) {
        sendConsole("global.__voxNativeArtB64='';\n");
        for(int off=0;off<r.base64.length();off+=ART_CHUNK){String p=r.base64.substring(off,Math.min(r.base64.length(),off+ART_CHUNK));sendConsole("global.__voxNativeArtB64+='"+p+"';\n");}
        sendConsole("(function(){try{var I={width:120,height:120,bpp:4,palette:new Uint16Array("+NativeArtCodec.jsArray(r.palette565)+"),buffer:E.toArrayBuffer(atob(global.__voxNativeArtB64))};global.__voxNativeArtB64='';if(global.__voxNativeMusicSetArt)global.__voxNativeMusicSetArt(I,'"+r.accentHex+"');}catch(e){global.__voxNativeArtB64='';}})();\n");
    }

    private void flushWeather() {
        if(!ready||weatherSending||weatherLatest==null)return;
        WeatherSyncEngine.Payload p=weatherLatest;
        weatherSending=true;
        weatherInFlight=p;
        String b64=Base64.encodeToString(p.json.getBytes(StandardCharsets.UTF_8),Base64.NO_WRAP);
        sendConsole("(function(){try{var S=require('Storage');if(!S.read('weather.vox.bak')){var O=S.read('weather.json');if(O)S.write('weather.vox.bak',O);}global.__voxWeatherB64='';}catch(e){}})();\n");
        for(int off=0;off<b64.length();off+=WEATHER_CHUNK){String part=b64.substring(off,Math.min(b64.length(),off+WEATHER_CHUNK));sendConsole("global.__voxWeatherB64+='"+part+"';\n");}
        sendConsole("(function(){try{var S=require('Storage');S.write('weather.json',atob(global.__voxWeatherB64));global.__voxWeatherB64='';print('VOX_V08:WEATHER_SYNC_OK');}catch(e){global.__voxWeatherB64='';print('VOX_V08:WEATHER_SYNC_ERR:'+e);}})();\n");
    }

    private static final class Phone {int batt;String charge,net,ring;}

    private Phone phone() {
        Phone p=new Phone();p.batt=0;p.charge="SUR BATTERIE";p.net="?";p.ring="?";
        try{Intent b=registerReceiver(null,new IntentFilter(Intent.ACTION_BATTERY_CHANGED));if(b!=null){int l=b.getIntExtra(BatteryManager.EXTRA_LEVEL,-1),sc=b.getIntExtra(BatteryManager.EXTRA_SCALE,100);p.batt=l<0?0:Math.max(0,Math.min(100,Math.round(l*100f/Math.max(1,sc))));int st=b.getIntExtra(BatteryManager.EXTRA_STATUS,BatteryManager.BATTERY_STATUS_UNKNOWN);boolean ch=st==BatteryManager.BATTERY_STATUS_CHARGING||st==BatteryManager.BATTERY_STATUS_FULL;boolean full=st==BatteryManager.BATTERY_STATUS_FULL;p.charge=full?"CHARGE COMPLETE":ch?"EN CHARGE":"SUR BATTERIE";}}
        catch(Exception ignored){}
        try{ConnectivityManager cm=(ConnectivityManager)getSystemService(CONNECTIVITY_SERVICE);Network n=cm==null?null:cm.getActiveNetwork();NetworkCapabilities c=(cm==null||n==null)?null:cm.getNetworkCapabilities(n);if(c==null)p.net="HORS LIGNE";else if(c.hasTransport(NetworkCapabilities.TRANSPORT_WIFI))p.net="WIFI";else if(c.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR))p.net="MOBILE";else if(c.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET))p.net="ETHERNET";else if(c.hasTransport(NetworkCapabilities.TRANSPORT_VPN))p.net="VPN";else p.net="CONNECTE";}catch(Exception ignored){}
        try{AudioManager am=(AudioManager)getSystemService(AUDIO_SERVICE);int m=am==null?AudioManager.RINGER_MODE_NORMAL:am.getRingerMode();p.ring=m==AudioManager.RINGER_MODE_SILENT?"SILENCE":m==AudioManager.RINGER_MODE_VIBRATE?"VIBREUR":"SONNERIE";}catch(Exception ignored){}
        return p;
    }

    private void pushPhoneStatus(){if(!ready||!nativePhoneOpen)return;Phone p=phone();sendConsole("if(global.__voxNativePhoneUpdate)global.__voxNativePhoneUpdate("+p.batt+","+q(p.charge)+","+q(p.net)+","+q(p.ring)+","+(findPlaying?"true":"false")+");\n");}

    private void toggleFindPhone(){if(findPlaying)stopFindPhone();else startFindPhone();}

    private void startFindPhone(){
        try{stopFindPhone();Uri u=RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);findRingtone=RingtoneManager.getRingtone(this,u);if(findRingtone==null)findRingtone=RingtoneManager.getRingtone(this,RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE));if(findRingtone!=null){AudioAttributes at=new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();findRingtone.setAudioAttributes(at);if(Build.VERSION.SDK_INT>=28)findRingtone.setLooping(true);findRingtone.play();}vibrator=(Vibrator)getSystemService(Context.VIBRATOR_SERVICE);if(vibrator!=null&&vibrator.hasVibrator())vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0,450,250,450,700},0));findPlaying=true;h.postDelayed(()->{stopFindPhone();pushPhoneStatus();},30000L);}catch(Exception ignored){findPlaying=false;}
    }
    private void stopFindPhone(){try{if(findRingtone!=null)findRingtone.stop();}catch(Exception ignored){}try{if(vibrator!=null)vibrator.cancel();}catch(Exception ignored){}findRingtone=null;vibrator=null;findPlaying=false;}

    private String q(String s){if(s==null)s="";return "'"+s.replace("\\","\\\\").replace("'","\\'").replace("\n"," ").replace("\r"," ")+"'";}

    private synchronized void sendConsole(String text){if(!ready||uartRx==null)return;byte[] all=text.getBytes(StandardCharsets.UTF_8);for(int off=0;off<all.length;off+=UART_CHUNK){int n=Math.min(UART_CHUNK,all.length-off);byte[] p=new byte[n];System.arraycopy(all,off,p,0,n);writes.add(p);}writeNext();}

    private synchronized void writeNext(){if(writeBusy||writes.isEmpty()||gatt==null||uartRx==null||!btOk())return;byte[] p=writes.poll();writeBusy=true;try{if(Build.VERSION.SDK_INT>=33){int r=gatt.writeCharacteristic(uartRx,p,BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);if(r!=0){writeBusy=false;h.postDelayed(this::writeNext,30);}}else{uartRx.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);uartRx.setValue(p);if(!gatt.writeCharacteristic(uartRx)){writeBusy=false;h.postDelayed(this::writeNext,30);}}}catch(Exception e){writeBusy=false;h.postDelayed(this::writeNext,50);}}
}
