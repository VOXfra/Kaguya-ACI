#!/usr/bin/env python3
from pathlib import Path
import argparse,hashlib,json,re,struct

MAGIC=b'\xE1\x12\x6F\x5A'
SEED0=0x92ca8aab26a24f51;SEED1=0x09bbb761a41bc44d;ROUND=0x8000000080008081
def rol64(x,n):return ((x<<n)|(x>>(64-n)))&0xffffffffffffffff
def ror64(x,n):return ((x>>n)|(x<<(64-n)))&0xffffffffffffffff
def ps5_hash(path):
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
def footer(p):
 b=p.read_bytes();tail=b[-65536:];base=len(b)-len(tail);hits=[];start=0
 while True:
  i=tail.find(MAGIC,start)
  if i<0:break
  if i+44<=len(tail):
   v=struct.unpack_from('<i',tail,i+4)[0];off=struct.unpack_from('<q',tail,i+8)[0];sz=struct.unpack_from('<q',tail,i+16)[0];sha=tail[i+24:i+44].hex();enc=bool(tail[i-1]) if i>=1 and tail[i-1] in (0,1) and v>=4 else False
   if 1<=v<=64 and 0<=off<len(b) and 0<sz<=len(b) and off+sz<=len(b):hits.append((base+i,v,off,sz,sha,enc))
  start=i+1
 return hits[-1] if hits else None
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--pak',required=True);ap.add_argument('--target',required=True);a=ap.parse_args();p=Path(a.pak);f=footer(p)
 if not f:raise SystemExit(2)
 _,v,off,sz,sha,enc=f
 if enc:raise SystemExit(3)
 data=p.read_bytes()[off:off+sz]
 if hashlib.sha1(data).hexdigest()!=sha:raise SystemExit(4)
 strings=[m.group(0).decode() for m in re.finditer(rb'[\x20-\x7e]{4,1024}',data)]
 target=int(a.target,16);matches=[]
 for s in strings:
  s=s.replace('\\','/')
  if 'Dakar2Game/' in s:s=s[s.index('Dakar2Game/'):]
  if '/' not in s:continue
  for c in {s,s.replace('WindowsNoEditor','PS5').replace('/FMOD/Desktop/','/FMOD/PS5/')}:
   try:h=ps5_hash(c)
   except UnicodeEncodeError:continue
   if h==target:matches.append(c)
 if len(set(matches))!=1:raise SystemExit(5)
 print('V173_WINDOWS_PAK_FOOTER_OK');print('V173_WINDOWS_INDEX_SHA1_OK');print('V173_WINDOWS_PLAYGO_EXACT_HASH_OK');print(sorted(set(matches))[0]);return 0
if __name__=='__main__':raise SystemExit(main())
