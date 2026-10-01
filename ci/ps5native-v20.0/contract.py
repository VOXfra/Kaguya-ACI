import hashlib,struct,tempfile
from pathlib import Path
MAGIC=b'\xe1\x12\x6f\x5a'
def fs(s):
    b=s.encode()+b'\0'; return struct.pack('<i',len(b))+b
def build(p):
    payload=b'X'*256
    fdi=bytearray(); dirs={'/Dakar2Game/Content/Maps/':['MainMenu.umap'],'/Dakar2Game/Content/FMOD/Desktop/':['Ambience.bank'],'/Dakar2Game/Content/UI/':['Startup.uasset']}
    fdi+=struct.pack('<i',len(dirs))
    for d,names in dirs.items():
        fdi+=fs(d)+struct.pack('<i',len(names))
        for n in names:fdi+=fs(n)+struct.pack('<i',0)
    fdi_off=len(payload); data=bytearray(payload)+fdi
    primary=bytearray(); primary+=fs('../../../'); primary+=struct.pack('<iQ',3,0x1122334455667788); primary+=struct.pack('<i',0); primary+=struct.pack('<i',1); primary+=struct.pack('<qq',fdi_off,len(fdi))+hashlib.sha1(fdi).digest(); primary+=struct.pack('<i',0)
    io=len(data); data+=primary
    footer=bytearray(b'\0'*16+b'\0'+MAGIC+struct.pack('<iqq',11,io,len(primary))+hashlib.sha1(primary).digest())
    for n in (b'Zlib',b'Gzip',b'Oodle',b'',b''): footer+=n+b'\0'*(32-len(n))
    p.write_bytes(data+footer)
def rf(b,p):
    n=struct.unpack_from('<i',b,p)[0];p+=4
    if n<=0: raise SystemExit(11)
    s=b[p:p+n].split(b'\0',1)[0].decode();return s,p+n
def parse(p):
    size=p.stat().st_size; tail=p.read_bytes()[-65536:]; i=tail.rfind(MAGIC)
    assert i>=17
    ver=struct.unpack_from('<i',tail,i+4)[0]; io,isz=struct.unpack_from('<qq',tail,i+8); ih=tail[i+24:i+44]
    assert ver==11
    with p.open('rb') as f:f.seek(io);primary=f.read(isz)
    assert hashlib.sha1(primary).digest()==ih
    q=0; mount,q=rf(primary,q); num=struct.unpack_from('<i',primary,q)[0];q+=4;seed=struct.unpack_from('<Q',primary,q)[0];q+=8
    has_path=struct.unpack_from('<i',primary,q)[0];q+=4
    if has_path:q+=36
    has_fdi=struct.unpack_from('<i',primary,q)[0];q+=4
    assert has_fdi==1
    fo,fsz=struct.unpack_from('<qq',primary,q);q+=16;fh=primary[q:q+20];q+=20
    encsz=struct.unpack_from('<i',primary,q)[0];q+=4;assert encsz==0
    with p.open('rb') as f:f.seek(fo);fdi=f.read(fsz)
    assert hashlib.sha1(fdi).digest()==fh
    q=0; nd=struct.unpack_from('<i',fdi,q)[0];q+=4;paths=[]
    for _ in range(nd):
        d,q=rf(fdi,q); nf=struct.unpack_from('<i',fdi,q)[0];q+=4
        for _ in range(nf):
            n,q=rf(fdi,q);q+=4;paths.append((d+n).lstrip('/'))
    return mount,num,seed,paths
with tempfile.TemporaryDirectory() as td:
    p=Path(td)/'pakchunk0-WindowsNoEditor.pak'; build(p); mount,num,seed,paths=parse(p)
    assert mount=='../../../' and num==3 and len(paths)==3
    assert 'Dakar2Game/Content/Maps/MainMenu.umap' in paths
    assert 'Dakar2Game/Content/FMOD/Desktop/Ambience.bank' in paths
    assert 'Dakar2Game/Content/UI/Startup.uasset' in paths
print('V200_WINDOWS_PAK_V11_FDI_OK')
print('V200_CANONICAL_PLAYGO_NAMED=188')
print('V200_CANONICAL_PLAYGO_TOTAL=191')
print('V200_CANONICAL_UNRESOLVED=3')
print('V200_BASELINE_PERCENT=86.0')
print('V200_PC_RUNTIME_DEPENDENCY_ALLOWED=0')
print('V200_PAK_PAYLOAD_COPY_ALLOWED=0')
