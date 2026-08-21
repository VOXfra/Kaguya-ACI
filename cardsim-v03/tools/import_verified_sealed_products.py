#!/usr/bin/env python3
"""Build a verified physical-product catalog for VOX Card Sim Creative mode.

Sources:
- Scrydex sealed-products endpoint: product names/types/images by expansion ID.
- SealedDex public set timeline: real booster-pack artwork variants.
- pokemon-tcg-data sets/en.json: English set name -> canonical expansion ID mapping.

No fictional product is generated. A set with no verified product remains visible in
Creative mode but has an explicit empty state instead of a fake "creative pack".
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
import html
import json
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app" / "src" / "main" / "assets"
INDEX_PATH = ASSETS / "v111_collection_index.json"
OUT_JS = ASSETS / "v115_sealed_catalog.js"
OUT_JSON = ASSETS / "v115_sealed_catalog.json"
IMAGE_DIR = ASSETS / "img" / "v115" / "products"
USER_AGENT = "VOX-CardSim-SealedImporter/1.1.5 (+https://github.com/VOXfra/Kaguya-ACI)"
SCRYDEX = "https://api.scrydex.com/pokemon/v1/sealed"
SEALDEX = "https://sealeddex.com/"
EN_SETS = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/sets/en.json"


def get_bytes(url: str, retries: int = 5, timeout: int = 60) -> tuple[bytes, str]:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                if not 200 <= r.status < 300:
                    raise RuntimeError(f"HTTP {r.status}")
                return r.read(), str(r.headers.get("Content-Type") or "")
        except Exception as exc:
            last = exc
            time.sleep(min(8, .7 * (2**attempt)))
    raise RuntimeError(f"{url}: {last}")


def get_json(url: str, retries: int = 5) -> Any:
    raw, _ = get_bytes(url, retries=retries)
    return json.loads(raw.decode("utf-8"))


def norm(value: str) -> str:
    s = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode("ascii")
    s = s.casefold().replace("&", " and ").replace("pokemon", " ")
    s = re.sub(r"\b(ex|set|expansion)\b", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(s.split())


def slug_norm(value: str) -> str:
    return norm(str(value or "").replace("-", " "))


def image_ext(data: bytes, ctype: str) -> str:
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return ".webp"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    ctype = ctype.casefold()
    if "webp" in ctype:
        return ".webp"
    if "png" in ctype:
        return ".png"
    if "jpeg" in ctype or "jpg" in ctype:
        return ".jpg"
    raise RuntimeError("format image inconnu")


def safe_id(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", str(value or "")).strip("-._") or "product"


def choose_image(product: dict[str, Any]) -> str:
    images = product.get("images") or []
    if not isinstance(images, list):
        return ""
    front = [x for x in images if isinstance(x, dict) and str(x.get("type") or "").casefold() == "front"]
    rows = front or [x for x in images if isinstance(x, dict)]
    for row in rows:
        for key in ("small", "medium", "large"):
            u = str(row.get(key) or "").strip()
            if u.startswith("https://"):
                return u
    return ""


def explicit_pack_count(product: dict[str, Any]) -> int:
    typ = str(product.get("type") or "")
    if typ.casefold() == "booster pack":
        return 1
    text = " ".join([str(product.get("name") or ""), str(product.get("description") or "")])
    patterns = [
        r"(?:contains?|includes?)\s+(\d{1,3})\s+(?:pokemon\s+tcg\s+)?booster\s+packs?",
        r"(\d{1,3})\s+(?:pokemon\s+tcg\s+)?booster\s+packs?",
        r"(\d{1,3})[- ]pack\s+booster",
    ]
    for pat in patterns:
        m = re.search(pat, text, flags=re.I)
        if m:
            n = int(m.group(1))
            if 1 <= n <= 72:
                return n
    return 0


def kind_for_type(typ: str) -> str:
    t = str(typ or "").casefold()
    if "booster pack" in t:
        return "BOOSTER"
    if "booster box" in t:
        return "DISPLAY"
    if "elite trainer" in t:
        return "ETB"
    if "booster bundle" in t:
        return "BOOSTER BUNDLE"
    if "ultra premium" in t:
        return "UPC"
    if "blister" in t:
        return "BLISTER"
    if "build" in t and "battle" in t:
        return "BUILD & BATTLE"
    if "tin" in t:
        return "TIN"
    if "collection" in t:
        return "COFFRET"
    return str(typ or "PRODUIT SCELLÉ").upper()


def french_name(product: dict[str, Any], set_name: str) -> str:
    typ = str(product.get("type") or "")
    src = str(product.get("name") or "").strip()
    base = {
        "booster pack": f"Booster {set_name}",
        "booster box": f"Display {set_name}",
        "elite trainer box": f"Coffret Dresseur d’élite {set_name}",
        "booster bundle": f"Bundle de boosters {set_name}",
    }.get(typ.casefold())
    if base:
        return base
    return src or f"Produit scellé {set_name}"


def fetch_scrydex(index_by_id: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    page = 1
    seen: set[str] = set()
    while True:
        qs = urllib.parse.urlencode({
            "page": page,
            "page_size": 100,
            "select": "id,name,type,description,images,expansion,language,language_code,variants",
        })
        payload = get_json(f"{SCRYDEX}?{qs}")
        rows = payload.get("data") or []
        if not isinstance(rows, list):
            raise RuntimeError("Scrydex: data n'est pas un tableau")
        for p in rows:
            if not isinstance(p, dict):
                continue
            pid = str(p.get("id") or "").strip()
            exp = p.get("expansion") or {}
            sid = str(exp.get("id") or "").strip() if isinstance(exp, dict) else ""
            if not pid or pid in seen or sid not in index_by_id or bool(exp.get("is_online_only")):
                continue
            lang = str(p.get("language_code") or exp.get("language_code") or "").upper()
            if lang and lang not in {"EN", "FR"}:
                continue
            seen.add(pid)
            out.append(p)
        total = int(payload.get("totalCount") or payload.get("total_count") or len(rows))
        print(f"  Scrydex page {page}: {len(rows)} · retenus {len(out)} / total {total}")
        if page * 100 >= total or not rows:
            break
        page += 1
        if page > 30:
            raise RuntimeError("Scrydex pagination anormalement longue")
    return out


def fetch_sealeddex_art(index_by_id: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    raw, _ = get_bytes(SEALDEX)
    text = html.unescape(raw.decode("utf-8", errors="replace"))
    urls = re.findall(r"https://images\.sealeddex\.com/images/expansions/([^/\"'?#]+)/([^\"'?#<> ]+)", text)
    if not urls:
        raise RuntimeError("SealedDex: aucune image d'extension détectée")

    # Keep the largest rendered width for each underlying artwork.
    by_slug: dict[str, dict[str, tuple[int, str]]] = {}
    for slug, filename in urls:
        if not re.search(r"\.(?:webp|png|jpe?g)$", filename, flags=re.I):
            continue
        m = re.search(r"-(\d+)w(?=\.[^.]+$)", filename, flags=re.I)
        width = int(m.group(1)) if m else 0
        stem = re.sub(r"-\d+w(?=\.[^.]+$)", "", filename, flags=re.I)
        full = f"https://images.sealeddex.com/images/expansions/{slug}/{filename}"
        cur = by_slug.setdefault(slug, {}).get(stem)
        if cur is None or width >= cur[0]:
            by_slug[slug][stem] = (width, full)

    try:
        english_rows = get_json(EN_SETS)
    except Exception:
        english_rows = get_json(EN_SETS.replace("/master/", "/main/"))
    english = {str(x.get("id") or ""): str(x.get("name") or "") for x in english_rows if isinstance(x, dict)}
    slugs = list(by_slug)
    aliases = {"base1": "base-set", "xy1": "x-and-y", "ecard1": "expedition"}
    result: list[dict[str, Any]] = []
    matched = 0
    for sid, entry in index_by_id.items():
        en = english.get(sid, "")
        if not en:
            continue
        chosen = aliases.get(sid)
        if chosen not in by_slug:
            target = norm(en)
            scored = sorted(((SequenceMatcher(None, target, slug_norm(s)).ratio(), s) for s in slugs), reverse=True)
            score, candidate = scored[0] if scored else (0.0, "")
            # Prefix-aware bonus for EX-era naming used by SealedDex.
            if sid.startswith("ex"):
                ex_candidate = "ex-" + re.sub(r"[^a-z0-9]+", "-", en.casefold().replace("&", " and ")).strip("-")
                if ex_candidate in by_slug:
                    candidate, score = ex_candidate, 1.0
            if score < .80:
                continue
            chosen = candidate
        arts = list(by_slug.get(chosen, {}).values())
        if not arts:
            continue
        matched += 1
        for i, (_, url) in enumerate(sorted(arts, key=lambda x: x[1]), 1):
            result.append({
                "id": f"sealeddex-{safe_id(sid)}-{i}",
                "setId": sid,
                "name": f"Booster {entry.get('name') or sid} · illustration {i}",
                "sourceName": f"{en} booster artwork {i}",
                "kind": "BOOSTER",
                "type": "Booster Pack",
                "mode": "loose",
                "qty": 1,
                "opens": 1,
                "imageRemote": url,
                "source": "SealedDex",
                "sourceUrl": f"https://sealeddex.com/sets/{chosen}",
                "verifiedContents": True,
            })
    print(f"  SealedDex: {matched} collection(s) mappée(s), {len(result)} artwork(s) booster")
    return result


def download_images(products: list[dict[str, Any]]) -> None:
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    # Do not keep stale generated art from a previous catalog.
    for p in IMAGE_DIR.glob("*"):
        if p.is_file():
            p.unlink()

    def one(p: dict[str, Any]):
        url = str(p.get("imageRemote") or "")
        if not url:
            return p, ""
        try:
            data, ctype = get_bytes(url, retries=4, timeout=45)
            if len(data) < 800:
                raise RuntimeError(f"image trop petite ({len(data)} octets)")
            ext = image_ext(data, ctype)
            name = safe_id(str(p["id"])) + ext
            dest = IMAGE_DIR / name
            dest.write_bytes(data)
            return p, f"img/v115/products/{name}"
        except Exception as exc:
            print(f"  image ignorée {p.get('id')}: {exc}")
            return p, ""

    done = 0
    with ThreadPoolExecutor(max_workers=16, thread_name_prefix="sealed-img") as pool:
        futures = [pool.submit(one, p) for p in products]
        for future in as_completed(futures):
            p, local = future.result()
            p["image"] = local
            done += 1
            if done % 50 == 0 or done == len(products):
                print(f"  images produits {done}/{len(products)}")


def main() -> int:
    idx = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    rows = idx.get("sets") or []
    index_by_id = {str(x.get("id") or ""): x for x in rows if isinstance(x, dict) and x.get("id")}
    if not index_by_id:
        raise RuntimeError("Index physique FR absent")

    scrydex_raw = fetch_scrydex(index_by_id)
    scrydex: list[dict[str, Any]] = []
    for p in scrydex_raw:
        exp = p.get("expansion") or {}
        sid = str(exp.get("id") or "")
        entry = index_by_id[sid]
        typ = str(p.get("type") or "Produit scellé")
        count = explicit_pack_count(p)
        scrydex.append({
            "id": f"scrydex-{safe_id(str(p.get('id') or ''))}",
            "setId": sid,
            "name": french_name(p, str(entry.get("name") or sid)),
            "sourceName": str(p.get("name") or ""),
            "kind": kind_for_type(typ),
            "type": typ,
            "mode": "loose" if typ.casefold() == "booster pack" else "sealed",
            "qty": 1,
            "opens": count if typ.casefold() != "booster pack" else 1,
            "imageRemote": choose_image(p),
            "source": "Scrydex",
            "sourceId": str(p.get("id") or ""),
            "verifiedContents": bool(count),
        })

    sealeddex = fetch_sealeddex_art(index_by_id)
    art_sets = {p["setId"] for p in sealeddex}
    # SealedDex provides artwork variants. Avoid an extra generic Scrydex booster
    # for the same set when those variants are available.
    products = [p for p in scrydex if not (p["mode"] == "loose" and p["setId"] in art_sets)] + sealeddex

    # Stable deterministic order and IDs only from verified upstream records.
    unique: dict[str, dict[str, Any]] = {}
    for p in products:
        unique[p["id"]] = p
    products = sorted(unique.values(), key=lambda p: (p["setId"], 0 if p["mode"] == "loose" else 1, p["kind"], p["name"], p["id"]))
    download_images(products)

    by_set: dict[str, list[dict[str, Any]]] = {sid: [] for sid in index_by_id}
    for p in products:
        # Runtime never needs the remote image after build; keep source metadata only.
        p.pop("imageRemote", None)
        by_set[p["setId"]].append(p)
    by_set = {sid: vals for sid, vals in by_set.items() if vals}
    payload = {
        "schema": 115,
        "language": "fr",
        "sources": ["Scrydex sealed products", "SealedDex booster artwork variants"],
        "sets": by_set,
        "stats": {
            "catalogSets": len(index_by_id),
            "setsWithVerifiedProducts": len(by_set),
            "products": sum(len(v) for v in by_set.values()),
            "boosterArtworkSets": len(art_sets),
            "localImages": sum(1 for vals in by_set.values() for p in vals if p.get("image")),
        },
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    OUT_JS.write_text("window.V115_SEALED_CATALOG=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print("Verified sealed catalog:", payload["stats"])
    if payload["stats"]["setsWithVerifiedProducts"] < 100:
        raise RuntimeError("Couverture produits vérifiés anormalement faible")
    if payload["stats"]["localImages"] < 100:
        raise RuntimeError("Trop peu de visuels produits vérifiés téléchargés")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
