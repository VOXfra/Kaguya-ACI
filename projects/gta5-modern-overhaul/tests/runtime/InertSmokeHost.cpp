#if !defined(_WIN32)
#error "Runtime smoke host is Windows-only"
#endif

#define WIN32_LEAN_AND_MEAN
#include <Windows.h>

#include <filesystem>
#include <iostream>
#include <stdexcept>
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

} // namespace

int main() {
    try {
        const std::filesystem::path root = CurrentExecutableDirectory();
        const std::filesystem::path asiPath = root / L"VOXModernOverhaul.asi";

        HMODULE module = LoadLibraryW(asiPath.c_str());
        if (module == nullptr) {
            std::cerr << "FAIL: LoadLibraryW(VOXModernOverhaul.asi) error=" << GetLastError() << '\n';
            return 1;
        }

        // Keep the inert ASI resident briefly to exercise a stable loaded state.
        Sleep(2000);

        if (GetModuleHandleW(L"VOXModernOverhaul.asi") == nullptr) {
            std::cerr << "FAIL: ASI disappeared while expected to remain loaded\n";
            return 1;
        }

        if (FreeLibrary(module) == 0) {
            std::cerr << "FAIL: FreeLibrary(VOXModernOverhaul.asi) error=" << GetLastError() << '\n';
            return 1;
        }

        std::cout << "PASS: inert ASI load/residency/unload checkpoint\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << "FAIL: runtime smoke exception: " << error.what() << '\n';
        return 1;
    }
}
