# VoxTerra Foundation

VoxTerra Foundation is the custom gameplay/immersion core of the VoxTerra realism modpack for Minecraft Java 26.2 on Fabric.

The project deliberately does **not** reimplement large systems that are already handled well by external mods. Lithosphere owns terrain generation, Serene Seasons owns the seasonal calendar, and rendering/performance remain the job of Iris, Sodium, Voxy and related optimisation mods.

VoxTerra instead owns the parts that define how the pack actually feels and plays.

## Foundation 0.1.0

### Custom HUD
- Permanent vanilla crosshair removed.
- Vanilla hotbar renderer is preserved at full opacity.
- Hotbar appears for 2.2 seconds when the selected slot changes.
- Hotbar remains visible while an item is actively being used.
- No alpha/fade is ever applied to item sprites, avoiding the transparent-hotbar issue seen with stacked HUD mods.

### Architecture
- Old experimental VoxTerra terrain/climate/season runtime has been removed from the active build.
- The source tree is now committed directly under `voxterra/` instead of being reconstructed from a hidden CI archive.
- Foundation is client/server safe: client-only HUD code lives behind the Fabric client entrypoint.
- Stone & Fire is the first gameplay module planned on top of Foundation.

## Requirements
- Minecraft Java 26.2
- Fabric Loader 0.19.3+
- Fabric API 0.158.0+26.2
- Java 25

## Modpack note
Remove Auto HUD and standalone crosshair-hiding mods when testing VoxTerra Foundation. They target the same vanilla HUD layers and are no longer needed.

## Direction
The objective is immersion and credible survival without turning realism into pointless friction. Systems are kept when they create interesting decisions or believable interactions; constraints that only make inventory management or routine actions annoying are not a goal.

The next playable milestone is **Stone & Fire**: gathering loose natural materials, primitive stone working, early wood processing, fire starting, cooking and a first-night survival loop.
