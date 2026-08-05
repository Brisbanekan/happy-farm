#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 AI 生成的風景圖處理成遊戲用的遠景幕布 assets/bg_far.png

為什麼要處理，不能直接用原圖：
  1. 視口的「天空帶」是很扁的長條（地平線在畫面 30% 處），
     16:9 的原圖直接鋪滿寬度會把天空撐得太高，只剩丘陵看得到。
     裁成寬條之後比例才對得上。
  2. 頂緣做 alpha 淡出，讓幕布溶進 canvas 畫的天空漸層，
     這樣換時間帶（黃昏、夜晚）只要改天空漸層，不必重畫幕布。
  3. 底部純色區只留一點點 —— 那一段之後會被「遠方大地」填色接手。

用法：把 AI 生的風景圖放進 Downloads，改 SRC 後執行。
"""
import os
from PIL import Image

SRC_DIR = "/sessions/intelligent-exciting-clarke/mnt/Downloads"
SRC = "Gemini_Generated_Image_fpk6yjfpk6yjfpk6.png"

# 依原圖內容量出來的分界（比例）
SKY_KEEP   = 0.234      # 從這裡開始保留（上面是大片空天，交給 canvas 漸層）
GROUND_AT  = 0.625      # 丘陵底線＝開始變成單純平綠的位置
BOTTOM     = 0.645      # 裁到這裡，留一點平綠好和遠方大地接色
FADE       = 0.28       # 頂部這個比例做淡出

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "assets", "bg_far.png")


def main():
    im = Image.open(os.path.join(SRC_DIR, SRC)).convert("RGBA")
    w, h = im.size

    top, bot = int(h * SKY_KEEP), int(h * BOTTOM)
    im = im.crop((0, top, w, bot))
    cw, ch = im.size

    # 頂緣淡出：讓幕布和 canvas 的天空漸層無縫接起來
    a = im.getchannel("A").load()
    px = im.load()
    fade_px = int(ch * FADE)
    for y in range(fade_px):
        k = y / fade_px                      # 0（最上，全透明）→ 1（不透明）
        v = int(255 * (k ** 1.4))
        for x in range(cw):
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, v)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    im.save(OUT)

    ground_ratio = (h * GROUND_AT - top) / ch
    print("bg_far.png", im.size)
    print("丘陵底線在圖高的 %.3f  → core.js 的 BG_GROUND 要設成這個值" % ground_ratio)
    # 順便回報底部平綠的顏色，遠方大地要用同色才不會有接縫
    rgb = im.convert("RGB")
    print("底部平綠 =", rgb.getpixel((cw // 2, ch - 3)))


if __name__ == "__main__":
    main()
