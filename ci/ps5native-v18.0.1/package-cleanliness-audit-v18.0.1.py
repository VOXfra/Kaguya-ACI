#!/usr/bin/env python3
from __future__ import annotations
import argparse,ast,json,re
from pathlib import Path
SENSITIVE={'dakar_ekpfs.bin','dakar_ekpfs.hex','user.json','credentials.json','epic-library-v17.2.1.json'}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--root',required=True);ap.add_argument('--json-out',required=True);ap.add_argument('--text-out',required=True);a=ap.parse_args();root=Path(a.root).resolve();c={};block=[]
 expected={'CMakeLists.txt','PS5-CHECKPOINT.md','ANYPS5-AUDIT-20260929.md','README.md','RUN-DAKAR-v18.0.1.cmd','TEST.cmd','project.json'};actual={p.name for p in root.iterdir() if p.is_file()};c['compact_root_file_set']=actual==expected;c['current_launcher_set']=sorted(p.name for p in root.glob('RUN-DAKAR-*.cmd'))==['RUN-DAKAR-v18.0.1.cmd']
 runner=(root/'tools/run-v18.0.1-final.ps1').read_text(encoding='utf-8');stages=['01-build-windows','02-canonical-reconciliation','03-big-pass-core','04-real-dakar-frontier','05-package-cleanliness-final'];c['five_stage_runner']=all(x in runner for x in stages) and '06-' not in runner
 rec=(root/'tools/reconcile-state-v18.0.py').read_text(encoding='utf-8');c['canonical_reconciliation']=all(x in rec for x in ['remaining_unresolved_count','eboot_table_index','VALIDATED_EKPFS_GATE','roadmap_credit'])
 frontier=(root/'tools/frontier-report-v18.0.py').read_text(encoding='utf-8');c['explicit_frontier_map']=all(x in frontier for x in ['naps-fidx-decode','eboot-plaintext-extraction','real-guest-entry','visible-menu-gameplay','roadmap_credit_awarded'])
 real=(root/'tools/real-dakar-big-pass-v18.0.ps1').read_text(encoding='utf-8');c['real_ps5_path_attempted']=all(x in real for x in ['dakar-ekpfs-intake-gate-v13.5.py','dakar-final-retail-attempt-v16.0.2.ps1','frontier-report-v18.0.py']);c['v174_absorbed']='dakar-pc-loose-playgo-attempt-v17.4.ps1' in real;c['pc_oracle_zero_credit']='zero roadmap credit' in real.lower()
 prov=(root/'tools/ps5-runtime-provenance-audit-v17.3.py').read_text(encoding='utf-8');c['runtime_provenance_gate']=all(x in prov for x in ['FORBIDDEN','Dakar2Game-Win64-Shipping.exe','pc_binary_dependency_allowed','pc_payload_copy_allowed'])
 sensitive=[];transient=[]
 for p in root.rglob('*'):
  if not p.is_file() or p.name.lower() not in SENSITIVE or not p.stat().st_size: continue
  rel=p.relative_to(root);parts={x.lower() for x in rel.parts};(transient if 'build' in parts else sensitive).append(str(rel))
 c['no_packaged_credentials_or_keys']=not sensitive;c['no_transient_sensitive_residue']=not transient
 selftest=(root/'tools/selftest-pc-only-unlock-v17.0.ps1').read_text(encoding='utf-8');c['synthetic_key_outside_project_and_cleanup']=('[IO.Path]::GetTempPath()' in selftest and 'V170_PC_ONLY_UNLOCK_SYNTHETIC_KEY_CLEANUP_OK' in selftest and "Join-Path $PrivateRoot" in selftest)
 py=[p for p in root.rglob('*.py') if 'build' not in {x.lower() for x in p.relative_to(root).parts} and '.local' not in {x.lower() for x in p.relative_to(root).parts}];errs=[]
 for p in py:
  try:ast.parse(p.read_text(encoding='utf-8',errors='strict'),filename=str(p))
  except Exception as e:errs.append(f'{p.relative_to(root)}: {e}')
 c['python_ast_ok']=not errs;c['github_windows_v1801_proof']=(root/'evidence/ps5/v18.0.1-github-windows-proof.json').is_file();c['real_v180_frontier_carried']=(root/'evidence/ps5/user/real-v18.0/dakar-real-frontier-v18.0.json').is_file()
 cache=root/'build/CMakeCache.txt';home=None
 if cache.is_file():
  m=re.search(r'CMAKE_HOME_DIRECTORY:INTERNAL=(.+)',cache.read_text(encoding='utf-8',errors='replace'));home=m.group(1).strip() if m else None
 c['cmake_cache_matches_current_root']=(not cache.is_file()) or bool(home and Path(home).resolve()==root.resolve())
 for k,v in c.items():
  if not v:block.append(k)
 res={'version':'18.0.1','checks':c,'packaged_sensitive_payloads':sensitive,'transient_sensitive_residue':transient,'python_files':len(py),'python_ast_errors':errs,'blockers':block};Path(a.json_out).write_text(json.dumps(res,indent=2)+'\n',encoding='utf-8');Path(a.text_out).write_text(('PASS' if not block else 'FAIL')+'\n',encoding='utf-8');print('V1801_AUDIT_'+('PASS' if not block else 'FAIL'));raise SystemExit(0 if not block else 1)
if __name__=='__main__':main()
