#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, struct
from pathlib import Path
PT_LOAD=1; PF_X=1
def exec_segments(path:Path):
    data=path.read_bytes()
    if len(data)<64 or data[:4]!=b'\x7fELF' or data[4]!=2 or data[5]!=1: raise ValueError(f'not ELF64 little-endian: {path}')
    phoff=struct.unpack_from('<Q',data,32)[0]; phentsize=struct.unpack_from('<H',data,54)[0]; phnum=struct.unpack_from('<H',data,56)[0]
    for i in range(phnum):
        o=phoff+i*phentsize
        if o+56>len(data): break
        p_type,p_flags=struct.unpack_from('<II',data,o); p_offset,p_vaddr=struct.unpack_from('<QQ',data,o+8); p_filesz=struct.unpack_from('<Q',data,o+32)[0]
        if p_type==PT_LOAD and (p_flags&PF_X) and p_offset+p_filesz<=len(data): yield p_vaddr,data[p_offset:p_offset+p_filesz]
def scan_blob(base:int,b:bytes):
    out=[]; i=0
    while i+5<=len(b):
        pref=b[i]
        if pref not in (0x66,0xF2): i+=1; continue
        j=i+1
        if j<len(b) and (b[j]&0xF0)==0x40: j+=1
        if j+2>=len(b) or b[j]!=0x0F or b[j+1] not in (0x78,0x79): i+=1; continue
        op=b[j+1]; modrm=b[j+2]
        if (modrm&0xC0)!=0xC0: i+=1; continue
        length=j+3-i; name=None
        if op==0x78 and pref==0x66 and ((modrm>>3)&7)==0:
            if i+length+2<=len(b): name='EXTRQ-imm'; length+=2
        elif op==0x78 and pref==0xF2:
            if i+length+2<=len(b): name='INSERTQ-imm'; length+=2
        elif op==0x79 and pref==0x66:name='EXTRQ-reg'
        elif op==0x79 and pref==0xF2:name='INSERTQ-reg'
        if name: out.append({'name':name,'guest_address':hex(base+i),'file_relative_offset':i,'bytes':b[i:i+length].hex()}); i+=length; continue
        i+=1
    return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument('paths',nargs='+');ap.add_argument('--out');a=ap.parse_args();mods=[];total=0
    for raw in a.paths:
        p=Path(raw);hits=[]
        for base,blob in exec_segments(p):hits.extend(scan_blob(base,blob))
        mods.append({'path':str(p),'hits':hits,'hit_count':len(hits)});total+=len(hits)
    report={'schema':'ps5native.cpu-compat-scan.v16.0','modules':mods,'known_sse4a_bitfield_hits':total,'runtime_policy':'EXTRQ/INSERTQ register/immediate forms are semantically emulated only on guarded guest #UD; other illegal instructions remain fail-closed and are reported by the guest fault gate.'}
    if a.out:Path(a.out).write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(f'CPU compatibility scan modules: {len(mods)}');print(f'Known SSE4a EXTRQ/INSERTQ sites: {total}');print('V160_CPU_STATIC_SCAN_OK')
if __name__=='__main__':main()
