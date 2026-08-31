#!/usr/bin/env python3
"""Importeur universel TCGdex pour VOX Card Sim.

Le catalogue ne contient aucune liste d'extensions codée en dur. Il découvre toutes
les collections exposées par TCGdex pour une langue, puis produit un fichier JSON
par collection et un index compact pour Android.

Principe de sûreté : une panne de la source riche ne doit jamais être transformée
en faux succès. GraphQL est le chemin de release car il fournit en une seule passe
les raretés, variantes et artworks de boosters. Le fallback REST reste disponible
manuellement pour diagnostic (`--allow-rest-fallback`) mais n'est pas accepté par le
build de release si les métadonnées riches ne sont pas présentes.

La langue est paramétrable (`--lang fr` par défaut) et le format généré est déjà
prévu pour l'ajout futur d'autres langues.
"""
from __future__ import annotations

import argparse
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
GRAPHQL_URL = API_ROOT + "/graphql"
USER_AGENT = "VOX-CardSim-Importer/1.1 (+https://github.com/VOXfra/Kaguya-ACI)"
LANG_RE = re.compile(r"^[a-z]{2}(?:-[a-z]{2})?$")
PAGE_SIZE = 40


def backoff(attempt: int) -> None:
    time.sleep(min(12.0, 0.65 * (2 ** attempt)))


def request_json(url: str, retries: int = 7) -> Any:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=55) as response:
                if not 200 <= response.status < 300:
                    raise RuntimeError(f"HTTP {response.status}")
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code not in (408, 425, 429, 500, 502, 503, 504):
                break
            retry_after = exc.headers.get("Retry-After") if exc.headers else None
            try:
                delay = max(0.5, float(retry_after)) if retry_after else 0
            except ValueError:
                delay = 0
            time.sleep(delay or min(12.0, 0.65 * (2 ** attempt)))
        except Exception as exc:
            last = exc
            backoff(attempt)
    raise RuntimeError(f"{url}: {last}")


def graphql(query: str, variables: dict[str, Any], retries: int = 6) -> dict[str, Any]:
    body = json.dumps({"query": query, "variables": variables}, separators=(",", ":")).encode("utf-8")
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                GRAPHQL_URL,
                data=body,
                method="POST",
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
            )
            with urllib.request.urlopen(req, timeout=90) as response:
                payload = json.loads(response.read().decode("utf-8"))
            errors = payload.get("errors") or []
            if errors:
                raise RuntimeError(json.dumps(errors, ensure_ascii=False)[:1600])
            data = payload.get("data")
            if not isinstance(data, dict):
                raise RuntimeError("Réponse GraphQL sans objet data")
            return data
        except Exception as exc:
            last = exc
            backoff(attempt)
    raise RuntimeError(f"GraphQL TCGdex: {last}")


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
    r = norm(raw)
    if r in ("common", "commune"):
        return "common"
    if r in ("uncommon", "peu commune"):
        return "uncommon"
    if "mega hyper" in r:
        return "mhr"
    if "special illustration" in r or "illustration speciale" in r or "black white" in r:
        return "sir"
    if "hyper" in r or "gold" in r or "secret rare" in r:
        return "hr"
    if "shiny ultra" in r:
        return "ur"
    if "ultra" in r or "rainbow" in r:
        return "ur"
    if "illustration" in r or "shiny" in r or "radiant" in r or "amazing" in r:
        return "ir"
    if "double" in r or "vmax" in r or "vstar" in r or r.endswith(" ex") or r.endswith(" gx"):
        return "double"
    return "rare"


def supply_tier(raw: Any) -> str:
    r = norm(raw)
    if r in ("common", "commune"):
        return "common"
    if r in ("uncommon", "peu commune"):
        return "uncommon"
    if "mega hyper" in r:
        return "mhr"
    if "black white" in r:
        return "bwr"
    if "special illustration" in r or "illustration speciale" in r:
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
    if "double" in r or "vmax" in r or "vstar" in r or r.endswith(" ex") or r.endswith(" gx"):
        return "double"
    return "rare"


def variants_of(raw: Any) -> list[str]:
    if not isinstance(raw, dict):
        return []
    return [k for k in ("normal", "holo", "reverse", "firstEdition") if raw.get(k) is True]


def stable_hash(value: Any) -> str:
    blob = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


def release_year(value: Any) -> int | None:
    text = str(value or "")
    if len(text) >= 4 and text[:4].isdigit():
        year = int(text[:4])
        return year if 1990 <= year <= 2100 else None
    return None


# TCGdex accepte `@locale(lang: String!)`, mais son implémentation serveur actuelle
# tente d'utiliser directement la valeur du nœud GraphQL. Une variable `$lang`
# déclenche donc `value.indexOf is not a function`. Le code langue est validé par
# LANG_RE puis injecté comme littéral sûr dans le document GraphQL.
GRAPHQL_QUERY_TEMPLATE = r"""
query ImportSets($page:Int!,$count:Int!){
  sets(pagination:{page:$page,itemsPerPage:$count},sort:{field:"releaseDate",order:"DESC"}) @locale(lang:"__LANG__"){
    id name logo symbol releaseDate
    cardCount{official total normal holo reverse firstEd}
    serie{id name}
    boosters{id name logo artwork_front artwork_back}
    cards{
      id localId name image rarity
      variants{normal holo reverse firstEdition wPromo}
      boosters{id name logo artwork_front artwork_back}
    }
  }
}
"""


def graphql_sets(lang: str) -> list[dict[str, Any]]:
    if not LANG_RE.fullmatch(lang):
        raise RuntimeError(f"Langue GraphQL invalide: {lang}")
    query = GRAPHQL_QUERY_TEMPLATE.replace("__LANG__", lang)
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    page = 1
    while True:
        data = graphql(query, {"page": page, "count": PAGE_SIZE})
        rows = data.get("sets") or []
        if not isinstance(rows, list):
            raise RuntimeError("GraphQL sets n'est pas un tableau")
        for row in rows:
            if not isinstance(row, dict):
                continue
            sid = str(row.get("id") or "").strip()
            if not sid:
                raise RuntimeError(f"Set sans ID page {page}")
            if sid in seen:
                raise RuntimeError(f"Pagination GraphQL duplique le set {sid}")
            seen.add(sid)
            out.append(row)
        print(f"  GraphQL page {page}: {len(rows)} set(s) · total {len(out)}")
        if len(rows) < PAGE_SIZE:
            break
        page += 1
        if page > 200:
            raise RuntimeError("Pagination GraphQL anormalement longue")
    if not out:
        raise RuntimeError("GraphQL n'a retourné aucune collection")
    return out


def rest_sets(lang: str) -> list[dict[str, Any]]:
    briefs = request_json(f"{API_ROOT}/{urllib.parse.quote(lang)}/sets")
    if not isinstance(briefs, list):
        raise RuntimeError("REST sets n'est pas un tableau")
    out: list[dict[str, Any]] = []
    for i, brief in enumerate(briefs, 1):
        if not isinstance(brief, dict) or not brief.get("id"):
            continue
        sid = str(brief["id"])
        detail = request_json(f"{API_ROOT}/{urllib.parse.quote(lang)}/sets/{urllib.parse.quote(sid)}")
        if not isinstance(detail, dict):
            raise RuntimeError(f"REST {sid}: réponse invalide")
        detail["__restFallback"] = True
        out.append(detail)
        if i % 25 == 0 or i == len(briefs):
            print(f"  REST sets {i}/{len(briefs)}")
    return out


def booster_row(raw: Any) -> dict[str, str] | None:
    if not isinstance(raw, dict):
        return None
    bid = str(raw.get("id") or "").strip()
    if not bid:
        return None
    return {k: str(raw.get(k) or "") for k in ("id", "name", "logo", "artwork_front", "artwork_back")}


def normalize_set(lang: str, raw: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    sid = str(raw.get("id") or "").strip()
    if not sid:
        raise RuntimeError("set sans id")
    cc = raw.get("cardCount") or {}
    source_cards = [x for x in (raw.get("cards") or []) if isinstance(x, dict)]
    total = int(cc.get("total") or len(source_cards))
    official = int(cc.get("official") or total)
    issues: list[str] = []
    fatal: list[str] = []
    if not source_cards:
        fatal.append("aucune carte")
    if len(source_cards) != total:
        fatal.append(f"cardCount.total={total}, cartes={len(source_cards)}")

    seen_ids: set[str] = set()
    seen_local: set[str] = set()
    cards: list[dict[str, Any]] = []
    missing_scans = missing_rarity = missing_variants = 0
    rarity_counts: dict[str, int] = {}
    for raw_card in source_cards:
        cid = str(raw_card.get("id") or "").strip()
        local = str(raw_card.get("localId") or "").strip()
        if not cid:
            fatal.append("id de carte manquant")
            continue
        if cid in seen_ids:
            fatal.append(f"id dupliqué: {cid}")
            continue
        seen_ids.add(cid)
        if not local:
            fatal.append(f"localId manquant: {cid}")
        elif local in seen_local:
            fatal.append(f"localId dupliqué: {local}")
        seen_local.add(local)

        image = str(raw_card.get("image") or "").strip()
        rarity_raw = str(raw_card.get("rarity") or "").strip()
        variants = variants_of(raw_card.get("variants"))
        if not image:
            missing_scans += 1
        if not rarity_raw:
            missing_rarity += 1
        if not variants:
            missing_variants += 1
        rarity_key = game_rarity(rarity_raw) if rarity_raw else "unknown"
        rarity_counts[rarity_key] = rarity_counts.get(rarity_key, 0) + 1
        card_boosters = [x for x in (booster_row(b) for b in raw_card.get("boosters") or []) if x]
        cards.append({
            "id": cid,
            "localId": local,
            "name": str(raw_card.get("name") or cid),
            "image": image,
            "rarityKey": rarity_key,
            "rarityRaw": rarity_raw,
            "supplyTier": supply_tier(rarity_raw) if rarity_raw else "unknown",
            "variants": variants,
            "boosters": card_boosters,
        })
    cards.sort(key=lambda c: number_key(c["localId"]))

    if missing_scans:
        issues.append(f"{missing_scans} scan(s) {lang} non référencé(s)")
    if missing_rarity:
        issues.append(f"{missing_rarity} rareté(s) absente(s)")
    if missing_variants:
        issues.append(f"{missing_variants} variante(s) absente(s)")
    if raw.get("__restFallback"):
        issues.append("fallback REST: raretés/variantes riches non garanties")

    if fatal:
        raise RuntimeError("; ".join(sorted(set(fatal))))

    serie = raw.get("serie") or {}
    boosters = [x for x in (booster_row(b) for b in raw.get("boosters") or []) if x]
    core = {
        "id": sid,
        "name": str(raw.get("name") or sid),
        "logo": str(raw.get("logo") or ""),
        "symbol": str(raw.get("symbol") or ""),
        "releaseDate": str(raw.get("releaseDate") or ""),
        "year": release_year(raw.get("releaseDate")),
        "seriesId": str(serie.get("id") or "") if isinstance(serie, dict) else "",
        "seriesName": str(serie.get("name") or "") if isinstance(serie, dict) else str(serie or ""),
        "official": official,
        "total": total,
        "boosters": boosters,
    }
    stable = {
        "schema": 111,
        "language": lang,
        "set": core,
        "cards": cards,
        "issues": sorted(set(issues)),
    }
    content_hash = stable_hash(stable)
    entry = {
        **core,
        "cards": len(cards),
        "file": safe_filename(sid),
        "status": "ready" if not issues else "partial",
        "missingScans": missing_scans,
        "missingRarities": missing_rarity,
        "missingVariants": missing_variants,
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
    return entry, payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Importe toutes les collections TCGdex d'une langue")
    parser.add_argument("--lang", default="fr", help="Langue TCGdex (fr par défaut)")
    parser.add_argument("--assets", default=None, help="Dossier assets Android")
    parser.add_argument("--strict", action="store_true", help="Échoue aussi si un set est partiel")
    parser.add_argument(
        "--allow-rest-fallback",
        action="store_true",
        help="Diagnostic uniquement : autorise le fallback REST si GraphQL est indisponible",
    )
    args = parser.parse_args()

    lang = args.lang.strip().lower()
    if not LANG_RE.fullmatch(lang):
        raise SystemExit(f"Code langue invalide: {lang}")
    root = Path(__file__).resolve().parents[1]
    assets = Path(args.assets).resolve() if args.assets else root / "app" / "src" / "main" / "assets"
    out_dir = assets / "catalog" / lang
    out_dir.mkdir(parents=True, exist_ok=True)

    source = "graphql"
    try:
        raw_sets = graphql_sets(lang)
    except Exception as exc:
        if not args.allow_rest_fallback:
            raise RuntimeError(
                "Import riche TCGdex indisponible. Le build est arrêté plutôt que de produire "
                f"un catalogue incomplet: {exc}"
            ) from exc
        print(f"GraphQL indisponible ({exc}), fallback REST de diagnostic.", file=sys.stderr)
        source = "rest-fallback"
        raw_sets = rest_sets(lang)
    if not raw_sets:
        raise RuntimeError(f"TCGdex {lang}: aucune collection retournée")

    seen: set[str] = set()
    entries: list[dict[str, Any]] = []
    payloads: dict[str, dict[str, Any]] = {}
    failures: list[dict[str, str]] = []
    for raw in raw_sets:
        sid = str(raw.get("id") or "")
        if not sid:
            failures.append({"id": "?", "error": "set sans id"})
            continue
        if sid in seen:
            failures.append({"id": sid, "error": "set dupliqué"})
            continue
        seen.add(sid)
        try:
            entry, payload = normalize_set(lang, raw)
            entries.append(entry)
            payloads[sid] = payload
        except Exception as exc:
            failures.append({"id": sid, "error": str(exc)})

    # L'importeur promet toutes les collections découvertes : une seule collection
    # perdue est donc une erreur de release et jamais un avertissement silencieux.
    if failures or len(entries) != len(raw_sets):
        print("Collections non importées :", file=sys.stderr)
        for row in failures:
            print(f"  {row['id']}: {row['error']}", file=sys.stderr)

    entries.sort(
        key=lambda s: (-(s.get("year") or 0), str(s.get("releaseDate") or ""), str(s["name"]).casefold())
    )
    for entry in entries:
        (out_dir / entry["file"]).write_text(
            json.dumps(payloads[entry["id"]], ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )

    ready = sum(1 for x in entries if x["status"] == "ready")
    partial = len(entries) - ready
    index = {
        "schema": 111,
        "language": lang,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": f"TCGdex {source}",
        "sets": entries,
        "stats": {
            "discovered": len(raw_sets),
            "imported": len(entries),
            "ready": ready,
            "partial": partial,
            "failed": len(failures),
            "cards": sum(int(x.get("cards") or 0) for x in entries),
            "missingScans": sum(int(x.get("missingScans") or 0) for x in entries),
            "missingRarities": sum(int(x.get("missingRarities") or 0) for x in entries),
            "missingVariants": sum(int(x.get("missingVariants") or 0) for x in entries),
        },
        "failures": failures,
    }
    compact = json.dumps(index, ensure_ascii=False, separators=(",", ":"))
    (assets / "v111_collection_index.json").write_text(compact, encoding="utf-8")
    (assets / "v111_collection_index.js").write_text(
        "'use strict';\nwindow.V111_COLLECTION_INDEX=" + compact + ";\n",
        encoding="utf-8",
    )
    (assets / "v111_import_report.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(
        f"Catalogue {lang}: {len(entries)}/{len(raw_sets)} sets · {index['stats']['cards']} cartes · "
        f"{ready} complets · {partial} partiels · {len(failures)} échec(s) · source {source}."
    )
    if failures or len(entries) != len(raw_sets):
        return 2
    if source != "graphql" and not args.allow_rest_fallback:
        return 4
    if args.strict and partial:
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
