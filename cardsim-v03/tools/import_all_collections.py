#!/usr/bin/env python3
"""Importeur universel et validant de collections pour VOX Card Sim.

L'outil découvre *toutes* les collections exposées par TCGdex pour une langue.
Il ne contient aucune liste d'extensions codée en dur. Pour chaque carte il garde
le nom/scan de la langue demandée, puis récupère les métadonnées canoniques
(rareté, variantes et Cardmarket) afin que le jeu puisse réellement exploiter le
catalogue.

Principe important : aucune donnée n'est inventée pour masquer un trou de source.
Un set incomplet est importé en état ``partial`` et la CI peut utiliser --strict
pour refuser sa publication. C'est volontairement plus sûr qu'un faux catalogue.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

API_ROOT = "https://api.tcgdex.net/v2"
USER_AGENT = "VOX-CardSim-Importer/1.1 (+https://github.com/VOXfra/Kaguya-ACI)"
LANG_RE = re.compile(r"^[a-z]{2}(?:-[a-z]{2})?$")


def request_json(url: str, retries: int = 8) -> Any:
    """GET JSON robuste : retry exponentiel, Retry-After et timeout borné."""
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=45) as response:
                if not (200 <= response.status < 300):
                    raise RuntimeError(f"HTTP {response.status}")
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code not in (408, 425, 429, 500, 502, 503, 504):
                break
            retry_after = exc.headers.get("Retry-After") if exc.headers else None
            try:
                delay = max(float(retry_after), 0.5) if retry_after else 0.0
            except ValueError:
                delay = 0.0
            time.sleep(max(delay, min(12.0, 0.65 * (2**attempt))))
        except Exception as exc:
            last = exc
            time.sleep(min(12.0, 0.65 * (2**attempt)))
    raise RuntimeError(f"{url}: {last}")


def safe_filename(set_id: str) -> str:
    value = re.sub(r"[^A-Za-z0-9._-]+", "_", set_id).strip("._")
    if not value:
        raise ValueError(f"ID de set inutilisable: {set_id!r}")
    return value + ".json"


def number_key(value: Any) -> tuple[int, str]:
    raw = str(value or "")
    head = raw.split("/", 1)[0]
    head = re.sub(r"^0+(?=\d)", "", head)
    return (int(head), raw) if head.isdigit() else (10**9, raw)


def norm(value: Any) -> str:
    return " ".join(str(value or "").strip().casefold().replace("é", "e").split())


def game_rarity(raw: Any) -> str:
    """Normalise sans perdre la rareté originale, conservée séparément."""
    r = norm(raw)
    if r == "common":
        return "common"
    if r == "uncommon":
        return "uncommon"
    if "mega hyper" in r:
        return "mhr"
    if "hyper" in r or "gold" in r or "secret rare" in r:
        return "hr"
    if "special illustration" in r or "black white" in r:
        return "sir"
    if "shiny ultra" in r:
        return "ur"
    if "ultra" in r or "rainbow" in r:
        return "ur"
    if "shiny" in r or "illustration" in r or "radiant" in r or "amazing" in r:
        return "ir"
    if "double" in r or "vmax" in r or "vstar" in r or "ex" in r or "gx" in r:
        return "double"
    if "rare" in r or "holo" in r or "ace spec" in r or "legend" in r:
        return "rare"
    # Les très vieilles nomenclatures varient beaucoup. On préserve rarityRaw et
    # on classe prudemment dans Rare plutôt que d'inventer un niveau supérieur.
    return "rare"


def supply_tier(raw: Any) -> str:
    r = norm(raw)
    if r == "common":
        return "common"
    if r == "uncommon":
        return "uncommon"
    if "mega hyper" in r:
        return "mhr"
    if "black white" in r:
        return "bwr"
    if "special illustration" in r:
        return "sir"
    if "hyper" in r or "gold" in r or "secret" in r:
        return "hr"
    if "shiny ultra" in r:
        return "shiny_ur"
    if "shiny" in r:
        return "shiny"
    if "ultra" in r or "rainbow" in r:
        return "ur"
    if "illustration" in r or "radiant" in r or "amazing" in r:
        return "ir"
    if "ace spec" in r:
        return "ace"
    if "double" in r or "vmax" in r or "vstar" in r or " ex" in f" {r}" or " gx" in f" {r}":
        return "double"
    return "rare"


def lean_pricing(raw: Any) -> dict[str, Any]:
    cm = (raw or {}).get("cardmarket") if isinstance(raw, dict) else None
    cm = cm or {}
    out: dict[str, Any] = {}
    for key, value in cm.items():
        if key == "updated":
            out[key] = value
        elif isinstance(value, (int, float)) and (key == "low" or key.startswith("trend") or key.startswith("avg")):
            out[key] = value
    return {"cardmarket": out} if out else {}


def set_year(detail: dict[str, Any]) -> int | None:
    release = str(detail.get("releaseDate") or "")
    if len(release) >= 4 and release[:4].isdigit():
        year = int(release[:4])
        if 1990 <= year <= 2100:
            return year
    return None


def series_info(detail: dict[str, Any]) -> tuple[str, str]:
    raw = detail.get("serie") or detail.get("series") or {}
    if isinstance(raw, dict):
        return str(raw.get("id") or ""), str(raw.get("name") or "")
    return "", str(raw or "")


def variants_of(detail: dict[str, Any]) -> list[str]:
    raw = detail.get("variants") or {}
    order = ("normal", "holo", "reverse", "firstEdition")
    variants = [key for key in order if raw.get(key) is True]
    return variants or ["normal"]


def stable_hash(value: Any) -> str:
    blob = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description="Importe toutes les collections TCGdex d'une langue")
    parser.add_argument("--lang", default="fr", help="Langue TCGdex (fr par défaut)")
    parser.add_argument("--assets", default=None, help="Dossier assets Android")
    parser.add_argument("--workers", type=int, default=24, help="Requêtes simultanées")
    parser.add_argument("--strict", action="store_true", help="Échoue si un set est partiel")
    args = parser.parse_args()

    lang = args.lang.strip().lower()
    if not LANG_RE.match(lang):
        raise SystemExit(f"Code langue invalide: {lang}")
    workers = max(1, min(args.workers, 32))
    root = Path(__file__).resolve().parents[1]
    assets = Path(args.assets).resolve() if args.assets else root / "app" / "src" / "main" / "assets"
    out_dir = assets / "catalog" / lang
    out_dir.mkdir(parents=True, exist_ok=True)

    briefs = request_json(f"{API_ROOT}/{urllib.parse.quote(lang)}/sets")
    if not isinstance(briefs, list) or not briefs:
        raise RuntimeError(f"TCGdex {lang}: aucune collection retournée")
    by_id: dict[str, dict[str, Any]] = {}
    for item in briefs:
        if not isinstance(item, dict):
            continue
        sid = str(item.get("id") or "").strip()
        if not sid:
            continue
        if sid in by_id:
            raise RuntimeError(f"TCGdex {lang}: set dupliqué {sid}")
        by_id[sid] = item

    print(f"Import TCGdex {lang}: {len(by_id)} collections découvertes")
    set_details: dict[str, dict[str, Any]] = {}
    failures: list[dict[str, str]] = []

    def fetch_set(sid: str) -> tuple[str, dict[str, Any]]:
        return sid, request_json(f"{API_ROOT}/{urllib.parse.quote(lang)}/sets/{urllib.parse.quote(sid)}")

    with concurrent.futures.ThreadPoolExecutor(max_workers=min(workers, 16)) as pool:
        fs = {pool.submit(fetch_set, sid): sid for sid in by_id}
        for n, future in enumerate(concurrent.futures.as_completed(fs), 1):
            sid = fs[future]
            try:
                got_sid, detail = future.result()
                set_details[got_sid] = detail
            except Exception as exc:
                failures.append({"id": sid, "error": str(exc)})
            if n % 25 == 0 or n == len(fs):
                print(f"  sets {n}/{len(fs)}")

    # Déduplique les détails de cartes : certaines promos peuvent être référencées
    # depuis plusieurs vues, mais une fiche TCGdex ne doit être téléchargée qu'une fois.
    card_jobs: dict[str, dict[str, Any]] = {}
    for sid, detail in set_details.items():
        cards = detail.get("cards") or []
        for brief in cards:
            if not isinstance(brief, dict):
                continue
            cid = str(brief.get("id") or "").strip()
            if cid:
                card_jobs.setdefault(cid, brief)

    details: dict[str, dict[str, Any]] = {}
    detail_failures: dict[str, str] = {}

    def fetch_card(cid: str) -> tuple[str, dict[str, Any]]:
        # Les libellés de rareté et de variantes sont beaucoup plus stables en EN.
        # Si la fiche EN manque, on retente la langue cible avant de déclarer le trou.
        try:
            return cid, request_json(f"{API_ROOT}/en/cards/{urllib.parse.quote(cid)}")
        except Exception:
            return cid, request_json(f"{API_ROOT}/{urllib.parse.quote(lang)}/cards/{urllib.parse.quote(cid)}")

    print(f"Détails structurés: {len(card_jobs)} cartes uniques")
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        fs = {pool.submit(fetch_card, cid): cid for cid in card_jobs}
        for n, future in enumerate(concurrent.futures.as_completed(fs), 1):
            cid = fs[future]
            try:
                got_id, detail = future.result()
                details[got_id] = detail
            except Exception as exc:
                detail_failures[cid] = str(exc)
            if n % 500 == 0 or n == len(fs):
                print(f"  cards {n}/{len(fs)}")

    entries: list[dict[str, Any]] = []
    payloads: dict[str, dict[str, Any]] = {}
    total_cards = total_variants = 0
    for sid, detail in set_details.items():
        source_cards = [x for x in (detail.get("cards") or []) if isinstance(x, dict)]
        declared = detail.get("cardCount") or by_id.get(sid, {}).get("cardCount") or {}
        official = int(declared.get("official") or 0)
        total = int(declared.get("total") or len(source_cards))
        issues: list[str] = []
        if not source_cards:
            issues.append("aucune carte")
        if len(source_cards) != total:
            issues.append(f"cardCount.total={total}, cartes={len(source_cards)}")

        seen_ids: set[str] = set()
        seen_local: set[str] = set()
        cards: list[dict[str, Any]] = []
        missing_scans = missing_details = 0
        rarity_counts: dict[str, int] = {}
        for brief in source_cards:
            cid = str(brief.get("id") or "").strip()
            local_id = str(brief.get("localId") or "").strip()
            if not cid:
                issues.append("id de carte manquant")
                continue
            if cid in seen_ids:
                issues.append(f"id dupliqué: {cid}")
                continue
            seen_ids.add(cid)
            if not local_id:
                issues.append(f"localId manquant: {cid}")
            elif local_id in seen_local:
                issues.append(f"localId dupliqué: {local_id}")
            seen_local.add(local_id)

            structured = details.get(cid) or {}
            if not structured:
                missing_details += 1
            image = str(brief.get("image") or "").strip()
            if not image:
                missing_scans += 1
            raw_rarity = str(structured.get("rarity") or "Rare")
            rarity = game_rarity(raw_rarity)
            rarity_counts[rarity] = rarity_counts.get(rarity, 0) + 1
            variants = variants_of(structured)
            total_variants += len(variants)
            card = {
                "id": cid,
                "localId": local_id,
                "name": str(brief.get("name") or structured.get("name") or cid),
                "image": image,
                "rarityKey": rarity,
                "rarityRaw": raw_rarity,
                "supplyTier": supply_tier(raw_rarity),
                "variants": variants,
                "pricing": lean_pricing(structured.get("pricing") or {}),
            }
            cards.append(card)

        cards.sort(key=lambda c: number_key(c["localId"]))
        if missing_scans:
            issues.append(f"{missing_scans} scan(s) {lang} non référencé(s)")
        if missing_details:
            issues.append(f"{missing_details} fiche(s) structurée(s) indisponible(s)")
        if len(cards) != total:
            issues.append(f"catalogue final={len(cards)}/{total}")

        serie_id, serie_name = series_info(detail)
        filename = safe_filename(sid)
        core_set = {
            "id": sid,
            "name": str(detail.get("name") or by_id.get(sid, {}).get("name") or sid),
            "logo": str(detail.get("logo") or by_id.get(sid, {}).get("logo") or ""),
            "symbol": str(detail.get("symbol") or by_id.get(sid, {}).get("symbol") or ""),
            "releaseDate": str(detail.get("releaseDate") or ""),
            "year": set_year(detail),
            "seriesId": serie_id,
            "seriesName": serie_name,
            "official": official,
            "total": total,
        }
        stable_payload = {"schema": 111, "language": lang, "set": core_set, "cards": cards, "issues": sorted(set(issues))}
        content_hash = stable_hash(stable_payload)
        entry = {
            **core_set,
            "cards": len(cards),
            "file": filename,
            "status": "ready" if not issues else "partial",
            "missingScans": missing_scans,
            "missingDetails": missing_details,
            "rarities": rarity_counts,
            "contentHash": content_hash,
        }
        payload = {
            "schema": 111,
            "language": lang,
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "contentHash": content_hash,
            "set": entry,
            "cards": cards,
            "issues": sorted(set(issues)),
        }
        entries.append(entry)
        payloads[sid] = payload
        total_cards += len(cards)

    # Les sets les plus récents sont en premier. Ce tri rend le rendu UI déterministe.
    entries.sort(key=lambda s: (-(s.get("year") or 0), str(s.get("releaseDate") or ""), str(s["name"]).casefold()))
    for entry in entries:
        (out_dir / entry["file"]).write_text(
            json.dumps(payloads[entry["id"]], ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )

    ready = sum(1 for x in entries if x["status"] == "ready")
    partial = len(entries) - ready
    index = {
        "schema": 111,
        "language": lang,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "TCGdex REST v2",
        "sets": entries,
        "stats": {
            "discovered": len(by_id),
            "imported": len(entries),
            "ready": ready,
            "partial": partial,
            "failed": len(failures),
            "cards": total_cards,
            "variants": total_variants,
            "missingScans": sum(int(x.get("missingScans") or 0) for x in entries),
            "missingDetails": sum(int(x.get("missingDetails") or 0) for x in entries),
        },
        "failures": failures,
    }
    compact = json.dumps(index, ensure_ascii=False, separators=(",", ":"))
    (assets / "v111_collection_index.json").write_text(compact, encoding="utf-8")
    (assets / "v111_collection_index.js").write_text(
        "'use strict';\nwindow.V111_COLLECTION_INDEX=" + compact + ";\n", encoding="utf-8"
    )
    (assets / "v111_import_report.json").write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")

    if failures:
        print("Collections impossibles à importer:", file=sys.stderr)
        for row in failures:
            print(f"  {row['id']}: {row['error']}", file=sys.stderr)
    if detail_failures:
        print(f"Fiches structurées indisponibles: {len(detail_failures)}", file=sys.stderr)

    print(
        f"Catalogue {lang}: {len(entries)}/{len(by_id)} sets, {total_cards} cartes, "
        f"{ready} complets, {partial} partiels, {len(failures)} set(s) en échec."
    )
    if failures:
        return 2
    if args.strict and partial:
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
