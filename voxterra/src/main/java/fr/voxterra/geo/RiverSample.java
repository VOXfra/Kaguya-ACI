package fr.voxterra.geo;

public record RiverSample(
        boolean river,
        double mask,
        double width,
        double waterSurface,
        double bedHeight,
        double accumulation
) {
    public static final RiverSample NONE = new RiverSample(false, 0, 0, 0, 0, 0);
}
