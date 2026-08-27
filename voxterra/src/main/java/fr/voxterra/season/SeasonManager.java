package fr.voxterra.season;

public final class SeasonManager {
    public static final int DAYS_PER_YEAR = 96;
    public static final int DAYS_PER_SEASON = DAYS_PER_YEAR / 4;
    public static final long TICKS_PER_DAY = 24000L;

    private SeasonManager() {}

    public static double yearPhase(long dayTime) {
        long day = Math.floorDiv(dayTime, TICKS_PER_DAY);
        double dayFraction = Math.floorMod(dayTime, TICKS_PER_DAY) / (double) TICKS_PER_DAY;
        return Math.floorMod(day, DAYS_PER_YEAR) / (double) DAYS_PER_YEAR + dayFraction / DAYS_PER_YEAR;
    }

    public static Season season(long dayTime) {
        int day = dayOfYear(dayTime);
        return Season.values()[Math.min(3, day / DAYS_PER_SEASON)];
    }

    public static int dayOfYear(long dayTime) {
        long day = Math.floorDiv(dayTime, TICKS_PER_DAY);
        return Math.floorMod((int) day, DAYS_PER_YEAR);
    }

    public static int year(long dayTime) {
        long day = Math.floorDiv(dayTime, TICKS_PER_DAY);
        return (int) Math.floorDiv(day, DAYS_PER_YEAR) + 1;
    }

    /** +1 at northern midsummer, -1 at northern midwinter. */
    public static double solarSeason(long dayTime) {
        double phase = yearPhase(dayTime);
        return Math.sin((phase - 0.25) * Math.PI * 2.0);
    }
}
