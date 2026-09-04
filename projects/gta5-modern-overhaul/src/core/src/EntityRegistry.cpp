#include "vox/core/EntityRegistry.hpp"

namespace vox::core {

EntityRegistry::EntityRegistry(const EntityId::ValueType nextEntityId) noexcept
    : generator_{nextEntityId} {}

std::optional<EntityRecord> EntityRegistry::Create(const EntityKind kind) {
    if (!IsValidEntityKind(kind)) {
        return std::nullopt;
    }

    std::scoped_lock lock{mutex_};
    const auto id = generator_.TryNext();
    if (!id.has_value()) {
        return std::nullopt;
    }

    const EntityRecord record{*id, kind};
    const auto [iterator, inserted] = records_.emplace(id->value(), record);
    if (!inserted) {
        return std::nullopt;
    }
    return iterator->second;
}

bool EntityRegistry::InsertRestored(const EntityRecord record) {
    if (!record.id.valid() || !IsValidEntityKind(record.kind)) {
        return false;
    }

    const auto next = generator_.next_value();
    if (next == 0 || record.id.value() >= next) {
        return false;
    }

    std::scoped_lock lock{mutex_};
    return records_.emplace(record.id.value(), record).second;
}

bool EntityRegistry::Remove(const EntityId id) {
    if (!id.valid()) {
        return false;
    }

    std::scoped_lock lock{mutex_};
    return records_.erase(id.value()) == 1;
}

bool EntityRegistry::Contains(const EntityId id) const {
    if (!id.valid()) {
        return false;
    }

    std::scoped_lock lock{mutex_};
    return records_.contains(id.value());
}

std::optional<EntityRecord> EntityRegistry::Find(const EntityId id) const {
    if (!id.valid()) {
        return std::nullopt;
    }

    std::scoped_lock lock{mutex_};
    const auto iterator = records_.find(id.value());
    if (iterator == records_.end()) {
        return std::nullopt;
    }
    return iterator->second;
}

std::vector<EntityRecord> EntityRegistry::Snapshot() const {
    std::scoped_lock lock{mutex_};
    std::vector<EntityRecord> snapshot;
    snapshot.reserve(records_.size());
    for (const auto& [id, record] : records_) {
        (void)id;
        snapshot.push_back(record);
    }
    return snapshot;
}

std::size_t EntityRegistry::size() const {
    std::scoped_lock lock{mutex_};
    return records_.size();
}

EntityId::ValueType EntityRegistry::next_entity_id() const noexcept {
    return generator_.next_value();
}

} // namespace vox::core
