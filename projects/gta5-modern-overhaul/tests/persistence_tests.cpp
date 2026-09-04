#include "vox/core/EntityRegistry.hpp"
#include "vox/core/GameThreadQueue.hpp"
#include "vox/core/WorldState.hpp"

#include <atomic>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

namespace {

int Fail(const std::string& message) {
    std::cerr << "FAIL: " << message << '\n';
    return 1;
}

std::string ReadFile(const std::filesystem::path& path) {
    std::ifstream stream{path, std::ios::binary};
    return std::string{std::istreambuf_iterator<char>{stream}, std::istreambuf_iterator<char>{}};
}

} // namespace

int main() {
    using vox::core::EntityId;
    using vox::core::EntityKind;
    using vox::core::EntityRecord;
    using vox::core::EntityRegistry;
    using vox::core::GameThreadQueue;
    using vox::core::LoadWorldStateFile;
    using vox::core::ParseWorldState;
    using vox::core::SaveWorldStateFileAtomic;
    using vox::core::SerializeWorldState;
    using vox::core::SnapshotWorldState;
    using vox::core::ValidateWorldState;
    using vox::core::WorldState;
    using vox::core::WorldStateLoadStatus;

    EntityRegistry registry{10};
    if (registry.Create(static_cast<EntityKind>(0)).has_value()) {
        return Fail("registry must reject unknown entity kinds");
    }

    const auto pedestrian = registry.Create(EntityKind::Pedestrian);
    const auto vehicle = registry.Create(EntityKind::Vehicle);
    if (!pedestrian || !vehicle || pedestrian->id.value() != 10 || vehicle->id.value() != 11) {
        return Fail("registry id allocation sequence failed");
    }
    if (!registry.Contains(pedestrian->id) || registry.size() != 2 || registry.next_entity_id() != 12) {
        return Fail("registry lookup/size/high-water invariant failed");
    }
    if (registry.InsertRestored(EntityRecord{EntityId::FromRaw(10), EntityKind::Pedestrian})) {
        return Fail("registry must reject duplicate restored IDs");
    }
    if (registry.InsertRestored(EntityRecord{EntityId::FromRaw(12), EntityKind::Animal})) {
        return Fail("registry must reject restored IDs at/above next id");
    }

    const WorldState snapshot = SnapshotWorldState(registry);
    std::string validationError;
    if (!ValidateWorldState(snapshot, &validationError)) {
        return Fail("valid registry snapshot rejected: " + validationError);
    }

    const std::string serialized = SerializeWorldState(snapshot);
    if (serialized.empty()) {
        return Fail("valid world state did not serialize");
    }
    std::string parseError;
    const auto parsed = ParseWorldState(serialized, &parseError);
    if (!parsed || parsed->nextEntityId != 12 || parsed->entities != snapshot.entities) {
        return Fail("world-state round trip failed: " + parseError);
    }

    std::string tampered = serialized;
    const auto vehicleToken = tampered.find("entity=11,2");
    if (vehicleToken == std::string::npos) {
        return Fail("test fixture could not find serialized vehicle");
    }
    tampered[vehicleToken + 7] = '9';
    if (ParseWorldState(tampered, &parseError).has_value() || parseError != "checksum_mismatch") {
        return Fail("tampered state must fail checksum validation");
    }

    WorldState duplicateState = snapshot;
    duplicateState.entities.push_back(duplicateState.entities.front());
    if (ValidateWorldState(duplicateState, &validationError) || validationError != "duplicate_entity_id") {
        return Fail("duplicate persistent IDs must fail closed");
    }

    const auto root = std::filesystem::temp_directory_path() / "vox_gta5_modern_overhaul" / "persistence_test";
    const auto statePath = root / "world_state.v1";
    std::error_code filesystemError;
    std::filesystem::remove_all(root, filesystemError);

    const auto missing = LoadWorldStateFile(statePath);
    if (missing.status != WorldStateLoadStatus::Missing || missing.state.has_value()) {
        return Fail("missing world state must be reported explicitly");
    }

    std::string saveError;
    if (!SaveWorldStateFileAtomic(statePath, snapshot, &saveError)) {
        return Fail("first atomic world-state save failed: " + saveError);
    }

    auto temporaryPath = statePath;
    temporaryPath += ".tmp";
    if (std::filesystem::exists(temporaryPath)) {
        return Fail("successful atomic save must not leave a temporary file");
    }

    const auto firstLoad = LoadWorldStateFile(statePath);
    if (!firstLoad.loaded() || firstLoad.status != WorldStateLoadStatus::Loaded || !firstLoad.state ||
        firstLoad.state->entities.size() != 2 || firstLoad.state->nextEntityId != 12) {
        return Fail("primary world-state load failed");
    }

    EntityRegistry restored{firstLoad.state->nextEntityId};
    for (const auto& record : firstLoad.state->entities) {
        if (!restored.InsertRestored(record)) {
            return Fail("restored registry rejected valid persisted entity");
        }
    }
    const auto animal = restored.Create(EntityKind::Animal);
    if (!animal || animal->id.value() != 12 || restored.next_entity_id() != 13) {
        return Fail("restored registry did not resume persistent high-water mark");
    }

    const WorldState secondSnapshot = SnapshotWorldState(restored);
    if (!SaveWorldStateFileAtomic(statePath, secondSnapshot, &saveError)) {
        return Fail("second atomic world-state save failed: " + saveError);
    }

    auto backupPath = statePath;
    backupPath += ".bak";
    if (!std::filesystem::is_regular_file(backupPath)) {
        return Fail("second save must retain previous valid state as backup");
    }

    {
        std::ofstream corrupt{statePath, std::ios::binary | std::ios::trunc};
        corrupt << "corrupted-primary";
    }
    const auto recovered = LoadWorldStateFile(statePath);
    if (recovered.status != WorldStateLoadStatus::RecoveredFromBackup || !recovered.state ||
        recovered.state->entities.size() != 2 || recovered.state->nextEntityId != 12) {
        return Fail("invalid primary must recover from previous valid backup");
    }

    if (ReadFile(backupPath) != serialized) {
        return Fail("backup content must equal the previous committed state exactly");
    }

    GameThreadQueue queue;
    int dispatchSum = 0;
    if (!queue.Enqueue([&] { dispatchSum += 1; })) return Fail("queue rejected valid task");
    if (!queue.Enqueue([] { throw std::runtime_error{"intentional"}; })) return Fail("queue rejected throwing task");
    if (!queue.Enqueue([&] { dispatchSum += 10; })) return Fail("queue rejected valid trailing task");

    const auto firstDrain = queue.Drain(2);
    if (firstDrain.executed != 1 || firstDrain.failed != 1 || dispatchSum != 1 || queue.pending() != 1) {
        return Fail("bounded queue drain/failure isolation invariant failed");
    }
    const auto secondDrain = queue.Drain(8);
    if (secondDrain.executed != 1 || secondDrain.failed != 0 || dispatchSum != 11 || queue.pending() != 0) {
        return Fail("queue trailing task drain failed");
    }

    if (!queue.Enqueue([&] {
            dispatchSum += 100;
            (void)queue.Enqueue([&] { dispatchSum += 1000; });
        })) {
        return Fail("queue rejected re-entrant scheduling task");
    }
    const auto reentrantDrain = queue.Drain(8);
    if (reentrantDrain.executed != 1 || dispatchSum != 111 || queue.pending() != 1) {
        return Fail("tasks enqueued during drain must defer to the next game-thread tick");
    }
    (void)queue.Drain(8);
    if (dispatchSum != 1111 || queue.pending() != 0) {
        return Fail("deferred re-entrant task did not run on next drain");
    }

    constexpr int producerCount = 4;
    constexpr int tasksPerProducer = 250;
    std::atomic<int> concurrentExecuted{0};
    std::vector<std::thread> producers;
    producers.reserve(producerCount);
    for (int producer = 0; producer < producerCount; ++producer) {
        producers.emplace_back([&] {
            for (int index = 0; index < tasksPerProducer; ++index) {
                if (!queue.Enqueue([&] { concurrentExecuted.fetch_add(1, std::memory_order_relaxed); })) {
                    throw std::runtime_error{"concurrent enqueue unexpectedly failed"};
                }
            }
        });
    }
    for (auto& producer : producers) {
        producer.join();
    }
    if (queue.pending() != static_cast<std::size_t>(producerCount * tasksPerProducer)) {
        return Fail("concurrent producer queue count mismatch");
    }
    const auto concurrentDrain = queue.Drain(queue.pending());
    if (concurrentDrain.failed != 0 || concurrentDrain.executed != producerCount * tasksPerProducer ||
        concurrentExecuted.load(std::memory_order_relaxed) != producerCount * tasksPerProducer) {
        return Fail("concurrent game-thread dispatch drain mismatch");
    }

    std::filesystem::remove_all(root, filesystemError);
    std::cout << "PASS: vox_persistence_tests\n";
    return 0;
}
