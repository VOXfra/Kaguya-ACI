#pragma once

#include <cstdint>
#include <compare>

namespace vox::core {

class EntityId final {
public:
    using ValueType = std::uint64_t;

    constexpr EntityId() noexcept = default;

    static constexpr EntityId Invalid() noexcept { return EntityId{}; }

    static constexpr EntityId FromRaw(ValueType value) noexcept {
        return EntityId{value};
    }

    [[nodiscard]] constexpr ValueType value() const noexcept { return value_; }
    [[nodiscard]] constexpr bool valid() const noexcept { return value_ != 0; }
    [[nodiscard]] constexpr explicit operator bool() const noexcept { return valid(); }

    constexpr auto operator<=>(const EntityId&) const noexcept = default;

private:
    explicit constexpr EntityId(ValueType value) noexcept : value_(value) {}

    ValueType value_{0};
};

} // namespace vox::core
