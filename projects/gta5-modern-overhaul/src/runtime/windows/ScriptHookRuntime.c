#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>

/*
 * Checkpoint 0E runtime.
 *
 * Design constraints:
 * - custom PE entrypoint, no CRT/default libraries;
 * - no GTA natives, hooks, memory patches or save/world writes;
 * - never LoadLibrary from the loader callback;
 * - ScriptHookV must already be loaded by the user's existing loader;
 * - resolve only scriptRegister/scriptWait and fail closed if ABI resolution fails;
 * - all repeated work runs from ScriptHookV's registered script context.
 */

typedef void(__cdecl *VoxScriptMainFn)(void);
typedef void(__cdecl *VoxScriptRegisterFn)(HMODULE, VoxScriptMainFn);
typedef void(__cdecl *VoxScriptWaitFn)(DWORD);

static VoxScriptWaitFn g_scriptWait = NULL;

static const char kScriptRegisterExport[] =
    "?scriptRegister@@YAXPEAUHINSTANCE__@@P6AXXZ@Z@Z";
static const char kScriptWaitExport[] = "?scriptWait@@YAXK@Z";

static DWORD VoxAsciiLength(const char* text)
{
    DWORD length = 0;
    if (text == NULL) {
        return 0;
    }

    while (text[length] != '\0') {
        ++length;
    }
    return length;
}

static BOOL VoxAppendWideLiteral(
    wchar_t* destination,
    DWORD capacity,
    DWORD* length,
    const wchar_t* suffix)
{
    DWORD cursor;

    if (destination == NULL || length == NULL || suffix == NULL || capacity == 0) {
        return FALSE;
    }

    cursor = *length;
    while (*suffix != L'\0') {
        if (cursor + 1 >= capacity) {
            return FALSE;
        }
        destination[cursor++] = *suffix++;
    }

    destination[cursor] = L'\0';
    *length = cursor;
    return TRUE;
}

static BOOL VoxBuildCheckpointPath(wchar_t* path, DWORD capacity)
{
    DWORD length;
    DWORD separator;

    if (path == NULL || capacity < 64) {
        return FALSE;
    }

    length = GetModuleFileNameW(NULL, path, capacity);
    if (length == 0 || length >= capacity) {
        return FALSE;
    }

    separator = length;
    while (separator > 0 && path[separator - 1] != L'\\' && path[separator - 1] != L'/') {
        --separator;
    }
    if (separator == 0) {
        return FALSE;
    }

    path[separator] = L'\0';
    length = separator;

    if (!VoxAppendWideLiteral(path, capacity, &length, L"VOXModernOverhaul")) {
        return FALSE;
    }

    /* The directory normally exists because the package contains config/core.cfg.
     * CreateDirectoryW is idempotent for our use: ERROR_ALREADY_EXISTS is acceptable.
     */
    if (!CreateDirectoryW(path, NULL) && GetLastError() != ERROR_ALREADY_EXISTS) {
        return FALSE;
    }

    if (!VoxAppendWideLiteral(path, capacity, &length, L"\\runtime_game_thread.log")) {
        return FALSE;
    }

    return TRUE;
}

static void VoxWriteCheckpointLine(const char* line)
{
    wchar_t path[1024];
    HANDLE file;
    DWORD bytesWritten;
    DWORD length;
    static const char newline[] = "\r\n";

    if (line == NULL || !VoxBuildCheckpointPath(path, (DWORD)(sizeof(path) / sizeof(path[0])))) {
        return;
    }

    file = CreateFileW(
        path,
        FILE_APPEND_DATA,
        FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
        NULL,
        OPEN_ALWAYS,
        FILE_ATTRIBUTE_NORMAL,
        NULL);

    if (file == INVALID_HANDLE_VALUE) {
        return;
    }

    length = VoxAsciiLength(line);
    if (length > 0) {
        (void)WriteFile(file, line, length, &bytesWritten, NULL);
    }
    (void)WriteFile(file, newline, 2, &bytesWritten, NULL);
    (void)FlushFileBuffers(file);
    (void)CloseHandle(file);
}

static void VoxScriptMain(void)
{
    DWORD heartbeatCount = 0;

    if (g_scriptWait == NULL) {
        return;
    }

    VoxWriteCheckpointLine("VOX_SCRIPT_MAIN_ENTER");

    /* A successful return from scriptWait(0) proves ScriptHookV resumed our script
     * after yielding through its own script/fiber scheduler.
     */
    g_scriptWait(0);
    VoxWriteCheckpointLine("VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT");

    /* Five low-frequency heartbeats prove repeated scheduling without creating an
     * unbounded diagnostic log. Afterwards the script remains resident and inert.
     */
    while (heartbeatCount < 5) {
        g_scriptWait(1000);
        VoxWriteCheckpointLine("VOX_SCRIPT_HEARTBEAT");
        ++heartbeatCount;
    }

    for (;;) {
        g_scriptWait(1000);
    }
}

BOOL WINAPI VoxDllEntry(HINSTANCE module, DWORD reason, LPVOID reserved)
{
    HMODULE scriptHook;
    VoxScriptRegisterFn scriptRegister;
    VoxScriptWaitFn scriptWait;

    (void)reserved;

    if (reason != DLL_PROCESS_ATTACH) {
        return TRUE;
    }

    /* Do not LoadLibrary from the loader callback. ScriptHookV is expected to have
     * already been loaded by the user's existing GTA V Enhanced ASI setup.
     */
    scriptHook = GetModuleHandleW(L"ScriptHookV.dll");
    if (scriptHook == NULL) {
        return TRUE;
    }

    scriptRegister = (VoxScriptRegisterFn)(void*)GetProcAddress(scriptHook, kScriptRegisterExport);
    scriptWait = (VoxScriptWaitFn)(void*)GetProcAddress(scriptHook, kScriptWaitExport);
    if (scriptRegister == NULL || scriptWait == NULL) {
        return TRUE;
    }

    g_scriptWait = scriptWait;
    scriptRegister(module, VoxScriptMain);
    return TRUE;
}
