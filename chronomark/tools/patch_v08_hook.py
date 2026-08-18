from pathlib import Path

p = Path('app/src/main/java/fr/vox/chronomarkplus/MainActivityV07.java')
s = p.read_text(encoding='utf-8')

needle = '''        else if(line.contains("VOX_MC:VOLUP")) adjustVolume(true);\n        else if(line.contains("VOX_MC:EXIT") || line.contains("VOX_WX:EXIT")) {'''
replacement = '''        else if(line.contains("VOX_MC:VOLUP")) adjustVolume(true);\n        else if(line.contains("VOX_V08:")) onV08WatchLine(line);\n        else if(line.contains("VOX_MC:EXIT") || line.contains("VOX_WX:EXIT")) {'''

if 'onV08WatchLine(line)' not in s:
    if needle not in s:
        raise SystemExit('v0.8 parser insertion point not found')
    s = s.replace(needle, replacement, 1)

hook_needle = '''\n    private void mediaPlayPause() {'''
hook_replacement = '''\n    protected void onV08WatchLine(String line) { }\n\n    private void mediaPlayPause() {'''
if 'protected void onV08WatchLine(String line)' not in s:
    if hook_needle not in s:
        raise SystemExit('v0.8 hook insertion point not found')
    s = s.replace(hook_needle, hook_replacement, 1)

p.write_text(s, encoding='utf-8')
print('Applied Chronomark+ v0.8 watch-command hook')
