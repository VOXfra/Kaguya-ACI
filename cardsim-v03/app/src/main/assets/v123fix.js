'use strict';
/* VOX Card Sim V1.2.3 — parité stricte online / offline.
   Le moteur, l'UI, les produits, les sauvegardes et les collations doivent venir de
   l'APK. Internet n'est qu'un enrichissement : cloud, marketplace, mises à jour et
   scans distants non encore téléchargés. Une connexion faible ne doit plus faire
   démarrer le jeu sur une ancienne couche historique. */
const V123_VERSION='1.2.3-offline-parity';
let V123_FETCH_SET_BASE=typeof fetchSetData==='function'?fetchSetData:null;
let V123_CARD_DETAIL_BASE=typeof getCardDetail==='function'?getCardDetail:null;

function v123Entry(setId){try{return typeof v111Entry==='function'?v111Entry(setId):null}catch{return null}}
function v123Hydrated(setId){try{return typeof v112CatalogReady==='function'?v112CatalogReady(setId):!!state.metaReady?.[setId]}catch{return false}}
async function v123Hydrate(setId){
 if(!setId||!SETS?.[setId])return false;
 if(v123Hydrated(setId))return true;
 try{
  if(v123Entry(setId)&&typeof v111HydrateSet==='function')return await v111HydrateSet(setId);
  if(V123_FETCH_SET_BASE)return await V123_FETCH_SET_BASE(setId),!!state.metaReady?.[setId];
 }catch(e){console.warn('V1.2.3 hydrate',setId,e)}
 return false;
}

/* Toute ancienne couche qui redemande une collection passe désormais par le JSON
   empaqueté. Cela supprime les vieux fetch API au démarrage Android. */
if(typeof fetchSetData==='function'){
 fetchSetData=async function(setId){
  if(v123Entry(setId))return v123Hydrate(setId);
  if(V123_FETCH_SET_BASE)return V123_FETCH_SET_BASE(setId);
  return false;
 };
}

/* Les JSON de cartes embarquent déjà leur snapshot Cardmarket. L'estimation peut
   donc fonctionner hors ligne avec la dernière valeur livrée dans l'APK, sans
   attendre TCGdex. En ligne, la requête distante ne sert que si aucun snapshot
   local ni cache récent n'existe. */
if(typeof getCardDetail==='function'){
 getCardDetail=async function(c){
  if(!c)throw new Error('card-missing');
  const cached=state.priceCache?.[c.id];
  if(cached&&cached.data&&Date.now()-Number(cached.fetchedAt||0)<12*3600e3)return cached.data;
  if(c.pricing?.cardmarket||c.pricing?.tcgplayer)return c;
  if(!navigator.onLine)throw new Error('offline-no-local-price');
  if(V123_CARD_DETAIL_BASE)return V123_CARD_DETAIL_BASE(c);
  throw new Error('card-detail-unavailable');
 };
}

function v123ReferencedSetIds(){
 const ids=new Set();
 if(state.activeSet)ids.add(state.activeSet);
 if(state.currentOpening?.setId)ids.add(state.currentOpening.setId);
 for(const ins of state.instances||[])if(ins?.setId)ids.add(ins.setId);
 for(const l of state.listings||[])if(l?.setId)ids.add(l.setId);
 return [...ids].filter(id=>SETS?.[id]);
}
function v123RenderCurrent(){
 try{renderSetSwitches?.()}catch(e){console.warn('V1.2.3 selectors',e)}
 try{renderHome?.()}catch(e){console.warn('V1.2.3 home',e)}
 try{renderProducts?.()}catch(e){console.warn('V1.2.3 shop',e)}
 try{renderBinder?.()}catch(e){console.warn('V1.2.3 binder',e)}
 try{renderInventory?.()}catch(e){console.warn('V1.2.3 inventory',e)}
 try{renderSettings?.()}catch(e){console.warn('V1.2.3 settings',e)}
 try{updateStats?.()}catch(e){console.warn('V1.2.3 stats',e)}
}

async function v123BootLocalFirst(){
 if(window.__voxV123BootPromise)return window.__voxV123BootPromise;
 window.__voxV123BootPromise=(async()=>{
  window.__voxV123BootStartedAt=Date.now();
  if(!SETS?.[state.activeSet]){
   try{state.activeSet=typeof v121DefaultSet==='function'?v121DefaultSet():Object.keys(SETS||{})[0]}catch{}
  }
  const ids=v123ReferencedSetIds();
  /* Lecture AssetManager locale : aucune connexion requise. Les sets déjà possédés
     sont hydratés pour que l'inventaire et le classeur aient exactement les mêmes
     noms/raretés en avion qu'en Wi-Fi. */
  await Promise.all(ids.map(id=>v123Hydrate(id)));
  for(const id of ids){try{reconcileBinder?.(id)}catch{}}
  v123RenderCurrent();
  try{if(typeof processMarket==='function')processMarket(true)}catch(e){console.warn('V1.2.3 local market tick',e)}
  if(state.currentOpening){
   try{renderOpening?.()}catch{}
   try{if(typeof preloadPack==='function')preloadPromise=preloadPack(state.currentOpening.cards||[])}catch{}
  }
  try{if(typeof v122Checkpoint==='function')v122Checkpoint('démarrage local');else save?.()}catch{}
  window.__voxV123BootCompletedAt=Date.now();
  window.__voxV123LocalFirstReady=true;
  return true;
 })().catch(e=>{console.error('VOX V1.2.3 local-first boot',e);window.__voxV123LocalFirstReady=false;return false});
 return window.__voxV123BootPromise;
}

/* Si un vieux code rappelle initData(), il obtient désormais le bootstrap local. */
initData=v123BootLocalFirst;

/* Le statut réseau ne change plus de version fonctionnelle : il ne déclenche qu'un
   rafraîchissement visuel. Les fonctions cloud gardent leur propre gestion réseau. */
window.addEventListener('online',()=>{try{v123RenderCurrent()}catch{}},{passive:true});
window.addEventListener('offline',()=>{try{v123RenderCurrent()}catch{}},{passive:true});

window.v123OfflineParityStatus=()=>({
 version:V123_VERSION,
 localFirstReady:!!window.__voxV123LocalFirstReady,
 online:!!navigator.onLine,
 activeSet:state.activeSet,
 activeHydrated:v123Hydrated(state.activeSet),
 referencedSets:v123ReferencedSetIds().length
});

v123BootLocalFirst();
window.__voxV123Ready=true;
