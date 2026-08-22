'use strict';
/* VOX Card Sim V1.1.7 — intégrité catalogue / rangement / ouverture.

   Objectifs :
   - un vrai classeur de rangement générique propre à CHAQUE collection, sans
     recycler le portfolio d'une autre extension ;
   - un seul produit Booster par extension dans la boutique, les artworks étant
     des variantes de wrapper choisies aléatoirement au moment de l'ouverture ;
   - charger le JSON canonique d'une extension avant toute ouverture, y compris
     les sets 1999 ;
   - ne proposer « Ouvrir » que lorsque le contenu scellé est réellement connu ;
   - ne jamais afficher une vieille image d'énergie globale comme si elle était
     l'énergie de l'année de l'extension.
*/
const V117_VERSION='1.1.7';

/* ---------- CLASSEUR GÉNÉRIQUE PAR COLLECTION ---------- */
const V117_BINDER_CACHE=new Map();
function v117BinderProduct(setId){
 const sid=String(setId||'');if(!sid||!SETS?.[sid])return null;
 if(!V117_BINDER_CACHE.has(sid)){
  const cfg=SETS[sid];
  V117_BINDER_CACHE.set(sid,{
   id:`v117-generic-binder-${sid}`,setId:sid,
   name:`Classeur générique 9 poches — ${cfg.name||sid}`,
   subtitle:'Rangement du simulateur · 360 emplacements',kind:'CLASSEUR GÉNÉRIQUE',
   mode:'binderUnlock',qty:1,price:19.99,image:'',binderCapacity:360,binderPages:40,
   v117GenericBinder:true,verifiedContents:true,openable:false,contentKind:'storage'
  });
 }
 return V117_BINDER_CACHE.get(sid);
}
function v117BinderSpec(setId){
 const p=v117BinderProduct(setId);if(!p)return null;
 return{name:p.name,subtitle:p.subtitle,image:'',capacity:360,pages:40,v117Generic:true};
}

const v117ProductByIdBase=productById;
productById=function(id){
 const s=String(id||'');if(s.startsWith('v117-generic-binder-'))return v117BinderProduct(s.slice('v117-generic-binder-'.length));
 return v117ProductByIdBase(id);
};

/* Un portfolio officiel reste un produit de collection. Le rangement du jeu
   utilise toujours son propre SKU lié au set ; impossible donc de retrouver un
   portfolio Héros Transcendants dans le Set de Base. */
v090BinderProduct=function(setId){return v117BinderProduct(setId)};
v090BinderSpec=function(setId){return v117BinderSpec(setId)};

if(typeof v115CreativeItems==='function'){
 const v117CreativeItemsBase=v115CreativeItems;
 v115CreativeItems=function(cfg){
  if(!cfg)return[];
  const rest=(v117CreativeItemsBase(cfg)||[]).filter(p=>p&&p.mode!=='binderUnlock'&&!p.v117GenericBinder);
  return[v117BinderProduct(cfg.id),...rest].filter(Boolean);
 };
}
/* v113Items a été réaffecté plusieurs fois dans les couches précédentes. Le
   réancrer ici évite qu'une ancienne closure masque à nouveau le classeur. */
v113Items=function(cfg){return typeof v115CreativeItems==='function'?v115CreativeItems(cfg):(cfg?.products||[])};

const v117BuyProductBase=buyProduct;
buyProduct=function(setId,productId){
 const p=productById(productId),sid=p?.setId||setId;
 if(p?.v117GenericBinder){
  const sku=sealedSku(p.id);v06AddLot(sku,1,v08Mode()==='creative'?0:p.price,v08Mode()==='creative'?'creative-binder':'generic-binder');
  state.binderOwned??={};state.binderOwned[sid]=true;try{reconcileBinder(sid)}catch{}
  save();renderProducts();renderInventory();if(state.activeSet===sid)renderBinder();updateStats();
  return toast(`${p.name} ajouté`);
 }
 return v117BuyProductBase(setId,productId);
};

/* Migration douce : une sauvegarde qui possédait déjà un classeur avant 1.1.7
   conserve son rangement, mais le nouveau SKU ne récupère jamais le stock d'un
   portfolio appartenant à une autre extension. */
function v117MigrateBinders(){
 const key=`voxCardSimV117_binders_${typeof v08Mode==='function'?v08Mode():'slot'}`;if(localStorage.getItem(key)==='1')return;
 for(const sid of Object.keys(SETS||{})){
  if(!state.binderOwned?.[sid])continue;
  const p=v117BinderProduct(sid),sku=p&&sealedSku(p.id);if(sku&&stockQty(sku)<=0)v06AddLot(sku,1,null,'migration-v117');
 }
 localStorage.setItem(key,'1');
}

/* ---------- UN BOOSTER PAR SET, ARTWORK ALÉATOIRE À L'OUVERTURE ---------- */
function v117CatalogRows(setId){return window.V115_SEALED_CATALOG?.sets?.[setId]||[]}
function v117BoosterProduct(setId){
 return v117CatalogRows(setId).find(p=>p?.v117CanonicalBooster)||v117CatalogRows(setId).find(p=>p?.mode==='loose')||null;
}
function v117BoosterArtworks(setId){
 const p=v117BoosterProduct(setId),rows=[];
 for(const x of (p?.artworks||[]))if(x&&!rows.includes(x))rows.push(x);
 if(p?.image&&!rows.includes(p.image))rows.push(p.image);
 return rows;
}
function v117ChoosePackArt(setId){const a=v117BoosterArtworks(setId);return a.length?pick(a):''}

const v117OpeningPackImageBase=openingPackImage;
openingPackImage=function(setId=state.currentOpening?.setId||state.activeSet){
 const current=state.currentOpening?.v117PackArt||window.__voxV117PendingPackArt||'';
 if(current)return current;
 const canonical=v117BoosterArtworks(setId);if(canonical.length)return canonical[0];
 return v117OpeningPackImageBase(setId);
};

/* Les lots 1.1.5 stockaient l'artwork dans le lot au moment de l'achat. V1.1.7
   l'ignore : deux boosters du même lot peuvent maintenant avoir des wrappers
   différents, comme dans une vraie sélection de boosters. */
const v117StartBoosterBase=startBooster;
startBooster=async function(setId=state.activeSet){
 const sid=String(setId||state.activeSet||'');
 try{
  if(typeof v112Entry==='function'&&v112Entry(sid)&&typeof v112CatalogReady==='function'&&!v112CatalogReady(sid)){
   const ok=await v111HydrateSet(sid);if(!ok){toast(`Les données de ${SETS?.[sid]?.name||sid} ne sont pas disponibles`);return;}
  }
  window.__voxV117PendingPackArt=v117ChoosePackArt(sid);
  const result=await v117StartBoosterBase(sid);
  if(state.currentOpening?.setId===sid){
   state.currentOpening.v117PackArt=window.__voxV117PendingPackArt||v117ChoosePackArt(sid)||state.currentOpening.v115PackArt||'';
   /* L'ancien champ est conservé pour les sauvegardes, mais n'est plus la source
      de vérité de l'artwork. */
   save();
  }
  return result;
 }catch(e){console.error('V1.1.7 start booster',sid,e);toast(`Ouverture impossible : ${e?.message||e}`);}
 finally{window.__voxV117PendingPackArt=''}
};

/* Sélectionner une archive en Créatif prépare ses données immédiatement. Le
   chargement reste paresseux : on ne garde pas 20k cartes en RAM d'un coup. */
if(typeof v113SelectCreativeSet==='function'){
 const v117SelectCreativeSetBase=v113SelectCreativeSet;
 v113SelectCreativeSet=async function(id){
  const r=v117SelectCreativeSetBase(id);
  if(typeof v112Entry==='function'&&v112Entry(id)&&typeof v112CatalogReady==='function'&&!v112CatalogReady(id)){
   try{await v111HydrateSet(id)}catch(e){console.warn('V1.1.7 creative hydrate',id,e)}
  }
  return r;
 };
}

/* ---------- PRODUITS SCELLÉS : PLUS DE FAUX BOUTON OUVRIR ---------- */
function v117CanOpenProduct(p){return !!p&&p.mode!=='binderUnlock'&&p.openable!==false&&Number(p.opens||0)>0&&p.verifiedContents!==false}
function v117SealedSubtitle(p){
 if(!p)return'Produit inconnu';
 if(p.v117GenericBinder)return'Classeur de rangement';
 if(p.contentKind==='accessory')return'Accessoire de collection · reste scellé';
 if(v117CanOpenProduct(p))return`Scellé · ${Number(p.opens)} booster${Number(p.opens)>1?'s':''}`;
 return'Produit scellé · contenu interne non documenté';
}

const v117OpenSealedBase=openSealedSku;
openSealedSku=function(sku){
 const p=productForSku(sku);if(!p||stockQty(sku)<=0)return;
 if(p.v117GenericBinder||p.mode==='binderUnlock')return toast('Ce classeur est un objet de rangement');
 if(p.contentKind==='accessory')return toast('Accessoire de collection — rien à ouvrir');
 if(!v117CanOpenProduct(p))return toast('Contenu interne non documenté : le produit reste scellé');
 return v117OpenSealedBase(sku);
};

renderSealedInventory=function(out){
 const rows=Object.entries(state.stock||{}).filter(([sku,q])=>sku.startsWith('SEALED:')&&q>0);
 if(!rows.length){out.innerHTML='<div class="empty-state panel">Aucun produit scellé ou classeur.</div>';return}
 out.innerHTML='';
 for(const[sku,qty]of rows){
  const p=productForSku(sku);if(!p)continue;
  const binder=!!p.v117GenericBinder||p.mode==='binderUnlock',spec=binder?v117BinderSpec(p.setId):null,canOpen=v117CanOpenProduct(p),e=document.createElement('div');
  e.className='sealed-row panel stock-row'+(binder?' v090-binder-item':'');
  const img=p.image?`<img loading="lazy" decoding="async" class="stock-thumb" src="${p.image}" alt="${escapeHtml(p.name)}">`:`<div class="stock-thumb v117-generic-thumb">▤</div>`;
  e.innerHTML=`${img}<div class="stock-copy"><strong>${escapeHtml(p.name)}</strong><span>${binder?`Rangement · ${spec?.capacity||360} emplacements`:v117SealedSubtitle(p)}</span><b>×${qty}</b></div><div class="row-actions">${canOpen?'<button class="primary open">Ouvrir 1</button>':''}<button class="secondary sell">Vendre</button></div>`;
  e.querySelector('.open')?.addEventListener('click',()=>openSealedSku(sku));
  e.querySelector('.sell').onclick=()=>openSellStock({type:'sealed',sku,setId:p.setId,productId:p.id,label:p.name,available:qty,unitBase:Number(p.marketTrend||p.price||1)*1.04,rarity:binder?'rare':(Number(p.opens)>=16?'sir':Number(p.opens)>=9?'ur':'rare')});
  out.appendChild(e);
 }
};

/* ---------- ÉNERGIES : PROVENANCE DU SET, PAS D'ARTWORK D'UNE AUTRE ANNÉE ---------- */
function v117SetYear(setId){
 try{const e=typeof v112Entry==='function'?v112Entry(setId):null,y=Number(e?.year||String(e?.releaseDate||'').slice(0,4));if(Number.isFinite(y)&&y>1990)return y}catch{}
 const cfg=SETS?.[setId],y=Number(cfg?.releaseYear||String(cfg?.releaseDate||'').slice(0,4));return Number.isFinite(y)&&y>1990?y:null;
}
const v117EnergyCardBase=energyCard;
energyCard=function(setId=state.currentOpening?.setId||state.activeSet){
 const sid=String(setId||state.currentOpening?.setId||state.activeSet||''),c=v117EnergyCardBase(sid);
 if(c){c.setId=sid;c.energyYear=v117SetYear(sid);c.image=null;c.imageSmall='';c.imageLarge='';c.v117EraEnergy=true;}
 return c;
};

const v117AddEnergyBase=addEnergyInstance;
addEnergyInstance=function(c){
 const before=(state.instances||[]).length,r=v117AddEnergyBase(c),sid=c?.setId||state.currentOpening?.setId||state.activeSet;
 for(let i=(state.instances||[]).length-1;i>=before;i--){const ins=state.instances[i];if(ins?.isEnergy){ins.setId=ins.setId||sid;ins.energyYear=ins.energyYear||c?.energyYear||v117SetYear(sid);ins.v117EraEnergy=true;}}
 return r;
};

function v117RepairEnergyInstances(){
 for(const ins of state.instances||[]){if(!ins?.isEnergy)continue;ins.setId=ins.setId||state.activeSet;ins.energyYear=ins.energyYear||v117SetYear(ins.setId);}
}
function v117DecorateEnergyPockets(){
 const sid=state.activeSet,year=v117SetYear(sid)||'ÉPOQUE';
 for(const pocket of document.querySelectorAll('#pocketGrid .energy-pocket')){
  pocket.querySelector('img')?.remove();if(pocket.querySelector('.v117-energy-art'))continue;
  const label=pocket.querySelector('.energy-label')?.textContent||'Énergie',art=document.createElement('div');art.className='v117-energy-art';
  art.innerHTML=`<small>ÉNERGIE DE BASE</small><strong>${escapeHtml(label.replace(/^COSMOS · /,''))}</strong><span>${year}</span>`;pocket.insertBefore(art,pocket.firstChild);
 }
}
const v117RenderBinderBase=renderBinder;
renderBinder=function(){const r=v117RenderBinderBase();v117DecorateEnergyPockets();return r};
const v117RenderRevealBase=renderReveal;
renderReveal=function(){const r=v117RenderRevealBase();const y=v117SetYear(state.currentOpening?.setId||state.activeSet);if(y)for(const s of document.querySelectorAll('#cardStack .energy-card small'))s.textContent=`ÉNERGIE DE BASE · ${y}`;return r};

/* ---------- RENDU PACK : AUCUN CROP/ZOOM FORCÉ ---------- */
const v117Style=document.createElement('style');v117Style.textContent=`
.sealed-pack{display:flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;background:transparent!important}
.sealed-pack>img{display:block!important;width:100%!important;height:100%!important;object-fit:contain!important;object-position:center!important;transform:none!important;filter:none!important;image-rendering:auto!important}
.v117-generic-thumb{display:grid!important;place-items:center!important;font-size:34px;color:#9eacbf;background:#111924!important}
.v117-energy-art{width:100%;height:100%;min-height:112px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;text-align:center;background:linear-gradient(145deg,#edf3f7,#cfd8df);color:#25313b;padding:8px}
.v117-energy-art small{font-size:7px;letter-spacing:.8px;font-weight:900}.v117-energy-art strong{font-size:11px}.v117-energy-art span{font-size:9px;font-weight:900;opacity:.62}
`;
document.head.appendChild(v117Style);

/* Répare le slot actif sans force-reset et remet les écrans visibles en cohérence. */
setTimeout(()=>{
 try{
  v117MigrateBinders();v117RepairEnergyInstances();for(const sid of Object.keys(SETS||{}))if(state.binderOwned?.[sid])reconcileBinder(sid);save();
  renderSetSwitches();if($('#shop')?.classList.contains('active'))renderProducts();if($('#binder')?.classList.contains('active'))renderBinder();if($('#inventory')?.classList.contains('active'))renderInventory();
 }catch(e){console.warn('V1.1.7 refresh',e)}
},180);
window.__voxV117Ready=true;
