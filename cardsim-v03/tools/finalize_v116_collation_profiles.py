#!/usr/bin/env python3
"""Finalise les profils de collation V1.1.6 avant les tests de release.

TCGdex expose quelques entrées physiques qui sont bien des collections de cartes,
mais pas des extensions distribuées sous forme de boosters aléatoires. Le générateur
par époque ne doit donc jamais leur attribuer une composition de booster par simple
ressemblance de série.

Ces entrées restent intégralement présentes dans le catalogue/classeur. Seul leur
profil d'ouverture aléatoire est supprimé :
- ``xy0`` : Bienvenue à Kalos / produit d'initiation, pas une extension à boosters ;
- ``basep`` : Wizards Black Star Promos ;
- ``wp`` : W Promotional.

Le script réécrit à la fois le JSON et son miroir JS afin que CI et APK utilisent
strictement le même catalogue de collation.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
A = ROOT / "app" / "src" / "main" / "assets"
JSON_PATH = A / "v116_collation_profiles.json"
JS_PATH = A / "v116_collation_profiles.js"

NON_RANDOM_BOOSTER_SETS = {"xy0", "basep", "wp"}


def main() -> int:
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    sets = data.get("sets") or {}
    removed = []
    for sid in sorted(NON_RANDOM_BOOSTER_SETS):
        if sid in sets:
            removed.append(sid)
            sets.pop(sid, None)

    # Recalcule les statistiques au lieu de laisser des compteurs devenus faux.
    families = {}
    for profile in sets.values():
        family = str(profile.get("family") or "unknown")
        families[family] = families.get(family, 0) + 1
    stats = data.setdefault("stats", {})
    stats["profiles"] = len(sets)
    stats["families"] = families
    stats["excludedNonRandomProducts"] = removed

    compact = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    JSON_PATH.write_text(compact, encoding="utf-8")
    JS_PATH.write_text("'use strict';\nwindow.V116_COLLATION_PROFILES=" + compact + ";\n", encoding="utf-8")
    print(f"V1.1.6 profils finalisés : {len(sets)} · entrées non-booster exclues : {removed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
