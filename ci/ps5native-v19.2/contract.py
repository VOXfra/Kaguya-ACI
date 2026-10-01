import hashlib,struct
RSA=384
assert 32 + 7*32 + 7*RSA == 2944
assert 5*RSA + 128 == 2048
cid=b'EP6853-PPSA04477_00-DKRGAMEPS50000EU'.ljust(48,b'\0')
seed=hashlib.sha3_256(cid).digest()
ek=seed+b''.join(hashlib.sha256(b'd'+bytes([i])).digest() for i in range(7))+b''.join(bytes([i+1])*RSA for i in range(7))
assert len(ek)==2944 and ek[:32]==seed
ik=b''.join(bytes([20+i])*RSA for i in range(5))+bytes([99])*128
assert len(ik)==2048
hdr=bytearray(0x5A0)
struct.pack_into('>I',hdr,0x510,0x3000)
struct.pack_into('>I',hdr,0x514,0x800)
hdr[0x520:0x540]=hashlib.sha3_256(ik).digest()
assert struct.unpack_from('>I',hdr,0x514)[0]==len(ik)
assert hdr[0x520:0x540]==hashlib.sha3_256(ik).digest()
print('V192_WINDOWS_RSA3072_LAYOUT_CONTRACT_OK')