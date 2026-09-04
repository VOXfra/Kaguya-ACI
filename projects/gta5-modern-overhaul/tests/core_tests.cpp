#include "vox/core/Config.hpp"
#include "vox/core/EntityId.hpp"
#include "vox/core/EntityIdGenerator.hpp"
#include "vox/core/EventBus.hpp"
#include "vox/core/GameInstall.hpp"
#include "vox/core/Logger.hpp"
#include "vox/core/SimulationTier.hpp"

#if defined(_WIN32)
#include "vox/platform/windows/WindowsFileVersion.hpp"
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#endif

#include <array>
#include <atomic>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <limits>
#include <optional>
#include <string>
#include <thread>
#include <vector>

namespace {

int Fail(const std::string& message) {
    std::cerr << "FAIL: " << message << '\n';
    return 1;
}

bool WriteMinimalPe(const std::filesystem::path& path, const std::uint16_t machine) {
    std::array<unsigned char, 70> bytes{};
    bytes[0] = static_cast<unsigned char>('M');
    bytes[1] = static_cast<unsigned char>('Z');
    bytes[0x3C] = 64;
    bytes[64] = static_cast<unsigned char>('P');
    bytes[65] = static_cast<unsigned char>('E');
    bytes[66] = 0;
    bytes[67] = 0;
    bytes[68] = static_cast<unsigned char>(machine & 0xFFU);
    bytes[69] = static_cast<unsigned char>((machine >> 8U) & 0xFFU);

    std::ofstream stream{path, std::ios::binary | std::ios::trunc};
    if (!stream.is_open()) {
        return false;
    }
    stream.write(reinterpret_cast<const char*>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
    return stream.good();
}

} // namespace

int main() {
    using vox::core::EnhancedInstallStatus;
    using vox::core::EntityId;
    using vox::core::EntityIdGenerator;
    using vox::core::EventBus;
    using vox::core::IsHigherFidelity;
    using vox::core::LogLevel;
    using vox::core::Logger;
    using vox::core::ParseConfig;
    using vox::core::ProbeEnhancedInstall;
    using vox::core::SimulationTier;

    const auto validConfig = ParseConfig("# core test\r\nschema_version = 1\r\nsafe_mode=true\r\nmax_entities = 2048\r\n");
    if (!validConfig.valid() || validConfig.schemaVersion != 1) return Fail("valid config must parse");
    if (validConfig.GetBool("safe_mode") != std::optional<bool>{true}) return Fail("config bool parse failed");
    if (validConfig.GetUnsigned("max_entities") != std::optional<std::uint64_t>{2048}) return Fail("config unsigned parse failed");

    const auto duplicateConfig = ParseConfig("schema_version=1\nschema_version=2\n");
    if (duplicateConfig.valid() || duplicateConfig.errors.empty()) return Fail("duplicate config key must fail closed");

    const auto missingSchema = ParseConfig("safe_mode=true\n");
    if (missingSchema.valid() || missingSchema.errors.empty()) return Fail("missing schema_version must fail closed");

    const auto invalidSchema = ParseConfig("schema_version=not-a-number\n");
    if (invalidSchema.valid() || invalidSchema.errors.empty()) return Fail("invalid schema_version must fail closed");

    const auto invalid = EntityId::Invalid();
    if (invalid.valid() || static_cast<bool>(invalid)) return Fail("EntityId::Invalid must never report valid");
    const auto first = EntityId::FromRaw(1);
    const auto second = EntityId::FromRaw(2);
    if (!first.valid() || !second.valid()) return Fail("non-zero EntityId values must be valid");
    if (first == second || !(first < second)) return Fail("EntityId comparison invariant failed");

    EntityIdGenerator generator{41};
    const auto generated41 = generator.TryNext();
    const auto generated42 = generator.TryNext();
    if (!generated41 || !generated42 || generated41->value() != 41 || generated42->value() != 42)
        return Fail("EntityIdGenerator sequence/high-water mark invariant failed");

    EntityIdGenerator zeroSanitized{0};
    const auto firstGenerated = zeroSanitized.TryNext();
    if (!firstGenerated || firstGenerated->value() != 1)
        return Fail("EntityIdGenerator must reserve zero as invalid");

    EntityIdGenerator finalId{std::numeric_limits<EntityId::ValueType>::max()};
    const auto maxGenerated = finalId.TryNext();
    if (!maxGenerated || maxGenerated->value() != std::numeric_limits<EntityId::ValueType>::max())
        return Fail("EntityIdGenerator must issue maximum valid ID exactly once");
    if (finalId.TryNext().has_value() || !finalId.exhausted())
        return Fail("EntityIdGenerator must fail closed after ID-space exhaustion");

    if (!IsHigherFidelity(SimulationTier::Physical, SimulationTier::Regional)) return Fail("Physical must be higher fidelity than Regional");
    if (IsHigherFidelity(SimulationTier::Dormant, SimulationTier::Physical)) return Fail("Dormant must not be higher fidelity than Physical");

    struct TestEvent final { int value; };
    struct NestedEvent final { int value; };

    EventBus bus;
    int sum = 0;
    int nested = 0;

    const auto tokenA = bus.Subscribe<TestEvent>([&](const TestEvent& event) { sum += event.value; });
    const auto tokenB = bus.Subscribe<TestEvent>([&](const TestEvent& event) {
        sum += event.value * 2;
        bus.Publish(NestedEvent{event.value});
    });
    const auto nestedToken = bus.Subscribe<NestedEvent>([&](const NestedEvent& event) { nested += event.value; });

    if (!tokenA.valid() || !tokenB.valid() || !nestedToken.valid()) {
        return Fail("EventBus must return valid subscription tokens");
    }

    bus.Publish(TestEvent{3});
    if (sum != 9 || nested != 3) {
        return Fail("EventBus publish or re-entrant publish invariant failed");
    }

    if (!bus.Unsubscribe(tokenA)) {
        return Fail("EventBus failed to unsubscribe existing token");
    }
    if (bus.Unsubscribe(tokenA)) {
        return Fail("EventBus must not report duplicate unsubscribe success");
    }

    bus.Publish(TestEvent{2});
    if (sum != 13 || nested != 5) {
        return Fail("EventBus unsubscribe invariant failed");
    }

    struct ConcurrentEvent final { int value; };
    std::atomic<int> concurrentCount{0};
    const auto concurrentToken = bus.Subscribe<ConcurrentEvent>([&](const ConcurrentEvent& event) {
        concurrentCount.fetch_add(event.value, std::memory_order_relaxed);
    });
    if (!concurrentToken.valid()) {
        return Fail("EventBus concurrent-test subscription failed");
    }

    constexpr int threadCount = 4;
    constexpr int publishesPerThread = 1000;
    std::vector<std::thread> publishers;
    publishers.reserve(threadCount);
    for (int threadIndex = 0; threadIndex < threadCount; ++threadIndex) {
        publishers.emplace_back([&] {
            for (int i = 0; i < publishesPerThread; ++i) {
                bus.Publish(ConcurrentEvent{1});
            }
        });
    }
    for (auto& publisher : publishers) {
        publisher.join();
    }
    if (concurrentCount.load(std::memory_order_relaxed) != threadCount * publishesPerThread) {
        return Fail("EventBus concurrent publish invariant failed");
    }

    const auto installTestRoot = std::filesystem::temp_directory_path() / "vox_gta5_modern_overhaul" / "install_probe_test";
    std::error_code filesystemError;
    std::filesystem::remove_all(installTestRoot, filesystemError);

    if (ProbeEnhancedInstall({}).status != EnhancedInstallStatus::EmptyPath) {
        return Fail("empty install path must be rejected");
    }
    if (ProbeEnhancedInstall(installTestRoot).status != EnhancedInstallStatus::MissingDirectory) {
        return Fail("missing install directory must be rejected");
    }

    std::filesystem::create_directories(installTestRoot, filesystemError);
    if (filesystemError) {
        return Fail("failed to create install probe test directory");
    }
    if (ProbeEnhancedInstall(installTestRoot).status != EnhancedInstallStatus::MissingExecutable) {
        return Fail("install without gta5_enhanced.exe must be rejected");
    }

    const auto fakeExecutable = installTestRoot / "gta5_enhanced.exe";
    {
        std::ofstream invalidExecutable{fakeExecutable, std::ios::binary | std::ios::trunc};
        invalidExecutable << "not a PE image";
    }
    if (ProbeEnhancedInstall(installTestRoot).status != EnhancedInstallStatus::InvalidExecutableFormat) {
        return Fail("non-PE executable must be rejected");
    }

    if (!WriteMinimalPe(fakeExecutable, 0x014CU)) {
        return Fail("failed to create x86 PE probe fixture");
    }
    if (ProbeEnhancedInstall(installTestRoot).status != EnhancedInstallStatus::UnsupportedExecutableArchitecture) {
        return Fail("non-AMD64 PE must be rejected");
    }

    if (!WriteMinimalPe(fakeExecutable, 0x8664U)) {
        return Fail("failed to create AMD64 PE probe fixture");
    }
    const auto validInstallProbe = ProbeEnhancedInstall(installTestRoot);
    if (!validInstallProbe.valid() || validInstallProbe.status != EnhancedInstallStatus::Valid) {
        return Fail("AMD64 gta5_enhanced.exe fixture must pass install probe");
    }

#if defined(_WIN32)
    wchar_t systemDirectory[MAX_PATH]{};
    const UINT systemDirectoryLength = GetSystemDirectoryW(systemDirectory, MAX_PATH);
    if (systemDirectoryLength == 0 || systemDirectoryLength >= MAX_PATH) {
        return Fail("GetSystemDirectoryW failed during Windows version test");
    }

    const auto systemVersion = vox::platform::windows::ReadWindowsFileVersion(
        std::filesystem::path{systemDirectory} / L"kernel32.dll");
    if (!systemVersion.valid() || systemVersion.version->ToString().empty()) {
        return Fail("Windows file-version API failed on kernel32.dll");
    }

    const auto missingVersion = vox::platform::windows::ReadWindowsFileVersion(
        installTestRoot / L"definitely_missing.exe");
    if (missingVersion.valid() || missingVersion.error.empty()) {
        return Fail("Windows file-version API must fail clearly on missing file");
    }
#endif

    std::filesystem::remove_all(installTestRoot, filesystemError);

    const auto logPath = std::filesystem::temp_directory_path() / "vox_gta5_modern_overhaul" / "core_test.log";
    std::filesystem::remove(logPath, filesystemError);
    Logger logger{logPath};
    if (!logger.ready()) return Fail("Logger failed to initialize test log file");
    logger.Write(LogLevel::Info, "core test marker");
    if (!std::filesystem::exists(logPath)) return Fail("Logger did not create expected log file");

    std::cout << "PASS: vox_core_tests\n";
    return 0;
}
