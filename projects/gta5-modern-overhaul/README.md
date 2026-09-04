# GTA V Modern World Overhaul

## Goal

Rebuild the experience of **playing GTA V's original story** with the visual quality, usability, physicality and world credibility expected from a modern Rockstar title, while preserving GTA V's campaign and map.

This is **not** a replacement campaign and not a recreation of GTA VI missions.

The project is designed around four principles:

1. **Visual quality first.** If the game still looks like 2013, the rest of the overhaul cannot sell the experience.
2. **Persistent consequences.** People, vehicles, properties, wildlife, damage and investigations continue to exist when the player is not looking.
3. **Procedural over bespoke whenever possible.** Generic IK, interaction, wardrobe, job and simulation systems should produce thousands of believable outcomes instead of requiring thousands of hand-authored scenes.
4. **Story compatibility is non-negotiable.** Every subsystem must be virtualizable, paused, overridden or restored when a vanilla mission requires canonical world state.

## Development contract

`AGENT.md` is authoritative for work on this project. It defines the continuous-checkpoint rule, blocker/root-cause protocol, validation gates, ask-before-guessing rule for subjective decisions, traceability requirements, packaging requirements and story-safety constraints.

The user is not expected to author code/assets. Normal user involvement should be limited to installing a checkpoint, launching GTA V Enhanced and returning logs/screenshots/video or subjective feedback when requested.

## Current checkpoint

**0.0.1-dev.8 — Diagnostic ASI bootstrap**

Engineering validation is complete through D3:

- Windows/MSVC core build and tests;
- Linux core build and tests;
- ASan + UBSan;
- Windows x64 `.asi` compilation;
- synthetic `gta5_enhanced.exe` host loading the generated `.asi`;
- exact `CHECKPOINT_OK` bootstrap marker;
- reproducible GTA-root ZIP creation and content verification.

The next gate is D4: actual GTA V Enhanced loading on the user's installation. No gameplay hook or world mutation is active in this checkpoint.

## Primary pillars

### 01 — Visual Foundation
Characters, skin, eyes, hair, beards, makeup, nails, tattoos, clothing, garment materials, vehicle quality, headlights, glass, interiors, world materials, vegetation, lighting/RTGI behavior, weather, volumetrics, water, underwater environment, particles, snow, mud and surface deformation.

### 02 — Character & Physical Interaction
True-body first person, head-linked camera, procedural hand/foot IK, door handles, vehicle doors, physical pickups, furniture, clothing changes, hair accessories, umbrellas, contextual interaction and melee.

### 03 — Persistent Society
Persistent NPC identities, households, jobs, schedules, homes, vehicles, wardrobes, relationships, privacy, health state, ageing, births/deaths, moves, property transfers, routines and social memory.

### 04 — World Simulation
Police, gangs, independent criminals, witnesses, cameras, investigations, emergency services, hospitals, morgue transport, traffic incidents, infrastructure, businesses, waste, utilities, construction, fire, reconstruction and seasons.

### 05 — Wildlife & Ecology
RDR2-class or better animal logic, persistent populations, territories, predation, ageing, reproduction, young animals, carcasses, study/compendium, hunting, skinning, meat/parts and ecological consequences.

### 06 — Vehicles & Crime Economy
Vehicle security by era/value, alarms, immobilizers, trackers, remote blocking where appropriate, theft methods, evidence, black market, chop shops, export, laundering, realistic fire behavior and persistent ownership.

### 07 — Life, Activities & Progression
Eating, sleep, hygiene, body-fat/muscle evolution, gym/sports, canoe/kayak, diving, fishing, study, shopping, online orders and properties.

### 08 — Extended Regions & Content Adaptation
North Yankton as a properly usable region, Cayo Perico integration where technically viable, and an adapter layer for selected GTA Online content in single-player with AI crew support.

## Working branch

`gta5-modern-world-overhaul`

See:

- `AGENT.md`
- `PATCHNOTES.md`
- `docs/ARCHITECTURE.md`
- `docs/TODO.md`
- `docs/TODO_PHASE0.md`
- `docs/TODO_TRANSVERSAL.md`
- `docs/STATUS.md`
- `docs/QUALITY_GATES.md`
- `docs/DEV_LOG.md`
- `docs/ROADMAP.md`
- `docs/STORY_COMPATIBILITY.md`
- `docs/DATA_MODEL.md`
