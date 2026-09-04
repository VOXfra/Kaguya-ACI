#if !defined(_WIN32)
#error "VOX Modern Overhaul inert ASI probe is Windows-only"
#endif

#define WIN32_LEAN_AND_MEAN
#include <Windows.h>

BOOL APIENTRY DllMain(HMODULE, DWORD, LPVOID) {
    // Intentionally inert isolation checkpoint.
    // No threads, logging, filesystem access, ScriptHookV calls, hooks,
    // memory writes, static state, or GTA interaction are permitted here.
    return TRUE;
}
