'use strict';

/* VOX Card Sim V1.1.0 — seconde passe performance.
   Le catalogue complet peut représenter des milliers de cartes : les archives ne
   doivent pas toutes rester en mémoire après leur simple découverte au démarrage. */
const V111_MAX_BOOKS=650,V111_MAX_PRICE_CACHE=550,V111_MAX_HISTORY=40,V111_MAX_SALES=1800,V111_MAX_PURCHASES=1400;
let v111CleanupTimer=0;

function v111MarkImportableSets(){
 for(const d of V111_INDEX.sets||[]){const s=SETS?.[d.id];if(!s)continue;s.v111Imported=true;s.v111File=d.file||s.v111File;s.v111CatalogHash=d.contentHash||s.v111CatalogHash||'';s.v111ImportStatus=d.status||s.v111ImportStatus||'ready'}
}
function v111ProtectedSets(){
 const keep=new Set([state.activeSet,state.currentOpening?.setId,state.marketSetFilter!=='all'?state.marketSetFilter:null].filter(Boolean));
 for(const x of state.instances||[])if(x?.setId&&x.status!=='sold')keep.add(x.setId);
 for(const x of state.gradingQueue||[])if(x?.setId)keep.add(x.setId);
 for(const x of state.gradingHistory||[])if(x?.setId)keep.add(x.setId);
 return keep;
}
function v111UnloadColdSets(){
 const keep=v111ProtectedSets();let released=0;
 for(const d of V111_INDEX.sets||[]){
  const id=d.id,cfg=SETS?.[id];if(!cfg||keep.has(id)||v111Year(cfg)>=2026)continue;
  const cards=state.sets?.[id]?.cards;if(!Array.isArray(cards)||!cards.length)continue;
  state.sets[id]={id,name:cfg.name,logo:d.logo||state.sets[id]?.logo||'',cards:[]};state.meta[id]={rarity:{},raw:[],counts:{}};state.metaReady[id]=false;released+=cards.length;
 }
 if(released)try{v081RebuildInstanceIndexes?.()}catch{}
 return released;
}
function v111TrimObjectByDate(obj,max,dateFn){
 if(!obj||typeof obj!=='object')return;const keys=Object.keys(obj);if(keys.length<=max)return;keys.sort((a,b)=>(dateFn(obj[b])||0)-(dateFn(obj[a])||0));for(const k of keys.slice(max))delete obj[k];
}
function v111PruneState(){
 try{
  v111TrimObjectByDate(state.marketBooks,V111_MAX_BOOKS,x=>Number(x?.lastTouched||x?.createdAt||0));
  v111TrimObjectByDate(state.priceCache,V111_MAX_PRICE_CACHE,x=>Number(x?.fetchedAt||0));
  for(const [k,a] of Object.entries(state.priceHistory||{}))if(Array.isArray(a)&&a.length>V111_MAX_HISTORY)state.priceHistory[k]=a.slice(-V111_MAX_HISTORY);
  if(Array.isArray(state.sales)&&state.sales.length>V111_MAX_SALES)state.sales.splice(0,state.sales.length-V111_MAX_SALES);
  if(Array.isArray(state.purchases)&&state.purchases.length>V111_MAX_PURCHASES)state.purchases.splice(0,state.purchases.length-V111_MAX_PURCHASES);
  if(typeof imageCache!=='undefined'&&imageCache instanceof Map&&imageCache.size>260){const keys=[...imageCache.keys()];for(const k of keys.slice(0,keys.length-180))imageCache.delete(k)}
 }catch(e){console.warn('V1.1 cache prune',e)}
}
function v111RunCleanup(){v111CleanupTimer=0;v111MarkImportableSets();v111PruneState();v111UnloadColdSets()}
function v111ScheduleCleanup(delay=1200){clearTimeout(v111CleanupTimer);v111CleanupTimer=setTimeout(()=>{if('requestIdleCallback'in window)requestIdleCallback(v111RunCleanup,{timeout:1800});else v111RunCleanup()},delay)}

/* Les vues longues coûtent surtout en layout/paint. content-visibility permet à la
   WebView de ne pas peindre les cartes hors écran sans modifier leur DOM. */
const v111PerfStyle=document.createElement('style');v111PerfStyle.textContent=`
.inventory-card,.sealed-row,.listing-row,.market-result,.offer-row,.product,.v110-grading-row{content-visibility:auto;contain-intrinsic-size:92px}.product{contain-intrinsic-size:340px}.summary-cards img{content-visibility:auto}.v107-set-row,.v107-year-row{overscroll-behavior-x:contain}
html.v111-low-motion .holo-spectrum,html.v111-low-motion .holo-glare{animation:none!important}
`;
document.head.appendChild(v111PerfStyle);

/* Après une navigation, on laisse l'animation/interaction finir puis on libère ce
   qui n'est plus nécessaire. Aucun cleanup n'est effectué pendant un booster. */
const v111NavPerfBase=nav;
nav=function(id){const r=v111NavPerfBase(id);if(id!=='opening')v111ScheduleCleanup(1800);return r};
document.addEventListener('visibilitychange',()=>{if(document.hidden){document.documentElement.classList.add('v111-low-motion');v111RunCleanup()}else document.documentElement.classList.remove('v111-low-motion')},{passive:true});
window.addEventListener('pagehide',v111RunCleanup,{passive:true});
setInterval(()=>{if(!state.currentOpening&&document.visibilityState==='visible')v111ScheduleCleanup(400)},5*60*1000);

v111MarkImportableSets();v111ScheduleCleanup(2600);
window.__voxV111PerfReady=true;
