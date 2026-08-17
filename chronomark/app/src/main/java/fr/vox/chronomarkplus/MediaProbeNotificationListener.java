package fr.vox.chronomarkplus;

import android.app.Notification;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class MediaProbeNotificationListener extends NotificationListenerService {
    public static class MediaNotice {
        public final String title;
        public final String text;
        public final String subText;
        public final boolean hasLargeIcon;

        MediaNotice(String title, String text, String subText, boolean hasLargeIcon) {
            this.title = title == null ? "" : title;
            this.text = text == null ? "" : text;
            this.subText = subText == null ? "" : subText;
            this.hasLargeIcon = hasLargeIcon;
        }
    }

    private static final Map<String, MediaNotice> notices = new ConcurrentHashMap<>();

    public static MediaNotice getNotice(String packageName) {
        if (packageName == null) return null;
        return notices.get(packageName);
    }

    @Override public void onListenerConnected() {
        super.onListenerConnected();
        StatusBarNotification[] active = getActiveNotifications();
        if (active != null) for (StatusBarNotification sbn : active) capture(sbn);
    }

    @Override public void onNotificationPosted(StatusBarNotification sbn) {
        capture(sbn);
    }

    @Override public void onNotificationRemoved(StatusBarNotification sbn) {
        if (sbn != null) notices.remove(sbn.getPackageName());
    }

    private void capture(StatusBarNotification sbn) {
        if (sbn == null || sbn.getNotification() == null) return;
        Notification n = sbn.getNotification();
        CharSequence title = n.extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence text = n.extras.getCharSequence(Notification.EXTRA_TEXT);
        CharSequence sub = n.extras.getCharSequence(Notification.EXTRA_SUB_TEXT);
        boolean hasLarge = n.getLargeIcon() != null;

        boolean mediaLike = Notification.CATEGORY_TRANSPORT.equals(n.category)
                || n.extras.getParcelable(Notification.EXTRA_MEDIA_SESSION) != null
                || hasLarge
                || !TextUtils.isEmpty(title);

        if (mediaLike) {
            notices.put(sbn.getPackageName(), new MediaNotice(
                    title == null ? "" : title.toString(),
                    text == null ? "" : text.toString(),
                    sub == null ? "" : sub.toString(),
                    hasLarge));
        }
    }
}
