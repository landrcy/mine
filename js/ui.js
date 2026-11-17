'use strict';
const $=s=>document.querySelector(s);
const ICONS={};
function icon(fi,rar){const k=fi+'|'+rar; return ICONS[k]||(ICONS[k]=oreIcon(fi,rar));}
function pct(p){p*=100; return (p>=10?p.toFixed(1):p>=1?p.toFixed(2):p>=0.01?p.toFixed(3):p.toPrecision(2))+'%';}
const UI = {
  sel:1, open:null, shown:0, bq:[], bOn:false, ports:[],
  init(){
    document.querySelectorAll('[data-panel]').forEach(b=>b.addEventListener('click',()=>UI.toggle(b.dataset.panel)));
    $('#panels').addEventListener('click',UI.click);
    $('#tool').addEventListener('click',()=>UI.setTool(Input.tool==='dig'?'pan':'dig'));
    $('#btop').addEventListener('click',()=>{cam.ty=-SKY*TILE*0.55; flashBtn('#btop');});
    $('#bdeep').addEventListener('click',()=>{cam.ty=G.deepest*TILE-VH*0.5; flashBtn('#bdeep');});
  },
  setTool(t){ Input.tool=t; const b=$('#tool'); b.textContent=t==='dig'?'DIG':'PAN'; b.classList.toggle('pan',t==='pan'); flashBtn('#tool'); },
  toggle(name){
    if(UI.open===name){ UI.close(); return; }
    UI.open=name; document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('on',p.id==='p-'+name));
    document.querySelectorAll('[data-panel]').forEach(b=>b.classList.toggle('act',b.dataset.panel===name));
    UI.render();
  },
  close(){ UI.open=null; document.querySelectorAll('.panel').forEach(p=>p.classList.remove('on')); document.querySelectorAll('[data-panel]').forEach(b=>b.classList.remove('act')); },
  render(){ if(!UI.open) return; ({robots:UI.rRobots,base:UI.rBase,log:UI.rLog,odds:UI.rOdds})[UI.open](); UI.tick(true); },
  rRobots(){
    const sel=G.robots.find(r=>r.id===UI.sel)||G.robots[0]; UI.sel=sel.id; const n=G.robots.length, full=n>=slots(), c=robotCost(n+1);
    let h=`<header><h2>ROBOTS</h2><span>${n}/${slots()} BAY</span></header>
      <button class="buy wide" data-act="build" ${full?'disabled':''} data-cost="${full?'':c}">${full?'BAY FULL · UPGRADE ROBOT BAY IN BASE':'BUILD ROBOT <b>'+fmt(c)+'</b>'}</button>
      <p class="hint">Every new build rolls a rarity. Higher rarity = faster drill + bigger battery. Luck helps.</p><div class="rlist">`;
    G.robots.forEach(r=>{ h+=`<div class="rcard ${r.id===sel.id?'sel':''}" data-act="sel" data-id="${r.id}" style="--rc:${RAR[r.rar].c}">
      <canvas class="port" width="40" height="34" data-port="${r.id}"></canvas>
      <div><b>#${r.id} ${TIERS[r.tier].n}</b><i style="color:${RAR[r.rar].c}">${RAR[r.rar].n} BUILD · TIER ${ROMAN[r.tier]}</i><em data-stat="${r.id}"></em></div></div>`; });
    h+=`</div><div class="rdetail"><h3>#${sel.id} UPGRADES</h3>`;
    Object.keys(RUPG).forEach(k=>{const u=RUPG[k], L=sel.up[k], mx=L>=u.max;
      h+=`<div class="row"><div><b>${u.n}</b> <span class="pips">${'▮'.repeat(L)}<s>${'▮'.repeat(u.max-L)}</s></span><small>${u.fx(L)}${mx?'':' → '+u.fx(L+1)}</small></div>
      <button class="buy" data-act="rup" data-k="${k}" ${mx?'disabled':''} data-cost="${mx?'':u.cost(L)}">${mx?'MAX':fmt(u.cost(L))}</button></div>`;});
    if(sel.tier<TIERS.length-1){ const t=TIERS[sel.tier+1];
      h+=`<div class="tierup"><canvas class="port big" width="40" height="34" data-port="next"></canvas><div><small>TRANSFORM TO TIER ${ROMAN[sel.tier+1]}</small><b>${t.n}</b><small>${t.d} Digs hardness ${t.dig} (${STRATA.filter(s=>s.h===t.dig).map(s=>s.name).join(', ')}).</small></div>
      <button class="buy tier" data-act="tier" data-cost="${t.cost}">${fmt(t.cost)}</button></div>`; }
    else h+=`<div class="tierup max"><b>FINAL FORM</b><small>Nothing left to become.</small></div>`;
    $('#p-robots').innerHTML=h+'</div>';
  },
  rBase(){
    let h=`<header><h2>BASE</h2><span>PLAYER-WIDE</span></header><p class="hint">These upgrade the whole operation, not one robot.</p>`;
    Object.keys(GUPG).forEach(k=>{const u=GUPG[k], L=G.up[k], mx=L>=u.max;
      h+=`<div class="row"><div><b>${u.n}</b> <span class="pips">${'▮'.repeat(L)}<s>${'▮'.repeat(Math.min(u.max,20)-L)}</s></span><small>${u.d(L)}${mx?'':' → '+u.d(L+1)}</small></div>
      <button class="buy" data-act="gup" data-k="${k}" ${mx?'disabled':''} data-cost="${mx?'':u.cost(L)}">${mx?'MAX':fmt(u.cost(L))}</button></div>`;});
    $('#p-base').innerHTML=h;
  },
  rLog(){
    const anySing=FINDS.some(f=>(G.log[f.id]||[])[6]>0);
    let variants=0; FINDS.forEach(f=>(G.log[f.id]||[]).forEach(c=>{if(c>0)variants++;}));
    let h=`<header><h2>DISCOVERY LOG</h2><span>${variants}/${FINDS.length*RAR.length} VARIANTS</span></header>
      <p class="hint">${G.found} finds total · best: <b style="color:${G.best>=0?RAR[G.best].c:'#888'}">${G.best>=0?RAR[G.best].n:'none yet'}</b></p>
      <table class="log"><tr><th></th>${RAR.map((r,i)=>`<th style="color:${r.c}">${i===6&&!anySing?'?':r.n[0]}</th>`).join('')}</tr>`;
    FINDS.forEach((f,fi)=>{const L=G.log[f.id], known=!!L;
      h+=`<tr class="${known?'':'unk'}"><td><img src="${icon(fi,null)}" alt=""><span>${known?f.name:'???'}</span><small>${known?f.top*M_PER_ROW+'m+':''}</small></td>${RAR.map((r,i)=>`<td style="--c:${r.c}" class="${L&&L[i]?'got':''}">${L&&L[i]?L[i]:'·'}</td>`).join('')}</tr>`;});
    h+='</table><h3>RECENT</h3><div class="recent">'+(G.recent.length?G.recent.map(([fi,r,y])=>`<div style="--c:${RAR[r].c}"><img src="${icon(fi,r)}" alt=""><b>${RAR[r].n}</b> ${FINDS[fi].name}<small>${y*M_PER_ROW}m</small></div>`).join(''):'<p class="hint">Nothing yet. Mark some tunnels.</p>')+'</div>';
    $('#p-log').innerHTML=h;
  },
  rOdds(){
    const L=luck(), d=G.deepest, o=rarityOdds(d,L), si=W.strat[I(Math.min(COLS-1,SHAFT),Math.max(0,d))], anySing=FINDS.some(f=>(G.log[f.id]||[])[6]>0);
    let h=`<header><h2>DROP ODDS</h2><span>LIVE</span></header>
      <p class="hint">Computed right now by the same function that rolls every find. Deeper rows and more luck shift the odds up. Rich deposits add +0.5 luck.</p>
      <p class="hint">At your deepest point: <b>${d*M_PER_ROW}m · ${STRATA[si].name}</b> · luck <b>+${L.toFixed(1)}</b></p><div class="odds">`;
    RAR.forEach((r,i)=>{ h+=`<div style="--c:${r.c}"><i></i><b>${i===6&&!anySing?'???':r.n}</b><span>${pct(o[i])}</span><small>x${r.m} value</small></div>`; });
    h+=`</div><h3>BY LAYER (top of each layer, your luck)</h3><table class="ot"><tr><th>LAYER</th>${RAR.map((r,i)=>`<th style="color:${r.c}">${i===6&&!anySing?'?':r.n.slice(0,3)}</th>`).join('')}</tr>`;
    STRATA.forEach(s=>{const p=rarityOdds(s.top,L); h+=`<tr><td>${s.name}</td>${p.map(x=>`<td>${pct(x)}</td>`).join('')}</tr>`;});
    h+=`</table><h3>ROBOT BUILD ROLL (surface odds)</h3><p class="hint">${rarityOdds(0,L).map((x,i)=>`<span style="color:${RAR[i].c}">${i===6&&!anySing?'???':RAR[i].n} ${pct(x)} (x${BUILD_MULT[i]})</span>`).join(' · ')}</p>`;
    $('#p-odds').innerHTML=h;
  },
  click(e){
    const b=e.target.closest('[data-act]'); if(!b||b.disabled) return; const a=b.dataset.act, sel=G.robots.find(r=>r.id===UI.sel);
    let ok=false;
    if(a==='sel'){ UI.sel=+b.dataset.id; const r=G.robots.find(q=>q.id===UI.sel); if(r) cam.ty=r.y-VH*0.55, cam.tx=r.x-VW/2; UI.rRobots(); UI.tick(true); return; }
    if(a==='build'){ const r=buyRobot(); if(r){ ok=true; UI.sel=r.id; UI.toast(`Robot #${r.id} built: <b style="color:${RAR[r.rar].c}">${RAR[r.rar].n}</b> quality (x${BUILD_MULT[r.rar]})`); if(r.rar>=1) RG.push({x:r.x,y:r.y-8,t:0,m:0.8,c:RAR[r.rar].c,R:20+r.rar*6}); } }
    if(a==='rup'&&sel) ok=buyRobotUp(sel,b.dataset.k);
    if(a==='tier'&&sel){ ok=buyTier(sel); if(ok){ cam.tx=sel.x-VW/2; cam.ty=sel.y-VH*0.55; UI.tierBanner(sel); } }
    if(a==='gup') ok=buyGlobal(b.dataset.k);
    if(ok){ save(); UI.render(); const nb=document.querySelector(`[data-act="${a}"]${b.dataset.k?`[data-k="${b.dataset.k}"]`:''}`); if(nb) pop(nb); UI.coins(b); }
    else { b.classList.remove('deny'); void b.offsetWidth; b.classList.add('deny'); }
  },
  coins(el){ if(reduced) return; const r=el.getBoundingClientRect(); for(let i=0;i<8;i++){const c=document.createElement('i'); c.className='coin'; c.style.left=(r.left+r.width/2)+'px'; c.style.top=(r.top+r.height/2)+'px'; c.style.setProperty('--dx',(Math.random()*80-40)+'px'); c.style.setProperty('--dy',(-30-Math.random()*50)+'px'); document.body.appendChild(c); setTimeout(()=>c.remove(),700);} },
  tick(force){
    // money ticks toward the real value
    const m=$('#money'); UI.shown += (G.money-UI.shown)*(reduced?1:0.18); if(Math.abs(G.money-UI.shown)<1) UI.shown=G.money; m.textContent=fmt(UI.shown);
    $('#depth').textContent=G.deepest*M_PER_ROW+'m';
    const cs=W.strat[I(0,Math.max(0,Math.min(ROWS-1,Math.floor((cam.y+VH/2)/TILE))))]; const zl=$('#layer'), zn=(cam.y+VH/2)<0?'SURFACE':STRATA[cs].name;
    if(zl.textContent!==zn){ zl.textContent=zn; pop(zl); }
    $('#bots').textContent=G.robots.length+'/'+slots(); $('#luck').textContent='+'+luck().toFixed(1);
    document.querySelectorAll('#panels [data-cost]').forEach(b=>{ const c=+b.dataset.cost; if(b.dataset.cost!=='') b.classList.toggle('no',G.money<c); });
    if(UI.open==='robots'){
      G.robots.forEach(r=>{ const e=document.querySelector(`[data-stat="${r.id}"]`); if(!e) return;
        const s={idle:'PARKED',move:r.home?'HAULING UP':'HEADING DOWN',drill:'DRILLING',unload:'UNLOADING'}[r.st]+(r.tfx?' · TRANSFORMING':'');
        e.textContent=`${s} · ${Math.max(0,r.ty)*M_PER_ROW}m · CARGO ${r.cargo.length}/${hopCap(r)} · BAT ${Math.round(100*r.bat/batMax(r))}%`; });
    }
  },
  ports(T){
    if(UI.open!=='robots') return;
    document.querySelectorAll('canvas[data-port]').forEach(c=>{ const g=c.getContext('2d'); g.imageSmoothingEnabled=false; g.clearRect(0,0,40,34);
      const id=c.dataset.port, sel=G.robots.find(r=>r.id===UI.sel); const r=id==='next'?sel:G.robots.find(q=>q.id===+id); if(!r) return;
      const tier=id==='next'?Math.min(TIERS.length-1,r.tier+1):r.tier, f=Math.floor(T*10)&7, st=id==='next'?'drill':(r.st==='drill'?'drill':r.st==='move'?'move':'idle');
      const s=robotSprite(tier,f,st,id==='next'?0:r.cargo.length/hopCap(r),FINDS[r.cargo.length?r.cargo[r.cargo.length-1][0]:0].col);
      g.drawImage(s.c,Math.round(20-s.ax),34-s.c.height); });
  },
  bump(){ const m=$('#money'); m.classList.remove('up'); void m.offsetWidth; m.classList.add('up'); },
  banner(fi,rar,isNew,row){ UI.bq.push({fi,rar,isNew,row}); if(UI.bq.length>4) UI.bq.splice(1,1); if(!UI.bOn) UI.nextBanner(); },
  nextBanner(){
    const b=UI.bq.shift(), el=$('#banner'); if(!b){ UI.bOn=false; return; } UI.bOn=true;
    const R=RAR[b.rar], f=FINDS[b.fi];
    el.className='r'+b.rar+(b.rar>=4?' big':''); el.style.setProperty('--c',R.c);
    el.innerHTML=`<img src="${icon(b.fi,b.rar)}" alt=""><div>${b.isNew?'<em>NEW</em>':''}<small>${R.n}</small><b>${f.name}</b><small>${b.row*M_PER_ROW}m · worth ${fmt(oreValue(b.fi,b.rar))}</small></div>`;
    void el.offsetWidth; el.classList.add('show');
    setTimeout(()=>{ el.classList.remove('show'); setTimeout(UI.nextBanner, reduced?150:320); }, b.rar>=4?3200:2200);
    if(UI.open==='log') UI.rLog();
  },
  tierBanner(r){ UI.bq.unshift(null); UI.bq.shift();
    const el=$('#tier'); el.innerHTML=`<small>ROBOT #${r.id} TRANSFORMED</small><b>TIER ${ROMAN[r.tier]}</b><span>${TIERS[r.tier].n}</span>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2600);
    if(!reduced){ shake=0.35; shakeMag=1+Math.floor(r.tier/2); }
    setTimeout(()=>{ flash={t:0,m:0.2,c:'#ffffff',a:reduced?0.15:0.4}; RG.push({x:r.x,y:r.y-8,t:0,m:0.8,c:'#ffffff',R:40}); }, reduced?0:780);
  },
  zone(si){
    const s=STRATA[si], el=$('#zone'), need=s.h>TIERS[bestTier()].dig;
    el.innerHTML=`<small>NEW LAYER · ${s.top*M_PER_ROW}m</small><b>${s.name}</b><span>HARDNESS ${s.h}${need?' · NEEDS TIER '+ROMAN[TIERS.findIndex(t=>t.dig>=s.h)]:''}</span>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); clearTimeout(UI.zt); UI.zt=setTimeout(()=>el.classList.remove('show'),3400);
  },
  toast(html,ms){ const el=$('#toast'); el.innerHTML=html; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); clearTimeout(UI.tt); UI.tt=setTimeout(()=>el.classList.remove('show'),ms||3200); },
};
function pop(el){ el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
function flashBtn(s){ pop($(s)); }
