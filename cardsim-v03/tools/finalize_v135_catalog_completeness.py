#!/usr/bin/env python3
"""VOX Card Sim V1.3.5 — consolidation stricte des collections physiques.

Cette passe corrige le défaut structurel laissé par V1.2.0/V1.2.6 : une collection
pouvait rester visible avec des cartes ou des scans manquants tout en laissant la
CI signer l'APK. V1.3.5 fusionne uniquement des sources documentées, déduplique
les cartes par numéro local canonique, complète les lignes réellement absentes et
refuse le build tant qu'une collection publiée reste partielle.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

import import_all_collections as importer
import finalize_v126_scan_fallbacks as v126

ROOT = Path(__file__).resolve().parents[1]
A = ROOT / "app" / "src" / "main" / "assets"
INDEX = A / "v111_collection_index.json"
INDEX_JS = A / "v111_collection_index.js"
REPORT = A / "v111_import_report.json"
PTCG_CARDS = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en/{set_id}.json"
UA = "VOX-CardSim-CatalogCompleteness/1.3.5 (+https://github.com/VOXfra/Kaguya-ACI)"

# Ces entrées ne publient actuellement aucun objet carte dans TCGdex. Les laisser
# dans le catalogue jouable créait artificiellement des collections 0/N.
METADATA_ONLY_EXCLUSIONS: dict[str, str] = {
    "jumbo": "agrégat TCGdex sans objets carte publiés",
    "wp": "entrée TCGdex sans objets carte publiés",
}

# Relations déterministes entre identifiants des deux bases.
PTCG_ALIASES: dict[str, str] = {
    **v126.ALIASES,
    "rc": "bw11",  # Radiant Collection = RC1..RC25 de Legendary Treasures.
}


def _key(value: Any) -> str:
    """Clé locale sémantique : 001 == 1, SWSH001 == SWSH1."""
    raw = urllib.parse.unquote(str(value or "")).strip().upper().replace(" ", "")
    match = re.fullmatch(r"([A-Z!?'_.-]*?)(\d+)([A-Z_.-]*)", raw)
    if match:
        return f"{match.group(1)}{int(match.group(2))}{match.group(3)}"
    return raw


def _text(value: Any) -> str:
    return str(value or "").strip()


def _variants(raw: Any) -> list[str]:
    if not isinstance(raw, dict):
        return []
    return [
        output
        for source, output in (
            ("normal", "normal"),
            ("holo", "holo"),
            ("reverse", "reverse"),
            ("firstEdition", "firstEdition"),
            ("wPromo", "wPromo"),
        )
        if raw.get(source) is True
    ]


def _ptcg_variants(row: dict[str, Any]) -> list[str]:
    tcg = row.get("tcgplayer") or {}
    prices = tcg.get("prices") if isinstance(tcg, dict) else {}
    if not isinstance(prices, dict):
        return []
    out: list[str] = []
    for raw in prices:
        key = str(raw).casefold()
        value = ""
        if "reverse" in key:
            value = "reverse"
        elif "1st" in key or "first" in key:
            value = "firstEdition"
        elif "holo" in key:
            value = "holo"
        elif "normal" in key:
            value = "normal"
        if value and value not in out:
            out.append(value)
    return out


def _is_fallback(card: dict[str, Any]) -> bool:
    return bool(
        card.get("v120FallbackCard")
        or card.get("v120FallbackScan")
        or card.get("v126FallbackScan")
        or card.get("v135FallbackCard")
        or card.get("v135FallbackScan")
        or _text(card.get("fallbackLanguage")).casefold() == "en"
        or _text(card.get("v135SourceLanguage")).casefold() == "en"
    )


def _score(card: dict[str, Any]) -> tuple[int, int, int, int]:
    return (
        0 if _is_fallback(card) else 1,
        1 if _text(card.get("image")) else 0,
        1 if _text(card.get("rarityRaw")) else 0,
        1 if card.get("variants") else 0,
    )


def _merge_missing(dst: dict[str, Any], src: dict[str, Any], language: str) -> dict[str, Any]:
    """Complète une ligne sans écraser une donnée FR/native valide."""
    out = dict(dst)
    if (not _text(out.get("name")) or _is_fallback(out)) and _text(src.get("name")):
        out["name"] = _text(src.get("name"))

    if not _text(out.get("image")) and _text(src.get("image")):
        out["image"] = _text(src.get("image"))
        out["imageSmall"] = _text(src.get("imageSmall") or src.get("image"))
        out["imageLarge"] = _text(src.get("imageLarge") or src.get("image"))
        out["v135RecoveredScan"] = True
        out["v135SourceLanguage"] = language
        if language != "fr":
            out["v135FallbackScan"] = True
            out["fallbackLanguage"] = language

    # Une image FR devenue disponible remplace un ancien fallback anglais.
    if language == "fr" and _text(src.get("image")) and _is_fallback(out):
        out["image"] = _text(src.get("image"))
        out["imageSmall"] = _text(src.get("imageSmall") or src.get("image"))
        out["imageLarge"] = _text(src.get("imageLarge") or src.get("image"))
        for key in (
            "v120FallbackScan", "v126FallbackScan", "v135FallbackScan",
            "fallbackLanguage", "fallbackSource", "v126FallbackLanguage",
        ):
            out.pop(key, None)
        out["v135RecoveredFrenchScan"] = True
        out["v135SourceLanguage"] = "fr"

    if not _text(out.get("rarityRaw")) and _text(src.get("rarityRaw")):
        rarity = _text(src.get("rarityRaw"))
        out["rarityRaw"] = rarity
        out["rarityKey"] = importer.game_rarity(rarity)
        out["supplyTier"] = importer.supply_tier(rarity)

    merged_variants: list[str] = []
    for value in list(out.get("variants") or []) + list(src.get("variants") or []):
        value = _text(value)
        if value and value not in merged_variants:
            merged_variants.append(value)
    if merged_variants:
        out["variants"] = merged_variants
    if not out.get("boosters") and src.get("boosters"):
        out["boosters"] = src.get("boosters")
    return out


def _dedupe(cards: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    by_key: dict[str, dict[str, Any]] = {}
    without_key: list[dict[str, Any]] = []
    dropped = 0
    for raw in cards:
        card = dict(raw)
        key = _key(card.get("localId"))
        if not key:
            without_key.append(card)
            continue
        previous = by_key.get(key)
        if previous is None:
            by_key[key] = card
            continue
        dropped += 1
        winner, loser = (card, previous) if _score(card) > _score(previous) else (previous, card)
        language = "en" if _is_fallback(loser) else "fr"
        merged = _merge_missing(winner, loser, language)
        merged["v135Deduplicated"] = True
        by_key[key] = merged
    out = list(by_key.values()) + without_key
    out.sort(key=lambda card: importer.number_key(card.get("localId")))
    return out, dropped


def _tcgdex_card(raw: dict[str, Any], language: str) -> dict[str, Any]:
    rarity = _text(raw.get("rarity"))
    image = _text(raw.get("image"))
    return {
        "id": _text(raw.get("id")),
        "localId": _text(raw.get("localId")),
        "name": _text(raw.get("name")),
        "image": image,
        "imageSmall": image,
        "imageLarge": image,
        "rarityKey": importer.game_rarity(rarity) if rarity else "unknown",
        "rarityRaw": rarity,
        "supplyTier": importer.supply_tier(rarity) if rarity else "unknown",
        "variants": _variants(raw.get("variants")),
        "boosters": [x for x in (importer.booster_row(b) for b in raw.get("boosters") or []) if x],
        "v135Source": "TCGdex",
        "v135SourceLanguage": language,
    }


def _ptcg_card(target_sid: str, raw: dict[str, Any], source_sid: str) -> dict[str, Any]:
    rarity = _text(raw.get("rarity"))
    images = raw.get("images") or {}
    if not isinstance(images, dict):
        images = {}
    large = _text(images.get("large") or images.get("small"))
    small = _text(images.get("small") or images.get("large"))
    local = _text(raw.get("number"))
    return {
        "id": f"{target_sid}-{local}" if local else _text(raw.get("id")),
        "localId": local,
        "name": _text(raw.get("name")),
        "image": large,
        "imageSmall": small,
        "imageLarge": large,
        "rarityKey": importer.game_rarity(rarity) if rarity else "unknown",
        "rarityRaw": rarity,
        "supplyTier": importer.supply_tier(rarity) if rarity else "unknown",
        "variants": _ptcg_variants(raw),
        "boosters": [],
        "v135Source": "pokemon-tcg-data",
        "v135SourceLanguage": "en",
        "v135FallbackScan": bool(large),
        "fallbackLanguage": "en",
        "fallbackSource": "pokemon-tcg-data",
        "v135FallbackSourceSet": source_sid,
        "v135FallbackSourceCard": _text(raw.get("id")),
    }


def _merge_tcgdex(
    target: list[dict[str, Any]], raw_cards: list[dict[str, Any]], language: str
) -> tuple[list[dict[str, Any]], int, int]:
    by_key = {_key(card.get("localId")): card for card in target if _key(card.get("localId"))}
    added = patched = 0
    for raw in raw_cards:
        if not isinstance(raw, dict):
            continue
        incoming = _tcgdex_card(raw, language)
        key = _key(incoming.get("localId"))
        if not key:
            continue
        current = by_key.get(key)
        if current is None:
            incoming["v135RecoveredCard"] = True
            if language != "fr":
                incoming["v135FallbackCard"] = True
                incoming["fallbackLanguage"] = language
            by_key[key] = incoming
            added += 1
        else:
            merged = _merge_missing(current, incoming, language)
            if merged != current:
                by_key[key] = merged
                patched += 1
    out = list(by_key.values())
    out.sort(key=lambda card: importer.number_key(card.get("localId")))
    return out, added, patched


def _merge_ptcg(
    sid: str, target: list[dict[str, Any]], rows: list[dict[str, Any]], source_sid: str
) -> tuple[list[dict[str, Any]], int, int]:
    by_key = {_key(card.get("localId")): card for card in target if _key(card.get("localId"))}
    added = patched = 0
    for raw in rows:
        incoming = _ptcg_card(sid, raw, source_sid)
        key = _key(incoming.get("localId"))
        if not key:
            continue
        current = by_key.get(key)
        if current is None:
            incoming["v135RecoveredCard"] = True
            incoming["v135FallbackCard"] = True
            by_key[key] = incoming
            added += 1
        else:
            merged = _merge_missing(current, incoming, "en")
            if merged != current:
                by_key[key] = merged
                patched += 1
    out = list(by_key.values())
    out.sort(key=lambda card: importer.number_key(card.get("localId")))
    return out, added, patched


def _request_json(url: str, retries: int = 5) -> Any | None:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=55) as response:
                if not 200 <= response.status < 300:
                    raise RuntimeError(f"HTTP {response.status}")
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return None
            last = exc
        except Exception as exc:
            last = exc
        time.sleep(min(8.0, 0.6 * (2 ** attempt)))
    print(f"V1.3.5 source indisponible: {url} · {last}")
    return None


def _fetch_ptcg(sid: str) -> tuple[str, str, list[dict[str, Any]] | None]:
    source_sid = PTCG_ALIASES.get(sid, sid)
    url = PTCG_CARDS.format(set_id=urllib.parse.quote(source_sid, safe="._-"))
    value = _request_json(url)
    if not isinstance(value, list):
        return sid, source_sid, None
    rows = [row for row in value if isinstance(row, dict)]
    if sid == "rc" and source_sid == "bw11":
        rows = [row for row in rows if _key(row.get("number")).startswith("RC")]
    return sid, source_sid, rows or None


def _set_map(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {
        _text(row.get("id")): row
        for row in rows
        if isinstance(row, dict) and _text(row.get("id"))
    }


def _source_total(raw: dict[str, Any] | None) -> int:
    if not isinstance(raw, dict):
        return 0
    count = raw.get("cardCount") or {}
    return int(count.get("total") or count.get("official") or len(raw.get("cards") or [])) if isinstance(count, dict) else len(raw.get("cards") or [])


def _source_official(raw: dict[str, Any] | None) -> int:
    if not isinstance(raw, dict):
        return 0
    count = raw.get("cardCount") or {}
    return int(count.get("official") or 0) if isinstance(count, dict) else 0


def _rehash(index: dict[str, Any], entry: dict[str, Any], payload: dict[str, Any]) -> None:
    stable_set = {key: value for key, value in payload.get("set", {}).items() if key != "contentHash"}
    digest = importer.stable_hash({
        "schema": 111,
        "language": _text(index.get("language") or "fr"),
        "set": stable_set,
        "cards": payload.get("cards") or [],
        "issues": payload.get("issues") or [],
    })
    entry["contentHash"] = digest
    payload["contentHash"] = digest
    payload.setdefault("set", {})["contentHash"] = digest


def _refresh(
    index: dict[str, Any], entry: dict[str, Any], payload: dict[str, Any],
    cards: list[dict[str, Any]], source_total: int, source_official: int, notes: list[str]
) -> None:
    cards.sort(key=lambda card: importer.number_key(card.get("localId")))
    missing_scans = sum(1 for card in cards if not _text(card.get("image")))
    missing_rarities = sum(1 for card in cards if not _text(card.get("rarityRaw")))
    missing_variants = sum(1 for card in cards if not list(card.get("variants") or []))
    fallback_scans = sum(1 for card in cards if _text(card.get("image")) and _is_fallback(card))
    missing_fr = sum(1 for card in cards if not _text(card.get("image")) or _is_fallback(card))
    rarities: dict[str, int] = {}
    for card in cards:
        rarity = _text(card.get("rarityRaw"))
        if rarity:
            card["rarityKey"] = importer.game_rarity(rarity)
            card["supplyTier"] = importer.supply_tier(rarity)
        key = _text(card.get("rarityKey")) or "unknown"
        rarities[key] = rarities.get(key, 0) + 1

    expected = max(int(source_total or 0), len(cards))
    ready = bool(cards) and len(cards) == expected and not (missing_scans or missing_rarities or missing_variants)
    fields = {
        "cards": len(cards),
        "total": len(cards),
        "sourceTotal": expected,
        "sourceOfficial": max(int(source_official or 0), int(entry.get("sourceOfficial") or 0)),
        "official": max(int(entry.get("official") or 0), int(source_official or 0)),
        "status": "ready" if ready else "partial",
        "missingScans": missing_scans,
        "missingRarities": missing_rarities,
        "missingVariants": missing_variants,
        "missingFrenchScans": missing_fr,
        "fallbackScans": fallback_scans,
        "rarities": rarities,
        "metadataStatus": "complete",
        "v135RecoveredCards": sum(1 for card in cards if card.get("v135RecoveredCard")),
        "v135RecoveredScans": sum(1 for card in cards if card.get("v135RecoveredScan") or card.get("v135RecoveredFrenchScan")),
        "v135FallbackScans": sum(1 for card in cards if card.get("v135FallbackScan")),
        "v135DeduplicatedCards": sum(1 for card in cards if card.get("v135Deduplicated")),
    }
    entry.update(fields)
    payload.setdefault("set", {}).update(fields)
    payload["cards"] = cards
    payload["v135Notes"] = sorted(set(notes))
    payload["issues"] = [] if ready else [
        message
        for message in (
            f"{expected-len(cards)} carte(s) manquante(s)" if len(cards) < expected else "",
            f"{missing_scans} scan(s) manquant(s)" if missing_scans else "",
            f"{missing_rarities} rareté(s) manquante(s)" if missing_rarities else "",
            f"{missing_variants} variante(s) manquante(s)" if missing_variants else "",
        )
        if message
    ]
    _rehash(index, entry, payload)


def _write(index: dict[str, Any]) -> None:
    compact = json.dumps(index, ensure_ascii=False, separators=(",", ":"))
    INDEX.write_text(compact, encoding="utf-8")
    INDEX_JS.write_text("'use strict';\nwindow.V111_COLLECTION_INDEX=" + compact + ";\n", encoding="utf-8")
    REPORT.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    original = [row for row in index.get("sets") or [] if isinstance(row, dict) and row.get("id")]
    source_discovered = len(original)

    excluded: list[dict[str, str]] = []
    entries: list[dict[str, Any]] = []
    for entry in original:
        sid = _text(entry.get("id"))
        if sid in METADATA_ONLY_EXCLUSIONS:
            excluded.append({"id": sid, "reason": METADATA_ONLY_EXCLUSIONS[sid]})
            path = A / "catalog" / "fr" / _text(entry.get("file") or f"{sid}.json")
            if path.exists():
                path.unlink()
            continue
        entries.append(entry)
    index["sets"] = entries

    incomplete = {
        _text(entry.get("id"))
        for entry in entries
        if entry.get("status") != "ready"
        or int(entry.get("missingScans") or 0)
        or int(entry.get("missingRarities") or 0)
        or int(entry.get("missingVariants") or 0)
        or int(entry.get("cards") or 0) < int(entry.get("sourceTotal") or entry.get("cards") or 0)
    }
    print(f"V1.3.5 avant consolidation: {len(incomplete)} collection(s) à réparer")

    fr: dict[str, dict[str, Any]] = {}
    en: dict[str, dict[str, Any]] = {}
    source_errors: list[str] = []
    try:
        fr = _set_map(importer.graphql_sets("fr"))
    except Exception as exc:
        source_errors.append(f"TCGdex FR: {exc}")
        print(source_errors[-1])
    try:
        en = _set_map(importer.graphql_sets("en"))
    except Exception as exc:
        source_errors.append(f"TCGdex EN: {exc}")
        print(source_errors[-1])

    ptcg: dict[str, tuple[str, list[dict[str, Any]]]] = {}
    with ThreadPoolExecutor(max_workers=10, thread_name_prefix="v135-ptcg") as pool:
        futures = [pool.submit(_fetch_ptcg, sid) for sid in sorted(incomplete)]
        for future in as_completed(futures):
            sid, source_sid, rows = future.result()
            if rows:
                ptcg[sid] = (source_sid, rows)

    total_added = total_patched = total_deduped = 0
    by_id = {_text(entry.get("id")): entry for entry in entries}
    for sid in sorted(incomplete):
        entry = by_id[sid]
        path = A / "catalog" / "fr" / _text(entry.get("file") or f"{sid}.json")
        if not path.is_file():
            raise RuntimeError(f"V1.3.5: fichier catalogue absent pour {sid}: {path}")
        payload = json.loads(path.read_text(encoding="utf-8"))
        cards, deduped = _dedupe([dict(row) for row in payload.get("cards") or [] if isinstance(row, dict)])
        notes: list[str] = []
        if deduped:
            notes.append(f"{deduped} doublon(s) de numéro local fusionné(s)")
            total_deduped += deduped

        fr_set = fr.get(sid)
        en_set = en.get(sid)
        expected = max(
            int(entry.get("sourceTotal") or 0), int(entry.get("total") or 0),
            _source_total(fr_set), _source_total(en_set),
        )
        official = max(
            int(entry.get("sourceOfficial") or 0), int(entry.get("official") or 0),
            _source_official(fr_set), _source_official(en_set),
        )

        for language, source in (("fr", fr_set), ("en", en_set)):
            if source:
                cards, added, patched = _merge_tcgdex(
                    cards, [row for row in source.get("cards") or [] if isinstance(row, dict)], language
                )
                if added or patched:
                    notes.append(f"TCGdex {language.upper()}: +{added} carte(s), {patched} ligne(s) enrichie(s)")
                total_added += added
                total_patched += patched

        pair = ptcg.get(sid)
        if pair:
            source_sid, rows = pair
            if source_sid == sid or sid == "rc":
                expected = max(expected, len(rows))
            cards, added, patched = _merge_ptcg(sid, cards, rows, source_sid)
            if added or patched:
                notes.append(f"pokemon-tcg-data {source_sid}: +{added} carte(s), {patched} ligne(s) enrichie(s)")
            total_added += added
            total_patched += patched

        _refresh(index, entry, payload, cards, expected, official, notes)
        path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(
            f"V1.3.5 {sid}: {entry['cards']}/{entry['sourceTotal']} · "
            f"scans={entry['missingScans']} · raretés={entry['missingRarities']} · "
            f"variantes={entry['missingVariants']} · {entry['status']}"
        )

    stats = dict(index.get("stats") or {})
    stats.update({
        "discovered": len(entries),
        "imported": len(entries),
        "ready": sum(1 for entry in entries if entry.get("status") == "ready"),
        "partial": sum(1 for entry in entries if entry.get("status") != "ready"),
        "failed": 0,
        "cards": sum(int(entry.get("cards") or 0) for entry in entries),
        "missingScans": sum(int(entry.get("missingScans") or 0) for entry in entries),
        "missingRarities": sum(int(entry.get("missingRarities") or 0) for entry in entries),
        "missingVariants": sum(int(entry.get("missingVariants") or 0) for entry in entries),
        "missingFrenchScans": sum(int(entry.get("missingFrenchScans") or 0) for entry in entries),
        "fallbackScans": sum(int(entry.get("fallbackScans") or 0) for entry in entries),
        "v135SourceDiscovered": source_discovered,
        "v135ExcludedMetadataOnlyCount": len(excluded),
        "v135RecoveredCards": sum(int(entry.get("v135RecoveredCards") or 0) for entry in entries),
        "v135RecoveredScans": sum(int(entry.get("v135RecoveredScans") or 0) for entry in entries),
        "v135FallbackScans": sum(int(entry.get("v135FallbackScans") or 0) for entry in entries),
        "v135DeduplicatedCards": total_deduped,
        "v135SourceErrors": len(source_errors),
    })
    index["stats"] = stats
    index["v135CatalogCompleteness"] = {
        "version": "1.3.5",
        "excludedMetadataOnly": excluded,
        "sourceErrors": source_errors,
        "cardsAdded": total_added,
        "rowsPatched": total_patched,
        "duplicatesMerged": total_deduped,
    }
    index["source"] = _text(index.get("source") or "TCGdex") + " + V1.3.5 strict completeness merge"
    _write(index)

    unresolved = []
    for entry in entries:
        expected = int(entry.get("sourceTotal") or 0)
        if (
            entry.get("status") != "ready"
            or int(entry.get("cards") or 0) != expected
            or int(entry.get("missingScans") or 0)
            or int(entry.get("missingRarities") or 0)
            or int(entry.get("missingVariants") or 0)
        ):
            unresolved.append({
                "id": entry.get("id"),
                "cards": entry.get("cards"),
                "sourceTotal": expected,
                "missingScans": entry.get("missingScans"),
                "missingRarities": entry.get("missingRarities"),
                "missingVariants": entry.get("missingVariants"),
            })

    print("V1.3.5 catalogue strict:", stats)
    if excluded:
        print("V1.3.5 metadata-only exclus:", excluded)
    if unresolved:
        raise RuntimeError(
            "V1.3.5: refus de signer un catalogue partiel: "
            + json.dumps(unresolved, ensure_ascii=False, separators=(",", ":"))
        )
    if source_errors:
        print("V1.3.5 sources indisponibles mais couverture finale complète:", source_errors)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
