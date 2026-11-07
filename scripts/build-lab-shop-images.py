"""Processes the licensed photographs for the Shop lab (/lab/shop/). Needs Pillow. Run from the repo root:
    node scripts/fetch-photos.mjs          (downloads the originals into scripts/private/shop-src/, checks licences)
    python scripts/build-lab-shop-images.py
    node scripts/build.mjs
Reads scripts/photos.json and writes:
  img/lab-shop/<id>-<w>.webp|jpg   responsive sizes for the optimised markup (4:3 products; hero 2:1 and a 4:3 phone crop)
  img/lab-shop/full/<id>.jpg       the same crop at up to 2400 px wide, quality 90: the "as exported" file the naive markup uses
  labs/shop-products.json          catalogue + image sizes in bytes (real file sizes) + tiny blurred placeholders + credits
The originals never leave scripts/private/ (gitignored)."""
import base64, io, json, os
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'scripts', 'private', 'shop-src')
OUT = os.path.join(ROOT, 'img', 'lab-shop')
FULL = os.path.join(OUT, 'full')
os.makedirs(FULL, exist_ok=True)
manifest = json.load(open(os.path.join(ROOT, 'scripts', 'photos.json'), encoding='utf-8'))

# Per-product crop tweaks: "zoom" > 1 crops tighter than the full 4:3 frame (used to keep a leaflet out of the chameleon photo).
ZOOM = {'wood-chameleon': 1.75}
PRODUCT_WIDTHS = [400, 800, 1200]
HERO_WIDTHS = [800, 1200, 1600]
HERO_M_WIDTHS = [400, 800]


def crop(img, ratio, focus, zoom=1.0):
    """Crop to width/height = ratio around focus (x, y as 0..1), then zoom in by `zoom`."""
    w, h = img.size
    cw, ch = (w, w / ratio) if w / h < ratio else (h * ratio, h)
    cw, ch = cw / zoom, ch / zoom
    cx = min(max(focus[0] * w, cw / 2), w - cw / 2)
    cy = min(max(focus[1] * h, ch / 2), h - ch / 2)
    return img.crop((round(cx - cw / 2), round(cy - ch / 2), round(cx + cw / 2), round(cy + ch / 2)))


def save_sizes(img, base, widths, ratio):
    sizes = {'webp': {}, 'jpg': {}}
    for wd in widths:
        im = img.resize((wd, round(wd / ratio)), Image.LANCZOS)
        p = os.path.join(OUT, f'{base}-{wd}.webp')
        im.save(p, 'WEBP', quality=72, method=6)
        sizes['webp'][str(wd)] = os.path.getsize(p)
        p = os.path.join(OUT, f'{base}-{wd}.jpg')
        im.save(p, 'JPEG', quality=72, optimize=True, progressive=True)
        sizes['jpg'][str(wd)] = os.path.getsize(p)
    return sizes


def lqip(img):
    t = img.resize((16, max(1, round(16 * img.height / img.width))), Image.LANCZOS)
    b = io.BytesIO()
    t.save(b, 'JPEG', quality=40)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()


def open_src(pid):
    p = os.path.join(SRC, pid + '.jpg')
    if not os.path.exists(p):
        return None
    return ImageOps.exif_transpose(Image.open(p)).convert('RGB')


out = {'shop': manifest['shop'], 'products': []}
credits = []

# hero: 2:1 for wide screens, 4:3 for phones
h = manifest['hero']
src = open_src('hero')
if src is None:
    raise SystemExit('hero original missing: run node scripts/fetch-photos.mjs first')
wide = crop(src, 2.0, h['focus'])
phone = crop(src, 4 / 3, h['focus'])
out['hero'] = {
    'alt': h['alt'], 'credit': h.get('credit'),
    'wide': {'w': 1600, 'h': 800, 'widths': HERO_WIDTHS, 'bytes': save_sizes(wide, 'hero', HERO_WIDTHS, 2.0)},
    'phone': {'w': 800, 'h': 600, 'widths': HERO_M_WIDTHS, 'bytes': save_sizes(phone, 'hero-m', HERO_M_WIDTHS, 4 / 3)},
    'lqip': lqip(wide),
}

for p in manifest['products']:
    src = open_src(p['id'])
    if src is None:
        print('SKIP (no original, licence not verified):', p['id'])
        continue
    im = crop(src, 4 / 3, p['focus'], ZOOM.get(p['id'], 1.0))
    full_w = min(2400, im.width)
    full = im.resize((full_w, round(full_w * 3 / 4)), Image.LANCZOS) if im.width > full_w else im
    fp = os.path.join(FULL, p['id'] + '.jpg')
    full.save(fp, 'JPEG', quality=90, optimize=False)
    item = {k: p[k] for k in ('id', 'category', 'name', 'blurb', 'alt', 'variantLabel', 'variants', 'credit') if k in p}
    item['img'] = {
        'w': 1200, 'h': 900, 'widths': PRODUCT_WIDTHS,
        'bytes': save_sizes(im, p['id'], PRODUCT_WIDTHS, 4 / 3),
        'full': {'w': full.width, 'h': full.height, 'bytes': os.path.getsize(fp)},
        'lqip': lqip(im),
    }
    out['products'].append(item)

with open(os.path.join(ROOT, 'labs', 'shop-products.json'), 'w', encoding='utf-8', newline='\n') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    f.write('\n')

total = sum(os.path.getsize(os.path.join(dp, n)) for dp, _, ns in os.walk(OUT) for n in ns)
print('products:', len(out['products']), '| files in img/lab-shop:', sum(len(ns) for _, _, ns in os.walk(OUT)), '|', round(total / 1024), 'KB total')
for it in out['products']:
    b = it['img']['bytes']
    print(f"  {it['id']:16} full {round(it['img']['full']['bytes']/1024):5} KB | 400 webp {round(b['webp']['400']/1024):4} KB | 800 webp {round(b['webp']['800']/1024):4} KB | 800 jpg {round(b['jpg']['800']/1024):4} KB")
