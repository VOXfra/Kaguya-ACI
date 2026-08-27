package fr.voxterra.season;

public enum Season {
    SPRING("Printemps"),
    SUMMER("Été"),
    AUTUMN("Automne"),
    WINTER("Hiver");

    private final String displayName;

    Season(String displayName) {
        this.displayName = displayName;
    }

    public String displayName() {
        return displayName;
    }
}
