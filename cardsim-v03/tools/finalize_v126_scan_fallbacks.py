#!/usr/bin/env python3
"""VOX Card Sim V1.2.6 — verified scan fallback consolidation.

The French TCGdex catalogue remains the canonical card catalogue.  This pass only
fills a missing *image* when an independently published pokemon-tcg-data English
set can be matched with high confidence.  It never fabricates a card or assumes
that two unrelated products are the same set.

Why a dedicated pass?
- TCGdex uses IDs such as ``swsh9.5tg`` while pokemon-tcg-data uses ``swsh9tg``;
- V1.2.0 only tried exact set IDs, so many perfectly documented scans were missed;
- the Android offline manager consequently reported hundreds of "source missing"
  rows even though an audited English scan existed for the same numbered card.

French scans always win.  English scans are marked explicitly in the generated
catalogue so the UI can tell the user when a fallback language is being used.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

import import_all_collections as importer

ROOT = Path(__file__).resolve().parents[1]
A = ROOT / "app" / "src" / "main" / "assets"
INDEX = A / "v111_collection_index.json"
INDEX_JS = A / "v111_collection_index.js"
REPORT = A / "v111_import_report.json"
PTCG_CARDS = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en/{set_id}.json"
UA = "VOX-CardSim-ScanFallback/1.2.6 (+https://github.com/VOXfra/Kaguya-ACI)"

# Only aliases where the relationship is deterministic and documented by the two
# catalogues.  Dynamic guessing by vaguely similar names is deliberately avoided.
ALIASES: dict[str, str] = {
    # Sword & Shield subsets.
    "swsh9.5tg": "swsh9tg",
    "swsh10.5tg": "swsh10tg",
    "swsh11.5tg": "swsh11tg",
    "swsh12.5tg": "swsh12tg",
    "swsh12.5gg": "swsh12pt5gg",
    "swsh4.5sv": "swsh45sv",
    "cel25cc": "cel25c",
    # Sun & Moon special sets whose punctuation differs between databases.
    "sm3.5": "sm35",
    "sm7.5": "sm75",
    # Black Star promos.
    "hgssp": "hsp",
    # McDonald's annual sets. Missing upstream years simply remain unresolved.
    "2011bw": "mcd11",
    "2012bw": "mcd12",
    "2013bw": "mcd13",
    "2014xy": "mcd14",
    "2015xy": "mcd15",
    "2016xy": "mcd16",
    "2017sm": "mcd17",
    "2018sm-fr": "mcd18",
    "2019sm-fr": "mcd19",
    "2021swsh": "mcd21",
    "2022swsh": "mcd22",
    "2023sv": "mcd23",
    "2024sv": "mcd24",
    # Early Trainer Kits present as individual sets in pokemon-tcg-data.
    "tk-ex-latia": "tk1a",
    "tk-ex-latio": "tk1b",
    "tk-ex-p": "tk2a",   # Plusle / Posipi
    "tk-ex-m": "tk2b",   # Minun / Négapi
}


def _request_json(url: str, retries: int = 3) -> Any | None:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=40) as response:
                if not 200 <= response.status < 300:
                    raise RuntimeError(f"HTTP {response.status}")
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return None
            last = exc
        except Exception as exc:
            last = exc
        time.sleep(0.35 * (2 ** attempt))
    print(f"V1.2.6 scan source unavailable: {url} · {last}")
    return None


def _fetch_source(target_sid: str, source_sid: str) -> tuple[str, str, list[dict[str, Any]] | None]:
    value = _request_json(PTCG_CARDS.format(set_id=urllib.parse.quote(source_sid, safe="._-")), retries=3)
    rows = [x for x in value if isinstance(x, dict)] if isinstance(value, list) else None
    return target_sid, source_sid, rows


def _key(value: Any) -> str:
    """Number/localId comparison key without inventing semantic equivalence."""
    raw = urllib.parse.unquote(str(value or "")).strip().upper().replace(" ", "")
    # Keep TG/GG/SV prefixes; only remove harmless leading zeroes in the numeric tail.
    m = re.fullmatch(r"([A-Z!?'_-]*)(\d+)([A-Z_]*)", raw)
    if m:
        return f"{m.group(1)}{int(m.group(2))}{m.group(3)}"
    return raw


def _norm_name(value: Any) -> str:
    s = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", s.casefold()).strip()


def _source_images(row: dict[str, Any]) -> tuple[str, str]:
    images = row.get("images") or {}
    if not isinstance(images, dict):
        return "", ""
    large = str(images.get("large") or "").strip()
    small = str(images.get("small") or "").strip()
    return large or small, small or large


def _rehash(index: dict[str, Any], entry: dict[str, Any], payload: dict[str, Any]) -> None:
    payload["issues"] = sorted(set(str(x) for x in payload.get("issues") or [] if x))
    stable_set = {k: v for k, v in payload.get("set", {}).items() if k != "contentHash"}
    digest = importer.stable_hash({
        "schema": 111,
        "language": str(index.get("language") or "fr"),
        "set": stable_set,
        "cards": payload.get("cards") or [],
        "issues": payload["issues"],
    })
    entry["contentHash"] = digest
    payload["contentHash"] = digest
    payload.setdefault("set", {})["contentHash"] = digest


def _source_map(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    duplicates: set[str] = set()
    for row in rows:
        k = _key(row.get("number"))
        if not k:
            continue
        if k in out:
            duplicates.add(k)
        else:
            out[k] = row
    for k in duplicates:
        out.pop(k, None)
    return out


def _apply_to_set(index: dict[str, Any], entry: dict[str, Any], source_sid: str, rows: list[dict[str, Any]]) -> dict[str, int]:
    path = A / "catalog" / "fr" / str(entry.get("file") or f"{entry['id']}.json")
    if not path.is_file():
        return {"restored": 0, "remaining": int(entry.get("missingScans") or 0), "fallback": 0}

    payload = json.loads(path.read_text(encoding="utf-8"))
    cards = [dict(x) for x in payload.get("cards") or [] if isinstance(x, dict)]
    by_number = _source_map(rows)
    restored = 0

    # Exact local-number equivalence is the release criterion.  It works for the
    # TG/GG/SV prefixes, ordinary numbered sets, McDonald's sets and early kits.
    for card in cards:
        if str(card.get("image") or "").strip():
            continue
        src = by_number.get(_key(card.get("localId")))
        if not src:
            continue
        large, small = _source_images(src)
        if not large:
            continue
        card["image"] = large
        card["imageSmall"] = small
        card["imageLarge"] = large
        card["v126FallbackScan"] = True
        card["v126FallbackLanguage"] = "en"
        card["v126FallbackSource"] = "pokemon-tcg-data"
        card["v126FallbackSourceSet"] = source_sid
        card["v126FallbackSourceCard"] = str(src.get("id") or "")
        restored += 1

    # A fallback already inserted by V1.2.0 is also an English fallback, not a
    # French scan.  Keep that provenance visible in the aggregate stats.
    fallback_count = sum(1 for c in cards if c.get("v120FallbackScan") or c.get("v126FallbackScan"))
    missing_operational = sum(1 for c in cards if not str(c.get("image") or "").strip())
    missing_french = sum(
        1 for c in cards
        if not str(c.get("image") or "").strip() or c.get("v120FallbackScan") or c.get("v126FallbackScan")
    )
    total = len(cards)
    source_total = int(entry.get("sourceTotal") or total)
    count_complete = source_total <= 0 or total >= source_total
    status = "ready" if cards and count_complete and missing_operational == 0 else "partial"

    entry.update({
        "cards": total,
        "total": total,
        "missingScans": missing_operational,
        "missingFrenchScans": missing_french,
        "fallbackScans": fallback_count,
        "status": status,
        "v126FallbackSourceSet": source_sid,
        "v126FallbackScans": sum(1 for c in cards if c.get("v126FallbackScan")),
    })
    pset = payload.setdefault("set", {})
    pset.update({
        "cards": total,
        "total": total,
        "missingScans": missing_operational,
        "missingFrenchScans": missing_french,
        "fallbackScans": fallback_count,
        "status": status,
        "v126FallbackSourceSet": source_sid,
    })
    payload["cards"] = cards
    issues = [
        x for x in payload.get("issues") or []
        if not re.search(r"scan\(s\).*(?:indisponible|non r[eé]f[eé]renc|source secondaire)", str(x), re.I)
    ]
    if restored:
        issues.append(f"{restored} scan(s) anglais vérifié(s) utilisé(s) en secours ({source_sid})")
    if missing_operational:
        issues.append(f"{missing_operational} scan(s) réellement indisponible(s) après les sources FR + EN")
    payload["issues"] = issues
    _rehash(index, entry, payload)
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return {"restored": restored, "remaining": missing_operational, "fallback": fallback_count}


def _refresh_aggregate(index: dict[str, Any]) -> None:
    entries = [x for x in index.get("sets") or [] if isinstance(x, dict)]
    stats = dict(index.get("stats") or {})
    stats.update({
        "ready": sum(1 for x in entries if x.get("status") == "ready"),
        "partial": sum(1 for x in entries if x.get("status") != "ready"),
        "missingScans": sum(int(x.get("missingScans") or 0) for x in entries),
        "missingFrenchScans": sum(int(x.get("missingFrenchScans", x.get("missingScans", 0)) or 0) for x in entries),
        "fallbackScans": sum(int(x.get("fallbackScans") or 0) for x in entries),
        "v126FallbackSets": sum(1 for x in entries if int(x.get("v126FallbackScans") or 0) > 0),
        "v126FallbackScans": sum(int(x.get("v126FallbackScans") or 0) for x in entries),
    })
    index["stats"] = stats
    index["source"] = str(index.get("source") or "TCGdex") + " + verified EN scan aliases"


def main() -> int:
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    entries = [x for x in index.get("sets") or [] if isinstance(x, dict) and x.get("id")]
    by_id = {str(x["id"]): x for x in entries}

    wanted: list[tuple[str, str]] = []
    for target_sid, source_sid in ALIASES.items():
        entry = by_id.get(target_sid)
        if entry and int(entry.get("missingScans") or 0) > 0:
            wanted.append((target_sid, source_sid))

    sources: dict[str, tuple[str, list[dict[str, Any]]]] = {}
    with ThreadPoolExecutor(max_workers=12, thread_name_prefix="scan-fallback") as pool:
        futures = [pool.submit(_fetch_source, target, source) for target, source in wanted]
        for future in as_completed(futures):
            target, source, rows = future.result()
            if rows:
                sources[target] = (source, rows)

    restored_total = 0
    mapped_sets = 0
    for target, _ in wanted:
        pair = sources.get(target)
        if not pair:
            continue
        source_sid, rows = pair
        result = _apply_to_set(index, by_id[target], source_sid, rows)
        if result["restored"]:
            mapped_sets += 1
            restored_total += result["restored"]
            print(f"V1.2.6 scan fallback {target} <- {source_sid}: +{result['restored']} · reste {result['remaining']}")

    # Populate French/fallback counters for every other set too, including the
    # exact-ID fallbacks inserted by V1.2.0.
    for entry in entries:
        sid = str(entry.get("id") or "")
        path = A / "catalog" / "fr" / str(entry.get("file") or f"{sid}.json")
        if not path.is_file():
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        cards = [x for x in payload.get("cards") or [] if isinstance(x, dict)]
        operational = sum(1 for c in cards if not str(c.get("image") or "").strip())
        fallback = sum(1 for c in cards if c.get("v120FallbackScan") or c.get("v126FallbackScan"))
        missing_fr = sum(1 for c in cards if not str(c.get("image") or "").strip() or c.get("v120FallbackScan") or c.get("v126FallbackScan"))
        changed = any([
            int(entry.get("missingScans") or 0) != operational,
            int(entry.get("fallbackScans") or 0) != fallback,
            int(entry.get("missingFrenchScans", -1)) != missing_fr,
        ])
        entry["missingScans"] = operational
        entry["fallbackScans"] = fallback
        entry["missingFrenchScans"] = missing_fr
        if changed:
            pset = payload.setdefault("set", {})
            pset["missingScans"] = operational
            pset["fallbackScans"] = fallback
            pset["missingFrenchScans"] = missing_fr
            _rehash(index, entry, payload)
            path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    _refresh_aggregate(index)
    compact = json.dumps(index, ensure_ascii=False, separators=(",", ":"))
    INDEX.write_text(compact, encoding="utf-8")
    INDEX_JS.write_text("'use strict';\nwindow.V111_COLLECTION_INDEX=" + compact + ";\n", encoding="utf-8")
    REPORT.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")

    remaining = int(index.get("stats", {}).get("missingScans") or 0)
    print("V1.2.6 scan fallback stats:", {
        "aliasSourcesFound": len(sources),
        "setsRestored": mapped_sets,
        "scansRestored": restored_total,
        "missingScans": remaining,
        "missingFrenchScans": index.get("stats", {}).get("missingFrenchScans"),
        "fallbackScans": index.get("stats", {}).get("fallbackScans"),
    })
    # Guard against silently regressing to the old 1307-gap catalogue.  This is
    # intentionally conservative; the exact total can improve as upstream grows.
    if remaining >= 1000:
        raise RuntimeError(f"V1.2.6: couverture de scans insuffisante ({remaining} manquants)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
