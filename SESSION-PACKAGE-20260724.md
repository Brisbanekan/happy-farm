# SESSION PACKAGE — 開心農場 Happy Farm（交接補充 2026-07-24）

> 承接 **0716（架構/股市/工廠/Firebase/iOS）**、**0720（功能鈕定位）**、**0722（動物/好友/描圖起點）**。本檔記 0722 之後的變更。繁中、精簡、批次改、少截圖。

---

## 0. 最新狀態
- **最新 commit：`55851b6`**（GPT 接手後）。檔案約 235KB。唯一正式檔 `C:\Users\ccltcd\Desktop\0705\happy-farm.html`（host 端 Read/Edit/Grep）。`happy-farm-main\` 是舊副本勿用。
- 素材：`building/storage.png`、`doghouse.png`、`factory.png`（GPT 換過工廠美術）。
- ⚠️ **同步警告（2026-07-24）**：GPT 於 git 上直接改了 5 個 commit（見 §GPT），**本地 `happy-farm.html` 未同步、落後於 git**。git 為最新來源。**下次動手前務必先把 git 最新 html 拉回本地覆蓋**（否則會蓋掉 GPT 的改動）；由於安全過濾擋下線上原始碼內容，Claude 無法自行逐位元組還原大檔，請由使用者把最新 html 存回 `0705\`（或提供解壓檔用 bash cp）。

## GPT 接手變更（2026-07-23，git commit）
> 這幾個由 GPT 直接在 git 上修改，本地檔尚未同步。細節以 git 上的程式為準。
- `8e53b82` 換工廠美術為「農場風格工作坊」（新 `factory.png`）。
- `4265e18` 工廠美術水平翻轉（`.bld.factory img` 加 `scaleX(-1)`）。描圖 clip/翻轉偵測會自動吃到（`applyBldClip` 讀 computed transform）。
- `db1ecc3` 修正工廠面板捲動位置重置（openFactory scroll reset）。
- `acb49b5` 改善手機介面與**牧場初始視角**（可能動到 `centerField`/牧場焦點 FFX/FFY 或 ranch 分支）。
- `55851b6` 修正**實機工具列**與**網頁初始置中**（可能動到 `.tools` 定位、`centerField`/`clampPan` 桌機分支）。
- ⚠️ 這些可能與本檔 §H（Android `visualViewport`）、§F（選單鈕封頂）、HUD 壓縮等有交互作用；接手時先讀 git 現況再改，別用本地舊檔直接覆蓋。

## 1. 本段變更（依主題）

### A. 描圖 clip-path（把建築裁成輪廓）＝重要
- 之前描圖是「每次事件用 alpha 逐像素判斷」；本段升級成 **`clip-path` 把 `.bld[data-act]` 元素直接裁成圖形輪廓**，透明角落在瀏覽器層級就不屬於建築＝純背景（hover/拖曳/點擊都不再被矩形攔截）。
- `silhouettePolygon(img,flip)`：把圖縮到 80px、**逐列取左右緣**組成多邊形（排除等角圖的對角透明區）；`applyBldClip(el)`：載入後套 `el.style.clipPath`，會依 `getComputedStyle` 偵測翻轉（`DOMMatrix.a<0`）鏡像多邊形。`initBldHit()` 內對每個 `.bld[data-act]` 呼叫。跨網域污染(本機 file://)會回退不裁。
- 仍保留 `imgOpaqueAt`（clip 後大多冗餘但無害）；平移 `panDown` 內仍用 alpha 判斷「壓在建築實體才不平移」。

### B. 建築素材/位置
- 倉庫 `.bld.storage{left:49px;top:247px;width:305px}` img `scaleX(-1)`（**使用者要翻轉，招牌會鏡像是預期**）。工廠 `.bld.factory{left:38px;top:527px;width:398px;rotate(1deg)}`。田地 `.field{left:975px;top:722px;...}`、田影 `.fieldshadow{left:975px;top:807px}`。
- 建築 `cursor` 由 JS 依描圖動態設（`.bld` CSS 已移除靜態 cursor:pointer）。

### C. 功能鈕（🎯）大改：從可拖曳 FAB → 固定在 dock
- **不再可拖曳**。HTML 移進底部 `.dock` 第二組、接在倉庫右邊（flexbox 自動對齊、跨裝置一致）。選單（每日/拉霸/股市）**水平往右展開**（`.dock .lbitems{flex-direction:row}`，open 才顯示）。按下動畫已還原。
- `initFabDrag`/`clampFab` 已改成 **no-op**；`toggleLeftbar` 簡化成只切 `open`；`layout()` 內舊的 leftbar 重置已移除。`updateFabDir/applyFabAnchor/snapFabY/fabEnv` 仍定義但未用。
- ⚠️ 間距坑：`body.sim .leftbar{left:46px}`（舊假瀏海偏移）特異度較高會把 dock 內功能鈕右推 46px → 已加 `body.sim .dock .leftbar{left:auto}` 覆寫，間距回 7px。
- ⚠️ **曾漏一個 `</div>` 導致 dock 沒關閉、把拉霸/股市場景吞進 dock → 兩場景定位崩塌顯示不出**（`1ed1afc` 修好）。改 dock HTML 後務必檢查 div 平衡（`node` 數 `<div`/`</div>`）。

### D. 拉霸盤面 SIM 尺寸
- 原本用 CSS `vw/vh/vmin/@media(max-height)`，**手機預覽會誤用桌機視窗尺寸而爆版**。改成 `slLayout()` 用 `VW()/VH()`(SIM-aware) 算盤面寬、用 `--slcw` 帶動 `.slCell` 字級、用 `.sl-compact` class 取代 `@media(max-height:520px)`。`slLayout()` 在 `openSlot`/`layout()` 呼叫。

### E. HUD / 名稱 / 工具
- **農場名可自訂**：`G.farmName`（存檔）+ `farmLabel()`（有自訂用自訂、否則登入名）+ 尾綴固定「的農場」。改名入口在角色資料→總覽「✏️改名」(`renameFarm` prompt，上限16字)。左上顯示由 `renderHUD` 更新 `#farmName`。頭像已移除、收折鈕在農場名稱上（`toggleHud`）。
- **窄版 HUD 壓縮**：金幣/經驗/等級圈縮小＋預覽左移（`body.narrow .coin/.xpbar/.lvbadge`、`body.sim .hud{left:34px}`）——修「狀態列擋到農場/牧場切換鍵」（預覽 sceneswitch 置中、真機切換鍵位置不同）。
- **工具鈕再按取消**：`renderTools` 的 onclick，若 `G.tool===t.k` 則 `G.tool=""`（空狀態，點田地無動作，tapField 各分支不匹配＝安全）。

### F. 選單鈕（⚙️ topmenu）定位
- right/top 改「封頂」`min(calc(Npx+inset),cap)`，避免瀏海 `inset` 把它推離右上角（右側工具列本來就封頂在 6px）。目前 `top:...,70px / right:...,8px`（使用者真機微調到 70px）。

### G. 全服自動好友（0722 已上，沿用）
- 登入讀 `profiles/` 名冊自動互加真實好友（`loadAllPlayers`）。規則 `profiles/.read:"auth!=null"` 使用者現有規則已具備。

### H. ⭐ Android 畫面超出修正（本段最後）
- 根因：Android 的 `innerWidth/Height`（含系統列）> 實際可見 `visualViewport`，場景用 inner 尺寸 → 右側工具/選單、底部被推出可見範圍。iOS 相反（inner/vv 回報舊小值、要用 screen）。
- 修法：新增 `IS_IOS`（UA 判斷，含 iPad 偽裝 Mac）。**非 iOS（Android/桌機）`VW()/VH()` 改用 `visualViewport` 尺寸**；iOS 維持原本 `max(inner,vv)`＋screen 底線。桌機無回歸（vv≈inner）。

## 2. 部署流程（沿用，重點提醒）
- Edit→`node` 語法檢查（每個 inline `<script>` 過 `new Function`）→ `upload/main` file_upload→JS 點 `Commit changes`（**點完等 ~3 秒**再導頁，別立刻讀 location）→線上 `?_=時間戳` fetch 驗關鍵字。
- ⚠️ GitHub upload 舊分頁常卡 `document_idle`：**開新分頁**重進 upload 頁。多個 Chrome 連線要先 `select_browser`。
- 驗證用 `commits?per_page=1`（別用 `commits/main`，回舊快取）。Pages CDN ~5–10 分，剛部署 pages 可能 false，等一下。github.com CSP 擋跨站 fetch→先 navigate 到 github.io 再驗。
- 改 HTML 結構務必檢查 div 平衡；改 SIM/尺寸相關務必在預覽實測 `VW()/VH()` 與元素 rect。

## 3. 待辦 / 可提議
- 各組按鈕「共用一條基準線」對齊（使用者提過想討論，未做）。
- 動物腳底錨點後靠上緣可能凸出圍籬 → 可收 `RANCH_Y0`。
- 全服好友玩家數變多時 `loadAllPlayers` 會全加為好友，未來可加上限。
- 選單鈕/HUD 這些真機微調值（70px 等）依實機再確認。
- 其餘沿用前面文件：手機 `signInWithRedirect` fallback、拆 `?debug=1`、數值平衡。
