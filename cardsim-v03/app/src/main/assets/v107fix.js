'use strict';
/* VOX Card Sim V1.0.7 — Android-safe final layer: year navigation, offline catalog,
   save/cloud repair and low-power/performance fixes. */
const V107_VERSION='1.0.7';
const V107_YEAR_KEY='voxCardSimV107_collectionYear';
const V107_LASTGOOD_PREFIX='voxCardSimV107_lastgood_';
const V107_OLD_YEARS={'sv03.5':2023,'sv03':2023,'sv02':2023,'s6a':2021,'me05':2026};

function v107SetYear(s){
 const y=Number(s?.releaseYear)||Number(String(s?.releaseDate||'').slice(0,4))||V107_OLD_YEARS[s?.id];
 return Number.isFinite(y)&&y>2000?y:null;
}
function v107Years(){return [...new Set(Object.values(SETS).map(v107SetYear).filter(Boolean))].sort((a,b)=>b-a)}
function v107YearFilter(){const raw=localStorage.getItem(V107_YEAR_KEY)||'all';return raw==='all'||v107Years().includes(Number(raw))?raw:'all'}
function v107SetYearFilter(v){localStorage.setItem(V107_YEAR_KEY,String(v));renderSetSwitches()}

/* ---------- COLLECTION NAVIGATION BY YEAR ---------- */
renderSetSwitches=function(){
 const selected=v107YearFilter(),sets=Object.values(SETS).slice().sort((a,b)=>(v107SetYear(b)||0)-(v107SetYear(a)||0)||String(b.releaseDate||'').localeCompare(String(a.releaseDate||''))||a.name.localeCompare(b.name,'fr'));
 const years=v107Years();
 $$('[data-set-switch]').forEach(box=>{
  const visible=selected==='all'?sets:sets.filter(s=>v107SetYear(s)===Number(selected));
  box.innerHTML=`<div class="v107-year-row"><button class="${selected==='all'?'active':''}" data-year="all">Tous</button>${years.map(y=>`<button class="${String(selected)===String(y)?'active':''}" data-year="${y}">${y}</button>`).join('')}</div><div class="v107-set-row">${visible.map(s=>`<button class="${state.activeSet===s.id?'active':''}" data-set="${s.id}">${escapeHtml(s.name)}</button>`).join('')}</div>`;
  box.querySelectorAll('[data-year]').forEach(b=>b.onclick=()=>v107SetYearFilter(b.dataset.year));
  box.querySelectorAll('[data-set]').forEach(b=>b.onclick=()=>selectSet(b.dataset.set));
 });
};

/* ---------- OFFLINE: ALL SETS, GROUPED BY YEAR ---------- */
const v107OfflineManifestBase=v05OfflineManifest;
v05OfflineManifest=function(setId){
 const cfg=SETS[setId];
 if(!cfg?.v105Catalog)return v107OfflineManifestBase(setId);
 const cards=cardsFor(setId);if(!state.metaReady?.[setId]||cards.length!==Number(cfg.total))throw new Error(`v107-set-not-ready-${setId}-${cards.length}`);
 const urls=new Set(),add=u=>{u=String(u||'').trim();if(/^https:\/\//i.test(u))urls.add(u)};
 for(const c of cards){
  const candidates=[c.imageLarge,c.imageSmall,c.image,...(c.images||[])];let high=candidates.find(x=>/\/high\.webp(?:\?|$)/i.test(String(x||'')))||c.imageLarge||c.image;
  high=String(high||'');if(high&&!/\.(?:webp|png|jpe?g)(?:\?|$)/i.test(high)&&!/\/high\.webp$/i.test(high))high=high.replace(/\/$/,'')+'/high.webp';add(high);
 }
 const logo=String(state.sets?.[setId]?.logo||'');if(logo)add(/\.(?:webp|png|jpe?g)(?:\?|$)/i.test(logo)?logo:logo+'.webp');
 for(const p of cfg.products||[])add(p.image);
 return [...urls];
};

const v107HydratePricesBase=v05HydratePrices;
v05HydratePrices=async function(setId,statusEl){
 const cfg=SETS[setId];if(!cfg?.v105Catalog)return v107HydratePricesBase(setId,statusEl);
 const cards=cardsFor(setId);for(const c of cards){
  const std=typeof v105EmbeddedPrice==='function'?Number(v105EmbeddedPrice(c,'standard')):0;
  const rev=typeof v105EmbeddedPrice==='function'?Number(v105EmbeddedPrice(c,'reverse')):0;
  if(std>0||rev>0)state.lastKnownEstimates[c.id]={standard:std||rev||null,reverse:rev||std||null,updated:null,fetchedAt:Date.now()};
 }
 save();if(statusEl)statusEl.textContent=`Hors ligne prêt · ${cards.length} cartes + prix embarqués`;
};

function v107OfflineStatus(id,row){
 let s=state.offlinePackMeta?.[id]||{installed:false};try{s=v05NativePackStatus(id)||s}catch{}
 const status=row.querySelector('.offline-status'),btn=row.querySelector('button');
 if(s.installed){status.textContent=`Disponible hors ligne · ${v05FormatBytes(s.bytes)}${s.completedAt?` · ${new Date(s.completedAt).toLocaleDateString('fr-FR')}`:''}`;btn.textContent='Mettre à jour'}
 else{status.textContent='Non téléchargée';btn.textContent='Télécharger'}
}
function v107RebuildOfflinePanel(){
 const card=$('#settingsModal .modal-card');if(!card)return;
 let sec=card.querySelector('.offline-settings');if(!sec){sec=document.createElement('div');sec.className='offline-settings';card.appendChild(sec)}
 const sets=Object.values(SETS).slice().sort((a,b)=>(v107SetYear(b)||0)-(v107SetYear(a)||0)||a.name.localeCompare(b.name,'fr'));
 const sig=sets.map(s=>s.id).join('|');if(sec.dataset.v107Sig!==sig){
  const groups=new Map();for(const s of sets){const y=v107SetYear(s)||'Autres';if(!groups.has(y))groups.set(y,[]);groups.get(y).push(s)}
  sec.innerHTML=`<div class="settings-divider"></div><span class="tag">HORS LIGNE</span><h3>Collections disponibles sans réseau</h3><p>Scans HD et prix embarqués. Les collections sont regroupées par année.</p>${[...groups].map(([y,a])=>`<div class="v107-offline-year"><strong>${y}</strong><span>${a.length} collection${a.length>1?'s':''}</span></div>${a.map(s=>`<div class="offline-row" data-offline-set="${s.id}"><div><strong>${escapeHtml(s.name)}</strong><small class="offline-status">Vérification…</small></div><button class="secondary small">Télécharger</button></div>`).join('')}`).join('')}`;
  sec.dataset.v107Sig=sig;sec.querySelectorAll('[data-offline-set] button').forEach(b=>b.onclick=()=>v05DownloadOffline(b.closest('[data-offline-set]').dataset.offlineSet));
 }
 for(const row of sec.querySelectorAll('[data-offline-set]'))v107OfflineStatus(row.dataset.offlineSet,row);
}

/* v05RefreshOfflinePanel used to serialize the whole save on every visual refresh. */
v05RefreshOfflinePanel=function(){const sec=$('#settingsModal .offline-settings');if(!sec)return;for(const row of sec.querySelectorAll('[data-offline-set]'))v107OfflineStatus(row.dataset.offlineSet,row)};

/* ---------- CLOUD / SAVE REPAIR ---------- */
function v107Mode(){try{return v084ActiveMode()}catch{return typeof v08Mode==='function'?v08Mode():'realistic'}}
function v107CloudUi(){
 const mode=v107Mode(),cloud=$('#onlineCloudState'),sync=$('#syncOnlineNow');
 if(mode!=='realistic'){
  if(state.online)state.online.cloudStatus='Désactivé dans ce mode · sauvegarde locale active';
  try{VOXOnline?.setCloudWritesEnabled?.(false)}catch{}
  if(cloud)cloud.textContent='Cloud : réservé au mode Réaliste · sauvegarde locale active';
  if(sync){sync.disabled=true;sync.textContent='Cloud réservé au Réaliste'}
 }else if(sync){sync.disabled=false;sync.textContent='Synchroniser'}
}
let v107CloudTimer=0;
function v107ArmCloudTimeout(){clearTimeout(v107CloudTimer);v107CloudTimer=setTimeout(()=>{if(v107Mode()==='realistic'&&state.online?.cloudStatus==='Vérification du cloud…'){state.online.cloudStatus='Cloud indisponible ou lent · sauvegarde locale active';try{v07RefreshOnlinePanel()}catch{}v107CloudUi()}},10000)}
const v107OnlineEventBase=window.voxOnlineEvent;
window.voxOnlineEvent=function(type,payload){
 if(type==='auth'&&v107Mode()!=='realistic'){
  state.online=state.online||{};state.online.auth=payload||{};state.online.cloudStatus='Désactivé dans ce mode · sauvegarde locale active';try{VOXOnline?.setCloudWritesEnabled?.(false)}catch{};try{v07RefreshOnlinePanel()}catch{};v107CloudUi();return;
 }
 const r=v107OnlineEventBase?.(type,payload);
 if(type==='auth'&&payload?.signedIn&&v107Mode()==='realistic')v107ArmCloudTimeout();
 if(type==='cloudLoaded'||type==='cloudSaved'){clearTimeout(v107CloudTimer);v107CloudTimer=0}
 setTimeout(v107CloudUi,0);return r;
};

function v107SnapshotLastGood(){
 try{
  const mode=v107Mode(),key=(typeof V084_SLOT_PREFIX!=='undefined'?V084_SLOT_PREFIX:'voxCardSimV08_slot_')+mode,raw=localStorage.getItem(key)||localStorage.getItem('voxCardSimV06');if(!raw)return false;
  const d=JSON.parse(raw);if(!d||!Array.isArray(d.instances)||d.gameMode!==mode)return false;
  localStorage.setItem(V107_LASTGOOD_PREFIX+mode,raw);return true;
 }catch{return false}
}
let v107SnapshotTimer=0;const v107SaveBase=save;
save=function(){const r=v107SaveBase();clearTimeout(v107SnapshotTimer);v107SnapshotTimer=setTimeout(v107SnapshotLastGood,1400);return r};
document.addEventListener('visibilitychange',()=>{if(document.hidden){try{save()}catch{};v107SnapshotLastGood()}},{passive:true});
window.addEventListener('pagehide',()=>{try{save()}catch{};v107SnapshotLastGood()},{passive:true});

/* ---------- PERFORMANCE / BATTERY ---------- */
const v107ProcessMarketBase=processMarket;
processMarket=function(initial=false){if(!initial&&document.hidden&&(typeof v088BatteryOn==='function'&&v088BatteryOn()))return;return v107ProcessMarketBase(initial)};
const v107RenderProductsBase=renderProducts;
renderProducts=function(){const r=v107RenderProductsBase();const imgs=[...document.querySelectorAll('#productGrid img')];imgs.forEach((im,i)=>{im.loading=i<2?'eager':'lazy';im.decoding='async';try{im.fetchPriority=i<2?'auto':'low'}catch{}});return r};

const v107RenderSettingsBase=renderSettings;
renderSettings=function(){const r=v107RenderSettingsBase();v107RebuildOfflinePanel();v107CloudUi();return r};

const v107Style=document.createElement('style');v107Style.textContent=`
[data-set-switch]{display:block!important;overflow:visible!important}.v107-year-row,.v107-set-row{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:2px 0 8px}.v107-year-row::-webkit-scrollbar,.v107-set-row::-webkit-scrollbar{display:none}.v107-year-row button,.v107-set-row button{flex:0 0 auto;border:1px solid #2b394d;background:#111a27;color:#98a5b8;border-radius:999px;padding:10px 16px;font-weight:800;white-space:nowrap}.v107-year-row button.active,.v107-set-row button.active{background:linear-gradient(180deg,#ffd468,#efb42b);color:#151515;border-color:#efb42b}.v107-year-row{padding-bottom:7px}.v107-year-row button{padding:7px 13px;font-size:12px}.v107-offline-year{display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding:9px 0 5px;border-bottom:1px solid #273446;color:#f3c653}.v107-offline-year span{font-size:11px;color:#8f9caf;font-weight:600}html.v088-battery .v107-year-row,html.v088-battery .v107-set-row{scroll-behavior:auto!important}html.v088-battery *{text-shadow:none!important}
`;
document.head.appendChild(v107Style);

/* Re-apply the product artwork now that every catalog set definitely exists. */
try{if(typeof v106ApplyProductArt==='function')v106ApplyProductArt()}catch(e){console.warn('V1.0.7 product art repair',e)}
try{renderSetSwitches()}catch{}
if(!$('#settingsModal')?.classList.contains('hidden'))renderSettings();
v107SnapshotLastGood();
window.__voxV107Ready=true;
