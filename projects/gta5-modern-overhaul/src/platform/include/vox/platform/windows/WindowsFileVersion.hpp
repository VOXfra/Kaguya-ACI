#pragma once

#include <cstdint>
#include <filesystem>
#include <optional>
#include <string>

namespace vox::platform::windows {

struct WindowsFileVersion final {
    std::uint16_t major{0};
    std::uint16_t minor{0};
    std::uint16_t patch{0};
    std::uint16_t build{0};

    [[nodiscard]] std::string ToString() const;
};

struct WindowsFileVersionResult final {
    std::optional<WindowsFileVersion> version;
    std::string error;

    [[nodiscard]] bool valid() const noexcept { return version.has_value(); }
};

[[nodiscard]] WindowsFileVersionResult ReadWindowsFileVersion(const std::filesystem::path& executable);

} // namespace vox::platform::windows
