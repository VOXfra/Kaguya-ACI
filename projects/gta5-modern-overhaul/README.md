# GTA V Modern World Overhaul

## Goal

Rebuild the experience of **playing GTA V's original story** with the visual quality, usability, physicality and world credibility expected from a modern Rockstar title, while preserving GTA V's campaign and map.

This is **not** a replacement campaign and not a recreation of GTA VI missions.

The project is designed around four principles:

1. **Visual quality first.** If the game still looks like 2013, the rest of the overhaul cannot sell the experience.
2. **Persistent consequences.** People, vehicles, properties, wildlife, damage and investigations continue to exist when the player is not looking.
3. **Procedural over bespoke whenever possible.** Generic IK, interaction, wardrobe, job and simulation systems should produce thousands of believable outcomes instead of requiring thousands of hand-authored scenes.
4. **Story compatibility is non-negotiable.** Every subsystem must be virtualizable, paused, overridden or restored when a vanilla mission requires canonical world state.

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

## Player role in development

The implementation is intended to minimize manual technical work by the user. Development should favor automated asset discovery, conversion, packaging, validation and diagnostics. The user should mainly need to install/run builds, launch GTA V Enhanced and report visual/runtime results.

## Working branch

`gta5-modern-world-overhaul`

See:

- `docs/ARCHITECTURE.md`
- `docs/TODO.md`
- `docs/ROADMAP.md`
- `docs/STORY_COMPATIBILITY.md`
- `docs/DATA_MODEL.md`
