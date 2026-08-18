from pathlib import Path

p = Path('app/src/main/java/fr/vox/chronomarkplus/WeatherSyncEngine.java')
s = p.read_text(encoding='utf-8')
old = '    private JSONArray numericSlice(JSONArray src, int count, int decimals) {'
new = '    private JSONArray numericSlice(JSONArray src, int count, int decimals) throws Exception {'
if old not in s:
    raise SystemExit('WeatherSyncEngine numericSlice signature not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
print('Applied Chronomark+ v1.0.1 WeatherSyncEngine compile fix')
