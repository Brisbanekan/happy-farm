# SESSION PACKAGE — 開心農場 Happy Farm（交接文件 2026-07-08）

> 給下一個對話 / 新 session 用。貼上這份即可無縫接手。用繁體中文溝通，使用者很在意 token，請批次修改、少截圖。

---

## 1. 專案是什麼
單一檔案網頁遊戲「開心農場 Happy Farm」（vanilla JS/CSS + 外部 PNG 素材），部署在 GitHub Pages。
- **Repo**：https://github.com/Brisbanekan/happy-farm（public，只有 `main`）
- **線上**：https://brisbanekan.github.io/happy-farm/happy-farm.html
- 功能：等角農田、牧場動物、看門狗、好友/拜訪/偷菜、每日獎勵/拉霸/股市（真實報價）、Firebase Google 雲端存檔、多裝置防互蓋、PWA。

## 2. 檔案位置（最重要）
- **唯一正式檔**：`C:\Users\ccltcd\Desktop\0705\happy-farm.html`（約 154KB）
  - 一律用 host 端 Read/Edit/Grep 操作。**不要用 bash 讀它**——bash 掛載會給截斷的舊快取（本 session 再次確認此雷）。
- 素材資料夾：`C:\Users\ccltcd\Desktop\happyfarmpic\{animal,background,building,fence}`
- **本 session 已把四個素材資料夾複製進 `0705\`**，本地直接開 HTML 就能看到圖（相對路徑）。
- 交接文件：`0705\SESSION-PACKAGE-20260708.md`（本檔）。

## 3. 部署流程（每次改完都要做）
1. Edit `0705\happy-farm.html`。
2. 瀏覽器開 `https://github.com/Brisbanekan/happy-farm/upload/main`，find「file upload input」→ file_upload。
3. Commit 用 JS 點正好等於 `Commit changes` 的按鈕：
   `[...document.querySelectorAll('button')].find(b=>/^commit changes$/i.test(b.textContent.trim())).click()`
4. 等 ~30 秒，用 deployments API 查 `state:"success"`。**API 有時延遲或沒新紀錄**——改用線上頁直接驗 CSS 規則（navigate `?v=N` cache-bust 後查 `document.styleSheets[0].cssRules`）最可靠。
5. raw.githubusercontent 有 ~5 分 CDN 快取，別急著用它判斷。
6. 素材傳對應子資料夾 `upload/main/{background,building,animal}`。

**工具雷區**：bash 讀 happy-farm.html 會拿到截斷舊版（誤導語法檢查）；web_fetch 抓大檔會截斷；github.com 頁面 CSP 擋跨站 fetch（驗線上檔要先 navigate 到 github.io 再跑 JS）。

## 4. 目前關鍵參數（現狀，commit `ecd32e0`）
- 世界 2200×1000；`.wcontent{left:314px;width:1400px}`；焦點 FX=934,FY=520。
- 建築：倉庫 `left:18px;top:251px;width:350px`（img scaleX(-1)）；房子 `left:855px;top:376px;width:350px`。
- 田地：`#world .field{left:370px;top:680px;transform:translate(-50%,-50%) rotate(10deg) scaleY(.5) rotate(45deg)}`
  - **外層 rotate(10deg)＝整塊田順時針轉 10 度**（剛性旋轉，不破等角地磚）。
  - 5 處反向修正在 transform 尾端加 `rotate(-10deg)`：`.crop`、`.ov`、狀態泡泡（translateY(-25px) 那條）、`.progress`、購地告示。地磚 `.plot::before` 不加（地面要跟著轉）。
  - 陰影 `fieldshadow{left:370px;top:765px;width:560px}`。
  - 排列維持 **3×6**（曾做 6×3+中心解鎖版，使用者看過比較後決定還原）。
- 工具列 `.tools{z-index:27}`（>zoomctrl 26，修「肥料/一鍵收成按不到」）；手機 `body.narrow .zoomctrl{right:calc(58px+safe);bottom:60px}`。
- 動畫錨點修正：`@keyframes bob` 用 `translate(-50%,…)` 保泡泡置中；`@keyframes hop` 帶 `scaleX(var(--fx,1))`；walkDog 改 `setProperty("--fx",±1)` 轉向。
- 手機彈窗：`body.narrow .modal{max-width:480px;max-height:92%}`。

## 5. 股市（本 session 大改）
- **首頁清單**（`#stockHome`，class `home` 切換）：仿券商 App 淺色卡片列表——色塊圖示（`SICON` 色碼表）＋中文名/代號＋走勢小圖＋價格/漲跌箭頭。點列進下單頁 `openStockTrade(t)`；「← 農場」離開；下單頁「← 返回」回首頁（`backStockHome()`）。
- **走勢小圖**：`SPARKS{}`（不入雲端存檔），fetchQuote 時從 1d/1m 收盤降採樣 ~40 點；**localStorage `hfSparkCache` 快取**→開股市立即顯示；開股市時 `pollAllQuotes(true)` 快速輪詢（0.35s/檔）。
- **財經新聞板**（首頁右側 `.shNews`，400px/手機 280px）：`NEWS_FEEDS`＝自由財經 RSS→ETtoday 備援；`yFetchText`（corsproxy 優先，allorigins 對 RSS 慢）；10 分鐘快取；點標題開新分頁。**Yahoo TW RSS 已死，別用。**
- **圖表**：TradingView iframe 已移除，改 **Lightweight Charts v5**（unpkg standalone）。`ensureChart/loadChart/setChartRange`；週期 24小時(1d/5m,含盤前後)/2日/3日(取5d切片)/5日(5d/15m)；漲綠跌紅 area；**3-line legend**（名稱/價格/時間，跟十字線）；`CHART_TZOFF` 時區平移。
- **下單頁排版**：`stkTop`、`btabs`、`bbody`、`#lwLegend` 全部用 `calc(14px + env(safe-area-inset-left))` 對齊同一條 X 軸（瀏海/動態島安全區）；`.stkChart` padding-left 安全區＋`#stkRanges`/`#lwChart` border-left `#2b3139`；`.stkBottom` 高 200px（手機 132px）；表格 width:100% 撐滿；表頭「標記價格」已改「**現價**」；股市中隱藏 `#simBtn`（openStocks 藏/exitStock 還原）。

## 6. 多裝置存檔防互蓋（本 session 新增）
- 機制：每次雲端存檔寫入 `G.dev=DEV_ID`（隨機 per 分頁）。`attachDevWatch(uid)` 監聽 `users/{uid}/dev`：見到別台裝置的值（且 `devSeenMine` 已為 true）→ `cloudPaused=true`＋顯示 `#devMask` 全螢幕「另一台裝置已接手」。
- `resumeHere()`：拉雲端最新→接手→saveGame 寫回（換對方暫停）＋loadFriends()。
- `saveUserCloud` 在 `cloudPaused` 時不寫；`cloudSaveNow`（手動存）會強制接手；`cloudLoadNow` 會解除暫停。
- **已實測運作**（截圖看到 overlay 正常觸發）。
- 首次載入仍走 progScore 比較（高者勝）。
- 可再做的折衷：暫停端改「即時旁觀」（唯讀跟播對方進度）——已向使用者提案，未做。

## 7. 好友（本 session 修正）
- **資料庫規則已確認發布**（使用者貼過全文）：`friends/$uid` read 限本人、`$fid` write 雙方皆可。規則不用再動。
- 修正：`openFriends()` 開面板即 `loadFriends()` 重新同步（15s 節流 `palSyncTs`）；`removePal` 同步刪 `friends/{me}/{uid}`；addPal 寫入失敗會 log 原因；`resumeHere` 也重載好友。

## 8. 本輪部署紀錄（皆 main）
建築/田地移位 → 股市首頁+圖表+面板縮小 → 安全區+新聞板+小圖快取 → 新聞板加寬 → 多裝置防互蓋 → 好友修正 → 工具列 z-index/縮放鈕移位 → 動物錨點+彈窗限寬 → 田地轉10度+作物直立 → 現價+面板200px → simBtn隱藏 → 表格對齊/撐滿 → legend對齊 → 圖表左邊框。最新 commit：`ecd32e0`。

## 9. 待辦 / 已知
- 手機登入 `signInWithRedirect` fallback 未做（可提議）。
- 暫停裝置「即時旁觀」模式（提案中）。
- 新聞來源若 corsproxy 掛掉只剩 allorigins（慢）；必要時再找第三代理。
- deployments API 偶爾不長新紀錄但內容已上線；以線上 CSS 驗證為準。
- PWA 換圖示/全螢幕需使用者刪舊捷徑重加。

## 10. 使用者偏好 / 規矩
- 繁體中文；回覆精簡、少廢話；很在意 token（批次改、少截圖、少來回）。
- 流程：改本地 → 使用者本地/手機測 → 說「部署」才上（小修有時直接部署）。
- 每次改完同步「本地 0705 ＋ GitHub main」。
- 不要重製有版權的開心農場美術。
- 使用者帳號正在多裝置實測中——**用瀏覽器驗線上頁時，絕不要按 devMask 的「載入最新進度」按鈕**（會搶走使用者進度）。
