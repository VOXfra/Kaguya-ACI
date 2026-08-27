package fr.voxterra.climate;

import fr.voxterra.season.Season;

public record ClimateSnapshot(
        double temperatureC,
        double annualMeanC,
        double moisture,
        double latitude,
        double elevation,
        Season season,
        int dayOfYear,
        int year
) {}
