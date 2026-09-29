#!/usr/bin/env python3
import argparse,json
from pathlib import Path
FORBIDDEN=['Dakar PC Oracle','DAKAR_PC_ROOT','Dakar2Game-Win64-Shipping.exe','Dakar2Game.exe','4aff63ad39cb4fe7a61720d59a4cebc6','legendary launch','steam_app_id=1839940']
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--root',required=True);ap.add_argument('--out',required=True);a=ap.parse_args();root=Path(a.root);hits=[];files=0
 for d in ['ps5_core','ps5_services','ps5_graphics','ps5_agc','platform_win32','adapters/dakar_ue4','apps/dakar_native_bootstrap','apps/dakar_final_integration']:
  b=root/d
  if not b.exists():continue
  for p in b.rglob('*'):
   if not p.is_file():continue
   files+=1;s=p.read_text(encoding='utf-8',errors='replace')
   for m in FORBIDDEN:
    if m.lower() in s.lower():hits.append({'file':p.as_posix(),'marker':m})
 status='PASS' if not hits else 'FAIL';Path(a.out).write_text(json.dumps({'status':status,'runtime_files_scanned':files,'forbidden_runtime_hits':hits,'pc_binary_dependency_allowed':False,'pc_payload_copy_allowed':False},indent=2),encoding='utf-8');print('V1722_RUNTIME_PROVENANCE_'+status);return 0 if status=='PASS' else 1
if __name__=='__main__':raise SystemExit(main())
