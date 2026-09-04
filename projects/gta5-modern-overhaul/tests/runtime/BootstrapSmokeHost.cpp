#if !defined(_WIN32)
#error "Runtime smoke host is Windows-only"
#endif

#define WIN32_LEAN_AND_MEAN
#include <Windows.h>

#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
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

std::string ReadAll(const std::filesystem::path& path) {
    std::ifstream stream{path, std::ios::binary};
    if (!stream.is_open()) {
        return {};
    }
    std::ostringstream content;
    content << stream.rdbuf();
    return stream.bad() ? std::string{} : content.str();
}

} // namespace

int main() {
    try {
        const std::filesystem::path root = CurrentExecutableDirectory();
        const std::filesystem::path asiPath = root / L"VOXModernOverhaul.asi";
        const std::filesystem::path logPath = root / L"VOXModernOverhaul" / L"logs" / L"bootstrap.log";

        std::error_code removeError;
        std::filesystem::remove(logPath, removeError);

        HMODULE module = LoadLibraryW(asiPath.c_str());
        if (module == nullptr) {
            std::cerr << "FAIL: LoadLibraryW(VOXModernOverhaul.asi) error=" << GetLastError() << '\n';
            return 1;
        }

        constexpr std::string_view expectedMarker =
            "CHECKPOINT_OK: ASI loaded in GTA V Enhanced; no gameplay hooks or memory patches are active.";

        for (int attempt = 0; attempt < 100; ++attempt) {
            const std::string content = ReadAll(logPath);
            if (content.find(expectedMarker) != std::string::npos) {
                Sleep(100);
                std::cout << "PASS: runtime ASI smoke checkpoint\n";
                return 0;
            }
            Sleep(50);
        }

        std::cerr << "FAIL: runtime checkpoint marker not observed\n";
        const std::string finalLog = ReadAll(logPath);
        if (!finalLog.empty()) {
            std::cerr << finalLog << '\n';
        }
        return 1;
    } catch (const std::exception& error) {
        std::cerr << "FAIL: runtime smoke exception: " << error.what() << '\n';
        return 1;
    }
}
