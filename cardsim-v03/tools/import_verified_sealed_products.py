#!/usr/bin/env python3
"""Build the verified physical-product catalog used by VOX Card Sim Creative mode.

The importer deliberately separates card data from physical-product data:
- TCGdex remains the source of the French card/set catalog.
- TCGCSV is the no-key public mirror of TCGplayer's product catalog and supplies
  real sealed product identities, names and product images.
- SealedDex supplies booster-pack artwork variants set by set.
- pokemon-tcg-data `sets/en.json` maps the common canonical set IDs to English
  names so the TCGCSV groups can be joined without hard-coding every expansion.

No fictional product is generated. Ambiguous group matches are skipped rather than
attached to the wrong expansion. A collection with no verified product stays
navigable in Creative mode and receives an explicit empty state at runtime.
"""
from __future__ import annotations

from difflib import SequenceMatcher
import html
import json
import re
import time
import unicodedata
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app" / "src" / "main" / "assets"
INDEX_PATH = ASSETS / "v111_collection_index.json"
OUT_JS = ASSETS / "v115_sealed_catalog.js"
OUT_JSON = ASSETS / "v115_sealed_catalog.json"
IMAGE_DIR = ASSETS / "img" / "v115" / "products"
USER_AGENT = "VOX-CardSim-SealedImporter/1.1.5 (+https://github.com/VOXfra/Kaguya-ACI)"
TCGCSV_BASE = "https://tcgcsv.com/tcgplayer/3"
SEALDEX = "https://sealeddex.com/"
EN_SETS = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/sets/en.json"

EXCLUDE_NAMES = re.compile(r"code card|jumbo|oversize|world championship", re.I)
MULTI_UNIT = re.compile(
    r"set of \d+|half booster|"
    r"(deck|tin|blister|bundle|collection|kit|box) display\b|"
    r"\bcases?\b|\bcartons?\b",
    re.I,
)
NOT_ACTUALLY_MULTI = re.compile(r"case file|on the case", re.I)
SERIES_PREFIX = re.compile(r"^[A-Za-z]+\d*(?:\.\d+)?:\s*")
DASH_PREFIX = re.compile(r"^[A-Z0-9]+\s+-\s+")
BASE_SET_SUFFIX = re.compile(r"\s+base set$", re.I)

TYPE_PATTERNS = [
    ("etb", re.compile(r"elite trainer box", re.I)),
    ("booster_bundle", re.compile(r"booster bundle", re.I)),
    ("booster_box", re.compile(r"booster (box|display)", re.I)),
    ("blister", re.compile(r"blister|checklane", re.I)),
    ("booster_pack", re.compile(r"booster pack|sleeved booster|fun pack|packs?$", re.I)),
    ("tin", re.compile(r"\btins?\b", re.I)),
    ("deck", re.compile(r"\bdecks?\b|battle arena|league battle|trainer kit|battle academy", re.I)),
    ("collection", re.compile(
        r"collection|premium|box set|\bbundle\b|\bbox\b|\bcase\b|build & battle|trading card game classic",
        re.I,
    )),
]


def get_bytes(url: str, retries: int = 5, timeout: int = 60) -> tuple[bytes, str]:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=timeout) as response:
                if not 200 <= response.status < 300:
                    raise RuntimeError(f"HTTP {response.status}")
                return response.read(), str(response.headers.get("Content-Type") or "")
        except Exception as exc:
            last = exc
            time.sleep(min(8.0, 0.65 * (2 ** attempt)))
    raise RuntimeError(f"{url}: {last}")


def get_json(url: str, retries: int = 5) -> Any:
    raw, _ = get_bytes(url, retries=retries)
    return json.loads(raw.decode("utf-8"))


def norm(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode("ascii")
    text = text.casefold().replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"\band\b", " ", text)
    return " ".join(text.split())


def group_core(name: str) -> str:
    value = SERIES_PREFIX.sub("", str(name or ""))
    value = DASH_PREFIX.sub("", value)
    value = BASE_SET_SUFFIX.sub("", value)
    return value.strip()


def slug_norm(value: str) -> str:
    return norm(str(value or "").replace("-", " "))


def safe_id(value: Any) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", str(value or "")).strip("-._") or "product"


def image_ext(data: bytes, ctype: str) -> str:
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return ".webp"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    ctype = str(ctype or "").casefold()
    if "webp" in ctype:
        return ".webp"
    if "png" in ctype:
        return ".png"
    if "jpeg" in ctype or "jpg" in ctype:
        return ".jpg"
    raise RuntimeError("format image inconnu")


def classify(name: str) -> str | None:
    for product_type, pattern in TYPE_PATTERNS:
        if pattern.search(str(name or "")):
            return product_type
    return None


def is_sealed(product: dict[str, Any]) -> bool:
    name = str(product.get("name") or "")
    if EXCLUDE_NAMES.search(name):
        return False
    if MULTI_UNIT.search(name) and not NOT_ACTUALLY_MULTI.search(name):
        return False
    if any(str(x.get("name") or "") == "Number" for x in product.get("extendedData") or [] if isinstance(x, dict)):
        return False
    return classify(name) is not None


def kind_for_type(product_type: str) -> str:
    return {
        "etb": "ETB", "booster_bundle": "BOOSTER BUNDLE", "booster_box": "DISPLAY",
        "blister": "BLISTER", "booster_pack": "BOOSTER", "tin": "TIN", "deck": "DECK",
        "collection": "COFFRET",
    }.get(product_type, "PRODUIT SCELLÉ")


def explicit_pack_count(name: str, product_type: str) -> int:
    if product_type == "booster_pack":
        return 1
    text = str(name or "")
    for pattern in (
        r"(?:contains?|includes?)\s+(\d{1,3})\s+(?:pokemon\s+tcg\s+)?booster\s+packs?",
        r"(\d{1,3})\s+(?:pokemon\s+tcg\s+)?booster\s+packs?",
        r"(\d{1,3})[- ]pack\s+booster",
        r"booster\s+bundle\s*[-–:]?\s*(\d{1,2})\s*pack",
    ):
        match = re.search(pattern, text, re.I)
        if match:
            count = int(match.group(1))
            if 1 <= count <= 72:
                return count
    return 0


def product_display_name(source_name: str, product_type: str, set_name: str) -> str:
    source = str(source_name or "").strip()
    lower = source.casefold()
    if product_type == "booster_pack":
        art = ""
        match = re.search(r"(?:booster pack|sleeved booster)\s*(?:[-–:]|\[)\s*([^\]]+?)\]?\s*$", source, re.I)
        if match:
            art = match.group(1).strip()
        return f"Booster {set_name}" + (f" — {art}" if art and norm(art) != norm(set_name) else "")
    if product_type == "booster_box":
        return f"Display {set_name}"
    if product_type == "booster_bundle":
        return f"Bundle de boosters {set_name}"
    if product_type == "etb":
        prefix = "Coffret Dresseur d’élite Pokémon Center" if "pokemon center" in lower else "Coffret Dresseur d’élite"
        return f"{prefix} {set_name}"
    return source or f"Produit scellé {set_name}"


def english_name_map() -> dict[str, str]:
    try:
        rows = get_json(EN_SETS)
    except Exception:
        rows = get_json(EN_SETS.replace("/master/", "/main/"))
    return {str(x.get("id") or ""): str(x.get("name") or "") for x in rows if isinstance(x, dict) and x.get("id")}


def match_tcgcsv_group(group: dict[str, Any], index_by_id: dict[str, dict[str, Any]], english: dict[str, str]) -> str | None:
    target = norm(group_core(str(group.get("name") or "")))
    if not target:
        return None
    exact = [sid for sid in index_by_id if english.get(sid) and target in {norm(english[sid]), norm(BASE_SET_SUFFIX.sub("", english[sid]))}]
    if len(exact) == 1:
        return exact[0]
    published = str(group.get("publishedOn") or "")[:4]
    gy = int(published) if published.isdigit() else None
    scored: list[tuple[float, str]] = []
    for sid, entry in index_by_id.items():
        en = english.get(sid, "")
        if not en:
            continue
        ey = int(entry.get("year")) if str(entry.get("year") or "").isdigit() else None
        if gy and ey and abs(gy - ey) > 1:
            continue
        scored.append((SequenceMatcher(None, target, norm(en)).ratio(), sid))
    scored.sort(reverse=True)
    if not scored or scored[0][0] < .88:
        return None
    if len(scored) > 1 and scored[0][0] - scored[1][0] < .035:
        return None
    return scored[0][1]


def fetch_tcgcsv(index_by_id: dict[str, dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    payload = get_json(f"{TCGCSV_BASE}/groups")
    groups = payload.get("results") or []
    if not isinstance(groups, list):
        raise RuntimeError("TCGCSV groups invalide")
    english = english_name_map()
    matched: list[tuple[dict[str, Any], str]] = []
    used_sets: set[str] = set()
    for group in groups:
        if not isinstance(group, dict):
            continue
        sid = match_tcgcsv_group(group, index_by_id, english)
        if sid and sid not in used_sets:
            used_sets.add(sid);matched.append((group, sid))
    print(f"  TCGCSV groupes: {len(groups)} · {len(matched)} mappés au catalogue physique")

    products: list[dict[str, Any]] = []
    for i, (group, sid) in enumerate(matched, 1):
        group_id = int(group["groupId"])
        rows = (get_json(f"{TCGCSV_BASE}/{group_id}/products", retries=4).get("results") or [])
        entry = index_by_id[sid]
        for raw in rows:
            if not isinstance(raw, dict) or not is_sealed(raw):
                continue
            ptype = classify(str(raw.get("name") or ""));pid = str(raw.get("productId") or "").strip()
            if not ptype or not pid:
                continue
            count = explicit_pack_count(str(raw.get("name") or ""), ptype)
            products.append({
                "id": f"tcgcsv-{pid}", "setId": sid,
                "name": product_display_name(str(raw.get("name") or ""), ptype, str(entry.get("name") or sid)),
                "sourceName": str(raw.get("name") or ""), "kind": kind_for_type(ptype), "type": ptype,
                "mode": "loose" if ptype == "booster_pack" else "sealed", "qty": 1,
                "opens": 1 if ptype == "booster_pack" else count,
                "imageRemote": str(raw.get("imageUrl") or ""), "source": "TCGCSV / TCGplayer catalog",
                "sourceId": pid, "sourceUrl": str(raw.get("url") or ""),
                "verifiedContents": bool(count or ptype == "booster_pack"),
            })
        if i % 25 == 0 or i == len(matched):
            print(f"  TCGCSV produits {i}/{len(matched)} groupes · {len(products)} scellés retenus")
        time.sleep(.12)
    return products, len(matched)


def fetch_sealeddex_art(index_by_id: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    raw, _ = get_bytes(SEALDEX)
    text = html.unescape(raw.decode("utf-8", errors="replace"))
    urls = re.findall(r"https://images\.sealeddex\.com/images/expansions/([^/\"'?#]+)/([^\"'?#<> ]+)", text)
    if not urls:
        urls = re.findall(r"(?:https://images\.sealeddex\.com)?/images/expansions/([^/\"'?#]+)/([^\"'?#<> ]+)", text)
    if not urls:
        raise RuntimeError("SealedDex: aucune image d'extension détectée")
    by_slug: dict[str, dict[str, tuple[int, str]]] = {}
    for slug, filename in urls:
        if not re.search(r"\.(?:webp|png|jpe?g)$", filename, re.I):
            continue
        width_match = re.search(r"-(\d+)w(?=\.[^.]+$)", filename, re.I);width = int(width_match.group(1)) if width_match else 0
        stem = re.sub(r"-\d+w(?=\.[^.]+$)", "", filename, flags=re.I)
        full = f"https://images.sealeddex.com/images/expansions/{slug}/{filename}"
        previous = by_slug.setdefault(slug, {}).get(stem)
        if previous is None or width >= previous[0]:by_slug[slug][stem] = (width, full)
    english = english_name_map();slugs = list(by_slug);aliases = {"base1":"base-set","base2":"base-set-2","xy1":"x-and-y","ecard1":"expedition"}
    result: list[dict[str, Any]] = [];matched = 0
    for sid, entry in index_by_id.items():
        en = english.get(sid, "")
        if not en:continue
        chosen = aliases.get(sid)
        if chosen not in by_slug:
            scored = sorted(((SequenceMatcher(None, norm(en), slug_norm(slug)).ratio(), slug) for slug in slugs), reverse=True)
            score, candidate = scored[0] if scored else (0.0, "")
            if sid.startswith("ex"):
                ex_candidate = "ex-" + re.sub(r"[^a-z0-9]+", "-", en.casefold().replace("&", " and ")).strip("-")
                if ex_candidate in by_slug:candidate, score = ex_candidate, 1.0
            if score < .82:continue
            chosen = candidate
        artworks = list(by_slug.get(chosen, {}).values())
        if not artworks:continue
        matched += 1
        for i, (_, url) in enumerate(sorted(artworks, key=lambda row: row[1]), 1):
            result.append({"id":f"sealeddex-{safe_id(sid)}-{i}","setId":sid,"name":f"Booster {entry.get('name') or sid} · illustration {i}","sourceName":f"{en} booster artwork {i}","kind":"BOOSTER","type":"booster_pack","mode":"loose","qty":1,"opens":1,"imageRemote":url,"source":"SealedDex","sourceUrl":f"https://sealeddex.com/sets/{chosen}","verifiedContents":True})
    print(f"  SealedDex: {matched} collection(s) mappée(s), {len(result)} artwork(s) booster")
    return result


def download_images(products: list[dict[str, Any]]) -> None:
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    for old in IMAGE_DIR.glob("*"):
        if old.is_file():old.unlink()
    def one(product: dict[str, Any]) -> tuple[dict[str, Any], str]:
        url = str(product.get("imageRemote") or "").strip()
        if not url.startswith("https://"):return product, ""
        try:
            data, ctype = get_bytes(url, retries=4, timeout=45)
            if len(data) < 350:raise RuntimeError(f"image trop petite ({len(data)} octets)")
            ext = image_ext(data, ctype);filename = safe_id(product["id"]) + ext;(IMAGE_DIR / filename).write_bytes(data)
            return product, f"img/v115/products/{filename}"
        except Exception as exc:
            print(f"  image ignorée {product.get('id')}: {exc}");return product, ""
    done = 0
    with ThreadPoolExecutor(max_workers=16, thread_name_prefix="sealed-img") as pool:
        futures = [pool.submit(one, product) for product in products]
        for future in as_completed(futures):
            product, local = future.result();product["image"] = local;done += 1
            if done % 100 == 0 or done == len(products):print(f"  images produits {done}/{len(products)}")


def main() -> int:
    index = json.loads(INDEX_PATH.read_text(encoding="utf-8"));entries = index.get("sets") or []
    index_by_id = {str(x.get("id") or ""): x for x in entries if isinstance(x, dict) and x.get("id")}
    if not index_by_id:raise RuntimeError("Index physique FR absent")
    tcgcsv, tcgcsv_sets = fetch_tcgcsv(index_by_id);sealeddex = fetch_sealeddex_art(index_by_id);art_sets = {p["setId"] for p in sealeddex}
    products = [p for p in tcgcsv if not (p["mode"] == "loose" and p["setId"] in art_sets)] + sealeddex
    unique = {str(product["id"]): product for product in products};products = sorted(unique.values(), key=lambda p:(p["setId"],0 if p["mode"]=="loose" else 1,p["kind"],p["name"],p["id"]))
    download_images(products)
    by_set: dict[str,list[dict[str,Any]]] = {}
    for product in products:product.pop("imageRemote",None);by_set.setdefault(product["setId"],[]).append(product)
    stats={"catalogSets":len(index_by_id),"tcgcsvMatchedSets":tcgcsv_sets,"setsWithVerifiedProducts":len(by_set),"products":sum(len(v) for v in by_set.values()),"boosterArtworkSets":len(art_sets),"localImages":sum(1 for rows in by_set.values() for p in rows if p.get("image"))}
    payload={"schema":115,"language":"fr","sources":["TCGCSV / TCGplayer product catalog","SealedDex booster artwork variants"],"sets":by_set,"stats":stats}
    OUT_JSON.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding="utf-8");OUT_JS.write_text("window.V115_SEALED_CATALOG="+json.dumps(payload,ensure_ascii=False,separators=(",",":"))+";\n",encoding="utf-8")
    print("Verified sealed catalog:",stats)
    if stats["setsWithVerifiedProducts"]<100:raise RuntimeError("Couverture produits vérifiés anormalement faible")
    if stats["products"]<250:raise RuntimeError("Trop peu de produits physiques vérifiés")
    if stats["localImages"]<180:raise RuntimeError("Trop peu de visuels produits vérifiés téléchargés")
    if "sm8" not in by_set or not any(p.get("mode")=="loose" for p in by_set["sm8"]):raise RuntimeError("Tonnerre Perdu / sm8 n'a aucun booster vérifié")
    return 0

if __name__ == "__main__":raise SystemExit(main())
