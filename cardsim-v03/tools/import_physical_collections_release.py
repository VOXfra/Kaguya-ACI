#!/usr/bin/env python3
"""Release VOX Card Sim : catalogue physique français, métadonnées de collation riches.

La V1.1.5 utilisait uniquement le détail de carte français TCGdex. C'est suffisant
pour les noms et les scans, mais plusieurs anciennes séries françaises regroupent
les holo/EX/GX sous des raretés trop larges (par exemple simplement ``Rare`` ou
``Ultra Rare``). Une collation historique fiable a besoin de distinguer ces pools.

V1.1.6 conserve donc **strictement** le nom, le scan et le numéro français fournis
par le détail de collection FR, mais enrichit ``rarity``/``variants``/``boosters``
avec le détail anglais TCGdex qui est plus précis sur ces anciennes extensions.
Si le détail anglais échoue, le détail français reste le fallback : aucune carte
n'est supprimée et aucune rareté n'est inventée.

Les extensions du jeu numérique Pokémon TCG Pocket restent exclues par nature de
série. Aucune liste de collections physiques n'est codée en dur.
"""
from __future__ import annotations

import re

import import_all_collections as importer
import import_all_collections_release  # noqa: F401  applique les patches release

DIGITAL_SERIES_IDS = {"tcgp"}

# Le chargeur release appelle importer.request_json aussi bien pour les sets que
# pour les cartes. On intercepte uniquement les détails de cartes FR : leur
# équivalent EN fournit des labels de rareté plus fins. Les détails de sets FR
# sont mémorisés afin de restaurer ensuite les données d'affichage françaises.
_raw_request_json = importer.request_json
_fr_set_details: dict[str, dict] = {}
_fr_card_re = re.compile(r"/fr/cards/([^/?#]+)$")
_fr_set_re = re.compile(r"/fr/sets/([^/?#]+)$")


def v116_request_json(url: str, retries: int = 7):
    text = str(url)
    m = _fr_card_re.search(text)
    if m:
        en_url = text.replace("/fr/cards/", "/en/cards/", 1)
        try:
            return _raw_request_json(en_url, retries=retries)
        except Exception as exc:
            print(f"  rareté EN indisponible {m.group(1)} · fallback FR : {exc}")
            return _raw_request_json(text, retries=retries)

    value = _raw_request_json(text, retries=retries)
    m = _fr_set_re.search(text)
    if m and isinstance(value, dict):
        # Copie légère : les résumés de cartes suffisent à restaurer nom/image/id.
        _fr_set_details[m.group(1)] = {
            "cards": [dict(c) for c in (value.get("cards") or []) if isinstance(c, dict)]
        }
    return value


importer.request_json = v116_request_json
_base_graphql_sets = importer.graphql_sets


def _restore_french_card_identity(rows: list[dict], lang: str) -> None:
    """Restaure les champs visibles FR après l'enrichissement de rareté EN."""
    if lang != "fr":
        return
    restored = 0
    for row in rows:
        sid = str(row.get("id") or "")
        fr = _fr_set_details.get(sid) or {}
        by_id = {str(c.get("id") or ""): c for c in fr.get("cards") or [] if c.get("id")}
        for card in row.get("cards") or []:
            source = by_id.get(str(card.get("id") or ""))
            if not source:
                continue
            for key in ("id", "localId", "name", "image"):
                value = source.get(key)
                if value not in (None, "", [], {}):
                    card[key] = value
            restored += 1
    print(f"  Identité/scans FR restaurés : {restored} carte(s)")


def physical_graphql_sets(lang: str):
    rows = _base_graphql_sets(lang)
    _restore_french_card_identity(rows, lang)

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
