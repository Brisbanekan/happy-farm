# happy-farm v2

把 `happy-farm.html` 的**世界層**換成 canvas 等角格線，**玩法一項不減**。

線上版：<https://brisbanekan.github.io/happy-farm/happy-farm-v2/>

---

## 為什麼要改：v1 的病根

v1 的世界是「固定像素 + CSS transform 縮放」，於是三件本來無關的事被綁在同一個 transform 上：

```css
/* v1：假造等角 */
#world .field{ transform: rotate(14deg) scaleY(.5) rotate(45deg); }
/* 於是每個子元素都要反向補正回來 */
.crop     { transform: rotate(-45deg) scaleY(2) translateY(-5px) rotate(-14deg); }
.statbub  { transform: translate(-50%,-50%) rotate(-45deg) scaleY(2) translateY(-25px) rotate(-14deg); }
.progress { transform: rotate(-45deg) scaleY(2) rotate(-14deg); }
```

連帶的代價：

- 農場一放大，按鈕跟著變大 → 手機上不是太小就是太擠
- 田地是自由擺放的絕對座標 → 點擊得靠 `clip-path`，最後還寫了**逐像素描圖判定**
  （v1 第 3481 行起：「依圖片實際不透明像素判斷命中，透明處把點擊讓給底下物件」）
- 動物是另一個 DOM 世界，`z-index` 要用 `zFor(y)` 每幀手動維護

**這些不是 bug，是「世界與 UI 共用尺度」這個決定的必然利息。**

---

## v2 怎麼分層

```
Iso      等角座標系   資料是 (col,row)，渲染時才換算成螢幕位置
Camera   世界視角     x / y / zoom —— 只影響世界層
UI       介面層       --u 為單位 —— 完全不受 camera 影響
```

世界畫在 `<canvas>`，UI 是 DOM，**兩者不共用任何 transform**。
「農場放大」和「按鈕大小」因此在物理上不可能互相影響。

### 等角換算取代描圖

```js
// 格 → 世界
toWorld(col,row){ return { x:(col-row)*TILE_W/2, y:(col+row)*TILE_H/2 }; }
// 世界 → 格（點擊判定就是這個反算）
toGrid(wx,wy){ return { col:wy/TILE_H + wx/TILE_W, row:wy/TILE_H - wx/TILE_W }; }
// 深度：等角世界的鐵律
depth(col,row){ return col+row; }
```

點擊 = `螢幕 → 世界 → 格 → 索引`，三行數學。v1 那 88 行描圖判定整段刪除。

### 深度排序

收集所有可繪物件 → 依 `col+row` 排序 → 一個 for 迴圈畫完。
沒有 `z-index`、沒有 `pointer-events` 補丁、動物走到哪深度都自動正確。

---

## 對照表

| | v1 | v2 |
|---|---|---|
| 世界渲染 | DOM 元素 + CSS transform | 一張 canvas，每幀重畫 |
| 等角 | `rotate(14deg) scaleY(.5) rotate(45deg)` 假造，子元素反向補正 | 座標公式換算 |
| 點擊判定 | `clip-path` + 逐像素描圖 | 反矩陣算出格子 |
| 深度 | `z-index` 手動維護（`zFor(y)`、`zTick()` 每幀更新） | `col+row` 排序 |
| 建築位置 | 絕對像素，靠圖片對齊 | 佔哪一格是資料（`PROPS`） |
| 動物 | 另一個 DOM 世界，`%` 定位 | 同一套格座標 |
| UI 尺寸 | 跟著世界 transform 一起縮放 | `--u`，設計基準 800×360 等比推導 |
| 縮放 | 改 transform，牽動一切 | 只動 `Camera.zoom` |
| 狀態變更 | 散在各處直接改 `G` | `Store.tx()` 集中（見下方技術債） |

---

## 檔案

```
index.html        外殼：canvas + UI DOM + 沿用的玩法面板
css/ui.css        UI 層（全部 --u）
css/systems.css   由 v1 篩出的玩法面板樣式（已剔除 v1 世界層與舊 HUD）
js/data.js        作物/動物/土地/拉霸盤面/股票清單 —— 原樣沿用
js/core.js        ★ Iso / Camera / World / Input / UI 尺度 —— 唯一重寫的部分
js/ui.js          ★ UI 層：HUD、工具、種子列、彈窗
js/farm.js        ★ 農場循環：點地、播種、收成、照顧、批次操作
js/systems.js     玩法系統 —— 由 happy-farm.html 原樣移植
js/boot.js        啟動順序：尺度 → 狀態 → 世界 → 輸入 → UI → 時間循環
```

★ = 新寫的。其餘是搬過來的。

**沿用的系統**：雲端同步與 Google 登入、拉霸（50 線 + FREE GAME）、股市（真實報價、
限價撮合、融資斷頭）、工廠加工、好友與偷菜、看門狗、熱氣球事件、成就、每日獎勵、
商店、倉庫、肥料、時間循環 `tick()`、存檔 `saveGame()`。

---

## 已知技術債

1. **舊系統仍直接改 `G`**。`Store.tx()` 只包住 v2 新寫的農場動作；`js/systems.js` 裡的
   系統維持原本的寫法。要完全收斂成單一 action 入口，得逐一改寫那些系統——
   但那會動到「原樣保留」的承諾，所以留著，先讓架構跑起來。
2. **`css/systems.css` 是機器篩選的結果**。用選擇器黑名單剔除 v1 世界層樣式，
   可能留了少數用不到的規則（`.pen`、`.path` 之類），不影響運作。
3. **`_legacy-full.css`、`_legacy-body.html`、`_panels.html`** 是抽取過程的中間檔，
   確認 v2 沒問題後可以刪掉。

## 改動後記得

`index.html` 裡 css/js 的 `?v=` 數字要加一，否則瀏覽器會沿用舊快取。
（v1 沒做這件事，改圖改程式後常常「看起來沒生效」。）
