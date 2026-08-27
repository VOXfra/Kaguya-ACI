package fr.voxterra.geo;

public record GeoSample(
        double baseHeight,
        double terrainHeight,
        double temperature01,
        double moisture01,
        double continentality,
        double ruggedness,
        RiverSample river
) {
    public boolean ocean() {
        return terrainHeight < GeoEngine.SEA_LEVEL - 0.5;
    }
}
