/* ============================================================
   happy-farm v2 — UI 層（DOM）
   ------------------------------------------------------------
   只讀狀態、只發 action，完全不知道 camera 的存在。
   ============================================================ */
"use strict";

const el = id => document.getElementById(id);

/* ---------------- 彈窗 ---------------- */
/* 彈窗外殼沿用 happy-farm.html 的 showM / closeM，玩法面板不必改任何一行 */
function showModal(html){ showM(html); }
function closeModal(){ closeM(); }

/* ---------------- 渲染（UI 專用；世界層自己每幀重畫） ---------------- */
function render(){ renderHUD(); renderTools(); renderSeedbar(); }

function renderHUD(){
  el("lvBadge").textContent = G.level;
  const need = XP_NEED(G.level);
  el("xpFill").style.width = Math.min(100, G.xp / need * 100) + "%";
  el("xpText").textContent = G.xp + "/" + need;
  el("goldChip").textContent = "$ " + (G.gold | 0).toLocaleString();
  el("creditChip").textContent = "💎 " + (G.credit | 0);
  el("charmChip").textContent = "❤️ " + (G.charm | 0);
  el("farmName").textContent = G.farmName || "我的農場";
}

const TOOLS = [
  { k:"hand",  ico:"✋", name:"手" },
  { k:"plant", ico:"🌱", name:"播種" },
  { k:"care",  ico:"🚿", name:"照顧" },
  { k:"fert",  ico:"💩", name:"肥料" },
];
function renderTools(){
  const box = el("tools");
  box.innerHTML = TOOLS.map(t =>
    '<div class="btn mini ' + (G.tool === t.k ? "on" : "") + '" data-tool="' + t.k + '">' + t.ico + '</div>'
  ).join("") + '<div class="btn mini" id="btnHarvestAll" title="一鍵收成">🧺</div>';
  box.querySelectorAll("[data-tool]").forEach(b => {
    b.onclick = () => setTool(b.dataset.tool);
  });
  el("btnHarvestAll").onclick = () => harvestAll();
}

function setTool(k){
  G.tool = k;
  el("seedbar").classList.toggle("on", k === "plant");
  render();
  save();
}

function renderSeedbar(){
  const bar = el("seedbar");
  if (G.tool !== "plant"){ bar.classList.remove("on"); return; }
  bar.classList.add("on");
  const owned = Object.keys(G.seeds).filter(k => G.seeds[k] > 0);
  if (!owned.length){
    bar.innerHTML = '<div class="hint" style="padding:calc(var(--u)*8)">沒有種子了，到商店買一些</div>';
    return;
  }
  if (!G.seedPick || !G.seeds[G.seedPick]) G.seedPick = owned[0];
  bar.innerHTML = owned.map(k => {
    const c = CROPS[k], lock = G.level < c.lvl;
    return '<div class="seed ' + (G.seedPick === k ? "on" : "") + (lock ? " lock" : "") + '" data-seed="' + k + '">'
         + c.emoji + '<b>' + c.name + '</b><span class="n">' + G.seeds[k] + '</span></div>';
  }).join("")
  + '<div class="seed" id="seedAll"><b style="font-size:calc(var(--u)*11)">全種</b></div>';
  bar.querySelectorAll("[data-seed]").forEach(b => {
    b.onclick = () => { G.seedPick = b.dataset.seed; renderSeedbar(); };
  });
  el("seedAll").onclick = () => plantAll();
}

/* ---------------- 種子選擇（點空地時） ---------------- */
function openSeedPicker(plotIndex){
  const owned = Object.keys(G.seeds).filter(k => G.seeds[k] > 0);
  if (!owned.length){ toast("沒有種子，先去商店買"); return openShop(); }
  showModal('<h2>要種什麼？<button class="x" onclick="closeModal()">×</button></h2>'
    + '<div class="mbody">' + owned.map(k => {
      const c = CROPS[k], lock = G.level < c.lvl;
      return '<div class="row"><div class="ic">' + c.emoji + '</div>'
        + '<div class="meta"><b>' + c.name + ' ×' + G.seeds[k] + '</b>'
        + '<small>成長 ' + c.grow + ' 秒｜收成賣 $' + c.sell + '｜經驗 ' + c.xp
        + (lock ? '　需 Lv.' + c.lvl : '') + '</small></div>'
        + '<button class="pill" ' + (lock ? "disabled" : "") + ' onclick="plantPlot(' + plotIndex + ',\'' + k + '\');closeModal()">種下</button></div>';
    }).join("") + '</div>');
}

/* ---------------- 縮放鈕：只動 camera ---------------- */
function zoomBy(f){
  Camera.zoomAt(World.view.w / 2, World.view.h / 2, f, World.view);
}

window.showModal = showModal; window.closeModal = closeModal;
window.render = render; window.renderHUD = renderHUD; window.renderTools = renderTools;
window.setTool = setTool; window.openSeedPicker = openSeedPicker;
window.zoomBy = zoomBy; window.el = el;
