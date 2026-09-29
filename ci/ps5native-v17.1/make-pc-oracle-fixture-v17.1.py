#!/usr/bin/env python3
from pathlib import Path
import argparse,struct
ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);a=ap.parse_args();r=Path(a.out);ship=r/'Dakar2Game'/'Binaries'/'Win64'/'Dakar2Game-Win64-Shipping.exe';ship.parent.mkdir(parents=True,exist_ok=True)
b=bytearray(0x800);b[:2]=b'MZ';struct.pack_into('<I',b,0x3c,0x80);b[0x80:0x84]=b'PE\0\0';struct.pack_into('<HHIIIHH',b,0x84,0x8664,1,0x12345678,0,0,0xF0,0x22);struct.pack_into('<H',b,0x98,0x20B);b[0x200:0x200+len(b'++UE4+Release-4.27\0EpicOnlineServices\0Dakar2Game\0')]=b'++UE4+Release-4.27\0EpicOnlineServices\0Dakar2Game\0';ship.write_bytes(b)
(r/'Dakar2Game.exe').write_bytes(b)
for n in ['EOSSDK-Win64-Shipping.dll','tbb12.dll']:(ship.parent/n).write_bytes(b'MZ'+bytes(510))
pakdir=r/'Dakar2Game'/'Content'/'Paks';pakdir.mkdir(parents=True,exist_ok=True)
for i in range(2):(pakdir/f'pakchunk{i}-WindowsNoEditor.pak').write_bytes((bytes([65+i])*1024*1024)+(bytes([66+i])*1024*1024))
print('V171_PC_ORACLE_FIXTURE_READY')
