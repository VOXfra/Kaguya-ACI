#!/usr/bin/env python3
"""Release wrapper around the V1.2.2 Cardmarket catalog finalizer.

Cardmarket's own expansion ids are used as a high-confidence mapping anchor. The
shop keeps every real Cardmarket product, but CardSim exposes a direct loose
booster only when the same set has audited booster artwork. If Cardmarket lists a
single pack for a set whose wrapper art is not independently audited, that product
remains a real sealed one-pack product instead of inventing an image.
"""
from __future__ import annotations

from collections import Counter, defaultdict
import json
from typing import Any

import finalize_v122_cardmarket as base


def _eid(row: dict[str, Any]) -> str:
    return str(base.field(row, "idExpansion", "id_expansion", "expansionId", default="") or "").strip()


def _build_expansion_map(rows: list[dict[str, Any]], aliases: dict[str, list[str]], index_by_id: dict[str, dict[str, Any]]) -> tuple[dict[str, str], dict[str, dict[str, int]]]:
    votes: dict[str, Counter[str]] = defaultdict(Counter)
    original = base.match_set
    for row in rows:
        eid = _eid(row)
        if not eid:
            continue
        sid = original(row, aliases, index_by_id)
        if sid:
            votes[eid][sid] += 1
    mapping: dict[str, str] = {}
    audit: dict[str, dict[str, int]] = {}
    for eid, counter in votes.items():
        ranked = counter.most_common()
        if not ranked:
            continue
        top_sid, top_n = ranked[0]
        second_n = ranked[1][1] if len(ranked) > 1 else 0
        if len(ranked) == 1 or (top_n >= 2 and top_n >= max(2, second_n * 2)):
            mapping[eid] = top_sid
            audit[eid] = dict(counter)
    return mapping, audit


def _audited_art(old: dict[str, Any], sid: str) -> tuple[list[str], str]:
    rows = list(old.get("sets", {}).get(sid) or [])
    rows.sort(key=lambda p: (
        bool(p.get("artworks")), bool(p.get("image")),
        bool(p.get("v117CanonicalBooster")), bool(p.get("verifiedContents")),
    ), reverse=True)
    for p in rows:
        arts = [str(x) for x in (p.get("artworks") or []) if str(x)]
        img = str(p.get("image") or "")
        if arts:
            return arts, img or arts[0]
        if img and (p.get("mode") == "loose" or str(p.get("type") or "") == "booster_pack"):
            return [img], img
    return [], ""


def _as_sealed_single_pack(p: dict[str, Any], reason: str) -> None:
    p["mode"] = "sealed"
    p["opens"] = 1
    p["openable"] = True
    p["verifiedContents"] = True
    p["v122SinglePackVariant"] = True
    p["v122LooseDemotionReason"] = reason
    p.pop("v117CanonicalBooster", None)
    p.pop("v122CanonicalCardmarketBooster", None)


def _canonicalize_boosters(old: dict[str, Any]) -> dict[str, int]:
    data = json.loads(base.SEALED.read_text(encoding="utf-8"))
    sets = data.get("sets") or {}
    converted = 0
    multi_sets = 0
    restored_art_sets = 0
    no_art_sets = 0

    for sid, rows in sets.items():
        loose = [p for p in rows or [] if p.get("mode") == "loose"]
        if not loose:
            continue

        def score(p: dict[str, Any]) -> tuple[int, int, int, str]:
            name = base.norm(p.get("name"))
            s = 0
            if p.get("artworks"): s += 100
            if p.get("image"): s += 20
            if p.get("v122CardmarketVerified"): s += 15
            if "sleeved" not in name and "blister" not in name: s += 8
            if name.startswith("booster ") or name.endswith(" booster") or " booster pack" in name: s += 5
            return (s, len(p.get("artworks") or []), -len(name), str(p.get("id") or ""))

        loose.sort(key=score, reverse=True)
        canonical = loose[0]
        if not canonical.get("artworks"):
            arts, image = _audited_art(old, str(sid))
            if arts:
                canonical["artworks"] = arts
                if not canonical.get("image") and image:
                    canonical["image"] = image
                canonical["v122ArtworkReusedFromAuditedCatalog"] = True
                restored_art_sets += 1

        # No audited wrapper art means no direct loose-booster SKU. The Cardmarket
        # product remains in the catalog as a real one-pack sealed product.
        if not canonical.get("artworks"):
            for p in loose:
                _as_sealed_single_pack(p, "no-audited-booster-art")
                converted += 1
            no_art_sets += 1
            if len(loose) > 1:
                multi_sets += 1
            continue

        canonical["mode"] = "loose"
        canonical["opens"] = 1
        canonical["openable"] = True
        canonical["verifiedContents"] = True
        canonical["v117CanonicalBooster"] = True
        canonical["v122CanonicalCardmarketBooster"] = True

        if len(loose) > 1:
            multi_sets += 1
        for p in loose[1:]:
            _as_sealed_single_pack(p, "non-canonical-cardmarket-pack")
            converted += 1

    canonical_rows = [p for rows in sets.values() for p in rows or [] if p.get("mode") == "loose"]
    stats = data.setdefault("stats", {})
    stats["canonicalBoosterSets"] = len({str(p.get("setId") or "") for p in canonical_rows})
    stats["boosterArtworks"] = sum(len(p.get("artworks") or []) for p in canonical_rows)
    stats["v122SinglePackVariants"] = converted
    stats["v122MultiBoosterProductSets"] = multi_sets
    stats["v122AuditedArtworkRestoredSets"] = restored_art_sets
    stats["v122NoAuditedLooseBoosterSets"] = no_art_sets

    for sid, rows in sets.items():
        direct = [p for p in rows or [] if p.get("mode") == "loose"]
        if len(direct) > 1:
            raise RuntimeError(f"Cardmarket: plusieurs boosters canoniques pour {sid}: {len(direct)}")
        if direct:
            p = direct[0]
            if not p.get("v117CanonicalBooster") or int(p.get("opens") or 0) != 1 or p.get("verifiedContents") is not True:
                raise RuntimeError(f"Cardmarket: booster canonique invalide: {sid}")
            if not p.get("artworks"):
                raise RuntimeError(f"Cardmarket: booster canonique sans artwork audité: {sid}")

    base.SEALED.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    base.SEALED_JS.write_text(
        "window.V115_SEALED_CATALOG=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    return {
        "convertedSinglePackVariants": converted,
        "setsWithMultipleSinglePackProducts": multi_sets,
        "canonicalBoosterSets": stats["canonicalBoosterSets"],
        "auditedArtworkRestoredSets": restored_art_sets,
        "noAuditedLooseBoosterSets": no_art_sets,
    }


def main() -> int:
    idx = json.loads(base.INDEX.read_text(encoding="utf-8"))
    old = json.loads(base.SEALED.read_text(encoding="utf-8"))
    index_by_id = {str(x.get("id")): x for x in idx.get("sets") or [] if isinstance(x, dict) and x.get("id")}
    aliases = base.set_aliases(index_by_id, old)

    products = base.load_public(base.CARDMARKET_PRODUCTS, ("products", "productList"))
    prices = base.load_public(base.CARDMARKET_PRICES, ("priceGuides", "priceGuide"))
    expansion_map, expansion_audit = _build_expansion_map(products, aliases, index_by_id)

    original_match = base.match_set
    original_load = base.load_public

    def anchored_match(row: dict[str, Any], aliases_arg: dict[str, list[str]], index_arg: dict[str, dict[str, Any]]) -> str | None:
        eid = _eid(row)
        if eid and eid in expansion_map:
            return expansion_map[eid]
        return original_match(row, aliases_arg, index_arg)

    def cached_load(url: str, preferred: tuple[str, ...]) -> list[dict[str, Any]]:
        if url == base.CARDMARKET_PRODUCTS: return products
        if url == base.CARDMARKET_PRICES: return prices
        return original_load(url, preferred)

    base.match_set = anchored_match
    base.load_public = cached_load
    try:
        rc = base.main()
    finally:
        base.match_set = original_match
        base.load_public = original_load

    data = json.loads(base.SEALED.read_text(encoding="utf-8"))
    stats = data.setdefault("stats", {})
    stats["cardmarketExpansionAnchors"] = len(expansion_map)
    stats["cardmarketExpansionAnchorVotes"] = sum(sum(v.values()) for v in expansion_audit.values())
    base.SEALED.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    base.SEALED_JS.write_text(
        "window.V115_SEALED_CATALOG=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )

    booster_stats = _canonicalize_boosters(old)
    final = json.loads(base.SEALED.read_text(encoding="utf-8"))
    final_stats = final.get("stats") or {}
    print("V1.2.2 Cardmarket expansion anchors:", {
        "anchors": len(expansion_map),
        "anchor_votes": sum(sum(v.values()) for v in expansion_audit.values()),
        "mapped_products": final_stats.get("cardmarketMappedProducts"),
        "mapped_sets": final_stats.get("cardmarketMappedSets"),
        **booster_stats,
    })
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
