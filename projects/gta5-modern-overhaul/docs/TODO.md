# Validated TODO

This file is the frozen high-level feature inventory for the first architecture cycle. New ideas should be attached to an existing subsystem whenever possible instead of creating isolated systems.

## P0 — Foundations

- [ ] GTA V Enhanced runtime/plugin bootstrap
- [ ] Structured logging and crash diagnostics
- [ ] Versioned config system
- [ ] Persistent entity ID system
- [ ] World-state database with migrations
- [ ] Event bus
- [ ] Spatial simulation tiers
- [ ] Mission/story detection
- [ ] Story Compatibility Manager
- [ ] Asset discovery/export/override pipeline
- [ ] Automated build/package/install workflow
- [ ] Debug overlay for entities, schedules, crimes, wildlife and construction

## P1 — Visual Foundation

### Characters
- [ ] Modern protagonist face/body quality
- [ ] Modern NPC quality baseline
- [ ] Skin shader/material overhaul
- [ ] Eyes/teeth
- [ ] Hair overhaul
- [ ] Beard overhaul
- [ ] Persistent hair/beard growth
- [ ] Hair cutting/styling
- [ ] Hair accessories: clips, ties/scrunchies, bands, compatible extensions
- [ ] Makeup system
- [ ] Nails / polish / optional nail art
- [ ] Tattoos with coherent-style, mixed/random and no-tattoo profiles
- [ ] Piercings/jewelry/accessories
- [ ] Dirt/wetness/sweat presentation
- [ ] Body morph system: fat/muscle/age/posture

### Clothing
- [ ] Body and garments separated
- [ ] Multiple garment sizes
- [ ] Stretch/body-fit behavior
- [ ] Garment morph compatibility with fat/muscle changes
- [ ] Modern fabric/material response
- [ ] Secondary garment movement
- [ ] Physical hats/accessories
- [ ] Persistent dropped hats/accessories
- [ ] Coherent style-tag system
- [ ] Owned wardrobes for player/NPCs
- [ ] Procedural/reusable changing-clothes interactions

### Vehicles
- [ ] Modernized exterior materials
- [ ] Modernized interiors
- [ ] Headlamp/tail-lamp internal geometry/depth
- [ ] Plausible light emitters tied to visible sources
- [ ] Glass/clearcoat/chrome/plastic/rubber improvement
- [ ] Damage presentation overhaul
- [ ] Vehicle LOD quality audit

### World
- [ ] Vegetation families replacement
- [ ] Vegetation variation and wind response
- [ ] Terrain/road/building material overhaul
- [ ] RTGI/lighting-source logic audit
- [ ] Night lighting overhaul
- [ ] Weather/sky/volumetrics
- [ ] Water overhaul
- [ ] Underwater terrain/material overhaul
- [ ] Particles/smoke/dust
- [ ] Snow visual overhaul
- [ ] Mud visual overhaul
- [ ] Surface deformation R&D

## P1 — Character / Animation / Interaction

- [ ] True-body first-person
- [ ] Head-linked stabilized first-person camera
- [ ] Full body visibility
- [ ] Procedural arm/hand IK
- [ ] Procedural foot placement
- [ ] Head/eye look targets
- [ ] Generic interaction socket system
- [ ] Natural door-handle interaction
- [ ] Natural vehicle-door/trunk/hood interaction
- [ ] Physical pickup/place/drop system
- [ ] Furniture interactions
- [ ] Light switch interaction
- [ ] TV/radio/device interaction
- [ ] Umbrella deploy/fold/carry/store behavior
- [ ] Contextual melee overhaul inspired by GTA VI/RDR2
- [ ] Non-linear animation variation layer

## P2 — Persistent People & Society

- [ ] Persistent identities
- [ ] Persistent households
- [ ] Persistent home assignment
- [ ] Temporary accommodation exceptions
- [ ] Jobs and workplaces
- [ ] School/education roles
- [ ] Daily routines
- [ ] Commutes
- [ ] Household-owned vehicles
- [ ] Garages that actually open and accept resident vehicles
- [ ] Residents lock/unlock homes
- [ ] Multi-person households
- [ ] Children/dependants with responsible adults
- [ ] Guardianship/foster transfer when required
- [ ] Ageing
- [ ] Relationship state
- [ ] Household formation/separation
- [ ] Birth/adoption support as long-term simulation
- [ ] NPC social memory
- [ ] Privacy/trespass reactions
- [ ] Plausible access to defensive objects/weapons
- [ ] No magical weapon draw from nowhere
- [ ] NPC body weight/muscle evolution from habits
- [ ] Health-risk abstraction
- [ ] Death permanence
- [ ] Estates/property transfer
- [ ] Moving-house logistics
- [ ] Moving trucks and visible relocation

## P2 — Needs, Lifestyle & Commerce

- [ ] Longer configurable day cycle (initial target 90–120 min)
- [ ] Hunger/nutrition without Tamagotchi-style spam
- [ ] Sleep/fatigue
- [ ] Hygiene/showering
- [ ] Social reaction to poor hygiene
- [ ] Food/drink physical consumption
- [ ] Physical waste/packaging
- [ ] Bins and garbage collection
- [ ] Gym and sports progression
- [ ] Muscle gain
- [ ] Fat gain/loss
- [ ] Canoe/kayak
- [ ] Jet-ski NPC behavior overhaul
- [ ] Diving/snorkeling
- [ ] Fishing
- [ ] Animal study/compendium
- [ ] Physical stores
- [ ] Online clothing orders
- [ ] Online vehicle orders
- [ ] Online accessory orders
- [ ] Online food orders
- [ ] Delivery logistics

## P2 — Properties & Interiors

- [ ] Lot/property data model
- [ ] Purchaseable abandoned/sold properties
- [ ] Save/sleep/live in owned properties
- [ ] Property storage
- [ ] Utilities/devices
- [ ] Modular interior kit
- [ ] Hundreds-of-interiors generation pipeline
- [ ] Interactive furniture
- [ ] Physical drawers/cabinets where added
- [ ] Functional residential garages
- [ ] Multiple compatible rebuild blueprints per lot
- [ ] Repair planning and pricing
- [ ] Construction work orders
- [ ] Material deliveries
- [ ] Workers with real jobs/tasks
- [ ] Temporary fencing/scaffolding/dumpsters
- [ ] Crane/lifting equipment when required
- [ ] Near-player physical construction simulation
- [ ] Offscreen abstract construction progression
- [ ] Abandoned/condemned states

## P2 — Crime, Police & Forensics

- [ ] Logical police detection/search
- [ ] Witnesses
- [ ] CCTV
- [ ] Face/clothing/plate observation
- [ ] Evidence graph
- [ ] Location/vehicle relationship inference
- [ ] Crime-scene persistence
- [ ] Scene closure/tape/cones
- [ ] Police stops in neighborhoods
- [ ] Physical searches/frisks
- [ ] Wall/vehicle positioning using procedural alignment
- [ ] Handcuff/arrest/transport
- [ ] Independent NPC criminals
- [ ] Ambient pursuits that begin without the player
- [ ] Gang activity and territories
- [ ] Gang routines and consequences
- [ ] Shell casing / supported evidence cleanup by authorities
- [ ] Black market
- [ ] Illegal weapon economy abstraction
- [ ] Counterplay for traceable in-game criminal equipment
- [ ] Judicial consequences / fines / impound / record abstraction

## P2 — Emergency Services & Healthcare

- [ ] Incident dispatch system
- [ ] Police response based on actual incident needs
- [ ] Fire response
- [ ] Ambulance response
- [ ] Physical stretcher loading
- [ ] Real transport to hospital
- [ ] Hospital interior
- [ ] Hospital bed respawn flow
- [ ] Clothing/equipment recovery after treatment
- [ ] Coroner/body-bag flow
- [ ] Real transport to morgue
- [ ] Tow trucks
- [ ] Road closure and reopening
- [ ] Utility repair crews

## P2 — Vehicles & Ownership

- [ ] Persistent vehicle ownership
- [ ] Vehicle security profile by era/value/model
- [ ] Mechanical lock theft path
- [ ] Alarm systems
- [ ] Immobilizers
- [ ] Keyless/security systems
- [ ] Trackers
- [ ] Remote disabling where fictionally appropriate
- [ ] Stolen vehicle status
- [ ] Chop shop
- [ ] Export stolen vehicles
- [ ] Vehicle identity laundering abstraction
- [ ] More varied AI driving personalities
- [ ] Vehicle condition persistence
- [ ] Realistic fire behavior
- [ ] Tires burst/burn without mandatory whole-car explosion
- [ ] Localized component failures/explosive events

## P2 — Wildlife & Ecology

- [ ] RDR2-class behavior baseline
- [ ] Persistent wildlife populations
- [ ] Persistent individuals where relevant
- [ ] Territories/habitats
- [ ] Predator/prey logic
- [ ] Social groups
- [ ] Hunger/thirst/rest
- [ ] Ageing
- [ ] Reproduction
- [ ] Baby/juvenile animals
- [ ] Seasonal behavior
- [ ] Weather/fire response
- [ ] Migration/recolonization
- [ ] Carcass persistence
- [ ] Scavengers/decomposition
- [ ] Study/compendium
- [ ] Tracking
- [ ] Skinning/butchering
- [ ] Meat/parts/skins
- [ ] Quality system
- [ ] Sale economy
- [ ] Aquatic fauna
- [ ] Fish schools
- [ ] Turtles and habitat-appropriate marine life

## P2 — Environment & Persistence

- [ ] Persistent calendar
- [ ] Seasons appropriate to San Andreas climate
- [ ] Seasonal day length
- [ ] Seasonal sun position/lighting integration
- [ ] Temperature/humidity
- [ ] Wind
- [ ] Rain state
- [ ] Dryness/fire risk
- [ ] Dynamic wildfire spread
- [ ] Structures/farms/homes can burn
- [ ] Evacuation logic
- [ ] Persistent burned landscape
- [ ] Vegetation recovery
- [ ] Persistent building damage
- [ ] No automatic reset on leaving/re-entering area
- [ ] Snow depth/deformation R&D
- [ ] Mud depth/deformation R&D
- [ ] Sand deformation R&D

## P3 — Audio

- [ ] Spatial sound overhaul
- [ ] Interior/exterior propagation
- [ ] Occlusion through doors/walls
- [ ] Reverb zones
- [ ] Gunshot acoustics inspired by Bodycam intensity
- [ ] Dynamic siren/reflection feel
- [ ] Weather/vegetation/water ambience
- [ ] AI hearing based on sound events

## P3 — Economy & Infrastructure

- [ ] Simplified personal finances for NPCs
- [ ] Business ownership/state
- [ ] Employees and opening hours
- [ ] Deliveries/restocking
- [ ] Business damage/closure/reopening
- [ ] Property market
- [ ] Utilities state: electricity/water/gas abstraction
- [ ] Power outages and repair
- [ ] Waste collection
- [ ] Public transport routes
- [ ] Bus/taxi/train use by NPC schedules

## P3 — Extended Regions / Online Adaptation

- [ ] Fourth custom/freemode protagonist in story environment
- [ ] Crew roster system
- [ ] Story-state-aware availability
- [ ] Michael/Franklin/Trevor/Lamar/Jimmy/etc. as possible crew where coherent
- [ ] Replacement crew when a story character is dead/unavailable
- [ ] Convert multiplayer player-count requirements into roles
- [ ] AI role execution
- [ ] Protect solo-story world variants from Online map changes
- [ ] North Yankton world-integration audit
- [ ] North Yankton population/traffic/fauna/interiors/activities
- [ ] North Yankton snow-system showcase
- [ ] Cayo Perico world-integration audit
- [ ] Cayo Perico free-roam usefulness

## P4 — Destruction

- [ ] Destructible small objects/furniture
- [ ] Doors/windows/barriers
- [ ] Destructible light walls in prepared interiors
- [ ] Pre-fracture pipeline
- [ ] Structural support graph R&D
- [ ] Selected structurally destructible buildings
- [ ] Dynamic local navigation around debris
- [ ] Persistent destruction state
- [ ] Mission canonical overlays for destroyed areas
- [ ] Progressive expansion of destructible-building coverage

## Asset/mod research backlog

- [ ] Catalogue existing Enhanced clothing packs
- [ ] Catalogue tattoo packs
- [ ] Catalogue hair/beard packs
- [ ] Catalogue makeup/nail/accessory mods
- [ ] Catalogue vegetation/vehicle/material mods
- [ ] Record license/permission for every external asset
- [ ] Use external mods only as reference unless redistribution/modification rights are clear
- [ ] Audit GitHub tools relevant to Enhanced asset processing
- [ ] Audit Hugging Face models useful for texture/material/mesh/animation assistance

## Explicit exclusions / non-goals

- [ ] Do not recreate GTA VI missions
- [ ] Do not replace GTA V's original story
- [ ] Do not require the user to manually author technical assets as a normal workflow
- [ ] Do not rely on leaked/proprietary source code or redistribute leaked Rockstar assets
- [ ] Do not let ambient systems permanently corrupt vanilla story missions
- [ ] Do not fake persistence by simply despawning consequences when the player leaves
