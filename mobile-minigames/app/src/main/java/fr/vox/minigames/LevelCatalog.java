package fr.vox.minigames;

/** Niveaux v0.1 pré-générés depuis des états résolus afin de garantir une solution connue. */
public final class LevelCatalog {
    private LevelCatalog() {}

    private static final int[][][] LEVELS = new int[][][]{
            new int[][]{new int[]{0,0,0,1},new int[]{1,0},new int[]{2,2,1},new int[]{},new int[]{2,2,1}},
            new int[][]{new int[]{},new int[]{1,2,0},new int[]{0},new int[]{1,1,1,2},new int[]{2,2,0,0}},
            new int[][]{new int[]{0,2,0,2},new int[]{},new int[]{2,1,1,0},new int[]{},new int[]{1,1,0,2}},
            new int[][]{new int[]{0,0,0,1},new int[]{},new int[]{2,1},new int[]{2,1,2},new int[]{0,1,2}},
            new int[][]{new int[]{0,0,0,2},new int[]{1,1,1,2},new int[]{2,2,3,1},new int[]{3,3,3,0},new int[]{},new int[]{}},
            new int[][]{new int[]{0,2,1},new int[]{},new int[]{1},new int[]{0,1,1,2},new int[]{3,3,2,0},new int[]{3,3,0,2}},
            new int[][]{new int[]{3,3,2},new int[]{2,0},new int[]{},new int[]{0,2,2,1},new int[]{1,1,0},new int[]{3,3,0,1}},
            new int[][]{new int[]{},new int[]{0},new int[]{2,2,1,0},new int[]{3,0,2,1},new int[]{3,3,3,2},new int[]{1,1,0}},
            new int[][]{new int[]{0},new int[]{1,1,0},new int[]{2,2,2,4},new int[]{3,4,2,1},new int[]{0},new int[]{3,3,3,1},new int[]{4,4,0}},
            new int[][]{new int[]{},new int[]{1,4,2,0},new int[]{3,0},new int[]{3,3,4,2},new int[]{4,1,1,4},new int[]{2,2,3,0},new int[]{1,0}},
            new int[][]{new int[]{0,4},new int[]{2,0,0,1},new int[]{2,1,4},new int[]{3,3,3,4},new int[]{},new int[]{4,0,2,1},new int[]{2,1,3}},
            new int[][]{new int[]{0,4,0},new int[]{1,1,2,1},new int[]{2,2,2,4},new int[]{3,3,0},new int[]{4,3,3,4},new int[]{1,0},new int[]{}},
            new int[][]{new int[]{0,0,5},new int[]{1,5},new int[]{2,4,2,1},new int[]{3,3,1},new int[]{4,4,1,5},new int[]{0,0,2,5},new int[]{2,3,3,4},new int[]{}},
            new int[][]{new int[]{0,0,0,5},new int[]{1,5,4,2},new int[]{},new int[]{3,3,4,3},new int[]{4,4,3,2},new int[]{5,0,2},new int[]{1,1,1,5},new int[]{2}},
            new int[][]{new int[]{0,2},new int[]{1,1,4,3},new int[]{2,4,0,2},new int[]{},new int[]{4,3,2},new int[]{5,5,3},new int[]{1,1,4,0},new int[]{3,5,5,0}},
            new int[][]{new int[]{},new int[]{1,1,5,0},new int[]{2},new int[]{3,0,0,2},new int[]{4,3,4,2},new int[]{5,5,3,0},new int[]{1,1,5,4},new int[]{3,4,2}},
            new int[][]{new int[]{0,0,5,6},new int[]{1,1,3,0},new int[]{2,2,2,4},new int[]{3,3,6},new int[]{4,4,4,5},new int[]{5,1,1,0},new int[]{6},new int[]{},new int[]{2,5,3,6}},
            new int[][]{new int[]{0,4,0,6},new int[]{1,1,3,6},new int[]{2,2,2,5},new int[]{3,3,3,6},new int[]{4,0},new int[]{1,6,0,4},new int[]{},new int[]{2,4},new int[]{5,5,5,1}},
            new int[][]{new int[]{0,0,0,3},new int[]{1,2,5},new int[]{2,5},new int[]{},new int[]{4,4,4,3},new int[]{5,2,5},new int[]{6,6,3,2},new int[]{6,1,0,3},new int[]{6,1,1,4}},
            new int[][]{new int[]{0,0,1,2},new int[]{1,1,4,2},new int[]{2,6},new int[]{3,3,3,5},new int[]{4,4,4,6},new int[]{5,5,5,1},new int[]{6},new int[]{6},new int[]{0,0,3,2}}
    };

    public static int count() { return LEVELS.length; }

    public static int[][] get(int index) {
        int safe = Math.max(0, Math.min(index, LEVELS.length - 1));
        int[][] src = LEVELS[safe];
        int[][] copy = new int[src.length][];
        for (int i = 0; i < src.length; i++) copy[i] = java.util.Arrays.copyOf(src[i], src[i].length);
        return copy;
    }
}
