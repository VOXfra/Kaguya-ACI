# Transversal TODO — V0.1 Freeze

These systems cut across several pillars and are part of the validated V0.1 scope.

## UI / HUD / Inventory

- [ ] Modern HUD that can be contextually minimal
- [ ] GTA VI/RDR2-inspired weapon/equipment wheel
- [ ] Limited carried weapon logic
- [ ] Vehicle/home weapon storage
- [ ] General inventory for tools, food, clothing and physical objects
- [ ] Physical ownership/location for important inventory items
- [ ] Phone UI modernization
- [ ] Contextual prompts that do not overwhelm the screen
- [ ] Accessibility/configuration options for immersive systems

## Dialogue / Social / Phone

- [ ] Ambient contextual dialogue system
- [ ] NPC-to-NPC conversation state
- [ ] Phone calls/messages tied to persistent identities
- [ ] Contacts and crew communication
- [ ] Emergency calls from NPCs
- [ ] Social-media/news reaction layer where useful
- [ ] Conversation memory hooks into social memory/relationships

## Weapons / Gunplay

- [ ] Bodycam-inspired weapon handling feel without forcing a bodycam camera
- [ ] Weapon inertia/recoil/body response
- [ ] Muzzle flash that interacts plausibly with lighting
- [ ] Smoke/particles/impact response
- [ ] Environment-sensitive acoustics
- [ ] Physical magazine/ammunition representation where viable
- [ ] Weapon traceability/evidence integration
- [ ] Visible carried long guns where appropriate
- [ ] No magical inventory transitions when physical storage is expected

## Vehicles — mechanical layer

- [ ] Fuel/energy system
- [ ] Plausible refuelling/charging interactions
- [ ] Vehicle mechanical condition abstraction
- [ ] Damage influencing drivability
- [ ] Maintenance/repair flow
- [ ] Ownership/service history hooks
- [ ] NPC refuelling/maintenance schedules where simulation budget allows

## Navigation / Locomotion

- [ ] Local dynamic pathfinding layer for modified/destructible interiors and construction sites
- [ ] Obstacle avoidance around persistent debris/temporary objects
- [ ] Procedural character alignment before interactions
- [ ] Locomotion variation by age/body state/fatigue/injury/personality
- [ ] Mission-safe fallback to vanilla navigation where required

## Animation Production Pipeline

- [ ] Catalogue reusable GTA V/RDR2-like animation primitives that can legally be derived from installed game data where permitted
- [ ] Blender/Sollumz automation for import/export/retarget workflows
- [ ] Automated retargeting experiments
- [ ] IK-driven correction to reduce bespoke animation count
- [ ] Procedural pose/hand-grip library
- [ ] Animation validation for clipping, root motion and mission compatibility
- [ ] Evaluate open-source/GitHub animation tooling
- [ ] Evaluate appropriately licensed Hugging Face/local models for motion/pose assistance
- [ ] Never require the user to manually animate as the normal production path

## Asset / Generative Production Pipeline

- [ ] Texture upscaling/reconstruction pipeline
- [ ] PBR/material assistance pipeline
- [ ] Mesh enhancement/LOD generation pipeline
- [ ] Hair/garment asset assistance pipeline
- [ ] Licence/provenance manifest for every third-party asset/tool/model
- [ ] Automated visual QA where possible
- [ ] Human-in-the-loop final visual acceptance via in-game captures

## Performance / Stability Budgets

- [ ] CPU budget per high-fidelity simulated entity
- [ ] Background simulation update budgets
- [ ] Persistent database size/performance targets
- [ ] GPU/VRAM budgets for character, vegetation and vehicle upgrades
- [ ] LOD budgets and streaming limits
- [ ] RT/lighting performance budget
- [ ] Maximum active construction/emergency/wildlife scenes by tier
- [ ] Graceful degradation rules rather than hard feature failure
- [ ] Performance presets that preserve simulation correctness while changing visual density

## Save / Recovery / Testing

- [ ] Atomic world-state saves
- [ ] Rolling backups
- [ ] Schema migrations
- [ ] Corruption detection/recovery
- [ ] Deterministic test seeds for simulation debugging
- [ ] Replayable scenario tests
- [ ] Mission regression matrix
- [ ] Long-duration soak tests for population/economy/ecology drift
- [ ] Debug commands to inspect or repair orphaned entities

## Design freeze rule

The V0.1 feature inventory is considered broad enough to begin implementation. New ideas are allowed, but should be mapped onto an existing subsystem first. Architecture changes are justified only when a genuinely new class of state or simulation cannot fit the current model.
