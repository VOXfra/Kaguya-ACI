package fr.vox.chronomarkplus;

/**
 * Shared design/lifecycle contract for every NEW Chronomark+ watch application.
 *
 * Rules:
 *  - Keep critical UI inside the round-display safe area.
 *  - No automatic return to the Bethesda clock; user exits explicitly.
 *  - Every app launch owns a monotonically increasing session token.
 *  - Every delayed callback/redraw must validate its session token.
 *  - Exit clears watches/timers before loading the Bethesda clock.
 *  - Never write Bethesda storage from RAM prototypes.
 *
 * Music Control+ predates this contract and is intentionally frozen after validation.
 */
public final class WatchAppContract {
    private WatchAppContract() {}

    public static final int DISPLAY_SIZE = 240;

    // Conservative content box inside the Chronomark's actually readable circular area.
    public static final int SAFE_LEFT = 32;
    public static final int SAFE_TOP = 29;
    public static final int SAFE_RIGHT = 206;
    public static final int SAFE_BOTTOM = 205;

    /**
     * JS preamble for a new RAM-only app session.
     * appKey must be an ASCII identifier such as WX, CAL, NAV, PHONE.
     */
    public static String beginSessionJs(String appKey) {
        String k = sanitizeKey(appKey);
        return "try{E.clearWatches();}catch(e){}" +
                "global.__voxSessionSeq=(global.__voxSessionSeq||0)+1;" +
                "var __voxSid=global.__voxSessionSeq;" +
                "global.__voxActiveApp='" + k + "';";
    }

    /** JS expression that is true only while this app launch still owns the screen. */
    public static String sessionGuardJs(String appKey) {
        String k = sanitizeKey(appKey);
        return "(__voxSid===global.__voxSessionSeq&&global.__voxActiveApp==='" + k + "')";
    }

    /**
     * Common explicit-exit code. Clears app-owned interaction state before returning
     * to Bethesda's clock. No timeout is created here.
     */
    public static String exitToClockJs() {
        return "try{E.clearWatches();}catch(e){}" +
                "global.__voxSessionSeq=(global.__voxSessionSeq||0)+1;" +
                "global.__voxActiveApp='';" +
                "try{g.reset().setClipRect(0,0,239,239).clear(1);g.flip();}catch(e){}" +
                "setTimeout(function(){load('clock.app.js');},100);";
    }

    /** Apply the shared conservative safe clipping box. */
    public static String safeClipJs() {
        return "g.setClipRect(" + SAFE_LEFT + "," + SAFE_TOP + "," + SAFE_RIGHT + "," + SAFE_BOTTOM + ");";
    }

    /** Restore full-screen clipping before Dickens surround/flip/exit operations. */
    public static String fullClipJs() {
        return "g.setClipRect(0,0,239,239);";
    }

    private static String sanitizeKey(String appKey) {
        if (appKey == null) return "APP";
        return appKey.replaceAll("[^A-Za-z0-9_]", "").toUpperCase();
    }
}
