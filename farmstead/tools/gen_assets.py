#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Farmstead — 程式化美術素材產生器
全部素材以 PIL 繪製，4x 超取樣後縮放取得抗鋸齒邊緣。
座標規則：等角地磚 128x64（2:1）；物件錨點一律「底部中心」。
"""
import os, math, random
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")
os.makedirs(OUT, exist_ok=True)
S = 4  # supersample

TILE_W, TILE_H = 128, 64

# ---------- 色盤（統一風格：柔和田園） ----------
P = {
    "grass_top":   (140, 200, 96),
    "grass_top2":  (122, 186, 84),
    "grass_side":  (94, 150, 62),
    "grass_side2": (78, 128, 52),
    "soil_top":    (150, 106, 72),
    "soil_top2":   (134, 92, 62),
    "soil_side":   (104, 72, 48),
    "wet_top":     (108, 76, 54),
    "wet_top2":    (96, 66, 46),
    "wet_side":    (78, 54, 38),
    "outline":     (60, 48, 40, 90),
    "shadow":      (40, 60, 30, 70),
    "wood":        (166, 118, 74),
    "wood_dark":   (128, 88, 54),
    "wood_light":  (196, 150, 100),
    "roof":        (196, 92, 78),
    "roof_dark":   (162, 70, 60),
    "roof2":       (120, 148, 178),
    "roof2_dark":  (94, 120, 150),
    "wall":        (246, 238, 220),
    "wall_dark":   (222, 210, 190),
    "leaf":        (96, 172, 76),
    "leaf_dark":   (72, 138, 58),
    "leaf_light":  (140, 202, 104),
}


def new(w, h):
    return Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))


def finish(img, w, h, name):
    out = img.resize((w, h), Image.LANCZOS)
    out.save(os.path.join(OUT, name))
    return out


def diamond(cx, cy, w, h):
    """等角菱形頂點（中心 cx,cy）"""
    return [(cx, cy - h / 2), (cx + w / 2, cy), (cx, cy + h / 2), (cx - w / 2, cy)]


def shade(col, f):
    return tuple(max(0, min(255, int(c * f))) for c in col[:3]) + (col[3] if len(col) > 3 else 255,)


# ================= 地磚 =================
def make_tile(name, top, top2, side, side2=None, furrows=False, wet=False, speckle=True):
    """等角地磚：菱形頂面 + 左右側壁（有厚度）"""
    th = 10  # 厚度
    w, h = TILE_W, TILE_H + th
    img = new(w, h)
    d = ImageDraw.Draw(img)
    cx, cy = w * S / 2, (TILE_H / 2) * S
    dw, dh = TILE_W * S, TILE_H * S

    # 側壁
    side2 = side2 or shade(side, 0.85)
    left = [(cx - dw / 2, cy), (cx, cy + dh / 2), (cx, cy + dh / 2 + th * S), (cx - dw / 2, cy + th * S)]
    right = [(cx + dw / 2, cy), (cx, cy + dh / 2), (cx, cy + dh / 2 + th * S), (cx + dw / 2, cy + th * S)]
    d.polygon(left, fill=side)
    d.polygon(right, fill=side2)

    # 頂面
    top_pts = diamond(cx, cy, dw, dh)
    d.polygon(top_pts, fill=top)

    # 頂面漸層（上半亮）
    grad = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    gd.polygon([(cx, cy - dh / 2), (cx + dw / 2, cy), (cx, cy), (cx - dw / 2, cy)], fill=top2 + (70,) if len(top2) == 3 else top2)
    img.alpha_composite(grad)

    if furrows:
        # 犁溝畫在獨立圖層後用菱形遮罩裁切（避免超出地磚邊界）
        fl = Image.new("RGBA", img.size, (0, 0, 0, 0))
        fd = ImageDraw.Draw(fl)
        rnd_f = random.Random(7)
        for i in range(-3, 4):
            t = i / 4.0
            # 平行於菱形「右下邊」方向：由左上往右下的等角線
            ax = cx - dw / 2 + t * dw / 2
            ay = cy + t * dh / 2
            bx = cx + t * dw / 2
            by = cy + dh / 2 + t * dh / 2 - dh / 2 * 0 - dh * 0
            b = (cx + t * dw / 2, cy - dh / 2 + t * dh / 2 + dh)
            # 用向量：起點在左頂點方向，終點在下頂點方向
            a = (ax, ay)
            b = (ax + dw / 2, ay + dh / 2)
            jitter = rnd_f.uniform(-1.0, 1.0) * S
            mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + jitter)
            fd.line([a, mid, b], fill=shade(top, 0.80), width=int(3.0 * S), joint="curve")
            fd.line([(a[0], a[1] - 2.4 * S), (mid[0], mid[1] - 2.4 * S), (b[0], b[1] - 2.4 * S)],
                    fill=shade(top, 1.14), width=int(1.5 * S), joint="curve")
        fmask = Image.new("L", img.size, 0)
        ImageDraw.Draw(fmask).polygon(diamond(cx, cy, dw, dh), fill=255)
        img.paste(fl, (0, 0), Image.composite(fl.split()[3], Image.new("L", img.size, 0), fmask))

    if speckle:
        rnd = random.Random(hash(name) & 0xffff)
        for _ in range(90):
            t = rnd.random(); u = rnd.random()
            if t + u > 1:
                t, u = 1 - t, 1 - u
            px = cx + (t - u) * dw / 2
            py = cy + (t + u - 0.5) * dh / 2 - dh / 4
            r = rnd.uniform(1.0, 2.4) * S
            c = shade(top, rnd.uniform(0.9, 1.12))
            d.ellipse([px - r, py - r * 0.55, px + r, py + r * 0.55], fill=c)

    if wet:
        # 濕潤感：整面壓暗＋少量柔和反光（不要白點）
        wetlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        wd = ImageDraw.Draw(wetlay)
        wd.polygon(diamond(cx, cy, dw, dh), fill=(30, 60, 90, 46))
        rnd = random.Random(11)
        for _ in range(4):
            px = cx + rnd.uniform(-0.24, 0.24) * dw
            py = cy + rnd.uniform(-0.2, 0.2) * dh
            r = rnd.uniform(7, 12) * S
            wd.ellipse([px - r, py - r * 0.45, px + r, py + r * 0.45], fill=(150, 195, 225, 34))
        wetlay = wetlay.filter(ImageFilter.GaussianBlur(2.2 * S))
        # 只保留菱形內
        mask = Image.new("L", img.size, 0)
        ImageDraw.Draw(mask).polygon(diamond(cx, cy, dw, dh), fill=255)
        img.paste(Image.alpha_composite(img.crop((0, 0, *img.size)), wetlay), (0, 0), mask)

    # 邊線
    d.line(top_pts + [top_pts[0]], fill=P["outline"], width=int(1.6 * S))
    return finish(img, w, h, name)


# ================= 作物 =================
def crop_base(w, h):
    img = new(w, h)
    return img, ImageDraw.Draw(img)


def draw_leaf(d, x, y, L, ang, col, col2, width_f=0.42):
    """一片葉子（橢圓弧形）"""
    ex = x + math.cos(ang) * L
    ey = y + math.sin(ang) * L
    steps = 16
    pts_a, pts_b = [], []
    for i in range(steps + 1):
        t = i / steps
        px = x + (ex - x) * t
        py = y + (ey - y) * t
        wdt = math.sin(math.pi * t) * L * width_f
        nx, ny = -math.sin(ang), math.cos(ang)
        pts_a.append((px + nx * wdt, py + ny * wdt))
        pts_b.append((px - nx * wdt, py - ny * wdt))
    d.polygon(pts_a + pts_b[::-1], fill=col)
    d.line(pts_a, fill=col2, width=max(1, int(1.2 * S)))


def make_crop(name, stage, kind):
    """stage: 0=幼苗 1=成長 2=成熟"""
    w, h = 64, 72
    img, d = crop_base(w, h)
    cx = w * S / 2
    gy = h * S - 6 * S  # 地面線

    # 影子
    d.ellipse([cx - 15 * S, gy - 5 * S, cx + 15 * S, gy + 5 * S], fill=(40, 60, 30, 60))

    if stage == 0:
        d.line([(cx, gy), (cx, gy - 12 * S)], fill=P["leaf_dark"], width=int(2.2 * S))
        draw_leaf(d, cx, gy - 10 * S, 11 * S, math.radians(-150), P["leaf"], P["leaf_dark"])
        draw_leaf(d, cx, gy - 10 * S, 11 * S, math.radians(-30), P["leaf_light"], P["leaf_dark"])
        return finish(img, w, h, name)

    stem_h = 22 * S if stage == 1 else 30 * S
    d.line([(cx, gy), (cx, gy - stem_h)], fill=P["leaf_dark"], width=int(3 * S))
    for i, a in enumerate((-160, -20, -130, -50)):
        if stage == 1 and i >= 2:
            break
        y0 = gy - stem_h * (0.45 + 0.18 * i)
        draw_leaf(d, cx, y0, (13 + i) * S, math.radians(a), P["leaf"] if i % 2 else P["leaf_light"], P["leaf_dark"])

    if stage == 2:
        top = gy - stem_h
        if kind == "carrot":
            for k, off in ((0, 0), (1, -7), (2, 7)):
                x = cx + off * S
                y = top + 6 * S + k * 2 * S
                d.ellipse([x - 7 * S, y - 8 * S, x + 7 * S, y + 8 * S], fill=(240, 146, 62))
                d.ellipse([x - 4 * S, y - 6 * S, x + 1 * S, y + 2 * S], fill=(252, 178, 108))
        elif kind == "tomato":
            for x_off, y_off, r in ((-8, 2, 8), (8, 0, 9), (0, -8, 7)):
                x, y = cx + x_off * S, top + 8 * S + y_off * S
                d.ellipse([x - r * S, y - r * S, x + r * S, y + r * S], fill=(226, 74, 62))
                d.ellipse([x - r * 0.55 * S, y - r * 0.7 * S, x - r * 0.05 * S, y - r * 0.2 * S], fill=(255, 150, 138))
        elif kind == "corn":
            for x_off in (-7, 7):
                x, y = cx + x_off * S, top + 10 * S
                d.rounded_rectangle([x - 5 * S, y - 12 * S, x + 5 * S, y + 10 * S], radius=5 * S, fill=(246, 206, 80))
                for r in range(5):
                    d.line([(x - 4 * S, y - 9 * S + r * 4 * S), (x + 4 * S, y - 9 * S + r * 4 * S)],
                           fill=(226, 180, 58), width=int(1.2 * S))
        else:  # pumpkin
            x, y = cx, top + 12 * S
            d.ellipse([x - 15 * S, y - 11 * S, x + 15 * S, y + 11 * S], fill=(238, 140, 50))
            for o in (-9, -3, 3, 9):
                d.arc([x + o * S - 5 * S, y - 11 * S, x + o * S + 5 * S, y + 11 * S], 260, 280, fill=(214, 116, 40), width=int(1.6 * S))
            d.rectangle([x - 2 * S, y - 15 * S, x + 2 * S, y - 10 * S], fill=P["leaf_dark"])
    return finish(img, w, h, name)


# ================= 建築 =================
def iso_box(d, cx, cy, w, dep, hgt, top_col, left_col, right_col, outline=True):
    """等角立方體：回傳頂面中心 y"""
    hw, hd = w / 2, dep / 2
    # 底面四點（等角）
    b_top = (cx, cy - (hw + hd) * 0.0)
    p_l = (cx - hw, cy - hw * 0.5)
    p_r = (cx + hd, cy - hd * 0.5)
    p_b = (cx + hd - hw, cy - hw * 0.5 - hd * 0.5 + (hw * 0.5 + hd * 0.5))
    # 用標準等角：以中心為底部中點
    P0 = (cx, cy)                     # 底前
    P1 = (cx - hw, cy - hw * 0.5)     # 底左
    P2 = (cx, cy - (hw + hd) * 0.5)   # 底後
    P3 = (cx + hd, cy - hd * 0.5)     # 底右
    T0 = (P0[0], P0[1] - hgt)
    T1 = (P1[0], P1[1] - hgt)
    T2 = (P2[0], P2[1] - hgt)
    T3 = (P3[0], P3[1] - hgt)
    d.polygon([P1, P0, T0, T1], fill=left_col)
    d.polygon([P0, P3, T3, T0], fill=right_col)
    d.polygon([T1, T0, T3, T2], fill=top_col)
    if outline:
        for poly in ([P1, P0, T0, T1], [P0, P3, T3, T0], [T1, T0, T3, T2]):
            d.polygon(poly, outline=P["outline"])
    return T0, T1, T2, T3


def make_barn(name="barn.png"):
    w, h = 200, 190
    img = new(w, h)
    d = ImageDraw.Draw(img)
    cx, gy = w * S / 2, (h - 14) * S
    d.ellipse([cx - 78 * S, gy - 16 * S, cx + 78 * S, gy + 16 * S], fill=(40, 60, 30, 70))
    bw, bd, bh = 108 * S, 92 * S, 62 * S
    T0, T1, T2, T3 = iso_box(d, cx, gy, bw, bd, bh, shade(P["wood"], 1.05), shade(P["wood"], 0.8), P["wood"])
    # 屋頂（山形）
    ridge_h = 40 * S
    apex_l = (T1[0] + (T2[0] - T1[0]) * 0.5, T1[1] + (T2[1] - T1[1]) * 0.5 - ridge_h)
    apex_r = (T0[0] + (T3[0] - T0[0]) * 0.5, T0[1] + (T3[1] - T0[1]) * 0.5 - ridge_h)
    d.polygon([T1, T0, apex_r, apex_l], fill=P["roof"], outline=P["outline"])
    d.polygon([T0, T3, apex_r], fill=shade(P["roof"], 0.88), outline=P["outline"])
    d.polygon([T1, apex_l, T2], fill=shade(P["roof"], 0.78), outline=P["outline"])
    d.line([apex_l, apex_r], fill=shade(P["roof"], 0.7), width=int(2 * S))
    # 木紋
    for i in range(1, 6):
        t = i / 6
        a = (T1[0] + (T0[0] - T1[0]) * t, T1[1] + (T0[1] - T1[1]) * t)
        d.line([a, (a[0], a[1] + bh)], fill=shade(P["wood"], 0.72), width=int(1.4 * S))
    # 大門
    door_c = ((T0[0] + T3[0]) / 2, (T0[1] + T3[1]) / 2 + bh * 0.55)
    dwid, dhei = 30 * S, 40 * S
    d.polygon([(door_c[0] - dwid * 0.1, door_c[1] - dhei * 0.5), (door_c[0] + dwid, door_c[1] - dhei * 0.05),
               (door_c[0] + dwid, door_c[1] + dhei * 0.62), (door_c[0] - dwid * 0.1, door_c[1] + dhei * 0.2)],
              fill=(72, 52, 40), outline=P["outline"])
    d.line([(door_c[0] - dwid * 0.05, door_c[1] - dhei * 0.2), (door_c[0] + dwid * 0.9, door_c[1] + dhei * 0.28)],
           fill=P["wood_light"], width=int(2 * S))
    return finish(img, w, h, name)


def make_house(name="house.png"):
    w, h = 180, 176
    img = new(w, h)
    d = ImageDraw.Draw(img)
    cx, gy = w * S / 2, (h - 14) * S
    d.ellipse([cx - 68 * S, gy - 14 * S, cx + 68 * S, gy + 14 * S], fill=(40, 60, 30, 70))
    bw, bd, bh = 92 * S, 80 * S, 50 * S
    T0, T1, T2, T3 = iso_box(d, cx, gy, bw, bd, bh, shade(P["wall"], 1.02), shade(P["wall_dark"], 0.9), P["wall"])
    ridge_h = 34 * S
    apex_l = (T1[0] + (T2[0] - T1[0]) * 0.5, T1[1] + (T2[1] - T1[1]) * 0.5 - ridge_h)
    apex_r = (T0[0] + (T3[0] - T0[0]) * 0.5, T0[1] + (T3[1] - T0[1]) * 0.5 - ridge_h)
    d.polygon([T1, T0, apex_r, apex_l], fill=P["roof2"], outline=P["outline"])
    d.polygon([T0, T3, apex_r], fill=shade(P["roof2"], 0.86), outline=P["outline"])
    d.polygon([T1, apex_l, T2], fill=shade(P["roof2"], 0.76), outline=P["outline"])
    # 窗
    for t in (0.32, 0.68):
        a = (T1[0] + (T0[0] - T1[0]) * t, T1[1] + (T0[1] - T1[1]) * t + bh * 0.42)
        d.polygon([(a[0] - 9 * S, a[1] - 12 * S), (a[0] + 9 * S, a[1] - 7 * S),
                   (a[0] + 9 * S, a[1] + 8 * S), (a[0] - 9 * S, a[1] + 3 * S)],
                  fill=(150, 205, 235), outline=P["outline"])
    # 門
    dc = ((T0[0] + T3[0]) / 2, (T0[1] + T3[1]) / 2 + bh * 0.6)
    d.polygon([(dc[0] - 2 * S, dc[1] - 20 * S), (dc[0] + 20 * S, dc[1] - 12 * S),
               (dc[0] + 20 * S, dc[1] + 16 * S), (dc[0] - 2 * S, dc[1] + 8 * S)],
              fill=P["wood_dark"], outline=P["outline"])
    # 煙囪
    d.rectangle([apex_l[0] + 16 * S, apex_l[1] - 22 * S, apex_l[0] + 28 * S, apex_l[1] + 6 * S],
                fill=(190, 110, 96), outline=P["outline"])
    return finish(img, w, h, name)


def make_shop(name="shop.png"):
    w, h = 176, 168
    img = new(w, h)
    d = ImageDraw.Draw(img)
    cx, gy = w * S / 2, (h - 14) * S
    d.ellipse([cx - 66 * S, gy - 13 * S, cx + 66 * S, gy + 13 * S], fill=(40, 60, 30, 70))
    bw, bd, bh = 88 * S, 76 * S, 46 * S
    T0, T1, T2, T3 = iso_box(d, cx, gy, bw, bd, bh, shade((252, 246, 232), 1.0), (216, 206, 188), (238, 230, 212))
    # 平屋頂 + 條紋遮陽棚
    d.polygon([T1, T0, T3, T2], fill=(236, 228, 210), outline=P["outline"])
    # 遮陽棚（前面）
    aw = 12 * S
    A0 = (T0[0], T0[1] + 6 * S)
    A1 = (T1[0], T1[1] + 6 * S)
    A2 = (T1[0] - aw * 0.2, T1[1] + 20 * S)
    A3 = (T0[0] - aw * 0.2, T0[1] + 20 * S)
    d.polygon([A1, A0, A3, A2], fill=(236, 122, 108), outline=P["outline"])
    n = 6
    for i in range(n):
        t0, t1 = i / n, (i + 0.5) / n
        p0 = (A1[0] + (A0[0] - A1[0]) * t0, A1[1] + (A0[1] - A1[1]) * t0)
        p1 = (A1[0] + (A0[0] - A1[0]) * t1, A1[1] + (A0[1] - A1[1]) * t1)
        q0 = (A2[0] + (A3[0] - A2[0]) * t0, A2[1] + (A3[1] - A2[1]) * t0)
        q1 = (A2[0] + (A3[0] - A2[0]) * t1, A2[1] + (A3[1] - A2[1]) * t1)
        d.polygon([p0, p1, q1, q0], fill=(250, 244, 236))
    # 攤位箱
    for off, col in ((-22, (238, 140, 50)), (0, (226, 74, 62)), (22, (140, 200, 96))):
        bx = cx + off * S * 0.7
        by = gy - 6 * S
        d.rounded_rectangle([bx - 11 * S, by - 12 * S, bx + 11 * S, by + 4 * S], radius=3 * S,
                            fill=P["wood"], outline=P["outline"])
        d.ellipse([bx - 8 * S, by - 18 * S, bx + 8 * S, by - 6 * S], fill=col)
    return finish(img, w, h, name)


def make_silo(name="silo.png"):
    w, h = 120, 200
    img = new(w, h)
    d = ImageDraw.Draw(img)
    cx, gy = w * S / 2, (h - 12) * S
    d.ellipse([cx - 34 * S, gy - 12 * S, cx + 34 * S, gy + 12 * S], fill=(40, 60, 30, 70))
    r, bh = 30 * S, 110 * S
    d.rectangle([cx - r, gy - bh, cx + r, gy], fill=(206, 212, 220))
    d.rectangle([cx - r, gy - bh, cx - r * 0.25, gy], fill=(226, 232, 240))
    d.rectangle([cx + r * 0.45, gy - bh, cx + r, gy], fill=(178, 186, 196))
    for i in range(6):
        y = gy - bh + i * (bh / 6)
        d.line([(cx - r, y), (cx + r, y)], fill=(168, 176, 188), width=int(1.6 * S))
    d.ellipse([cx - r, gy - 12 * S, cx + r, gy + 12 * S], fill=(190, 198, 208), outline=P["outline"])
    # 圓頂
    d.pieslice([cx - r, gy - bh - r * 0.95, cx + r, gy - bh + r * 0.95], 180, 360, fill=(196, 92, 78), outline=P["outline"])
    d.ellipse([cx - r, gy - bh - 11 * S, cx + r, gy - bh + 11 * S], fill=(210, 104, 88), outline=P["outline"])
    return finish(img, w, h, name)


def make_well(name="well.png"):
    w, h = 110, 120
    img = new(w, h)
    d = ImageDraw.Draw(img)
    cx, gy = w * S / 2, (h - 12) * S
    d.ellipse([cx - 32 * S, gy - 11 * S, cx + 32 * S, gy + 11 * S], fill=(40, 60, 30, 70))
    r = 28 * S
    d.ellipse([cx - r, gy - 26 * S, cx + r, gy - 2 * S], fill=(120, 128, 140))
    d.ellipse([cx - r * 0.72, gy - 22 * S, cx + r * 0.72, gy - 6 * S], fill=(86, 148, 200))
    d.rectangle([cx - r, gy - 16 * S, cx + r, gy], fill=(150, 156, 166))
    d.ellipse([cx - r, gy - 12 * S, cx + r, gy + 12 * S], fill=(132, 140, 152), outline=P["outline"])
    for x in (-r * 0.8, r * 0.8):
        d.rectangle([cx + x - 3 * S, gy - 58 * S, cx + x + 3 * S, gy - 14 * S], fill=P["wood_dark"])
    d.polygon([(cx - r * 1.1, gy - 54 * S), (cx + r * 1.1, gy - 54 * S), (cx, gy - 78 * S)],
              fill=P["roof"], outline=P["outline"])
    return finish(img, w, h, name)


# ================= 動物 =================
def make_chicken(name="chicken.png"):
    w, h = 56, 56
    img = new(w, h)
    d = ImageDraw.Draw(img)
    cx, gy = w * S / 2, (h - 8) * S
    d.ellipse([cx - 14 * S, gy - 5 * S, cx + 14 * S, gy + 5 * S], fill=(40, 60, 30, 60))
    d.line([(cx - 5 * S, gy), (cx - 5 * S, gy - 8 * S)], fill=(238, 170, 60), width=int(2 * S))
    d.line([(cx + 5 * S, gy), (cx + 5 * S, gy - 8 * S)], fill=(238, 170, 60), width=int(2 * S))
    d.ellipse([cx - 15 * S, gy - 30 * S, cx + 15 * S, gy - 6 * S], fill=(252, 250, 244), outline=P["outline"])
    d.ellipse([cx - 2 * S, gy - 26 * S, cx + 13 * S, gy - 12 * S], fill=(236, 232, 224))
    d.ellipse([cx - 17 * S, gy - 42 * S, cx + 3 * S, gy - 24 * S], fill=(252, 250, 244), outline=P["outline"])
    d.polygon([(cx - 17 * S, gy - 34 * S), (cx - 25 * S, gy - 32 * S), (cx - 17 * S, gy - 29 * S)], fill=(240, 158, 54))
    d.ellipse([cx - 13 * S, gy - 37 * S, cx - 9 * S, gy - 33 * S], fill=(50, 40, 36))
    for o in (-6, -2, 2):
        d.ellipse([cx + o * S - 3 * S, gy - 46 * S, cx + o * S + 3 * S, gy - 40 * S], fill=(226, 74, 62))
    return finish(img, w, h, name)


def make_cow(name="cow.png"):
    w, h = 84, 66
    img = new(w, h)
    d = ImageDraw.Draw(img)
    cx, gy = w * S / 2, (h - 8) * S
    d.ellipse([cx - 24 * S, gy - 6 * S, cx + 24 * S, gy + 6 * S], fill=(40, 60, 30, 60))
    for x in (-14, -6, 8, 16):
        d.rectangle([cx + x * S - 3 * S, gy - 12 * S, cx + x * S + 3 * S, gy], fill=(60, 52, 48))
    d.rounded_rectangle([cx - 22 * S, gy - 34 * S, cx + 20 * S, gy - 8 * S], radius=11 * S,
                        fill=(250, 248, 244), outline=P["outline"])
    for sx, sy, r in ((-12, -26, 6), (2, -18, 5), (10, -28, 4)):
        d.ellipse([cx + sx * S - r * S, gy + sy * S - r * S, cx + sx * S + r * S, gy + sy * S + r * S], fill=(60, 52, 48))
    d.ellipse([cx + 12 * S, gy - 44 * S, cx + 34 * S, gy - 24 * S], fill=(250, 248, 244), outline=P["outline"])
    d.ellipse([cx + 20 * S, gy - 34 * S, cx + 33 * S, gy - 26 * S], fill=(246, 190, 186))
    d.ellipse([cx + 22 * S, gy - 32 * S, cx + 25 * S, gy - 29 * S], fill=(90, 70, 66))
    d.ellipse([cx + 28 * S, gy - 32 * S, cx + 31 * S, gy - 29 * S], fill=(90, 70, 66))
    d.ellipse([cx + 15 * S, gy - 41 * S, cx + 20 * S, gy - 37 * S], fill=(60, 52, 48))
    return finish(img, w, h, name)


# ================= 裝飾 =================
def make_tree(name="tree.png"):
    w, h = 96, 118
    img = new(w, h)
    d = ImageDraw.Draw(img)
    cx, gy = w * S / 2, (h - 10) * S
    d.ellipse([cx - 26 * S, gy - 9 * S, cx + 26 * S, gy + 9 * S], fill=(40, 60, 30, 70))
    d.polygon([(cx - 7 * S, gy), (cx + 7 * S, gy), (cx + 4 * S, gy - 36 * S), (cx - 4 * S, gy - 36 * S)],
              fill=P["wood_dark"], outline=P["outline"])
    for cxx, cyy, r in ((0, -62, 30), (-20, -50, 22), (20, -50, 22), (-8, -78, 20), (12, -76, 18)):
        d.ellipse([cx + cxx * S - r * S, gy + cyy * S - r * S, cx + cxx * S + r * S, gy + cyy * S + r * S],
                  fill=P["leaf_dark"])
    for cxx, cyy, r in ((-4, -66, 24), (-18, -54, 16), (14, -56, 16), (-6, -80, 15)):
        d.ellipse([cx + cxx * S - r * S, gy + cyy * S - r * S, cx + cxx * S + r * S, gy + cyy * S + r * S],
                  fill=P["leaf"])
    for cxx, cyy, r in ((-10, -74, 12), (6, -64, 10)):
        d.ellipse([cx + cxx * S - r * S, gy + cyy * S - r * S, cx + cxx * S + r * S, gy + cyy * S + r * S],
                  fill=P["leaf_light"])
    return finish(img, w, h, name)


def make_fence(name="fence.png"):
    w, h = 128, 56
    img = new(w, h)
    d = ImageDraw.Draw(img)
    # 沿等角方向的柵欄（左下→右上）
    x0, y0 = 6 * S, (h - 8) * S
    x1, y1 = (w - 6) * S, (h - 8) * S - (TILE_H / 2) * S
    for t in (0.0, 0.5, 1.0):
        px = x0 + (x1 - x0) * t
        py = y0 + (y1 - y0) * t
        d.rectangle([px - 3 * S, py - 30 * S, px + 3 * S, py], fill=P["wood"], outline=P["outline"])
    for off in (10, 22):
        d.line([(x0, y0 - off * S), (x1, y1 - off * S)], fill=P["wood_light"], width=int(4 * S))
        d.line([(x0, y0 - off * S), (x1, y1 - off * S)], fill=P["outline"], width=int(1 * S))
    return finish(img, w, h, name)


# ================= 產物圖示（UI 用） =================
def make_icon(name, kind):
    w = h = 48
    img = new(w, h)
    d = ImageDraw.Draw(img)
    cx = cy = w * S / 2
    if kind == "carrot":
        d.polygon([(cx - 9 * S, cy - 6 * S), (cx + 9 * S, cy - 6 * S), (cx, cy + 16 * S)], fill=(240, 146, 62))
        d.polygon([(cx - 6 * S, cy - 4 * S), (cx + 2 * S, cy - 4 * S), (cx - 2 * S, cy + 8 * S)], fill=(252, 178, 108))
        for a in (-40, 0, 40):
            draw_leaf(d, cx, cy - 6 * S, 14 * S, math.radians(-90 + a), P["leaf"], P["leaf_dark"])
    elif kind == "tomato":
        d.ellipse([cx - 14 * S, cy - 10 * S, cx + 14 * S, cy + 16 * S], fill=(226, 74, 62))
        d.ellipse([cx - 9 * S, cy - 6 * S, cx - 1 * S, cy + 2 * S], fill=(255, 150, 138))
        for a in (-60, -20, 20, 60):
            draw_leaf(d, cx, cy - 9 * S, 9 * S, math.radians(-90 + a), P["leaf_dark"], P["leaf_dark"], 0.5)
    elif kind == "corn":
        d.rounded_rectangle([cx - 8 * S, cy - 15 * S, cx + 8 * S, cy + 15 * S], radius=8 * S, fill=(246, 206, 80))
        for r in range(6):
            d.line([(cx - 6 * S, cy - 11 * S + r * 5 * S), (cx + 6 * S, cy - 11 * S + r * 5 * S)],
                   fill=(226, 180, 58), width=int(1.4 * S))
        draw_leaf(d, cx - 6 * S, cy + 6 * S, 16 * S, math.radians(-140), P["leaf"], P["leaf_dark"])
    elif kind == "pumpkin":
        d.ellipse([cx - 17 * S, cy - 10 * S, cx + 17 * S, cy + 14 * S], fill=(238, 140, 50))
        for o in (-10, -3, 4, 11):
            d.arc([cx + o * S - 5 * S, cy - 10 * S, cx + o * S + 5 * S, cy + 14 * S], 260, 280,
                  fill=(214, 116, 40), width=int(1.8 * S))
        d.rectangle([cx - 2 * S, cy - 15 * S, cx + 2 * S, cy - 9 * S], fill=P["leaf_dark"])
    elif kind == "egg":
        d.ellipse([cx - 11 * S, cy - 14 * S, cx + 11 * S, cy + 14 * S], fill=(252, 248, 238), outline=P["outline"])
        d.ellipse([cx - 7 * S, cy - 9 * S, cx - 1 * S, cy - 1 * S], fill=(255, 255, 250))
    elif kind == "milk":
        d.polygon([(cx - 10 * S, cy + 16 * S), (cx + 10 * S, cy + 16 * S), (cx + 10 * S, cy - 8 * S),
                   (cx, cy - 17 * S), (cx - 10 * S, cy - 8 * S)], fill=(250, 250, 248), outline=P["outline"])
        d.rectangle([cx - 10 * S, cy + 2 * S, cx + 10 * S, cy + 10 * S], fill=(120, 180, 226))
    elif kind == "coin":
        d.ellipse([cx - 16 * S, cy - 16 * S, cx + 16 * S, cy + 16 * S], fill=(240, 190, 60), outline=(198, 148, 40), width=int(2 * S))
        d.ellipse([cx - 11 * S, cy - 11 * S, cx + 11 * S, cy + 11 * S], fill=(252, 214, 96))
        d.ellipse([cx - 9 * S, cy - 10 * S, cx - 2 * S, cy - 3 * S], fill=(255, 240, 180))
    return finish(img, w, h, name)


if __name__ == "__main__":
    make_tile("tile_grass.png", P["grass_top"], P["grass_top2"] + (80,), P["grass_side"], P["grass_side2"])
    make_tile("tile_soil.png", P["soil_top"], P["soil_top2"] + (70,), P["soil_side"], furrows=True)
    make_tile("tile_wet.png", P["wet_top"], P["wet_top2"] + (70,), P["wet_side"], furrows=True, wet=True)

    for kind in ("carrot", "tomato", "corn", "pumpkin"):
        for st in (0, 1, 2):
            make_crop(f"crop_{kind}_{st}.png", st, kind)

    make_barn(); make_house(); make_shop(); make_silo(); make_well()
    make_chicken(); make_cow(); make_tree(); make_fence()
    for k in ("carrot", "tomato", "corn", "pumpkin", "egg", "milk", "coin"):
        make_icon(f"icon_{k}.png", k)

    files = sorted(os.listdir(OUT))
    print(f"generated {len(files)} assets")
    for f in files:
        print(" ", f)
