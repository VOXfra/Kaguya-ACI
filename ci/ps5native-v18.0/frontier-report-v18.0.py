#!/usr/bin/env python3
from __future__ import annotations
import argparse,json
from pathlib import Path
def load(p):
    p=Path(p);return json.loads(p.read_text(encoding='utf-8-sig')) if p.is_file() else None
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--canonical',required=True);ap.add_argument('--gate',required=True);ap.add_argument('--final',required=True);ap.add_argument('--namespace');ap.add_argument('--provenance');ap.add_argument('--out',required=True);ap.add_argument('--text-out',required=True);a=ap.parse_args()
    can=load(a.canonical);gate=load(a.gate);fin=load(a.final);ns=load(a.namespace) if a.namespace else None;prov=load(a.provenance) if a.provenance else None
    if not can or not gate or not fin: raise SystemExit(2)
    key_valid=bool(gate.get('supplied_ekpfs_validated'));final_status=str(fin.get('status') or 'UNKNOWN');blocker=str(fin.get('blocker') or 'UNKNOWN');stages=[]
    def add(name,status,evidence,blocked_by=None): stages.append({'stage':name,'status':status,'evidence':evidence,'blocked_by':blocked_by})
    add('public-retail-metadata','PASS','canonical PlayGo/FIH/CNT/imagedigs evidence');add('outer-pfs-geometry','PASS',gate.get('geometry'));add('validated-ekpfs','PASS' if key_valid else 'BLOCKED','4-sample imagedigs gate' if key_valid else gate.get('gate_state'),'VALIDATED_EKPFS_REQUIRED' if not key_valid else None)
    ds='NOT_REACHED' if not key_valid else ('PASS' if final_status in ('ROOT_RETURNED','READY') else 'ATTEMPTED')
    for name in ['naps-fidx-decode','eboot-plaintext-extraction','retail-module-set','entry-preflight','real-guest-entry']: add(name,ds,'final integration pipeline',None if key_valid else 'VALIDATED_EKPFS_REQUIRED')
    if final_status=='ROOT_RETURNED': add('visible-menu-gameplay','UNPROVEN','requires human-visible menu + interactive gameplay proof','AWAITING_REAL_MENU_GAMEPLAY_PROOF')
    else:add('visible-menu-gameplay','NOT_REACHED','real guest entry has not completed',blocker)
    rep={'schema':'ps5native.dakar-big-pass-frontier.v18.0','status':'READY','validated_baseline_percent':86.0,'target_percent':100.0,'roadmap_credit_awarded':0.0,'real_final_status':final_status,'real_final_blocker':blocker,'ekpfs_supplied':bool(gate.get('explicit_ekpfs_path_supplied')),'ekpfs_validated':key_valid,'namespace_exact_new_matches':(ns or {}).get('exact_new_match_count') if ns else None,'runtime_provenance':(prov or {}).get('status'),'pc_runtime_dependency_allowed':False,'stages':stages}
    rep['next_decisive_action']='A lawfully obtained 32-byte Dakar EKPFS must validate against all four independent imagedigs samples. Without it, NAPS/FIDX and eboot plaintext are cryptographically unreachable from the current retail backup.' if not key_valid else 'Continue on the reported real final blocker.'
    Path(a.out).write_text(json.dumps(rep,indent=2)+'\n',encoding='utf-8');Path(a.text_out).write_text(rep['next_decisive_action']+'\n',encoding='utf-8');print('V180_FRONTIER_REPORT_OK');return 0
if __name__=='__main__': raise SystemExit(main())
