
'use strict';
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
let SC=3, VW=400, VH=240;
const DARK=mk(4,4);
const cam={x:0,y:-60,tx:0,ty:-60};
let shake=0, shakeMag=0, flash=null;
// ---------- zoom: integer levels 1..4; level N draws N canvas pixels per world pixel using density-N art ----------
const ZOOM={z:1,t:1,anchor:null,MIN:1,MAX:4};
const RV={cx:0,cy:0,Z:1,D:1};
const viewW=()=>VW/ZOOM.z, viewH=()=>VH/ZOOM.z;
function zoomTo(t,px,py){
  t=Math.max(ZOOM.MIN,Math.min(ZOOM.MAX,Math.round(t))); if(t===ZOOM.t) return false;
  if(px==null){ px=VW/2; py=VH/2; }
  ZOOM.anchor={px,py,wx:cam.x+px/ZOOM.z,wy:cam.y+py/ZOOM.z};
  ZOOM.t=t; lod(t);
  if(reduced){ ZOOM.z=t; applyAnchor(); ZOOM.anchor=null; }
  return true;
}
function applyAnchor(){ const a=ZOOM.anchor; cam.x=cam.tx=a.wx-a.px/ZOOM.z; cam.y=cam.ty=a.wy-a.py/ZOOM.z; clampCam(false); }
function zoomUpdate(dt){
  if(ZOOM.z!==ZOOM.t){ const k=1-Math.exp(-dt*14); ZOOM.z+=(ZOOM.t-ZOOM.z)*k; if(Math.abs(ZOOM.z-ZOOM.t)<0.004) ZOOM.z=ZOOM.t; }
  if(ZOOM.anchor){ applyAnchor(); if(ZOOM.z===ZOOM.t) ZOOM.anchor=null; }
}
function resize(){
  const w=innerWidth, h=innerHeight;
  SC = w<760 ? 2 : Math.max(2,Math.floor(Math.min(w/400,h/250)));
  VW=Math.ceil(w/SC); VH=Math.ceil(h/SC);
  cv.width=VW; cv.height=VH; cv.style.width=VW*SC+'px'; cv.style.height=VH*SC+'px';
  DARK.c.width=VW; DARK.c.height=VH; ctx.imageSmoothingEnabled=false;
  clampCam(true);
}
function camBounds(){
  const wx=COLS*TILE, vw=viewW(), vh=viewH(); let x0,x1;
  if(vw>=wx){ x0=x1=-(vw-wx)/2; } else { x0=-10; x1=wx-vw+10; }
  return {x0,x1,y0:-SKY*TILE-10,y1:ROWS*TILE-vh+30};
}
function clampCam(snap){
  const b=camBounds();
  cam.tx=Math.max(b.x0,Math.min(b.x1,cam.tx)); cam.ty=Math.max(b.y0,Math.min(b.y1,cam.ty));
  if(snap){cam.x=cam.tx; cam.y=cam.ty;}
  cam.x=Math.max(b.x0,Math.min(b.x1,cam.x)); cam.y=Math.max(b.y0,Math.min(b.y1,cam.y));
}
function camUpdate(dt){
  zoomUpdate(dt); clampCam(false);
  if(reduced||ZOOM.anchor){ cam.x=cam.tx; cam.y=cam.ty; return; }
  const k=1-Math.exp(-dt*10); cam.x+=(cam.tx-cam.x)*k; cam.y+=(cam.ty-cam.y)*k;
}
const PT=[], FL=[], RG=[];
function spawn(o){ if(PT.length>=(reduced?70:900)) return; PT.push(o); }
const rnd=(a,b)=>a+Math.random()*(b-a);
const FX = {
  scrap(r,v){ FL.push({x:r.x,y:r.y-14,t:0,m:1.1,txt:'+'+fmt(v)+' SCRAP',c:'#b8b2a4'}); },
  far(r){ UI.toast(`Robot #${r.id} can't reach a mark and get back on one charge.<br><small>Upgrade its BATTERY, the LIFT, or mark closer to the shaft.</small>`,4200); },
  drilling(r,dt){
    const pr=reduced?0.2:1, j=r.job, k=I(j.x,j.y), pal=STRATA[W.strat[k]].pal;
    const dx=j.x-r.tx, dy=j.y-r.ty, fx=j.x*TILE+6-dx*6, fy=j.y*TILE+6-dy*6;
    const n=dt*60*pr*(0.5+r.tier*0.25);
    for(let i=0;i<n;i++){
      if(Math.random()<0.5) spawn({x:fx+rnd(-3,3),y:fy+rnd(-4,4),vx:-dx*rnd(10,40)+rnd(-20,20),vy:rnd(-40,-5)-dy*20,l:0,m:rnd(0.3,0.8),c:pal[1+Math.floor(Math.random()*3)],k:0});
      if(r.tier===2&&Math.random()<0.5) spawn({x:fx,y:fy+rnd(-4,4),vx:rnd(-50,50)-dx*20,vy:rnd(-60,10),l:0,m:rnd(0.15,0.4),c:Math.random()<0.5?'#ffd0c0':'#ff4030',k:1});
      if(r.tier===3&&Math.random()<0.4) spawn({x:fx,y:fy,vx:rnd(-20,20),vy:rnd(-10,20),l:0,m:rnd(0.3,0.7),c:['#ffffff','#e080ff','#ff9a30'][Math.floor(Math.random()*3)],k:1});
      if(r.tier===4&&Math.random()<0.25) spawn({x:fx+rnd(-5,5),y:fy+rnd(-5,5),vx:rnd(-30,30),vy:rnd(-70,-20),l:0,m:rnd(0.5,1),c:pal[Math.floor(Math.random()*4)],k:6});
      if(r.tier===5&&Math.random()<0.6){const a=Math.random()*6.28,d=rnd(10,26); spawn({x:fx+Math.cos(a)*d,y:fy+Math.sin(a)*d,tx:fx,ty:fy,l:0,m:rnd(0.3,0.6),c:Math.random()<0.5?'#ff5cf0':'#5ff6ff',k:5});}
    }
    if(r.tier>=4 && !reduced && Math.random()<dt*6){ shake=Math.max(shake,0.08); shakeMag=Math.max(shakeMag,r.tier===4?1:1); }
  },
  burst(x,y,tier){
    const pal=STRATA[W.strat[I(x,y)]].pal, n=reduced?3:10+tier*4;
    for(let i=0;i<n;i++) spawn({x:x*TILE+rnd(1,11),y:y*TILE+rnd(1,11),vx:rnd(-40,40),vy:rnd(-60,0),l:0,m:rnd(0.4,1.1),c:pal[Math.floor(Math.random()*4)],k:Math.random()<0.4?6:0});
  },
  reveal(fi,rar,x,y,isNew){
    const f=FINDS[fi], R=RAR[rar], px=x*TILE+6, py=y*TILE+4;
    FL.push({x:px,y:py,t:0,m:1.4+rar*0.2,txt:(rar>0?R.n+' ':'')+f.name,c:R.c});
    const n=(reduced?1:6)*rar;
    for(let i=0;i<n;i++){const a=Math.random()*6.28,s=rnd(20,60+rar*10); spawn({x:px,y:py,vx:Math.cos(a)*s,vy:Math.sin(a)*s-20,l:0,m:rnd(0.4,1),c:i%3?R.c:'#ffffff',k:1});}
    if(rar>=2) RG.push({x:px,y:py,t:0,m:0.6+rar*0.12,c:R.c,R:10+rar*7});
    if(rar>=4 && !reduced){ shake=0.25+0.18*(rar-4); shakeMag=1+(rar-4); }
    if(rar>=3) flash={t:0,m:reduced?0.3:0.12+0.05*rar,c:rar>=5?R.c:'#ffffff',a:reduced?0.18:0.25+0.08*(rar-3)};
    if(rar>=2 || isNew) UI.banner(fi,rar,isNew,y);
  },
  unload(r,items,tot){
    const dx=24, dy=-20;
    FL.push({x:r.x,y:r.y-14,t:0,m:1.3,txt:'+'+fmt(tot),c:'#ffe28a'});
    items.slice(0,reduced?2:12).forEach(([fi],i)=>{const C=FINDS[fi].col; spawn({x:r.x,y:r.y-8,sx:r.x,sy:r.y-8,tx:dx,ty:dy,l:-i*0.05,m:0.6,c:C[2],k:7});});
  },
};
function updateFX(dt){
  for(let i=PT.length-1;i>=0;i--){const p=PT[i]; p.l+=dt; if(p.l<0) continue; if(p.l>=p.m){PT.splice(i,1);continue;}
    if(p.k===0||p.k===1||p.k===6){p.vy+=160*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=0.98;}
    else if(p.k===2){ if(p.l>p.hang){ p.vy+=220*dt; p.y+=p.vy*dt; if(p.y>=p.fy){ for(let s=-1;s<=1;s+=2) spawn({x:p.x,y:p.fy-1,vx:s*rnd(10,25),vy:rnd(-30,-15),l:0,m:0.25,c:'#9ab8d0',k:0}); PT.splice(i,1);} } }
    else if(p.k===3||p.k===4){p.x+=p.vx*dt; p.y+=p.vy*dt;}
    else if(p.k===5){const q=p.l/p.m; p.x+=(p.tx-p.x)*q*0.3; p.y+=(p.ty-p.y)*q*0.3;}
    else if(p.k===7){const q=p.l/p.m; p.x=p.sx+(p.tx-p.sx)*q; p.y=p.sy+(p.ty-p.sy)*q-Math.sin(q*Math.PI)*16;}
  }
  for(let i=FL.length-1;i>=0;i--){FL[i].t+=dt; if(FL[i].t>FL[i].m) FL.splice(i,1);}
  for(let i=RG.length-1;i>=0;i--){RG[i].t+=dt; if(RG[i].t>RG[i].m) RG.splice(i,1);}
  if(shake>0) shake-=dt; if(flash){flash.t+=dt; if(flash.t>flash.m) flash=null;}
  ambient(dt);
}
let dripT=0, smokeT=0;
function ambient(dt){
  const x0=Math.floor(cam.x/TILE), y0=Math.max(1,Math.floor(cam.y/TILE)), cols=Math.ceil(viewW()/TILE)+1, rows=Math.ceil(viewH()/TILE)+1;
  dripT+=dt;
  const rate=reduced?0.8:0.08;
  while(dripT>rate){ dripT-=rate;
    const x=x0+Math.floor(Math.random()*cols), y=y0+Math.floor(Math.random()*rows);
    if(x>=0&&x<COLS&&y>0&&y<ROWS&&G.dug[I(x,y)]&&!G.dug[I(x,y-1)]){
      let fy=y; while(fy+1<ROWS&&G.dug[I(x,fy+1)]&&fy-y<6) fy++;
      spawn({x:x*TILE+2+Math.floor(Math.random()*8),y:y*TILE,vy:0,l:0,m:4,hang:rnd(0.3,1.2),fy:fy*TILE+TILE-1,c:'#7fa6c4',k:2});
    }
  }
  if(!reduced) G.robots.forEach(r=>{ if(r.ty>=0&&Math.random()<dt*3) spawn({x:r.x+r.face*rnd(4,24),y:r.y-rnd(2,12),vx:rnd(-3,3),vy:rnd(-4,2),l:0,m:rnd(1.5,3),c:'#d8c8a8',k:3}); });
  smokeT+=dt;
  if(smokeT>(reduced?1.2:0.18)){ smokeT=0;
    spawn({x:34+rnd(-1,1),y:-44,vx:rnd(2,6),vy:rnd(-10,-6),l:0,m:rnd(2,4),c:'#3a3a40',k:4});
    if(G.up.refinery>=1) spawn({x:146+rnd(-1,1),y:-62,vx:rnd(3,8),vy:rnd(-12,-7),l:0,m:rnd(2.5,4.5),c:'#4a4246',k:4});
    G.robots.forEach(r=>{ if(r.tier===4&&r.st!=='idle') spawn({x:r.x-r.face*6,y:r.y-34,vx:rnd(-2,2),vy:rnd(-12,-6),l:0,m:2,c:'#2a2a2e',k:4}); });
  }
}

// ================= DRAWING =================
function n1d(x,s){const i=Math.floor(x),f=x-i,a=hash2(i,0,s),b=hash2(i+1,0,s);return a+(b-a)*f*f*(3-2*f);}
const SKYB=['#090b14','#10131f','#181a2a','#221f31','#302737','#43303a','#5a3a38','#704634'];
function drawSky(cx,cy,T,VW){
  const top=-SKY*TILE, bh=Math.ceil(SKY*TILE/SKYB.length);
  for(let i=0;i<SKYB.length;i++){const y=top+i*bh-cy; ctx.fillStyle=SKYB[i]; ctx.fillRect(0,y,VW,bh+1);}
  ctx.fillStyle='#000'; ctx.fillRect(0,top-cy-400,VW,400);
  // sparse stars
  for(let i=0;i<40;i++){const x=Math.floor(hash2(i,1,3)*VW), y=top+Math.floor(hash2(i,2,3)*40)-cy; if(hash2(i,Math.floor(T*0.5),9)>0.15){ctx.fillStyle=i%5?'#5a5a70':'#a0a0b8'; ctx.fillRect(x,y,1,1);} }
  // drifting clouds (hard edged)
  for(let k=0;k<4;k++){const w=40+k*14, x=((hash2(k,4,4)*600+T*(2+k))%(VW+w*2))-w, y=top+22+k*11-cy;
    ctx.fillStyle=k%2?'#2a2333':'#382a36'; ctx.fillRect(x,y,w,3); ctx.fillRect(x+6,y-2,w-14,2); ctx.fillStyle='#4a3238'; ctx.fillRect(x+4,y+3,w-6,1);}
  // far ridge + near pine hills (parallax)
  for(let sx=0;sx<VW;sx++){
    const wx1=(sx+cx*0.3)/22, h1=Math.round(26+n1d(wx1,7)*26+n1d(wx1*3,8)*6);
    ctx.fillStyle='#1c1a26'; ctx.fillRect(sx,-h1-cy,1,h1); ctx.fillStyle='#2a2532'; ctx.fillRect(sx,-h1-cy,1,1);
    const wx2=(sx+cx*0.6)/14, h2=Math.round(10+n1d(wx2,11)*12), tree=hash2(Math.floor((sx+cx*0.6)/5),0,12)>0.55?Math.round(3+hash2(Math.floor((sx+cx*0.6)/5),1,12)*6):0;
    const pine=tree? Math.max(0,tree-Math.abs(((sx+Math.round(cx*0.6))%5)-2)*2):0;
    ctx.fillStyle='#121117'; ctx.fillRect(sx,-h2-pine-cy,1,h2+pine);
  }
}
function line(g,x0,y0,x1,y1,c){g.fillStyle=c;x0|=0;y0|=0;x1|=0;y1|=0;const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let e=dx+dy;for(;;){g.fillRect(x0,y0,1,1);if(x0===x1&&y0===y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx;}if(e2<=dx){e+=dx;y0+=sy;}}}
function drawSurface(T){
  const g=ctx; g.save();
  const shaftBusy=G.robots.some(r=>r.tx===SHAFT&&r.st==='move'&&r.path.length&&r.path[0][0]===SHAFT);
  // depot / warehouse
  const S=PAL.steel;
  for(let x=2;x<46;x++){ g.fillStyle=(x%4===0)?S[1]:(x%4===1)?S[3]:S[2]; g.fillRect(x,-26,1,26);} 
  g.fillStyle=S[4]; g.fillRect(1,-29,46,1); g.fillStyle=S[2]; g.fillRect(1,-28,46,2); g.fillStyle=S[0]; g.fillRect(2,-26,44,1);
  g.fillStyle='#07080b'; g.fillRect(8,-18,30,18); g.fillStyle='#1a1c22'; for(let y=-18;y<0;y+=3) g.fillRect(8,y,30,1);
  for(let x=8;x<38;x++){g.fillStyle=((x+Math.floor(T*4))%6)<3?'#d9a520':'#16130a'; g.fillRect(x,-19,1,1);} // moving hazard strip
  g.fillStyle='#2a2a30'; g.fillRect(32,-44,4,18); g.fillStyle='#4a4a54'; g.fillRect(32,-44,4,1); // stack
  g.fillStyle=Math.floor(T*2)%2?'#ff9a1a':'#5a2a08'; g.fillRect(20,-31,3,2); // beacon
  // conveyor to depot roof hopper
  g.fillStyle='#1c1e24'; g.fillRect(20,-27,18,1); for(let x=20;x<38;x++) if((x+Math.floor(T*10))%3===0){g.fillStyle='#5a5e68';g.fillRect(x,-27,1,1);}
  // headframe over the shaft
  const hx=SHAFT*TILE+6, top=-66, Y=PAL.gun;
  line(g,hx-10,0,hx-3,top,Y[3]); line(g,hx+10,0,hx+3,top,Y[2]); line(g,hx-9,0,hx-2,top,Y[1]);
  for(let k=1;k<6;k++){const y=-k*11, w=Math.round(10-k*1.3); line(g,hx-w,y,hx+w,y,Y[2]); if(k<5) line(g,hx-w,y,hx+w-1,y-11,Y[1]);}
  g.fillStyle=Y[3]; g.fillRect(hx-5,top-2,11,2); g.fillStyle=Y[4]; g.fillRect(hx-5,top-2,11,1);
  const sa=shaftBusy&&!reduced?T*6:T*0.2; // sheave wheel
  for(let a=0;a<6.28;a+=0.2){g.fillStyle=Y[3];g.fillRect(Math.round(hx+Math.cos(a)*5),Math.round(top-6+Math.sin(a)*5),1,1);}
  for(let k=0;k<3;k++){const a=sa+k*2.094; line(g,hx,top-6,hx+Math.cos(a)*4,top-6+Math.sin(a)*4,Y[2]);}
  g.fillStyle=Y[4]; g.fillRect(hx,top-6,1,1);
  g.fillStyle=Math.floor(T*1.5)%2?'#ff2a1a':'#4a0a06'; g.fillRect(hx,top-13,1,2);
  line(g,hx+5,top-6,hx+26,-14,'#55555e'); // cable to winch house
  g.fillStyle=S[2]; g.fillRect(hx+20,-16,16,16); g.fillStyle=S[4]; g.fillRect(hx+20,-17,16,1); g.fillStyle='#0a0a0e'; g.fillRect(hx+24,-10,6,10);
  g.fillStyle=Math.floor(T*3)%3?'#ffd060':'#806020'; g.fillRect(hx+32,-12,2,2);
  // refinery (appears with upgrade, grows with levels)
  const RL=G.up.refinery;
  if(RL>=1){ const rx=120;
    for(let k=0;k<(RL>=3?2:1);k++){const tx=rx+k*16; for(let y=-34;y<0;y++){const b=(y<-30)?Y[4]:Y[3]; g.fillStyle=b; g.fillRect(tx,y,12,1); g.fillStyle=Y[1]; g.fillRect(tx+9,y,3,1); g.fillStyle=Y[2]; g.fillRect(tx+6,y,3,1);} g.fillStyle=Y[0]; g.fillRect(tx,-20,12,1);}
    g.fillStyle='#2a1a14'; g.fillRect(rx+30,-22,16,22); g.fillStyle='#4a2c1c'; g.fillRect(rx+30,-22,16,1);
    const fl=[ '#ff5a10','#ffa020','#ffe080'][Math.floor(T*8)%3]; g.fillStyle='#120806'; g.fillRect(rx+34,-10,8,6); g.fillStyle=fl; g.fillRect(rx+35,-8,6,3);
    g.fillStyle='#2a2a30'; g.fillRect(rx+24,-62,4,62); g.fillStyle='#4a4a54'; g.fillRect(rx+24,-62,4,1);
    if(RL>=6){ g.fillStyle='#3a3a44'; g.fillRect(rx+50,-50,2,50); const fh=4+Math.floor(T*12)%3; g.fillStyle='#ffe080'; g.fillRect(rx+50,-50-fh,2,fh); g.fillStyle='#ff7a10'; g.fillRect(rx+49,-50-fh+1,4,fh-2); }
  }
  // robot bay hangar with one light per slot
  const bx=196; g.fillStyle=S[1]; g.fillRect(bx,-22,46,22); for(let x=0;x<46;x++){const h=Math.round(Math.sqrt(Math.max(0,1-Math.pow((x-23)/23,2)))*8); g.fillStyle=S[3]; g.fillRect(bx+x,-22-h,1,h); g.fillStyle=S[4]; g.fillRect(bx+x,-22-h,1,1);} 
  g.fillStyle='#08090c'; g.fillRect(bx+8,-16,30,16); for(let y=-16;y<0;y+=2){g.fillStyle='#1a1c22';g.fillRect(bx+8,y,30,1);}
  for(let k=0;k<slots();k++){g.fillStyle=k<G.robots.length?(Math.floor(T*2+k)%4?'#5fd068':'#2a5a2a'):'#3a1a1a'; g.fillRect(bx+6+k*4,-20,2,2);}
  // claim posts
  [0,COLS*TILE-1].forEach(x=>{g.fillStyle='#3a2a1a';g.fillRect(x,-10,1,10);g.fillStyle=Math.floor(T*2)%2?'#d9a520':'#6a4a10';g.fillRect(x-1,-11,3,2);});
  // light poles
  [90,170,300].forEach(x=>{g.fillStyle='#2a2a30';g.fillRect(x,-24,1,24);g.fillRect(x,-24,4,1);g.fillStyle='#ffe0a0';g.fillRect(x+3,-23,1,1);});
  g.restore();
}

const SUP_WOOD=['#24160a','#4c3018','#7a5028','#a07038'], SUP_STEEL=['#14181e','#343c48','#5a6676','#a8b4c4'];
const lampPeriod=()=>[0,8,5,3][G.up.lights];
function isLampTile(x,y){
  if(x===SHAFT) return y%6===2;
  const p=lampPeriod(); return p>0 && y>0 && !G.dug[I(x,y-1)] && ((x*7+y*3)%p===0);
}
function R_(x,y,w,h,c){ ctx.fillStyle=c; ctx.fillRect(x,y,w,h); }
function bolt(x,y,u,C){ R_(x,y,u,u,C[3]); R_(x+u,y+u,u,u,C[0]); }
// tunnel furniture; u = one canvas pixel in world units, so zoomed views get finer parts
function drawSupport(X,Y,y,u,D){
  const C=y>=113?SUP_STEEL:SUP_WOOD, steel=y>=113;
  R_(X+1,Y,2,TILE,C[0]); R_(X+9,Y,2,TILE,C[0]); R_(X+1,Y,1,TILE,C[2]); R_(X+9,Y,1,TILE,C[2]);
  R_(X,Y,TILE,2,C[1]); R_(X,Y,TILE,1,C[3]);
  if(D>1){
    if(!steel){ for(let k=1;k<4;k++){ R_(X+1+u,Y+k*3,u,1.5,C[1]); R_(X+9+u,Y+k*3+1,u,1.5,C[1]); } R_(X,Y+1,TILE,u,C[0]); R_(X+4,Y+u,u,1-u,C[0]); R_(X+8,Y+u,u,1-u,C[0]); } // grain + plank seams
    else { R_(X+2-u,Y+2,u,TILE-2,C[3]); R_(X+10-u,Y+2,u,TILE-2,C[3]); }
    bolt(X+1.5,Y+0.5,u,C); bolt(X+9.5,Y+0.5,u,C); bolt(X+1.5,Y+6,u,C); bolt(X+9.5,Y+6,u,C);
    if(D>2){ R_(X+3,Y+2,u,u*2,C[1]); R_(X+8,Y+2,u,u*2,C[1]); } // brackets
  } else if(steel){ R_(X+3,Y+2,1,1,C[1]); R_(X+8,Y+2,1,1,C[1]); }
  else { R_(X+2,Y+5,1,1,C[3]); }
}
function drawLadder(X,Y,y,u,D){
  const C=y>=113?SUP_STEEL:SUP_WOOD;
  R_(X+3,Y,1,TILE,C[1]); R_(X+8,Y,1,TILE,C[1]);
  for(let k=1;k<TILE;k+=4){ R_(X+3,Y+k,6,1,C[2]); if(D>1){ R_(X+3,Y+k,6,u,C[3]); bolt(X+3,Y+k,u,C); bolt(X+8-u,Y+k,u,C); } }
  if(D>1){ R_(X+3,Y,u,TILE,C[3]); R_(X+8,Y,u,TILE,C[3]); }
}
function drawShaftRails(X,Y,y,u,D){
  const C=SUP_STEEL;
  R_(X+1,Y,1,TILE,C[2]); R_(X+10,Y,1,TILE,C[2]); R_(X+2,Y,1,TILE,C[1]); R_(X+9,Y,1,TILE,C[1]);
  if(y%2===0) R_(X+1,Y+11,10,1,C[1]);
  if(D>1){ R_(X+1,Y,u,TILE,C[3]); R_(X+10,Y,u,TILE,C[3]); for(let k=0;k<TILE;k+=3){ bolt(X+1.5,Y+k,u,C); bolt(X+9.5,Y+k,u,C); }
    if(y%2===0){ R_(X+1,Y+11,10,u,C[3]); for(let i=2;i<10;i+=2) R_(X+i,Y+11.5,u,u,C[0]); }
    R_(X+6,Y,u,TILE,'#3a3a40'); R_(X+6+u,Y,u,TILE,'#5a5a62'); } // hoist cable
}
function drawTiles(cx,cy,vw,vh,T,L,D){
  const u=1/Math.max(1,D);
  const x0=Math.floor(cx/TILE)-1, x1=Math.floor((cx+vw)/TILE)+1, y0=Math.max(0,Math.floor(cy/TILE)), y1=Math.min(ROWS-1,Math.floor((cy+vh)/TILE));
  const drill=new Map(); G.robots.forEach(r=>{ if(r.st==='drill'&&r.job) drill.set(I(r.job.x,r.job.y),r); });
  const TD=TILE*D;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const inC=x>=0&&x<COLS, si=stratAt(x,y), sx=(((x%8)+8)%8)*TD, sy=(y%8)*TD, X=x*TILE, Y=y*TILE, k=inC?I(x,y):-1;
    const dug=inC&&G.dug[k];
    if(dug){
      ctx.drawImage(L.back[si],sx,sy,TD,TD,X,Y,TILE,TILE);
      const Lf=isDug(x-1,y), Rt=isDug(x+1,y), U=isDug(x,y-1), Dn=isDug(x,y+1);
      if(x===SHAFT) drawShaftRails(X,Y,y,u,D);
      else if(((U||Dn)&&!Lf&&!Rt) || (G.lad&&G.lad[k])) drawLadder(X,Y,y,u,D);
      else if(y>=3 && !U && (Lf||Rt) && x%3===0) drawSupport(X,Y,y,u,D);
      else if(y===0){ R_(X,Y,TILE,2,SUP_WOOD[1]); R_(X,Y,TILE,1,SUP_WOOD[3]); if(D>1){ R_(X+4,Y+u,u,2-u,SUP_WOOD[0]); R_(X+8,Y+u,u,2-u,SUP_WOOD[0]); } } // plank walkway over a hole at the surface
      if(!Dn){ R_(X,Y+TILE-1,TILE,1,STRATA[si].pal[3]); if(D>1){ for(let i=0;i<TILE;i+=u*3) if(hash2(x*97+Math.round(i*D),y,13)>0.6) R_(X+i,Y+TILE-1-u,u,u,STRATA[si].pal[2]); } } // floor rubble
      if(isLampTile(x,y)){ R_(X+4,Y,4,1,'#2a2a30'); R_(X+5,Y+1,2,1,'#ffe9a8'); if(D>1){ R_(X+4,Y+1,u,1,'#2a2a30'); R_(X+8-u,Y+1,u,1,'#2a2a30'); R_(X+5,Y+1,u,u,'#ffffff'); R_(X+4,Y+2-u,4,u,'#2a2a30'); } }
      continue;
    }
    ctx.drawImage(L.front[si],sx,sy,TD,TD,X,Y,TILE,TILE);
    if(inC){
      const o=W.ore[k];
      if(o){ ctx.drawImage(L.ore[o-1][(x*3+y*5)&3],X,Y,TILE,TILE);
        const C=FINDS[o-1].col, ph=Math.floor(T*3+x*1.7+y*2.3)%6; if(ph<2) R_(X+3+ph*4,Y+3+((x+y)%5),u*Math.max(1,D>>1),u*Math.max(1,D>>1),C[3]); }
      if(W.deco[k]===1) ctx.drawImage(L.crystal,X,Y,TILE,TILE);
      const pal=STRATA[si].pal;
      if(isDug(x,y-1)){ R_(X,Y,TILE,1,pal[3]); if(D>1) R_(X,Y,TILE,u,shade(STRATA[si].pal[3],1.25));
        if(y===0) grass(X,Y,x,u,D); }
      if(isDug(x,y+1)){ R_(X,Y+TILE-2,TILE,2,pal[0]); for(let i=0;i<TILE;i+=3) if(hash2(x*TILE+i,y,6)>0.5) R_(X+i,Y+TILE-3,1,1,pal[0]);
        if(D>1) for(let i=0;i<TILE;i+=u*2) if(hash2(x*97+Math.round(i*D),y,7)>0.55) R_(X+i,Y+TILE-2-u*Math.ceil(hash2(i*D,y,8)*D*1.5),u,u*2,pal[0]); } // stalactite fringe
      if(isDug(x-1,y)){ R_(X,Y,1,TILE,pal[3]); }
      if(isDug(x+1,y)){ R_(X+TILE-1,Y,1,TILE,pal[0]); }
      const dr=drill.get(k);
      if(dr){ const n=Math.floor(dr.prog*14*D); ctx.fillStyle=dr.tier===5?'#000':'#050404';
        for(let i=0;i<n;i++){ const a=hash2(k,i,8), b=hash2(k,i,9); ctx.fillRect(X+Math.floor(a*TILE*D)/D,Y+Math.floor(b*TILE*D)/D,(dr.tier===5?2:1)*Math.max(u,u*Math.ceil(D/2)),Math.max(u,u*Math.ceil(D/2))); } }
    } else if(y===0) grass(X,Y,x,u,D);
  }
  if(y1>=ROWS-1) R_(cx-5,ROWS*TILE,vw+10,vh,'#000');
  ctx.fillStyle='rgba(4,3,6,0.45)'; const gy=Math.max(0,cy);
  if(cx<0) ctx.fillRect(cx,gy,-cx,vh); if(cx+vw>COLS*TILE) ctx.fillRect(COLS*TILE,gy,cx+vw-COLS*TILE,vh);
}
function grass(X,Y,x,u,D){
  const n=TILE*D;
  for(let i=0;i<n;i++){ const wx=x*n+i, hgt=(1+Math.floor(hash2(wx,0,5)*3*D))*u; ctx.fillStyle=hash2(wx,1,5)>0.5?'#3c4a22':'#55602c'; ctx.fillRect(X+i*u,Y-hgt+u,u,hgt);
    if(D>1&&hash2(wx,2,5)>0.9){ ctx.fillStyle='#7a8640'; ctx.fillRect(X+i*u,Y-hgt+u,u,u); } }
}
// sprite tint cache for tier-up white silhouette
const WHITE=new WeakMap();
function whiteOf(c){let w=WHITE.get(c); if(w) return w; const s=mk(c.width,c.height); s.g.drawImage(c,0,0); s.g.globalCompositeOperation='source-in'; s.g.fillStyle='#ffffff'; s.g.fillRect(0,0,c.width,c.height); WHITE.set(c,s.c); return s.c;}
function robotDrawInfo(r,tier){
  const f=Math.floor(r.anim)&7, st=r.st==='drill'?'drill':r.st==='move'?'move':'idle';
  const top=r.cargo.length?r.cargo[r.cargo.length-1][0]:0, D=RV.D;
  return D>1? robotSpriteLOD(tier,f,st,r.cargo.length/hopCap(r),FINDS[top].col,D) : robotSprite(tier,f,st,r.cargo.length/hopCap(r),FINDS[top].col);
}
const snap=v=>Math.round(v*RV.Z)/RV.Z;
function blitRobot(r,spr,alpha,white,ox){
  const D=spr.D||1, w=spr.c.width/D, h=spr.c.height/D, ax=spr.ax/D, ay=spr.ay/D;
  const bob=(r.tier===3||r.tier===5)?(2+((Math.floor(r.anim/2))%4<2?1:0)):0;
  const img=white?whiteOf(spr.c):spr.c, x=snap(r.x+(ox||0)), y=snap(r.y-ay-1-bob);
  const jit=(r.st==='drill'&&!reduced&&r.tier<4)?((Math.floor(r.anim)%2))/Math.max(1,D>>1):0;
  ctx.save(); ctx.globalAlpha=alpha;
  if(r.vdir && r.st==='drill' && r.tier<2){ ctx.translate(x,snap(r.y-6)); ctx.rotate(r.vdir==='d'?Math.PI/2:-Math.PI/2); if(r.face<0) ctx.scale(1,-1); ctx.drawImage(img,-ax,-Math.round(ay/2)-2+jit,w,h); }
  else if(r.face<0){ ctx.translate(x,0); ctx.scale(-1,1); ctx.drawImage(img,-ax+jit,y,w,h); }
  else ctx.drawImage(img,x-ax+jit,y,w,h);
  ctx.restore();
}
function drawRobots(cx,cy,vw,vh,T){
  const u=1/RV.D, share=new Map();
  G.robots.forEach(r=>{ const k=r.tx+','+r.ty; share.set(k,(share.get(k)||0)+1); r._slot=share.get(k)-1; });
  G.robots.forEach(r=>{
    if(r.x<cx-40||r.x>cx+vw+40||r.y<cy-20||r.y>cy+vh+50) return;
    const n=share.get(r.tx+','+r.ty), ox=n>1?(r._slot-(n-1)/2)*Math.min(4,8/n):0; // spread robots sharing a tile
    // the lift cage holds any robot in the shaft (riding, drilling or waiting), and meets one walking in
    const toShaft=r.st==='move'&&r.path.length&&r.path[0][0]===SHAFT&&r.path[0][1]>=0;
    if((r.tx===SHAFT && r.ty>=0) || toShaft){ const x=SHAFT*TILE+6-7, y=snap(r.tx===SHAFT?r.y:r.path[0][1]*TILE+TILE)-15, C=SUP_STEEL;
      R_(x,y,15,1,C[3]); R_(x,y+15,15,1,C[3]); R_(x,y,1,15,C[2]); R_(x+14,y,1,15,C[2]);
      if(RV.D>1){ for(let i=2;i<14;i+=2) R_(x+i,y+1,u,14,C[1]); R_(x,y,15,u,'#d8e4f0'); bolt(x,y,u,C); bolt(x+14-u,y,u,C); bolt(x,y+15-u,u,C); bolt(x+14-u,y+15-u,u,C); R_(x+3,y+1,9,u,'#d9a520'); }
      R_(x+7,-60,1,Math.max(0,y+60),'#55555e'); if(RV.D>1) R_(x+7,-60,u,Math.max(0,y+60),'#8a8a94'); }
    if(r.tfx){ const q=r.tfx.t/r.tfx.d;
      if(reduced){ blitRobot(r,robotDrawInfo(r,r.tfx.from),1-q,false,ox); blitRobot(r,robotDrawInfo(r,r.tier),q,false,ox); return; }
      if(q<0.45){ const old=robotDrawInfo(r,r.tfx.from); r.anim+=0.6; blitRobot(r,old,1,Math.floor(q*40)%2===0,ox);
        for(let i=0;i<10;i++){const a=i*0.628+q*9, d=(1-q/0.45)*30; R_(snap(r.x+Math.cos(a)*d),snap(r.y-8+Math.sin(a)*d),2,2,i%2?'#ffffff':'#ffd060');} }
      else blitRobot(r,robotDrawInfo(r,r.tier),1,q<0.6,ox);
      return; }
    blitRobot(r,robotDrawInfo(r,r.tier),1,false,ox);
    const top=snap(r.y)-24-(r.tier>=4?10:0), mx=Math.round(r.x+ox);
    if(r.rar>0) R_(mx-1,top,3,1,RAR[r.rar].c);
    if(UI.sel===r.id){ const b=Math.floor(T*4)%2; R_(mx-1,top-1-b,3,1,'#ffe28a'); R_(mx,top-b,1,1,'#ffe28a'); }
  });
}
function drawParticles(emis){
  const D=RV.D, fine=D>1?0.5:1;
  PT.forEach(p=>{ if(p.l<0) return; const e=(p.k===1||p.k===3||p.k===5||p.k===7); if(e!==emis) return;
    if(p.x<RV.cx-4||p.y<RV.cy-4||p.x>RV.cx+viewW()+4||p.y>RV.cy+viewH()+4) return;
    const x=snap(p.x), y=snap(p.y);
    if(p.k===3){ ctx.globalAlpha=0.5*(1-Math.abs(p.l/p.m*2-1)); }
    if(p.k===4){ const q=p.l/p.m, s=1+Math.floor(q*4); ctx.globalAlpha=q<0.7?0.9:0.45; R_(x,y,s,s,p.c); ctx.globalAlpha=1; return; }
    const sz=(p.k===6||p.k===7)?2*fine:fine; R_(x,y,sz,sz,p.c); ctx.globalAlpha=1;
  });
}
function darkA(row){ return row<0?0: row<1?0.25: row<3?0.42: row<6?0.58: row<113?0.74: 0.8; }
function drawDarkness(cx,cy,vw,vh,T){
  const d=DARK.g, Z=RV.Z, Sd=Math.min(RV.D,2);
  d.setTransform(1,0,0,1,0,0); d.globalCompositeOperation='source-over'; d.clearRect(0,0,VW,VH);
  d.setTransform(Z,0,0,Z,-cx*Z,-cy*Z);
  const r0=Math.floor(cy/TILE), r1=Math.floor((cy+vh)/TILE);
  for(let row=r0;row<=r1;row++){ const a=darkA(row); if(a<=0) continue; d.fillStyle='rgba(4,3,8,'+a+')'; d.fillRect(cx-2,row*TILE,vw+4,TILE); }
  d.globalCompositeOperation='destination-out';
  const st=(img,x,y)=>d.drawImage(img,x-img.width/(2*Sd),y-img.height/(2*Sd),img.width/Sd,img.height/Sd);
  G.robots.forEach(r=>{ if(r.y<cy-80||r.y>cy+vh+80) return; const R=lampR(r), dir=r.st==='drill'&&r.vdir?r.vdir:(r.face>0?'r':'l');
    st(stamp(R*Sd,dir),r.x+r.face*2,r.y-7); if(r.tier>=3) st(stamp((14+r.tier*3)*Sd),r.x,r.y-8); });
  const x0=Math.max(0,Math.floor(cx/TILE)-2), x1=Math.min(COLS-1,Math.floor((cx+vw)/TILE)+2), y0=Math.max(0,r0-2), y1=Math.min(ROWS-1,r1+2);
  const lr=[22,22,26,30][G.up.lights];
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const k=I(x,y);
    if(G.dug[k]){ if(isLampTile(x,y)) st(stamp(lr*Sd),x*TILE+6,y*TILE+4); }
    else if(W.deco[k]===1) st(stamp(9*Sd),x*TILE+6,y*TILE+6);
    else if(W.deco[k]===2) st(stamp(9*Sd),x*TILE+6,y*TILE+6);
    else if(W.ore[k]&&FINDS[W.ore[k]-1].glow) st(stamp(7*Sd),x*TILE+6,y*TILE+6);
  }
  RG.forEach(g=>st(stamp(Math.max(4,Math.round(g.R*(g.t/g.m)))*Sd),g.x,g.y));
  d.globalCompositeOperation='source-over'; d.setTransform(1,0,0,1,0,0);
  ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(DARK.c,0,0); ctx.restore();
}
function drawEmissive(cx,cy,vw,vh,T,L,D){
  const x0=Math.max(0,Math.floor(cx/TILE)-1), x1=Math.min(COLS-1,Math.floor((cx+vw)/TILE)+1), y0=Math.max(0,Math.floor(cy/TILE)), y1=Math.min(ROWS-1,Math.floor((cy+vh)/TILE));
  const pulse=[0.4,0.55,0.7,0.55][Math.floor(T*2)%4], SL=G.up.scanner, TD=TILE*D, u=1/D;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const k=I(x,y); if(G.dug[k]) continue; const X=x*TILE, Y=y*TILE, si=W.strat[k];
    if(STRATA[si].f==='magma'||STRATA[si].f==='rift'){ ctx.globalAlpha=pulse; ctx.drawImage(L.emis[si],(x%8)*TD,(y%8)*TD,TD,TD,X,Y,TILE,TILE); ctx.globalAlpha=1; }
    const o=W.ore[k];
    if(o){ const f=FINDS[o-1];
      if(f.glow){ ctx.globalAlpha=pulse*0.8; ctx.drawImage(L.ore[o-1][(x*3+y*5)&3],X,Y,TILE,TILE); ctx.globalAlpha=1; }
      else if(SL>=2 || (SL>=1 && y<=G.deepest+10)){ ctx.globalAlpha=0.35+0.25*(Math.floor(T*2+x)%2); R_(X+5,Y+5,2,2,f.col[2]); ctx.globalAlpha=1; }
      if(SL>=3 && W.rich[k] && Math.floor(T*4+x*3+y)%8<2){ R_(X+1,Y+1,1,1,'#fff3a0'); R_(X+10,Y+10,1,1,'#fff3a0'); }
    }
    if(W.deco[k]===2){ ctx.globalAlpha=[0.6,0.8,1,0.8][Math.floor(T*2+x)%4]; ctx.drawImage(L.lava,X,Y,TILE,TILE); ctx.globalAlpha=1; }
    if(W.deco[k]===1&&Math.floor(T*2+x+y)%4===2){ ctx.globalAlpha=0.6; ctx.drawImage(L.crystal,X,Y,TILE,TILE); ctx.globalAlpha=1; }
  }
  G.robots.forEach(r=>{ if(r.y<cy-60||r.y>cy+vh+60) return;
    if(r.st==='drill'&&r.job&&!r.tfx){ const tx=r.job.x*TILE+6, ty=r.job.y*TILE+6, sx=snap(r.x), sy=snap(r.y);
      if(r.tier===2){ const ox=sx+r.face*12; [-9,-6,-1].forEach((o,i)=>{ beam(ox,sy+o-2,tx-(r.job.x-r.tx)*3,ty+(i-1)*2,[Math.floor(T*20+i)%2?'#ff3030':'#ffb0a0'],u); }); }
      if(r.tier===3){ const ox=sx+r.face*15, oy=sy-11; beam(ox,oy-1,tx,ty-1,['#8a3ad0'],u); beam(ox,oy,tx,ty,['#e080ff'],u); beam(ox,oy,tx,ty,['#ffffff'],u*Math.max(1,D>>1)); }
      if(r.tier===5 && !reduced){ ctx.save(); ctx.setTransform(1,0,0,1,0,0); const Z=RV.Z, X=(tx-cx)*Z, Y=(ty-cy)*Z;
        for(let i=0;i<3;i++){ const yy=Math.round(Y-8*Z+Math.random()*16*Z), w=Math.round((6+Math.random()*10)*Z), off=Math.round((Math.random()*6-3)*Z); ctx.drawImage(cv,Math.round(X-w/2),yy,w,2*Z,Math.round(X-w/2)+off,yy,w,2*Z);} ctx.restore(); R_(tx-1,ty-1,2,2,'#ff5cf0'); }
    }
  });
  RG.forEach(g=>{ const q=g.t/g.m, R=g.R*q; ctx.globalAlpha=q<0.5?1:0.6; const n=Math.max(8,R*3*D); for(let i=0;i<n;i++){const a=i/n*6.283; R_(snap(g.x+Math.cos(a)*R),snap(g.y+Math.sin(a)*R),Math.max(u,1/Math.max(1,D>>1)),Math.max(u,1/Math.max(1,D>>1)),g.c);} ctx.globalAlpha=1; });
}
function beam(x0,y0,x1,y1,cols,w){ const n=Math.max(2,Math.ceil(Math.hypot(x1-x0,y1-y0)/w)); ctx.fillStyle=cols[0]; for(let i=0;i<=n;i++){ const t=i/n; ctx.fillRect(snap(x0+(x1-x0)*t),snap(y0+(y1-y0)*t),w,w); } }
function drawMarks(cx,cy,vw,vh,T){
  const Z=RV.Z, th=Math.max(1,Math.round(Z/2));
  const x0=Math.max(0,Math.floor(cx/TILE)), x1=Math.min(COLS-1,Math.floor((cx+vw)/TILE)), y0=Math.max(0,Math.floor(cy/TILE)), y1=Math.min(ROWS-1,Math.floor((cy+vh)/TILE));
  const bt=TIERS[bestTier()].dig, ph=Math.floor(T*10);
  ctx.save(); ctx.setTransform(1,0,0,1,0,0);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const k=I(x,y); if(!G.mark[k]||G.dug[k]) continue;
    const dx=Math.round((x*TILE-cx)*Z), dy=Math.round((y*TILE-cy)*Z), S=Math.round(((x+1)*TILE-cx)*Z)-dx, bad=hardAt(k)>bt, lone=!CONN[k], c1=bad?'#ff3b3b':lone?'#9a9080':'#ffd23a';
    ctx.fillStyle=bad?'rgba(255,40,40,0.16)':lone?'rgba(160,150,130,0.10)':'rgba(255,210,58,0.14)'; ctx.fillRect(dx,dy,S,S);
    const up=y>0&&G.mark[k-COLS]&&!G.dug[k-COLS], dn=y<ROWS-1&&G.mark[k+COLS]&&!G.dug[k+COLS], lf=x>0&&G.mark[k-1]&&!G.dug[k-1], rt=x<COLS-1&&G.mark[k+1]&&!G.dug[k+1];
    const seg=4*th;
    for(let i=0;i<S;i+=th){ const on=((Math.floor((i+(ph+x*TILE+y*TILE)*th)/(seg/2)))%2)===0; ctx.fillStyle=on?c1:'#1a1406';
      if(!up) ctx.fillRect(dx+i,dy,th,th); if(!dn) ctx.fillRect(dx+i,dy+S-th,th,th); if(!lf) ctx.fillRect(dx,dy+i,th,th); if(!rt) ctx.fillRect(dx+S-th,dy+i,th,th); }
    if(bad && (x+y)%2===0){ ctx.fillStyle='#ff3b3b'; for(let i=Math.round(S*0.25);i<Math.round(S*0.75);i+=th){ctx.fillRect(dx+i,dy+i,th,th);ctx.fillRect(dx+S-th-i,dy+i,th,th);} }
  }
  if(!G.tut){
    const b=Math.floor(T*3)%2; [[6,1],[7,1],[6,2],[7,2],[8,2]].forEach(([x,y])=>{ if(G.dug[I(x,y)]) return; ctx.fillStyle=b?'#ffd23a':'#8a6a10'; const dx=Math.round((x*TILE-cx)*Z), dy=Math.round((y*TILE-cy)*Z), S=TILE*Z; ctx.fillRect(dx,dy,S,th); ctx.fillRect(dx,dy+S-th,S,th); ctx.fillRect(dx,dy,th,S); ctx.fillRect(dx+S-th,dy,th,S); });
    drawText(ctx,'TAP',Math.round((7*TILE-cx)*Z)-6,Math.round((TILE-cy)*Z)-14-b,1,'#ffd23a','#000'); }
  ctx.restore();
}
function drawFloats(cx,cy){
  const Z=RV.Z;
  FL.forEach(f=>{ const q=f.t/f.m, y=Math.round((f.y-cy)*Z-(reduced?0:q*16)), w=textW(f.txt,1); ctx.globalAlpha=q>0.75?0.5:1; drawText(ctx,f.txt,Math.round((f.x-cx)*Z-w/2),y,1,f.c,'#000'); ctx.globalAlpha=1; });
}
let titleCache=null, GLINT=null;
function titleArt(){
  if(titleCache) return titleCache;
  const word='MINE', B=7, w=textW(word,B), H=7*B, s=mk(w+4,H+4), col=['#140b07','#3e2014','#6e3a20','#a0602f','#e8b47c'];
  const M=new Uint8Array((w+4)*(H+4)), at=(x,y)=>x>=0&&y>=0&&x<w+4&&y<H+4&&M[y*(w+4)+x];
  for(let i=0;i<word.length;i++){const m=FONT[word[i]]; for(let k=0;k<35;k++) if(m[k]==='1'){
    const gx=2+i*6*B+(k%5)*B, gy=2+Math.floor(k/5)*B; for(let y=0;y<B;y++)for(let x=0;x<B;x++) M[(gy+y)*(w+4)+gx+x]=1; }}
  // erode edges: bites out of the rim
  const E=M.slice();
  for(let y=0;y<H+4;y++)for(let x=0;x<w+4;x++){ if(!M[y*(w+4)+x]) continue; const edge=!at(x-1,y)||!at(x+1,y)||!at(x,y-1)||!at(x,y+1);
    if(edge && hash2(x>>1,y>>1,23)<0.16) E[y*(w+4)+x]=0; }
  M.set(E);
  for(let y=0;y<H+4;y++)for(let x=0;x<w+4;x++){ if(!at(x,y)) continue; const ly=(y-2)/H;
    let c= !at(x,y-1)?col[4] : !at(x,y+1)?col[0] : !at(x+1,y)?col[1] : ly<0.3?col[3]: ly<0.62?col[2]: col[1];
    if(at(x,y-1)&&!at(x-1,y)&&ly<0.62) c=col[3];
    P(s,x,y,c); }
  const r=mulberry32(5); // cracks + dents
  for(let k=0;k<7;k++){ let x=4+Math.floor(r()*(w-6)), y=4+Math.floor(r()*(H-6)); for(let n=0;n<6+r()*6;n++){ if(at(x,y)&&at(x,y-1)&&at(x,y+1)) P(s,x,y,col[0]); x+=r()<0.5?1:-1; y+=1; } }
  for(let k=0;k<14;k++){ const x=3+Math.floor(r()*(w-4)), y=3+Math.floor(r()*(H-4)); if(at(x,y)&&at(x+1,y+1)&&at(x,y-1)){ P(s,x,y,col[0]); P(s,x+1,y+1,col[3]); } }
  outlineSprite(s,'#000000');
  return titleCache=s.c;
}
function drawTitle(T){
  const img=titleArt(), x=Math.round((VW-img.width)/2), y=Math.max(8,Math.round(-cam.y)-img.height-38);
  ctx.drawImage(img,x,y);
  if(!reduced){ // glint sweep
    const gx=Math.floor((T*60)%(img.width+120))-60;
    const sub=GLINT||(GLINT=mk(img.width,img.height)); sub.g.globalCompositeOperation='source-over'; sub.g.clearRect(0,0,img.width,img.height); sub.g.drawImage(img,0,0); sub.g.globalCompositeOperation='source-atop'; sub.g.fillStyle='rgba(255,240,200,0.55)';
    for(let yy=0;yy<img.height;yy++) sub.g.fillRect(gx+Math.floor(yy/2),yy,4,1);
    ctx.drawImage(sub.c,x,y);
    if(Math.random()<0.3) spawn({x:cam.x+x+Math.random()*img.width,y:cam.y+y+img.height-4,vx:0,vy:10,l:0,m:1.5,c:'#6a5442',k:0});
  }
  return {x,y,w:img.width,h:img.height};
}
function render(T, mode){
  const Z=ZOOM.z, D=ZOOM.t, L=lod(D), vw=VW/Z, vh=VH/Z;
  const sh=shake>0&&!reduced?shakeMag:0, ox=sh?Math.round(rnd(-sh,sh)):0, oy=sh?Math.round(rnd(-sh,sh)):0;
  const cx=(Math.round(cam.x*Z)+ox)/Z, cy=(Math.round(cam.y*Z)+oy)/Z;
  RV.cx=cx; RV.cy=cy; RV.Z=Z; RV.D=D;
  ctx.setTransform(1,0,0,1,0,0); ctx.imageSmoothingEnabled=false; ctx.fillStyle='#000'; ctx.fillRect(0,0,VW,VH);
  if(cy<0){ ctx.setTransform(Z,0,0,Z,0,0); drawSky(cx,cy,T,vw); }
  ctx.setTransform(Z,0,0,Z,-cx*Z,-cy*Z);
  if(cy<0) drawSurface(T);
  drawTiles(cx,cy,vw,vh,T,L,D);
  drawParticles(false);
  drawRobots(cx,cy,vw,vh,T);
  if(!ADMIN.reveal) drawDarkness(cx,cy,vw,vh,T);
  ctx.setTransform(Z,0,0,Z,-cx*Z,-cy*Z);
  drawEmissive(cx,cy,vw,vh,T,L,D);
  drawParticles(true);
  if(mode==='game') drawMarks(cx,cy,vw,vh,T);
  ctx.setTransform(1,0,0,1,0,0);
  drawFloats(cx,cy);
  if(mode==='title') drawTitle(T);
  if(flash){ const q=flash.t/flash.m; ctx.globalAlpha=flash.a*(q<0.5?1:0.5); ctx.fillStyle=flash.c; ctx.fillRect(0,0,VW,VH); ctx.globalAlpha=1; }
}
