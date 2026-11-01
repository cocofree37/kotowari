"""ファビコンを docs/ に書き出す(favicon.svg / favicon.ico / apple-touch-icon.png)。

黒地に白で「水平線と日の出」(いまの調子のアイコンと同じモチーフ)。
小さく表示されても潰れないよう、塗りつぶしの半円と太めの線にしている。
SVG と PNG/ICO は同じ座標(64x64)から作る。

実行: python3 scripts/make-favicons.py  (要 Pillow)
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / 'docs'

# 64x64 の座標系
HORIZON_Y = 44
HORIZON = (10, 54)         # 水平線の左右端
SUN_R = 14                 # 半円の半径(中心は水平線上の x=32)
RAY_ANGLES = (-50, 0, 50)  # 光線の向き(真上からの角度)
RAY_FROM, RAY_TO = 21, 29  # 光線の始点・終点(太陽の中心からの距離)
LINE_W = 4


def rays():
    out = []
    for deg in RAY_ANGLES:
        a = math.radians(deg)
        out.append(((32 + RAY_FROM * math.sin(a), HORIZON_Y - RAY_FROM * math.cos(a)),
                    (32 + RAY_TO * math.sin(a), HORIZON_Y - RAY_TO * math.cos(a))))
    return out


def svg():
    lines = [f'<line x1="{HORIZON[0]}" y1="{HORIZON_Y}" x2="{HORIZON[1]}" y2="{HORIZON_Y}"/>']
    lines += [f'<line x1="{p[0]:.2f}" y1="{p[1]:.2f}" x2="{q[0]:.2f}" y2="{q[1]:.2f}"/>' for p, q in rays()]
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n'
        '  <rect width="64" height="64" fill="#000"/>\n'
        f'  <path d="M{32 - SUN_R} {HORIZON_Y} A{SUN_R} {SUN_R} 0 0 1 {32 + SUN_R} {HORIZON_Y} Z" fill="#fff"/>\n'
        f'  <g stroke="#fff" stroke-width="{LINE_W}" stroke-linecap="round">\n    ' + '\n    '.join(lines) + '\n  </g>\n'
        '</svg>\n'
    )


def png(size):
    k = 8  # 8倍で描いて縮小(アンチエイリアス)
    s = size * k / 64
    img = Image.new('RGB', (size * k, size * k), (0, 0, 0))
    d = ImageDraw.Draw(img)
    r = LINE_W * s / 2

    def line(p, q):
        d.line([(p[0] * s, p[1] * s), (q[0] * s, q[1] * s)], fill=(255, 255, 255), width=round(LINE_W * s))
        for x, y in (p, q):  # 丸い線端
            d.ellipse([x * s - r, y * s - r, x * s + r, y * s + r], fill=(255, 255, 255))

    d.pieslice([(32 - SUN_R) * s, (HORIZON_Y - SUN_R) * s, (32 + SUN_R) * s, (HORIZON_Y + SUN_R) * s], 180, 360, fill=(255, 255, 255))
    line((HORIZON[0], HORIZON_Y), (HORIZON[1], HORIZON_Y))
    for p, q in rays():
        line(p, q)
    return img.resize((size, size), Image.LANCZOS)


def main():
    (OUT / 'favicon.svg').write_text(svg(), encoding='utf-8')
    png(180).save(OUT / 'apple-touch-icon.png', optimize=True)
    png(256).save(OUT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
    for name in ('favicon.svg', 'favicon.ico', 'apple-touch-icon.png'):
        print('wrote', OUT / name, (OUT / name).stat().st_size, 'bytes')


if __name__ == '__main__':
    main()
