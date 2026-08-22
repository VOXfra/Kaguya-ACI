#!/usr/bin/env python3
"""Build era-correct Basic Energy visuals for V1.1.7.

TCG expansions do not always number Basic Energy cards, so TCGdex cannot provide a
set-local card ID for every pack era. Poképédia documents the French Basic Energy
prints and their availability by series. We resolve only the original card image at
build time and package it locally; runtime never hotlinks the wiki.

The generator is deliberately small: eight energy types already supported by the
simulator, with distinct visual eras for SM 2017/2019, SWSH 2020/2022, the three SV
basic-energy print waves, and Mega Evolution.
"""
from __future__ import annotations
import json,re,time,urllib.parse,urllib.request
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];A=ROOT/'app'/'src'/'main'/'assets';OUT=A/'v117_energy_catalog.json';OUTJS=A/'v117_energy_catalog.js';DIR=A/'img'/'v117'/'energy'
UA='VOX-CardSim-Energy/1.1.7 (+https://github.com/VOXfra/Kaguya-ACI)';API='https://www.pokepedia.fr/api.php'
TYPES=[('Plante','Grass'),('Feu','Fire'),('Eau','Water'),('Électrique','Lightning'),('Psy','Psychic'),('Combat','Fighting'),('Obscurité','Darkness'),('Métal','Metal')]

def titles():
 out={}
 for fr,en in TYPES:
  out.setdefault('sm2017',[]).append((fr,en,f'Énergie {fr} de base (Série Soleil et Lune, 2017)'))
  out.setdefault('sm2019',[]).append((fr,en,f'Énergie {fr} de base (Série Soleil et Lune, 2019)'))
  out.setdefault('swsh2020',[]).append((fr,en,f'Énergie {fr} de base (Série Épée et Bouclier, 2020)'))
  out.setdefault('swsh2022',[]).append((fr,en,f'Énergie {fr} de base (Série Épée et Bouclier, 2022)'))
 idx={fr:i+1 for i,(fr,_) in enumerate(TYPES)}
 for key,offset in [('sv2023',0),('sv2024',8),('sv2025',16)]:
  for fr,en in TYPES:
   n=idx[fr]+offset;out.setdefault(key,[]).append((fr,en,f'Énergie {fr} de base (Écarlate et Violet Énergie de base {n:03d})'))
 for fr,en in TYPES:
  n=idx[fr];out.setdefault('mega',[]).append((fr,en,f'Énergie {fr} de base (Méga-Évolution Énergie de base {n:03d})'))
 return out

def json_get(url,tries=3):
 last=None
 for n in range(tries):
  try:
   req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'application/json'})
   with urllib.request.urlopen(req,timeout=35) as r:return json.loads(r.read().decode('utf-8'))
  except Exception as e:last=e;time.sleep(.5*(n+1))
 raise RuntimeError(last)
def bytes_get(url,tries=3):
 last=None
 for n in range(tries):
  try:
   req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'image/*,*/*'})
   with urllib.request.urlopen(req,timeout=45) as r:return r.read(),str(r.headers.get('Content-Type') or '')
  except Exception as e:last=e;time.sleep(.5*(n+1))
 raise RuntimeError(last)
def resolve(title):
 q=urllib.parse.urlencode({'action':'query','format':'json','formatversion':'2','redirects':'1','prop':'pageimages','piprop':'original','titles':title})
 d=json_get(API+'?'+q);pages=d.get('query',{}).get('pages',[])
 if not pages:return''
 return str(pages[0].get('original',{}).get('source') or '')
def ext(data,ct):
 if data.startswith(b'\x89PNG'):return'.png'
 if data.startswith(b'\xff\xd8'):return'.jpg'
 if data.startswith(b'RIFF') and data[8:12]==b'WEBP':return'.webp'
 c=ct.casefold();return'.png' if 'png' in c else '.webp' if 'webp' in c else '.jpg'

def one(era,i,fr,en,title):
 try:
  url=resolve(title)
  if not url:return era,i,None,f'page image absente: {title}'
  data,ct=bytes_get(url)
  if len(data)<10000:return era,i,None,f'image trop petite: {len(data)}'
  suffix=ext(data,ct);name=f'{era}-{i:02d}{suffix}';(DIR/name).write_bytes(data)
  return era,i,{'id':f'{era}-{i}','name':fr,'energyType':en,'image':f'img/v117/energy/{name}','sourcePage':f'https://www.pokepedia.fr/{urllib.parse.quote(title.replace(" ","_"),safe="()_,-")}'},''
 except Exception as e:return era,i,None,str(e)

def main():
 DIR.mkdir(parents=True,exist_ok=True)
 for f in DIR.glob('*'):
  if f.is_file():f.unlink()
 rows=titles();result={};errors=[];jobs=[]
 with ThreadPoolExecutor(max_workers=8,thread_name_prefix='energy') as pool:
  for era,items in rows.items():
   for i,(fr,en,title) in enumerate(items,1):jobs.append(pool.submit(one,era,i,fr,en,title))
  for f in as_completed(jobs):
   era,i,item,err=f.result()
   if item:result.setdefault(era,{})[i]=item
   else:errors.append((era,i,err))
 eras={k:[v[i] for i in sorted(v)] for k,v in result.items() if len(v)==8}
 payload={'schema':117,'eras':eras,'rules':{'sm2017':'Soleil et Lune 2017','sm2019':'Soleil et Lune 2019','swsh2020':'Épée et Bouclier 2020','swsh2022':'Épée et Bouclier 2022','sv2023':'Écarlate et Violet énergie 001–008','sv2024':'Écarlate et Violet énergie 009–016','sv2025':'Écarlate et Violet énergie 017–024','mega':'Méga-Évolution énergie 001–008'},'errors':[{'era':e,'slot':i,'error':m} for e,i,m in errors]}
 OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8');OUTJS.write_text("'use strict';\nwindow.V117_ENERGY_CATALOG="+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
 print('V1.1.7 energy eras:',{k:len(v) for k,v in eras.items()},'errors=',len(errors))
 # These two eras cover the exact modern packs reported by the user and must exist.
 for needed in ('swsh2022','sv2023'):
  if len(eras.get(needed,[]))!=8:raise RuntimeError(f'énergie {needed} incomplète')
 return 0
if __name__=='__main__':raise SystemExit(main())
