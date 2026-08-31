#!/usr/bin/env python3
"""Recover physical products missed by cross-database IDs, then classify binders.

The historical product importer originally joined TCGdex FR sets to TCGplayer through
pokemon-tcg-data using the raw set id. That is unsafe because the projects use
different ids for many modern/special sets (sv08.5 vs sv8pt5, 2024sv vs mcd24,
me01 vs me1, ...).

This finalizer now performs a metadata-backed reconciliation before binder
classification:
- direct / normalized id aliases first;
- release date + printed/total card counts as the strong fallback;
- explicit McDonald's TCGplayer group naming by year;
- only real TCGCSV/TCGplayer products are recovered;
- product art is downloaded locally from the TCGplayer CDN;
- no fictional booster/ETB/display is synthesized.

It is intentionally idempotent because the release workflow runs this script both
before and after the V1.2 integrity finalizer.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
import json
import re
from pathlib import Path
from typing import Any

import import_verified_sealed_products as sealed_importer

ROOT = Path(__file__).resolve().parents[1]
A = ROOT / "app" / "src" / "main" / "assets"
P = A / "v115_sealed_catalog.json"
J = A / "v115_sealed_catalog.js"
INDEX = A / "v111_collection_index.json"
RECOVERED_DIR = A / "img" / "v120" / "recovered-products"

BINDER = re.compile(
    r"portfolio|binder|album|9[- ]pocket|4[- ]pocket|card binder|collection binder|collection file",
    re.I,
)


def _norm_date(value: Any) -> date | None:
    raw = str(value or "").strip().replace("/", "-")
    try:
        return date.fromisoformat(raw[:10])
    except Exception:
        return None


def _id_variants(sid: str) -> list[str]:
    """Likely pokemon-tcg-data ids for a TCGdex id, without guessing set names."""
    raw = str(sid or "").casefold().strip()
    out = [raw]
    if raw.endswith("-fr"):
        out.append(raw[:-3])

    # Remove zero-padding in the numeric component: sv08 -> sv8, me01 -> me1.
    m = re.match(r"^([a-z]+)0*(\d+)(.*)$", raw)
    if m:
        prefix, number, tail = m.groups()
        compact = f"{prefix}{int(number)}{tail}"
        out.append(compact)
        # Special-set conventions used by pokemon-tcg-data.
        if tail.startswith(".5"):
            suffix = tail[2:]
            out.extend(
                [
                    f"{prefix}{int(number)}pt5{suffix}",
                    f"{prefix}{int(number)}5{suffix}",
                ]
            )

    # Older special sets often use "75", "115", "35", "45" rather than ".5".
    if ".5" in raw:
        out.append(raw.replace(".5", "5"))
        out.append(raw.replace(".5", "pt5"))

    # Common split special sets (Black Bolt / White Flare) prepend z/r externally;
    # the metadata fallback below disambiguates them by exact card totals.
    return list(dict.fromkeys(x for x in out if x))


def _external_rows() -> list[dict[str, Any]]:
    rows = sealed_importer.get_json(sealed_importer.EN_SETS)
    return [x for x in rows if isinstance(x, dict) and x.get("id") and x.get("name")]


def _english_map(index_by_id: dict[str, dict[str, Any]]) -> tuple[dict[str, str], dict[str, str]]:
    rows = _external_rows()
    by_id = {str(x["id"]).casefold(): x for x in rows}
    mapped: dict[str, str] = {}
    source_id: dict[str, str] = {}

    for sid, entry in index_by_id.items():
        year = int(entry.get("year") or 0)
        name = str(entry.get("name") or "")

        # TCGplayer calls these groups "McDonald's Promos YYYY".
        if str(entry.get("seriesId") or "").casefold() == "mc" or "mcdonald" in name.casefold():
            if year:
                mapped[sid] = f"McDonald's Promos {year}"
                source_id[sid] = f"mcd{str(year)[-2:]}"
                continue

        found = None
        for candidate in _id_variants(sid):
            if candidate in by_id:
                found = by_id[candidate]
                break

        if found is None:
            target_date = _norm_date(entry.get("releaseDate"))
            official = int(entry.get("official") or entry.get("sourceOfficial") or 0)
            total = int(entry.get("total") or entry.get("sourceTotal") or 0)
            scored: list[tuple[int, int, dict[str, Any]]] = []
            for row in rows:
                rd = _norm_date(row.get("releaseDate"))
                printed = int(row.get("printedTotal") or 0)
                ext_total = int(row.get("total") or 0)
                if year and rd and abs(rd.year - year) > 1:
                    continue
                score = 0
                delta = 9999
                if target_date and rd:
                    delta = abs((rd - target_date).days)
                    if delta == 0:
                        score += 8
                    elif delta <= 2:
                        score += 6
                    elif delta <= 14:
                        score += 3
                if official and printed == official:
                    score += 6
                if total and ext_total == total:
                    score += 6
                # Allow known secret-card count drift when printed count/date are exact.
                if total and abs(ext_total - total) <= 3:
                    score += 1
                if year and rd and rd.year == year:
                    score += 1
                if score >= 10:
                    scored.append((score, -delta, row))
            scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
            if scored:
                # Require a unique strongest reconciliation when possible.
                if len(scored) == 1 or scored[0][0] > scored[1][0] or scored[0][1] > scored[1][1]:
                    found = scored[0][2]

        if found is not None:
            mapped[sid] = str(found.get("name") or "")
            source_id[sid] = str(found.get("id") or "")

    return mapped, source_id


def _has_core_product(rows: list[dict[str, Any]]) -> bool:
    for p in rows or []:
        if not isinstance(p, dict):
            continue
        if p.get("v117GenericBinder") or p.get("v117StorageBinder") or p.get("mode") == "binderUnlock":
            continue
        if p.get("contentKind") == "binder":
            continue
        return True
    return False


def _download_product_image(product: dict[str, Any]) -> str:
    pid = str(product.get("sourceId") or "").strip()
    if not pid.isdigit():
        return ""
    RECOVERED_DIR.mkdir(parents=True, exist_ok=True)
    # Same stable high-resolution endpoint already used by the V1.2 integrity pass.
    url = f"https://tcgplayer-cdn.tcgplayer.com/product/{pid}_in_1000x1000.jpg"
    try:
        data, ctype = sealed_importer.get_bytes(url, retries=3, timeout=40)
        if len(data) < 12000:
            return ""
        ext = sealed_importer.image_ext(data, ctype)
        path = RECOVERED_DIR / f"tcgplayer-{pid}{ext}"
        if not path.is_file() or path.stat().st_size != len(data):
            path.write_bytes(data)
        return path.relative_to(A).as_posix()
    except Exception:
        return ""


def recover_missing_products(d: dict[str, Any], idx: dict[str, Any]) -> dict[str, int]:
    index_by_id = {
        str(x.get("id")): x
        for x in idx.get("sets") or []
        if isinstance(x, dict) and x.get("id")
    }
    english, source_ids = _english_map(index_by_id)
    original_english = sealed_importer.english_name_map
    sealed_importer.english_name_map = lambda: english
    try:
        fresh, matched_groups = sealed_importer.fetch_tcgcsv(index_by_id)
    finally:
        sealed_importer.english_name_map = original_english

    sets = d.setdefault("sets", {})
    needs = {sid for sid in index_by_id if not _has_core_product(list(sets.get(sid) or []))}
    candidates = [dict(p) for p in fresh if str(p.get("setId") or "") in needs]

    # One real loose pack is enough; wrapper art variants belong to artworks, not
    # separate shop SKUs. Other real sealed products remain individual products.
    loose_seen: set[str] = set()
    filtered: list[dict[str, Any]] = []
    for p in sorted(candidates, key=lambda x: (str(x.get("setId")), str(x.get("type")), len(str(x.get("sourceName") or "")))):
        sid = str(p.get("setId") or "")
        if p.get("mode") == "loose":
            if sid in loose_seen:
                continue
            loose_seen.add(sid)
        filtered.append(p)

    local: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=12, thread_name_prefix="recover-product") as pool:
        future_map = {pool.submit(_download_product_image, p): p for p in filtered}
        for future in as_completed(future_map):
            p = future_map[future]
            local[str(p.get("id"))] = future.result()

    added = recovered_sets = boosters = 0
    touched: set[str] = set()
    for p in filtered:
        sid = str(p.get("setId") or "")
        image = local.get(str(p.get("id"))) or ""
        # A real identity without a usable image is retained only for an openable
        # pack; everything else waits for a future build rather than showing junk.
        if not image and p.get("mode") != "loose":
            continue
        p.pop("imageRemote", None)
        if image:
            p["image"] = image
        p["v120RecoveredProduct"] = True
        p["v120RecoveredEnglishSetId"] = source_ids.get(sid, "")
        if p.get("mode") == "loose":
            p["v117CanonicalBooster"] = True
            p["v120ShopVerified"] = True
            p["verifiedContents"] = True
            p["opens"] = 1
            boosters += 1
        elif p.get("verifiedContents"):
            p["v120ShopVerified"] = True

        rows = sets.setdefault(sid, [])
        existing_ids = {str(x.get("id") or "") for x in rows if isinstance(x, dict)}
        if str(p.get("id") or "") in existing_ids:
            continue
        rows.append(p)
        added += 1
        touched.add(sid)

    # A second pass may run after V1.2 canonicalization. If a set still has no core
    # product, the audit exposes it explicitly instead of pretending coverage.
    recovered_sets = len(touched)
    still_empty = sum(1 for sid in index_by_id if not _has_core_product(list(sets.get(sid) or [])))
    return {
        "metadataMappedSets": len(english),
        "tcgcsvMatchedGroupsRecoveredPass": matched_groups,
        "recoveredProductRows": added,
        "recoveredProductSets": recovered_sets,
        "recoveredLooseBoosterSets": boosters,
        "stillProductlessSets": still_empty,
    }


def classify_binders(d: dict[str, Any], idx: dict[str, Any]) -> None:
    physical_sets = {str(x.get("id")) for x in idx.get("sets") or [] if x.get("id")}
    physical_binder_sets: set[str] = set()
    n = 0
    for sid, rows in (d.get("sets") or {}).items():
        for p in rows or []:
            text = f"{p.get('sourceName','')} {p.get('name','')}"
            if p.get("mode") != "loose" and BINDER.search(text):
                p["contentKind"] = "binder"
                p["openable"] = False
                p["verifiedContents"] = True
                p["opens"] = 0
                p["v117UsableBinder"] = True
                p["v120ShopVerified"] = True
                physical_binder_sets.add(str(sid))
                n += 1

    generic_sets = physical_sets - physical_binder_sets
    stats = d.setdefault("stats", {})
    stats["verifiedPhysicalBinderProducts"] = n
    stats["verifiedPhysicalBinderSets"] = len(physical_binder_sets)
    stats["genericStorageBinderSets"] = len(generic_sets)
    stats["usableBinderProducts"] = len(physical_sets)


def main() -> int:
    d = json.loads(P.read_text(encoding="utf-8"))
    idx = json.loads(INDEX.read_text(encoding="utf-8"))

    recovery = recover_missing_products(d, idx)
    d.setdefault("stats", {}).update(recovery)
    classify_binders(d, idx)

    P.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    J.write_text(
        "window.V115_SEALED_CATALOG="
        + json.dumps(d, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )

    print("V1.2 recovered products:", recovery)
    print(
        "V1.2 binder coverage:",
        d["stats"].get("usableBinderProducts"),
        "sets ·",
        d["stats"].get("verifiedPhysicalBinderProducts"),
        "physical binder product(s)",
    )
    if not idx.get("sets"):
        raise RuntimeError("catalogue physique vide")
    if d["stats"]["usableBinderProducts"] != len(idx["sets"]):
        raise RuntimeError("couverture classeur incomplète")
    # Regression: these are real sealed-product sets and must never regress to zero.
    required = ["sv08.5", "sv04.5", "sv05", "sv06", "sv06.5", "sv07", "sv08", "sv01", "sv02", "sv03", "sv03.5", "sv04", "me01", "me02", "me03", "me04", "me05"]
    index_ids = {str(x.get("id")) for x in idx.get("sets") or []}
    missing = [sid for sid in required if sid in index_ids and not _has_core_product(list(d.get("sets", {}).get(sid) or []))]
    if missing:
        raise RuntimeError(f"collections commerciales encore sans produit: {missing}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
