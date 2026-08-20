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
HEADERS = {"User-Agent": "VOX-CardSim-V106-build/1.0.6"}

SPECS = [
    ("sv04.5", 2024, "2024-01-26", "legacy"),
    ("sv05",   2024, "2024-03-22", "legacy"),
    ("sv06",   2024, "2024-05-24", "legacy"),
    ("sv06.5", 2024, "2024-08-02", "legacy"),
    ("sv07",   2024, "2024-09-13", "legacy"),
    ("sv08",   2024, "2024-11-08", "legacy"),
    ("sv08.5", 2025, "2025-01-17", "legacy"),
    ("sv09",   2025, "2025-03-28", "legacy"),
    ("sv10",   2025, "2025-05-30", "legacy"),
    ("sv10.5b",2025, "2025-07-18", "legacy"),
    ("sv10.5w",2025, "2025-07-18", "legacy"),
    ("me01",   2025, "2025-09-26", "legacy"),
    ("me02",   2025, "2025-11-14", "legacy"),
    ("me02.5", 2026, "2026-01-30", "retail"),
    ("me03",   2026, "2026-03-27", "retail"),
    ("me04",   2026, "2026-05-22", "retail"),
]


def get_json(url: str, tries: int = 6):
    err = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            err = e
            time.sleep(0.45 * (i + 1))
    raise RuntimeError(f"{url}: {err}")


def compact_js(name: str, var: str, obj):
    (A / name).write_text(
        "'use strict';\nwindow.%s=%s;\n" % (
            var, json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
        ), encoding="utf-8"
    )


def norm(s):
    return " ".join(str(s or "").strip().casefold().replace("é", "e").split())


def game_rarity(raw):
    r = norm(raw)
    if r == "common": return "common"
    if r == "uncommon": return "uncommon"
    if "mega hyper" in r: return "mhr"
    if "hyper" in r: return "hr"
    if "special illustration" in r: return "sir"
    if "black white" in r: return "sir"
    if "shiny ultra" in r: return "ur"
    if "ultra" in r: return "ur"
    if "shiny" in r: return "ir"
    if "illustration" in r: return "ir"
    if "double" in r: return "double"
    if "ace spec" in r: return "rare"
    if "rare" in r: return "rare"
    return "rare"


def supply_tier(raw):
    r = norm(raw)
    if r == "common": return "common"
    if r == "uncommon": return "uncommon"
    if "black white" in r: return "bwr"
    if "mega hyper" in r: return "mhr"
    if "hyper" in r: return "hr"
    if "special illustration" in r: return "sir"
    if "shiny ultra" in r: return "shiny_ur"
    if "shiny" in r: return "shiny"
    if "ultra" in r: return "ur"
    if "illustration" in r: return "ir"
    if "ace spec" in r: return "ace"
    if "double" in r: return "double"
    if "rare" in r: return "rare"
    return "rare"


def lean_pricing(raw):
    """Keep only Cardmarket fields used by the game; discard TCGplayer and metadata bloat."""
    cm = (raw or {}).get("cardmarket") or {}
    out = {}
    for k, v in cm.items():
        if k == "updated":
            out[k] = v
        elif isinstance(v, (int, float)) and (k == "low" or k.startswith("trend") or k.startswith("avg")):
            out[k] = v
    return {"cardmarket": out} if out else {}


def main():
    sets, briefs = {}, {}
    print(f"Loading {len(SPECS)} TCGdex sets...")
    for sid, year, release, availability in SPECS:
        d = get_json("https://api.tcgdex.net/v2/fr/sets/" + urllib.parse.quote(sid))
        cards = d.get("cards") or []
        if not cards:
            raise RuntimeError(f"{sid}: empty TCGdex set")
        cc = d.get("cardCount") or {}
        declared = int(cc.get("total") or len(cards))
        if len(cards) != declared:
            raise RuntimeError(f"{sid}: cards {len(cards)} != cardCount.total {declared}")
        api_release = str(d.get("releaseDate") or release)
        if api_release[:4].isdigit() and int(api_release[:4]) != year:
            raise RuntimeError(f"{sid}: unexpected release year {api_release}")
        briefs[sid] = cards
        sets[sid] = {
            "id": sid,
            "name": d.get("name") or sid,
            "logo": d.get("logo") or "",
            "releaseDate": api_release,
            "year": year,
            "availability": availability,
            "total": declared,
            "official": int(cc.get("official") or declared),
            "cards": [],
            "master": {},
        }
        print(f"  {sid}: {d.get('name')} / {declared} cards")

    jobs = [(sid, c) for sid in briefs for c in briefs[sid]]
    details = {}

    def fetch_detail(job):
        sid, brief = job
        cid = brief.get("id")
        if not cid:
            raise RuntimeError(f"{sid}: card without id")
        d = get_json("https://api.tcgdex.net/v2/en/cards/" + urllib.parse.quote(cid))
        return sid, cid, d

    print(f"Fetching {len(jobs)} card details...")
    with ThreadPoolExecutor(max_workers=32) as pool:
        fs = [pool.submit(fetch_detail, j) for j in jobs]
        for n, f in enumerate(as_completed(fs), 1):
            sid, cid, d = f.result()
            details[(sid, cid)] = d
            if n % 500 == 0:
                print(f"  details {n}/{len(jobs)}")
    if len(details) != len(jobs):
        raise RuntimeError(f"details {len(details)}/{len(jobs)}")

    total_cards = total_master_slots = 0
    rarity_report = {}
    for sid, _, _, _ in SPECS:
        rarity_report[sid] = {}
        local_seen = set()
        for brief in briefs[sid]:
            cid = brief["id"]
            d = details[(sid, cid)]
            local = str(brief.get("localId") or d.get("localId") or "").strip()
            if not local:
                raise RuntimeError(f"{sid}/{cid}: missing localId")
            if local in local_seen:
                raise RuntimeError(f"{sid}: duplicate localId {local}")
            local_seen.add(local)
            raw_rarity = str(d.get("rarity") or "Rare")
            game, tier = game_rarity(raw_rarity), supply_tier(raw_rarity)
            variants = d.get("variants") or {}
            master = [k for k in ("normal", "holo", "reverse") if variants.get(k) is True] or ["normal"]
            image = brief.get("image") or d.get("image") or ""
            if not image:
                raise RuntimeError(f"{sid}/{cid}: missing image")
            sets[sid]["cards"].append({
                "id": cid,
                "localId": local,
                "name": brief.get("name") or d.get("name") or cid,
                "image": image,
                "rarityKey": game,
                "supplyTier": tier,
                "pricing": lean_pricing(d.get("pricing") or {}),
            })
            sets[sid]["master"][local.zfill(3)] = master
            rarity_report[sid][tier] = rarity_report[sid].get(tier, 0) + 1
            total_master_slots += len(master)
        sets[sid]["cards"].sort(key=lambda c: (int(c["localId"]) if c["localId"].isdigit() else 99999, c["localId"]))
        if len(sets[sid]["cards"]) != sets[sid]["total"]:
            raise RuntimeError(f"{sid}: final card count mismatch")
        total_cards += len(sets[sid]["cards"])

    payload = {
        "schema": 106,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sets": sets,
        "rotation2026": ["me02.5", "me03", "me04", "me05"],
        "legacyYears": [2024, 2025],
        "stats": {
            "sets": len(sets),
            "cards": total_cards,
            "masterSlots": total_master_slots,
            "rarities": rarity_report,
        },
    }
    compact_js("v105_catalog_embed.js", "V105_CATALOG", payload)
    (A / "v105_catalog.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size = (A / "v105_catalog_embed.js").stat().st_size
    print(f"Catalog ready: {len(sets)} sets / {total_cards} cards / {total_master_slots} Master slots / {size} bytes")


if __name__ == "__main__":
    main()
