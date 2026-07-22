# SESSION PACKAGE — 開心農場 Happy Farm（交接補充 2026-07-22）

> 本次 session 變更補充。完整背景見 **`SESSION-PACKAGE-20260716.md`**（架構/股市/工廠/Firebase/iOS）與 **`SESSION-PACKAGE-20260720.md`**（功能鈕定位/動畫/桌機版面）。用繁體中文、回覆精簡、批次改、少截圖。

---

## 0. 本次最新狀態
- **最新 commit：`5546d5d`**。檔案約 232KB。
- 本 session 全部在 UI/牧場動態/好友/點擊判定，未動股市與存檔結構。
- 唯一正式檔 `C:\Users\ccltcd\Desktop\0705\happy-farm.html`，host 端 Read/Edit/Grep。`0705\happy-farm-main\` 是舊副本，勿用。

## 1. 本次改動（依序，含 commit）
1. **蜜蜂尺寸**（`31a1ebe`→`65ce3a2`）：`AN_SIZE.bee` 46→最終 **50px**。動物顯示尺寸都在 `AN_SIZE`（line ~2050），img `height`。
2. **動物錨點改底部中心**（`13bde0d`）：`.animal{transform:translate(-50%,-50%)}` → **`translate(-50%,-100%)`**（line ~521、281 同步）。座標＝腳底、深度排序更準。靠上緣動物身體可能微凸圍籬（待收 `RANCH_Y0` 走動上緣）。
3. **遮擋順序同步**（`a82c94f`）＝重要：原本 z-index 在移動開始就設終點 y，整段位移期間層級是終點值→前後突然跳。改成 **`zTick` 用 requestAnimationFrame 依即時內插 y 更新 z-index**（`penMotion[i]={y0,y1,t0,ms}`、`startZTick`、`zFor(y)=Math.round(y*10)` 提高解析度）。維護原則：走動時記 `penMotion`＋`startZTick`；`clearPen`/移除動物要清 `penMotion` 並 `cancelAnimationFrame`。
4. **農場/牧場同大小**（`fb1f35e`）：`calcWorldScale()` 兩場景統一 **`Math.max(s, coverScale())`**（原本農場只填寬 `VW/WORLD_W`、牧場 cover，差約 1.7%）。cover≥VW/W，已涵蓋原本農場填寬需求。
5. **功能鈕磁吸＋選單鈕縮小**（`6078dd8`）：`snapFabY()` 拖曳時功能鈕垂直中心靠近 dock（好友/商店/倉庫）那排中線 12px 內就吸附對齊（`FAB_SNAP=12`）。選單鈕 `body.narrow .topmenu` 縮到 40px、圓角 12、`top/right` 6/8px 往右上角靠，避開右側工具列（原本只差 3px 幾乎重疊）。
6. **種子命名分離**（`3651ed5`）：新增 `seedName(k)=CROPS[k].name+"種子"`。商店販售清單、倉庫🌱種子頁、選種面板、種子獎勵文字都顯示「番茄種子」；收成/倉庫收成頁/工廠原料仍用 `CROPS[k].name`（番茄）。
7. **全服自動真實好友**（`e7ba738`）：新增 `loadAllPlayers()`，登入後與開好友面板時讀 `profiles/` 名冊，把每個非自己、未加過的真實玩家自動併進 `G.pals`（免代碼）。拜訪沿用 `users/{uid}`。**Firebase 規則已具備** `profiles/.read:"auth!=null"`（使用者現有規則就有，無需再改）。NPC🤖電腦好友（`G.friends`）維持不變。
8. **淡化消失＋狗狗屋群組**（`33091dd`）：`.zoomfade` 由 `opacity:.22`→**`opacity:0`**（真正淡到消失，`.bld`/`#dog` 本就有 `.35s` 過渡）。`updateFade` 改用 `applyGroup(sels)`：群組內任一在中心整組保持清楚、否則整組一起淡化；**狗 `#dog`＋狗屋 `.bld.doghouse` 編成同群組**同步。
9. **描圖點擊 + 平移方向2**（`5546d5d`）：
   - **描圖**：倉庫/房子/工廠改 `data-act`（inv/profile/factory），`initBldHit()` 綁點擊；`imgOpaqueAt()` 把圖縮到 canvas 取 alpha，**依實際不透明像素判斷命中**，透明處把點擊轉給底下物件（`elementFromPoint`＋重派 click）。水平翻轉倉庫用 `DOMMatrix.a<0` 校正 u=1-u。跨域污染時保底回退成整塊可點（本機 file:// 會回退，github.io 同源正常）。
   - **平移方向2**：`panDown` 加 `if(userZoom<=1){dragActive=false;return;}`——**未放大完全不平移、點擊保持純點擊**；放大後才可拖。雙指縮放不受影響。

## 2. 部署流程重點（本 session 踩到）
- 流程同 0716/0720：Edit→`node` 語法檢查（跑每個 inline `<script>` 過 `new Function`）→ `upload/main` file_upload→JS 點 `Commit changes`→線上 `?_=時間戳` fetch 驗關鍵字＋語法。
- ⚠️ **GitHub upload 舊分頁常卡 `document_idle`**（find/file_upload 逾時）：**開新分頁**（`tabs_create_mcp`）重進 upload 頁即可，之後沿用新分頁。
- ⚠️ 點完 Commit **等 ~3 秒**再導頁，別立刻讀 `location`（會打斷送出）。
- ⚠️ 驗證用 `commits?per_page=1`（不要 `commits/main`，那個回舊快取）。github.com 頁 CSP 擋跨站 fetch→先 navigate 到 github.io 再驗。Pages CDN 有 ~5–10 分快取，剛部署 pages 可能 false，等一下再驗。
- 多裝置：兩個 Chrome 連線時要先 `select_browser` 選定。

## 3. 待辦 / 可提議
- 按鈕對齊：使用者提過想討論各組按鈕「共用一條基準線」（目前各組各自貼邊，非同軸）——待議。
- 動物腳底錨點後，靠上緣可能凸出圍籬 → 可收 `RANCH_Y0` 走動上緣。
- 全服好友：玩家數變多時 `loadAllPlayers` 會把所有人加成好友，未來可考慮上限/分頁。
- 其餘沿用 0716/0720：手機 `signInWithRedirect` fallback、拆 `?debug=1`、數值平衡。
