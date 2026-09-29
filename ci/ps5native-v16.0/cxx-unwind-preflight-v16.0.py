#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,struct
from pathlib import Path
def cstr(data,off):
    if off<0 or off>=len(data):return ''
    e=data.find(b'\0',off)
    if e<0:e=len(data)
    return data[off:e].decode('utf-8','replace')
def analyze(path:Path):
    d=path.read_bytes();sections=[];imports=[]
    if len(d)<64 or d[:4]!=b'\x7fELF' or d[4]!=2 or d[5]!=1:raise ValueError(f'not ELF64 LE: {path}')
    shoff=struct.unpack_from('<Q',d,40)[0];shentsz=struct.unpack_from('<H',d,58)[0];shnum=struct.unpack_from('<H',d,60)[0];shstrndx=struct.unpack_from('<H',d,62)[0];sh=[]
    for i in range(shnum):
        o=shoff+i*shentsz
        if o+64>len(d):break
        sh.append(struct.unpack_from('<IIQQQQIIQQ',d,o))
    shstr=b''
    if shstrndx<len(sh):
        _,_,_,_,off,size,_,_,_,_=sh[shstrndx];shstr=d[off:off+size]
    for s in sh:
        name=cstr(shstr,s[0])
        if name in ('.eh_frame','.eh_frame_hdr','.gcc_except_table'):sections.append({'name':name,'size':s[5]})
        if s[1] in (2,11) and s[9] and s[6]<len(sh):
            stroff,strsz=sh[s[6]][4],sh[s[6]][5];st=d[stroff:stroff+strsz];off,size,entsz=s[4],s[5],s[9]
            for j in range(0,size,entsz):
                if off+j+24>len(d):break
                nm,info,other,shndx,val,sz=struct.unpack_from('<IBBHQQ',d,off+j)
                if shndx==0:
                    n=cstr(st,nm)
                    if n.startswith('_Unwind_') or n.startswith('__cxa_') or 'personality' in n:imports.append(n)
    return {'path':str(path),'unwind_sections':sections,'cxx_unwind_imports':sorted(set(imports)),'risk':bool(sections or imports)}
def main():
    ap=argparse.ArgumentParser();ap.add_argument('paths',nargs='+');ap.add_argument('--out');a=ap.parse_args();mods=[analyze(Path(p)) for p in a.paths]
    report={'schema':'ps5native.cxx-unwind-preflight.v16.0','modules':mods,'modules_with_unwind_surface':sum(m['risk'] for m in mods),'policy':'Presence is informational. v16 does not fake success: unresolved C++ runtime imports remain diagnostic traps or relocation blockers; guest execution proceeds when no exception path requires them.'}
    if a.out:Path(a.out).write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(f'C++ unwind preflight modules: {len(mods)}');print(f'Modules with unwind surface: {report["modules_with_unwind_surface"]}');print('V160_CXX_UNWIND_PREFLIGHT_OK')
if __name__=='__main__':main()
