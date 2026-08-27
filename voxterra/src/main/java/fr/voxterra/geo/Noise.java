package fr.voxterra.geo;

/** Deterministic allocation-free 2D value/fractal noise. */
public final class Noise {
    private Noise() {}

    public static double value(long seed, double x, double z) {
        int x0 = fastFloor(x);
        int z0 = fastFloor(z);
        int x1 = x0 + 1;
        int z1 = z0 + 1;
        double tx = smooth(x - x0);
        double tz = smooth(z - z0);
        double a = lerp(hashUnit(seed, x0, z0), hashUnit(seed, x1, z0), tx);
        double b = lerp(hashUnit(seed, x0, z1), hashUnit(seed, x1, z1), tx);
        return lerp(a, b, tz);
    }

    public static double fbm(long seed, double x, double z, int octaves, double lacunarity, double gain) {
        double sum = 0.0;
        double amp = 1.0;
        double norm = 0.0;
        for (int i = 0; i < octaves; i++) {
            sum += value(seed + i * 0x9E3779B97F4A7C15L, x, z) * amp;
            norm += amp;
            x *= lacunarity;
            z *= lacunarity;
            amp *= gain;
        }
        return sum / norm;
    }

    public static double ridged(long seed, double x, double z, int octaves) {
        double n = fbm(seed, x, z, octaves, 2.0, 0.5);
        double r = 1.0 - Math.abs(n);
        return r * r * r;
    }

    public static double domainWarpX(long seed, double x, double z, double strength) {
        return x + value(seed ^ 0x4D595DF4D0F33173L, x * 0.53, z * 0.53) * strength;
    }

    public static double domainWarpZ(long seed, double x, double z, double strength) {
        return z + value(seed ^ 0x94D049BB133111EBL, x * 0.53, z * 0.53) * strength;
    }

    public static long mix64(long z) {
        z = (z ^ (z >>> 30)) * 0xbf58476d1ce4e5b9L;
        z = (z ^ (z >>> 27)) * 0x94d049bb133111ebL;
        return z ^ (z >>> 31);
    }

    private static double hashUnit(long seed, int x, int z) {
        long h = seed;
        h ^= (long) x * 0x632BE59BD9B4E019L;
        h ^= (long) z * 0x9E3779B97F4A7C15L;
        h = mix64(h);
        return ((h >>> 11) * 0x1.0p-53) * 2.0 - 1.0;
    }

    private static int fastFloor(double v) {
        int i = (int) v;
        return v < i ? i - 1 : i;
    }

    private static double smooth(double t) {
        return t * t * (3.0 - 2.0 * t);
    }

    private static double lerp(double a, double b, double t) {
        return a + (b - a) * t;
    }
}
