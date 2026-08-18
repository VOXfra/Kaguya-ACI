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
import java.util.Locale;

/**
 * v0.7.4: Weather+ only.
 * - Music Control+ is intentionally untouched.
 * - Weather+ uses a strict safe-area on the round display.
 * - No automatic 120 s return: BTN2/phone button exits explicitly.
 * - Session token prevents stale redraws after returning to the Bethesda clock.
 * - Dynamic-location weather updates are pushed into the active Weather+ session.
 * - Watch storage remains untouched (RAM-only prototype).
 */
public class MainActivityV074 extends MainActivityV073 {
    private final Handler wxHandler = new Handler(Looper.getMainLooper());
    private boolean weather074Active;
    private String lastWeatherSignature = "";

    private final Runnable wxMonitor = new Runnable() {
        @Override public void run() {
            if (weather074Active && parentBooleanV07("consoleReady")) {
                MainActivityV071.FixWeatherData w = getWx074();
                if (w != null) {
                    String sig = weatherSignature(w);
                    if (!sig.equals(lastWeatherSignature)) {
                        lastWeatherSignature = sig;
                        pushWeather074(false);
                    }
                }
            }
            wxHandler.postDelayed(this, 1500L);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        patch074Ui();
        wxHandler.post(wxMonitor);
    }

    @Override
    protected void onDestroy() {
        wxHandler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    private void patch074Ui() {
        View root = getWindow().getDecorView();

        TextView version = findTextContains074(root, "MUSIC CONTROL+ / METEO+");
        if (version != null) version.setText("MUSIC CONTROL+ / METEO+ / v0.7.4");

        Button launch = findButtonContains074(root, "LANCER METEO+");
        if (launch != null) {
            launch.setText("LANCER METEO+");
            launch.setOnClickListener(v -> launchWeather074());
        }

        Button sync = findButtonContains074(root, "SYNCHRONISER");
        if (sync != null) sync.setOnClickListener(v -> {
            if (weather074Active) pushWeather074(false);
            else invokeV07("syncCurrentMode");
        });

        Button back = findButtonContains074(root, "RETOUR CADRAN");
        if (back != null) back.setOnClickListener(v -> {
            if (weather074Active) returnClock074();
            else invokeV07("returnToClock");
        });
    }

    private void launchWeather074() {
        MainActivityV071.FixWeatherData w = getWx074();
        if (w == null) {
            Toast.makeText(this, "Actualise d'abord Meteo+.", Toast.LENGTH_LONG).show();
            return;
        }
        if (!parentBooleanV07("consoleReady")) {
            Toast.makeText(this, "Connecte d'abord la Chronomark.", Toast.LENGTH_LONG).show();
            return;
        }

        weather074Active = true;
        lastWeatherSignature = weatherSignature(w);
        setParentFieldV07("watchMode", "weather074");
        pushWeather074(true);
    }

    private void pushWeather074(boolean fullLaunch) {
        MainActivityV071.FixWeatherData w = getWx074();
        if (!weather074Active || w == null || !parentBooleanV07("consoleReady")) return;

        StringBuilder times = new StringBuilder("[");
        StringBuilder temps = new StringBuilder("[");
        StringBuilder pops = new StringBuilder("[");
        for (int i = 0; i < w.hours.size(); i++) {
            if (i > 0) { times.append(','); temps.append(','); pops.append(','); }
            times.append(jsQuote(hourLabel(w.hours.get(i).time)));
            temps.append(Math.round(w.hours.get(i).temp));
            pops.append(Math.round(w.hours.get(i).pop));
        }
        times.append(']'); temps.append(']'); pops.append(']');

        String place = trim(ascii(w.place).toUpperCase(Locale.ROOT), 12);
        String cond = trim(ascii(w.condition), 28);

        if (!fullLaunch) {
            String update = "(function(){var W=global.__voxWX;if(!W||!W.active||W.sid!==global.__voxWXSession)return;" +
                    "W.place=" + jsQuote(place) + ";W.temp=" + Math.round(w.temp) +
                    ";W.feels=" + Math.round(w.feels) + ";W.hum=" + Math.round(w.humidity) +
                    ";W.pop=" + Math.round(w.nextRainChance) + ";W.wind=" + Math.round(w.wind) +
                    ";W.min=" + Math.round(w.min) + ";W.max=" + Math.round(w.max) +
                    ";W.cond=" + jsQuote(cond) + ";W.times=" + times + ";W.temps=" + temps + ";W.pops=" + pops +
                    ";if(global.__voxWXDraw)global.__voxWXDraw();})();\n";
            sendConsoleV07(update);
            return;
        }

        String js = "(function(){try{" +
                "try{if(global.__voxMCTimer)clearInterval(global.__voxMCTimer);if(global.__voxMCAuto)clearTimeout(global.__voxMCAuto);if(global.__voxWXAuto)clearTimeout(global.__voxWXAuto);}catch(e){}" +
                "try{if(global.__voxWX&&global.__voxWX.stop)global.__voxWX.stop(false);}catch(e){}try{E.clearWatches();}catch(e){}" +
                "var sid=(global.__voxWXSession||0)+1;global.__voxWXSession=sid;" +
                "var W=global.__voxWX={sid:sid,active:true,page:0,place:" + jsQuote(place) +
                ",temp:" + Math.round(w.temp) + ",feels:" + Math.round(w.feels) +
                ",hum:" + Math.round(w.humidity) + ",pop:" + Math.round(w.nextRainChance) +
                ",wind:" + Math.round(w.wind) + ",min:" + Math.round(w.min) + ",max:" + Math.round(w.max) +
                ",cond:" + jsQuote(cond) + ",times:" + times + ",temps:" + temps + ",pops:" + pops + "};" +

                "W.stop=function(goClock){if(!W.active)return;W.active=false;" +
                "try{E.clearWatches();}catch(e){}if(global.__voxWX===W)global.__voxWX=null;global.__voxWXSession=sid+1;" +
                "if(goClock){try{g.reset().clear(1);g.flip();}catch(e){}print('VOX'+'_WX:EXIT');setTimeout(function(){load('clock.app.js');},100);}};" +
                "global.__voxWXBack=function(){W.stop(true);};" +

                "global.__voxWXFit=function(str,maxw,big){str=str||'';if(big)g.setFontGrotesk16();else g.setFontArchitekt10();" +
                "if(g.stringWidth(str)<=maxw)return str;while(str.length>1&&g.stringWidth(str+'...')>maxw)str=str.substr(0,str.length-1);return str+'...';};" +

                "global.__voxWXBase=function(){if(!W.active||W.sid!==global.__voxWXSession)return false;" +
                "g.reset().clear(1);Dickens.buttonIcons=['chart','clock','down','up'];Dickens.loadSurround();" +
                "g.setColor('#181820').fillCircleAA(119,119,91);g.setClipRect(32,29,206,205);return true;};" +

                "global.__voxWXNow=function(){if(!global.__voxWXBase())return;" +
                "g.setFontArchitekt10().setFontAlign(0,0).setColor('#DDD').drawString(global.__voxWXFit(W.place,130,false),119,40);" +
                "g.setFontGrotesk16();var cc=global.__voxWXFit(W.cond,156,true);if(g.stringWidth(cc)>156)g.setFontArchitekt10();g.setColor('#FFF').drawString(cc,119,63);" +
                "g.setColor('#E49E4C').setFontArchitekt35().drawString(W.temp+'°',119,101);" +
                "g.setFontArchitekt10();" +
                "g.setColor('#8AA').drawString('RESS',78,132).drawString('HUM',160,132);" +
                "g.setColor('#FFF').drawString(W.feels+'°',78,146).drawString(W.hum+'%',160,146);" +
                "g.setColor('#8AA').drawString('PLUIE',78,163).drawString('VENT',160,163);" +
                "g.setColor('#FFF').drawString(W.pop+'%',78,177).drawString(W.wind+' KMH',160,177);" +
                "g.setColor('#AAA').drawString('MIN '+W.min+'°     MAX '+W.max+'°',119,197);" +
                "g.setClipRect(0,0,239,239);g.flip();};" +

                "global.__voxWXGraph=function(){if(!global.__voxWXBase())return;" +
                "g.setFontArchitekt10().setFontAlign(0,0).setColor('#DDD').drawString(global.__voxWXFit(W.place,130,false),119,37);" +
                "g.setColor('#E49E4C').setFontGrotesk16().drawString('6 PROCHAINES H',119,57);" +
                "var n=W.temps.length;if(!n){g.setFontArchitekt10().setColor('#AAA').drawString('AUCUNE DONNEE',119,118);g.setClipRect(0,0,239,239);g.flip();return;}" +
                "var tmin=Math.min.apply(Math,W.temps),tmax=Math.max.apply(Math,W.temps);if(tmax<=tmin)tmax=tmin+1;" +
                "var x0=49,x1=189,yt=81,yb=140,px=0,py=0;g.setColor('#333').drawRect(x0,yt,x1,yb);" +
                "for(var i=0;i<n;i++){var x=n==1?119:x0+i*(x1-x0)/(n-1);var y=yb-(W.temps[i]-tmin)*(yb-yt)/(tmax-tmin);" +
                "if(i){g.setColor('#D7F22E').drawLine(px,py,x,y);}g.setColor('#D7F22E').fillCircle(x,y,2);px=x;py=y;}" +
                "g.setFontArchitekt10().setFontAlign(1,0).setColor('#AAA').drawString(Math.round(tmax)+'°',42,yt).drawString(Math.round(tmin)+'°',42,yb);" +
                "for(var j=0;j<n;j++){var xx=n==1?119:x0+j*(x1-x0)/(n-1);var bh=Math.round(Math.max(0,Math.min(100,W.pops[j]))*0.16);" +
                "g.setColor('#00BCEB').fillRect(xx-3,166-bh,xx+3,166);if(j==0||j==n-1||j%2==0)g.setColor('#AAA').setFontAlign(0,0).drawString(W.times[j],xx,180);}" +
                "g.setFontAlign(0,0).setColor('#D7F22E').drawString('TEMP',78,198);g.setColor('#00BCEB').drawString('PLUIE',160,198);" +
                "g.setClipRect(0,0,239,239);g.flip();};" +

                "global.__voxWXDraw=function(){if(!W.active||W.sid!==global.__voxWXSession)return;if(W.page===0)global.__voxWXNow();else global.__voxWXGraph();};" +
                "var pg=function(d){if(!W.active||W.sid!==global.__voxWXSession)return;W.page=(W.page+d+2)%2;global.__voxWXDraw();};" +
                "setWatch(function(){pg(1);},BTN1,{edge:1,repeat:1});setWatch(global.__voxWXBack,BTN2,{edge:1,repeat:1});" +
                "setWatch(function(){pg(1);},BTN3,{edge:1,repeat:1});setWatch(function(){pg(-1);},BTN4,{edge:1,repeat:1});" +
                "global.__voxWXDraw();print('VOX'+'_WX:READY074');" +
                "}catch(e){print('VOX'+'_WX:ERR:'+e);try{E.clearWatches();g.reset().clear(1);g.flip();}catch(x){}setTimeout(function(){load('clock.app.js');},1200);}})();\n";

        sendConsoleV07(js);
    }

    private void returnClock074() {
        weather074Active = false;
        lastWeatherSignature = "";
        setParentFieldV07("watchMode", "");
        if (!parentBooleanV07("consoleReady")) return;
        sendConsoleV07("try{if(global.__voxWX&&global.__voxWX.stop)global.__voxWX.stop(true);else{global.__voxWXSession=(global.__voxWXSession||0)+1;E.clearWatches();g.reset().clear(1);g.flip();setTimeout(function(){load('clock.app.js');},100);}}catch(e){setTimeout(function(){load('clock.app.js');},100);}\n");
    }

    private String weatherSignature(MainActivityV071.FixWeatherData w) {
        StringBuilder s = new StringBuilder();
        s.append(w.place).append('|').append(Math.round(w.lat * 10000)).append('|').append(Math.round(w.lon * 10000))
                .append('|').append(Math.round(w.temp)).append('|').append(Math.round(w.feels)).append('|')
                .append(Math.round(w.humidity)).append('|').append(Math.round(w.nextRainChance)).append('|')
                .append(Math.round(w.wind)).append('|').append(w.condition);
        for (MainActivityV071.FixHourPoint h : w.hours) {
            s.append('|').append(h.time).append(':').append(Math.round(h.temp)).append(':').append(Math.round(h.pop));
        }
        return s.toString();
    }

    private MainActivityV071.FixWeatherData getWx074() {
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
        return java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
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

    private TextView findTextContains074(View root, String needle) {
        if (root instanceof TextView) {
            CharSequence cs = ((TextView) root).getText();
            if (cs != null && cs.toString().contains(needle)) return (TextView) root;
        }
        if (root instanceof ViewGroup) {
            ViewGroup vg = (ViewGroup) root;
            for (int i = 0; i < vg.getChildCount(); i++) {
                TextView t = findTextContains074(vg.getChildAt(i), needle);
                if (t != null) return t;
            }
        }
        return null;
    }

    private Button findButtonContains074(View root, String needle) {
        if (root instanceof Button) {
            CharSequence cs = ((Button) root).getText();
            if (cs != null && cs.toString().contains(needle)) return (Button) root;
        }
        if (root instanceof ViewGroup) {
            ViewGroup vg = (ViewGroup) root;
            for (int i = 0; i < vg.getChildCount(); i++) {
                Button b = findButtonContains074(vg.getChildAt(i), needle);
                if (b != null) return b;
            }
        }
        return null;
    }
}
