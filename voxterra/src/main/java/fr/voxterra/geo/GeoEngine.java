package fr.voxterra.geo;

import java.util.Arrays;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Continuous deterministic geography model.
 *
 * V0.1.1 performance rule: expensive geology is sampled on a coarse 2D lattice
 * and interpolated. The smallest geological wavelength is hundreds of blocks, so
 * recomputing ~30 fractal-noise octaves for every single Minecraft column was both
 * wasteful and visually pointless.
 */
public final class GeoEngine {
    public static final int SEA_LEVEL = 63;
    public static final int MIN_Y = -64;
    public static final int MAX_Y = 735;

    private static final AtomicLong SEED = new AtomicLong(0L);
    private static final ThreadLocal<ColumnCache> COLUMN_CACHE = ThreadLocal.withInitial(ColumnCache::new);
    private static final ThreadLocal<SampleCache> SAMPLE_CACHE = ThreadLocal.withInitial(SampleCache::new);

    private static final int TERRAIN_TILE_BITS = 7;
    private static final int TERRAIN_TILE_SIZE = 1 << TERRAIN_TILE_BITS;
    private static final int TERRAIN_SAMPLE_STEP = 8;
    private static final int TERRAIN_GRID = TERRAIN_TILE_SIZE / TERRAIN_SAMPLE_STEP + 1;
    private static final int MAX_TERRAIN_TILES = 768;
    private static final ConcurrentHashMap<Long, TerrainTile> TERRAIN_CACHE = new ConcurrentHashMap<>();
    private static final ConcurrentLinkedQueue<Long> TERRAIN_ORDER = new ConcurrentLinkedQueue<>();

    private GeoEngine() {}

    public static void init(long seed) {
        long previous = SEED.getAndSet(seed);
        if (previous != seed) {
            HydroCache.clear();
            TERRAIN_CACHE.clear();
            TERRAIN_ORDER.clear();
        }
        COLUMN_CACHE.remove();
        SAMPLE_CACHE.remove();
    }

    public static long seed() { return SEED.get(); }

    static double baseHeightRaw(double x, double z) {
        final long seed = seed();

        double macroX = x / 36000.0;
        double macroZ = z / 36000.0;
        double wx = Noise.domainWarpX(seed ^ 0x17A7B1E5L, macroX, macroZ, 0.82);
        double wz = Noise.domainWarpZ(seed ^ 0x51ED270BL, macroX, macroZ, 0.82);
        double continent = Noise.fbm(seed ^ 0x6A09E667F3BCC909L, wx, wz, 4, 2.0, 0.52);
        continent += 0.16 * Noise.value(seed ^ 0xBB67AE8584CAA73BL, x / 110000.0, z / 110000.0);

        double coast = smoothstep(-0.075, 0.095, continent);
        double deepOcean = smoothstep(0.02, -0.48, continent);
        double interior = smoothstep(0.00, 0.28, continent);

        double regional = Noise.fbm(seed ^ 0xA54FF53A5F1D36F1L, x / 15000.0, z / 15000.0, 3, 2.0, 0.50);
        double lowland = Noise.fbm(seed ^ 0x3C6EF372FE94F82BL, x / 5200.0, z / 5200.0, 3, 2.05, 0.50);

        double twx = x + Noise.value(seed ^ 0x243F6A8885A308D3L, x / 22000.0, z / 22000.0) * 6500.0;
        double twz = z + Noise.value(seed ^ 0x13198A2E03707344L, x / 22000.0, z / 22000.0) * 6500.0;
        double plateFieldA = Noise.fbm(seed ^ 0x510E527FADE682D1L, twx / 30000.0, twz / 30000.0, 2, 2.0, 0.54);
        double plateFieldB = Noise.fbm(seed ^ 0x9B05688C2B3E6C1FL,
                (twx + twz * 0.42) / 43000.0,
                (twz - twx * 0.21) / 43000.0, 2, 2.0, 0.52);

        double beltA = Math.pow(clamp01(1.0 - Math.abs(plateFieldA) * 2.05), 3.1);
        double beltB = Math.pow(clamp01(1.0 - Math.abs(plateFieldB) * 2.20), 3.5);
        double tectonicActivity = smoothstep(-0.22, 0.52,
                Noise.fbm(seed ^ 0x1F83D9ABFB41BD6BL, x / 56000.0, z / 56000.0, 2, 2.0, 0.5));
        double mountainBelt = clamp01((beltA * 0.82 + beltB * 0.58) * (0.42 + tectonicActivity * 0.82));
        mountainBelt *= smoothstep(-0.015, 0.16, continent);

        double ridgeDetailField = Noise.fbm(seed ^ 0x5BE0CD19137E2179L,
                (x + regional * 900.0) / 2900.0,
                (z - regional * 700.0) / 2900.0, 3, 2.0, 0.48);
        double ridgeDetail = Math.pow(clamp01(1.0 - Math.abs(ridgeDetailField) * 1.42), 2.2);
        double peakNoise = clamp01(0.50 + 0.50 * Noise.fbm(seed ^ 0xCBBB9D5DC1059ED8L,
                x / 4200.0, z / 4200.0, 3, 2.03, 0.50));

        double mountains = mountainBelt * (92.0 + 135.0 * peakNoise + 48.0 * ridgeDetail);
        double foothills = Math.pow(mountainBelt, 0.56) * (18.0 + 18.0 * clamp01(0.5 + regional * 0.5));

        double evx = x + Noise.value(seed ^ 0xD1310BA698DFB5ACL, x / 7200.0, z / 7200.0) * 1500.0;
        double evz = z + Noise.value(seed ^ 0x2FFD72DBD01ADFB7L, x / 7200.0, z / 7200.0) * 1500.0;
        double valleyField = Noise.fbm(seed ^ 0xB8E1AFED6A267E96L, evx / 2350.0, evz / 2350.0, 2, 2.0, 0.52);
        double valleyLines = Math.pow(clamp01(1.0 - Math.abs(valleyField) * 1.70), 3.2);
        double erosionStrength = 6.0 + 18.0 * Math.pow(mountainBelt, 0.55) + 7.0 * Math.abs(regional);

        double landElevation = 5.0
                + interior * 22.0
                + lowland * (7.0 + 7.0 * interior)
                + regional * 9.0
                + foothills
                + mountains;
        landElevation -= valleyLines * erosionStrength * smoothstep(-0.01, 0.10, continent);

        double coastPlain = 1.0 - smoothstep(0.02, 0.18, continent);
        landElevation = lerp(landElevation, 3.5 + lowland * 3.5, coastPlain * 0.72);
        double landHeight = SEA_LEVEL + landElevation;

        double seaFloor = SEA_LEVEL - 5.0 - deepOcean * (42.0 + 34.0 * Math.abs(regional));
        seaFloor += Noise.fbm(seed ^ 0xA4093822299F31D0L, x / 6500.0, z / 6500.0, 2, 2.0, 0.5) * 3.0;

        double h = lerp(seaFloor, landHeight, coast);
        double detail = Noise.fbm(seed ^ 0x082EFA98EC4E6C89L, x / 620.0, z / 620.0, 3, 2.05, 0.47);
        double detailAmp = coast * (2.2 + interior * 2.8 + mountainBelt * 8.5);
        h += detail * detailAmp;

        return clamp(h, MIN_Y + 6, MAX_Y - 16);
    }

    public static double baseHeight(double x, double z) {
        int blockX = fastFloor(x);
        int blockZ = fastFloor(z);
        int tileX = Math.floorDiv(blockX, TERRAIN_TILE_SIZE);
        int tileZ = Math.floorDiv(blockZ, TERRAIN_TILE_SIZE);
        return terrainTile(tileX, tileZ).sample(x, z);
    }

    private static TerrainTile terrainTile(int tileX, int tileZ) {
        long key = pack(tileX, tileZ);
        TerrainTile result = TERRAIN_CACHE.computeIfAbsent(key, ignored -> {
            TerrainTile built = new TerrainTile(tileX, tileZ);
            TERRAIN_ORDER.add(key);
            return built;
        });
        while (TERRAIN_CACHE.size() > MAX_TERRAIN_TILES) {
            Long old = TERRAIN_ORDER.poll();
            if (old == null) break;
            TERRAIN_CACHE.remove(old);
        }
        return result;
    }

    public static double terrainHeight(double x, double z) {
        double base = baseHeight(x, z);
        if (base <= SEA_LEVEL + 2.0) return base;
        RiverSample river = HydroCache.sample(x, z);
        if (!river.river()) return base;
        return Math.min(base, lerp(base, river.bedHeight(), river.mask()));
    }

    public static RiverSample riverAt(double x, double z) {
        return HydroCache.sample(x, z);
    }

    public static GeoSample sample(double x, double z) {
        long currentSeed = seed();
        int bx = fastFloor(x);
        int bz = fastFloor(z);
        long key = pack(bx, bz);
        SampleCache cache = SAMPLE_CACHE.get();
        GeoSample cached = cache.get(currentSeed, key);
        if (cached != null) return cached;

        double base = baseHeight(x, z);
        RiverSample river = base > SEA_LEVEL + 2.0 ? HydroCache.sample(x, z) : RiverSample.NONE;
        double terrain = river.river() ? Math.min(base, lerp(base, river.bedHeight(), river.mask())) : base;
        double slope = slope(x, z);
        double latitude = latitude(z);
        double continentality = clamp01((base - SEA_LEVEL + 35.0) / 170.0);
        double temperature = clamp01(0.80 - Math.abs(latitude) * 0.68 - Math.max(0, terrain - SEA_LEVEL) / 520.0
                + Noise.value(currentSeed ^ 0x5BE0CD19137E2179L, x / 18000.0, z / 18000.0) * 0.08);
        double moisture = moistureAt(x, z, base, latitude);
        GeoSample result = new GeoSample(base, terrain, temperature, moisture, continentality, clamp01(slope / 85.0), river);
        cache.put(currentSeed, key, result);
        return result;
    }

    public static double heightAt(int x, int z) {
        long currentSeed = seed();
        ColumnCache cache = COLUMN_CACHE.get();
        if (cache.seed == currentSeed && cache.x == x && cache.z == z) return cache.height;
        double h = terrainHeight(x, z);
        cache.seed = currentSeed;
        cache.x = x;
        cache.z = z;
        cache.height = h;
        return h;
    }

    public static double latitude(double z) {
        return Math.tanh(z / 125000.0);
    }

    public static double slope(double x, double z) {
        double d = 24.0;
        double dx = baseHeight(x + d, z) - baseHeight(x - d, z);
        double dz = baseHeight(x, z + d) - baseHeight(x, z - d);
        return Math.sqrt(dx * dx + dz * dz) / (2.0 * d) * 100.0;
    }

    public static double moistureAt(double x, double z, double height, double latitude) {
        double wetNoise = Noise.fbm(seed() ^ 0xCBBB9D5DC1059ED8L, x / 17000.0, z / 17000.0, 3, 2.0, 0.52);
        double oceanInfluence = clamp01(1.0 - Math.max(0, height - SEA_LEVEL) / 150.0);
        double latWet = 0.12 * (1.0 - Math.abs(latitude));
        return clamp01(0.50 + wetNoise * 0.38 + oceanInfluence * 0.12 + latWet);
    }

    static double drainageRainfall(double x, double z, double height) {
        double wet = Noise.value(seed() ^ 0xCBBB9D5DC1059ED8L, x / 17000.0, z / 17000.0);
        double oceanInfluence = clamp01(1.0 - Math.max(0, height - SEA_LEVEL) / 180.0);
        return clamp01(0.55 + wet * 0.28 + oceanInfluence * 0.12);
    }

    static double smoothstep(double edge0, double edge1, double x) {
        if (edge0 == edge1) return x < edge0 ? 0 : 1;
        double t = clamp01((x - edge0) / (edge1 - edge0));
        return t * t * (3 - 2 * t);
    }

    static double clamp01(double v) { return clamp(v, 0.0, 1.0); }
    static double clamp(double v, double lo, double hi) { return Math.max(lo, Math.min(hi, v)); }
    static double lerp(double a, double b, double t) { return a + (b - a) * t; }

    private static int fastFloor(double v) {
        int i = (int) v;
        return v < i ? i - 1 : i;
    }

    private static long pack(int x, int z) {
        return (((long) x) << 32) ^ (z & 0xffffffffL);
    }

    private static final class TerrainTile {
        private final int originX;
        private final int originZ;
        private final double[] heights = new double[TERRAIN_GRID * TERRAIN_GRID];

        TerrainTile(int tileX, int tileZ) {
            originX = tileX * TERRAIN_TILE_SIZE;
            originZ = tileZ * TERRAIN_TILE_SIZE;
            int i = 0;
            for (int gz = 0; gz < TERRAIN_GRID; gz++) {
                double z = originZ + gz * TERRAIN_SAMPLE_STEP;
                for (int gx = 0; gx < TERRAIN_GRID; gx++) {
                    double x = originX + gx * TERRAIN_SAMPLE_STEP;
                    heights[i++] = baseHeightRaw(x, z);
                }
            }
        }

        double sample(double x, double z) {
            double fx = clamp((x - originX) / TERRAIN_SAMPLE_STEP, 0.0, TERRAIN_GRID - 1.0000001);
            double fz = clamp((z - originZ) / TERRAIN_SAMPLE_STEP, 0.0, TERRAIN_GRID - 1.0000001);
            int x0 = (int) fx;
            int z0 = (int) fz;
            int x1 = Math.min(x0 + 1, TERRAIN_GRID - 1);
            int z1 = Math.min(z0 + 1, TERRAIN_GRID - 1);
            double tx = fx - x0;
            double tz = fz - z0;
            double a = lerp(heights[z0 * TERRAIN_GRID + x0], heights[z0 * TERRAIN_GRID + x1], tx);
            double b = lerp(heights[z1 * TERRAIN_GRID + x0], heights[z1 * TERRAIN_GRID + x1], tx);
            return lerp(a, b, tz);
        }
    }

    private static final class ColumnCache {
        long seed = Long.MIN_VALUE;
        int x = Integer.MIN_VALUE;
        int z = Integer.MIN_VALUE;
        double height;
    }

    private static final class SampleCache {
        private static final int SIZE = 64;
        private final long[] keys = new long[SIZE];
        private final GeoSample[] values = new GeoSample[SIZE];
        private long seed = Long.MIN_VALUE;
        private int cursor;

        SampleCache() { Arrays.fill(keys, Long.MIN_VALUE); }

        GeoSample get(long currentSeed, long key) {
            if (seed != currentSeed) reset(currentSeed);
            for (int i = 0; i < SIZE; i++) if (keys[i] == key) return values[i];
            return null;
        }

        void put(long currentSeed, long key, GeoSample value) {
            if (seed != currentSeed) reset(currentSeed);
            keys[cursor] = key;
            values[cursor] = value;
            cursor = (cursor + 1) & (SIZE - 1);
        }

        private void reset(long currentSeed) {
            seed = currentSeed;
            Arrays.fill(keys, Long.MIN_VALUE);
            Arrays.fill(values, null);
            cursor = 0;
        }
    }
}
