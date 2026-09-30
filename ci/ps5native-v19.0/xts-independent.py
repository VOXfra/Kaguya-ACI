from __future__ import annotations
import hashlib,hmac,struct
from cryptography.hazmat.primitives.ciphers import Cipher,algorithms,modes

ek=bytes(range(32));seed=bytes(range(16));sector=0x123456789
data=bytes((i*17+3)&255 for i in range(0x1000))
expected={"direct":"6f5cabe7fc24aabf5e53009d6b0f42beae4d623b87be192c563238b712875a17","newcrypt":"e1d5afc0a67b93cb304d5b065e014d4d53e2cf0ecb4cc2b5011ee29777954366"}
for mode,want in expected.items():
    base=ek if mode=="direct" else hmac.new(ek,seed,hashlib.sha256).digest()
    enc=hmac.new(base,struct.pack("<I",1)+seed,hashlib.sha256).digest()
    tk,dk=enc[:16],enc[16:]
    tweak=sector.to_bytes(8,"little")+b"\0"*8
    ct=Cipher(algorithms.AES(dk+tk),modes.XTS(tweak)).encryptor().update(data)
    assert hashlib.sha256(ct).hexdigest()==want
print("V190_WINDOWS_INDEPENDENT_XTS_KAT_OK")
