#!/usr/bin/env python3
"""Make Cardmarket's public Pokémon non-single catalog the shop source of truth.

Cardmarket publishes a public product catalog and price guide for Pokémon.  The
previous CardSim pipeline used TCGCSV/TCGplayer as the product catalog, which is
useful for artwork but can disagree with the European product catalog and can
attach a product to the wrong set when database IDs diverge.

V1.2.2 keeps TCGplayer/SealedDex only as supporting evidence (artwork and explicit
pack counts) and rebuilds the shop rows from Cardmarket's official public files.
No sealed contents are guessed: a Cardmarket product is openable only when an
existing audited row documents its pack count, or when it is a single booster and
the set has a verified collation profile.
"""
from __future__ import annotations

from difflib import SequenceMatcher
import json
import re
import unicodedata
from pathlib import Path
from typing import Any

import import_verified_sealed_products as legacy
import finalize_v117_binders_impl as reconcile

ROOT = Path(__file__).resolve().parents[1]
A = ROOT / "app" / "src" / "main" / "assets"
INDEX = A / "v111_collection_index.json"
SEALED = A / "v115_sealed_catalog.json"
SEALED_JS = A / "v115_sealed_catalog.js"
COLLATION = A / "v116_collation_profiles.json"

CARDMARKET_PRODUCTS = "https://downloads.s3.cardmarket.com/productCatalog/productList/products_nonsingles_6.json"
CARDMARKET_PRICES = "https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json"

PRODUCT_WORDS = re.compile(
    r"booster|display|box|bundle|trainer|collection|blister|tin|deck|portfolio|binder|album|"
    r"playmat|sleeve|pouch|case|kit|battle|accessor|coffret|classeur|deckbox|deck box",
    re.I,
)
BINDER_WORDS = re.compile(r"binder|portfolio|album|classeur", re.I)
BINDER_COLLECTION_WORDS = re.compile(r"binder collection|portfolio collection|album collection", re.I)


def norm(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode("ascii")
    text = text.casefold().replace("&", " and ").replace("pokemon tcg", " ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


def field(row: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in row and row[key] is not None:
            return row[key]
    return default


def payload_rows(payload: Any, *preferred: str) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    if isinstance(payload, dict):
        for key in preferred + ("products", "priceGuides", "prices", "data", "results"):
            rows = payload.get(key)
            if isinstance(rows, list):
                return [x for x in rows if isinstance(x, dict)]
    raise RuntimeError("Cardmarket: format JSON public inattendu")


def load_public(url: str, preferred: tuple[str, ...]) -> list[dict[str, Any]]:
    payload = legacy.get_json(url, retries=5)
    rows = payload_rows(payload, *preferred)
    if not rows:
        raise RuntimeError(f"Cardmarket: fichier public vide: {url}")
    return rows


def price_map(rows: list[dict[str, Any]]) -> dict[str, float]:
    out: dict[str, float] = {}
    for row in rows:
        pid = str(field(row, "idProduct", "id_product", "id", default="") or "").strip()
        if not pid:
            continue
        value = None
        for key in ("trend", "avg30", "avg7", "avg1", "avg", "low"):
            raw = field(row, key, key.replace("_", "-"))
            try:
                n = float(raw)
            except (TypeError, ValueError):
                continue
            if n > 0.01:
                value = n
                break
        if value is not None:
            out[pid] = round(value, 2)
    return out


def classify(name: str, category: str) -> str | None:
    n, c = norm(name), norm(category)
    if "elite trainer box" in n:
        return "etb"
    if "booster bundle" in n:
        return "booster_bundle"
    if "booster box" in n or "booster display" in n or "booster boxes" in c:
        return "booster_box"
    if "booster" in n or c in {"boosters", "booster"}:
        return "booster_pack"
    if "blister" in n or "checklane" in n:
        return "blister"
    if re.search(r"\btin\b|\btins\b", n):
        return "tin"
    if BINDER_WORDS.search(name):
        return "binder_collection" if BINDER_COLLECTION_WORDS.search(name) else "binder"
    if re.search(r"\bdeck\b|battle academy|trainer kit", n):
        return "deck"
    if re.search(r"collection|box set|premium|special set|build and battle|battle kit|case", n):
        return "collection"
    if re.search(r"playmat|sleeve|pouch|accessor|deck box|deckbox", n):
        return "accessory"
    if PRODUCT_WORDS.search(name) or PRODUCT_WORDS.search(category):
        return "sealed"
    return None


def kind(ptype: str) -> str:
    return {
        "booster_pack": "BOOSTER", "booster_box": "DISPLAY", "booster_bundle": "BOOSTER BUNDLE",
        "etb": "ETB", "blister": "BLISTER", "tin": "TIN", "deck": "DECK",
        "binder": "CLASSEUR", "binder_collection": "COLLECTION CLASSEUR",
        "accessory": "ACCESSOIRE", "collection": "COFFRET", "sealed": "PRODUIT SCELLÉ",
    }.get(ptype, "PRODUIT")


def set_aliases(index_by_id: dict[str, dict[str, Any]], old: dict[str, Any]) -> dict[str, list[str]]:
    english, _ = reconcile._english_map(index_by_id)
    # Cardmarket uses the full commercial name for 151.
    if "sv03.5" in index_by_id:
        english["sv03.5"] = "Scarlet & Violet 151"
    aliases: dict[str, list[str]] = {}
    for sid, entry in index_by_id.items():
        vals = [entry.get("name"), entry.get("longName"), english.get(sid)]
        # Existing audited source names provide useful commercial aliases but never
        # create a product by themselves; Cardmarket remains the acceptance source.
        for p in (old.get("sets", {}).get(sid) or []):
            source = str(p.get("sourceName") or "")
            # Strip common product suffixes to recover a set-name alias.
            source = re.sub(
                r"\s*[-–:]?\s*(elite trainer box|pokemon center elite trainer box|booster pack|sleeved booster|"
                r"booster box|booster display|booster bundle|build & battle.*|three pack blister|3 pack blister|"
                r"single pack blister|blister|collection|premium collection|box)\b.*$",
                "", source, flags=re.I,
            ).strip()
            if source:
                vals.append(source)
        if str(entry.get("seriesId") or "").casefold() == "mc" or "mcdonald" in norm(entry.get("name")):
            y = int(entry.get("year") or 0)
            if y:
                vals += [f"McDonald's {y}", f"McDonalds {y}", f"McDonald's Collection {y}", f"McDonald's Promos {y}"]
        clean = []
        for value in vals:
            n = norm(value)
            if len(n) >= 3 and n not in clean:
                clean.append(n)
        aliases[sid] = clean
    return aliases


def match_set(row: dict[str, Any], aliases: dict[str, list[str]], index_by_id: dict[str, dict[str, Any]]) -> str | None:
    name = str(field(row, "name", "Name", default="") or "")
    pn = norm(name)
    if not pn:
        return None

    scored: list[tuple[int, int, str]] = []
    for sid, values in aliases.items():
        entry = index_by_id[sid]
        year = int(entry.get("year") or 0)
        if (str(entry.get("seriesId") or "").casefold() == "mc" or "mcdonald" in norm(entry.get("name"))) and "mcdonald" in pn:
            if year and str(year) in pn:
                scored.append((160, len(str(year)), sid))
        for alias in values:
            tokens = alias.split()
            score = 0
            if pn == alias:
                score = 150
            elif pn.startswith(alias + " "):
                score = 120
            elif len(tokens) >= 2 and re.search(rf"(^| ){re.escape(alias)}( |$)", pn):
                score = 100
            elif len(tokens) == 1 and pn.startswith(alias + " "):
                score = 95
            if score:
                # Prefer the most specific alias; this prevents Evolutions from
                # stealing Prismatic Evolutions and Base Set from stealing Base Set 2.
                scored.append((score, len(alias), sid))

    if not scored:
        return None
    scored.sort(reverse=True)
    best = scored[0]
    contenders = [x for x in scored if x[0] == best[0] and x[1] == best[1]]
    if len({x[2] for x in contenders}) > 1:
        return None
    return best[2]


def compatible(old: dict[str, Any], ptype: str) -> bool:
    ot = str(old.get("type") or "")
    if ptype == "booster_pack":
        return old.get("mode") == "loose" or ot == "booster_pack"
    if ptype == "booster_box":
        return ot in {"booster_box", "display"} or int(old.get("opens") or 0) >= 24
    if ptype == "booster_bundle":
        return "bundle" in ot or "bundle" in norm(old.get("sourceName"))
    if ptype == "etb":
        return ot == "etb" or "elite trainer box" in norm(old.get("sourceName"))
    if ptype in {"binder", "binder_collection"}:
        return old.get("contentKind") == "binder" or BINDER_WORDS.search(str(old.get("sourceName") or "")) is not None
    return ot == ptype or ptype in norm(old.get("sourceName")) or ptype in norm(old.get("name"))


def old_match(rows: list[dict[str, Any]], name: str, ptype: str) -> dict[str, Any] | None:
    if ptype == "booster_pack":
        candidates = [p for p in rows if compatible(p, ptype)]
        candidates.sort(key=lambda p: (bool(p.get("artworks")), bool(p.get("image")), bool(p.get("verifiedContents"))), reverse=True)
        return candidates[0] if candidates else None
    target = norm(name)
    scored: list[tuple[float, dict[str, Any]]] = []
    for p in rows:
        if not compatible(p, ptype):
            continue
        source = norm(p.get("sourceName") or p.get("name"))
        if not source:
            continue
        ratio = SequenceMatcher(None, target, source).ratio()
        if target in source or source in target:
            ratio = max(ratio, .90)
        scored.append((ratio, p))
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0][1] if scored and scored[0][0] >= .62 else None


def main() -> int:
    idx = json.loads(INDEX.read_text(encoding="utf-8"))
    old = json.loads(SEALED.read_text(encoding="utf-8"))
    col = json.loads(COLLATION.read_text(encoding="utf-8")) if COLLATION.is_file() else {"sets": {}}
    index_by_id = {str(x.get("id")): x for x in idx.get("sets") or [] if isinstance(x, dict) and x.get("id")}
    aliases = set_aliases(index_by_id, old)

    cm_products = load_public(CARDMARKET_PRODUCTS, ("products", "productList"))
    cm_prices = price_map(load_public(CARDMARKET_PRICES, ("priceGuides", "priceGuide")))

    by_set: dict[str, list[dict[str, Any]]] = {}
    unmapped = ignored = reused_images = priced = 0
    seen_ids: set[str] = set()

    for raw in cm_products:
        pid = str(field(raw, "idProduct", "id_product", "id", default="") or "").strip()
        name = str(field(raw, "name", "Name", default="") or "").strip()
        category = str(field(raw, "categoryName", "category_name", "category", "Category", default="") or "").strip()
        if not pid or not name or pid in seen_ids:
            continue
        seen_ids.add(pid)
        ptype = classify(name, category)
        if not ptype:
            ignored += 1
            continue
        sid = match_set(raw, aliases, index_by_id)
        if not sid:
            unmapped += 1
            continue

        prior = old_match(list(old.get("sets", {}).get(sid) or []), name, ptype)
        profile = col.get("sets", {}).get(sid)
        is_booster = ptype == "booster_pack"
        openable_booster = bool(is_booster and profile and profile.get("confidence") != "structure-only")
        opens = 1 if openable_booster else 0
        verified_contents = openable_booster
        if prior and not is_booster:
            old_opens = int(prior.get("opens") or 0)
            if old_opens > 0 and prior.get("verifiedContents") is True:
                opens = old_opens
                verified_contents = True

        product: dict[str, Any] = {
            "id": f"cm-{pid}", "setId": sid, "name": name, "sourceName": name,
            "kind": kind(ptype), "type": ptype,
            "mode": "loose" if openable_booster else "sealed", "qty": 1,
            "opens": opens, "openable": bool(opens), "verifiedContents": verified_contents,
            "source": "Cardmarket official public product catalog",
            "sourceId": pid, "cardmarketId": pid,
            "sourceUrl": f"https://www.cardmarket.com/en/Pokemon/Products?idProduct={pid}",
            "v120ShopVerified": True, "v122CardmarketVerified": True,
            "v122CardmarketCategory": category,
        }
        if ptype == "binder":
            product["contentKind"] = "binder"
            product["v117UsableBinder"] = True
            product["grantsBinder"] = True
        elif ptype == "binder_collection":
            product["contentKind"] = "binder_collection"
            product["grantsBinder"] = True
        elif ptype == "accessory":
            product["contentKind"] = "accessory"

        if openable_booster:
            product["v117CanonicalBooster"] = True
        if prior:
            if prior.get("image"):
                product["image"] = prior["image"]
                reused_images += 1
            if is_booster and prior.get("artworks"):
                product["artworks"] = list(prior["artworks"])
            if prior.get("v109BundledArt"):
                product["v109BundledArt"] = True

        if pid in cm_prices:
            product["price"] = cm_prices[pid]
            product["marketTrend"] = cm_prices[pid]
            product["v121RetailBasePrice"] = cm_prices[pid]
            priced += 1

        by_set.setdefault(sid, []).append(product)

    # Stable ordering: single booster first, then displays/ETBs/bundles, then the rest.
    order = {"booster_pack": 0, "booster_box": 1, "etb": 2, "booster_bundle": 3, "blister": 4, "tin": 5,
             "collection": 6, "binder_collection": 7, "binder": 8, "deck": 9, "accessory": 10, "sealed": 11}
    for sid, rows in by_set.items():
        rows.sort(key=lambda p: (order.get(str(p.get("type")), 99), norm(p.get("name")), str(p.get("id"))))
        # Cardmarket can list language/packaging variants with the same name. Keep
        # unique product IDs, but collapse exact duplicate names to the best row.
        unique: dict[tuple[str, str], dict[str, Any]] = {}
        for p in rows:
            key = (str(p.get("type")), norm(p.get("name")))
            cur = unique.get(key)
            if cur is None or (not cur.get("image") and p.get("image")) or (not cur.get("price") and p.get("price")):
                unique[key] = p
        by_set[sid] = list(unique.values())

    products = [p for rows in by_set.values() for p in rows]
    booster_rows = [p for p in products if p.get("mode") == "loose"]
    stats = dict(old.get("stats") or {})
    stats.update({
        "setsWithVerifiedProducts": len(by_set),
        "products": len(products),
        "canonicalBoosterSets": len({p["setId"] for p in booster_rows}),
        "boosterArtworks": sum(max(1, len(p.get("artworks") or [])) for p in booster_rows),
        "v120ShopVerifiedProducts": len(products),
        "cardmarketSourcePrimary": True,
        "cardmarketCatalogRows": len(cm_products),
        "cardmarketPriceRows": len(cm_prices),
        "cardmarketMappedProducts": len(products),
        "cardmarketMappedSets": len(by_set),
        "cardmarketPricedProducts": priced,
        "cardmarketReusedImages": reused_images,
        "cardmarketUnmappedRecognizedRows": unmapped,
        "cardmarketIgnoredRows": ignored,
    })

    payload = dict(old)
    payload["sets"] = by_set
    payload["stats"] = stats
    payload["v122CardmarketFinalized"] = True
    payload["sources"] = [
        "Cardmarket official public Pokémon non-singles product catalog",
        "Cardmarket official public Pokémon price guide",
        "TCGCSV / TCGplayer catalog (supporting content metadata only)",
        "SealedDex (supporting booster artwork only)",
    ]
    SEALED.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    SEALED_JS.write_text("window.V115_SEALED_CATALOG=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")

    required = ["base3", "sv03.5", "sv04.5", "sv05", "sv06", "sv06.5", "sv07", "sv08", "sv08.5", "me01", "me02", "me03", "me04", "me05"]
    missing = [sid for sid in required if sid in index_by_id and not by_set.get(sid)]
    if missing:
        raise RuntimeError(f"Cardmarket: collections commerciales requises sans produit: {missing}")
    for sid in ["base3", "sv03.5", "sv08.5"]:
        if sid in index_by_id and not any(p.get("v122CardmarketVerified") for p in by_set.get(sid, [])):
            raise RuntimeError(f"Cardmarket: contrat produit absent pour {sid}")
    if len(by_set) < 90:
        raise RuntimeError(f"Cardmarket: couverture trop faible: {len(by_set)} sets")
    if len(products) < 250:
        raise RuntimeError(f"Cardmarket: trop peu de produits mappés: {len(products)}")

    print("V1.2.2 Cardmarket catalog:", {
        "source_rows": len(cm_products), "mapped_products": len(products), "mapped_sets": len(by_set),
        "priced": priced, "reused_images": reused_images, "unmapped_recognized": unmapped,
        "ignored": ignored, "boosters": len(booster_rows),
    })
    for sid in ("base3", "sv03.5", "sv08.5"):
        if sid in by_set:
            print(sid, "=>", len(by_set[sid]), "Cardmarket products")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
