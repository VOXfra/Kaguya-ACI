#!/usr/bin/env python3
"""V1.1.7 physical catalog wrapper.

Keeps the V1.1.6 French TCGdex identity/rarity pipeline, then fills only missing
card scans from the public PokemonTCG data mirror. French scans always win; the
fallback is image-only and never changes the French name, number or rarity.
"""
from __future__ import annotations

import urllib.parse

import import_all_collections as importer
import import_physical_collections_release as v116  # applies V1.1.6 patches

_BASE = importer.graphql_sets
RAW = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en/{sid}.json"
_cache: dict[str, list[dict]] = {}


def _key(value) -> str:
    s = str(value or "").strip().casefold()
    s = s.replace(" ", "").replace("-", "")
    return s.lstrip("0") or "0"


def _fallback_rows(sid: str) -> list[dict]:
    if sid in _cache:
        return _cache[sid]
    try:
        rows = v116._raw_request_json(RAW.format(sid=urllib.parse.quote(sid)), retries=3)
        if not isinstance(rows, list):
            rows = []
    except Exception as exc:
        print(f"  fallback scan externe indisponible {sid}: {exc}")
        rows = []
    _cache[sid] = [x for x in rows if isinstance(x, dict)]
    return _cache[sid]


def _fill_missing_scans(rows: list[dict], lang: str) -> None:
    if lang != "fr":
        return
    restored = 0
    unresolved = 0
    touched_sets = 0
    for row in rows:
        cards = [c for c in (row.get("cards") or []) if isinstance(c, dict)]
        missing = [c for c in cards if not str(c.get("image") or "").strip()]
        if not missing:
            continue
        sid = str(row.get("id") or "")
        source = _fallback_rows(sid)
        if not source:
            unresolved += len(missing)
            continue
        touched_sets += 1
        by_id = {str(x.get("id") or ""): x for x in source if x.get("id")}
        by_num = {_key(x.get("number")): x for x in source if x.get("number") not in (None, "")}
        for card in missing:
            src = by_id.get(str(card.get("id") or "")) or by_num.get(_key(card.get("localId")))
            images = src.get("images") if isinstance(src, dict) else None
            image = str((images or {}).get("large") or (images or {}).get("small") or "").strip() if isinstance(images, dict) else ""
            if image:
                card["image"] = image
                card["v117ScanFallback"] = "PokemonTCG data / English artwork"
                restored += 1
            else:
                unresolved += 1
    print(f"  V1.1.7 scans de secours : {restored} restauré(s) · {unresolved} encore absent(s) · {touched_sets} set(s) complété(s)")


def v117_sets(lang: str):
    rows = _BASE(lang)
    _fill_missing_scans(rows, lang)
    return rows


importer.graphql_sets = v117_sets

if __name__ == "__main__":
    raise SystemExit(importer.main())
