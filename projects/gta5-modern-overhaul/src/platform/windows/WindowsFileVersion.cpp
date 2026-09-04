#include "vox/platform/windows/WindowsFileVersion.hpp"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <winver.h>

#include <cstddef>
#include <sstream>
#include <vector>

namespace vox::platform::windows {
namespace {

std::string Win32Error(const char* operation) {
    return std::string{operation} + " failed with Win32 error " + std::to_string(GetLastError());
}

} // namespace

std::string WindowsFileVersion::ToString() const {
    std::ostringstream stream;
    stream << major << '.' << minor << '.' << patch << '.' << build;
    return stream.str();
}

WindowsFileVersionResult ReadWindowsFileVersion(const std::filesystem::path& executable) {
    WindowsFileVersionResult result;

    DWORD ignored = 0;
    const DWORD size = GetFileVersionInfoSizeW(executable.c_str(), &ignored);
    if (size == 0) {
        result.error = Win32Error("GetFileVersionInfoSizeW");
        return result;
    }

    std::vector<std::byte> data(size);
    if (GetFileVersionInfoW(executable.c_str(), 0, size, data.data()) == FALSE) {
        result.error = Win32Error("GetFileVersionInfoW");
        return result;
    }

    void* rootBlock = nullptr;
    UINT rootSize = 0;
    if (VerQueryValueW(data.data(), L"\\", &rootBlock, &rootSize) == FALSE ||
        rootBlock == nullptr || rootSize < sizeof(VS_FIXEDFILEINFO)) {
        result.error = "VerQueryValueW did not return a valid VS_FIXEDFILEINFO block";
        return result;
    }

    const auto* fixed = static_cast<const VS_FIXEDFILEINFO*>(rootBlock);
    if (fixed->dwSignature != 0xFEEF04BDU) {
        result.error = "invalid VS_FIXEDFILEINFO signature";
        return result;
    }

    result.version = WindowsFileVersion{
        static_cast<std::uint16_t>(HIWORD(fixed->dwFileVersionMS)),
        static_cast<std::uint16_t>(LOWORD(fixed->dwFileVersionMS)),
        static_cast<std::uint16_t>(HIWORD(fixed->dwFileVersionLS)),
        static_cast<std::uint16_t>(LOWORD(fixed->dwFileVersionLS)),
    };
    return result;
}

} // namespace vox::platform::windows
