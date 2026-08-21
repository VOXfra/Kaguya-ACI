#!/usr/bin/env python3
"""Import release universel TCGdex pour VOX Card Sim.

Le schéma GraphQL public de TCGdex peut actuellement échouer sur des cartes dont
`rarity` est nul alors que le champ est déclaré non-null. Une release ne doit pas
dépendre de ce comportement serveur.

Cette entrée de release utilise donc le chemin REST documenté comme source de
vérité :
- découverte de toutes les collections de la langue ;
- détail de chaque collection en parallèle ;
- détail de chaque carte en parallèle pour récupérer nom, scan, rareté, variantes
  et informations de booster quand TCGdex les fournit ;
- aucune carte, rareté ou image n'est inventée ; une lacune distante est conservée
  comme diagnostic dans le catalogue au lieu de faire disparaître la collection.

Le catalogue reste paramétrable par langue. `--lang fr` est la release actuelle.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import urllib.parse
from pathlib import Path

import import_all_collections as importer

_base_normalize_set = importer.normalize_set


def _get_json(url: str, retries: int = 7):
    try:
        value = importer.request_json(url, retries=retries)
        return value if isinstance(value, dict) else None, None
    except Exception as exc:
        return None, str(exc)


def _rest_rich_sets(lang: str):
    """Découvre puis enrichit tout le catalogue sans dépendre de GraphQL.

    Le listing `/sets` donne la liste canonique des collections. Les réponses de
    détail d'un set ne contiennent que des résumés de cartes : chaque résumé est
    donc enrichi via `/cards/{id}`. Le parallélisme reste borné pour ne pas saturer
    TCGdex ni le téléphone/runner qui génère la release.
    """
    encoded_lang = urllib.parse.quote(lang)
    briefs = importer.request_json(f"{importer.API_ROOT}/{encoded_lang}/sets", retries=8)
    if not isinstance(briefs, list) or not briefs:
        raise RuntimeError("TCGdex REST: aucune collection découverte")

    normalized_briefs = []
    seen = set()
    for raw in briefs:
        if not isinstance(raw, dict):
            continue
        sid = str(raw.get("id") or "").strip()
        if not sid:
            raise RuntimeError("TCGdex REST: collection sans ID")
        if sid in seen:
            raise RuntimeError(f"TCGdex REST: collection dupliquée {sid}")
        seen.add(sid)
        normalized_briefs.append(raw)
    if len(normalized_briefs) < 50:
        raise RuntimeError(f"TCGdex REST: seulement {len(normalized_briefs)} collections")

    def fetch_set(brief):
        sid = str(brief["id"])
        url = f"{importer.API_ROOT}/{encoded_lang}/sets/{urllib.parse.quote(sid, safe='')}"
        detail, error = _get_json(url)
        if detail is None:
            # On conserve le shell : la collection reste visible et explicitement
            # quarantainée au lieu de disparaître silencieusement du catalogue.
            detail = dict(brief)
            detail["cards"] = []
            detail["__setEnrichmentError"] = error or "détail collection absent"
        else:
            # Les champs du listing servent de garde-fou si un détail REST omet
            # ponctuellement logo/cardCount/name.
            for key, value in brief.items():
                if detail.get(key) in (None, "", [], {}):
                    detail[key] = value
        return detail

    sets = []
    set_failures = 0
    with ThreadPoolExecutor(max_workers=16, thread_name_prefix="tcgdex-set") as pool:
        futures = [pool.submit(fetch_set, b) for b in normalized_briefs]
        for future in as_completed(futures):
            row = future.result()
            if row.get("__setEnrichmentError"):
                set_failures += 1
            sets.append(row)
    sets.sort(key=lambda r: str(r.get("id") or ""))
    print(f"  REST collections : {len(sets)} · {set_failures} détail(s) indisponible(s)")

    card_refs = []
    for set_row in sets:
        sid = str(set_row.get("id") or "")
        rows = set_row.get("cards") or []
        if not isinstance(rows, list):
            set_row["cards"] = []
            set_row["__setEnrichmentError"] = "liste de cartes invalide"
            continue
        for card in rows:
            if isinstance(card, dict) and card.get("id"):
                card_refs.append((sid, card))

    total = len(card_refs)
    if total < 5000:
        raise RuntimeError(f"TCGdex REST: seulement {total} cartes découvertes")
    print(f"  REST détails cartes : {total} carte(s)")

    def fetch_card(pair):
        sid, brief = pair
        cid = str(brief.get("id") or "").strip()
        url = f"{importer.API_ROOT}/{encoded_lang}/cards/{urllib.parse.quote(cid, safe='')}"
        detail, error = _get_json(url, retries=6)
        merged = dict(brief)
        if detail:
            # On ne copie que les données utiles au jeu/import. Le payload reste
            # compact malgré plus de vingt mille cartes historiques.
            for key in ("id", "localId", "name", "image", "rarity", "variants", "boosters"):
                value = detail.get(key)
                if value not in (None, "", [], {}):
                    merged[key] = value
        else:
            merged["__enrichmentError"] = error or "détail carte absent"
        return sid, brief, merged

    done = failed = 0
    # 20 workers : assez rapide pour ~20k cartes, mais suffisamment conservateur
    # face aux limites/réessais de l'API publique.
    with ThreadPoolExecutor(max_workers=20, thread_name_prefix="tcgdex-card") as pool:
        futures = [pool.submit(fetch_card, pair) for pair in card_refs]
        for future in as_completed(futures):
            sid, original, merged = future.result()
            original.clear()
            original.update(merged)
            done += 1
            if merged.get("__enrichmentError"):
                failed += 1
            if done % 500 == 0 or done == total:
                print(f"  détails cartes {done}/{total} · {failed} échec(s)")

    print(f"  Enrichissement REST terminé · {failed}/{total} détail(s) carte indisponible(s)")
    return sets


def _rehash(lang: str, entry: dict, payload: dict):
    issues = sorted(set(payload.get("issues") or []))
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
    payload["issues"] = issues
    return entry, payload


def _download_status(entry: dict, payload: dict, source_total: int, available: int):
    """Sépare qualité métadonnées et capacité à télécharger les scans.

    Une rareté/variante absente ne doit pas empêcher de télécharger une collection
    dont tous les scans sont présents. En revanche un scan manquant ou des cartes
    absentes dans la source FR garde le pack en `partial`.
    """
    missing_scans = int(entry.get("missingScans") or 0)
    missing_rarity = int(entry.get("missingRarities") or 0)
    missing_variants = int(entry.get("missingVariants") or 0)
    source_incomplete = source_total > available
    entry["metadataStatus"] = "complete" if not (missing_rarity or missing_variants) else "partial"
    entry["status"] = "ready" if available > 0 and missing_scans == 0 and not source_incomplete else "partial"
    payload["set"].update({
        "status": entry["status"],
        "metadataStatus": entry["metadataStatus"],
    })


def _release_normalize_set(lang: str, raw: dict):
    """Importe chaque collection découverte sans fabriquer ce que TCGdex omet."""
    cards = [x for x in (raw.get("cards") or []) if isinstance(x, dict)]
    cc = raw.get("cardCount") or {}
    source_total = int(cc.get("total") or len(cards))
    source_official = int(cc.get("official") or source_total)
    sid = str(raw.get("id") or "").strip()

    # Un détail set totalement indisponible reste un shell explicite.
    if not cards:
        serie = raw.get("serie") or {}
        boosters = [x for x in (importer.booster_row(b) for b in raw.get("boosters") or []) if x]
        issues = [f"source TCGdex {lang} sans cartes disponibles"]
        if raw.get("__setEnrichmentError"):
            issues.append(str(raw["__setEnrichmentError"]))
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
            "metadataStatus": "partial",
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
            "issues": issues,
        }
        return _rehash(lang, entry, payload)

    patched = dict(raw)
    patched_cc = dict(cc)
    # normalize_set est strict sur cardCount.total ; pour les anciennes bases FR
    # incomplètes on travaille sur les cartes réellement exposées tout en gardant
    # les totaux source séparément pour le diagnostic/UI.
    patched_cc["total"] = len(cards)
    patched_cc["official"] = min(source_official, len(cards))
    patched["cardCount"] = patched_cc
    patched.pop("__restFallback", None)

    entry, payload = _base_normalize_set(lang, patched)
    entry["sourceTotal"] = source_total
    entry["sourceOfficial"] = source_official
    payload["set"]["sourceTotal"] = source_total
    payload["set"]["sourceOfficial"] = source_official

    issues = list(payload.get("issues") or [])
    if source_total != len(cards):
        issues.append(f"source TCGdex {lang} incomplète : {len(cards)}/{source_total} cartes disponibles")
    if raw.get("__setEnrichmentError"):
        issues.append(str(raw["__setEnrichmentError"]))
    failed_details = sum(1 for c in cards if c.get("__enrichmentError"))
    if failed_details:
        issues.append(f"{failed_details} détail(s) carte REST indisponible(s)")

    # Les marqueurs de diagnostic n'ont pas besoin d'être embarqués carte par carte.
    for c in payload.get("cards") or []:
        c.pop("__enrichmentError", None)
    payload["issues"] = sorted(set(issues))
    _download_status(entry, payload, source_total, len(cards))
    return _rehash(lang, entry, payload)


# `main()` conserve toute sa validation d'unicité, de comptage et ses hashes.
# On remplace seulement la source d'import riche par le chemin REST robuste.
importer.graphql_sets = _rest_rich_sets
importer.normalize_set = _release_normalize_set


def _rewrite_source(assets: Path) -> None:
    """Corrige le libellé historique `graphql` produit par main()."""
    p = assets / "v111_collection_index.json"
    if not p.exists():
        return
    idx = json.loads(p.read_text(encoding="utf-8"))
    idx["source"] = "TCGdex REST enrichi"
    compact = json.dumps(idx, ensure_ascii=False, separators=(",", ":"))
    p.write_text(compact, encoding="utf-8")
    (assets / "v111_collection_index.js").write_text(
        "'use strict';\nwindow.V111_COLLECTION_INDEX=" + compact + ";\n", encoding="utf-8"
    )
    (assets / "v111_import_report.json").write_text(
        json.dumps(idx, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    rc = importer.main()
    root = Path(__file__).resolve().parents[1]
    _rewrite_source(root / "app" / "src" / "main" / "assets")
    raise SystemExit(rc)
