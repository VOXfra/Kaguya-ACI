#!/usr/bin/env python3
"""Upgrade canonical booster wrapper art for V1.1.7.

The SealedDex landing page embeds 128px thumbnails. The source filenames are stable
and larger/original renditions are often available at the same path. Probe the
original and common responsive sizes, keep only portrait pack files, and replace
low-resolution thumbnails in the APK when a materially better rendition exists.
"""
from __future__ import annotations
import html,json,re,struct,time,urllib.request
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
from typing import Any
ROOT=Path(__file__).resolve().parents[1];A=ROOT/'app'/'src'/'main'/'assets';CAT=A/'v115_sealed_catalog.json';JS=A/'v115_sealed_catalog.js';IMG=A/'img'/'v115'/'products'
UA='VOX-CardSim-V117-Art/1.1.7';HOME='https://sealeddex.com/'

def get(url:str,tries:int=2,timeout:int=24):
 last=None
 for n in range(tries):
  try:
   req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'image/avif,image/webp,image/png,image/jpeg,*/*'})
   with urllib.request.urlopen(req,timeout=timeout) as r:return r.read(),str(r.headers.get('Content-Type') or '')
  except Exception as e:last=e;time.sleep(.25*(n+1))
 raise RuntimeError(last)

def ext(data:bytes,ct:str):
 if data.startswith(b'RIFF') and data[8:12]==b'WEBP':return'.webp'
 if data.startswith(b'\x89PNG'):return'.png'
 if data.startswith(b'\xff\xd8'):return'.jpg'
 c=ct.casefold();return'.webp' if 'webp' in c else '.png' if 'png' in c else '.jpg'

def dims(data:bytes):
 try:
  if data.startswith(b'\x89PNG') and len(data)>=24:return struct.unpack('>II',data[16:24])
  if data.startswith(b'RIFF') and data[8:12]==b'WEBP':
   kind=data[12:16]
   if kind==b'VP8X':return 1+int.from_bytes(data[24:27],'little'),1+int.from_bytes(data[27:30],'little')
   if kind==b'VP8L' and len(data)>=25:
    bits=int.from_bytes(data[21:25],'little');return (bits&0x3fff)+1,((bits>>14)&0x3fff)+1
   p=data.find(b'\x9d\x01\x2a',20,100)
   if p>=0:return int.from_bytes(data[p+3:p+5],'little')&0x3fff,int.from_bytes(data[p+5:p+7],'little')&0x3fff
  if data.startswith(b'\xff\xd8'):
   i=2
   while i+9<len(data):
    if data[i]!=0xff:i+=1;continue
    marker=data[i+1];i+=2
    if marker in (0xd8,0xd9):continue
    ln=int.from_bytes(data[i:i+2],'big')
    if marker in range(0xc0,0xc4):return int.from_bytes(data[i+5:i+7],'big'),int.from_bytes(data[i+3:i+5],'big')
    i+=max(2,ln)
 except Exception:pass
 return(0,0)

def candidates(url:str):
 m=re.search(r'-\d+w(?=\.[^.]+$)',url,re.I);out=[]
 if m:
  # Original asset first, then responsive renditions from highest to lowest.
  out.append(url[:m.start()]+url[m.end():])
  for w in (1600,1200,1024,800,768,640,512,480,384,320,256):out.append(url[:m.start()]+f'-{w}w'+url[m.end():])
 out.append(url);return list(dict.fromkeys(out))

def main():
 payload=json.loads(CAT.read_text(encoding='utf-8'));raw,_=get(HOME,3,50);text=html.unescape(raw.decode('utf-8','replace'))
 pairs=re.findall(r'https://images\.sealeddex\.com/images/expansions/([^/\"\'?#]+)/([^\"\'?#<> ]+)',text)
 if not pairs:pairs=re.findall(r'(?:https://images\.sealeddex\.com)?/images/expansions/([^/\"\'?#]+)/([^\"\'?#<> ]+)',text)
 by={}
 for slug,fn in pairs:
  if '-pack-' not in fn.casefold() or not re.search(r'\.(webp|png|jpe?g)$',fn,re.I):continue
  stem=re.sub(r'-\d+w(?=\.[^.]+$)','',fn,flags=re.I);u=f'https://images.sealeddex.com/images/expansions/{slug}/{fn}'
  by.setdefault(slug,{})[stem]=u
 slug_by={}
 for sid,rows in (payload.get('sets') or {}).items():
  for p in rows:
   if p.get('v117CanonicalBooster'):
    m=re.search(r'/sets/([^/?#]+)',str(p.get('sourceUrl') or ''))
    if m:slug_by[sid]=m.group(1)
    break
 for old in IMG.glob('v117-hq-*'):
  if old.is_file():old.unlink()
 def one(sid,i,u):
  best=None
  for candidate in candidates(u):
   try:
    data,ct=get(candidate);w,h=dims(data)
    if not w or not h:continue
    if h<w*1.20 or w<240 or h<380:continue
    if best is None or w*h>best[0]*best[1]:best=(w,h,data,ct,candidate)
    if w>=640:break
   except Exception:continue
  if not best:return sid,i,'',0,0,''
  w,h,data,ct,src=best;name=f'v117-hq-{re.sub(r"[^A-Za-z0-9._-]+","-",sid)}-{i}{ext(data,ct)}';(IMG/name).write_bytes(data)
  return sid,i,f'img/v115/products/{name}',w,h,src
 jobs=[];results={}
 with ThreadPoolExecutor(max_workers=12,thread_name_prefix='hq-pack') as pool:
  for sid,slug in slug_by.items():
   for i,u in enumerate(sorted((by.get(slug) or {}).values()),1):jobs.append(pool.submit(one,sid,i,u))
  for f in as_completed(jobs):
   sid,i,path,w,h,src=f.result()
   if path:results.setdefault(sid,[]).append((i,path,w,h,src))
 hq=sets=0
 for sid,rows in (payload.get('sets') or {}).items():
  p=next((x for x in rows if x.get('v117CanonicalBooster')),None)
  if not p:continue
  rr=sorted(results.get(sid,[]));
  if rr:
   p['artworks']=[x[1] for x in rr];p['image']=rr[0][1];p['v117ArtworkDimensions']=[[x[2],x[3]] for x in rr];p['v117ArtworkSources']=[x[4] for x in rr];p['v117HighQualityArtwork']=True;hq+=len(rr);sets+=1
  else:p['v117HighQualityArtwork']=False
 payload.setdefault('stats',{})['hqBoosterArtworkSets']=sets;payload['stats']['hqBoosterArtworks']=hq
 CAT.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8');JS.write_text("window.V115_SEALED_CATALOG="+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
 # Remove old tiny SealedDex thumbnails that are no longer referenced.
 refs={str(p.get('image')) for rows in payload.get('sets',{}).values() for p in rows}|{str(a) for rows in payload.get('sets',{}).values() for p in rows for a in (p.get('artworks') or [])}
 for f in IMG.glob('sealeddex-*'):
  if f'img/v115/products/{f.name}' not in refs:
   try:f.unlink()
   except OSError:pass
 print(f'V1.1.7 HQ booster art: {sets} sets / {hq} wrappers')
 # At minimum prove the specific regression reported by the Android screenshot is fixed.
 sw=next((p for p in payload.get('sets',{}).get('swsh10',[]) if p.get('v117CanonicalBooster')),None)
 if sw and sw.get('artworks'):
  for path in sw['artworks']:
   data=(A/path).read_bytes();w,h=dims(data)
   if h<w*1.2:raise RuntimeError(f'Astres Radieux non-portrait: {path} {w}x{h}')
 return 0
if __name__=='__main__':raise SystemExit(main())
