package fr.vox.minigames;

import org.junit.Test;
import static org.junit.Assert.*;

public final class WaterSortGameTest {
    @Test public void pourRespectsTopColor() {
        WaterSortGame game = new WaterSortGame(new int[][]{{0,1},{0},{}, {1,1,1}});
        assertFalse(game.canPour(0, 1));
        assertTrue(game.canPour(0, 2));
        assertTrue(game.pour(0, 2).moved);
        assertEquals(1, game.topColor(2));
    }

    @Test public void undoRestoresPreviousState() {
        WaterSortGame game = new WaterSortGame(new int[][]{{0,0,1},{1,1},{}, {0}});
        int[][] before = game.snapshot();
        assertTrue(game.pour(0, 2).moved);
        assertTrue(game.undo());
        assertArrayEquals(before[0], game.snapshot()[0]);
        assertEquals(0, game.moves());
    }

    @Test public void allCatalogLevelsAreStructurallyValid() {
        for (int i = 0; i < LevelCatalog.count(); i++) {
            WaterSortGame game = new WaterSortGame(LevelCatalog.get(i));
            assertFalse("Le niveau ne doit pas être déjà résolu: " + i, game.isSolved());
            assertNotNull(game.findHint());
        }
    }
}
