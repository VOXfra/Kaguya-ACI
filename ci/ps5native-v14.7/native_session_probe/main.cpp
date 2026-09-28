#include <ps5native/graphics_presentation.hpp>
#include <ps5native/memory_service.hpp>
#include <ps5native/thread_key_service.hpp>
#include <ps5native/semaphore.hpp>
#include <ps5native/loaded_dependency_set.hpp>
#include <ps5native/win32_d3d12_graphics_backend.hpp>
#include <ps5native/win32_platform.hpp>
#include <ps5native/win64_abi_bridge.hpp>
#include <ps5native/win64_guest_call_gate.hpp>

#include <array>
#include <atomic>
#include <chrono>
#include <cstdint>
#include <cstring>
#include <filesystem>
#include <iostream>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

namespace {

constexpr ps5native::Address kWorkerEntry = 0x700280;
constexpr ps5native::Address kFaultWorkerEntry = 0x7002C0;
constexpr std::size_t kCoordinatorCount = 2;
constexpr std::size_t kRoundsPerCoordinator = 24;
constexpr std::uint32_t kFrameCount = 96;

std::mutex g_event_mutex;
std::vector<std::uint64_t> g_events;

extern "C" std::uint64_t lifecycle_event(std::uint64_t event_id) {
    std::lock_guard lock(g_event_mutex);
    g_events.push_back(event_id);
    return event_id;
}

extern "C" std::uint64_t ps5_host_strlen(std::uint64_t pointer_value) {
    const auto* text = reinterpret_cast<const char*>(
        static_cast<std::uintptr_t>(pointer_value));
    return text ? static_cast<std::uint64_t>(std::strlen(text)) : 0;
}

bool check(bool condition, const char* label) {
    std::cout << label << ": " << (condition ? "PASS" : "FAIL") << '\n';
    return condition;
}

std::vector<std::filesystem::path> module_paths(const std::filesystem::path& dir) {
    return {dir / "app.elf", dir / "libB.elf", dir / "libCommon.elf", dir / "libA.elf"};
}

bool register_host_surfaces(ps5native::LoadedDependencySet& set,
                            void* event_bridge,
                            void* strlen_bridge) {
    if (!event_bridge || !strlen_bridge) return false;
    set.resolver().register_global_symbol("lifecycle_event", event_bridge);
    set.resolver().register_identity({"libSceLibcInternal", "j4ViWNHEgww"}, strlen_bridge);
    return true;
}

bool expect_main_tls(const ps5native::LoadedDependencySet& set,
                     const std::string& identity,
                     std::size_t offset,
                     std::uint64_t expected) {
    const auto value = set.read_module_tls_u64(identity, offset);
    return value && *value == expected;
}

} // namespace

int wmain(int argc, wchar_t** argv) {
    if (argc < 2) {
        std::wcerr << L"Usage: NativeSessionProbe.exe <runtime-fixture-root>\n";
        return 2;
    }

    using namespace ps5native;
    bool ok = true;
    const std::filesystem::path fixture_root = argv[1];
    const auto dir = fixture_root / "good";

    Win32Platform platform(dir);
    Win64GuestCallGate gate;
    ok &= check(gate.ready() && gate.supports_tls_base(),
                "Native session Win64 guest gate + FS-base capability");
    if (!ok) return 3;

    Win64AbiBridgePool bridges;
    void* event_bridge = bridges.create_sysv_to_win64_u64(
        reinterpret_cast<void*>(&lifecycle_event), {1});
    void* strlen_bridge = bridges.create_sysv_to_win64_u64(
        reinterpret_cast<void*>(&ps5_host_strlen), {1});
    ok &= check(event_bridge && strlen_bridge,
                "Native session SysV->Win64 host bridges");
    if (!ok) return 4;

    LoadedDependencySet set;
    ok &= check(set.load(module_paths(dir), "app.so", platform) &&
                register_host_surfaces(set, event_bridge, strlen_bridge) &&
                set.prepare() && set.preflight_runtime(gate) && set.start(gate),
                "Native session multi-module load/prepare/preflight/start");
    if (!ok) {
        std::cerr << "SESSION_START_ERROR: " << set.error() << "\n";
        return 5;
    }

    const bool initial_tls =
        expect_main_tls(set, "libCommon.so", 8, 1) &&
        expect_main_tls(set, "libA.so", 8, 2) &&
        expect_main_tls(set, "libB.so", 8, 3) &&
        expect_main_tls(set, "app.so", 8, 4);
    ok &= check(initial_tls, "Native session main-thread module TLS initialized");
    if (!ok) return 6;

    MemoryService memory(platform);
    const auto scratch_region = memory.allocate(4096);
    ok &= check(scratch_region && scratch_region->base && scratch_region->size >= 4096,
                "Native session host memory service scratch allocation");
    if (!scratch_region || !scratch_region->base) return 7;
    auto* scratch = reinterpret_cast<std::uint64_t*>(scratch_region->base);
    for (std::size_t i = 0; i < kCoordinatorCount; ++i) scratch[i] = 0;

    ThreadKeyService thread_keys;
    const auto coordinator_key = thread_keys.create_key();
    ok &= check(coordinator_key.has_value(),
                "Native session host thread-key service create");
    if (!coordinator_key) return 8;

    Semaphore workers_done(0, kCoordinatorCount);

    auto graphics_backend = std::make_shared<Win32D3D12GraphicsBackend>();
    GraphicsPresentationSurface presentation(graphics_backend);
    GraphicsPresentationDesc desc{};
    desc.width = 800;
    desc.height = 450;
    desc.buffer_count = 3;
    desc.format = GraphicsTextureFormat::Rgba8Unorm;
    desc.visible = true;
    desc.frame_latency_waitable = true;
    desc.max_frame_latency = 1;
    desc.title = "PS5NativeCore v14.7 Integrated Native Session";
    GraphicsError gfx_error = GraphicsError::None;
    const auto surface = presentation.create(desc, &gfx_error);
    ok &= check(surface && gfx_error == GraphicsError::None,
                "Native session visible waitable triple-buffer DXGI surface create");
    if (!surface) return 11;

    std::atomic<std::uint64_t> guest_batches{0};
    std::atomic<std::uint64_t> guest_calls{0};
    std::atomic<std::uint64_t> guest_faults{0};
    std::atomic<bool> worker_failure{false};

    const std::array<std::string, 4> identities = {
        "libCommon.so", "libA.so", "libB.so", "app.so"};
    const std::array<std::uint64_t, 4> tls0 = {10, 20, 30, 40};

    std::vector<std::thread> coordinators;
    for (std::size_t coordinator = 0; coordinator < kCoordinatorCount; ++coordinator) {
        coordinators.emplace_back([&, coordinator] {
            const auto key_value = static_cast<std::uintptr_t>(0x7000 + coordinator);
            if (!thread_keys.set_specific(*coordinator_key, key_value) ||
                !thread_keys.get_specific(*coordinator_key) ||
                *thread_keys.get_specific(*coordinator_key) != key_value) {
                worker_failure.store(true);
                workers_done.post();
                return;
            }
            for (std::size_t round = 0; round < kRoundsPerCoordinator; ++round) {
                const std::uint64_t base_arg =
                    1 + static_cast<std::uint64_t>(coordinator * kRoundsPerCoordinator + round);
                std::vector<GuestThreadSpec> specs;
                for (std::size_t module = 0; module < identities.size(); ++module) {
                    specs.push_back({
                        7000 + static_cast<std::uint64_t>(coordinator * 1000 + round * 4 + module),
                        nullptr,
                        base_arg + module,
                        identities[module],
                        kWorkerEntry});
                }
                const auto report = set.run_joined_threads(specs, gate);
                bool batch_ok = report.threads.size() == specs.size();
                for (std::size_t module = 0; module < report.threads.size(); ++module) {
                    const auto expected = tls0[module] + base_arg + module;
                    batch_ok = batch_ok && report.threads[module].success &&
                        report.threads[module].return_value == expected &&
                        report.threads[module].tls_address != 0;
                }
                if (!batch_ok) {
                    worker_failure.store(true);
                    workers_done.post();
                    return;
                }
                guest_batches.fetch_add(1);
                guest_calls.fetch_add(report.threads.size());

                if ((round % 8) == 7) {
                    const auto mixed = set.run_joined_threads({
                        {8000 + static_cast<std::uint64_t>(coordinator * 100 + round), nullptr, 9, "app.so", kWorkerEntry},
                        {9000 + static_cast<std::uint64_t>(coordinator * 100 + round), nullptr, 0xDEAD, "app.so", kFaultWorkerEntry},
                        {10000 + static_cast<std::uint64_t>(coordinator * 100 + round), nullptr, 10, "libA.so", kWorkerEntry},
                    }, gate);
                    const bool fault_ok = mixed.threads.size() == 3 &&
                        mixed.threads[0].success && mixed.threads[0].return_value == 49 &&
                        !mixed.threads[1].success &&
                        mixed.threads[1].error.find("0xC0000005") != std::string::npos &&
                        mixed.threads[2].success && mixed.threads[2].return_value == 30 &&
                        set.state() == DependencySetState::Started;
                    if (!fault_ok) {
                        worker_failure.store(true);
                        workers_done.post();
                        return;
                    }
                    guest_faults.fetch_add(1);
                }
                scratch[coordinator] = round + 1;
            }
            workers_done.post();
        });
    }

    bool frames_ok = true;
    for (std::uint32_t frame = 0; frame < kFrameCount; ++frame) {
        if (frame == 32) {
            frames_ok = frames_ok &&
                presentation.resize(*surface, 1024, 576, 5000) == GraphicsError::None;
        } else if (frame == 64) {
            frames_ok = frames_ok &&
                presentation.resize(*surface, 1280, 720, 5000) == GraphicsError::None;
        }
        const float t = static_cast<float>(frame) / static_cast<float>(kFrameCount - 1);
        frames_ok = frames_ok &&
            presentation.clear_and_present(*surface,
                0.08f + 0.55f * t,
                0.18f + 0.20f * (1.0f - t),
                0.72f - 0.40f * t,
                1.0f,
                5000) == GraphicsError::None;
        if (!frames_ok) break;
    }

    bool workers_signaled = true;
    for (std::size_t i = 0; i < kCoordinatorCount; ++i) {
        workers_signaled = workers_done.wait(std::chrono::seconds(15)) && workers_signaled;
    }
    for (auto& thread : coordinators) {
        if (thread.joinable()) thread.join();
    }

    const auto info = presentation.info(*surface, &gfx_error);
    const bool frame_progress_ok = frames_ok && info &&
        info->present_count == kFrameCount &&
        info->waited_frame_count == kFrameCount &&
        info->desc.width == 1280 && info->desc.height == 720 &&
        info->client_width == 1280 && info->client_height == 720 &&
        info->window_exists && info->window_visible && info->frame_latency_waitable;
    ok &= check(frame_progress_ok,
                "Native session 96 visible paced frames + two resizes while guest workers run");

    const std::uint64_t expected_batches = kCoordinatorCount * kRoundsPerCoordinator;
    const std::uint64_t expected_calls = expected_batches * 4;
    const std::uint64_t expected_faults = kCoordinatorCount * 3;
    bool scratch_ok = true;
    for (std::size_t i = 0; i < kCoordinatorCount; ++i) {
        scratch_ok = scratch_ok && scratch[i] == kRoundsPerCoordinator;
    }
    const bool worker_matrix_ok = workers_signaled && !worker_failure.load() && scratch_ok &&
        guest_batches.load() == expected_batches &&
        guest_calls.load() == expected_calls &&
        guest_faults.load() == expected_faults;
    ok &= check(worker_matrix_ok,
                "Native session concurrent multi-module TLS workers + injected guest faults");

    const bool sync_services_ok =
        thread_keys.delete_key(*coordinator_key) &&
        !thread_keys.get_specific(*coordinator_key) &&
        memory.release(scratch_region->base) && memory.region_count() == 0;
    ok &= check(sync_services_ok,
                "Native session memory/thread-key/semaphore service lifecycle during integrated workload");

    const bool main_tls_intact =
        expect_main_tls(set, "libCommon.so", 8, 1) &&
        expect_main_tls(set, "libA.so", 8, 2) &&
        expect_main_tls(set, "libB.so", 8, 3) &&
        expect_main_tls(set, "app.so", 8, 4);
    ok &= check(main_tls_intact,
                "Native session main TLS isolated from concurrent workers");

    const auto root = set.execute_root_u64(gate);
    const bool root_ok = root.success && root.return_value == 156;
    ok &= check(root_ok,
                "Native session root guest remains executable after integrated loop");

    const bool presentation_cleanup =
        presentation.destroy(*surface) == GraphicsError::None &&
        presentation.count() == 0;
    const bool runtime_cleanup = set.shutdown(gate) && set.unload_all();
    ok &= check(presentation_cleanup && runtime_cleanup,
                "Native session graphics + dependency-set shutdown/unload");

    std::cout << "Native session guest batches/calls/faults: "
              << guest_batches.load() << "/" << guest_calls.load() << "/"
              << guest_faults.load() << "\n";
    std::cout << "Native session root return: " << root.return_value << "\n";

    if (!ok) return 20;
    std::cout << "V147_INTEGRATED_NATIVE_SESSION_OK\n";
    return 0;
}
