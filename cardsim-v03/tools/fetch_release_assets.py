#!/usr/bin/env python3
"""Télécharge et valide les ressources distantes nécessaires à l'APK Card Sim.

Le runtime n'utilise pas directement les photos de boutiques pour les produits
2026 : elles sont figées pendant le build puis embarquées dans l'APK. Ce script
centralise aussi les 15 scans français Nuit Noire absents de TCGdex afin d'éviter
un workflow YAML rempli de logique réseau difficile à tester.
"""
from __future__ import annotations

import hashlib
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app" / "src" / "main" / "assets"
V109 = ASSETS / "img" / "v109"
ME05 = V109 / "me05_cards"
UA = "Mozilla/5.0 VOX-CardSim/1.1.0"

STATIC_ASSETS = {
    "img/eevee_logo.png": "https://archives.bulbagarden.net/media/upload/thumb/1/1f/S6a_Eevee_Heroes_Logo.png/1200px-S6a_Eevee_Heroes_Logo.png",
    "img/eevee_booster.jpg": "https://tcgplayer-cdn.tcgplayer.com/product/565350_400w.jpg",
    "img/eevee_box.jpg": "https://tcgplayer-cdn.tcgplayer.com/product/565351_400w.jpg",
    "img/binder_151.jpg": "https://d2j6dbq0eux0bg.cloudfront.net/images/51000416/4098527801.jpg",
    "img/binder_obsidian.webp": "https://matraws.dk/cdn/shop/files/ultra-pro-charizard-pokemon-obsidian-flames-9-pocket-portfolio-mappe-kortspil-643.webp?crop=center&height=1200&v=1707377473&width=1200",
    "img/binder_paldea.png": "https://kawaiicollector.com.au/cdn/shop/files/Paldea-Evolved-Portfolio-Large_1200x1200.png?v=1693561546",
    "img/binder_eevee.jpg": "https://s3-ap-northeast-1.amazonaws.com/jiraffe-magi/prod/images/item/9644364/1.jpg",
    "img/v109/me025_booster.png": "https://www.guizettefamily.com/wp-content/uploads/2025/11/booster-EV2.5-.png",
    "img/v109/me025_bundle.webp": "https://lootboxjeux.fr/cdn/shop/files/ME2-5_Bundle_FR.webp?v=1774695267&width=640",
    "img/v109/me025_etb.jpg": "https://www.destocktcg.fr/assets/uploads/products/etb-heros-transcendants-coffret-dresseur-delite-pokemon-fr-me2-5-6920c6bc4d1eb.jpg",
    "img/v109/me025_binder.png": "https://ultrapro.com/cdn/shop/files/16823_9PktPort_PKM_ME2-Spread.png?v=1770245317&width=900",
    "img/v109/me03_booster.jpg": "https://www.ultrajeux.com/images/produits/normal/32272-cartes-a-collectionner-pokemon-me03-mega-evolution-equilibre-parfait.jpg",
    "img/v109/me03_bundle.jpg": "https://www.pokezenith.com/1226-large_default/pokemon-bundle-de-6-boosters-me03-equilibre-parfait.jpg",
    "img/v109/me03_etb.jpg": "https://www.comptoir-tcg.fr/cdn/shop/files/etb-equilibre-parfait-coffret-dresseur-delite-pokemon-fr-me03-me3-69a1c9477a52e.jpg?v=1773936847&width=1445",
    "img/v109/me03_display.webp": "https://kuro-star.com/cdn/shop/files/ME03-Display1site.webp?v=1772416349&width=416",
    "img/v109/me03_binder.jpg": "https://ultrapro.com/cdn/shop/files/16724_Port_9PKT_PKM_ME03_Spread_8c227ea2-7b85-4064-8d1e-6e6e501a5665.jpg?v=1775585796&width=900",
    "img/v109/me04_booster.png": "https://shop.cmay-collections.com/cdn/shop/files/booster-pokemon-me04-chaos-ascendant-fr.png?v=1774942680&width=1024",
    "img/v109/me04_bundle.jpg": "https://cdn1.philibertnet.com/857453-thickbox_default/pokemon-me04-chaos-ascendant-bundle-6-boosters-0196214140356.jpg",
    "img/v109/me04_etb.jpg": "https://www.destocktcg.fr/assets/uploads/products/coffret-dresseur-delite-pokemon-chaos-ascendant-etb-mega-evolution-me04-me4-69d76624c4008.jpg",
    "img/v109/me04_display.jpg": "https://www.pokezenith.com/img/p/1/4/2/1/1421.jpg",
    "img/v109/me04_binder.png": "https://ultrapro.com/cdn/shop/files/16726_Port_9PKT_PKM_ME04_Spread.png?v=1781223280&width=900",
    "img/v109/me05_booster.jpg": "https://www.destocktcg.fr/assets/uploads/products/booster-me05-mega-evolution-nuit-noire-pokemon-fr-me5-6a03178ac0c68.jpg",
    "img/v109/me05_bundle.jpg": "https://www.destocktcg.fr/assets/uploads/products/bundle-me05-lot-de-6-boosters-nuit-noire-pokemon-fr-mega-evolution-me5-6a031a8a49231.jpg",
    "img/v109/me05_etb.jpg": "https://www.bcd-jeux.fr/85783-large_default/pokemon-me05-nuit-noire-etb-zarude-pokemon.jpg",
    "img/v109/me05_display.jpg": "https://cdn1.philibertnet.com/864878/pokemon-me05-nuit-noire-boite-de-36-boosters-2100001360900.jpg",
    "img/v109/me05_build.png": "https://www.princedist.com/cdn/shop/files/bnb_64e0c1de-ddc6-40e8-b88f-94e7f5100bfa_1024x1024.png?v=1778183927",
    "img/v109/me05_binder.png": "https://ultrapro.com/cdn/shop/files/16922_9PKTPort_PKM_ME05_Spread.png?v=1784320169&width=900",
    "img/v109/me05_logo.png": "https://hikarudistribution.com/cdn/shop/articles/logo_nuit_noire_ME05_f1773200-bc42-4c73-a268-2a5c10ae4ecf.png?v=1777881909&width=1600",
}

ME05_HANDLES = {
    75: "pkm-me05-075-cloche-tenebreuse",
    76: "pkm-me05-076-carriere-fossile",
    77: "pkm-me05-077-combat-final-de-gladio",
    78: "pkm-me05-078-albia",
    79: "pkm-me05-079-bridjet",
    80: "pkm-me05-080-vitalite-d-ondine",
    81: "pkm-me05-081-sbire-du-clan-derouillard",
    82: "pkm-me05-082-bombe-geniale",
    83: "pkm-me05-083-energie-obscur-sombre",
    84: "pkm-me05-084-energie-electrique-voltaique",
    85: "pkm-me05-085-mimantis",
    86: "pkm-me05-086-carmadura",
    87: "pkm-me05-087-poissirene",
    88: "pkm-me05-088-oratoria",
    89: "pkm-me05-089-elecsprint",
}


def request(url: str, accept: str = "image/avif,image/webp,image/png,image/jpeg,application/json,*/*"):
    return urllib.request.urlopen(
        urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept}), timeout=45
    )


def image_like(blob: bytes) -> bool:
    return (
        blob.startswith(b"\x89PNG\r\n\x1a\n")
        or blob.startswith(b"\xff\xd8\xff")
        or blob.startswith(b"RIFF") and blob[8:12] == b"WEBP"
        or blob.startswith(b"GIF8")
    )


def download(url: str, dest: Path, min_bytes: int = 5000) -> bytes:
    last: Exception | None = None
    for attempt in range(5):
        try:
            with request(url) as response:
                blob = response.read()
            if len(blob) < min_bytes:
                raise RuntimeError(f"fichier trop petit ({len(blob)} octets)")
            if not image_like(blob):
                raise RuntimeError("réponse non image")
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(blob)
            return blob
        except Exception as exc:
            last = exc
            time.sleep(0.7 * (attempt + 1) ** 2)
    raise RuntimeError(f"{url}: {last}")


def product_image(data: dict) -> str:
    values = [data.get("featured_image"), *(data.get("images") or [])]
    for value in values:
        if isinstance(value, dict):
            value = value.get("src") or value.get("url")
        if isinstance(value, str) and value.strip():
            value = value.strip()
            return "https:" + value if value.startswith("//") else value
    raise RuntimeError("image produit absente")


def pin_static_assets() -> None:
    for rel, url in STATIC_ASSETS.items():
        print(f"  asset {rel}")
        download(url, ASSETS / rel)

    boosters = [
        V109 / "me025_booster.png",
        V109 / "me03_booster.jpg",
        V109 / "me04_booster.png",
        V109 / "me05_booster.jpg",
    ]
    hashes = {hashlib.sha256(path.read_bytes()).hexdigest() for path in boosters}
    if len(hashes) != 4:
        raise RuntimeError("les quatre visuels de booster 2026 ne sont pas distincts")


def pin_me05_fallbacks() -> None:
    ME05.mkdir(parents=True, exist_ok=True)
    local: dict[int, str] = {}
    for number, handle in ME05_HANDLES.items():
        print(f"  Nuit Noire #{number:03d}")
        with request(f"https://lorenzone.fr/products/{handle}.js", "application/json,*/*") as response:
            data = json.loads(response.read().decode("utf-8"))
        src = product_image(data)
        parsed = urllib.parse.urlparse(src).path.lower()
        ext = "png" if parsed.endswith(".png") else "webp" if parsed.endswith(".webp") else "jpg"
        rel = f"img/v109/me05_cards/{number:03d}.{ext}"
        download(src, ASSETS / rel, min_bytes=12000)
        local[number] = rel

    pitch = ASSETS / "pitch_black_embed.js"
    text = pitch.read_text(encoding="utf-8")
    match = re.search(r"window\.V090_PITCH_BLACK_DATA=(.*);\s*$", text, re.S)
    if not match:
        raise RuntimeError("payload pitch_black_embed.js absent")
    payload = json.loads(match.group(1))
    cards = payload.get("cards") or []
    if len(cards) != 120:
        raise RuntimeError(f"Nuit Noire : {len(cards)}/120 cartes")

    touched: list[int] = []
    for card in cards:
        try:
            number = int(str(card.get("localId") or "0").lstrip("0") or "0")
        except ValueError:
            continue
        if number not in local:
            continue
        card["image"] = ""
        card["imageSmall"] = local[number]
        card["imageLarge"] = local[number]
        card["v109BundledFrenchScan"] = True
        touched.append(number)

    if sorted(touched) != list(range(75, 90)):
        raise RuntimeError(f"patch Nuit Noire incomplet : {touched}")
    pitch.write_text(
        "'use strict';\nwindow.V090_PITCH_BLACK_DATA=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    (ASSETS / "v109_me05_scan_fallbacks.json").write_text(
        json.dumps({str(k): v for k, v in sorted(local.items())}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def validate_local_me05() -> None:
    files = [p for p in ME05.iterdir() if p.is_file()]
    if len(files) != 15:
        raise RuntimeError(f"Nuit Noire : {len(files)} scans locaux au lieu de 15")
    for path in files:
        blob = path.read_bytes()
        if len(blob) < 12000 or not image_like(blob):
            raise RuntimeError(f"scan invalide : {path.name}")


def main() -> int:
    (ASSETS / "img").mkdir(parents=True, exist_ok=True)
    V109.mkdir(parents=True, exist_ok=True)
    print("Ressources produit / classeurs…")
    pin_static_assets()
    print("Scans français Nuit Noire manquants…")
    pin_me05_fallbacks()
    validate_local_me05()
    print(f"Ressources release prêtes : {len(STATIC_ASSETS)} visuels + 15 scans Nuit Noire")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
