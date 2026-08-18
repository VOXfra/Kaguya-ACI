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
 * Chronomark+ v0.8.1
 *
 * Stability/readability pass:
 * - Music Control+ remains untouched.
 * - Weather+: retired. A compact LIVE current-weather home page hands off with a real
 *   load('weather.app.js') to Bethesda's original Weather app. We no longer eval/inject
 *   the tokenized app, which could leave the display black when navigating its pages.
 * - Phone Status is simplified to fit the physical round safe area.
 * - Find Phone gets a dedicated watch page. BTN1 toggles ringing, BTN3/BTN4 navigate.
 * - No persistent watch storage writes.
 */
public class MainActivityV081 extends MainActivityV080 {
    private final Handler h081 = new Handler(Looper.getMainLooper());
    private boolean weather081Active;
    private boolean phone081Active;
    private String weather081Sig = "";
    private String phone081Sig = "";

    private final Runnable monitor081 = new Runnable() {
        @Override public void run() {
            if (weather081Active && !"weather081".equals(parentString("watchMode"))) {
                weather081Active = false;
                weather081Sig = "";
            }
            if (phone081Active && !"phone081".equals(parentString("watchMode"))) {
                phone081Active = false;
                phone081Sig = "";
            }

            if (parentBoolean("consoleReady")) {
                if (weather081Active) {
                    MainActivityV071.FixWeatherData w = getWeather081();
                    if (w != null) {
                        String s = weatherSignature(w);
                        if (!s.equals(weather081Sig)) {
                            weather081Sig = s;
                            pushWeather081(false);
                        }
                    }
                }
                if (phone081Active) {
                    MainActivityV080.PhoneSnapshot p = getPhoneSnapshot081();
                    if (p != null) {
                        String s = p.signature() + "|" + findPlaying081();
                        if (!s.equals(phone081Sig)) {
                            phone081Sig = s;
                            pushPhone081(false);
                        }
                    }
                }
            }
            h081.postDelayed(this, 2000L);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        patchUi081();
        h081.post(monitor081);
    }

    @Override
    protected void onDestroy() {
        h081.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    private void patchUi081() {
        View root = getWindow().getDecorView();

        TextView version = findTextContains081(root, "MUSIC CONTROL+ / WEATHER / PHONE");
        if (version != null) version.setText("MUSIC CONTROL+ / WEATHER / PHONE / v0.8.1");

        TextView weatherSummary = findTextContains081(root, "Accueil actuel + graphiques Bethesda");
        if (weatherSummary != null)
            weatherSummary.setText("Meteo actuelle live + ouverture native du Weather Bethesda");

        Button weather = findButtonContains081(root, "OUVRIR WEATHER");
        if (weather != null) {
            weather.setText("OUVRIR WEATHER / ACTUEL + BETHESDA");
            weather.setOnClickListener(v -> launchWeather081());
        }

        Button phone = findButtonContains081(root, "OUVRIR PHONE STATUS");
        if (phone != null) {
            phone.setText("OUVRIR PHONE STATUS / FIND PHONE");
            phone.setOnClickListener(v -> launchPhone081());
        }

        TextView phoneSection = findTextContains081(root, "PHONE STATUS + FIND PHONE / RAM ONLY");
        if (phoneSection != null) phoneSection.setText("PHONE STATUS + FIND PHONE / WATCH PROTOTYPE");
    }

    // ------------------------------------------------------------------
    // Weather: compact live home -> real native Bethesda load
    // ------------------------------------------------------------------

    private void launchWeather081() {
        MainActivityV071.FixWeatherData w = getWeather081();
        if (w == null) {
            Toast.makeText(this, "Actualise d'abord Weather avec la position du telephone.", Toast.LENGTH_LONG).show();
            Button fetch = findButtonContains081(getWindow().getDecorView(), "ACTUALISER WEATHER");
            if (fetch != null) fetch.performClick();
            return;
        }
        if (!parentBoolean("consoleReady")) {
            Toast.makeText(this, "Connecte d'abord la Chronomark.", Toast.LENGTH_LONG).show();
            return;
        }
        phone081Active = false;
        weather081Active = true;
        weather081Sig = weatherSignature(w);
        setParentField("watchMode", "weather081");
        pushWeather081(true);
    }

    private void pushWeather081(boolean full) {
        if (!weather081Active || !parentBoolean("consoleReady")) return;
        MainActivityV071.FixWeatherData w = getWeather081();
        if (w == null) return;

        String place = trim081(ascii081(w.place).toUpperCase(Locale.ROOT), 14);
        String cond = trim081(ascii081(w.condition).toUpperCase(Locale.ROOT), 25);

        if (!full) {
            sendConsole081("(function(){var W=global.__voxWx081;if(!W||global.__voxActiveApp!=='WX081')return;" +
                    "W.place=" + jsQuote081(place) + ";W.temp=" + Math.round(w.temp) +
                    ";W.cond=" + jsQuote081(cond) + ";W.feels=" + Math.round(w.feels) +
                    ";W.rain=" + Math.round(w.nextRainChance) + ";if(global.__voxWx081Draw)global.__voxWx081Draw();})();\n");
            return;
        }

        String js = "(function(){try{" + WatchAppContract.suspendBethesdaClockJs() + WatchAppContract.beginSessionJs("WX081") +
                "var W=global.__voxWx081={place:" + jsQuote081(place) + ",temp:" + Math.round(w.temp) +
                ",cond:" + jsQuote081(cond) + ",feels:" + Math.round(w.feels) + ",rain:" + Math.round(w.nextRainChance) + "};" +
                "global.__voxWx081Draw=function(){if(global.__voxActiveApp!=='WX081')return;" +
                "g.reset().setClipRect(0,0,239,239).clear(1);Dickens.buttonIcons=['chart','clock',null,null];Dickens.loadSurround();" +
                "g.setColor('#181820').fillCircleAA(119,119,92);g.setClipRect(40,34,198,190);" +
                "g.setFontArchitekt10().setFontAlign(0,0).setColor('#BFC8CC').drawString(W.place,119,45);" +
                "g.setColor('#E49E4C').setFontArchitekt35().drawString(W.temp+'°',119,88);" +
                "g.setColor('#FFF').setFontGrotesk14();var c=W.cond;while(c.length>1&&g.stringWidth(c)>146)c=c.substr(0,c.length-1);g.drawString(c,119,121);" +
                "g.setFontArchitekt10().setColor('#91A0A5').drawString('RESSENTI '+W.feels+'°',119,148);" +
                "g.setColor('#00BCEB').drawString('PLUIE '+W.rain+'%',119,166);" +
                "g.setColor('#AAB2B5').drawString('BTN1  DETAILS',119,184);g.setClipRect(0,0,239,239);g.flip();};" +
                "setWatch(function(){print('VOX'+'_V08:WEATHER_NATIVE081');},BTN1,{edge:1,repeat:1});" +
                "setWatch(function(){print('VOX'+'_V08:WEATHER_EXIT081');load('clock.app.js');},BTN2,{edge:1,repeat:1});" +
                "setWatch(function(){print('VOX'+'_V08:WEATHER_SYNC081');},BTN3,{edge:1,repeat:1});" +
                "global.__voxWx081Draw();print('VOX'+'_V08:WEATHER_READY081');" +
                "}catch(e){print('VOX'+'_V08:WEATHER_ERR081:'+e);load('clock.app.js');}})();\n";
        sendConsole081(js);
        setWatchStatus081("WATCH / WEATHER ACTUEL / RAM ONLY");
    }

    private void openNativeBethesdaWeather081() {
        weather081Active = false;
        weather081Sig = "";
        setParentField("watchMode", "weatherNative");
        // Important: use the exact normal app lifecycle. No eval, no loadWeather override,
        // no tokenized-source injection. This is deliberately the stable Bethesda path.
        sendConsole081("try{E.clearWatches();global.__voxSessionSeq=(global.__voxSessionSeq||0)+1;global.__voxActiveApp='';" +
                "g.reset().setClipRect(0,0,239,239).clear(1);g.flip();}catch(e){}" +
                "setTimeout(function(){load('weather.app.js');},80);\n");
        setWatchStatus081("WATCH / WEATHER BETHESDA NATIF");
    }

    // ------------------------------------------------------------------
    // Phone Status + dedicated Find Phone page
    // ------------------------------------------------------------------

    private void launchPhone081() {
        if (!parentBoolean("consoleReady")) {
            Toast.makeText(this, "Connecte d'abord la Chronomark.", Toast.LENGTH_LONG).show();
            return;
        }
        weather081Active = false;
        phone081Active = true;
        setParentField("watchMode", "phone081");
        MainActivityV080.PhoneSnapshot p = getPhoneSnapshot081();
        if (p == null) return;
        phone081Sig = p.signature() + "|" + findPlaying081();
        pushPhone081(true);
    }

    private void pushPhone081(boolean full) {
        if (!phone081Active || !parentBoolean("consoleReady")) return;
        MainActivityV080.PhoneSnapshot p = getPhoneSnapshot081();
        if (p == null) return;

        String model = ascii081(p.model).toUpperCase(Locale.ROOT).replace("GOOGLE ", "").trim();
        model = trim081(model, 16);
        String charge = p.charging ? (p.full ? "CHARGE COMPLETE" : "EN CHARGE" + (p.plug.isEmpty() ? "" : " " + p.plug)) : "SUR BATTERIE";
        boolean finding = findPlaying081();

        if (!full) {
            sendConsole081("(function(){var P=global.__voxPhone081;if(!P||global.__voxActiveApp!=='PHONE081')return;" +
                    "P.batt=" + p.battery + ";P.charge=" + jsQuote081(charge) + ";P.net=" + jsQuote081(p.network) +
                    ";P.ring=" + jsQuote081(p.ringer) + ";P.model=" + jsQuote081(model) + ";P.find=" + (finding ? "true" : "false") +
                    ";if(global.__voxPhone081Draw)global.__voxPhone081Draw();})();\n");
            return;
        }

        String js = "(function(){try{" + WatchAppContract.suspendBethesdaClockJs() + WatchAppContract.beginSessionJs("PHONE081") +
                "var P=global.__voxPhone081={page:0,batt:" + p.battery + ",charge:" + jsQuote081(charge) +
                ",net:" + jsQuote081(p.network) + ",ring:" + jsQuote081(p.ringer) + ",model:" + jsQuote081(model) +
                ",find:" + (finding ? "true" : "false") + "};" +
                "global.__voxPhone081Base=function(){if(global.__voxActiveApp!=='PHONE081')return false;" +
                "g.reset().setClipRect(0,0,239,239).clear(1);Dickens.buttonIcons=[null,'clock','down','up'];Dickens.loadSurround();" +
                "g.setColor('#181820').fillCircleAA(119,119,92);g.setClipRect(40,34,198,190);return true;};" +
                "global.__voxPhone081Status=function(){if(!global.__voxPhone081Base())return;" +
                "g.setFontArchitekt10().setFontAlign(0,0).setColor('#BFC8CC').drawString('PHONE STATUS',119,43);" +
                "g.setColor(P.batt<=20?'#E04B3F':'#E49E4C').setFontArchitekt35().drawString(P.batt+'%',119,78);" +
                "var bw=112,bx=63;g.setColor('#3A4144').fillRect(bx,103,bx+bw,111);g.setColor(P.batt<=20?'#E04B3F':'#78C6BE').fillRect(bx,103,bx+bw*P.batt/100,111);" +
                "g.setFontArchitekt10().setColor('#FFF').drawString(P.charge,119,126);" +
                "g.setColor('#8FA1A7').drawString('RESEAU',78,145).drawString('SON',160,145);" +
                "g.setColor('#FFF').drawString(P.net,78,159).drawString(P.ring,160,159);" +
                "g.setColor('#9BA4A7').drawString(P.model,119,177);" +
                "g.setColor('#00BCEB').drawString('BTN1  FIND PHONE',119,189);g.setClipRect(0,0,239,239);g.flip();};" +
                "global.__voxPhone081Find=function(){if(!global.__voxPhone081Base())return;" +
                "g.setFontArchitekt10().setFontAlign(0,0).setColor('#BFC8CC').drawString('FIND PHONE',119,45);" +
                "g.setColor(P.find?'#E49E4C':'#78C6BE').drawRect(102,70,136,126).drawRect(105,74,133,118).fillCircle(119,122,2);" +
                "g.setFontGrotesk14().setColor(P.find?'#E49E4C':'#FFF').drawString(P.find?'TELEPHONE SONNE':'PRET A SONNER',119,145);" +
                "g.setFontArchitekt10().setColor('#00BCEB').drawString(P.find?'BTN1  ARRETER':'BTN1  SONNER',119,165);" +
                "g.setColor('#9BA4A7').drawString('BTN3 / BTN4  STATUS',119,184);g.setClipRect(0,0,239,239);g.flip();};" +
                "global.__voxPhone081Draw=function(){if(P.page===0)global.__voxPhone081Status();else global.__voxPhone081Find();};" +
                "var page=function(d){P.page=(P.page+d+2)%2;global.__voxPhone081Draw();};" +
                "setWatch(function(){if(P.page===0){P.page=1;global.__voxPhone081Draw();}print('VOX'+'_V08:FIND081');},BTN1,{edge:1,repeat:1});" +
                "setWatch(function(){print('VOX'+'_V08:PHONE_EXIT081');load('clock.app.js');},BTN2,{edge:1,repeat:1});" +
                "setWatch(function(){page(1);},BTN3,{edge:1,repeat:1});setWatch(function(){page(-1);},BTN4,{edge:1,repeat:1});" +
                "global.__voxPhone081Draw();print('VOX'+'_V08:PHONE_READY081');" +
                "}catch(e){print('VOX'+'_V08:PHONE_ERR081:'+e);load('clock.app.js');}})();\n";
        sendConsole081(js);
        setWatchStatus081("WATCH / PHONE STATUS + FIND / RAM ONLY");
    }

    @Override
    protected void onV08WatchLine(String line) {
        if (line == null) return;
        if (line.contains("VOX_V08:WEATHER_NATIVE081")) {
            runOnUiThread(this::openNativeBethesdaWeather081);
            return;
        }
        if (line.contains("VOX_V08:WEATHER_SYNC081")) {
            runOnUiThread(() -> { if (weather081Active) pushWeather081(false); });
            return;
        }
        if (line.contains("VOX_V08:WEATHER_EXIT081")) {
            runOnUiThread(() -> {
                weather081Active = false;
                weather081Sig = "";
                setParentField("watchMode", "");
                setWatchStatus081("WATCH / BETHESDA CLOCK");
            });
            return;
        }
        if (line.contains("VOX_V08:FIND081")) {
            // Reuse the already validated Android alarm/vibration implementation from v0.8.0.
            super.onV08WatchLine("VOX_V08:FIND");
            h081.postDelayed(() -> { if (phone081Active) pushPhone081(false); }, 120L);
            return;
        }
        if (line.contains("VOX_V08:PHONE_EXIT081")) {
            runOnUiThread(() -> {
                phone081Active = false;
                phone081Sig = "";
                setParentField("watchMode", "");
                setWatchStatus081("WATCH / BETHESDA CLOCK");
            });
            return;
        }
        if (line.contains("VOX_V08:PHONE_READY081")) {
            runOnUiThread(() -> setWatchStatus081("WATCH / PHONE STATUS + FIND / RAM ONLY"));
            return;
        }
        // Keep every validated v0.8 behavior (including Android test Find Phone) intact.
        super.onV08WatchLine(line);
    }

    // ------------------------------------------------------------------
    // Reflection helpers into the validated layers
    // ------------------------------------------------------------------

    private MainActivityV071.FixWeatherData getWeather081() {
        try {
            Field f = MainActivityV071.class.getDeclaredField("wx");
            f.setAccessible(true);
            return (MainActivityV071.FixWeatherData) f.get(this);
        } catch (Exception e) { return null; }
    }

    private MainActivityV080.PhoneSnapshot getPhoneSnapshot081() {
        try {
            Method m = MainActivityV080.class.getDeclaredMethod("readPhoneSnapshot");
            m.setAccessible(true);
            return (MainActivityV080.PhoneSnapshot) m.invoke(this);
        } catch (Exception e) { return null; }
    }

    private boolean findPlaying081() {
        try {
            Field f = MainActivityV080.class.getDeclaredField("findPlaying");
            f.setAccessible(true);
            return f.getBoolean(this);
        } catch (Exception e) { return false; }
    }

    private boolean parentBoolean(String name) {
        try {
            Field f = MainActivityV07.class.getDeclaredField(name);
            f.setAccessible(true);
            return f.getBoolean(this);
        } catch (Exception e) { return false; }
    }

    private String parentString(String name) {
        try {
            Field f = MainActivityV07.class.getDeclaredField(name);
            f.setAccessible(true);
            Object v = f.get(this);
            return v == null ? "" : v.toString();
        } catch (Exception e) { return ""; }
    }

    private void setParentField(String name, Object value) {
        try {
            Field f = MainActivityV07.class.getDeclaredField(name);
            f.setAccessible(true);
            f.set(this, value);
        } catch (Exception ignored) {}
    }

    private void sendConsole081(String text) {
        try {
            Method m = MainActivityV07.class.getDeclaredMethod("sendConsole", String.class);
            m.setAccessible(true);
            m.invoke(this, text);
        } catch (Exception e) {
            Toast.makeText(this, "Erreur pont Chronomark: " + e.getClass().getSimpleName(), Toast.LENGTH_LONG).show();
        }
    }

    private void setWatchStatus081(String text) {
        try {
            Field f = MainActivityV07.class.getDeclaredField("watchStatus");
            f.setAccessible(true);
            TextView t = (TextView) f.get(this);
            if (t != null) t.setText(text);
        } catch (Exception ignored) {}
    }

    private String weatherSignature(MainActivityV071.FixWeatherData w) {
        return w.place + "|" + Math.round(w.temp) + "|" + Math.round(w.feels) + "|" + Math.round(w.nextRainChance) + "|" + w.condition;
    }

    private String ascii081(String s) {
        if (s == null) return "";
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "")
                .replace('’', '\'').replace('–', '-').replace('—', '-');
    }

    private String trim081(String s, int max) {
        if (s == null) return "";
        s = s.replace('\n', ' ').replace('\r', ' ').trim();
        return s.length() <= max ? s : s.substring(0, max);
    }

    private String jsQuote081(String s) {
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

    private TextView findTextContains081(View root, String needle) {
        if (root instanceof TextView) {
            CharSequence t = ((TextView) root).getText();
            if (t != null && t.toString().contains(needle)) return (TextView) root;
        }
        if (root instanceof ViewGroup) {
            ViewGroup g = (ViewGroup) root;
            for (int i = 0; i < g.getChildCount(); i++) {
                TextView found = findTextContains081(g.getChildAt(i), needle);
                if (found != null) return found;
            }
        }
        return null;
    }

    private Button findButtonContains081(View root, String needle) {
        TextView t = findTextContains081(root, needle);
        return t instanceof Button ? (Button) t : null;
    }
}
