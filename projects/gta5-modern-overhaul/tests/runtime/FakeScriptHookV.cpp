#if !defined(_WIN32)
#error "Fake ScriptHookV is Windows-only"
#endif

#define WIN32_LEAN_AND_MEAN
#include <Windows.h>

#include <atomic>

namespace {

using ScriptMain = void (*)();
std::atomic<ScriptMain> g_registeredScript{nullptr};

} // namespace

/*
 * Intentionally DO NOT expose the historical exact mangled names here.
 * This fake simulates harmless C++ decoration drift while preserving the semantic
 * function identifiers. The production runtime must discover these exports through
 * its PE export-name fallback instead of succeeding via the hard-coded fast path.
 */
#pragma comment(linker, "/EXPORT:?scriptRegister@@VOX_ABI_DRIFT_TEST=VoxFakeScriptRegister")
#pragma comment(linker, "/EXPORT:?scriptWait@@VOX_ABI_DRIFT_TEST=VoxFakeScriptWait")

extern "C" void VoxFakeScriptRegister(HMODULE, ScriptMain script) {
    g_registeredScript.store(script, std::memory_order_release);
}

extern "C" void VoxFakeScriptWait(DWORD time) {
    if (time == 0) {
        Sleep(1);
        return;
    }
    Sleep(time > 10 ? 10 : time);
}

extern "C" __declspec(dllexport) BOOL VoxFakeWasRegistered() {
    return g_registeredScript.load(std::memory_order_acquire) != nullptr ? TRUE : FALSE;
}

extern "C" __declspec(dllexport) void VoxFakeRunRegisteredScript() {
    const ScriptMain script = g_registeredScript.load(std::memory_order_acquire);
    if (script != nullptr) {
        script();
    }
}
