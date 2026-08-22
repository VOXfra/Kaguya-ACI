#!/usr/bin/env python3
"""Bundle Basic Energy artwork for the eras that have a dedicated energy slot.

Sun & Moon booster energy can include Fairy Energy, so its pool has 9 types.
Sword & Shield booster packs use the eight surviving booster-energy types; the
Fairy print exists as an accessory/ETB print but is not put in the random booster
energy slot. Scarlet & Violet and Mega Evolution also use eight types.
"""
from __future__ import annotations
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'app'/'src'/'main'/'assets'/'img'/'v117'/'energy'
UA='VOX-CardSim-Energy/1.1.7'
BASE_TYPES=['grass_energy','fire_energy','water_energy','lightning_energy','psychic_energy','fighting_energy','darkness_energy','metal_energy']


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


def main()->int:
 if OUT.exists():
  for p in OUT.rglob('*'):
   if p.is_file():p.unlink()
 # Sun & Moon: 8 types actuels + Fairy Energy en neuvième position.
 for i,slug in enumerate(BASE_TYPES+['fairy_energy'],1):
  save_first(OUT/'sm'/f'{i}.jpg',[
   f'https://pkmncards.com/wp-content/uploads/en_US-SM_Energy-{i:03d}-{slug}-1.jpg',
   f'https://pkmncards.com/wp-content/uploads/en_US-SM_Energy-{i:03d}-{slug}.jpg'])
 # Sword & Shield 2020: Fairy a bien eu une impression, mais pas dans le slot
 # énergie des boosters ; on garde donc les huit types tirables.
 for i,slug in enumerate(BASE_TYPES,1):
  save_first(OUT/'swsh_2020'/f'{i}.jpg',[f'https://pkmncards.com/wp-content/uploads/en_US-SWSH_Energy-{i:03d}-{slug}.jpg'])
  save_first(OUT/'swsh_2022'/f'{i}.png',[f'https://pkmncards.com/wp-content/uploads/en_US-SWSH_Energy-{i+9:03d}-{slug}.png'])
  save_first(OUT/'sv'/f'{i}.png',[f'https://images.pokemontcg.io/sve/{i}_hires.png',f'https://images.pokemontcg.io/sve/{i}.png'])
  save_first(OUT/'me'/f'{i}.png',[f'https://pkmncards.com/wp-content/uploads/mee_en_{i:03d}_std.png',f'https://images.pokemontcg.io/mee/{i}_hires.png'])
 files=[p for p in OUT.rglob('*') if p.is_file()]
 if len(files)!=41:raise RuntimeError(f'énergies V1.1.7 incomplètes: {len(files)}/41')
 print(f'V1.1.7 energy assets: {len(files)}')
 return 0

if __name__=='__main__':raise SystemExit(main())
