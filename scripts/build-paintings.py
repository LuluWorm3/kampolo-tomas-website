#!/usr/bin/env python3
"""Turns the public-domain paintings downloaded by fetch-paintings.mjs into the scene backgrounds of the Renaissance Edition.
Each scene gets a crop around a focal point (16:10, or 4:3 for the 404 page) in two grades that follow the site theme:
dark (lower exposure, warm shadows, vignette) and light (lifted shadows blended toward cream). Pillow only.
Also writes the art credits (scripts/art-credits.json) that build.mjs prints on /documents/.
Run from the repo root: node scripts/fetch-paintings.mjs && python scripts/build-paintings.py
"""
import json
import os
import random
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageStat

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'scripts', 'private', 'paintings-src')
OUT = os.path.join(ROOT, 'img', 'renaissance')
CREAM = (250, 244, 230)

# scene -> painting id, focal point (fraction of the source), output size
SCENES = {
    'scene-interior': ('woman-balance', (0.62, 0.40), (1600, 1000)),
    'scene-about': ('titian-man', (0.5, 0.40), (1600, 1000)),
    'scene-experience': ('harvesters', (0.55, 0.5), (1600, 1000)),
    'scene-projects': ('grand-canal', (0.5, 0.44), (1600, 1000)),
    'scene-skills': ('young-woman-lute', (0.5, 0.48), (1600, 1000)),
    'scene-education': ('aristotle-homer', (0.52, 0.42), (1600, 1000)),
    'scene-contact': ('water-pitcher', (0.5, 0.40), (1600, 1000)),
    'cdiv': ('unicorn-garden', (0.5, 0.55), (1600, 1200)),
}


TRIM = {'grand-canal': 0.06}  # fraction cut off the bottom: the museum's colour-calibration strip


def crop(img, focal, size, trim=0.0):
    sw, sh = img.size
    if trim:
        img = img.crop((0, 0, sw, int(sh * (1 - trim))))
        sw, sh = img.size
    ratio = size[0] / size[1]
    bw, bh = (sw, sw / ratio) if sw / sh < ratio else (sh * ratio, sh)
    cx = min(max(focal[0] * sw, bw / 2), sw - bw / 2)
    cy = min(max(focal[1] * sh, bh / 2), sh - bh / 2)
    box = tuple(int(v) for v in (cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2))
    return img.crop(box).resize(size, Image.LANCZOS)


def vignette(img, colour, strength):
    w, h = img.size
    v = Image.radial_gradient('L').resize((w, h)).point(lambda t: int(max(0, (t - 90) * strength)))
    return Image.composite(Image.new('RGB', (w, h), colour), img, v)


def grain(img, amount, seed=7):
    w, h = img.size
    rng = random.Random(seed)
    n = Image.new('L', (w, h))
    n.putdata([rng.randint(0, 255) for _ in range(w * h)])
    n = Image.blend(n.filter(ImageFilter.GaussianBlur(0.5)), Image.new('L', (w, h), 128), 1 - amount)
    return ImageChops.soft_light(img, Image.merge('RGB', (n, n, n)))


# Scenes where figures must stay readable in the dark grade get a lighter exposure and lifted shadows.
DARK_GRADE = {'scene-interior': (0.88, 0.85)}


def dark(img, bright=0.74, gamma=1.0):
    if gamma != 1.0:
        img = img.point(lambda v: int(255 * (v / 255) ** gamma))
    img = ImageEnhance.Brightness(img).enhance(bright)
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = Image.blend(img, Image.new('RGB', img.size, (40, 22, 14)), 0.1)
    return grain(vignette(img, (8, 5, 3), 1.25), 0.12)


def light(img):
    img = ImageEnhance.Brightness(img).enhance(1.12)
    img = Image.blend(img, Image.new('RGB', img.size, CREAM), 0.34)
    img = ImageEnhance.Contrast(img).enhance(0.96)
    return grain(vignette(img, (228, 216, 194), 0.6), 0.1)


# The Studio scene is the owner's own pair of pictures: the same painting twice, once with the easel canvas holding only the
# pencil drawing (studio-custom-start.jpg) and once with the portrait painted in (studio-custom.jpg). They live in a private
# folder. The start picture is the page background; only the figure (where the two differ) is cut out of the finished picture
# as a patch, and edition.js paints that patch over the start picture stroke by stroke.
STUDIO_FINAL = os.path.join(ROOT, 'scripts', 'private', 'studio-custom.jpg')
STUDIO_START = os.path.join(ROOT, 'scripts', 'private', 'studio-custom-start.jpg')
FIGURE_AREA = (1100, 290, 1380, 700)  # where to look for the difference, in scene pixels (1600x1000)


def figure_mask(start, final):
    """Where the two pictures differ inside the figure area, closed up and feathered."""
    diff = ImageChops.difference(start, final).convert('L').point(lambda v: 255 if v > 20 else 0)
    area = Image.new('L', diff.size, 0)
    ImageDraw.Draw(area).rectangle(FIGURE_AREA, fill=255)
    m = ImageChops.multiply(diff, area)
    m = m.filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.MinFilter(15)).filter(ImageFilter.MinFilter(3))
    return m.filter(ImageFilter.GaussianBlur(2.2))


def build_studio():
    if not (os.path.exists(STUDIO_FINAL) and os.path.exists(STUDIO_START)):
        print('SKIP studio scene: put scripts/private/studio-custom-start.jpg and studio-custom.jpg')
        return 0
    final = crop(Image.open(STUDIO_FINAL).convert('RGB'), (0.5, 0.5), (1600, 1000))
    start = crop(Image.open(STUDIO_START).convert('RGB').resize(Image.open(STUDIO_FINAL).size), (0.5, 0.5), (1600, 1000))
    mask = figure_mask(start, final)
    box = mask.point(lambda v: 255 if v > 12 else 0).getbbox()
    pad = 10
    box = (max(0, box[0] - pad), max(0, box[1] - pad), min(1600, box[2] + pad), min(1000, box[3] + pad))
    grade = lambda im: dark(im, 0.86, 0.9)
    g_start, g_final = grade(start), grade(final)
    path = os.path.join(OUT, 'scene-studio-dark.webp')
    g_start.save(path, 'WEBP', quality=64, method=6)
    patch = g_final.crop(box).convert('RGBA')
    patch.putalpha(mask.crop(box))
    patch.save(os.path.join(OUT, 'scene-studio-patch.webp'), 'WEBP', quality=86, method=6)
    with open(os.path.join(OUT, 'studio.json'), 'w', encoding='utf8') as f:
        json.dump({'patch': {'x': box[0], 'y': box[1], 'w': box[2] - box[0], 'h': box[3] - box[1]}}, f)
    print('wrote', os.path.relpath(path), os.path.getsize(path) // 1024, 'KB; figure patch', box)
    return os.path.getsize(path)


def main():
    os.makedirs(OUT, exist_ok=True)
    total = build_studio()
    used = set()
    for scene, (pid, focal, size) in SCENES.items():
        src = os.path.join(SRC, pid + '.jpg')
        if not os.path.exists(src):
            print('MISSING', pid, '(run node scripts/fetch-paintings.mjs)')
            continue
        used.add(pid)
        base = crop(Image.open(src).convert('RGB'), focal, size, TRIM.get(pid, 0.0))
        for mode, fn in (('dark', dark), ('light', light)):
            path = os.path.join(OUT, scene + '-' + mode + '.webp')
            graded = dark(base, *DARK_GRADE[scene]) if mode == 'dark' and scene in DARK_GRADE else fn(base)
            graded.save(path, 'WEBP', quality=58, method=6)
            total += os.path.getsize(path)
            print('wrote', os.path.relpath(path), os.path.getsize(path) // 1024, 'KB')
    credits = []
    for pid in sorted(used):
        meta = json.load(open(os.path.join(SRC, pid + '.json'), encoding='utf8'))
        credits.append({k: meta.get(k, '') for k in ('title', 'artist', 'date', 'museum', 'licence', 'page')})
    with open(os.path.join(ROOT, 'scripts', 'art-credits.json'), 'w', encoding='utf8') as f:
        json.dump(credits, f, indent=2, ensure_ascii=False)
    print('total', total // 1024, 'KB;', len(credits), 'credits')


if __name__ == '__main__':
    main()
