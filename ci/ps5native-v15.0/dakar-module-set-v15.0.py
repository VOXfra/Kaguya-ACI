#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, importlib.util, json, sys
from collections import deque
from pathlib import Path, PurePosixPath

SCHEMA='ps5native.dakar-module-set.v15.0'
HANDOFF_SCHEMA='ps5native.dakar-retail-handoff.v14.9'

class ModuleSetError(RuntimeError):
    def __init__(self,code:int,msg:str): super().__init__(msg); self.code=code

def read_json(p:Path): return json.loads(p.read_text(encoding='utf-8-sig'))
def write_json(p:Path,o): p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(o,indent=2)+'\n',encoding='utf-8')
def sha256_file(p:Path):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
    return h.hexdigest()
def canonical_sha(o): return hashlib.sha256(json.dumps(o,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def load_inventory(tool:Path):
    spec=importlib.util.spec_from_file_location('ps5_inventory_v150',tool); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m

def normalize_rel(raw:str)->PurePosixPath:
    p=PurePosixPath(str(raw).replace('\\','/'))
    if p.is_absolute() or not p.parts or any(x in ('','.', '..') for x in p.parts): raise ModuleSetError(37,'module path is not a safe relative path')
    return p
def safe_path(root:Path,raw:str)->Path:
    rel=normalize_rel(raw); base=root.resolve(); p=(base/Path(*rel.parts)).resolve()
    try: p.relative_to(base)
    except ValueError: raise ModuleSetError(37,'module path escapes artifact root')
    return p
def relpath(root:Path,p:Path)->str:
    try: return p.resolve().relative_to(root.resolve()).as_posix()
    except ValueError: raise ModuleSetError(37,'module is outside artifact root')

def identity(m): return str(m.get('soname') or m.get('file_name') or '')
def graph_orders(modules:dict[str,dict],root_id:str):
    startup=[]; state={}; stack=[]; missing=[]; cycles=[]
    def dfs(i):
        if i not in modules:
            missing.append(i); return False
        st=state.get(i,0)
        if st==2:return True
        if st==1:
            try:j=stack.index(i)
            except ValueError:j=0
            cycles.append(stack[j:]+[i]); return False
        state[i]=1; stack.append(i); ok=True
        for dep in modules[i]['needed']:
            if dep not in modules: missing.append(dep); ok=False
            elif not dfs(dep): ok=False
        stack.pop(); state[i]=2
        if i not in startup: startup.append(i)
        return ok
    ok=dfs(root_id)
    q=deque([root_id]); seen={root_id}; scope=[]
    while q:
        i=q.popleft(); scope.append(i)
        if i not in modules: continue
        for dep in modules[i]['needed']:
            if dep not in seen: seen.add(dep); q.append(dep)
    return ok and not missing and not cycles,startup,list(reversed(startup)),scope,sorted(set(missing)),cycles

def emit(a):
    handoff=read_json(Path(a.handoff)); artroot=Path(a.artifact_root)
    if handoff.get('schema')!=HANDOFF_SCHEMA: raise ModuleSetError(31,'handoff schema mismatch')
    source=handoff.get('source_kind')
    if source=='integration_fixture' and not a.integration_fixture: raise ModuleSetError(32,'integration fixture requires explicit allowance')
    if source=='retail_post_ekpfs' and not bool((handoff.get('security') or {}).get('ekpfs_validated')) and handoff.get('status')=='READY': raise ModuleSetError(32,'retail READY handoff requires independently validated EKPFS')
    base={'schema':SCHEMA,'status':'PENDING','source_kind':source,'handoff_schema':handoff.get('schema'),'root':None,'module_count':0,'closure_complete':False,'startup_order':[],'finalization_order':[],'resolution_scope':[],'missing_dependencies':[],'duplicate_identities':[],'cycles':[],'modules':[],'closure_sha256':None,'pending_reason':None,'blockers':[]}
    if handoff.get('status')!='READY':
        base['pending_reason']=handoff.get('pending_reason') or 'HANDOFF_NOT_READY'; write_json(Path(a.out),base); print('Module-set status: PENDING'); print('Module-set pending reason: '+base['pending_reason']); print('V150_MODULE_SET_MANIFEST_EMITTED'); return 0
    art=handoff.get('artifact') or {}; root_art=safe_path(artroot,str(art.get('relative_path') or ''))
    if not root_art.is_file(): raise ModuleSetError(36,'root handoff artifact missing')
    if root_art.stat().st_size!=int(art.get('size',-1)) or sha256_file(root_art)!=str(art.get('sha256') or '').lower(): raise ModuleSetError(36,'root handoff artifact integrity mismatch')
    inv=load_inventory(Path(a.inventory_tool)); catalog=read_json(Path(a.catalog))
    parsed=[]
    for f in sorted(x for x in artroot.rglob('*') if x.is_file()):
        try: parsed.append((f,inv.parse_module(f,catalog)))
        except Exception: pass
    root_matches=[m for f,m in parsed if f.resolve()==root_art.resolve()]
    if len(root_matches)!=1: raise ModuleSetError(31,'root artifact is not a uniquely parseable module')
    records={}; dup={}
    for f,m in parsed:
        i=identity(m)
        if not i: continue
        rec={'identity':i,'relative_path':relpath(artroot,f),'size':f.stat().st_size,'sha256':sha256_file(f),'needed':list(dict.fromkeys(m.get('needed_files') or [])),'container_kind':m.get('container_kind'),'structured_import_count':int(m.get('structured_import_count',0)),'relocation_count':int(m.get('relocation_count',0))}
        if i in records: dup.setdefault(i,[records[i]['relative_path']]).append(rec['relative_path'])
        else: records[i]=rec
    root_id=identity(root_matches[0]); base['root']={'identity':root_id,'relative_path':relpath(artroot,root_art),'sha256':sha256_file(root_art)}
    if dup:
        base['status']='BLOCKED'; base['duplicate_identities']=[{'identity':k,'paths':v} for k,v in sorted(dup.items())]; base['blockers'].append('duplicate module identities'); write_json(Path(a.out),base); print('Module-set status: BLOCKED'); print('Duplicate module identities: '+','.join(sorted(dup))); print('V150_MODULE_SET_MANIFEST_EMITTED'); return 0
    ok,startup,fini,scope,missing,cycles=graph_orders(records,root_id)
    base['modules']=[records[i] for i in startup if i in records]
    base['module_count']=len(base['modules']); base['startup_order']=startup; base['finalization_order']=fini; base['resolution_scope']=scope; base['missing_dependencies']=missing; base['cycles']=cycles
    if not ok:
        base['status']='BLOCKED'
        if missing: base['blockers'].append('missing dependencies: '+', '.join(missing))
        if cycles: base['blockers'].append('dependency cycle')
    else:
        base['status']='READY'; base['closure_complete']=True
        digest_payload={'root':base['root'],'modules':base['modules'],'startup_order':startup,'finalization_order':fini,'resolution_scope':scope}; base['closure_sha256']=canonical_sha(digest_payload)
    write_json(Path(a.out),base)
    print('Module-set status: '+base['status']); print('Module-set root: '+root_id); print('Module-set modules: '+str(base['module_count']))
    if missing: print('Module-set missing: '+', '.join(missing))
    if base['closure_sha256']: print('Module-set closure SHA256: '+base['closure_sha256'])
    print('V150_MODULE_SET_MANIFEST_EMITTED'); return 0

def validate(a):
    m=read_json(Path(a.manifest)); root=Path(a.artifact_root)
    if m.get('schema')!=SCHEMA: raise ModuleSetError(31,'module-set schema mismatch')
    if m.get('status')!='READY' or m.get('closure_complete') is not True: raise ModuleSetError(30,'module-set is not READY with complete closure')
    mods=m.get('modules') or []; by={}
    for rec in mods:
        i=str(rec.get('identity') or '')
        if not i or i in by: raise ModuleSetError(33,'duplicate/empty identity in manifest')
        p=safe_path(root,str(rec.get('relative_path') or ''))
        if not p.is_file(): raise ModuleSetError(36,'module artifact missing: '+i)
        if p.stat().st_size!=int(rec.get('size',-1)): raise ModuleSetError(36,'module artifact size mismatch: '+i)
        if sha256_file(p)!=str(rec.get('sha256') or '').lower(): raise ModuleSetError(36,'module artifact SHA-256 mismatch: '+i)
        by[i]=rec
    rid=str((m.get('root') or {}).get('identity') or '')
    ok,startup,fini,scope,missing,cycles=graph_orders(by,rid)
    if missing: raise ModuleSetError(34,'missing dependency: '+missing[0])
    if cycles: raise ModuleSetError(35,'dependency cycle detected')
    if not ok: raise ModuleSetError(34,'module-set closure incomplete')
    if startup!=m.get('startup_order') or fini!=m.get('finalization_order') or scope!=m.get('resolution_scope'): raise ModuleSetError(38,'module-set graph order mismatch')
    payload={'root':m.get('root'),'modules':mods,'startup_order':startup,'finalization_order':fini,'resolution_scope':scope}
    if canonical_sha(payload)!=str(m.get('closure_sha256') or ''): raise ModuleSetError(39,'module-set closure digest mismatch')
    print('Module-set manifest validation: PASS'); print('Module-set artifact integrity: PASS'); print('Module-set dependency closure: PASS'); print('Module-set startup order: '+' '.join(startup)); print('V150_MODULE_SET_CONTRACT_OK'); return 0

def main():
    ap=argparse.ArgumentParser(); sp=ap.add_subparsers(dest='cmd',required=True)
    e=sp.add_parser('emit'); e.add_argument('--handoff',required=True); e.add_argument('--artifact-root',required=True); e.add_argument('--catalog',required=True); e.add_argument('--inventory-tool',required=True); e.add_argument('--out',required=True); e.add_argument('--integration-fixture',action='store_true')
    v=sp.add_parser('validate'); v.add_argument('--manifest',required=True); v.add_argument('--artifact-root',required=True)
    a=ap.parse_args()
    try: return emit(a) if a.cmd=='emit' else validate(a)
    except ModuleSetError as ex:
        print('MODULE_SET_REJECT: '+str(ex),file=sys.stderr); return ex.code
if __name__=='__main__': raise SystemExit(main())
