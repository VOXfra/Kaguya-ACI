'use strict';
/* VOX Card Sim V1.1.2 — chargeur catalogue canonique Android.
   Objectifs :
   - toutes les collections présentes dans V111_COLLECTION_INDEX utilisent le même
     lecteur de JSON empaqueté, même si une ancienne version avait déjà créé SETS[id] ;
   - aucune ancienne valeur `metaReady` ne peut court-circuiter le catalogue 1.1 ;
   - les collections réellement absentes de la source FR restent visibles mais sont
     explicitement signalées au lieu de déclencher un faux message de corruption ;
   - un scan absent affiche un placeholder propre et jamais une URL `undefined` ;
   - l'ancien bouton/menu de réinitialisation forcée est supprimé. */
const V112_VERSION='1.1.2';
const V112_MISSING_SCAN='img/missing-card.svg';
const V112_SELECT_TOKENS=new Map();

function v112Entry(setId){try{return v111Entry(setId)}catch{return null}}
function v112Expected(entry,cfg){
 const n=Number(entry?.total)||Number(entry?.cards)||Number(cfg?.total)||0;
 return Number.isFinite(n)&&n>=0?n:0;
}
function v112CatalogReady(setId){
 const e=v112Entry(setId),s=state.sets?.[setId];
 if(!e||!s?.v112CatalogHydrated||!state.metaReady?.[setId])return false;
 try{return cardsFor(setId).length===v112Expected(e,SETS?.[setId])}catch{return false}
}
function v112Unavailable(setId){const e=v112Entry(setId);return !!e&&Number(e.cards||e.total||0)<=0}
function v112UnavailableMessage(setId){
 const e=v112Entry(setId),name=e?.name||SETS?.[setId]?.name||setId;
 return `${name} est bien répertoriée, mais la source française ne fournit actuellement aucune carte exploitable.`;
}

/* Le bug V1.1.1 principal : v111RegisterCatalogShells() faisait `continue` lorsque
   SETS[d.id] existait déjà. Ces extensions n'avaient donc ni v111Imported ni
   v111File et retombaient dans l'ancien chargeur. On réconcilie TOUS les IDs. */
for(const d of V111_INDEX.sets||[]){
 if(!d?.id||!SETS?.[d.id])continue;
 const cfg=SETS[d.id];
 cfg.v111Imported=true;
 cfg.v111File=d.file||cfg.v111File||'';
 cfg.v111CatalogHash=d.contentHash||cfg.v111CatalogHash||'';
 cfg.v111ImportStatus=d.status||cfg.v111ImportStatus||'partial';
 cfg.v111MetadataStatus=d.metadataStatus||cfg.v111MetadataStatus||'';
 cfg.v111SourceTotal=Number(d.sourceTotal)||Number(d.total)||Number(cfg.total)||0;
 if(d.releaseDate)cfg.releaseDate=d.releaseDate;
 if(Number(d.year))cfg.releaseYear=Number(d.year);
 if(Number(d.total)>0){cfg.total=Number(d.total);cfg.official=Math.min(Number(d.official)||cfg.total,cfg.total)}
}
/* `v111Imported()` n'est plus dérivé d'un flag hérité : l'index lui-même fait foi. */
v111Imported=function(setId){return !!v112Entry(setId)};

function v112ReadCatalog(entry){
 if(!entry?.file)return null;
 /* APK Android : lecture synchrone et déterministe depuis AssetManager. */
 try{
  const raw=window.VOXOffline?.readCatalogFile?.(V111_LANGUAGE,String(entry.file));
  if(raw){const p=JSON.parse(raw);if(Number(p?.schema)===111&&Array.isArray(p.cards))return p}
 }catch(e){console.warn('V1.1.2 native catalog read',entry.id,e)}
 return null;
}
async function v112FetchCatalog(entry){
 let payload=v112ReadCatalog(entry);
 if(payload)return payload;
 /* Fallback uniquement pour navigateur/debug. Sur Android le pont natif ci-dessus
    est la source normale et évite les aléas de fetch(file://). */
 const paths=[
  `catalog/${encodeURIComponent(V111_LANGUAGE)}/${encodeURIComponent(entry.file)}`,
  `file:///android_asset/catalog/${encodeURIComponent(V111_LANGUAGE)}/${encodeURIComponent(entry.file)}`
 ];
 let last=null;
 for(const path of paths){
  try{const r=await fetch(path,{cache:'no-store'});if(r.ok){const p=await r.json();if(Number(p?.schema)===111&&Array.isArray(p.cards))return p}last=new Error(`HTTP ${r.status}`)}catch(e){last=e}
 }
 throw last||new Error('catalogue empaqueté introuvable');
}
function v112ImageFields(x,setId){
 /* Les quinze scans Nuit Noire embarqués restent prioritaires, même lorsqu'on
    recharge maintenant me05 depuis le catalogue canonique. */
 if(setId==='me05'){
  const n=Number.parseInt(String(x?.localId||''),10);
  if(n>=75&&n<=89){
   const local=`img/v109/me05_cards/${String(n).padStart(3,'0')}.webp`;
   return {image:'',imageSmall:local,imageLarge:local,images:[local],v109BundledFrenchScan:true};
  }
 }
 const base=String(x?.image||'').trim();
 const low=base?v111Image(base,'low'):'';
 const high=base?v111Image(base,'high'):'';
 const imageSmall=low||high||V112_MISSING_SCAN,imageLarge=high||low||V112_MISSING_SCAN;
 return {image:base,imageSmall,imageLarge,images:[...new Set([imageSmall,imageLarge])],v112MissingScan:!base};
}

/* Remplace définitivement les deux anciens hydrateurs V1.1/V1.1.1. Une collection
   est considérée chargée seulement si CE chargeur l'a validée, pas parce qu'une
   ancienne couche avait mis metaReady=true. */
v111HydrateSet=async function(setId){
 const cfg=SETS?.[setId],entry=v112Entry(setId);if(!cfg||!entry?.file)return false;
 const expected=v112Expected(entry,cfg);
 if(expected<=0)return false;
 if(v112CatalogReady(setId))return true;
 if(V111_LOAD_PROMISES.has(setId))return V111_LOAD_PROMISES.get(setId);
 const task=(async()=>{
  try{
   const payload=await v112FetchCatalog(entry),raw=Array.isArray(payload.cards)?payload.cards:[];
   if(raw.length!==expected)throw new Error(`cartes empaquetées ${raw.length}/${expected}`);
   const cards=raw.map(x=>({...x,setId,v111Embedded:true,...v112ImageFields(x,setId)})).sort((a,b)=>cardNo(a)-cardNo(b));
   const rarity={},counts={},master={};window.V110_MASTER_VARIANTS=window.V110_MASTER_VARIANTS||{};
   for(const c of cards){
    const n=cardNo(c),rk=c.rarityKey||'unknown';rarity[n]=rk;counts[rk]=(counts[rk]||0)+1;
    master[String(c.localId||'').padStart(3,'0')]=Array.isArray(c.variants)&&c.variants.length?c.variants:['normal'];
   }
   state.sets[setId]={id:setId,name:cfg.name,logo:entry.logo||state.sets?.[setId]?.logo||'',cards,v112CatalogHydrated:true,v112CatalogHash:entry.contentHash||''};
   state.meta[setId]={rarity,raw:cards,counts};state.metaReady[setId]=true;
   window.V110_MASTER_VARIANTS[setId]={supported:true,source:`TCGdex ${V111_LANGUAGE} import V1.1.2`,cards:master};
   cfg.total=expected;cfg.v111Imported=true;cfg.v111File=entry.file;
   try{v081RebuildInstanceIndexes?.()}catch{}
   return true;
  }catch(e){
   console.error('V1.1.2 catalog hydrate',setId,e);state.metaReady[setId]=false;
   if(state.sets?.[setId])state.sets[setId].v112CatalogHydrated=false;
   return false;
  }finally{V111_LOAD_PROMISES.delete(setId)}
 })();
 V111_LOAD_PROMISES.set(setId,task);return task;
};

function v112RenderAfterSelect(setId){
 if(state.activeSet!==setId)return;
 try{renderHome();renderBinder();updateStats();if(!$('#marketModal')?.classList.contains('hidden'))v4RenderBuyHome?.()}catch(e){console.warn('V1.1.2 render set',setId,e)}
}
const v112LegacySelectSet=selectSet;
selectSet=function(setId){
 const entry=v112Entry(setId),cfg=SETS?.[setId];
 if(!entry)return v112LegacySelectSet(setId);
 if(!cfg)return;
 if(v112Unavailable(setId))return toast(v112UnavailableMessage(setId));
 state.activeSet=setId;save();renderSetSwitches();
 if(v112CatalogReady(setId)){v112RenderAfterSelect(setId);return}
 const token=(V112_SELECT_TOKENS.get(setId)||0)+1;V112_SELECT_TOKENS.set(setId,token);
 const hero=$('#heroText');if(hero)hero.textContent=`Chargement local de ${cfg.name}…`;
 v111HydrateSet(setId).then(ok=>{
  if(V112_SELECT_TOKENS.get(setId)!==token)return;
  if(!ok)return toast(`Impossible de lire les données embarquées de ${cfg.name}.`);
  v112RenderAfterSelect(setId);
 });
};

/* Les collections sans aucune carte publiée par TCGdex restent VISIBLES : elles ne
   disparaissent donc pas du catalogue. Un clic explique simplement la situation. */
const v112RenderSetSwitchesBase=renderSetSwitches;
renderSetSwitches=function(){
 const r=v112RenderSetSwitchesBase();
 document.querySelectorAll('[data-set]').forEach(b=>{
  const id=b.dataset.set;if(!v112Unavailable(id))return;
  b.classList.add('v112-source-unavailable');b.setAttribute('aria-disabled','true');b.title='Données françaises non disponibles dans la source';
  b.onclick=e=>{e.preventDefault();toast(v112UnavailableMessage(id))};
 });
 return r;
};

/* Le Marketplace doit lui aussi demander le catalogue canonique, même si une vieille
   couche avait laissé metaReady=true pour cette extension. */
const v112MarketBase=v4RenderBuyHome;
v4RenderBuyHome=function(){
 const r=v112MarketBase();const sel=$('#v08MarketSet');if(!sel)return r;
 sel.onchange=async e=>{
  const id=e.target.value;state.marketSetFilter=id;state.marketPage=1;
  if(id!=='all'&&v112Entry(id)&&!v112Unavailable(id)&&!v112CatalogReady(id)){
   e.target.disabled=true;const ok=await v111HydrateSet(id);e.target.disabled=false;
   if(!ok)toast(`Impossible de charger ${SETS?.[id]?.name||id}`);
  }
  save();v4RenderBuyHome();
 };
 return r;
};

/* Aucun navigateur ne doit afficher une icône d'image cassée pour les milliers de
   scans que la source FR ne possède pas encore. */
const v112CardImgBase=cardImg;
cardImg=function(c,q='high'){
 let u='';try{u=String(v112CardImgBase(c,q)||'')}catch{}
 if(!u||/\bundefined\b|\bnull\b/i.test(u))return c?.imageLarge||c?.imageSmall||V112_MISSING_SCAN;
 return u;
};

/* ---------- SUPPRESSION DU FORCE RESET ---------- */
function v112RemoveResetUI(){
 try{document.querySelector('#resetProgressBtn')?.remove()}catch{}
 /* Si l'ancien dialogue était resté ouvert au moment de la mise à niveau, on le
    ferme seulement lorsqu'il s'agit bien du dialogue RESET, sans toucher aux ventes. */
 try{
  const word=document.querySelector('#resetWord');if(word){const m=$('#sellModal');m?.classList.add('hidden');const c=$('#sellContent');if(c)c.innerHTML=''}
 }catch{}
}
if(typeof v06SettingsExtras==='function'){
 const v112SettingsExtrasBase=v06SettingsExtras;
 v06SettingsExtras=function(){const r=v112SettingsExtrasBase();v112RemoveResetUI();return r};
}
/* Garde-fou : plus aucune couche ne peut rouvrir le dialogue par un ancien callback. */
v06ResetConfirm=function(){v112RemoveResetUI()};
const resetObserver=new MutationObserver(v112RemoveResetUI);try{resetObserver.observe($('#settingsModal')||document.body,{subtree:true,childList:true})}catch{}
v112RemoveResetUI();

const v112Style=document.createElement('style');v112Style.textContent=`
#resetProgressBtn{display:none!important}.v112-source-unavailable{opacity:.55;border-style:dashed!important}.v112-source-unavailable::after{content:' · source FR indisponible';font-size:9px;color:#8f9caf;font-weight:700}
`;
document.head.appendChild(v112Style);

/* Rejoue le sélecteur après réconciliation des anciennes configurations. */
try{renderSetSwitches()}catch(e){console.warn('V1.1.2 initial selector',e)}
window.__voxV112Ready=true;
