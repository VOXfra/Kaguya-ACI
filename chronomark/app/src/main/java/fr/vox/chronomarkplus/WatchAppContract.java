package fr.vox.chronomarkplus;

/**
 * Shared design/lifecycle contract for every NEW Chronomark+ watch application.
 *
 * Rules:
 *  - Keep critical UI inside the round-display safe area.
 *  - No automatic return to the Bethesda clock; user exits explicitly.
 *  - Every app launch owns a monotonically increasing session token.
 *  - Every delayed callback/redraw must validate its session token.
 *  - Suspend redraw callbacks left behind by clock.app.js while a RAM app owns the screen.
 *  - Exit clears watches/timers before loading the Bethesda clock.
 *  - Never write Bethesda storage from RAM prototypes.
 *
 * Music Control+ predates this contract and is intentionally frozen after validation.
 */
public final class WatchAppContract {
    private WatchAppContract() {}

    public static final int DISPLAY_SIZE = 240;

    // Deliberately conservative: the physical bezel hides noticeably more than a square 240x240 preview suggests.
    public static final int SAFE_LEFT = 36;
    public static final int SAFE_TOP = 32;
    public static final int SAFE_RIGHT = 202;
    public static final int SAFE_BOTTOM = 194;

    /**
     * clock.app.js is normally replaced through Espruino load(), which clears its app state.
     * RAM prototypes do not call load(), so the clock's minuteChanged listener and menu/notification
     * timers can survive and redraw the clock over the new app. Suspend only the clock-owned visual
     * callbacks we can identify; boot-level BLE services remain untouched.
     */
    public static String suspendBethesdaClockJs() {
        return "try{if(typeof notifyTimeout!=='undefined'&&notifyTimeout){clearTimeout(notifyTimeout);notifyTimeout=0;}}catch(e){}" +
                "try{if(typeof scroll!=='undefined'&&scroll&&scroll.timer){clearTimeout(scroll.timer);scroll.timer=0;}}catch(e){}" +
                "try{if(typeof scrollT!=='undefined'&&scrollT){clearInterval(scrollT);scrollT=0;}}catch(e){}" +
                "try{if(Dickens.sweepT){clearInterval(Dickens.sweepT);Dickens.sweepT=0;}}catch(e){}" +
                "try{if(Dickens.removeAllListeners)Dickens.removeAllListeners('minuteChanged');}catch(e){}" +
                "try{E.clearWatches();}catch(e){}";
    }

    /** Begin a RAM-only app session. appKey must be an ASCII identifier such as WX, CAL, NAV, PHONE. */
    public static String beginSessionJs(String appKey) {
        String k = sanitizeKey(appKey);
        return "global.__voxSessionSeq=(global.__voxSessionSeq||0)+1;" +
                "var __voxSid=global.__voxSessionSeq;" +
                "global.__voxActiveApp='" + k + "';";
    }

    /** JS expression true only while this launch still owns the screen. */
    public static String sessionGuardJs(String appKey) {
        String k = sanitizeKey(appKey);
        return "(__voxSid===global.__voxSessionSeq&&global.__voxActiveApp==='" + k + "')";
    }

    /**
     * Explicit exit. load(clock.app.js) is intentional: it restores Bethesda's normal app lifecycle,
     * including the clock listeners that were suspended while the RAM app owned the display.
     */
    public static String exitToClockJs() {
        return "try{E.clearWatches();}catch(e){}" +
                "global.__voxSessionSeq=(global.__voxSessionSeq||0)+1;" +
                "global.__voxActiveApp='';" +
                "try{g.reset().setClipRect(0,0,239,239).clear(1);g.flip();}catch(e){}" +
                "setTimeout(function(){load('clock.app.js');},80);";
    }

    public static String safeClipJs() {
        return "g.setClipRect(" + SAFE_LEFT + "," + SAFE_TOP + "," + SAFE_RIGHT + "," + SAFE_BOTTOM + ");";
    }

    public static String fullClipJs() {
        return "g.setClipRect(0,0,239,239);";
    }

    private static String sanitizeKey(String appKey) {
        if (appKey == null) return "APP";
        return appKey.replaceAll("[^A-Za-z0-9_]", "").toUpperCase();
    }
}
