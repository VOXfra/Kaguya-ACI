#!/usr/bin/env python3
"""Entrée release robuste de l'importeur universel VOX Card Sim.

TCGdex a actuellement deux incohérences GraphQL côté serveur :
- `sets()` interprète `pagination`/`sort` comme filtres si `filters:{}` est absent ;
- le champ GraphQL `Card.rarity` est déclaré non-null mais peut pourtant être nul
  dans certaines localisations, ce qui annule toute une page GraphQL.

La release contourne ces défauts sans inventer de données :
1. GraphQL reste utilisé pour découvrir *toutes* les collections et toutes leurs
   cartes en français, sans demander le champ `rarity` cassé ;
2. les cartes sont enrichies en parallèle via l'endpoint REST individuel TCGdex,
   qui expose la rareté et les variantes sans faire tomber une collection entière ;
3. une carte que TCGdex ne sait réellement pas décrire reste explicitement
   partielle/quarantainée par l'importeur normal, au lieu de recevoir une valeur
   supposée.

Le résultat reste entièrement générique : aucune liste d'extensions n'est codée
ici et la langue continue d'être fournie par `--lang`.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib.parse

import import_all_collections as importer

# TCGdex exige actuellement un objet filters vide pour que pagination/sort soient
# interprétés comme des arguments et non comme des filtres de recherche.
needle = "sets(pagination:{page:$page,itemsPerPage:$count},sort:"
replacement = "sets(filters:{},pagination:{page:$page,itemsPerPage:$count},sort:"
if needle not in importer.GRAPHQL_QUERY_TEMPLATE:
    raise RuntimeError("Contrat GraphQL TCGdex inattendu : patch filters non appliqué")
importer.GRAPHQL_QUERY_TEMPLATE = importer.GRAPHQL_QUERY_TEMPLATE.replace(needle, replacement, 1)

# Le serveur GraphQL peut retourner null pour Card.rarity alors que le schéma
# l'annonce non-null. Demander ce champ fait alors échouer toute la page. On le
# retire de la requête de découverte et on le récupère via REST juste après.
rarity_token = "id localId name image rarity"
if rarity_token not in importer.GRAPHQL_QUERY_TEMPLATE:
    raise RuntimeError("Contrat GraphQL TCGdex inattendu : champ rarity introuvable")
importer.GRAPHQL_QUERY_TEMPLATE = importer.GRAPHQL_QUERY_TEMPLATE.replace(
    rarity_token, "id localId name image", 1
)

_base_graphql_sets = importer.graphql_sets


def _rich_graphql_sets(lang: str):
    sets = _base_graphql_sets(lang)
    cards = []
    for set_row in sets:
        for card in set_row.get("cards") or []:
            if isinstance(card, dict) and card.get("id"):
                cards.append(card)

    # L'endpoint individuel est beaucoup plus tolérant que la résolution GraphQL
    # imbriquée. La concurrence reste volontairement modérée pour ne pas marteler
    # TCGdex ; request_json possède déjà retry/backoff pour 429/5xx.
    total = len(cards)
    print(f"  Enrichissement REST fiable : {total} carte(s)")

    def fetch(card):
        cid = str(card.get("id") or "")
        url = (
            f"{importer.API_ROOT}/{urllib.parse.quote(lang)}/cards/"
            f"{urllib.parse.quote(cid, safe='')}"
        )
        try:
            detail = importer.request_json(url, retries=5)
            return card, detail if isinstance(detail, dict) else None, None
        except Exception as exc:
            # L'importeur marquera proprement la carte/collection comme partielle.
            # Un défaut de données de la source ne doit pas supprimer le set.
            return card, None, str(exc)

    done = failed = 0
    with ThreadPoolExecutor(max_workers=24, thread_name_prefix="tcgdex") as pool:
        futures = [pool.submit(fetch, card) for card in cards]
        for future in as_completed(futures):
            card, detail, error = future.result()
            done += 1
            if detail:
                # Ne remplace que par des valeurs réellement retournées par TCGdex.
                for key in ("name", "image", "rarity", "variants", "boosters"):
                    value = detail.get(key)
                    if value not in (None, "", [], {}):
                        card[key] = value
            else:
                failed += 1
                card["__enrichmentError"] = error or "REST detail absent"
            if done % 500 == 0 or done == total:
                print(f"  détails {done}/{total} · {failed} échec(s)")

    # Un échec individuel n'est pas transformé en fausse donnée. Le normaliseur
    # classera le set concerné en `partial`, mais les autres collections restent
    # exploitables et l'index contient bien toutes les collections découvertes.
    return sets


importer.graphql_sets = _rich_graphql_sets

if __name__ == "__main__":
    raise SystemExit(importer.main())
