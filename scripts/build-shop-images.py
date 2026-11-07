"""Generates the demo product illustrations for the Image lab and writes the lab markup into
index.html (between the shop-lab markers). Needs Pillow. Run from the repo root:
    python scripts/build-shop-images.py
then: node scripts/build.mjs
The images are generated illustrations, not real products or photographs."""
import base64, io, os, re, json
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'img', 'shop')
os.makedirs(OUT, exist_ok=True)
S = 2  # supersample factor
W, H = 1200, 900

PRODUCTS = [
    ('mug', 'Ceramic mug', 'Illustration of a ceramic mug with steam', ((253, 226, 214), (250, 190, 170)), (227, 6, 19)),
    ('lamp', 'Desk lamp', 'Illustration of an adjustable desk lamp', ((222, 233, 250), (180, 200, 240)), (29, 78, 160)),
    ('pack', 'Daypack', 'Illustration of a backpack with a front pocket', ((226, 240, 226), (180, 214, 184)), (40, 110, 70)),
    ('phones', 'Headphones', 'Illustration of over-ear headphones', ((236, 228, 248), (205, 190, 236)), (90, 60, 170)),
    ('plant', 'Plant pot', 'Illustration of a potted plant', ((250, 240, 214), (240, 220, 160)), (50, 120, 60)),
    ('book', 'Notebook', 'Illustration of a spiral notebook', ((226, 232, 236), (190, 202, 212)), (20, 20, 20)),
]


def gradient(size, c1, c2):
    w, h = size
    img = Image.new('RGB', size, c1)
    px = img.load()
    for y in range(h):
        t = y / (h - 1)
        row = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
        for x in range(w):
            px[x, y] = row
    return img


def draw_product(key, accent, bg):
    img = gradient((W * S, H * S), *bg)
    d = ImageDraw.Draw(img)
    cx, cy = W * S // 2, H * S // 2
    k = S
    ink = (20, 20, 20)
    white = (255, 255, 255)
    shadow = (0, 0, 0, 0)
    # ground shadow
    d.ellipse([cx - 260 * k, cy + 250 * k, cx + 260 * k, cy + 300 * k], fill=tuple(max(0, c - 40) for c in bg[1]))
    if key == 'mug':
        d.rounded_rectangle([cx - 170 * k, cy - 120 * k, cx + 110 * k, cy + 260 * k], 40 * k, fill=accent)
        d.ellipse([cx + 40 * k, cy - 50 * k, cx + 240 * k, cy + 140 * k], outline=accent, width=34 * k)
        d.ellipse([cx - 170 * k, cy - 150 * k, cx + 110 * k, cy - 80 * k], fill=tuple(int(c * 0.8) for c in accent))
        for i, off in enumerate((-90, -20, 50)):
            d.arc([cx - 100 * k + off * k, cy - 330 * k, cx - 40 * k + off * k, cy - 170 * k], 90, 270, fill=white, width=10 * k)
    elif key == 'lamp':
        d.rounded_rectangle([cx - 150 * k, cy + 220 * k, cx + 150 * k, cy + 260 * k], 20 * k, fill=ink)
        d.line([cx, cy + 220 * k, cx - 90 * k, cy - 20 * k], fill=ink, width=18 * k)
        d.line([cx - 90 * k, cy - 20 * k, cx + 90 * k, cy - 200 * k], fill=ink, width=18 * k)
        d.polygon([(cx + 40 * k, cy - 250 * k), (cx + 230 * k, cy - 130 * k), (cx + 190 * k, cy - 40 * k), (cx + 20 * k, cy - 170 * k)], fill=accent)
        d.ellipse([cx + 50 * k, cy - 80 * k, cx + 190 * k, cy - 10 * k], fill=(255, 236, 160))
    elif key == 'pack':
        d.rounded_rectangle([cx - 190 * k, cy - 220 * k, cx + 190 * k, cy + 270 * k], 110 * k, fill=accent)
        d.rounded_rectangle([cx - 120 * k, cy + 20 * k, cx + 120 * k, cy + 220 * k], 40 * k, fill=tuple(int(c * 0.75) for c in accent))
        d.arc([cx - 90 * k, cy - 330 * k, cx + 90 * k, cy - 170 * k], 180, 360, fill=ink, width=22 * k)
        d.line([cx - 100 * k, cy + 90 * k, cx + 100 * k, cy + 90 * k], fill=white, width=8 * k)
    elif key == 'phones':
        d.arc([cx - 230 * k, cy - 290 * k, cx + 230 * k, cy + 170 * k], 180, 360, fill=ink, width=34 * k)
        d.rounded_rectangle([cx - 270 * k, cy - 60 * k, cx - 120 * k, cy + 200 * k], 60 * k, fill=accent)
        d.rounded_rectangle([cx + 120 * k, cy - 60 * k, cx + 270 * k, cy + 200 * k], 60 * k, fill=accent)
        d.ellipse([cx - 245 * k, cy + 10 * k, cx - 145 * k, cy + 140 * k], fill=tuple(int(c * 0.7) for c in accent))
        d.ellipse([cx + 145 * k, cy + 10 * k, cx + 245 * k, cy + 140 * k], fill=tuple(int(c * 0.7) for c in accent))
    elif key == 'plant':
        for ang, dx, dy in ((-40, -90, -150), (10, 0, -230), (45, 100, -140)):
            d.ellipse([cx + dx * k - 70 * k, cy + dy * k - 120 * k, cx + dx * k + 70 * k, cy + dy * k + 60 * k], fill=accent)
        d.polygon([(cx - 170 * k, cy + 20 * k), (cx + 170 * k, cy + 20 * k), (cx + 120 * k, cy + 270 * k), (cx - 120 * k, cy + 270 * k)], fill=(196, 112, 70))
        d.rectangle([cx - 190 * k, cy - 10 * k, cx + 190 * k, cy + 40 * k], fill=(214, 134, 90))
    else:  # notebook
        d.rounded_rectangle([cx - 190 * k, cy - 250 * k, cx + 190 * k, cy + 260 * k], 24 * k, fill=ink)
        d.rectangle([cx + 110 * k, cy - 250 * k, cx + 140 * k, cy + 260 * k], fill=accent if accent != ink else (227, 6, 19))
        for i in range(8):
            y = cy - 200 * k + i * 60 * k
            d.ellipse([cx - 210 * k, y - 12 * k, cx - 180 * k, y + 12 * k], fill=white)
        d.rounded_rectangle([cx - 110 * k, cy - 140 * k, cx + 60 * k, cy - 70 * k], 12 * k, fill=white)
    return img.resize((W, H), Image.LANCZOS)


def hero_image(w, h):
    img = gradient((w * S, h * S), (20, 20, 20), (60, 60, 64))
    d = ImageDraw.Draw(img)
    k = S
    # abstract storefront: shelves with simple items
    for row in range(2):
        y = int(h * (0.38 + row * 0.34)) * k
        d.rectangle([int(w * 0.06) * k, y, int(w * 0.94) * k, y + 8 * k], fill=(230, 230, 228))
        for i in range(7):
            x = int(w * (0.09 + i * 0.125)) * k
            col = [(227, 6, 19), (255, 255, 255), (120, 160, 240), (240, 200, 90)][(i + row) % 4]
            hh = int(h * (0.12 + ((i * 7 + row * 3) % 5) * 0.02)) * k
            d.rounded_rectangle([x, y - hh, x + int(w * 0.08) * k, y], 10 * k, fill=col)
    return img.resize((w, h), Image.LANCZOS)


def save(img, base, widths, ratio):
    out = []
    for wd in widths:
        im = img.resize((wd, round(wd * ratio)), Image.LANCZOS)
        im.save(os.path.join(OUT, f'{base}-{wd}.webp'), 'WEBP', quality=72, method=6)
        im.save(os.path.join(OUT, f'{base}-{wd}.jpg'), 'JPEG', quality=72, optimize=True, progressive=True)
        out.append(wd)
    return out


def lqip(img):
    t = img.resize((16, round(16 * img.height / img.width)), Image.LANCZOS)
    b = io.BytesIO()
    t.save(b, 'JPEG', quality=40)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()


def srcset(base, widths, ext):
    return ', '.join(f'/img/shop/{base}-{w}.{ext} {w}w' for w in widths)


SIZES = '(max-width: 600px) 100vw, (max-width: 960px) 50vw, 25vw'
items = []
for key, name, alt, bg, accent in PRODUCTS:
    im = draw_product(key, accent, bg)
    widths = save(im, key, [400, 800, 1200], H / W)
    items.append((key, name, alt, widths, lqip(im)))

hero = hero_image(1600, 640)
hw = save(hero, 'hero', [800, 1200, 1600], 640 / 1600)
hero_m = hero_image(800, 800)
hmw = save(hero_m, 'hero-m', [400, 800], 1.0)

html = ['<div class="hero-img">',
        '            <picture>',
        f'              <source media="(max-width: 600px)" type="image/webp" srcset="{srcset("hero-m", hmw, "webp")}" sizes="100vw" />',
        f'              <source media="(max-width: 600px)" srcset="{srcset("hero-m", hmw, "jpg")}" sizes="100vw" />',
        f'              <source type="image/webp" srcset="{srcset("hero", hw, "webp")}" sizes="(min-width: 960px) 66vw, 100vw" />',
        f'              <img src="/img/shop/hero-1200.jpg" srcset="{srcset("hero", hw, "jpg")}" sizes="(min-width: 960px) 66vw, 100vw" width="1600" height="640" loading="lazy" decoding="async" alt="Illustration of a shop shelf with simple coloured items" />',
        '            </picture>',
        '          </div>',
        '          <ul class="products">']
for key, name, alt, widths, q in items:
    html += [
        '            <li class="product"><figure>',
        f'              <div class="product__img" data-lqip="{q}"><picture>',
        f'                <source type="image/webp" srcset="{srcset(key, widths, "webp")}" sizes="{SIZES}" />',
        f'                <img src="/img/shop/{key}-800.jpg" srcset="{srcset(key, widths, "jpg")}" sizes="{SIZES}" width="1200" height="900" loading="lazy" decoding="async" alt="{alt}" />',
        '              </picture></div>',
        f'              <figcaption>{name}</figcaption>',
        '            </figure></li>',
    ]
html.append('          </ul>')
snippet = '\n          '.join(html)

path = os.path.join(ROOT, 'index.html')
src = open(path, encoding='utf-8').read().replace('\r\n', '\n')
new, n = re.subn(r'(<!-- shop-lab:start -->)[\s\S]*?(<!-- shop-lab:end -->)', lambda m: m.group(1) + '\n          ' + snippet + '\n          ' + m.group(2), src)
assert n == 1, 'markers not found'
open(path, 'w', encoding='utf-8', newline='\n').write(new)
json.dump({'products': [i[0] for i in items]}, open(os.path.join(OUT, 'manifest.json'), 'w'))
total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
print('images written:', len(os.listdir(OUT)), 'files,', round(total / 1024), 'KB total')
