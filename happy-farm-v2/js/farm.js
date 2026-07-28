/* ============================================================
   happy-farm v2 — 農場核心循環
   ------------------------------------------------------------
   v1 這一段和渲染綁在一起（renderGrid 一邊算狀態一邊拼 innerHTML，
   點擊還要靠 clip-path / 逐像素描圖判定）。
   v2 這裡只管「狀態怎麼變」，畫面交給 World 每幀重畫，
   點到哪一格由 World.pick() 用反矩陣算出來。

   存檔、時間循環、經驗、買地等沿用 happy-farm.html 的實作
   （saveGame / loadGame / tick / gainXp / buyLand），此處不重複定義。
   ============================================================ */
"use strict";

/* ---------------- 田地互動 ----------------
   點擊行為依狀態自動判定，減少切換工具的次數。 */
function tapPlot(i){
  if (typeof VISIT !== "undefined" && VISIT.on){ visitTap(i); return; }
  const p = G.plots[i];
  if (!p) return;

  if (!p.unlocked){ buyLand(i); return; }

  const t = G.tool;

  // 田有狀況時優先處理，不必特地切到照顧工具
  if (p.dry || p.weed || p.bug){
    if (t === "care" || t === "hand"){ carePlot(i); return; }
  }
  if (p.state === "planted" && p.ripe){ harvestPlot(i); return; }
  if (p.state === "planted"){
    if (t === "fert"){ openFertPick(i); return; }
    toast("還沒成熟，再等等");
    return;
  }
  // 空地
  const pick = window.__plantSel || G.seedPick;
  if (t === "plant" && pick && (G.seeds[pick] || 0) > 0) plantPlot(i, pick);
  else openSeedPicker(i);
}

function plantPlot(i, kind){
  const p = G.plots[i], c = CROPS[kind];
  if (!p || !c) return;
  if ((G.seeds[kind] || 0) <= 0) return toast("沒有" + c.name + "種子了");
  if (G.level < c.lvl) return toast("需要 Lv." + c.lvl);
  Store.tx("plant", () => {
    G.seeds[kind]--; if (G.seeds[kind] <= 0) delete G.seeds[kind];
    p.state = "planted"; p.crop = kind; p.grow = 0; p.ripe = false; p.stolen = 0;
    const g = plotGrid(i); World.pop(g.col, g.row, "🌱");
  });
}

function harvestPlot(i){
  const p = G.plots[i];
  if (!p || p.state !== "planted" || !p.ripe) return false;
  const c = CROPS[p.crop];
  Store.tx("harvest", () => {
    G.harvest[p.crop] = (G.harvest[p.crop] || 0) + 1;
    if (c.charm) G.charm += c.charm;
    gainXp(c.xp);
    const g = plotGrid(i); World.pop(g.col, g.row, "＋1");
    Object.assign(p, newPlot(true));
  });
  return true;
}

function carePlot(i){
  const p = G.plots[i];
  if (!p || !(p.dry || p.weed || p.bug)) return;
  if (p.bugBig && p.bug > 1){
    Store.tx("spray", () => { p.bug--; });
    toast("噴了一次，還要 " + p.bug + " 次");
    return;
  }
  Store.tx("care", () => {
    p.dry = false; p.weed = false; p.bug = 0; p.bugBig = false;
    gainXp(2);
    const g = plotGrid(i); World.pop(g.col, g.row, "✨");
  });
}

/** 批次操作：一次收一片田比逐格點更有收穫感 */
function harvestAll(){
  let n = 0;
  G.plots.forEach((p, i) => { if (p.state === "planted" && p.ripe && harvestPlot(i)) n++; });
  toast(n ? ("收成了 " + n + " 塊田") : "目前沒有成熟的作物");
}

function plantAll(){
  const kind = window.__plantSel || G.seedPick;
  if (!kind) return toast("先選一種種子");
  let n = 0;
  G.plots.forEach((p, i) => {
    if (p.unlocked && p.state !== "planted" && (G.seeds[kind] || 0) > 0){ plantPlot(i, kind); n++; }
  });
  toast(n ? ("播種了 " + n + " 塊田") : "沒有空地或種子不足");
}

/* ---------------- 動物 ----------------
   v1 的動物是另一個 DOM 世界（#penGround 內用 % 定位、z-index 手動維護）。
   v2 的動物和田地共用同一套等角座標，深度排序自動正確。 */
function tapAnimal(i){
  const a = G.ranch[i], d = a && ANIMALS[a.a];
  if (!d) return;
  if (!a.ready) return toast(d.name + "還在生產中");
  Store.tx("collect", () => {
    a.ready = false; a.prod = 0;
    G.gold += d.yield;
    gainXp(d.xp);
  });
  toast("收成 " + d.name + " 的產物 ＋" + d.yield);
}

/* ---------------- 場景 ----------------
   v1 的「農場 / 牧場」是兩個各自定位的 DOM 世界。
   v2 兩者在同一張格線上，切換場景＝移動 camera。 */
function setScene(name){
  G.scene = name;
  if (name === "ranch") Camera.centerOn(FIELD_COLS + 1.6, 1.4);
  else Camera.centerOn(FIELD_COLS/2 - 0.5, FIELD_ROWS/2 - 0.5);
}

window.tapPlot = tapPlot; window.plantPlot = plantPlot; window.harvestPlot = harvestPlot;
window.carePlot = carePlot; window.harvestAll = harvestAll; window.plantAll = plantAll;
window.tapAnimal = tapAnimal; window.setScene = setScene;
