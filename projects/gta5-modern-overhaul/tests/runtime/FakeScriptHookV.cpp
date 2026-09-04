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
 * Do not rely on the compiler's current C++ name mangling for this test DLL.
 * The production runtime resolves the ScriptHookV x64 SDK ABI names below, so the
 * fake must expose those exact names even if a future MSVC changes how the source
 * declarations themselves would be decorated.
 */
#pragma comment(linker, "/EXPORT:?scriptRegister@@YAXPEAUHINSTANCE__@@P6AXXZ@Z@Z=VoxFakeScriptRegister")
#pragma comment(linker, "/EXPORT:?scriptWait@@YAXK@Z=VoxFakeScriptWait")

extern "C" void VoxFakeScriptRegister(HMODULE, ScriptMain script) {
    g_registeredScript.store(script, std::memory_order_release);
}

extern "C" void VoxFakeScriptWait(DWORD time) {
    // The real ScriptHookV yields a script fiber. For the synthetic harness we only
    // need deterministic resumability; clamp waits so CI remains fast.
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
