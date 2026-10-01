from __future__ import annotations
import hashlib, math, struct
RIF_SIZE=0x400; KEY_BLOB_OFF=0x240; KEY_BLOB_SIZE=0x1C0
RIF_MAGIC=b'RIF\0'; QPAC=b'QPaC'; DESC=bytes([1,4,0,16,0,32,0,3])
def exact_overlap(src,dst,sizes=(256,128,64,32,16)):
    out=[]
    for n in sizes:
        for so in range(0,len(src)-n+1,n):
            if dst.find(src[so:so+n])>=0: out.append((n,so,dst.find(src[so:so+n])))
    return out
rif=bytearray(RIF_SIZE);rif[:4]=RIF_MAGIC;rif[4:6]=(2).to_bytes(2,'big');rif[6:8]=(0xffff).to_bytes(2,'big');rif[0x14:0x18]=QPAC;rif[0x18:0x20]=(0x7fffffffffffffff).to_bytes(8,'big',signed=True)
cid=b'EP6853-PPSA04477_00-DKRGAMEPS50000EU';rif[0x20:0x20+len(cid)]=cid;rif[0x50:0x58]=DESC;rif[0x60:0x68]=(1).to_bytes(8,'big')
blob=bytes((i*29+7)&255 for i in range(KEY_BLOB_SIZE));rif[KEY_BLOB_OFF:]=blob
img=bytes(256)+blob[:256]+bytes(2048-512)
assert len(rif)==0x400 and rif[:4]==b'RIF\0' and struct.unpack_from('>H',rif,4)[0]==2
assert rif[0x14:0x18]==b'QPaC' and rif[0x50:0x58]==DESC and struct.unpack_from('>Q',rif,0x60)[0]==1
assert len(rif[0x240:])==0x1c0 and any(x[0]==256 for x in exact_overlap(blob,img))
print('V191_WINDOWS_RIF_STRUCTURAL_CONTRACT_OK')
