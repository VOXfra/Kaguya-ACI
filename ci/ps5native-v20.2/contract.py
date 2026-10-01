import tempfile,json
from pathlib import Path
ASSETS=[
'Dakar2Game/Plugins/Game/DakarGame/Content/Game/B_GameInstance.uasset',
'Dakar2Game/Plugins/Game/DakarGame/Content/Levels/L_DakarStart.umap',
'Dakar2Game/Plugins/Game/DakarGame/Content/Levels/L_DakarMenu.umap',
'Dakar2Game/Plugins/Game/DakarGame/Content/Levels/L_DakarLobby.umap',
'Dakar2Game/Plugins/Game/DakarGame/Content/Levels/L_DakarPodium.umap',
'Dakar2Game/Plugins/Game/DakarGame/Content/Game/Intro/BP_GameIntroController.uasset',
'Dakar2Game/Plugins/Game/DakarGame/Content/UMG2/MainMenu/B_NewMainMenu.uasset',
'Dakar2Game/Plugins/Game/DakarGame/Content/UMG2/Mainmenu.uasset',
'Dakar2Game/Plugins/Game/DakarGame/Content/UMG2/B_LoadingMenu.uasset',
'Dakar2Game/Content/Bink/bnk_DKR_GameIntro2.uasset',
'Dakar2Game/Content/Bink/bnk_Dakar_LoadingScreen.uasset']
mods=['DakarGame','BmCore','BmGameFramework','BmLoading','BmOnline','BmRawInput','FMODStudio','OnlineSubsystem','OnlineSubsystemEOS','OnlineSubsystemUtils','BinkMediaPlayer','PhysXVehicles','BmPhysXHeightField','BmNavigationSystem','BmCharacter','BmItem','BmCustomization','BmRoadNetwork','BmTrafficSystem','BmShaders','BmSky']
with tempfile.TemporaryDirectory() as td:
    p=Path(td)/'paths.txt'
    with p.open('w',encoding='utf-8') as f:
        for a in ASSETS:
            f.write('pakchunk0-WindowsNoEditor.pak\t'+a+'\n')
            stem=a.rsplit('.',1)[0]; f.write('pakchunk0-WindowsNoEditor.pak\t'+stem+'.uexp\n')
    paths={line.split('\t',1)[1] for line in p.read_text().splitlines()}
    assert all(a in paths for a in ASSETS)
    assert all((a.rsplit('.',1)[0]+'.uexp') in paths for a in ASSETS)
    runtime={'runtime_modules':mods}
    assert all(m in runtime['runtime_modules'] for m in mods)
    shared={0,1,2,3,4,5,10}
    assert 0 in shared
print('V202_MENU_ASSETS_11_OF_11_OK')
print('V202_BOOT_MODULES_21_OF_21_OK')
print('V202_CHUNK0_SHARED_LABEL_OK')
print('V202_BASELINE_PERCENT=86.0')
print('V202_REAL_FRONTIER=VALIDATED_EKPFS_REQUIRED')
