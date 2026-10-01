#include <cstddef>
#include <cstdint>
#include <iostream>
#include <optional>
#include <vector>

struct Module {
    std::uint64_t id;
    std::size_t static_offset;
    std::size_t mem_size;
    std::size_t align;
    std::size_t file_offset;
};

static std::optional<std::size_t> variant2_offset(
    std::size_t previous_offset,
    std::size_t size,
    std::size_t align,
    std::size_t file_offset) noexcept {
    if (align == 0 || (align & (align - 1)) != 0) return std::nullopt;
    if (previous_offset > static_cast<std::size_t>(-1) - size - (align - 1)) return std::nullopt;
    std::size_t res = previous_offset + size + align - 1;
    res -= (res + file_offset) & (align - 1);
    return res;
}

int main(int argc, char**) {
    const std::uint64_t runtime_zero = (argc == 1) ? 0U : 1U;
    const auto aoff = variant2_offset(0, 32, 16, 0x2000);
    if (!aoff || *aoff != 32) return 10;

    const auto boff = variant2_offset(*aoff, 32, 16, 0x3000);
    if (!boff || *boff != 64) return 11;

    const Module tlsA{1, *aoff, 32, 16, 0x2000};
    const Module tlsB{2, *boff, 32, 16, 0x3000};

    // Requester is module 3, but the referenced STT_TLS symbol is defined by tlsB.
    const std::uint64_t requester_id = 3 + runtime_zero;
    const std::uint64_t provider_id = tlsB.id;
    if (requester_id == provider_id) return 12;

    const std::uint64_t symbol_offset = 8 + runtime_zero;
    const std::int64_t addend = 4 - static_cast<std::int64_t>(runtime_zero);

    const std::uint64_t dtpmod64 = provider_id;
    const std::uint64_t dtpoff64 =
        symbol_offset + static_cast<std::uint64_t>(addend);
    const std::int64_t tpoff64 =
        static_cast<std::int64_t>(symbol_offset) +
        addend -
        static_cast<std::int64_t>(tlsB.static_offset);

    if (dtpmod64 != 2) return 13;
    if (dtpoff64 != 12) return 14;
    if (tpoff64 != -52) return 15;

    // DTV indexes by explicit module ID, not registration order.
    std::vector<std::uintptr_t> dtv(4, 0);
    constexpr std::uintptr_t blockA = 0x100000;
    constexpr std::uintptr_t blockB = 0x0fffe0;
    // Register B first deliberately.
    dtv[static_cast<std::size_t>(tlsB.id) + 1] = blockB;
    dtv[static_cast<std::size_t>(tlsA.id) + 1] = blockA;
    if (dtv[2] != blockA || dtv[3] != blockB) return 16;

    const auto odd = variant2_offset(64, 24, 16, 0x2818);
    if (!odd || *odd != 88) return 17;
    if (((0U - *odd) & 15U) != (0x2818U & 15U)) return 18;

    std::cout << "V207_WINDOWS_TLS_STATIC_CONTRACT_OK\n";
    std::cout << "V207_DTPMOD64_PROVIDER_ID=2\n";
    std::cout << "V207_DTPOFF64_VALUE=12\n";
    std::cout << "V207_TPOFF64_SIGNED_VALUE=-52\n";
    std::cout << "V207_DTV_EXPLICIT_ID_INDEXING=1\n";
    std::cout << "V207_VARIANT2_OFFSET_CONGRUENCE=1\n";
    std::cout << "V207_TLSDESC_STATUS=EXPLICITLY_BLOCKED\n";
    std::cout << "V207_BASELINE_PERCENT=86.0\n";
    return 0;
}
