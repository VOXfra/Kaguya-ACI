# Roadmap

The project is too large for feature-by-feature development. Each phase must first prove a reusable platform capability, then scale it.

## Phase 0 — Tooling and technical audit

**Goal:** know what GTA V Enhanced will let us replace safely and automate the repetitive work.

Deliverables:

- Enhanced plugin/runtime bootstrap
- logging + crash diagnostics
- automatic game/build detection
- asset locator
- CodeWalker/OpenIV/OpenRPF/Sollumz interoperability tests
- material/shader/LOD/RT compatibility tests
- automated package/install script
- baseline performance capture
- story mission detection proof-of-concept

Exit criteria:

- one-command build/install for test packages
- reliable restore/disable path
- known method to identify an on-screen asset and replace it non-destructively

## Phase 1 — Visual vertical slice

**Goal:** determine whether GTA V Enhanced can visually approach the target strongly enough to justify full production.

Use one controlled area containing:

- one protagonist
- several NPC types
- vehicles
- vegetation
- road/building materials
- exterior + interior
- daylight + night + rain

Implement first-pass:

- skin/eyes/hair/beard
- clothing materials
- vegetation
- vehicle/headlamp materials
- lighting-source logic
- weather/atmosphere
- key world materials

Exit criteria:

- side-by-side comparison proves a major generational jump over Enhanced vanilla
- blockers are identified by layer (renderer, shader, asset format, performance)

## Phase 2 — Core persistence + story compatibility

**Goal:** create the platform every living-world feature depends on.

Deliverables:

- Entity Registry
- World State DB
- Event Bus
- Spatial Simulation Manager
- Story Compatibility Manager
- persistent person/vehicle/property prototypes
- canonical mission overlay proof-of-concept

Validation scenario:

1. create a persistent resident with a home and car
2. follow them home
3. leave region
4. advance time
5. return and find them in a coherent new state
6. start a vanilla mission requiring the area
7. confirm mission works
8. restore persistent world state afterwards

## Phase 3 — Character platform

**Goal:** one modern character pipeline shared by protagonists and NPCs.

Deliverables:

- separated body/garment architecture
- morphology controls
- hairstyle/beard system
- growth state
- tattoos/makeup/nails/accessories
- style profiles and owned wardrobes
- garment sizes/stretch prototype
- procedural changing-clothes prototype
- True Body + procedural IK foundation

Validation scenario:

A persistent NPC changes appearance naturally over several in-game days without losing identity; Franklin/Trevor/Michael use the same underlying appearance systems.

## Phase 4 — Interaction and interiors

**Goal:** prove reusable physical interaction instead of bespoke scripted scenes.

Deliverables:

- interaction sockets
- hand/foot IK
- natural door handles
- vehicle doors/trunks/hoods
- switches/TV/radio
- physical pickups
- umbrellas
- modular interior kit
- functional garage prototype

Validation scenario:

Resident arrives home, opens garage, parks, closes it, enters via a handled door, uses lights/TV and changes clothes without bespoke house-specific choreography.

## Phase 5 — Society simulation

**Goal:** make NPCs exist independently of the player.

Deliverables:

- households
- jobs
- schedules
- commutes
- social memory
- privacy/trespass
- relationships
- ageing
- moving home
- death/estate/guardianship flows
- driving profiles

Validation scenario:

A household can live for several simulated weeks, commute, shop, change routines and react persistently to a major event without full-time physical simulation.

## Phase 6 — Crime, police and emergency services

**Goal:** consequences become systemic.

Deliverables:

- witnesses/CCTV/evidence graph
- logical police searches
- stops/frisks/arrests
- independent crimes/pursuits
- gangs
- ambulance/stretcher/hospital
- coroner/morgue
- towing/road reopening
- black-market gameplay layer
- vehicle theft/security progression

Validation scenario:

An NPC-generated pursuit ends in injuries/death; services physically process the scene, identities update, vehicles are removed, household/property consequences occur and the player may encounter the aftermath later.

## Phase 7 — Wildlife and ecology

**Goal:** meet or exceed RDR2's systemic wildlife philosophy.

Deliverables:

- persistent populations
- individual state
- territories
- predator/prey logic
- reproduction/juveniles
- carcass/decomposition
- study/compendium
- skinning/parts/sale
- aquatic fauna
- underwater overhaul

Validation scenario:

A local ecosystem changes over weeks because of predation, weather, hunting and fire, then partially recovers without direct player scripting.

## Phase 8 — Environment, seasons, fire and reconstruction

**Goal:** the physical world changes and repairs itself.

Deliverables:

- calendar/seasons/day length
- weather/environmental state
- wildfire propagation
- persistent burn/damage states
- property lots and rebuild blueprints
- construction planning
- logistics/workers/equipment
- near-player physical construction
- offscreen construction abstraction

Validation scenario:

A fire damages a property, services respond, the property becomes condemned/sold/owned, a rebuild plan is selected, materials arrive and a visible multi-stage reconstruction completes over time.

## Phase 9 — Deformation and destruction

**Goal:** progressively replace GTA's static-world assumptions.

Deliverables:

- snow/mud/sand deformation prototypes
- destructible props/furniture
- destructible prepared interior walls
- pre-fracture tooling
- structural graph prototype
- selected destructible building
- dynamic local navigation around debris

This phase remains gated by renderer/physics/performance research.

## Phase 10 — Extended regions and Online-to-SP adapter

**Goal:** add meaningful world/content expansion without compromising vanilla story compatibility.

Deliverables:

- custom/freemode fourth protagonist
- crew roster
- role-based AI mission adapter
- story-state-aware crew availability
- Online/Solo map-state virtualization
- North Yankton integration
- Cayo Perico integration where viable

## Production rule

Never scale a feature to the whole map until a vertical slice proves:

1. visual quality
2. runtime stability
3. persistence correctness
4. story compatibility
5. acceptable performance
6. automation of repetitive asset work
