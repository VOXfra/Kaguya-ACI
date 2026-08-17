package fr.vox.chronomarkplus;

import android.app.Activity;
import android.app.Notification;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.text.TextUtils;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());

    private MediaSessionManager mediaSessionManager;
    private ComponentName listenerComponent;

    private TextView accessState;
    private TextView sessionTitle;
    private TextView appName;
    private TextView mediaTitle;
    private TextView mediaSubtitle;
    private TextView mediaTime;
    private TextView capabilityText;
    private TextView rawLog;
    private ImageView artwork;
    private Button accessButton;
    private Button refreshButton;

    private boolean running;

    private final Runnable ticker = new Runnable() {
        @Override public void run() {
            if (!running) return;
            refreshMedia(false);
            handler.postDelayed(this, 1000);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mediaSessionManager = (MediaSessionManager) getSystemService(MEDIA_SESSION_SERVICE);
        listenerComponent = new ComponentName(this, MediaProbeNotificationListener.class);
        buildUi();
        refreshMedia(true);
    }

    @Override protected void onResume() {
        super.onResume();
        running = true;
        handler.removeCallbacks(ticker);
        handler.post(ticker);
    }

    @Override protected void onPause() {
        running = false;
        handler.removeCallbacks(ticker);
        super.onPause();
    }

    private void buildUi() {
        ScrollView outer = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(18), dp(18), dp(24));
        root.setBackgroundColor(Color.rgb(15, 19, 22));
        outer.addView(root);

        TextView title = text("CHRONOMARK+", 30, Color.rgb(240,231,205));
        title.setLetterSpacing(0.08f);
        root.addView(title);

        TextView sub = text("MEDIA CONTROL+ PROBE / v0.5.0", 13, Color.rgb(211,71,54));
        sub.setPadding(0,0,0,dp(12));
        root.addView(sub);

        TextView safety = text("PHONE-SIDE MEDIA DIAGNOSTIC / WATCH STORAGE UNTOUCHED", 11, Color.rgb(122,198,190));
        safety.setPadding(dp(10),dp(10),dp(10),dp(10));
        safety.setBackgroundColor(Color.rgb(27,34,38));
        root.addView(safety, lp(-1, -2));

        root.addView(label("ANDROID MEDIA ACCESS"));

        accessState = text("CHECKING...", 13, Color.WHITE);
        accessState.setPadding(dp(10),dp(8),dp(10),dp(8));
        root.addView(accessState, lp(-1,-2));

        LinearLayout accessRow = new LinearLayout(this);
        accessRow.setOrientation(LinearLayout.HORIZONTAL);
        accessButton = button("ENABLE MEDIA ACCESS");
        refreshButton = button("REFRESH");
        accessButton.setOnClickListener(v -> {
            try {
                startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
            } catch (Exception e) {
                Toast.makeText(this, "Impossible d'ouvrir les parametres d'acces aux notifications.", Toast.LENGTH_LONG).show();
            }
        });
        refreshButton.setOnClickListener(v -> refreshMedia(true));
        accessRow.addView(accessButton, new LinearLayout.LayoutParams(0, dp(48), 1.4f));
        accessRow.addView(refreshButton, new LinearLayout.LayoutParams(0, dp(48), .7f));
        root.addView(accessRow);

        root.addView(label("PRIMARY MEDIA SESSION"));

        artwork = new ImageView(this);
        artwork.setAdjustViewBounds(true);
        artwork.setScaleType(ImageView.ScaleType.CENTER_CROP);
        artwork.setBackgroundColor(Color.rgb(7,10,12));
        root.addView(artwork, new LinearLayout.LayoutParams(-1, dp(240)));

        sessionTitle = text("NO ACTIVE SESSION", 12, Color.rgb(122,198,190));
        sessionTitle.setPadding(0,dp(10),0,0);
        root.addView(sessionTitle);

        appName = text("-", 12, Color.rgb(164,169,167));
        root.addView(appName);

        mediaTitle = text("-", 20, Color.rgb(240,231,205));
        mediaTitle.setPadding(0,dp(8),0,0);
        root.addView(mediaTitle);

        mediaSubtitle = text("-", 14, Color.rgb(228,158,76));
        root.addView(mediaSubtitle);

        mediaTime = text("00:00 / 00:00", 16, Color.WHITE);
        mediaTime.setPadding(0,dp(8),0,0);
        root.addView(mediaTime);

        capabilityText = text("ARTWORK / UNKNOWN", 12, Color.rgb(164,169,167));
        capabilityText.setPadding(0,dp(8),0,dp(8));
        root.addView(capabilityText);

        root.addView(label("RAW MEDIA SURVEY"));

        rawLog = text("", 10, Color.rgb(219,219,210));
        rawLog.setTypeface(android.graphics.Typeface.MONOSPACE);
        rawLog.setPadding(dp(10),dp(10),dp(10),dp(10));
        rawLog.setBackgroundColor(Color.rgb(7,10,12));
        rawLog.setTextIsSelectable(true);
        root.addView(rawLog, lp(-1, dp(360)));

        TextView footer = text("Goal: verify YouTube / TIDAL / Spotify metadata and artwork before sending anything to the Chronomark.", 11, Color.rgb(164,169,167));
        footer.setPadding(0,dp(10),0,0);
        root.addView(footer);

        setContentView(outer);
    }

    private void refreshMedia(boolean verbose) {
        boolean access = isNotificationListenerEnabled();
        accessState.setText(access ? "ACCESS / ENABLED / MEDIA SESSIONS AVAILABLE" : "ACCESS / REQUIRED / ENABLE CHRONOMARK+ IN NOTIFICATION ACCESS");
        accessState.setTextColor(access ? Color.rgb(122,198,190) : Color.rgb(228,158,76));
        accessButton.setText(access ? "MEDIA ACCESS ENABLED" : "ENABLE MEDIA ACCESS");

        if (!access || mediaSessionManager == null) {
            showNoSession("Notification access is required.");
            if (verbose) rawLog.setText("Grant Notification Access to Chronomark+, then return here.\nAndroid uses this permission to let the app inspect active media sessions.");
            return;
        }

        List<MediaController> controllers;
        try {
            controllers = mediaSessionManager.getActiveSessions(listenerComponent);
        } catch (SecurityException e) {
            showNoSession("Android denied active session access.");
            rawLog.setText("SECURITY EXCEPTION\n" + e);
            return;
        } catch (Exception e) {
            showNoSession("MediaSessionManager error.");
            rawLog.setText("ERROR\n" + e);
            return;
        }

        if (controllers == null || controllers.isEmpty()) {
            showNoSession("No active MediaSession.");
            rawLog.setText("MEDIA SESSION COUNT: 0\n\nStart playback in YouTube, TIDAL, Spotify, etc., then tap REFRESH.");
            return;
        }

        MediaController primary = choosePrimary(controllers);
        renderPrimary(primary);

        StringBuilder out = new StringBuilder();
        out.append("CHRONOMARK+ v0.5.0 / MEDIA PROBE\n");
        out.append("SESSION COUNT: ").append(controllers.size()).append("\n\n");
        int i = 0;
        for (MediaController c : controllers) {
            MediaMetadata md = c.getMetadata();
            PlaybackState ps = c.getPlaybackState();
            String pkg = c.getPackageName();
            MediaProbeNotificationListener.MediaNotice notice = MediaProbeNotificationListener.getNotice(pkg);

            out.append("--- SESSION ").append(++i).append(" ---\n");
            out.append("PACKAGE: ").append(pkg).append("\n");
            out.append("APP: ").append(getAppLabel(pkg)).append("\n");
            out.append("STATE: ").append(stateName(ps)).append("\n");
            out.append("POSITION: ").append(formatTime(estimatePosition(ps))).append("\n");
            if (md != null) {
                out.append("TITLE: ").append(value(md, MediaMetadata.METADATA_KEY_TITLE, MediaMetadata.METADATA_KEY_DISPLAY_TITLE)).append("\n");
                out.append("ARTIST: ").append(value(md, MediaMetadata.METADATA_KEY_ARTIST, MediaMetadata.METADATA_KEY_ALBUM_ARTIST, MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE)).append("\n");
                out.append("ALBUM: ").append(value(md, MediaMetadata.METADATA_KEY_ALBUM)).append("\n");
                out.append("DURATION: ").append(formatTime(md.getLong(MediaMetadata.METADATA_KEY_DURATION))).append("\n");
                out.append("MEDIA_ID: ").append(value(md, MediaMetadata.METADATA_KEY_MEDIA_ID)).append("\n");
                out.append("DISPLAY_DESC: ").append(value(md, MediaMetadata.METADATA_KEY_DISPLAY_DESCRIPTION)).append("\n");
                out.append("ART_BITMAP: ").append(getArtwork(md) != null ? "YES" : "NO").append("\n");
                out.append("ART_URI: ").append(firstNonEmpty(md.getString(MediaMetadata.METADATA_KEY_ART_URI), md.getString(MediaMetadata.METADATA_KEY_ALBUM_ART_URI), md.getString(MediaMetadata.METADATA_KEY_DISPLAY_ICON_URI))).append("\n");
            } else {
                out.append("METADATA: NONE\n");
            }
            if (notice != null) {
                out.append("NOTIFICATION_TITLE: ").append(notice.title).append("\n");
                out.append("NOTIFICATION_TEXT: ").append(notice.text).append("\n");
                out.append("NOTIFICATION_SUBTEXT: ").append(notice.subText).append("\n");
                out.append("NOTIFICATION_LARGE_ICON: ").append(notice.hasLargeIcon ? "YES" : "NO").append("\n");
            } else {
                out.append("NOTIFICATION_SNAPSHOT: NONE\n");
            }
            out.append("\n");
        }
        rawLog.setText(out.toString());
    }

    private MediaController choosePrimary(List<MediaController> list) {
        for (MediaController c : list) {
            PlaybackState s = c.getPlaybackState();
            if (s != null && s.getState() == PlaybackState.STATE_PLAYING) return c;
        }
        return list.get(0);
    }

    private void renderPrimary(MediaController c) {
        MediaMetadata md = c.getMetadata();
        PlaybackState ps = c.getPlaybackState();
        String pkg = c.getPackageName();
        String label = getAppLabel(pkg);

        sessionTitle.setText("ACTIVE / " + stateName(ps));
        appName.setText(label + " / " + pkg);

        String title = md == null ? "" : value(md, MediaMetadata.METADATA_KEY_TITLE, MediaMetadata.METADATA_KEY_DISPLAY_TITLE);
        String subtitle = md == null ? "" : value(md, MediaMetadata.METADATA_KEY_ARTIST, MediaMetadata.METADATA_KEY_ALBUM_ARTIST, MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE, MediaMetadata.METADATA_KEY_DISPLAY_DESCRIPTION);
        if (TextUtils.isEmpty(title)) {
            MediaProbeNotificationListener.MediaNotice n = MediaProbeNotificationListener.getNotice(pkg);
            if (n != null) {
                title = n.title;
                if (TextUtils.isEmpty(subtitle)) subtitle = firstNonEmpty(n.text, n.subText);
            }
        }
        mediaTitle.setText(TextUtils.isEmpty(title) ? "UNTITLED MEDIA" : title);
        mediaSubtitle.setText(TextUtils.isEmpty(subtitle) ? "-" : subtitle);

        long pos = estimatePosition(ps);
        long dur = md == null ? 0 : md.getLong(MediaMetadata.METADATA_KEY_DURATION);
        mediaTime.setText(formatTime(pos) + " / " + formatTime(dur));

        Bitmap b = md == null ? null : getArtwork(md);
        if (b != null) artwork.setImageBitmap(b); else artwork.setImageDrawable(null);

        MediaProbeNotificationListener.MediaNotice notice = MediaProbeNotificationListener.getNotice(pkg);
        boolean notifArt = notice != null && notice.hasLargeIcon;
        String uri = md == null ? "" : firstNonEmpty(md.getString(MediaMetadata.METADATA_KEY_ART_URI), md.getString(MediaMetadata.METADATA_KEY_ALBUM_ART_URI), md.getString(MediaMetadata.METADATA_KEY_DISPLAY_ICON_URI));
        capabilityText.setText("ARTWORK / METADATA BITMAP: " + (b != null ? "YES" : "NO") + " / URI: " + (!TextUtils.isEmpty(uri) ? "YES" : "NO") + " / NOTIFICATION ICON: " + (notifArt ? "YES" : "NO"));
    }

    private Bitmap getArtwork(MediaMetadata md) {
        Bitmap b = md.getBitmap(MediaMetadata.METADATA_KEY_ART);
        if (b == null) b = md.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);
        if (b == null) b = md.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON);
        return b;
    }

    private long estimatePosition(PlaybackState s) {
        if (s == null) return 0;
        long p = Math.max(0, s.getPosition());
        if (s.getState() == PlaybackState.STATE_PLAYING && s.getLastPositionUpdateTime() > 0) {
            long dt = Math.max(0, SystemClock.elapsedRealtime() - s.getLastPositionUpdateTime());
            p += (long) (dt * s.getPlaybackSpeed());
        }
        return Math.max(0, p);
    }

    private String stateName(PlaybackState s) {
        if (s == null) return "UNKNOWN";
        switch (s.getState()) {
            case PlaybackState.STATE_PLAYING: return "PLAYING";
            case PlaybackState.STATE_PAUSED: return "PAUSED";
            case PlaybackState.STATE_BUFFERING: return "BUFFERING";
            case PlaybackState.STATE_STOPPED: return "STOPPED";
            case PlaybackState.STATE_CONNECTING: return "CONNECTING";
            case PlaybackState.STATE_SKIPPING_TO_NEXT: return "SKIP NEXT";
            case PlaybackState.STATE_SKIPPING_TO_PREVIOUS: return "SKIP PREVIOUS";
            case PlaybackState.STATE_FAST_FORWARDING: return "FAST FORWARD";
            case PlaybackState.STATE_REWINDING: return "REWIND";
            case PlaybackState.STATE_ERROR: return "ERROR";
            case PlaybackState.STATE_NONE:
            default: return "NONE";
        }
    }

    private String value(MediaMetadata md, String... keys) {
        if (md == null) return "";
        for (String k : keys) {
            CharSequence t = md.getText(k);
            if (t != null && t.length() > 0) return t.toString();
            String s = md.getString(k);
            if (!TextUtils.isEmpty(s)) return s;
        }
        return "";
    }

    private String firstNonEmpty(String... values) {
        for (String s : values) if (!TextUtils.isEmpty(s)) return s;
        return "";
    }

    private String getAppLabel(String pkg) {
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
            CharSequence label = pm.getApplicationLabel(ai);
            return label == null ? pkg : label.toString();
        } catch (Exception e) {
            return pkg;
        }
    }

    private boolean isNotificationListenerEnabled() {
        try {
            String flat = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
            return flat != null && flat.contains(getPackageName());
        } catch (Exception e) {
            return false;
        }
    }

    private void showNoSession(String reason) {
        sessionTitle.setText("NO ACTIVE MEDIA SESSION");
        appName.setText(reason);
        mediaTitle.setText("-");
        mediaSubtitle.setText("-");
        mediaTime.setText("00:00 / 00:00");
        capabilityText.setText("ARTWORK / UNKNOWN");
        artwork.setImageDrawable(null);
    }

    private String formatTime(long ms) {
        if (ms <= 0) return "00:00";
        long total = ms / 1000;
        long h = total / 3600;
        long m = (total % 3600) / 60;
        long s = total % 60;
        if (h > 0) return String.format(Locale.ROOT, "%d:%02d:%02d", h, m, s);
        return String.format(Locale.ROOT, "%02d:%02d", m, s);
    }

    private TextView label(String s) {
        TextView t = text(s, 11, Color.rgb(164,169,167));
        t.setPadding(0,dp(14),0,dp(5));
        return t;
    }

    private TextView text(String s, int size, int color) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(size);
        t.setTextColor(color);
        return t;
    }

    private Button button(String s) {
        Button b = new Button(this);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextSize(10);
        return b;
    }

    private LinearLayout.LayoutParams lp(int w, int h) {
        return new LinearLayout.LayoutParams(w,h);
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
