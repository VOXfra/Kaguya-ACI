#!/usr/bin/env python3
"""Entrée release robuste de l'importeur universel VOX Card Sim.

TCGdex présente actuellement plusieurs incohérences GraphQL côté serveur :
certains champs déclarés non-null (`Card.rarity`, `Booster.name`, etc.) peuvent
pourtant être nuls dans des données réelles et font alors échouer toute une page.

La stratégie release est donc volontairement défensive et sans approximation :
1. GraphQL sert uniquement à découvrir toutes les collections et les identifiants
   de cartes avec les champs structurels qui restent stables ;
2. les métadonnées riches des sets puis des cartes sont enrichies via les endpoints
   REST individuels TCGdex, en parallèle avec retry/backoff ;
3. une donnée réellement absente reste absente et la collection est marquée
   `partial`, jamais complétée par une valeur inventée.

Aucune liste d'extensions n'est codée en dur et la langue reste paramétrable.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib.parse

import import_all_collections as importer

# TCGdex exige actuellement filters:{} pour distinguer pagination/sort de filtres.
needle = "sets(pagination:{page:$page,itemsPerPage:$count},sort:"
replacement = "sets(filters:{},pagination:{page:$page,itemsPerPage:$count},sort:"
if needle not in importer.GRAPHQL_QUERY_TEMPLATE:
    raise RuntimeError("Contrat GraphQL TCGdex inattendu : patch filters non appliqué")
importer.GRAPHQL_QUERY_TEMPLATE = importer.GRAPHQL_QUERY_TEMPLATE.replace(needle, replacement, 1)

# Réduit la requête GraphQL aux champs structurels. Les champs riches connus pour
# pouvoir casser la résolution (rarity, variants, boosters imbriqués) sont ensuite
# récupérés via REST, où un défaut d'une carte n'annule pas tout un set.
old_block = '''    boosters{id name logo artwork_front artwork_back}
    cards{
      id localId name image rarity
      variants{normal holo reverse firstEdition wPromo}
      boosters{id name logo artwork_front artwork_back}
    }'''
new_block = '''    cards{
      id localId name image
    }'''
if old_block not in importer.GRAPHQL_QUERY_TEMPLATE:
    raise RuntimeError("Contrat GraphQL TCGdex inattendu : bloc riche introuvable")
importer.GRAPHQL_QUERY_TEMPLATE = importer.GRAPHQL_QUERY_TEMPLATE.replace(old_block, new_block, 1)

_base_graphql_sets = importer.graphql_sets


def _get_json(url: str):
    try:
        value = importer.request_json(url, retries=5)
        return value if isinstance(value, dict) else None, None
    except Exception as exc:
        return None, str(exc)


def _rich_graphql_sets(lang: str):
    sets = _base_graphql_sets(lang)

    # Enrichit d'abord chaque collection via REST : boosters/artworks, série,
    # compteurs, logo et autres champs fiables sont conservés quand disponibles.
    def fetch_set(row):
        sid = str(row.get("id") or "")
        url = f"{importer.API_ROOT}/{urllib.parse.quote(lang)}/sets/{urllib.parse.quote(sid, safe='')}"
        detail, error = _get_json(url)
        return row, detail, error

    set_failed = 0
    with ThreadPoolExecutor(max_workers=16, thread_name_prefix="tcgdex-set") as pool:
        futures = [pool.submit(fetch_set, row) for row in sets]
        for future in as_completed(futures):
            row, detail, error = future.result()
            if detail:
                # Les cartes GraphQL gardent leur ordre/identifiants ; les autres
                # métadonnées de collection peuvent venir du détail REST.
                graph_cards = row.get("cards")
                for key, value in detail.items():
                    if key == "cards":
                        continue
                    if value not in (None, "", [], {}):
                        row[key] = value
                row["cards"] = graph_cards
            else:
                set_failed += 1
                row["__setEnrichmentError"] = error or "REST set detail absent"
    print(f"  Enrichissement collections REST : {len(sets)} · {set_failed} échec(s)")

    cards = []
    for set_row in sets:
        for card in set_row.get("cards") or []:
            if isinstance(card, dict) and card.get("id"):
                cards.append(card)

    total = len(cards)
    print(f"  Enrichissement cartes REST : {total} carte(s)")

    def fetch_card(card):
        cid = str(card.get("id") or "")
        url = (
            f"{importer.API_ROOT}/{urllib.parse.quote(lang)}/cards/"
            f"{urllib.parse.quote(cid, safe='')}"
        )
        detail, error = _get_json(url)
        return card, detail, error

    done = failed = 0
    with ThreadPoolExecutor(max_workers=24, thread_name_prefix="tcgdex-card") as pool:
        futures = [pool.submit(fetch_card, card) for card in cards]
        for future in as_completed(futures):
            card, detail, error = future.result()
            done += 1
            if detail:
                for key in ("name", "image", "rarity", "variants", "boosters"):
                    value = detail.get(key)
                    if value not in (None, "", [], {}):
                        card[key] = value
            else:
                failed += 1
                card["__enrichmentError"] = error or "REST card detail absent"
            if done % 500 == 0 or done == total:
                print(f"  détails {done}/{total} · {failed} échec(s)")

    # Les éventuelles absences réelles seront transformées en statut `partial`
    # par normalize_set ; toutes les collections découvertes restent dans l'index.
    return sets


importer.graphql_sets = _rich_graphql_sets

if __name__ == "__main__":
    raise SystemExit(importer.main())
