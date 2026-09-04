#if !defined(_WIN32)
#error "VOX Modern Overhaul no-CRT ASI probe is Windows-only"
#endif

/*
 * Checkpoint dev.10 intentionally avoids the C/C++ runtime entirely.
 * The linker uses VoxDllEntry directly as the PE DLL entrypoint with
 * /NODEFAULTLIB. This function must not call Win32, CRT, STL, ScriptHookV,
 * or any project code. Its only purpose is to prove whether GTA V Enhanced
 * tolerates loading the bare project ASI image itself.
 */
int VoxDllEntry(void* module, unsigned long reason, void* reserved) {
    (void)module;
    (void)reason;
    (void)reserved;
    return 1;
}
