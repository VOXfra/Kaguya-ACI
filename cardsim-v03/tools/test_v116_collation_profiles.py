#!/usr/bin/env python3
"""Contrats de non-régression de la collation V1.1.6.

Ce test est volontairement écrit avant l'implémentation du nouveau moteur : il
formalise ce que l'APK doit garantir et empêche le retour silencieux au vieux
booster Écarlate/Violet de 11 cartes pour toutes les époques.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
A = ROOT / "app" / "src" / "main" / "assets"


def main() -> int:
    idx = json.loads((A / "v111_collection_index.json").read_text(encoding="utf-8"))
    sealed = json.loads((A / "v115_sealed_catalog.json").read_text(encoding="utf-8"))
    profiles = json.loads((A / "v116_collation_profiles.json").read_text(encoding="utf-8"))

    assert profiles["schema"] == 116 and profiles["language"] == "fr"
    sets = profiles["sets"]

    # Chaque extension possédant un vrai booster achetable doit avoir un profil.
    booster_sets = {
        sid for sid, rows in sealed.get("sets", {}).items()
        if any(p.get("mode") == "loose" for p in rows or [])
    }
    missing = sorted(booster_sets - set(sets))
    assert not missing, f"booster(s) sans profil de collation: {missing}"

    # Contrats de structure historiques et spéciaux vérifiables.
    expected = {
        "base1": ("wotc11", 11),
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

    # Tous les profils doivent expliquer leur niveau de certitude. Un taux non
    # documenté peut être approximé par époque, mais jamais présenté comme exact.
    valid_confidence = {"official", "measured", "empirical", "era-empirical", "structure-only"}
    for sid, p in sets.items():
        assert p.get("confidence") in valid_confidence, (sid, p.get("confidence"))
        assert p.get("sources"), f"sources absentes: {sid}"
        assert 1 <= int(p.get("cardCount") or 0) <= 15, sid
        for key, value in (p.get("rates") or {}).items():
            assert 0 <= float(value) <= 1, (sid, key, value)

    # Les sous-collections (Galeries, Shiny Vault, Classic Collection) ne sont
    # jamais ouvertes comme des boosters autonomes : elles alimentent un slot du
    # set parent lorsque celui-ci le prévoit.
    forbidden = {"cel25cc", "sma", "swsh4.5sv", "swsh9.5tg", "swsh10.5tg", "swsh11.5tg", "swsh12.5tg", "swsh12.5gg"}
    assert not (forbidden & set(sets)), sorted(forbidden & set(sets))

    # Les 185 collections du catalogue restent disponibles pour navigation : ce
    # moteur ne doit en supprimer aucune de l'index cartes.
    assert len(idx.get("sets") or []) >= 180
    print(f"V1.1.6 collation: {len(sets)} profils · {len(booster_sets)} sets à booster couverts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
