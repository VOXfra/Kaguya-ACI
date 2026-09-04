#include "vox/core/Config.hpp"
#include "vox/core/GameInstall.hpp"
#include "vox/core/Logger.hpp"
#include "vox/platform/windows/WindowsFileVersion.hpp"

#if !defined(_WIN32)
#error "VOX Modern Overhaul ASI bootstrap is Windows-only"
#endif

#define WIN32_LEAN_AND_MEAN
#include <Windows.h>

#include <filesystem>
#include <fstream>
#include <optional>
#include <sstream>
#include <string>
#include <string_view>
#include <vector>

namespace {

constexpr char kRuntimeVersion[] = "0.0.1-dev.8";
constexpr wchar_t kEnhancedProcessName[] = L"gta5_enhanced.exe";
constexpr wchar_t kDataDirectoryName[] = L"VOXModernOverhaul";
constexpr wchar_t kConfigRelativePath[] = L"config\\core.cfg";
constexpr wchar_t kLogRelativePath[] = L"logs\\bootstrap.log";

std::optional<std::filesystem::path> CurrentExecutablePath() {
    std::vector<wchar_t> buffer(32768, L'\0');
    const DWORD length = GetModuleFileNameW(nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
    if (length == 0 || static_cast<std::size_t>(length) >= buffer.size()) {
        return std::nullopt;
    }
    return std::filesystem::path{std::wstring_view{buffer.data(), static_cast<std::size_t>(length)}};
}

bool IsEnhancedProcess(const std::filesystem::path& executablePath) {
    const std::wstring filename = executablePath.filename().wstring();
    return CompareStringOrdinal(filename.c_str(), -1, kEnhancedProcessName, -1, TRUE) == CSTR_EQUAL;
}

std::optional<std::string> ReadTextFile(const std::filesystem::path& path) {
    std::ifstream stream{path, std::ios::binary};
    if (!stream.is_open()) {
        return std::nullopt;
    }

    std::ostringstream content;
    content << stream.rdbuf();
    if (stream.bad()) {
        return std::nullopt;
    }
    return content.str();
}

std::string Utf8Path(const std::filesystem::path& path) {
    const auto encoded = path.u8string();
    return std::string{encoded.begin(), encoded.end()};
}

bool FileExists(const std::filesystem::path& path) {
    std::error_code error;
    return std::filesystem::is_regular_file(path, error) && !error;
}

DWORD RunBootstrap() {
    const auto executablePath = CurrentExecutablePath();
    if (!executablePath) {
        OutputDebugStringA("VOX Modern Overhaul: unable to resolve current executable path.\n");
        return 0;
    }

    const std::filesystem::path gameRoot = executablePath->parent_path();
    const std::filesystem::path dataRoot = gameRoot / kDataDirectoryName;
    const std::filesystem::path logPath = dataRoot / kLogRelativePath;

    vox::core::Logger logger{logPath};
    if (!logger.ready()) {
        OutputDebugStringA("VOX Modern Overhaul: unable to initialize bootstrap log.\n");
        return 0;
    }

    logger.Write(vox::core::LogLevel::Info, std::string{"VOX Modern Overhaul bootstrap "} + kRuntimeVersion);
    logger.Write(vox::core::LogLevel::Info, std::string{"process="} + Utf8Path(*executablePath));

    if (!IsEnhancedProcess(*executablePath)) {
        logger.Write(vox::core::LogLevel::Error,
                     "Current process is not gta5_enhanced.exe. Runtime disabled without touching game state.");
        return 0;
    }

    const auto install = vox::core::ProbeEnhancedInstall(gameRoot);
    logger.Write(vox::core::LogLevel::Info,
                 std::string{"enhanced_probe="} + std::string{vox::core::ToString(install.status)});

    if (!install.valid()) {
        logger.Write(vox::core::LogLevel::Error,
                     "Enhanced install validation failed. Runtime disabled without touching game state.");
        return 0;
    }

    const auto versionResult = vox::platform::windows::ReadWindowsFileVersion(install.executable);
    if (versionResult.valid()) {
        logger.Write(vox::core::LogLevel::Info,
                     std::string{"game_file_version="} + versionResult.version->ToString());
    } else {
        logger.Write(vox::core::LogLevel::Warning,
                     std::string{"game_file_version_unavailable="} + versionResult.error);
    }

    logger.Write(vox::core::LogLevel::Info,
                 std::string{"asi_loader_dinput8="} + (FileExists(gameRoot / L"dinput8.dll") ? "present" : "missing"));
    logger.Write(vox::core::LogLevel::Info,
                 std::string{"scripthookv="} + (FileExists(gameRoot / L"ScriptHookV.dll") ? "present" : "missing"));

    const std::filesystem::path configPath = dataRoot / kConfigRelativePath;
    const auto configText = ReadTextFile(configPath);
    if (!configText) {
        logger.Write(vox::core::LogLevel::Error,
                     std::string{"config_missing_or_unreadable="} + Utf8Path(configPath));
        logger.Write(vox::core::LogLevel::Info,
                     "Diagnostic bootstrap completed; gameplay systems remain disabled.");
        return 0;
    }

    const auto config = vox::core::ParseConfig(*configText);
    if (!config.valid()) {
        logger.Write(vox::core::LogLevel::Error, "config_invalid; gameplay systems remain disabled");
        for (const auto& error : config.errors) {
            logger.Write(vox::core::LogLevel::Error,
                         "config_error line=" + std::to_string(error.line) + " message=" + error.message);
        }
        return 0;
    }

    const auto enabled = config.GetBool("diagnostic_bootstrap_enabled");
    if (!enabled.has_value()) {
        logger.Write(vox::core::LogLevel::Error,
                     "config key diagnostic_bootstrap_enabled must be true or false");
        return 0;
    }
    if (!*enabled) {
        logger.Write(vox::core::LogLevel::Info,
                     "diagnostic_bootstrap_enabled=false; checkpoint disabled by configuration");
        return 0;
    }

    logger.Write(vox::core::LogLevel::Info, "diagnostic_bootstrap_enabled=true");
    logger.Write(vox::core::LogLevel::Info,
                 "CHECKPOINT_OK: ASI loaded in GTA V Enhanced; no gameplay hooks or memory patches are active.");
    return 0;
}

DWORD WINAPI BootstrapThread(void*) noexcept {
    try {
        return RunBootstrap();
    } catch (...) {
        OutputDebugStringA("VOX Modern Overhaul: unhandled bootstrap exception; runtime disabled.\n");
        return 0;
    }
}

} // namespace

BOOL APIENTRY DllMain(HMODULE module, DWORD reason, LPVOID) {
    if (reason != DLL_PROCESS_ATTACH) {
        return TRUE;
    }

    DisableThreadLibraryCalls(module);

    HANDLE thread = CreateThread(nullptr, 0, BootstrapThread, nullptr, 0, nullptr);
    if (thread != nullptr) {
        CloseHandle(thread);
    } else {
        OutputDebugStringA("VOX Modern Overhaul: bootstrap thread creation failed.\n");
    }

    return TRUE;
}
