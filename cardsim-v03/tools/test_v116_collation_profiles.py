#!/usr/bin/env python3
"""Contrats de non-régression de la collation et du catalogue produit V1.2.x.

La collation est générée avant ce test. La dernière étape matérialise ensuite le
catalogue Cardmarket officiel : le runtime de collation et l'APK sont ainsi testés
contre exactement le catalogue boutique final, pas contre une ancienne passe
TCGplayer intermédiaire.
"""
from __future__ import annotations

import json
from pathlib import Path

import finalize_v122_cardmarket

ROOT = Path(__file__).resolve().parents[1]
A = ROOT / "app" / "src" / "main" / "assets"


def main() -> int:
    # Cardmarket est la source finale du catalogue physique et des prix. Le script
    # échoue plutôt que de conserver silencieusement un catalogue incomplet.
    finalize_v122_cardmarket.main()

    idx = json.loads((A / "v111_collection_index.json").read_text(encoding="utf-8"))
    sealed = json.loads((A / "v115_sealed_catalog.json").read_text(encoding="utf-8"))
    profiles = json.loads((A / "v116_collation_profiles.json").read_text(encoding="utf-8"))

    assert profiles["schema"] == 116 and profiles["language"] == "fr"
    sets = profiles["sets"]

    # La boutique doit réellement être la passe Cardmarket finale.
    assert sealed.get("v122CardmarketFinalized") is True
    stats = sealed.get("stats") or {}
    assert stats.get("cardmarketSourcePrimary") is True
    assert int(stats.get("cardmarketMappedSets") or 0) >= 90, stats
    assert int(stats.get("cardmarketMappedProducts") or 0) >= 250, stats
    assert int(stats.get("cardmarketPricedProducts") or 0) > 0, stats
    for sid in ["base3", "sv03.5", "sv08.5"]:
        if any(x.get("id") == sid for x in idx.get("sets") or []):
            rows = sealed.get("sets", {}).get(sid) or []
            assert rows, f"Cardmarket: aucun produit final pour {sid}"
            assert any(p.get("v122CardmarketVerified") is True for p in rows), sid

    # Chaque extension possédant un vrai booster directement ouvrable doit avoir
    # un profil. Les autres produits booster Cardmarket peuvent rester scellés si
    # leur collation/packaging exact n'est pas assez documenté.
    booster_sets = {
        sid for sid, rows in sealed.get("sets", {}).items()
        if any(p.get("mode") == "loose" for p in rows or [])
    }
    missing = sorted(booster_sets - set(sets))
    assert not missing, f"booster(s) sans profil de collation: {missing}"

    # Contrats de structure historiques et spéciaux vérifiables.
    expected = {
        "base1": ("wotc11", 11),
        "base3": ("wotc11", 11),
        "neo4": ("wotc11", 11),
        "ecard1": ("ecard9", 9),
        "ex1": ("ex9", 9),
        "dp1": ("dp10", 10),
        "hgss1": ("hgss10", 10),
        "bw1": ("bwxy10", 10),
        "xy1": ("bwxy10", 10),
        "sm1": ("sm11", 11),
        "swsh1": ("swsh11", 11),
        "sv01": ("sv11", 11),
        "dc1": ("double-crisis7", 7),
        "dv1": ("dragon-vault5", 5),
        "det1": ("detective4", 4),
        "g1": ("generations10", 10),
        "cel25": ("celebrations4", 4),
        "pop1": ("pop2", 2),
        "me01": ("sv11", 11),
        "me05": ("sv11", 11),
    }
    for sid, (family, count) in expected.items():
        p = sets.get(sid)
        assert p, f"profil absent: {sid}"
        assert p["family"] == family, (sid, p.get("family"), family)
        assert int(p["cardCount"]) == count, (sid, p.get("cardCount"), count)

    valid_confidence = {"official", "measured", "empirical", "era-empirical", "structure-only"}
    for sid, p in sets.items():
        assert p.get("confidence") in valid_confidence, (sid, p.get("confidence"))
        assert p.get("sources"), f"sources absentes: {sid}"
        assert 1 <= int(p.get("cardCount") or 0) <= 15, sid
        for key, value in (p.get("rates") or {}).items():
            assert 0 <= float(value) <= 1, (sid, key, value)

    forbidden = {"cel25cc", "sma", "swsh4.5sv", "swsh9.5tg", "swsh10.5tg", "swsh11.5tg", "swsh12.5tg", "swsh12.5gg"}
    assert not (forbidden & set(sets)), sorted(forbidden & set(sets))
    assert len(idx.get("sets") or []) >= 180
    print(f"V1.2.x collation: {len(sets)} profils · {len(booster_sets)} boosters Cardmarket directement ouvrables")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
