#pragma once

#include <cstdint>

namespace vox::core {

enum class SimulationTier : std::uint8_t {
    Physical = 0,
    LocalAbstract = 1,
    Regional = 2,
    Dormant = 3,
};

[[nodiscard]] constexpr bool IsHigherFidelity(
    SimulationTier lhs,
    SimulationTier rhs) noexcept {
    return static_cast<std::uint8_t>(lhs) < static_cast<std::uint8_t>(rhs);
}

} // namespace vox::core
