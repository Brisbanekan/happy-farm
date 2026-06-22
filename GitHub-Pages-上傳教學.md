# 把開心農場放到 GitHub Pages（逐步教學）

整個過程免費、不用信用卡，大約 5～10 分鐘。你只要上傳一個檔案，就會得到一個可以用手機/電腦打開的網址。

> 小提醒：如果你要用「跨裝置雲端同步」，請**先**依《雲端同步設定教學》把 Firebase 網址填進 `happy-farm.html` 最上方的 `CLOUD_DB`，再做下面的上傳。不需要雲端同步的話，直接上傳即可。

---

## 步驟 1：註冊 / 登入 GitHub
1. 前往 👉 https://github.com
2. 沒有帳號就按 **Sign up** 註冊（用 email 即可）；有帳號就 **Sign in** 登入。

## 步驟 2：建立一個儲存庫（Repository）
1. 右上角按 **＋ → New repository**。
2. **Repository name** 填：`happy-farm`
3. 下面選 **Public**（公開，這樣才能用 Pages）。
4. 按綠色的 **Create repository**。

## 步驟 3：上傳遊戲檔案
1. 在新建好的頁面，點藍字 **uploading an existing file**
   （或上方 **Add file → Upload files**）。
2. 把 `happy-farm.html` 拖進去。
   - **建議**：先把檔名改成 **`index.html`**，這樣網址比較短、開起來就是首頁。
3. 下方按 **Commit changes**（綠色按鈕）。

## 步驟 4：開啟 GitHub Pages
1. 上方點 **Settings**（設定）。
2. 左側選單點 **Pages**。
3. 在 **Build and deployment → Source** 選 **Deploy from a branch**。
4. **Branch** 選 **main**，資料夾選 **/ (root)**，按 **Save**。

## 步驟 5：拿到你的網址 🎉
1. 等 1～2 分鐘（GitHub 在幫你部署）。
2. 重新整理 Pages 這個頁面，最上方會出現網址，像這樣：
   ```
   https://你的帳號.github.io/happy-farm/
   ```
   - 如果檔名是 `index.html`：直接用上面網址。
   - 如果檔名是 `happy-farm.html`：網址要再加檔名 →
     `https://你的帳號.github.io/happy-farm/happy-farm.html`
3. 點開就能玩了！把這個網址用手機打開也能玩。

---

## 之後要修改 / 更新遊戲怎麼辦？
1. 回到你的 repository 首頁。
2. 點開 `index.html`（或 `happy-farm.html`）→ 右上角鉛筆圖示 **Edit**，
   **或** 用 **Add file → Upload files** 上傳新版同名檔案覆蓋。
3. 按 **Commit changes**。
4. 等 1～2 分鐘，重新整理網頁即可看到更新（如果沒變，按 Ctrl/Cmd+Shift+R 強制重新整理）。

---

## 常見問題
- **打開是 404 找不到頁面？** 通常是還在部署，等 1～2 分鐘再重整；或確認檔名與網址相符。
- **網址結尾要不要加檔名？** 檔名是 `index.html` 就不用；其他檔名要加。
- **可以換成自己的網域嗎？** 可以，在 Pages 設定的 **Custom domain** 填入，再到網域商設定 CNAME。
- **進度會存在哪？** 沒設定雲端時存在各裝置的瀏覽器；要跨裝置同步請完成《雲端同步設定教學》。
- **要收費嗎？** GitHub Pages 對公開儲存庫是免費的。
