# VoxTerra 0.1.1 — World & Climate

Experimental Fabric 26.2 foundation for a simulation-first Minecraft overhaul.

## What 0.1.1 contains
- Continuous macro-scale continents and oceans.
- Directional tectonic uplift belts instead of isolated noise domes.
- Multi-scale foothills, ridges and erosion-like valley networks.
- Cached D8 drainage / flow accumulation on overlapping 4 km hydrology windows.
- River channels whose width/depth scale with upstream accumulation.
- Biomes selected *from* terrain + climate instead of shaping terrain.
- 800-block vertical Overworld (`-64..735`).
- 96-day year, four continuous seasons and latitude/altitude-based local temperature.
- Dynamic freeze/snow/thaw pass around players during precipitation.
- Debug commands: `/voxterra climate` and `/voxterra season`.

## Install / test
1. Minecraft Java 26.2, Fabric Loader 0.19.3 and Fabric API 0.158.0+26.2.
2. Put `voxterra-0.1.1.jar` in the profile's `mods` folder.
3. Remove VoxTerra 0.1.0 if it is still installed.
4. Create a **new** world and select the `VoxTerra Realistic` world preset.
5. Existing chunks are never retrofitted with the new terrain generator.

## Why 0.1.1 exists
The first public 0.1.0 build had a serious world-generation performance flaw. The density
hot path called the full geography sample, which also evaluated slope, climate and moisture
for every terrain column. Multiple worldgen workers could also build the same hydrology tile
at the same time, and river water was inserted through `Level#setBlock` after chunk loading.
Together these could stall neighbouring chunk generation.

0.1.1 separates the terrain-height hot path from climate sampling, makes hydrology tile
construction concurrency-safe, removes boxed hydrology sorting, performs a sparse river
presence test, and writes generated river water directly into the already loaded chunk without
neighbour-update cascades.

## Status
This is still the World & Climate foundation. Hydrology and continental-scale relief are real
algorithms rather than a Vanilla noise preset, but geomorphology is intentionally compressed
for Minecraft scale. Caves/geology remain deliberately unfinished for a later milestone.

## Known limitations
- Cave morphology and geology are not yet simulation-grade.
- Seasonal foliage colour transitions are not implemented yet; snow/freeze/thaw are.
- Hydrology uses a 32 m drainage grid for performance, so the smallest channels can still reveal
  some D8/angular behaviour.
- 0.1.1 improves terrain morphology substantially, but erosion, sediment transport, lakes and
  glacial terrain are still future World & Climate work.
