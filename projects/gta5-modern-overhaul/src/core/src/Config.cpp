#include "vox/core/Config.hpp"

#include <charconv>
#include <cctype>
#include <limits>

namespace vox::core {
namespace {

std::string_view Trim(std::string_view value) noexcept {
    while (!value.empty() && std::isspace(static_cast<unsigned char>(value.front())) != 0) {
        value.remove_prefix(1);
    }
    while (!value.empty() && std::isspace(static_cast<unsigned char>(value.back())) != 0) {
        value.remove_suffix(1);
    }
    return value;
}

bool IsValidKey(std::string_view key) noexcept {
    if (key.empty()) {
        return false;
    }
    for (const char ch : key) {
        const unsigned char uch = static_cast<unsigned char>(ch);
        if (std::isalnum(uch) == 0 && ch != '_' && ch != '-' && ch != '.') {
            return false;
        }
    }
    return true;
}

std::optional<std::uint64_t> ParseUnsignedValue(std::string_view value) noexcept {
    value = Trim(value);
    if (value.empty()) {
        return std::nullopt;
    }

    std::uint64_t parsed = 0;
    const char* begin = value.data();
    const char* end = value.data() + value.size();
    const auto [ptr, ec] = std::from_chars(begin, end, parsed, 10);
    if (ec != std::errc{} || ptr != end) {
        return std::nullopt;
    }
    return parsed;
}

} // namespace

std::optional<std::string_view> ConfigParseResult::Get(std::string_view key) const {
    const auto found = values.find(std::string{key});
    if (found == values.end()) {
        return std::nullopt;
    }
    return std::string_view{found->second};
}

std::optional<bool> ConfigParseResult::GetBool(std::string_view key) const {
    const auto value = Get(key);
    if (!value) {
        return std::nullopt;
    }
    if (*value == "true") {
        return true;
    }
    if (*value == "false") {
        return false;
    }
    return std::nullopt;
}

std::optional<std::uint64_t> ConfigParseResult::GetUnsigned(std::string_view key) const {
    const auto value = Get(key);
    if (!value) {
        return std::nullopt;
    }
    return ParseUnsignedValue(*value);
}

ConfigParseResult ParseConfig(std::string_view text) {
    ConfigParseResult result;
    std::size_t lineNumber = 0;
    std::size_t offset = 0;

    while (offset <= text.size()) {
        ++lineNumber;
        const std::size_t lineEnd = text.find('\n', offset);
        const std::size_t count = lineEnd == std::string_view::npos ? text.size() - offset : lineEnd - offset;
        std::string_view line = text.substr(offset, count);
        if (!line.empty() && line.back() == '\r') {
            line.remove_suffix(1);
        }
        line = Trim(line);

        if (!line.empty() && line.front() != '#') {
            const std::size_t equals = line.find('=');
            if (equals == std::string_view::npos) {
                result.errors.push_back({lineNumber, "expected key=value"});
            } else {
                const std::string_view keyView = Trim(line.substr(0, equals));
                const std::string_view valueView = Trim(line.substr(equals + 1));
                if (!IsValidKey(keyView)) {
                    result.errors.push_back({lineNumber, "invalid key"});
                } else {
                    const std::string key{keyView};
                    if (result.values.contains(key)) {
                        result.errors.push_back({lineNumber, "duplicate key: " + key});
                    } else {
                        result.values.emplace(key, std::string{valueView});
                    }
                }
            }
        }

        if (lineEnd == std::string_view::npos) {
            break;
        }
        offset = lineEnd + 1;
    }

    const auto schema = result.GetUnsigned("schema_version");
    if (!schema) {
        result.errors.push_back({0, "missing or invalid schema_version"});
        return result;
    }
    if (*schema == 0 || *schema > std::numeric_limits<std::uint32_t>::max()) {
        result.errors.push_back({0, "schema_version out of range"});
        return result;
    }

    result.schemaVersion = static_cast<std::uint32_t>(*schema);
    return result;
}

} // namespace vox::core
