#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, re, struct
from pathlib import Path
def sha256_file(p:Path, chunk=4*1024*1024):
    h=hashlib.sha256()
    with p.open('rb') as f:
        while True:
            b=f.read(chunk)
            if not b: break
            h.update(b)
    return h.hexdigest()
def pe_info(p:Path):
    data=p.read_bytes()[:4*1024*1024]
    if len(data)<0x100 or data[:2]!=b'MZ': raise ValueError('not an MZ executable')
    peoff=struct.unpack_from('<I',data,0x3c)[0]
    if peoff+0x18>len(data) or data[peoff:peoff+4]!=b'PE\0\0': raise ValueError('PE signature missing')
    machine,nsec,tstamp,_,_,optsz,chars=struct.unpack_from('<HHIIIHH',data,peoff+4)
    magic=struct.unpack_from('<H',data,peoff+24)[0]
    return {'machine_hex':f'0x{machine:04X}','x64':machine==0x8664,'sections':nsec,'timestamp':tstamp,'optional_magic_hex':f'0x{magic:04X}','pe32_plus':magic==0x20B,'characteristics_hex':f'0x{chars:04X}'}
def sample_hash(p:Path, span=1024*1024):
    size=p.stat().st_size
    with p.open('rb') as f:
        a=f.read(min(span,size))
        if size>span:f.seek(max(0,size-span)); b=f.read(span)
        else:b=b''
    return {'first_1m_sha256':hashlib.sha256(a).hexdigest(),'last_1m_sha256':hashlib.sha256(b).hexdigest() if b else None}
def scan_markers(p:Path):
    size=p.stat().st_size;cap=min(size,128*1024*1024)
    with p.open('rb') as f:data=f.read(cap)
    pats=[rb'\+\+UE4\+Release-[0-9]+\.[0-9]+',rb'Unreal Engine',rb'EpicOnlineServices',rb'Dakar2Game'];out=[]
    for pat in pats:
        for m in re.finditer(pat,data,re.I):
            s=m.group(0).decode('ascii','replace')
            if s not in out: out.append(s)
            if len(out)>=32:return out
    return out
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--root',required=True);ap.add_argument('--provider',default='unknown');ap.add_argument('--out',required=True);a=ap.parse_args()
    root=Path(a.root).resolve();ship=root/'Dakar2Game'/'Binaries'/'Win64'/'Dakar2Game-Win64-Shipping.exe';launch=root/'Dakar2Game.exe'
    if not ship.is_file(): raise SystemExit('shipping executable missing: '+str(ship))
    pei=pe_info(ship)
    if not pei['x64'] or not pei['pe32_plus']: raise SystemExit('shipping executable is not Win64 PE32+')
    paks=sorted((root/'Dakar2Game'/'Content'/'Paks').glob('*.pak')) if (root/'Dakar2Game'/'Content'/'Paks').is_dir() else []
    dllnames=['EOSSDK-Win64-Shipping.dll','HFFBSDK.dll','OpenImageDenoise.dll','hydra5-x64.dll','tbb12.dll'];windir=ship.parent;dlls=[]
    for n in dllnames:
        p=windir/n
        if p.is_file(): dlls.append({'name':n,'size':p.stat().st_size,'sha256':sha256_file(p)})
    pakrec=[]
    for p in paks:
        r={'name':p.name,'size':p.stat().st_size};r.update(sample_hash(p));pakrec.append(r)
    rep={'schema':'ps5native.dakar-pc-oracle-intake.v17.1','status':'READY','provider':a.provider,'install_root':str(root),'launcher':{'present':launch.is_file()},'shipping_exe':{'path':str(ship),'size':ship.stat().st_size,'sha256':sha256_file(ship),'pe':pei,'markers':scan_markers(ship)},'runtime_dlls':dlls,'pak_count':len(pakrec),'pak_total_bytes':sum(x['size'] for x in pakrec),'paks':pakrec,'ownership_bypass_attempted':False,'download_attempted':False,'files_modified':False}
    Path(a.out).write_text(json.dumps(rep,indent=2)+'\n',encoding='utf-8')
    print('V171_PC_ORACLE_INTAKE_READY')
if __name__=='__main__':raise SystemExit(main())
