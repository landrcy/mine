'use strict';
// All art is drawn procedurally at native pixel size, then scaled by an integer factor.
function mk(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.imageSmoothingEnabled=false;return {c,g,w,h};}
function rgb(h){h=h.replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function hex(r,g,b){return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,v|0)).toString(16).padStart(2,'0')).join('');}
function shade(h,k,add){const [r,g,b]=rgb(h);add=add||[0,0,0];return hex(r*k+add[0],g*k+add[1],b*k+add[2]);}

// periodic value noise for seamless sheets
function pnoise(S,cell,rnd){
  const P=S/cell, L=[];for(let i=0;i<P*P;i++)L.push(rnd());
  const at=(i,j)=>L[((j%P+P)%P)*P+((i%P+P)%P)];
  return (x,y)=>{const fx=x/cell, fy=y/cell, i=Math.floor(fx), j=Math.floor(fy), u=fx-i, v=fy-j;
    const su=u*u*(3-2*u), sv=v*v*(3-2*v);
    const a=at(i,j),b=at(i+1,j),c=at(i,j+1),d=at(i+1,j+1);
    return (a+(b-a)*su)*(1-sv)+(c+(d-c)*su)*sv;};
}

const SHEET = 96; // 8x8 tiles, seamless
const ART = {front:[], back:[], emis:[]};
function buildSheets(){
  STRATA.forEach((st,si)=>{
    const rnd=mulberry32(901+si*77);
    const n1=pnoise(SHEET,16,rnd), n2=pnoise(SHEET,6,rnd), n3=pnoise(SHEET,32,rnd);
    const pal=st.pal.map(rgb);
    const F=mk(SHEET,SHEET), B=mk(SHEET,SHEET), E=mk(SHEET,SHEET);
    const fi=F.g.createImageData(SHEET,SHEET), bi=B.g.createImageData(SHEET,SHEET), ei=E.g.createImageData(SHEET,SHEET);
    const put=(img,x,y,c,a)=>{const k=((y%SHEET)*SHEET+(x%SHEET))*4;img.data[k]=c[0];img.data[k+1]=c[1];img.data[k+2]=c[2];img.data[k+3]=a==null?255:a;};
    const band=new Uint8Array(SHEET*SHEET);
    for(let y=0;y<SHEET;y++)for(let x=0;x<SHEET;x++){
      let v=n1(x,y)*0.6+n2(x,y)*0.3+n3(x,y)*0.25-0.08, h=hash2(x,y,si);
      switch(st.f){
        case 'soil': v+= (h<0.05?0.3:0) - (h>0.97?0.3:0); break;
        case 'clay': v=v*0.8+0.2*(0.5+0.5*Math.sin((y+n1(x,y)*14)*0.35))+(h<0.03?0.25:0); break;
        case 'bed':  v=v*0.6+0.35*(((y+Math.floor(n3(x,y)*10))%8)<2?0:0.8) ; if(((y+Math.floor(n1(x,y)*5))%8)===0) v-=0.35; break;
        case 'lime': v=v*0.7+0.3; if(y%24===0 || (x+(Math.floor(y/24)%2)*20)%40===0) v=0.05; if(h<0.012) v=1; break;
        case 'shale':v=v*0.5+0.5*(((y+Math.floor(n2(x,y)*3))%3)===0?0.15:0.65); break;
        case 'granite': v=v*0.6+0.25; break;
        case 'basalt': v=v*0.5+0.4; {const cx=(x+Math.floor(n3(x,y)*4))%16; if(cx===0) v=0.02; else if(cx===1) v=0.85;} if(y%32===Math.floor(n1(x,0)*6)) v=0.05; break;
        case 'magma': v=v*0.8+0.1; break;
        case 'rift': v=v*0.6+0.15+0.3*Math.sin((x*0.3+y*0.7+n3(x,y)*9)); break;
      }
      band[y*SHEET+x] = v<0.32?0:v<0.5?1:v<0.7?2:3;
    }
    for(let y=0;y<SHEET;y++)for(let x=0;x<SHEET;x++){
      let c=pal[band[y*SHEET+x]].slice(); const h=hash2(x,y,si+50);
      if(st.f==='granite'){ if(h<0.08)c=[146,98,92]; else if(h<0.13)c=[16,12,12]; else if(h<0.16)c=[190,180,170]; }
      if(st.f==='soil' && h>0.985){ c=[20,14,10]; } // root specks
      if(st.f==='rift' && h<0.006){ c=[200,160,255]; put(ei,x,y,[200,150,255],255); }
      put(fi,x,y,c);
      put(bi,x,y,[c[0]*0.4+2,c[1]*0.42+3,c[2]*0.5+8]); // cool, dark back wall
    }
    if(st.f==='magma'){ // glowing cracks: random walks
      const r2=mulberry32(77);
      for(let k=0;k<4;k++){let x=Math.floor(r2()*SHEET),y=Math.floor(r2()*SHEET);
        for(let s=0;s<70;s++){const t=s<6||s>62?0:s<16||s>50?1:2;
          const cc=[[120,24,6],[220,70,10],[255,170,40]][t];
          put(fi,(x+SHEET)%SHEET,(y+SHEET)%SHEET,cc); put(ei,(x+SHEET)%SHEET,(y+SHEET)%SHEET,cc,255);
          if(r2()<0.7) x+=1; else y+=r2()<0.5?1:-1;}}
    }
    if(st.f==='lime'){ // little shell fossils
      const r2=mulberry32(55);
      for(let k=0;k<10;k++){const x=Math.floor(r2()*(SHEET-4)),y=Math.floor(r2()*(SHEET-3));
        [[1,0],[2,0],[0,1],[3,1],[1,2],[2,2],[1,1]].forEach(([a,b],i)=>put(fi,x+a,y+b,i<6?[196,190,166]:[90,86,74]));}
    }
    F.g.putImageData(fi,0,0); B.g.putImageData(bi,0,0); E.g.putImageData(ei,0,0);
    ART.front.push(F.c); ART.back.push(B.c); ART.emis.push(E.c);
  });
}

// ---------- ore overlay tiles (per find, 4 variants) ----------
ART.ore = [];
function buildOre(){
  FINDS.forEach((o,oi)=>{
    const vs=[];
    for(let v=0;v<4;v++){
      const s=mk(TILE,TILE), r=mulberry32(300+oi*13+v), C=o.col;
      if(o.relic && o.id==='fossil'){ // ammonite spiral
        const pts=[[3,3],[4,3],[5,3],[6,3],[7,4],[8,5],[8,6],[8,7],[7,8],[6,8],[5,8],[4,7],[3,6],[3,5],[4,5],[5,5],[6,6],[5,6]];
        pts.forEach(([x,y],i)=>{s.g.fillStyle=i<4?C[3]:i<12?C[2]:C[1];s.g.fillRect(x+(v%2),y,1,1);});
        s.g.fillStyle=C[0];s.g.fillRect(4+(v%2),6,1,1);
      } else if(o.relic){ // old gear
        const cx=6,cy=6;for(let y=0;y<TILE;y++)for(let x=0;x<TILE;x++){const d=Math.hypot(x-cx+.5,y-cy+.5),a=Math.atan2(y-cy,x-cx);
          const tooth=Math.cos(a*8)>0.3?1:0; if(d<3.4+tooth*1.4&&d>1.6){s.g.fillStyle=y<cy-1?C[3]:y<cy+2?C[2]:C[1];s.g.fillRect(x,y,1,1);}}
        s.g.fillStyle=C[0];s.g.fillRect(cx,cy,1,1);
      } else {
        const blobs=2+Math.floor(r()*3);
        for(let b=0;b<blobs;b++){
          const bx=1+Math.floor(r()*8), by=1+Math.floor(r()*8), bw=2+Math.floor(r()*3), bh=2+Math.floor(r()*2);
          for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){
            if((x===0||x===bw-1)&&(y===0||y===bh-1)&&r()<0.6)continue;
            s.g.fillStyle = y===0?C[2]: y===bh-1?C[0]:C[1]; s.g.fillRect(bx+x,by+y,1,1);}
          s.g.fillStyle=C[3]; s.g.fillRect(bx,by,1,1);
        }
      }
      vs.push(s.c);
    }
    ART.ore.push(vs);
  });
}

// ---------- 5x7 pixel font ----------
const FONT = {
A:'01110100011000111111100011000110001',B:'11110100011000111110100011000111110',C:'01111100001000010000100001000001111',
D:'11110100011000110001100011000111110',E:'11111100001000011110100001000011111',F:'11111100001000011110100001000010000',
G:'01111100001000010111100011000101111',H:'10001100011000111111100011000110001',I:'11111001000010000100001000010011111',
J:'00111000010000100001100011000101110',K:'10001100101010011000101001001010001',L:'10000100001000010000100001000011111',
M:'10001110111010110101100011000110001',N:'10001110011010110011100011000110001',O:'01110100011000110001100011000101110',
P:'11110100011000111110100001000010000',Q:'01110100011000110001101011001001101',R:'11110100011000111110101001001010001',
S:'01111100001000001110000010000111110',T:'11111001000010000100001000010000100',U:'10001100011000110001100011000101110',
V:'10001100011000110001100010101000100',W:'10001100011000110101101011101110001',X:'10001100010101000100010101000110001',
Y:'10001100010101000100001000010000100',Z:'11111000010001000100010001000011111',
'0':'01110100111010110101110011000101110','1':'00100011000010000100001000010001110','2':'01110100010000100010001000100011111',
'3':'11110000010000101110000010000111110','4':'00010001100101010010111110001000010','5':'11111100001111000001000011000101110',
'6':'00110010001000011110100011000101110','7':'11111000010001000100010000100001000','8':'01110100011000101110100011000101110',
'9':'01110100011000101111000010001001100','$':'00100011111010001110001011111000100','+':'00000001000010011111001000010000000',
'.':'00000000000000000000000000110001100','-':'00000000000000011111000000000000000','!':'00100001000010000100001000000000100',
':':'00000011000110000000011000110000000','?':'01110100010000100110001000000000100',' ':'00000000000000000000000000000000000',
'/':'00001000010001000100010001000010000','%':'11001110010001000100010001001110011','x':'00000000001000101010001000101010001',
};
function textW(t,sc){return t.length*6*sc-sc;}
function drawText(g,t,x,y,sc,col,shadow){
  t=String(t).toUpperCase(); sc=sc||1;
  for(let pass=shadow?0:1;pass<2;pass++){
    g.fillStyle=pass===0?shadow:col;
    const o=pass===0?sc:0;
    for(let i=0;i<t.length;i++){const m=FONT[t[i]]||FONT['?'];
      for(let k=0;k<35;k++) if(m[k]==='1') g.fillRect(x+i*6*sc+(k%5)*sc+o, y+Math.floor(k/5)*sc+o, sc, sc);}
  }
}

// ---------- light stamps (hard bands, used with destination-out) ----------
const STAMPS = {};
function stamp(r, dir){
  r=Math.round(r); const key=r+'|'+(dir||'o'); if(STAMPS[key]) return STAMPS[key];
  const s=mk(r*2+1,r*2+1), im=s.g.createImageData(r*2+1,r*2+1);
  const ang = {r:0,l:Math.PI,u:-Math.PI/2,d:Math.PI/2}[dir];
  for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){
    let d=Math.hypot(x,y)/r;
    if(dir){ // cone: wide spot ahead + small pool around
      const a=Math.atan2(y,x); let da=Math.abs(((a-ang+Math.PI*3)%(Math.PI*2))-Math.PI);
      const inCone=da<0.62; if(!inCone) d=d/0.38; // tighter around the robot
    }
    let al = d<0.42?255: d<0.64?185: d<0.84?115: d<1?55:0;
    const k=((y+r)*(r*2+1)+(x+r))*4; im.data[k+3]=al;
  }
  s.g.putImageData(im,0,0); return STAMPS[key]=s.c;
}

// ---------- robot sprites ----------
const PAL = {
  rust:   ['#1e110b','#4a2716','#7a4223','#a8653a','#d9a070'],
  steel:  ['#151a24','#2f3a4c','#4f5e76','#7d8ea8','#d6e2f0'],
  gun:    ['#0f1114','#22262c','#3a4049','#5a6370','#b8c4d0'],
  teal:   ['#0a1214','#1c2a2e','#34484e','#587880','#cfeef0'],
  yellow: ['#2a1c04','#6a480a','#ac7812','#dfa82a','#fff0b4'],
  obsid:  ['#050308','#120a1c','#22142f','#3a2450','#ff5cf0'],
};
function plate(s,x,y,w,h,B){
  for(let j=0;j<h;j++){const f=h<=1?0:j/(h-1); s.g.fillStyle = j===0?B[4] : f<0.38?B[3] : f<0.72?B[2] : j===h-1?B[0] : B[1]; s.g.fillRect(x,y+j,w,1);}
  s.g.fillStyle=B[1]; s.g.fillRect(x+w-1,y+1,1,Math.max(0,h-2));
}
function P(s,x,y,c){s.g.fillStyle=c;s.g.fillRect(x,y,1,1);}
function R(s,x,y,w,h,c){s.g.fillStyle=c;s.g.fillRect(x,y,w,h);}
function outlineSprite(s,col){
  const im=s.g.getImageData(0,0,s.w,s.h), d=im.data, a=(x,y)=>x>=0&&y>=0&&x<s.w&&y<s.h&&d[(y*s.w+x)*4+3]>0;
  const out=[]; for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++) if(!a(x,y)&&(a(x+1,y)||a(x-1,y)||a(x,y+1)||a(x,y-1))) out.push([x,y]);
  s.g.fillStyle=col; out.forEach(([x,y])=>s.g.fillRect(x,y,1,1));
}
function heap(s,x,y,w,full,oc){ // ore heap in hopper
  if(full<=0) return; const hgt=Math.ceil(full*3);
  for(let j=0;j<hgt;j++){const ww=w-j*2; if(ww<=0)break; for(let i=0;i<ww;i++){const c=oc[(i+j*2)%3===0?3:(i+j)%2?2:1]; P(s,x+j+i,y-j,c);}}
}
function spiralCone(s,x,y,len,h,f,B,spin){ // drill cone pointing right
  for(let i=0;i<len;i++){const hh=Math.max(2,Math.round(h*(1-i/len))), y0=y+Math.round((h-hh)/2);
    for(let j=0;j<hh;j++){const st=((i+j+(spin?f:0))%3); P(s,x+i,y0+j, j===0?B[4]: st===0?B[1]:st===1?B[3]:B[2]);}}
}
// returns {c, ax, ay}: canvas + anchor (ax = center-x, ay = floor-y within canvas)
const SPR_CACHE = new Map();
function robotSprite(tier,f,st,full,oc){
  const key=tier+'|'+f+'|'+st+'|'+Math.ceil(full*3)+'|'+(oc?oc[2]:'');
  let v=SPR_CACHE.get(key); if(v) return v;
  v = [drawT1,drawT2,drawT3,drawT4,drawT5,drawT6][tier](f,st,full,oc||FINDS[0].col);
  SPR_CACHE.set(key,v); if(SPR_CACHE.size>900) SPR_CACHE.delete(SPR_CACHE.keys().next().value);
  return v;
}
function drawT1(f,st,full,oc){
  const s=mk(20,15), B=PAL.rust, mv=st!=='idle', dr=st==='drill';
  R(s,2,11,11,3,'#15110e'); for(let i=2;i<13;i++) if((i+(mv?f:0))%3===0){P(s,i,11,'#4a423a');P(s,i,13,'#4a423a');}
  [4,7,10].forEach(x=>{P(s,x,12,'#7a7066');}); R(s,2,10,11,1,B[1]);
  plate(s,3,6,8,4,B); P(s,5,8,B[0]); P(s,8,7,B[1]); P(s,4,7,B[4]); P(s,9,8,'#2c1a10');
  // hopper (rear)
  R(s,1,3,6,1,B[4]); R(s,1,4,1,3,B[2]); R(s,6,4,1,2,B[2]); R(s,2,4,4,2,'#0b0908'); heap(s,2,3,4,full,oc);
  plate(s,7,4,4,2,B); P(s,9,5,f%4<2?'#ff4a26':'#a02412'); // sensor
  P(s,11,6,'#ffe08a'); P(s,11,7,'#b88a3a'); R(s,11,8,2,2,PAL.gun[2]); // lamp + arm
  spiralCone(s,13,6,5,5,f,PAL.gun,dr);
  P(s,3,1,'#2a2420'); P(s,3,2,'#3a332c'); // exhaust
  outlineSprite(s,'#070607'); return {c:s.c,ax:7,ay:14};
}
function drawT2(f,st,full,oc){
  const s=mk(24,17), B=PAL.steel, mv=st!=='idle', dr=st==='drill';
  R(s,1,12,14,4,'#121418'); for(let i=1;i<15;i++) if((i+(mv?f:0))%3===0){P(s,i,12,'#444a54');P(s,i,15,'#444a54');}
  [3,6,9,12].forEach(x=>{R(s,x,13,2,2,'#5a6170');P(s,x,13,'#9aa4b4');});
  for(let i=1;i<15;i++) P(s,i,11,((i+ (mv?Math.floor(f/2):0))%4)<2?'#d9a520':'#1a1608'); // hazard skirt
  plate(s,2,6,10,5,B); P(s,4,8,B[0]); P(s,7,7,B[4]); P(s,10,9,B[0]);
  R(s,1,2,6,1,B[4]); R(s,1,3,1,3,B[3]); R(s,6,3,1,3,B[3]); R(s,2,3,4,3,'#0a0b0e'); R(s,3,3,1,3,B[1]); heap(s,2,2,4,full,oc);
  plate(s,10,4,3,7,B); P(s,11,5,'#ff3b1f'); P(s,11,6,f%4<2?'#ff3b1f':'#7a1a10');
  P(s,13,5,'#ffe9a0'); P(s,13,6,'#ffe9a0'); P(s,13,7,'#a07a3a');
  R(s,13,9,1,3,'#2a3040'); R(s,14,10,2,1, dr&&f%2?'#e8eef6':'#aeb8c8'); // piston
  spiralCone(s,16,7,7,7,f,PAL.gun,dr);
  outlineSprite(s,'#060709'); return {c:s.c,ax:8,ay:16};
}
function drawT3(f,st,full,oc){
  const s=mk(26,20), B=PAL.gun, mv=st==='move', dr=st==='drill';
  // legs: 4 jointed spider legs, knees raised, alternating lift
  [[6,-1,0],[9,-1,1],[13,1,0],[16,1,1]].forEach(([x,o,ph])=>{const lift=mv&&((Math.floor(f/2)+ph)%2)?1:0, kx=x+o*2, ky=6-lift, fx=x+o*3;
    line(s.g,x,9,kx,ky,B[3]); line(s.g,kx,ky,fx,18-lift,B[2]); P(s,kx,ky,B[4]); P(s,fx,18-lift,B[4]); P(s,fx-o,18-lift,B[1]);});
  plate(s,4,5,15,5,B); for(let i=5;i<18;i+=3) P(s,i,8,'#ff3030'); // red running lights
  R(s,5,1,6,1,B[4]); R(s,5,2,1,3,B[3]); R(s,10,2,1,3,B[3]); R(s,6,2,4,3,'#08090b'); heap(s,6,1,4,full,oc);
  plate(s,15,3,4,3,B); P(s,17,4,'#ffe9a0'); P(s,18,4,'#ffe9a0');
  // three arms
  const em=dr?(f%2?'#ffd0d0':'#ff3030'):'#6a1414';
  R(s,19,4,3,1,B[3]); R(s,21,2,1,2,B[3]); R(s,22,1,2,2,B[2]); P(s,24,1,em); P(s,24,2,em);
  R(s,19,6,5,1,B[3]); R(s,23,5,2,3,B[2]); P(s,25,6,em);
  R(s,19,8,2,1,B[3]); R(s,21,9,2,1,B[3]); R(s,22,10,2,2,B[2]); P(s,24,11,em);
  outlineSprite(s,'#050506'); return {c:s.c,ax:11,ay:19};
}
function drawT4(f,st,full,oc){
  const s=mk(28,22), B=PAL.teal, dr=st==='drill';
  // thruster flame (hard bands) flicker
  const fl=3+((f*7)%3);
  for(let j=0;j<fl;j++){const w=Math.max(1,6-j*2); R(s,11-Math.floor(w/2),14+j,w,1, j===0?'#ffffff':j<2?'#7af4ff':'#7a3cff');}
  R(s,6,12,11,2,'#0c1214'); R(s,7,12,9,1,'#3a4a50');
  plate(s,3,4,17,8,B); R(s,3,9,17,1,'#5a24b0'); P(s,8,6,B[0]); P(s,9,7,B[0]); R(s,14,5,1,4,B[1]);
  P(s,5,8,B[0]); P(s,12,9,B[4]); for(let i=4;i<19;i+=4)P(s,i,5,B[4]);
  R(s,5,1,7,1,B[4]); R(s,5,2,7,2,'#061012'); heap(s,6,2,5,full,oc); R(s,5,3,7,1,B[2]);
  R(s,17,6,2,2, f%4<2?'#ff4060':'#902030'); P(s,19,9,'#fff0b0'); P(s,19,10,'#fff0b0');
  // plasma lance + coil rings
  R(s,20,7,6,2,B[1]); [21,23].forEach(x=>{R(s,x,6,1,4, (x+f)%2?B[4]:B[3]);});
  const tip=dr?(f%2?'#ffffff':'#e080ff'):'#6a2a9a'; R(s,26,7,1,2,tip); if(dr)P(s,27,7,'#c060ff');
  outlineSprite(s,'#040608'); return {c:s.c,ax:11,ay:21};
}
function drawT5(f,st,full,oc){
  const s=mk(40,34), B=PAL.yellow, mv=st==='move', dr=st==='drill';
  // legs (walk cycle)
  const ph=mv?f%8:0, sw=[0,1,2,1,0,-1,-2,-1][ph];
  [[11,sw],[20,-sw]].forEach(([x,o])=>{
    R(s,x,20,3,4,PAL.gun[2]); R(s,x+1,20,1,4,PAL.gun[3]); // thigh
    R(s,x+o,24,3,1,PAL.gun[4]); R(s,x+o,25,3,5,B[2]); R(s,x+o+2,25,1,5,B[1]); // shin
    R(s,x+o-2,30,7,3,PAL.gun[1]); R(s,x+o-2,30,7,1,PAL.gun[3]); });
  plate(s,6,8,22,12,B); for(let i=6;i<28;i++) P(s,i,17,((i+(mv?f:0))%4)<2?'#1a1404':'#e0a020');
  P(s,9,11,B[0]); P(s,22,10,B[0]); P(s,16,13,B[4]); R(s,13,9,1,7,B[1]);
  R(s,20,10,6,2,'#2a0606'); R(s,21,10,4,1,f%6<3?'#ff3a1a':'#8a1a0a'); // sensor bar
  // huge hopper
  R(s,1,4,9,1,B[4]); R(s,1,5,1,10,B[3]); R(s,9,5,1,6,B[3]); R(s,2,5,7,10,'#0c0a06'); for(let x=3;x<9;x+=2) R(s,x,6,1,9,'#2a1f0a'); R(s,2,9,7,1,B[1]); heap(s,2,4,7,full,oc); if(full>0.6)heap(s,3,2,5,1,oc);
  R(s,11,2,2,6,PAL.gun[2]); R(s,11,1,2,1,PAL.gun[4]); // stack
  [15,19,23].forEach(x=>{R(s,x,6,2,2,PAL.gun[1]); P(s,x,6,'#fff3c0'); P(s,x+1,6,'#fff3c0');}); // floodlights
  // bucket wheel
  const cx=32,cy=14,ang=(dr?f*0.39:mv?f*0.1:0);
  for(let y=-8;y<=8;y++)for(let x=-8;x<=8;x++){const d=Math.hypot(x,y); if(d<6.5&&d>4.6) P(s,cx+x,cy+y, y<-1?PAL.gun[3]:y<3?PAL.gun[2]:PAL.gun[1]); if(d<1.6)P(s,cx+x,cy+y,PAL.gun[4]);}
  for(let k=0;k<8;k++){const a=ang+k*Math.PI/4, bx=Math.round(cx+Math.cos(a)*7), by=Math.round(cy+Math.sin(a)*7);
    R(s,bx-1,by-1,2,2,B[2]); P(s,bx-1,by-1,B[4]); P(s,bx,by,'#2a1c04');
    const sx=Math.round(cx+Math.cos(a)*3), sy=Math.round(cy+Math.sin(a)*3); P(s,sx,sy,PAL.gun[3]);}
  R(s,27,13,3,2,PAL.gun[2]);
  outlineSprite(s,'#050403'); return {c:s.c,ax:17,ay:33};
}
function drawT6(f,st,full,oc){
  const s=mk(38,30), B=PAL.obsid, dr=st==='drill', cx=16, cy=14;
  // obsidian monolith (diamond) with hard bands
  for(let y=-11;y<=11;y++){const w=11-Math.abs(y); for(let x=-w;x<=w;x++){
    const t=(x+y); P(s,cx+x,cy+y, (Math.abs(x)===w||Math.abs(y)===11)?B[4]: t<-6?B[3]: t<0?B[2]: t<6?B[1]:B[0]);}}
  // fracture lines + tip spikes
  [[-6,-3,-2,4],[3,-6,6,-1],[2,4,-3,8]].forEach(([a,b,c,d])=>line(s.g,cx+a,cy+b,cx+c,cy+d,'#5a2a70'));
  R(s,cx,cy-13,1,2,B[4]); R(s,cx,cy+12,1,2,B[4]); P(s,cx-1,cy-12,B[3]); P(s,cx+1,cy+12,B[3]);
  // void core eye, pulsing rings
  const pr=[2,3,4,3][f%4];
  for(let y=-pr;y<=pr;y++)for(let x=-pr;x<=pr;x++){const d=Math.hypot(x,y); if(d<=pr) P(s,cx+x,cy+y, d<pr-1.5?'#000000': d<pr-0.6?'#ff5cf0':'#5ff6ff');}
  P(s,cx,cy,'#ffffff');
  // orbiting shards
  for(let k=0;k<3;k++){const a=f*Math.PI/4+k*2.094, x=Math.round(cx+Math.cos(a)*14), y=Math.round(cy+Math.sin(a)*5);
    P(s,x,y-1,B[4]); R(s,x-1,y,3,1,B[3]); P(s,x,y+1,B[1]);}
  // carried ore as floating cluster
  if(full>0){ for(let k=0;k<Math.ceil(full*5);k++){const x=3+((k*5)%6), y=10+((k*3)%7); R(s,x,y,2,2,oc[1]); P(s,x,y,oc[3]);}}
  // reality tear ahead when drilling
  if(dr){ for(let y=4;y<26;y++){const x=30+((y*7+f*3)%5)-2; P(s,x,y,'#000000'); P(s,x-1,y,(y+f)%3?'#ff5cf0':'#5ff6ff'); if((y+f)%4===0)P(s,x+1,y,'#ffffff');}}
  outlineSprite(s,'#000000'); return {c:s.c,ax:16,ay:27};
}
// small ore nugget icon (for UI)
function oreIcon(oi, rar){
  const o=FINDS[oi], s=mk(14,14), C=o.col;
  if(rar!=null){R(s,0,0,14,14,RAR[rar].c); R(s,1,1,12,12,'#0b0a0c');}
  const pts=['....###.....','..#######...','.#########..','###########.','###########.','.##########.','..#######...','....####....'];
  pts.forEach((row,y)=>{for(let x=0;x<row.length;x++) if(row[x]==='#') P(s,1+x,3+y, y<2?C[2]: y<5?C[1]:C[0]);});
  P(s,5,4,C[3]); P(s,6,4,C[3]); P(s,3,6,C[3]);
  return s.c.toDataURL();
}
