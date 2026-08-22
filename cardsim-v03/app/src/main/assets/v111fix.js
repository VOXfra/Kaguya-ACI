'use strict';

/* VOX Card Sim V1.1.0
   - catalogue français généré automatiquement ;
   - chargement paresseux des anciennes collections pour éviter de gonfler la RAM ;
   - téléchargements Android persistants, bulk/update/auto-update ;
   - indicateur vert quand un pack hors ligne doit être actualisé ;
   - correction du vieux verrou de classeur basé sur la rotation horaire. */
const V111_VERSION='1.1.0';
const V111_INDEX=window.V111_COLLECTION_INDEX||{schema:111,language:'fr',sets:[],stats:{}};
const V111_LANGUAGE=String(V111_INDEX.language||'fr');
const V111_ENTRY_BY_ID=new Map((V111_INDEX.sets||[]).map(x=>[x.id,x]));
const V111_LOAD_PROMISES=new Map();

function v111Year(s){
 try{if(typeof v107SetYear==='function')return v107SetYear(s)}catch{}
 const y=Number(s?.releaseYear)||Number(String(s?.releaseDate||'').slice(0,4));return Number.isFinite(y)?y:null;
}
function v111Image(base,q='high'){
 const u=String(base||'').trim();if(!u)return'';
 if(/\.(?:webp|png|jpe?g)(?:\?|$)/i.test(u))return u;
 return u.replace(/\/$/,'')+`/${q}.webp`;
}
function v111Entry(setId){return V111_ENTRY_BY_ID.get(setId)||null}
function v111Imported(setId){return !!SETS?.[setId]?.v111Imported}

/* ---------- CATALOGUE COMPLET, MAIS DONNÉES CARTES CHARGÉES À LA DEMANDE ---------- */
function v111RegisterCatalogShells(){
 for(const d of V111_INDEX.sets||[]){
  if(!d?.id)continue;
  if(SETS[d.id]){
   SETS[d.id].v111CatalogHash=d.contentHash||'';SETS[d.id].v111ImportStatus=d.status||'ready';continue;
  }
  SETS[d.id]={
   id:d.id,name:d.name||d.id,longName:d.name||d.id,series:d.seriesName||'POKÉMON TCG',
   total:Number(d.total)||Number(d.cards)||0,official:Number(d.official)||Number(d.total)||0,
   hero:[],foilEnergy:0,demigod:0,rates:{double:0,ur:0,ir:0,sir:0,hr:0,mhr:0},
   releaseDate:d.releaseDate||'',releaseYear:d.year||null,products:[],legacyMarketplaceOnly:v111Year(d)<2026,
   v111Imported:true,v111File:d.file,v111CatalogHash:d.contentHash||'',v111ImportStatus:d.status||'partial',
   v111NoPhysicalProducts:true
  };
  EXPECTED_RARITIES[d.id]={total:Number(d.total)||Number(d.cards)||0};
  state.pageBySet??={};state.pageBySet[d.id]=Math.max(0,Number(state.pageBySet[d.id])||0);
  state.metaReady[d.id]=false;
 }
 for(const [k,l] of Object.entries({common:'Commune',uncommon:'Peu commune',rare:'Rare',double:'Double Rare',ir:'Illustration Rare',ur:'Ultra Rare',sir:'Illustration spéciale rare',hr:'Hyper Rare',mhr:'Méga Hyper Rare'}))RARITY_LABEL[k]=RARITY_LABEL[k]||l;
}

async function v111HydrateSet(setId){
 if(state.metaReady?.[setId]&&cardsFor(setId).length)return true;
 const cfg=SETS?.[setId],entry=v111Entry(setId);if(!cfg||!entry?.file)return false;
 if(V111_LOAD_PROMISES.has(setId))return V111_LOAD_PROMISES.get(setId);
 const task=(async()=>{
  try{
   const r=await fetch(`catalog/${encodeURIComponent(V111_LANGUAGE)}/${encodeURIComponent(entry.file)}`);if(!r.ok)throw new Error(`catalog HTTP ${r.status}`);
   const payload=await r.json(),raw=Array.isArray(payload.cards)?payload.cards:[];
   if(raw.length!==Number(cfg.total))throw new Error(`cartes ${raw.length}/${cfg.total}`);
   const cards=raw.map(x=>{
    const base=String(x.image||'').trim(),imgs=[v111Image(base,'low'),v111Image(base,'high')].filter(Boolean);
    return {...x,setId,v111Embedded:true,image:base,imageSmall:imgs[0]||'',imageLarge:imgs[1]||imgs[0]||'',images:imgs};
   }).sort((a,b)=>cardNo(a)-cardNo(b));
   const rarity={},counts={};window.V110_MASTER_VARIANTS=window.V110_MASTER_VARIANTS||{};const master={};
   for(const c of cards){const n=cardNo(c),rk=c.rarityKey||'unknown';rarity[n]=rk;counts[rk]=(counts[rk]||0)+1;master[String(c.localId||'').padStart(3,'0')]=Array.isArray(c.variants)&&c.variants.length?c.variants:['normal']}
   state.sets[setId]={id:setId,name:cfg.name,logo:entry.logo||'',cards};state.meta[setId]={rarity,raw:cards,counts};state.metaReady[setId]=true;
   window.V110_MASTER_VARIANTS[setId]={supported:true,source:`TCGdex ${V111_LANGUAGE} import`,cards:master};
   try{v081RebuildInstanceIndexes?.()}catch{}
   return true;
  }catch(e){console.error('V1.1 catalog hydrate',setId,e);state.metaReady[setId]=false;return false}
  finally{V111_LOAD_PROMISES.delete(setId)}
 })();
 V111_LOAD_PROMISES.set(setId,task);return task;
}

const v111SelectSetBase=selectSet;
selectSet=function(setId){
 if(!v111Imported(setId)||state.metaReady?.[setId])return v111SelectSetBase(setId);
 if(!SETS[setId])return;state.activeSet=setId;save();renderSetSwitches();
 const hero=$('#heroText');if(hero)hero.textContent='Chargement local de la collection…';
 v111HydrateSet(setId).then(ok=>{if(!ok)return toast('Cette collection est présente dans le catalogue mais ses données sont incomplètes');try{renderHome();renderBinder();updateStats();if(!$('#marketModal')?.classList.contains('hidden'))v4RenderBuyHome?.()}catch(e){console.warn(e)}});
};

/* Un shell auto-importé sans produits physiques vérifiés ne doit jamais créer un
   faux booster/ETB/display dans la boutique ou l'offre Archive. */
if(typeof v108RetailIds==='function'){
 const base=v108RetailIds;v108RetailIds=function(){return base().filter(id=>!SETS[id]?.v111NoPhysicalProducts)};
}
if(typeof v108ArchiveIds==='function'){
 const base=v108ArchiveIds;v108ArchiveIds=function(){return base().filter(id=>!SETS[id]?.v111NoPhysicalProducts)};
}

/* Le marketplace charge uniquement la collection choisie. Les milliers de cartes
   historiques ne sont donc pas conservées en RAM juste pour afficher l'accueil. */
const v111RenderMarketBase=v4RenderBuyHome;
v4RenderBuyHome=function(){
 const r=v111RenderMarketBase();const sel=$('#v08MarketSet');if(!sel)return r;
 sel.onchange=async e=>{const id=e.target.value;state.marketSetFilter=id;state.marketPage=1;if(id!=='all'&&v111Imported(id)&&!state.metaReady[id]){e.target.disabled=true;await v111HydrateSet(id)}save();v4RenderBuyHome()};
 return r;
};

/* ---------- CLASSEURS 2026 : PLUS AUCUN VERROU DE ROTATION ---------- */
const v111BuyBinderBase=v090BuyBinder;
v090BuyBinder=function(setId){
 const cfg=SETS?.[setId],p=v090BinderProduct?.(setId);if(!cfg||!p)return v111BuyBinderBase(setId);
 if(v111Year(cfg)!==2026)return v111BuyBinderBase(setId);
 if(typeof v090SetUnlocked==='function'&&!v090SetUnlocked(setId))return;
 const mode=v08Mode();
 // Ancienne V0.9 : "setId !== v08ActiveShopSet()". Cette notion n'existe plus :
 // toutes les collections 2026 validées sont accessibles dans la boutique.
 if(mode!=='creative'&&typeof v088HourlyRemaining==='function'&&v088HourlyRemaining(p)<=0)return toast('Rupture de stock · réassort au prochain créneau');
 if(mode!=='creative'&&state.wallet<p.price)return toast('Solde insuffisant');
 if(mode!=='creative')state.wallet-=p.price;
 v06AddLot(sealedSku(p.id),1,mode==='creative'?0:p.price,mode==='creative'?'creative':'boutique-classeur-2026');
 if(mode!=='creative'&&typeof v088LimitedRetail==='function'&&v088LimitedRetail(p)){
  const key=v088StockKey(p);state.storeHourlyPurchases[key]=v088HourlyBought(p)+1;v088PruneStockLedger();
 }
 v090SyncBinderOwned(setId);reconcileBinder(setId);save();renderBinder();renderProducts();renderInventory();updateStats();toast(`${p.name} ajouté · ${v090BinderCount(setId)} classeur(s)`);
};

/* ---------- HORS LIGNE PERSISTANT / BULK / MISES À JOUR ---------- */
function v111NativeStatus(id){
 try{if(window.VOXOffline)return JSON.parse(VOXOffline.packStatus(id)||'{}')}catch{}
 try{if(window.VOXNative)return JSON.parse(VOXNative.packStatus(id)||'{}')}catch{}
 return state.offlinePackMeta?.[id]||{};
}
function v111BulkStatus(){try{return window.VOXOffline?JSON.parse(VOXOffline.bulkStatus()||'{}'):{} }catch{return{}}}
function v111NeedsUpdate(id,status=v111NativeStatus(id)){
 const hash=String(v111Entry(id)?.contentHash||SETS[id]?.v111CatalogHash||'');
 if(!status?.installed||!hash)return false;
 return !status.catalogHash||status.catalogHash!==hash;
}
function v111SetStatusText(id,row){
 const s=v111NativeStatus(id),status=row.querySelector('.offline-status'),btn=row.querySelector('button'),entry=v111Entry(id),update=v111NeedsUpdate(id,s),stateName=String(s.state||'');
 row.classList.toggle('v111-update-available',update);
 let badge=row.querySelector('.v111-update-badge');if(update&&!badge){badge=document.createElement('span');badge.className='v111-update-badge';badge.textContent='● MISE À JOUR DISPONIBLE';row.querySelector('div')?.appendChild(badge)}else if(!update&&badge)badge.remove();
 if(stateName==='queued'||stateName==='running'){
  const done=Number(s.done)||0,total=Number(s.total)||0;status.textContent=stateName==='queued'?'En attente…':`Téléchargement · ${done}/${total||'…'}${s.failed?` · ${s.failed} erreur(s)`:''}`;btn.disabled=true;btn.textContent='En cours';return;
 }
 btn.disabled=false;
 if(s.installed){status.textContent=`Disponible hors ligne · ${v05FormatBytes(s.bytes)}${s.completedAt?` · ${new Date(s.completedAt).toLocaleDateString('fr-FR')}`:''}`;btn.textContent=update?'Mettre à jour':'Réinstaller'}
 else if(stateName==='error'){status.textContent=`Téléchargement incomplet${s.failed?` · ${s.failed} erreur(s)`:''}`;btn.textContent='Réessayer'}
 else{status.textContent=entry?.status==='partial'?'Catalogue source incomplet · téléchargement bloqué':'Non téléchargée';btn.textContent='Télécharger';btn.disabled=entry?.status==='partial'}
}
async function v111DownloadOne(id,force=false){
 const entry=v111Entry(id);if(entry?.status==='partial')return toast('Cette collection est en quarantaine : source incomplète');
 try{VOXOffline?.requestNotificationPermission?.()}catch{}
 if(window.VOXOffline&&entry){VOXOffline.downloadPack(id,'[]',!!force);v111ScheduleOfflineRefresh(200);return}
 // Compatibilité si le pont V1.1 n'existe pas (build web/debug).
 return v05DownloadOffline(id);
}
function v111Bulk(updateOnly){
 if(!window.VOXOffline)return toast('Le téléchargement en arrière-plan nécessite l’APK Android');
 try{VOXOffline.requestNotificationPermission?.();VOXOffline.downloadAll(V111_LANGUAGE,!!updateOnly);toast(updateOnly?'Mises à jour ajoutées à la file':'Téléchargement complet ajouté à la file');v111ScheduleOfflineRefresh(250)}catch(e){console.error(e);toast('Impossible de démarrer la file de téléchargement')}
}
function v111AutoEnabled(){try{return!!VOXOffline?.autoUpdateEnabled?.()}catch{return false}}
function v111SetAuto(enabled){try{VOXOffline?.setAutoUpdate?.(!!enabled);if(enabled)toast('Mise à jour automatique activée')}catch{toast('Option indisponible sur ce build')}}

let v111OfflineTimer=0;
function v111ScheduleOfflineRefresh(delay=1200){clearTimeout(v111OfflineTimer);v111OfflineTimer=setTimeout(()=>{if(!$('#settingsModal')?.classList.contains('hidden')){v111RebuildOfflinePanel(false);const b=v111BulkStatus();if(b.running)v111ScheduleOfflineRefresh(1300)}},delay)}
function v111RebuildOfflinePanel(force=true){
 const card=$('#settingsModal .modal-card');if(!card)return;let sec=card.querySelector('.offline-settings');if(!sec){sec=document.createElement('div');sec.className='offline-settings';card.appendChild(sec)}
 const sets=(V111_INDEX.sets?.length?V111_INDEX.sets:Object.values(SETS).map(s=>({id:s.id,name:s.name,year:v111Year(s),status:'ready'}))).slice().sort((a,b)=>(b.year||0)-(a.year||0)||String(b.releaseDate||'').localeCompare(String(a.releaseDate||''))||String(a.name).localeCompare(String(b.name),'fr'));
 const sig=sets.map(s=>`${s.id}:${s.contentHash||''}:${s.status||''}`).join('|');
 if(force||sec.dataset.v111Sig!==sig){
  const groups=new Map();for(const s of sets){const y=s.year||'Autres';if(!groups.has(y))groups.set(y,[]);groups.get(y).push(s)}
  sec.innerHTML=`<div class="settings-divider"></div><span class="tag">HORS LIGNE</span><h3>Collections disponibles sans réseau</h3><p>Les transferts Android continuent écran éteint. Les scans déjà présents sont réutilisés et seules les collections réellement modifiées sont signalées.</p><div class="v111-bulk panel"><div><button id="v111DownloadAll" class="secondary">Tout télécharger</button><button id="v111UpdateAll" class="secondary">Tout mettre à jour</button></div><label class="v111-auto"><span><strong>Mise à jour automatique</strong><small>Contrôle quotidien des collections déjà téléchargées</small></span><span class="switch"><input id="v111AutoUpdate" type="checkbox"><i></i></span></label><small id="v111BulkState"></small></div>${[...groups].map(([y,a])=>`<div class="v107-offline-year"><strong>${y}</strong><span>${a.length} collection${a.length>1?'s':''}</span></div>${a.map(s=>`<div class="offline-row" data-offline-set="${escapeHtml(s.id)}"><div><strong>${escapeHtml(s.name||s.id)}</strong><small class="offline-status">Vérification…</small></div><button class="secondary small">Télécharger</button></div>`).join('')}`).join('')}`;
  sec.dataset.v111Sig=sig;
  $('#v111DownloadAll').onclick=()=>v111Bulk(false);$('#v111UpdateAll').onclick=()=>v111Bulk(true);const auto=$('#v111AutoUpdate');auto.checked=v111AutoEnabled();auto.onchange=e=>v111SetAuto(e.target.checked);
  sec.querySelectorAll('[data-offline-set] button').forEach(b=>b.onclick=()=>{const id=b.closest('[data-offline-set]').dataset.offlineSet;v111DownloadOne(id,v111NeedsUpdate(id)||v111NativeStatus(id).installed)});
 }
 for(const row of sec.querySelectorAll('[data-offline-set]'))v111SetStatusText(row.dataset.offlineSet,row);
 const bulk=v111BulkStatus(),txt=$('#v111BulkState');if(txt)txt.textContent=bulk.running?`${bulk.updateOnly?'Mise à jour':'Téléchargement'} global · ${bulk.done||0}/${bulk.total||'…'}${bulk.failed?` · ${bulk.failed} erreur(s)`:''}`:(bulk.finishedAt?`Dernière file terminée · ${bulk.failed||0} erreur(s)`: 'Aucun transfert global en cours');
 v111DecorateCollectionUpdates();if(bulk.running)v111ScheduleOfflineRefresh(1300);
}

/* Le petit voyant vert apparaît aussi sur les boutons de collection déjà rendus. */
function v111DecorateCollectionUpdates(){
 document.querySelectorAll('[data-set]').forEach(b=>{const id=b.dataset.set,need=v111NeedsUpdate(id);b.classList.toggle('v111-set-update',need);let dot=b.querySelector('.v111-set-update-dot');if(need&&!dot){dot=document.createElement('i');dot.className='v111-set-update-dot';dot.title='Mise à jour disponible';b.appendChild(dot)}else if(!need&&dot)dot.remove()});
}
const v111RenderSwitchesBase=renderSetSwitches;
renderSetSwitches=function(){const r=v111RenderSwitchesBase();v111DecorateCollectionUpdates();return r};

const v111RenderSettingsBase=renderSettings;
renderSettings=function(){const r=v111RenderSettingsBase();v111RebuildOfflinePanel(false);return r};

/* ---------- PETITES OPTIMISATIONS UI ---------- */
function v111TuneImages(root=document){for(const im of root.querySelectorAll('img')){if(!im.closest('#cardStack')&&!im.closest('#modalVisual'))im.loading='lazy';im.decoding='async'}}
const v111RenderInventoryBase=renderInventory;renderInventory=function(){const r=v111RenderInventoryBase();v111TuneImages($('#inventoryContent')||document);return r};
const v111RenderProductsBase=renderProducts;renderProducts=function(){const r=v111RenderProductsBase();v111TuneImages($('#productGrid')||document);return r};
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('#settingsModal')?.classList.contains('hidden'))v111ScheduleOfflineRefresh(100)},{passive:true});

const v111Style=document.createElement('style');v111Style.textContent=`
.v111-update-badge{display:block;margin-top:4px;color:#62d88d;font-size:9px!important;font-weight:900;letter-spacing:.55px}.v111-update-available{box-shadow:inset 3px 0 0 #43c97b}.v111-bulk{padding:12px;margin:12px 0}.v111-bulk>div{display:grid;grid-template-columns:1fr 1fr;gap:8px}.v111-bulk button{min-width:0}.v111-auto{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding-top:11px;border-top:1px solid #293548}.v111-auto>span:first-child{display:flex;flex-direction:column;gap:3px}.v111-auto small,#v111BulkState{color:#8f9caf;font-size:10px;line-height:1.35}.v111-auto .switch i{display:block}.v111-set-update{position:relative}.v111-set-update-dot{display:block;position:absolute;right:5px;top:5px;width:7px;height:7px;border-radius:50%;background:#4de08c;box-shadow:0 0 0 2px #0d141d,0 0 8px #4de08c88}.offline-row button:disabled{opacity:.55}
`;
document.head.appendChild(v111Style);

v111RegisterCatalogShells();
try{renderSetSwitches();if(!$('#settingsModal')?.classList.contains('hidden'))v111RebuildOfflinePanel(true);if($('#shop')?.classList.contains('active'))renderProducts()}catch(e){console.warn('V1.1 initial refresh',e)}
window.__voxV111Ready=true;
