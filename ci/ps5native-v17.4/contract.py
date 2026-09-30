from pathlib import Path
import argparse,importlib.util,json,tempfile,shutil
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--root',required=True);a=ap.parse_args();root=Path(a.root)
 spec=importlib.util.spec_from_file_location('corr',root/'ci/ps5native-v17.4/dakar-pc-loose-playgo-correlation-v17.4.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 td=Path(tempfile.mkdtemp(prefix='v174-'))
 try:
  pc=td/'pc'
  files=['Dakar2Game/Content/DLCData/DLCData_TEST.json','Dakar2Game/Content/FMOD/Desktop/Ambience.bank','Dakar2Game/Content/Paks/pakchunk77-WindowsNoEditor.pak']
  for rel in files:
   p=pc/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b'x')
  paths=['Dakar2Game/Content/DLCData/DLCData_TEST.json','Dakar2Game/Content/FMOD/PS5/Ambience.bank','Dakar2Game/Content/Paks/pakchunk77-PS5.pak']
  rows=[{'table_index':i+1,'chunk_id':0,'hash_hex':f'0x{m.ps5_hash(p):016X}'} for i,p in enumerate(paths)]
  tgt=td/'targets.json';tgt.write_text(json.dumps({'remaining_unresolved_retail_hashes':rows}),encoding='utf-8')
  out=td/'out.json';txt=td/'out.txt'
  rc=m.main.__call__ if False else None
  import subprocess,sys
  cp=subprocess.run([sys.executable,str(root/'ci/ps5native-v17.4/dakar-pc-loose-playgo-correlation-v17.4.py'),'--pc-root',str(pc),'--targets',str(tgt),'--out',str(out),'--text-out',str(txt)])
  if cp.returncode: return cp.returncode
  j=json.loads(out.read_text())
  assert j['loose_file_count']==3 and j['exact_new_match_count']==3 and j['unresolved_after']==0
  assert j['launch_attempted'] is False and j['decryption_attempted'] is False and j['key_material_used'] is False and j['fuzzy_matching_used'] is False
  print('V174_WINDOWS_LOOSE_NAMESPACE_EXACT_HASH_OK')
  return 0
 finally: shutil.rmtree(td,ignore_errors=True)
if __name__=='__main__': raise SystemExit(main())
