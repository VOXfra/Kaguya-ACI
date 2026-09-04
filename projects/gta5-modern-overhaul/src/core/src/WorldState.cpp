#include "vox/core/WorldState.hpp"

#include <algorithm>
#include <charconv>
#include <fstream>
#include <limits>
#include <set>
#include <sstream>
#include <system_error>

#if defined(_WIN32)
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#else
#include <fcntl.h>
#include <unistd.h>
#endif

namespace vox::core {
namespace {

constexpr std::string_view kMagic = "VOX_WORLD_STATE";
constexpr std::string_view kChecksumPrefix = "checksum=";

std::uint64_t Fnv1a64(const std::string_view text) noexcept {
    std::uint64_t hash = 14695981039346656037ull;
    for (const unsigned char byte : text) {
        hash ^= static_cast<std::uint64_t>(byte);
        hash *= 1099511628211ull;
    }
    return hash;
}

std::string Hex64(const std::uint64_t value) {
    char digits[16]{};
    static constexpr char alphabet[] = "0123456789abcdef";
    std::uint64_t current = value;
    for (int index = 15; index >= 0; --index) {
        digits[index] = alphabet[current & 0x0full];
        current >>= 4u;
    }
    return std::string{digits, sizeof(digits)};
}

template <typename T>
bool ParseUnsignedExact(const std::string_view text, T& value) noexcept {
    static_assert(std::is_unsigned_v<T>);
    if (text.empty()) {
        return false;
    }

    T parsed{};
    const char* begin = text.data();
    const char* end = begin + text.size();
    const auto result = std::from_chars(begin, end, parsed, 10);
    if (result.ec != std::errc{} || result.ptr != end) {
        return false;
    }
    value = parsed;
    return true;
}

bool ReadWholeFile(const std::filesystem::path& path, std::string& text, std::string& error) {
    std::ifstream stream{path, std::ios::binary};
    if (!stream.is_open()) {
        error = "open_failed";
        return false;
    }

    stream.seekg(0, std::ios::end);
    const auto size = stream.tellg();
    if (size < 0) {
        error = "size_failed";
        return false;
    }
    stream.seekg(0, std::ios::beg);

    text.resize(static_cast<std::size_t>(size));
    if (!text.empty()) {
        stream.read(text.data(), static_cast<std::streamsize>(text.size()));
    }
    if (!stream.good() && !stream.eof()) {
        error = "read_failed";
        return false;
    }
    return true;
}

bool FlushFileToDisk(const std::filesystem::path& path, std::string& error) {
#if defined(_WIN32)
    const HANDLE handle = CreateFileW(
        path.c_str(),
        GENERIC_WRITE,
        FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
        nullptr,
        OPEN_EXISTING,
        FILE_ATTRIBUTE_NORMAL,
        nullptr);
    if (handle == INVALID_HANDLE_VALUE) {
        error = "flush_open_failed";
        return false;
    }
    const BOOL flushed = FlushFileBuffers(handle);
    CloseHandle(handle);
    if (!flushed) {
        error = "flush_failed";
        return false;
    }
    return true;
#else
    const int descriptor = ::open(path.c_str(), O_RDONLY);
    if (descriptor < 0) {
        error = "flush_open_failed";
        return false;
    }
    const int result = ::fsync(descriptor);
    ::close(descriptor);
    if (result != 0) {
        error = "flush_failed";
        return false;
    }
    return true;
#endif
}

bool FlushDirectoryToDisk(const std::filesystem::path& directory) noexcept {
#if defined(_WIN32)
    (void)directory;
    return true;
#else
    const int descriptor = ::open(directory.c_str(), O_RDONLY | O_DIRECTORY);
    if (descriptor < 0) {
        return false;
    }
    const int result = ::fsync(descriptor);
    ::close(descriptor);
    return result == 0;
#endif
}

bool ReplaceAtomically(
    const std::filesystem::path& temporary,
    const std::filesystem::path& target,
    const std::filesystem::path& backup,
    std::string& error) {
#if defined(_WIN32)
    std::error_code existsError;
    const bool targetExists = std::filesystem::exists(target, existsError);
    if (existsError) {
        error = "target_exists_check_failed";
        return false;
    }

    if (targetExists) {
        if (ReplaceFileW(
                target.c_str(),
                temporary.c_str(),
                backup.c_str(),
                REPLACEFILE_WRITE_THROUGH,
                nullptr,
                nullptr) == FALSE) {
            error = "replace_file_failed";
            return false;
        }
        return true;
    }

    if (MoveFileExW(
            temporary.c_str(),
            target.c_str(),
            MOVEFILE_WRITE_THROUGH) == FALSE) {
        error = "move_file_failed";
        return false;
    }
    return true;
#else
    std::error_code filesystemError;
    if (std::filesystem::exists(target, filesystemError)) {
        if (filesystemError) {
            error = "target_exists_check_failed";
            return false;
        }
        std::filesystem::copy_file(
            target,
            backup,
            std::filesystem::copy_options::overwrite_existing,
            filesystemError);
        if (filesystemError) {
            error = "backup_copy_failed";
            return false;
        }
        if (!FlushFileToDisk(backup, error)) {
            return false;
        }
    } else if (filesystemError) {
        error = "target_exists_check_failed";
        return false;
    }

    if (::rename(temporary.c_str(), target.c_str()) != 0) {
        error = "rename_failed";
        return false;
    }
    (void)FlushDirectoryToDisk(target.parent_path());
    return true;
#endif
}

std::optional<WorldState> LoadOneFile(const std::filesystem::path& path, std::string& error) {
    std::string text;
    if (!ReadWholeFile(path, text, error)) {
        return std::nullopt;
    }
    return ParseWorldState(text, &error);
}

} // namespace

bool ValidateWorldState(const WorldState& state, std::string* error) {
    auto fail = [&](const char* message) {
        if (error != nullptr) {
            *error = message;
        }
        return false;
    };

    if (state.schemaVersion != kWorldStateSchemaVersion) {
        return fail("unsupported_schema");
    }
    if (state.nextEntityId == 0) {
        return fail("next_entity_id_zero");
    }

    std::set<EntityId::ValueType> ids;
    EntityId::ValueType maxId = 0;
    for (const auto& record : state.entities) {
        if (!record.id.valid()) {
            return fail("invalid_entity_id");
        }
        if (!IsValidEntityKind(record.kind)) {
            return fail("invalid_entity_kind");
        }
        if (!ids.insert(record.id.value()).second) {
            return fail("duplicate_entity_id");
        }
        maxId = std::max(maxId, record.id.value());
    }

    if (maxId >= state.nextEntityId) {
        return fail("next_entity_id_not_above_max");
    }

    if (error != nullptr) {
        error->clear();
    }
    return true;
}

std::string SerializeWorldState(const WorldState& state) {
    std::string validationError;
    if (!ValidateWorldState(state, &validationError)) {
        return {};
    }

    std::vector<EntityRecord> sorted = state.entities;
    std::sort(sorted.begin(), sorted.end(), [](const EntityRecord& left, const EntityRecord& right) {
        return left.id.value() < right.id.value();
    });

    std::ostringstream body;
    body << kMagic << '\n';
    body << "schema_version=" << state.schemaVersion << '\n';
    body << "next_entity_id=" << state.nextEntityId << '\n';
    body << "entity_count=" << sorted.size() << '\n';
    for (const auto& record : sorted) {
        body << "entity=" << record.id.value() << ',' << static_cast<std::uint16_t>(record.kind) << '\n';
    }

    const std::string bodyText = body.str();
    return bodyText + std::string{kChecksumPrefix} + Hex64(Fnv1a64(bodyText)) + "\n";
}

std::optional<WorldState> ParseWorldState(const std::string_view text, std::string* error) {
    auto fail = [&](const char* message) -> std::optional<WorldState> {
        if (error != nullptr) {
            *error = message;
        }
        return std::nullopt;
    };

    const std::string checksumMarker = "\n" + std::string{kChecksumPrefix};
    const std::size_t markerPos = text.rfind(checksumMarker);
    if (markerPos == std::string_view::npos) {
        return fail("checksum_missing");
    }

    const std::size_t checksumValueBegin = markerPos + checksumMarker.size();
    const std::size_t checksumLineEnd = text.find('\n', checksumValueBegin);
    if (checksumLineEnd == std::string_view::npos || checksumLineEnd + 1 != text.size()) {
        return fail("checksum_must_be_final_line");
    }

    const std::string_view checksumText = text.substr(
        checksumValueBegin,
        checksumLineEnd - checksumValueBegin);
    if (checksumText.size() != 16) {
        return fail("checksum_length_invalid");
    }

    std::uint64_t expectedChecksum{};
    const auto checksumParse = std::from_chars(
        checksumText.data(),
        checksumText.data() + checksumText.size(),
        expectedChecksum,
        16);
    if (checksumParse.ec != std::errc{} || checksumParse.ptr != checksumText.data() + checksumText.size()) {
        return fail("checksum_invalid");
    }

    const std::string_view body = text.substr(0, markerPos + 1);
    if (Fnv1a64(body) != expectedChecksum) {
        return fail("checksum_mismatch");
    }

    WorldState state{};
    bool schemaSeen = false;
    bool nextSeen = false;
    bool countSeen = false;
    std::size_t declaredCount = 0;

    std::istringstream stream{std::string{body}};
    std::string line;
    if (!std::getline(stream, line) || line != kMagic) {
        return fail("magic_invalid");
    }

    while (std::getline(stream, line)) {
        if (line.empty()) {
            continue;
        }

        constexpr std::string_view schemaPrefix = "schema_version=";
        constexpr std::string_view nextPrefix = "next_entity_id=";
        constexpr std::string_view countPrefix = "entity_count=";
        constexpr std::string_view entityPrefix = "entity=";

        const std::string_view view{line};
        if (view.starts_with(schemaPrefix)) {
            if (schemaSeen) return fail("schema_duplicate");
            std::uint32_t value{};
            if (!ParseUnsignedExact(view.substr(schemaPrefix.size()), value)) return fail("schema_invalid");
            state.schemaVersion = value;
            schemaSeen = true;
            continue;
        }
        if (view.starts_with(nextPrefix)) {
            if (nextSeen) return fail("next_entity_id_duplicate");
            EntityId::ValueType value{};
            if (!ParseUnsignedExact(view.substr(nextPrefix.size()), value)) return fail("next_entity_id_invalid");
            state.nextEntityId = value;
            nextSeen = true;
            continue;
        }
        if (view.starts_with(countPrefix)) {
            if (countSeen) return fail("entity_count_duplicate");
            std::uint64_t value{};
            if (!ParseUnsignedExact(view.substr(countPrefix.size()), value) ||
                value > static_cast<std::uint64_t>(std::numeric_limits<std::size_t>::max())) {
                return fail("entity_count_invalid");
            }
            declaredCount = static_cast<std::size_t>(value);
            countSeen = true;
            continue;
        }
        if (view.starts_with(entityPrefix)) {
            const std::string_view payload = view.substr(entityPrefix.size());
            const std::size_t comma = payload.find(',');
            if (comma == std::string_view::npos || payload.find(',', comma + 1) != std::string_view::npos) {
                return fail("entity_line_invalid");
            }

            EntityId::ValueType idValue{};
            std::uint16_t kindValue{};
            if (!ParseUnsignedExact(payload.substr(0, comma), idValue) ||
                !ParseUnsignedExact(payload.substr(comma + 1), kindValue)) {
                return fail("entity_value_invalid");
            }
            state.entities.push_back(EntityRecord{
                EntityId::FromRaw(idValue),
                static_cast<EntityKind>(kindValue)});
            continue;
        }

        return fail("unknown_line");
    }

    if (!schemaSeen || !nextSeen || !countSeen) {
        return fail("required_field_missing");
    }
    if (state.entities.size() != declaredCount) {
        return fail("entity_count_mismatch");
    }

    std::string validationError;
    if (!ValidateWorldState(state, &validationError)) {
        if (error != nullptr) {
            *error = validationError;
        }
        return std::nullopt;
    }

    if (error != nullptr) {
        error->clear();
    }
    return state;
}

WorldState SnapshotWorldState(const EntityRegistry& registry) {
    WorldState state{};
    state.schemaVersion = kWorldStateSchemaVersion;
    state.nextEntityId = registry.next_entity_id();
    state.entities = registry.Snapshot();
    return state;
}

WorldStateLoadResult LoadWorldStateFile(const std::filesystem::path& path) {
    WorldStateLoadResult result{};
    const std::filesystem::path backup = path.string() + ".bak";

    std::error_code filesystemError;
    const bool primaryExists = std::filesystem::exists(path, filesystemError);
    if (filesystemError) {
        result.status = WorldStateLoadStatus::Invalid;
        result.error = "primary_exists_check_failed";
        return result;
    }

    if (primaryExists) {
        std::string primaryError;
        if (auto primary = LoadOneFile(path, primaryError); primary.has_value()) {
            result.status = WorldStateLoadStatus::Loaded;
            result.state = std::move(primary);
            return result;
        }
        result.error = "primary_invalid:" + primaryError;
    }

    filesystemError.clear();
    const bool backupExists = std::filesystem::exists(backup, filesystemError);
    if (filesystemError) {
        result.status = WorldStateLoadStatus::Invalid;
        result.error += ";backup_exists_check_failed";
        return result;
    }

    if (backupExists) {
        std::string backupError;
        if (auto recovered = LoadOneFile(backup, backupError); recovered.has_value()) {
            result.status = WorldStateLoadStatus::RecoveredFromBackup;
            result.state = std::move(recovered);
            return result;
        }
        result.status = WorldStateLoadStatus::Invalid;
        result.error += ";backup_invalid:" + backupError;
        return result;
    }

    if (!primaryExists) {
        result.status = WorldStateLoadStatus::Missing;
        result.error.clear();
        return result;
    }

    result.status = WorldStateLoadStatus::Invalid;
    return result;
}

bool SaveWorldStateFileAtomic(
    const std::filesystem::path& path,
    const WorldState& state,
    std::string* error) {
    auto fail = [&](const std::string& message) {
        if (error != nullptr) {
            *error = message;
        }
        return false;
    };

    std::string validationError;
    if (!ValidateWorldState(state, &validationError)) {
        return fail("state_invalid:" + validationError);
    }

    const std::string serialized = SerializeWorldState(state);
    if (serialized.empty()) {
        return fail("serialize_failed");
    }

    std::error_code filesystemError;
    const auto parent = path.parent_path();
    if (!parent.empty()) {
        std::filesystem::create_directories(parent, filesystemError);
        if (filesystemError) {
            return fail("create_directories_failed");
        }
    }

    const std::filesystem::path temporary = path.string() + ".tmp";
    const std::filesystem::path backup = path.string() + ".bak";
    std::filesystem::remove(temporary, filesystemError);
    filesystemError.clear();

    {
        std::ofstream stream{temporary, std::ios::binary | std::ios::trunc};
        if (!stream.is_open()) {
            return fail("temporary_open_failed");
        }
        stream.write(serialized.data(), static_cast<std::streamsize>(serialized.size()));
        stream.flush();
        if (!stream.good()) {
            stream.close();
            std::filesystem::remove(temporary, filesystemError);
            return fail("temporary_write_failed");
        }
    }

    std::string flushError;
    if (!FlushFileToDisk(temporary, flushError)) {
        std::filesystem::remove(temporary, filesystemError);
        return fail(flushError);
    }

    std::string replaceError;
    if (!ReplaceAtomically(temporary, path, backup, replaceError)) {
        std::filesystem::remove(temporary, filesystemError);
        return fail(replaceError);
    }

    if (error != nullptr) {
        error->clear();
    }
    return true;
}

} // namespace vox::core
