
#include <Windows.h>
#include <algorithm>
#include <array>
#include <cstdint>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

#pragma pack(push,1)
struct Ehdr{unsigned char i[16];uint16_t type,machine;uint32_t ver;uint64_t entry,phoff,shoff;uint32_t flags;uint16_t eh,phes,phn,shes,shn,shstr;};
struct Phdr{uint32_t type,flags;uint64_t off,va,pa,fs,ms,align;};
#pragma pack(pop)
struct Seg{uint64_t va,off,fs,ms,align;uint32_t flags;};
struct Assess{bool ready{},entry_exec{},nonoverlap{true},alignment{true};std::vector<std::string> issues;};
static bool pow2(uint64_t v){return v && !(v&(v-1));}
static Assess assess(const std::vector<Seg>& s,uint64_t entry,bool requireEntry){
    Assess a; std::vector<Seg> o=s; std::sort(o.begin(),o.end(),[](auto&x,auto&y){return x.va<y.va;});
    uint64_t prev=0; bool have=false;
    for(auto&x:o){
        auto al=x.align?x.align:1;
        if(!pow2(al)||(x.va%al)!=(x.off%al))a.alignment=false;
        if(have&&x.ms&&x.va<prev)a.nonoverlap=false;
        if(x.ms){prev=x.va+x.ms;have=true;}
        if(entry>=x.va&&entry-x.va<x.ms&&(x.flags&1))a.entry_exec=true;
    }
    if(!a.alignment)a.issues.push_back("invalid_load_alignment_or_congruence");
    if(!a.nonoverlap)a.issues.push_back("overlapping_load_memory_ranges");
    if(requireEntry&&!a.entry_exec)a.issues.push_back("entrypoint_not_executable");
    a.ready=a.issues.empty(); return a;
}
static bool writeFixture(const std::filesystem::path&p,int kind){
    std::vector<unsigned char>b(0x3000);
    Ehdr e{};e.i[0]=0x7f;e.i[1]='E';e.i[2]='L';e.i[3]='F';e.i[4]=2;e.i[5]=1;e.i[6]=1;e.type=3;e.machine=62;e.ver=1;e.entry=kind==1?0x402010:0x400020;e.phoff=sizeof(Ehdr);e.eh=sizeof(Ehdr);e.phes=sizeof(Phdr);e.phn=4;
    std::array<Phdr,4>ph{{{1,5,0x1000,0x400000,0,0x100,0x1000,0x1000},{1,6,0x2000,0x402000,0,0x200,0x1000,0x1000},{7,4,0x2080,0x402080,0,0x20,0x40,0x10},{0x6474e552u,4,0,0x402000,0,0,0x1000,1}}};
    if(kind==2){ph[1].va=0x400800;ph[2].va=0x400880;ph[3].va=0x400800;}
    if(kind==3){ph[1].off=0x2100;ph[2].off=0x2180;}
    std::memcpy(b.data(),&e,sizeof(e));std::memcpy(b.data()+e.phoff,ph.data(),sizeof(ph));
    std::ofstream o(p,std::ios::binary);o.write((char*)b.data(),(std::streamsize)b.size());return(bool)o;
}
static bool has(const Assess&a,const char*s){return std::find(a.issues.begin(),a.issues.end(),s)!=a.issues.end();}
int main(){
    std::vector<Seg> valid{{0x400000,0x1000,0x100,0x1000,0x1000,5},{0x402000,0x2000,0x200,0x1000,0x1000,6}};
    auto ok=assess(valid,0x400020,true); if(!ok.ready||!ok.entry_exec)return 10;
    auto badEntry=assess(valid,0x402010,true); if(badEntry.ready||!has(badEntry,"entrypoint_not_executable"))return 11;
    auto overlap=valid;overlap[1].va=0x400800;auto badOverlap=assess(overlap,0x400020,false);if(badOverlap.ready||!has(badOverlap,"overlapping_load_memory_ranges"))return 12;
    auto incongruent=valid;incongruent[1].off=0x2100;auto badAlign=assess(incongruent,0x400020,false);if(badAlign.ready||!has(badAlign,"invalid_load_alignment_or_congruence"))return 13;

    SYSTEM_INFO si{};GetSystemInfo(&si);const SIZE_T page=si.dwPageSize?si.dwPageSize:4096;
    auto* mem=(unsigned char*)VirtualAlloc(nullptr,page*3,MEM_RESERVE|MEM_COMMIT,PAGE_READWRITE);if(!mem)return 14;
    DWORD old{};
    if(!VirtualProtect(mem,page,PAGE_EXECUTE_READ,&old))return 15;
    if(!VirtualProtect(mem+page,page,PAGE_NOACCESS,&old))return 16;
    if(!VirtualProtect(mem+page*2,page,PAGE_READONLY,&old))return 17;
    if(!FlushInstructionCache(GetCurrentProcess(),mem,page*3))return 18;
    MEMORY_BASIC_INFORMATION mbi{};
    if(!VirtualQuery(mem,&mbi,sizeof(mbi))||mbi.Protect!=PAGE_EXECUTE_READ)return 19;
    if(!VirtualQuery(mem+page,&mbi,sizeof(mbi))||mbi.Protect!=PAGE_NOACCESS)return 20;
    if(!VirtualQuery(mem+page*2,&mbi,sizeof(mbi))||mbi.Protect!=PAGE_READONLY)return 21;
    VirtualFree(mem,0,MEM_RELEASE);
    std::cout<<"V204_WINDOWS_MAPPING_SEMANTICS_OK\n";
    std::cout<<"V204_NEGATIVE_ENTRYPOINT_REJECTED=1\n";
    std::cout<<"V204_NEGATIVE_OVERLAP_REJECTED=1\n";
    std::cout<<"V204_NEGATIVE_ALIGNMENT_REJECTED=1\n";
    std::cout<<"V204_WIN32_PROTECTIONS_RX_NOACCESS_RO=1\n";
    return 0;
}