#pragma once

#include "vox/core/EntityId.hpp"
#include "vox/core/EntityIdGenerator.hpp"

#include <cstddef>
#include <cstdint>
#include <map>
#include <mutex>
#include <optional>
#include <vector>

namespace vox::core {

enum class EntityKind : std::uint16_t {
    Pedestrian = 1,
    Vehicle = 2,
    Property = 3,
    Animal = 4,
    System = 255,
};

[[nodiscard]] constexpr bool IsValidEntityKind(EntityKind kind) noexcept {
    switch (kind) {
        case EntityKind::Pedestrian:
        case EntityKind::Vehicle:
        case EntityKind::Property:
        case EntityKind::Animal:
        case EntityKind::System:
            return true;
    }
    return false;
}

struct EntityRecord final {
    EntityId id{};
    EntityKind kind{EntityKind::System};

    constexpr auto operator<=>(const EntityRecord&) const noexcept = default;
};

class EntityRegistry final {
public:
    explicit EntityRegistry(EntityId::ValueType nextEntityId = 1) noexcept;

    EntityRegistry(const EntityRegistry&) = delete;
    EntityRegistry& operator=(const EntityRegistry&) = delete;
    EntityRegistry(EntityRegistry&&) = delete;
    EntityRegistry& operator=(EntityRegistry&&) = delete;

    [[nodiscard]] std::optional<EntityRecord> Create(EntityKind kind);
    [[nodiscard]] bool InsertRestored(EntityRecord record);
    [[nodiscard]] bool Remove(EntityId id);
    [[nodiscard]] bool Contains(EntityId id) const;
    [[nodiscard]] std::optional<EntityRecord> Find(EntityId id) const;
    [[nodiscard]] std::vector<EntityRecord> Snapshot() const;
    [[nodiscard]] std::size_t size() const;
    [[nodiscard]] EntityId::ValueType next_entity_id() const noexcept;

private:
    mutable std::mutex mutex_;
    EntityIdGenerator generator_;
    std::map<EntityId::ValueType, EntityRecord> records_;
};

} // namespace vox::core
