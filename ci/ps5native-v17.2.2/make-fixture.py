from pathlib import Path
import argparse,struct
ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);a=ap.parse_args();r=Path(a.out);ship=r/'Dakar2Game'/'Binaries'/'Win64'/'Dakar2Game-Win64-Shipping.exe';ship.parent.mkdir(parents=True,exist_ok=True)
b=bytearray(0x1000);b[:2]=b'MZ';struct.pack_into('<I',b,0x3c,0x80);b[0x80:0x84]=b'PE\0\0';struct.pack_into('<HHIIIHH',b,0x84,0x8664,1,0x12345678,0,0,0xF0,0x22);struct.pack_into('<H',b,0x98,0x20B);b[0x240:0x240+len(b'++UE4+Release-4.27\0EpicOnlineServices\0D3D12\0')]=b'++UE4+Release-4.27\0EpicOnlineServices\0D3D12\0';ship.write_bytes(b)
pak=r/'Dakar2Game'/'Content'/'Paks';pak.mkdir(parents=True,exist_ok=True);(pak/'pakchunk0-WindowsNoEditor.pak').write_bytes(b'A'*1024);(pak/'pakchunk1-WindowsNoEditor.pak').write_bytes(b'B'*2048)
print('V1722_FIXTURE_READY')
