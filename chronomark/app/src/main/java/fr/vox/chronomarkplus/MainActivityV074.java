package fr.vox.chronomarkplus;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.text.Normalizer;
import java.util.Locale;

/**
 * v0.7.4 - Weather+ correction only.
 * Music Control+ remains exactly the validated implementation inherited from v0.7.
 * Weather+ is RAM-only and uses the shared Chronomark+ lifecycle contract.
 */
public class MainActivityV074 extends MainActivityV073 {
    private final Handler weatherHandler = new Handler(Looper.getMainLooper());
    private boolean weather074Active;
    private String lastWeatherSignature = "";

    private final Runnable weatherMonitor = new Runnable() {
        @Override public void run() {
            if (weather074Active && !isWeather074Mode()) {
                // BTN2 on the watch is handled by the inherited UART parser, which clears watchMode.
                // Mirror that state locally so a later GPS refresh cannot push over the Bethesda clock.
                weather074Active = false;
                lastWeatherSignature = "";
            }

            if (weather074Active && parentBooleanV07("consoleReady")) {
                MainActivityV071.FixWeatherData data = getWeatherData();
                if (data != null) {
                    String signature = weatherSignature(data);
                    if (!signature.equals(lastWeatherSignature)) {
                        lastWeatherSignature = signature;
                        pushWeather074(false);
                    }
                }
            }
            weatherHandler.postDelayed(this, 1500L);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        patchUi();
        weatherHandler.post(weatherMonitor);
    }

    @Override
    protected void onDestroy() {
        weatherHandler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    private void patchUi() {
        View root = getWindow().getDecorView();

        TextView version = findTextContains(root, "MUSIC CONTROL+ / METEO+");
        if (version != null) version.setText("MUSIC CONTROL+ / METEO+ / v0.7.4");

        TextView summary = findTextContains(root, "Suivi automatique");
        if (summary != null) summary.setText("Position dynamique + meteo locale / mise a jour automatique");

        Button launch = findButtonContains(root, "LANCER METEO+");
        if (launch != null) {
            launch.setText("LANCER METEO+");
            launch.setOnClickListener(v -> launchWeather074());
        }

        Button sync = findButtonContains(root, "SYNCHRONISER");
        if (sync != null) sync.setOnClickListener(v -> {
            if (weather074Active) pushWeather074(false);
            else invokeV07("syncCurrentMode");
        });

        Button back = findButtonContains(root, "RETOUR CADRAN");
        if (back != null) back.setOnClickListener(v -> {
            if (weather074Active) returnClock074();
            else invokeV07("returnToClock");
        });
    }

    private void launchWeather074() {
        MainActivityV071.FixWeatherData data = getWeatherData();
        if (data == null) {
            Toast.makeText(this, "Actualise d'abord Meteo+.", Toast.LENGTH_LONG).show();
            return;
        }
        if (!parentBooleanV07("consoleReady")) {
            Toast.makeText(this, "Connecte d'abord la Chronomark.", Toast.LENGTH_LONG).show();
            return;
        }

        weather074Active = true;
        lastWeatherSignature = weatherSignature(data);
        setParentFieldV07("watchMode", "weather074");
        pushWeather074(true);
    }

    private void pushWeather074(boolean fullLaunch) {
        MainActivityV071.FixWeatherData w = getWeatherData();
        if (!weather074Active || w == null || !parentBooleanV07("consoleReady")) return;

        StringBuilder times = new StringBuilder("[");
        StringBuilder temps = new StringBuilder("[");
        StringBuilder pops = new StringBuilder("[");
        for (int i = 0; i < w.hours.size(); i++) {
            if (i > 0) { times.append(','); temps.append(','); pops.append(','); }
            MainActivityV071.FixHour h = w.hours.get(i);
            times.append(jsQuote(hourLabel(h.time)));
            temps.append(Math.round(h.temp));
            pops.append(Math.round(h.pop));
        }
        times.append(']'); temps.append(']'); pops.append(']');

        String place = trim(ascii(w.place).toUpperCase(Locale.ROOT), 14);
        String condition = trim(ascii(w.condition).toUpperCase(Locale.ROOT), 30);

        if (!fullLaunch) {
            String update = "(function(){var W=global.__voxWX;" +
                    "if(!W||!W.active||W.sid!==global.__voxSessionSeq||global.__voxActiveApp!=='WX')return;" +
                    "W.place=" + jsQuote(place) + ";W.temp=" + Math.round(w.temp) +
                    ";W.feels=" + Math.round(w.feels) + ";W.hum=" + Math.round(w.humidity) +
                    ";W.pop=" + Math.round(w.nextRainChance) + ";W.wind=" + Math.round(w.wind) +
                    ";W.min=" + Math.round(w.min) + ";W.max=" + Math.round(w.max) +
                    ";W.cond=" + jsQuote(condition) + ";W.times=" + times +
                    ";W.temps=" + temps + ";W.pops=" + pops + ";" +
                    "if(global.__voxWXDraw)global.__voxWXDraw();})();\n";
            sendConsoleV07(update);
            return;
        }

        String js = "(function(){try{" +
                WatchAppContract.suspendBethesdaClockJs() +
                "try{if(global.__voxWX&&global.__voxWX.stop)global.__voxWX.stop(false);}catch(e){}" +
                WatchAppContract.beginSessionJs("WX") +
                "var W=global.__voxWX={sid:__voxSid,active:true,page:0,place:" + jsQuote(place) +
                ",temp:" + Math.round(w.temp) + ",feels:" + Math.round(w.feels) +
                ",hum:" + Math.round(w.humidity) + ",pop:" + Math.round(w.nextRainChance) +
                ",wind:" + Math.round(w.wind) + ",min:" + Math.round(w.min) + ",max:" + Math.round(w.max) +
                ",cond:" + jsQuote(condition) + ",times:" + times + ",temps:" + temps + ",pops:" + pops + "};" +

                "W.valid=function(){return W.active&&W.sid===global.__voxSessionSeq&&global.__voxActiveApp==='WX';};" +
                "W.stop=function(goClock){if(!W.active)return;W.active=false;try{E.clearWatches();}catch(e){}" +
                "if(global.__voxWX===W)global.__voxWX=null;global.__voxSessionSeq=(global.__voxSessionSeq||0)+1;global.__voxActiveApp='';" +
                "if(goClock){try{g.reset().setClipRect(0,0,239,239).clear(1);g.flip();}catch(e){}" +
                "print('VOX'+'_WX:EXIT');setTimeout(function(){load('clock.app.js');},80);}};" +
                "global.__voxWXBack=function(){W.stop(true);};" +

                "global.__voxWXFit=function(str,maxw,font){str=str||'';font();if(g.stringWidth(str)<=maxw)return str;" +
                "while(str.length>1){str=str.substr(0,str.length-1);if(g.stringWidth(str+'...')<=maxw)return str+'...';}return str;};" +

                "global.__voxWXBase=function(){if(!W.valid())return false;" +
                "g.reset().setClipRect(0,0,239,239).clear(1);Dickens.buttonIcons=['chart','clock','down','up'];Dickens.loadSurround();" +
                "g.setColor('#181820').fillCircleAA(119,119,92);" + WatchAppContract.safeClipJs() + "return true;};" +

                "global.__voxWXNow=function(){if(!global.__voxWXBase())return;" +
                "var f10=function(){g.setFontArchitekt10();};var f14=function(){g.setFontGrotesk14();};" +
                "g.setFontAlign(0,0).setColor('#BFC8CC');g.drawString(global.__voxWXFit(W.place,132,f10),119,40);" +
                "g.setColor('#FFF');g.drawString(global.__voxWXFit(W.cond,150,f14),119,60);" +
                "g.setColor('#E49E4C').setFontArchitekt35().drawString(W.temp+'°',119,95);" +
                "g.setFontArchitekt10();g.setColor('#71868E').drawString('RESSENTI',78,126).drawString('HUMIDITE',160,126);" +
                "g.setColor('#FFF').drawString(W.feels+'°',78,141).drawString(W.hum+'%',160,141);" +
                "g.setColor('#71868E').drawString('PLUIE',78,158).drawString('VENT',160,158);" +
                "g.setColor('#FFF').drawString(W.pop+'%',78,173).drawString(W.wind+' KM/H',160,173);" +
                "g.setColor('#AAB2B5').drawString('MIN '+W.min+'°   MAX '+W.max+'°',119,189);" +
                WatchAppContract.fullClipJs() + "g.flip();};" +

                "global.__voxWXGraph=function(){if(!global.__voxWXBase())return;" +
                "var f10=function(){g.setFontArchitekt10();};" +
                "g.setFontAlign(0,0).setColor('#BFC8CC').drawString(global.__voxWXFit(W.place,132,f10),119,39);" +
                "g.setColor('#E49E4C').setFontGrotesk14().drawString('6 PROCHAINES H',119,58);" +
                "var n=W.temps.length;if(!n){g.setFontArchitekt10().setColor('#AAA').drawString('AUCUNE DONNEE',119,118);" + WatchAppContract.fullClipJs() + "g.flip();return;}" +
                "var tmin=Math.min.apply(Math,W.temps),tmax=Math.max.apply(Math,W.temps);if(tmax<=tmin)tmax=tmin+1;" +
                "var x0=60,x1=184,yt=79,yb=132,px=0,py=0;g.setColor('#34383A').drawRect(x0,yt,x1,yb);" +
                "for(var i=0;i<n;i++){var x=n===1?122:x0+i*(x1-x0)/(n-1);var y=yb-(W.temps[i]-tmin)*(yb-yt)/(tmax-tmin);" +
                "if(i){g.setColor('#D7F22E').drawLine(px,py,x,y);}g.setColor('#D7F22E').fillCircle(x,y,2);px=x;py=y;}" +
                "g.setFontArchitekt10().setFontAlign(1,0).setColor('#9CA5A8').drawString(Math.round(tmax)+'°',53,yt).drawString(Math.round(tmin)+'°',53,yb);" +
                "for(var j=0;j<n;j++){var xx=n===1?122:x0+j*(x1-x0)/(n-1);var bh=Math.round(Math.max(0,Math.min(100,W.pops[j]))*0.18);" +
                "g.setColor('#00BCEB').fillRect(xx-3,160-bh,xx+3,160);" +
                "if(j===0||j===n-1||j===2||j===4)g.setColor('#9CA5A8').setFontAlign(0,0).drawString(W.times[j],xx,174);}" +
                "g.setFontAlign(0,0).setColor('#D7F22E').drawString('TEMP',82,189);g.setColor('#00BCEB').drawString('PLUIE',157,189);" +
                WatchAppContract.fullClipJs() + "g.flip();};" +

                "global.__voxWXDraw=function(){if(!W.valid())return;if(W.page===0)global.__voxWXNow();else global.__voxWXGraph();};" +
                "var page=function(d){if(!W.valid())return;W.page=(W.page+d+2)%2;global.__voxWXDraw();};" +
                "setWatch(function(){page(1);},BTN1,{edge:1,repeat:1});setWatch(global.__voxWXBack,BTN2,{edge:1,repeat:1});" +
                "setWatch(function(){page(1);},BTN3,{edge:1,repeat:1});setWatch(function(){page(-1);},BTN4,{edge:1,repeat:1});" +
                "global.__voxWXDraw();print('VOX'+'_WX:READY074');" +
                "}catch(e){print('VOX'+'_WX:ERR:'+e);try{E.clearWatches();g.reset().setClipRect(0,0,239,239).clear(1);g.flip();}catch(x){}" +
                "global.__voxSessionSeq=(global.__voxSessionSeq||0)+1;global.__voxActiveApp='';setTimeout(function(){load('clock.app.js');},250);}})();\n";

        sendConsoleV07(js);
    }

    private void returnClock074() {
        weather074Active = false;
        lastWeatherSignature = "";
        setParentFieldV07("watchMode", "");
        if (!parentBooleanV07("consoleReady")) return;
        sendConsoleV07("try{if(global.__voxWX&&global.__voxWX.stop)global.__voxWX.stop(true);else{" +
                WatchAppContract.exitToClockJs() + "}}catch(e){" + WatchAppContract.exitToClockJs() + "}\n");
    }

    private boolean isWeather074Mode() {
        try {
            Field f = MainActivityV07.class.getDeclaredField("watchMode");
            f.setAccessible(true);
            return "weather074".equals(f.get(this));
        } catch (Exception e) { return false; }
    }

    private String weatherSignature(MainActivityV071.FixWeatherData w) {
        StringBuilder s = new StringBuilder();
        s.append(w.place).append('|').append(Math.round(w.lat * 10000)).append('|').append(Math.round(w.lon * 10000))
                .append('|').append(Math.round(w.temp)).append('|').append(Math.round(w.feels)).append('|')
                .append(Math.round(w.humidity)).append('|').append(Math.round(w.nextRainChance)).append('|')
                .append(Math.round(w.wind)).append('|').append(w.condition);
        for (MainActivityV071.FixHour h : w.hours) {
            s.append('|').append(h.time).append(':').append(Math.round(h.temp)).append(':').append(Math.round(h.pop));
        }
        return s.toString();
    }

    private MainActivityV071.FixWeatherData getWeatherData() {
        try {
            Field f = MainActivityV071.class.getDeclaredField("wx");
            f.setAccessible(true);
            return (MainActivityV071.FixWeatherData) f.get(this);
        } catch (Exception e) { return null; }
    }

    private boolean parentBooleanV07(String name) {
        try {
            Field f = MainActivityV07.class.getDeclaredField(name);
            f.setAccessible(true);
            return f.getBoolean(this);
        } catch (Exception e) { return false; }
    }

    private void setParentFieldV07(String name, Object value) {
        try {
            Field f = MainActivityV07.class.getDeclaredField(name);
            f.setAccessible(true);
            f.set(this, value);
        } catch (Exception ignored) {}
    }

    private void sendConsoleV07(String text) {
        try {
            Method m = MainActivityV07.class.getDeclaredMethod("sendConsole", String.class);
            m.setAccessible(true);
            m.invoke(this, text);
        } catch (Exception e) {
            Toast.makeText(this, "Erreur pont Chronomark: " + e.getClass().getSimpleName(), Toast.LENGTH_LONG).show();
        }
    }

    private void invokeV07(String name) {
        try {
            Method m = MainActivityV07.class.getDeclaredMethod(name);
            m.setAccessible(true);
            m.invoke(this);
        } catch (Exception ignored) {}
    }

    private String hourLabel(String iso) {
        int t = iso == null ? -1 : iso.indexOf('T');
        if (t >= 0 && iso.length() >= t + 3) return iso.substring(t + 1, t + 3) + "h";
        return iso == null ? "" : iso;
    }

    private String ascii(String s) {
        if (s == null) return "";
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "")
                .replace('’', '\'').replace('–', '-').replace('—', '-');
    }

    private String trim(String s, int max) {
        if (s == null) return "";
        s = s.replace('\n', ' ').replace('\r', ' ').trim();
        return s.length() <= max ? s : s.substring(0, max);
    }

    private String jsQuote(String s) {
        if (s == null) s = "";
        StringBuilder out = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            switch (ch) {
                case '\\': out.append("\\\\"); break;
                case '"': out.append("\\\""); break;
                case '\n': out.append("\\n"); break;
                case '\r': out.append("\\r"); break;
                case '\t': out.append("\\t"); break;
                default:
                    if (ch < 32 || ch > 126) {
                        String h = Integer.toHexString(ch);
                        out.append("\\u");
                        for (int z = h.length(); z < 4; z++) out.append('0');
                        out.append(h);
                    } else out.append(ch);
            }
        }
        return out.append('"').toString();
    }

    private TextView findTextContains(View root, String needle) {
        if (root instanceof TextView) {
            CharSequence cs = ((TextView) root).getText();
            if (cs != null && cs.toString().contains(needle)) return (TextView) root;
        }
        if (root instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) root;
            for (int i = 0; i < group.getChildCount(); i++) {
                TextView result = findTextContains(group.getChildAt(i), needle);
                if (result != null) return result;
            }
        }
        return null;
    }

    private Button findButtonContains(View root, String needle) {
        if (root instanceof Button) {
            CharSequence cs = ((Button) root).getText();
            if (cs != null && cs.toString().contains(needle)) return (Button) root;
        }
        if (root instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) root;
            for (int i = 0; i < group.getChildCount(); i++) {
                Button result = findButtonContains(group.getChildAt(i), needle);
                if (result != null) return result;
            }
        }
        return null;
    }
}
