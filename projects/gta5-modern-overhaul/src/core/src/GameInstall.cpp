#include "vox/core/GameInstall.hpp"

#include <array>
#include <cstdint>
#include <fstream>
#include <string>
#include <system_error>

namespace vox::core {
namespace {

constexpr std::uint16_t kAmd64Machine = 0x8664;

bool ReadExact(std::ifstream& stream, char* destination, const std::streamsize size) {
    stream.read(destination, size);
    return stream.gcount() == size;
}

std::uint32_t ReadLe32(const std::array<unsigned char, 64>& bytes, const std::size_t offset) noexcept {
    return static_cast<std::uint32_t>(bytes[offset]) |
           (static_cast<std::uint32_t>(bytes[offset + 1]) << 8U) |
           (static_cast<std::uint32_t>(bytes[offset + 2]) << 16U) |
           (static_cast<std::uint32_t>(bytes[offset + 3]) << 24U);
}

std::uint16_t ReadLe16(const unsigned char low, const unsigned char high) noexcept {
    return static_cast<std::uint16_t>(low) |
           static_cast<std::uint16_t>(static_cast<std::uint16_t>(high) << 8U);
}

enum class PeProbeResult {
    ValidAmd64,
    InvalidFormat,
    UnsupportedArchitecture,
};

PeProbeResult ProbePeImage(const std::filesystem::path& executable) {
    std::ifstream stream{executable, std::ios::binary};
    if (!stream.is_open()) {
        return PeProbeResult::InvalidFormat;
    }

    std::array<unsigned char, 64> dos{};
    if (!ReadExact(stream, reinterpret_cast<char*>(dos.data()), static_cast<std::streamsize>(dos.size()))) {
        return PeProbeResult::InvalidFormat;
    }

    if (dos[0] != static_cast<unsigned char>('M') || dos[1] != static_cast<unsigned char>('Z')) {
        return PeProbeResult::InvalidFormat;
    }

    const std::uint32_t peOffset = ReadLe32(dos, 0x3C);
    if (peOffset < dos.size()) {
        return PeProbeResult::InvalidFormat;
    }

    stream.clear();
    stream.seekg(static_cast<std::streamoff>(peOffset), std::ios::beg);
    if (!stream.good()) {
        return PeProbeResult::InvalidFormat;
    }

    std::array<unsigned char, 6> peHeader{};
    if (!ReadExact(stream, reinterpret_cast<char*>(peHeader.data()), static_cast<std::streamsize>(peHeader.size()))) {
        return PeProbeResult::InvalidFormat;
    }

    if (peHeader[0] != static_cast<unsigned char>('P') ||
        peHeader[1] != static_cast<unsigned char>('E') ||
        peHeader[2] != 0 ||
        peHeader[3] != 0) {
        return PeProbeResult::InvalidFormat;
    }

    const std::uint16_t machine = ReadLe16(peHeader[4], peHeader[5]);
    if (machine != kAmd64Machine) {
        return PeProbeResult::UnsupportedArchitecture;
    }

    return PeProbeResult::ValidAmd64;
}

} // namespace

EnhancedInstallProbe ProbeEnhancedInstall(const std::filesystem::path& root) {
    EnhancedInstallProbe result;
    result.root = root;

    if (root.empty()) {
        result.status = EnhancedInstallStatus::EmptyPath;
        return result;
    }

    std::error_code error;
    const bool rootExists = std::filesystem::exists(root, error);
    if (error) {
        result.status = EnhancedInstallStatus::FilesystemError;
        return result;
    }
    if (!rootExists) {
        result.status = EnhancedInstallStatus::MissingDirectory;
        return result;
    }

    const bool rootIsDirectory = std::filesystem::is_directory(root, error);
    if (error) {
        result.status = EnhancedInstallStatus::FilesystemError;
        return result;
    }
    if (!rootIsDirectory) {
        result.status = EnhancedInstallStatus::PathIsNotDirectory;
        return result;
    }

    result.executable = root / std::string{kEnhancedExecutableName};
    const bool executableExists = std::filesystem::exists(result.executable, error);
    if (error) {
        result.status = EnhancedInstallStatus::FilesystemError;
        return result;
    }
    if (!executableExists) {
        result.status = EnhancedInstallStatus::MissingExecutable;
        return result;
    }

    const bool executableIsFile = std::filesystem::is_regular_file(result.executable, error);
    if (error) {
        result.status = EnhancedInstallStatus::FilesystemError;
        return result;
    }
    if (!executableIsFile) {
        result.status = EnhancedInstallStatus::ExecutableIsNotRegularFile;
        return result;
    }

    switch (ProbePeImage(result.executable)) {
        case PeProbeResult::InvalidFormat:
            result.status = EnhancedInstallStatus::InvalidExecutableFormat;
            return result;
        case PeProbeResult::UnsupportedArchitecture:
            result.status = EnhancedInstallStatus::UnsupportedExecutableArchitecture;
            return result;
        case PeProbeResult::ValidAmd64:
            result.status = EnhancedInstallStatus::Valid;
            return result;
    }

    result.status = EnhancedInstallStatus::InvalidExecutableFormat;
    return result;
}

std::string_view ToString(const EnhancedInstallStatus status) noexcept {
    switch (status) {
        case EnhancedInstallStatus::Valid: return "valid";
        case EnhancedInstallStatus::EmptyPath: return "empty_path";
        case EnhancedInstallStatus::MissingDirectory: return "missing_directory";
        case EnhancedInstallStatus::PathIsNotDirectory: return "path_is_not_directory";
        case EnhancedInstallStatus::MissingExecutable: return "missing_executable";
        case EnhancedInstallStatus::ExecutableIsNotRegularFile: return "executable_is_not_regular_file";
        case EnhancedInstallStatus::InvalidExecutableFormat: return "invalid_executable_format";
        case EnhancedInstallStatus::UnsupportedExecutableArchitecture: return "unsupported_executable_architecture";
        case EnhancedInstallStatus::FilesystemError: return "filesystem_error";
    }
    return "unknown";
}

} // namespace vox::core
