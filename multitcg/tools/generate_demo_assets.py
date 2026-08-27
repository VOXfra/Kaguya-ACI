#!/usr/bin/env python3
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

NAMES = [
    "Rustwing", "Tidebit", "Mossbyte", "Gustgear", "Ember Relay", "Abyssal Coil",
    "Stone Signal", "Sky Circuit", "Forgeheart", "Leviathan Node", "Worldroot Prime", "Tempest Crown"
]
RARITIES = ["COMMON"]*6 + ["RARE"]*4 + ["EPIC"]*2


def font(size):
    for p in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
    ]:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def card(path, idx, name, rarity):
    w, h = 600, 825
    img = Image.new("RGB", (w, h), (24 + idx*7 % 90, 28 + idx*11 % 80, 38 + idx*13 % 95))
    d = ImageDraw.Draw(img)
    # Original geometric demo art; no third-party artwork.
    for n in range(9):
        pad = 28 + n * 24
        d.rounded_rectangle((pad, 120 + n*11, w-pad, 620-n*8), radius=38,
                            outline=(90 + (idx*19+n*13) % 150, 80 + (idx*31+n*7) % 160, 110 + (idx*17+n*23) % 140), width=5)
    d.ellipse((155, 235, 445, 525), outline=(235, 235, 235), width=9)
    d.line((185, 380, 415, 380), fill=(245,245,245), width=10)
    d.line((300, 265, 300, 495), fill=(245,245,245), width=10)
    d.rounded_rectangle((25, 25, w-25, h-25), radius=28, outline=(245,245,245), width=7)
    d.text((42, 48), f"MULTI-TCG  #{idx:02d}", font=font(27), fill=(245,245,245))
    d.text((42, 660), name, font=font(42), fill=(255,255,255))
    d.text((42, 728), rarity, font=font(27), fill=(220,220,220))
    d.text((420, 750), "VOX DEMO", font=font(18), fill=(210,210,210))
    img.save(path, "PNG", optimize=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    for i, (name, rarity) in enumerate(zip(NAMES, RARITIES), start=1):
        card(out / f"card_{i:02d}.png", i, name, rarity)

    back = Image.new("RGB", (600, 825), (19, 24, 34))
    d = ImageDraw.Draw(back)
    for r in range(250, 20, -22):
        d.ellipse((300-r, 412-r, 300+r, 412+r), outline=(100+r//2, 115+r//3, 145+r//4), width=5)
    d.text((113, 365), "MULTI-TCG", font=font(62), fill=(250,250,250))
    d.text((170, 445), "DEMO SET", font=font(38), fill=(220,220,220))
    back.save(out / "cardback.png", "PNG", optimize=True)

    mask = Image.new("L", (600, 825), 0)
    md = ImageDraw.Draw(mask)
    for y in range(0, 825, 20):
        md.line((0, y, 600, max(0, y-180)), fill=135, width=8)
    mask.save(out / "foilmask.png", "PNG", optimize=True)

    pack = Image.new("RGB", (512, 512), (24, 30, 43))
    pd = ImageDraw.Draw(pack)
    pd.rounded_rectangle((46, 38, 466, 474), radius=34, outline=(235,235,235), width=8)
    pd.text((84, 160), "MULTI-TCG", font=font(51), fill=(250,250,250))
    pd.text((146, 240), "DEMO", font=font(48), fill=(225,225,225))
    pd.text((145, 324), "BOOSTER", font=font(31), fill=(200,200,200))
    pack.save(out / "pack_icon.png", "PNG", optimize=True)


if __name__ == "__main__":
    main()
