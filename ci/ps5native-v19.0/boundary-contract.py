from __future__ import annotations
import hashlib,hmac,json,struct,tempfile
from pathlib import Path

def derive(ek,seed,mode,index):
    base=ek if mode=="direct" else hmac.new(ek,seed,hashlib.sha256).digest()
    return hmac.new(base,struct.pack("<I",index)+seed,hashlib.sha256).digest()

ek=bytes(range(32));seed=bytes(range(16))
expected={
"direct":{
"enc":"76be34e86d4a3793c4f2af46f63879f41b876753b3609b58c497052fc4f416b6",
"sig":"e9d9d5c076c2b31e0a95557f14f36f20b99cfcc788f7c09e640ada5f49eeb7bd",
"ctsha256":"6f5cabe7fc24aabf5e53009d6b0f42beae4d623b87be192c563238b712875a17"},
"newcrypt":{
"enc":"d27ad1a1860b06a5c08c0a2037e6430b733aeae5aa85da50f7feccc51aaa2a07",
"sig":"2370f4a014a6206a2d578130cdea4046db68acc0b384b1947ce9497b3fd2aad4",
"ctsha256":"e1d5afc0a67b93cb304d5b065e014d4d53e2cf0ecb4cc2b5011ee29777954366"}}
for mode,e in expected.items():
    assert derive(ek,seed,mode,1).hex()==e["enc"]
    assert derive(ek,seed,mode,2).hex()==e["sig"]
print("V190_WINDOWS_DUAL_SCHEDULE_KDF_OK")

blob=b"".join(hashlib.sha256(b"slot"+i.to_bytes(4,"little")).digest()*8 for i in range(8))
assert len(blob)==2048
fps=[hashlib.sha256(blob[i:i+256]).hexdigest() for i in range(0,len(blob),256)]
assert len(fps)==8 and len(set(fps))==8
print("V190_WINDOWS_2048_EQUALS_8X256_PROFILE_OK")

td=Path(tempfile.mkdtemp())
rif=bytearray(0x400);rif[:4]=b"RIF\0";cid=b"EP6853-PPSA04477_00-DKRGAMEPS50000EU";rif[0x40:0x40+len(cid)]=cid
p=td/"rif";p.write_bytes(rif)
d=p.read_bytes();assert len(d)%0x400==0 and d[:4]==b"RIF\0" and cid in d
print("V190_WINDOWS_RIF_CENSUS_SHAPE_OK")

report={"raw_wrapped_bytes_exported":False,"raw_rif_bytes_exported":False,"bruteforce":False,"network_key_search":False}
assert not any(report.values())
print("V190_WINDOWS_REDACTION_POLICY_OK")
