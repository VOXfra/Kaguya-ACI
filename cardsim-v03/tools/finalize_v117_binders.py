#!/usr/bin/env python3
"""Release wrapper for product recovery and source-specific product semantics."""
import json
import finalize_v117_binders_impl as impl

_base_english_map = impl._english_map


def _english_map(index_by_id):
    mapped, source_id = _base_english_map(index_by_id)
    # pokemon-tcg-data calls this set simply "151" while TCGplayer's product
    # group is "Scarlet & Violet 151".
    if "sv03.5" in index_by_id:
        mapped["sv03.5"] = "Scarlet & Violet 151"
        source_id["sv03.5"] = "sv3pt5"
    return mapped, source_id


impl._english_map = _english_map


def _finalize_promo_pack_semantics():
    """Keep real McDonald's packs visible without inventing booster collation."""
    data = json.loads(impl.P.read_text(encoding="utf-8"))
    idx = json.loads(impl.INDEX.read_text(encoding="utf-8"))
    mc_sets = {
        str(x.get("id"))
        for x in idx.get("sets") or []
        if str(x.get("seriesId") or "").casefold() == "mc"
        or "mcdonald" in str(x.get("name") or "").casefold()
    }
    changed = 0
    dirty = False
    for sid in mc_sets:
        for p in data.get("sets", {}).get(sid, []) or []:
            if p.get("mode") == "loose" or p.get("v117CanonicalBooster"):
                p["mode"] = "sealed"
                p["type"] = "promo_pack"
                p["kind"] = "PACK PROMOTIONNEL"
                p["opens"] = 0
                p["openable"] = False
                p["verifiedContents"] = False
                p["contentKind"] = "promo_pack"
                p["v120ShopVerified"] = True
                p.pop("v117CanonicalBooster", None)
                p.pop("artworks", None)
                changed += 1
                dirty = True
            elif p.get("v120RecoveredProduct"):
                if p.get("v120ShopVerified") is not True:
                    p["v120ShopVerified"] = True
                    dirty = True
                if p.get("openable") is not False:
                    p["openable"] = False
                    dirty = True
                if p.get("contentKind") != "promo_pack":
                    p["contentKind"] = "promo_pack"
                    dirty = True
    stats = data.setdefault("stats", {})
    promo_count = sum(
        1
        for sid in mc_sets
        for p in data.get("sets", {}).get(sid, []) or []
        if p.get("contentKind") == "promo_pack"
    )
    if stats.get("verifiedPromoPackProducts") != promo_count:
        stats["verifiedPromoPackProducts"] = promo_count
        dirty = True
    if dirty:
        impl.P.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        impl.J.write_text(
            "window.V115_SEALED_CATALOG="
            + json.dumps(data, ensure_ascii=False, separators=(",", ":"))
            + ";\n",
            encoding="utf-8",
        )
        print(f"V1.2 McDonald's promo packs verified in shop: {promo_count} ({changed} reclassified)")


if __name__ == "__main__":
    rc = impl.main()
    _finalize_promo_pack_semantics()
    raise SystemExit(rc)
