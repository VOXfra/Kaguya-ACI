#!/usr/bin/env python3
"""Génère les profils de collation physiques VOX Card Sim V1.1.6.

La V1.1.5 savait importer les cartes et les produits, mais la majorité des sets
retombait encore sur un booster moderne générique. Ce générateur sépare désormais :
- la structure physique du booster et l'ordre des slots ;
- les pools de raretés imprimés ;
- les probabilités empiriques de remplacement des slots.

Une structure documentée peut être ``official``/``measured`` tandis qu'un taux de
hit reste ``empirical``/``era-empirical``. Quand seul le nombre de cartes est
fiable (POP), le profil reste ``structure-only`` : le runtime bloque l'ouverture
plutôt que d'inventer un taux de rare.
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
A = ROOT / "app" / "src" / "main" / "assets"
INDEX = A / "v111_collection_index.json"
SEALED = A / "v115_sealed_catalog.json"
OUT = A / "v116_collation_profiles.json"
OUT_JS = A / "v116_collation_profiles.js"

SOURCES = {
    "bulba": {"title": "Bulbapedia — Booster pack (TCG)", "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"},
    "expedition": {"title": "Bulbapedia — Expedition Base Set", "url": "https://bulbapedia.bulbagarden.net/wiki/Expedition_Base_Set_(TCG)"},
    "efour_ex": {"title": "Elite Fourum — EX Series pack make-up and pull rates", "url": "https://www.elitefourum.com/t/is-there-a-list-resource-for-booster-pack-make-up-over-the-years/36496"},
    "pricedex_bw": {"title": "ThePriceDex — Black & White pull rates", "url": "https://www.thepricedex.com/set/bw1/black-white/pull-rates"},
    "pricedex_xy": {"title": "ThePriceDex — XY pull rates", "url": "https://www.thepricedex.com/set/xy1/xy/pull-rates"},
    "packrip": {"title": "PackRip — empirical SM/SWSH pack data", "url": "https://github.com/zsd7200/packrip"},
    "pokemon_sv": {"title": "Pokémon Support — Scarlet & Violet booster composition", "url": "https://support.pokemon.com/hc/en-us/articles/360000981613-What-can-I-expect-in-a-Pok%C3%A9mon-Trading-Card-Game-booster-pack"},
    "pricedex_me": {"title": "ThePriceDex — Mega Evolution pull rates", "url": "https://www.thepricedex.com/set/me1/mega-evolution/pull-rates"},
    "specials": {"title": "Bulbapedia — special booster set articles", "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"},
}


def src(*keys):
    return [SOURCES[k] for k in keys]


# Taux SM/SWSH : données empiriques de PackRip, lui-même sourcé vers de grands
# échantillons communautaires. Ils ne sont jamais étiquetés comme officiels.
SM_RATES = {
    "sm1": dict(secret=.0081, rainbow=.0147, ultra=.0422, gx=.1115, holo=.1676),
    "sm2": dict(secret=.0081, rainbow=.0129, ultra=.0359, gx=.1111, holo=.1676),
    "sm3": dict(secret=.0095, rainbow=.0159, ultra=.0393, gx=.1095, holo=.1676),
    "sm3.5": dict(secret=.0091, rainbow=.0150, ultra=.0397, gx=.1185, shining=.0872, holo=1.0),
    "sm4": dict(secret=.0111, rainbow=.0111, ultra=.0444, gx=.0830, holo=.1676),
    "sm5": dict(secret=.0071, rainbow=.0134, ultra=.0356, gx=.0744, prism=.0791, holo=.1676),
    "sm6": dict(secret=.0071, rainbow=.0134, ultra=.0356, gx=.0744, prism=.0791, holo=.1676),
    "sm7": dict(secret=.0088, rainbow=.0122, ultra=.0378, gx=.1034, prism=.0547, holo=.1676),
    "sm7.5": dict(secret=.0077, rainbow=.0231, ultra=.0694, gx=.1542, prism=.1080, holo=1.0),
    "sm8": dict(secret=.0102, rainbow=.0133, ultra=.0440, gx=.1028, prism=.1217, holo=.1676),
    "sm9": dict(secret=.0069, rainbow=.0103, ultra=.0482, gx=.0929, prism=.0596, holo=.1676),
    "sm10": dict(secret=.0090, rainbow=.0139, ultra=.0412, gx=.0988, holo=.1676),
    "sm11": dict(secret=.0090, rainbow=.0144, ultra=.0436, gx=.1272, holo=.1676),
    "sm115": dict(secret=0, rainbow=.0171, ultra=.0487, gx=.1506, holo=.1676, shiny=.3658),
    "sm12": dict(secret=.0089, rainbow=.0150, ultra=.0374, gx=.1193, character=.1011, holo=.1676),
}

SWSH_RATES = {
    "swsh1": dict(secret=.0091, rainbow=.0123, ultra=.0374, vmax=.0220, v=.1420, holo=.1676),
    "swsh2": dict(secret=.0095, rainbow=.0150, ultra=.0376, vmax=.0340, v=.1265, holo=.1676),
    "swsh3": dict(secret=.0087, rainbow=.0119, ultra=.0385, vmax=.0385, v=.1258, holo=.1676),
    "swsh3.5": dict(secret=.0128, rainbow=.0165, ultra=.0421, vmax=.1703, v=.1703, holo=1.0),
    "swsh4": dict(secret=.0105, rainbow=.0142, ultra=.0407, vmax=.0417, v=.1241, amazing=.0517, holo=.1676),
    "swsh4.5": dict(secret=0, rainbow=.0179, ultra=.0458, vmax=.0534, v=.1104, shiny=.3891, holo=.1753),
    "swsh5": dict(secret=.0100, rainbow=.0093, ultra=.0313, vmax=.0434, v=.1210, holo=.1676),
    "swsh6": dict(secret=.0122, rainbow=.0082, ultra=.0332, vmax=.0418, v=.1210, holo=.1320),
    "swsh7": dict(secret=.0136, rainbow=.0122, ultra=.0229, vmax=.0555, v=.1210, holo=.1320),
    # Les sets suivants gardent une structure exacte, mais certains taux restent
    # des profils d'époque tant qu'une mesure set-spécifique n'est pas intégrée.
    "swsh8": dict(secret=.0100, rainbow=.0120, ultra=.0350, vmax=.0450, v=.1250, holo=.1450),
    "swsh9": dict(secret=.0085, rainbow=.0147, ultra=.0412, vstar=.0233, vmax=.0104, v=.1430, holo=.1750, tg=.1250),
    "swsh10": dict(secret=.0090, rainbow=.0140, ultra=.0420, vstar=.0240, vmax=.0120, v=.1400, radiant=.0400, holo=.1700, tg=.1250),
    "swsh10.5": dict(secret=.0100, rainbow=.0120, ultra=.0400, vstar=.0250, v=.1400, radiant=.0400, holo=1.0),
    "swsh11": dict(secret=.0090, rainbow=.0140, ultra=.0410, vstar=.0240, vmax=.0120, v=.1400, radiant=.0400, holo=.1700, tg=.1250),
    "swsh12": dict(secret=.0090, rainbow=.0140, ultra=.0410, vstar=.0240, vmax=.0120, v=.1400, radiant=.0400, holo=.1700, tg=.1250),
    "swsh12.5": dict(secret=.0100, ultra=.0400, vstar=.0250, v=.1400, radiant=.0400, holo=1.0, gallery=.2000),
}

EX_RATES = {
    "ex1": (.1667, 0, 0), "ex2": (.1667, 0, 0), "ex3": (.1667, .0278, 0),
    "ex4": (.0833, .0139, 0), "ex5": (.0833, 0, 0), "ex6": (.0833, .0278, 0),
    "ex8": (.0833, 0, .0139), "ex9": (.0833, 0, 0), "ex10": (.0833, .0139, .0139),
    "ex11": (.0278, 0, .0139), "ex12": (.0833, 0, .0139), "ex13": (.0278, 0, .0139),
    "ex14": (.0833, 0, .0139), "ex15": (.0833, 0, .0139), "ex16": (.0833, 0, .0139),
}

SPECIAL = {
    "dc1": ("double-crisis7", 7, "empirical", src("specials"), dict(ultra=.1111, holo=1.0)),
    "dv1": ("dragon-vault5", 5, "official", src("specials"), {}),
    "det1": ("detective4", 4, "empirical", src("specials", "packrip"), dict(ultra=.3708)),
    "g1": ("generations10", 10, "official", src("specials"), {}),
    "cel25": ("celebrations4", 4, "empirical", src("specials", "packrip"), dict(classic=.4016, vmax=.0380, ultra=.0476, v=.0628, holo=.1204)),
}

FORBIDDEN = {"cel25cc", "sma", "swsh4.5sv", "swsh9.5tg", "swsh10.5tg", "swsh11.5tg", "swsh12.5tg", "swsh12.5gg", "rc", "sve", "mee"}

PHYSICAL_ORDER = {
    "wotc11": ["common×7", "rare/hit", "uncommon×3"],
    "ecard9": ["common×5", "reverse", "rare/hit", "uncommon×2"],
    "ex9": ["common×5", "reverse", "rare/hit", "uncommon×2"],
    "dp10": ["common×5", "reverse", "rare/hit", "uncommon×3"],
    "hgss10": ["common×5", "reverse", "rare/hit", "uncommon×3"],
    "bwxy10": ["common×5", "reverse", "rare/hit", "uncommon×3"],
    "sm11": ["common×5", "reverse/insert", "rare/hit", "uncommon×3", "energy"],
    "swsh11": ["common×5", "reverse/insert", "rare/hit", "uncommon×3", "energy"],
    "sv11": ["common×4", "uncommon×3", "foil-slot-1", "foil-slot-2", "rare-slot", "energy"],
    "double-crisis7": ["common×3", "reverse", "rare/hit", "uncommon×2"],
    "dragon-vault5": ["holo×5"],
    "detective4": ["holo-common×3", "holo-rare/hit"],
    "generations10": ["core×8", "radiant-collection×2"],
    "celebrations4": ["holo×4"],
    "pop2": ["card×2"],
}


def profile_for(s):
    sid = s["id"]
    series = s.get("seriesId") or ""
    if sid in FORBIDDEN:
        return None
    if sid in SPECIAL:
        family, count, confidence, sources, rates = SPECIAL[sid]
        return dict(family=family, cardCount=count, confidence=confidence, sources=sources, rates=rates)
    if series == "base":
        return dict(family="wotc11", cardCount=11, confidence="measured", sources=src("bulba"), rates={"holo": 1/3, "secret": 1/60 if sid == "base5" else 0})
    if series == "neo":
        return dict(family="wotc11", cardCount=11, confidence="empirical", sources=src("bulba"), rates={"holo": .25 if sid in {"neo3", "neo4"} else 1/3, "shining": 1/12 if sid in {"neo3", "neo4"} else 0})
    if series == "ecard":
        return dict(family="ecard9", cardCount=9, confidence="official" if sid == "ecard1" else "empirical", sources=src("expedition"), rates={"holo": 1/3, "secret": 1/36 if sid == "ecard2" else 0})
    if series == "ex" and re.fullmatch(r"ex\d+", sid):
        ex, secret, gold = EX_RATES.get(sid, (1/12, 0, 0))
        return dict(family="ex9", cardCount=9, confidence="empirical", sources=src("bulba", "efour_ex"), rates={"ex": ex, "secret": secret, "goldStar": gold, "holo": 1/3})
    if series == "pop" and re.fullmatch(r"pop\d+", sid):
        return dict(family="pop2", cardCount=2, confidence="structure-only", sources=src("specials"), rates={})
    if series == "dp" and re.fullmatch(r"dp\d+", sid):
        return dict(family="dp10", cardCount=10, confidence="era-empirical", sources=src("bulba"), rates={"lvx": 1/36 if sid in {"dp1", "dp2"} else 1/18, "holo": .30})
    if series == "pl" and re.fullmatch(r"pl\d+", sid):
        return dict(family="dp10", cardCount=10, confidence="era-empirical", sources=src("bulba"), rates={"lvx": 1/18, "holo": .25})
    if series == "hgss" and re.fullmatch(r"hgss\d+", sid):
        rates = {"prime": 1/6, "legend": 1/12, "secret": 1/72, "holo": 1/4.2} if sid == "hgss1" else {"prime": 1/9, "legend": 1/18, "secret": 1/72, "holo": .25}
        return dict(family="hgss10", cardCount=10, confidence="empirical", sources=src("bulba"), rates=rates)
    if series == "col" and sid == "col1":
        return dict(family="hgss10", cardCount=10, confidence="empirical", sources=src("bulba"), rates={"shining": 1/18, "holo": 1/3})
    if series == "bw" and re.fullmatch(r"bw\d+(?:\.\d+)?", sid):
        return dict(family="bwxy10", cardCount=10, confidence="era-empirical", sources=src("bulba", "pricedex_bw"), rates={"secret": 1/72, "ultra": 1/18, "holo": 1/3.8})
    if series == "xy" and re.fullmatch(r"xy\d+(?:\.\d+)?", sid):
        return dict(family="bwxy10", cardCount=10, confidence="era-empirical", sources=src("bulba", "pricedex_xy"), rates={"secret": 1/72, "ultra": 1/36, "ex": 1/12, "holo": 1/4.3})
    if series == "sm" and re.fullmatch(r"sm\d+(?:\.\d+)?", sid):
        rates = SM_RATES.get(sid, dict(gx=.11, ultra=.04, rainbow=.014, secret=.009, holo=.1676))
        return dict(family="sm11", cardCount=11, confidence="empirical" if sid in SM_RATES else "era-empirical", sources=src("bulba", "packrip"), rates=rates)
    if series == "swsh" and re.fullmatch(r"swsh\d+(?:\.\d+)?", sid):
        rates = SWSH_RATES.get(sid, dict(v=.12, vmax=.04, ultra=.035, rainbow=.012, secret=.01, holo=.15))
        exact_empirical = sid in {"swsh1", "swsh2", "swsh3", "swsh3.5", "swsh4", "swsh4.5", "swsh5", "swsh6", "swsh7"}
        return dict(family="swsh11", cardCount=11, confidence="empirical" if exact_empirical else "era-empirical", sources=src("bulba", "packrip"), rates=rates)
    if series == "sv" and re.fullmatch(r"sv\d+(?:\.\d+)?[bw]?", sid):
        known = {
            "sv01": dict(double=.1376, ultra=.0657, ir=.0767, sir=.0315, hr=.0185, ace=0),
            "sv03.5": dict(double=.1328, ultra=.0644, ir=.0850, sir=.0311, hr=.0194, ace=0, foilEnergy=.2483),
            "sv04.5": dict(double=.1589, ultra=.0661, ir=.0722, sir=.0172, hr=.0161, ace=0, shiny=.2544, shinyUltra=.0772),
            "sv08.5": dict(double=.1651, ultra=.0746, ir=0, sir=.0222, hr=.0056, ace=.0468, pokeBall=.3310, masterBall=.0492),
        }
        rates = known.get(sid, dict(double=.169, ultra=.067, ir=.077, sir=.0115, hr=.006, ace=.05 if sid not in {"sv01", "sv02", "sv03", "sv03.5", "sv04", "sv04.5"} else 0))
        return dict(family="sv11", cardCount=11, confidence="empirical" if sid in known else "era-empirical", sources=src("pokemon_sv"), rates=rates)
    if series == "me" and re.fullmatch(r"me\d+(?:\.\d+)?", sid):
        known = {
            "me01": dict(double=.20, ultra=1/12, ir=1/9, sir=1/101, mhr=1/1260),
            "me05": dict(double=.2102, ultra=.0830, ir=.1101, sir=.0125, mhr=.0009),
        }
        rates = known.get(sid, dict(double=.20, ultra=1/12, ir=1/9, sir=1/101, mhr=1/1260))
        return dict(family="sv11", cardCount=11, confidence="empirical" if sid in known else "era-empirical", sources=src("pokemon_sv", "pricedex_me"), rates=rates)
    return None


def main() -> int:
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    sealed = json.loads(SEALED.read_text(encoding="utf-8")) if SEALED.exists() else {"sets": {}}
    profiles = {}
    deps = {
        "sm115": ["sma"], "swsh4.5": ["swsh4.5sv"], "swsh9": ["swsh9.5tg"],
        "swsh10": ["swsh10.5tg"], "swsh11": ["swsh11.5tg"], "swsh12": ["swsh12.5tg"],
        "swsh12.5": ["swsh12.5gg"], "cel25": ["cel25cc"],
    }
    for row in index.get("sets", []):
        profile = profile_for(row)
        if not profile:
            continue
        profile = {
            "setId": row["id"], "name": row.get("name") or row["id"],
            "seriesId": row.get("seriesId") or "", "releaseDate": row.get("releaseDate") or "",
            "official": int(row.get("official") or 0), **profile,
        }
        profile["physicalOrder"] = PHYSICAL_ORDER.get(profile["family"], [])
        if row["id"] in deps:
            profile["dependencies"] = deps[row["id"]]
        profiles[row["id"]] = profile

    booster_sets = {
        sid for sid, rows in sealed.get("sets", {}).items()
        if any(p.get("mode") == "loose" for p in rows or [])
    }
    missing = sorted(booster_sets - set(profiles))
    if missing:
        raise RuntimeError(f"boosters physiques sans profil: {missing}")

    families = {}
    for p in profiles.values():
        families[p["family"]] = families.get(p["family"], 0) + 1
    payload = {
        "schema": 116, "language": "fr",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sets": profiles,
        "stats": {
            "profiles": len(profiles), "verifiedBoosterSets": len(booster_sets),
            "coveredVerifiedBoosters": len(booster_sets & set(profiles)), "families": families,
        },
    }
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(compact, encoding="utf-8")
    OUT_JS.write_text("'use strict';\nwindow.V116_COLLATION_PROFILES=" + compact + ";\n", encoding="utf-8")
    print("V1.1.6 profiles", payload["stats"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
