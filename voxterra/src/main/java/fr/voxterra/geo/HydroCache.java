package fr.voxterra.geo;

import java.util.Comparator;
import java.util.PriorityQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * Coarse deterministic drainage cache.
 *
 * Important: worldgen is multithreaded. computeIfAbsent guarantees that a hydrology
 * tile is built once instead of several chunk workers calculating the same 4 km
 * drainage window simultaneously (the V0.1 stall bug).
 */
public final class HydroCache {
    private static final int CELL = 32;
    private static final int CORE_CELLS = 64;
    private static final int HALO = 32;
    private static final int GRID = CORE_CELLS + HALO * 2;
    private static final int CORE_BLOCKS = CORE_CELLS * CELL;
    private static final int MAX_TILES = 96;
    private static final double RIVER_THRESHOLD = 82.0;

    private static final ConcurrentHashMap<Long, HydroTile> CACHE = new ConcurrentHashMap<>();
    private static final ConcurrentLinkedQueue<Long> INSERTION_ORDER = new ConcurrentLinkedQueue<>();

    private HydroCache() {}

    public static void clear() {
        CACHE.clear();
        INSERTION_ORDER.clear();
    }

    public static RiverSample sample(double x, double z) {
        int tx = Math.floorDiv((int) Math.floor(x), CORE_BLOCKS);
        int tz = Math.floorDiv((int) Math.floor(z), CORE_BLOCKS);
        return get(tx, tz).sample(x, z);
    }

    private static HydroTile get(int tx, int tz) {
        long key = (((long) tx) << 32) ^ (tz & 0xffffffffL);
        HydroTile tile = CACHE.computeIfAbsent(key, ignored -> {
            HydroTile built = new HydroTile(tx, tz);
            INSERTION_ORDER.add(key);
            return built;
        });
        trimCache();
        return tile;
    }

    private static void trimCache() {
        while (CACHE.size() > MAX_TILES) {
            Long eldest = INSERTION_ORDER.poll();
            if (eldest == null) return;
            CACHE.remove(eldest);
        }
    }

    private static final class HydroTile {
        private static final int[] DX = {-1, 0, 1, -1, 1, -1, 0, 1};
        private static final int[] DZ = {-1, -1, -1, 0, 0, 1, 1, 1};

        final int originX;
        final int originZ;
        final double[] raw = new double[GRID * GRID];
        final double[] filled = new double[GRID * GRID];
        final double[] accumulation = new double[GRID * GRID];
        final int[] downstream = new int[GRID * GRID];

        HydroTile(int tx, int tz) {
            int coreStartX = tx * CORE_BLOCKS;
            int coreStartZ = tz * CORE_BLOCKS;
            this.originX = coreStartX - HALO * CELL;
            this.originZ = coreStartZ - HALO * CELL;
            build();
        }

        private void build() {
            for (int gz = 0; gz < GRID; gz++) {
                for (int gx = 0; gx < GRID; gx++) {
                    int idx = index(gx, gz);
                    double x = originX + (gx + 0.5) * CELL;
                    double z = originZ + (gz + 0.5) * CELL;
                    double h = GeoEngine.baseHeightRaw(x, z);
                    raw[idx] = h;
                    filled[idx] = h;
                    double rainfall = GeoEngine.drainageRainfall(x, z, h);
                    accumulation[idx] = h <= GeoEngine.SEA_LEVEL ? 0.15 : 0.55 + rainfall * 0.9;
                    downstream[idx] = -1;
                }
            }
            priorityFlood();
            calculateFlow();
        }

        private void priorityFlood() {
            boolean[] seen = new boolean[GRID * GRID];
            PriorityQueue<Cell> pq = new PriorityQueue<>(Comparator.comparingDouble(Cell::height));
            for (int i = 0; i < GRID; i++) {
                seedBorder(i, 0, seen, pq);
                seedBorder(i, GRID - 1, seen, pq);
                seedBorder(0, i, seen, pq);
                seedBorder(GRID - 1, i, seen, pq);
            }

            while (!pq.isEmpty()) {
                Cell c = pq.poll();
                int cx = c.idx % GRID;
                int cz = c.idx / GRID;
                for (int d = 0; d < 8; d++) {
                    int nx = cx + DX[d];
                    int nz = cz + DZ[d];
                    if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) continue;
                    int ni = index(nx, nz);
                    if (seen[ni]) continue;
                    seen[ni] = true;
                    double nh = Math.max(filled[ni], c.height + 0.0015);
                    filled[ni] = nh;
                    pq.add(new Cell(ni, nh));
                }
            }
        }

        private void seedBorder(int x, int z, boolean[] seen, PriorityQueue<Cell> pq) {
            int i = index(x, z);
            if (!seen[i]) {
                seen[i] = true;
                pq.add(new Cell(i, filled[i]));
            }
        }

        private void calculateFlow() {
            int[] order = new int[GRID * GRID];
            for (int i = 0; i < order.length; i++) order[i] = i;
            sortByHeightDescending(order, 0, order.length - 1);

            for (int idx : order) {
                int x = idx % GRID;
                int z = idx / GRID;
                double bestDrop = 0.0;
                int best = -1;
                for (int d = 0; d < 8; d++) {
                    int nx = x + DX[d];
                    int nz = z + DZ[d];
                    if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) continue;
                    int ni = index(nx, nz);
                    double distance = (DX[d] == 0 || DZ[d] == 0) ? 1.0 : 1.41421356237;
                    double drop = (filled[idx] - filled[ni]) / distance;
                    if (drop > bestDrop) {
                        bestDrop = drop;
                        best = ni;
                    }
                }
                downstream[idx] = best;
                if (best >= 0) accumulation[best] += accumulation[idx];
            }
        }

        private void sortByHeightDescending(int[] a, int lo, int hi) {
            int i = lo, j = hi;
            double pivot = filled[a[(lo + hi) >>> 1]];
            while (i <= j) {
                while (filled[a[i]] > pivot) i++;
                while (filled[a[j]] < pivot) j--;
                if (i <= j) {
                    int t = a[i]; a[i] = a[j]; a[j] = t;
                    i++; j--;
                }
            }
            if (lo < j) sortByHeightDescending(a, lo, j);
            if (i < hi) sortByHeightDescending(a, i, hi);
        }

        RiverSample sample(double x, double z) {
            double gridX = (x - originX) / CELL - 0.5;
            double gridZ = (z - originZ) / CELL - 0.5;
            int cx = (int) Math.floor(gridX);
            int cz = (int) Math.floor(gridZ);

            double bestDist = Double.POSITIVE_INFINITY;
            double bestWidth = 0;
            double bestSurface = 0;
            double bestBed = 0;
            double bestAcc = 0;

            for (int oz = -2; oz <= 2; oz++) {
                for (int ox = -2; ox <= 2; ox++) {
                    int gx = cx + ox;
                    int gz = cz + oz;
                    if (gx < 1 || gz < 1 || gx >= GRID - 1 || gz >= GRID - 1) continue;
                    int idx = index(gx, gz);
                    double acc = accumulation[idx];
                    int dn = downstream[idx];
                    if (acc < RIVER_THRESHOLD || dn < 0) continue;

                    int dx = dn % GRID;
                    int dz = dn / GRID;
                    double ax = originX + (gx + 0.5) * CELL;
                    double az = originZ + (gz + 0.5) * CELL;
                    double bx = originX + (dx + 0.5) * CELL;
                    double bz = originZ + (dz + 0.5) * CELL;
                    SegmentDistance sd = segmentDistance(x, z, ax, az, bx, bz);
                    double width = GeoEngine.clamp(1.4 + Math.sqrt(acc / 45.0) * 1.65, 1.8, 32.0);

                    if (sd.distance < bestDist) {
                        double surfaceA = Math.min(filled[idx], raw[idx] + 1.8) - 0.8;
                        double surfaceB = Math.min(filled[dn], raw[dn] + 1.8) - 0.8;
                        double surface = GeoEngine.lerp(surfaceA, surfaceB, sd.t);
                        double depth = GeoEngine.clamp(1.4 + Math.sqrt(acc / 360.0), 1.5, 9.0);
                        bestDist = sd.distance;
                        bestWidth = width;
                        bestSurface = surface;
                        bestBed = surface - depth;
                        bestAcc = acc;
                    }
                }
            }

            if (!Double.isFinite(bestDist) || bestDist > bestWidth + 3.5) return RiverSample.NONE;
            double mask = 1.0 - GeoEngine.smoothstep(bestWidth * 0.70, bestWidth + 3.5, bestDist);
            if (mask <= 0.001) return RiverSample.NONE;
            return new RiverSample(true, mask, bestWidth, bestSurface, bestBed, bestAcc);
        }

        private int index(int x, int z) { return z * GRID + x; }

        private static SegmentDistance segmentDistance(double px, double pz, double ax, double az, double bx, double bz) {
            double vx = bx - ax;
            double vz = bz - az;
            double wx = px - ax;
            double wz = pz - az;
            double len2 = vx * vx + vz * vz;
            double t = len2 <= 1e-9 ? 0.0 : GeoEngine.clamp((wx * vx + wz * vz) / len2, 0.0, 1.0);
            double qx = ax + vx * t;
            double qz = az + vz * t;
            double dx = px - qx;
            double dz = pz - qz;
            return new SegmentDistance(Math.sqrt(dx * dx + dz * dz), t);
        }

        private record Cell(int idx, double height) {}
        private record SegmentDistance(double distance, double t) {}
    }
}
