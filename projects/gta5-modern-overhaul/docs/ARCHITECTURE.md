# Architecture

## 1. Architectural objective

The overhaul must behave as a **single world platform**, not a pile of unrelated mods. Systems communicate through shared entity IDs, events and persisted state.

The runtime is split into two layers:

- **High-fidelity local simulation** near the player.
- **Abstract background simulation** for distant entities and regions.

The same persistent entity can move between both layers without losing identity or state.

---

## 2. Core runtime

### 2.1 Entity Registry
Stable IDs for:

- people
- households
- animals
- vehicles
- properties/lots
- businesses
- objects of interest
- crimes/cases
- construction sites
- emergency incidents

No important persistent entity should be represented only by a transient GTA handle.

### 2.2 World State Database
Stores persistent state independently of whether GTA currently has the entity streamed.

Responsibilities:

- save/load
- versioned schemas
- migration between mod versions
- periodic snapshots
- crash-safe writes
- region state
- canonical story state overlays

### 2.3 Event Bus
Systems communicate through structured events rather than direct hard-coded dependencies.

Examples:

- `PersonDied`
- `VehicleStolen`
- `CameraObservedPlate`
- `PropertyDamaged`
- `FireStarted`
- `PatientAdmitted`
- `HouseholdMoved`
- `GarmentLost`
- `AnimalCarcassCreated`
- `MissionStarted`

### 2.4 Spatial Simulation Manager
Defines simulation fidelity by distance/relevance.

**Tier 0 — Physical**
Full GTA entities, animations, IK, collisions and local AI.

**Tier 1 — Local abstract**
Exact route/task progression without full physical entities.

**Tier 2 — Regional**
Schedule/event progression, travel ETA, population/economic updates.

**Tier 3 — Dormant**
Only long-term state changes.

---

## 3. Story Compatibility Layer

Every world-changing feature must declare whether it can affect mission-critical entities.

The layer provides:

- mission detection
- canonical-state overlays
- temporary restoration of required buildings/doors/vehicles
- suspension of conflicting ambient events
- mission-safe population control
- post-mission restoration of persistent world state
- hard exclusions for scripts known to be fragile

The persistent state is not deleted when a canonical mission overlay is active.

---

## 4. Visual Foundation

### 4.1 Asset Pipeline
Tool-driven pipeline around GTA V Enhanced resources:

1. discover asset in world
2. locate dependent resources
3. export source
4. convert/edit
5. validate LOD/material/collision/RT compatibility
6. package as non-destructive override
7. launch comparison test
8. capture diagnostics

Target tool ecosystem includes CodeWalker, OpenIV where useful, OpenRPF, Blender/Sollumz and custom VOX automation.

### 4.2 Character Rendering
Separate body and garments.

Targets:

- improved face/body geometry
- skin/eyes/teeth
- strand/card hybrid hair experimentation
- beard volume
- makeup overlays
- nails
- tattoos
- piercings/jewelry
- body morphs
- garment stretch/morph compatibility
- garment secondary motion
- dirt/wetness/damage

### 4.3 Vehicle Rendering
Targets:

- coherent modern materials
- clearcoat/paint
- glass
- rubber/plastic/chrome/carbon
- detailed lamps with internal depth
- physically plausible emissive/light-source relationship
- improved interiors
- better damage presentation

### 4.4 World Rendering
Targets:

- vegetation replacement and variation
- modern terrain/material response
- lighting-source logic using Enhanced RT capabilities
- weather/atmosphere
- volumetrics
- water and underwater environment
- particles
- snow/mud/sand deformation research

---

## 5. Character Identity System

A person is built from independent layers:

- identity
- age
- body morphology
- health state
- appearance
- hair/beard growth
- tattoos
- makeup/nails
- style profile
- owned wardrobe
- accessories
- gait/posture/mood
- relationships
- household
- work/school role
- vehicle ownership
- routines
- memories

Wardrobes use style tags and outfit rules, not unrestricted random combinations.

Hair and beard growth are persistent for protagonists and NPCs. Hair accessories include clips, ties/scrunchies, bands and compatible extension systems where technically viable.

---

## 6. Physical Garment & Inventory Layer

Garments are separate items with:

- size
- stretch range
- body-fit compatibility
- style tags
- condition
- cleanliness
- wetness
- owner
- storage location

Stores/online shops can stock multiple sizes. Putting on/removing clothes should use procedural interaction plus reusable animation primitives rather than instant menu swaps whenever the context permits.

Portable objects such as hats and umbrellas remain physical/persistent when dropped. Umbrellas fold and remain carried/stored instead of being disposable rain props.

---

## 7. Interaction / IK / True Body

Shared procedural layer for player and NPCs:

- body placement
- hand target selection
- hand pose selection
- arm IK
- foot IK
- head/eye look targets
- object constraints
- context-aware alignment

Used by:

- doors and handles
- vehicle doors/trunks/hoods
- furniture
- light switches
- televisions/radios
- pickups
- clothes
- umbrellas
- tools
- construction
- melee
- hospital interactions

True-body first-person camera follows the actual body/head with configurable stabilization and anti-clipping rather than acting as an independent floating camera.

---

## 8. Persistent Society

### 8.1 People & Households
Persistent people normally belong to a logical residence or temporary accommodation.

Households may contain multiple adults, children and dependants. Exceptions include visitors, tourists, homeless people, institutional residents and transient workers.

### 8.2 Routines
Schedules reference logical activities rather than fixed animations:

- sleep
- hygiene
- meal
- commute
- work
- school
- shopping
- recreation
- social visit
- exercise

Near the player these become physical actions; far away they resolve abstractly.

### 8.3 Privacy & Home Security
Entering an occupied home without permission can trigger:

- suspicion
- verbal confrontation
- retreat/panic
- police call
- alarm
- dog response
- defensive behavior using objects/weapons that the resident can plausibly access

Weapons are never spawned magically from the body: a resident must already carry one or retrieve it from a plausible storage location.

### 8.4 Life Events
Supported long-term events include:

- birth/adoption/guardianship
- relationship changes
- moving home
- job changes
- illness/injury
- death
- estate/property transfer
- foster placement when no responsible guardian remains

Children are non-combatants by design and AI systems avoid involving them in combat. They are not implemented as magically invulnerable or disappearing entities.

---

## 9. Properties, Interiors & Construction

### 9.1 Lots
A lot is separate from its current building blueprint.

A destroyed property may:

- be repaired to original form
- use an alternate compatible blueprint
- be renovated/extended
- remain abandoned
- be sold
- be purchased by the player or NPCs

### 9.2 Interior Generation
Use modular interior kits and coherent archetypes to scale to hundreds of accessible interiors.

Interior objects expose interaction sockets and destruction metadata.

### 9.3 Reconstruction Simulation
Damage produces work orders and material/logistics requirements.

Physical near-player simulation can include:

- workers
- debris removal
- deliveries
- dumpsters
- scaffolding
- temporary fencing
- cranes/lifting equipment when needed

Distant construction progresses abstractly using the same work-order state.

---

## 10. Crime, Evidence & Black Market

### 10.1 Evidence Graph
Cases can link:

- people
- clothing description
- faces
- plates
- vehicles
- CCTV
- witnesses
- locations
- weapons
- shell casings
- blood/other supported traces
- time windows

Investigations reason over relationships rather than instantly knowing the player's identity.

### 10.2 Black Market
Supports plausible criminal services such as:

- stolen-vehicle disposal/export
- chop shops
- laundering identifiers where technically modeled
- illegal weapon trade
- disposal/alteration of traceable criminal equipment within gameplay abstraction

This system exists to create consequences and counterplay, not to provide real-world evasion instructions.

---

## 11. Vehicles

Each vehicle can have persistent ownership and a security profile driven by era/value/model.

Possible systems:

- mechanical lock
- alarm
- electronic immobilizer
- keyless access
- tracker
- remote disable where appropriate to the fictional vehicle technology
- stolen status
- plate/identity state

Vehicle fires use component/state logic. Burning does not imply a cinematic whole-car explosion; tires, fuel vapors, pressurized components and batteries can create localized events.

AI drivers use persistent or generated driving profiles rather than one generic traffic behavior.

---

## 12. Emergency & Civic Systems

Incidents generate actual service needs.

Examples:

- police scene control
- ambulance treatment and transport
- stretcher loading
- hospital admission
- coroner/body transport
- towing
- road closure/reopening
- fire response
- utility repair

NPC casualties update persistent identities and downstream household/property state.

---

## 13. Wildlife & Ecology

Persistent populations and individuals use:

- species
- age
- sex
- health
- territory
- hunger/thirst
- reproduction
- offspring
- social group
- predator/prey relationships
- migration
- weather/season response

Near-player animals use detailed behavior; distant populations use ecological simulation.

Hunting supports study, tracking, carcass persistence, skinning/butchering abstractions, quality, meat/parts and sale where appropriate.

Aquatic ecosystems include fish schools, turtles and other habitat-appropriate fauna plus a full underwater visual overhaul.

---

## 14. Environment

### Seasons/calendar
A persistent calendar controls:

- sunrise/sunset
- day length
- seasonal weather
- vegetation state
- animal behavior
- clothing choices
- fire risk

Target day length is configurable, with an initial design target around 90–120 real minutes per full game day so life systems are meaningful without requiring constant needs management.

### Fire
Fire propagates through spatial cells using fuel, moisture, wind, slope and weather. Damage persists and can trigger evacuation, firefighting, property loss and reconstruction.

### Surface deformation
Research layer for snow, mud and sand with depth/deformation, footprints, tire ruts, displaced material and weather-driven recovery where feasible in RAGE.

---

## 15. Extended Content Adapter

A fourth custom/freemode protagonist may serve as the bridge to adapted GTA Online content.

AI crew candidates can include story characters when alive/available and appropriate to story state. Crew requirements should be converted from network-player assumptions into role requirements that AI companions can satisfy.

North Yankton and Cayo Perico are treated as region-integration projects, with strict story/world-state compatibility.

---

## 16. Performance rule

No feature is allowed to require full-fidelity simulation of the entire map simultaneously.

The project must prefer:

- spatial LOD
- event-driven updates
- pooled entities
- deterministic regeneration from persisted state
- asynchronous/offscreen abstract simulation
- cached asset metadata

The illusion of a living world comes from **continuity**, not from brute-forcing every entity every frame.
