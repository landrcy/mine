'use strict';
// ================= WORLD =================
const W = { strat:new Uint8Array(COLS*ROWS), ore:new Uint8Array(COLS*ROWS), rich:new Uint8Array(COLS*ROWS), deco:new Uint8Array(COLS*ROWS), edge:[] };
const I = (x,y)=>y*COLS+x;
function stratAt(x,y){ // also used outside the claim for rendering
  if(y<0) return 0; if(y>=ROWS) return STRATA.length-1;
  const cx=Math.max(0,Math.min(COLS-1,x)); return W.strat[I(cx,y)];
}
function genWorld(seed){
  const r=mulberry32(seed);
  W.strat.fill(0); W.ore.fill(0); W.rich.fill(0); W.deco.fill(0);
  const offs=STRATA.map(()=>{const o=[];let v=0;for(let x=0;x<COLS;x++){ if(r()<0.45) v+=r()<0.5?-1:1; v=Math.max(-3,Math.min(3,v)); o.push(v);} return o;});
  for(let x=0;x<COLS;x++)for(let y=0;y<ROWS;y++){
    let s=0; for(let i=1;i<STRATA.length;i++) if(y>=STRATA[i].top+offs[i][x]) s=i; W.strat[I(x,y)]=s; }
  FINDS.forEach((f,fi)=>{
    if(f.relic) return;
    for(let v=0;v<f.n;v++){
      let x=Math.floor(r()*COLS), y=Math.floor(f.top+r()*(f.bot-f.top));
      const L=f.len[0]+Math.floor(r()*(f.len[1]-f.len[0]+1)); const rich=r()<0.12;
      for(let k=0;k<L;k++){
        if(x>=0&&x<COLS&&y>=1&&y<ROWS&&x!==SHAFT){ W.ore[I(x,y)]=fi+1; if(rich) W.rich[I(x,y)]=1; }
        if(r()<0.6) x+=r()<0.5?-1:1; else y+=r()<0.5?-1:1;
      }
    }
  });
  FINDS.forEach((f,fi)=>{ if(!f.relic) return;
    for(let y=f.top;y<=Math.min(f.bot,ROWS-1);y++)for(let x=0;x<COLS;x++) if(!W.ore[I(x,y)]&&r()<f.chance) W.ore[I(x,y)]=fi+1; });
  // starter coal right next to the shaft so the first trip pays fast
  [[6,1],[7,1],[6,2],[7,2],[8,2],[3,2],[4,2],[4,3],[7,3],[8,3]].forEach(([x,y])=>W.ore[I(x,y)]=1);
  for(let y=0;y<6;y++) W.ore[I(SHAFT,y)]=0;
  for(let y=113;y<ROWS;y++)for(let x=0;x<COLS;x++){ const i=I(x,y); if(!W.ore[i]){ if(r()<0.018) W.deco[i]=1; else if(y>=188 && y<240 && r()<0.012) W.deco[i]=2; } }
  // deep veins (added in v3 with its own rng so every existing world keeps the ore it already had):
  // below the granite line there was too little ore to ever afford the last robot tiers.
  const r2=mulberry32((seed^0x5eed1)>>>0);
  FINDS.forEach((f,fi)=>{ if(f.relic||f.bot<113) return; const top=Math.max(113,f.top), n=Math.round(f.n*DEEP_VEINS*(f.bot-top)/(f.bot-f.top));
    for(let v=0;v<n;v++){ let x=Math.floor(r2()*COLS), y=Math.floor(top+r2()*(f.bot-top)); const L=f.len[0]+Math.floor(r2()*(f.len[1]-f.len[0]+1)); const rich=r2()<0.12;
      for(let k=0;k<L;k++){ if(x>=0&&x<COLS&&y>=113&&y<ROWS&&x!==SHAFT){ const i=I(x,y); if(!W.ore[i]&&!W.deco[i]){ W.ore[i]=fi+1; if(rich) W.rich[i]=1; } }
        if(r2()<0.6) x+=r2()<0.5?-1:1; else y+=r2()<0.5?-1:1; } } });
}
const DEEP_VEINS=2;
const hardAt = i => STRATA[W.strat[i]].h;
// which marks a robot could eventually reach (touch a tunnel/surface, directly or through other marks)
const CONN=new Uint8Array(COLS*ROWS);
function recomputeConn(){
  CONN.fill(0); const q=[];
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const k=I(x,y); if(G.mark[k]&&!G.dug[k]&&(isDug(x-1,y)||isDug(x+1,y)||isDug(x,y-1)||isDug(x,y+1))){CONN[k]=1;q.push(k);}}
  while(q.length){const k=q.pop(), x=k%COLS, y=(k/COLS)|0; for(const [dx,dy] of DIRS){const nx=x+dx, ny=y+dy; if(nx<0||nx>=COLS||ny<0||ny>=ROWS) continue; const n=I(nx,ny); if(!CONN[n]&&G.mark[n]&&!G.dug[n]){CONN[n]=1;q.push(n);}}}
}

// ================= STATE =================
let G = null;
const reserved = new Map();
const isDug=(x,y)=> y===-1 ? (x>=0&&x<COLS) : (x>=0&&x<COLS&&y>=0&&y<ROWS&&G.dug[I(x,y)]===1);
const luck = ()=> 0.1*G.up.luck+(G.xluck||0); // xluck = admin luck slider
const slots = ()=> 2+G.up.bay;
const sellMult = ()=> (1+0.12*G.up.market)*(1+0.2*G.up.refinery);
const bestTier = ()=> G.robots.reduce((m,r)=>Math.max(m,r.tier),0);
function newRobot(tier, rar){
  const id=G.nextId++;
  return {id, tier, rar, up:{drill:0,hopper:0,battery:0,lamp:0}, tx:(id-1)%4, ty:-1, x:((id-1)%4)*TILE+6, y:0,
    st:'idle', path:[], job:null, prog:0, cargo:[], bat:45, face:1, vdir:null, anim:Math.random()*8, think:0, tfx:null, home:false};
}
function newGame(){
  G = {v:1, seed:(Math.random()*2e9)|0, money:20, dug:new Uint8Array(COLS*ROWS), mark:new Uint8Array(COLS*ROWS), robots:[],
       up:{bay:0,luck:0,market:0,lift:0,refinery:0,auto:0,scanner:0,lights:0}, log:{}, deepest:0, seen:[0], rate:0, earned:0,
       found:0, best:-1, tut:0, nextId:1, recent:[], last:Date.now(), xluck:0, forceRar:-1, oreAdd:{}};
  for(let y=0;y<4;y++) G.dug[I(SHAFT,y)]=1;
  genWorld(G.seed);
  const r=newRobot(0,0); r.bat=batMax(r); G.robots.push(r);
}
const hopCap = r => 4+2*r.up.hopper;
const batMax = r => Math.round((45+20*r.up.battery)*BUILD_MULT[r.rar]);
const lampR  = r => 30+7*r.up.lamp+r.tier*4;
const drillRate = r => TIERS[r.tier].spd*(1+0.3*r.up.drill)*BUILD_MULT[r.rar];

// ================= SAVE =================
function packBits(a){let s='';for(let i=0;i<a.length;i+=6){let v=0;for(let k=0;k<6;k++)v|=(a[i+k]?1:0)<<k;s+=String.fromCharCode(48+v);}return s;}
function unpackBits(s,a){for(let i=0;i<s.length;i++){const v=s.charCodeAt(i)-48;for(let k=0;k<6;k++)if(i*6+k<a.length)a[i*6+k]=(v>>k)&1;}}
const SAVE_KEY='mine-save-v1';
function save(){
  if(!G || window.__demo) return;
  try{
    const o=Object.assign({},G,{dug:packBits(G.dug),mark:packBits(G.mark),last:Date.now(),
      robots:G.robots.map(r=>({id:r.id,tier:r.tier,rar:r.rar,up:r.up,tx:r.tx,ty:r.ty,cargo:r.cargo,bat:r.bat,scrap:r.scrap||0}))});
    localStorage.setItem(SAVE_KEY, JSON.stringify(o));
  }catch(e){}
}
function normalize(o){
  const num=(v,d,lo,hi)=>{v=+v; if(!isFinite(v)) v=d; if(lo!=null) v=Math.max(lo,v); if(hi!=null) v=Math.min(hi,v); return v;};
  o.money=num(o.money,0,0); o.deepest=num(o.deepest,0,0,ROWS-1)|0; o.found=num(o.found,0,0)|0; o.best=num(o.best,-1,-1,RAR.length-1)|0;
  o.rate=num(o.rate,0,0); o.earned=num(o.earned,0,0); o.tut=o.tut?1:0; o.seen=Array.isArray(o.seen)?o.seen:[0];
  o.recent=Array.isArray(o.recent)?o.recent.filter(a=>Array.isArray(a)&&FINDS[a[0]]&&RAR[a[1]]):[]; o.log=o.log&&typeof o.log==='object'?o.log:{};
  const up={bay:0,luck:0,market:0,lift:0,refinery:0,auto:0,scanner:0,lights:0}; o.up=Object.assign(up,o.up||{}); for(const k in up) o.up[k]=num(o.up[k],0,0,GUPG[k].max)|0;
  o.robots=(Array.isArray(o.robots)?o.robots:[]).filter(r=>r&&isFinite(r.id));
  o.robots.forEach(r=>{ r.tier=num(r.tier,0,0,TIERS.length-1)|0; r.rar=num(r.rar,0,0,RAR.length-1)|0; r.up=Object.assign({drill:0,hopper:0,battery:0,lamp:0},r.up||{});
    for(const k in RUPG) r.up[k]=num(r.up[k],0,0,RUPG[k].max)|0; r.cargo=(Array.isArray(r.cargo)?r.cargo:[]).filter(c=>Array.isArray(c)&&FINDS[c[0]]&&RAR[c[1]]); r.bat=num(r.bat,45,0); r.scrap=num(r.scrap,0,0); r.tx=num(r.tx,0)|0; r.ty=num(r.ty,-1)|0; });
  if(!o.robots.length) o.robots=[{id:1,tier:0,rar:0,up:{drill:0,hopper:0,battery:0,lamp:0},tx:0,ty:-1,cargo:[],bat:45}];
  o.xluck=num(o.xluck,0,0,5); o.forceRar=num(o.forceRar,-1,-1,RAR.length-1)|0;
  const oa={}; if(o.oreAdd&&typeof o.oreAdd==='object') for(const k in o.oreAdd){ const i=+k, v=+o.oreAdd[k]; if(Number.isInteger(i)&&i>=0&&i<COLS*ROWS&&Number.isInteger(v)&&v>=1&&v<=FINDS.length) oa[i]=v; } o.oreAdd=oa;
  o.sv=2; return o;
}
function load(){
  let raw=null;
  try{ raw=localStorage.getItem(SAVE_KEY); }catch(e){ return false; }
  if(!raw) return false;
  try{
    const o=normalize(JSON.parse(raw)); if(o.v!==1) throw new Error('version');
    const dug=new Uint8Array(COLS*ROWS), mark=new Uint8Array(COLS*ROWS); unpackBits(o.dug,dug); unpackBits(o.mark,mark);
    G=Object.assign(o,{dug,mark});
    genWorld(G.seed);
    for(const k in G.oreAdd) W.ore[+k]=G.oreAdd[k]; // ore placed from the admin panel
    G.robots=o.robots.map(s=>{const r=newRobot(s.tier,s.rar); G.nextId--; Object.assign(r,s);
      if(!isDug(r.tx,r.ty)){r.tx=(r.id-1)%4;r.ty=-1;} r.x=r.tx*TILE+6; r.y=r.ty*TILE+TILE; return r;});
    G.nextId=Math.max(G.nextId||1, ...G.robots.map(r=>r.id+1));
    G.robots.forEach(r=>r.bat=Math.min(r.bat,batMax(r)));
    // marks on already-dug tiles are cleared
    for(let i=0;i<G.mark.length;i++) if(G.dug[i]) G.mark[i]=0;
    return true;
  }catch(e){
    // never wipe a save we could not read: keep a copy before starting fresh
    try{ localStorage.setItem(SAVE_KEY+'-backup-'+Date.now(), raw); }catch(_){}
    return false;
  }
}

// ================= PATHFINDING (through dug tunnels only) =================
const NN=(ROWS+1)*COLS, prev=new Int32Array(NN), dist=new Int32Array(NN), Q=new Int32Array(NN);
const ni=(x,y)=>(y+1)*COLS+x;
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
function bfs(sx,sy, visit){ // visit(x,y,d,cellIndex) returns true to stop
  dist.fill(-1); let h=0,t=0; const s=ni(sx,sy); dist[s]=0; prev[s]=-1; Q[t++]=s;
  while(h<t){
    const c=Q[h++], x=c%COLS, y=Math.floor(c/COLS)-1, d=dist[c];
    if(visit(x,y,d,c)) return c;
    for(const [dx,dy] of DIRS){const nx=x+dx, ny=y+dy; if(!isDug(nx,ny)) continue; const n=ni(nx,ny); if(dist[n]>=0) continue; dist[n]=d+1; prev[n]=c; Q[t++]=n;}
  }
  return -1;
}
function pathTo(c){const out=[]; while(c>=0&&prev[c]>=0){out.push([c%COLS,Math.floor(c/COLS)-1]); c=prev[c];} return out.reverse();}
let DUGVER=0;
const parkX = r => (r.id-1)%4;
function stepTime(r,ax,ay,bx,by){ let s=2.6*TIERS[r.tier].mv; if(ax===bx && bx===SHAFT && (ay>=0||by>=0)) s*=1.5*(1+0.6*G.up.lift); return 1/s; }
// battery seconds for a path: riding the shaft lift is cable-powered, so it costs no battery
const onLift=(ax,bx)=>ax===SHAFT&&bx===SHAFT;
function pathCost(r,sx,sy,path){ let t=0,px=sx,py=sy; for(const [x,y] of path){ if(!onLift(px,x)) t+=stepTime(r,px,py,x,y); px=x; py=y; } return t; }
// seconds to get from (x,y) back to the robot's parking spot, through tunnels (cached until new tunnels appear)
function homeCost(r,x,y){
  const k=x+','+y+','+DUGVER+','+G.up.lift+','+r.tier; if(r._hcK===k) return r._hcV;
  const c=bfs(x,y,(bx,by)=>bx===parkX(r)&&by===-1); const v=c<0?1e9:pathCost(r,x,y,pathTo(c));
  r._hcK=k; r._hcV=v; return v;
}
const digTime = (r,k)=> HARD_TIME[hardAt(k)]*(W.ore[k]?1.25:1)/drillRate(r);
const RESERVE = 1.3, MARGIN = 2;
function findJob(r,skip){
  const dig=TIERS[r.tier].dig, A=G.up.auto, range=[0,22,34,9999][A];
  let mark=null, ore=null, deep=null;
  bfs(r.tx,r.ty,(x,y,d,c)=>{
    for(const [dx,dy] of DIRS){const nx=x+dx, ny=y+dy;
      if(nx<0||nx>=COLS||ny<0||ny>=ROWS) continue; const ti=I(nx,ny);
      if(G.dug[ti]||reserved.has(ti)||hardAt(ti)>dig||(skip&&skip.has(ti))) continue;
      if(G.mark[ti]){ mark={x:nx,y:ny,c,kind:'mark'}; return true; }
      if(A>=1 && !ore && W.ore[ti] && d<=range) ore={x:nx,y:ny,c,kind:'auto'};
      if(A>=2 && nx===SHAFT && dy===1 && (!deep || ny>deep.y)) deep={x:nx,y:ny,c,kind:'auto'};
    }
    return false;
  });
  const j=mark||ore||deep; if(!j) return null;
  j.path=pathTo(j.c); return j;
}
function goHome(r){
  release(r); const px=parkX(r);
  const c=bfs(r.tx,r.ty,(x,y)=>x===px&&y===-1);
  r.home=true; r.job=null;
  if(c<0){ r.st='idle'; return; }
  r.path=pathTo(c);
  if(!r.path.length){ arriveHome(r); } else r.st='move';
}
// ROOT-CAUSE FIX: robots now recharge every time they reach the surface, not only when they unload cargo.
function arriveHome(r){ r.home=false; r.bat=batMax(r);
  if(r.scrap>0){ let v=Math.round(r.scrap*sellMult()); if(!isFinite(v)) v=0; G.money+=v; G.earned+=v; rateAcc+=v; r.scrap=0; if(v>0){ FX.scrap(r,v); UI.bump(); } }
  if(r.cargo.length){ r.st='unload'; r.timer=reduced?0.4:0.9; } else { r.st='idle'; r.think=0.3; } }
function lowBat(r){ return r.ty>=0 && r.bat < homeCost(r,r.tx,r.ty)*RESERVE+MARGIN; }
function plan(r){
  if(r.ty===-1) r.bat=batMax(r); // charging at the surface
  if(r.cargo.length>=hopCap(r) || lowBat(r)){ goHome(r); return; }
  // ROOT-CAUSE FIX: only take a job the robot can reach, dig and return from on its battery.
  const skip=new Set(); let j=null, needHome=false;
  for(let tries=0;tries<8;tries++){
    const c=findJob(r,skip); if(!c) break;
    const k=I(c.x,c.y), sx=c.c%COLS, sy=Math.floor(c.c/COLS)-1;
    const need=pathCost(r,r.tx,r.ty,c.path)+digTime(r,k)+homeCost(r,sx,sy)*RESERVE+MARGIN;
    const full=homeCost(r,r.tx,r.ty)+need; // worst case: go home, recharge, come back
    if(need<=r.bat){ j=c; break; }
    if(r.ty>=0 && full<=batMax(r)){ needHome=true; break; }       // reachable after a recharge
    skip.add(k);                                                  // out of range even on a full battery
    if(c.kind==='mark' && !r._farTold){ r._farTold=1; r.far=k; FX.far&&FX.far(r,c); }
  }
  if(j){ r.far=null; reserved.set(I(j.x,j.y), r.id); r.job=j; r.home=false;
    if(j.path.length){ r.path=j.path; r.st='move'; } else startDrill(r); return; }
  if(needHome){ goHome(r); return; }
  if(r.ty>=0 || r.cargo.length || r.tx!==parkX(r)) goHome(r); else { r.st='idle'; r.think=skip.size?1.5:0.4; }
}
function release(r){ if(r.job){ const k=I(r.job.x,r.job.y); if(reserved.get(k)===r.id) reserved.delete(k); } r.job=null; }
function startDrill(r){
  const j=r.job; r.st='drill'; r.prog=0; r._prog=0;
  if(j.x!==r.tx){ r.face=j.x>r.tx?1:-1; r.vdir=null; } else r.vdir=j.y>r.ty?'d':'u';
}
function jobValid(r){ const j=r.job; if(!j) return false; const k=I(j.x,j.y); return !G.dug[k] && (j.kind!=='mark'||G.mark[k]); }
function moveSpeed(r, vertical){
  let s=2.6*TIERS[r.tier].mv; if(vertical && r.tx===SHAFT) s*=1.5*(1+0.6*G.up.lift);
  if(r.bat<=0 && !(vertical && r.tx===SHAFT)) s*=0.35; return s*TILE;
}
function stepPath(r,dt){
  if(!r.path.length){ if(r.home) arriveHome(r); else if(jobValid(r)) startDrill(r); else { release(r); r.st='idle'; r.think=0; } return; }
  const [nx,ny]=r.path[0], gx=nx*TILE+6, gy=ny*TILE+TILE, vertical=nx===r.tx;
  if(nx!==r.tx) r.face=nx>r.tx?1:-1;
  const sp=moveSpeed(r,vertical)*dt, dx=gx-r.x, dy=gy-r.y, d=Math.hypot(dx,dy);
  if(d<=sp){ r.x=gx; r.y=gy; r.tx=nx; r.ty=ny; r.path.shift();
    r._prog=0;
    if(!r.home && r.job && !jobValid(r)){ release(r); r.st='idle'; r.think=0; }
    else if(!r.home && lowBat(r)){ goHome(r); } }
  else { r.x+=dx/d*sp; r.y+=dy/d*sp; }
}
function drillStep(r,dt){
  if(!jobValid(r)){ release(r); r.st='idle'; r.think=0; return; }
  const k=I(r.job.x,r.job.y), t=HARD_TIME[hardAt(k)]*(W.ore[k]?1.25:1);
  r.prog+=dt*drillRate(r)/t; r._prog=0;
  FX.drilling(r, dt);
  r._bt=(r._bt||0)+dt; if(r._bt>0.5){ r._bt=0; if(lowBat(r) && r.prog<0.9){ goHome(r); return; } }
  if(r.prog>=1) completeDig(r);
}
function completeDig(r){
  const {x,y}=r.job, k=I(x,y); G.dug[k]=1; G.mark[k]=0; DUGVER++; release(r);
  FX.burst(x,y,r.tier);
  const o=W.ore[k];
  if(!o) r.scrap=(r.scrap||0)+hardAt(k); // plain rock rides up as scrap: a small income floor so a player can never end up broke with nothing left to dig
  if(o){
    const fi=o-1, rl=luck()+(W.rich[k]?0.5:0); let rar=rollRarity(y, rl, Math.random);
    if(G.forceRar>=0){ rar=G.forceRar; G.forceRar=-1; } // admin: forced next find
    r.cargo.push([fi,rar]);
    const L=G.log[FINDS[fi].id]||(G.log[FINDS[fi].id]=[0,0,0,0,0,0,0]); const isNew=L[rar]===0; L[rar]++;
    G.found++; if(rar>G.best) G.best=rar;
    G.recent.unshift([fi,rar,y]); G.recent.length=Math.min(G.recent.length,10);
    FX.reveal(fi,rar,x,y,isNew);
  }
  recomputeConn();
  if(y>G.deepest){ G.deepest=y; const s=W.strat[k]; if(!G.seen.includes(s)){ G.seen.push(s); UI.zone(s); } }
  r.st='idle'; r.think=0;
}
function oreValue(fi,rar){ return Math.round(FINDS[fi].val*RAR[rar].m*sellMult()); }
let rateAcc=0, rateT=0;
function sell(r){
  let tot=0; r.cargo.forEach(([fi,rar])=>tot+=oreValue(fi,rar));
  FX.unload(r, r.cargo.slice(), tot); r.cargo=[];
  if(!isFinite(tot)) tot=0; G.money+=tot; G.earned+=tot; rateAcc+=tot; UI.bump();
}
function robotUpdate(r,dt){
  r.anim+=dt*(r.st==='drill'?14:10);
  if(r.tfx){ r.tfx.t+=dt; if(r.tfx.t>=r.tfx.d) r.tfx=null; else return; }
  if(r.ty>=0 && !(r.st==='move' && r.tx===SHAFT && r.path.length && r.path[0][0]===SHAFT)) r.bat=Math.max(0,r.bat-dt);
  // watchdog: a robot that is busy but makes no progress for 20s gets put back in a sane state
  r._prog=(r._prog||0)+dt;
  if((r.st==='move'||r.st==='drill') && r._prog>20){ r._wd=(r._wd||0)+1; G.wd=(G.wd||0)+1; release(r); r.path=[]; r.home=false;
    if(!isDug(r.tx,r.ty)){ r.tx=parkX(r); r.ty=-1; } r.x=r.tx*TILE+6; r.y=r.ty*TILE+TILE; r.st='idle'; r.think=0; r._prog=0; }
  if(r.st==='idle'||r.st==='unload') r._prog=0;
  switch(r.st){
    case 'idle': r.think-=dt; if(r.think<=0){ r.think=0.4; plan(r); } break;
    case 'move': stepPath(r,dt); break;
    case 'drill': drillStep(r,dt); break;
    case 'unload': r.timer-=dt; if(r.timer<=0){ sell(r); r.bat=batMax(r); r.st='idle'; r.think=0; } break;
  }
}
function simUpdate(dt){
  G.robots.forEach(r=>robotUpdate(r,dt));
  rateT+=dt; if(rateT>=10){ G.rate=G.rate*0.8+(rateAcc/rateT)*0.2; rateAcc=0; rateT=0; }
}
// ================= PURCHASES =================
function buyRobot(){
  const n=G.robots.length+1, c=robotCost(n);
  if(G.robots.length>=slots()||G.money<c) return null;
  G.money-=c; const rar=rollRarity(0, luck(), Math.random); const r=newRobot(0,rar); r.bat=batMax(r); G.robots.push(r); return r;
}
function buyRobotUp(r,key){
  const L=r.up[key], u=RUPG[key]; if(L>=u.max) return false; const c=u.cost(L); if(G.money<c) return false;
  G.money-=c; r.up[key]++; if(key==='battery') r.bat=batMax(r); return true;
}
function buyTier(r){
  if(r.tier>=TIERS.length-1) return false; const c=TIERS[r.tier+1].cost; if(G.money<c) return false;
  G.money-=c; const from=r.tier; r.tier++; r.tfx={t:0,d:reduced?0.7:1.8,from}; return true;
}
function buyGlobal(key){
  const L=G.up[key], u=GUPG[key]; if(L>=u.max) return false; const c=u.cost(L); if(G.money<c) return false;
  G.money-=c; G.up[key]++; return true;
}
