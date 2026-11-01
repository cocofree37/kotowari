"""「いまの調子」アイコン(太陽と水平線)を docs/img/energy-1..5.png に書き出す。

- 1,2,3,5: design/energy-src/ の元画像を、水平線の位置と線の太さをそろえて縮小
- 4(好調): 元画像を使わず、同じ文法(丸い線端・1本の水平線・4分の3の太陽と5本の光線)でここで描く
- 背景は純白・線は黒。画面側で選択中は CSS の invert で白抜きにする

実行: python3 scripts/make-energy-icons.py  (要 Pillow / numpy)
"""
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'design' / 'energy-src'
OUT = ROOT / 'docs' / 'img'

CANVAS = 2100      # 作業キャンバス(正方形)
HORIZON_Y = 1270   # 全アイコン共通の水平線の高さ
SIZE = 192         # 出力サイズ
STROKE = 40        # 線の太さ(作業キャンバス基準。小さく表示しても線が痩せない太さ)

# 番号: (ファイル, 水平線は上端か下端か, 目標の太さ)
SOURCES = {
    1: ('ぐったり.jpeg', 'top', 34),  # 点線の円が割れないよう、太くしすぎない
    2: ('いまいち.jpeg', 'bottom', STROKE),
    3: ('ふつう.jpeg', 'bottom', STROKE),
    5: ('絶好調.jpeg', 'bottom', STROKE),
}


def shifted(m, dy, dx):
    out = np.zeros_like(m)
    h, w = m.shape
    out[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = m[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
    return out


def dilate(m, steps):
    """十字と3x3を交互に重ねて、ほぼ円形に線を太らせる(斜めの光線も均等に太る)。"""
    for i in range(steps):
        offsets = [(1, 0), (-1, 0), (0, 1), (0, -1)]
        if i % 2:
            offsets += [(1, 1), (1, -1), (-1, 1), (-1, -1)]
        r = m.copy()
        for dy, dx in offsets:
            r |= shifted(m, dy, dx)
        m = r
    return m


def horizon(mask, edge):
    """水平線の中心のy座標と太さ。左端付近の列にある、最上段または最下段の線を調べる。"""
    ys, xs = np.where(mask)
    col = mask[:, int(xs.min() + 0.1 * (xs.max() - xs.min()))]
    rows = np.where(col)[0]
    runs = np.split(rows, np.where(np.diff(rows) > 1)[0] + 1)
    run = runs[0] if edge == 'top' else runs[-1]
    return (run[0] + run[-1]) / 2, len(run)


def from_source(path, edge, target):
    mask = np.array(Image.open(path).convert('L')) < 128
    hy, thick = horizon(mask, edge)
    mask = dilate(mask, max(0, round((target - thick) / 2)))
    canvas = np.zeros((CANVAS, CANVAS), bool)
    h, w = mask.shape
    oy, ox = HORIZON_Y - round(hy), (CANVAS - w) // 2
    y0, x0 = max(oy, 0), max(ox, 0)
    y1, x1 = min(oy + h, CANVAS), min(ox + w, CANVAS)
    canvas[y0:y1, x0:x1] = mask[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
    return Image.fromarray(np.where(canvas, 0, 255).astype(np.uint8))


def draw_koucho():
    """好調: 太陽の4分の3が水平線の上に出ていて、5本の光線が扇状に伸びる。"""
    k = 2  # 2倍で描いて縮小(アンチエイリアス)
    img = Image.new('L', (CANVAS * k, CANVAS * k), 255)
    d = ImageDraw.Draw(img)
    w = STROKE * k
    cx, hy, r = CANVAS * k // 2, HORIZON_Y * k, 330 * k
    cy = hy - r // 2  # 中心は水平線より r/2 上 = 直径の4分の3が見える

    def line(p, q):
        d.line([p, q], fill=0, width=w)
        for x, y in (p, q):
            d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=0)

    line((cx - 760 * k, hy), (cx + 760 * k, hy))
    # 水平線との交点(中心から見て下に30度)の間を、上側を回る大円弧で描く
    d.arc([cx - r, cy - r, cx + r, cy + r], start=150, end=30, fill=0, width=w)
    for deg in (-60, -30, 0, 30, 60):
        a = math.radians(deg)
        p = (cx + math.sin(a) * (r + 80 * k), cy - math.cos(a) * (r + 80 * k))
        q = (cx + math.sin(a) * (r + 390 * k), cy - math.cos(a) * (r + 390 * k))
        line(p, q)
    return img.resize((CANVAS, CANVAS), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    icons = {n: from_source(SRC / f, edge, t) for n, (f, edge, t) in SOURCES.items()}
    icons[4] = draw_koucho()
    for n, img in sorted(icons.items()):
        img.resize((SIZE, SIZE), Image.LANCZOS).save(OUT / f'energy-{n}.png', optimize=True)
        print('wrote', OUT / f'energy-{n}.png')


if __name__ == '__main__':
    main()
