#if !defined(_WIN32)
#error "Runtime smoke host is Windows-only"
#endif

#define WIN32_LEAN_AND_MEAN
#include <Windows.h>

#include <chrono>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <thread>
#include <vector>

namespace {

constexpr char kHistoricalScriptRegisterExport[] = "?scriptRegister@@YAXPEAUHINSTANCE__@@P6AXXZ@Z@Z";
constexpr char kHistoricalScriptWaitExport[] = "?scriptWait@@YAXK@Z";
constexpr char kDriftedScriptRegisterExport[] = "?scriptRegister@@VOX_ABI_DRIFT_TEST";
constexpr char kDriftedScriptWaitExport[] = "?scriptWait@@VOX_ABI_DRIFT_TEST";

std::filesystem::path CurrentExecutableDirectory() {
    std::vector<wchar_t> buffer(32768, L'\0');
    const DWORD length = GetModuleFileNameW(nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
    if (length == 0 || static_cast<std::size_t>(length) >= buffer.size()) {
        throw std::runtime_error{"GetModuleFileNameW failed"};
    }
    return std::filesystem::path{std::wstring_view{buffer.data(), static_cast<std::size_t>(length)}}.parent_path();
}

std::string ReadTextFile(const std::filesystem::path& path) {
    std::ifstream stream{path, std::ios::binary};
    if (!stream) {
        return {};
    }
    return std::string{std::istreambuf_iterator<char>{stream}, std::istreambuf_iterator<char>{}};
}

std::size_t CountOccurrences(std::string_view text, std::string_view needle) {
    std::size_t count = 0;
    std::size_t offset = 0;
    while ((offset = text.find(needle, offset)) != std::string_view::npos) {
        ++count;
        offset += needle.size();
    }
    return count;
}

DWORD WINAPI RunRegisteredScriptThread(LPVOID parameter) {
    const auto runner = reinterpret_cast<void (*)()>(parameter);
    runner();
    return 0;
}

} // namespace

int main() {
    try {
        const std::filesystem::path root = CurrentExecutableDirectory();
        const std::filesystem::path scriptHookPath = root / L"ScriptHookV.dll";
        const std::filesystem::path asiPath = root / L"VOXModernOverhaul.asi";
        const std::filesystem::path logPath = root / L"VOXModernOverhaul" / L"runtime_game_thread.log";

        std::error_code ec;
        std::filesystem::remove(logPath, ec);

        HMODULE scriptHook = LoadLibraryW(scriptHookPath.c_str());
        if (scriptHook == nullptr) {
            std::cerr << "FAIL_STAGE=LOAD_FAKE_SCRIPHOOK: error=" << GetLastError() << '\n';
            return 1;
        }

        // Ensure the fake really forces the new fallback path.
        if (GetProcAddress(scriptHook, kHistoricalScriptRegisterExport) != nullptr ||
            GetProcAddress(scriptHook, kHistoricalScriptWaitExport) != nullptr) {
            std::cerr << "FAIL_STAGE=FALLBACK_PRECONDITION: historical exact ABI unexpectedly exported\n";
            return 1;
        }
        if (GetProcAddress(scriptHook, kDriftedScriptRegisterExport) == nullptr) {
            std::cerr << "FAIL_STAGE=ABI_DRIFT_EXPORT_SCRIPT_REGISTER\n";
            return 1;
        }
        if (GetProcAddress(scriptHook, kDriftedScriptWaitExport) == nullptr) {
            std::cerr << "FAIL_STAGE=ABI_DRIFT_EXPORT_SCRIPT_WAIT\n";
            return 1;
        }

        const auto wasRegistered = reinterpret_cast<BOOL (*)()>(GetProcAddress(scriptHook, "VoxFakeWasRegistered"));
        const auto runner = reinterpret_cast<void (*)()>(GetProcAddress(scriptHook, "VoxFakeRunRegisteredScript"));
        if (wasRegistered == nullptr || runner == nullptr) {
            std::cerr << "FAIL_STAGE=FAKE_CONTROL_EXPORTS\n";
            return 1;
        }
        if (wasRegistered() != FALSE) {
            std::cerr << "FAIL_STAGE=PRECONDITION: fake ScriptHookV already has a registered script\n";
            return 1;
        }

        HMODULE asi = LoadLibraryW(asiPath.c_str());
        if (asi == nullptr) {
            std::cerr << "FAIL_STAGE=LOAD_ASI: error=" << GetLastError() << '\n';
            return 1;
        }

        if (wasRegistered() == FALSE) {
            std::cerr << "FAIL_STAGE=SCRIPT_REGISTER_NOT_CALLED_AFTER_EXPORT_FALLBACK\n";
            return 1;
        }

        HANDLE scriptThread = CreateThread(
            nullptr,
            0,
            RunRegisteredScriptThread,
            reinterpret_cast<LPVOID>(runner),
            0,
            nullptr);
        if (scriptThread == nullptr) {
            std::cerr << "FAIL_STAGE=SYNTHETIC_SCHEDULER_THREAD: error=" << GetLastError() << '\n';
            return 1;
        }
        CloseHandle(scriptThread);

        bool sawEnter = false;
        bool sawResume = false;
        std::size_t heartbeatCount = 0;
        const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds{5};
        while (std::chrono::steady_clock::now() < deadline) {
            const std::string text = ReadTextFile(logPath);
            sawEnter = text.find("VOX_SCRIPT_MAIN_ENTER") != std::string::npos;
            sawResume = text.find("VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT") != std::string::npos;
            heartbeatCount = CountOccurrences(text, "VOX_SCRIPT_HEARTBEAT");
            if (sawEnter && sawResume && heartbeatCount >= 5) {
                std::cout << "PASS: export-name drift fallback, registration, ScriptMain entry, wait/resume and five heartbeats observed\n";
                return 0;
            }
            std::this_thread::sleep_for(std::chrono::milliseconds{20});
        }

        if (!sawEnter) {
            std::cerr << "FAIL_STAGE=SCRIPT_MAIN_NOT_EXECUTED\n";
        } else if (!sawResume) {
            std::cerr << "FAIL_STAGE=SCRIPT_WAIT_NOT_RESUMED\n";
        } else {
            std::cerr << "FAIL_STAGE=HEARTBEAT_COUNT: observed=" << heartbeatCount << " expected>=5\n";
        }

        if (std::filesystem::exists(logPath)) {
            std::cerr << ReadTextFile(logPath) << '\n';
        }
        return 1;
    } catch (const std::exception& error) {
        std::cerr << "FAIL_STAGE=HOST_EXCEPTION: " << error.what() << '\n';
        return 1;
    }
}
