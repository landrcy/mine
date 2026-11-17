'use strict';
// ================= ADMIN PANEL (press L; on phones long-press the LUCK stat) =================
// Every action edits G through the same fields the save already validates (normalize), then saves.
const ADMIN = {
  reveal:false, speed:1, picking:null, rconf:false,
  isTyping(e){ const t=e.target; return t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable); },
  toggle(){ if(MODE!=='game') return; UI.toggle('admin'); },
  opt(list,sel){ return list.map((n,i)=>`<option value="${i}"${i===sel?' selected':''}>${n}</option>`).join(''); },
  render(){
    const r=G.robots.find(q=>q.id===UI.sel)||G.robots[0], RN=RAR.map(x=>x.n), TN=TIERS.map((t,i)=>ROMAN[i]+' '+t.n);
    let h=`<header><h2>ADMIN</h2><span>L TO CLOSE</span></header>
    <h3>CASH <small class="adm-v">${fmt(G.money)}</small></h3>
    <div class="adm-r"><button class="buy" data-adm="cash" data-v="1000">+1K</button><button class="buy" data-adm="cash" data-v="1000000">+1M</button></div>
    <div class="adm-r"><input id="adm-cash" type="number" min="0" step="1" placeholder="amount" inputmode="numeric"><button class="buy" data-adm="cashadd">ADD</button><button class="buy" data-adm="cashset">SET</button></div>
    <h3>LUCK BONUS <small class="adm-v" id="adm-lv">+${G.xluck.toFixed(1)} (total +${luck().toFixed(1)})</small></h3>
    <input id="adm-luck" class="adm-sl" type="range" min="0" max="5" step="0.1" value="${G.xluck}">
    <h3>SPAWN ROBOT <small class="adm-v">${G.robots.length}/${slots()} bay</small></h3>
    <div class="adm-r"><select id="adm-st">${ADMIN.opt(TN,0)}</select><select id="adm-sr">${ADMIN.opt(RN,0)}</select><button class="buy" data-adm="spawn">SPAWN</button></div>
    <h3>SELECTED ROBOT #${r.id}</h3>
    <div class="adm-r"><select id="adm-rt">${ADMIN.opt(TN,r.tier)}</select><select id="adm-rr">${ADMIN.opt(RN,r.rar)}</select></div>
    <div class="adm-g">${Object.keys(RUPG).map(k=>`<label>${RUPG[k].n}<input type="number" min="0" max="${RUPG[k].max}" value="${r.up[k]}" data-ru="${k}"></label>`).join('')}</div>
    <div class="adm-r"><button class="buy wide" data-adm="setbot">APPLY TO #${r.id}</button></div>
    <div class="adm-r"><button class="buy wide" data-adm="maxbots">MAX ALL ROBOTS</button></div>
    <div class="adm-r"><button class="buy wide" data-adm="maxbase">MAX ALL BASE UPGRADES</button></div>
    <h3>CAMERA</h3>
    <div class="adm-r"><input id="adm-depth" type="number" min="0" max="${(ROWS-1)*M_PER_ROW}" step="2" placeholder="depth m"><button class="buy" data-adm="tp">GO</button></div>
    <h3>MAP</h3>
    <div class="adm-r"><button class="buy ${ADMIN.reveal?'tier':''}" data-adm="reveal">REVEAL ${ADMIN.reveal?'ON':'OFF'}</button></div>
    <div class="adm-r"><input id="adm-d0" type="number" min="0" step="2" placeholder="from m"><input id="adm-d1" type="number" min="0" step="2" placeholder="to m"><input id="adm-x0" type="number" min="0" max="${COLS-1}" placeholder="col" value="0"><input id="adm-x1" type="number" min="0" max="${COLS-1}" placeholder="col" value="${COLS-1}"></div>
    <div class="adm-r"><button class="buy wide" data-adm="dig">DIG OUT REGION</button></div>
    <h3>FINDS</h3>
    <div class="adm-r"><select id="adm-fr"><option value="-1">NEXT FIND: NORMAL ROLL</option>${RN.map((n,i)=>`<option value="${i}"${G.forceRar===i?' selected':''}>NEXT FIND: ${n}</option>`).join('')}</select></div>
    <div class="adm-r"><select id="adm-ore">${ADMIN.opt(FINDS.map(f=>f.name),0)}</select><button class="buy" data-adm="pick">${ADMIN.picking?'TAP A TILE…':'PLACE AT TILE'}</button></div>
    <div class="adm-r"><button class="buy wide" data-adm="unlock">UNLOCK ALL LOG ENTRIES</button></div>
    <h3>GAME SPEED</h3>
    <div class="adm-r">${[1,2,5,10].map(v=>`<button class="buy ${ADMIN.speed===v?'tier':''}" data-adm="speed" data-v="${v}">${v}X</button>`).join('')}</div>
    <h3>SAVE</h3>
    <div class="adm-r"><button class="buy wide adm-red" data-adm="reset">${ADMIN.rconf?'TAP AGAIN: WIPE AND START OVER':'RESET SAVE'}</button></div>
    <p class="hint">Reset keeps a backup copy of the old save in this browser.</p>`;
    $('#p-admin').innerHTML=h; UI.closeBtn('admin');
  },
  done(msg){ recomputeConn(); save(); UI.tick(true); if(msg) UI.toast(msg,1800); ADMIN.render(); },
  int(id,lo,hi){ const v=+$(id).value; if($(id).value===''||!isFinite(v)) return null; return Math.max(lo,Math.min(hi,Math.round(v))); },
  click(e){
    const b=e.target.closest('[data-adm]'); if(!b) return; const a=b.dataset.adm, r=G.robots.find(q=>q.id===UI.sel)||G.robots[0];
    if(a!=='reset') ADMIN.rconf=false;
    if(a==='cash'){ G.money+=+b.dataset.v; UI.bump(); return ADMIN.done(); }
    if(a==='cashadd'||a==='cashset'){ const v=ADMIN.int('#adm-cash',0,1e15); if(v===null) return UI.toast('Type an amount first.',1500); G.money=a==='cashadd'?Math.min(1e15,G.money+v):v; UI.shown=G.money; return ADMIN.done(); }
    if(a==='spawn'){
      if(G.robots.length>=slots()){ if(G.up.bay<GUPG.bay.max) G.up.bay++; else return UI.toast('Robot bay is at its maximum.',1800); }
      const t=+$('#adm-st').value|0, rr=+$('#adm-sr').value|0, n=newRobot(Math.max(0,Math.min(TIERS.length-1,t)),Math.max(0,Math.min(RAR.length-1,rr)));
      n.bat=batMax(n); G.robots.push(n); UI.sel=n.id; return ADMIN.done(`Robot #${n.id} spawned.`); }
    if(a==='setbot'){
      const t=Math.max(0,Math.min(TIERS.length-1,+$('#adm-rt').value|0)), rr=Math.max(0,Math.min(RAR.length-1,+$('#adm-rr').value|0));
      if(t!==r.tier){ r.tfx={t:0,d:reduced?0.7:1.8,from:r.tier}; r.tier=t; }
      r.rar=rr; document.querySelectorAll('#p-admin [data-ru]').forEach(i=>{ const k=i.dataset.ru, v=+i.value; r.up[k]=isFinite(v)?Math.max(0,Math.min(RUPG[k].max,Math.round(v))):r.up[k]; });
      r.bat=batMax(r); if(r.job&&!jobValid(r)){ release(r); r.st='idle'; } return ADMIN.done(`Robot #${r.id} updated.`); }
    if(a==='maxbots'){ const top=TIERS.length-1; G.robots.forEach(q=>{ if(q.tier!==top){ q.tfx={t:0,d:reduced?0.7:1.8,from:q.tier}; q.tier=top; } for(const k in RUPG) q.up[k]=RUPG[k].max; q.bat=batMax(q); });
      return ADMIN.done(`All ${G.robots.length} robots maxed: ${TIERS[top].n}.`); }
    if(a==='maxbase'){ for(const k in GUPG) G.up[k]=GUPG[k].max; return ADMIN.done('All base upgrades maxed.'); }
    if(a==='tp'){ const m=ADMIN.int('#adm-depth',0,(ROWS-1)*M_PER_ROW); if(m===null) return; const row=Math.floor(m/M_PER_ROW); cam.ty=row*TILE-viewH()/2; cam.tx=SHAFT*TILE-viewW()/2; if(reduced) clampCam(true); return; }
    if(a==='reveal'){ ADMIN.reveal=!ADMIN.reveal; return ADMIN.render(); }
    if(a==='dig'){
      const d0=ADMIN.int('#adm-d0',0,(ROWS-1)*M_PER_ROW), d1=ADMIN.int('#adm-d1',0,(ROWS-1)*M_PER_ROW); if(d0===null||d1===null) return UI.toast('Type a depth range in meters.',1800);
      const x0=ADMIN.int('#adm-x0',0,COLS-1)??0, x1=ADMIN.int('#adm-x1',0,COLS-1)??COLS-1, y0=Math.floor(Math.min(d0,d1)/M_PER_ROW), y1=Math.floor(Math.max(d0,d1)/M_PER_ROW);
      for(let y=y0;y<=y1;y++)for(let x=Math.min(x0,x1);x<=Math.max(x0,x1);x++){ const k=I(x,y); G.dug[k]=1; G.mark[k]=0; reserved.delete(k); }
      DUGVER++; if(y1>G.deepest) G.deepest=y1; for(let y=y0;y<=y1;y++){ const s=W.strat[I(0,y)]; if(!G.seen.includes(s)) G.seen.push(s); }
      G.robots.forEach(q=>{ if(q.job&&!jobValid(q)){ release(q); q.st='idle'; q.think=0; } });
      return ADMIN.done(`Dug ${y0*M_PER_ROW}–${y1*M_PER_ROW}m.`); }
    if(a==='pick'){ ADMIN.picking=ADMIN.picking?null:{fi:+$('#adm-ore').value|0}; if(ADMIN.picking){ UI.toast('Tap a rock tile to place the ore.',2200); if(innerWidth<760){ ADMIN.picking.reopen=1; UI.close(); return; } } return ADMIN.render(); }
    if(a==='unlock'){ FINDS.forEach(f=>{ const L=G.log[f.id]||(G.log[f.id]=[0,0,0,0,0,0,0]); for(let i=0;i<L.length;i++) L[i]=Math.max(1,L[i]|0); }); G.seen=STRATA.map((s,i)=>i); return ADMIN.done('Every log entry unlocked.'); }
    if(a==='speed'){ ADMIN.speed=+b.dataset.v||1; return ADMIN.render(); }
    if(a==='reset'){ if(!ADMIN.rconf){ ADMIN.rconf=true; return ADMIN.render(); }
      ADMIN.rconf=false; try{ const raw=localStorage.getItem(SAVE_KEY); if(raw) localStorage.setItem(SAVE_KEY+'-backup-'+Date.now(),raw); }catch(_){}
      localStorage.removeItem(SAVE_KEY); newGame(); reserved.clear(); recomputeConn(); UI.sel=G.robots[0].id; UI.shown=G.money; ADMIN.speed=1; ADMIN.reveal=false; save(); cam.ty=-viewH()*0.42; return ADMIN.done('Save reset. A backup was kept.'); }
  },
  change(e){
    const t=e.target;
    if(t.id==='adm-luck'){ const v=+t.value; G.xluck=isFinite(v)?Math.max(0,Math.min(5,Math.round(v*10)/10)):0; const l=$('#adm-lv'); if(l) l.textContent=`+${G.xluck.toFixed(1)} (total +${luck().toFixed(1)})`; UI.tick(true); if(e.type==='change') save(); }
    if(t.id==='adm-fr' && e.type==='change'){ const v=+t.value|0; G.forceRar=Math.max(-1,Math.min(RAR.length-1,v)); save(); }
  },
  // place an ore at a tapped tile (called from the canvas pointer handler while picking)
  place(tx,ty){
    const p=ADMIN.picking; ADMIN.picking=null; if(p.reopen&&UI.open!=='admin') UI.toggle('admin'); if(tx<0||tx>=COLS||ty<1||ty>=ROWS){ UI.toast('Pick a tile inside the claim.',1600); return ADMIN.render(); }
    const k=I(tx,ty); if(G.dug[k]){ UI.toast('That tile is already dug. Pick solid rock.',1800); return ADMIN.render(); }
    W.ore[k]=p.fi+1; W.deco[k]=0; G.oreAdd[k]=p.fi+1; ADMIN.done(`${FINDS[p.fi].name} placed at ${ty*M_PER_ROW}m.`);
  },
  init(){
    const pn=$('#p-admin'); pn.addEventListener('click',ADMIN.click); pn.addEventListener('input',ADMIN.change); pn.addEventListener('change',ADMIN.change);
    // hidden mobile entry: hold the LUCK stat for a second
    const lk=$('#luck').closest('.stat'); let tm=null; lk.style.pointerEvents='auto'; lk.style.touchAction='none'; lk.style.webkitTouchCallout='none';
    lk.addEventListener('pointerdown',()=>{ clearTimeout(tm); tm=setTimeout(()=>{ tm=null; ADMIN.toggle(); },900); });
    ['pointerup','pointerleave','pointercancel'].forEach(ev=>lk.addEventListener(ev,()=>{ clearTimeout(tm); tm=null; }));
    lk.addEventListener('contextmenu',e=>e.preventDefault());
  }
};
