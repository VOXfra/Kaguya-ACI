#ifdef _WIN32

#include <ps5native/win32_online_state_backend.hpp>

#include <Windows.h>
#include <iphlpapi.h>

namespace ps5native {

namespace {

using GetConnectivityHintFn =
    DWORD (WINAPI*)(
        NL_NETWORK_CONNECTIVITY_HINT*);

GetConnectivityHintFn
load_connectivity_function(
    HMODULE& module) {

    module =
        ::LoadLibraryW(
            L"iphlpapi.dll");

    if (!module) {
        return nullptr;
    }

    const auto proc =
        ::GetProcAddress(
            module,
            "GetNetworkConnectivityHint");

    if (!proc) {
        ::FreeLibrary(module);
        module = nullptr;
        return nullptr;
    }

    return reinterpret_cast<
        GetConnectivityHintFn>(proc);
}

NetworkReachability
map_reachability(
    NL_NETWORK_CONNECTIVITY_LEVEL_HINT level) {

    switch (level) {
    case NetworkConnectivityLevelHintNone:
        return NetworkReachability::Offline;

    case NetworkConnectivityLevelHintLocalAccess:
        return NetworkReachability::LocalOnly;

    case NetworkConnectivityLevelHintInternetAccess:
        return NetworkReachability::Internet;

    case NetworkConnectivityLevelHintConstrainedInternetAccess:
        return NetworkReachability::
            ConstrainedInternet;

    case NetworkConnectivityLevelHintUnknown:
    case NetworkConnectivityLevelHintHidden:
    default:
        return NetworkReachability::Unknown;
    }
}

} // namespace

bool Win32OnlineStateBackend::available()
    const noexcept {

    HMODULE module = nullptr;

    const auto function =
        load_connectivity_function(
            module);

    if (module) {
        ::FreeLibrary(module);
    }

    return function != nullptr;
}

std::optional<HostNetworkState>
Win32OnlineStateBackend::network_state()
    const {

    HMODULE module = nullptr;

    const auto function =
        load_connectivity_function(
            module);

    if (!function) {
        return std::nullopt;
    }

    NL_NETWORK_CONNECTIVITY_HINT hint{};

    const DWORD result =
        function(&hint);

    ::FreeLibrary(module);

    if (result != NO_ERROR) {
        return std::nullopt;
    }

    HostNetworkState state;

    state.reachability =
        map_reachability(
            hint.ConnectivityLevel);

    state.online_service_reachable =
        false;

    return state;
}

std::optional<HostOnlineUserState>
Win32OnlineStateBackend::user_state(
    PlatformUserId user_id) const {

    if (user_id < 0) {
        return std::nullopt;
    }

    HostOnlineUserState state;

    state.account_linked = false;
    state.auth_state =
        OnlineAuthState::SignedOut;

    return state;
}

} // namespace ps5native

#endif
