'use strict';
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
let SC=3, VW=400, VH=240;
const DARK=mk(4,4);
const cam={x:0,y:-60,tx:0,ty:-60};
let shake=0, shakeMag=0, flash=null;

function resize(){
  const w=innerWidth, h=innerHeight;
  SC = w<760 ? 2 : Math.max(2,Math.floor(Math.min(w/400,h/250)));
  VW=Math.ceil(w/SC); VH=Math.ceil(h/SC);
  cv.width=VW; cv.height=VH; cv.style.width=VW*SC+'px'; cv.style.height=VH*SC+'px';
  DARK.c.width=VW; DARK.c.height=VH; ctx.imageSmoothingEnabled=false;
  clampCam(true);
}
function camBounds(){
  const wx=COLS*TILE; let x0,x1;
  if(VW>=wx){ x0=x1=-Math.floor((VW-wx)/2); } else { x0=-10; x1=wx-VW+10; }
  return {x0,x1,y0:-SKY*TILE-10,y1:ROWS*TILE-VH+30};
}
function clampCam(snap){
  const b=camBounds();
  cam.tx=Math.max(b.x0,Math.min(b.x1,cam.tx)); cam.ty=Math.max(b.y0,Math.min(b.y1,cam.ty));
  if(snap){cam.x=cam.tx; cam.y=cam.ty;}
  cam.x=Math.max(b.x0,Math.min(b.x1,cam.x)); cam.y=Math.max(b.y0,Math.min(b.y1,cam.y));
}
function camUpdate(dt){
  clampCam(false);
  if(reduced){ cam.x=cam.tx; cam.y=cam.ty; return; }
  const k=1-Math.exp(-dt*10); cam.x+=(cam.tx-cam.x)*k; cam.y+=(cam.ty-cam.y)*k;
}

// ================= PARTICLES / FX =================
const PT=[], FL=[], RG=[];
function spawn(o){ if(PT.length>=(reduced?70:900)) return; PT.push(o); }
const rnd=(a,b)=>a+Math.random()*(b-a);
const FX = {
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
  const x0=Math.floor(cam.x/TILE), y0=Math.max(1,Math.floor(cam.y/TILE)), cols=Math.ceil(VW/TILE)+1, rows=Math.ceil(VH/TILE)+1;
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
function drawSky(cx,cy,T){
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
function drawSurface(cx,cy,T){
  const g=ctx; g.save(); g.translate(-cx,-cy);
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
function drawTiles(cx,cy,T){
  const x0=Math.floor(cx/TILE)-1, x1=Math.floor((cx+VW)/TILE)+1, y0=Math.max(0,Math.floor(cy/TILE)), y1=Math.min(ROWS-1,Math.floor((cy+VH)/TILE));
  const drill=new Map(); G.robots.forEach(r=>{ if(r.st==='drill'&&r.job) drill.set(I(r.job.x,r.job.y),r); });
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const inC=x>=0&&x<COLS, si=stratAt(x,y), sx=(((x%8)+8)%8)*TILE, sy=(y%8)*TILE, dx=x*TILE-cx, dy=y*TILE-cy, k=inC?I(x,y):-1;
    const dug=inC&&G.dug[k];
    if(dug){
      ctx.drawImage(ART.back[si],sx,sy,TILE,TILE,dx,dy,TILE,TILE);
      const L=isDug(x-1,y), Rr=isDug(x+1,y), U=isDug(x,y-1), D=isDug(x,y+1);
      if(x===SHAFT){ // elevator rails + braces
        ctx.fillStyle=SUP_STEEL[2]; ctx.fillRect(dx+1,dy,1,TILE); ctx.fillRect(dx+10,dy,1,TILE); ctx.fillStyle=SUP_STEEL[1]; ctx.fillRect(dx+2,dy,1,TILE); ctx.fillRect(dx+9,dy,1,TILE);
        if(y%2===0){ctx.fillStyle=SUP_STEEL[1]; ctx.fillRect(dx+1,dy+11,10,1);} 
      } else if((U||D)&&!L&&!Rr){ // ladder
        const C=y>=113?SUP_STEEL:SUP_WOOD; ctx.fillStyle=C[1]; ctx.fillRect(dx+3,dy,1,TILE); ctx.fillRect(dx+8,dy,1,TILE);
        ctx.fillStyle=C[2]; for(let k2=1;k2<TILE;k2+=4) ctx.fillRect(dx+3,dy+k2,6,1);
      } else if(y>=3 && !U && (L||Rr) && x%3===0){ // timber / steel supports
        const C=y>=113?SUP_STEEL:SUP_WOOD;
        ctx.fillStyle=C[0]; ctx.fillRect(dx+1,dy,2,TILE); ctx.fillRect(dx+9,dy,2,TILE);
        ctx.fillStyle=C[2]; ctx.fillRect(dx+1,dy,1,TILE); ctx.fillRect(dx+9,dy,1,TILE);
        ctx.fillStyle=C[1]; ctx.fillRect(dx,dy,TILE,2); ctx.fillStyle=C[3]; ctx.fillRect(dx,dy,TILE,1);
        if(y>=113){ctx.fillStyle=C[1]; ctx.fillRect(dx+3,dy+2,1,1); ctx.fillRect(dx+8,dy+2,1,1);} 
      }
      if(!D){ ctx.fillStyle=STRATA[si].pal[3]; ctx.fillRect(dx,dy+TILE-1,TILE,1); }
      if(isLampTile(x,y)){ ctx.fillStyle='#2a2a30'; ctx.fillRect(dx+4,dy,4,1); ctx.fillStyle='#ffe9a8'; ctx.fillRect(dx+5,dy+1,2,1); }
      continue;
    }
    ctx.drawImage(ART.front[si],sx,sy,TILE,TILE,dx,dy,TILE,TILE);
    if(inC){
      const o=W.ore[k];
      if(o){ ctx.drawImage(ART.ore[o-1][(x*3+y*5)&3],dx,dy);
        const C=FINDS[o-1].col, ph=Math.floor(T*3+x*1.7+y*2.3)%6; if(ph<2){ctx.fillStyle=C[3]; ctx.fillRect(dx+3+ph*4,dy+3+((x+y)%5),1,1);} }
      if(W.deco[k]===1){ const ph=Math.floor(T*2+x+y)%4; ctx.fillStyle=['#2a6a8a','#4ab0d0','#9ae8ff','#4ab0d0'][ph]; ctx.fillRect(dx+3,dy+6,1,4); ctx.fillRect(dx+5,dy+4,1,6); ctx.fillRect(dx+7,dy+7,1,3); ctx.fillStyle='#e0faff'; ctx.fillRect(dx+5,dy+4,1,1);} 
      // rims where rock meets tunnel
      const pal=STRATA[si].pal;
      if(isDug(x,y-1)){ ctx.fillStyle=pal[3]; ctx.fillRect(dx,dy,TILE,1); if(y===0){ for(let i=0;i<TILE;i++){const hgt=1+Math.floor(hash2(x*TILE+i,0,5)*3); ctx.fillStyle=hash2(x*TILE+i,1,5)>0.5?'#3c4a22':'#55602c'; ctx.fillRect(dx+i,dy-hgt+1,1,hgt);} } }
      if(isDug(x,y+1)){ ctx.fillStyle=pal[0]; ctx.fillRect(dx,dy+TILE-2,TILE,2); for(let i=0;i<TILE;i+=3) if(hash2(x*TILE+i,y,6)>0.5) ctx.fillRect(dx+i,dy+TILE-3,1,1); }
      if(isDug(x-1,y)){ ctx.fillStyle=pal[3]; ctx.fillRect(dx,dy,1,TILE); }
      if(isDug(x+1,y)){ ctx.fillStyle=pal[0]; ctx.fillRect(dx+TILE-1,dy,1,TILE); }
      const dr=drill.get(k);
      if(dr){ // cracks grow with progress
        const n=Math.floor(dr.prog*14); ctx.fillStyle=dr.tier===5?'#000':'#050404';
        for(let i=0;i<n;i++){ const a=hash2(k,i,8), b=hash2(k,i,9); ctx.fillRect(dx+Math.floor(a*TILE),dy+Math.floor(b*TILE),dr.tier===5?2:1,1); }
      }
    } else if(y===0){ for(let i=0;i<TILE;i++){const hgt=1+Math.floor(hash2(x*TILE+i,0,5)*3); ctx.fillStyle=hash2(x*TILE+i,1,5)>0.5?'#3c4a22':'#55602c'; ctx.fillRect(dx+i,dy-hgt+1,1,hgt);} }
  }
  if(y1>=ROWS-1){ ctx.fillStyle='#000'; ctx.fillRect(0,ROWS*TILE-cy,VW,VH); }
  // dim everything outside the claim
  ctx.fillStyle='rgba(4,3,6,0.45)';
  const lx=-cx, rx=COLS*TILE-cx, gy=Math.max(0,-cy);
  if(lx>0) ctx.fillRect(0,gy,lx,VH); if(rx<VW) ctx.fillRect(rx,gy,VW-rx,VH);
}
// sprite tint cache for tier-up white silhouette
const WHITE=new WeakMap();
function whiteOf(c){let w=WHITE.get(c); if(w) return w; const s=mk(c.width,c.height); s.g.drawImage(c,0,0); s.g.globalCompositeOperation='source-in'; s.g.fillStyle='#ffffff'; s.g.fillRect(0,0,c.width,c.height); WHITE.set(c,s.c); return s.c;}
function robotDrawInfo(r,tier){
  const f=Math.floor(r.anim)&7, st=r.st==='drill'?'drill':r.st==='move'?'move':'idle';
  const top=r.cargo.length?r.cargo[r.cargo.length-1][0]:0;
  return robotSprite(tier,f,st,r.cargo.length/hopCap(r),FINDS[top].col);
}
function blitRobot(r,spr,cx,cy,alpha,white){
  const bob=(r.tier===3||r.tier===5)?(2+((Math.floor(r.anim/2))%4<2?1:0)):0;
  const img=white?whiteOf(spr.c):spr.c, x=Math.round(r.x-cx), y=Math.round(r.y-cy-spr.ay-1-bob);
  const jit=(r.st==='drill'&&!reduced&&r.tier<4)?((Math.floor(r.anim)%2)):0;
  ctx.save(); ctx.globalAlpha=alpha;
  if(r.vdir && r.st==='drill' && r.tier<2){ ctx.translate(x,Math.round(r.y-cy-6)); ctx.rotate(r.vdir==='d'?Math.PI/2:-Math.PI/2); if(r.face<0) ctx.scale(1,-1); ctx.drawImage(img,-spr.ax,-Math.round(spr.ay/2)-2+jit); }
  else if(r.face<0){ ctx.translate(x,0); ctx.scale(-1,1); ctx.drawImage(img,-spr.ax+jit,y); }
  else ctx.drawImage(img,x-spr.ax+jit,y);
  ctx.restore();
}
function drawRobots(cx,cy,T){
  G.robots.forEach(r=>{
    const sx=r.x-cx, sy=r.y-cy; if(sx<-40||sx>VW+40||sy<-50||sy>VH+40) return;
    // elevator cage while riding the shaft
    if(r.tx===SHAFT && r.ty>=0 && r.st==='move'){ const x=Math.round(sx)-7, y=Math.round(sy)-15; ctx.fillStyle=SUP_STEEL[3]; ctx.fillRect(x,y,15,1); ctx.fillRect(x,y+15,15,1); ctx.fillStyle=SUP_STEEL[2]; ctx.fillRect(x,y,1,15); ctx.fillRect(x+14,y,1,15);
      ctx.fillStyle='#55555e'; ctx.fillRect(x+7,-cy-60,1,Math.max(0,y-(-cy-60))); }
    if(r.tfx){ const q=r.tfx.t/r.tfx.d;
      if(reduced){ blitRobot(r,robotDrawInfo(r,r.tfx.from),cx,cy,1-q,false); blitRobot(r,robotDrawInfo(r,r.tier),cx,cy,q,false); return; }
      if(q<0.45){ const old=robotDrawInfo(r,r.tfx.from); r.anim+=0.6; blitRobot(r,old,cx,cy,1,Math.floor(q*40)%2===0);
        for(let i=0;i<10;i++){const a=i*0.628+q*9, d=(1-q/0.45)*30; ctx.fillStyle=i%2?'#ffffff':'#ffd060'; ctx.fillRect(Math.round(sx+Math.cos(a)*d),Math.round(sy-8+Math.sin(a)*d),2,2);} }
      else { const nw=robotDrawInfo(r,r.tier); blitRobot(r,nw,cx,cy,1,q<0.6); }
      return; }
    blitRobot(r,robotDrawInfo(r,r.tier),cx,cy,1,false);
    if(r.rar>0){ ctx.fillStyle=RAR[r.rar].c; ctx.fillRect(Math.round(sx)-1,Math.round(sy)-24-(r.tier>=4?10:0),3,1); }
    if(UI.sel===r.id){ const y=Math.round(sy)-22-(r.tier>=4?10:0), x=Math.round(sx); const b=Math.floor(T*4)%2; ctx.fillStyle='#ffe28a'; ctx.fillRect(x-1,y-3-b,3,1); ctx.fillRect(x,y-2-b,1,1); }
  });
}
function drawParticles(cx,cy,emis){
  PT.forEach(p=>{ if(p.l<0) return; const e=(p.k===1||p.k===3||p.k===5||p.k===7); if(e!==emis) return;
    const x=Math.round(p.x-cx), y=Math.round(p.y-cy); if(x<-2||y<-2||x>VW||y>VH) return;
    if(p.k===3){ ctx.globalAlpha=0.5*(1-Math.abs(p.l/p.m*2-1)); }
    if(p.k===4){ const q=p.l/p.m, s=1+Math.floor(q*4); ctx.globalAlpha=q<0.7?0.9:0.45; ctx.fillStyle=p.c; ctx.fillRect(x,y,s,s); ctx.globalAlpha=1; return; }
    ctx.fillStyle=p.c; ctx.fillRect(x,y,p.k===6||p.k===7?2:1,p.k===6||p.k===7?2:1); ctx.globalAlpha=1;
  });
}
function darkA(row){ return row<0?0: row<1?0.25: row<3?0.42: row<6?0.58: row<113?0.74: 0.8; }
function drawDarkness(cx,cy,T){
  const d=DARK.g; d.globalCompositeOperation='source-over'; d.clearRect(0,0,VW,VH);
  const r0=Math.floor(cy/TILE), r1=Math.floor((cy+VH)/TILE);
  for(let row=r0;row<=r1;row++){ const a=darkA(row); if(a<=0) continue; d.fillStyle='rgba(4,3,8,'+a+')'; d.fillRect(0,row*TILE-cy,VW,TILE); }
  d.globalCompositeOperation='destination-out';
  const st=(img,x,y)=>d.drawImage(img,Math.round(x-cx-(img.width>>1)),Math.round(y-cy-(img.height>>1)));
  G.robots.forEach(r=>{ if(r.y-cy<-80||r.y-cy>VH+80) return; const R=lampR(r), dir=r.st==='drill'&&r.vdir?r.vdir:(r.face>0?'r':'l');
    st(stamp(R,dir),r.x+r.face*2,r.y-7); if(r.tier>=3) st(stamp(14+r.tier*3),r.x,r.y-8); });
  const x0=Math.max(0,Math.floor(cx/TILE)-2), x1=Math.min(COLS-1,Math.floor((cx+VW)/TILE)+2), y0=Math.max(0,r0-2), y1=Math.min(ROWS-1,r1+2);
  const lr=[22,22,26,30][G.up.lights];
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const k=I(x,y);
    if(G.dug[k]){ if(isLampTile(x,y)) st(stamp(lr),x*TILE+6,y*TILE+4); }
    else if(W.deco[k]===1) st(stamp(9),x*TILE+6,y*TILE+6);
    else if(W.deco[k]===2) st(stamp(9),x*TILE+6,y*TILE+6);
    else if(W.ore[k]&&FINDS[W.ore[k]-1].glow) st(stamp(7),x*TILE+6,y*TILE+6);
  }
  RG.forEach(g=>st(stamp(Math.max(4,Math.round(g.R*(g.t/g.m)))),g.x,g.y));
  d.globalCompositeOperation='source-over';
  ctx.drawImage(DARK.c,0,0);
}
function drawEmissive(cx,cy,T){
  const x0=Math.max(0,Math.floor(cx/TILE)-1), x1=Math.min(COLS-1,Math.floor((cx+VW)/TILE)+1), y0=Math.max(0,Math.floor(cy/TILE)), y1=Math.min(ROWS-1,Math.floor((cy+VH)/TILE));
  const pulse=[0.4,0.55,0.7,0.55][Math.floor(T*2)%4], SL=G.up.scanner;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const k=I(x,y); if(G.dug[k]) continue; const dx=x*TILE-cx, dy=y*TILE-cy, si=W.strat[k];
    if(STRATA[si].f==='magma'||STRATA[si].f==='rift'){ ctx.globalAlpha=pulse; ctx.drawImage(ART.emis[si],(x%8)*TILE,(y%8)*TILE,TILE,TILE,dx,dy,TILE,TILE); ctx.globalAlpha=1; }
    const o=W.ore[k];
    if(o){ const f=FINDS[o-1];
      if(f.glow){ ctx.globalAlpha=pulse*0.8; ctx.drawImage(ART.ore[o-1][(x*3+y*5)&3],dx,dy); ctx.globalAlpha=1; }
      else if(SL>=2 || (SL>=1 && y<=G.deepest+10)){ ctx.globalAlpha=0.35+0.25*(Math.floor(T*2+x)%2); ctx.fillStyle=f.col[2]; ctx.fillRect(dx+5,dy+5,2,2); ctx.globalAlpha=1; }
      if(SL>=3 && W.rich[k] && Math.floor(T*4+x*3+y)%8<2){ ctx.fillStyle='#fff3a0'; ctx.fillRect(dx+1,dy+1,1,1); ctx.fillRect(dx+10,dy+10,1,1); }
    }
    if(W.deco[k]===2){ ctx.fillStyle=['#5a1404','#a03008','#ff6a10','#a03008'][Math.floor(T*2+x)%4]; ctx.fillRect(dx+3,dy+5,6,2); ctx.fillStyle='#ffd060'; ctx.fillRect(dx+5,dy+5,2,1);} 
    if(W.deco[k]===1&&Math.floor(T*2+x+y)%4===2){ ctx.fillStyle='#e0faff'; ctx.fillRect(dx+5,dy+4,1,1);} 
  }
  // headlamps + effect beams
  G.robots.forEach(r=>{ const sx=Math.round(r.x-cx), sy=Math.round(r.y-cy); if(sy<-60||sy>VH+60) return;
    if(r.st==='drill'&&r.job&&!r.tfx){ const tx=r.job.x*TILE+6-cx, ty=r.job.y*TILE+6-cy;
      if(r.tier===2){ const ox=sx+r.face*12; [-9,-6,-1].forEach((o,i)=>{ const yy=sy+o-2; line(ctx,ox,yy,tx-(r.job.x-r.tx)*3,ty+(i-1)*2,Math.floor(T*20+i)%2?'#ff3030':'#ffb0a0'); }); }
      if(r.tier===3){ const ox=sx+r.face*15, oy=sy-11; line(ctx,ox,oy,tx,ty,'#ffffff'); line(ctx,ox,oy-1,tx,ty-1,'#e080ff'); line(ctx,ox,oy+1,tx,ty+1,'#8a3ad0'); }
      if(r.tier===5 && !reduced){ for(let i=0;i<3;i++){ const yy=Math.round(ty-8+Math.random()*16), w=Math.round(6+Math.random()*10), off=Math.round(Math.random()*6-3); ctx.drawImage(cv,Math.round(tx-w/2),yy,w,2,Math.round(tx-w/2)+off,yy,w,2);} ctx.fillStyle='#ff5cf0'; ctx.fillRect(Math.round(tx-1),Math.round(ty-1),2,2);} 
    }
  });
  RG.forEach(g=>{ const q=g.t/g.m, R=Math.round(g.R*q), x=g.x-cx, y=g.y-cy; ctx.fillStyle=g.c; ctx.globalAlpha=q<0.5?1:0.6;
    const n=Math.max(8,R*3); for(let i=0;i<n;i++){const a=i/n*6.283; ctx.fillRect(Math.round(x+Math.cos(a)*R),Math.round(y+Math.sin(a)*R),1,1);} ctx.globalAlpha=1; });
}
function drawMarks(cx,cy,T){
  const x0=Math.max(0,Math.floor(cx/TILE)), x1=Math.min(COLS-1,Math.floor((cx+VW)/TILE)), y0=Math.max(0,Math.floor(cy/TILE)), y1=Math.min(ROWS-1,Math.floor((cy+VH)/TILE));
  const bt=TIERS[bestTier()].dig, ph=Math.floor(T*10);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const k=I(x,y); if(!G.mark[k]||G.dug[k]) continue;
    const dx=x*TILE-cx, dy=y*TILE-cy, bad=hardAt(k)>bt, lone=!CONN[k], c1=bad?'#ff3b3b':lone?'#9a9080':'#ffd23a';
    ctx.fillStyle=bad?'rgba(255,40,40,0.16)':lone?'rgba(160,150,130,0.10)':'rgba(255,210,58,0.14)'; ctx.fillRect(dx,dy,TILE,TILE);
    const up=y>0&&G.mark[k-COLS]&&!G.dug[k-COLS], dn=y<ROWS-1&&G.mark[k+COLS]&&!G.dug[k+COLS], lf=x>0&&G.mark[k-1]&&!G.dug[k-1], rt=x<COLS-1&&G.mark[k+1]&&!G.dug[k+1];
    for(let i=0;i<TILE;i++){ const on=((i+ph+x*TILE+y*TILE)%4)<2; ctx.fillStyle=on?c1:'#1a1406';
      if(!up) ctx.fillRect(dx+i,dy,1,1); if(!dn) ctx.fillRect(dx+i,dy+TILE-1,1,1); if(!lf) ctx.fillRect(dx,dy+i,1,1); if(!rt) ctx.fillRect(dx+TILE-1,dy+i,1,1); }
    if(bad && (x+y)%2===0){ ctx.fillStyle='#ff3b3b'; for(let i=3;i<9;i++){ctx.fillRect(dx+i,dy+i,1,1);ctx.fillRect(dx+11-i,dy+i,1,1);} }
  }
  if(!G.tut){ // first-run hint over the starter coal
    const b=Math.floor(T*3)%2; [[6,1],[7,1],[6,2],[7,2],[8,2]].forEach(([x,y])=>{ if(G.dug[I(x,y)]) return; ctx.fillStyle=b?'#ffd23a':'#8a6a10'; const dx=x*TILE-cx, dy=y*TILE-cy; ctx.fillRect(dx,dy,TILE,1); ctx.fillRect(dx,dy+TILE-1,TILE,1); ctx.fillRect(dx,dy,1,TILE); ctx.fillRect(dx+TILE-1,dy,1,TILE); });
    const tx=7*TILE-cx, ty=TILE-cy-14-b; drawText(ctx,'TAP',tx-6,ty,1,'#ffd23a','#000'); }
}
function drawFloats(cx,cy){
  FL.forEach(f=>{ const q=f.t/f.m, y=Math.round(f.y-cy-(reduced?0:q*16)), w=textW(f.txt,1); ctx.globalAlpha=q>0.75?0.5:1; drawText(ctx,f.txt,Math.round(f.x-cx-w/2),y,1,f.c,'#000'); ctx.globalAlpha=1; });
}
// title "MINE": eroded, hard-banded iron letters
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
  const sh=shake>0&&!reduced?shakeMag:0, ox=sh?Math.round(rnd(-sh,sh)):0, oy=sh?Math.round(rnd(-sh,sh)):0;
  const cx=Math.round(cam.x)+ox, cy=Math.round(cam.y)+oy;
  ctx.fillStyle='#000'; ctx.fillRect(0,0,VW,VH);
  if(cy<0){ drawSky(cx,cy,T); drawSurface(cx,cy,T); }
  drawTiles(cx,cy,T);
  drawParticles(cx,cy,false);
  drawRobots(cx,cy,T);
  drawDarkness(cx,cy,T);
  drawEmissive(cx,cy,T);
  drawParticles(cx,cy,true);
  if(mode==='game') drawMarks(cx,cy,T);
  drawFloats(cx,cy);
  if(mode==='title') drawTitle(T);
  if(flash){ const q=flash.t/flash.m; ctx.globalAlpha=flash.a*(q<0.5?1:0.5); ctx.fillStyle=flash.c; ctx.fillRect(0,0,VW,VH); ctx.globalAlpha=1; }
}
