# -*- coding: utf-8 -*-
import os, json
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(os.path.dirname(ROOT), 'vibe_images')
OUT = os.path.join(ROOT, 'assets', 'ui')
os.makedirs(OUT, exist_ok=True)

def find_raw(prefix):
    hits = [os.path.join(RAW, f) for f in os.listdir(RAW) if f.startswith(prefix)]
    if not hits:
        raise FileNotFoundError(prefix)
    return max(hits, key=os.path.getmtime)

def load_rgba(path):
    im = Image.open(path).convert('RGBA')
    return np.asarray(im).astype(np.float64)

def sample_bg(a):
    h, w, _ = a.shape
    ring = np.concatenate([a[:4, :, :3].reshape(-1, 3), a[-4:, :, :3].reshape(-1, 3),
                           a[:, :4, :3].reshape(-1, 3), a[:, -4:, :3].reshape(-1, 3)])
    return np.median(ring, axis=0)

def key_green(a, bg):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    greenness = g - np.maximum(r, b)
    alpha = 1.0 - np.clip((greenness - 10.0) / 30.0, 0.0, 1.0)
    # un-matte semi-transparent edge pixels against known background
    edge = (alpha > 0.02) & (alpha < 0.98)
    for c in range(3):
        ch = a[..., c]
        true = (ch - (1.0 - alpha) * bg[c]) / np.maximum(alpha, 1e-6)
        a[..., c] = np.where(edge, np.clip(true, 0, 255), ch)
    # gentle despill on kept pixels
    kept = alpha > 0.02
    cap = np.maximum(r, b) + 14.0
    a[..., 1] = np.where(kept & (g > cap), cap, g)
    a[..., 3] = alpha * 255.0
    return a

def to_img(a):
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')

def trim(im, pad=2, threshold=10):
    a = np.asarray(im)
    ys, xs = np.where(a[..., 3] > threshold)
    if len(xs) == 0:
        return im
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    x0 = max(0, x0 - pad); y0 = max(0, y0 - pad)
    x1 = min(im.width - 1, x1 + pad); y1 = min(im.height - 1, y1 + pad)
    return im.crop((int(x0), int(y0), int(x1) + 1, int(y1) + 1))

def fit_square(im, size):
    im = trim(im)
    s = min((size - 8) / im.width, (size - 8) / im.height)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.paste(im, ((size - im.width) // 2, (size - im.height) // 2), im)
    return canvas

def fit_height(im, h):
    im = trim(im)
    s = h / im.height
    return im.resize((max(1, round(im.width * s)), h), Image.LANCZOS)

def save(im, name):
    im.save(os.path.join(OUT, name))
    print(name, im.size)
    return im

manifest = {'design_resolution': [960, 540], 'assets': {}}

def rec(name, im, **kw):
    d = {'file': 'assets/ui/' + name, 'width': im.width, 'height': im.height}
    d.update(kw)
    manifest['assets'][name[:-4]] = d

# ---- panels (9-slice) ----
a = load_rgba(find_raw('panel-main-raw')); bg = sample_bg(a)
im = trim(to_img(key_green(a, bg)), pad=1, threshold=128)
main = im.resize((512, 512), Image.LANCZOS)
save(main, 'panel_main.png'); rec('panel_main.png', main, nine_slice=64,
    usage='Phaser: this.add.nineslice(x,y,"panel_main",null,w,h,64,64,64,64)')

a = load_rgba(find_raw('panel-small-raw')); bg = sample_bg(a)
im = trim(to_img(key_green(a, bg)))
small = im.resize((256, 256), Image.LANCZOS)
save(small, 'panel_small.png'); rec('panel_small.png', small, nine_slice=16,
    usage='Phaser: this.add.nineslice(x,y,"panel_small",null,w,h,16,16,16,16)')

# ---- icons 4x2 ----
a = load_rgba(find_raw('icons-sheet-raw')); bg = sample_bg(a)
ka = key_green(a, bg)
H, W = ka.shape[:2]
names = ['icon_coin', 'icon_heart', 'icon_base', 'icon_damage',
         'icon_atkspeed', 'icon_time', 'icon_wave', 'icon_defense']
for i, nm in enumerate(names):
    cy, cx = divmod(i, 4)
    cell = ka[cy * H // 2:(cy + 1) * H // 2, cx * W // 4:(cx + 1) * W // 4]
    im = fit_square(to_img(cell), 128)
    save(im, nm + '.png'); rec(nm + '.png', im)

# ---- rarity frames: 3 columns ----
a = load_rgba(find_raw('rarity-frames-raw')); bg = sample_bg(a)
ka = key_green(a, bg)
H, W = ka.shape[:2]
bounds = [0, W // 3, 2 * W // 3, W]
for i, nm in enumerate(['rarity_common', 'rarity_rare', 'rarity_epic']):
    cell = ka[:, bounds[i]:bounds[i + 1]]
    im = fit_height(to_img(cell), 512)
    save(im, nm + '.png'); rec(nm + '.png', im,
        usage='card frame overlay; place icon+text inside the empty center')

# ---- health bar: 3 row bands via projection ----
a = load_rgba(find_raw('healthbar-parts-raw')); bg = sample_bg(a)
ka = key_green(a, bg)
mask = ka[..., 3] > 40
rows = mask.sum(axis=1)
bands = []
in_b = False
for y, v in enumerate(rows):
    if v > 20 and not in_b:
        in_b = True; y0 = y
    elif v <= 20 and in_b:
        in_b = False; bands.append((y0, y))
if in_b: bands.append((y0, len(rows)))
assert len(bands) == 3, bands
parts = {}
for (y0, y1), nm in zip(bands, ['bar_trough', 'bar_fill', 'bar_frame']):
    parts[nm] = trim(to_img(ka[y0:y1]))

BAR_W, BAR_H = 480, 60
trough = parts['bar_trough'].resize((BAR_W, BAR_H), Image.LANCZOS)
frame = parts['bar_frame'].resize((BAR_W, BAR_H), Image.LANCZOS)
save(trough, 'bar_trough.png'); save(frame, 'bar_frame.png')

# measure frame hole: transparent span between outer opaque runs on center lines
fa = np.asarray(parts['bar_frame'])
fm = fa[..., 3] > 128
fh, fw = fm.shape
cx, cy = fw // 2, fh // 2
def hole_span(vec):
    idx = np.flatnonzero(vec)
    first, last = idx[0], idx[-1]
    inner = np.flatnonzero(~vec[first:last + 1])
    return first + inner[0], first + inner[-1]
hx0, hx1 = hole_span(fm[cy, :])
hy0, hy1 = hole_span(fm[:, cx])
hole_w = hx1 - hx0 + 1
hole_h = hy1 - hy0 + 1
sx, sy = BAR_W / fw, BAR_H / fh
fill_w = max(8, round(hole_w * sx) - 4)
fill_h = max(8, round(hole_h * sy) - 4)
off_x = round(hx0 * sx) + 2
off_y = round(hy0 * sy) + 2
fill = parts['bar_fill'].resize((fill_w, fill_h), Image.LANCZOS)
save(fill, 'bar_fill.png')
rec('bar_trough.png', trough, usage='bottom layer of HP bar')
rec('bar_frame.png', frame, usage='top layer of HP bar, hollow center')
rec('bar_fill.png', fill, fill_offset=[off_x, off_y],
    usage='middle layer; crop width by hp ratio: fill.setCrop(0,0,w*ratio,h)')

# ---- damage numbers: column clusters ----
a = load_rgba(find_raw('damage-numbers-raw')); bg = sample_bg(a)
ka = key_green(a, bg)
mask = ka[..., 3] > 40
cols = mask.sum(axis=0)
clusters = []
in_c = False
for x, v in enumerate(cols):
    if v > 6 and not in_c:
        in_c = True; x0 = x
    elif v <= 6 and in_c:
        in_c = False
        if x - x0 > 30: clusters.append((x0, x))
if in_c: clusters.append((x0, len(cols)))
merged = []
for c in clusters:
    if merged and c[0] - merged[-1][1] < 50:
        merged[-1] = (merged[-1][0], c[1])
    else:
        merged.append(c)
clusters = [tuple(c) for c in merged]
assert len(clusters) == 3, clusters
for (x0, x1), nm, h in zip(clusters, ['dmg_normal', 'dmg_crit', 'dmg_taken'], [80, 128, 80]):
    im = fit_height(to_img(ka[:, x0:x1]), h)
    save(im, nm + '.png'); rec(nm + '.png', im, usage='floating combat text sprite')

# ---- crosshair ----
a = load_rgba(find_raw('crosshair-raw')); bg = sample_bg(a)
im = fit_square(to_img(key_green(a, bg)), 128)
save(im, 'crosshair.png'); rec('crosshair.png', im, usage='aim cursor; hide system cursor over battle canvas')

# ---- aim line (drawn) ----
LW, LH = 256, 24
aim = Image.new('RGBA', (LW, LH), (0, 0, 0, 0))
d = ImageDraw.Draw(aim)
x = 4
i = 0
while x < LW - 34:
    dash_w = 26
    alpha = int(255 * (0.35 + 0.65 * (x / LW)))
    d.rounded_rectangle([x, 7, x + dash_w, 17], radius=5,
                        fill=(255, 244, 214, alpha), outline=(62, 39, 24, alpha), width=3)
    x += dash_w + 12
    i += 1
d.polygon([(LW - 26, 4), (LW - 4, 12), (LW - 26, 20)], fill=(232, 78, 48, 255),
          outline=(62, 39, 24, 255))
save(aim, 'aim_line.png'); rec('aim_line.png', aim, usage='optional aiming guide; tile/rotate toward target')

with open(os.path.join(ROOT, 'manifest.json'), 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

# ---- verification contact sheet over checkerboard ----
files = sorted(os.listdir(OUT))
thumbs = []
for f in files:
    if f.endswith('.png'):
        im = Image.open(os.path.join(OUT, f)).convert('RGBA')
        im.thumbnail((150, 150), Image.LANCZOS)
        thumbs.append((f, im))
cols_n = 6
cell = 170
rows_n = (len(thumbs) + cols_n - 1) // cols_n
sheet = Image.new('RGBA', (cols_n * cell, rows_n * cell), (40, 40, 46, 255))
dd = ImageDraw.Draw(sheet)
for idx, (f, im) in enumerate(thumbs):
    cy, cx = divmod(idx, cols_n)
    ox, oy = cx * cell, cy * cell
    for yy in range(0, cell, 16):
        for xx in range(0, cell, 16):
            if (xx // 16 + yy // 16) % 2 == 0:
                dd.rectangle([ox + xx, oy + yy, ox + xx + 15, oy + yy + 15], fill=(58, 58, 66, 255))
    sheet.paste(im, (ox + (cell - im.width) // 2, oy + (cell - im.height) // 2), im)
sheet.convert('RGB').save(os.path.join(ROOT, 'contact_sheet.jpg'), quality=88)
print('DONE', len(files), 'assets')