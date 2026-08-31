#!/usr/bin/env python3
import json
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
A = ROOT / "app" / "src" / "main" / "assets"
A.mkdir(parents=True, exist_ok=True)
HEADERS = {"User-Agent": "VOX-CardSim-V110-build/1.1"}


def get_json(url: str, tries: int = 5):
    err = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=35) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            err = e
            time.sleep(0.5 * (i + 1))
    raise RuntimeError(f"{url}: {err}")


def write_js(name: str, var: str, obj):
    (A / name).write_text(
        "'use strict';\nwindow.%s=%s;\n"
        % (var, json.dumps(obj, ensure_ascii=False, separators=(",", ":"))),
        encoding="utf-8",
    )


def number_of(value):
    s = str(value or "").split("/")[0].strip()
    return int(s) if s.isdigit() else None


def main():
    # Same pinned Japanese source and same #095 repair as the validated V0.9.3/V1.0 builds.
    eevee = get_json(
        "https://raw.githubusercontent.com/seavey-org/tcg-tracker/"
        "11ca9a20d57e88d5091e92ff0c907458e7e36281/backend/data/"
        "pokemon-tcg-data-japan/cards/jp-s6a-eevee-heroes.json"
    )
    nums = {number_of(x.get("number")) for x in eevee if number_of(x.get("number")) is not None}
    if 95 not in nums:
        eevee.append(
            {
                "id": "jp-s6a-eevee-heroes-095/069",
                "name": "Umbreon VMAX - 095/069",
                "number": "095/069",
                "rarity": "Hyper Rare",
                "images": {
                    "small": "https://tcgplayer-cdn.tcgplayer.com/product/570557_200w.jpg",
                    "large": "https://tcgplayer-cdn.tcgplayer.com/product/570557_400w.jpg",
                },
            }
        )
    nums = {number_of(x.get("number")) for x in eevee if number_of(x.get("number")) is not None}
    if nums != set(range(1, 102)):
        raise RuntimeError(f"Eevee numbers invalid: missing {sorted(set(range(1,102))-nums)}")
    write_js("eevee_heroes_embed.js", "V062_EEVEE_DATA", eevee)
    (A / "eevee_heroes.json").write_text(
        json.dumps(eevee, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )

    specs = {
        "sv03.5": ("sv3pt5.json", 207),
        "sv03": ("sv3.json", 230),
        "sv02": ("sv2.json", 279),
    }
    sets = {}
    standard = {}
    for sid, (meta_file, total) in specs.items():
        set_data = get_json(f"https://api.tcgdex.net/v2/fr/sets/{urllib.parse.quote(sid)}")
        raw = get_json(
            "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en/"
            + meta_file
        )
        if len(set_data.get("cards") or []) != total or len(raw) != total:
            raise RuntimeError(f"{sid}: set/raw count mismatch")
        sets[sid] = set_data
        standard[sid] = {"set": set_data, "raw": raw}
    write_js("standard_sets_embed.js", "V063_STANDARD_DATA", standard)

    me = get_json("https://api.tcgdex.net/v2/fr/sets/me05")
    if len(me.get("cards") or []) != 120:
        raise RuntimeError("Nuit Noire set count is not 120")
    sets["me05"] = me

    # V1.0 validated variants against TCGdex EN card details. Reuse that exact contract.
    jobs = []
    for sid, set_data in sets.items():
        for brief in set_data.get("cards") or []:
            jobs.append((sid, brief))

    def fetch_detail(pair):
        sid, brief = pair
        cid = brief["id"]
        detail = get_json(
            "https://api.tcgdex.net/v2/en/cards/" + urllib.parse.quote(cid)
        )
        return sid, cid, detail

    details = {}
    with ThreadPoolExecutor(max_workers=20) as pool:
        futures = [pool.submit(fetch_detail, job) for job in jobs]
        for f in as_completed(futures):
            sid, cid, detail = f.result()
            details[(sid, cid)] = detail
    expected_details = sum(len(s.get("cards") or []) for s in sets.values())
    if len(details) != expected_details:
        raise RuntimeError(f"TCGdex details {len(details)}/{expected_details}")

    master = {}
    for sid, set_data in sets.items():
        cards = {}
        for brief in set_data["cards"]:
            detail = details[(sid, brief["id"])]
            variants = detail.get("variants") or {}
            arr = [k for k in ("normal", "holo", "reverse") if variants.get(k) is True]
            if not arr:
                raise RuntimeError(f"{sid}/{brief['id']}: no documented variant")
            lid = str(brief.get("localId") or detail.get("localId") or "").zfill(3)
            cards[lid] = arr
        if len(cards) != len(set_data["cards"]):
            raise RuntimeError(f"{sid}: Master card map incomplete")
        master[sid] = {"supported": True, "source": "TCGdex variants", "cards": cards}

    foil = {"Rare", "Double Rare", "Triple Rare", "Super Rare", "Hyper Rare", "Ultra Rare"}
    eevee_cards = {}
    for card in eevee:
        n = number_of(card.get("number"))
        if n is None:
            continue
        eevee_cards[f"{n:03d}"] = ["holo" if card.get("rarity") in foil else "normal"]
    if len(eevee_cards) != 101:
        raise RuntimeError(f"Eevee Master map {len(eevee_cards)}/101")
    master["s6a"] = {
        "supported": True,
        "source": "Japanese set rarity mapping",
        "cards": eevee_cards,
    }

    expected_cards = {"sv03.5": 207, "sv03": 230, "sv02": 279, "s6a": 101, "me05": 120}
    expected_slots = {"sv03.5": 362, "sv03": 417, "sv02": 461, "s6a": 101, "me05": 187}
    for sid, expected in expected_cards.items():
        got = len(master[sid]["cards"])
        slots = sum(len(v) for v in master[sid]["cards"].values())
        print(f"{sid}: {got} cards / {slots} Master slots")
        if got != expected or slots != expected_slots[sid]:
            raise RuntimeError(
                f"{sid}: Master mismatch {got}/{expected} cards, {slots}/{expected_slots[sid]} slots"
            )
    write_js("master_variants_embed.js", "V110_MASTER_VARIANTS", master)

    # Same compact Nuit Noire payload shape used by V0.9.3, with embedded market snapshots.
    rmap = {
        "common": "common",
        "uncommon": "uncommon",
        "rare": "rare",
        "double rare": "double",
        "illustration rare": "ir",
        "ultra rare": "ur",
        "special illustration rare": "sir",
        "mega hyper rare": "mhr",
    }
    cards = []
    counts = {}
    numbers = set()
    for brief in me["cards"]:
        detail = details[("me05", brief["id"])]
        rarity = str(detail.get("rarity") or "").strip()
        key = rmap.get(rarity.casefold(), "unknown")
        counts[key] = counts.get(key, 0) + 1
        n = number_of(brief.get("localId") or detail.get("localId"))
        numbers.add(n)
        image = brief.get("image") or detail.get("image")
        if not image or not image.startswith("https://assets.tcgdex.net/"):
            raise RuntimeError(f"Nuit Noire image missing for {brief['id']}")
        cards.append(
            {
                "id": brief["id"],
                "localId": str(brief.get("localId") or detail.get("localId")),
                "name": brief.get("name") or detail.get("name"),
                "image": image,
                "rarity": rarity,
                "rarityKey": key,
                "pricing": detail.get("pricing") or {},
            }
        )
    expected_counts = {
        "common": 37,
        "uncommon": 26,
        "rare": 11,
        "double": 10,
        "ir": 11,
        "ur": 18,
        "sir": 6,
        "mhr": 1,
    }
    if numbers != set(range(1, 121)) or counts != expected_counts:
        raise RuntimeError(f"Nuit Noire validation failed: {counts}")
    write_js(
        "pitch_black_embed.js",
        "V090_PITCH_BLACK_DATA",
        {
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "set": {k: me.get(k) for k in ("id", "name", "logo", "symbol", "cardCount", "releaseDate")},
            "cards": cards,
        },
    )


if __name__ == "__main__":
    main()
