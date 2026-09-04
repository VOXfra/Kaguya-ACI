#include "vox/runtime/CoreApi.h"

#include "vox/core/EntityIdGenerator.hpp"

#include <atomic>
#include <cstdint>
#include <string>

namespace {

std::atomic<bool> g_started{false};
std::atomic<std::uint64_t> g_tickCount{0};
VoxHostLogLineFn g_logLine = nullptr;
vox::core::EntityIdGenerator g_entityIds{};

void Log(const char* line) noexcept {
    const auto sink = g_logLine;
    if (sink != nullptr && line != nullptr) {
        sink(line);
    }
}

} // namespace

extern "C" __declspec(dllexport) std::uint32_t VOX_CDECL VoxCoreStart(const VoxHostApi* hostApi) {
    if (hostApi == nullptr ||
        hostApi->struct_size < sizeof(VoxHostApi) ||
        hostApi->api_version != VOX_CORE_API_VERSION ||
        hostApi->log_line == nullptr) {
        return 0u;
    }

    bool expected = false;
    if (!g_started.compare_exchange_strong(expected, true, std::memory_order_acq_rel)) {
        return 0u;
    }

    g_logLine = hostApi->log_line;
    g_tickCount.store(0, std::memory_order_release);
    Log("VOX_CORE_START");

    const auto firstId = g_entityIds.TryNext();
    if (!firstId.has_value()) {
        Log("VOX_CORE_ENTITY_ID_ALLOCATION_FAILED");
        g_logLine = nullptr;
        g_started.store(false, std::memory_order_release);
        return 0u;
    }

    const std::string marker = "VOX_CORE_ENTITY_ID=" + std::to_string(firstId->value());
    Log(marker.c_str());
    return 1u;
}

extern "C" __declspec(dllexport) void VOX_CDECL VoxCoreTick(void) {
    if (!g_started.load(std::memory_order_acquire)) {
        return;
    }

    const std::uint64_t tick = g_tickCount.fetch_add(1, std::memory_order_acq_rel) + 1;
    if (tick <= 5) {
        const std::string marker = "VOX_CORE_TICK=" + std::to_string(tick);
        Log(marker.c_str());
    }
}

extern "C" __declspec(dllexport) void VOX_CDECL VoxCoreStop(void) {
    bool expected = true;
    if (!g_started.compare_exchange_strong(expected, false, std::memory_order_acq_rel)) {
        return;
    }

    Log("VOX_CORE_STOP");
    g_logLine = nullptr;
}
