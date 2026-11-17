'use strict';
// ===== Level of detail: zoomed-in views get more pixels, not just bigger ones =====
function scale2x(c){
  const w=c.width,h=c.height, s=new Uint32Array(c.getContext('2d').getImageData(0,0,w,h).data.buffer), o=mk(w*2,h*2), od=o.g.createImageData(w*2,h*2), d=new Uint32Array(od.data.buffer);
  const at=(x,y)=>x<0||y<0||x>=w||y>=h?0:s[y*w+x];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const E=at(x,y),B=at(x,y-1),Dd=at(x-1,y),F=at(x+1,y),H=at(x,y+1); let e0=E,e1=E,e2=E,e3=E;
    if(B!==H&&Dd!==F){ e0=Dd===B?Dd:E; e1=B===F?F:E; e2=Dd===H?Dd:E; e3=H===F?F:E; }
    const k=(y*2)*(w*2)+x*2; d[k]=e0; d[k+1]=e1; d[k+w*2]=e2; d[k+w*2+1]=e3;
  }
  o.g.putImageData(od,0,0); return o.c;
}
function scale3x(c){
  const w=c.width,h=c.height, s=new Uint32Array(c.getContext('2d').getImageData(0,0,w,h).data.buffer), o=mk(w*3,h*3), od=o.g.createImageData(w*3,h*3), d=new Uint32Array(od.data.buffer);
  const at=(x,y)=>x<0||y<0||x>=w||y>=h?0:s[y*w+x], W3=w*3;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const A=at(x-1,y-1),B=at(x,y-1),C=at(x+1,y-1),Dd=at(x-1,y),E=at(x,y),F=at(x+1,y),G=at(x-1,y+1),H=at(x,y+1),I_=at(x+1,y+1);
    let e=[E,E,E,E,E,E,E,E,E];
    if(B!==H&&Dd!==F){ e=[Dd===B?Dd:E, (Dd===B&&E!==C)||(B===F&&E!==A)?B:E, B===F?F:E,
      (Dd===B&&E!==G)||(Dd===H&&E!==A)?Dd:E, E, (B===F&&E!==I_)||(H===F&&E!==C)?F:E,
      Dd===H?Dd:E, (Dd===H&&E!==I_)||(H===F&&E!==G)?H:E, H===F?F:E]; }
    const k=(y*3)*W3+x*3; for(let j=0;j<3;j++)for(let i=0;i<3;i++) d[k+j*W3+i]=e[j*3+i];
  }
  o.g.putImageData(od,0,0); return o.c;
}
function upscale(c,D){ return D===1?c: D===2?scale2x(c): D===3?scale3x(c): scale2x(scale2x(c)); }
function canvasOf(c){ const s=mk(c.width,c.height); s.g.drawImage(c,0,0); return s; }
// strip the 1px dark outline so the smooth upscale doesn't fatten it; re-outline at full density afterwards
function stripOutline(c){
  const s=canvasOf(c), im=s.g.getImageData(0,0,s.w,s.h), d=im.data, A=(x,y)=>x>=0&&y>=0&&x<s.w&&y<s.h&&d[(y*s.w+x)*4+3]>0, kill=[];
  for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++){ const k=(y*s.w+x)*4; if(!d[k+3]) continue; if(d[k]+d[k+1]+d[k+2]>40) continue;
    if(!A(x-1,y)||!A(x+1,y)||!A(x,y-1)||!A(x,y+1)) kill.push(k); }
  kill.forEach(k=>d[k+3]=0); s.g.putImageData(im,0,0); return s.c;
}

// ---------- per-density texture set (built lazily the first time a zoom level is used) ----------
function lod(D){
  if(ART.lod[D]) return ART.lod[D];
  const L=genSheets(D);
  const base=ART.lod[1]?ART.lod[1].ore:genOre();
  L.ore=base.map((vs,oi)=>vs.map((c,v)=>D===1?c:detailOre(upscale(c,D),oi,v,D)));
  L.crystal=crystalSprite(D); L.lava=lavaSprite(D);
  ART.lod[D]=L; return L;
}
function detailOre(c,oi,v,D){
  const s=canvasOf(c), o=FINDS[oi], C=o.col, r=mulberry32(700+oi*31+v), S=TILE*D;
  const gemlike=o.glow||o.id==='gem';
  if(gemlike){ // faceted crystal prisms with hard bands and a bright edge
    for(let k=0;k<3;k++){ const w=Math.max(2,Math.round((1.4+r()*1.2)*D)), h=Math.round((3+r()*3)*D), x0=Math.round((1+r()*8)*D), y0=Math.round((3+r()*7)*D)+h;
      for(let y=0;y<h;y++){ const tip=Math.max(0,Math.round(w/2-(y)*(w/2)/Math.max(1,D))); for(let x=tip;x<w-tip;x++){
        P(s,x0+x,y0-h+y, x===tip?C[3]: x<w/2?C[2]: y>h*0.7?C[0]:C[1]); } }
      P(s,x0+Math.floor(w/2),y0-h,'#ffffff'); }
  } else if(!o.relic){ // metal veins + specular glints
    for(let k=0;k<2;k++){ let x=r()*S, y=r()*S; for(let i=0;i<S*0.7;i++){ P(s,Math.round(x),Math.round(y),C[i%5===0?3:2]); x+=r()<0.6?1:0; y+=r()<0.5?1:-0.5; if(x>=S||y>=S||y<0) break; } }
    for(let k=0;k<4;k++) P(s,Math.round(r()*S),Math.round(r()*S),C[3]);
    if(o.id==='coal') for(let k=0;k<5;k++){ const x=Math.round(r()*S), y=Math.round(r()*S); P(s,x,y,'#9aa0b4'); P(s,x+1,y,'#5a5e70'); }
  } else if(o.id==='fossil'){ // ammonite ribs
    const im=s.g.getImageData(0,0,S,S).data; for(let y=0;y<S;y++)for(let x=0;x<S;x++){ const k=(y*S+x)*4; if(im[k+3]&&(x+y)%Math.max(2,D)===0) P(s,x,y,C[1]); }
  } else { // lost gear: bolt holes + rust
    for(let k=0;k<5;k++){ const x=Math.round(r()*S), y=Math.round(r()*S); P(s,x,y,'#7a3a1a'); }
  }
  return s.c;
}
function crystalSprite(D){
  const s=mk(TILE*D,TILE*D), C=['#123a4a','#2a6a8a','#4ab0d0','#9ae8ff','#e0faff'];
  [[3,10,1.4,4.5],[5,10,1.8,6.5],[7.5,10,1.3,3.5]].forEach(([bx,by,bw,bh])=>{
    const w=Math.max(1,Math.round(bw*D)), h=Math.round(bh*D), x0=Math.round(bx*D), y0=Math.round(by*D);
    for(let y=0;y<h;y++){ const tipH=Math.max(1,Math.round(w*0.8)); const inset=y<tipH?Math.round((tipH-y)*(w/2)/tipH):0;
      for(let x=inset;x<w-inset;x++) P(s,x0+x,y0-h+y, x===inset?C[4]: x<w/2?C[3]: x<w-1?C[2]:C[1]); }
    if(D>1) for(let y=Math.round(h*0.4);y<h;y+=Math.max(2,D)) P(s,x0+Math.floor(w/2),y0-h+y,C[1]); });
  return s.c;
}
function lavaSprite(D){ // a lens of molten rock: dark crust rim, hard bands to a white-hot seam, crust plates when zoomed
  const s=mk(TILE*D,TILE*D), C=['#2a0802','#5a1404','#a03008','#ff6a10','#ffd060','#fff4c0'];
  const cx=6*D, cy=6*D, rx=3.6*D, ry=1.7*D;
  for(let y=0;y<TILE*D;y++)for(let x=0;x<TILE*D;x++){
    const wob=(hash2(Math.floor(x/Math.max(1,D>>1)),3,41)-0.5)*0.35;
    const e=Math.pow((x+0.5-cx)/rx,2)+Math.pow((y+0.5-cy)/(ry*(1+wob)),2); if(e>1.35) continue;
    let c= e>1? C[0] : e>0.7? C[2] : e>0.35? C[3] : e>0.12? C[4] : C[5];
    if(D>1 && e<1 && e>0.2 && hash2(Math.floor(x/D*2),Math.floor(y/D*2),43)>0.8) c=C[1]; // floating crust plates
    P(s,x,y,c); }
  return s.c;
}
// ---------- robot detail passes (drawn on the smooth upscale, in base-pixel coordinates) ----------
function detailRobot(s,tier,f,st,full,D){
  let snap=null; const solid=(x,y)=>{ if(!snap) snap=s.g.getImageData(0,0,s.w,s.h).data; return x>=0&&y>=0&&x<s.w&&y<s.h&&snap[(y*s.w+x)*4+3]>0; };
  const q=v=>Math.round(v*D), px=(x,y,c)=>P(s,q(x),q(y),c), hp=(x,y,c)=>P(s,x,y,c);
  const hline=(x0,x1,y,c)=>{for(let x=q(x0);x<=q(x1);x++) hp(x,q(y),c);}, vline=(x,y0,y1,c)=>{for(let y=q(y0);y<=q(y1);y++) hp(q(x),y,c);};
  const rivet=(x,y,B)=>{ const X=q(x),Y=q(y); hp(X,Y,B[4]); if(D>=3) hp(X+1,Y,B[3]); hp(X+1,Y+1,B[0]); if(D>=4){hp(X,Y+1,B[3]); hp(X+2,Y+1,B[0]); hp(X+1,Y+2,B[0]);} };
  const scratch=(x,y,len,c)=>{ for(let i=0;i<len*D;i++) hp(q(x)+i,q(y)+Math.floor(i/2),c); };
  const dent=(x,y,B)=>{ const X=q(x),Y=q(y); hp(X,Y,B[0]); hp(X+1,Y,B[0]); hp(X,Y+1,B[3]); if(D>2){hp(X+2,Y+1,B[0]); hp(X+1,Y+1,B[3]);} };
  const cable=(x0,y0,x1,y1,sag,cols)=>{ cols.forEach((c,ci)=>{ const n=Math.max(4,Math.round(Math.hypot(x1-x0,y1-y0)*D*1.5)); for(let i=0;i<=n;i++){ const t=i/n, x=x0+(x1-x0)*t, y=y0+(y1-y0)*t+Math.sin(t*Math.PI)*sag; hp(q(x),q(y)+ci,c);} }); };
  const glass=(x,y,w,h,c)=>{ for(let j=0;j<q(h);j++)for(let i=0;i<q(w);i++) hp(q(x)+i,q(y)+j, i===q(w)-1||j===q(h)-1?shade(c,0.55):c); hp(q(x),q(y),'#ffffff'); if(D>=3) hp(q(x)+1,q(y),'#ffffff'); };
  const hazard=(x0,x1,y,h,ph)=>{ for(let j=0;j<q(h);j++)for(let i=q(x0);i<q(x1);i++) hp(i,q(y)+j, (((i+j+ph*D)/Math.max(2,D))|0)%2?'#e0a820':'#14100a'); };
  const treads=(x0,x1,y0,y1,mv)=>{ const sh=mv?f*D/2|0:0; for(let x=q(x0);x<q(x1);x++){ const on=((x+sh)%Math.max(2,D))===0; hp(x,q(y0),on?'#6a625a':'#1c1814'); hp(x,q(y1),on?'#6a625a':'#1c1814'); } };
  const hub=(x,y,r,a,c1,c2)=>{ const X=q(x),Y=q(y),R=r*D; for(let k=0;k<3;k++){ const an=a+k*2.094; for(let i=1;i<R;i++) hp(Math.round(X+Math.cos(an)*i),Math.round(Y+Math.sin(an)*i),c1);} hp(X,Y,c2); };
  const spiral=(x0,x1,y0,y1,on)=>{ const sh=on?(f*D/2)|0:0; for(let x=q(x0);x<q(x1);x++)for(let y=q(y0);y<q(y1);y++){ if(((x+y+sh)%Math.max(3,D*2))===0 && solid(x,y)) hp(x,y,'#e6e2da'); } };
  const mv=st!=='idle', dr=st==='drill';
  if(tier===0){ const B=PAL.rust;
    treads(2,13,11,13.6,mv); [4,7,10].forEach(x=>hub(x+0.5,12.5,0.45,mv?f*0.8:0,'#a09486','#e0d8c8'));
    [[3.3,6.4],[9.6,6.4],[3.3,9],[9.6,9]].forEach(([x,y])=>rivet(x,y,B)); vline(6.5,6.3,9.5,B[0]); vline(6.75,6.3,9.5,B[3]);
    scratch(4,7.2,1.4,B[4]); dent(8.2,8,B); for(let y=q(9.6);y<q(10.4);y++) hp(q(3.6),y,'#8a3a14');
    glass(11,6,0.9,0.9,'#ffe08a'); cable(5.5,5.6,11.2,8.3,0.9,['#3a0e0a','#1a1a1a']); hazard(1.2,6.8,3.2,0.5,0);
    spiral(13,18,6,11,dr); hline(13,17,8.5,PAL.gun[1]);
  }
  if(tier===1){ const B=PAL.steel;
    treads(1,15,12,15.6,mv); [3,6,9,12].forEach(x=>hub(x+1,14,0.7,mv?f*0.8:0,'#b8c0cc','#ffffff'));
    hazard(1,15,11,1,mv?f:0);
    for(let x=2.4;x<11;x+=1.6) rivet(x,6.3,B); vline(7,6.4,10.5,B[0]); hline(2,11,8.5,B[1]); dent(4.3,9,B); scratch(8,7.2,1.6,B[4]);
    glass(13,5,0.9,0.8,'#ffe9a0'); glass(13,6,0.9,0.8,'#ffe9a0');
    for(let x=q(14);x<q(16);x++){ hp(x,q(10.2),'#ffffff'); hp(x,q(10.2)+1,'#8a94a6'); } vline(13.2,9,11.6,'#1a2030'); // chrome piston
    cable(6,6,13.5,9.4,1.2,['#c03a14','#20242c']); [10.3,11.3].forEach(y=>hline(10.2,12.6,y,B[0]));
    spiral(16,23,7,14,dr);
  }
  if(tier===2){ const B=PAL.gun;
    [6,9,13,16].forEach((x,i)=>{ const o=i<2?-1:1; const kx=x+o*2, ky=6; hp(q(kx),q(ky),'#d0d8e0'); if(D>2) hp(q(kx)+1,q(ky),'#7a8490'); for(let t=0;t<1;t+=1/(4*D)) hp(q(x+(kx-x)*t)+1,q(9+(ky-9)*t),'#9aa4b0'); });
    for(let x=5;x<19;x+=2.2) rivet(x,5.3,B); vline(10,5.4,9.4,B[0]); vline(14,5.4,9.4,B[0]); for(let x=q(11);x<q(13.6);x+=2) vline(x/D,6.4,7.6,B[0]);
    cable(17,4.6,23,1.8,0.6,['#3a3f48','#a01818']); cable(17,6.5,24,6.5,0.4,['#3a3f48']); cable(17,8.4,23,10.6,0.6,['#3a3f48','#a01818']);
    [[24.5,1.5],[25.5,6.5],[24.5,11.5]].forEach(([x,y])=>{ hp(q(x),q(y),dr&&f%2?'#ffffff':'#ff8080'); });
    glass(17,4,1.8,0.8,'#ffe9a0'); dent(7,7.6,B); scratch(12,8.6,1.4,B[4]);
  }
  if(tier===3){ const B=PAL.teal;
    for(let x=4;x<19;x+=2) rivet(x,9.4,B); hline(3,19.5,7,B[1]); vline(9,4.4,8.6,B[0]); vline(14,4.4,8.6,B[0]);
    for(let y=4.8;y<8.6;y+=0.6) hline(4.2,6.2,y,B[0]); // vent slats
    glass(17,6,1.8,1.8,'#ff4060'); glass(19,9,0.9,1.8,'#fff0b0');
    cable(9,2.4,21,6.6,1.6,['#5a24b0','#20242c']); hazard(6,17,12,1,f);
    for(let i=0;i<5;i++) hp(q(8+i*2),q(13.2),'#7af4ff'); scratch(6,6,2,B[4]); dent(12,10.4,B);
  }
  if(tier===4){ const B=PAL.yellow;
    for(let y=9.5;y<16;y+=2.2) for(let x=7.5;x<27;x+=2.6) rivet(x,y,B);
    hline(6,28,12.5,B[1]); vline(17.5,8.4,19.6,B[1]); for(let y=9;y<16;y+=1) hline(7,8,y,B[1]); // side ladder
    for(let x=q(6);x<q(28);x++) hp(x,q(7.4),(x/D|0)%3===0?PAL.gun[3]:'#00000000'); hline(6,28,7.6,PAL.gun[2]); // handrail
    [15,19,23].forEach(x=>glass(x,6,1.8,1,'#fff3c0')); cable(26,10,30.5,13,1.5,['#1a1408','#c03a14','#1a1408']);
    for(let y=q(1);y<q(3);y++) hp(q(11.5),y,'#141414'); // soot
    dent(10,15,B); dent(21,16,B); scratch(18,11,2,B[4]); scratch(9,13,1.5,B[4]);
    const ph=mv?f%8:0, sw=[0,1,2,1,0,-1,-2,-1][ph]; [[11,sw],[20,-sw]].forEach(([x,o])=>{ vline(x+0.5,20,26,'#e8eef4'); vline(x+o+2.6,25,29,'#ffffff'); rivet(x+1,24.2,PAL.gun); });
    // bucket teeth
    const ang=(dr?f*0.39:mv?f*0.1:0); for(let k=0;k<8;k++){ const a=ang+k*Math.PI/4; hp(q(32+Math.cos(a)*8.3),q(14+Math.sin(a)*8.3),'#d8d0c0'); }
  }
  if(tier===5){ const cx=16, cy=14;
    [[-6,-3,-2,4],[3,-6,6,-1],[2,4,-3,8],[-8,0,-4,-5],[5,3,8,1]].forEach(([a,b,c,d2])=>{ const n=Math.max(4,Math.round(Math.hypot(c-a,d2-b)*D)); for(let i=0;i<=n;i++){ const t=i/n; hp(q(cx+a+(c-a)*t),q(cy+b+(d2-b)*t), i%3?'#7a3a9a':'#ff5cf0'); } });
    for(let k=0;k<6;k++){ const a=k*1.047+f*0.2, r=7.5; hp(q(cx+Math.cos(a)*r),q(cy+Math.sin(a)*r), k%2?'#5ff6ff':'#ff5cf0'); } // runes
    for(let a=0;a<6.28;a+=0.25/D){ const r=4.6; hp(q(cx+Math.cos(a)*r),q(cy+Math.sin(a)*r),'#3a1050'); }
    hp(q(cx)-1,q(cy)-1,'#ffffff');
  }
}
function robotSpriteLOD(tier,f,st,full,oc,D){
  const key='L'+D+'|'+tier+'|'+f+'|'+st+'|'+Math.ceil(full*3)+'|'+(oc?oc[2]:'');
  let v=SPR_CACHE.get(key); if(v) return v;
  const b=robotSprite(tier,f,st,full,oc);
  const s=canvasOf(upscale(stripOutline(b.c),D));
  detailRobot(s,tier,f,st,full,D);
  outlineSprite(s,'#060507');
  v={c:s.c,ax:b.ax*D,ay:b.ay*D,D};
  SPR_CACHE.set(key,v); if(SPR_CACHE.size>1400) SPR_CACHE.delete(SPR_CACHE.keys().next().value);
  return v;
}
