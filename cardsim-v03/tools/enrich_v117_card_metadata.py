#!/usr/bin/env python3
"""V1.1.7 metadata repair for historical booster pools.

TCGdex is kept as the authority for French card identity/scans. pokemon-tcg-data is
used only as a second structured source for rarity labels where it has the same
canonical set/card ID. This restores distinctions such as Rare Holo in Base/Jungle/
Fossil without changing the French card itself.
"""
from __future__ import annotations
import hashlib,json,re,time,urllib.error,urllib.request
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
from typing import Any

ROOT=Path(__file__).resolve().parents[1]
A=ROOT/'app'/'src'/'main'/'assets';INDEX=A/'v111_collection_index.json';CAT=A/'catalog'/'fr'
BASE='https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en/{sid}.json'
UA='VOX-CardSim-V117-Metadata/1.1.7'

def get(sid:str):
    url=BASE.format(sid=sid);last=None
    for n in range(3):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'application/json'})
            with urllib.request.urlopen(req,timeout=35) as r:return json.loads(r.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            if e.code==404:return None
            last=e
        except Exception as e:last=e
        time.sleep(.4*(n+1))
    print(f'  metadata externe indisponible {sid}: {last}');return None

def norm(v:Any)->str:return ' '.join(str(v or '').casefold().replace('é','e').split())
def rarity_key(raw:Any)->str:
    r=norm(raw)
    if r in ('common','commune'):return 'common'
    if r in ('uncommon','peu commune'):return 'uncommon'
    if 'mega hyper' in r:return 'mhr'
    if 'special illustration' in r or 'illustration speciale' in r or 'black white' in r:return 'sir'
    if 'hyper' in r or 'gold' in r or 'secret rare' in r:return 'hr'
    if 'shiny ultra' in r:return 'ur'
    if 'ultra' in r or 'rainbow' in r:return 'ur'
    if 'illustration' in r or 'shiny' in r or 'radiant' in r or 'amazing' in r:return 'ir'
    if 'double' in r or 'vmax' in r or 'vstar' in r or r.endswith(' ex') or r.endswith(' gx'):return 'double'
    return 'rare'
def supply(raw:Any)->str:
    r=norm(raw)
    if r in ('common','commune'):return 'common'
    if r in ('uncommon','peu commune'):return 'uncommon'
    if 'mega hyper' in r:return 'mhr'
    if 'special illustration' in r:return 'sir'
    if 'secret' in r or 'hyper' in r or 'gold' in r:return 'hr'
    if 'ultra' in r:return 'ur'
    if 'illustration' in r or 'radiant' in r or 'amazing' in r:return 'ir'
    if 'double' in r or 'vmax' in r or 'vstar' in r or r.endswith(' ex') or r.endswith(' gx'):return 'double'
    return 'rare'

def specificity(r:str)->int:
    n=norm(r)
    if n in ('','common','uncommon','rare'):return 0
    return 2 if any(x in n for x in ('holo','star','prime','legend','shining','ex','gx','vmax','vstar','ultra','secret','radiant','amazing','illustration','double','prism','ace spec')) else 1

def main()->int:
    idx=json.loads(INDEX.read_text(encoding='utf-8'));sets=idx.get('sets') or []
    external={}
    # Fetch all canonical IDs concurrently. Missing files are normal for regional sets.
    with ThreadPoolExecutor(max_workers=18,thread_name_prefix='rarity') as pool:
        fut={pool.submit(get,str(e['id'])):str(e['id']) for e in sets}
        for f in as_completed(fut):
            sid=fut[f];rows=f.result()
            if isinstance(rows,list):external[sid]=rows
    changed=matched=0;base_holo={}
    for entry in sets:
        sid=str(entry['id']);path=CAT/str(entry['file'])
        payload=json.loads(path.read_text(encoding='utf-8'));ext=external.get(sid) or []
        by_id={str(c.get('id') or ''):c for c in ext if isinstance(c,dict)}
        counts={}
        for c in payload.get('cards') or []:
            x=by_id.get(str(c.get('id') or ''))
            if not x:continue
            matched+=1;rich=str(x.get('rarity') or '').strip();old=str(c.get('rarityRaw') or '').strip()
            if rich and (specificity(rich)>specificity(old) or norm(old)=='rare'):
                c['rarityRaw']=rich;c['rarityKey']=rarity_key(rich);c['supplyTier']=supply(rich);c['v117RaritySource']='pokemon-tcg-data';changed+=1
            rk=str(c.get('rarityKey') or 'unknown');counts[rk]=counts.get(rk,0)+1
        # The index is UI/diagnostics only; keep its rarity summary in sync.
        entry['rarities']=counts
        compact=json.dumps(payload,ensure_ascii=False,separators=(',',':'))
        path.write_text(compact,encoding='utf-8')
        entry['contentHash']=hashlib.sha256(compact.encode('utf-8')).hexdigest()
        if sid in ('base1','base2','base3'):
            holo=sum(1 for c in payload.get('cards') or [] if 'holo' in norm(c.get('rarityRaw')))
            base_holo[sid]=holo
    idx['source']=str(idx.get('source') or '')+' + pokemon-tcg-data rarity metadata'
    idx.setdefault('stats',{})['v117RarityMatches']=matched;idx['stats']['v117RarityUpgrades']=changed
    compact=json.dumps(idx,ensure_ascii=False,separators=(',',':'))
    INDEX.write_text(compact,encoding='utf-8');(A/'v111_collection_index.js').write_text("'use strict';\nwindow.V111_COLLECTION_INDEX="+compact+';\n',encoding='utf-8')
    (A/'v111_import_report.json').write_text(json.dumps(idx,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'V1.1.7 rarity enrichment: {matched} matched / {changed} upgraded / vintage holo {base_holo}')
    # Critical regression: these three sets physically contain holo rares. If the
    # second source stops restoring them, do not ship another fake WOTC collation.
    for sid in ('base1','base2','base3'):
        if base_holo.get(sid,0)<=0:raise RuntimeError(f'{sid}: aucune Rare Holo après enrichissement')
    return 0
if __name__=='__main__':raise SystemExit(main())
