#!/usr/bin/env python3
from __future__ import annotations
import argparse,json
from pathlib import Path
SEED0=0x92ca8aab26a24f51;SEED1=0x09bbb761a41bc44d;ROUND=0x8000000080008081
def rol64(x,n): return ((x<<n)|(x>>(64-n))) & 0xffffffffffffffff
def ror64(x,n): return ((x>>n)|(x<<(64-n))) & 0xffffffffffffffff
def ps5_hash(path:str)->int:
 p=path.replace('\\','/').lstrip('/');d=p.upper().encode('ascii','strict');ln=len(d);s0=SEED0;s1=rol64(SEED0,11);s2=rol64(SEED0,23);tail=0
 if ln:
  nw=(ln-1)>>3;a0,a1,a2=s0,s1,s2;off=0
  for _ in range(nw):
   w=int.from_bytes(d[off:off+8],'little');off+=8;a0^=w;t18=ror64(rol64(a2^a1,5)^a0,11);t12=rol64(rol64(a2^a0,17)^a1,11);a2=ror64(rol64(a1^a0,1)^a2,5)
   a0=((((~t12)&0xffffffffffffffff)&a2)^t18^ROUND)&0xffffffffffffffff;a1=((((~a2)&0xffffffffffffffff)&t18)^t12)&0xffffffffffffffff;a2=((((~t18)&0xffffffffffffffff)&t12)^a2)&0xffffffffffffffff
  s0,s1,s2=a0,a1,a2
  for j in range(((ln-1)&7)+1):tail|=d[off+j]<<(8*j)
 u16=s1;u11=s2;u6=(tail^s0^SEED1)&0xffffffffffffffff;u17=(rol64(u11^u16,5)^u6)&0xffffffffffffffff;u18=(rol64(u11^u6,17)^u16)&0xffffffffffffffff;u11=(rol64(u16^u6,1)^u11)&0xffffffffffffffff
 return ((((~rol64(u18,11))&0xffffffffffffffff)&ror64(u11,5))^ror64(u17,11)^ROUND)&0xffffffffffffffff
def transforms(rel):
 rel=rel.replace('\\','/').lstrip('/');out={rel}
 for x in list(out):
  out.add(x.replace('/FMOD/Desktop/','/FMOD/PS5/').replace('/fmod/desktop/','/FMOD/PS5/'))
  out.add(x.replace('/Win64/','/PS5/').replace('/win64/','/PS5/'))
  out.add(x.replace('-WindowsNoEditor.pak','-PS5.pak').replace('-windowsnoeditor.pak','-PS5.pak'))
 return sorted(out)
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--pc-root',required=True);ap.add_argument('--targets',required=True);ap.add_argument('--out',required=True);ap.add_argument('--text-out');a=ap.parse_args()
 root=Path(a.pc_root);src=json.loads(Path(a.targets).read_text());rows=src['remaining_unresolved_retail_hashes'];unresolved={int(x['hash_hex'],16):x for x in rows}
 if len(unresolved)!=3: raise SystemExit(2)
 files=[];matches=[]
 for p in sorted(root.rglob('*')):
  if not p.is_file(): continue
  rel=p.relative_to(root).as_posix();files.append(rel)
  for cand in transforms(rel):
   try:h=ps5_hash(cand)
   except UnicodeEncodeError:continue
   if h in unresolved:matches.append((h,cand,rel))
 uniq={(h,c):r for h,c,r in matches};hits=set(h for h,c in uniq);remaining=[x for h,x in unresolved.items() if h not in hits]
 rep={'status':'READY','loose_file_count':len(files),'exact_new_match_count':len(uniq),'unresolved_after':len(remaining),'launch_attempted':False,'decryption_attempted':False,'key_material_used':False,'fuzzy_matching_used':False}
 Path(a.out).write_text(json.dumps(rep))
 if a.text_out: Path(a.text_out).write_text('ok')
 print('V174_PC_LOOSE_PLAYGO_CORRELATION_READY');return 0
if __name__=='__main__': raise SystemExit(main())
