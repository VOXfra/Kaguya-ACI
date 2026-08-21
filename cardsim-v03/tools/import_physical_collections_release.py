#!/usr/bin/env python3
"""Release VOX Card Sim : catalogue physique uniquement.

`import_all_collections_release` fiabilise TCGdex mais TCGdex regroupe aussi les
extensions du jeu numérique Pokémon TCG Pocket (`serie.id == "tcgp"`). VOX Card
Sim simule des objets physiques (boosters, usure, grading, classeurs) : mélanger
ces extensions numériques au catalogue crée de fausses « collections ».

Ce wrapper conserve l'importeur universel et sa future gestion des langues, mais
écarte explicitement les séries numériques connues. Aucune collection physique
n'est codée en dur : le filtrage se fait par nature de série, pas par ID de set.
"""
from __future__ import annotations

import import_all_collections as importer
import import_all_collections_release  # noqa: F401  applique les patches release

DIGITAL_SERIES_IDS = {"tcgp"}

_base_graphql_sets = importer.graphql_sets


def physical_graphql_sets(lang: str):
    rows = _base_graphql_sets(lang)
    physical = []
    excluded = []
    for row in rows:
        serie = row.get("serie") or {}
        series_id = str(serie.get("id") or "") if isinstance(serie, dict) else ""
        if series_id in DIGITAL_SERIES_IDS:
            excluded.append((str(row.get("id") or "?"), str(row.get("name") or "?")))
            continue
        physical.append(row)
    if excluded:
        print(f"  Collections numériques exclues : {len(excluded)} ({', '.join(x[0] for x in excluded)})")
    if not physical:
        raise RuntimeError(f"TCGdex {lang}: aucune collection physique après filtrage")
    return physical


importer.graphql_sets = physical_graphql_sets

if __name__ == "__main__":
    raise SystemExit(importer.main())
