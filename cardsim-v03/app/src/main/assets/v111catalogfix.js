'use strict';
/* VOX Card Sim V1.1.1 — correctif catalogue complet Android.
   - lecture native des JSON empaquetés, sans dépendre de fetch(file://) ;
   - années historiques 1999/2000 enfin accessibles ;
   - l'année active est automatiquement ramenée à l'écran. */
const V111_CATALOG_PATCH_VERSION='1.1.1';
const V111_PREPATCH_YEAR=typeof v107SetYear==='function'?v107SetYear:null;

function v111CatalogYear(s){
 let y=Number(s?.releaseYear)||Number(String(s?.releaseDate||'').slice(0,4));
 if(Number.isFinite(y)&&y>=1996&&y<=2100)return y;
 try{
  const e=typeof v111Entry==='function'?v111Entry(s?.id):null;
  y=Number(e?.year)||Number(String(e?.releaseDate||'').slice(0,4));
  if(Number.isFinite(y)&&y>=1996&&y<=2100)return y;
 }catch{}
 try{
  y=V111_PREPATCH_YEAR?Number(V111_PREPATCH_YEAR(s)):NaN;
  if(Number.isFinite(y)&&y>=1996&&y<=2100)return y;
 }catch{}
 return null;
}

/* L'ancienne V1.0.7 rejetait explicitement 1999 et 2000 avec `y > 2000`.
   Tous les consommateurs historiques utilisent maintenant la fonction corrigée. */
try{v107SetYear=v111CatalogYear}catch{}
try{v111Year=v111CatalogYear}catch{}
v107Years=function(){
 return [...new Set(Object.values(SETS).map(v111CatalogYear).filter(Boolean))].sort((a,b)=>b-a);
};

function v111ReadPackagedCatalog(entry){
 if(!entry?.file)return null;
 try{
  const raw=window.VOXOffline?.readCatalogFile?.(V111_LANGUAGE,String(entry.file));
  if(raw){
   const payload=JSON.parse(raw);
   if(payload&&Number(payload.schema)===111&&Array.isArray(payload.cards))return payload;
  }
 }catch(e){console.warn('V1.1.1 native catalog read failed',entry?.id||entry?.file,e)}
 return null;
}

/* Remplace le fetch file:// par le pont Android natif. Le fallback fetch reste utile
   pour le build web/debug où VOXOffline n'existe pas. */
v111HydrateSet=async function(setId){
 if(state.metaReady?.[setId]&&cardsFor(setId).length)return true;
 const cfg=SETS?.[setId],entry=v111Entry(setId);if(!cfg||!entry?.file)return false;
 if(V111_LOAD_PROMISES.has(setId))return V111_LOAD_PROMISES.get(setId);
 const task=(async()=>{
  try{
   let payload=v111ReadPackagedCatalog(entry);
   if(!payload){
    const r=await fetch(`catalog/${encodeURIComponent(V111_LANGUAGE)}/${encodeURIComponent(entry.file)}`);
    if(!r.ok)throw new Error(`catalog HTTP ${r.status}`);
    payload=await r.json();
   }
   const raw=Array.isArray(payload.cards)?payload.cards:[];
   const expected=Number(cfg.total)||Number(entry.cards)||0;
   if(raw.length!==expected)throw new Error(`cartes ${raw.length}/${expected}`);
   if(!raw.length){state.metaReady[setId]=false;return false}
   const cards=raw.map(x=>{
    const base=String(x.image||'').trim(),imgs=[v111Image(base,'low'),v111Image(base,'high')].filter(Boolean);
    return {...x,setId,v111Embedded:true,image:base,imageSmall:imgs[0]||'',imageLarge:imgs[1]||imgs[0]||'',images:imgs};
   }).sort((a,b)=>cardNo(a)-cardNo(b));
   const rarity={},counts={};window.V110_MASTER_VARIANTS=window.V110_MASTER_VARIANTS||{};const master={};
   for(const c of cards){
    const n=cardNo(c),rk=c.rarityKey||'unknown';rarity[n]=rk;counts[rk]=(counts[rk]||0)+1;
    master[String(c.localId||'').padStart(3,'0')]=Array.isArray(c.variants)&&c.variants.length?c.variants:['normal'];
   }
   state.sets[setId]={id:setId,name:cfg.name,logo:entry.logo||'',cards};
   state.meta[setId]={rarity,raw:cards,counts};state.metaReady[setId]=true;
   window.V110_MASTER_VARIANTS[setId]={supported:true,source:`TCGdex ${V111_LANGUAGE} import`,cards:master};
   try{v081RebuildInstanceIndexes?.()}catch{}
   return true;
  }catch(e){console.error('V1.1.1 catalog hydrate',setId,e);state.metaReady[setId]=false;return false}
  finally{V111_LOAD_PROMISES.delete(setId)}
 })();
 V111_LOAD_PROMISES.set(setId,task);return task;
};

/* Le catalogue possède beaucoup plus d'années que l'ancienne UI. On garde les
   pastilles familières, mais on ramène automatiquement l'année sélectionnée et la
   collection active dans la zone visible après chaque rendu. */
renderSetSwitches=function(){
 const selected=v107YearFilter();
 const sets=Object.values(SETS).slice().sort((a,b)=>(v111CatalogYear(b)||0)-(v111CatalogYear(a)||0)||String(b.releaseDate||'').localeCompare(String(a.releaseDate||''))||String(a.name||'').localeCompare(String(b.name||''),'fr'));
 const years=v107Years();
 $$('[data-set-switch]').forEach(box=>{
  const visible=selected==='all'?sets:sets.filter(s=>v111CatalogYear(s)===Number(selected));
  box.innerHTML=`<div class="v107-year-row"><button class="${selected==='all'?'active':''}" data-year="all">Tous</button>${years.map(y=>`<button class="${String(selected)===String(y)?'active':''}" data-year="${y}">${y}</button>`).join('')}</div><div class="v107-set-row">${visible.map(s=>`<button class="${state.activeSet===s.id?'active':''}" data-set="${escapeHtml(s.id)}">${escapeHtml(s.name||s.id)}</button>`).join('')}</div>`;
  box.querySelectorAll('[data-year]').forEach(b=>b.onclick=()=>v107SetYearFilter(b.dataset.year));
  box.querySelectorAll('[data-set]').forEach(b=>b.onclick=()=>selectSet(b.dataset.set));
  requestAnimationFrame(()=>{
   try{box.querySelector('.v107-year-row [data-year].active')?.scrollIntoView({block:'nearest',inline:'center'})}catch{}
   try{box.querySelector('.v107-set-row [data-set].active')?.scrollIntoView({block:'nearest',inline:'center'})}catch{}
  });
 });
 try{v111DecorateCollectionUpdates?.()}catch{}
};

try{renderSetSwitches()}catch(e){console.warn('V1.1.1 selector refresh',e)}
window.__voxV111CatalogFixReady=true;
