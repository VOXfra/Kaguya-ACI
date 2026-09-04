#include "vox/runtime/CoreApi.h"

#include "vox/core/EntityRegistry.hpp"
#include "vox/core/GameThreadQueue.hpp"
#include "vox/core/WorldState.hpp"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <atomic>
#include <cstdint>
#include <filesystem>
#include <memory>
#include <string>
#include <vector>

namespace {

std::atomic<bool> g_started{false};
std::atomic<std::uint64_t> g_tickCount{0};
VoxHostLogLineFn g_logLine = nullptr;
std::unique_ptr<vox::core::EntityRegistry> g_registry;
std::unique_ptr<vox::core::GameThreadQueue> g_gameThreadQueue;
std::filesystem::path g_statePath;

void Log(const char* line) noexcept {
    const auto sink = g_logLine;
    if (sink != nullptr && line != nullptr) {
        sink(line);
    }
}

void LogUnsigned(const char* prefix, const std::uint64_t value) {
    const std::string marker = std::string{prefix} + std::to_string(value);
    Log(marker.c_str());
}

std::filesystem::path ResolveStatePath() {
    std::vector<wchar_t> buffer(32768, L'\0');
    const DWORD length = GetModuleFileNameW(nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
    if (length == 0 || static_cast<std::size_t>(length) >= buffer.size()) {
        return {};
    }

    const std::filesystem::path executable{
        std::wstring_view{buffer.data(), static_cast<std::size_t>(length)}};
    return executable.parent_path() / L"VOXModernOverhaul" / L"state" / L"world_state.v1";
}

void ResetRuntimeState() noexcept {
    g_gameThreadQueue.reset();
    g_registry.reset();
    g_statePath.clear();
    g_tickCount.store(0, std::memory_order_release);
}

bool RestoreRegistry(const vox::core::WorldState& state) {
    auto registry = std::make_unique<vox::core::EntityRegistry>(state.nextEntityId);
    for (const auto& record : state.entities) {
        if (!registry->InsertRestored(record)) {
            return false;
        }
    }
    g_registry = std::move(registry);
    return true;
}

std::optional<vox::core::EntityRecord> FindSystemEntity() {
    if (!g_registry) {
        return std::nullopt;
    }
    for (const auto& record : g_registry->Snapshot()) {
        if (record.kind == vox::core::EntityKind::System) {
            return record;
        }
    }
    return std::nullopt;
}

bool SaveCurrentState() {
    if (!g_registry || g_statePath.empty()) {
        return false;
    }

    std::string error;
    const auto state = vox::core::SnapshotWorldState(*g_registry);
    if (!vox::core::SaveWorldStateFileAtomic(g_statePath, state, &error)) {
        Log("VOX_PERSISTENCE_SAVE_FAILED");
        if (!error.empty()) {
            const std::string marker = "VOX_PERSISTENCE_ERROR=" + error;
            Log(marker.c_str());
        }
        return false;
    }
    Log("VOX_PERSISTENCE_SAVE_OK");
    return true;
}

bool StartPersistentWorld() {
    g_statePath = ResolveStatePath();
    if (g_statePath.empty()) {
        Log("VOX_PERSISTENCE_PATH_FAILED");
        return false;
    }

    const auto loaded = vox::core::LoadWorldStateFile(g_statePath);
    bool mustSave = false;

    switch (loaded.status) {
        case vox::core::WorldStateLoadStatus::Missing:
            g_registry = std::make_unique<vox::core::EntityRegistry>();
            mustSave = true;
            Log("VOX_PERSISTENCE_STATUS=NEW");
            break;

        case vox::core::WorldStateLoadStatus::Loaded:
            if (!loaded.state || !RestoreRegistry(*loaded.state)) {
                Log("VOX_PERSISTENCE_RESTORE_FAILED");
                return false;
            }
            Log("VOX_PERSISTENCE_STATUS=LOADED");
            break;

        case vox::core::WorldStateLoadStatus::RecoveredFromBackup: {
            if (!loaded.state || !RestoreRegistry(*loaded.state)) {
                Log("VOX_PERSISTENCE_BACKUP_RESTORE_FAILED");
                return false;
            }
            std::error_code removeError;
            std::filesystem::remove(g_statePath, removeError);
            if (removeError) {
                Log("VOX_PERSISTENCE_CORRUPT_PRIMARY_REMOVE_FAILED");
                return false;
            }
            mustSave = true;
            Log("VOX_PERSISTENCE_STATUS=RECOVERED_FROM_BACKUP");
            break;
        }

        case vox::core::WorldStateLoadStatus::Invalid:
            Log("VOX_PERSISTENCE_STATUS=INVALID");
            if (!loaded.error.empty()) {
                const std::string marker = "VOX_PERSISTENCE_ERROR=" + loaded.error;
                Log(marker.c_str());
            }
            return false;
    }

    auto systemEntity = FindSystemEntity();
    if (!systemEntity) {
        systemEntity = g_registry->Create(vox::core::EntityKind::System);
        if (!systemEntity) {
            Log("VOX_PERSISTENCE_SYSTEM_ENTITY_CREATE_FAILED");
            return false;
        }
        mustSave = true;
    }

    LogUnsigned("VOX_PERSISTENCE_SYSTEM_ENTITY_ID=", systemEntity->id.value());
    LogUnsigned("VOX_PERSISTENCE_ENTITY_COUNT=", static_cast<std::uint64_t>(g_registry->size()));
    LogUnsigned("VOX_PERSISTENCE_NEXT_ENTITY_ID=", g_registry->next_entity_id());

    if (mustSave && !SaveCurrentState()) {
        return false;
    }

    return true;
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

    try {
        if (!StartPersistentWorld()) {
            ResetRuntimeState();
            g_logLine = nullptr;
            g_started.store(false, std::memory_order_release);
            return 0u;
        }

        g_gameThreadQueue = std::make_unique<vox::core::GameThreadQueue>();
        if (!g_gameThreadQueue->Enqueue([] { Log("VOX_GAME_THREAD_QUEUE_DISPATCHED=1"); })) {
            Log("VOX_GAME_THREAD_QUEUE_ENQUEUE_FAILED");
            ResetRuntimeState();
            g_logLine = nullptr;
            g_started.store(false, std::memory_order_release);
            return 0u;
        }

        Log("VOX_CORE_RUNTIME_READY");
        return 1u;
    } catch (...) {
        Log("VOX_CORE_START_EXCEPTION");
        ResetRuntimeState();
        g_logLine = nullptr;
        g_started.store(false, std::memory_order_release);
        return 0u;
    }
}

extern "C" __declspec(dllexport) void VOX_CDECL VoxCoreTick(void) {
    if (!g_started.load(std::memory_order_acquire)) {
        return;
    }

    try {
        if (g_gameThreadQueue) {
            const auto drained = g_gameThreadQueue->Drain(64);
            if (drained.failed != 0) {
                LogUnsigned("VOX_GAME_THREAD_QUEUE_FAILURES=", static_cast<std::uint64_t>(drained.failed));
            }
        }

        const std::uint64_t tick = g_tickCount.fetch_add(1, std::memory_order_acq_rel) + 1;
        if (tick <= 5) {
            LogUnsigned("VOX_CORE_TICK=", tick);
        }
    } catch (...) {
        Log("VOX_CORE_TICK_EXCEPTION");
        g_started.store(false, std::memory_order_release);
    }
}

extern "C" __declspec(dllexport) void VOX_CDECL VoxCoreStop(void) {
    bool expected = true;
    if (!g_started.compare_exchange_strong(expected, false, std::memory_order_acq_rel)) {
        return;
    }

    try {
        if (g_registry && !g_statePath.empty()) {
            (void)SaveCurrentState();
        }
        Log("VOX_CORE_STOP");
    } catch (...) {
        Log("VOX_CORE_STOP_EXCEPTION");
    }

    ResetRuntimeState();
    g_logLine = nullptr;
}
