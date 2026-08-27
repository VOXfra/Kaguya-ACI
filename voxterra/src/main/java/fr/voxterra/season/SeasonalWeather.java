package fr.voxterra.season;

import fr.voxterra.climate.ClimateEngine;
import fr.voxterra.climate.ClimateSnapshot;
import fr.voxterra.worldgen.RiverChunkProcessor;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.util.RandomSource;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;

/** Lightweight dynamic snow/freeze/thaw pass driven by VoxTerra temperature. */
public final class SeasonalWeather {
    private SeasonalWeather() {}

    public static void tick(ServerLevel level) {
        if (!RiverChunkProcessor.isVoxTerra(level) || level.getGameTime() % 20L != 0L) return;

        for (ServerPlayer player : level.players()) {
            RandomSource random = RandomSource.create(level.getGameTime() ^ player.getUUID().getMostSignificantBits());
            int px = player.blockPosition().getX();
            int pz = player.blockPosition().getZ();

            for (int i = 0; i < 20; i++) {
                int x = px + random.nextInt(97) - 48;
                int z = pz + random.nextInt(97) - 48;
                int topY = level.getHeight(Heightmap.Types.MOTION_BLOCKING, x, z);
                if (topY <= level.getMinY() || topY >= level.getMaxY()) continue;

                BlockPos airPos = new BlockPos(x, topY, z);
                BlockPos groundPos = airPos.below();
                ClimateSnapshot climate = ClimateEngine.sample(WorldTime.ticks(level), x, topY - 1, z);
                BlockState ground = level.getBlockState(groundPos);
                BlockState air = level.getBlockState(airPos);

                if (climate.temperatureC() <= -0.5 && level.isRainingAt(airPos)) {
                    if (ground.is(Blocks.WATER) && climate.temperatureC() <= -2.0) {
                        level.setBlock(groundPos, Blocks.ICE.defaultBlockState(), 3);
                    } else if (air.isAir() && Blocks.SNOW.defaultBlockState().canSurvive(level, airPos)) {
                        level.setBlock(airPos, Blocks.SNOW.defaultBlockState(), 3);
                    }
                } else if (climate.temperatureC() >= 2.0) {
                    if (air.is(Blocks.SNOW)) {
                        level.setBlock(airPos, Blocks.AIR.defaultBlockState(), 3);
                    }
                    if (ground.is(Blocks.ICE) || ground.is(Blocks.FROSTED_ICE)) {
                        level.setBlock(groundPos, Blocks.WATER.defaultBlockState(), 3);
                    }
                }
            }
        }
    }
}
