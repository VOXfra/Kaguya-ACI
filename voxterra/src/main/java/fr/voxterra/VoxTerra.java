package fr.voxterra;

import com.mojang.brigadier.context.CommandContext;
import fr.voxterra.climate.ClimateEngine;
import fr.voxterra.climate.ClimateSnapshot;
import fr.voxterra.geo.GeoEngine;
import fr.voxterra.geo.GeoSample;
import fr.voxterra.season.SeasonalWeather;
import fr.voxterra.season.WorldTime;
import fr.voxterra.worldgen.RiverChunkProcessor;
import fr.voxterra.worldgen.VoxTerraBiomeSource;
import fr.voxterra.worldgen.VoxTerraDensityFunction;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerChunkEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLevelEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.world.level.Level;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static net.minecraft.commands.Commands.literal;

public final class VoxTerra implements ModInitializer {
    public static final String MOD_ID = "voxterra";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    @Override
    public void onInitialize() {
        Registry.register(BuiltInRegistries.BIOME_SOURCE, id("realistic"), VoxTerraBiomeSource.CODEC);
        Registry.register(BuiltInRegistries.DENSITY_FUNCTION_TYPE, id("terrain"), VoxTerraDensityFunction.CODEC);

        ServerLevelEvents.LOAD.register((server, level) -> {
            if (level.dimension() == Level.OVERWORLD) {
                GeoEngine.init(level.getSeed());
                LOGGER.info("VoxTerra geography initialized with seed {}", level.getSeed());
            }
        });

        ServerChunkEvents.CHUNK_LOAD.register((level, chunk, generated) -> {
            if (generated && level.dimension() == Level.OVERWORLD) {
                RiverChunkProcessor.processGeneratedChunk(level, chunk);
            }
        });

        ServerTickEvents.END_LEVEL_TICK.register(level -> {
            if (level.dimension() == Level.OVERWORLD) SeasonalWeather.tick(level);
        });

        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) ->
                dispatcher.register(literal("voxterra")
                        .then(literal("climate").executes(VoxTerra::climateCommand))
                        .then(literal("season").executes(VoxTerra::seasonCommand)))
        );

        LOGGER.info("VoxTerra 0.1.1 initialized");
    }

    private static int climateCommand(CommandContext<CommandSourceStack> ctx) {
        CommandSourceStack source = ctx.getSource();
        var p = source.getPosition();
        long dayTime = WorldTime.ticks(source.getLevel());
        ClimateSnapshot c = ClimateEngine.sample(dayTime, p.x, p.y, p.z);
        GeoSample g = GeoEngine.sample(p.x, p.z);
        source.sendSuccess(() -> Component.literal(String.format(
                "VoxTerra | %.1f°C | %s | jour %d/96 | altitude %.0f | humidité %.0f%% | rivière %.1fm",
                c.temperatureC(), c.season().displayName(), c.dayOfYear() + 1, p.y,
                c.moisture() * 100.0, g.river().width())), false);
        return 1;
    }

    private static int seasonCommand(CommandContext<CommandSourceStack> ctx) {
        long dayTime = WorldTime.ticks(ctx.getSource().getLevel());
        ClimateSnapshot c = ClimateEngine.sample(dayTime, 0, GeoEngine.SEA_LEVEL, ctx.getSource().getPosition().z);
        ctx.getSource().sendSuccess(() -> Component.literal(
                "VoxTerra | année " + c.year() + " | " + c.season().displayName() + " | jour " + (c.dayOfYear() + 1) + "/96"), false);
        return 1;
    }

    public static Identifier id(String path) {
        return Identifier.fromNamespaceAndPath(MOD_ID, path);
    }
}
