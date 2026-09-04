# Initial Persistent World Data Model

This is intentionally implementation-neutral. Exact serialization/storage is chosen after the Enhanced runtime audit.

## Person

```text
PersonId
AliveState
BirthDate/AgeBand
BodyState
AppearanceState
HairState
BeardState
TattooProfile
MakeupState
NailState
StyleProfile
WardrobeId
InventoryId
HouseholdId?
ResidenceId?
WorkplaceId?
SchoolId?
OwnedVehicleIds[]
RelationshipIds[]
HealthState
HygieneState
HungerState
FatigueState
CurrentActivity
ScheduleProfile
DrivingProfile
SocialMemory[]
LegalState
LastKnownRegion
SimulationTier
```

## Household

```text
HouseholdId
MemberIds[]
GuardianRelationships[]
ResidenceId
OwnedVehicleIds[]
SharedInventoryId
FinanceProfile
MoveState
```

## Property / Lot

```text
PropertyId
LotId
OwnerEntityId
ResidentHouseholdIds[]
BlueprintId
ConditionState
DamageState
ConstructionState
SecurityState
UtilityState
InteriorState
GarageState
ForSaleState
MissionProtectionLevel
```

## Vehicle

```text
VehicleId
ModelId
OwnerEntityId
HomeParkingLocation
PlateIdentity
SecurityProfile
Keys/AccessState
TrackerState
StolenState
ConditionState
Fuel/PowerState
FireState
Cargo/InventoryId
LastKnownRegion
SimulationTier
```

## Garment

```text
GarmentId
GarmentType
StyleTags[]
Size
StretchRange
MorphCompatibility
OwnerPersonId
StorageLocation
EquippedState
Condition
Dirt
Wetness
Damage
```

## Animal

```text
AnimalId
SpeciesId
Age
Sex
Health
BodyCondition
TerritoryId
GroupId?
ParentIds[]
OffspringIds[]
Hunger
Thirst
ReproductiveState
BehaviorState
StudyState
CarcassState?
LastKnownRegion
SimulationTier
```

## Wildlife Population

```text
PopulationId
SpeciesId
HabitatCellIds[]
AdultCount
JuvenileCount
BirthRateState
MortalityState
FoodPressure
PredationPressure
MigrationState
```

## Crime Case

```text
CaseId
IncidentType
StartTime
Locations[]
VictimIds[]
SuspectIds[]
WitnessIds[]
VehicleIds[]
EvidenceNodes[]
CameraObservations[]
OfficerAssignments[]
CaseStatus
ConfidenceLinks[]
```

## Incident

```text
IncidentId
IncidentType
Location
StartTime
Severity
PeopleInvolved[]
VehiclesInvolved[]
PropertyInvolved[]
RequiredServices[]
RoadState
ResolutionState
```

## Construction Site

```text
ConstructionId
PropertyId
TargetBlueprintId
WorkOrders[]
MaterialInventory
RequiredEquipment[]
AssignedWorkers[]
LogisticsOrders[]
Progress
SiteObjects[]
SimulationTier
```

## Business

```text
BusinessId
PropertyId
OwnerEntityId
EmployeeIds[]
OpeningHours
InventoryState
DeliveryOrders[]
DamageState
OperatingState
```

## Event design rule

Cross-system changes should be represented by events. Example chain:

```text
PersonDied(PersonId)
  -> WorkplaceVacancyCreated
  -> HouseholdUpdated
  -> GuardianshipEvaluationRequested
  -> EstateEvaluationRequested
  -> PropertyOccupancyChanged
  -> VehicleOwnershipReviewRequested
```

The downstream systems choose outcomes; `PersonDied` does not hard-code them.

## Persistence rule

GTA runtime handles are transient adapters. Persistent systems refer to stable IDs from this model.
