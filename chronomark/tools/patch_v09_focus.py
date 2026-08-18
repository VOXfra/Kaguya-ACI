from pathlib import Path

# Music Control+: keep the validated visual design, but apply the common lifecycle contract.
p = Path('app/src/main/java/fr/vox/chronomarkplus/MainActivityV07.java')
s = p.read_text(encoding='utf-8')

old = '''        String js = "(function(){try{" +\n                "var M=global.__voxMC={title:"'''
new = '''        String js = "(function(){try{" + WatchAppContract.suspendBethesdaClockJs() + WatchAppContract.beginSessionJs("MC") +\n                "var M=global.__voxMC={title:"'''
if old not in s:
    raise SystemExit('Music session insertion point not found')
s = s.replace(old, new, 1)

old = '''                "global.__voxMCBack=function(){try{if(global.__voxMCTimer)clearInterval(global.__voxMCTimer);if(global.__voxMCAuto)clearTimeout(global.__voxMCAuto);}catch(e){}print('VOX'+'_MC:EXIT');load('clock.app.js');};" +'''
new = '''                "global.__voxMCBack=function(){try{if(global.__voxMCTimer)clearInterval(global.__voxMCTimer);if(global.__voxV3)clearInterval(global.__voxV3);if(global.__voxV4)clearInterval(global.__voxV4);E.clearWatches();}catch(e){}global.__voxSessionSeq=(global.__voxSessionSeq||0)+1;global.__voxActiveApp='';print('VOX'+'_MC:EXIT');load('clock.app.js');};" +'''
if old not in s:
    raise SystemExit('Music exit block not found')
s = s.replace(old, new, 1)

old = '''                "global.__voxMCDraw=function(){" +'''
new = '''                "global.__voxMCDraw=function(){if(global.__voxActiveApp!=='MC')return;" +'''
if old not in s:
    raise SystemExit('Music draw guard insertion point not found')
s = s.replace(old, new, 1)

old = '''                "global.__voxMCTimer=setInterval(global.__voxMCDraw,1000);global.__voxMCAuto=setTimeout(global.__voxMCBack,120000);global.__voxMCDraw();print('VOX'+'_MC:READY');" +'''
new = '''                "global.__voxMCTimer=setInterval(global.__voxMCDraw,1000);global.__voxMCAuto=0;global.__voxMCDraw();print('VOX'+'_MC:READY');" +'''
if old not in s:
    raise SystemExit('Music auto-return block not found')
s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')

# Phone Status: remove the least useful text line and keep every instruction inside safe area.
# patch_v08_hook runs first and may already have moved these two lines for v0.8.1.
p = Path('app/src/main/java/fr/vox/chronomarkplus/MainActivityV081.java')
s = p.read_text(encoding='utf-8')

old = '''                "g.setFontArchitekt10().setFontAlign(0,0).setColor('#BFC8CC').drawString('PHONE STATUS',119,43);" +'''
new = '''                "g.setFontArchitekt10().setFontAlign(0,0).setColor('#BFC8CC').drawString('TELEPHONE',119,43);" +'''
if old not in s:
    raise SystemExit('Phone header not found')
s = s.replace(old, new, 1)

candidates = [
    '''                "g.setColor('#9BA4A7').drawString(P.model,119,168);" +\n                "g.setColor('#00BCEB').drawString('BTN1  FIND PHONE',119,183);g.setClipRect(0,0,239,239);g.flip();};" +''',
    '''                "g.setColor('#9BA4A7').drawString(P.model,119,177);" +\n                "g.setColor('#00BCEB').drawString('BTN1  FIND PHONE',119,189);g.setClipRect(0,0,239,239);g.flip();};" +'''
]
new = '''                "g.setColor('#00BCEB').drawString('BTN1  FIND PHONE',119,181);g.setClipRect(0,0,239,239);g.flip();};" +'''
for old in candidates:
    if old in s:
        s = s.replace(old, new, 1)
        break
else:
    raise SystemExit('Phone bottom block not found')

p.write_text(s, encoding='utf-8')
print('Applied Chronomark+ v0.9 focused Music/Phone polish')
