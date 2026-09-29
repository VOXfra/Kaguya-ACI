#include <Windows.h>
#include <intrin.h>
#include <cstdint>
#include <cstring>
#include <iostream>
#include <vector>

struct State { bool armed=false; std::uint64_t emulated=0; };
thread_local State* active=nullptr;

static M128A* xmm(CONTEXT* c,unsigned i){
 switch(i){case 0:return &c->Xmm0;case 1:return &c->Xmm1;case 2:return &c->Xmm2;case 3:return &c->Xmm3;
 case 4:return &c->Xmm4;case 5:return &c->Xmm5;case 6:return &c->Xmm6;case 7:return &c->Xmm7;
 case 8:return &c->Xmm8;case 9:return &c->Xmm9;case 10:return &c->Xmm10;case 11:return &c->Xmm11;
 case 12:return &c->Xmm12;case 13:return &c->Xmm13;case 14:return &c->Xmm14;case 15:return &c->Xmm15;default:return nullptr;}
}
static std::uint64_t mask64(unsigned n){return n>=64?~std::uint64_t{0}:((std::uint64_t{1}<<n)-1);}
static bool emulate(EXCEPTION_POINTERS* info){
 if(!info||!info->ExceptionRecord||!info->ContextRecord||info->ExceptionRecord->ExceptionCode!=EXCEPTION_ILLEGAL_INSTRUCTION||!active||!active->armed)return false;
 std::uint8_t code[16]{}; SIZE_T got=0; auto rip=(std::uintptr_t)info->ContextRecord->Rip;
 if(!ReadProcessMemory(GetCurrentProcess(),(void*)rip,code,sizeof code,&got)||got!=sizeof code)return false;
 std::size_t i=0;auto mandatory=code[i++];if(mandatory!=0x66&&mandatory!=0xF2)return false;
 std::uint8_t rex=0;if((code[i]&0xF0)==0x40)rex=code[i++];if(code[i++]!=0x0F)return false;auto op=code[i++];if(op!=0x78&&op!=0x79)return false;
 auto modrm=code[i++];if((modrm&0xC0)!=0xC0)return false;unsigned reg=((modrm>>3)&7)+((rex&4)?8:0),rm=(modrm&7)+((rex&1)?8:0);
 auto* dst=xmm(info->ContextRecord,(mandatory==0x66&&op==0x78)?rm:reg);if(!dst)return false;
 unsigned length=0,index=0;std::uint64_t source=0;
 if(op==0x78){if(mandatory==0x66){if(((modrm>>3)&7)!=0)return false;length=code[i++]&0x3f;index=code[i++]&0x3f;source=dst->Low;}
 else{auto* s=xmm(info->ContextRecord,rm);if(!s)return false;length=code[i++]&0x3f;index=code[i++]&0x3f;source=s->Low;}}
 else{auto* s=xmm(info->ContextRecord,rm);if(!s)return false;if(mandatory==0x66){length=(unsigned)(s->Low&0x3f);index=(unsigned)((s->Low>>8)&0x3f);source=dst->Low;}
 else{auto ctl=(std::uint64_t)s->High;length=(unsigned)(ctl&0x3f);index=(unsigned)((ctl>>8)&0x3f);source=s->Low;}}
 if(length==0)length=64;if(index>=64||length>64||index+length>64)return false;auto mask=mask64(length);
 if(mandatory==0x66)dst->Low=(source>>index)&mask;else{auto sm=length==64?mask:(mask<<index);auto ins=length==64?(source&mask):((source&mask)<<index);dst->Low=(dst->Low&~sm)|ins;}
 info->ContextRecord->Rip+=i;++active->emulated;return true;
}
static LONG CALLBACK veh(EXCEPTION_POINTERS* p){return emulate(p)?EXCEPTION_CONTINUE_EXECUTION:EXCEPTION_CONTINUE_SEARCH;}
static bool sse4a(){int r[4]{};__cpuid(r,0x80000000);if((unsigned)r[0]<0x80000001u)return false;__cpuid(r,0x80000001);return (r[2]&(1<<6))!=0;}
int main(){
 void* h=AddVectoredExceptionHandler(1,veh);if(!h)return 2;
 std::vector<std::uint8_t> code={0x66,0x48,0x0F,0x6E,0xC1,0x66,0x0F,0x78,0xC0,0x08,0x08,0x66,0x48,0x0F,0x7E,0xC0,0xC3};
 void* p=VirtualAlloc(nullptr,4096,MEM_COMMIT|MEM_RESERVE,PAGE_READWRITE);std::memcpy(p,code.data(),code.size());DWORD old{};VirtualProtect(p,4096,PAGE_EXECUTE_READ,&old);FlushInstructionCache(GetCurrentProcess(),p,code.size());
 State st{};st.armed=true;active=&st;using F=std::uint64_t(*)(std::uint64_t);auto result=((F)p)(0x1122334455667788ull);active=nullptr;RemoveVectoredExceptionHandler(h);VirtualFree(p,0,MEM_RELEASE);
 if(result!=0x77ull){std::cerr<<"result mismatch "<<std::hex<<result<<"\n";return 3;}if(!sse4a()&&st.emulated!=1){std::cerr<<"expected VEH emulation on non-SSE4a host\n";return 4;}
 std::cout<<"Host SSE4a: "<<(sse4a()?"yes":"no")<<"\n";std::cout<<"Emulations: "<<st.emulated<<"\n";std::cout<<"V1601_RECOVERY_WIRING_CONTRACT_OK\n";return 0;
}