package fr.voxterra.climate;

import fr.voxterra.geo.GeoEngine;
import fr.voxterra.geo.GeoSample;
import fr.voxterra.season.SeasonManager;

public final class ClimateEngine {
    private ClimateEngine() {}

    public static ClimateSnapshot sample(long dayTime, double x, double y, double z) {
        GeoSample geo = GeoEngine.sample(x, z);
        double lat = GeoEngine.latitude(z);
        double elevation = Math.max(0.0, y - GeoEngine.SEA_LEVEL);

        // Broad Earth-like annual mean: warm equator, cold poles, lapse rate with altitude.
        double annualMean = 27.0 - 38.0 * Math.abs(lat) - elevation * 0.0065;
        annualMean += (geo.moisture01() - 0.5) * 2.0;

        double hemisphere = lat < 0 ? -1.0 : 1.0;
        double amplitude = 3.5 + Math.abs(lat) * 17.5;
        double seasonal = SeasonManager.solarSeason(dayTime) * amplitude * hemisphere;

        // Daily cycle, warmest around mid-afternoon instead of exactly noon.
        double tod = Math.floorMod(dayTime, SeasonManager.TICKS_PER_DAY) / (double) SeasonManager.TICKS_PER_DAY;
        double diurnal = Math.sin((tod - 0.30) * Math.PI * 2.0) * (2.0 + (1.0 - geo.moisture01()) * 2.0);

        return new ClimateSnapshot(
                annualMean + seasonal + diurnal,
                annualMean,
                geo.moisture01(),
                lat,
                y,
                SeasonManager.season(dayTime),
                SeasonManager.dayOfYear(dayTime),
                SeasonManager.year(dayTime)
        );
    }
}
