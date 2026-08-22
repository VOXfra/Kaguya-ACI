#!/usr/bin/env python3
"""Classify verified portfolio/binder products as usable storage accessories."""
from __future__ import annotations
import json,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
A=ROOT/'app'/'src'/'main'/'assets'
P=A/'v115_sealed_catalog.json';J=A/'v115_sealed_catalog.js'
BINDER=re.compile(r'portfolio|binder|album|9[- ]pocket|4[- ]pocket|card binder|collection binder',re.I)


def main()->int:
 d=json.loads(P.read_text(encoding='utf-8'));n=0
 for rows in (d.get('sets') or {}).values():
  for p in rows or []:
   text=f"{p.get('sourceName','')} {p.get('name','')}"
   if p.get('mode')!='loose' and BINDER.search(text):
    p['contentKind']='binder';p['openable']=False;p['verifiedContents']=True;p['opens']=0;p['v117UsableBinder']=True;n+=1
 d.setdefault('stats',{})['usableBinderProducts']=n
 P.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
 J.write_text('window.V115_SEALED_CATALOG='+json.dumps(d,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
 print(f'V1.1.7 usable binder products: {n}')
 if n<5:raise RuntimeError(f'trop peu de produits classeur identifiés: {n}')
 return 0

if __name__=='__main__':raise SystemExit(main())
