#ifdef _WIN32

#include <ps5native/win32_local_user_backend.hpp>

#include <Lmcons.h>

#include <array>
#include <string>
#include <vector>

namespace ps5native {
namespace {

std::string utf8_from_wide(
    const std::wstring& wide) {

    if (wide.empty()) {
        return {};
    }

    const int needed =
        WideCharToMultiByte(
            CP_UTF8,
            0,
            wide.data(),
            static_cast<int>(
                wide.size()),
            nullptr,
            0,
            nullptr,
            nullptr);

    if (needed <= 0) {
        return {};
    }

    std::string utf8(
        static_cast<std::size_t>(
            needed),
        '\0');

    WideCharToMultiByte(
        CP_UTF8,
        0,
        wide.data(),
        static_cast<int>(
            wide.size()),
        utf8.data(),
        needed,
        nullptr,
        nullptr);

    return utf8;
}

} // namespace

std::optional<HostUserIdentity>
Win32LocalUserBackend::local_identity()
    const {

    std::array<wchar_t,
        UNLEN + 1> user_buffer{};

    DWORD user_size =
        static_cast<DWORD>(
            user_buffer.size());

    if (!GetUserNameW(
            user_buffer.data(),
            &user_size)) {

        return std::nullopt;
    }

    std::wstring user_name(
        user_buffer.data());

    std::array<wchar_t,
        LOCALE_NAME_MAX_LENGTH>
        locale_buffer{};

    std::wstring locale;

    const int locale_size =
        GetUserDefaultLocaleName(
            locale_buffer.data(),
            static_cast<int>(
                locale_buffer.size()));

    if (locale_size > 0) {
        locale =
            locale_buffer.data();
    }

    HostUserIdentity identity;

    identity.display_name =
        utf8_from_wide(
            user_name);

    identity.locale =
        utf8_from_wide(
            locale);

    if (identity.display_name.empty()) {
        return std::nullopt;
    }

    return identity;
}

} // namespace ps5native

#endif
