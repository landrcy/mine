'use strict';
// ---------- core constants ----------
const TILE = 12, COLS = 32, ROWS = 280, SKY = 10; // SKY = tiles of air above ground
const SHAFT = 5, DEPOT = 2;                        // shaft column, depot column
const M_PER_ROW = 2;                               // meters per tile row

// ---------- seeded rng ----------
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hash2(x,y,s){let h=(x*374761393+y*668265263+(s||0)*1442695041)|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967296;}

// ---------- strata (top = first row, h = hardness) ----------
const STRATA = [
  {id:'topsoil', name:'TOPSOIL',    top:0,   h:1, pal:['#1b120c','#2e1f14','#45301d','#5e4329'], f:'soil'},
  {id:'clay',    name:'CLAY',       top:8,   h:1, pal:['#311a12','#4f2a1b','#6f3d26','#8f5333'], f:'clay'},
  {id:'sand',    name:'SANDSTONE',  top:28,  h:2, pal:['#3d2817','#62432a','#8a623c','#ad8352'], f:'bed'},
  {id:'lime',    name:'LIMESTONE',  top:53,  h:2, pal:['#3a3a35','#5c5a50','#82806f','#a6a28c'], f:'lime'},
  {id:'shale',   name:'SHALE',      top:83,  h:3, pal:['#15171c','#23272f','#343a44','#4a525e'], f:'shale'},
  {id:'granite', name:'GRANITE',    top:113, h:4, pal:['#2f2526','#4b3c3c','#6c5856','#8f7a74'], f:'granite'},
  {id:'basalt',  name:'BASALT',     top:148, h:5, pal:['#0f1012','#1b1c20','#292b31','#3a3d45'], f:'basalt'},
  {id:'magma',   name:'MAGMA ROCK', top:188, h:6, pal:['#120706','#22100c','#361912','#4a2418'], f:'magma'},
  {id:'rift',    name:'THE RIFT',   top:240, h:7, pal:['#07040c','#120a1e','#1e1230','#2c1c46'], f:'rift'},
];
const HARD_TIME = [0, 0.6, 1.25, 2.0, 3.0, 4.4, 6.4, 9.0]; // seconds per tile at drill power 1

// ---------- finds (ores + relics) ----------
// col = [dark, mid, light, highlight]
const FINDS = [
  {id:'coal',     name:'COAL',      val:4,    top:1,   bot:70,  n:34, len:[3,8], col:['#0a0a0d','#22222a','#3e3e4a','#8a8a9c']},
  {id:'copper',   name:'COPPER',    val:9,    top:8,   bot:95,  n:26, len:[3,7], col:['#4a2410','#8a4a20','#c4733a','#f2b884']},
  {id:'iron',     name:'IRON',      val:16,   top:26,  bot:135, n:24, len:[3,7], col:['#3a1a16','#6c3326','#a05a44','#d6a08c']},
  {id:'silver',   name:'SILVER',    val:34,   top:55,  bot:165, n:18, len:[2,6], col:['#3a4250','#76839a','#b8c4d4','#f6f9ff']},
  {id:'gold',     name:'GOLD',      val:70,   top:85,  bot:205, n:15, len:[2,5], col:['#5a3a06','#a06e0e','#e2b128','#fff1a6']},
  {id:'gem',      name:'SAPPHIRE',  val:150,  top:115, bot:245, n:13, len:[1,4], col:['#0a1450','#1b38a2','#3b78e6','#bfe6ff']},
  {id:'ember',    name:'EMBERITE',  val:320,  top:150, bot:260, n:12, len:[2,5], col:['#4a0c00','#b03000','#ff7a10','#ffe68a'], glow:1, fict:1},
  {id:'void',     name:'VOIDGLASS', val:720,  top:190, bot:279, n:12, len:[1,4], col:['#14001e','#3c0a5c','#8f2fd6','#eab0ff'], glow:1, fict:1},
  {id:'aether',   name:'AETHERIUM', val:1600, top:220, bot:279, n:10, len:[1,4], col:['#002e2c','#007f78','#2fe2c8','#e4fff9'], glow:1, fict:1},
  {id:'chronite', name:'CHRONITE',  val:4200, top:248, bot:279, n:8,  len:[1,3], col:['#1d2a08','#5a8a1e','#b8f040','#fbffd6'], glow:1, fict:1},
  {id:'fossil',   name:'FOSSIL',    val:60,   top:28,  bot:112, n:0,  relic:1, chance:0.012, col:['#3a3226','#7a6c54','#bfae8a','#efe4c8']},
  {id:'gear',     name:'LOST GEAR', val:400,  top:113, bot:279, n:0,  relic:1, chance:0.007, col:['#1c1a16','#4a443a','#857a64','#d2c4a0']},
];

// ---------- rarity (odds are computed by rarityOdds, the same function the game rolls with) ----------
const RAR = [
  {n:'COMMON',      c:'#b8b2a4', m:1,    b:1,       g:0},
  {n:'UNCOMMON',    c:'#5fd068', m:2,    b:0.25,    g:0.6},
  {n:'RARE',        c:'#3f8cff', m:4,    b:0.07,    g:1.1},
  {n:'EPIC',        c:'#b34dff', m:10,   b:0.015,   g:1.6},
  {n:'LEGENDARY',   c:'#ffb31a', m:30,   b:0.003,   g:2.1},
  {n:'MYTHIC',      c:'#ff3b3b', m:120,  b:0.0004,  g:2.6},
  {n:'SINGULARITY', c:'#5ff6ff', m:1000, b:0.00002, g:3.0, secret:1},
];
function rarityOdds(row, luck){
  const d = Math.max(0,row)/ROWS*2.2;
  const w = RAR.map(r => r.b*Math.exp(r.g*(d+luck)));
  const s = w.reduce((a,b)=>a+b,0);
  return w.map(x=>x/s);
}
function rollRarity(row, luck, rnd){
  const o = rarityOdds(row, luck); let r = rnd(), i = 0;
  for(; i<o.length-1; i++){ if(r < o[i]) return i; r -= o[i]; }
  return i;
}

// ---------- robot tiers (the transformations) ----------
const TIERS = [
  {n:'RUST DIGGER',       d:'Rusty tread digger. Patched plates, one lamp.',            dig:2, spd:1,   mv:1.0,  cost:0},
  {n:'HYDRAULIC DRILLER', d:'Armored hull, piston-driven spiral drill.',               dig:3, spd:1.8, mv:1.15, cost:600},
  {n:'LASER CUTTER',      d:'Four legs, three arms, cutting lasers.',                   dig:4, spd:3,   mv:1.35, cost:6000},
  {n:'PLASMA BORER',      d:'Hovers on thrusters, melts rock with a plasma lance.',     dig:5, spd:5,   mv:1.6,  cost:30000},
  {n:'EXCAVATOR TITAN',   d:'A walking bucket-wheel excavator too big for its tunnels.',dig:6, spd:8.5, mv:1.8,  cost:200000},
  {n:'VOID DRILL',        d:'Tears holes in reality. Rock just stops existing.',        dig:7, spd:15,  mv:2.2,  cost:1200000},
];
const ROMAN = ['I','II','III','IV','V','VI'];

// per-robot upgrades
const RUPG = {
  drill:   {n:'DRILL',   max:12, cost:L=>Math.round(25*Math.pow(1.6,L)),  fx:L=>'x'+(1+0.3*L).toFixed(1)+' speed'},
  hopper:  {n:'HOPPER',  max:10, cost:L=>Math.round(40*Math.pow(1.7,L)),  fx:L=>(4+2*L)+' cargo'},
  battery: {n:'BATTERY', max:10, cost:L=>Math.round(30*Math.pow(1.6,L)),  fx:L=>(45+20*L)+'s charge'},
  lamp:    {n:'LAMP',    max:6,  cost:L=>Math.round(35*Math.pow(1.8,L)),  fx:L=>(30+7*L)+'px light'},
};
// robot build quality rolls a rarity too (luck applies), giving a stat multiplier
const BUILD_MULT = [1, 1.1, 1.2, 1.35, 1.5, 1.75, 2.2];
function robotCost(n){ return Math.round(60*Math.pow(2.4, n-1)); }

// player-wide (global) upgrades
const GUPG = {
  bay:      {n:'ROBOT BAY',   max:8,  cost:L=>Math.round(150*Math.pow(3,L)),   d:L=>(2+L)+' robot slots'},
  luck:     {n:'LUCK',        max:15, cost:L=>Math.round(200*Math.pow(2.2,L)), d:L=>'+'+(0.1*L).toFixed(1)+' luck'},
  market:   {n:'MARKET',      max:20, cost:L=>Math.round(120*Math.pow(2,L)),   d:L=>'x'+(1+0.12*L).toFixed(2)+' sell price'},
  lift:     {n:'LIFT',        max:8,  cost:L=>Math.round(100*Math.pow(1.9,L)), d:L=>'x'+(1+0.6*L).toFixed(1)+' shaft speed'},
  refinery: {n:'REFINERY',    max:10, cost:L=>Math.round(500*Math.pow(2.3,L)), d:L=>'+'+(20*L)+'% ore value'},
  auto:     {n:'AUTO-DIG AI', max:3,  cost:L=>[400,5000,60000][L],             d:L=>['off','mines nearby ore','also sinks new shafts','long-range prospecting'][L]},
  scanner:  {n:'DEEP SCANNER',max:3,  cost:L=>[250,4000,50000][L],             d:L=>['off','shows ore near your tunnels','shows all ore','marks rich deposits'][L]},
  lights:   {n:'TUNNEL LIGHTS',max:3, cost:L=>[150,2500,30000][L],             d:L=>['off','lamps every 8 tiles','lamps every 5 tiles','lamps every 3 tiles'][L]},
};

function fmt(n){
  n = Math.floor(n);
  if(n < 10000) return '$'+n;
  const u=['K','M','B','T','Q']; let i=-1;
  while(n>=1000 && i<u.length-1){n/=1000;i++;}
  return '$'+(n<100?n.toFixed(1):Math.floor(n))+u[i];
}
