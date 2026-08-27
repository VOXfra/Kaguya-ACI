package fr.voxterra.worldgen;

import com.mojang.serialization.MapCodec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import fr.voxterra.geo.GeoEngine;
import fr.voxterra.geo.GeoSample;
import net.minecraft.core.Holder;
import net.minecraft.core.HolderGetter;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.RegistryOps;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.level.biome.Biome;
import net.minecraft.world.level.biome.BiomeSource;
import net.minecraft.world.level.biome.Biomes;
import net.minecraft.world.level.biome.Climate;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.stream.Stream;

/** Biomes are selected as a consequence of geography and climate, not used to shape the terrain. */
public final class VoxTerraBiomeSource extends BiomeSource {
    public static final MapCodec<VoxTerraBiomeSource> CODEC = RecordCodecBuilder.mapCodec(instance ->
            instance.group(RegistryOps.retrieveGetter(Registries.BIOME))
                    .apply(instance, instance.stable(VoxTerraBiomeSource::new)));

    private final HolderGetter<Biome> biomes;
    private Set<Holder<Biome>> possible;

    public VoxTerraBiomeSource(HolderGetter<Biome> biomes) {
        this.biomes = biomes;
    }

    @Override
    protected MapCodec<? extends BiomeSource> codec() {
        return CODEC;
    }

    @Override
    protected Stream<Holder<Biome>> collectPossibleBiomes() {
        if (possible == null) {
            possible = new LinkedHashSet<>();
            ResourceKey<Biome>[] keys = new ResourceKey[]{
                    Biomes.PLAINS, Biomes.FOREST, Biomes.BIRCH_FOREST, Biomes.DARK_FOREST,
                    Biomes.TAIGA, Biomes.SNOWY_TAIGA, Biomes.SNOWY_PLAINS,
                    Biomes.DESERT, Biomes.SAVANNA, Biomes.JUNGLE, Biomes.SPARSE_JUNGLE,
                    Biomes.SWAMP, Biomes.MANGROVE_SWAMP, Biomes.MEADOW, Biomes.GROVE,
                    Biomes.SNOWY_SLOPES, Biomes.FROZEN_PEAKS, Biomes.STONY_PEAKS,
                    Biomes.WINDSWEPT_HILLS, Biomes.BEACH, Biomes.SNOWY_BEACH, Biomes.STONY_SHORE,
                    Biomes.RIVER, Biomes.FROZEN_RIVER,
                    Biomes.WARM_OCEAN, Biomes.OCEAN, Biomes.COLD_OCEAN, Biomes.FROZEN_OCEAN,
                    Biomes.DEEP_OCEAN, Biomes.DEEP_COLD_OCEAN, Biomes.DEEP_FROZEN_OCEAN,
                    Biomes.BADLANDS
            };
            for (ResourceKey<Biome> key : keys) possible.add(biomes.getOrThrow(key));
        }
        return possible.stream();
    }

    @Override
    public Holder<Biome> getNoiseBiome(int quartX, int quartY, int quartZ, Climate.Sampler sampler) {
        int x = quartX << 2;
        int z = quartZ << 2;
        GeoSample g = GeoEngine.sample(x, z);
        double h = g.terrainHeight();
        double t = g.temperature01();
        double m = g.moisture01();
        double slope = g.ruggedness() * 85.0;

        if (g.river().river() && g.river().mask() > 0.48 && h > GeoEngine.SEA_LEVEL - 4) {
            return get(t < 0.22 ? Biomes.FROZEN_RIVER : Biomes.RIVER);
        }

        if (h < GeoEngine.SEA_LEVEL - 28) {
            if (t < 0.18) return get(Biomes.DEEP_FROZEN_OCEAN);
            if (t < 0.38) return get(Biomes.DEEP_COLD_OCEAN);
            return get(Biomes.DEEP_OCEAN);
        }
        if (h < GeoEngine.SEA_LEVEL - 1) {
            if (t < 0.18) return get(Biomes.FROZEN_OCEAN);
            if (t < 0.38) return get(Biomes.COLD_OCEAN);
            if (t > 0.76) return get(Biomes.WARM_OCEAN);
            return get(Biomes.OCEAN);
        }

        if (h <= GeoEngine.SEA_LEVEL + 5) {
            if (slope > 18) return get(Biomes.STONY_SHORE);
            if (t < 0.22) return get(Biomes.SNOWY_BEACH);
            return get(Biomes.BEACH);
        }

        if (h > 275) return get(t < 0.42 ? Biomes.FROZEN_PEAKS : Biomes.STONY_PEAKS);
        if (h > 215) return get(t < 0.34 ? Biomes.SNOWY_SLOPES : Biomes.STONY_PEAKS);
        if (h > 165) {
            if (t < 0.28) return get(Biomes.GROVE);
            if (m > 0.48) return get(Biomes.MEADOW);
            return get(Biomes.WINDSWEPT_HILLS);
        }

        if (t > 0.76 && m < 0.25) return get(Biomes.DESERT);
        if (t > 0.66 && m < 0.42) return get(Biomes.SAVANNA);
        if (t > 0.74 && m > 0.70) return get(Biomes.JUNGLE);
        if (t > 0.68 && m > 0.58) return get(Biomes.SPARSE_JUNGLE);
        if (m > 0.83 && h < GeoEngine.SEA_LEVEL + 18) return get(t > 0.62 ? Biomes.MANGROVE_SWAMP : Biomes.SWAMP);
        if (t < 0.18) return get(m > 0.52 ? Biomes.SNOWY_TAIGA : Biomes.SNOWY_PLAINS);
        if (t < 0.34) return get(Biomes.TAIGA);
        if (m > 0.72) return get(Biomes.DARK_FOREST);
        if (m > 0.55) return get(t > 0.56 ? Biomes.BIRCH_FOREST : Biomes.FOREST);
        if (t > 0.64 && m < 0.34) return get(Biomes.BADLANDS);
        return get(Biomes.PLAINS);
    }

    private Holder<Biome> get(ResourceKey<Biome> key) {
        return biomes.getOrThrow(key);
    }
}
