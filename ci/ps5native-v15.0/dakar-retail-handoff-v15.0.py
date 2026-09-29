#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path, PurePosixPath

SCHEMA = 'ps5native.dakar-retail-handoff.v14.9'
PIPELINE_PREFIXES = ('ps5native.dakar-post-ekpfs-pipeline.v14.', 'ps5native.dakar-post-ekpfs-pipeline.v15.')

class HandoffError(RuntimeError):
    def __init__(self, code:int, reason:str):
        super().__init__(reason)
        self.code=code
        self.reason=reason

def read_json(path:Path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write_json(path:Path,obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(obj,indent=2)+'\n',encoding='utf-8')

def sha256_file(path:Path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):
            h.update(chunk)
    return h.hexdigest()

def normalize_rel(raw:str)->PurePosixPath:
    text=str(raw).replace('\\','/')
    p=PurePosixPath(text)
    if not text or p.is_absolute() or any(part in ('','..') for part in p.parts) or ':' in p.parts[0]:
        raise HandoffError(23,'artifact path is not a safe relative path')
    return p

def safe_artifact_path(root:Path, rel_raw:str)->Path:
    rel=normalize_rel(rel_raw)
    root_res=root.resolve()
    candidate=(root_res/Path(*rel.parts)).resolve()
    try:
        candidate.relative_to(root_res)
    except ValueError:
        raise HandoffError(23,'artifact path escapes artifact root')
    return candidate

def artifact_rel(root:Path,path:Path)->str:
    root_res=root.resolve(); path_res=path.resolve()
    try: rel=path_res.relative_to(root_res)
    except ValueError: raise HandoffError(23,'pipeline artifact is outside declared artifact root')
    return PurePosixPath(*rel.parts).as_posix()

def emit_manifest(report:dict, artifact_root:Path, integration_fixture:bool)->dict:
    schema=str(report.get('schema') or '')
    if not any(schema.startswith(prefix) for prefix in PIPELINE_PREFIXES):
        raise HandoffError(21,f'unsupported pipeline schema: {schema!r}')
    if any(bool(report.get(k)) for k in ('network_access','key_search_performed','bruteforce_performed')):
        raise HandoffError(21,'pipeline report violates offline/no-search handoff contract')

    source_kind='integration_fixture' if integration_fixture else 'retail_post_ekpfs'
    eboot=report.get('eboot') or {}
    direct=bool(report.get('direct_dakar_executable_plaintext_access'))
    extracted=bool(eboot.get('candidate_extracted'))
    parsed=bool(eboot.get('module_parse_ok'))
    ekpfs_ok=bool(report.get('ekpfs_validated'))
    ready=direct and extracted and parsed and (integration_fixture or ekpfs_ok)

    manifest={
        'schema':SCHEMA,
        'status':'READY' if ready else 'PENDING',
        'source_kind':source_kind,
        'pipeline':{
            'schema':schema,
            'state':report.get('state'),
            'package_input':report.get('input'),
            'package_total_bytes':report.get('package_total_bytes'),
            'retail_signed':report.get('retail_signed'),
            'eboot_candidate_index':report.get('eboot_candidate_index'),
        },
        'security':{
            'ekpfs_supplied':bool(report.get('ekpfs_supplied')),
            'ekpfs_validated':ekpfs_ok,
            'network_access':False,
            'key_search_performed':False,
            'bruteforce_performed':False,
        },
        'artifact':None,
        'runtime_gate':{
            'startup_authorized': bool(integration_fixture or (report.get('startup_gate') or {}).get('entry_abi_evidenced')),
            'required_modes':['inspect-only','entry-preflight'],
        },
        'pending_reason':None,
    }
    if ready:
        local=Path(str(eboot.get('local_path') or ''))
        if not local.is_file(): raise HandoffError(24,'pipeline marks eboot ready but local artifact is missing')
        rel=artifact_rel(artifact_root,local)
        actual_size=local.stat().st_size; actual_sha=sha256_file(local)
        declared_size=int(eboot.get('candidate_size',-1)); declared_sha=str(eboot.get('sha256') or '').lower()
        if declared_size!=actual_size or declared_sha!=actual_sha:
            raise HandoffError(24,'pipeline eboot size/hash does not match local artifact')
        inventory=eboot.get('module_inventory') or {}
        manifest['artifact']={
            'relative_path':rel,
            'size':actual_size,
            'sha256':actual_sha,
            'module_parse_ok':True,
            'container_kind':inventory.get('container_kind'),
            'structured_import_count':inventory.get('structured_import_count'),
            'relocation_count':inventory.get('relocation_count'),
        }
        if manifest['runtime_gate']['startup_authorized']:
            manifest['runtime_gate']['required_modes'].append('guarded-startup')
    else:
        if not integration_fixture and not ekpfs_ok:
            manifest['pending_reason']='WAITING_FOR_VALIDATED_EKPFS'
        elif not direct:
            manifest['pending_reason']='PLAINTEXT_EBOOT_NOT_AVAILABLE'
        elif not extracted:
            manifest['pending_reason']='EBOOT_NOT_EXTRACTED'
        elif not parsed:
            manifest['pending_reason']='EBOOT_MODULE_PARSE_NOT_READY'
        else:
            manifest['pending_reason']='HANDOFF_NOT_READY'
    return manifest

def validate_manifest(manifest:dict, artifact_root:Path, allow_fixture:bool):
    if manifest.get('schema')!=SCHEMA: raise HandoffError(21,'handoff schema mismatch')
    if manifest.get('status')!='READY': raise HandoffError(20,f"handoff is not READY ({manifest.get('pending_reason') or manifest.get('status')})")
    source=manifest.get('source_kind')
    if source=='integration_fixture':
        if not allow_fixture: raise HandoffError(22,'integration fixture handoff requires explicit allow flag')
    elif source=='retail_post_ekpfs':
        sec=manifest.get('security') or {}
        if not sec.get('ekpfs_validated'): raise HandoffError(22,'retail handoff requires independently validated EKPFS')
    else:
        raise HandoffError(22,f'unsupported source kind: {source!r}')
    sec=manifest.get('security') or {}
    if any(bool(sec.get(k)) for k in ('network_access','key_search_performed','bruteforce_performed')):
        raise HandoffError(22,'handoff security contract violation')
    art=manifest.get('artifact') or {}
    path=safe_artifact_path(artifact_root,str(art.get('relative_path') or ''))
    if not path.is_file(): raise HandoffError(24,'handoff artifact is missing')
    actual_size=path.stat().st_size
    if int(art.get('size',-1))!=actual_size: raise HandoffError(24,'handoff artifact size mismatch')
    actual_sha=sha256_file(path)
    if str(art.get('sha256') or '').lower()!=actual_sha: raise HandoffError(24,'handoff artifact SHA-256 mismatch')
    if art.get('module_parse_ok') is not True: raise HandoffError(24,'handoff artifact was not module-parse validated')
    return path,actual_sha

def run_runtime(exe:Path, artifact:Path, args:list[str], log:Path):
    cp=subprocess.run([str(exe),str(artifact),*args],capture_output=True,text=True,errors='replace',timeout=180)
    text=(cp.stdout or '')+(cp.stderr or '')
    log.parent.mkdir(parents=True,exist_ok=True); log.write_text(text,encoding='utf-8')
    return cp.returncode,text

def require(text:str, needles:list[str], label:str):
    missing=[x for x in needles if x not in text]
    if missing: raise HandoffError(26,f'{label} missing runtime markers: {missing}')

def command_emit(a):
    report=read_json(Path(a.pipeline_report))
    manifest=emit_manifest(report,Path(a.artifact_root),a.integration_fixture)
    write_json(Path(a.out),manifest)
    print(f"Handoff status: {manifest['status']}")
    print(f"Handoff source: {manifest['source_kind']}")
    if manifest.get('pending_reason'): print(f"Handoff pending reason: {manifest['pending_reason']}")
    if manifest.get('artifact'):
        print(f"Handoff artifact: {manifest['artifact']['relative_path']}")
        print(f"Handoff SHA256: {manifest['artifact']['sha256']}")
    print('V149_HANDOFF_MANIFEST_EMITTED')
    return 0

def command_run(a):
    manifest=read_json(Path(a.manifest)); root=Path(a.artifact_root)
    artifact,sha=validate_manifest(manifest,root,a.allow_integration_fixture)
    print('Handoff manifest validation: PASS')
    print(f'Artifact integrity: PASS sha256={sha}')
    if a.validate_only:
        print('V149_HANDOFF_VALIDATE_ONLY_OK'); return 0
    exe=Path(a.runtime_exe) if a.runtime_exe else None
    if not exe or not exe.is_file(): raise HandoffError(25,'DakarNative.exe is required and must exist')
    work=Path(a.work_dir); work.mkdir(parents=True,exist_ok=True)
    rc,text=run_runtime(exe,artifact,['--inspect-only'],work/'inspect.log')
    if rc!=0: raise HandoffError(26,f'inspect failed exit={rc}')
    require(text,['Non-executing PT_LOAD mapping: PASS','PASS: accessible PS5 ELF parse + dynamic inventory + non-executing mapping completed.'],'inspect')
    print('Inspect handoff: PASS')
    args=['--entry-preflight','--public-exact-host-bindings','--public-platform-bindings']
    rc,text=run_runtime(exe,artifact,args,work/'entry-preflight.log')
    if rc!=0: raise HandoffError(26,f'entry preflight failed exit={rc}')
    require(text,['Relocation issues: 0','Deferred IRELATIVE relocations: 0','Entry preflight executable entry: PASS','Entry preflight TLS FS-base gate: PASS','Entry preflight RELRO writable runs: 0','Entry preflight: PASS'],'entry-preflight')
    print('Entry preflight handoff: PASS')
    authorized=bool((manifest.get('runtime_gate') or {}).get('startup_authorized'))
    if authorized and a.allow_guarded_startup:
        args=['--guarded-startup','--public-exact-host-bindings','--public-platform-bindings']
        rc,text=run_runtime(exe,artifact,args,work/'guarded-startup.log')
        if rc!=0: raise HandoffError(26,f'guarded startup failed exit={rc}')
        require(text,['Guarded startup callback address integrity: PASS','Guarded startup lifecycle: PASS'],'guarded-startup')
        print('Guarded startup handoff: PASS')
    else:
        print(f"Guarded startup handoff: SKIPPED authorized={authorized} explicit_allow={bool(a.allow_guarded_startup)}")
    report={'schema':'ps5native.dakar-retail-handoff-run.v14.9','manifest':str(Path(a.manifest)),'artifact':str(artifact),'sha256':sha,'inspect_pass':True,'entry_preflight_pass':True,'guarded_startup_attempted':bool(authorized and a.allow_guarded_startup),'guarded_startup_pass':bool(authorized and a.allow_guarded_startup)}
    if a.report_out: write_json(Path(a.report_out),report)
    print('V149_RETAIL_HANDOFF_CONTRACT_OK')
    return 0

def main():
    ap=argparse.ArgumentParser()
    sp=ap.add_subparsers(dest='cmd',required=True)
    e=sp.add_parser('emit'); e.add_argument('--pipeline-report',required=True); e.add_argument('--artifact-root',required=True); e.add_argument('--out',required=True); e.add_argument('--integration-fixture',action='store_true')
    r=sp.add_parser('run'); r.add_argument('--manifest',required=True); r.add_argument('--artifact-root',required=True); r.add_argument('--runtime-exe'); r.add_argument('--work-dir',default='.'); r.add_argument('--report-out'); r.add_argument('--allow-integration-fixture',action='store_true'); r.add_argument('--allow-guarded-startup',action='store_true'); r.add_argument('--validate-only',action='store_true')
    a=ap.parse_args()
    try:
        return command_emit(a) if a.cmd=='emit' else command_run(a)
    except HandoffError as ex:
        print(f'HANDOFF_REJECT: {ex.reason}',file=sys.stderr)
        return ex.code
    except Exception as ex:
        print(f'HANDOFF_REJECT: unexpected error: {ex}',file=sys.stderr)
        return 29
if __name__=='__main__': raise SystemExit(main())
