# Changelog

## 0.1.1 — Worldgen hotfix + terrain morphology

### Fixed
- Removed climate, moisture and slope evaluation from the terrain density hot path.
- Prevented concurrent chunk workers from redundantly rebuilding the same hydrology tile.
- Replaced boxed `Integer[]` hydrology sorting with a primitive `int[]` sort.
- Reworked generated river filling to avoid `Level#setBlock` update cascades.
- Added a sparse per-chunk river probe so non-river chunks skip the expensive full 16x16 pass.

### Changed
- Reworked continental relief to use narrow, connected tectonic uplift belts rather than broad
  dome-like ridge noise.
- Added smaller ridge/peak detail inside mountain belts.
- Added erosion-like connected valley fields which also influence the drainage heightfield.
- Flattened coastal/alluvial lowlands and continental shelves for more natural transitions.

## 0.1.0 — World & Climate foundation

### Added
- Fabric 26.2 project foundation.
- Custom `voxterra:realistic` world preset.
- Continuous continents/oceans and multi-scale relief.
- Cached coarse hydrology with depression filling, D8 flow and flow accumulation.
- River incision and above-sea-level river water.
- Climate-derived Vanilla biome selection.
- 800-block Overworld vertical range (`-64..735`).
- 96-day seasonal calendar and latitude/altitude-based temperatures.
- Dynamic snow, freezing and thawing.
- `/voxterra climate` and `/voxterra season` debug commands.
