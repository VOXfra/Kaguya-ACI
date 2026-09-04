#pragma once

#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

namespace vox::core {

struct ConfigError final {
    std::size_t line{0};
    std::string message;
};

struct ConfigParseResult final {
    std::unordered_map<std::string, std::string> values;
    std::vector<ConfigError> errors;
    std::uint32_t schemaVersion{0};

    [[nodiscard]] bool valid() const noexcept { return errors.empty() && schemaVersion != 0; }
    [[nodiscard]] std::optional<std::string_view> Get(std::string_view key) const;
    [[nodiscard]] std::optional<bool> GetBool(std::string_view key) const;
    [[nodiscard]] std::optional<std::uint64_t> GetUnsigned(std::string_view key) const;
};

[[nodiscard]] ConfigParseResult ParseConfig(std::string_view text);

} // namespace vox::core
