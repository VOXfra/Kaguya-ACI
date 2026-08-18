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
 * v0.7.5 - Weather+ graph readability pass only.
 * Music Control+ remains untouched.
 */
public class MainActivityV075 extends MainActivityV074 {
    private final Handler wx075Handler = new Handler(Looper.getMainLooper());
    private boolean wx075Active;
    private String wx075Signature = "";

    private final Runnable monitor075 = new Runnable() {
        @Override public void run() {
            if (wx075Active && !isWeather075Mode()) {
                wx075Active = false;
                wx075Signature = "";
            }
            if (wx075Active && parentBoolean("consoleReady")) {
                MainActivityV071.FixWeatherData w = getWeather();
                if (w != null) {
                    String sig = signature(w);
                    if (!sig.equals(wx075Signature)) {
                        wx075Signature = sig;
                        push075(false);
                    }
                }
            }
            wx075Handler.postDelayed(this, 1500L);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        patch075Ui();
        wx075Handler.post(monitor075);
    }

    @Override
    protected void onDestroy() {
        wx075Handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    private void patch075Ui() {
        View root = getWindow().getDecorView();
        TextView version = findText(root, "MUSIC CONTROL+ / METEO+");
        if (version != null) version.setText("MUSIC CONTROL+ / METEO+ / v0.7.5");

        Button launch = findButton(root, "LANCER METEO+");
        if (launch != null) launch.setOnClickListener(v -> launch075());

        Button sync = findButton(root, "SYNCHRONISER");
        if (sync != null) sync.setOnClickListener(v -> {
            if (wx075Active) push075(false);
            else invokeV07("syncCurrentMode");
        });

        Button back = findButton(root, "RETOUR CADRAN");
        if (back != null) back.setOnClickListener(v -> {
            if (wx075Active) returnClock075();
            else invokeV07("returnToClock");
        });
    }

    private void launch075() {
        MainActivityV071.FixWeatherData w = getWeather();
        if (w == null) {
            Toast.makeText(this, "Actualise d'abord Meteo+.", Toast.LENGTH_LONG).show();
            return;
        }
        if (!parentBoolean("consoleReady")) {
            Toast.makeText(this, "Connecte d'abord la Chronomark.", Toast.LENGTH_LONG).show();
            return;
        }
        wx075Active = true;
        wx075Signature = signature(w);
        setParentField("watchMode", "weather075");
        push075(true);
    }

    private void push075(boolean fullLaunch) {
        MainActivityV071.FixWeatherData w = getWeather();
        if (!wx075Active || w == null || !parentBoolean("consoleReady")) return;

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
            String update = "(function(){var W=global.__voxWX;if(!W||!W.active||W.sid!==global.__voxSessionSeq||global.__voxActiveApp!=='WX')return;" +
                    "W.place=" + jsQuote(place) + ";W.temp=" + Math.round(w.temp) +
                    ";W.feels=" + Math.round(w.feels) + ";W.hum=" + Math.round(w.humidity) +
                    ";W.pop=" + Math.round(w.nextRainChance) + ";W.wind=" + Math.round(w.wind) +
                    ";W.min=" + Math.round(w.min) + ";W.max=" + Math.round(w.max) +
                    ";W.cond=" + jsQuote(condition) + ";W.times=" + times + ";W.temps=" + temps + ";W.pops=" + pops +
                    ";if(global.__voxWXDraw)global.__voxWXDraw();})();\n";
            sendConsole(update);
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
                "if(goClock){try{g.reset().setClipRect(0,0,239,239).clear(1);g.flip();}catch(e){}print('VOX'+'_WX:EXIT');setTimeout(function(){load('clock.app.js');},80);}};" +
                "global.__voxWXBack=function(){W.stop(true);};" +

                "global.__voxWXFit=function(str,maxw,font){str=str||'';font();if(g.stringWidth(str)<=maxw)return str;" +
                "while(str.length>1){str=str.substr(0,str.length-1);if(g.stringWidth(str+'...')<=maxw)return str+'...';}return str;};" +

                "global.__voxWXBase=function(){if(!W.valid())return false;g.reset().setClipRect(0,0,239,239).clear(1);" +
                "Dickens.buttonIcons=['chart','clock','down','up'];Dickens.loadSurround();g.setColor('#181820').fillCircleAA(119,119,92);" +
                WatchAppContract.safeClipJs() + "return true;};" +

                "global.__voxWXNow=function(){if(!global.__voxWXBase())return;var f10=function(){g.setFontArchitekt10();};var f14=function(){g.setFontGrotesk14();};" +
                "g.setFontAlign(0,0).setColor('#BFC8CC').drawString(global.__voxWXFit(W.place,132,f10),119,40);" +
                "g.setColor('#FFF').drawString(global.__voxWXFit(W.cond,150,f14),119,60);" +
                "g.setColor('#E49E4C').setFontArchitekt35().drawString(W.temp+'°',119,95);" +
                "g.setFontArchitekt10();g.setColor('#71868E').drawString('RESSENTI',78,126).drawString('HUMIDITE',160,126);" +
                "g.setColor('#FFF').drawString(W.feels+'°',78,141).drawString(W.hum+'%',160,141);" +
                "g.setColor('#71868E').drawString('PLUIE',78,158).drawString('VENT',160,158);" +
                "g.setColor('#FFF').drawString(W.pop+'%',78,173).drawString(W.wind+' KM/H',160,173);" +
                "g.setColor('#AAB2B5').drawString('MIN '+W.min+'°   MAX '+W.max+'°',119,189);" +
                WatchAppContract.fullClipJs() + "g.flip();};" +

                "global.__voxWXGraph=function(){if(!global.__voxWXBase())return;var f10=function(){g.setFontArchitekt10();};" +
                "g.setFontAlign(0,0).setColor('#BFC8CC').drawString(global.__voxWXFit(W.place,132,f10),119,38);" +
                "g.setColor('#E49E4C').setFontGrotesk14().drawString('6 PROCHAINES HEURES',119,55);" +
                "var n=W.temps.length;if(!n){g.setFontArchitekt10().setColor('#AAA').drawString('AUCUNE DONNEE',119,118);" + WatchAppContract.fullClipJs() + "g.flip();return;}" +
                "var tmin=Math.min.apply(Math,W.temps),tmax=Math.max.apply(Math,W.temps);if(tmax<=tmin)tmax=tmin+1;" +
                "var x0=48,x1=190,yt=76,yb=126,px=0,py=0;g.setColor('#34383A').drawRect(x0,yt,x1,yb);" +
                "for(var i=0;i<n;i++){var x=n===1?119:x0+i*(x1-x0)/(n-1);var y=yb-(W.temps[i]-tmin)*(yb-yt)/(tmax-tmin);" +
                "if(i){g.setColor('#D7F22E').drawLine(px,py,x,y);}g.setColor('#D7F22E').fillCircle(x,y,2);" +
                "var ly=y<91?y+10:y-10;g.setFontArchitekt10().setFontAlign(0,0).setColor('#D7F22E').drawString(W.temps[i]+'°',x,ly);px=x;py=y;}" +
                "g.setFontArchitekt10();for(var j=0;j<n;j++){var xx=n===1?119:x0+j*(x1-x0)/(n-1);" +
                "g.setFontAlign(0,0).setColor('#C7CDD0').drawString(W.times[j],xx,148);" +
                "g.setColor('#00BCEB').drawString(W.pops[j]+'%',xx,169);}" +
                "g.setColor('#D7F22E').drawString('°C TEMP',80,188);g.setColor('#00BCEB').drawString('% PLUIE',158,188);" +
                WatchAppContract.fullClipJs() + "g.flip();};" +

                "global.__voxWXDraw=function(){if(!W.valid())return;if(W.page===0)global.__voxWXNow();else global.__voxWXGraph();};" +
                "var page=function(d){if(!W.valid())return;W.page=(W.page+d+2)%2;global.__voxWXDraw();};" +
                "setWatch(function(){page(1);},BTN1,{edge:1,repeat:1});setWatch(global.__voxWXBack,BTN2,{edge:1,repeat:1});" +
                "setWatch(function(){page(1);},BTN3,{edge:1,repeat:1});setWatch(function(){page(-1);},BTN4,{edge:1,repeat:1});" +
                "global.__voxWXDraw();print('VOX'+'_WX:READY075');" +
                "}catch(e){print('VOX'+'_WX:ERR:'+e);try{E.clearWatches();g.reset().setClipRect(0,0,239,239).clear(1);g.flip();}catch(x){}" +
                "global.__voxSessionSeq=(global.__voxSessionSeq||0)+1;global.__voxActiveApp='';setTimeout(function(){load('clock.app.js');},250);}})();\n";
        sendConsole(js);
    }

    private void returnClock075() {
        wx075Active = false;
        wx075Signature = "";
        setParentField("watchMode", "");
        if (!parentBoolean("consoleReady")) return;
        sendConsole("try{if(global.__voxWX&&global.__voxWX.stop)global.__voxWX.stop(true);else{" +
                WatchAppContract.exitToClockJs() + "}}catch(e){" + WatchAppContract.exitToClockJs() + "}\n");
    }

    private boolean isWeather075Mode() {
        try {
            Field f = MainActivityV07.class.getDeclaredField("watchMode");
            f.setAccessible(true);
            return "weather075".equals(f.get(this));
        } catch (Exception e) { return false; }
    }

    private MainActivityV071.FixWeatherData getWeather() {
        try {
            Field f = MainActivityV071.class.getDeclaredField("wx");
            f.setAccessible(true);
            return (MainActivityV071.FixWeatherData) f.get(this);
        } catch (Exception e) { return null; }
    }

    private String signature(MainActivityV071.FixWeatherData w) {
        StringBuilder s = new StringBuilder();
        s.append(w.place).append('|').append(Math.round(w.lat * 10000)).append('|').append(Math.round(w.lon * 10000))
                .append('|').append(Math.round(w.temp)).append('|').append(Math.round(w.feels)).append('|')
                .append(Math.round(w.humidity)).append('|').append(Math.round(w.nextRainChance)).append('|')
                .append(Math.round(w.wind)).append('|').append(w.condition);
        for (MainActivityV071.FixHour h : w.hours) s.append('|').append(h.time).append(':').append(Math.round(h.temp)).append(':').append(Math.round(h.pop));
        return s.toString();
    }

    private boolean parentBoolean(String name) {
        try {
            Field f = MainActivityV07.class.getDeclaredField(name);
            f.setAccessible(true);
            return f.getBoolean(this);
        } catch (Exception e) { return false; }
    }

    private void setParentField(String name, Object value) {
        try {
            Field f = MainActivityV07.class.getDeclaredField(name);
            f.setAccessible(true);
            f.set(this, value);
        } catch (Exception ignored) {}
    }

    private void sendConsole(String text) {
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
        StringBuilder o = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            switch (ch) {
                case '\\': o.append("\\\\"); break;
                case '"': o.append("\\\""); break;
                case '\n': o.append("\\n"); break;
                case '\r': o.append("\\r"); break;
                case '\t': o.append("\\t"); break;
                default:
                    if (ch < 32 || ch > 126) {
                        String h = Integer.toHexString(ch);
                        o.append("\\u");
                        for (int z = h.length(); z < 4; z++) o.append('0');
                        o.append(h);
                    } else o.append(ch);
            }
        }
        return o.append('"').toString();
    }

    private TextView findText(View root, String needle) {
        if (root instanceof TextView) {
            CharSequence cs = ((TextView) root).getText();
            if (cs != null && cs.toString().contains(needle)) return (TextView) root;
        }
        if (root instanceof ViewGroup) {
            ViewGroup vg = (ViewGroup) root;
            for (int i = 0; i < vg.getChildCount(); i++) {
                TextView t = findText(vg.getChildAt(i), needle);
                if (t != null) return t;
            }
        }
        return null;
    }

    private Button findButton(View root, String needle) {
        if (root instanceof Button) {
            CharSequence cs = ((Button) root).getText();
            if (cs != null && cs.toString().contains(needle)) return (Button) root;
        }
        if (root instanceof ViewGroup) {
            ViewGroup vg = (ViewGroup) root;
            for (int i = 0; i < vg.getChildCount(); i++) {
                Button b = findButton(vg.getChildAt(i), needle);
                if (b != null) return b;
            }
        }
        return null;
    }
}
