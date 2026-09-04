#pragma once

#include <filesystem>
#include <string_view>

namespace vox::core {

inline constexpr std::string_view kEnhancedExecutableName = "gta5_enhanced.exe";

enum class EnhancedInstallStatus {
    Valid,
    EmptyPath,
    MissingDirectory,
    PathIsNotDirectory,
    MissingExecutable,
    ExecutableIsNotRegularFile,
    InvalidExecutableFormat,
    UnsupportedExecutableArchitecture,
    FilesystemError,
};

struct EnhancedInstallProbe final {
    EnhancedInstallStatus status{EnhancedInstallStatus::EmptyPath};
    std::filesystem::path root;
    std::filesystem::path executable;

    [[nodiscard]] bool valid() const noexcept {
        return status == EnhancedInstallStatus::Valid;
    }
};

[[nodiscard]] EnhancedInstallProbe ProbeEnhancedInstall(const std::filesystem::path& root);
[[nodiscard]] std::string_view ToString(EnhancedInstallStatus status) noexcept;

} // namespace vox::core
