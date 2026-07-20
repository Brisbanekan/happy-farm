# SESSION PACKAGE — 開心農場 Happy Farm（交接補充 2026-07-20）

> 本檔是「本次 session 的變更補充」。完整專案背景（架構、股市、工廠、熱氣球、Firebase、iOS 橫置、部署流程細節等）仍以 **`SESSION-PACKAGE-20260716.md`** 為主，請兩份一起看。用繁體中文、回覆精簡、批次改、少截圖。

---

## 0. 本次最新狀態
- **最新 commit：`efcf9df`**（桌機版面重置）。檔案約 226KB。
- 本 session 全部圍繞「功能鍵（🎯 leftbar toggle）」的定位/動畫/版面問題，未動遊戲邏輯、股市、存檔。
- 唯一正式檔仍是 `C:\Users\ccltcd\Desktop\0705\happy-farm.html`，一律 host 端 Read/Edit/Grep。
- ⚠️ `0705\happy-farm-main\happy-farm.html` 是**舊的解壓副本（無本次修正）**，別拿它測試或覆蓋正式檔。

## 1. 本次修的五件事（功能鍵 🎯）
依序（commit）：

1. **右/下邊界超出框（`d609703`）**：手機預覽（SIM）機身有 11px border，`fabEnv()` 原本用含框的 `getBoundingClientRect` 尺寸當邊界，右/下各多算 22px→按鈕半顆出框。
   - 修：`fabEnv()` 原點加 `sc.clientLeft/clientTop*k`、邊界改用 `sc.clientWidth/clientHeight`（不含框）。
   - `updateFabDir()` 往上展開的錨點由 `VH()` 改 `e.h`（scene 內部高度），SIM 才不偏。
   - 真機無 border，不受影響。

2. **展開/收合瞬間位移（`54abdab`）**：`.leftbar` 平常 `column-reverse`（🎯 在整疊最下、底邊錨定）；若處於「top 錨 + column-reverse」不一致狀態再展開，項目會把 🎯 往下推約 158px。
   - 修：`toggleLeftbar()` 展開前先重釘錨邊。

3. **連點展開收合累積下移（`306b62f`）＝最關鍵**：`updateFabDir()` 每次「讀 rect→設定」有四捨五入殘留，約 0.05px/次，連點就一直往下沉。
   - 修：改**快取錨定**。`updateFabDir()` 算完把結果存 `bar._fab={down,top,bottom}`；新增 `applyFabAnchor()` 直接重貼快取值（不再量 rect）。`toggleLeftbar()` 展開時優先 `applyFabAnchor()`，無快取才 `updateFabDir()`。
   - 實測連點 60 次漂移由 ~3px 降到 0.1px（一次性、肉眼看不出）。
   - **`bar._fab` 何時刷新**：拖曳結束 `up()`、`clampFab()`、載入 `initFabDrag()` 都會呼叫 `updateFabDir()` 重新快取，所以永遠是最新拖曳位置。改這塊時務必維持「刻意移動才 updateFabDir、單純開關只 applyFabAnchor」的分工，否則漂移會回來。

4. **按鈕下沉動畫（`36db753`）**：先查證「按下 translateY(2px) 動畫」**不是**漂移主因（加了排除 transform 的量測後仍漂 0.1px＝純 rect round-trip）。之後**依使用者要求取消 🎯 的下沉動畫**：新增 `.leftbar .lbtoggle:active{transform:none;box-shadow:0 4px 0 #e6c486;}`（僅此鈕；每日/拉霸/股市仍保留 `translateY(2px)` 動畫）。

5. **桌機版面被手機拖曳污染（`efcf9df`）**：手機/預覽拖曳 🎯 會在 `.leftbar` 留下行內 `left/top` 與 `expand-down` class；切回網頁（桌機）時，這些殘留把常駐的每日/拉霸/股市整排推位移。
   - 修：`layout()` 內在 `!isNarrow()` 時清掉 `leftbar` 的行內 `left/top/bottom`＋移除 `expand-down/open`＋`_fab=null`，讓桌機固定回 CSS 版面（`bottom:94px`、`column-reverse`）。`layout()` 於 resize/切換預覽/載入都會跑，故自動生效。

## 2. 相關函式/CSS 位置（給後續改動用）
- `fabEnv()`、`updateFabDir()`、`applyFabAnchor()`、`clampFab()`、`initFabDrag()`：約 line 3148–3220。
- `toggleLeftbar()`/`closeLeftbar()`：約 line 2886–2892。
- `layout()`：約 line 3010（桌機重置在 `document.body.classList.toggle("narrow"...)` 之後）。
- CSS：`.leftbar`/`.lbtn`/`.lbtoggle`/`:active`/`.expand-down` 約 line 552–590；SIM 機身框 `body.sim #scene{border:11px...}` 約 line 214。
- 座標系一律用 **#scene 內部座標**；邊界用 `scene` 實際 client 尺寸，**不要用 VW()/VH()**（PWA/iOS 下會被 screen 修正值放大）。

## 3. 部署流程補充（本次踩到的坑）
- 流程同 0716 §3：Edit→Grep 驗證→ `upload/main` file_upload→JS 點 `Commit changes`→線上 `?_=時間戳` fetch 驗關鍵字＋語法。
- ⚠️ **點完 Commit 後別馬上讀 `location.href` 或立刻 navigate**：本 session 因為點完立即讀 location 導致 commit 送出被打斷、白部署一次。正確作法：**點完等 ~3 秒**再驗證/導頁。
- ⚠️ **`commits/main` 這個 API 端點會回舊快取**（本次看到 sha 沒更新誤判失敗）；改用 `commits?per_page=1&_=時間戳` 抓列表第一筆才準。
- Pages/raw 有 ~5–10 分 CDN 快取，剛部署 `hasFix` 可能 false，等一下再驗；以「pages 與 raw 都含新關鍵字」為準。
- 手機端看新版要 `?v=新數字` 重載或重開 PWA（`sw.js` 不快取，但瀏覽器 HTTP 快取仍會擋）。

## 4. 待辦 / 可提議（沿用 0716 §15，未變）
- 手機登入 `signInWithRedirect` fallback。
- 穩定後拆掉 `?debug=1`/🔧診斷面板。
- 工廠/熱氣球/融資數值平衡再依實玩微調。
- 功能鍵角落殘留 ~7px box-shadow（非主體）。
