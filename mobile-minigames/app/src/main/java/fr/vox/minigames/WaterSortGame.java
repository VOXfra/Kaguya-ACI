package fr.vox.minigames;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Moteur pur du mini-jeu Liquid Sort.
 * Les bouteilles sont stockées du bas vers le haut afin de garder les règles faciles à auditer.
 */
public final class WaterSortGame {
    public static final int CAPACITY = 4;

    public static final class MoveResult {
        public final boolean moved;
        public final int color;
        public final int amount;

        private MoveResult(boolean moved, int color, int amount) {
            this.moved = moved;
            this.color = color;
            this.amount = amount;
        }

        static MoveResult none() { return new MoveResult(false, -1, 0); }
        static MoveResult moved(int color, int amount) { return new MoveResult(true, color, amount); }
    }

    private final int[][] initial;
    private int[][] bottles;
    private final List<int[][]> history = new ArrayList<>();
    private int moves;

    public WaterSortGame(int[][] level) {
        validateLevel(level);
        this.initial = deepCopy(level);
        this.bottles = deepCopy(level);
    }

    public int bottleCount() { return bottles.length; }
    public int size(int bottle) { return bottles[bottle].length; }
    public int get(int bottle, int layer) { return bottles[bottle][layer]; }
    public int moves() { return moves; }
    public boolean canUndo() { return !history.isEmpty(); }

    public int topColor(int bottle) {
        int[] b = bottles[bottle];
        return b.length == 0 ? -1 : b[b.length - 1];
    }

    public int topGroupSize(int bottle) {
        int[] b = bottles[bottle];
        if (b.length == 0) return 0;
        int color = b[b.length - 1];
        int count = 1;
        for (int i = b.length - 2; i >= 0 && b[i] == color; i--) count++;
        return count;
    }

    public boolean canPour(int from, int to) {
        if (from < 0 || to < 0 || from >= bottles.length || to >= bottles.length || from == to) return false;
        int[] src = bottles[from];
        int[] dst = bottles[to];
        if (src.length == 0 || dst.length >= CAPACITY) return false;
        int color = src[src.length - 1];
        return dst.length == 0 || dst[dst.length - 1] == color;
    }

    public MoveResult pour(int from, int to) {
        if (!canPour(from, to)) return MoveResult.none();
        int color = topColor(from);
        int amount = Math.min(topGroupSize(from), CAPACITY - bottles[to].length);
        history.add(deepCopy(bottles));

        int srcSize = bottles[from].length;
        bottles[from] = Arrays.copyOf(bottles[from], srcSize - amount);
        int dstSize = bottles[to].length;
        bottles[to] = Arrays.copyOf(bottles[to], dstSize + amount);
        Arrays.fill(bottles[to], dstSize, dstSize + amount, color);
        moves++;
        return MoveResult.moved(color, amount);
    }

    public boolean undo() {
        if (history.isEmpty()) return false;
        bottles = history.remove(history.size() - 1);
        moves = Math.max(0, moves - 1);
        return true;
    }

    public void restart() {
        bottles = deepCopy(initial);
        history.clear();
        moves = 0;
    }

    public boolean isSolved() {
        for (int[] bottle : bottles) {
            if (bottle.length == 0) continue;
            if (bottle.length != CAPACITY) return false;
            int color = bottle[0];
            for (int value : bottle) if (value != color) return false;
        }
        return true;
    }

    public int[] findHint() {
        int[] fallback = null;
        for (int from = 0; from < bottles.length; from++) {
            for (int to = 0; to < bottles.length; to++) {
                if (!canPour(from, to)) continue;
                boolean srcComplete = isBottleComplete(from);
                boolean dstEmpty = bottles[to].length == 0;
                if (!srcComplete || !dstEmpty) return new int[]{from, to};
                if (fallback == null) fallback = new int[]{from, to};
            }
        }
        return fallback;
    }

    public boolean isBottleComplete(int index) {
        int[] b = bottles[index];
        if (b.length != CAPACITY) return false;
        for (int value : b) if (value != b[0]) return false;
        return true;
    }

    public int[][] snapshot() { return deepCopy(bottles); }

    private static int[][] deepCopy(int[][] src) {
        int[][] copy = new int[src.length][];
        for (int i = 0; i < src.length; i++) copy[i] = Arrays.copyOf(src[i], src[i].length);
        return copy;
    }

    private static void validateLevel(int[][] level) {
        if (level == null || level.length < 3) throw new IllegalArgumentException("Niveau invalide");
        for (int[] bottle : level) {
            if (bottle == null || bottle.length > CAPACITY) throw new IllegalArgumentException("Bouteille invalide");
            for (int color : bottle) if (color < 0) throw new IllegalArgumentException("Couleur invalide");
        }
    }
}
