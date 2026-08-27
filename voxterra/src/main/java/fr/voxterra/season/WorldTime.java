package fr.voxterra.season;

import net.minecraft.server.level.ServerLevel;

/** Accesses the dimension's default world clock introduced in Minecraft 26.x. */
public final class WorldTime {
    private WorldTime() {}

    public static long ticks(ServerLevel level) {
        return level.dimensionType().defaultClock()
                .map(clock -> level.clockManager().getTotalTicks(clock))
                .orElseGet(level::getGameTime);
    }
}
