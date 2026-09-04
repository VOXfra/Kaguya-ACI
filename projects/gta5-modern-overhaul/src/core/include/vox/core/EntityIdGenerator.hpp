#pragma once

#include "vox/core/EntityId.hpp"

#include <atomic>
#include <cstdint>
#include <limits>
#include <optional>

namespace vox::core {

class EntityIdGenerator final {
public:
    using ValueType = EntityId::ValueType;

    explicit constexpr EntityIdGenerator(ValueType nextValue = 1) noexcept
        : next_(Sanitize(nextValue)) {}

    EntityIdGenerator(const EntityIdGenerator&) = delete;
    EntityIdGenerator& operator=(const EntityIdGenerator&) = delete;
    EntityIdGenerator(EntityIdGenerator&&) = delete;
    EntityIdGenerator& operator=(EntityIdGenerator&&) = delete;

    [[nodiscard]] std::optional<EntityId> TryNext() noexcept {
        ValueType current = next_.load(std::memory_order_relaxed);

        while (current != ExhaustedSentinel()) {
            const ValueType desired =
                current == std::numeric_limits<ValueType>::max()
                    ? ExhaustedSentinel()
                    : current + 1;

            if (next_.compare_exchange_weak(
                    current,
                    desired,
                    std::memory_order_relaxed,
                    std::memory_order_relaxed)) {
                return EntityId::FromRaw(current);
            }
        }

        return std::nullopt;
    }

    [[nodiscard]] ValueType next_value() const noexcept {
        return next_.load(std::memory_order_relaxed);
    }

    [[nodiscard]] bool exhausted() const noexcept {
        return next_value() == ExhaustedSentinel();
    }

private:
    static constexpr ValueType ExhaustedSentinel() noexcept { return 0; }
    static constexpr ValueType Sanitize(ValueType value) noexcept {
        return value == 0 ? 1 : value;
    }

    std::atomic<ValueType> next_;
};

} // namespace vox::core
