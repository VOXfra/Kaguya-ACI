#!/usr/bin/env python3
from __future__ import annotations
import argparse,hashlib,json,re,struct
from pathlib import Path
def sha256_file(p):
 h=hashlib.sha256();h.update(p.read_bytes());return h.hexdigest()
def parse_pe(p):
 data=p.read_bytes()
 if len(data)<0x100 or data[:2]!=b'MZ':raise ValueError('not MZ')
 peoff=struct.unpack_from('<I',data,0x3c)[0]
 if data[peoff:peoff+4]!=b'PE\0\0':raise ValueError('PE signature missing')
 machine,nsec,tstamp,_,_,optsz,chars=struct.unpack_from('<HHIIIHH',data,peoff+4);magic=struct.unpack_from('<H',data,peoff+24)[0]
 return {'x64':machine==0x8664,'pe32_plus':magic==0x20b,'sections':nsec}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--root',required=True);ap.add_argument('--out',required=True);a=ap.parse_args();root=Path(a.root);ship=root/'Dakar2Game'/'Binaries'/'Win64'/'Dakar2Game-Win64-Shipping.exe'
 pe=parse_pe(ship);data=ship.read_bytes();markers=[]
 for pat in [rb'\+\+UE4\+Release-[0-9]+\.[0-9]+',rb'EpicOnlineServices',rb'D3D12']:
  for m in re.finditer(pat,data,re.I):
   s=m.group(0).decode('ascii','replace')
   if s not in markers:markers.append(s)
 paks=sorted((root/'Dakar2Game'/'Content'/'Paks').glob('*.pak'))
 r={'status':'READY','launch_attempted':False,'process_started':False,'pc_payload_copied_into_project':False,'shipping_exe':{'pe':pe,'markers':markers,'sha256':sha256_file(ship)},'pak_count':len(paks),'pak_total_bytes':sum(x.stat().st_size for x in paks)}
 Path(a.out).write_text(json.dumps(r),encoding='utf-8');print('V1722_PC_STATIC_ORACLE_READY')
 return 0
if __name__=='__main__':raise SystemExit(main())
