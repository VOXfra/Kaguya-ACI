#pragma once

#ifdef _WIN32

#include <optional>

#include <ps5native/online_state_service.hpp>

namespace ps5native {

class Win32OnlineStateBackend final
    : public OnlineStateBackend {
public:
    bool available()
        const noexcept override;

    std::optional<HostNetworkState>
    network_state()
        const override;

    std::optional<HostOnlineUserState>
    user_state(
        PlatformUserId user_id)
        const override;
};

} // namespace ps5native

#endif
