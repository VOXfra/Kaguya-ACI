#include "vox/core/EntityId.hpp"
#include "vox/core/Logger.hpp"
#include "vox/core/SimulationTier.hpp"

#include <filesystem>
#include <iostream>
#include <string>

namespace {

int Fail(const std::string& message) {
    std::cerr << "FAIL: " << message << '\n';
    return 1;
}

} // namespace

int main() {
    using vox::core::EntityId;
    using vox::core::IsHigherFidelity;
    using vox::core::LogLevel;
    using vox::core::Logger;
    using vox::core::SimulationTier;

    const auto invalid = EntityId::Invalid();
    if (invalid.valid() || static_cast<bool>(invalid)) {
        return Fail("EntityId::Invalid must never report valid");
    }

    const auto first = EntityId::FromRaw(1);
    const auto second = EntityId::FromRaw(2);
    if (!first.valid() || !second.valid()) {
        return Fail("non-zero EntityId values must be valid");
    }
    if (first == second || !(first < second)) {
        return Fail("EntityId comparison invariant failed");
    }

    if (!IsHigherFidelity(SimulationTier::Physical, SimulationTier::Regional)) {
        return Fail("Physical must be higher fidelity than Regional");
    }
    if (IsHigherFidelity(SimulationTier::Dormant, SimulationTier::Physical)) {
        return Fail("Dormant must not be higher fidelity than Physical");
    }

    const auto logPath = std::filesystem::temp_directory_path() / "vox_gta5_modern_overhaul" / "core_test.log";
    std::error_code error;
    std::filesystem::remove(logPath, error);

    Logger logger{logPath};
    if (!logger.ready()) {
        return Fail("Logger failed to initialize test log file");
    }

    logger.Write(LogLevel::Info, "core test marker");
    if (!std::filesystem::exists(logPath)) {
        return Fail("Logger did not create expected log file");
    }

    std::cout << "PASS: vox_core_tests\n";
    return 0;
}
