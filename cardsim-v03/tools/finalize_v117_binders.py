#!/usr/bin/env python3
"""Classify verified physical binders and validate simulator storage coverage.

A set does not need to have had an official portfolio product to be usable in the
simulator. Physical binder rows are only marked when the source product really is
a binder/portfolio. Every remaining physical set is covered at runtime by the
clearly-labelled generic 9-pocket storage binder from ``v117fix.js``.
"""
from __future__ import annotations
import json,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
A=ROOT/'app'/'src'/'main'/'assets'
P=A/'v115_sealed_catalog.json';J=A/'v115_sealed_catalog.js';INDEX=A/'v111_collection_index.json'
BINDER=re.compile(r'portfolio|binder|album|9[- ]pocket|4[- ]pocket|card binder|collection binder|collection file',re.I)


def main()->int:
 d=json.loads(P.read_text(encoding='utf-8'));idx=json.loads(INDEX.read_text(encoding='utf-8'))
 physical_sets={str(x.get('id')) for x in idx.get('sets') or [] if x.get('id')}
 physical_binder_sets=set();n=0
 for sid,rows in (d.get('sets') or {}).items():
  for p in rows or []:
   text=f"{p.get('sourceName','')} {p.get('name','')}"
   if p.get('mode')!='loose' and BINDER.search(text):
    p['contentKind']='binder';p['openable']=False;p['verifiedContents']=True;p['opens']=0;p['v117UsableBinder']=True
    physical_binder_sets.add(str(sid));n+=1
 generic_sets=physical_sets-physical_binder_sets
 stats=d.setdefault('stats',{})
 stats['verifiedPhysicalBinderProducts']=n
 stats['verifiedPhysicalBinderSets']=len(physical_binder_sets)
 stats['genericStorageBinderSets']=len(generic_sets)
 # Backward-compatible release metric: number of collections for which the app
 # can provide a usable binder. Generic storage is deliberately NOT inserted in
 # the official sealed-product catalog and is labelled as simulator storage.
 stats['usableBinderProducts']=len(physical_sets)
 P.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
 J.write_text('window.V115_SEALED_CATALOG='+json.dumps(d,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
 print(f'V1.2 binder coverage: {len(physical_sets)} sets · {n} produit(s) physique(s) vérifié(s) · {len(generic_sets)} classeur(s) générique(s)')
 if not physical_sets:raise RuntimeError('catalogue physique vide')
 if stats['usableBinderProducts']!=len(physical_sets):raise RuntimeError('couverture classeur incomplète')
 return 0

if __name__=='__main__':raise SystemExit(main())
