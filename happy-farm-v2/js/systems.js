/* ============================================================
   雲端讀寫 / 登入  — 由 happy-farm.html 原樣移植（第 1064–1403 行）
   ============================================================ */
/* ====== 雲端同步設定（跨裝置） ======
   在 Firebase 免費建立 Realtime Database 後，把網址貼進下面（保留引號）。
   例如： const CLOUD_DB = "https://happy-farm-xxxx-default-rtdb.firebaseio.com";
   留空字串 = 只用本機存檔（不跨裝置）。設定教學見一起提供的「雲端同步設定教學」檔。 */
const CLOUD_DB = "";
/* ==================================== */

/* ====== 帳號登入設定（Google 一鍵登入；登入即進度，跨裝置） ======
   到 Firebase 專案 → 專案設定 → 你的應用程式，把網頁設定貼到下面（保留引號）。
   範例：
   const FIREBASE_CONFIG = {
     apiKey:"AIza...", authDomain:"happy-farm-xxxx.firebaseapp.com",
     databaseURL:"https://happy-farm-xxxx-default-rtdb.firebaseio.com",
     projectId:"happy-farm-xxxx", appId:"1:123:web:abc"
   };
   留空 {} = 不啟用帳號登入，遊戲照舊（本機存檔）。 */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDUiN3c9pSiVu3Zj3r-qqNu6MyMyR9wjJo",
  authDomain: "happyfarm-9a755.firebaseapp.com",
  databaseURL: "https://happyfarm-9a755-default-rtdb.firebaseio.com",
  projectId: "happyfarm-9a755",
  storageBucket: "happyfarm-9a755.firebasestorage.app",
  messagingSenderId: "529999689085",
  appId: "1:529999689085:web:a58e014c5a8849bb2b4814"
};
/* ============================================================== */
let fbAuth=null, fbDB=null, fbUser=null, fbSaveTimer=null, cloudReady=false;
function accountMode(){return !!(FIREBASE_CONFIG&&FIREBASE_CONFIG.apiKey&&window.firebase);}
function showLogin(m){const el=document.getElementById("loginMask");if(el)el.classList.add("on");const mm=document.getElementById("loginMsg");if(mm)mm.textContent=m||"";}
function hideLogin(){const el=document.getElementById("loginMask");if(el)el.classList.remove("on");}
function googleLogin(){
  if(!fbAuth){showLogin("尚未設定 Firebase");return;}
  const p=new firebase.auth.GoogleAuthProvider();
  fbAuth.signInWithPopup(p).catch(function(e){ showLogin("登入失敗："+(e&&e.message||e)); });
}
function logoutAccount(){ if(fbAuth)fbAuth.signOut(); }
function initAuth(){
  if(!accountMode())return false;
  try{ firebase.initializeApp(FIREBASE_CONFIG); }catch(e){}
  fbAuth=firebase.auth(); fbDB=firebase.database();
  fbAuth.onAuthStateChanged(function(user){
    fbUser=user||null;
    if(user){ hideLogin(); loadUserCloud(user.uid); }
    else { showLogin(); }
  });
  return true;
}
// 進度分數：用來比較兩份存檔誰「進度比較多」，多的勝出（避免空白存檔覆蓋有進度的）
function progScore(s){ if(!s)return -1; return (s.level||0)*1e7 + (s.totalDays||0)*1e4 + (s.credit||0)*1e3 + Math.min(s.gold||0,1e6) + (s.charm||0)*100; }
function loadUserCloud(uid){
  if(!fbDB)return;
  cloudReady=false;                       // 載入完成前先鎖住雲端寫入，避免覆蓋
  const localScore = progScore(G);         // 本機目前進度分數
  fbDB.ref("users/"+uid).once("value").then(function(snap){
    const d=snap.val();
    if(d&&Array.isArray(d.plots) && progScore(d) >= localScore){
      Object.assign(G,d); normalizeState(); log("☁️ 已載入你的帳號雲端進度。","g");
    } else if(d&&Array.isArray(d.plots)){
      normalizeState(); log("☁️ 本機進度較多，保留本機並上傳（避免被較舊雲端覆蓋）。","b");
    } else {
      normalizeState(); log("☁️ 首次以此帳號登入：沿用本機進度並上傳雲端綁定帳號。","g");
    }
    cloudReady=true;
    dailyCheck(); setScene(G.scene||"farm"); render(); saveUserCloud();
    ensureProfile(); loadFriends(); loadAllPlayers(); attachDevWatch(uid);
  }).catch(function(e){ log("⚠️ 雲端讀取失敗："+(e&&e.message||e)+"（多半是資料庫規則未發布）","r"); cloudReady=true; render(); });
}
/* ---- 多裝置防互蓋：最後寫入者＝作用中裝置，其他裝置暫停雲端存檔並提示接手 ---- */
const DEV_ID=Math.random().toString(36).slice(2,10)+Date.now().toString(36);
let cloudPaused=false, devWatchOn=false, devSeenMine=false;
function attachDevWatch(uid){
  if(devWatchOn||!fbDB)return; devWatchOn=true;
  fbDB.ref("users/"+uid+"/dev").on("value",function(snap){
    const v=snap.val();
    if(v===DEV_ID){devSeenMine=true;return;}          // 自己的寫入
    if(!v||!devSeenMine||cloudPaused)return;           // 首次載入時的舊值不算接手
    cloudPaused=true;                                  // 別台裝置寫入 → 這台暫停
    const m=document.getElementById("devMask"); if(m)m.style.display="flex";
    log("⏸️ 偵測到另一台裝置接手，此裝置已暫停雲端存檔。","b");
  });
}
function resumeHere(){
  const m=document.getElementById("devMask");
  if(!fbDB||!fbUser){if(m)m.style.display="none";cloudPaused=false;return;}
  fbDB.ref("users/"+fbUser.uid).once("value").then(function(snap){
    const d=snap.val();
    if(d&&Array.isArray(d.plots)){Object.assign(G,d);normalizeState();}
    cloudPaused=false; devSeenMine=false; if(m)m.style.display="none";
    setScene(G.scene||"farm"); render(); loadFriends(); loadAllPlayers();
    saveGame();                                        // 以本裝置身分寫回 → 其他裝置換成暫停
    toast("已載入最新進度，這台裝置繼續 ☁️");
  }).catch(function(e){alert("讀取失敗："+(e&&e.message||e));});
}
function saveUserCloud(){
  if(!fbDB||!fbUser||!cloudReady||cloudPaused)return;   // 尚未載入完成或已被別台接手時不寫入
  clearTimeout(fbSaveTimer);
  // 防抖 0.6 秒（必須小於遊戲心跳 1.5 秒，否則計時器會被一直重置而永遠不存）
  fbSaveTimer=setTimeout(function(){ try{ if(cloudPaused)return; G.ts=Date.now(); G.dev=DEV_ID; fbDB.ref("users/"+fbUser.uid).set(JSON.parse(JSON.stringify(G))).catch(function(e){ log("⚠️ 雲端存檔失敗："+(e&&e.message||e),"r"); }); }catch(e){} }, 600);
}
function cloudSaveNow(){
  if(!fbDB||!fbUser){toast("尚未登入");return;}
  clearTimeout(fbSaveTimer); G.ts=Date.now(); G.dev=DEV_ID; cloudPaused=false;
  fbDB.ref("users/"+fbUser.uid).set(JSON.parse(JSON.stringify(G)))
    .then(function(){ toast("已存到雲端 ☁️"); log("☁️ 已手動覆寫雲端存檔。","g"); })
    .catch(function(e){ alert("雲端存檔失敗："+(e&&e.message||e)); });
}
function cloudLoadNow(){
  if(!fbDB||!fbUser){toast("尚未登入");return;}
  if(!confirm("用雲端進度覆蓋這台裝置目前的進度？"))return;
  fbDB.ref("users/"+fbUser.uid).once("value").then(function(snap){
    const d=snap.val();
    if(d&&Array.isArray(d.plots)){ Object.assign(G,d); normalizeState(); cloudPaused=false; devSeenMine=false; const dm=document.getElementById("devMask"); if(dm)dm.style.display="none"; setScene(G.scene||"farm"); render(); toast("已從雲端讀取"); log("☁️ 已從雲端覆蓋本機進度。","b"); closeM(); }
    else toast("雲端目前沒有存檔");
  }).catch(function(e){ alert("讀取失敗："+(e&&e.message||e)); });
}

const SAVE_KEY="happyfarm_save_v1";
const CODE_KEY="happyfarm_code";
let syncCode = (()=>{try{return localStorage.getItem(CODE_KEY)||"";}catch(e){return "";}})();

function freshGame(){
  G.gold=200;G.credit=5;G.level=1;G.xp=0;G.charm=0;G.tool="hand";
  G.seeds={radish:3};G.harvest={};G.dog=null;G.ferts={f1:0,f2:0,bigspray:0};G.lastDaily="";G.ts=0;G.scene="farm";
  G.streak=0;G.totalDays=0;G.lastClaim="";G.lastMarketDate="";
  G.stocks={};STOCKS.forEach(s=>G.stocks[s.t]={price:s.base,prev:s.base,shares:0,avg:0});
  G.stockOrders=[];G.stockFav={};
  G.plots=LANDS.map((l,i)=>newPlot(i<6));
  G.ranch=[];G.pals={};G.myCode="";
  G.factory={lv:1,q:[]};G.goods={};G.buffs={};
  G.friends=FRIEND_NAMES.map(f=>({name:f[0],av:f[1],plots:Array.from({length:6},()=>makeFriendPlot())}));
}
function normalizeState(){
  if(!Array.isArray(G.plots))G.plots=LANDS.map((l,i)=>newPlot(i<6));
  while(G.plots.length<LANDS.length)G.plots.push(newPlot(false));
  if(G.plots.length>LANDS.length)G.plots.length=LANDS.length;
  if(!Array.isArray(G.friends)||!G.friends.length)
    G.friends=FRIEND_NAMES.map(f=>({name:f[0],av:f[1],plots:Array.from({length:6},()=>makeFriendPlot())}));
  // 雲端存檔會把空物件/null 欄位剝掉，這裡把電腦好友的田地補回完整格式（否則好友面板會炸掉打不開）
  G.friends=G.friends.map(function(f){return {name:(f&&f.name)||"農友",av:(f&&f.av)||"🧑‍🌾",
    plots:Array.from({length:6},function(_,k){var p=(f&&Array.isArray(f.plots))?f.plots[k]:null;return (p&&typeof p==="object")?p:{crop:null};})};});
  if(!G.ferts)G.ferts={f1:0,f2:0,bigspray:0};
  if(!G.seeds)G.seeds={};
  if(!G.harvest)G.harvest={};
  if(!G.ach||typeof G.ach!=="object")G.ach={};      // 成就解鎖紀錄
  if(!G.stat||typeof G.stat!=="object")G.stat={};   // 累積統計（收成、拉霸等）
  if(!Array.isArray(G.ranch))G.ranch=[];
  if(!G.pals||typeof G.pals!=="object"||Array.isArray(G.pals))G.pals={};
  if(typeof G.myCode!=="string")G.myCode="";
  G.ranch=G.ranch.filter(s=>s&&ANIMALS[s.a]); // 過濾舊版空欄位/無效動物
  if(G.scene!=="ranch")G.scene="farm";
  if(typeof G.streak!=="number")G.streak=0;
  if(typeof G.totalDays!=="number")G.totalDays=0;
  if(typeof G.lastClaim!=="string")G.lastClaim="";
  if(typeof G.lastMarketDate!=="string")G.lastMarketDate="";
  if(!G.stocks||typeof G.stocks!=="object")G.stocks={};
  STOCK_DELIST.forEach(k=>{const st=G.stocks[k]; if(!st)return;   // 下架結算：持倉按最後價格換回金幣
    const sh=st.shares||0;
    if(sh!==0){ const px=(typeof st.price==="number"?st.price:st.avg)||0, av=st.avg||px;
      const refund=sh>0?Math.round(px*sh):Math.round((2*av-px)*(-sh));
      G.gold+=Math.max(0,refund);
      log("📤 "+k+" 已下架，持倉以 "+fmtP(px)+" 結算返還 "+Math.max(0,refund)+" "+CO,"b"); }
    delete G.stocks[k];});
  STOCKS.forEach(s=>{let st=G.stocks[s.t]; if(!st||typeof st.price!=="number")st=G.stocks[s.t]={price:s.base,prev:s.base,shares:0,avg:0};
    if(typeof st.avg!=="number")st.avg=(st.shares&&st.cost)?st.cost/st.shares:0;
    if(typeof st.debt!=="number")st.debt=0;});   // 融資負債欄位
  if(!Array.isArray(G.stockOrders))G.stockOrders=[];
  G.stockOrders=G.stockOrders.filter(o=>STOCKS.some(s=>s.t===o.t));   // 移除下架標的掛單
  if(!G.stockFav||typeof G.stockFav!=="object")G.stockFav={};
  if(G.dog&&typeof G.dog.level!=="number")G.dog.level=1;
  if(!G.factory||typeof G.factory!=="object")G.factory={lv:1,q:[]};   // 工廠
  if(typeof G.factory.lv!=="number"||G.factory.lv<1)G.factory.lv=1;
  if(G.factory.lv>10)G.factory.lv=10;
  if(!Array.isArray(G.factory.q))G.factory.q=[];
  if(!G.goods||typeof G.goods!=="object")G.goods={};
  if(!G.buffs||typeof G.buffs!=="object")G.buffs={};
  applyOfflineGrowth();
}
// 離線生長：載入存檔後，用「現在時間 − 上次存檔時間(ts)」把作物補算成長（每 1.5 秒＝1 tick）
let _lastGrownTs=0;
function applyOfflineGrowth(){
  if(!G.ts||G.ts===_lastGrownTs)return;              // 無時間戳、或此存檔已補算過就略過
  const ticks=(Date.now()-G.ts)/1500;                // 換算成成長 tick 數
  _lastGrownTs=G.ts;                                 // 記住已處理（不改 G.ts，維持雲端同步的時間比較）
  if(!(ticks>0)||!Array.isArray(G.plots))return;
  let ripened=0;
  G.plots.forEach(function(p){
    if(p&&p.unlocked&&p.state==="planted"&&!p.ripe&&p.crop&&CROPS[p.crop]){
      let s=1;if(p.dry)s*=.4;if(p.weed)s*=.6;if(p.bug)s*=.6;
      p.grow=(p.grow||0)+ticks*s;
      if(p.grow>=CROPS[p.crop].grow){p.grow=CROPS[p.crop].grow;p.ripe=true;ripened++;}
    }
  });
  // 牧場動物離線產出：每 tick +1，達到 time 就完成
  let prodDone=0;
  if(Array.isArray(G.ranch))G.ranch.forEach(function(s){
    if(s&&!s.ready&&ANIMALS[s.a]){
      s.prod=(s.prod||0)+ticks;
      if(s.prod>=ANIMALS[s.a].time){s.prod=ANIMALS[s.a].time;s.ready=true;prodDone++;}
    }
  });
  if(ripened>0)log("🌱 離線期間有 "+ripened+" 塊作物長成熟了！","g");
  if(prodDone>0)log("🐾 離線期間有 "+prodDone+" 隻動物完成產出！","g");
}
// 拜訪好友時，把對方存檔（凍結在他上次存檔的 ts）的作物補算到「現在」的生長階段，讓拜訪看到即時狀況
function advancePlotsOffline(plots, ts){
  if(!Array.isArray(plots)||!ts)return plots;
  const ticks=(Date.now()-ts)/1500;
  if(!(ticks>0))return plots;
  plots.forEach(function(p){
    if(p&&p.unlocked&&p.state==="planted"&&!p.ripe&&p.crop&&CROPS[p.crop]){
      let s=1;if(p.dry)s*=.4;if(p.weed)s*=.6;if(p.bug)s*=.6;
      p.grow=(p.grow||0)+ticks*s;
      if(p.grow>=CROPS[p.crop].grow){p.grow=CROPS[p.crop].grow;p.ripe=true;}
    }
  });
  return plots;
}
function saveGame(){try{G.ts=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(G));}catch(e){} if(accountMode()&&fbUser){saveUserCloud();} else {cloudPush(false);} }
function loadGame(){
  try{
    const s=localStorage.getItem(SAVE_KEY);if(!s)return false;
    const d=JSON.parse(s);if(!d||!Array.isArray(d.plots))return false;
    Object.assign(G,d);normalizeState();
    return true;
  }catch(e){return false;}
}

/* ====== 雲端讀寫 ====== */
function cloudOn(){return !!CLOUD_DB;}
function cloudUrl(code){return CLOUD_DB.replace(/\/+$/,"")+"/farms/"+encodeURIComponent(code)+".json";}
function genCode(){let s="";const a="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";for(let i=0;i<6;i++)s+=a[Math.floor(Math.random()*a.length)];return s;}
let lastPush=0;
function cloudPush(force){
  if(!cloudOn()||!syncCode)return;
  const now=Date.now();
  if(!force && now-lastPush<12000)return;
  lastPush=now;
  try{fetch(cloudUrl(syncCode),{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(G)}).catch(()=>{});}catch(e){}
}
function cloudPull(code){
  return fetch(cloudUrl(code)).then(r=>r.ok?r.json():null).then(d=>{
    if(!d||!Array.isArray(d.plots))return false;
    Object.assign(G,d);normalizeState();
    syncCode=code;try{localStorage.setItem(CODE_KEY,code);}catch(e){}
    try{localStorage.setItem(SAVE_KEY,JSON.stringify(G));}catch(e){}
    return true;
  }).catch(()=>false);
}
function cloudCreate(){
  if(!cloudOn())return;
  syncCode=genCode();try{localStorage.setItem(CODE_KEY,syncCode);}catch(e){}
  cloudPush(true);
  log("☁️ 已建立雲端存檔，農場代碼："+syncCode,"b");
  openCloud();
}
function cloudJoin(){
  const inp=document.getElementById("joinCode");
  const code=(inp&&inp.value||"").trim().toUpperCase();
  if(!code){toast("請輸入代碼");return;}
  toast("讀取雲端中…");
  cloudPull(code).then(ok=>{
    if(ok){toast("已同步雲端進度！");render();openCloud();}
    else alert("找不到這組代碼的存檔，請確認代碼正確。");
  });
}
function resetGame(){
  if(confirm("確定要重新開始嗎？目前的農場進度將被清除，無法復原。")){
    try{localStorage.removeItem(SAVE_KEY);}catch(e){}
    location.reload();
  }
}
function exportSave(){
  saveGame();
  const data=localStorage.getItem(SAVE_KEY)||JSON.stringify(G);
  const blob=new Blob([data],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="happyfarm-save-"+new Date().toISOString().slice(0,10)+".json";
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast("已匯出存檔檔案 💾");
}
function importSave(input){
  const file=input.files&&input.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=()=>{try{
    const d=JSON.parse(r.result);
    if(!d||!Array.isArray(d.plots))throw 0;
    localStorage.setItem(SAVE_KEY,r.result);
    toast("匯入成功，重新載入中…");
    setTimeout(()=>location.reload(),400);
  }catch(e){alert("這個存檔檔案無效，無法匯入。");}};
  r.readAsText(file);
}
function todayStr(){return new Date().toISOString().slice(0,10);}
function yesterdayStr(){const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);}
/* 每日檢查：更新股市、提示可領的每日獎勵 */
function dailyCheck(){
  const today=todayStr();
  if(G.lastMarketDate!==today){ updateMarket(); G.lastMarketDate=today; }
  if(G.lastClaim!==today){ toast("🎁 每日登入獎勵可領取！"); log("🎁 今日登入獎勵可領取（點底部 🎁 每日）","b"); }
}
function rewardText(r){let a=[];if(r.g)a.push("<span class=coinico></span>"+r.g);if(r.c)a.push("💎"+r.c);if(r.h)a.push("❤️"+r.h);if(r.s)Object.entries(r.s).forEach(([k,n])=>a.push(CROPS[k].emoji+seedName(k)+"×"+n));return a.join(" ");}
function claimDaily(){
  const today=todayStr();
  if(G.lastClaim===today){toast("今天已經領過囉");return;}
  G.streak = (G.lastClaim===yesterdayStr()) ? (G.streak||0)+1 : 1; // 連續或重置
  G.totalDays=(G.totalDays||0)+1;
  G.lastClaim=today;
  const r=DAILY_REWARDS[(G.streak-1)%7];
  let parts=[];
  if(r.g){G.gold+=r.g;parts.push("<span class=coinico></span>"+r.g);}
  if(r.c){G.credit+=r.c;parts.push("💎"+r.c);}
  if(r.h){G.charm+=r.h;parts.push("❤️"+r.h);}
  if(r.s)Object.entries(r.s).forEach(([k,n])=>{G.seeds[k]=(G.seeds[k]||0)+n;parts.push(CROPS[k].emoji+seedName(k)+"×"+n);});
  if(G.totalDays%30===0){G.credit+=10;parts.push("｜累積"+G.totalDays+"天額外 💎10");} // 累積里程碑
  log("🎁 連續第 "+G.streak+" 天登入，領取："+parts.join(" "),"g");
  toast("領取成功 "+parts.join(" "));
  renderHUD();saveGame();openDaily();
}
function openDaily(){
  const today=todayStr(); const claimedToday=(G.lastClaim===today);
  const pos = G.streak>0 ? ((G.streak-1)%7)+1 : 0; // 本循環已領到第幾天
  let h='<h2>🎁 每日登入獎勵 <button class="x" onclick="closeM()">×</button></h2><div class="body">'+
    '<p class="hint">連續登入天數越多獎勵越好，第 7 天有大獎；中斷會從第 1 天重新算。累積登入每滿 30 天再送 💎10。<br>目前連續：<b>'+(G.streak||0)+'</b> 天 ｜ 累積：<b>'+(G.totalDays||0)+'</b> 天</p>'+
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px">';
  DAILY_REWARDS.forEach((r,i)=>{
    const big=(i===6); const done=claimedToday&&(i+1)<=pos;
    h+='<div style="border:2px solid '+(big?"#f0b429":"#e6dcc8")+';border-radius:12px;padding:7px 3px;text-align:center;background:'+(done?"#eef7e0":"#fff")+'">'+
      '<div style="font-size:11px;font-weight:800;color:#8a7350">第'+(i+1)+'天</div>'+
      '<div style="font-size:20px">'+(big?"🎁":"<span class=coinico></span>")+'</div>'+
      '<div style="font-size:10px;line-height:1.3">'+rewardText(r)+'</div>'+(done?'<div style="font-size:10px;color:#2e7d32">✅</div>':'')+'</div>';
  });
  h+='</div>';
  h+= claimedToday
    ? '<button class="bigbtn" style="margin-top:12px;opacity:.5" disabled>今日已領取，明天再來 ✅</button>'
    : '<button class="bigbtn" style="margin-top:12px" onclick="claimDaily()">領取今日獎勵 🎁</button>';
  h+='</div>';showM(h);
}


/* ============================================================
   拉霸機  — 由 happy-farm.html 原樣移植（第 1404–1548 行）
   ============================================================ */
/* ============ 拉霸機（3×3 多線，星城風格） ============ */
function slSymByKey(k){return SL_SYMS.find(x=>x.k===k);}
function slPick(){const tot=SL_SYMS.reduce((a,x)=>a+x.w,0);let r=Math.random()*tot;for(const x of SL_SYMS){if(r<x.w)return x;r-=x.w;}return SL_SYMS[0];}
let slotSpinning=false, slFS=0, slBetIdx=0;
function slBet(){return SL_BETS[slBetIdx];}
// 進入拉霸場景（入口按鈕沿用 openSlot 名稱）
function openSlot(){
  slFS=G.slotFS||0;
  const bi=SL_BETS.indexOf(G.slotBet||50); slBetIdx=bi>=0?bi:0;
  document.getElementById("scene").classList.add("s-slot");
  const sb=document.getElementById("simBtn"); if(sb)sb.style.display="none";
  slBuildGrid(); slLayout(); slRenderUI();
}
function slLayout(){   // 依 VW()/VH()(SIM-aware) 算盤面寬與壓縮模式，取代 CSS vw/vh/@media（預覽會誤用桌機視窗）
  const grid=document.getElementById("slGrid"); if(!grid)return;
  const vw=VW(), vh=VH();
  const gw=Math.round(Math.min(0.92*vw, 600, Math.max(220, 1.52*vh - 330)));
  grid.style.width=gw+"px";
  grid.style.setProperty("--slcw", ((gw-44)/5)+"px");   // padding10*2 + gap6*4 = 44
  const ss=document.getElementById("slotScene"); if(ss)ss.classList.toggle("sl-compact", vh<=520);
}
function exitSlot(){
  if(slotSpinning)return;
  document.getElementById("scene").classList.remove("s-slot");
  const sb=document.getElementById("simBtn"); if(sb)sb.style.display="";
  render();
}
function slBuildGrid(){
  let h="";for(let i=0;i<20;i++){const sym=slPick();h+='<div class="slCell" id="sl'+i+'"><span class="'+sym.cls+'">'+sym.s+'</span></div>';}
  document.getElementById("slGrid").innerHTML=h;
}
function slRenderUI(){
  const g=document.getElementById("slGold"); if(g)g.textContent=Math.floor(G.gold).toLocaleString();
  const bv=document.getElementById("slBetV"); if(bv)bv.textContent=slBet();
  const bn=document.getElementById("slFsBanner"), fn=document.getElementById("slFsN");
  if(bn)bn.classList.toggle("on",slFS>0); if(fn)fn.textContent=slFS;
  const btn=document.getElementById("slSpinBtn");
  if(btn){btn.classList.toggle("fs",slFS>0);btn.textContent=slotSpinning?"轉動中…":(slFS>0?("FREE SPIN ×"+slFS):"SPIN");btn.disabled=slotSpinning;}
  const lock=slotSpinning||slFS>0;
  const bd=document.getElementById("slBetDn"),bu=document.getElementById("slBetUp");
  if(bd)bd.disabled=lock||slBetIdx<=0; if(bu)bu.disabled=lock||slBetIdx>=SL_BETS.length-1;
}
function slBetAdj(d){
  if(slotSpinning||slFS>0)return;
  slBetIdx=Math.max(0,Math.min(SL_BETS.length-1,slBetIdx+d));
  G.slotBet=slBet(); saveGame(); slRenderUI();
}
function slSpin(){
  if(slotSpinning)return;
  const bet=slBet(); const isFS=slFS>0;
  if(!isFS){ if(G.gold<bet){toast("金幣不足");return;} G.gold-=bet; }
  else { slFS--; G.slotFS=slFS; }
  G.slotBet=bet; renderHUD(); slotSpinning=true;
  // 產生結果盤面
  const grid=Array.from({length:20},()=>({sym:slPick(),mult:0}));
  // 免費局：機率灑 2~4 個荷葉 WILD，部分帶 ×2/×3
  const drops=new Set();
  if(isFS&&Math.random()<SL_WILD_DROP){
    const n=2+Math.floor(Math.random()*3);
    const idxs=[...Array(20).keys()].sort(()=>Math.random()-.5).slice(0,n);
    idxs.forEach(i=>{
      if(grid[i].sym.k==="scat")return;
      const r=Math.random();
      grid[i]={sym:slSymByKey("wild"),mult:r<.75?0:(r<.95?2:3)};
      drops.add(i);
    });
  }
  const cells=[];for(let i=0;i<20;i++)cells.push(document.getElementById("sl"+i));
  cells.forEach(el=>{if(el){el.classList.remove("win","wildDrop");el.classList.add("spin");}});
  const res=document.getElementById("slRes");
  if(res){res.className="slRes";res.textContent="轉動中…";}
  slRenderUI();
  let ticks=0;
  const iv=setInterval(()=>{
    ticks++;
    for(let c=0;c<5;c++){
      const stop=8+c*4;   // 逐欄停輪
      for(let r2=0;r2<4;r2++){
        const i=r2*5+c, el=cells[i]; if(!el)continue;
        if(ticks<stop){ const s=slPick(); el.innerHTML='<span class="'+s.cls+'">'+s.s+'</span>'; }
        else if(ticks===stop){
          el.classList.remove("spin");
          el.innerHTML='<span class="'+grid[i].sym.cls+'">'+grid[i].sym.s+'</span>'+(grid[i].mult?'<b class="mult">×'+grid[i].mult+'</b>':'');
          if(drops.has(i))el.classList.add("wildDrop");
        }
      }
    }
    if(ticks>=8+4*4){clearInterval(iv);slSettle(grid,cells,bet,isFS);}
  },65);
}
function slSettle(grid,cells,bet,isFS){
  let win=0,lines=0;const winSet=new Set();
  SL_LINES.forEach(line=>{
    const cs=line.map((r,c)=>grid[r*5+c]);
    let key=null;
    for(const c of cs){ if(c.sym.k!=="wild"){key=c.sym.k;break;} }
    if(key===null||key==="scat")key="wild";   // 純荷葉線用 WILD 賠率
    const sym=slSymByKey(key);
    let cnt=0,mult=1;
    for(const c of cs){
      if(c.sym.k===key||c.sym.k==="wild"){cnt++;if(c.mult)mult*=c.mult;}
      else break;
    }
    const pay=sym.pay&&sym.pay[Math.min(cnt,5)];
    if(pay&&cnt>=3){ win+=bet*pay*mult; lines++; line.forEach((r,c)=>{if(c<cnt)winSet.add(r*5+c);}); }
  });
  win=Math.round(win);
  if(win>=bet*50)achStat("big50");
  // SCATTER：3+ 觸發 FREE GAME（免費局中不再觸發，避免無限連鎖）
  const sc=grid.filter(x=>x.sym.k==="scat").length;
  let fsMsg="";
  if(sc>=3&&!isFS){
    achStat("fs");
    slFS+=SL_FS_AWARD; G.slotFS=slFS;
    fsMsg="✨ 螢火蟲 ×"+sc+"!觸發 FREE GAME +"+SL_FS_AWARD+" 局!";
    grid.forEach((x,i)=>{if(x.sym.k==="scat")winSet.add(i);});
    log("拉霸觸發 FREE GAME +"+SL_FS_AWARD+" 局","b");
  }
  winSet.forEach(i=>{if(cells[i])cells[i].classList.add("win");});
  if(win){G.gold+=win;log("拉霸中獎 💰"+win.toLocaleString()+"("+lines+" 線)","g");}
  const res=document.getElementById("slRes");
  if(res){
    if(win&&fsMsg){res.className="slRes w";res.textContent="🎉 贏得 💰"+win.toLocaleString()+"("+lines+" 線) "+fsMsg;}
    else if(win){res.className="slRes w";res.textContent="🎉 贏得 💰"+win.toLocaleString()+"("+lines+" 線)!";}
    else if(fsMsg){res.className="slRes w";res.textContent=fsMsg;}
    else{res.className="slRes";res.textContent=isFS?"免費局沒中,再接再厲!":"沒中,再試一次!";}
  }
  if(win)toast("🎉 拉霸贏得 "+win.toLocaleString()+" 金幣!");
  slotSpinning=false;
  renderHUD();saveGame();slRenderUI();
}
// 賠率說明
function openSlotPay(){
  let rows=SL_SYMS.filter(x=>x.pay).map(x=>
    '<tr><td><span class="'+x.cls+'">'+x.s+'</span></td><td style="text-align:left">'+x.name+'</td>'+
    '<td>'+(x.pay[5]||"—")+'</td><td>'+(x.pay[4]||"—")+'</td><td>'+(x.pay[3]||"—")+'</td></tr>').join("");
  let h='<h2>🐸 農青哥-賠率說明 <button class="x" onclick="closeM()">×</button></h2><div class="body">'+
    '<p class="hint">彩金計算方式:押注額 × 圖示賠率 = 獲得彩金。5×4 盤面、共 50 種連線方式,由最左欄起連續相同圖示 3 個以上即中獎,多線可同時中獎加總。</p>'+
    '<table class="slPayTbl"><tr><th></th><th style="text-align:left">圖示</th><th>×5</th><th>×4</th><th>×3</th></tr>'+rows+'</table>'+
    '<p class="hint" style="margin-top:10px">🍃 荷葉(WILD):可代替任何圖示,螢火蟲(SCATTER)除外。</p>'+
    '<p class="hint">✨ 螢火蟲(SCATTER):盤面出現 3 個以上,觸發 '+SL_FS_AWARD+' 局 FREE SPINS(每轉觸發率約 10%;免費局中不再觸發)。</p>'+
    '<p class="hint">FREE GAME 中每次 SPIN 有機率隨機生成 2~4 個荷葉(WILD),且有機率帶 ×2 或 ×3 倍數,連線彩金乘上倍數!免費局押注額沿用觸發當下的押注。本機台長期回報率(RTP)約 97%。</p>'+
  '</div>';showM(h);
}


/* ============================================================
   角色資料 / 成就  — 由 happy-farm.html 原樣移植（第 1549–1622 行）
   ============================================================ */
/* ============ 角色資料 / 成就系統 ============ */
function achStat(k){ if(!G.stat)G.stat={}; G.stat[k]=(G.stat[k]||0)+1; }
function achSt(k){ return (G.stat&&G.stat[k])||0; }
const ACH=[
 {id:"lv5",   ico:"🌱",n:"初出茅廬",  d:"等級達到 Lv.5",         c:()=>G.level>=5,   p:()=>"Lv."+G.level+"/5"},
 {id:"lv10",  ico:"🌾",n:"熟練農夫",  d:"等級達到 Lv.10",        c:()=>G.level>=10,  p:()=>"Lv."+G.level+"/10"},
 {id:"lv20",  ico:"👑",n:"農場大亨",  d:"等級達到 Lv.20",        c:()=>G.level>=20,  p:()=>"Lv."+G.level+"/20"},
 {id:"gold1", ico:"💰",n:"第一桶金",  d:"持有金幣達 10,000",     c:()=>G.gold>=10000,   p:()=>Math.min(Math.floor(G.gold),10000).toLocaleString()+"/10,000"},
 {id:"gold2", ico:"🏦",n:"百萬富翁",  d:"持有金幣達 1,000,000",  c:()=>G.gold>=1000000, p:()=>Math.min(Math.floor(G.gold),1000000).toLocaleString()+"/1,000,000"},
 {id:"land",  ico:"🗺️",n:"開疆闢土", d:"解鎖全部農地",          c:()=>G.plots.every(p=>p.unlocked), p:()=>G.plots.filter(p=>p.unlocked).length+"/"+G.plots.length+" 塊"},
 {id:"harv100",ico:"🧺",n:"勤勞農夫", d:"累積收成 100 次",       c:()=>achSt("harv")>=100, p:()=>achSt("harv")+"/100"},
 {id:"harv500",ico:"🌟",n:"豐收之神", d:"累積收成 500 次",       c:()=>achSt("harv")>=500, p:()=>achSt("harv")+"/500"},
 {id:"animal5",ico:"🐮",n:"動物之友", d:"牧場同時飼養 5 隻動物", c:()=>G.ranch.length>=5,  p:()=>G.ranch.length+"/5 隻"},
 {id:"dog",   ico:"🐕",n:"忠實夥伴",  d:"飼養一隻看門狗",        c:()=>!!G.dog},
 {id:"dogmax",ico:"🦮",n:"最佳拍檔",  d:"看門狗升到 Lv.5",       c:()=>!!G.dog&&(G.dog.level||1)>=5, p:()=>"Lv."+(G.dog?(G.dog.level||1):0)+"/5"},
 {id:"day7",  ico:"📅",n:"全勤農夫",  d:"累積簽到 7 天",         c:()=>(G.totalDays||0)>=7, p:()=>(G.totalDays||0)+"/7 天"},
 {id:"pal",   ico:"🤝",n:"呼朋引伴",  d:"新增 1 位真人好友",     c:()=>Object.keys(G.pals||{}).length>=1},
 {id:"fs",    ico:"🎰",n:"螢光起舞",  d:"觸發拉霸 FREE GAME",    c:()=>achSt("fs")>=1},
 {id:"slot50",ico:"💎",n:"一夜致富",  d:"拉霸單轉贏得 50 倍押注",c:()=>achSt("big50")>=1},
 {id:"stock", ico:"📈",n:"進軍華爾街",d:"持有任一檔股票",        c:()=>Object.values(G.stocks||{}).some(s=>s&&s.shares)}
];
function checkAch(){
  if(!G||!Array.isArray(G.plots))return;
  if(!G.ach)G.ach={};
  ACH.forEach(a=>{
    if(G.ach[a.id])return;
    let ok=false; try{ok=!!a.c();}catch(e){}
    if(ok){ G.ach[a.id]=Date.now(); toast("🏆 達成成就:"+a.n+"!"); log("🏆 達成成就【"+a.n+"】"+a.d,"b"); }
  });
}
function openProfile(tab){
  if(!G.ach)G.ach={};
  checkAch();
  const done=ACH.filter(a=>G.ach[a.id]).length;
  const tabs='<div class="ptabs">'+
    '<button class="'+(!tab?"on":"")+'" onclick="openProfile()">👤 總覽</button>'+
    '<button class="'+(tab==="ach"?"on":"")+'" onclick="openProfile(\'ach\')">🏆 成就('+done+'/'+ACH.length+')</button>'+
    '<button class="'+(tab==="dog"?"on":"")+'" onclick="openProfile(\'dog\')">🐕 養狗</button></div>';
  let body="";
  if(tab==="dog"){
    body=dogBody();
  }else if(tab==="ach"){
    body='<div class="achlist">'+ACH.map(a=>{
      const ok=!!G.ach[a.id];
      const pg=(!ok&&a.p)?('<span class="apg">'+a.p()+'</span>'):"";
      return '<div class="achrow'+(ok?" ok":"")+'"><span class="aico">'+(ok?a.ico:"🔒")+'</span>'+
        '<div class="atx"><b>'+a.n+'</b><small>'+a.d+'</small></div>'+pg+
        '<span class="ast">'+(ok?"✅":"")+'</span></div>';
    }).join("")+'</div>';
  }else{
    const unlocked=G.plots.filter(p=>p.unlocked).length;
    const crops=Object.values(G.harvest||{}).reduce((a,b)=>a+b,0);
    const seeds=Object.values(G.seeds||{}).reduce((a,b)=>a+b,0);
    const need=XP_NEED(G.level);
    body=
    '<div class="pcard"><div class="pav">🧑‍🌾</div><div style="flex:1"><b>'+farmLabel()+'</b><br><small>Lv.'+G.level+'（XP '+G.xp+'/'+need+'）</small></div><button class="pbtn" style="padding:5px 10px;flex-shrink:0" onclick="renameFarm()">✏️ 改名</button></div>'+
    '<div class="pgrid">'+
    '<div class="pbox"><small>💰 金幣</small><b>'+Math.floor(G.gold).toLocaleString()+'</b></div>'+
    '<div class="pbox"><small>💎 鑽石</small><b>'+G.credit+'</b></div>'+
    '<div class="pbox"><small>❤️ 魅力</small><b>'+G.charm+'</b></div>'+
    '<div class="pbox"><small>🌾 農地</small><b>'+unlocked+'/'+G.plots.length+' 塊</b></div>'+
    '<div class="pbox"><small>🎒 倉庫作物</small><b>'+crops+'</b></div>'+
    '<div class="pbox"><small>🌱 種子</small><b>'+seeds+'</b></div>'+
    '<div class="pbox"><small>🐮 牧場動物</small><b>'+G.ranch.length+'/'+ranchCap()+' 隻</b></div>'+
    '<div class="pbox"><small>🐕 看門狗</small><b>'+(G.dog?("Lv."+(G.dog.level||1)):"未飼養")+'</b></div>'+
    '<div class="pbox"><small>🤝 好友</small><b>'+Object.keys(G.pals||{}).length+' 位</b></div>'+
    '<div class="pbox"><small>📅 累積簽到</small><b>'+(G.totalDays||0)+' 天</b></div>'+
    '<div class="pbox"><small>🧺 累積收成</small><b>'+achSt("harv")+' 次</b></div>'+
    '<div class="pbox"><small>🎰 FREE GAME</small><b>'+achSt("fs")+' 次</b></div>'+
    '</div>';
  }
  showM('<h2>🏡 角色資料 <button class="x" onclick="closeM()">×</button></h2><div class="body">'+tabs+body+'</div>');
}


/* ============================================================
   股市  — 由 happy-farm.html 原樣移植（第 1623–2039 行）
   ============================================================ */
/* ============ 股市 ============ */
function updateMarket(){ pollAllQuotes(); }   // 改用真實市場報價（Yahoo Finance）
let curStock=STOCKS[0].t, stockOpen=false, stockDropOpen=false, orderType="limit", stkTab="pos", stockView="home";
function stockOf(t){return STOCKS.find(x=>x.t===t)||STOCKS[0];}
function fmtP(v){return (Math.round(v*100)/100).toLocaleString("en-US",{maximumFractionDigits:2});}
function openStocks(){
  stockOpen=true; stockView="home";
  document.getElementById("scene").classList.add("s-stock");
  document.getElementById("stockScene").classList.add("home");
  const sb=document.getElementById("simBtn"); if(sb)sb.style.display="none";   // 手機預覽鈕會蓋住倉位表，股市中隱藏
  pollAllQuotes(true); renderStockHome(); loadFinNews();
}
function exitStock(){ stockOpen=false; stockDropOpen=false;
  const sb=document.getElementById("simBtn"); if(sb)sb.style.display="";
  document.getElementById("scene").classList.remove("s-stock"); render(); }
function backStockHome(){ stockView="home"; stockDropOpen=false;
  document.getElementById("stockScene").classList.add("home"); renderStockHome(); }
function openStockTrade(t){
  curStock=t; stockView="trade";
  document.getElementById("stockScene").classList.remove("home");
  loadChart(); setOrderType(orderType); odUseCur(); renderStockUI();
}
/* ---- 股市首頁清單 ---- */
const SICON={"2330":"#c62828","2317":"#37474f","2454":"#6a1b9a","2308":"#1565c0","2382":"#00695c","2881":"#0d47a1","2882":"#00897b","2412":"#f9a825","2891":"#2e7d32","3711":"#5d4037","9105":"#f57c00","3481":"#5e35b1","2409":"#00838f","2610":"#c2185b","2002":"#455a64"};
const SPARKS={};   // 走勢小圖資料（不入雲端存檔）
try{const _sc=JSON.parse(localStorage.getItem("hfSparkCache")||"null");if(_sc&&_sc.sp)Object.assign(SPARKS,_sc.sp);}catch(e){}   // 本機快取：首頁小圖立即顯示
function sparkSvg(arr,color,prev,rng){
  if(!arr||arr.length<2||!(prev>0))return '<svg width="110" height="34"></svg>';
  const R=rng||1.5;   // 統一比例尺：全標的共用 ±R%，中央虛線＝昨收
  const Y=v=>(16-((v-prev)/prev*100)/R*14).toFixed(1);
  const pts=arr.map((v,i)=>((i/(arr.length-1)*106+2).toFixed(1)+','+Y(v))).join(' ');
  return '<svg width="110" height="34" viewBox="0 0 110 34">'+
    '<line x1="2" y1="16" x2="108" y2="16" stroke="#9aa3b0" stroke-width="1" stroke-dasharray="3 3" opacity=".7"/>'+
    '<polyline fill="none" stroke="'+color+'" stroke-width="1.6" stroke-linejoin="round" points="'+pts+'"/></svg>';
}
function renderStockHome(){
  if(!stockOpen||stockView!=="home")return;
  const el=document.getElementById("shList"); if(!el)return;
  document.getElementById("shCash").textContent=G.gold.toLocaleString();
  let gmax=1.5;   // 全標的統一 Y 軸範圍：取最大漲跌幅（下限 ±1.5%）
  STOCKS.forEach(s=>{const st=G.stocks[s.t],sp=SPARKS[s.t];
    if(sp&&st&&st.prev>0)sp.forEach(v=>{const p=Math.abs((v-st.prev)/st.prev*100);if(p>gmax)gmax=p;});});
  const head='<div class="shHead"><div class="hIcon"></div><div class="shName">標的（名稱／代號）</div>'+
    '<div class="shSpark">當日走勢（虛線＝昨收，±'+gmax.toFixed(1)+'%同比例）</div><div class="shPx" style="align-items:flex-end">價格｜漲跌幅</div></div>';
  el.innerHTML=head+STOCKS.map(s=>{const st=G.stocks[s.t];const c=st.prev?((st.price-st.prev)/st.prev*100):0;const up=c>=0;
    return '<div class="shRow" onclick="openStockTrade(\''+s.t+'\')">'+
      '<div class="shIcon" style="background:'+(SICON[s.t]||'#607d8b')+'">'+(s.n.charAt(0)==="農"&&s.n.length>1?s.n.charAt(1):s.n.charAt(0))+'</div>'+
      '<div class="shName"><b>'+s.n+'</b><span>'+s.t+'</span></div>'+
      '<div class="shSpark">'+sparkSvg(SPARKS[s.t],up?'#16a34a':'#dc2626',st.prev,gmax)+'</div>'+
      '<div class="shPx"><b>$'+fmtP(st.price)+'</b><span class="'+(up?'up':'dn')+'">'+(up?'↗':'↘')+' '+Math.abs(c).toFixed(2)+'%</span></div></div>';
  }).join("");
}
/* ---- 財經新聞（Yahoo奇摩財經 RSS，經 CORS 代理） ---- */
let newsTs=0;
function yFetchText(u,ok,tryIdx,fail){
  tryIdx=tryIdx||0; if(tryIdx>=YPROXIES.length){if(fail)fail();return;}
  const idx=(1+tryIdx)%YPROXIES.length;   // 新聞先走 corsproxy（allorigins 對 RSS 較慢）
  const ctrl=("AbortController" in window)?new AbortController():null;
  const timer=ctrl?setTimeout(function(){ctrl.abort();},9000):null;
  fetch(YPROXIES[idx]+encodeURIComponent(u),ctrl?{signal:ctrl.signal}:{})
    .then(function(r){if(timer)clearTimeout(timer);if(!r.ok)throw 0;return r.text();})
    .then(function(d){ok(d);})
    .catch(function(){if(timer)clearTimeout(timer);yFetchText(u,ok,tryIdx+1,fail);});
}
const NEWS_FEEDS=["https://news.ltn.com.tw/rss/business.xml","https://feeds.feedburner.com/ettoday/finance"];
function loadFinNews(force,fi){
  fi=fi||0;
  const el=document.getElementById("shNewsList"); if(!el)return;
  if(!force&&!fi&&Date.now()-newsTs<600000&&el.querySelector(".nItem"))return;   // 10 分鐘快取
  if(fi>=NEWS_FEEDS.length){el.innerHTML='<div class="nt" style="padding:10px">暫時載入不到新聞</div>';return;}
  yFetchText(NEWS_FEEDS[fi],function(xml){
    const doc=new DOMParser().parseFromString(xml,"text/xml");
    const items=Array.prototype.slice.call(doc.querySelectorAll("item"),0,20);
    if(!items.length){loadFinNews(force,fi+1);return;}
    el.innerHTML=items.map(function(it){
      const g=function(tag){const n=it.querySelector(tag);return n?n.textContent.trim():"";};
      const t=g("title").replace(/</g,"&lt;");
      const d=new Date(g("pubDate"));
      const tm=isNaN(d)?"":(("0"+(d.getMonth()+1)).slice(-2)+"/"+("0"+d.getDate()).slice(-2)+" "+("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2));
      return '<a class="nItem" href="'+g("link")+'" target="_blank" rel="noopener"><span>'+t+'</span><div class="nt">'+tm+'</div></a>';
    }).join("");
    newsTs=Date.now();
  },0,function(){loadFinNews(force,fi+1);});
}
/* ---- Lightweight Charts 圖表（24小時～5個交易日） ---- */
let lwChart=null,lwSeries=null,lwOpenSeries=null,lwData=[],lwOpens=[],chartRange="24H",chartReq=0,lwTries=0,lwBase=0,lwPriceLine=null;
const CHART_TZOFF=-new Date().getTimezoneOffset()*60;
function ensureChart(){
  if(lwChart)return true;
  if(!window.LightweightCharts)return false;
  const el=document.getElementById("lwChart"); if(!el)return false;
  lwChart=LightweightCharts.createChart(el,{autoSize:true,
    layout:{textColor:'#848e9c',background:{type:'solid',color:'#0b0e11'},attributionLogo:false},
    rightPriceScale:{scaleMargins:{top:0.32,bottom:0.12},borderColor:'#2b3139'},
    timeScale:{timeVisible:true,secondsVisible:false,borderColor:'#2b3139'},
    crosshair:{horzLine:{visible:false,labelVisible:false}},
    grid:{vertLines:{visible:false},horzLines:{color:'#1c2126'}}});
  lwSeries=lwChart.addSeries(LightweightCharts.BaselineSeries,{
    baseValue:{type:'price',price:0},lineWidth:2,crosshairMarkerVisible:false,
    topLineColor:'#0ecb81',topFillColor1:'rgba(14,203,129,.28)',topFillColor2:'rgba(14,203,129,.03)',
    bottomLineColor:'#f6465d',bottomFillColor1:'rgba(246,70,93,.03)',bottomFillColor2:'rgba(246,70,93,.28)',
    autoscaleInfoProvider:function(){   // Y 軸以基準價為中心上下對稱，漲跌幅度視覺一致
      if(!lwData.length||!lwBase)return null;
      let dev=0; lwData.forEach(p=>{const d=Math.abs(p.value-lwBase); if(d>dev)dev=d;});
      dev=Math.max(dev,lwBase*0.002)*1.08;
      return {priceRange:{minValue:lwBase-dev,maxValue:lwBase+dev}};
    }});
  lwOpenSeries=lwChart.addSeries(LightweightCharts.LineSeries,{   // 逐日開盤基準（多日圖為階梯線）
    color:'#9aa3b0',lineWidth:1,lineStyle:LightweightCharts.LineStyle.Dashed,lineType:1,
    crosshairMarkerVisible:false,priceLineVisible:false,lastValueVisible:false});
  lwChart.subscribeCrosshairMove(updateLwLegend);
  // 平移圖表時：「開盤」標籤跟著可視範圍最右邊交易日的開盤價移動（不需十字線）
  lwChart.timeScale().subscribeVisibleLogicalRangeChange(function(r){
    if(!r||!lwOpens.length||!lwPriceLine)return;
    const i=Math.min(lwOpens.length-1,Math.max(0,Math.round(r.to)-1));
    const v=lwOpens[i]&&lwOpens[i].value;
    if(v){try{lwPriceLine.applyOptions({price:v});}catch(e){}}
  });
  return true;
}
function updateLwLegend(param){
  const lg=document.getElementById("lwLegend"); if(!lg||!lwSeries)return;
  let bar=null, ob=null;
  if(param&&param.time&&param.point&&param.point.x>=0&&param.point.y>=0){
    bar=param.seriesData.get(lwSeries);
    if(lwOpenSeries)ob=param.seriesData.get(lwOpenSeries);
  }
  if(!bar)bar=lwData[lwData.length-1];
  if(!bar){lg.innerHTML="";return;}
  const openVal=(ob&&typeof ob.value==="number")?ob.value:lwBase;   // 十字線所在交易日的開盤
  if(lwPriceLine){try{lwPriceLine.applyOptions({price:openVal});}catch(e){}}   // 右軸「開盤」標籤跟著換日
  const s=stockOf(curStock);
  const dt=new Date((bar.time-CHART_TZOFF)*1000);
  lg.innerHTML='<div class="l1">'+s.n+' <span>'+s.t+'</span></div>'+
    '<div class="l2">'+fmtP(bar.value)+'</div>'+
    '<div class="l3">'+dt.toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})+'　開盤 '+fmtP(openVal)+'</div>';
}
function setChartRange(r){chartRange=r;
  document.querySelectorAll('#stkRanges button').forEach(b=>b.classList.toggle('on',b.getAttribute('data-r')===r));
  loadChart();
}
function loadChart(){
  if(!ensureChart()){ if(lwTries++<20)setTimeout(loadChart,600); return; }   // CDN 尚未載入時重試
  const s=stockOf(curStock); const rq=++chartReq;
  const day=chartRange==="24H";
  const tw=/\.TW$/.test(s.y);
  const useDaily=day&&!tw;   // 台股 range=1d 不給分線 → 一律抓 5d 再切最後一日
  const u="https://query1.finance.yahoo.com/v8/finance/chart/"+encodeURIComponent(s.y)+
    "?interval="+(day?"5m":"15m")+"&range="+(useDaily?"1d":"5d")+"&includePrePost="+useDaily+"&_ts="+Date.now();   // 24小時一律5分K（台股從5d切最後一日）
  yFetch(u,function(d){
    if(rq!==chartReq)return;
    const res=d&&d.chart&&d.chart.result&&d.chart.result[0]; if(!res)return;
    const ts=res.timestamp||[], q=(res.indicators&&res.indicators.quote&&res.indicators.quote[0])||{}, cl=q.close||[];
    let pts=[];
    for(let i=0;i<ts.length;i++){ if(cl[i]!=null)pts.push({time:ts[i]+CHART_TZOFF,value:Math.round(cl[i]*100)/100}); }
    const nd=chartRange==="2D"?2:chartRange==="3D"?3:(day&&tw?1:0);   // 2日/3日（台股24小時=1日）：從5日資料取最後N個交易日
    if(nd){ const keys=[]; pts.forEach(p=>{const k=Math.floor(p.time/86400);if(keys.indexOf(k)<0)keys.push(k);});
      const keep=keys.slice(-nd); pts=pts.filter(p=>keep.indexOf(Math.floor(p.time/86400))>=0); }
    if(!pts.length)return;
    // 逐日開盤：每個交易日各自的開盤價（多日圖呈階梯狀，隨交易日調整）
    const opens=[]; let curDay=null, dayOpen=0;
    pts.forEach(p=>{const dk=Math.floor(p.time/86400);
      if(dk!==curDay){curDay=dk;dayOpen=p.value;}
      opens.push({time:p.time,value:dayOpen});});
    lwBase=dayOpen;   // 基準色以最後一個交易日的開盤為準
    lwSeries.applyOptions({baseValue:{type:'price',price:lwBase}});
    if(lwPriceLine){try{lwSeries.removePriceLine(lwPriceLine);}catch(e){} lwPriceLine=null;}
    lwData=pts; lwOpens=opens; lwSeries.setData(pts);
    if(lwOpenSeries)lwOpenSeries.setData(opens);
    lwPriceLine=lwSeries.createPriceLine({price:lwBase,color:'#9aa3b0',lineWidth:1,lineStyle:LightweightCharts.LineStyle.Dashed,axisLabelVisible:true,title:'開盤',lineVisible:false});
    lwChart.timeScale().fitContent(); updateLwLegend();
  });
}
function pickStock(t){curStock=t;stockDropOpen=false;loadChart();odUseCur();renderStockUI();}
function toggleStockDrop(){stockDropOpen=!stockDropOpen;renderStockUI();}
function toggleFav(){G.stockFav[curStock]=!G.stockFav[curStock];saveGame();renderStockUI();}
function setStkTab(t){stkTab=t;renderStockUI();}
function setOrderType(t){orderType=t;
  const l=document.getElementById("otLimit"),m=document.getElementById("otMarket"),p=document.getElementById("odPrice");
  if(l)l.classList.toggle("on",t==="limit"); if(m)m.classList.toggle("on",t==="market");
  if(p)p.disabled=(t==="market");
  updOdCost();
}
function odUseCur(){const p=document.getElementById("odPrice");if(p)p.value=G.stocks[curStock].price;updOdCost();}
function odPriceNow(){ const st=G.stocks[curStock];
  if(orderType==="market")return st.price;
  return parseFloat((document.getElementById("odPrice")||{}).value)||st.price; }
let odUnit="l";   // 數量單位：l=張（預設，1張=1000股）、s=股
function toggleOdUnit(){ odUnit=(odUnit==="s"?"l":"s");
  const b=document.getElementById("odUnit"); if(b)b.textContent=(odUnit==="s"?"股 ▾":"張 ▾");
  const el=document.getElementById("odQty"); if(el)el.value="";
  updOdCost(); }
function odQtyShares(){ const v=Math.floor(parseFloat((document.getElementById("odQty")||{}).value)||0);
  return odUnit==="l"?v*1000:v; }
function fmtShares(n){ const a=Math.abs(n||0); if(a<1000)return n+"股";
  const lots=Math.floor(a/1000), rem=a%1000;
  return (n<0?"-":"")+lots+"張"+(rem?rem+"股":""); }
let levB=0;   // 融資成數（借款比例）：0=現股、0.4/0.5/0.6
function setLev(b){ levB=b;
  const vals=[0,0.6];   // 現股 / 融資（預設6成，自備4成）
  document.querySelectorAll('#levRow button').forEach((x,i)=>x.classList.toggle('on',vals[i]===b));
  updOdCost(); }
function odQtySlide(v){ const lbl=document.getElementById("odPctLbl"); if(lbl)lbl.textContent=v+"%"; odQtyPct(v/100); }
function odQtyPct(r){ const q=Math.floor(G.gold*r/(odPriceNow()*(1-levB)));   // 融資下自備款可買更多
  const el=document.getElementById("odQty"); if(el)el.value=(odUnit==="l"?Math.floor(q/1000):(q>0?q:0)); updOdCost(); }
function updOdCost(){ const el=document.getElementById("odCost"); if(!el)return;
  const qty=odQtyShares(); const total=Math.round(odPriceNow()*qty); const self=Math.round(total*(1-levB));
  let liq="";
  if(levB>0&&qty>0){ const st=G.stocks[curStock]||{}; const sh=Math.max(0,st.shares||0);
    const nd=(sh>0?(st.debt||0):0)+total*levB, ns=sh+qty;
    liq="　｜　預估強平價 <span style='color:#f6465d'>"+fmtP(1.3*nd/ns)+"</span>"; }   // 維持率130%＝市值/融資 → 強平價=1.3×融資/股數
  el.innerHTML=(levB>0?("自備款 "+CO+" "+self.toLocaleString()+"（融資 "+(total-self).toLocaleString()+"）")
                      :("預估成本 "+CO+" "+total.toLocaleString()))
    +(odUnit==="l"&&qty?("　＝"+qty.toLocaleString()+"股"):"")+"　｜　可用 "+CO+" "+G.gold.toLocaleString()+liq; }
function placeOrder(side){
  const st=G.stocks[curStock];
  const qty=odQtyShares();
  if(qty<=0){toast("請輸入數量");return;}
  if(orderType==="market"){execTrade(curStock,side,qty,st.price,levB);return;}
  const price=Math.round((parseFloat((document.getElementById("odPrice")||{}).value)||0)*100)/100;
  if(price<=0){toast("請輸入委託價格");return;}
  if((side>0&&st.price<=price)||(side<0&&st.price>=price)){execTrade(curStock,side,qty,st.price,levB);return;}   // 立即可成交
  G.stockOrders.push({id:Math.round(Date.now()+Math.random()*1e4),t:curStock,side:side,price:price,qty:qty,lev:levB});
  log("📋 掛單："+(side>0?"買入":"賣出")+" "+stockName(curStock)+" ×"+qty+" @ "+fmtP(price),"b");
  toast("已掛單，到價自動成交");saveGame();renderStockUI();
}
function execTrade(t,side,qty,price,lev){
  const st=G.stocks[t]; const pos=st.shares||0;
  let closeQ=0, openQ=qty;
  if(pos!==0&&(pos>0)!==(side>0)){closeQ=Math.min(qty,Math.abs(pos));openQ=qty-closeQ;}   // 先平反向倉
  if(closeQ>0){
    const dir=pos>0?1:-1;
    const pnl=Math.round((price-st.avg)*dir*closeQ);
    let repay=0;
    if(dir>0&&(st.debt||0)>0){ repay=(closeQ>=pos)?st.debt:Math.round(st.debt*closeQ/pos); st.debt-=repay; }   // 平多按比例償還融資
    G.gold=Math.max(0,Math.round(G.gold+st.avg*closeQ)+pnl-repay);
    st.shares=pos-dir*closeQ; if(st.shares===0){st.avg=0;st.debt=0;}
    log((dir>0?"平多 ":"平空 ")+stockName(t)+" ×"+closeQ+" @ "+fmtP(price)+"，損益 "+(pnl>=0?"+":"")+pnl+" "+CO+(repay?("（償還融資 "+repay.toLocaleString()+"）"):""),(pnl>=0?"g":"r"));
    toast(pnl>=0?("💰 獲利 +"+pnl):("虧損 "+pnl));
  }
  if(openQ>0){
    const total=Math.round(price*openQ);
    const b=(side>0&&lev)?lev:0;                    // 融資只適用買進/做多
    const cost=Math.round(total*(1-b));             // 自備款
    if(G.gold<cost){ toast(closeQ?"金幣不足，僅完成平倉":(b?"自備款不足":"金幣不足")); }
    else{
      G.gold-=cost;
      if(b>0)st.debt=Math.round((st.debt||0)+total*b);
      const cur=Math.abs(st.shares);
      st.avg=cur?((st.avg*cur+price*openQ)/(cur+openQ)):price;
      st.shares+=side*openQ;
      log((side>0?"開多 ":"開空 ")+stockName(t)+" ×"+openQ+" @ "+fmtP(price)+(b?("（融資"+(b*10)+"成，借 "+Math.round(total*b).toLocaleString()+"）"):""),"b");
    }
  }
  renderHUD();saveGame();renderStockUI();
}
function closePosition(t){const st=G.stocks[t];if(!st||!st.shares)return;execTrade(t,st.shares>0?-1:1,Math.abs(st.shares),st.price);}
function cancelOrder(id){G.stockOrders=(G.stockOrders||[]).filter(o=>o.id!==id);saveGame();renderStockUI();toast("已取消掛單");}
function stockTick(){   // 每個遊戲心跳：以最新真實報價撮合限價單
  (G.stockOrders||[]).slice().forEach(o=>{const st=G.stocks[o.t];if(!st)return;
    if((o.side>0&&st.price<=o.price)||(o.side<0&&st.price>=o.price)){
      G.stockOrders=G.stockOrders.filter(x=>x.id!==o.id);
      toast("✅ 限價單成交："+stockName(o.t));
      execTrade(o.t,o.side,o.qty,o.price,o.lev||0);
    }});
  // 融資維持率檢查：市值/融資金額 < 130% → 強制斷頭（台股規則）
  STOCKS.forEach(function(x){const st=G.stocks[x.t];
    if(st&&(st.debt||0)>0&&st.shares>0){
      const mr=st.price*st.shares/st.debt;
      if(mr<1.3){ log("💥 "+x.n+" 融資維持率 "+Math.round(mr*100)+"%＜130%，遭強制斷頭平倉","r"); toast("💥 融資斷頭："+x.n); execTrade(x.t,-1,st.shares,st.price); }
    }});
  if(stockOpen)renderStockUI();
}
/* ---- 真實市場報價（Yahoo Finance，含盤前/盤中/盤後）；CORS 代理多重容錯 ---- */
const YPROXIES=["https://api.allorigins.win/raw?url=","https://corsproxy.io/?url="];
let yProxyIdx=0;
function yFetch(u,ok,tryIdx){
  tryIdx=tryIdx||0;
  if(tryIdx>=YPROXIES.length)return;
  const idx=(yProxyIdx+tryIdx)%YPROXIES.length;
  const ctrl=("AbortController" in window)?new AbortController():null;
  const timer=ctrl?setTimeout(function(){ctrl.abort();},8000):null;
  fetch(YPROXIES[idx]+encodeURIComponent(u),ctrl?{signal:ctrl.signal}:{})
    .then(function(r){if(timer)clearTimeout(timer);if(!r.ok)throw 0;return r.json();})
    .then(function(d){yProxyIdx=idx;ok(d);})
    .catch(function(){if(timer)clearTimeout(timer);yFetch(u,ok,tryIdx+1);});
}
function fetchQuote(t,cb){
  const s=stockOf(t);
  const tw=/\.TW$/.test(s.y);   // 台股：Yahoo 不回 range=1d 分線 → 抓 5d/15m 再取最後一個交易日
  // _ts 快取破壞參數：避免 CORS 代理回舊快取造成報價與圖表不一致
  const u="https://query1.finance.yahoo.com/v8/finance/chart/"+encodeURIComponent(s.y)+(tw?"?interval=5m&range=5d":"?interval=5m&range=1d&includePrePost=true")+"&_ts="+Date.now();   // 台美股皆 5 分 K
  yFetch(u,function(d){
    const res=d&&d.chart&&d.chart.result&&d.chart.result[0]; if(!res)return;
    const meta=res.meta||{}; const st=G.stocks[t]; if(!st)return;
    if(meta.regularMarketTime&&(Date.now()/1000-meta.regularMarketTime)>6*86400)return;   // 過期資料不採用
    let px=meta.regularMarketPrice;
    const q=res.indicators&&res.indicators.quote&&res.indicators.quote[0];
    const tss=res.timestamp||[];
    let cs=[],dayk=[];
    if(q&&q.close){for(let i=0;i<q.close.length;i++){if(q.close[i]!=null){cs.push(q.close[i]);dayk.push(Math.floor(((tss[i]||0)+28800)/86400));}}}   // UTC+8 分日
    let prevTW=null;
    if(tw&&cs.length){const lastD=dayk[dayk.length-1];const idx=dayk.indexOf(lastD);
      if(idx>0)prevTW=cs[idx-1];   // 前一交易日收盤＝昨收
      cs=cs.slice(idx);}           // 只留最後一個交易日
    if(cs.length)px=cs[cs.length-1];   // 最新成交（美股含盤前/盤後）
    if(cs.length>2){ const step=Math.max(1,Math.floor(cs.length/40));   // 首頁走勢小圖（降採樣約40點）
      SPARKS[t]=cs.filter((_,i)=>i%step===0); if(SPARKS[t][SPARKS[t].length-1]!==cs[cs.length-1])SPARKS[t].push(cs[cs.length-1]);
      try{localStorage.setItem("hfSparkCache",JSON.stringify({sp:SPARKS}));}catch(e){} }
    if(!px)return;
    st.price=Math.round(px*100)/100;
    if(tw&&prevTW)st.prev=prevTW; else if(meta.chartPreviousClose)st.prev=meta.chartPreviousClose;
    let sess="盤中";
    const ts=res.timestamp&&res.timestamp[res.timestamp.length-1];
    const tp=meta.currentTradingPeriod;
    if(ts&&tp&&tp.regular){ if(ts<tp.regular.start)sess="盤前"; else if(ts>=tp.regular.end)sess="盤後"; }
    st.sess=sess; st.qts=Date.now();
    if(cb)cb();
    if(stockOpen&&stockView==="home")renderStockHome();
    else if(stockOpen&&t===curStock)renderStockUI();
  });
}
function pollAllQuotes(fast){ STOCKS.forEach(function(s,i){ setTimeout(function(){fetchQuote(s.t);},i*(fast?350:1200)); }); }
setTimeout(pollAllQuotes,2500);                                          // 開場先抓一輪真實報價
setInterval(pollAllQuotes,90000);                                        // 全標的每 90 秒更新（背景撮合掛單也吃得到）
setInterval(function(){ if(stockOpen)fetchQuote(curStock); },15000);     // 股市開啟中，當前標的每 15 秒更新

function renderStockUI(){
  if(!stockOpen)return;
  if(stockView==="home"){renderStockHome();return;}
  const s=stockOf(curStock), st=G.stocks[curStock];
  const chg=st.prev?((st.price-st.prev)/st.prev*100):0;
  document.getElementById("stkName").textContent=s.n;
  document.getElementById("stkTick").textContent=s.t;
  const pe=document.getElementById("stkPrice"); pe.textContent=fmtP(st.price); pe.className="stkPrice "+(chg>=0?"up":"dn");
  const ce=document.getElementById("stkChg"); ce.textContent=(chg>=0?"+":"")+chg.toFixed(2)+"%"; ce.style.color=chg>=0?"#0ecb81":"#f6465d";
  const se=document.getElementById("stkSess"); if(se){se.textContent=st.sess||"--";se.style.color=st.sess==="盤中"?"#0ecb81":(st.sess?"#f0b90b":"#848e9c");}
  const posEl=document.getElementById("stkPos");
  posEl.textContent=st.shares?((st.shares>0?"+":"")+fmtShares(st.shares)):"--";
  posEl.style.color=st.shares>0?"#0ecb81":(st.shares<0?"#f6465d":"#eaecef");
  document.getElementById("stkCash").textContent=G.gold.toLocaleString();
  document.getElementById("stkStar").classList.toggle("on",!!G.stockFav[curStock]);
  // 標的摺疊選單（自選置頂）
  const dd=document.getElementById("stkDrop"); dd.classList.toggle("on",stockDropOpen);
  if(stockDropOpen){
    const list=STOCKS.slice().sort((a,b)=>(G.stockFav[b.t]?1:0)-(G.stockFav[a.t]?1:0));
    dd.innerHTML=list.map(x=>{const xs=G.stocks[x.t];const c=xs.prev?((xs.price-xs.prev)/xs.prev*100):0;
      return '<div class="row" onclick="pickStock(\''+x.t+'\')">'+(G.stockFav[x.t]?'⭐':'<span style="opacity:.25">⭐</span>')+'<b>'+x.n+'</b><span class="tk">'+x.t+'</span>'+
        '<span>'+fmtP(xs.price)+'</span><span style="width:62px;text-align:right;color:'+(c>=0?'#0ecb81':'#f6465d')+'">'+(c>=0?'+':'')+c.toFixed(2)+'%</span></div>';}).join("");
  }
  // 底部：倉位 / 當前委託
  const posRows=STOCKS.filter(x=>(G.stocks[x.t].shares||0)!==0);
  document.getElementById("posN").textContent=posRows.length;
  document.getElementById("ordN").textContent=(G.stockOrders||[]).length;
  document.getElementById("btPos").classList.toggle("on",stkTab==="pos");
  document.getElementById("btOrd").classList.toggle("on",stkTab==="ord");
  const body=document.getElementById("stkBody");
  if(stkTab==="pos"){
    if(!posRows.length){body.innerHTML='<div style="color:#848e9c;font-size:12px;padding:18px;text-align:center">目前沒有持倉，用右側面板下單開始交易。</div>';return;}
    let h='<table><tr><th>標的</th><th>數量</th><th>開倉均價</th><th>現價</th><th>融資(維持率)</th><th>強平價</th><th>盈虧(ROI%)</th><th></th></tr>';
    posRows.forEach(x=>{const xs=G.stocks[x.t];const lg=xs.shares>0;
      const pnl=(xs.price-xs.avg)*xs.shares;
      const roi=xs.avg?(pnl/(xs.avg*Math.abs(xs.shares))*100):0;
      let fin='—', liq='—';
      if(lg&&(xs.debt||0)>0){const mr=xs.price*xs.shares/xs.debt*100;
        fin=Math.round(xs.debt).toLocaleString()+'（<span class="'+(mr<140?'dn':'up')+'">'+Math.round(mr)+'%</span>）';
        liq='<span class="dn">'+fmtP(1.3*xs.debt/xs.shares)+'</span>';}   // 跌到此價維持率=130%
      h+='<tr><td><b>'+x.n+'</b> <span class="'+(lg?'up':'dn')+'">'+(lg?'多':'空')+'</span></td>'+
        '<td>'+fmtShares(xs.shares)+'</td><td>'+fmtP(xs.avg)+'</td><td>'+fmtP(xs.price)+'</td><td>'+fin+'</td><td>'+liq+'</td>'+
        '<td class="'+(pnl>=0?'up':'dn')+'">'+(pnl>=0?'+':'')+Math.round(pnl)+'（'+(roi>=0?'+':'')+roi.toFixed(2)+'%）</td>'+
        '<td><button class="cbtn" onclick="closePosition(\''+x.t+'\')">市價平倉</button></td></tr>';
    });
    body.innerHTML=h+'</table>';
  }else{
    const os=G.stockOrders||[];
    if(!os.length){body.innerHTML='<div style="color:#848e9c;font-size:12px;padding:18px;text-align:center">沒有掛單中的委託。</div>';return;}
    let h='<table><tr><th>標的</th><th>方向</th><th>委託價</th><th>數量</th><th></th></tr>';
    os.forEach(o=>{h+='<tr><td><b>'+stockName(o.t)+'</b></td><td class="'+(o.side>0?'up':'dn')+'">'+(o.side>0?'買入/做多':'賣出/做空')+'</td><td>'+fmtP(o.price)+'</td><td>'+fmtShares(o.qty)+'</td>'+
      '<td><button class="cbtn" onclick="cancelOrder('+o.id+')">取消</button></td></tr>';});
    body.innerHTML=h+'</table>';
  }
}
function init(){
  const loaded=loadGame();
  if(!loaded)freshGame();
  // 柵欄
  const fb=document.getElementById("fenceBottom");for(let i=0;i<48;i++){const s=document.createElement("span");s.style.height=(18+Math.random()*6)+"px";fb.appendChild(s);}
  const localTs=G.ts||0;
  function finish(msg,cls){ if(msg)log(msg,cls); dailyCheck(); render(); saveGame(); }
  // 網址帶有農場代碼？例如 ...index.html#farm=AB12CD
  let hashCode="";const m=(location.hash||"").match(/farm=([A-Za-z0-9]+)/);if(m)hashCode=m[1].toUpperCase();
  const code=hashCode||syncCode;
  if(cloudOn() && code){
    fetch(cloudUrl(code)).then(r=>r.ok?r.json():null).then(d=>{
      if(d&&Array.isArray(d.plots)){
        const cloudTs=d.ts||0;
        if(hashCode || !loaded || cloudTs>=localTs){
          Object.assign(G,d);normalizeState();
        }
        syncCode=code;try{localStorage.setItem(CODE_KEY,code);}catch(e){}
        finish("☁️ 已連結雲端農場（代碼 "+code+"）。","b");
      }else{
        syncCode=code;try{localStorage.setItem(CODE_KEY,code);}catch(e){}
        finish(loaded?"☁️ 雲端尚無此代碼，將以本機進度上傳。":"歡迎來到開心農場！","g");
      }
    }).catch(()=>finish(loaded?"（雲端連線失敗，使用本機進度）":"歡迎來到開心農場！","g"));
  }else{
    finish(loaded?"☁️ 已載入你的農場進度。":"歡迎來到開心農場！選右側 🌱播種，直接點田地就能種下蘿蔔種子。","g");
  }
}
function makeFriendPlot(){
  const keys=Object.keys(CROPS);const r=Math.random();
  if(r<0.45){const c=keys[Math.floor(Math.random()*4)];return {crop:c,ripe:true,stolen:0,dry:Math.random()<.4,weed:Math.random()<.4,bug:Math.random()<.3?1:0};}
  if(r<0.75){const c=keys[Math.floor(Math.random()*5)];return {crop:c,ripe:false,dry:Math.random()<.5,weed:Math.random()<.5,bug:Math.random()<.35?1:0};}
  return {crop:null};
}


/* ============================================================
   工廠  — 由 happy-farm.html 原樣移植（第 2290–2404 行）
   ============================================================ */
/* ============ 工廠：升級（1-10級，需魅力門檻）＋農產加工 ============ */
const FGOODS={
  salad:   {name:"蔬菜沙拉",   emoji:"🥗", lv:1,  time:60,  sell:360,   need:{radish:5,cucumber:5}},
  ketchup: {name:"番茄醬",     emoji:"🥫", lv:1,  time:90,  sell:640,   need:{tomato:8}},
  cornsoup:{name:"玉米濃湯",   emoji:"🍲", lv:2,  time:120, sell:880,   need:{corn:6,radish:4},        buff:{k:"grow",min:10,desc:"🌱 作物成長+20%（10分）"}},
  sjam:    {name:"草莓果醬",   emoji:"🍓", lv:3,  time:150, sell:2700,  need:{strawberry:8}},
  chsauce: {name:"辣椒醬",     emoji:"🌶️", lv:4,  time:180, sell:3800,  need:{chili:8,tomato:4},       buff:{k:"sell",min:10,desc:"💰 賣價+15%（10分）"}},
  ppie:    {name:"南瓜派",     emoji:"🥧", lv:5,  time:210, sell:4900,  need:{pumpkin:6,strawberry:4}},
  wjuice:  {name:"西瓜汁",     emoji:"🧃", lv:5,  time:150, sell:4600,  need:{watermelon:6},           buff:{k:"animal",min:10,desc:"🐮 動物生產+20%（10分）"}},
  wine:    {name:"葡萄酒",     emoji:"🍷", lv:7,  time:300, sell:12500, need:{grape:12},               buff:{k:"xp",min:30,desc:"⭐ 經驗+30%（30分）"}},
  fruitbox:{name:"綜合果盤",   emoji:"🍉", lv:8,  time:240, sell:18500, need:{pineapple:4,melon:3,grape:4,strawberry:4}},
  feast:   {name:"滿漢農宴禮盒",emoji:"🎁", lv:10, time:360, sell:25000, need:{pumpkin:6,watermelon:6,melon:4,grape:6}, buff:{k:"all",min:10,desc:"✨ 全效果加乘（10分）"}}
};
const FLV=[null,null,   // FLV[n]＝升到 n 級的需求；魅力為門檻不消耗；效果涵蓋農場/牧場全域
  {gold:3000,  charm:10,  fx:"🌱 全作物成長 +5%（含解鎖玉米濃湯）"},
  {gold:8000,  charm:25,  fx:"🐮 動物生產 +5%、加工速度 -10%"},
  {gold:18000, charm:45,  fx:"🚿 田地異常發生率 -20%、加工佇列 +1"},
  {gold:35000, charm:70,  fx:"💰 全域賣價 +5%（作物＋加工品）"},
  {gold:60000, charm:100, fx:"🌱 成長加成升至 +10%、加工速度 -20%"},
  {gold:100000,charm:140, fx:"🐮 生產加成升至 +10%、加工佇列 +1"},
  {gold:160000,charm:190, fx:"🧺 收成產量 +1 顆、賣價升至 +10%"},
  {gold:240000,charm:250, fx:"🚿 異常發生率 -40%、加工速度 -30%"},
  {gold:350000,charm:320, fx:"⭐ 全經驗 +10%、賣價升至 +15%（解鎖滿漢農宴禮盒）"}
];
function fLv(){return (G&&G.factory&&G.factory.lv)||1;}
function fSpeed(){const lv=fLv();return lv>=9?0.7:lv>=6?0.8:lv>=3?0.9:1;}
function fSlots(){const lv=fLv();return 1+(lv>=4?1:0)+(lv>=7?1:0);}
function fSellBonus(){const lv=fLv();return 1+(lv>=10?0.15:lv>=8?0.10:lv>=5?0.05:0);}   // 全域賣價（作物＋加工品）
function fGrowB(){const lv=fLv();return lv>=6?0.10:lv>=2?0.05:0;}     // 全作物成長加成
function fAnimB(){const lv=fLv();return lv>=7?0.10:lv>=3?0.05:0;}     // 牧場動物生產加成
function fHazM(){const lv=fLv();return lv>=9?0.6:lv>=4?0.8:1;}        // 田地異常發生率倍率
function fQtyB(){return fLv()>=8?1:0;}                                 // 收成產量 +1
function fXpB(){return fLv()>=10?0.10:0;}                              // 全經驗加成
function buffOn(k){const b=G.buffs||{};const t=Date.now();return !!((b[k]&&b[k]>t)||(b.all&&b.all>t));}
function upFactory(){
  const nl=G.factory.lv+1, c=FLV[nl]; if(!c){toast("工廠已滿級");return;}
  if(G.charm<c.charm){toast("魅力不足（需 ❤️"+c.charm+"）");return;}
  if(G.gold<c.gold){toast("金幣不足");return;}
  G.gold-=c.gold; G.factory.lv=nl;
  log("🏭 工廠升級 Lv."+nl+"！"+c.fx,"g"); toast("🏭 工廠 Lv."+nl);
  renderHUD(); saveGame(); openFactory();
}
function fCraft(k){
  const r=FGOODS[k]; if(!r)return;
  if(G.factory.lv<r.lv){toast("工廠等級不足");return;}
  if(G.factory.q.length>=fSlots()){toast("加工佇列已滿");return;}
  for(const m in r.need){if((G.harvest[m]||0)<r.need[m]){toast("原料不足："+CROPS[m].name);return;}}
  for(const m in r.need){G.harvest[m]-=r.need[m];if(G.harvest[m]<=0)delete G.harvest[m];}
  G.factory.q.push({k:k,end:Date.now()+Math.round(r.time*fSpeed())*1000});
  log("🏭 開始加工 "+r.emoji+r.name,"b"); saveGame(); openFactory();
}
function fSell(k){
  if(!(G.goods[k]>0))return; const r=FGOODS[k];
  const v=Math.round(r.sell*fSellBonus()*(buffOn("sell")?1.15:1));
  G.goods[k]--; if(G.goods[k]<=0)delete G.goods[k];
  G.gold+=v; log("賣出 "+r.emoji+r.name+"＝<span class=coinico></span>"+v,"g"); toast("<span class=coinico></span> +"+v);
  renderHUD(); saveGame(); openFactory();
}
function fUse(k){
  if(!(G.goods[k]>0))return; const r=FGOODS[k]; if(!r.buff)return;
  G.goods[k]--; if(G.goods[k]<=0)delete G.goods[k];
  const until=Date.now()+r.buff.min*60000;
  if(r.buff.k==="all")["grow","sell","animal","xp"].forEach(b=>{G.buffs[b]=Math.max(G.buffs[b]||0,until);});
  else G.buffs[r.buff.k]=Math.max(G.buffs[r.buff.k]||0,until);
  log("使用 "+r.emoji+r.name+"："+r.buff.desc,"b"); toast(r.buff.desc);
  saveGame(); openFactory();
}
function openFactory(){
  if(typeof editOn!=="undefined"&&editOn)return;   // 佈局編輯中不開面板
  const f=G.factory, now=Date.now();
  let h='<h2>🏭 農產加工廠 Lv.'+f.lv+' <button class="x" onclick="closeM()">×</button></h2><div class="body" id="factPanel">';
  const c=FLV[f.lv+1];
  if(c){const can=G.gold>=c.gold&&G.charm>=c.charm;
    h+='<div style="background:#fff3c4;border:2px solid #f5b733;border-radius:10px;padding:8px 10px;margin-bottom:8px;font-size:13px">'+
      '<b>升級 Lv.'+(f.lv+1)+'</b>：'+c.fx+'<br>需 <span class=coinico></span>'+c.gold.toLocaleString()+'＋魅力門檻 ❤️'+c.charm+'（目前 ❤️'+G.charm+'）'+
      '<button class="pbtn gold" style="float:right;margin-top:-18px" onclick="upFactory()" '+(can?'':'disabled')+'>升級</button><div style="clear:both"></div></div>';}
  else h+='<p class="hint">🎉 已達最高等級 Lv.10</p>';
  h+='<p class="hint" style="margin:2px 0 8px">佇列 '+f.q.length+'/'+fSlots()+'｜加工時間 ×'+fSpeed().toFixed(1)+
    '｜🌱成長+'+Math.round(fGrowB()*100)+'%｜🐮生產+'+Math.round(fAnimB()*100)+'%｜🚿異常-'+Math.round((1-fHazM())*100)+'%'+
    '｜💰賣價+'+Math.round((fSellBonus()-1)*100)+'%'+(fQtyB()?'｜🧺收成+1':'')+(fXpB()?'｜⭐經驗+10%':'')+'</p>';
  const bn={grow:"🌱成長+20%",sell:"💰賣價+15%",animal:"🐮生產+20%",xp:"⭐經驗+30%"};
  const act=Object.keys(bn).filter(b=>buffOn(b));
  if(act.length)h+='<div style="font-size:12px;font-weight:800;color:#2e7d32;margin-bottom:8px">加乘中：'+act.map(b=>{const u=Math.max(G.buffs[b]||0,G.buffs.all||0);return bn[b]+"（剩"+Math.ceil((u-now)/60000)+"分）";}).join('、')+'</div>';
  f.q.forEach(x=>{const r=FGOODS[x.k];
    h+='<div class="shopitem"><span class="e">'+r.emoji+'</span><div class="meta"><b>'+r.name+'</b><div data-factory-end="'+x.end+'">⏳ 加工中…剩 '+Math.max(0,Math.ceil((x.end-now)/1000))+'s</div></div></div>';});
  const gk=Object.keys(G.goods||{}).filter(k=>G.goods[k]>0);
  if(gk.length){h+='<div style="font-size:13px;font-weight:800;margin:8px 0 4px">加工品庫存</div>';
    gk.forEach(k=>{const r=FGOODS[k];if(!r)return;
      h+='<div class="shopitem"><span class="e">'+r.emoji+'</span><div class="meta"><b>'+r.name+'</b> ×'+G.goods[k]+(r.buff?'<div>'+r.buff.desc+'</div>':'')+'</div>'+
        (r.buff?'<button class="pbtn blue" onclick="fUse(\''+k+'\')">使用</button>':'')+
        '<button class="pbtn gold" onclick="fSell(\''+k+'\')">賣 '+Math.round(r.sell*fSellBonus()).toLocaleString()+'</button></div>';});}
  h+='<div style="font-size:13px;font-weight:800;margin:10px 0 4px">配方（原料取自倉庫作物）</div>';
  Object.keys(FGOODS).forEach(k=>{const r=FGOODS[k];const locked=f.lv<r.lv;
    const needTxt=Object.keys(r.need).map(m=>CROPS[m].emoji+r.need[m]+'/'+(G.harvest[m]||0)).join(' ');
    const ok=!locked&&f.q.length<fSlots()&&Object.keys(r.need).every(m=>(G.harvest[m]||0)>=r.need[m]);
    h+='<div class="shopitem"><span class="e">'+r.emoji+'</span><div class="meta"><b>'+r.name+'</b>'+(locked?' <span class="locktag">需工廠 Lv.'+r.lv+'</span>':'')+
      '<div>'+needTxt+'｜'+Math.round(r.time*fSpeed())+'s｜賣 '+r.sell.toLocaleString()+(r.buff?'｜'+r.buff.desc:'')+'</div></div>'+
      '<button class="pbtn gold" onclick="fCraft(\''+k+'\')" '+(ok?'':'disabled')+'>加工</button></div>';});
  h+='<p class="hint">升級需同時滿足金幣與魅力值門檻（魅力不會被扣除）。加工離線也會繼續倒數。</p></div>';
  showM(h);
}

/* ============ 經驗 / 升級 ============ */
function gainXp(n){
  n=n*(1+fXpB());                        // 工廠Lv10：全經驗+10%
  if(buffOn("xp"))n*=1.3;                // 葡萄酒加乘
  n=Math.round(n);
  G.xp+=n;
  while(G.xp>=XP_NEED(G.level)){
    G.xp-=XP_NEED(G.level);G.level++;G.credit+=1;G.charm+=2;
    log("🎉 升級！Lv."+G.level+" 獎勵 💎1 ＋ ❤️2，可種更高級作物、買新農地。","g");
    toast("⭐ 升級 Lv."+G.level+"（+💎1 +❤️2）");
  }
  renderHUD();
}

/* ============================================================
   買地 / 商店 / 倉庫 / 肥料  — 由 happy-farm.html 原樣移植（第 2405–2532 行）
   ============================================================ */
/* ============ 買地 ============ */
function buyLand(i){
  const L=LANDS[i];const p=G.plots[i];if(p.unlocked)return;
  const firstLocked=G.plots.findIndex(x=>!x.unlocked);
  if(i!==firstLocked){toast("請先購買前面的農地");return;}
  if(G.level<L.lvl){toast("需要 Lv."+L.lvl+" 才能購買");return;}
  if(G.gold<L.price){toast("金幣不足");return;}
  G.gold-=L.price;p.unlocked=true;log("購買新農地（<span class=coinico></span>"+L.price+"），農場變大了！","g");render();
}

/* ============ 商店 ============ */
function seedName(k){return (CROPS[k]?CROPS[k].name:"")+"種子";}   // 種子情境顯示名（作物名＋種子）；收成/原料仍用 CROPS[k].name
function lockedShopFold(label,count,cards){
  return count?'<details class="locked-fold"><summary>🔒 '+label+'（'+count+'）</summary><div class="locked-list">'+cards+'</div></details>':'';
}
function openShop(tab){
  tab=tab||"crop";const keys=Object.keys(CROPS);
  const cap=ranchCap();
  const tabsHtml='<div class="tabs">'+
    '<button class="'+(tab==='crop'?'on':'')+'" onclick="openShop(\'crop\')">🌾 農作物</button>'+
    '<button class="'+(tab==='flower'?'on':'')+'" onclick="openShop(\'flower\')">🌸 花卉</button>'+
    '<button class="'+(tab==='fert'?'on':'')+'" onclick="openShop(\'fert\')">🧴 道具/肥料</button>'+
    '<button class="'+(tab==='animal'?'on':'')+'" onclick="openShop(\'animal\')">🐮 動物</button></div>';
  let desc;   // 各分類說明（隨分類凍結在表頭）
  if(tab==="animal"){ const capLeft=Math.max(0,cap-G.ranch.length);
    desc='<div style="font-size:13px;font-weight:800;background:#fff3c4;border:2px solid #f5b733;border-radius:10px;padding:6px 10px;margin:6px 0 0">'+
      '🐾 牧場容量 '+G.ranch.length+'/'+cap+'｜還可購買 <span style="color:#c9920f;font-size:15px">'+capLeft+'</span> 隻'+
      (G.ranch.length>=cap?'　<span class="locktag">已滿，升級增容</span>':'')+'</div>';
  }else if(tab==="fert"){
    desc='<p class="hint"><span class=coinico></span>金幣買一般肥料；💎藍幣買高級肥料與大蟲殺蟲劑。</p>';
  }else{
    desc='<p class="hint">🌱 買種子種到田裡，成長後收成可賣錢或加工。</p>';
  }
  let h='<h2>🛒 商店 <button class="x" onclick="closeM()">×</button></h2><div class="mhead">'+tabsHtml+desc+'</div><div class="body">';
  if(tab==="animal"){
    let animalOpen="",animalLocked="",animalLockedCount=0;
    Object.entries(ANIMALS).forEach(([k,a])=>{
      const locked=G.level<a.lvl;const full=G.ranch.length>=cap;const can=!locked&&!full&&G.gold>=a.cost;
      const card='<div class="shopitem">'+animalIcon(k)+'<div class="meta"><b>'+a.name+'</b>'+
        '<div>每 '+a.time+'s 產 '+a.prod+' ＝ '+CO+a.yield+' ｜ 經驗 '+a.xp+(locked?' ｜ <span class="locktag">需 Lv.'+a.lvl+'</span>':'')+'</div></div>'+
        '<button class="pbtn gold" onclick="buyAnimal(\''+k+'\')" '+(can?'':'disabled')+'>'+CO+a.cost+'</button></div>';
      if(locked){animalLocked+=card;animalLockedCount++;}else animalOpen+=card;
    });
    h+=animalOpen+lockedShopFold("尚未解鎖的動物",animalLockedCount,animalLocked);
    if(G.ranch.length){
      h+='<hr style="margin:12px 0;border:none;border-top:1px solid #eadfca">';
      h+='<div style="font-size:13px;font-weight:800;margin:0 0 6px">我的動物（'+G.ranch.length+'/'+cap+'）</div>';
      G.ranch.forEach((s,i)=>{const a=ANIMALS[s.a];
        h+='<div class="shopitem">'+animalIcon(s.a)+'<div class="meta"><b>'+a.name+'</b>'+
          '<div>'+(s.ready?'✅ 可收成 '+CO+a.yield:'生產中…')+'</div></div>'+
          '<button class="pbtn" style="background:#ffe3e3;border-color:#e98a8a;color:#a23b3b" onclick="sellAnimal('+i+')">售出 '+CO+sellRefund(s.a)+'</button></div>';
      });
    }
    h+='</div>';showM(h);return;
  }
  if(tab==="fert"){
    Object.entries(FERTS).forEach(([k,f])=>{const cur=f.cur==="blue"?"💎":"<span class=coinico></span>";const can=f.cur==="blue"?G.credit>=f.cost:G.gold>=f.cost;
      h+='<div class="shopitem"><span class="e">'+f.emoji+'</span><div class="meta"><b>'+f.name+'</b><div>'+f.desc+'</div></div><button class="pbtn '+(f.cur==="blue"?"blue":"gold")+'" onclick="buyFert(\''+k+'\')" '+(can?'':'disabled')+'>'+cur+f.cost+'</button></div>';});
  }else{
    let cropOpen="",cropLocked="",cropLockedCount=0;
    keys.filter(k=>CROPS[k].type===tab).forEach(k=>{const c=CROPS[k];const cr=c.charmReq||0;const locked=G.level<c.lvl||G.charm<cr;
      let req=[];if(G.level<c.lvl)req.push("Lv."+c.lvl);if(G.charm<cr)req.push("❤️"+cr);
      let btn;
      if(locked){ btn='<button class="pbtn gold" disabled>'+CO+c.cost+'</button>'; }
      else { btn='<div style="display:flex;align-items:center;gap:3px;flex-wrap:wrap;justify-content:flex-end">'+
        '<button class="pbtn" style="padding:5px 8px" onclick="bqStep(\''+k+'\',-1)">−</button>'+
        '<input type="number" id="bq_'+k+'" value="1" min="1" oninput="bqClamp(\''+k+'\')" style="width:42px;padding:5px;border:2px solid #cdbb95;border-radius:8px;text-align:center;font-size:14px">'+
        '<button class="pbtn" style="padding:5px 8px" onclick="bqStep(\''+k+'\',1)">＋</button>'+
        '<button class="pbtn gold" onclick="buySeedQty(\''+k+'\')">買（'+CO+c.cost+'/個）</button></div>'; }
      const card='<div class="shopitem"><span class="e">'+c.emoji+'</span><div class="meta"><b>'+seedName(k)+'</b><div>成長 '+c.grow+'s ｜ 賣價 '+CO+c.sell+' ｜ 經驗 '+c.xp+(c.charm?' ｜ 魅力+'+c.charm:"")+' ｜ 解鎖 Lv.'+c.lvl+(cr?' ❤️'+cr:"")+'</div>'+(req.length?'<span class="locktag">尚需 '+req.join(" + ")+'</span>':"")+'</div>'+btn+'</div>';
      if(locked){cropLocked+=card;cropLockedCount++;}else cropOpen+=card;
    });
    h+=cropOpen+lockedShopFold("尚未解鎖的商品",cropLockedCount,cropLocked);
  }
  h+='</div>';showM(h);
}
function buySeed(k){const c=CROPS[k];if(G.level<c.lvl||G.charm<(c.charmReq||0)||G.gold<c.cost)return;G.gold-=c.cost;G.seeds[k]=(G.seeds[k]||0)+1;toast("買了 "+c.name+" 種子");renderHUD();saveGame();openShop(c.type);}
function bqClamp(k){const el=document.getElementById("bq_"+k);if(!el)return;let n=parseInt(el.value)||1;if(n<1)n=1;el.value=n;}
function bqStep(k,d){const el=document.getElementById("bq_"+k);if(!el)return;let n=(parseInt(el.value)||1)+d;if(n<1)n=1;el.value=n;}
function buySeedQty(k){const c=CROPS[k];if(G.level<c.lvl||G.charm<(c.charmReq||0)){toast("尚未解鎖");return;}const el=document.getElementById("bq_"+k);let n=Math.max(1,parseInt(el&&el.value)||1);const maxAfford=Math.floor(G.gold/c.cost);if(maxAfford<1){toast("金幣不足");return;}if(n>maxAfford){n=maxAfford;toast("金幣只夠買 "+n+" 個");}G.gold-=c.cost*n;G.seeds[k]=(G.seeds[k]||0)+n;toast("買了 "+c.name+" 種子 ×"+n);renderHUD();saveGame();openShop(c.type);}
function buyFert(k){const f=FERTS[k];if(f.cur==="blue"){if(G.credit<f.cost)return;G.credit-=f.cost;}else{if(G.gold<f.cost)return;G.gold-=f.cost;}G.ferts[k]=(G.ferts[k]||0)+1;toast("買了 "+f.name);renderHUD();openShop("fert");}

/* ============ 倉庫 / 種子 ============ */
function openInv(tab){
  tab=tab||"harvest";
  let h='<h2>🏚️ 倉庫 / 種子 <button class="x" onclick="closeM()">×</button></h2><div class="body"><div class="tabs">'+
    '<button class="'+(tab==='harvest'?'on':'')+'" onclick="openInv(\'harvest\')">📦 收成（可賣）</button>'+
    '<button class="'+(tab==='seeds'?'on':'')+'" onclick="openInv(\'seeds\')">🌱 種子</button></div>';
  if(tab==="harvest"){
    const ks=Object.keys(G.harvest).filter(k=>G.harvest[k]>0);
    if(ks.length===0)h+='<p class="hint">倉庫是空的，去收成作物吧。</p>';
    else{ks.forEach(k=>{const c=CROPS[k];const cnt=G.harvest[k];
      h+='<div class="invitem"><span class="e">'+c.emoji+'</span>'+
        '<div class="meta"><b>'+c.name+'</b> ×'+cnt+'<div style="font-size:12px;color:#8d7b6a">單價 '+CO+c.sell+'</div></div>'+
        '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:flex-end">'+
          '<button class="pbtn" style="padding:5px 9px" onclick="sqStep(\''+k+'\',-1)">−</button>'+
          '<input type="number" id="sq_'+k+'" value="1" min="1" max="'+cnt+'" oninput="sqClamp(\''+k+'\')" style="width:48px;padding:5px;border:2px solid #cdbb95;border-radius:8px;text-align:center;font-size:14px">'+
          '<button class="pbtn" style="padding:5px 9px" onclick="sqStep(\''+k+'\',1)">＋</button>'+
          '<button class="pbtn gold" onclick="sellQtyInput(\''+k+'\')">賣出</button>'+
          '<button class="pbtn" onclick="sellAll(\''+k+'\')">全賣</button>'+
        '</div></div>';});
      h+='<button class="bigbtn" onclick="sellEverything()">💰 全部賣掉</button>';}
  }else{
    const ks=Object.keys(G.seeds).filter(k=>G.seeds[k]>0);
    if(ks.length===0)h+='<p class="hint">沒有種子，到商店買。</p>';
    ks.forEach(k=>{const c=CROPS[k];h+='<div class="invitem"><span class="e">'+c.emoji+'</span><div class="meta"><b>'+seedName(k)+'</b> ×'+G.seeds[k]+'</div><button class="pbtn" onclick="selectSeed(\''+k+'\')">選此播種</button></div>';});
    h+='<p class="hint">選好種子後，工具切到 🌱 播種，點翻好的田即可種下。</p>';
  }
  h+='</div>';showM(h);
}
function sqClamp(k){const el=document.getElementById("sq_"+k);if(!el)return;let n=parseInt(el.value)||1;const mx=G.harvest[k]||1;if(n<1)n=1;if(n>mx)n=mx;el.value=n;}
function sqStep(k,d){const el=document.getElementById("sq_"+k);if(!el)return;let n=(parseInt(el.value)||1)+d;const mx=G.harvest[k]||1;if(n<1)n=1;if(n>mx)n=mx;el.value=n;}
function sellQtyInput(k){const el=document.getElementById("sq_"+k);let n=parseInt(el&&el.value)||1;sellQty(k,n);}
function sellMul(){return (buffOn("sell")?1.15:1)*fSellBonus();}   // 辣椒醬加乘 × 工廠全域賣價加成
function sellQty(k,n){if(!G.harvest[k])return;n=Math.max(1,Math.min(n,G.harvest[k]));const v=Math.round(CROPS[k].sell*n*sellMul());G.gold+=v;G.harvest[k]-=n;if(G.harvest[k]<=0)delete G.harvest[k];toast("賣出 "+CROPS[k].name+" ×"+n+"，得 <span class=coinico></span>"+v);renderHUD();saveGame();openInv("harvest");}
function sellOne(k){sellQty(k,1);}
function sellAll(k){if(!G.harvest[k])return;G.gold+=Math.round(CROPS[k].sell*G.harvest[k]*sellMul());delete G.harvest[k];toast("全部賣出！");renderHUD();saveGame();openInv("harvest");}
function sellEverything(){let t=0;Object.keys(G.harvest).forEach(k=>t+=CROPS[k].sell*G.harvest[k]);t=Math.round(t*sellMul());G.gold+=t;G.harvest={};log("倉庫全部賣出，獲得 <span class=coinico></span>"+t,"g");toast("<span class=coinico></span> +"+t);renderHUD();saveGame();openInv("harvest");}
function selectSeed(k){window.__plantSel=k;G.tool="plant";renderTools();toast("已選 "+CROPS[k].name+"，點翻好的田播種");closeM();}

/* ============ 肥料 ============ */
function openFertPick(i){
  let h='<h2>💩 施肥加速 <button class="x" onclick="closeM()">×</button></h2><div class="body">';
  ["f1","f2"].forEach(k=>{const f=FERTS[k];h+='<div class="shopitem"><span class="e">'+f.emoji+'</span><div class="meta"><b>'+f.name+'</b><div>'+f.desc+' ｜ 持有 '+(G.ferts[k]||0)+'</div></div><button class="pbtn" onclick="useFert('+i+',\''+k+'\')" '+((G.ferts[k]||0)>0?'':'disabled')+'>使用</button></div>';});
  h+='<p class="hint">沒有肥料？到 🛒 商店 → 道具/肥料 購買。施肥可縮短成長、也能在被偷前搶收。</p></div>';showM(h);
}
function useFert(i,k){if((G.ferts[k]||0)<=0)return;const p=G.plots[i];if(p.state!=="planted"||p.ripe){closeM();return;}G.ferts[k]--;p.grow+=FERTS[k].cut;const total=CROPS[p.crop].grow;if(p.grow>=total){p.grow=total;p.ripe=true;log("施肥後作物立刻成熟！可馬上收成防被偷 😆","g");}else log("施肥加速 "+FERTS[k].cut+"s");closeM();render();}


/* ============================================================
   好友 / 偷菜  — 由 happy-farm.html 原樣移植（第 2533–2761 行）
   ============================================================ */
/* ============ 好友 / 偷菜 ============ */
/* ====== 真實好友（串接 Firebase users 資料庫） ====== */
function friendReady(){return !!(fbDB&&fbUser);}
function myName(){ return ((fbUser&&fbUser.displayName)||"神秘農友").slice(0,12); }
function farmLabel(){ const n=(G.farmName&&G.farmName.trim())?G.farmName.trim():myName(); return n+"的農場"; }   // 農場顯示名＝名字＋「的農場」
function renameFarm(){ const v=prompt("輸入名字（會自動加上「的農場」；留空恢復登入名字）", G.farmName||""); if(v===null)return; G.farmName=(v||"").trim().slice(0,16); saveGame(); renderHUD(); const m=document.getElementById("mask"); if(m&&m.classList.contains("on"))openProfile(); }
// 由 uid 產生固定的 6 碼好友代碼（同帳號在任何裝置都是同一組）
function codeFromUid(uid,salt){
  let n=2166136261>>>0; const s=uid+"#"+(salt||0);
  for(let i=0;i<s.length;i++){ n^=s.charCodeAt(i); n=Math.imul(n,16777619)>>>0; }
  const a="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let c="";
  for(let i=0;i<6;i++){ c+=a[n%a.length]; n=Math.imul((n>>>5)^0x9e3779b9,2654435761)>>>0; }
  return c;
}
// 登入後建立/更新公開名片 profiles/{uid}，並登記好友代碼 codes/{code} → uid
function ensureProfile(){
  if(!friendReady())return;
  const fin=function(){
    fbDB.ref("profiles/"+fbUser.uid).update({name:myName(),level:G.level||1,code:G.myCode,ts:Date.now()})
      .catch(function(e){log("⚠️ 建立好友名片失敗："+(e&&e.message||e),"r");});
  };
  if(G.myCode){fin();return;}
  const claim=function(salt){
    if(salt>6){log("⚠️ 好友代碼產生失敗，請稍後重開 👑好友 面板再試","r");return;}
    const code=codeFromUid(fbUser.uid,salt);
    fbDB.ref("codes/"+code).once("value").then(function(snap){
      const cur=snap.val();
      if(cur&&cur!==fbUser.uid){claim(salt+1);return;}   // 撞號（機率極低）就換下一組
      return fbDB.ref("codes/"+code).set(fbUser.uid).then(function(){
        G.myCode=code; saveGame(); fin();
        log("👑 你的好友代碼："+code,"b");
        if(document.getElementById("palCode"))openFriends();   // 好友面板開著就即時刷新
      });
    }).catch(function(e){
      log("⚠️ 好友代碼建立失敗："+(e&&e.message||e)+"。請確認 Firebase 資料庫規則允許 codes / profiles 路徑讀寫。","r");
    });
  };
  claim(0);
}
// 載入時把「別人加我」和「我加別人」的共用好友清單合併進 G.pals，達成雙向好友
function loadFriends(){
  if(!friendReady())return;
  fbDB.ref("friends/"+fbUser.uid).once("value").then(function(snap){
    const d=snap.val()||{}; let added=0;
    Object.keys(d).forEach(function(uid){
      if(uid&&uid!==fbUser.uid&&!(G.pals&&G.pals[uid])){
        const r=d[uid]||{}; if(!G.pals)G.pals={}; G.pals[uid]={name:r.name||"農友",lv:r.lv||1}; added++;
      }
    });
    if(added>0){saveGame(); if(document.getElementById("palCode"))openFriends();}
  }).catch(function(){});
}
// 全服自動好友：讀公開名片名冊 profiles/，把每個真實玩家自動加進好友（免代碼）
let allPlayersTs=0;
function loadAllPlayers(){
  if(!friendReady())return;
  fbDB.ref("profiles").once("value").then(function(snap){
    const d=snap.val()||{}; let added=0; if(!G.pals||typeof G.pals!=="object"||Array.isArray(G.pals))G.pals={};
    Object.keys(d).forEach(function(uid){
      if(!uid||uid===fbUser.uid||G.pals[uid])return;
      const p=d[uid]||{}; G.pals[uid]={name:p.name||"農友",lv:p.level||1}; added++;
    });
    if(added>0){saveGame(); if(document.getElementById("palCode"))openFriends();}
  }).catch(function(e){ log("⚠️ 讀取全服玩家名冊失敗（需 Firebase 規則允許讀取 profiles 節點）："+(e&&e.message||e),"r"); });
}
function addPalByCode(){
  const inp=document.getElementById("palCode");
  const code=(inp&&inp.value||"").trim().toUpperCase();
  if(!code){toast("請輸入好友代碼");return;}
  if(!friendReady()){toast("請先登入帳號");return;}
  if(code===G.myCode){toast("這是你自己的代碼 😅");return;}
  fbDB.ref("codes/"+code).once("value").then(function(snap){
    const uid=snap.val();
    if(!uid){alert("找不到這組代碼的玩家，請確認代碼正確（對方需要先登入過遊戲）。");return;}
    if(G.pals[uid]){toast("已經是好友了");openFriends();return;}
    return fbDB.ref("profiles/"+uid).once("value").then(function(ps){
      const pf=ps.val()||{};
      G.pals[uid]={name:pf.name||"農友",lv:pf.level||1};
      saveGame();
      // 雙向好友：寫進共用 friends 節點，對方載入時就會把你也加進好友清單
      try{
        fbDB.ref("friends/"+fbUser.uid+"/"+uid).set({name:G.pals[uid].name,lv:G.pals[uid].lv,ts:Date.now()})
          .catch(function(e){log("⚠️ 好友節點寫入失敗（可能是資料庫規則未含 friends）："+(e&&e.message||e),"r");});
        fbDB.ref("friends/"+uid+"/"+fbUser.uid).set({name:myName(),lv:G.level||1,ts:Date.now()})
          .catch(function(e){log("⚠️ 對方好友節點寫入失敗："+(e&&e.message||e),"r");});
      }catch(e){}
      toast("已加入好友 "+G.pals[uid].name);
      openFriends();
    });
  }).catch(function(e){alert("查詢失敗："+(e&&e.message||e));});
}
function removePal(uid){ if(!confirm("移除這位好友？"))return; delete G.pals[uid];
  if(friendReady()){try{fbDB.ref("friends/"+fbUser.uid+"/"+uid).remove();}catch(e){}}   // 同步刪雲端，否則下次載入又跑回來
  saveGame(); openFriends(); }

let palSyncTs=0;
function openFriends(){
  if(friendReady()&&Date.now()-palSyncTs>15000){palSyncTs=Date.now();loadFriends();loadAllPlayers();}   // 開好友面板時重新同步雲端好友清單＋全服玩家名冊
  let h='<h2>👑 好友名單 <button class="x" onclick="closeM()">×</button></h2><div class="body">';
  if(friendReady()){
    if(!G.myCode)ensureProfile();   // 代碼還沒產生（或之前失敗）就再試一次
    h+='<div style="background:#fff3c4;border:2px solid #f5b733;border-radius:10px;padding:8px 10px;margin-bottom:10px;font-size:13px;font-weight:800">我的好友代碼：<span style="font-size:17px;color:#c9920f;letter-spacing:2px">'+(G.myCode||"產生中…")+'</span><div style="font-weight:400;font-size:12px;color:#8d7b6a">把代碼給朋友，他輸入後就能加你好友、來你的農場。</div></div>'+
      '<div style="display:flex;gap:6px;margin-bottom:12px"><input id="palCode" maxlength="6" placeholder="輸入好友代碼" style="flex:1;min-width:0;border:2px solid #e6dcc8;border-radius:10px;padding:8px 10px;font-size:14px;text-transform:uppercase"><button class="pbtn gold" onclick="addPalByCode()">➕ 加好友</button></div>';
    const uids=Object.keys(G.pals||{});
    h+='<div style="font-size:13px;font-weight:800;margin:0 0 6px">🌍 真實好友（'+uids.length+'）</div>';
    if(!uids.length)h+='<p class="hint">還沒有真實好友。跟朋友交換代碼互加，就能去對方農場偷菜、幫忙照顧！</p>';
    uids.forEach(function(uid){const f=G.pals[uid];
      h+='<div class="friend"><span class="av">🧑‍🌾</span><div class="meta"><b>'+f.name+'</b><div>Lv.'+(f.lv||"?")+'</div></div>'+
        '<button class="pbtn blue" onclick="enterVisitPal(\''+uid+'\')">前往農場</button>'+
        '<button class="pbtn" style="background:#ffe3e3;border-color:#e98a8a;color:#a23b3b" onclick="removePal(\''+uid+'\')">移除</button></div>';
    });
    h+='<hr style="margin:12px 0;border:none;border-top:1px solid #eadfca">';
  }else{
    h+='<p class="hint">尚未登入帳號。登入後可用好友代碼加真實好友，互相拜訪、偷菜、幫忙照顧。以下為電腦好友（練習用）。</p>';
  }
  h+='<div style="font-size:13px;font-weight:800;margin:0 0 6px">🤖 電腦好友（練習）</div>';
  const NPC_LV=[3,5,8,12];
  G.friends.forEach((f,i)=>{const ripe=(f.plots||[]).filter(p=>p&&p.ripe&&(p.stolen||0)<2).length;h+='<div class="friend"><span class="av">'+f.av+'</span><div class="meta"><b>'+f.name+'</b><div>Lv.'+NPC_LV[i%NPC_LV.length]+'｜成熟可偷：'+ripe+' 塊</div></div><button class="pbtn blue" onclick="enterVisitNpc('+i+')">前往農場</button></div>';});
  h+='</div>';showM(h);
}

/* ====== 拜訪好友農場（直接進入遊戲場景；真實好友與電腦好友共用） ====== */
let VISIT={on:false,uid:null,npc:-1,plots:[],name:"",dog:null};
function visitPlotsFromNpc(f){
  const arr=[];
  for(let i=0;i<LANDS.length;i++){
    const np=(f.plots||[])[i];
    if(np&&typeof np==="object")arr.push({unlocked:true,state:np.crop?"planted":"empty",crop:np.crop||null,
      ripe:!!np.ripe,stolen:np.stolen||0,dry:!!np.dry,weed:!!np.weed,bug:np.bug||0,bugBig:!!np.bugBig,
      grow:(np.crop&&!np.ripe&&CROPS[np.crop])?Math.round(CROPS[np.crop].grow*0.6):0,_npc:np});
    else arr.push({unlocked:false,state:"empty",crop:null});
  }
  return arr;
}
function enterVisitNpc(i){
  const f=G.friends[i]; if(!f)return;
  VISIT={on:true,uid:null,npc:i,plots:visitPlotsFromNpc(f),name:f.av+" "+f.name,dog:null};
  startVisit();
}
function enterVisitPal(uid){
  if(!friendReady())return;
  toast("前往好友農場…");
  fbDB.ref("users/"+uid).once("value").then(function(snap){
    const d=snap.val();
    if(!d||!Array.isArray(d.plots)){alert("讀不到好友的農場資料（對方可能還沒上線存檔過）。");return;}
    const f=G.pals[uid]||{name:"農友"};
    VISIT={on:true,uid:uid,npc:-1,name:"🧑‍🌾 "+f.name+"（Lv."+(d.level||1)+"）",dog:d.dog||null,
      plots:d.plots.map(function(p){return (p&&typeof p==="object")?p:{unlocked:false,state:"empty",crop:null};})};
    advancePlotsOffline(VISIT.plots, d.ts);   // 補算到現在，顯示好友作物的即時生長階段
    startVisit();
  }).catch(function(e){alert("讀取失敗："+(e&&e.message||e));});
}
function startVisit(){
  closeM(); setScene("farm");
  const sc=document.getElementById("scene"); if(sc)sc.classList.add("visiting");
  const vn=document.getElementById("visitName"); if(vn)vn.textContent=VISIT.name+" 的農場";
  if(G.tool!=="hand"&&G.tool!=="care")G.tool="hand";
  render(); centerField();
  toast("✋ 偷成熟作物｜🚿 幫忙照顧"+((VISIT.dog&&VISIT.dog.fedUntil&&VISIT.dog.fedUntil>Date.now())?"（⚠️ 小心他的看門狗）":""));
}
function leaveVisit(){
  VISIT={on:false,uid:null,npc:-1,plots:[],name:"",dog:null};
  const sc=document.getElementById("scene"); if(sc)sc.classList.remove("visiting");
  render(); centerField(); toast("回到自己的農場 🏡");
}

/* ====== 拜訪中點田地：✋偷菜 / 🚿照顧 ====== */
function visitTap(i){
  const p=VISIT.plots[i]; if(!p||!p.unlocked)return;
  const care=(G.tool==="care");
  if(!p.crop||(p.state&&p.state!=="planted")){toast("空地");return;}
  if(VISIT.npc>=0){   // 電腦好友：本機模擬
    const np=p._npc||{};
    if(care){
      let n=0;
      if(p.dry){p.dry=false;np.dry=false;n++;}
      if(p.weed){p.weed=false;np.weed=false;n++;}
      if(p.bug){p.bug=0;p.bugBig=false;np.bug=0;n++;}
      if(n){gainXp(n);toast("幫忙照顧 +"+n+" 經驗");}else toast("這塊地不需要照顧");
    }else{
      if(!p.ripe){toast("還沒成熟，不能偷");return;}
      if((p.stolen||0)>=2){toast("這塊已被偷光了");return;}
      if(Math.random()<0.18){const fine=15+Math.floor(Math.random()*30);G.gold=Math.max(0,G.gold-fine);log("你在 "+VISIT.name+" 家偷菜被狗咬了！🐕 掉了 "+CO+fine,"r");toast("被狗咬！掉錢 😱");}
      else{const q=1+Math.floor(Math.random()*3);p.stolen++;np.stolen=(np.stolen||0)+1;const c=CROPS[p.crop];G.harvest[p.crop]=(G.harvest[p.crop]||0)+q;gainXp(2);log("偷到 "+VISIT.name+" 的 "+c.emoji+c.name+" ×"+q+"！😏","b");toast("偷到 "+c.name+" ×"+q);}
    }
    renderHUD();renderGrid();saveGame();
    return;
  }
  // 真實好友：直接寫回對方資料庫
  const plotRef=fbDB.ref("users/"+VISIT.uid+"/plots/"+i);
  if(care){
    let n=0; const up={};
    if(p.dry){p.dry=false;up.dry=false;n++;}
    if(p.weed){p.weed=false;up.weed=false;n++;}
    if(p.bug){p.bug=0;p.bugBig=false;up.bug=0;up.bugBig=false;n++;}
    if(!n){toast("這塊地不需要照顧");return;}
    plotRef.update(up).then(function(){
      gainXp(n);saveGame();
      log("幫 "+VISIT.name+" 照顧田地 🤝 +"+n+" 經驗","g");toast("幫忙照顧 +"+n+" 經驗");
      renderGrid();
    }).catch(function(e){alert("寫入失敗："+(e&&e.message||e));});
  }else{
    if(!p.ripe){toast("還沒成熟，不能偷");return;}
    if((p.stolen||0)>=2){toast("這塊已被偷光了");return;}
    const dog=VISIT.dog;   // 對方存檔裡的真實看門狗
    if(dog&&dog.fedUntil&&dog.fedUntil>Date.now()&&Math.random()<dogBiteChance(dog.level||1)){
      const fine=Math.round((15+Math.random()*30)*(1+((dog.level||1)-1)*0.6));
      G.gold=Math.max(0,G.gold-fine);renderHUD();saveGame();
      fbDB.ref("users/"+VISIT.uid+"/gold").transaction(function(g){return (g||0)+fine;});
      log("你在 "+VISIT.name+" 家偷菜被狗咬了！🐕 掉了 "+CO+fine,"r");toast("被狗咬！掉錢 😱");
      return;
    }
    plotRef.child("stolen").transaction(function(cur){
      cur=cur||0; return cur>=2?undefined:cur+1;
    },function(err,committed,snap){
      if(err){alert("偷菜失敗："+(err.message||err));return;}
      if(!committed){toast("這塊已被偷光了");p.stolen=2;renderGrid();return;}
      p.stolen=snap.val();
      const q=1+Math.floor(Math.random()*2);
      const c=CROPS[p.crop]||{name:"作物",emoji:"🌾"};
      G.harvest[p.crop]=(G.harvest[p.crop]||0)+q;gainXp(2);saveGame();
      log("偷到 "+VISIT.name+" 的 "+c.emoji+c.name+" ×"+q+"！😏","b");toast("偷到 "+c.name+" ×"+q);
      renderGrid();
    });
  }
}

/* 電腦好友與真實好友都改用場景拜訪（enterVisitNpc / enterVisitPal） */


/* ============================================================
   養狗 / 玩法 / 同步面板  — 由 happy-farm.html 原樣移植（第 2762–2846 行）
   ============================================================ */
/* ============ 養狗 ============ */
const DOG_FEED_MS=12*3600*1000; // 餵一次飽 12 小時
function dogFed(){return !!(G.dog && G.dog.fedUntil && G.dog.fedUntil>Date.now());}
function dogFedLeftText(){if(!dogFed())return"";const ms=G.dog.fedUntil-Date.now();const hh=Math.floor(ms/3600000);const mm=Math.floor((ms%3600000)/60000);return hh>0?(hh+" 小時 "+mm+" 分"):(mm+" 分");}
function dogBiteChance(lv){return Math.min(0.55, 0.30+((lv||1)-1)*0.0625);} // Lv1=30%…Lv5=55%（最高5等、最高55%）
function dogUpCost(lv){return 3000*(lv||1);}
function dogBody(){   // 養狗內容（房屋面板分頁用）
  let h='<p class="hint">看門狗會巡守農場，當好友來偷成熟作物時有機率咬住對方，讓對方失手、把偷到的東西掉一部分變成 <span class=coinico></span> 給你。升級可提高咬中機率與掉落金額。狗要餵食才會咬人。</p>';
  if(!G.dog){
    h+='<div class="shopitem"><span class="e">🐶</span><div class="meta"><b>看門狗 Lv.1</b><div>購買後守護你的農場</div></div><button class="pbtn gold" onclick="buyDog(\'gold\')" '+(G.gold>=1500?'':'disabled')+'>'+CO+'1500</button> <button class="pbtn blue" onclick="buyDog(\'blue\')" '+(G.credit>=3?'':'disabled')+'>💎3</button></div>';
  }else{
    const lv=G.dog.level||1; const ch=Math.round(dogBiteChance(lv)*100);
    h+='<div class="shopitem"><span class="e">🐕</span><div class="meta"><b>你的看門狗 Lv.'+lv+'</b><div>咬中機率約 '+ch+'%｜對方掉落金額隨等級提高<br>狀態：'+(dogFed()?("✅ 已餵食，還可守護 "+dogFedLeftText()):"⚠️ 未餵食，無法咬人")+'</div></div><button class="pbtn" onclick="feedDog()">餵食 ('+CO+'300)</button></div>';
    if(lv<5){const cost=dogUpCost(lv);
      h+='<div class="shopitem"><span class="e">⬆️</span><div class="meta"><b>升級到 Lv.'+(lv+1)+'</b><div>咬中機率 '+ch+'% → '+Math.round(dogBiteChance(lv+1)*100)+'%，掉落金額更多</div></div><button class="pbtn gold" onclick="upgradeDog()" '+(G.gold>=cost?'':'disabled')+'>'+CO+cost+'</button></div>';
    }else h+='<p class="hint">看門狗已達最高 Lv.5 🎉</p>';
  }
  return h;
}
function openDog(){ openProfile('dog'); }   // 舊入口導向房屋面板的養狗分頁
function buyDog(cur){if(cur==="gold"){if(G.gold<1500)return;G.gold-=1500;}else{if(G.credit<3)return;G.credit-=3;}G.dog={fedUntil:0,level:1};log("買了一隻看門狗 🐕","g");renderHUD();saveGame();openDog();}
function feedDog(){if(G.gold<300){toast("金幣不足");return;}G.gold-=300;G.dog.fedUntil=Date.now()+DOG_FEED_MS;toast("狗狗吃飽了 🦴 守護 12 小時");renderHUD();saveGame();openDog();}
function upgradeDog(){if(!G.dog)return;const lv=G.dog.level||1;if(lv>=5)return;const cost=dogUpCost(lv);if(G.gold<cost)return;G.gold-=cost;G.dog.level=lv+1;log("看門狗升級到 Lv."+(lv+1)+"！","g");toast("🐕 升級 Lv."+(lv+1));renderHUD();saveGame();openDog();}

/* ============ 玩法 ============ */
function openHelp(){
  showM('<h2>❓ 玩法說明 <button class="x" onclick="closeM()">×</button></h2><div class="body" style="font-size:14px;line-height:1.7">'+
  '<b>基本循環</b><br>🌱 播種（空地直接點即可，免翻土） → 💧 照顧 → 等成熟 → ✋ 收成 → 🏚️ 倉庫賣錢 → ⭐ 升級 → 🛒 買高級種子 / 🪧 購買土地。收成後土地會空出來，可以馬上再種。<br><br>'+
  '<b>作物三階段</b>：種子🌰（前 45%）→ 幼苗🌱（45～100%）→ 成熟結果（顯示作物本體，發光代表可收成）。<br><br>'+
  '<b>照顧</b>：地偶爾會變乾💧、長草🌿、生蟲🐜，會拖慢成長（發生頻率已調低）。選右側 🚿 照顧工具點田地，會自動一次澆水／除草／除蟲。照顧好收成多一顆。大毛毛蟲🐛要噴 5 次，或用💎大蟲殺蟲劑一次解決。成熟作物可用右側 🧺 一鍵收成全部收下。<br><br>'+
  '<b>兩種貨幣</b>：<span class=coinico></span>金幣買大部分；💎藍幣是課金幣。<br><br>'+
  '<b>👑 好友</b>：登入帳號後會有一組 6 碼好友代碼，和朋友交換代碼互加好友，就能前往對方的<b>真實農場</b>：✋偷成熟作物（每塊最多被偷 2 次，小心對方的看門狗）、🚿幫忙澆水/除草/殺蟲賺經驗。沒登入也可以跟🤖電腦好友練習。<br><br>'+
  '<b>養狗</b>：🐕餵一次飽 12 小時，期間會咬偷菜的朋友，你撿掉落的錢。<br><br>'+
  '<b>🐾 牧場</b>：切到「🐮 牧場」分頁看你的動物在草原走動。動物到 🛒 商店 → 🐮 動物 分頁購買（雞🥚、牛🥛、羊🧶、豬🥓、蜜蜂🍯）；產物出現在動物頭上時點一下即可收成換 <span class=coinico></span>。可拖移瀏覽，容量隨等級提升。<br><br>'+
  '<b>肥料</b>：💩加速成長，或被偷前搶先催熟。低階作物衝經驗、高階作物賺錢。<br><br>'+
  '<b>💎 鑽石怎麼來</b>：每次升級 +💎1；每天首次登入 +💎2。鑽石可買高級肥料、大蟲殺蟲劑、看門狗。<br><br>'+
  '<b>❤️ 魅力怎麼來</b>：種花收成（康乃馨 +1、鬱金香 +2）、每次升級 +❤️2、每日登入 +❤️3。<br><br>'+
  '<b>💾 進度與存檔</b>：進度會自動儲存，登入 Google 帳號後同步到雲端，換裝置登入同一帳號即可接續。'+
  '</div>');
}

/* ============ 雲端同步面板 ============ */
function openCloud(){
  let h='<h2>☁️ 雲端同步 <button class="x" onclick="closeM()">×</button></h2><div class="body">';
  if(accountMode()){
    if(fbUser){
      const nm=(fbUser.displayName||fbUser.email||"已登入");
      h+='<p class="hint">✅ 已用帳號登入：<b>'+nm+'</b><br>進度會自動綁定這個帳號並雲端同步，換裝置登入同一個 Google 帳號即可接續。</p>'+
        '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:10px">'+
          '<button class="pbtn gold" onclick="cloudSaveNow()">⬆️ 立即存到雲端</button>'+
          '<button class="pbtn blue" onclick="cloudLoadNow()">⬇️ 從雲端讀取</button>'+
        '</div>'+
        '<p class="hint" style="margin-top:0">「立即存到雲端」會用<b>這台裝置目前的進度</b>覆寫雲端；換裝置前先在進度最新的那台按一下最保險。</p>'+
        '<div style="text-align:center"><button class="pbtn" style="background:#ffe3e3;border-color:#e98a8a" onclick="logoutAccount()">登出</button></div>';
    }else{
      h+='<p class="hint">尚未登入。請先用 Google 登入以綁定並同步進度。</p>'+
        '<div style="text-align:center"><button class="pbtn" onclick="googleLogin()">使用 Google 登入</button></div>';
    }
    h+='</div>';showM(h);return;
  }
  if(!cloudOn()){
    h+='<p class="hint">尚未啟用雲端同步。<br><br>請依一起提供的「<b>雲端同步設定教學</b>」：在 Firebase 免費建立 Realtime Database，把網址貼到本檔最上方的 <code>CLOUD_DB</code>，再放到 GitHub Pages 上線。完成後手機和電腦開同一個網址，就能用代碼跨裝置同步。</p>';
  }else{
    if(syncCode){
      const base=location.href.split("#")[0];
      const link=base+"#farm="+syncCode;
      const qr="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data="+encodeURIComponent(link);
      h+='<p class="hint">在另一台裝置開同一個網址，輸入下面代碼或掃描 QR 即可同步同一個農場，之後會自動雲端存檔。</p>'+
        '<div style="text-align:center"><div style="font-size:30px;font-weight:900;letter-spacing:5px;color:#1565c0">'+syncCode+'</div>'+
        '<img src="'+qr+'" alt="QR" style="margin:10px auto;border:4px solid #fff;border-radius:10px;box-shadow:0 2px 6px #0003;width:180px;height:180px"><br>'+
        '<button class="pbtn blue" onclick="cloudPush(true);toast(\'已上傳目前進度 ☁️\')">⬆️ 立即上傳目前進度</button></div>'+
        '<hr style="margin:14px 0;border:none;border-top:1px solid #eadfca">';
    }else{
      h+='<p class="hint">建立雲端存檔後會得到一組「農場代碼」，在其他裝置輸入即可接續。</p>'+
        '<div style="text-align:center"><button class="pbtn" onclick="cloudCreate()">✨ 建立雲端存檔（產生代碼）</button></div>'+
        '<hr style="margin:14px 0;border:none;border-top:1px solid #eadfca">';
    }
    h+='<div style="text-align:center"><div style="font-size:13px;font-weight:700;margin-bottom:6px">用代碼讀取其他裝置的農場</div>'+
      '<input id="joinCode" maxlength="8" placeholder="輸入代碼" style="text-transform:uppercase;padding:8px 10px;border:2px solid #cdbb95;border-radius:10px;font-size:16px;width:150px;text-align:center;letter-spacing:3px"> '+
      '<button class="pbtn gold" onclick="cloudJoin()">讀取</button>'+
      '<p class="hint" style="margin-top:8px">⚠️ 讀取會用雲端進度覆蓋這台裝置目前的進度。</p></div>';
  }
  h+='</div>';showM(h);
}


/* ============================================================
   熱氣球事件  — 由 happy-farm.html 原樣移植（第 2864–2964 行）
   ============================================================ */
/* ============ 熱氣球隨機事件（機會/命運） ============ */
let balloonTimer=null, balloonActive=false;
function scheduleBalloon(first){
  clearTimeout(balloonTimer);
  const ms=first?(60000+Math.random()*60000):(180000+Math.random()*180000);   // 首次1~2分，之後3~6分
  balloonTimer=setTimeout(spawnBalloon,ms);
}
let balloonEnd=0, balloonInt=0, balloonY0=0, balloonY1=0, balloonStart=0;
const BALLOON_X0=-140, BALLOON_X1=2340, BALLOON_DUR=38000;
function balloonFrame(){
  if(!balloonActive)return;
  const b=document.getElementById("balloon"); if(!b)return;
  const t=Math.min(1,(Date.now()-balloonStart)/BALLOON_DUR);
  const x=BALLOON_X0+(BALLOON_X1-BALLOON_X0)*t;
  const y=balloonY0+(balloonY1-balloonY0)*t + Math.sin(t*Math.PI*2)*8;   // 略帶上下起伏
  b.style.transform="translate("+x.toFixed(1)+"px,"+y.toFixed(1)+"px)";
  if(t>=1){ hideBalloon(); scheduleBalloon(); }
}
function spawnBalloon(){
  const b=document.getElementById("balloon");
  if(!b||balloonActive||VISIT.on||stockOpen||(typeof editOn!=="undefined"&&editOn)){scheduleBalloon();return;}
  balloonActive=true;
  balloonY0=60+Math.random()*200; balloonY1=balloonY0+(Math.random()*60-30);
  b.style.transition="none"; b.classList.add("fly");
  balloonStart=Date.now(); balloonEnd=balloonStart+BALLOON_DUR+800;
  // 用 setInterval 逐幀：繞過 CSS transition（reduced-motion 會被忽略）與 RAF（背景分頁會暫停）兩個坑
  clearInterval(balloonInt); balloonInt=setInterval(balloonFrame,50); balloonFrame();
}
function hideBalloon(){ balloonActive=false; balloonEnd=0;
  clearInterval(balloonInt); balloonInt=0;
  const b=document.getElementById("balloon"); if(b){b.classList.remove("fly");b.style.transform="translate("+BALLOON_X0+"px,0)";} }
const BEVENTS=[   // w=權重；機會共80（8種）、命運共80（9種）＝50:50
  {w:15,f:function(){const v=(50+Math.floor(Math.random()*100))*Math.max(1,Math.floor(G.level/2));G.gold+=v;
    return{e:"🪙",t:"機會",d:"熱氣球灑下金幣雨！<br>獲得 <b>"+v.toLocaleString()+"</b> 金幣"};}},
  {w:8,f:function(){const v=1+(Math.random()<0.2?1:0);G.credit+=v;
    return{e:"💎",t:"機會",d:"空投補給箱！<br>獲得 <b>"+v+"</b> 顆鑽石"};}},
  {w:12,f:function(){let n=0;G.plots.forEach(function(p){if(p.unlocked&&p.state==="planted"&&!p.ripe){p.grow+=30;n++;
      const t=CROPS[p.crop].grow;if(p.grow>=t){p.grow=t;p.ripe=true;}}});
    return{e:"🌱",t:"機會",d:n?("春風拂過農場！<br><b>"+n+"</b> 塊田的作物成長 +30 秒"):"春風拂過農場！<br>可惜現在沒有成長中的作物"};}},
  {w:10,f:function(){const v=3+Math.floor(Math.random()*6);G.charm+=v;
    return{e:"❤️",t:"機會",d:"農場網紅來拍片打卡！<br>魅力 +<b>"+v+"</b>"};}},
  {w:10,f:function(){const ks=Object.keys(CROPS).filter(k=>CROPS[k].type==="crop"&&CROPS[k].lvl<=G.level);
    const k=ks[Math.floor(Math.random()*ks.length)];const n=5+Math.floor(Math.random()*6);
    G.harvest[k]=(G.harvest[k]||0)+n;
    return{e:CROPS[k].emoji,t:"機會",d:"路過的商隊送你<br><b>"+CROPS[k].name+" ×"+n+"</b>"};}},
  {w:8,f:function(){let n=0;if(Array.isArray(G.ranch))G.ranch.forEach(function(s){if(s&&!s.ready){
      s.prod+=ANIMALS[s.a].time*0.5;if(s.prod>=ANIMALS[s.a].time){s.prod=ANIMALS[s.a].time;s.ready=true;}n++;}});
    return{e:"🐮",t:"機會",d:n?("動物們心情大好！<br><b>"+n+"</b> 隻動物生產進度 +50%"):"動物們心情大好！<br>但牧場目前沒有生產中的動物"};}},
  {w:8,f:function(){G.ferts.f1=(G.ferts.f1||0)+2;
    return{e:"💩",t:"機會",d:"撿到熱氣球掉落的包裹：<br><b>普通肥料 ×2</b>"};}},
  {w:9,f:function(){const v=G.level*10;gainXp(v);
    return{e:"⭐",t:"機會",d:"看熱氣球看出了靈感！<br>經驗 +<b>"+v+"</b>"};}},
  {w:11,f:function(){const pl=G.plots.filter(p=>p.unlocked&&p.state==="planted"&&!p.ripe&&!p.bug);
    if(pl.length){pl[Math.floor(Math.random()*pl.length)].bug=1;
      return{e:"🐜",t:"命運",bad:1,d:"熱氣球嚇跑了鳥群，蟲蟲趁虛而入！<br>一塊田生蟲了，快去除蟲"};}
    return{e:"🐜",t:"命運",bad:1,d:"蟲群飛過農場…<br>幸好沒有作物受害"};}},
  {w:11,f:function(){const v=Math.min(G.gold,Math.round(G.gold*0.03)+20);G.gold-=v;
    return{e:"💸",t:"命運",bad:1,d:"熱氣球緊急降落壓壞了圍籬…<br>賠了 <b>"+v.toLocaleString()+"</b> 金幣修理費"};}},
  {w:10,f:function(){const pl=G.plots.filter(p=>p.unlocked&&p.state==="planted"&&!p.ripe&&!p.dry);
    if(pl.length){pl[Math.floor(Math.random()*pl.length)].dry=true;
      return{e:"🌪️",t:"命運",bad:1,d:"熱氣球捲起一陣強風！<br>一塊田變乾旱了，記得澆水"};}
    return{e:"🌪️",t:"命運",bad:1,d:"一陣強風吹過…<br>幸好田地無恙"};}},
  {w:9,f:function(){const pl=G.plots.filter(p=>p.unlocked&&p.state==="planted"&&!p.ripe&&!p.weed);
    if(pl.length){pl[Math.floor(Math.random()*pl.length)].weed=true;
      return{e:"🌿",t:"命運",bad:1,d:"熱氣球撒落一堆野草種子！<br>一塊田長雜草了，快去除草"};}
    return{e:"🌿",t:"命運",bad:1,d:"野草種子隨風飄散…<br>幸好沒落在你的田裡"};}},
  {w:9,f:function(){let n=0;if(Array.isArray(G.ranch))G.ranch.forEach(function(s){if(s&&!s.ready){
      s.prod=Math.max(0,s.prod-ANIMALS[s.a].time*0.4);n++;}});
    return{e:"🐺",t:"命運",bad:1,d:n?("野狼在農場外嚎叫，動物受驚！<br><b>"+n+"</b> 隻動物生產進度倒退 40%"):"遠方傳來野狼嚎叫…<br>牧場暫時無動物受影響"};}},
  {w:9,f:function(){const ks=Object.keys(G.harvest||{}).filter(k=>G.harvest[k]>0);
    if(ks.length){const k=ks[Math.floor(Math.random()*ks.length)];const n=Math.min(G.harvest[k],2+Math.floor(Math.random()*4));
      G.harvest[k]-=n;if(G.harvest[k]<=0)delete G.harvest[k];
      return{e:"🐭",t:"命運",bad:1,d:"倉庫遭老鼠光顧！<br>被偷吃了 <b>"+CROPS[k].name+" ×"+n+"</b>"};}
    return{e:"🐭",t:"命運",bad:1,d:"老鼠溜進倉庫…<br>但倉庫空空如也，摸摸鼻子走了"};}},
  {w:8,f:function(){const v=Math.min(G.credit,1);
    if(v>0){G.credit-=v;return{e:"🎣",t:"命運",bad:1,d:"熱氣球把鑽石鉤走了！<br>損失 <b>"+v+"</b> 顆鑽石"};}
    return{e:"🎣",t:"命運",bad:1,d:"熱氣球想偷鑽石…<br>但你身上沒有，牠白忙一場"};}},
  {w:7,f:function(){const dropped=Math.max(0,(G.charm||0)>0?(2+Math.floor(Math.random()*3)):0);
    G.charm=Math.max(0,G.charm-dropped);
    return{e:"📉",t:"命運",bad:1,d:dropped?("農場傳出負評…<br>魅力 -<b>"+dropped+"</b>"):"有人想黑你的農場…<br>但你人氣本來就低，毫髮無傷 😅"};}},
  {w:6,f:function(){let n=0;G.plots.forEach(function(p){if(p.unlocked&&p.state==="planted"&&!p.ripe){
      p.grow=Math.max(0,p.grow-20);n++;}});
    return{e:"❄️",t:"命運",bad:1,d:n?("突如其來的寒流！<br><b>"+n+"</b> 塊田的作物成長 -20 秒"):"一陣寒流掠過…<br>但沒有成長中的作物受影響"};}}
];
function popBalloon(){
  if(typeof editOn!=="undefined"&&editOn)return;
  if(!balloonActive)return;
  hideBalloon(); scheduleBalloon();
  const tot=BEVENTS.reduce(function(a,x){return a+x.w;},0);
  let r=Math.random()*tot, ev=BEVENTS[0];
  for(let i=0;i<BEVENTS.length;i++){ r-=BEVENTS[i].w; if(r<=0){ev=BEVENTS[i];break;} }
  const res=ev.f();
  log("🎈 "+res.t+"："+res.d.replace(/<[^>]*>/g,""),(res.bad?"r":"g"));
  showM('<h2>🎈 '+(res.bad?"命運":"機會")+' <button class="x" onclick="closeM()">×</button></h2>'+
    '<div class="body" style="text-align:center">'+
    '<div style="font-size:64px;margin:10px 0">'+res.e+'</div>'+
    '<p style="font-size:15px;font-weight:800;line-height:1.8">'+res.d+'</p>'+
    '<button class="pbtn gold" style="padding:10px 28px" onclick="closeM()">確定</button></div>');
  renderHUD(); render(); saveGame();
}


/* ============================================================
   時間循環 / UI helpers  — 由 happy-farm.html 原樣移植（第 2965–3008 行）
   ============================================================ */
/* ============ 時間循環 ============ */
function tick(){
  G.plots.forEach(p=>{
    if(p.unlocked&&p.state==="planted"&&!p.ripe){
      let s=1;if(p.dry)s*=.4;if(p.weed)s*=.6;if(p.bug)s*=.6;s*=(1+fGrowB());if(buffOn("grow"))s*=1.2;p.grow+=s;
      if(p.grow>=CROPS[p.crop].grow){p.grow=CROPS[p.crop].grow;p.ripe=true;log(CROPS[p.crop].emoji+CROPS[p.crop].name+" 成熟了，快收成！","g");}
    }
  });
  // 蟲／草／乾的發生頻率（拉長間隔：原 0.12 → 0.045）
  if(Math.random()<0.045*fHazM()){const pl=G.plots.filter(p=>p.unlocked&&p.state==="planted"&&!p.ripe&&!p.dry&&!p.weed&&!p.bug);if(pl.length){const p=pl[Math.floor(Math.random()*pl.length)];const r=Math.random();if(r<.4)p.dry=true;else if(r<.7)p.weed=true;else{if(Math.random()<.12){p.bug=5;p.bugBig=true;log("出現大毛毛蟲🐛！需噴 5 次","r");}else p.bug=1;}}}
  if(Math.random()<0.35){const rp=G.plots.filter(p=>p.unlocked&&p.state==="planted"&&p.ripe&&p.stolen<2);if(rp.length){const p=rp[Math.floor(Math.random()*rp.length)];const th=G.friends[Math.floor(Math.random()*G.friends.length)];if(dogFed()&&Math.random()<dogBiteChance(G.dog.level)){const lv=G.dog.level||1;const d=Math.round((15+Math.random()*30)*(1+(lv-1)*0.6));G.gold+=d;log("🐕 看門狗(Lv."+lv+")咬住來偷菜的 "+th.name+"，對方失手掉了 <span class=coinico></span>"+d+"！","g");}else{p.stolen++;log(th.av+" "+th.name+" 偷走了你一些 "+CROPS[p.crop].emoji+CROPS[p.crop].name+"…快收成吧！","r");}}}
  if(Math.random()<0.3){const f=G.friends[Math.floor(Math.random()*G.friends.length)];f.plots[Math.floor(Math.random()*f.plots.length)]=makeFriendPlot();}
  // 牧場動物生產
  if(Array.isArray(G.ranch))G.ranch.forEach(s=>{
    if(s&&!s.ready){s.prod+=(1+fAnimB())*(buffOn("animal")?1.2:1);if(s.prod>=ANIMALS[s.a].time){s.prod=ANIMALS[s.a].time;s.ready=true;}}
  });
  // 工廠加工完成
  let factoryDone=false;  if(G.factory&&Array.isArray(G.factory.q)&&G.factory.q.length){
    const nowT=Date.now(); const done=G.factory.q.filter(x=>x.end<=nowT);
    if(done.length){ factoryDone=true; G.factory.q=G.factory.q.filter(x=>x.end>nowT);
      done.forEach(x=>{const r=FGOODS[x.k]; if(!r)return;
        G.goods[x.k]=(G.goods[x.k]||0)+1;
        log("🏭 加工完成 "+r.emoji+r.name+"！","g"); toast("🏭 "+r.name+" 完成");}); } }
  { const mk=document.getElementById("mask");   // 面板「真的開著」（遮罩顯示中）才刷新倒數，避免關閉後又自己跳出
    const fp=document.getElementById("factPanel");    if(fp&&mk&&mk.classList.contains("on")){      if(factoryDone)openFactory();      else fp.querySelectorAll("[data-factory-end]").forEach(el=>{        const end=Number(el.getAttribute("data-factory-end"))||0;        el.textContent="⏳ 加工中…剩 "+Math.max(0,Math.ceil((end-Date.now())/1000))+"s";      });    } }
  // 熱氣球逾時保險：任何原因卡住（分頁休眠、動畫沒觸發）超過預定時間就強制回收並重新排程
  if(balloonActive&&balloonEnd&&Date.now()>balloonEnd+2000){ hideBalloon(); scheduleBalloon(); }
  stockTick();   // 股價波動＋限價單撮合
  render();
  saveGame();
}

/* ============ UI helpers ============ */
function showM(h){  const oldFact=document.getElementById("factPanel"), oldFactScroll=oldFact?oldFact.scrollTop:0;  document.getElementById("modal").innerHTML=h;document.getElementById("mask").classList.add("on");  const newFact=document.getElementById("factPanel");if(newFact)newFact.scrollTop=oldFactScroll;}
function closeM(){document.getElementById("mask").classList.remove("on");}
document.getElementById("mask").addEventListener("click",e=>{if(e.target.id==="mask")closeM();});
function toggleLog(){document.getElementById("logPanel").classList.toggle("on");}
function toggleLeftbar(){const lb=document.getElementById("leftbar");if(lb)lb.classList.toggle("open");}
function closeLeftbar(){const lb=document.getElementById("leftbar");if(lb)lb.classList.remove("open");}
let logCount=0;
function log(t,cls){const p=document.createElement("p");if(cls)p.innerHTML='<span class="'+cls+'">'+t+'</span>';else p.innerHTML=t;const l=document.getElementById("logList");l.prepend(p);logCount++;if(logCount>60&&l.lastChild)l.removeChild(l.lastChild);}
let toastT;
function toast(t){const el=document.getElementById("toast");el.innerHTML=t;el.classList.add("on");clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove("on"),1400);}



/* ============================================================
   牧場容量與動物買賣 —— 由 happy-farm.html 補搬（原本混在渲染區段中）
   ============================================================ */
function ranchCap(){return Math.min(8, 2+Math.floor(G.level/3));}
function sellRefund(k){return Math.floor(ANIMALS[k].cost*0.5);}
function animalIcon(k){const img=ANIMAL_IMG[k];return img?'<span class="e"><img src="'+img.b+'" style="height:34px;width:auto;vertical-align:middle"></span>':'<span class="e">'+ANIMALS[k].emoji+'</span>';}
function openRanch(){ openShop('animal'); }   // 牧場管理已整合進商店的「動物」分頁
function buyAnimal(k){
  const a=ANIMALS[k];const cap=ranchCap();
  if(G.level<a.lvl||G.gold<a.cost||G.ranch.length>=cap)return;
  G.gold-=a.cost;G.ranch.push({a:k,prod:0,ready:false,x:null,y:null});
  log("買了 "+a.emoji+a.name+" 放進牧場 🐾","g");toast("歡迎 "+a.emoji+a.name);
  renderHUD();renderPen();saveGame();openShop('animal');
}
function sellAnimal(i){
  const s=G.ranch[i];if(!s)return;const a=ANIMALS[s.a];const refund=sellRefund(s.a);
  G.ranch.splice(i,1);G.gold+=refund;
  clearPen();renderPen();renderHUD();saveGame();
  log("售出 "+a.emoji+a.name+"，回收 <span class=coinico></span>"+refund,"g");toast("售出 +<span class=coinico></span>"+refund);
  openShop('animal');
}
function renderHUD(){
  document.getElementById("goldChip").innerHTML='<span class=coinico></span> '+G.gold;
  document.getElementById("creditChip").textContent="💎 "+G.credit;
  document.getElementById("charmChip").textContent="❤️ "+G.charm;
  document.getElementById("lvBadge").textContent=G.level;
  const need=XP_NEED(G.level);
  document.getElementById("xpFill").style.width=Math.min(100,G.xp/need*100)+"%";
  document.getElementById("xpText").textContent=G.xp+"/"+need;
  const fn=document.getElementById("farmName"); if(fn)fn.textContent=farmLabel();   // 農場名：自訂優先，否則名字+的農場
  checkAch();   // 順便檢查是否有新成就達成
}
