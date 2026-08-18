package fr.vox.chronomarkplus;

import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

/**
 * Chronomark+ v0.9.0
 * Focused build: Music Control+ + Phone Status / Find Phone only.
 * Weather experiments remain in history but are no longer exposed by the active UI.
 */
public class MainActivityV090 extends MainActivityV081 {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        patchFocusedUi();
    }

    private void patchFocusedUi() {
        View root = getWindow().getDecorView();

        TextView version = findContains(root, "MUSIC CONTROL+ / WEATHER / PHONE");
        if (version != null) version.setText("MUSIC CONTROL+ / PHONE STATUS / v0.9.0");

        TextView safety = findContains(root, "RAM-ONLY WATCH PROTOTYPES");
        if (safety != null) safety.setText("RAM-ONLY / MUSIC + PHONE / BETHESDA STORAGE INTACT");

        Button music = findButton(root, "LAUNCH MUSIC CONTROL+");
        if (music != null) music.setText("OUVRIR MUSIC CONTROL+");

        TextView help = findContains(root, "MUSIC: BTN1");
        if (help != null) help.setText(
                "MUSIC : BTN1 lecture/pause • BTN2 cadran • BTN3 suivant / maintien vol- • BTN4 precedent / maintien vol+\n" +
                "PHONE : BTN1 Find Phone • BTN2 cadran • BTN3/BTN4 changer de page");

        TextView phoneSection = findContains(root, "PHONE STATUS + FIND PHONE");
        if (phoneSection != null) phoneSection.setText("PHONE STATUS / FIND PHONE / RAM ONLY");

        Button phone = findButton(root, "OUVRIR PHONE STATUS");
        if (phone != null) phone.setText("OUVRIR PHONE STATUS / FIND PHONE");

        // The Android-side test button was useful during bring-up, but the feature is now
        // deliberately driven from the watch UI.
        hide(root, "TEST FIND PHONE");

        // Weather is intentionally retired from the focused product UI.
        hide(root, "WEATHER / DONNEES TELEPHONE");
        hide(root, "METEO / NON CHARGEE");
        hide(root, "Meteo actuelle live");
        hide(root, "ACTUALISER WEATHER");
        hide(root, "OUVRIR WEATHER");
    }

    private void hide(View root, String needle) {
        TextView v = findContains(root, needle);
        if (v != null) v.setVisibility(View.GONE);
    }

    private Button findButton(View root, String needle) {
        TextView v = findContains(root, needle);
        return v instanceof Button ? (Button) v : null;
    }

    private TextView findContains(View root, String needle) {
        if (root instanceof TextView) {
            CharSequence s = ((TextView) root).getText();
            if (s != null && s.toString().contains(needle)) return (TextView) root;
        }
        if (root instanceof ViewGroup) {
            ViewGroup g = (ViewGroup) root;
            for (int i = 0; i < g.getChildCount(); i++) {
                TextView found = findContains(g.getChildAt(i), needle);
                if (found != null) return found;
            }
        }
        return null;
    }
}
