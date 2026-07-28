/* ============ 資料設定 ============ */
const CROPS = {
  radish:   {name:"蘿蔔",   emoji:"🥕", grown:"🥕", type:"crop",  lvl:1, charmReq:0,  cost:10,  sell:20,  grow:24, xp:6},
  cucumber: {name:"小黃瓜", emoji:"🥒", grown:"🥒", type:"crop",  lvl:1, charmReq:0,  cost:16,  sell:32,  grow:34, xp:8},
  tomato:   {name:"番茄",   emoji:"🍅", grown:"🍅", type:"crop",  lvl:2, charmReq:3,  cost:28,  sell:55,  grow:44, xp:11},
  corn:     {name:"玉米",   emoji:"🌽", grown:"🌽", type:"crop",  lvl:3, charmReq:8,  cost:45,  sell:92,  grow:56, xp:15},
  eggplant: {name:"茄子",   emoji:"🍆", grown:"🍆", type:"crop",  lvl:4, charmReq:15, cost:70,  sell:150, grow:70, xp:20},
  strawberry:{name:"草莓",  emoji:"🍓", grown:"🍓", type:"crop",  lvl:5, charmReq:25, cost:110, sell:240, grow:86, xp:28},
  chili:    {name:"辣椒",   emoji:"🌶️", grown:"🌶️", type:"crop",  lvl:6, charmReq:30, cost:140, sell:310, grow:96, xp:34},
  pumpkin:  {name:"南瓜",   emoji:"🎃", grown:"🎃", type:"crop",  lvl:7, charmReq:40, cost:180, sell:420, grow:108,xp:42},
  watermelon:{name:"西瓜",  emoji:"🍉", grown:"🍉", type:"crop",  lvl:8, charmReq:50, cost:230, sell:550, grow:120,xp:50},
  grape:    {name:"葡萄",   emoji:"🍇", grown:"🍇", type:"crop",  lvl:9, charmReq:60, cost:300, sell:720, grow:132,xp:60},
  pineapple:{name:"鳳梨",   emoji:"🍍", grown:"🍍", type:"crop",  lvl:11,charmReq:75, cost:420, sell:1050,grow:150,xp:78},
  melon:    {name:"哈密瓜", emoji:"🍈", grown:"🍈", type:"crop",  lvl:13,charmReq:95, cost:600, sell:1600,grow:170,xp:100},
  peach:    {name:"水蜜桃", emoji:"🍑", grown:"🍑", type:"crop",  lvl:15,charmReq:120,cost:850, sell:2400,grow:190,xp:128},
  avocado:  {name:"酪梨",   emoji:"🥑", grown:"🥑", type:"crop",  lvl:18,charmReq:150,cost:1200,sell:3600,grow:215,xp:165},
  carnation:{name:"康乃馨", emoji:"🌸", grown:"🌸", type:"flower",lvl:2, charmReq:0,  cost:40,  sell:70,  grow:52, xp:14, charm:1},
  tulip:    {name:"鬱金香", emoji:"🌷", grown:"🌷", type:"flower",lvl:4, charmReq:2,  cost:90,  sell:170, grow:74, xp:24, charm:2},
  sunflower:{name:"向日葵", emoji:"🌻", grown:"🌻", type:"flower",lvl:6, charmReq:5,  cost:160, sell:300, grow:92, xp:32, charm:3},
  rose:     {name:"玫瑰",   emoji:"🌹", grown:"🌹", type:"flower",lvl:9, charmReq:10, cost:280, sell:540, grow:115,xp:48, charm:4},
  hibiscus: {name:"扶桑花", emoji:"🌺", grown:"🌺", type:"flower",lvl:12,charmReq:20, cost:450, sell:900, grow:140,xp:70, charm:6},
  lotus:    {name:"蓮花",   emoji:"🏵️", grown:"🏵️", type:"flower",lvl:16,charmReq:35, cost:750, sell:1550,grow:170,xp:100,charm:8},
};
/* 三階段生長：種子(0～45%) → 幼苗(45～100%) → 成熟可收成。STAGE 對應前兩個階段的外觀 */
const STAGE = ["🌰","🌱"];
/* 6×3 = 18 塊地：前 6 塊免費開通，其餘 12 塊依等級/金幣解鎖 */
const LANDS = [
  {price:0,lvl:1},{price:0,lvl:1},{price:0,lvl:1},{price:0,lvl:1},{price:0,lvl:1},{price:0,lvl:1},
  {price:10000,lvl:5},{price:20000,lvl:7},{price:30000,lvl:9},{price:50000,lvl:11},{price:80000,lvl:13},{price:120000,lvl:15},
  {price:160000,lvl:17},{price:200000,lvl:19},{price:260000,lvl:21},
  {price:320000,lvl:23},{price:400000,lvl:25},{price:500000,lvl:27}
];
const ANIMALS = {
  chick:{name:"小雞", emoji:"🐔", prod:"🥚", cost:200,  time:20, yield:48,  xp:4,  lvl:1},
  cow:  {name:"乳牛", emoji:"🐄", prod:"🥛", cost:800,  time:35, yield:135, xp:10, lvl:3},
  sheep:{name:"綿羊", emoji:"🐑", prod:"🧶", cost:1600, time:50, yield:270, xp:16, lvl:5},
  pig:  {name:"小豬", emoji:"🐖", prod:"🥓", cost:3200, time:65, yield:440, xp:24, lvl:8},
  bee:  {name:"蜜蜂", emoji:"🐝", prod:"🍯", cost:6000, time:80, yield:780, xp:36, lvl:11},
};
const RANCH_REQ=[1,1,3,5,8,11]; // 每個牧場欄位的解鎖等級
// 動物圖像（內嵌 data URI，由使用者提供的圖檔縮圖而成）＋ 顯示高度(px)
const ANIMAL_IMG={chick:{b:"animal/chicken.png"},cow:{b:"animal/cow.png"},sheep:{b:"animal/sheep.png"},pig:{b:"animal/pig.png"},bee:{b:"animal/bee.png"}};/*__ANIMALIMG__*/
const AN_SIZE={chick:93, cow:120, sheep:114, pig:90, bee:75};   /* 全部動物放大 1.5 倍（原 62/80/76/60/50） */

// 每日登入獎勵（7 天循環，第 7 天大獎）。g=金幣 c=鑽石 h=魅力 s=種子
const DAILY_REWARDS=[
  {g:300, s:{radish:3}},
  {g:500, s:{cucumber:2}},
  {g:800, c:1},
  {g:1200, s:{tomato:3}},
  {g:2000, c:2, h:3},
  {g:3000, h:5, s:{corn:2}},
  {g:6000, c:5, h:10, s:{strawberry:3}}
];
// ===== 農青哥拉霸（5×4 盤面、50 線、FREE GAME）=====
// w=權重；pay={連線數:賠率}，中獎彩金 = 押注額 × 賠率（多線可同中加總）
const SL_SYMS=[
  {k:"wild",s:"🍃",cls:"fWild",w:4.5, pay:{3:1,4:2,5:4},   name:"荷葉(WILD)"},
  {k:"scat",s:"✨",cls:"fScat",w:5.75,pay:null,            name:"螢火蟲(SCATTER)"},
  {k:"rf",  s:"🐸",cls:"fRed", w:5,   pay:{3:1,4:2,5:4},   name:"紅色青蛙"},
  {k:"yf",  s:"🐸",cls:"fYel", w:7,   pay:{3:.5,4:1,5:2},  name:"黃色青蛙"},
  {k:"bf",  s:"🐸",cls:"fBlu", w:7,   pay:{3:.5,4:1,5:2},  name:"藍色青蛙"},
  {k:"lo",  s:"🌺",cls:"",     w:11,  pay:{3:.2,4:.4,5:.8},name:"荷花"},
  {k:"ca",  s:"🌼",cls:"",     w:11,  pay:{3:.2,4:.4,5:.8},name:"馬蹄蓮"},
  {k:"na",  s:"🌸",cls:"",     w:11,  pay:{3:.2,4:.4,5:.8},name:"水仙"},
  {k:"sp",  s:"♠",cls:"suS",  w:10.5,pay:{3:.1,4:.2,5:.4},name:"黑桃"},
  {k:"he",  s:"♥",cls:"suH",  w:10.5,pay:{3:.1,4:.2,5:.4},name:"紅心"},
  {k:"di",  s:"♦",cls:"suD",  w:10.5,pay:{3:.1,4:.2,5:.4},name:"方塊"},
  {k:"cl",  s:"♣",cls:"suC",  w:8.5, pay:{3:.1,4:.2,5:.4},name:"梅花"}
];
// 50 條連線：每條 = 5 欄各取的列(0~3)，格子索引 = 列*5+欄
const SL_LINES=[
 [0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[3,3,3,3,3],
 [0,1,2,1,0],[3,2,1,2,3],[1,0,1,0,1],[2,3,2,3,2],
 [0,1,0,1,0],[3,2,3,2,3],[1,2,1,2,1],[2,1,2,1,2],
 [0,0,1,0,0],[3,3,2,3,3],[1,1,0,1,1],[2,2,3,2,2],
 [0,1,1,1,0],[3,2,2,2,3],[1,0,0,0,1],[2,3,3,3,2],
 [0,2,0,2,0],[3,1,3,1,3],[1,3,1,3,1],[2,0,2,0,2],
 [0,1,2,3,3],[3,2,1,0,0],[0,0,1,2,3],[3,3,2,1,0],
 [1,2,3,2,1],[2,1,0,1,2],[0,2,2,2,0],[3,1,1,1,3],
 [1,1,2,1,1],[2,2,1,2,2],[0,3,0,3,0],[3,0,3,0,3],
 [1,2,2,2,1],[2,1,1,1,2],[0,0,2,0,0],[3,3,1,3,3],
 [1,0,1,2,1],[2,3,2,1,2],[0,1,3,1,0],[3,2,0,2,3],
 [1,1,3,1,1],[2,2,0,2,2],[0,3,3,3,0],[3,0,0,0,3],
 [1,3,3,3,1],[2,0,0,0,2]
];
const SL_BETS=[50,100,500,1000];   // 可調押注檔位
const SL_FS_AWARD=10;              // SCATTER ×3+ 送 10 局
const SL_WILD_DROP=0.14;           // 免費局灑 WILD 機率(模擬 80 萬轉:觸發率≈10%、總RTP≈97%)
// 股市：真實標的（皆為美股/台股ADR——TradingView 免費嵌入不含 TWSE 授權，改用 ADR 圖表報價都完整；y = Yahoo 報價代碼）
const STOCKS=[
  // 台股權值股（Yahoo .TW 報價，價位為台幣）
  {t:"2330", n:"農積電",    base:1050, y:"2330.TW"},
  {t:"2317", n:"農海",      base:165,  y:"2317.TW"},
  {t:"2454", n:"農發科",    base:1300, y:"2454.TW"},
  {t:"2308", n:"農達電",    base:400,  y:"2308.TW"},
  {t:"2382", n:"農達",      base:280,  y:"2382.TW"},
  {t:"2881", n:"農邦金",    base:88,   y:"2881.TW"},
  {t:"2882", n:"農泰金",    base:64,   y:"2882.TW"},
  {t:"2412", n:"農華電",    base:123,  y:"2412.TW"},
  {t:"2891", n:"農信金",    base:42,   y:"2891.TW"},
  {t:"3711", n:"農月光投控", base:150, y:"3711.TW"},
  // 台股低價熱門標的
  {t:"9105", n:"農金寶-DR", base:13, y:"9105.TW"},
  {t:"3481", n:"農創",     base:14, y:"3481.TW"},
  {t:"2409", n:"農達光",   base:16, y:"2409.TW"},
  {t:"2610", n:"農航",     base:22, y:"2610.TW"},
  {t:"2002", n:"農鋼",     base:21, y:"2002.TW"}
];
// 已下架標的（舊 ADR/美股與更早的代號）：讀檔時以最後價格結算持倉返還金幣
const STOCK_DELIST=["TSM","UMC","ASX","CHT","NVDA","AAPL","GOOGL","MSFT","TSLA","AMZN","NTSMC","NFAK","NHAI","TNPC","NAPL","NOOG","NSFT","NSLA","NMZN"];
function stockName(t){const s=STOCKS.find(x=>x.t===t);return s?s.n:t;}
const FERTS = {
  f1:{name:"普通肥料",emoji:"💩",cost:120,cut:8,cur:"gold",desc:"加速成長 8 秒"},
  f2:{name:"高級肥料",emoji:"✨",cost:3,cut:20,cur:"blue",desc:"加速成長 20 秒（藍幣）"},
  bigspray:{name:"大蟲殺蟲劑",emoji:"🧴",cost:5,cur:"blue",desc:"一次清除大毛毛蟲（藍幣）"},
};
const FRIEND_NAMES=[["阿明","🧑‍🌾"],["小美","👩‍🌾"],["大雄","👨‍🌾"],["May","💁‍♀️"]];

/* 跨平台一致的金幣圖示（用於彈窗 innerHTML；iOS 的 <span class=coinico></span> 會變銀色） */
const CO='<span class=coinico></span>';
/* ============ 遊戲狀態 ============ */
let G = {
  gold:200, credit:5, level:1, xp:0, charm:0,
  tool:"hand",
  seeds:{radish:3}, harvest:{}, plots:[], dog:null,
  ferts:{f1:0,f2:0,bigspray:0}, friends:[], pals:{}, myCode:"",
};
const XP_NEED = lv => 50 + (lv-1)*70;
function newPlot(unlocked){return {unlocked:unlocked,state:"empty",crop:null,grow:0,stolen:0,
  dry:false,weed:false,bug:0,bugBig:false,ripe:false};}
