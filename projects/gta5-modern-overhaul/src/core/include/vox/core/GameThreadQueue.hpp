#pragma once

#include <cstddef>
#include <deque>
#include <functional>
#include <mutex>
#include <utility>
#include <vector>

namespace vox::core {

struct GameThreadDrainResult final {
    std::size_t executed{0};
    std::size_t failed{0};
};

class GameThreadQueue final {
public:
    using Task = std::function<void()>;

    GameThreadQueue() = default;
    GameThreadQueue(const GameThreadQueue&) = delete;
    GameThreadQueue& operator=(const GameThreadQueue&) = delete;

    [[nodiscard]] bool Enqueue(Task task) {
        if (!task) {
            return false;
        }
        std::scoped_lock lock{mutex_};
        queue_.push_back(std::move(task));
        return true;
    }

    [[nodiscard]] GameThreadDrainResult Drain(std::size_t maxTasks) noexcept {
        GameThreadDrainResult result{};
        if (maxTasks == 0) {
            return result;
        }

        std::vector<Task> batch;
        {
            std::scoped_lock lock{mutex_};
            const std::size_t count = queue_.size() < maxTasks ? queue_.size() : maxTasks;
            batch.reserve(count);
            for (std::size_t i = 0; i < count; ++i) {
                batch.push_back(std::move(queue_.front()));
                queue_.pop_front();
            }
        }

        for (auto& task : batch) {
            try {
                task();
                ++result.executed;
            } catch (...) {
                ++result.failed;
            }
        }
        return result;
    }

    [[nodiscard]] std::size_t pending() const noexcept {
        std::scoped_lock lock{mutex_};
        return queue_.size();
    }

private:
    mutable std::mutex mutex_;
    std::deque<Task> queue_;
};

} // namespace vox::core
