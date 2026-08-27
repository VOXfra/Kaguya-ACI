package fr.voxterra.worldgen;

import com.mojang.serialization.MapCodec;
import fr.voxterra.geo.GeoEngine;
import net.minecraft.util.KeyDispatchDataCodec;
import net.minecraft.world.level.levelgen.DensityFunction;

/** Leaf density function converting the VoxTerra height field into solid terrain. */
public final class VoxTerraDensityFunction implements DensityFunction {
    public static final MapCodec<VoxTerraDensityFunction> CODEC = MapCodec.unit(VoxTerraDensityFunction::new);

    @Override
    public double compute(FunctionContext pos) {
        return GeoEngine.heightAt(pos.blockX(), pos.blockZ()) - pos.blockY();
    }

    @Override
    public void fillArray(double[] densities, ContextProvider provider) {
        int lastX = Integer.MIN_VALUE;
        int lastZ = Integer.MIN_VALUE;
        double height = 0;
        for (int i = 0; i < densities.length; i++) {
            FunctionContext pos = provider.forIndex(i);
            if (pos.blockX() != lastX || pos.blockZ() != lastZ) {
                lastX = pos.blockX();
                lastZ = pos.blockZ();
                height = GeoEngine.heightAt(lastX, lastZ);
            }
            densities[i] = height - pos.blockY();
        }
    }

    @Override
    public DensityFunction mapChildren(Visitor visitor) {
        return this;
    }

    @Override
    public double minValue() {
        return GeoEngine.MIN_Y - GeoEngine.MAX_Y;
    }

    @Override
    public double maxValue() {
        return GeoEngine.MAX_Y - GeoEngine.MIN_Y;
    }

    @Override
    public KeyDispatchDataCodec<? extends DensityFunction> codec() {
        return KeyDispatchDataCodec.of(CODEC);
    }
}
