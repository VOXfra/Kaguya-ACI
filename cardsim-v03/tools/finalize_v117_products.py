#!/usr/bin/env python3
"""V1.1.7 product-catalog finalizer.

The V1.1.5 importer deliberately kept every SealedDex booster artwork as a
separate product. That made the Creative shop look as if artwork variants were
separate SKUs. V1.1.7 keeps the verified pack wrappers as artwork variants of
one canonical booster product per expansion.

SealedDex pages also contain set logos in the same expansion image directory.
Those landscape assets were previously misclassified as booster wrappers (the
huge cropped logo seen for Astral Radiance). This pass checks the actual local
image dimensions and only accepts portrait pack art from SealedDex.

The pass also marks products as openable only when their booster content is
known with useful confidence. It never invents an arbitrary pack count for a
random collection/tin. A few physical formats have invariant counts that can be
safely recovered from their product type/name.
"""
from __future__ import annotations

import json
import re
import struct
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app" / "src" / "main" / "assets"
INDEX = ASSETS / "v111_collection_index.json"
CATALOG = ASSETS / "v115_sealed_catalog.json"
CATALOG_JS = ASSETS / "v115_sealed_catalog.js"

ACCESSORY = re.compile(
    r"portfolio|binder|album|9[- ]pocket|4[- ]pocket|card binder|playmat|deck box|"
    r"sleeves?|card sleeves?|storage box|card case|collection file",
    re.I,
)


def local_exists(path: str) -> bool:
    return bool(path) and (ASSETS / path).is_file()


def image_size(path: str) -> tuple[int, int] | None:
    """Read PNG/JPEG/WebP dimensions without an extra Pillow dependency."""
    if not local_exists(path):
        return None
    data = (ASSETS / path).read_bytes()
    if len(data) < 30:
        return None
    # PNG
    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24:
        return struct.unpack(">II", data[16:24])
    # JPEG
    if data[:2] == b"\xff\xd8":
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1; continue
            marker = data[i + 1]; i += 2
            if marker in (0xD8, 0xD9):
                continue
            if i + 2 > len(data):
                break
            length = int.from_bytes(data[i:i + 2], "big")
            if marker in range(0xC0, 0xC4) and i + 7 < len(data):
                return int.from_bytes(data[i + 5:i + 7], "big"), int.from_bytes(data[i + 3:i + 5], "big")
            i += max(2, length)
        return None
    # WebP VP8X / VP8L / VP8
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        kind = data[12:16]
        if kind == b"VP8X" and len(data) >= 30:
            w = 1 + int.from_bytes(data[24:27], "little")
            h = 1 + int.from_bytes(data[27:30], "little")
            return w, h
        if kind == b"VP8L" and len(data) >= 25 and data[20] == 0x2F:
            bits = int.from_bytes(data[21:25], "little")
            return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
        sig = data.find(b"\x9d\x01\x2a", 20, 80)
        if sig >= 0 and sig + 7 <= len(data):
            w = int.from_bytes(data[sig + 3:sig + 5], "little") & 0x3FFF
            h = int.from_bytes(data[sig + 5:sig + 7], "little") & 0x3FFF
            return w, h
    return None


def is_portrait_pack_art(path: str) -> bool:
    size = image_size(path)
    if not size:
        return True  # unknown format: do not discard a verified source blindly
    w, h = size
    return w > 0 and h > 0 and h >= w * 1.20


def infer_openability(p: dict[str, Any]) -> None:
    """Annotate a real product without pretending unknown contents are known."""
    name = str(p.get("sourceName") or p.get("name") or "")
    ptype = str(p.get("type") or "")
    current = int(p.get("opens") or 0)

    if p.get("mode") == "loose" or ptype == "booster_pack":
        p["opens"] = 1; p["verifiedContents"] = True; p["openable"] = True
        p["packCountSource"] = p.get("packCountSource") or "booster-pack"; return

    if ACCESSORY.search(name):
        p["opens"] = 0; p["openable"] = False; p["verifiedContents"] = True
        p["contentKind"] = "accessory"; p["packCountSource"] = "not-a-booster-product"; return

    if current > 0:
        p["openable"] = True; p["verifiedContents"] = True
        p["packCountSource"] = p.get("packCountSource") or "explicit-product-name"; return

    # This catalog is the international/French TCG catalog. A row already
    # classified by TCGplayer as Booster Box refers to the standard 36-pack box.
    if ptype == "booster_box":
        p["opens"] = 36; p["openable"] = True; p["verifiedContents"] = True
        p["packCountSource"] = "standard-western-display-36"; return

    if ptype == "booster_bundle":
        p["opens"] = 6; p["openable"] = True; p["verifiedContents"] = True
        p["packCountSource"] = "standard-booster-bundle-6"; return

    if re.search(r"build\s*(?:&|and)\s*battle", name, re.I):
        p["opens"] = 4; p["openable"] = True; p["verifiedContents"] = True
        p["packCountSource"] = "build-and-battle-4"; return

    if ptype == "blister":
        m = re.search(r"\b([123])[- ]pack\b|\b([123])\s+booster\s+packs?\b", name, re.I)
        if m:
            p["opens"] = int(m.group(1) or m.group(2)); p["openable"] = True; p["verifiedContents"] = True
            p["packCountSource"] = "explicit-blister-count"; return

    p["opens"] = 0; p["openable"] = False; p["verifiedContents"] = False
    p["packCountSource"] = "unknown"


def canonical_booster(set_id: str, set_name: str, loose: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not loose:
        return None

    sealeddex_all = [p for p in loose if str(p.get("source") or "").casefold() == "sealeddex"]
    # Reject logos/banners accidentally scraped from /images/expansions/<slug>/.
    sealeddex = [p for p in sealeddex_all if is_portrait_pack_art(str(p.get("image") or ""))]
    preferred = sealeddex or [p for p in loose if str(p.get("source") or "").casefold() != "sealeddex"] or loose
    artworks: list[str] = []
    for p in preferred:
        img = str(p.get("image") or "")
        if local_exists(img) and img not in artworks:
            artworks.append(img)
    if not artworks:
        for p in loose:
            img = str(p.get("image") or "")
            if local_exists(img) and img not in artworks and is_portrait_pack_art(img):
                artworks.append(img)

    exemplar = preferred[0]
    image = artworks[0] if artworks else ""
    return {
        "id": f"v117-booster-{set_id}", "setId": set_id, "name": f"Booster {set_name}",
        "sourceName": str(exemplar.get("sourceName") or f"{set_name} Booster Pack"),
        "kind": "BOOSTER", "type": "booster_pack", "mode": "loose", "qty": 1, "opens": 1,
        "image": image, "artworks": artworks,
        "source": "SealedDex" if sealeddex else str(exemplar.get("source") or "verified catalog"),
        "sourceUrl": str(exemplar.get("sourceUrl") or ""), "verifiedContents": True, "openable": True,
        "packCountSource": "booster-pack", "v117CanonicalBooster": True,
        "artworkSource": "SealedDex" if sealeddex else str(exemplar.get("source") or "verified catalog"),
        "rejectedNonPackImages": max(0, len(sealeddex_all) - len(sealeddex)),
    }


def main() -> int:
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    payload = json.loads(CATALOG.read_text(encoding="utf-8"))
    names = {str(x.get("id")): str(x.get("name") or x.get("id")) for x in index.get("sets") or []}

    out: dict[str, list[dict[str, Any]]] = {}
    canonical_sets = artwork_count = openable = accessories = unknown = rejected_art = 0

    all_sids = set(names) | set((payload.get("sets") or {}).keys())
    for sid in sorted(all_sids):
        rows = [dict(p) for p in (payload.get("sets") or {}).get(sid, []) if isinstance(p, dict)]
        loose = [p for p in rows if p.get("mode") == "loose" or p.get("type") == "booster_pack"]
        sealed = [p for p in rows if p not in loose]
        combined: list[dict[str, Any]] = []
        booster = canonical_booster(sid, names.get(sid, sid), loose)
        if booster:
            combined.append(booster); canonical_sets += 1
            artwork_count += len(booster.get("artworks") or [])
            rejected_art += int(booster.get("rejectedNonPackImages") or 0)

        seen: set[str] = set()
        for p in sealed:
            pid = str(p.get("id") or "")
            if not pid or pid in seen: continue
            seen.add(pid); infer_openability(p)
            if p.get("openable"): openable += 1
            elif p.get("contentKind") == "accessory": accessories += 1
            else: unknown += 1
            combined.append(p)
        if combined: out[sid] = combined

    stats = dict(payload.get("stats") or {})
    stats.update({
        "setsWithVerifiedProducts": len(out), "products": sum(len(v) for v in out.values()),
        "canonicalBoosterSets": canonical_sets, "boosterArtworks": artwork_count,
        "rejectedNonPackImages": rejected_art, "openableSealedProducts": openable,
        "verifiedAccessories": accessories, "unknownContentProducts": unknown,
    })
    payload["sets"] = out; payload["stats"] = stats; payload["schema"] = 115
    payload["v117Finalized"] = True
    payload["sources"] = list(dict.fromkeys([*(payload.get("sources") or []), "V1.1.7 canonical product finalizer"]))

    CATALOG.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    CATALOG_JS.write_text("window.V115_SEALED_CATALOG=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")

    for sid, rows in out.items():
        loose = [p for p in rows if p.get("mode") == "loose"]
        if len(loose) > 1: raise RuntimeError(f"{sid}: {len(loose)} booster products after canonicalization")
        for p in loose:
            if re.search(r"illustration\s+\d+", str(p.get("name") or ""), re.I): raise RuntimeError(f"{sid}: artwork leaked into shop product name")
            if not p.get("v117CanonicalBooster"): raise RuntimeError(f"{sid}: loose product is not canonical")
            for img in p.get("artworks") or []:
                if not local_exists(str(img)): raise RuntimeError(f"{sid}: missing artwork {img}")
                if str(p.get("artworkSource")) == "SealedDex" and not is_portrait_pack_art(str(img)):
                    raise RuntimeError(f"{sid}: non-portrait SealedDex asset leaked: {img} {image_size(str(img))}")

    if canonical_sets < 90: raise RuntimeError(f"only {canonical_sets} canonical booster sets")
    if artwork_count < canonical_sets: raise RuntimeError(f"only {artwork_count} local booster artworks for {canonical_sets} sets")
    print("V1.1.7 products:", stats)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
