#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 Canva AI 匯出的白底 PNG 處理成遊戲素材。

流程：邊緣泛洪去背（保留物件內部白色，例如乳牛白身、母雞白羽）
      → 去除殘留白邊 → 裁切透明邊 → 依目標高度等比縮放 → 存進 assets/
"""
import os, sys
from collections import deque
from PIL import Image, ImageFilter

DL = "/sessions/intelligent-exciting-clarke/mnt/Downloads"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")
os.makedirs(OUT, exist_ok=True)

# 來源檔 → (輸出名, 目標高度 px)
JOBS = {
    "fs_barn.png":    ("barn.png",    190),
    "fs_house.png":   ("house.png",   176),
    "fs_chicken.png": ("chicken.png",  38),
    "fs_cow.png":     ("cow.png",      62),
    "fs_shop.png":    ("shop.png",    168),
    "fs_silo.png":    ("silo.png",    200),
    "fs_well.png":    ("well.png",    120),
    "fs_tree.png":    ("tree.png",    118),
    "fs_fence.png":   ("fence.png",    56),
}

def remove_bg(im, tol=2):
    # 容差必須極小：AI 圖的白色物件（母雞白羽 255,252,246）與純白背景只差數階，
    # 容差一大就會從邊緣抗鋸齒像素「漏」進物件內部，把白色主體整片吃掉。
    """從四邊泛洪，把連通的近白色像素設為透明。物件內部的白色不受影響。"""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    dq = deque()

    def near_white(p):
        return p[0] >= 255 - tol and p[1] >= 255 - tol and p[2] >= 255 - tol

    for x in range(w):
        for y in (0, h - 1):
            if not seen[y * w + x] and near_white(px[x, y]):
                seen[y * w + x] = 1; dq.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y * w + x] and near_white(px[x, y]):
                seen[y * w + x] = 1; dq.append((x, y))

    while dq:
        x, y = dq.popleft()
        px[x, y] = (255, 255, 255, 0)
        for dx, dy in ((1,0), (-1,0), (0,1), (0,-1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and near_white(px[nx, ny]):
                seen[ny * w + nx] = 1; dq.append((nx, ny))
    return im


def clean_edge(im):
    """柔化去背邊緣（不侵蝕主體，避免吃掉淺色物件的輪廓）。"""
    r, g, b, a = im.split()
    a = a.filter(ImageFilter.GaussianBlur(0.5))
    a = a.point(lambda v: 0 if v < 40 else (255 if v > 210 else v))   # 去掉半透明殘渣
    return Image.merge("RGBA", (r, g, b, a))


def drop_ground_shadow(im, zone=0.24):
    """移除 AI 畫的地面陰影：只掃底部區域，且只吃「冷灰」像素（b>=r）。
    暖白的物件（母雞 255,252,246，b<r）不受影響。"""
    im = im.convert("RGBA"); w, h = im.size; px = im.load()
    y0 = int(h * (1 - zone))
    for y in range(y0, h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            mx, mn = max(r, g, b), min(r, g, b)
            sat = (mx - mn) / 255.0
            if mx > 200 and sat < 0.10 and b >= r:      # 冷調淺灰＝陰影
                px[x, y] = (r, g, b, 0)
    return im


def process(src, dst, target_h):
    p = os.path.join(DL, src)
    if not os.path.exists(p):
        return f"skip {src} (not found)"
    im = Image.open(p)
    im = remove_bg(im)
    im = clean_edge(im)
    im = drop_ground_shadow(im)
    bb = im.getbbox()
    if bb:
        im = im.crop(bb)
    ratio = target_h / im.height
    im = im.resize((max(1, round(im.width * ratio)), target_h), Image.LANCZOS)
    im.save(os.path.join(OUT, dst))
    return f"{src} -> {dst} {im.size}"


if __name__ == "__main__":
    only = sys.argv[1:] or None
    for src, (dst, th) in JOBS.items():
        if only and src not in only:
            continue
        print(process(src, dst, th))
