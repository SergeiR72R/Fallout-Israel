#!/usr/bin/env python3
"""Собирает кадры из Blender (tools/blender/characters.py) в атласы для игры.

    python3 tools/pack_sprites.py /opt/sprites/hero hero [--sat 1.0] [--bright 1.0] [--contrast 1.0]

Кадры обрезаются по непрозрачной области, уменьшаются до игрового масштаба
(90 пикселей на метр — родной для 1080p) и раскладываются по страницам 4096×4096.
Результат: public/sprites/<имя>-<стр>.webp и src/data/sprites/<имя>.json.
"""
import json, os, re, sys
from PIL import Image, ImageEnhance

src, name = sys.argv[1], sys.argv[2]
def opt(key, default):
    return float(sys.argv[sys.argv.index(key) + 1]) if key in sys.argv else default
TARGET_PPU = opt('--ppu', 90.0)
# Цветокоррекция кадров (подогнать под палитру фона без перерендера).
SAT, BRIGHT, CONTRAST = opt('--sat', 1.0), opt('--bright', 1.0), opt('--contrast', 1.0)
PAGE = 4096
PAD = 2

meta = json.load(open(os.path.join(src, 'meta.json')))
scale = TARGET_PPU / meta['ppu']
fx, fy = meta['feet']

frames = []
for fn in sorted(os.listdir(src)):
    m = re.match(r'(\w+)_(\w+)_(\d)_(\d+)\.png$', fn)
    if not m:
        continue
    wset, anim, d, i = m.group(1), m.group(2), int(m.group(3)), int(m.group(4))
    im = Image.open(os.path.join(src, fn)).convert('RGBA')
    # Ловушка теней даёт почти невидимый шум (α ≤ 10) по всему кадру — убираем.
    a = im.getchannel('A').point(lambda v: 0 if v <= 12 else min(255, round((v - 12) * 255 / 243)))
    im.putalpha(a)
    alpha = a.point(lambda v: 255 if v > 0 else 0)
    box = alpha.getbbox()
    if not box:
        continue
    crop = im.crop(box)
    if (SAT, BRIGHT, CONTRAST) != (1.0, 1.0, 1.0):
        a0 = crop.getchannel('A')
        rgb = crop.convert('RGB')
        rgb = ImageEnhance.Color(rgb).enhance(SAT)
        rgb = ImageEnhance.Brightness(rgb).enhance(BRIGHT)
        rgb = ImageEnhance.Contrast(rgb).enhance(CONTRAST)
        crop = rgb.convert('RGBA'); crop.putalpha(a0)
    w, h = max(1, round(crop.width * scale)), max(1, round(crop.height * scale))
    crop = crop.resize((w, h), Image.LANCZOS)
    frames.append(dict(key=f'{wset}/{anim}/{d}/{i}', img=crop,
                       ox=round((box[0] - fx) * scale, 2), oy=round((box[1] - fy) * scale, 2)))

# Полочная упаковка: по убыванию высоты.
frames.sort(key=lambda f: -f['img'].height)
pages = [Image.new('RGBA', (PAGE, PAGE), (0, 0, 0, 0))]
x = y = shelf = 0
out = {}
used_h = [0]
for f in frames:
    w, h = f['img'].size
    if x + w > PAGE:
        x = 0; y += shelf + PAD; shelf = 0
    if y + h > PAGE:
        pages.append(Image.new('RGBA', (PAGE, PAGE), (0, 0, 0, 0)))
        used_h.append(0)
        x = y = shelf = 0
    pages[-1].paste(f['img'], (x, y))
    out[f['key']] = [len(pages) - 1, x, y, w, h, f['ox'], f['oy']]
    shelf = max(shelf, h)
    used_h[-1] = max(used_h[-1], y + h)
    x += w + PAD

os.makedirs('public/sprites', exist_ok=True)
os.makedirs('src/data/sprites', exist_ok=True)
page_files = []
for i, p in enumerate(pages):
    ph = 1 << (used_h[i] - 1).bit_length()  # высота — степень двойки
    p = p.crop((0, 0, PAGE, min(PAGE, ph)))
    fn = f'sprites/{name}-{i}.webp'
    p.save(os.path.join('public', fn), 'WEBP', quality=90, method=6, alpha_quality=90)
    page_files.append([fn, p.width, p.height])

data = dict(name=name, ppu=TARGET_PPU, height=meta['height'], dirs=meta['dirs'],
            anims=meta['anims'], pages=page_files, frames=out)
json.dump(data, open(f'src/data/sprites/{name}.json', 'w'), separators=(',', ':'))
sizes = [os.path.getsize(os.path.join('public', p[0])) // 1024 for p in page_files]
print(f'{name}: {len(out)} кадров, страниц {len(pages)}, {sizes} КБ')
