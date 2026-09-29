from pathlib import Path
import argparse
BAD=['Dakar PC Oracle','Dakar2Game-Win64-Shipping.exe','legendary launch']
ap=argparse.ArgumentParser();ap.add_argument('--root',required=True);a=ap.parse_args();r=Path(a.root);hits=[]
for p in r.rglob('*'):
 if p.is_file():
  s=p.read_text(errors='ignore')
  for b in BAD:
   if b.lower() in s.lower():hits.append((str(p),b))
print('V173_WINDOWS_PROVENANCE_'+('FAIL' if hits else 'PASS'));raise SystemExit(1 if hits else 0)
