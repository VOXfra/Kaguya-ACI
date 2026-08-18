package fr.vox.chronomarkplus;

import android.Manifest;
import android.bluetooth.BluetoothGatt;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;

/** Chronomark+ v1.0.0 - native watch apps + long-running Android companion. */
public class MainActivityV100 extends MainActivityV090 {
    private static final int REQ_NOTIF = 1100;
    private TextView nativeStatus;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        patchV100Ui();
    }

    private void patchV100Ui() {
        View root=getWindow().getDecorView();
        TextView version=findContains(root,"MUSIC CONTROL+ / PHONE STATUS / v0.9.0");
        if(version!=null)version.setText("MUSIC CONTROL+ / PHONE STATUS / v1.0.0 NATIVE");
        TextView safety=findContains(root,"RAM-ONLY / MUSIC + PHONE");
        if(safety!=null)safety.setText("NATIVE INSTALLER / BETHESDA FILES PRESERVED / APP LIST BACKED UP");

        hide(root,"OUVRIR MUSIC CONTROL+");
        hide(root,"OUVRIR PHONE STATUS / FIND PHONE");
        TextView help=findContains(root,"MUSIC : BTN1");
        if(help!=null)help.setText("APRES INSTALLATION : ouvre Music Control+ ou Phone Status directement depuis le menu de la montre.");

        TextView logTitle=findContains(root,"LIVE BRIDGE LOG");
        if(logTitle!=null && logTitle.getParent() instanceof ViewGroup){
            ViewGroup parent=(ViewGroup)logTitle.getParent();int at=parent.indexOfChild(logTitle);
            TextView section=txt("APPS NATIVES / INSTALLATION UNIQUE",11,0xFFA4A9A7);section.setPadding(0,dp(14),0,dp(4));parent.addView(section,at++);
            nativeStatus=txt("1) Connecte la Chronomark  2) Installe les apps  3) Active le companion",12,0xFF7AC6BE);nativeStatus.setPadding(dp(10),dp(8),dp(10),dp(8));nativeStatus.setBackgroundColor(0xFF1B2226);parent.addView(nativeStatus,at++);

            Button install=btn("INSTALLER MUSIC+ + PHONE SUR LA MONTRE");install.setOnClickListener(v->installNative());parent.addView(install,at++,lp(dp(52)));
            Button restore=btn("RESTAURER LE MENU BETHESDA / DESINSTALLER");restore.setOnClickListener(v->restoreBethesda());parent.addView(restore,at++,lp(dp(48)));
            Button start=btn("ACTIVER LE COMPANION NATIF EN ARRIERE-PLAN");start.setOnClickListener(v->startNativeCompanion());parent.addView(start,at++,lp(dp(52)));
            Button stop=btn("ARRETER LE COMPANION NATIF");stop.setOnClickListener(v->stopNativeCompanion());parent.addView(stop,at,lp(dp(46)));
        }
    }

    private void installNative(){
        if(!consoleReady()){Toast.makeText(this,"Connecte d'abord la Chronomark.",Toast.LENGTH_LONG).show();return;}
        nativeStatus.setText("INSTALLATION / ecriture des nouveaux fichiers...");
        writeWatchFile("musicplus.app.js",NativeWatchApps.MUSIC_APP);
        writeWatchFile("musicplus.info",NativeWatchApps.MUSIC_INFO);
        writeWatchFile("phone.app.js",NativeWatchApps.PHONE_APP);
        writeWatchFile("phone.info",NativeWatchApps.PHONE_INFO);
        String js="(function(){try{var S=require('Storage'),a=S.readJSON('applist.json',1);if(!a)throw 'applist manquant';"+
                "if(!S.read('applist.vox.bak'))S.write('applist.vox.bak',S.read('applist.json'));"+
                "function patch(nm,ic){if(!a[nm]||!a[ic])return;var n=a[nm],i=a[ic],m=n.indexOf('music');if(m>=0){n[m]='musicplus';i[m]='music';}else if(n.indexOf('musicplus')<0){var w=n.indexOf('weather');if(w<0)w=n.length;n.splice(w,0,'musicplus');i.splice(w,0,'music');}"+
                "if(n.indexOf('phone')<0){var p=n.indexOf('musicplus');p=p<0?n.length:p+1;n.splice(p,0,'phone');i.splice(p,0,'message');}}"+
                "patch('name','icon');patch('nameTest','iconTest');S.write('applist.json',JSON.stringify(a));print('VOX_V08:NATIVE_INSTALL_OK');setTimeout(function(){load('clock.app.js');},150);}catch(e){print('VOX_V08:NATIVE_INSTALL_ERR:'+e);}})();\n";
        send(js);
    }

    private void restoreBethesda(){
        if(!consoleReady()){Toast.makeText(this,"Connecte d'abord la Chronomark.",Toast.LENGTH_LONG).show();return;}
        nativeStatus.setText("RESTAURATION / menu Bethesda...");
        String js="(function(){try{var S=require('Storage'),b=S.read('applist.vox.bak');if(b)S.write('applist.json',b);else{var a=S.readJSON('applist.json',1);function r(nm,ic){if(!a||!a[nm])return;var n=a[nm],i=a[ic]||[];var m=n.indexOf('musicplus');if(m>=0){n[m]='music';if(i[m]!==undefined)i[m]='music';}var p=n.indexOf('phone');if(p>=0){n.splice(p,1);if(i.length>p)i.splice(p,1);}}r('name','icon');r('nameTest','iconTest');S.write('applist.json',JSON.stringify(a));}"+
                "['musicplus.app.js','musicplus.info','phone.app.js','phone.info'].forEach(function(f){S.erase(f);});print('VOX_V08:NATIVE_RESTORE_OK');setTimeout(function(){load('clock.app.js');},150);}catch(e){print('VOX_V08:NATIVE_RESTORE_ERR:'+e);}})();\n";
        send(js);
    }

    private void writeWatchFile(String name,String content){
        String b64=Base64.encodeToString(content.getBytes(StandardCharsets.UTF_8),Base64.NO_WRAP);
        send("global.__voxInstallB64='';\n");
        for(int off=0;off<b64.length();off+=360){String p=b64.substring(off,Math.min(b64.length(),off+360));send("global.__voxInstallB64+='"+p+"';\n");}
        send("require('Storage').write('"+name+"',atob(global.__voxInstallB64));global.__voxInstallB64='';\n");
    }

    private void startNativeCompanion(){
        BluetoothGatt g=currentGatt();
        if(g==null){Toast.makeText(this,"Connecte d'abord la Chronomark pour enregistrer son adresse.",Toast.LENGTH_LONG).show();return;}
        String mac=g.getDevice().getAddress();getSharedPreferences(ChronomarkNativeService.PREFS,MODE_PRIVATE).edit().putString(ChronomarkNativeService.KEY_MAC,mac).apply();
        if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},REQ_NOTIF);
        closeActivityGatt();
        Intent i=new Intent(this,ChronomarkNativeService.class);
        if(Build.VERSION.SDK_INT>=26)startForegroundService(i);else startService(i);
        nativeStatus.setText("COMPANION NATIF ACTIF / "+mac+" / la montre se reconnecte en arriere-plan");
    }

    private void stopNativeCompanion(){Intent i=new Intent(this,ChronomarkNativeService.class);i.setAction(ChronomarkNativeService.ACTION_STOP);startService(i);if(nativeStatus!=null)nativeStatus.setText("COMPANION NATIF ARRETE");}

    @Override protected void onV08WatchLine(String line){
        if(line!=null&&line.contains("VOX_V08:NATIVE_INSTALL_OK")){runOnUiThread(()->nativeStatus.setText("INSTALLE / Music Control+ et Phone Status sont maintenant dans le menu de la montre"));return;}
        if(line!=null&&line.contains("VOX_V08:NATIVE_INSTALL_ERR:")){runOnUiThread(()->nativeStatus.setText("ERREUR INSTALLATION / aucune suppression Bethesda effectuee"));return;}
        if(line!=null&&line.contains("VOX_V08:NATIVE_RESTORE_OK")){runOnUiThread(()->nativeStatus.setText("MENU BETHESDA RESTAURE"));return;}
        if(line!=null&&line.contains("VOX_V08:NATIVE_RESTORE_ERR:")){runOnUiThread(()->nativeStatus.setText("ERREUR RESTAURATION"));return;}
        super.onV08WatchLine(line);
    }

    private boolean consoleReady(){try{Field f=MainActivityV07.class.getDeclaredField("consoleReady");f.setAccessible(true);return f.getBoolean(this);}catch(Exception e){return false;}}
    private BluetoothGatt currentGatt(){try{Field f=MainActivityV07.class.getDeclaredField("gatt");f.setAccessible(true);return (BluetoothGatt)f.get(this);}catch(Exception e){return null;}}
    private void closeActivityGatt(){try{Method m=MainActivityV07.class.getDeclaredMethod("closeGatt");m.setAccessible(true);m.invoke(this);}catch(Exception ignored){}}
    private void send(String s){try{Method m=MainActivityV07.class.getDeclaredMethod("sendConsole",String.class);m.setAccessible(true);m.invoke(this,s);}catch(Exception e){Toast.makeText(this,"Pont Chronomark: "+e.getClass().getSimpleName(),Toast.LENGTH_LONG).show();}}

    private void hide(View root,String needle){TextView v=findContains(root,needle);if(v!=null)v.setVisibility(View.GONE);}
    private TextView findContains(View root,String needle){if(root instanceof TextView){CharSequence s=((TextView)root).getText();if(s!=null&&s.toString().contains(needle))return (TextView)root;}if(root instanceof ViewGroup){ViewGroup g=(ViewGroup)root;for(int i=0;i<g.getChildCount();i++){TextView t=findContains(g.getChildAt(i),needle);if(t!=null)return t;}}return null;}
    private TextView txt(String s,int sp,int c){TextView t=new TextView(this);t.setText(s);t.setTextSize(sp);t.setTextColor(c);return t;}
    private Button btn(String s){Button b=new Button(this);b.setText(s);b.setAllCaps(false);b.setTextSize(10);return b;}
    private LinearLayout.LayoutParams lp(int h){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,h);p.setMargins(0,dp(3),0,dp(3));return p;}
    private int dp(int v){return Math.round(v*getResources().getDisplayMetrics().density);}
}
