#!/usr/bin/env python3
"""Bundle Basic Energy artwork by booster era and generate the runtime catalog.

The original app reused SVE artwork everywhere. This release keeps local, dated
prints and splits Scarlet & Violet at the documented 001-008 / 009-016 /
017-024 refreshes. PkmnCards is used for SVE because the old PokemonTCG.io SVE
image endpoint currently returns 404 for these files.
"""
from __future__ import annotations
import json
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
A=ROOT/'app'/'src'/'main'/'assets'
OUT=A/'img'/'v117'/'energy'
CATALOG=A/'v117_energy_catalog.js'
UA='VOX-CardSim-Energy/1.2.0'
TYPES=[('Plante','grass_energy'),('Feu','fire_energy'),('Eau','water_energy'),('Électrique','lightning_energy'),('Psy','psychic_energy'),('Combat','fighting_energy'),('Obscurité','darkness_energy'),('Métal','metal_energy')]


def get(url:str)->bytes:
 req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'image/*'})
 with urllib.request.urlopen(req,timeout=45) as r:data=r.read()
 if len(data)<12000:raise RuntimeError(f'image trop petite: {len(data)}')
 return data


def save_first(path:Path,urls:list[str])->None:
 last=None
 for url in urls:
  try:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(get(url));return
  except Exception as exc:last=exc
 raise RuntimeError(f'{path.name}: {last}')


def erow(folder:str,i:int,name:str,ext:str)->dict:
 return {'id':f'{folder}-{i}','name':name,'image':f'img/v117/energy/{folder}/{i}.{ext}'}


def main()->int:
 if OUT.exists():
  for p in OUT.rglob('*'):
   if p.is_file():p.unlink()
 eras={k:[] for k in ['sm2017','sm2019','swsh2020','swsh2022','sv2023','sv2024','sv2025','mega']}

 # Sun & Moon launch print. Team Up is kept in the same SM family rather than
 # ever falling through to a newer Sword/Shield or Scarlet/Violet card.
 for i,(fr,slug) in enumerate(TYPES,1):
  save_first(OUT/'sm'/f'{i}.jpg',[
   f'https://pkmncards.com/wp-content/uploads/en_US-SM_Energy-{i:03d}-{slug}-1.jpg',
   f'https://pkmncards.com/wp-content/uploads/en_US-SM_Energy-{i:03d}-{slug}.jpg'])
  eras['sm2017'].append(erow('sm',i,fr,'jpg'));eras['sm2019'].append(erow('sm',i,fr,'jpg'))
 # Fairy was a valid random Basic Energy in Sun & Moon.
 save_first(OUT/'sm'/'9.jpg',[
  'https://pkmncards.com/wp-content/uploads/en_US-SM_Energy-009-fairy_energy-1.jpg',
  'https://pkmncards.com/wp-content/uploads/en_US-SM_Energy-009-fairy_energy.jpg'])
 fairy=erow('sm',9,'Fée','jpg');eras['sm2017'].append(fairy);eras['sm2019'].append(fairy)

 for i,(fr,slug) in enumerate(TYPES,1):
  save_first(OUT/'swsh_2020'/f'{i}.jpg',[f'https://pkmncards.com/wp-content/uploads/en_US-SWSH_Energy-{i:03d}-{slug}.jpg'])
  eras['swsh2020'].append(erow('swsh_2020',i,fr,'jpg'))
  save_first(OUT/'swsh_2022'/f'{i}.png',[f'https://pkmncards.com/wp-content/uploads/en_US-SWSH_Energy-{i+9:03d}-{slug}.png'])
  eras['swsh2022'].append(erow('swsh_2022',i,fr,'png'))

  # SVE has three documented Basic Energy print waves: 001-008, 009-016,
  # 017-024. These exact scans are bundled locally so a booster never receives
  # a generic energy card from the wrong era.
  for key,folder,n in [('sv2023','sv_2023',i),('sv2024','sv_2024',i+8),('sv2025','sv_2025',i+16)]:
   save_first(OUT/folder/f'{i}.png',[
    f'https://pkmncards.com/wp-content/uploads/sve_en_{n:03d}.png',
    f'https://images.pokemontcg.io/sve/{n}_hires.png',
    f'https://images.pokemontcg.io/sve/{n}.png'])
   eras[key].append(erow(folder,i,fr,'png'))

  save_first(OUT/'me'/f'{i}.png',[f'https://pkmncards.com/wp-content/uploads/mee_en_{i:03d}_std.png',f'https://images.pokemontcg.io/mee/{i}_hires.png'])
  eras['mega'].append(erow('me',i,fr,'png'))

 files=[p for p in OUT.rglob('*') if p.is_file()]
 if len(files)!=57:raise RuntimeError(f'énergies V1.2.0 incomplètes: {len(files)}/57')
 if any(p.stat().st_size<12000 for p in files):raise RuntimeError('énergie locale anormalement petite')
 payload={'schema':117,'eras':eras,'stats':{'files':len(files),'eraProfiles':len(eras)}}
 CATALOG.write_text("'use strict';\nwindow.V117_ENERGY_CATALOG="+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
 print(f'V1.2.0 energy assets: {len(files)} · {len(eras)} profils')
 return 0

if __name__=='__main__':raise SystemExit(main())
