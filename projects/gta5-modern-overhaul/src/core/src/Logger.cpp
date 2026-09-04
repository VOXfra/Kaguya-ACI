#include "vox/core/Logger.hpp"

#include <chrono>
#include <iomanip>
#include <sstream>
#include <system_error>

namespace vox::core {
namespace {

std::string TimestampNow() {
    using Clock = std::chrono::system_clock;
    const auto now = Clock::now();
    const std::time_t nowTime = Clock::to_time_t(now);

    std::tm localTime{};
#if defined(_WIN32)
    localtime_s(&localTime, &nowTime);
#else
    localtime_r(&nowTime, &localTime);
#endif

    std::ostringstream stream;
    stream << std::put_time(&localTime, "%Y-%m-%d %H:%M:%S");
    return stream.str();
}

} // namespace

Logger::Logger(std::filesystem::path filePath) {
    std::error_code error;
    const auto parent = filePath.parent_path();
    if (!parent.empty()) {
        std::filesystem::create_directories(parent, error);
        if (error) {
            return;
        }
    }

    stream_.open(filePath, std::ios::out | std::ios::app);
}

bool Logger::ready() const noexcept {
    std::scoped_lock lock{mutex_};
    return stream_.is_open() && stream_.good();
}

void Logger::Write(LogLevel level, std::string_view message) {
    std::scoped_lock lock{mutex_};
    if (!stream_.is_open()) {
        return;
    }

    stream_ << '[' << TimestampNow() << "] [" << LevelName(level) << "] " << message << '\n';
    stream_.flush();
}

std::string_view Logger::LevelName(LogLevel level) noexcept {
    switch (level) {
        case LogLevel::Trace:
            return "TRACE";
        case LogLevel::Info:
            return "INFO";
        case LogLevel::Warning:
            return "WARN";
        case LogLevel::Error:
            return "ERROR";
    }

    return "UNKNOWN";
}

} // namespace vox::core
