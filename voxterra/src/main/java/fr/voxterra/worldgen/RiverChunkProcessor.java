package fr.voxterra.worldgen;

import fr.voxterra.geo.GeoEngine;
import fr.voxterra.geo.RiverSample;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.chunk.LevelChunk;

/**
 * Fills above-sea-level river channels after a freshly generated LevelChunk appears.
 *
 * V0.1 used Level#setBlock for every column on the server thread. This version first
 * performs a sparse river probe and then writes directly into the already-loaded chunk
 * with side effects disabled, avoiding neighbor chunk loads and update cascades.
 */
public final class RiverChunkProcessor {
    private static final int DIRECT_CHUNK_WRITE_FLAGS = 512; // suppress block placement side effects

    private RiverChunkProcessor() {}

    public static boolean isVoxTerra(ServerLevel level) {
        return level.getChunkSource().getGenerator().getBiomeSource() instanceof VoxTerraBiomeSource;
    }

    public static void processGeneratedChunk(ServerLevel level, LevelChunk chunk) {
        if (!isVoxTerra(level)) return;
        int minX = chunk.getPos().getMinBlockX();
        int minZ = chunk.getPos().getMinBlockZ();

        // Most chunks have no river. Avoid 256 full probes for them.
        boolean maybeRiver = false;
        for (int dz = 1; dz < 16 && !maybeRiver; dz += 4) {
            for (int dx = 1; dx < 16; dx += 4) {
                RiverSample r = GeoEngine.riverAt(minX + dx, minZ + dz);
                if (r.river() && r.mask() > 0.05) {
                    maybeRiver = true;
                    break;
                }
            }
        }
        if (!maybeRiver) return;

        BlockPos.MutableBlockPos pos = new BlockPos.MutableBlockPos();
        for (int dz = 0; dz < 16; dz++) {
            for (int dx = 0; dx < 16; dx++) {
                int x = minX + dx;
                int z = minZ + dz;
                RiverSample river = GeoEngine.riverAt(x, z);
                if (!river.river() || river.mask() < 0.34 || river.waterSurface() <= GeoEngine.SEA_LEVEL + 0.5) continue;

                int bedY = (int) Math.floor(GeoEngine.terrainHeight(x, z));
                int waterY = (int) Math.floor(river.waterSurface());
                if (waterY <= bedY || waterY > GeoEngine.MAX_Y - 2) continue;

                pos.set(x, bedY, z);
                chunk.setBlockState(pos,
                        river.accumulation() > 900 ? Blocks.CLAY.defaultBlockState() : Blocks.GRAVEL.defaultBlockState(),
                        DIRECT_CHUNK_WRITE_FLAGS);

                for (int y = bedY + 1; y <= waterY; y++) {
                    pos.set(x, y, z);
                    chunk.setBlockState(pos, Blocks.WATER.defaultBlockState(), DIRECT_CHUNK_WRITE_FLAGS);
                }
            }
        }
    }
}
