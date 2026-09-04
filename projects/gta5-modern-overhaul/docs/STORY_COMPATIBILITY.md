# Story Compatibility Contract

## Rule

The original GTA V campaign must remain playable from beginning to end with the overhaul enabled.

No ambient system may permanently corrupt a mission-critical dependency.

## Mission overlay model

When a vanilla mission starts, the Story Compatibility Manager may temporarily create a canonical overlay containing:

- required building state
- required doors/props
- required vehicles
- required NPC availability
- required traffic/population rules
- required weather/time constraints if the mission depends on them
- disabled or deferred ambient incidents in the mission bubble

The persistent world underneath is preserved.

When the mission ends, the overlay is removed and persistent state is reconciled.

## Protected categories

Before modifying or destroying an entity, systems must query protection state.

Protection levels:

1. `NONE` — fully mutable.
2. `SOFT` — mutable outside active mission windows; canonical overlay available.
3. `HARD` — do not persist destructive changes because reliable mission restoration is not yet proven.
4. `SCRIPT_OWNED` — the vanilla mission currently controls this entity/area.

## Examples

### Destroyed mission building

Persistent world:

`Property #184 = heavily damaged`

Mission requires original building:

- activate canonical intact representation
- pause reconstruction workers in mission bubble
- run mission
- unload canonical representation
- restore damaged/reconstruction state

### Story character used as Online-adapter crew

Before selection:

- check alive/dead story state
- check current mission ownership
- check availability rules

A dead Trevor is never silently respawned as crew. A temporary story conflict makes him unavailable and the roster selects another valid character.

### Changed Online/Solo map variants

Online-derived content must never globally replace the solo map. Alternate map states are streamed/overlaid only when required and only in scopes proven safe.

## Testing

Every major system eventually requires automated/manual regression coverage across:

- prologue
- early Franklin missions
- Michael home/family missions
- Trevor introduction and Blaine County missions
- heists
- multi-protagonist missions
- finale branches
- post-story free roam

A feature is not considered production-ready if its only working configuration requires disabling the story campaign.
