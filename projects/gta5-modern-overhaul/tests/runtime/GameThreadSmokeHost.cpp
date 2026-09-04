#if !defined(_WIN32)
#error "Runtime smoke host is Windows-only"
#endif

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
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
            std::cerr << "FAIL: LoadLibraryW(ScriptHookV.dll) error=" << GetLastError() << '\n';
            return 1;
        }

        HMODULE asi = LoadLibraryW(asiPath.c_str());
        if (asi == nullptr) {
            std::cerr << "FAIL: LoadLibraryW(VOXModernOverhaul.asi) error=" << GetLastError() << '\n';
            return 1;
        }

        const auto runner = reinterpret_cast<void (*)()>(GetProcAddress(scriptHook, "VoxFakeRunRegisteredScript"));
        if (runner == nullptr) {
            std::cerr << "FAIL: fake ScriptHookV runner export missing\n";
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
            std::cerr << "FAIL: CreateThread for synthetic scheduler error=" << GetLastError() << '\n';
            return 1;
        }
        CloseHandle(scriptThread);

        const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds{5};
        while (std::chrono::steady_clock::now() < deadline) {
            const std::string text = ReadTextFile(logPath);
            if (text.find("VOX_SCRIPT_MAIN_ENTER") != std::string::npos &&
                text.find("VOX_SCRIPT_MAIN_RESUMED_AFTER_WAIT") != std::string::npos &&
                CountOccurrences(text, "VOX_SCRIPT_HEARTBEAT") >= 5) {
                std::cout << "PASS: ScriptHookV registration, first yield/resume and five heartbeats observed\n";
                return 0;
            }
            std::this_thread::sleep_for(std::chrono::milliseconds{20});
        }

        std::cerr << "FAIL: ScriptHookV game-thread checkpoint markers were not observed\n";
        if (std::filesystem::exists(logPath)) {
            std::cerr << ReadTextFile(logPath) << '\n';
        }
        return 1;
    } catch (const std::exception& error) {
        std::cerr << "FAIL: runtime smoke exception: " << error.what() << '\n';
        return 1;
    }
}
