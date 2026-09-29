from pathlib import Path
import argparse,hashlib,struct
SEED0=0x92ca8aab26a24f51;SEED1=0x09bbb761a41bc44d;ROUND=0x8000000080008081
def rol64(x,n):return ((x<<n)|(x>>(64-n)))&0xffffffffffffffff
def ror64(x,n):return ((x>>n)|(x<<(64-n)))&0xffffffffffffffff
def h(path):
 p=path.replace('\\','/').lstrip('/');d=p.upper().encode('ascii');ln=len(d);s0=SEED0;s1=rol64(SEED0,11);s2=rol64(SEED0,23);tail=0
 if ln:
  nw=(ln-1)>>3;a0,a1,a2=s0,s1,s2;off=0
  for _ in range(nw):
   w=int.from_bytes(d[off:off+8],'little');off+=8;a0^=w;t18=ror64(rol64(a2^a1,5)^a0,11);t12=rol64(rol64(a2^a0,17)^a1,11);a2=ror64(rol64(a1^a0,1)^a2,5)
   a0=((((~t12)&0xffffffffffffffff)&a2)^t18^ROUND)&0xffffffffffffffff;a1=((((~a2)&0xffffffffffffffff)&t18)^t12)&0xffffffffffffffff;a2=((((~t18)&0xffffffffffffffff)&t12)^a2)&0xffffffffffffffff
  s0,s1,s2=a0,a1,a2
  for j in range(((ln-1)&7)+1):tail|=d[off+j]<<(8*j)
 u16=s1;u11=s2;u6=(tail^s0^SEED1)&0xffffffffffffffff;u17=(rol64(u11^u16,5)^u6)&0xffffffffffffffff;u18=(rol64(u11^u6,17)^u16)&0xffffffffffffffff;u11=(rol64(u16^u6,1)^u11)&0xffffffffffffffff
 return ((((~rol64(u18,11))&0xffffffffffffffff)&ror64(u11,5))^ror64(u17,11)^ROUND)&0xffffffffffffffff
ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);a=ap.parse_args();out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True)
path='Dakar2Game/Content/Maps/V173Exact.uasset';idx=path.encode()+b'\0';payload=b'P'*4096;off=len(payload);footer=b'\0'*16+b'\0'+b'\xE1\x12\x6F\x5A'+struct.pack('<iqq',8,off,len(idx))+hashlib.sha1(idx).digest()+b'Zlib\0'+b'\0'*155
out.write_bytes(payload+idx+footer);print(f'{h(path):016X}');print('V173_FIXTURE_READY')
