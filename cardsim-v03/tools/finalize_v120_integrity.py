#!/usr/bin/env python3
"""VOX Card Sim 1.2.0 — consolidation des données physiques.

Ce passage s'exécute après les importeurs TCGdex/TCGCSV et avant la génération des
profils de collation. Il ne crée aucun produit ou carte fictif :
- les cartes déjà présentes restent françaises ; pokemon-tcg-data sert de seconde
  source pour préciser les raretés, restaurer un scan absent et compléter les
  cartes réellement publiées que le listing FR TCGdex omet ;
- les boosters TCGplayer sont retéléchargés depuis le CDN haute définition et
  fusionnés en UN produit par extension ; les wrappers deviennent des artworks ;
- les images paysage / logos et les miniatures trop faibles ne sont jamais choisies
  lorsqu'un wrapper haute définition existe ;
- un petit catalogue d'énergies de base est construit par extension avec une source
  de la même série/époque. Si aucune source cohérente n'existe, le runtime garde le
  placeholder neutre plutôt que d'afficher une énergie d'une autre génération.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

import import_all_collections as card_importer
import import_verified_sealed_products as sealed_importer
import finalize_v117_products as v117

ROOT = Path(__file__).resolve().parents[1]
A = ROOT / "app" / "src" / "main" / "assets"
INDEX = A / "v111_collection_index.json"
INDEX_JS = A / "v111_collection_index.js"
REPORT = A / "v111_import_report.json"
SEALED = A / "v115_sealed_catalog.json"
SEALED_JS = A / "v115_sealed_catalog.js"
ENERGY = A / "v120_energy_catalog.json"
ENERGY_JS = A / "v120_energy_catalog.js"
HD_DIR = A / "img" / "v120" / "boosters"
PTCG_CARDS = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en/{set_id}.json"
TCGPLAYER_HD = "https://tcgplayer-cdn.tcgplayer.com/product/{product_id}_in_1000x1000.jpg"
UA = "VOX-CardSim-Integrity/1.2.0 (+https://github.com/VOXfra/Kaguya-ACI)"

ENERGY_NAMES = {
    "grass energy": "Plante", "fire energy": "Feu", "water energy": "Eau",
    "lightning energy": "Électrique", "psychic energy": "Psy", "fighting energy": "Combat",
    "darkness energy": "Obscurité", "metal energy": "Métal", "fairy energy": "Fée",
}


def get_bytes(url: str, retries: int = 3, timeout: int = 35) -> tuple[bytes, str]:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                if not 200 <= r.status < 300:
                    raise RuntimeError(f"HTTP {r.status}")
                return r.read(), str(r.headers.get("Content-Type") or "")
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                raise
            last = exc
        except Exception as exc:
            last = exc
        time.sleep(.4 * (2 ** attempt))
    raise RuntimeError(f"{url}: {last}")


def get_json(url: str, retries: int = 3) -> Any:
    raw, _ = get_bytes(url, retries=retries)
    return json.loads(raw.decode("utf-8"))


def number_key(v: Any) -> tuple[int, str]:
    raw = str(v or ""); head = raw.split("/", 1)[0]
    m = re.match(r"^0*(\d+)", head)
    return (int(m.group(1)), raw) if m else (10**9, raw)


def ext_variants(card: dict[str, Any]) -> list[str]:
    rarity = str(card.get("rarity") or "").casefold()
    if "holo" in rarity:
        return ["holo"]
    return ["normal"]


def fetch_ptcg_set(sid: str) -> tuple[str, list[dict[str, Any]] | None]:
    try:
        value = get_json(PTCG_CARDS.format(set_id=urllib.parse.quote(sid, safe="._-")), retries=2)
        if isinstance(value, list):
            return sid, [x for x in value if isinstance(x, dict)]
    except Exception:
        pass
    return sid, None


def rehash_payload(lang: str, entry: dict[str, Any], payload: dict[str, Any]) -> None:
    payload["issues"] = sorted(set(str(x) for x in payload.get("issues") or [] if x))
    stable_set = {k: v for k, v in payload.get("set", {}).items() if k != "contentHash"}
    digest = card_importer.stable_hash({
        "schema": 111, "language": lang, "set": stable_set,
        "cards": payload.get("cards") or [], "issues": payload["issues"],
    })
    entry["contentHash"] = digest
    payload["contentHash"] = digest
    payload["set"]["contentHash"] = digest


def enrich_cards(index: dict[str, Any]) -> tuple[dict[str, list[dict[str, Any]]], dict[str, int]]:
    entries = [x for x in index.get("sets") or [] if isinstance(x, dict) and x.get("id")]
    external: dict[str, list[dict[str, Any]]] = {}
    with ThreadPoolExecutor(max_workers=14, thread_name_prefix="ptcg-cardset") as pool:
        futures = [pool.submit(fetch_ptcg_set, str(e["id"])) for e in entries]
        for future in as_completed(futures):
            sid, rows = future.result()
            if rows:
                external[sid] = rows

    enriched = scans_restored = appended = rarity_upgrades = 0
    for entry in entries:
        sid = str(entry["id"]); path = A / "catalog" / "fr" / str(entry.get("file") or f"{sid}.json")
        if not path.is_file():
            continue
        payload = json.loads(path.read_text(encoding="utf-8")); cards = [dict(x) for x in payload.get("cards") or [] if isinstance(x, dict)]
        ext = external.get(sid) or []
        by_id = {str(x.get("id") or ""): x for x in ext if x.get("id")}
        by_num = {str(x.get("number") or ""): x for x in ext if x.get("number")}
        have_ids = {str(x.get("id") or "") for x in cards}
        have_num = {str(x.get("localId") or "") for x in cards}

        for card in cards:
            src = by_id.get(str(card.get("id") or "")) or by_num.get(str(card.get("localId") or ""))
            if not src:
                continue
            rarity = str(src.get("rarity") or "").strip()
            if rarity and rarity != str(card.get("rarityRaw") or ""):
                card["rarityRaw"] = rarity
                card["rarityKey"] = card_importer.game_rarity(rarity)
                card["supplyTier"] = card_importer.supply_tier(rarity)
                rarity_upgrades += 1
            images = src.get("images") or {}
            if not str(card.get("image") or "").strip() and isinstance(images, dict):
                fallback = str(images.get("large") or images.get("small") or "").strip()
                if fallback:
                    card["image"] = fallback; card["v120FallbackScan"] = True; scans_restored += 1
            if not card.get("variants"):
                card["variants"] = ext_variants(src)
            card["v120RaritySource"] = "pokemon-tcg-data"
            enriched += 1

        source_total = int(entry.get("sourceTotal") or entry.get("total") or len(cards))
        if ext and len(cards) < source_total:
            candidates = sorted(ext, key=lambda x: number_key(x.get("number")))
            for src in candidates:
                if len(cards) >= source_total:
                    break
                cid = str(src.get("id") or ""); num = str(src.get("number") or "")
                if not cid or cid in have_ids or (num and num in have_num):
                    continue
                images = src.get("images") or {}; rarity = str(src.get("rarity") or "").strip()
                fallback = str(images.get("large") or images.get("small") or "").strip() if isinstance(images, dict) else ""
                cards.append({
                    "id": cid, "localId": num, "name": str(src.get("name") or cid), "image": fallback,
                    "rarityKey": card_importer.game_rarity(rarity) if rarity else "unknown",
                    "rarityRaw": rarity, "supplyTier": card_importer.supply_tier(rarity) if rarity else "unknown",
                    "variants": ext_variants(src), "boosters": [], "v120FallbackCard": True,
                    "fallbackLanguage": "en", "fallbackSource": "pokemon-tcg-data",
                })
                have_ids.add(cid); have_num.add(num); appended += 1

        cards.sort(key=lambda c: number_key(c.get("localId")))
        missing_scans = sum(1 for c in cards if not str(c.get("image") or "").strip())
        missing_rarity = sum(1 for c in cards if not str(c.get("rarityRaw") or "").strip())
        missing_variants = sum(1 for c in cards if not (c.get("variants") or []))
        rarity_counts: dict[str, int] = {}
        for c in cards:
            k = str(c.get("rarityKey") or "unknown"); rarity_counts[k] = rarity_counts.get(k, 0) + 1

        complete_count = source_total <= 0 or len(cards) >= source_total
        status = "ready" if cards and complete_count and missing_scans == 0 else "partial"
        metadata = "complete" if missing_rarity == 0 and missing_variants == 0 else "partial"
        entry.update({
            "cards": len(cards), "total": len(cards), "missingScans": missing_scans,
            "missingRarities": missing_rarity, "missingVariants": missing_variants,
            "rarities": rarity_counts, "status": status, "metadataStatus": metadata,
            "v120FallbackCards": sum(1 for c in cards if c.get("v120FallbackCard")),
        })
        pset = payload.setdefault("set", {})
        pset.update({
            "total": len(cards), "cards": len(cards), "status": status, "metadataStatus": metadata,
            "v120FallbackCards": entry["v120FallbackCards"],
        })
        payload["cards"] = cards
        issues = [x for x in payload.get("issues") or [] if not re.search(r"scan\(s\)|raret[eé]\(s\)|variante\(s\)", str(x), re.I)]
        if missing_scans: issues.append(f"{missing_scans} scan(s) encore indisponible(s) après source secondaire")
        if missing_rarity: issues.append(f"{missing_rarity} rareté(s) encore indisponible(s) après source secondaire")
        if entry["v120FallbackCards"]: issues.append(f"{entry['v120FallbackCards']} carte(s) complétée(s) par pokemon-tcg-data EN")
        payload["issues"] = issues
        rehash_payload(str(index.get("language") or "fr"), entry, payload)
        path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    sets = index.get("sets") or []
    stats = dict(index.get("stats") or {})
    stats.update({
        "discovered": len(sets), "imported": len(sets), "failed": 0,
        "ready": sum(1 for x in sets if x.get("status") == "ready"),
        "partial": sum(1 for x in sets if x.get("status") != "ready"),
        "cards": sum(int(x.get("cards") or 0) for x in sets),
        "missingScans": sum(int(x.get("missingScans") or 0) for x in sets),
        "missingRarities": sum(int(x.get("missingRarities") or 0) for x in sets),
        "missingVariants": sum(int(x.get("missingVariants") or 0) for x in sets),
        "v120ExternalSets": len(external), "v120CardsEnriched": enriched,
        "v120FallbackCards": appended, "v120ScansRestored": scans_restored,
        "v120RarityUpgrades": rarity_upgrades,
    })
    index["stats"] = stats; index["source"] = str(index.get("source") or "TCGdex") + " + pokemon-tcg-data integrity"
    compact = json.dumps(index, ensure_ascii=False, separators=(",", ":"))
    INDEX.write_text(compact, encoding="utf-8")
    INDEX_JS.write_text("'use strict';\nwindow.V111_COLLECTION_INDEX=" + compact + ";\n", encoding="utf-8")
    REPORT.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    return external, stats


def basic_energies(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for c in rows or []:
        if str(c.get("supertype") or "").casefold() != "energy":
            continue
        if "basic" not in [str(x).casefold() for x in c.get("subtypes") or []]:
            continue
        key = str(c.get("name") or "").casefold().strip()
        fr = ENERGY_NAMES.get(key)
        if not fr:
            continue
        rarity = str(c.get("rarity") or "").casefold()
        if "secret" in rarity or "ultra" in rarity or "hyper" in rarity:
            continue
        images = c.get("images") or {}; large = str(images.get("large") or "") if isinstance(images, dict) else ""
        small = str(images.get("small") or large) if isinstance(images, dict) else large
        if not large and not small:
            continue
        out[fr] = {"type": fr, "id": str(c.get("id") or ""), "number": str(c.get("number") or ""), "imageLarge": large or small, "imageSmall": small or large}
    return list(out.values())


def build_energy_catalog(index: dict[str, Any], external: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    entries = [x for x in index.get("sets") or [] if isinstance(x, dict) and x.get("id")]
    candidates: dict[str, list[tuple[int, str, list[dict[str, Any]]]]] = {}
    for e in entries:
        sid = str(e["id"]); rows = basic_energies(external.get(sid) or [])
        if len(rows) < 6:
            continue
        series = str(e.get("seriesId") or ""); year = int(e.get("year") or 0)
        candidates.setdefault(series, []).append((year, sid, rows))

    sets: dict[str, Any] = {}
    for e in entries:
        sid = str(e["id"]); series = str(e.get("seriesId") or ""); year = int(e.get("year") or 0)
        choices = candidates.get(series) or []
        if not choices:
            continue
        # Même série d'abord, puis année la plus proche, sans aller dans le futur si possible.
        past = [x for x in choices if x[0] and x[0] <= year]
        pool = past or choices
        source_year, source_sid, energies = min(pool, key=lambda x: (abs((x[0] or year) - year), -len(x[2])))
        sets[sid] = {"sourceSet": source_sid, "sourceYear": source_year, "targetYear": year, "seriesId": series, "energies": energies}

    # Scarlet & Violet possède un set énergie dédié connu par le jeu historique ;
    # ces URLs sont celles déjà utilisées par l'application, mais seulement pour
    # cette série au lieu de contaminer toutes les générations.
    for e in entries:
        sid = str(e["id"]); series = str(e.get("seriesId") or "").casefold()
        if series not in {"sv", "scarlet-violet", "scarlet & violet"} and not sid.startswith("sv"):
            continue
        if sid in sets:
            continue
        rows = []
        for n, fr in enumerate(["Plante","Feu","Eau","Électrique","Psy","Combat","Obscurité","Métal"], 1):
            rows.append({"type":fr,"id":f"sve-{n}","number":str(n),"imageLarge":f"https://images.pokemontcg.io/sve/{n}_hires.png","imageSmall":f"https://images.pokemontcg.io/sve/{n}.png"})
        sets[sid] = {"sourceSet":"sve","sourceYear":2023,"targetYear":int(e.get("year") or 0),"seriesId":series,"energies":rows}

    payload = {"schema":120,"language":"fr","generatedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),"sets":sets,"stats":{"setsWithEraEnergy":len(sets),"seriesWithEnergy":len({x.get('seriesId') for x in sets.values()})}}
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    ENERGY.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    ENERGY_JS.write_text("'use strict';\nwindow.V120_ENERGY_CATALOG=" + compact + ";\n", encoding="utf-8")
    return payload


def download_hd_booster(product: dict[str, Any]) -> tuple[dict[str, Any], str]:
    pid = str(product.get("sourceId") or "").strip()
    if not pid.isdigit():
        return product, ""
    url = TCGPLAYER_HD.format(product_id=pid)
    try:
        data, ctype = get_bytes(url, retries=3, timeout=40)
        if len(data) < 12000:
            raise RuntimeError(f"image HD trop petite: {len(data)}")
        ext = sealed_importer.image_ext(data, ctype)
        HD_DIR.mkdir(parents=True, exist_ok=True)
        path = HD_DIR / f"tcgplayer-{pid}{ext}"; path.write_bytes(data)
        rel = path.relative_to(A).as_posix()
        size = v117.image_size(rel)
        # TCGplayer documente ce rendu comme une image produit 1000x1000. Beaucoup
        # de wrappers sont donc centrés sur un canevas carré : le ratio du FICHIER
        # n'est pas le ratio du sachet. Le filtre portrait reste appliqué aux images
        # SealedDex non structurées ; pour ce CDN produit de confiance on exige à
        # la place une vraie définition minimale, sans rejeter un bon scan carré.
        if not size or min(size) < 450 or max(size) < 450:
            path.unlink(missing_ok=True); return product, ""
        return product, rel
    except Exception:
        return product, ""


def finalize_products(index: dict[str, Any]) -> dict[str, Any]:
    payload = json.loads(SEALED.read_text(encoding="utf-8"))
    entries = [x for x in index.get("sets") or [] if isinstance(x, dict) and x.get("id")]
    index_by_id = {str(x["id"]): x for x in entries}

    # Reprend les boosters TCGCSV que l'ancien importeur retirait lorsqu'il trouvait
    # des miniatures SealedDex, puis tente directement l'image CDN 1000x1000.
    tcgcsv, _ = sealed_importer.fetch_tcgcsv(index_by_id)
    loose_tcg = [p for p in tcgcsv if p.get("mode") == "loose" and p.get("sourceId")]
    hd_by_set: dict[str, list[str]] = {}
    with ThreadPoolExecutor(max_workers=12, thread_name_prefix="tcgplayer-hd") as pool:
        futures = [pool.submit(download_hd_booster, p) for p in loose_tcg]
        for future in as_completed(futures):
            p, rel = future.result()
            if rel:
                hd_by_set.setdefault(str(p.get("setId") or ""), []).append(rel)

    names = {str(x["id"]): str(x.get("name") or x["id"]) for x in entries}
    out: dict[str, list[dict[str, Any]]] = {}
    canonical = art_count = hd_sets = low_rejected = shop_verified = unknown = 0
    all_sids = set(names) | set((payload.get("sets") or {}).keys())
    for sid in sorted(all_sids):
        rows = [dict(p) for p in (payload.get("sets") or {}).get(sid, []) if isinstance(p, dict)]
        loose = [p for p in rows if p.get("mode") == "loose" or p.get("type") == "booster_pack"]
        sealed = [p for p in rows if p not in loose]
        combined: list[dict[str, Any]] = []

        artworks: list[str] = []
        for img in hd_by_set.get(sid, []):
            if img not in artworks:
                artworks.append(img)
        if artworks:
            hd_sets += 1
        # SealedDex n'est qu'un complément : on refuse ses logos/paysages et, si
        # une image HD existe, ses miniatures <300 px ne polluent pas le tirage.
        for p in loose:
            img = str(p.get("image") or "")
            if not img or not (A / img).is_file() or not v117.is_portrait_pack_art(img):
                if img: low_rejected += 1
                continue
            size = v117.image_size(img) or (0, 0)
            if artworks and max(size) < 300:
                low_rejected += 1; continue
            if img not in artworks:
                artworks.append(img)
        if artworks:
            booster = {
                "id":f"v117-booster-{sid}","setId":sid,"name":f"Booster {names.get(sid,sid)}",
                "sourceName":f"{names.get(sid,sid)} Booster Pack","kind":"BOOSTER","type":"booster_pack",
                "mode":"loose","qty":1,"opens":1,"image":artworks[0],"artworks":artworks,
                "source":"TCGplayer CDN HD + SealedDex vérifié" if sid in hd_by_set else "SealedDex vérifié",
                "verifiedContents":True,"openable":True,"packCountSource":"booster-pack",
                "v117CanonicalBooster":True,"v120ShopVerified":True,"v120ImageQuality":"hd" if sid in hd_by_set else "best-available",
            }
            combined.append(booster); canonical += 1; art_count += len(artworks); shop_verified += 1

        seen: set[str] = set()
        for p in sealed:
            pid = str(p.get("id") or "")
            if not pid or pid in seen:
                continue
            seen.add(pid); v117.infer_openability(p)
            # Un article reste dans le catalogue de données, mais n'entre dans la
            # boutique Créative que si son contenu est déterminé ou s'il s'agit
            # explicitement d'un accessoire non ouvrable.
            p["v120ShopVerified"] = bool(p.get("openable") or p.get("contentKind") == "accessory")
            if p["v120ShopVerified"]: shop_verified += 1
            else: unknown += 1
            combined.append(p)
        if combined:
            out[sid] = combined

    stats = dict(payload.get("stats") or {})
    stats.update({
        "setsWithVerifiedProducts":len(out),"products":sum(len(v) for v in out.values()),
        "canonicalBoosterSets":canonical,"boosterArtworks":art_count,"v120HdBoosterSets":hd_sets,
        "rejectedLowQualityBoosterImages":low_rejected,"v120ShopVerifiedProducts":shop_verified,
        "unknownContentProducts":unknown,
    })
    payload.update({"sets":out,"stats":stats,"schema":115,"v117Finalized":True,"v120Finalized":True})
    payload["sources"] = list(dict.fromkeys([*(payload.get("sources") or []),"TCGplayer CDN 1000x1000","VOX V1.2 integrity finalizer"]))
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    SEALED.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    SEALED_JS.write_text("window.V115_SEALED_CATALOG=" + compact + ";\n", encoding="utf-8")
    return payload


def main() -> int:
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    external, card_stats = enrich_cards(index)
    # enrich_cards réécrit l'index ; le recharger garde les nouveaux compteurs.
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    energy = build_energy_catalog(index, external)
    products = finalize_products(index)

    base = next((x for x in index.get("sets") or [] if x.get("id") == "base1"), None)
    if not base:
        raise RuntimeError("Set de Base absent")
    base_payload = json.loads((A / "catalog" / "fr" / str(base["file"])).read_text(encoding="utf-8"))
    base_rarities = [str(c.get("rarityRaw") or "") for c in base_payload.get("cards") or []]
    if not any("Rare Holo" in x for x in base_rarities):
        raise RuntimeError("Set de Base: aucune Rare Holo après enrichissement")
    if not any(x == "Rare" for x in base_rarities):
        raise RuntimeError("Set de Base: aucune Rare simple après enrichissement")
    if int(products.get("stats",{}).get("canonicalBoosterSets") or 0) < 90:
        raise RuntimeError("Couverture boosters canoniques insuffisante")
    if int(products.get("stats",{}).get("v120HdBoosterSets") or 0) < 50:
        raise RuntimeError("Trop peu de boosters avec visuel HD TCGplayer")
    print("V1.2 card integrity:", card_stats)
    print("V1.2 energy integrity:", energy.get("stats"))
    print("V1.2 product integrity:", products.get("stats"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())