#!/usr/bin/env python3
"""Entrée release robuste de l'importeur universel VOX Card Sim.

TCGdex présente actuellement plusieurs incohérences de données : certains champs
GraphQL déclarés non-null peuvent être nuls et quelques anciennes collections FR
annoncent plus de cartes qu'elles n'en exposent réellement.

La release n'invente rien et ne jette aucune collection :
1. GraphQL découvre les 200 collections et leurs cartes disponibles ;
2. REST enrichit chaque set puis chaque carte (rareté, variantes, artworks) ;
3. si TCGdex FR est incomplet, la collection est importée en `partial` avec le
   nombre de cartes réellement disponibles et le total source conservé séparément.

Ainsi une lacune de la base distante ne casse plus toute l'application et aucune
fausse carte/rareté n'est fabriquée. La langue reste paramétrable.
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

# Réduit la découverte GraphQL aux champs structurels qui ne cassent pas la page.
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
_base_normalize_set = importer.normalize_set


def _get_json(url: str):
    try:
        value = importer.request_json(url, retries=5)
        return value if isinstance(value, dict) else None, None
    except Exception as exc:
        return None, str(exc)


def _rich_graphql_sets(lang: str):
    sets = _base_graphql_sets(lang)

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
        url = f"{importer.API_ROOT}/{urllib.parse.quote(lang)}/cards/{urllib.parse.quote(cid, safe='')}"
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
    return sets


def _rehash(lang: str, entry: dict, payload: dict):
    issues = list(payload.get("issues") or [])
    hash_set = {k: v for k, v in payload.get("set", {}).items() if k != "contentHash"}
    digest = importer.stable_hash({
        "schema": 111,
        "language": lang,
        "set": hash_set,
        "cards": payload.get("cards") or [],
        "issues": issues,
    })
    entry["contentHash"] = digest
    payload["contentHash"] = digest
    payload["set"]["contentHash"] = digest
    return entry, payload


def _release_normalize_set(lang: str, raw: dict):
    """Garde tous les sets, même si TCGdex FR ne publie qu'une partie des cartes."""
    cards = [x for x in (raw.get("cards") or []) if isinstance(x, dict)]
    cc = raw.get("cardCount") or {}
    source_total = int(cc.get("total") or len(cards))
    source_official = int(cc.get("official") or source_total)

    if len(cards) == source_total:
        return _base_normalize_set(lang, raw)

    sid = str(raw.get("id") or "").strip()
    issue = f"source TCGdex {lang} incomplète : {len(cards)}/{source_total} cartes disponibles"

    # Cas extrême : la collection existe dans l'index FR mais TCGdex ne fournit
    # aucune carte FR. On conserve la collection comme shell quarantainé.
    if not cards:
        serie = raw.get("serie") or {}
        boosters = [x for x in (importer.booster_row(b) for b in raw.get("boosters") or []) if x]
        entry = {
            "id": sid,
            "name": str(raw.get("name") or sid),
            "logo": str(raw.get("logo") or ""),
            "symbol": str(raw.get("symbol") or ""),
            "releaseDate": str(raw.get("releaseDate") or ""),
            "year": importer.release_year(raw.get("releaseDate")),
            "seriesId": str(serie.get("id") or "") if isinstance(serie, dict) else "",
            "seriesName": str(serie.get("name") or "") if isinstance(serie, dict) else str(serie or ""),
            "official": 0,
            "total": 0,
            "sourceOfficial": source_official,
            "sourceTotal": source_total,
            "boosters": boosters,
            "cards": 0,
            "file": importer.safe_filename(sid),
            "status": "partial",
            "missingScans": source_total,
            "missingRarities": source_total,
            "missingVariants": source_total,
            "rarities": {},
        }
        payload = {
            "schema": 111,
            "language": lang,
            "generatedAt": importer.time.strftime("%Y-%m-%dT%H:%M:%SZ", importer.time.gmtime()),
            "set": dict(entry),
            "cards": [],
            "issues": [issue],
        }
        return _rehash(lang, entry, payload)

    # Pour une collection partiellement publiée, le runtime travaille sur les
    # cartes réellement disponibles. Le total annoncé par TCGdex reste disponible
    # via sourceTotal/sourceOfficial pour l'UI et les diagnostics.
    patched = dict(raw)
    patched_cc = dict(cc)
    patched_cc["total"] = len(cards)
    patched_cc["official"] = min(source_official, len(cards))
    patched["cardCount"] = patched_cc
    entry, payload = _base_normalize_set(lang, patched)
    entry["status"] = "partial"
    entry["sourceTotal"] = source_total
    entry["sourceOfficial"] = source_official
    payload["set"]["status"] = "partial"
    payload["set"]["sourceTotal"] = source_total
    payload["set"]["sourceOfficial"] = source_official
    issues = list(payload.get("issues") or [])
    if issue not in issues:
        issues.append(issue)
    payload["issues"] = sorted(set(issues))
    return _rehash(lang, entry, payload)


importer.graphql_sets = _rich_graphql_sets
importer.normalize_set = _release_normalize_set

if __name__ == "__main__":
    raise SystemExit(importer.main())
