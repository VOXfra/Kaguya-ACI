'use strict';

/* V0.8.4 — authoritative game-mode separation + force repair reset. */
const V084_MODE_META='voxCardSimV08_activeMode';
const V084_SLOT_PREFIX='voxCardSimV08_slot_';
const V084_VALID_MODES=new Set(['realistic','ludic','creative']);
function v084ActiveMode(){const m=localStorage.getItem(V084_MODE_META);return V084_VALID_MODES.has(m)?m:'realistic'}

/* The selected slot is authoritative, never a gameMode value that leaked from a cloud/shared save. */
state.gameMode=v084ActiveMode();

const v084SwitchModeBase=v08SwitchMode;
v08SwitchMode=function(mode){
 if(!V084_VALID_MODES.has(mode)||mode===v084ActiveMode())return;
 const current=v084ActiveMode();state.gameMode=current;save();
 let json=localStorage.getItem(V084_SLOT_PREFIX+mode);
 if(!json){const fresh=v08FreshSave(mode);fresh.gameMode=mode;fresh.lastSavedAt=Date.now();json=JSON.stringify(fresh)}
 try{const d=JSON.parse(json);d.gameMode=mode;d.version=Math.max(8,Number(d.version)||0);d.schemaVersion=Math.max(8,Number(d.schemaVersion)||0);d.lastSavedAt=Number(d.lastSavedAt)||Date.now();json=JSON.stringify(d)}catch{const d=v08FreshSave(mode);d.gameMode=mode;d.lastSavedAt=Date.now();json=JSON.stringify(d)}
 localStorage.setItem(V084_MODE_META,mode);localStorage.setItem(V084_SLOT_PREFIX+mode,json);localStorage.setItem(V06_STORAGE,json);localStorage.setItem(V06_BACKUP,json);
 try{VOXOnline?.setCloudWritesEnabled?.(false)}catch{}
 toast(`Mode ${V08_MODES[mode].label}…`);setTimeout(()=>location.reload(),280);
};

function v084KeptCards(){
 return (state.instances||[]).filter(x=>x&&x.status!=='sold').map(x=>{
  const c={...x,status:'owned',location:'inventory',binderSlot:null,purchasePrice:null,sourcePackCost:null,source:'force-reset'};
  if(c.isEnergy)c.energyKeeper=false;
  return c;
 });
}
function v084DiscoveriesFor(cards){
 const out={};for(const x of cards)if(!x.isEnergy&&x.setId&&x.cardId)out[`${x.setId}|${x.cardId}`]=Number(x.acquiredAt||x.openedAt||Date.now());return out;
}
function v084LudicStateFor(discovered){
 const keys=Object.keys(discovered),completedSets={};
 for(const sid of Object.keys(SETS)){let n=0;for(const k of keys)if(k.startsWith(sid+'|'))n++;if(n>=Number(SETS[sid]?.total||Infinity))completedSets[sid]=Date.now()}
 return{twentyMilestone:Math.floor(keys.length/20),completedSets,boosterCount:0,totalBonus:0};
}
function v084BuildForceReset(mode){
 const cards=v084KeptCards(),discovered=v084DiscoveriesFor(cards),d=v08FreshSave(mode),now=Date.now();
 d.version=8;d.schemaVersion=8;d.gameMode=mode;d.playerId=state.playerId||d.playerId;d.activeSet=SETS[state.activeSet]?state.activeSet:'sv03.5';d.wallet=1000;d.instances=cards;
 d.stock={};d.stockLots={};d.listings=[];d.sales=[];d.purchases=[];d.packsOpened={};d.currentOpening=null;d.binderOwned={};d.pageBySet={'sv03.5':0,'sv03':0,'sv02':0,'s6a':0};
 d.lastMarketTick=now;d.marketShift={};d.marketBooks={};d.marketSellers=[];d.priceHistory={};d.publicCards=[];d.jpPackPlans={};d.dailyDropBought={};d.eventCatalog={};d.luckyPacks=0;
 d.discoveredCards=discovered;d.ludicRewards=v084LudicStateFor(discovered);
 d.settings={...(state.settings||d.settings||{})};d.inventorySort=state.inventorySort||'numberAsc';d.notificationsEnabled=state.notificationsEnabled!==false;d.offlinePackMeta={...(state.offlinePackMeta||{})};
 d.friends=[...(state.friends||[])];d.friendRequestsOut=[...(state.friendRequestsOut||[])];d.friendDeclined=[...(state.friendDeclined||[])];
 if(state.sellerProfile&&!state.sellerProfile.legacyAuto)d.sellerProfile={...state.sellerProfile,completedSales:0,revenue:0};
 d.onlineProcessedSellerTrades=[];d.onlineProcessedBuyerTrades=[];d.lastSavedAt=now;return d;
}
function v084WriteModeSave(mode,obj){
 obj.gameMode=mode;obj.lastSavedAt=Number(obj.lastSavedAt)||Date.now();const json=JSON.stringify(obj);
 localStorage.setItem(V084_MODE_META,mode);localStorage.setItem(V084_SLOT_PREFIX+mode,json);localStorage.setItem(V06_STORAGE,json);localStorage.setItem(V06_BACKUP,json);return json;
}
function v084StartForceReset(){
 const mode=v084ActiveMode(),m=$('#sellModal');m.classList.remove('hidden');
 const kept=v084KeptCards().length;
 $('#sellContent').innerHTML=`<span class="tag danger-tag">RÉPARATION</span><h2>Force Reset · ${V08_MODES[mode].label}</h2><p>Cette opération conserve <strong>${kept} carte(s)</strong> actuellement possédée(s), remet le solde à <strong>1 000 €</strong> et efface le reste de la progression de ce mode : boosters, scellés, classeurs, annonces, ventes, achats et récompenses.</p><p>Les réglages, amis et ton identité de compte restent conservés.</p><label class="profile-field">Tape FORCE pour confirmer<input id="forceResetWord" autocomplete="off"></label><button id="forceResetFinal" class="danger-button" disabled>Force Reset</button><small id="forceResetState"></small>`;
 const inp=$('#forceResetWord'),btn=$('#forceResetFinal'),status=$('#forceResetState');
 inp.oninput=()=>btn.disabled=inp.value.trim().toUpperCase()!=='FORCE';
 btn.onclick=()=>{
  if(inp.value.trim().toUpperCase()!=='FORCE')return;btn.disabled=true;inp.disabled=true;
  const d=v084BuildForceReset(mode),now=Date.now();
  if(mode==='realistic'){
   d.onlineCloudEnabled=true;d.v08ResetNonce=`FORCE-${now}-${Math.random().toString(36).slice(2,10)}`;d.lastSavedAt=now;
   const json=v084WriteModeSave(mode,d);try{VOXNative?.mirrorSave?.(json)}catch{}
   const marker={mode:'realistic',nonce:d.v08ResetNonce,json,startedAt:now};localStorage.setItem(V082_RESET_MARKER,JSON.stringify(marker));status.textContent='Force Reset local effectué · remplacement du cloud Google…';
   if(typeof v082PushReset==='function'&&v082PushReset(marker))return;
   toast('Force Reset local effectué · cloud en attente');return;
  }
  const json=v084WriteModeSave(mode,d);try{VOXOnline?.setCloudWritesEnabled?.(false)}catch{};status.textContent='Progression réparée.';toast(`${V08_MODES[mode].label} réparé · ${d.instances.length} cartes conservées · 1 000 €`);setTimeout(()=>location.reload(),400);
 };
}

function v084InjectForceReset(){
 const card=$('#settingsModal .modal-card');if(!card||$('#v084ForceResetPanel'))return;
 const box=document.createElement('div');box.id='v084ForceResetPanel';box.className='backup-panel';box.innerHTML=`<div class="backup-head"><strong>Force Reset de réparation</strong><span>Conserve les cartes + 1 000 €</span></div><p>À utiliser pour nettoyer une progression touchée par l'ancien bug de séparation des modes.</p><div class="backup-actions"><button id="v084ForceResetBtn" class="danger-button">Force Reset</button></div>`;card.appendChild(box);$('#v084ForceResetBtn').onclick=v084StartForceReset;
}
const v084RenderSettingsBase=renderSettings;
renderSettings=function(){v084RenderSettingsBase();v084InjectForceReset()};

/* Keep UI and online state aligned with the authoritative mode. */
const v084UpdateStatsBase=updateStats;
updateStats=function(){state.gameMode=v084ActiveMode();v084UpdateStatsBase();if(v084ActiveMode()==='creative'){const w=$('#wallet');if(w)w.textContent='∞';const l=w?.previousElementSibling;if(l)l.textContent='Créatif'}};
if(v084ActiveMode()!=='realistic')try{VOXOnline?.setCloudWritesEnabled?.(false)}catch{}
setTimeout(()=>{try{state.gameMode=v084ActiveMode();renderSettings();renderProducts();renderInventory();renderBinder();renderHome();updateStats();v08RefreshModePill?.()}catch(e){console.warn('V0.8.4 mode refresh',e)}},180);
window.__voxV084ModeReady=true;
