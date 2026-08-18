package fr.vox.chronomarkplus;

import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Locale;

/**
 * v0.7.2: Weather+ visual redesign.
 * Music Control+ remains unchanged from the validated v0.7 implementation.
 * Watch-side Weather+ remains RAM-only.
 */
public class MainActivityV072 extends MainActivityV071 {
    private boolean weather072Active;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        patch072Ui();
    }

    private void patch072Ui() {
        View root = getWindow().getDecorView();

        TextView version = findTextContains(root, "MUSIC CONTROL+ / WEATHER+");
        if (version != null) version.setText("MUSIC CONTROL+ / METEO+ / v0.7.2");

        Button launch = findButton(root, "LANCER METEO+ / 120s");
        if (launch != null) launch.setOnClickListener(v -> launchWeather072());

        Button sync = findButton(root, "SYNCHRONISER");
        if (sync != null) sync.setOnClickListener(v -> {
            if (weather072Active) pushWeather072();
            else invokeV07("syncCurrentMode");
        });

        Button back = findButton(root, "RETOUR CADRAN");
        if (back != null) back.setOnClickListener(v -> {
            if (weather072Active) returnClock072();
            else invokeV07("returnToClock");
        });
    }

    private void launchWeather072() {
        MainActivityV071.FixWeatherData w = getWx();
        if (w == null) {
            Toast.makeText(this, "Actualise d'abord Meteo+.", Toast.LENGTH_LONG).show();
            return;
        }
        if (!parentBooleanV07("consoleReady")) {
            Toast.makeText(this, "Connecte d'abord la Chronomark.", Toast.LENGTH_LONG).show();
            return;
        }
        weather072Active = true;
        setParentFieldV07("watchMode", "weather072");
        pushWeather072();
    }

    private void pushWeather072() {
        MainActivityV071.FixWeatherData w = getWx();
        if (!weather072Active || w == null || !parentBooleanV07("consoleReady")) return;

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

        String js = "(function(){try{" +
                "try{if(global.__voxMCTimer)clearInterval(global.__voxMCTimer);if(global.__voxMCAuto)clearTimeout(global.__voxMCAuto);if(global.__voxWXAuto)clearTimeout(global.__voxWXAuto);}catch(e){}" +
                "try{E.clearWatches();}catch(e){}" +
                "var W=global.__voxWX={page:0,place:" + jsQuote(place) +
                ",temp:" + Math.round(w.temp) + ",feels:" + Math.round(w.feels) +
                ",hum:" + Math.round(w.humidity) + ",pop:" + Math.round(w.nextRainChance) +
                ",wind:" + Math.round(w.wind) + ",min:" + Math.round(w.min) + ",max:" + Math.round(w.max) +
                ",cond:" + jsQuote(cond) + ",times:" + times + ",temps:" + temps + ",pops:" + pops + "};" +

                "global.__voxWXClean=function(){try{if(global.__voxWXAuto)clearTimeout(global.__voxWXAuto);}catch(e){}try{E.clearWatches();}catch(e){}try{g.reset().clear(1);g.flip();}catch(e){}};" +
                "global.__voxWXBack=function(){global.__voxWXClean();print('VOX'+'_WX:EXIT');setTimeout(function(){load('clock.app.js');},100);};" +

                "global.__voxWXBase=function(){" +
                "g.reset().clear(1);Dickens.buttonIcons=['chart','clock','down','up'];Dickens.loadSurround();" +
                "g.setColor('#181820').fillCircleAA(119,119,95);" +
                "g.setFontArchitekt10().setFontAlign(0,0).setColor('#EEE').drawString(W.place,119,39);" +
                "};" +

                "global.__voxWXNow=function(){global.__voxWXBase();" +
                "g.setFontGrotesk16();if(g.stringWidth(W.cond)>164)g.setFontArchitekt10();g.setColor('#FFF').drawString(W.cond,119,66);" +
                "g.setColor('#E49E4C').setFontArchitekt35().drawString(W.temp+'°',119,105);" +
                "g.setFontArchitekt10();" +
                "g.setColor('#8AA').drawString('RESS',82,139).drawString('HUM',156,139);" +
                "g.setColor('#FFF').drawString(W.feels+'°',82,154).drawString(W.hum+'%',156,154);" +
                "g.setColor('#8AA').drawString('PLUIE',82,174).drawString('VENT',156,174);" +
                "g.setColor('#FFF').drawString(W.pop+'%',82,189).drawString(W.wind+' KMH',156,189);" +
                "g.setColor('#AAA').drawString('MIN '+W.min+'°   MAX '+W.max+'°',119,207);" +
                "g.flip();};" +

                "global.__voxWXGraph=function(){global.__voxWXBase();" +
                "g.setColor('#E49E4C').setFontGrotesk16().drawString('6 PROCHAINES H',119,62);" +
                "var n=W.temps.length;if(!n){g.setFontArchitekt10().setColor('#AAA').drawString('AUCUNE DONNEE',119,120);g.flip();return;}" +
                "var tmin=Math.min.apply(Math,W.temps),tmax=Math.max.apply(Math,W.temps);if(tmax<=tmin)tmax=tmin+1;" +
                "var x0=48,x1=190,yt=83,yb=145,prevX=0,prevY=0;" +
                "g.setColor('#333').drawRect(x0,yt,x1,yb);" +
                "for(var i=0;i<n;i++){var x=n==1?119:x0+i*(x1-x0)/(n-1);var y=yb-(W.temps[i]-tmin)*(yb-yt)/(tmax-tmin);" +
                "if(i){g.setColor('#FF4').drawLine(prevX,prevY,x,y);}g.setColor('#FF4').fillCircle(x,y,2);prevX=x;prevY=y;}" +
                "g.setFontArchitekt10().setFontAlign(-1,0).setColor('#AAA').drawString(Math.round(tmax)+'°',29,yt).drawString(Math.round(tmin)+'°',29,yb);" +
                "for(var j=0;j<n;j++){var xx=n==1?119:x0+j*(x1-x0)/(n-1);var bh=Math.round(Math.max(0,Math.min(100,W.pops[j]))*0.18);g.setColor('#0AF').fillRect(xx-3,171-bh,xx+3,171);" +
                "if(j==0||j==n-1||j%2==0)g.setColor('#AAA').setFontAlign(0,0).drawString(W.times[j],xx,184);}" +
                "g.setFontAlign(0,0).setColor('#FF4').drawString('TEMP',82,207);g.setColor('#0AF').drawString('PLUIE',156,207);" +
                "g.flip();};" +

                "global.__voxWXDraw=function(){if(W.page===0)global.__voxWXNow();else global.__voxWXGraph();};" +
                "var pg=function(d){W.page=(W.page+d+2)%2;global.__voxWXDraw();};" +
                "setWatch(function(){pg(1);},BTN1,{edge:1,repeat:1});" +
                "setWatch(global.__voxWXBack,BTN2,{edge:1,repeat:1});" +
                "setWatch(function(){pg(1);},BTN3,{edge:1,repeat:1});" +
                "setWatch(function(){pg(-1);},BTN4,{edge:1,repeat:1});" +
                "global.__voxWXAuto=setTimeout(global.__voxWXBack,120000);global.__voxWXDraw();print('VOX'+'_WX:READY072');" +
                "}catch(e){print('VOX'+'_WX:ERR:'+e);try{E.clearWatches();g.reset().clear(1);g.flip();}catch(x){}setTimeout(function(){load('clock.app.js');},1200);}})();\n";

        sendConsoleV07(js);
    }

    private void returnClock072() {
        weather072Active = false;
        setParentFieldV07("watchMode", "");
        if (!parentBooleanV07("consoleReady")) return;
        sendConsoleV07("try{if(global.__voxWXAuto)clearTimeout(global.__voxWXAuto);if(global.__voxMCTimer)clearInterval(global.__voxMCTimer);if(global.__voxMCAuto)clearTimeout(global.__voxMCAuto);E.clearWatches();g.reset().clear(1);g.flip();}catch(e){}setTimeout(function(){load('clock.app.js');},100);\n");
    }

    private MainActivityV071.FixWeatherData getWx() {
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

    private TextView findTextContains(View root, String needle) {
        if (root instanceof TextView) {
            CharSequence cs = ((TextView) root).getText();
            if (cs != null && cs.toString().contains(needle)) return (TextView) root;
        }
        if (root instanceof ViewGroup) {
            ViewGroup vg = (ViewGroup) root;
            for (int i = 0; i < vg.getChildCount(); i++) {
                TextView t = findTextContains(vg.getChildAt(i), needle);
                if (t != null) return t;
            }
        }
        return null;
    }

    private Button findButton(View root, String exact) {
        if (root instanceof Button && exact.contentEquals(((Button) root).getText())) return (Button) root;
        if (root instanceof ViewGroup) {
            ViewGroup vg = (ViewGroup) root;
            for (int i = 0; i < vg.getChildCount(); i++) {
                Button b = findButton(vg.getChildAt(i), exact);
                if (b != null) return b;
            }
        }
        return null;
    }
}
