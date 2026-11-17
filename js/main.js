'use strict';
const RMQ=matchMedia('(prefers-reduced-motion: reduce)');
let reduced=RMQ.matches; RMQ.addEventListener&&RMQ.addEventListener('change',e=>reduced=e.matches);
let MODE='title', T=0, wipe=null;
const Input={tool:'dig', ptrs:new Map(), drag:null};

function screenToTile(cx,cy){ const r=cv.getBoundingClientRect(), Z=ZOOM.z; const x=(cx-r.left)/SC/Z+cam.x, y=(cy-r.top)/SC/Z+cam.y; return [Math.floor(x/TILE),Math.floor(y/TILE),x,y]; }
function markLine(a,b,on){ let [x0,y0]=a; const [x1,y1]=b; const dx=Math.abs(x1-x0), dy=-Math.abs(y1-y0), sx=x0<x1?1:-1, sy=y0<y1?1:-1; let e=dx+dy;
  for(;;){ setMark(x0,y0,on); if(x0===x1&&y0===y1) break; const e2=2*e; if(e2>=dy){e+=dy;x0+=sx;} else if(e2<=dx){e+=dx;y0+=sy;} } }
function setMark(x,y,on){ if(x<0||x>=COLS||y<0||y>=ROWS) return; const k=I(x,y); if(G.dug[k]) return; const d=Input.drag; if(d&&d.hist&&!d.hist.has(k)) d.hist.set(k,G.mark[k]); G.mark[k]=on?1:0; if(on&&!G.tut){ G.tut=1; } }
function robotAt(wx,wy){ return G.robots.find(r=>Math.abs(r.x-wx)<8&&wy<r.y+2&&wy>r.y-16-(r.tier>=4?10:0)); }

cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{
  if(MODE!=='game') return; cv.setPointerCapture(e.pointerId);
  Input.ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(Input.ptrs.size>=2){ const d=Input.drag; if(d&&!d.pan&&d.hist) d.hist.forEach((v,k)=>G.mark[k]=v); // second finger: undo the marks the first finger just drew
    Input.drag={pan:true,x:e.clientX,y:e.clientY,pinch:pinchDist()}; return; }
  if( e.button===1 || e.button===2 || Input.tool==='pan'){ Input.drag={pan:true,x:e.clientX,y:e.clientY}; return; }
  const [tx,ty,wx,wy]=screenToTile(e.clientX,e.clientY);
  if(ADMIN.picking){ Input.drag=null; ADMIN.place(tx,ty); return; }
  const r=robotAt(wx,wy); if(r){ UI.sel=r.id; if(UI.open!=='robots') UI.toggle('robots'); else UI.render(); Input.drag=null; return; }
  if(ty<0){ Input.drag={pan:true,x:e.clientX,y:e.clientY}; return; }
  const on=!(tx>=0&&tx<COLS&&G.mark[I(tx,ty)]); Input.drag={pan:false,on,last:[tx,ty],sx:e.clientX,sy:e.clientY,cy:e.clientY,hist:new Map()};
  setMark(tx,ty,on);
});
cv.addEventListener('pointermove',e=>{
  const p=Input.ptrs.get(e.pointerId); if(!p) return; const d=Input.drag;
  if(d&&d.pan){ const n=Input.ptrs.size, Z=ZOOM.z; cam.tx-=(e.clientX-p.x)/SC/Z/n; cam.ty-=(e.clientY-p.y)/SC/Z/n; cam.x=cam.tx; cam.y=cam.ty; clampCam(false);
    if(n>=2&&d.pinch){ p.x=e.clientX; p.y=e.clientY; const q=pinchDist()/d.pinch, m=pinchMid();
      if(q>1.4){ if(zoomAt(ZOOM.t+1,m[0],m[1])) d.pinch=pinchDist(); else d.pinch=pinchDist(); }
      else if(q<0.7){ zoomAt(ZOOM.t-1,m[0],m[1]); d.pinch=pinchDist(); } } }
  else if(d){ const [tx,ty]=screenToTile(e.clientX,e.clientY); if(tx!==d.last[0]||ty!==d.last[1]){ markLine(d.last,[tx,ty],d.on); d.last=[tx,ty]; } d.cy=e.clientY; }
  p.x=e.clientX; p.y=e.clientY;
});
function endPtr(e){ Input.ptrs.delete(e.pointerId); if(!Input.ptrs.size){ const d=Input.drag; Input.drag=null; recomputeConn(); if(d&&!d.pan&&d.on){ const k=I(Math.max(0,Math.min(COLS-1,d.last[0])),Math.max(0,Math.min(ROWS-1,d.last[1]))); if(G.mark[k]&&!CONN[k]&&!UI.loneTold){ UI.loneTold=1; UI.toast('Gray marks are cut off. Connect them to a tunnel or the surface.'); } } save(); } }
cv.addEventListener('pointerup',endPtr); cv.addEventListener('pointercancel',endPtr);
// wheel pans (like scrolling a page); ctrl/cmd + wheel or a trackpad pinch zooms around the cursor
let wheelZ=0, wheelZT=0;
cv.addEventListener('wheel',e=>{ e.preventDefault(); if(MODE!=='game') return; const m=e.deltaMode===1?16:1;
  if(e.ctrlKey||e.metaKey){ const now=performance.now(); if(now-wheelZT>300) wheelZ=0; wheelZT=now; wheelZ+=e.deltaY*m;
    if(Math.abs(wheelZ)>=40){ zoomAt(ZOOM.t+(wheelZ<0?1:-1),e.clientX,e.clientY); wheelZ=0; } return; }
  cam.ty+=e.deltaY*m/SC/ZOOM.z*0.9; cam.tx+=e.deltaX*m/SC/ZOOM.z; },{passive:false});
function pinchDist(){ const a=[...Input.ptrs.values()]; return a.length<2?0:Math.max(1,Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)); }
function pinchMid(){ const a=[...Input.ptrs.values()]; return [(a[0].x+a[1].x)/2,(a[0].y+a[1].y)/2]; }
function zoomAt(t,clientX,clientY){ const r=cv.getBoundingClientRect(); const ok=clientX==null?zoomTo(t):zoomTo(t,(clientX-r.left)/SC,(clientY-r.top)/SC); if(ok) UI.zoomLbl(); return ok; }
addEventListener('keydown',e=>{
  if(MODE!=='game') return;
  if(ADMIN.isTyping(e)){ if(e.key==='Escape'){ e.target.blur(); UI.close(); } return; } // typing in a field: no game keys
  if((e.key==='l'||e.key==='L')&&!e.ctrlKey&&!e.metaKey&&!e.altKey){ e.preventDefault(); ADMIN.toggle(); return; }
  if(e.key==='Escape') UI.close();
  const s=(e.shiftKey?120:40)/ZOOM.z;
  if(e.key==='ArrowDown'||e.key==='s') cam.ty+=s; if(e.key==='ArrowUp'||e.key==='w') cam.ty-=s;
  if(e.key==='ArrowLeft'||e.key==='a') cam.tx-=s; if(e.key==='ArrowRight'||e.key==='d') cam.tx+=s;
  if(e.key==='+'||e.key==='='){ e.preventDefault(); zoomAt(ZOOM.t+1); } if(e.key==='-'||e.key==='_'){ e.preventDefault(); zoomAt(ZOOM.t-1); }
  if(e.key===' '){ e.preventDefault(); UI.setTool(Input.tool==='dig'?'pan':'dig'); }
});
addEventListener('resize',resize);
document.addEventListener('visibilitychange',()=>{ if(document.hidden) save(); });
addEventListener('pagehide',save);

function startGame(fresh){
  if(fresh){ localStorage.removeItem(SAVE_KEY); newGame(); reserved.clear(); }
  const first=!G.tut && G.found===0;
  MODE='game'; $('#title').classList.add('out'); document.body.classList.add('playing');
  wipe={t:0,m:reduced?0.35:0.8};
  cam.ty=-viewH()*0.42; cam.tx=SHAFT*TILE+30-viewW()*0.5; if(reduced) clampCam(true);
  setTimeout(()=>{ $('#title').hidden=true; if(first) $('#howto').classList.add('show'); else UI.zone(W.strat[I(SHAFT,Math.max(0,G.deepest))]); }, reduced?200:700);
}
$('#play').addEventListener('click',()=>startGame(false));
$('#newg').addEventListener('click',e=>{ const b=e.currentTarget; if(b.dataset.c){ startGame(true); } else { b.dataset.c=1; b.textContent='TAP AGAIN TO WIPE SAVE'; } });
$('#gotit').addEventListener('click',()=>{ $('#howto').classList.remove('show'); UI.zone(0); });

let last=performance.now(), uiT=0, saveT=0;
function frame(now){
  const dt=Math.min(0.05,(now-last)/1000); last=now; T+=dt;
  if(MODE==='title'){ cam.ty=-Math.min(SKY*TILE,VH*0.45)+6+Math.sin(T*0.12)*(reduced?0:6); const cb=camBounds(); cam.tx=cb.x0===cb.x1?cb.x0:SHAFT*TILE+40-VW/2; }
  for(let i=0;i<(MODE==='game'?ADMIN.speed:1);i++) simUpdate(dt); updateFX(dt); camUpdate(dt);
  if(MODE==='game' && Input.drag && !Input.drag.pan){ const h=innerHeight, y=Input.drag.cy; if(y<h*0.1) cam.ty-=200*dt/ZOOM.z; else if(y>h*0.9) cam.ty+=200*dt/ZOOM.z; }
  render(T, MODE);
  if(wipe){ wipe.t+=dt; const q=wipe.t/wipe.m; if(q>=1) wipe=null; else {
    if(reduced){ ctx.globalAlpha=1-q; ctx.fillStyle='#000'; ctx.fillRect(0,0,VW,VH); ctx.globalAlpha=1; }
    else { ctx.fillStyle='#000'; for(let y=0;y<VH;y+=8)for(let x=0;x<VW;x+=8) if(hash2(x,y,31)*0.7+(y/VH)*0.3>q) ctx.fillRect(x,y,8,8); } } }
  uiT+=dt; if(uiT>0.1){ UI.tick(); UI.ports(T); uiT=0; }
  saveT+=dt; if(saveT>5 && MODE==='game'){ save(); saveT=0; }
  requestAnimationFrame(frame);
}
function boot(){
  buildSheets(); resize();
  const had=load();
  if(!had) newGame();
  recomputeConn(); UI.shown=G.money; UI.init(); ADMIN.init();
  if(had){
    $('#play').textContent='CONTINUE'; $('#newg').hidden=false;
    const away=Math.min(7200,(Date.now()-(G.last||Date.now()))/1000);
    if(away>60 && G.rate>0){ const gain=Math.floor(G.rate*away*0.5); if(gain>0){ G.money+=gain; setTimeout(()=>UI.toast(`While you were away (${Math.round(away/60)} min) your robots hauled <b>+${fmt(gain)}</b><br><small>half your recent rate, capped at 2 hours</small>`,5200),900); } }
  }
  // debug/screenshot hooks (no effect on normal play)
  const q=new URLSearchParams(location.search);
  if(q.has('demo')) demoState(+q.get('demo')||1);
  // build the zoomed art sets in idle time so the first zoom never hitches
  const idle=window.requestIdleCallback||(f=>setTimeout(f,200)); [2,3,4].forEach((D,i)=>setTimeout(()=>idle(()=>lod(D)),1500+i*1200));
  requestAnimationFrame(frame);
}
function demoState(n){
  newGame(); G.tut=1; G.money=n>1?2.5e6:900;
  const R=n>1?[[0,2,4],[1,3,5],[2,4,6],[3,5,3],[4,6,2],[5,4,8]]:[[0,0,0],[1,1,2],[2,1,1]];
  const deep=n>1?200:40;
  for(let y=0;y<deep;y++) G.dug[I(SHAFT,y)]=1;
  for(let k=0;k<(n>1?10:5);k++){ const y=6+k*Math.floor(deep/(n>1?10:5)); const dir=k%2?-1:1; for(let i=1;i<(dir>0?20:5);i++){ const x=SHAFT+dir*i; if(x>=0&&x<COLS) G.dug[I(x,y)]=1; } }
  for(let x=SHAFT+1;x<SHAFT+12;x++) G.mark[I(x,deep-2)]=1;
  for(let y=deep-8;y<deep+4;y++) G.mark[I(SHAFT+12,y)]=1;
  G.up.lights=n>1?2:1; G.up.scanner=n>1?3:1; G.up.refinery=n>1?6:1; G.up.bay=n>1?5:1; G.up.auto=n>1?2:0;
  G.robots=[]; G.nextId=1;
  R.forEach(([t,rar])=>{ const r=newRobot(t,rar); r.up.lamp=3; r.up.drill=4; r.up.hopper=3; r.bat=batMax(r); G.robots.push(r); });
  G.robots.forEach((r,i)=>{ const y=deep-2-(i%3)*Math.floor(deep/(n>1?10:5)); const x=SHAFT+1+i*2; for(let xx=SHAFT;xx<=x;xx++) G.dug[I(xx,y)]=1; r.tx=x; r.ty=y; r.x=x*TILE+6; r.y=y*TILE+TILE; r.cargo=[[n>1?6:1,1],[n>1?7:0,0]]; });
  G.deepest=deep-1; G.seen=[...new Set(STRATA.map((s,i)=>s.top<=deep?i:0))];
  G.log={coal:[9,3,1,0,0,0,0],copper:[4,2,1,1,0,0,0],iron:[2,1,0,0,1,0,0]}; G.found=25; G.best=4;
  window.__demo=true; recomputeConn();
}
boot();
