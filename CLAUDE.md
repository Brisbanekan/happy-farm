# 開心農場 Happy Farm — 工作規則

## 工作流程（重要）

使用者為了節省 token，採用「本機優先」流程：

1. **改檔案 → 本機 commit**（純本機，不推送）
2. 使用者自己測試
3. 使用者說「傳上去」→ 才 `git push`
4. 使用者說「改壞了」→ `git reset` 退回上一版

**預設絕不主動 push。** 一定要等使用者明確說要上傳。

改完後簡短回報改了什麼、commit 訊息是什麼即可，不要長篇解釋。

## 專案資訊

- GitHub：`https://github.com/Brisbanekan/happy-farm`（注意大寫 B）
- 線上版：https://brisbanekan.github.io/happy-farm/happy-farm.html
- 本機工作目錄：`C:\Users\ccltcd\Desktop\0705`（**唯一**的 git 工作目錄）
- 分支：`main`，追蹤 `origin/main`

### 認證

PAT 存在 `.git/.git-credentials`（權限 600，不會被上傳）。
換 token 時：使用者把新 token 存成 `token.txt`，用指令直接讀進設定、**不要印出內容**，用完刪除。`token.txt` 已在 `.gitignore` 中。

### 目錄結構

| 路徑 | 說明 |
|---|---|
| `happy-farm.html` | **主要遊戲本體**，單一檔案，約 3600 行 / 250KB |
| `happy-farm-iso/` | 等角視野新版本（canvas world layer），2026-08 開發中 |
| `happy-farm-v2/` | 模組化重構版本（js/ css/ 拆檔） |
| `farmstead/` | 另一個實驗版本，含 Python 素材產生腳本 |
| `animal/` `building/` `background/` `fence/` | 共用素材圖 |
| `manifest.json` `sw.js` `icon-*.png` | PWA 設定 |
| `SESSION-PACKAGE-*.md` | 歷次開發紀錄 |
| `_local-backup/` | 本機舊素材備份，已 gitignore |

### 注意事項

- `core.autocrlf=false`（避免 Windows 換行讓整份 html 變成假差異）
- 這個資料夾在 Cowork 沙盒中對應 `/sessions/<session>/mnt/0705`
- 遊戲是繁體中文介面，橫向手機為最佳體驗，程式碼註解也用中文
