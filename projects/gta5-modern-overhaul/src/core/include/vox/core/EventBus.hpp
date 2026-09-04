#pragma once

#include <algorithm>
#include <atomic>
#include <cstdint>
#include <functional>
#include <mutex>
#include <typeindex>
#include <unordered_map>
#include <utility>
#include <vector>

namespace vox::core {

struct SubscriptionToken final {
    std::uint64_t id{0};
    std::type_index eventType{typeid(void)};

    [[nodiscard]] constexpr bool valid() const noexcept { return id != 0; }
    [[nodiscard]] constexpr explicit operator bool() const noexcept { return valid(); }
};

class EventBus final {
public:
    EventBus() = default;

    EventBus(const EventBus&) = delete;
    EventBus& operator=(const EventBus&) = delete;
    EventBus(EventBus&&) = delete;
    EventBus& operator=(EventBus&&) = delete;

    template <typename Event>
    [[nodiscard]] SubscriptionToken Subscribe(std::function<void(const Event&)> handler) {
        if (!handler) {
            return {};
        }

        const auto id = nextId_.fetch_add(1, std::memory_order_relaxed);
        const auto type = std::type_index{typeid(Event)};

        HandlerRecord record;
        record.id = id;
        record.callback = [handler = std::move(handler)](const void* event) {
            handler(*static_cast<const Event*>(event));
        };

        {
            std::scoped_lock lock{mutex_};
            handlers_[type].push_back(std::move(record));
        }

        return SubscriptionToken{id, type};
    }

    [[nodiscard]] bool Unsubscribe(const SubscriptionToken& token) {
        if (!token.valid()) {
            return false;
        }

        std::scoped_lock lock{mutex_};
        const auto found = handlers_.find(token.eventType);
        if (found == handlers_.end()) {
            return false;
        }

        auto& records = found->second;
        const auto oldSize = records.size();
        std::erase_if(records, [&token](const HandlerRecord& record) {
            return record.id == token.id;
        });

        if (records.empty()) {
            handlers_.erase(found);
        }

        return records.size() != oldSize;
    }

    template <typename Event>
    void Publish(const Event& event) const {
        std::vector<std::function<void(const void*)>> callbacks;

        {
            std::scoped_lock lock{mutex_};
            const auto found = handlers_.find(std::type_index{typeid(Event)});
            if (found == handlers_.end()) {
                return;
            }

            callbacks.reserve(found->second.size());
            for (const auto& record : found->second) {
                callbacks.push_back(record.callback);
            }
        }

        for (const auto& callback : callbacks) {
            callback(&event);
        }
    }

private:
    struct HandlerRecord final {
        std::uint64_t id{0};
        std::function<void(const void*)> callback;
    };

    mutable std::mutex mutex_;
    mutable std::unordered_map<std::type_index, std::vector<HandlerRecord>> handlers_;
    std::atomic<std::uint64_t> nextId_{1};
};

} // namespace vox::core
