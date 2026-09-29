#include <Windows.h>
#include <cstdint>
#include <iostream>

static M128A* xmm(CONTEXT* c, unsigned i) {
    switch(i){
    case 0:return &c->Xmm0; case 1:return &c->Xmm1; case 2:return &c->Xmm2; case 3:return &c->Xmm3;
    case 4:return &c->Xmm4; case 5:return &c->Xmm5; case 6:return &c->Xmm6; case 7:return &c->Xmm7;
    case 8:return &c->Xmm8; case 9:return &c->Xmm9; case 10:return &c->Xmm10; case 11:return &c->Xmm11;
    case 12:return &c->Xmm12; case 13:return &c->Xmm13; case 14:return &c->Xmm14; case 15:return &c->Xmm15;
    default:return nullptr;
    }
}
static std::uint64_t mask64(unsigned n){return n>=64?~std::uint64_t{0}:((std::uint64_t{1}<<n)-1);}
static bool emulate(CONTEXT& c,const std::uint8_t* code,std::size_t n){
    if(n<5)return false; std::size_t i=0; auto mandatory=code[i++];
    if(mandatory!=0x66&&mandatory!=0xF2)return false;
    std::uint8_t rex=0; if(i<n&&(code[i]&0xF0)==0x40)rex=code[i++];
    if(i+2>=n||code[i++]!=0x0F)return false; auto op=code[i++]; if(op!=0x78&&op!=0x79)return false;
    auto modrm=code[i++]; if((modrm&0xC0)!=0xC0)return false;
    unsigned reg=((modrm>>3)&7)+((rex&4)?8:0), rm=(modrm&7)+((rex&1)?8:0);
    auto* dst=xmm(&c,(mandatory==0x66&&op==0x78)?rm:reg); if(!dst)return false;
    unsigned length=0,index=0; std::uint64_t source=0;
    if(op==0x78){
      if(mandatory==0x66){if(((modrm>>3)&7)!=0||i+2>n)return false;length=code[i++]&0x3f;index=code[i++]&0x3f;source=dst->Low;}
      else {auto* src=xmm(&c,rm);if(!src||i+2>n)return false;length=code[i++]&0x3f;index=code[i++]&0x3f;source=src->Low;}
    } else {
      auto* src=xmm(&c,rm); if(!src)return false;
      if(mandatory==0x66){length=(unsigned)(src->Low&0x3f);index=(unsigned)((src->Low>>8)&0x3f);source=dst->Low;}
      else {auto ctl=(std::uint64_t)src->High;length=(unsigned)(ctl&0x3f);index=(unsigned)((ctl>>8)&0x3f);source=src->Low;}
    }
    if(length==0)length=64; if(index>=64||length>64||index+length>64)return false;
    auto mask=mask64(length);
    if(mandatory==0x66)dst->Low=(source>>index)&mask;
    else {auto sm=length==64?mask:(mask<<index);auto ins=length==64?(source&mask):((source&mask)<<index);dst->Low=(dst->Low&~sm)|ins;}
    return true;
}
int main(){
    CONTEXT c{}; c.Xmm0.Low=0x1122334455667788ull;
    const std::uint8_t ex[]={0x66,0x0F,0x78,0xC0,0x08,0x08};
    if(!emulate(c,ex,sizeof ex)||c.Xmm0.Low!=0x77ull)return 10;
    c={};c.Xmm0.Low=0x1122334455667788ull;c.Xmm1.Low=0xAAull;
    const std::uint8_t in[]={0xF2,0x0F,0x78,0xC1,0x08,0x08};
    if(!emulate(c,in,sizeof in)||c.Xmm0.Low!=0x112233445566AA88ull)return 11;
    c={};c.Xmm8.Low=0x123456789ABCDEF0ull;
    const std::uint8_t ex8[]={0x66,0x41,0x0F,0x78,0xC0,0x10,0x08};
    if(!emulate(c,ex8,sizeof ex8)||c.Xmm8.Low!=0xDEull)return 12;
    std::cout<<"V160_WINDOWS_CONTEXT_SSE4A_OK\n"; return 0;
}