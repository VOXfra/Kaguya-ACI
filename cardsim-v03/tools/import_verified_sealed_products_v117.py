#!/usr/bin/env python3
"""V1.1.7 wrapper around the verified sealed-product importer.

Fixes two release-data problems without fabricating products:
- SealedDex pages also expose banners/logos/square crops; only portrait booster-pack
  images are accepted and the highest available width is preferred.
- deterministic same-set products (display, bundle, blisters, Build & Battle) get
  their actual booster count so the inventory no longer calls them '0 boosters'.
Unsupported mixed-content tins/decks/collections remain valid sealed collectibles,
but are explicitly marked non-openable by the runtime instead of throwing a toast.
"""
from __future__ import annotations

import re
import struct

import import_verified_sealed_products as base

_BASE_GET_BYTES = base.get_bytes
_BASE_COUNT = base.explicit_pack_count
_IMAGE_CACHE: dict[str, tuple[bytes, str]] = {}


def dimensions(data: bytes) -> tuple[int, int] | None:
    try:
        if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24:
            return struct.unpack(">II", data[16:24])
        if data.startswith(b"\xff\xd8"):
            i = 2
            while i + 9 < len(data):
                if data[i] != 0xFF:
                    i += 1; continue
                marker = data[i + 1]; i += 2
                if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
                    continue
                if i + 2 > len(data): break
                size = int.from_bytes(data[i:i+2], "big")
                if marker in (0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF) and i + 7 < len(data):
                    return int.from_bytes(data[i+5:i+7], "big"), int.from_bytes(data[i+3:i+5], "big")
                if size < 2: break
                i += size
        if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
            kind = data[12:16]
            if kind == b"VP8X" and len(data) >= 30:
                w = 1 + int.from_bytes(data[24:27], "little")
                h = 1 + int.from_bytes(data[27:30], "little")
                return w, h
            if kind == b"VP8L" and len(data) >= 25 and data[20] == 0x2F:
                b0,b1,b2,b3 = data[21:25]
                return 1 + b0 + ((b1 & 0x3F) << 8), 1 + ((b1 >> 6) | (b2 << 2) | ((b3 & 0x0F) << 10))
            pos = data.find(b"\x9d\x01\x2a", 20)
            if pos >= 0 and pos + 7 <= len(data):
                return int.from_bytes(data[pos+3:pos+5], "little") & 0x3FFF, int.from_bytes(data[pos+5:pos+7], "little") & 0x3FFF
    except Exception:
        return None
    return None


def cached_get_bytes(url: str, retries: int = 5, timeout: int = 60):
    if url in _IMAGE_CACHE:
        return _IMAGE_CACHE[url]
    return _BASE_GET_BYTES(url, retries=retries, timeout=timeout)


def candidates(url: str) -> list[str]:
    out = []
    m = re.search(r"-(\d+)w(?=\.[^.?#]+(?:\?|$))", url, re.I)
    if m:
        for width in (1024, 768, 640, 512, 384, 320, 256, 192, 128):
            out.append(url[:m.start(1)] + str(width) + url[m.end(1):])
    out.append(url)
    return list(dict.fromkeys(out))


def portrait_booster(url: str):
    best = None
    for candidate in candidates(url):
        try:
            data, ctype = _BASE_GET_BYTES(candidate, retries=2, timeout=35)
            dim = dimensions(data)
            if not dim: continue
            w, h = dim
            # A real sealed booster wrapper is tall/portrait. This rejects the
            # 210x80/256x88 banners and square thumbnails that caused giant crops.
            ratio = h / max(1, w)
            if w < 100 or h < 180 or ratio < 1.42 or ratio > 2.25:
                continue
            score = w * h
            if best is None or score > best[0]:
                best = (score, candidate, data, ctype, w, h)
            if w >= 500:
                break
        except Exception:
            continue
    if not best:
        return None
    _, url, data, ctype, w, h = best
    _IMAGE_CACHE[url] = (data, ctype)
    return url, w, h


def fetch_sealeddex_art(index_by_id):
    rows = base._v117_original_fetch_sealeddex_art(index_by_id)
    valid = []
    rejected = 0
    for p in rows:
        checked = portrait_booster(str(p.get("imageRemote") or ""))
        if not checked:
            rejected += 1
            continue
        url, w, h = checked
        p["imageRemote"] = url
        p["imageWidth"] = w
        p["imageHeight"] = h
        p["v117PortraitVerified"] = True
        valid.append(p)
    print(f"  V1.1.7 artworks booster : {len(valid)} portrait(s) validé(s) · {rejected} asset(s) rejeté(s)")
    return valid


def explicit_pack_count(name: str, product_type: str) -> int:
    old = _BASE_COUNT(name, product_type)
    if old:
        return old
    text = str(name or "")
    lower = text.casefold()
    # Explicit compact forms frequently used by TCGplayer.
    m = re.search(r"\b(\d{1,2})\s*[- ]?pack\b", text, re.I)
    if m:
        n = int(m.group(1))
        if 1 <= n <= 72: return n
    if product_type == "booster_box":
        return 36
    if product_type == "booster_bundle":
        return 6
    if product_type == "blister":
        if "single" in lower or "checklane" in lower: return 1
    if "build & battle stadium" in lower or "build and battle stadium" in lower:
        return 12
    if "build & battle box" in lower or "build and battle box" in lower:
        return 4
    return 0


# Save original before replacing it; the original helper is still responsible for
# discovering/mapping SealedDex set slugs.
base._v117_original_fetch_sealeddex_art = base.fetch_sealeddex_art
base.get_bytes = cached_get_bytes
base.fetch_sealeddex_art = fetch_sealeddex_art
base.explicit_pack_count = explicit_pack_count

if __name__ == "__main__":
    raise SystemExit(base.main())
