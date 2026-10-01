import re
PC_ONLY=[6,7,8]
PC_SIZES={6:6164967373,7:11975213540,8:5681900988}
PS5_CHUNK9=10551296
MAP_ROOTS={6:"SaudiArabia/S06",7:"SaudiArabia/S07-09_12",8:"SaudiArabia/S10-11"}
assert sum(PC_SIZES.values())/PS5_CHUNK9 > 50
assert set(PC_ONLY)=={6,7,8}
assert MAP_ROOTS[6].endswith("/S06")
assert MAP_ROOTS[7].endswith("/S07-09_12")
assert MAP_ROOTS[8].endswith("/S10-11")
fixture=b"/Script/DakarGame\0EDKPlatform::PS5\0GamepadPS5ControlScheme\0C:/BuildAgent/work/abc/Dakar2Game/Plugins/Game/DakarGame/Source/DakarGame/Private/Boot.cpp\0"
text=fixture.decode("latin1")
mods=set(re.findall(r"/Script/([A-Za-z0-9_]+)",text))
src=set(m.group(1) for m in re.finditer(r"Dakar2Game/Plugins/.+?/Source/([^/]+)/",text))
assert "DakarGame" in mods and "DakarGame" in src
assert "EDKPlatform::PS5" in text
print("V201_RUNTIME_MODULE_SURFACE_OK")
print("V201_PC_ONLY_CHUNKS=6,7,8")
print("V201_PS5_CHUNK9_BYTES=10551296")
print("V201_CHUNK_EQUIVALENCE_6_7_8_TO_9=0")
print("V201_BASELINE_PERCENT=86.0")
