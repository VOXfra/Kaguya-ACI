#!/usr/bin/env python3
"""Importeur universel de collections pour VOX Card Sim.

Le but est de ne plus maintenir une liste d'extensions à la main. L'outil découvre
les collections publiées par TCGdex pour une langue, valide chaque set et produit :
- un index compact chargé par l'application ;
- un JSON local par collection avec toutes les cartes et leurs URLs de scan ;
- un rapport de couverture exploitable par la CI.

Par défaut on reste en français. Le paramètre --lang permet déjà de préparer
l'arrivée d'autres langues sans changer le format du jeu.
"""
from __future__ import annotations

import argparse
import concurrent.futures
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
    """GET JSON avec backoff, Retry-After et erreurs lisibles.

    Une erreur ponctuelle ne doit jamais produire silencieusement un catalogue
    incomplet. Après les tentatives, l'appelant décide si le set est mis en quarantaine.
    """
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            )
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
            time.sleep(max(delay, min(12.0, 0.65 * (2 ** attempt))))
        except Exception as exc:  # réseau, timeout, JSON invalide
            last = exc
            time.sleep(min(12.0, 0.65 * (2 ** attempt)))
    raise RuntimeError(f"{url}: {last}")


def safe_filename(set_id: str) -> str:
    value = re.sub(r"[^A-Za-z0-9._-]+", "_", set_id).strip("._")
    if not value:
        raise ValueError(f"ID de set inutilisable: {set_id!r}")
    return value + ".json"


def number_key(value: Any) -> tuple[int, str]:
    raw = str(value or "")
    head = raw.split("/", 1)[0]
    return (int(head), raw) if head.isdigit() else (10**9, raw)


def normalize_card(card: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(card.get("id") or ""),
        "localId": str(card.get("localId") or ""),
        "name": str(card.get("name") or ""),
        "image": str(card.get("image") or ""),
    }


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


def import_set(lang: str, brief: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    sid = str(brief.get("id") or "").strip()
    if not sid:
        raise RuntimeError("set sans id")
    detail = request_json(f"{API_ROOT}/{urllib.parse.quote(lang)}/sets/{urllib.parse.quote(sid)}")
    raw_cards = detail.get("cards") or []
    declared = detail.get("cardCount") or brief.get("cardCount") or {}
    official = int(declared.get("official") or 0)
    total = int(declared.get("total") or len(raw_cards))
    cards = [normalize_card(x) for x in raw_cards if isinstance(x, dict)]
    cards.sort(key=lambda c: number_key(c["localId"]))

    issues: list[str] = []
    if not cards:
        issues.append("aucune carte")
    if len(cards) != total:
        issues.append(f"cardCount.total={total}, cartes={len(cards)}")
    ids = [c["id"] for c in cards]
    if any(not x for x in ids):
        issues.append("id de carte manquant")
    if len(set(ids)) != len(ids):
        issues.append("id de carte dupliqué")
    local_ids = [c["localId"] for c in cards]
    if any(not x for x in local_ids):
        issues.append("localId manquant")
    if any(not c["name"] for c in cards):
        issues.append("nom de carte manquant")
    missing_scans = sum(1 for c in cards if not c["image"])
    if missing_scans:
        issues.append(f"{missing_scans} scan(s) français non référencé(s)")

    serie_id, serie_name = series_info(detail)
    filename = safe_filename(sid)
    status = "ready" if not issues else "partial"
    entry = {
        "id": sid,
        "name": str(detail.get("name") or brief.get("name") or sid),
        "logo": str(detail.get("logo") or brief.get("logo") or ""),
        "symbol": str(detail.get("symbol") or brief.get("symbol") or ""),
        "releaseDate": str(detail.get("releaseDate") or ""),
        "year": set_year(detail),
        "seriesId": serie_id,
        "seriesName": serie_name,
        "official": official,
        "total": total,
        "cards": len(cards),
        "file": filename,
        "status": status,
        "missingScans": missing_scans,
    }
    payload = {
        "schema": 111,
        "language": lang,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "set": entry,
        "cards": cards,
        "issues": issues,
    }
    return entry, payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Importe toutes les collections TCGdex d'une langue")
    parser.add_argument("--lang", default="fr", help="Langue TCGdex (fr par défaut)")
    parser.add_argument("--assets", default=None, help="Dossier assets Android")
    parser.add_argument("--workers", type=int, default=12, help="Téléchargements de sets en parallèle")
    parser.add_argument("--strict", action="store_true", help="Échoue si un set est partiel")
    args = parser.parse_args()

    lang = args.lang.strip().lower()
    if not LANG_RE.match(lang):
        raise SystemExit(f"Code langue invalide: {lang}")
    root = Path(__file__).resolve().parents[1]
    assets = Path(args.assets).resolve() if args.assets else root / "app" / "src" / "main" / "assets"
    out_dir = assets / "catalog" / lang
    out_dir.mkdir(parents=True, exist_ok=True)

    briefs = request_json(f"{API_ROOT}/{urllib.parse.quote(lang)}/sets")
    if not isinstance(briefs, list) or not briefs:
        raise RuntimeError(f"TCGdex {lang}: aucune collection retournée")
    seen: set[str] = set()
    clean_briefs: list[dict[str, Any]] = []
    for item in briefs:
        if not isinstance(item, dict):
            continue
        sid = str(item.get("id") or "").strip()
        if not sid:
            continue
        if sid in seen:
            raise RuntimeError(f"TCGdex {lang}: set dupliqué {sid}")
        seen.add(sid)
        clean_briefs.append(item)

    results: list[tuple[dict[str, Any], dict[str, Any]]] = []
    failures: list[dict[str, str]] = []
    print(f"Import TCGdex {lang}: {len(clean_briefs)} collections découvertes")
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(args.workers, 24))) as pool:
        future_map = {pool.submit(import_set, lang, b): str(b.get("id") or "?") for b in clean_briefs}
        for n, future in enumerate(concurrent.futures.as_completed(future_map), 1):
            sid = future_map[future]
            try:
                results.append(future.result())
            except Exception as exc:
                failures.append({"id": sid, "error": str(exc)})
            if n % 20 == 0 or n == len(future_map):
                print(f"  {n}/{len(future_map)} traitées")

    # Un set dont l'endpoint entier est indisponible est une vraie erreur d'import :
    # on ne fabrique jamais de contenu fictif pour masquer le problème.
    if failures:
        print("Collections impossibles à importer:", file=sys.stderr)
        for row in failures:
            print(f"  {row['id']}: {row['error']}", file=sys.stderr)

    entries = [x[0] for x in results]
    entries.sort(key=lambda s: (-(s.get("year") or 0), str(s.get("releaseDate") or ""), str(s["name"]).casefold()), reverse=False)
    payload_by_id = {x[0]["id"]: x[1] for x in results}
    for entry in entries:
        (out_dir / entry["file"]).write_text(
            json.dumps(payload_by_id[entry["id"]], ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
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
            "discovered": len(clean_briefs),
            "imported": len(entries),
            "ready": ready,
            "partial": partial,
            "failed": len(failures),
            "cards": sum(int(x.get("cards") or 0) for x in entries),
            "missingScans": sum(int(x.get("missingScans") or 0) for x in entries),
        },
        "failures": failures,
    }
    (assets / "v111_collection_index.json").write_text(
        json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    (assets / "v111_collection_index.js").write_text(
        "'use strict';\nwindow.V111_COLLECTION_INDEX="
        + json.dumps(index, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    (assets / "v111_import_report.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(
        f"Catalogue {lang}: {len(entries)}/{len(clean_briefs)} sets, "
        f"{index['stats']['cards']} cartes, {ready} complets, {partial} partiels, "
        f"{len(failures)} échec(s)."
    )
    if failures:
        return 2
    if args.strict and partial:
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
