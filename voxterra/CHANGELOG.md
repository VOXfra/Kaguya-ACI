# Changelog

## 0.1.0-foundation.1 — Custom Foundation pivot

### Added
- Maintainable VoxTerra source tree committed directly under `voxterra/`.
- Custom Foundation client HUD module.
- Permanent crosshair removal through Fabric's 26.2 HUD element API.
- Contextual vanilla hotbar: appears for 2.2 seconds after a selected-slot change and while an item is actively used.
- Original vanilla hotbar renderer is retained, so item sprites are never faded or made translucent by VoxTerra.

### Changed
- VoxTerra is now the custom gameplay/immersion core of the modpack rather than the terrain/climate provider.
- Lithosphere and Serene Seasons are expected to provide terrain and seasons externally.
- Client-only Foundation behaviour is isolated behind the Fabric client entrypoint.

### Removed from active runtime
- Experimental custom VoxTerra world preset and terrain registration.
- Experimental VoxTerra hydrology/world generation runtime.
- Experimental VoxTerra seasonal/weather runtime.
- `/voxterra climate` and `/voxterra season` debug commands tied to the rejected world/climate prototype.

### Historical prototype

## 0.1.1 — Worldgen hotfix + terrain morphology

### Fixed
- Removed climate, moisture and slope evaluation from the terrain density hot path.
- Prevented concurrent chunk workers from redundantly rebuilding the same hydrology tile.
- Replaced boxed `Integer[]` hydrology sorting with a primitive `int[]` sort.
- Reworked generated river filling to avoid `Level#setBlock` update cascades.
- Added a sparse per-chunk river probe so non-river chunks skip the expensive full 16x16 pass.

### Changed
- Reworked continental relief to use narrow, connected tectonic uplift belts rather than broad dome-like ridge noise.
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
