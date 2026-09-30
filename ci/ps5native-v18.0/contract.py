import json,subprocess,sys,tempfile
from pathlib import Path
td=Path(tempfile.mkdtemp());ev=td/'evidence/ps5/user';ev.mkdir(parents=True)
def w(rel,obj):
 p=td/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(obj),encoding='utf-8')
w('evidence/ps5/user/dakar-official-psn-dlcdata-correlation-v13.0.json',{'remaining_unresolved_count':3,'remaining_unresolved_retail_hashes':[{'table_index':55,'chunk_id':0,'hash_hex':'0x1'},{'table_index':105,'chunk_id':0,'hash_hex':'0x2'},{'table_index':129,'chunk_id':0,'hash_hex':'0x3'}],'baseline_retail_hash_count':191,'total_named_count':188})
w('evidence/ps5/user/dakar-eboot-protected-window-refinement-v13.1.1.json',{'eboot':{'table_index':185,'chunk_id':0,'hash_hex':'0xF16A60EEE4F247FC'},'eboot_chunk0_pfs_image_overlap_after_bytes':16287858688})
w('evidence/ps5/user/dakar-imagedigs-plaintext-pattern-census-v13.2.json',{'imagedigs_entry':{'digest_count':670201},'pfs_image_block_count':669711})
w('evidence/ps5/user/real-v13.5-ekpfs-gate.json',{'gate_state':'WAITING_FOR_SUPPLIED_EKPFS'})
w('evidence/ps5/user/real-v16.0.2/dakar-final-integration-v16.0.2.json',{'status':'PENDING','blocker':'WAITING_FOR_VALIDATED_EKPFS'})
w('evidence/ps5/user/real-v17.2.2/dakar-pc-oracle-static-v17.2.2.json',{'pak_count':10,'shipping_exe':{'imports':['x']*48}})
w('evidence/ps5/user/real-v17.3/dakar-pc-pak-playgo-correlation-v17.3.json',{'exact_new_match_count':0})
out=td/'canonical.json';txt=td/'canonical.txt'
subprocess.check_call([sys.executable,'ci/ps5native-v18.0/reconcile-state-v18.0.py','--root',str(td),'--out',str(out),'--text-out',str(txt)])
j=json.loads(out.read_text());assert j['canonical']['playgo_unresolved_count']==3 and j['canonical']['eboot_table_index']==185 and j['execution_frontier']['first_blocked_stage']=='VALIDATED_EKPFS_GATE'
gate=td/'gate.json';gate.write_text(json.dumps({'gate_state':'WAITING_FOR_SUPPLIED_EKPFS','explicit_ekpfs_path_supplied':False,'supplied_ekpfs_validated':False,'geometry':{'pfs_offset':65536}}))
fin=td/'final.json';fin.write_text(json.dumps({'status':'PENDING','blocker':'WAITING_FOR_VALIDATED_EKPFS'}));ns=td/'ns.json';ns.write_text(json.dumps({'exact_new_match_count':0}));prov=td/'prov.json';prov.write_text(json.dumps({'status':'PASS'}))
fo=td/'frontier.json';ft=td/'frontier.txt'
subprocess.check_call([sys.executable,'ci/ps5native-v18.0/frontier-report-v18.0.py','--canonical',str(out),'--gate',str(gate),'--final',str(fin),'--namespace',str(ns),'--provenance',str(prov),'--out',str(fo),'--text-out',str(ft)])
f=json.loads(fo.read_text());assert f['real_final_blocker']=='WAITING_FOR_VALIDATED_EKPFS' and f['roadmap_credit_awarded']==0.0 and f['stages'][2]['status']=='BLOCKED' and all(x['status']=='NOT_REACHED' for x in f['stages'][3:8])
print('V180_WINDOWS_CANONICAL_FRONTIER_CONTRACT_OK')
