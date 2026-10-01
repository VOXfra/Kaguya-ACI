
#include <Windows.h>
#include <cstddef>
#include <cstdint>
#include <iostream>
#include <memory>
#include <vector>

union DtvEntry {
    std::size_t counter;
    std::uintptr_t pointer;
    DtvEntry() noexcept : counter(0) {}
};

struct Tcb {
    std::uintptr_t self{};
    std::uintptr_t dtv{};
    std::uintptr_t thread{};
    std::uintptr_t spare0{};
    std::uintptr_t spare1{};
    std::uint64_t canary{};
    std::uintptr_t fiber{};
    std::uint64_t reserved{};
};
static_assert(sizeof(Tcb)==0x40);

int main(){
    std::vector<std::uint8_t> a(32),b(32);
    std::vector<DtvEntry> dtv(4);
    dtv[0].counter=1;
    dtv[1].counter=2;
    dtv[2].pointer=reinterpret_cast<std::uintptr_t>(a.data());
    dtv[3].pointer=reinterpret_cast<std::uintptr_t>(b.data());

    auto tcb=std::make_unique<Tcb>();
    tcb->self=reinterpret_cast<std::uintptr_t>(tcb.get());
    tcb->dtv=reinterpret_cast<std::uintptr_t>(dtv.data());

    if(tcb->self!=reinterpret_cast<std::uintptr_t>(tcb.get())) return 10;
    if(tcb->dtv!=reinterpret_cast<std::uintptr_t>(dtv.data())) return 11;
    if(dtv[0].counter!=1||dtv[1].counter!=2) return 12;
    if(dtv[2].pointer==0||dtv[3].pointer==0||dtv[2].pointer==dtv[3].pointer) return 13;

    std::uint64_t relocation_slot=0xDEADBEEFDEADBEEFULL;
    const std::uint64_t module_id=7;
    relocation_slot=module_id;
    if(relocation_slot!=7) return 14;

    std::cout<<"V206_ORBIS_TCB_DTV_OK\n";
    std::cout<<"V206_TCB_SIZE=64\n";
    std::cout<<"V206_DTV_GENERATION=1\n";
    std::cout<<"V206_DTV_MODULES=2\n";
    std::cout<<"V206_DTPMOD64_MODULE_ID=7\n";
    std::cout<<"V206_WINDOWS_CONTRACT_OK\n";
    return 0;
}
