/* ============================================================
   happy-farm v2 — 核心架構
   ------------------------------------------------------------
   這支檔案是 v1 → v2 唯一「重寫」的部分，其餘玩法系統原樣沿用。
   三層分離，各自有獨立的尺度規則：

     Iso     等角座標系 —— 資料是 (col,row)，不是絕對像素
     Camera  世界視角  —— x / y / zoom，只影響世界層
     UI      介面層    —— 以 --u 為單位，完全不受 camera 影響

   v1 的病根：世界用固定像素 + CSS transform 縮放，
   於是「農場放大」和「按鈕大小」共用同一個 transform，一改就顧此失彼。
   v2 讓兩者物理上分離：世界畫在 <canvas>，UI 是 DOM，兩者不共用任何 transform。
   ============================================================ */
"use strict";

/* ============================================================
   0) UI 尺度層 —— 設計基準 800×360，等比推導 --u
   ------------------------------------------------------------
   所有 UI 尺寸寫成 calc(var(--u) * n)，n 就是設計稿上的 px。
   真機、預覽、桌機因此自動一致，不必逐裝置補 media query。
   ============================================================ */
const DESIGN_W = 800, DESIGN_H = 360;

function syncUIScale(){
  const vw = window.innerWidth, vh = window.innerHeight;
  // 取較小的縮放比，確保設計稿完整可見；上限 2 避免大螢幕上 UI 過胖
  const u = Math.min(vw / DESIGN_W, vh / DESIGN_H, 2);
  document.documentElement.style.setProperty("--u", u + "px");
}

/* ============================================================
   1) 等角座標系
   ------------------------------------------------------------
   世界的資料結構是格線，不是自由擺放的絕對座標。
   v1 靠 CSS「rotate(14deg) scaleY(.5) rotate(45deg)」假造等角，
   於是每個子元素都得反向補正 rotate(-45deg) scaleY(2) rotate(-14deg)，
   而且點擊要用 clip-path 或逐像素描圖判定。
   v2 直接用公式換算，點擊判定變成反矩陣運算——沒有描圖這回事。
   ============================================================ */
const TILE_W = 128, TILE_H = 64;          // 標準 2:1 等角地磚

const Iso = {
  /** 格座標 → 世界座標（世界座標仍是「未經 camera」的平面座標） */
  toWorld(col, row){
    return { x: (col - row) * TILE_W / 2,
             y: (col + row) * TILE_H / 2 };
  },
  /** 世界座標 → 格座標（可含小數，用於命中判定） */
  toGrid(wx, wy){
    return { col: (wy / TILE_H) + (wx / TILE_W),
             row: (wy / TILE_H) - (wx / TILE_W) };
  },
  /** 深度：等角world的鐵律，col+row 越大越靠近鏡頭 */
  depth(col, row){ return col + row; },
};

/* ============================================================
   2) Camera —— 世界視角，只影響世界層
   ============================================================ */
const Camera = {
  x: 0, y: 0, zoom: 1,
  minZoom: 0.45, maxZoom: 2.2,

  /** 世界座標 → 螢幕座標 */
  toScreen(wx, wy, view){
    return { x: (wx - this.x) * this.zoom + view.w / 2,
             y: (wy - this.y) * this.zoom + view.h / 2 };
  },
  /** 螢幕座標 → 世界座標（點擊判定用） */
  toWorld(sx, sy, view){
    return { x: (sx - view.w / 2) / this.zoom + this.x,
             y: (sy - view.h / 2) / this.zoom + this.y };
  },
  /** 以某個螢幕點為錨縮放（雙指/滾輪縮放時畫面不會亂跳） */
  zoomAt(sx, sy, factor, view){
    const before = this.toWorld(sx, sy, view);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    const after = this.toWorld(sx, sy, view);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clamp();
  },
  /** 限制鏡頭範圍，避免把世界拖出畫面外 */
  clamp(){
    const b = World.bounds;
    this.x = Math.max(b.x0, Math.min(b.x1, this.x));
    this.y = Math.max(b.y0, Math.min(b.y1, this.y));
  },
  centerOn(col, row){
    const w = Iso.toWorld(col, row);
    this.x = w.x; this.y = w.y;
  },
};

/* ============================================================
   3) 狀態層 —— 單一來源 + 所有變更走 action
   ------------------------------------------------------------
   v1 的 G 物件散在各處被直接改，「哪裡動到存檔」很難追。
   v2 用 tx() 包住每一次變更：集中做存檔與重繪，也留下變更來源。
   （沿用的舊系統仍直接改 G，這是已知技術債，見 README）
   ============================================================ */
const Store = {
  /** 一次狀態異動：名稱只為除錯可讀 */
  tx(name, fn){
    const r = fn();
    Store.dirty = true;
    Store.lastTx = name;
    if (typeof save === "function") save();
    if (typeof render === "function") render();
    return r;
  },
  dirty: false,
  lastTx: "",
};

/* 田地版面：6 欄 × 3 列，與 v1 的 18 塊地一一對應（index = row*6 + col） */
const FIELD_COLS = 6, FIELD_ROWS = 3;
const FIELD_ORIGIN = { col: 0, row: 0 };     // 田地在世界格線上的起點

function plotGrid(i){
  return { col: FIELD_ORIGIN.col + (i % FIELD_COLS),
           row: FIELD_ORIGIN.row + Math.floor(i / FIELD_COLS) };
}
function gridToPlotIndex(col, row){
  // 必須用 round 不能用 floor：地磚是「以錨點為中心」畫的菱形，
  // 在格座標上覆蓋 [c-0.5, c+0.5]，而 floor 對應的是 [c, c+1)——
  // 用 floor 會讓可點區域和畫出來的地磚整整錯開半格。
  // 順便也解掉浮點邊界問題（round(-6.7e-16) = 0，floor 會變 -1）。
  const c = Math.round(col - FIELD_ORIGIN.col), r = Math.round(row - FIELD_ORIGIN.row);
  if (c < 0 || r < 0 || c >= FIELD_COLS || r >= FIELD_ROWS) return -1;
  return r * FIELD_COLS + c;
}

/* 牧場：一塊格線區域。動物的活動範圍是格座標，不再是 % 定位的梯形 */
const PEN = {
  c0: FIELD_COLS + 0.6, c1: FIELD_COLS + 3.4,
  r0: 0.2,              r1: 3.0,
  /** 開場位置：沿區域均勻散開，避免全部疊在一起 */
  spawn(i){
    const cols = 3;
    return { col: this.c0 + 0.4 + (i % cols) * ((this.c1 - this.c0 - 0.8) / (cols - 1)),
             row: this.r0 + 0.3 + Math.floor(i / cols) * 0.95 };
  },
  clamp(c, r){
    return { col: Math.max(this.c0, Math.min(this.c1, c)),
             row: Math.max(this.r0, Math.min(this.r1, r)) };
  },
};

/* 各動物在世界中的顯示高度（世界像素；一格地磚寬 128） */
const AN_H = { chick:34, cow:56, sheep:50, pig:46, bee:22 };

/* 農場島：草地不是無限平面，而是一塊有邊界的島。
   在格座標上用橢圓判定，投影到等角後是有機的圓潤形狀，不會是生硬的矩形。
   有了邊界，遠景幕布才有意義——否則草地會把背景整片蓋掉。 */
const ISLAND = {
  cx: 3.75, cy: 1.5, rx: 8, ry: 5,
  THICK: 26,                       // 島緣厚度（世界像素），讓島看起來有體積
  has(c, r){
    const dx = (c - this.cx) / this.rx, dy = (r - this.cy) / this.ry;
    return dx*dx + dy*dy <= 1;
  },
  /** 島的輪廓（格座標），用來畫接地陰影 */
  outline(steps){
    const pts = [];
    for (let i = 0; i < steps; i++){
      const t = i / steps * Math.PI * 2;
      pts.push({ col: this.cx + this.rx * Math.cos(t),
                 row: this.cy + this.ry * Math.sin(t) });
    }
    return pts;
  },
};

/* 世界上的固定物件：佔哪一格是「資料」，不是靠圖片對齊 */
const PROPS = [
  { key:"house",    img:"../building/house.png",    col:-2.4, row:-1.2, h:210, act:"profile" },
  { key:"storage",  img:"../building/storage.png",  col: 7.4, row:-0.6, h:190, act:"inv",     flip:true },
  { key:"factory",  img:"../building/factory.png",  col:-2.0, row: 3.2, h:200, act:"factory", flip:true },
  { key:"doghouse", img:"../building/doghouse.png", col: 7.0, row: 3.4, h:110, flip:true },
];

/* ============================================================
   4) World —— canvas 渲染
   ------------------------------------------------------------
   一次畫完，深度排序是 for 迴圈，不再有 z-index / pointer-events 補丁。
   ============================================================ */
const World = {
  cv: null, ctx: null, dpr: 1,
  view: { w: 0, h: 0 },
  bounds: { x0:-900, x1:900, y0:-500, y1:900 },
  img: {},
  hover: -1,
  pops: [],

  init(canvas){
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    // 鏡頭範圍依島的大小推導：島有邊界之後，不限制就會平移到空幕布上
    const ctr = Iso.toWorld(ISLAND.cx, ISLAND.cy);
    this.bounds = { x0: ctr.x - 430, x1: ctr.x + 430,
                    y0: ctr.y - 260, y1: ctr.y + 300 };
    this.resize();
    window.addEventListener("resize", () => { this.resize(); syncUIScale(); });
    Camera.centerOn(ISLAND.cx - 0.5, ISLAND.cy);
    this.loop();
  },

  resize(){
    const r = this.cv.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.view.w = r.width; this.view.h = r.height;
    this.cv.width  = Math.round(r.width  * this.dpr);
    this.cv.height = Math.round(r.height * this.dpr);
  },

  /** 載入圖片，缺圖不擋流程（回傳 null，繪製時略過） */
  load(key, src){
    return new Promise(res => {
      const im = new Image();
      im.onload = () => { this.img[key] = im; res(im); };
      im.onerror = () => { this.img[key] = null; res(null); };
      im.src = src;
    });
  },

  /** 螢幕座標 → 田地索引；沒中回 -1。取代 v1 的逐像素描圖判定 */
  pick(sx, sy){
    const w = Camera.toWorld(sx, sy, this.view);
    const g = Iso.toGrid(w.x, w.y);
    return gridToPlotIndex(g.col, g.row);
  },

  pop(col, row, text){
    const w = Iso.toWorld(col, row);
    this.pops.push({ x:w.x, y:w.y - 26, text, t:0 });
  },

  /* ---- 繪圖小工具 ---- */
  diamond(sx, sy, z){
    const c = this.ctx, hw = TILE_W/2*z, hh = TILE_H/2*z;
    c.beginPath();
    c.moveTo(sx, sy - hh); c.lineTo(sx + hw, sy);
    c.lineTo(sx, sy + hh); c.lineTo(sx - hw, sy);
    c.closePath();
  },
  sprite(im, sx, sy, h, flip){
    if (!im) return;
    const c = this.ctx, z = Camera.zoom;
    const dh = h * z, dw = im.width / im.height * dh;
    if (flip){
      c.save(); c.translate(sx, sy); c.scale(-1, 1);
      c.drawImage(im, -dw/2, -dh + TILE_H/2*z, dw, dh);
      c.restore();
    } else {
      c.drawImage(im, sx - dw/2, sy - dh + TILE_H/2*z, dw, dh);
    }
  },
  glyph(text, sx, sy, px, color){
    const c = this.ctx;
    c.save();
    c.font = "700 " + px + "px system-ui,'Noto Color Emoji','Apple Color Emoji',sans-serif";
    c.textAlign = "center"; c.textBaseline = "alphabetic";
    if (color){ c.fillStyle = color; }
    c.shadowColor = "#0006"; c.shadowBlur = px * 0.18; c.shadowOffsetY = px * 0.08;
    c.fillText(text, sx, sy);
    c.restore();
  },

  /* ---- 遠景幕布（視差圖層） ----
     規則：
     1. 畫在所有地磚之前，永遠不參與深度排序——它是「無限遠」。
     2. 位移只取 camera 的一小部分（PARALLAX），移動時才有遠近差。
     3. 縮放跟得比世界慢（BG_ZOOM_FOLLOW），否則放大時遠山會跟著衝過來、穿幫。
     4. 圖裡不能有地面透視，否則會跟等角格線打架。
     有 assets/bg_far.png 就用圖，沒有就用程式畫的替代版。 */
  drawBackdrop(view){
    const c = this.ctx, z = Camera.zoom;
    const PARALLAX_X = 0.16, PARALLAX_Y = 0.10, BG_ZOOM_FOLLOW = 0.35;
    const pz = 1 + (z - 1) * BG_ZOOM_FOLLOW;
    const ox = -Camera.x * PARALLAX_X * z;
    const oy = -Camera.y * PARALLAX_Y * z;
    const horizon = view.h * 0.30 + oy;

    // 天空
    const sky = c.createLinearGradient(0, 0, 0, horizon + 40 * pz);
    sky.addColorStop(0, "#8fcdf0"); sky.addColorStop(1, "#d8eef7");
    c.fillStyle = sky; c.fillRect(0, 0, view.w, view.h);

    const bg = this.img.bg;
    if (bg){
      // AI 幕布：等比鋪滿寬度，底邊對齊地平線下方一點
      const w = view.w * 1.35 * pz, h = bg.height / bg.width * w;
      c.drawImage(bg, view.w/2 - w/2 + ox, horizon - h * 0.72, w, h);
    } else {
      // 替代版：兩層丘陵 + 樹線剪影
      const hill = (yOff, amp, color, phase) => {
        c.beginPath();
        c.moveTo(-50, view.h);
        for (let x = -50; x <= view.w + 50; x += 24){
          const y = horizon + yOff - Math.sin((x + ox * 1.6 + phase) / 260) * amp * pz;
          c.lineTo(x, y);
        }
        c.lineTo(view.w + 50, view.h); c.closePath();
        c.fillStyle = color; c.fill();
      };
      hill(-14 * pz, 26 * pz, "#8fbf7a", 0);          // 遠丘
      // 樹線：一排圓形樹冠，坐在遠丘上
      c.fillStyle = "#5f9c55";
      for (let x = -40; x < view.w + 40; x += 34 * pz){
        const base = horizon - 14 * pz - Math.sin((x + ox * 1.6) / 260) * 26 * pz;
        const r = (9 + ((x * 7) % 5)) * pz;
        c.beginPath(); c.arc(x + (ox * 0.4) % (34 * pz), base - r * 0.5, r, 0, Math.PI * 2); c.fill();
      }
      hill(16 * pz, 18 * pz, "#7fb56a", 900);         // 近丘
    }

    // 地平線以下＝遠方的大地。刻意比島上的草更淡、更冷，
    // 島才會從背景中「浮」出來；顏色一樣的話兩者會糊成一片。
    const far = c.createLinearGradient(0, horizon, 0, view.h);
    far.addColorStop(0, "#a8cf93");
    far.addColorStop(1, "#93c47d");
    c.fillStyle = far; c.fillRect(0, horizon, view.w, view.h - horizon);

    // 大氣透視：越靠地平線越淡
    const haze = c.createLinearGradient(0, horizon - 30 * pz, 0, horizon + 90 * pz);
    haze.addColorStop(0, "#dceef7cc"); haze.addColorStop(1, "#dceef700");
    c.fillStyle = haze; c.fillRect(0, horizon - 30 * pz, view.w, 120 * pz);
  },

  /** 島的接地陰影：畫在地磚之前，讓島「坐」在遠方大地上而不是浮著 */
  drawIslandShadow(view){
    const c = this.ctx, z = Camera.zoom;
    const pts = ISLAND.outline(48);
    c.save();
    c.beginPath();
    pts.forEach((p, i) => {
      const w = Iso.toWorld(p.col, p.row);
      const s = Camera.toScreen(w.x, w.y + ISLAND.THICK * 1.15, view);
      i ? c.lineTo(s.x, s.y) : c.moveTo(s.x, s.y);
    });
    c.closePath();
    c.filter = "blur(" + (10 * z) + "px)";
    c.fillStyle = "rgba(40,70,30,0.28)";
    c.fill();
    c.restore();
  },

  /* ---- 主繪製 ---- */
  draw(now){
    const c = this.ctx, view = this.view, z = Camera.zoom;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.drawBackdrop(view);

    this.drawIslandShadow(view);

    const items = [];                       // 收集 → 依 depth 排序 → 一次畫完
    const add = (depth, fn) => items.push({ depth, fn });

    // 草地：只鋪在島的範圍內，島外留給遠景幕布
    const c0 = Math.floor(ISLAND.cx - ISLAND.rx), c1 = Math.ceil(ISLAND.cx + ISLAND.rx);
    const r0 = Math.floor(ISLAND.cy - ISLAND.ry), r1 = Math.ceil(ISLAND.cy + ISLAND.ry);
    for (let r = r0; r <= r1; r++){
      for (let col = c0; col <= c1; col++){
        if (!ISLAND.has(col, r)) continue;
        if (col >= 0 && col < FIELD_COLS && r >= 0 && r < FIELD_ROWS) continue;   // 田地另外畫
        const w = Iso.toWorld(col, r), s = Camera.toScreen(w.x, w.y, view);
        if (s.x < -TILE_W*z || s.x > view.w + TILE_W*z || s.y < -TILE_H*z || s.y > view.h + TILE_H*4*z) continue;
        // 沒有前方鄰居的格子＝島緣，要補側面才有厚度
        const edgeR = !ISLAND.has(col + 1, r);
        const edgeL = !ISLAND.has(col, r + 1);
        add(Iso.depth(col, r) - 0.5, () => {
          if (edgeR || edgeL) this.drawIslandEdge(s, z, edgeR, edgeL);
          this.diamond(s.x, s.y, z);
          c.fillStyle = ((col + r) & 1) ? "#8fc766" : "#86bf5e"; c.fill();
          c.strokeStyle = "#00000010"; c.lineWidth = 1; c.stroke();
        });
      }
    }

    // 田地
    const plots = (typeof VISIT !== "undefined" && VISIT.on) ? VISIT.plots : G.plots;
    plots.forEach((p, i) => {
      const gp = plotGrid(i);
      const w = Iso.toWorld(gp.col, gp.row), s = Camera.toScreen(w.x, w.y, view);
      if (s.x < -200 || s.x > view.w + 200 || s.y < -200 || s.y > view.h + 260) return;
      add(Iso.depth(gp.col, gp.row), () => this.drawPlot(p, i, s, z, now));
    });

    // 建築：佔格是資料
    PROPS.forEach(pr => {
      const w = Iso.toWorld(pr.col, pr.row), s = Camera.toScreen(w.x, w.y, view);
      add(Iso.depth(pr.col, pr.row), () => this.sprite(this.img[pr.key], s.x, s.y, pr.h, pr.flip));
    });

    // 牧場動物：同一套座標系，不再是另一個 DOM 世界
    (G.ranch || []).forEach((a, i) => {
      if (!a) return;
      if (a.gc == null){
        const p = PEN.spawn(i);
        a.gc = p.col; a.gr = p.row;
      }
      this.stepAnimal(a, now);
      const w = Iso.toWorld(a.gc, a.gr), s = Camera.toScreen(w.x, w.y, view);
      const def = (typeof ANIMALS !== "undefined") ? ANIMALS[a.a] : null;
      add(Iso.depth(a.gc, a.gr) + 0.2, () => {
        const im = this.img["an_" + a.a];
        if (im) this.sprite(im, s.x, s.y, AN_H[a.a] || 52, a.dir < 0);
        else if (def) this.glyph(def.emoji, s.x, s.y, 34 * z);
        if (a.ready && def){
          const bob = Math.sin(now / 320 + i) * 3;
          this.glyph(def.prod, s.x, s.y - 58 * z + bob * z, 22 * z);
        }
      });
    });

    items.sort((a, b) => a.depth - b.depth);
    for (const it of items) it.fn();

    // 浮動字（收成 +N 之類）
    for (let i = this.pops.length - 1; i >= 0; i--){
      const p = this.pops[i]; p.t += 1/60;
      if (p.t > 1.1){ this.pops.splice(i, 1); continue; }
      const s = Camera.toScreen(p.x, p.y - p.t * 34, view);
      c.save(); c.globalAlpha = Math.max(0, 1 - p.t / 1.1);
      this.glyph(p.text, s.x, s.y, 20 * z, "#fff");
      c.restore();
    }
  },

  drawPlot(p, i, s, z, now){
    const c = this.ctx;
    if (!p.unlocked){
      this.diamond(s.x, s.y, z);
      c.fillStyle = "#7fb85a"; c.fill();
      c.save(); c.globalAlpha = 0.34; c.fillStyle = "#2b3a20";
      this.diamond(s.x, s.y, z); c.fill(); c.restore();
      // 第一塊未開通的地標出售價，其餘只畫鎖
      const first = G.plots.findIndex(x => !x.unlocked);
      if (i === first && typeof LANDS !== "undefined" && LANDS[i]){
        this.glyph("Lv." + LANDS[i].lvl, s.x, s.y + 4*z, 13*z, "#fff");
      } else {
        this.drawLock(s.x, s.y + 3*z, 15*z);
      }
      return;
    }
    // 土地：畫出清楚的格線，讓玩家看得出一格一格（v1 這是靠 CSS 邊框硬湊）
    this.diamond(s.x, s.y, z);
    c.fillStyle = p.dry ? "#a8875c" : (p.state === "planted" ? "#8a6a45" : "#9a7852");
    c.fill();
    c.strokeStyle = "#6b4f33"; c.lineWidth = Math.max(1, 1.6 * z); c.stroke();
    // 上緣打亮，強化立體感
    c.beginPath();
    c.moveTo(s.x - TILE_W/2*z, s.y);
    c.lineTo(s.x, s.y - TILE_H/2*z);
    c.lineTo(s.x + TILE_W/2*z, s.y);
    c.strokeStyle = "#ffffff30"; c.lineWidth = Math.max(1, 1.4 * z); c.stroke();

    if (this.hover === i){
      this.diamond(s.x, s.y, z);
      c.strokeStyle = "#ffffffcc"; c.lineWidth = 2; c.stroke();
    }

    if (p.state === "planted" && typeof CROPS !== "undefined"){
      const cr = CROPS[p.crop];
      if (cr){
        const sway = Math.sin(now/700 + i) * 2 * z;
        if (p.ripe){
          this.glyph(cr.grown, s.x + sway, s.y + 6*z, 34*z);
        } else {
          const st = p.grow < cr.grow * 0.45 ? 0 : 1;
          this.glyph(STAGE[st], s.x + sway, s.y + 6*z, (st ? 26 : 20) * z);
          // 成長進度條
          const bw = 42*z, bh = 6*z, bx = s.x - bw/2, by = s.y + 12*z;
          c.fillStyle = "#0006"; c.fillRect(bx, by, bw, bh);
          c.fillStyle = "#8fd14f";
          c.fillRect(bx, by, bw * Math.min(1, p.grow / cr.grow), bh);
        }
      }
    }
    // 狀態圖示（缺水/雜草/蟲）
    let st = (p.dry ? "💧" : "") + (p.weed ? "🌿" : "") + (p.bug ? (p.bugBig ? "🐛" : "🐜") : "");
    if (st) this.glyph(st, s.x, s.y - 30*z, 15*z);
  },

  /** 島緣側面：從地磚的前兩條邊往下拉出土壁，島才有體積 */
  drawIslandEdge(s, z, edgeR, edgeL){
    const c = this.ctx, hw = TILE_W/2*z, hh = TILE_H/2*z, d = ISLAND.THICK * z;
    const bottom = { x: s.x, y: s.y + hh };
    if (edgeR){                                  // 右前面（受光較多）
      const p = { x: s.x + hw, y: s.y };
      c.beginPath();
      c.moveTo(p.x, p.y); c.lineTo(bottom.x, bottom.y);
      c.lineTo(bottom.x, bottom.y + d); c.lineTo(p.x, p.y + d);
      c.closePath();
      c.fillStyle = "#8a6a45"; c.fill();
      c.fillStyle = "#00000018"; c.fill();
    }
    if (edgeL){                                  // 左前面（背光，壓暗）
      const p = { x: s.x - hw, y: s.y };
      c.beginPath();
      c.moveTo(p.x, p.y); c.lineTo(bottom.x, bottom.y);
      c.lineTo(bottom.x, bottom.y + d); c.lineTo(p.x, p.y + d);
      c.closePath();
      c.fillStyle = "#6f5436"; c.fill();
    }
    // 土壁上緣的草皮厚度
    c.beginPath();
    if (edgeR){ c.moveTo(s.x + hw, s.y); c.lineTo(bottom.x, bottom.y); }
    if (edgeL){ c.moveTo(s.x - hw, s.y); c.lineTo(bottom.x, bottom.y); }
    c.lineWidth = Math.max(1.5, 5 * z); c.strokeStyle = "#6ba354"; c.stroke();
  },

  drawLock(x, y, size){
    const c = this.ctx, w = size, h = size*0.78, r = w*0.18;
    c.save(); c.translate(x, y);
    c.beginPath(); c.lineWidth = Math.max(1, w*0.16); c.strokeStyle = "#f7e7bb";
    c.arc(0, -h*0.42, w*0.28, Math.PI, 0); c.stroke();
    const x0 = -w/2, y0 = -h*0.12;
    c.beginPath();
    c.moveTo(x0+r, y0);
    c.arcTo(x0+w, y0,   x0+w, y0+h, r); c.arcTo(x0+w, y0+h, x0, y0+h, r);
    c.arcTo(x0,   y0+h, x0,   y0,   r); c.arcTo(x0,   y0,   x0+w, y0,   r);
    c.closePath();
    c.fillStyle = "#f2d489"; c.fill();
    c.lineWidth = Math.max(1, w*0.1); c.strokeStyle = "#a8813a"; c.stroke();
    c.restore();
  },

  /** 動物在牧場區域內慢慢走動（格座標，不是像素）
      v1 用 % 定位 + 手動維護 z-index，這裡走到哪深度就自動正確 */
  stepAnimal(a, now){
    const p = PEN.clamp(a.gc, a.gr);
    a.gc = p.col; a.gr = p.row;
    if (!a.nt || now > a.nt){
      a.nt = now + 2200 + Math.random()*3000;
      const t = PEN.clamp(PEN.c0 + Math.random()*(PEN.c1 - PEN.c0),
                          PEN.r0 + Math.random()*(PEN.r1 - PEN.r0));
      a.tc = t.col; a.tr = t.row;
    }
    const dc = (a.tc - a.gc), dr = (a.tr - a.gr), d = Math.hypot(dc, dr);
    if (d > 0.02){
      const sp = 0.011;                       // 格/幀
      a.gc += dc/d * sp; a.gr += dr/d * sp;
      a.dir = dc >= 0 ? 1 : -1;
    }
  },

  loop(){
    const step = (t) => { this.draw(t); requestAnimationFrame(step); };
    requestAnimationFrame(step);
  },
};

/* ============================================================
   5) Input —— 只作用在 canvas，UI 的點擊完全不經過這裡
   ------------------------------------------------------------
   v1 的 pointer-events 補丁就是因為 UI 和世界疊在同一棵 DOM 樹上。
   ============================================================ */
const Input = {
  drag: null, moved: 0, pinch: null, lastTapEnd: 0,

  init(canvas){
    const pos = e => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    canvas.addEventListener("pointerdown", e => {
      canvas.setPointerCapture(e.pointerId);
      this.drag = pos(e); this.moved = 0;
    });
    canvas.addEventListener("pointermove", e => {
      const p = pos(e);
      World.hover = World.pick(p.x, p.y);
      if (!this.drag) return;
      const dx = p.x - this.drag.x, dy = p.y - this.drag.y;
      this.moved += Math.abs(dx) + Math.abs(dy);
      Camera.x -= dx / Camera.zoom; Camera.y -= dy / Camera.zoom;
      Camera.clamp();
      this.drag = p;
    });
    const end = e => {
      if (this.drag && this.moved < 10){         // 門檻 10px，超過才算平移
        const p = pos(e);
        const i = World.pick(p.x, p.y);
        if (i >= 0 && typeof tapPlot === "function") tapPlot(i);
      }
      this.drag = null; this.lastTapEnd = Date.now();
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", () => { this.drag = null; });
    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      const p = pos(e);
      Camera.zoomAt(p.x, p.y, e.deltaY < 0 ? 1.12 : 0.89, World.view);
    }, { passive:false });

    // 雙指縮放
    let pts = new Map();
    canvas.addEventListener("pointerdown", e => pts.set(e.pointerId, pos(e)));
    canvas.addEventListener("pointermove", e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, pos(e));
      if (pts.size === 2){
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x-b.x, a.y-b.y);
        if (this.pinch){
          const mid = { x:(a.x+b.x)/2, y:(a.y+b.y)/2 };
          Camera.zoomAt(mid.x, mid.y, d / this.pinch, World.view);
        }
        this.pinch = d;
        this.drag = null;
      }
    });
    const clear = e => { pts.delete(e.pointerId); if (pts.size < 2) this.pinch = null; };
    canvas.addEventListener("pointerup", clear);
    canvas.addEventListener("pointercancel", clear);
  },
};

/* ============================================================
   6) 對外相容層
   ------------------------------------------------------------
   沿用的舊系統會呼叫 render() / renderGrid() / renderPen()。
   世界層改成 canvas 後這些不必再做事——每幀本來就重畫。
   保留同名函式，舊程式碼一行都不用改。
   ============================================================ */
function renderGrid(){ /* canvas 每幀重畫，無需手動同步 */ }
function renderPen(){  /* 同上 */ }
function clearPen(){   /* v1 需要手動回收 DOM 動物節點，v2 沒有節點可回收 */ }

/** v1 用它把「被 CSS transform 推歪的田地」重新置中；v2 直接移動 camera */
function centerField(){
  Camera.centerOn(FIELD_COLS / 2 - 0.5, FIELD_ROWS / 2 - 0.5);
}

/** 存檔沿用舊系統的 saveGame（含雲端推送），此處只做名稱對接 */
function save(){ if (typeof saveGame === "function") saveGame(); }

/* v1 有「手機預覽模擬器」，會用假的邏輯視口覆寫 VW()/VH()。
   v2 不需要模擬器——UI 以 --u 等比推導，桌機視窗直接就是真機的等比放大，
   所以這裡回傳真實視口即可。拉霸盤面的 slLayout() 仍靠這兩個函式算寬高。 */
function VW(){ return window.innerWidth; }
function VH(){ return window.innerHeight; }
const SIM = false;

window.Iso = Iso; window.Camera = Camera; window.World = World;
window.Input = Input; window.Store = Store;
window.syncUIScale = syncUIScale;
window.plotGrid = plotGrid; window.gridToPlotIndex = gridToPlotIndex;
