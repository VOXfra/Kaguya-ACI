#pragma once

#ifdef _WIN32

#include <ps5native/account_user_service.hpp>

#include <Windows.h>

namespace ps5native {

class Win32LocalUserBackend final
    : public HostUserBackend {
public:
    bool available() const noexcept override {
        return true;
    }

    std::optional<HostUserIdentity>
    local_identity() const override;
};

} // namespace ps5native

#endif
