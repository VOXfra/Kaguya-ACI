#pragma once

#include "vox/core/EntityRegistry.hpp"

#include <cstdint>
#include <filesystem>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace vox::core {

inline constexpr std::uint32_t kWorldStateSchemaVersion = 1;

struct WorldState final {
    std::uint32_t schemaVersion{kWorldStateSchemaVersion};
    EntityId::ValueType nextEntityId{1};
    std::vector<EntityRecord> entities;
};

enum class WorldStateLoadStatus : std::uint8_t {
    Loaded,
    Missing,
    RecoveredFromBackup,
    Invalid,
};

struct WorldStateLoadResult final {
    WorldStateLoadStatus status{WorldStateLoadStatus::Invalid};
    std::optional<WorldState> state;
    std::string error;

    [[nodiscard]] bool loaded() const noexcept {
        return status == WorldStateLoadStatus::Loaded ||
               status == WorldStateLoadStatus::RecoveredFromBackup;
    }
};

[[nodiscard]] bool ValidateWorldState(const WorldState& state, std::string* error = nullptr);
[[nodiscard]] std::string SerializeWorldState(const WorldState& state);
[[nodiscard]] std::optional<WorldState> ParseWorldState(std::string_view text, std::string* error = nullptr);
[[nodiscard]] WorldState SnapshotWorldState(const EntityRegistry& registry);
[[nodiscard]] WorldStateLoadResult LoadWorldStateFile(const std::filesystem::path& path);
[[nodiscard]] bool SaveWorldStateFileAtomic(
    const std::filesystem::path& path,
    const WorldState& state,
    std::string* error = nullptr);

} // namespace vox::core
