#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>

/*
 * Checkpoint 0F runtime.
 *
 * Design constraints:
 * - custom PE entrypoint, no CRT/default libraries;
 * - no GTA natives, hooks, memory patches or save/world writes;
 * - never LoadLibrary from the loader callback;
 * - ScriptHookV must already be loaded by the user's existing loader;
 * - resolve only scriptRegister/scriptWait and fail closed if ABI resolution fails;
 * - tolerate harmless C++ export-name decoration drift across ScriptHookV builds;
 * - all repeated work runs from ScriptHookV's registered script context.
 */

typedef void(__cdecl *VoxScriptMainFn)(void);
typedef void(__cdecl *VoxScriptRegisterFn)(HMODULE, VoxScriptMainFn);
typedef void(__cdecl *VoxScriptWaitFn)(DWORD);

static VoxScriptWaitFn g_scriptWait = NULL;

static const char kScriptRegisterExport[] =
    "?scriptRegister@@YAXPEAUHINSTANCE__@@P6AXXZ@Z@Z";
static const char kScriptWaitExport[] = "?scriptWait@@YAXK@Z";
static const char kScriptRegisterStem[] = "scriptRegister";
static const char kScriptWaitStem[] = "scriptWait";

static BOOL VoxAsciiEquals(const char* left, const char* right)
{
    if (left == NULL || right == NULL) {
        return FALSE;
    }

    while (*left != '\0' && *right != '\0') {
        if (*left != *right) {
            return FALSE;
        }
        ++left;
        ++right;
    }

    return *left == '\0' && *right == '\0';
}

static BOOL VoxMatchesCppExportStem(const char* exportName, const char* stem)
{
    const char* name;
    const char* wanted;

    if (exportName == NULL || stem == NULL) {
        return FALSE;
    }

    /* Some DLLs may expose an undecorated alias. */
    if (VoxAsciiEquals(exportName, stem)) {
        return TRUE;
    }

    /* Normal MSVC C++ exports begin with '?' and put '@@' immediately after the
     * function identifier. Requiring that delimiter prevents scriptRegister from
     * accidentally matching scriptRegisterAdditionalThread.
     */
    if (*exportName != '?') {
        return FALSE;
    }

    name = exportName + 1;
    wanted = stem;
    while (*wanted != '\0') {
        if (*name != *wanted) {
            return FALSE;
        }
        ++name;
        ++wanted;
    }

    return name[0] == '@' && name[1] == '@';
}

static FARPROC VoxResolveExportByStem(HMODULE module, const char* exactName, const char* stem)
{
    FARPROC exact;
    BYTE* base;
    IMAGE_DOS_HEADER* dos;
    IMAGE_NT_HEADERS64* nt;
    IMAGE_DATA_DIRECTORY exportData;
    IMAGE_EXPORT_DIRECTORY* exports;
    DWORD* nameRvas;
    DWORD index;
    const char* candidate = NULL;

    if (module == NULL || exactName == NULL || stem == NULL) {
        return NULL;
    }

    /* Fast path for the ABI name used by the historical/current SDK. */
    exact = GetProcAddress(module, exactName);
    if (exact != NULL) {
        return exact;
    }

    /* Also accept an explicit undecorated alias if a future build exposes one. */
    exact = GetProcAddress(module, stem);
    if (exact != NULL) {
        return exact;
    }

    /* Last-resort compatibility path: inspect the already-loaded module's export
     * names and locate the unique C++ export by semantic function identifier.
     * We still use GetProcAddress for the final address so forwarded exports remain
     * Windows' responsibility.
     */
    base = (BYTE*)(void*)module;
    dos = (IMAGE_DOS_HEADER*)(void*)base;
    if (dos->e_magic != IMAGE_DOS_SIGNATURE || dos->e_lfanew <= 0) {
        return NULL;
    }

    nt = (IMAGE_NT_HEADERS64*)(void*)(base + dos->e_lfanew);
    if (nt->Signature != IMAGE_NT_SIGNATURE ||
        nt->OptionalHeader.Magic != IMAGE_NT_OPTIONAL_HDR64_MAGIC) {
        return NULL;
    }

    exportData = nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_EXPORT];
    if (exportData.VirtualAddress == 0 || exportData.Size < sizeof(IMAGE_EXPORT_DIRECTORY)) {
        return NULL;
    }

    exports = (IMAGE_EXPORT_DIRECTORY*)(void*)(base + exportData.VirtualAddress);
    if (exports->AddressOfNames == 0 || exports->NumberOfNames == 0) {
        return NULL;
    }

    nameRvas = (DWORD*)(void*)(base + exports->AddressOfNames);
    for (index = 0; index < exports->NumberOfNames; ++index) {
        const char* exportName;

        if (nameRvas[index] == 0) {
            continue;
        }

        exportName = (const char*)(const void*)(base + nameRvas[index]);
        if (!VoxMatchesCppExportStem(exportName, stem)) {
            continue;
        }

        /* Ambiguity is more dangerous than disabling ourselves. */
        if (candidate != NULL) {
            return NULL;
        }
        candidate = exportName;
    }

    if (candidate == NULL) {
        return NULL;
    }

    return GetProcAddress(module, candidate);
}

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

    g_scriptWait(0);
    VoxWriteCheckpointLine("VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT");

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

    scriptHook = GetModuleHandleW(L"ScriptHookV.dll");
    if (scriptHook == NULL) {
        return TRUE;
    }

    scriptRegister = (VoxScriptRegisterFn)(void*)VoxResolveExportByStem(
        scriptHook,
        kScriptRegisterExport,
        kScriptRegisterStem);
    scriptWait = (VoxScriptWaitFn)(void*)VoxResolveExportByStem(
        scriptHook,
        kScriptWaitExport,
        kScriptWaitStem);
    if (scriptRegister == NULL || scriptWait == NULL) {
        return TRUE;
    }

    g_scriptWait = scriptWait;
    scriptRegister(module, VoxScriptMain);
    return TRUE;
}
