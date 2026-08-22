'use strict';
/* VOX Card Sim V1.1.7 — intégrité catalogue / rangement / ouverture.

   Cette couche ne fabrique aucune carte ni aucun produit Pokémon :
   - un portfolio physique vérifié devient réellement utilisable comme classeur ;
   - lorsqu'aucun portfolio de l'extension n'est documenté, le simulateur propose
     un classeur générique de rangement clairement identifié comme tel ;
   - une extension n'a qu'UN article Booster, ses wrappers sont tirés au hasard ;
   - les archives sont hydratées depuis le JSON APK avant ouverture/classeur ;
   - les holos WOTC sont distinguées grâce à leurs variantes holo/normal ;
   - les slots Énergie modernes utilisent l'artwork de leur époque, embarqué localement ;
   - un produit scellé sans contenu documenté n'affiche plus un faux « 0 booster ».
*/
const V117_VERSION='1.1.7';

/* ---------- PRODUITS / CLASSEURS ---------- */
function v117CatalogRows(setId){return window.V115_SEALED_CATALOG?.sets?.[setId]||[]}
function v117PhysicalBinderSource(setId){
 return v117CatalogRows(setId).find(p=>p?.contentKind==='binder')||null;
}
const V117_BINDER_CACHE=new Map();
function v117BinderProduct(setId){
 const sid=String(setId||'');if(!sid||!SETS?.[sid])return null;
 const source=v117PhysicalBinderSource(sid),key=`${sid}|${source?.id||'generic'}`;
 const cached=V117_BINDER_CACHE.get(key);if(cached)return cached;
 const cfg=SETS[sid],p={
  id:`v117-storage-binder-${sid}`,setId:sid,
  name:source?.name||`Classeur générique 9 poches — ${cfg.name||sid}`,
  subtitle:source?'Classeur physique vérifié · utilisé comme rangement':'Rangement du simulateur · 360 emplacements',
  kind:source?'CLASSEUR':'CLASSEUR GÉNÉRIQUE',mode:'binderUnlock',qty:1,
  price:Number(source?.price)||19.99,image:String(source?.image||''),binderCapacity:360,binderPages:40,
  v117StorageBinder:true,v117GenericBinder:!source,v117PhysicalSourceId:source?.id||'',
  verifiedContents:true,openable:false,contentKind:'storage'
 };
 V117_BINDER_CACHE.set(key,p);return p;
}
function v117BinderSpec(setId){const p=v117BinderProduct(setId);return p?{name:p.name,subtitle:p.subtitle,image:p.image||'',capacity:360,pages:40,v117Generic:!!p.v117GenericBinder}:null}

const v117ProductByIdBase=productById;
productById=function(id){
 const s=String(id||'');if(s.startsWith('v117-storage-binder-'))return v117BinderProduct(s.slice('v117-storage-binder-'.length));
 return v117ProductByIdBase(id);
};

/* Le rangement interne est toujours lié au set actif. Un portfolio d'une autre
   extension ne peut donc plus se retrouver visuellement dans le Set de Base. */
v090BinderProduct=function(setId){return v117BinderProduct(setId)};
v090BinderSpec=function(setId){return v117BinderSpec(setId)};

if(typeof v115CreativeItems==='function'){
 const v117CreativeItemsBase=v115CreativeItems;
 v115CreativeItems=function(cfg){
  if(!cfg)return[];
  const sourceBinder=v117PhysicalBinderSource(cfg.id);
  const rest=(v117CreativeItemsBase(cfg)||[]).filter(p=>p&&p.mode!=='binderUnlock'&&!p.v117StorageBinder);
  /* Si un vrai portfolio existe, il reste l'article du shop. Sinon seulement,
     on ajoute le classeur générique du simulateur. */
  return(sourceBinder?rest:[v117BinderProduct(cfg.id),...rest]).filter(Boolean);
 };
}
v113Items=function(cfg){return typeof v115CreativeItems==='function'?v115CreativeItems(cfg):(cfg?.products||[])};

function v117ActivateBinder(setId,label,unitCost=0,source='binder-v117'){
 const sid=String(setId||''),p=v117BinderProduct(sid);if(!p)return false;
 v06AddLot(sealedSku(p.id),1,Number.isFinite(unitCost)?unitCost:null,source);
 state.binderOwned??={};state.binderOwned[sid]=true;try{reconcileBinder(sid)}catch{}
 save();try{renderProducts();renderInventory();if(state.activeSet===sid)renderBinder();updateStats()}catch{}
 toast(`${label||p.name} ajouté au rangement`);return true;
}

const v117BuyProductBase=buyProduct;
buyProduct=function(setId,productId){
 const p=productById(productId),sid=p?.setId||setId,mode=v08Mode();
 if(p?.v117StorageBinder){
  const cost=mode==='creative'?0:Number(p.price||19.99);if(mode!=='creative'&&state.wallet<cost)return toast('Solde insuffisant');
  if(mode!=='creative')state.wallet-=cost;return v117ActivateBinder(sid,p.name,cost,mode==='creative'?'creative-binder':'generic-binder');
 }
 /* Un vrai portfolio acheté en Créatif sert immédiatement de classeur au lieu
    d'être stocké comme un objet scellé avec un absurde bouton « Ouvrir ». */
 if(mode==='creative'&&p?.v115Verified&&p.contentKind==='binder')return v117ActivateBinder(sid,p.name,0,'creative-physical-binder');
 return v117BuyProductBase(setId,productId);
};

/* Le bouton du classeur doit fonctionner même pour une archive qui n'est pas la
   rotation boutique du moment. */
v090BuyBinder=function(setId){
 const p=v117BinderProduct(setId);if(!p)return;return buyProduct(setId,p.id);
};

function v117MigrateBinders(){
 const key=`voxCardSimV117_binders2_${typeof v08Mode==='function'?v08Mode():'slot'}`;if(localStorage.getItem(key)==='1')return;
 for(const sid of Object.keys(SETS||{})){
  if(!state.binderOwned?.[sid])continue;
  const p=v117BinderProduct(sid),sku=p&&sealedSku(p.id);if(sku&&stockQty(sku)<=0)v06AddLot(sku,1,null,'migration-v117');
 }
 localStorage.setItem(key,'1');
}

/* ---------- UN BOOSTER PAR EXTENSION / WRAPPER ALÉATOIRE ---------- */
function v117BoosterProduct(setId){return v117CatalogRows(setId).find(p=>p?.v117CanonicalBooster)||v117CatalogRows(setId).find(p=>p?.mode==='loose')||null}
function v117BoosterArtworks(setId){
 const out=[],canonical=v117BoosterProduct(setId);
 for(const u of canonical?.artworks||[])if(u&&!out.includes(u))out.push(u);
 if(canonical?.image&&!out.includes(canonical.image))out.push(canonical.image);
 /* Garde-fou pour un catalogue pré-finalisé : plusieurs lignes loose deviennent
    quand même des variantes et jamais plusieurs produits visuels. */
 for(const p of v117CatalogRows(setId))if(p?.mode==='loose'&&p?.image&&!out.includes(p.image))out.push(p.image);
 return out;
}
function v117ChoosePackArt(setId){const a=v117BoosterArtworks(setId);return a.length?pick(a):''}

const v117OpeningPackImageBase=openingPackImage;
openingPackImage=function(setId=state.currentOpening?.setId||state.activeSet){
 const current=state.currentOpening?.v117PackArt||window.__voxV117PendingPackArt||'';if(current)return current;
 const arts=v117BoosterArtworks(setId);return arts[0]||v117OpeningPackImageBase(setId);
};

/* ---------- HYDRATATION ARCHIVES + COLLATION WOTC ---------- */
function v117NeedsHydration(setId){return typeof v112Entry==='function'&&v112Entry(setId)&&typeof v112Unavailable==='function'&&!v112Unavailable(setId)&&typeof v112CatalogReady==='function'&&!v112CatalogReady(setId)}
const V117_HYDRATING=new Set();
async function v117EnsureSet(setId){
 if(!v117NeedsHydration(setId))return true;
 if(V117_HYDRATING.has(setId)){try{return await V111_LOAD_PROMISES.get(setId)}catch{return false}}
 V117_HYDRATING.add(setId);try{return!!(await v111HydrateSet(setId))}finally{V117_HYDRATING.delete(setId)}
}

/* WOTC : TCGdex libelle souvent holo et non-holo « Rare ». Les variantes sont
   suffisamment précises : holo=true sans normal=true est le pool Rare Holo. */
if(typeof v116IsHolo==='function'){
 const v117IsHoloBase=v116IsHolo;
 v116IsHolo=function(c){
  if(v117IsHoloBase(c))return true;
  const r=typeof v116Raw==='function'?v116Raw(c):String(c?.rarityRaw||'').toLowerCase(),v=typeof v116Variants==='function'?v116Variants(c):(c?.variants||[]);
  return r==='rare'&&v.includes('holo')&&!v.includes('normal');
 };
}

const v117StartBoosterBase=startBooster;
startBooster=async function(setId=state.activeSet){
 const sid=String(setId||state.activeSet||'');
 try{
  const ok=await v117EnsureSet(sid);if(!ok){toast(`Les données de ${SETS?.[sid]?.name||sid} ne sont pas encore disponibles`);return;}
  window.__voxV117PendingPackArt=v117ChoosePackArt(sid);
  const before=state.currentOpening?.id||null,result=await v117StartBoosterBase(sid),o=state.currentOpening;
  if(o&&o.id!==before&&o.setId===sid){o.v117PackArt=window.__voxV117PendingPackArt||v117ChoosePackArt(sid)||o.v115PackArt||'';save()}
  return result;
 }catch(e){console.error('V1.1.7 start booster',sid,e);toast(`Ouverture impossible : ${e?.message||e}`)}
 finally{window.__voxV117PendingPackArt=''}
};

if(typeof v113SelectCreativeSet==='function'){
 const v117SelectCreativeSetBase=v113SelectCreativeSet;
 v113SelectCreativeSet=async function(id){const r=v117SelectCreativeSetBase(id);try{await v117EnsureSet(id)}catch{}return r};
}

/* Le classeur déclenche lui aussi le chargement canonique. C'est le chemin qui
   manquait notamment aux archives 1999 lorsque l'utilisateur allait directement
   sur l'onglet Classeur. */
const v117RenderBinderBase=renderBinder;
renderBinder=function(){
 const sid=state.activeSet;
 if(v117NeedsHydration(sid)){
  const g=$('#pocketGrid');if(g)g.innerHTML='<div class="binder-locked"><div>◌</div><strong>Chargement de la collection…</strong></div>';
  v117EnsureSet(sid).then(ok=>{if(ok&&state.activeSet===sid)renderBinder();else if(!ok)toast(`Impossible de charger ${SETS?.[sid]?.name||sid}`)});return;
 }
 const r=v117RenderBinderBase();v117PatchEnergyPockets();return r;
};

/* ---------- PRODUITS SCELLÉS / INVENTAIRE ---------- */
function v117CanOpenProduct(p){return!!p&&p.mode!=='binderUnlock'&&p.openable!==false&&Number(p.opens||0)>0&&p.verifiedContents!==false}
function v117CanUseBinderProduct(p){return!!p&&p.contentKind==='binder'}
function v117SealedSubtitle(p,condition='Neuf'){
 if(!p)return'Produit inconnu';
 if(p.v117StorageBinder)return`Classeur de rangement · état ${condition}`;
 if(p.contentKind==='binder')return`Classeur physique · état ${condition}`;
 if(p.contentKind==='accessory')return`Accessoire de collection · état ${condition}`;
 if(v117CanOpenProduct(p))return`${Number(p.opens)} booster${Number(p.opens)>1?'s':''} · état ${condition}`;
 return`Produit scellé de collection · état ${condition}`;
}

function v117ConsumeOneLot(sku,condition){
 try{v06LotNormalize(sku);if(typeof v111PrioritizeLot==='function')v111PrioritizeLot(sku,condition)}catch{}
 const lots=state.stockLots?.[sku]||[];const lot=lots.find(x=>Number(x?.qty)>0);if(lot)lot.qty=Math.max(0,Number(lot.qty)-1);
 if(state.stockLots?.[sku])state.stockLots[sku]=state.stockLots[sku].filter(x=>Number(x?.qty)>0);
 addStock(sku,-1);
}
function v117UsePhysicalBinder(sku,p,condition){
 if(!p||!v117CanUseBinderProduct(p)||stockQty(sku)<=0)return;
 v117ConsumeOneLot(sku,condition);v117ActivateBinder(p.setId,p.name,0,'physical-binder-opened');
}

const v117OpenSealedBase=openSealedSku;
openSealedSku=function(sku){
 const p=productForSku(sku);if(!p||stockQty(sku)<=0)return;
 if(p.v117StorageBinder)return toast('Ce classeur est déjà utilisé pour le rangement');
 if(v117CanUseBinderProduct(p))return toast('Utilise « Ajouter au classeur » dans l’inventaire');
 if(!v117CanOpenProduct(p))return toast('Ce produit reste scellé : son contenu exact n’est pas modélisé');
 return v117OpenSealedBase(sku);
};

renderSealedInventory=function(out){
 const rows=[];
 for(const[sku,q]of Object.entries(state.stock||{})){
  if(!sku.startsWith('SEALED:')||q<=0)continue;const p=productForSku(sku);if(!p)continue;
  const groups=typeof v111LotGroups==='function'?v111LotGroups(sku):[{condition:'Neuf',qty:q}];for(const g of groups)rows.push({sku,p,...g});
 }
 if(!rows.length){out.innerHTML='<div class="empty-state panel">Aucun produit scellé ou classeur.</div>';return}out.innerHTML='';
 for(const r of rows){
  const p=r.p,canOpen=v117CanOpenProduct(p),canBinder=v117CanUseBinderProduct(p),e=document.createElement('div');e.className='sealed-row panel stock-row';
  const visual=p.image?`<img class="stock-thumb" loading="lazy" decoding="async" src="${p.image}" alt="${escapeHtml(p.name)}">`:'<div class="stock-thumb v117-generic-thumb">▤</div>';
  e.innerHTML=`${visual}<div class="stock-copy"><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(v117SealedSubtitle(p,r.condition))}</span><b>×${r.qty}</b></div><div class="row-actions">${canBinder?'<button class="primary use-binder">Ajouter au classeur</button>':canOpen?'<button class="primary open">Ouvrir 1</button>':''}<button class="secondary sell">Vendre</button></div>`;
  e.querySelector('.use-binder')?.addEventListener('click',()=>v117UsePhysicalBinder(r.sku,p,r.condition));
  e.querySelector('.open')?.addEventListener('click',()=>{if(typeof v111PreferredPackCondition!=='undefined')v111PreferredPackCondition=r.condition;try{v111PrioritizeLot?.(r.sku,r.condition)}catch{}openSealedSku(r.sku)});
  e.querySelector('.sell').onclick=()=>{try{v111PrioritizeLot?.(r.sku,r.condition)}catch{}openSellStock({type:'sealed',sku:r.sku,setId:p.setId,productId:p.id,label:p.name,available:r.qty,unitBase:Number(p.marketTrend||p.price||1)*(typeof v4ConditionMultiplier==='function'?v4ConditionMultiplier(r.condition):1),rarity:Number(p.opens)>=16?'sir':Number(p.opens)>=9?'ur':'rare',v111Condition:r.condition})};
  out.appendChild(e);
 }
};

/* Le stock de boosters utilise l'art canonique et non un vieux logo de SETS. */
renderBoosterInventory=function(out){
 const rows=[];for(const s of Object.values(SETS||{})){const sku=boosterSku(s.id);if(stockQty(sku)<=0)continue;const groups=typeof v111LotGroups==='function'?v111LotGroups(sku):[{condition:'Neuf',qty:stockQty(sku)}];for(const g of groups)rows.push({set:s,sku,...g})}
 if(!rows.length){out.innerHTML='<div class="empty-state panel">Aucun booster libre en stock.</div>';return}out.innerHTML='';
 for(const r of rows){const art=v117BoosterArtworks(r.set.id)[0]||'',e=document.createElement('div');e.className='sealed-row panel stock-row';e.innerHTML=`${art?`<img class="stock-thumb" loading="lazy" decoding="async" src="${art}" alt="Booster">`:'<div class="stock-thumb v117-generic-thumb">▥</div>'}<div class="stock-copy"><strong>Booster ${escapeHtml(r.set.name)}</strong><span>État du booster : <b>${escapeHtml(r.condition)}</b></span><b>×${r.qty}</b></div><div class="row-actions"><button class="primary open">Ouvrir</button><button class="secondary sell">Vendre</button></div>`;e.querySelector('.open').onclick=()=>{if(typeof v111PreferredPackCondition!=='undefined')v111PreferredPackCondition=r.condition;startBooster(r.set.id)};e.querySelector('.sell').onclick=()=>{try{v111PrioritizeLot?.(r.sku,r.condition)}catch{}openSellStock({type:'booster',sku:r.sku,setId:r.set.id,label:`Booster ${r.set.name}`,available:r.qty,unitBase:5.99*(typeof v4ConditionMultiplier==='function'?v4ConditionMultiplier(r.condition):1),rarity:'rare',v111Condition:r.condition})};out.appendChild(e)}
};

/* ---------- ÉNERGIES DE LA BONNE ÉPOQUE ---------- */
function v117SetYear(setId){
 try{const e=typeof v112Entry==='function'?v112Entry(setId):null,y=Number(e?.year||String(e?.releaseDate||'').slice(0,4));if(Number.isFinite(y)&&y>1990)return y}catch{}
 const cfg=SETS?.[setId],y=Number(cfg?.releaseYear||String(cfg?.releaseDate||'').slice(0,4));return Number.isFinite(y)&&y>1990?y:null;
}
function v117EnergyEra(setId){
 const sid=String(setId||''),p=typeof v116Profile==='function'?v116Profile(sid):null,f=p?.family||'',date=String(p?.releaseDate||SETS?.[sid]?.releaseDate||'');
 if(sid.startsWith('me'))return'me';
 if(f==='sv11')return'sv';
 if(f==='swsh11')return date>='2022-02-25'?'swsh_2022':'swsh_2020';
 if(f==='sm11')return'sm';
 return'';
}
function v117EnergyPath(setId,index){
 const era=v117EnergyEra(setId);if(!era)return'';const ext=(era==='sm'||era==='swsh_2020')?'jpg':'png';return`img/v117/energy/${era}/${index+1}.${ext}`;
}
const v117EnergyCardBase=energyCard;
energyCard=function(setId=state.currentOpening?.setId||state.activeSet){
 const sid=String(setId||''),era=v117EnergyEra(sid);if(!era)return v117EnergyCardBase(sid);
 const i=Math.floor(Math.random()*ENERGY.length),e=ENERGY[i],path=v117EnergyPath(sid,i),foil=Math.random()<Number(SETS?.[sid]?.foilEnergy||0);
 return{id:`v117-energy-${era}-${i+1}`,setId:sid,localId:'E',name:`Énergie de base — ${e.name}`,kind:'energy',energyType:e.name,foil,variant:foil?'cosmos':'normal',image:path,imageLarge:path,imageSmall:path,slot:'Énergie',energyYear:v117SetYear(sid),v117EraEnergy:true};
};

const v117AddEnergyBase=addEnergyInstance;
addEnergyInstance=function(c){
 const before=(state.instances||[]).length,r=v117AddEnergyBase(c),sid=c?.setId||state.currentOpening?.setId||state.activeSet;
 for(let i=before;i<(state.instances||[]).length;i++){
  const ins=state.instances[i];if(!ins?.isEnergy)continue;const ti=ENERGY.findIndex(e=>e.name===ins.energyType),path=ti>=0?v117EnergyPath(sid,ti):'';
  ins.setId=sid;ins.energyYear=v117SetYear(sid);ins.v117EraEnergy=!!path;if(path){ins.imageSmall=path;ins.imageLarge=path}
 }
 return r;
};
function v117RepairEnergyInstances(){
 for(const ins of state.instances||[]){if(!ins?.isEnergy)continue;const sid=ins.setId||state.activeSet,ti=ENERGY.findIndex(e=>e.name===ins.energyType),path=ti>=0?v117EnergyPath(sid,ti):'';ins.setId=sid;ins.energyYear=ins.energyYear||v117SetYear(sid);if(path){ins.imageSmall=path;ins.imageLarge=path;ins.v117EraEnergy=true}}
}
function v117PatchEnergyPockets(){
 const sid=state.activeSet;if(!v117EnergyEra(sid))return;const pockets=[...document.querySelectorAll('#pocketGrid .energy-pocket')];
 pockets.forEach((p,i)=>{const im=p.querySelector('img'),path=v117EnergyPath(sid,i%ENERGY.length);if(im&&path)im.src=path});
}

/* ---------- VISUELS BOOSTER : RATIO CONSERVÉ, JAMAIS DE CROP ---------- */
const v117Style=document.createElement('style');v117Style.textContent=`
.sealed-pack{display:flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;background:#080c12!important}
.sealed-pack>img,#packArt{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important;object-position:center!important;transform:none!important;filter:none!important;image-rendering:auto!important}
.product-photo,.stock-thumb{object-fit:contain!important;object-position:center!important}.v117-generic-thumb{display:grid!important;place-items:center!important;font-size:34px;color:#9eacbf;background:#111924!important}
`;
document.head.appendChild(v117Style);

setTimeout(()=>{
 try{
  v117MigrateBinders();v117RepairEnergyInstances();for(const sid of Object.keys(SETS||{}))if(state.binderOwned?.[sid])reconcileBinder(sid);save();
  renderSetSwitches();if($('#shop')?.classList.contains('active'))renderProducts();if($('#binder')?.classList.contains('active'))renderBinder();if($('#inventory')?.classList.contains('active'))renderInventory();
 }catch(e){console.warn('V1.1.7 refresh',e)}
},180);
window.__voxV117Ready=true;
