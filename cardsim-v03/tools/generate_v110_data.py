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
            time.sleep(0.6 * (i + 1))
    raise RuntimeError(f"{url}: {err}")


def write_js(name: str, var: str, obj):
    (A / name).write_text(
        "'use strict';\nwindow.%s=%s;\n"
        % (var, json.dumps(obj, ensure_ascii=False, separators=(",", ":"))),
        encoding="utf-8",
    )


def numeric_part(value):
    s = str(value or "").split("/")[0].strip()
    return int(s) if s.isdigit() else None


def details_for_set(set_id: str):
    enc = urllib.parse.quote(set_id)
    set_data = get_json(f"https://api.tcgdex.net/v2/fr/sets/{enc}")
    cards = set_data.get("cards") or []

    def one(c):
        cid = c.get("id")
        if not cid:
            return None
        return get_json(
            "https://api.tcgdex.net/v2/fr/cards/" + urllib.parse.quote(cid)
        )

    out = []
    with ThreadPoolExecutor(max_workers=18) as pool:
        futures = [pool.submit(one, c) for c in cards]
        for f in as_completed(futures):
            value = f.result()
            if value:
                out.append(value)
    out.sort(key=lambda x: numeric_part(x.get("localId") or x.get("number")) or 0)
    if len(out) != len(cards):
        raise RuntimeError(f"{set_id}: details {len(out)}/{len(cards)}")
    return set_data, out


def variants_for(detail):
    variants = detail.get("variants") or {}
    result = []
    if isinstance(variants, dict):
        if variants.get("normal"):
            result.append("normal")
        if variants.get("holo"):
            result.append("holo")
        if variants.get("reverse"):
            result.append("reverse")
    if not result:
        rarity = str(detail.get("rarity") or "").lower()
        result = ["normal"] if ("common" in rarity or "uncommon" in rarity) else ["holo"]
    return result


def main():
    eevee_url = (
        "https://raw.githubusercontent.com/seavey-org/tcg-tracker/"
        "11ca9a20d57e88d5091e92ff0c907458e7e36281/backend/data/"
        "pokemon-tcg-data-japan/cards/jp-s6a-eevee-heroes.json"
    )
    eevee = get_json(eevee_url)
    eevee_by_number = {}
    for card in eevee:
        n = numeric_part(card.get("number"))
        if n is not None and 1 <= n <= 101:
            eevee_by_number[n] = card
    if len(eevee_by_number) != 101:
        raise RuntimeError(f"Eevee numbered cards {len(eevee_by_number)}/101")
    write_js("eevee_heroes_embed.js", "V062_EEVEE_DATA", eevee)
    (A / "eevee_heroes.json").write_text(
        json.dumps(eevee, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )

    standard = {}
    details = {}
    metadata_files = {
        "sv03.5": "sv3pt5.json",
        "sv03": "sv3.json",
        "sv02": "sv2.json",
    }
    for set_id, metadata_file in metadata_files.items():
        set_data, card_details = details_for_set(set_id)
        raw = get_json(
            "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en/"
            + metadata_file
        )
        standard[set_id] = {"set": set_data, "raw": raw}
        details[set_id] = card_details
    write_js("standard_sets_embed.js", "V063_STANDARD_DATA", standard)

    me_set, me_cards = details_for_set("me05")
    if len(me_cards) != 120:
        raise RuntimeError(f"Nuit Noire details {len(me_cards)}/120")
    write_js("pitch_black_embed.js", "V090_PITCH_BLACK_DATA", {"set": me_set, "cards": me_cards})
    details["me05"] = me_cards

    master = {}
    for set_id, card_details in details.items():
        cards = {}
        for detail in card_details:
            n = numeric_part(detail.get("localId") or detail.get("number"))
            if n is None:
                continue
            cards[f"{n:03d}"] = variants_for(detail)
        master[set_id] = {"supported": True, "cards": cards}

    # Eevee Heroes does not have an English-style reverse parallel set in this source.
    eevee_master = {}
    for n, detail in sorted(eevee_by_number.items()):
        rarity = str(detail.get("rarity") or "").lower()
        eevee_master[f"{n:03d}"] = [
            "normal" if rarity in ("common", "uncommon") else "holo"
        ]
    master["s6a"] = {"supported": True, "cards": eevee_master}

    expected_cards = {"sv03.5": 207, "sv03": 230, "sv02": 279, "s6a": 101, "me05": 120}
    # These counts were validated against the same TCGdex variants metadata used by V1.0.
    expected_slots = {"sv03.5": 362, "sv03": 417, "sv02": 461, "s6a": 101, "me05": 187}
    for set_id, expected in expected_cards.items():
        got = len(master[set_id]["cards"])
        slots = sum(len(v) for v in master[set_id]["cards"].values())
        print(f"{set_id}: {got} cards / {slots} Master slots")
        if got != expected:
            raise RuntimeError(f"{set_id}: Master cards {got}/{expected}")
        if slots != expected_slots[set_id]:
            raise RuntimeError(
                f"{set_id}: Master slots {slots}/{expected_slots[set_id]}"
            )
    write_js("master_variants_embed.js", "V110_MASTER_VARIANTS", master)


if __name__ == "__main__":
    main()
