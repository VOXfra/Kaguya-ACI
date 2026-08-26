#!/usr/bin/env python3
"""Tests de régression locaux pour la consolidation V1.3.5."""
from __future__ import annotations

import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

import finalize_v135_catalog_completeness as v135


def test_local_id_key() -> None:
    assert v135._key("001") == v135._key("1") == "1"
    assert v135._key("SWSH001") == v135._key("SWSH1") == "SWSH1"
    assert v135._key("SVP001") == v135._key("SVP1") == "SVP1"
    assert v135._key("TG01") == "TG1"
    assert v135._key("RC025") == "RC25"


def test_french_row_wins_semantic_duplicate() -> None:
    cards = [
        {
            "id": "svp-001",
            "localId": "001",
            "name": "Poussacha",
            "image": "https://assets.tcgdex.net/fr/sv/svp/001",
            "rarityRaw": "Promo",
            "variants": ["holo"],
        },
        {
            "id": "svp-1",
            "localId": "1",
            "name": "Sprigatito",
            "image": "https://images.pokemontcg.io/svp/1_hires.png",
            "rarityRaw": "Promo",
            "variants": ["normal"],
            "v120FallbackCard": True,
            "fallbackLanguage": "en",
        },
    ]
    merged, dropped = v135._dedupe(cards)
    assert dropped == 1
    assert len(merged) == 1
    card = merged[0]
    assert card["id"] == "svp-001"
    assert card["name"] == "Poussacha"
    assert card["image"].startswith("https://assets.tcgdex.net/fr/")
    assert set(card["variants"]) == {"holo", "normal"}


def test_fallback_scan_can_fill_native_blank() -> None:
    cards = [
        {
            "id": "demo-001",
            "localId": "001",
            "name": "Nom français",
            "image": "",
            "rarityRaw": "Common",
            "variants": ["normal"],
        },
        {
            "id": "demo-1",
            "localId": "1",
            "name": "English name",
            "image": "https://example.invalid/1.png",
            "rarityRaw": "Common",
            "variants": ["normal"],
            "v120FallbackCard": True,
            "fallbackLanguage": "en",
        },
    ]
    merged, dropped = v135._dedupe(cards)
    assert dropped == 1
    assert len(merged) == 1
    assert merged[0]["name"] == "Nom français"
    assert merged[0]["image"] == "https://example.invalid/1.png"


def main() -> int:
    test_local_id_key()
    test_french_row_wins_semantic_duplicate()
    test_fallback_scan_can_fill_native_blank()
    print("V1.3.5 catalog completeness unit tests: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
