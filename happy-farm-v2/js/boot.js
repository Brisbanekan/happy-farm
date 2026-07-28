/* ============================================================
   happy-farm v2 — 啟動
   ------------------------------------------------------------
   啟動順序刻意固定：尺度 → 狀態 → 世界 → 輸入 → UI → 時間循環。
   前面兩層（尺度、狀態）決定後面一切，所以先跑。
   ============================================================ */
"use strict";

(function boot(){
  // 1) UI 尺度：在任何 DOM 量測之前先定好 --u
  syncUIScale();

  // 2) 狀態：讀存檔 → 補欄位 → 離線續算（沿用舊系統的實作）
  if (typeof loadGame === "function") loadGame();
  if (typeof normalizeState === "function") normalizeState();
  if (!G.plots || !G.plots.length){
    G.plots = [];
    for (let i = 0; i < 18; i++) G.plots.push(newPlot(i < 6));
  }
  G.scene = "farm";

  // 3) 世界：canvas + camera
  const cv = document.getElementById("world");
  World.init(cv);

  // 遠景幕布：放了圖就用圖，沒放就用 drawBackdrop() 的程式版本，不會壞
  World.load("bg", "assets/bg_far.png");

  // 素材：建築與動物沿用既有圖檔（世界層改成 canvas 後仍是同一批 PNG）
  PROPS.forEach(p => World.load(p.key, p.img));
  if (typeof ANIMAL_IMG !== "undefined"){
    Object.keys(ANIMAL_IMG).forEach(k => World.load("an_" + k, "../" + ANIMAL_IMG[k].b));
  }

  // 4) 輸入：只綁在 canvas 上，UI 的點擊不經過這裡
  Input.init(cv);

  // 5) UI
  render();

  // 6) 時間循環（沿用舊系統的 tick，內含成長/蟲害/偷菜/工廠/股價）
  if (typeof tick === "function") setInterval(tick, 1000);

  // 開場把鏡頭對準島中央，讓遠景幕布在四周露出來
  Camera.centerOn(ISLAND.cx - 0.5, ISLAND.cy);
  Camera.zoom = 0.78; Camera.clamp();
})();

/* 「更多」面板：把不常用的入口收進來，維持一級按鈕不超過 6 個 */
function openMore(){
  showM('<h2>更多<button class="x" onclick="closeM()">×</button></h2>'
    + '<div class="mbody">'
    + '<div class="row"><div class="ic">🎁</div><div class="meta"><b>每日獎勵</b><small>連續登入有加碼</small></div>'
    +   '<button class="pill" onclick="closeM();openDaily()">打開</button></div>'
    + '<div class="row"><div class="ic">🎰</div><div class="meta"><b>農青哥拉霸</b><small>用金幣試手氣</small></div>'
    +   '<button class="pill" onclick="closeM();openSlot()">打開</button></div>'
    + '<div class="row"><div class="ic">📈</div><div class="meta"><b>股市</b><small>真實報價的模擬交易</small></div>'
    +   '<button class="pill" onclick="closeM();openStocks()">打開</button></div>'
    + '<div class="row"><div class="ic">🏭</div><div class="meta"><b>工廠</b><small>農產加工，提高利潤</small></div>'
    +   '<button class="pill" onclick="closeM();openFactory()">打開</button></div>'
    + '<div class="row"><div class="ic">🏡</div><div class="meta"><b>角色與成就</b><small>看門狗也在這裡</small></div>'
    +   '<button class="pill" onclick="closeM();openProfile()">打開</button></div>'
    + '<div class="row"><div class="ic">🐮</div><div class="meta"><b>前往牧場</b><small>鏡頭移到牧場區</small></div>'
    +   '<button class="pill" onclick="closeM();setScene(\'ranch\')">前往</button></div>'
    + '<div class="row"><div class="ic">📜</div><div class="meta"><b>農場紀錄</b><small>最近發生的事</small></div>'
    +   '<button class="pill" onclick="closeM();toggleLog()">打開</button></div>'
    + '<div class="row"><div class="ic">☁️</div><div class="meta"><b>雲端同步</b><small>跨裝置接續進度</small></div>'
    +   '<button class="pill" onclick="closeM();openCloud()">打開</button></div>'
    + '</div>');
}
window.openMore = openMore;
