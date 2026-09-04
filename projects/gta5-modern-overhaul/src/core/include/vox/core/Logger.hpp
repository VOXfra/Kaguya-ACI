#pragma once

#include <filesystem>
#include <fstream>
#include <mutex>
#include <string_view>

namespace vox::core {

enum class LogLevel {
    Trace,
    Info,
    Warning,
    Error,
};

class Logger final {
public:
    explicit Logger(std::filesystem::path filePath);

    Logger(const Logger&) = delete;
    Logger& operator=(const Logger&) = delete;
    Logger(Logger&&) = delete;
    Logger& operator=(Logger&&) = delete;

    [[nodiscard]] bool ready() const noexcept;
    void Write(LogLevel level, std::string_view message);

private:
    static std::string_view LevelName(LogLevel level) noexcept;

    mutable std::mutex mutex_;
    std::ofstream stream_;
};

} // namespace vox::core
