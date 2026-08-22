#!/usr/bin/env python3
"""V1.1.7 product normalization.

Runs after import_verified_sealed_products.py.
- one loose booster SKU per expansion (artwork variants are metadata, not products)
- only SealedDex *pack* artwork is kept; logos/header images are rejected
- probes larger SealedDex renditions and refuses landscape/cropped artwork
- models booster counts only when deterministically known from the product identity
- non-modelled decks/tins/collections remain legitimate sealed collectibles but are
  explicitly non-openable instead of pretending to contain zero boosters.
"""
from __future__ import annotations

import html
import json
import re
import struct
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

ROOT=Path(__file__).resolve().parents[1]
A=ROOT/'app'/'src'/'main'/'assets'
CAT=A/'v115_sealed_catalog.json'
OUT_JS=A/'v115_sealed_catalog.js'
IMG=A/'img'/'v115'/'products'
INDEX=A/'v111_collection_index.json'
UA='VOX-CardSim-V117/1.1.7 (+https://github.com/VOXfra/Kaguya-ACI)'
SEALDEX='https://sealeddex.com/'


def get(url:str,retries:int=4,timeout:int=45)->tuple[bytes,str]:
    last=None
    for n in range(retries):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'*/*'})
            with urllib.request.urlopen(req,timeout=timeout) as r:
                if 200<=r.status<300:return r.read(),str(r.headers.get('Content-Type') or '')
                raise RuntimeError(f'HTTP {r.status}')
        except Exception as e:
            last=e;time.sleep(min(5,.45*(2**n)))
    raise RuntimeError(f'{url}: {last}')


def safe(v:Any)->str:
    return re.sub(r'[^A-Za-z0-9._-]+','-',str(v or '')).strip('-._') or 'asset'


def ext(data:bytes,ctype:str)->str:
    if data.startswith(b'RIFF') and data[8:12]==b'WEBP':return '.webp'
    if data.startswith(b'\x89PNG\r\n\x1a\n'):return '.png'
    if data.startswith(b'\xff\xd8\xff'):return '.jpg'
    c=ctype.casefold()
    if 'webp' in c:return '.webp'
    if 'png' in c:return '.png'
    if 'jpeg' in c:return '.jpg'
    raise ValueError('format image inconnu')


def dims(data:bytes)->tuple[int,int]:
    try:
        if data.startswith(b'\x89PNG') and len(data)>=24:
            return struct.unpack('>II',data[16:24])
        if data.startswith(b'RIFF') and data[8:12]==b'WEBP':
            kind=data[12:16]
            if kind==b'VP8X' and len(data)>=30:
                w=1+int.from_bytes(data[24:27],'little');h=1+int.from_bytes(data[27:30],'little');return w,h
            if kind==b'VP8 ':
                p=data.find(b'\x9d\x01\x2a',20)
                if p>=0 and len(data)>=p+7:
                    w=int.from_bytes(data[p+3:p+5],'little')&0x3fff;h=int.from_bytes(data[p+5:p+7],'little')&0x3fff;return w,h
            if kind==b'VP8L' and len(data)>=25:
                b0,b1,b2,b3=data[21:25];w=1+(((b2&0x3f)<<8)|b1);h=1+((b3<<6)|(b2>>2));return w,h
        if data.startswith(b'\xff\xd8'):
            i=2
            while i+9<len(data):
                if data[i]!=0xff:i+=1;continue
                marker=data[i+1];i+=2
                if marker in (0xd8,0xd9):continue
                if i+2>len(data):break
                ln=int.from_bytes(data[i:i+2],'big')
                if marker in range(0xc0,0xc4) and i+7<len(data):
                    return int.from_bytes(data[i+5:i+7],'big'),int.from_bytes(data[i+3:i+5],'big')
                i+=max(2,ln)
    except Exception:pass
    return (0,0)


def pack_count(p:dict[str,Any])->int:
    name=str(p.get('sourceName') or p.get('name') or '')
    typ=str(p.get('type') or '')
    # Explicit counts are strongest.
    pats=[
      r'(?:contains?|includes?)\s+(\d{1,2})\s+(?:pokemon\s+tcg\s+)?booster\s+packs?',
      r'\b(\d{1,2})\s*[- ]?pack\s+blister\b',r'\b(\d{1,2})\s+pack\s+blister\b',
      r'\b(\d{1,2})\s+(?:pokemon\s+tcg\s+)?booster\s+packs?\b',
    ]
    for pat in pats:
        m=re.search(pat,name,re.I)
        if m:
            n=int(m.group(1))
            if 1<=n<=72:return n
    low=name.casefold()
    if typ=='booster_pack':return 1
    if typ=='booster_bundle':return 6
    if typ=='booster_box':return 36
    if typ=='blister':
        if 'single pack' in low or 'checklane' in low:return 1
        m=re.search(r'\b([123])\s*pack\b',low)
        if m:return int(m.group(1))
    if 'build & battle stadium' in low or 'build and battle stadium' in low:return 12
    if 'build & battle box' in low or 'build and battle box' in low:return 4
    return 0


def fetch_pack_art_by_slug()->dict[str,list[str]]:
    raw,_=get(SEALDEX);text=html.unescape(raw.decode('utf-8','replace'))
    pairs=re.findall(r'https://images\.sealeddex\.com/images/expansions/([^/\"\'?#]+)/([^\"\'?#<> ]+)',text)
    if not pairs:pairs=re.findall(r'(?:https://images\.sealeddex\.com)?/images/expansions/([^/\"\'?#]+)/([^\"\'?#<> ]+)',text)
    by:dict[str,dict[str,tuple[int,str]]]={}
    for slug,filename in pairs:
        # Critical V1.1.7 rule: set logos and page headers are not booster wrappers.
        if '-pack-' not in filename.casefold():continue
        if not re.search(r'\.(?:webp|png|jpe?g)$',filename,re.I):continue
        m=re.search(r'-(\d+)w(?=\.[^.]+$)',filename,re.I);width=int(m.group(1)) if m else 0
        stem=re.sub(r'-\d+w(?=\.[^.]+$)','',filename,flags=re.I)
        url=f'https://images.sealeddex.com/images/expansions/{slug}/{filename}'
        old=by.setdefault(slug,{}).get(stem)
        if old is None or width>old[0]:by[slug][stem]=(width,url)
    return {slug:[u for _,u in sorted(rows.values(),key=lambda x:x[1])] for slug,rows in by.items()}


def candidate_urls(url:str)->list[str]:
    out=[]
    m=re.search(r'-(\d+)w(?=\.[^.]+$)',url,re.I)
    if m:
        for w in (1024,768,640,512,384,320,256):out.append(url[:m.start(1)]+str(w)+url[m.end(1):])
    out.append(url)
    return list(dict.fromkeys(out))


def download_art(set_id:str,idx:int,url:str)->str:
    for candidate in candidate_urls(url):
        try:
            data,ctype=get(candidate,retries=2,timeout=25);w,h=dims(data)
            # A real booster wrapper is portrait and must not be a tiny thumbnail.
            if w and h:
                ratio=w/h
                if ratio<.40 or ratio>.78:continue
                if w<240 or h<380:continue
            elif len(data)<18000:continue
            suffix=ext(data,ctype);name=f'v117-booster-{safe(set_id)}-{idx}{suffix}'
            (IMG/name).write_bytes(data);return f'img/v115/products/{name}'
        except Exception:continue
    return ''


def main()->int:
    cat=json.loads(CAT.read_text(encoding='utf-8'));idx=json.loads(INDEX.read_text(encoding='utf-8'))
    names={str(x['id']):str(x.get('name') or x['id']) for x in idx.get('sets') or []}
    rows_by_set=cat.get('sets') or {}
    pack_urls=fetch_pack_art_by_slug()
    # Recover the slug already verified by the V1.1.5 mapping.
    slug_by_set={}
    for sid,rows in rows_by_set.items():
        for p in rows or []:
            if p.get('source')=='SealedDex':
                m=re.search(r'/sets/([^/?#]+)',str(p.get('sourceUrl') or ''))
                if m:slug_by_set[sid]=m.group(1);break

    IMG.mkdir(parents=True,exist_ok=True)
    for old in IMG.glob('v117-booster-*'):
        if old.is_file():old.unlink()

    artwork_jobs=[];artworks:dict[str,list[str]]={}
    with ThreadPoolExecutor(max_workers=12,thread_name_prefix='v117-art') as pool:
        for sid,slug in slug_by_set.items():
            for i,url in enumerate(pack_urls.get(slug,[]),1):artwork_jobs.append((sid,i,pool.submit(download_art,sid,i,url)))
        for sid,i,f in artwork_jobs:
            local=f.result()
            if local:artworks.setdefault(sid,[]).append(local)

    new_sets:dict[str,list[dict[str,Any]]]={};openable=collectible=0
    for sid,rows in rows_by_set.items():
        clean=[]
        # Keep non-loose physical products and enrich deterministic contents.
        for raw in rows or []:
            if str(raw.get('mode'))=='loose':continue
            p=dict(raw);n=pack_count(p);p['opens']=n;p['verifiedContents']=bool(n);p['v117Openable']=bool(n)
            p['v117CollectibleOnly']=not bool(n)
            if n:openable+=1
            else:collectible+=1
            clean.append(p)
        arts=artworks.get(sid,[])
        # Exactly one loose booster product per set. Art is selected at opening time.
        if arts:
            clean.insert(0,{
              'id':f'v117-booster-{safe(sid)}','setId':sid,'name':f'Booster {names.get(sid,sid)}',
              'sourceName':f'{names.get(sid,sid)} booster pack','kind':'BOOSTER','type':'booster_pack',
              'mode':'loose','qty':1,'opens':1,'image':arts[0],'artworks':arts,
              'source':'SealedDex','sourceUrl':f'https://sealeddex.com/sets/{slug_by_set.get(sid,"")}',
              'verifiedContents':True,'v117Openable':True,'v117CanonicalBooster':True,
            })
        else:
            # Fallback to one pre-existing real booster image if SealedDex did not
            # expose a pack artwork for this set; never keep illustration SKUs.
            old_loose=next((dict(p) for p in (rows or []) if str(p.get('mode'))=='loose' and p.get('image')),None)
            if old_loose:
                old_loose.update({'id':f'v117-booster-{safe(sid)}','name':f'Booster {names.get(sid,sid)}','qty':1,'opens':1,'verifiedContents':True,'v117Openable':True,'v117CanonicalBooster':True,'artworks':[old_loose.get('image')]})
                clean.insert(0,old_loose)
        if clean:new_sets[sid]=clean

    # Delete V1.1.5 SealedDex thumbnails/logos no longer referenced.
    referenced={str(p.get('image')) for rows in new_sets.values() for p in rows if p.get('image')}
    referenced|={a for rows in new_sets.values() for p in rows for a in (p.get('artworks') or [])}
    for old in IMG.glob('sealeddex-*'):
        rel=f'img/v115/products/{old.name}'
        if rel not in referenced:
            try:old.unlink()
            except OSError:pass

    products=[p for rows in new_sets.values() for p in rows]
    cat['schema']=117;cat['sources']=list(dict.fromkeys((cat.get('sources') or [])+['V1.1.7 normalized booster artwork/content model']))
    cat['sets']=new_sets
    cat['stats']={**(cat.get('stats') or {}),'products':len(products),'setsWithVerifiedProducts':len(new_sets),'canonicalBoosterSets':sum(1 for rows in new_sets.values() if any(p.get('v117CanonicalBooster') for p in rows)),'highQualityArtworkFiles':sum(len(p.get('artworks') or []) for p in products),'openableSealedProducts':openable,'collectibleOnlyProducts':collectible}
    CAT.write_text(json.dumps(cat,ensure_ascii=False,indent=2),encoding='utf-8')
    OUT_JS.write_text("'use strict';\nwindow.V115_SEALED_CATALOG="+json.dumps(cat,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    print('V1.1.7 products:',cat['stats'])
    if cat['stats']['canonicalBoosterSets']<85:raise RuntimeError('couverture boosters canoniques trop faible')
    # Regression contracts: no shop product called illustration N and no landscape
    # SealedDex header image can survive normalization.
    if any(re.search(r'illustration\s+\d+',str(p.get('name') or ''),re.I) for p in products):raise RuntimeError('SKU illustration encore présent')
    return 0

if __name__=='__main__':raise SystemExit(main())
