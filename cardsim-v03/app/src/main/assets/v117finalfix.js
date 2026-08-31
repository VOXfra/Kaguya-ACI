'use strict';
/* V1.1.7 final runtime guards.
   Keeps lazy APK data deterministic for archives and guarantees that Creative
   exposes one loose booster SKU per expansion plus the simulator binder. */
const V117_FINAL_VERSION='1.1.7';
const V117_FINAL_HYDRATING=new Map();

/* A French scan remains the first choice. For a genuinely missing TCGdex FR image,
   the build may attach an explicit English emergency fallback from the canonical
   same card ID. This prevents blank cards without pretending the French source is
   complete (the import report still counts the missing French scan). */
if(typeof v112ImageFields==='function'){
 const v117FinalImageFieldsBase=v112ImageFields;
 v112ImageFields=function(x,setId){
  const r=v117FinalImageFieldsBase(x,setId),f=String(x?.v117FallbackImage||'');
  if(!f.startsWith('https://'))return r;
  return{...r,imageSmall:f,imageLarge:f,images:[f],v112MissingScan:false,v117FallbackImageLanguage:x?.v117FallbackImageLanguage||'en'};
 };
}
if(typeof cardImg==='function'){
 const v117FinalCardImgBase=cardImg;
 cardImg=function(c,quality='high'){
  const f=String(c?.v117FallbackImage||'');if(f.startsWith('https://')&&(!c?.imageLarge||String(c.imageLarge).includes('missing-card.svg')))return f;
  return v117FinalCardImgBase(c,quality);
 };
}

async function v117EnsureSet(setId){
 const sid=String(setId||'');if(!sid)return false;
 if(typeof v112Entry!=='function'||!v112Entry(sid))return true;
 if(typeof v112Unavailable==='function'&&v112Unavailable(sid))return false;
 if(typeof v112CatalogReady==='function'&&v112CatalogReady(sid))return true;
 if(V117_FINAL_HYDRATING.has(sid))return V117_FINAL_HYDRATING.get(sid);
 const p=Promise.resolve(v111HydrateSet(sid)).then(Boolean).finally(()=>V117_FINAL_HYDRATING.delete(sid));V117_FINAL_HYDRATING.set(sid,p);return p;
}

/* Re-anchor the Creative item provider after all previous wrappers. Exactly one
   loose single booster survives; multi-packs/bundles and real sealed products do. */
const v117FinalCreativeBase=typeof v115CreativeItems==='function'?v115CreativeItems:null;
if(v117FinalCreativeBase)v115CreativeItems=function(cfg){
 let rows=(v117FinalCreativeBase(cfg)||[]).filter(Boolean),canonical=typeof v117BoosterProduct==='function'?v117BoosterProduct(cfg?.id):null;
 rows=rows.filter(p=>{
  if(p?.v117GenericBinder)return false;
  if(p?.mode==='binderUnlock')return false;
  if(p?.mode==='loose'&&Number(p.qty||1)===1)return false;
  if(/^sealeddex-/i.test(String(p?.id||''))||/illustration\s+\d+/i.test(String(p?.name||'')))return false;
  return true;
 });
 if(canonical)rows.unshift(canonical);
 else{
  const trusted=(cfg?.products||[]).find(p=>p?.mode==='loose'&&Number(p.qty||1)===1&&!/illustration\s+\d+/i.test(String(p.name||'')));
  if(trusted)rows.unshift(trusted);
 }
 if(typeof v117BinderProduct==='function')rows.push(v117BinderProduct(cfg.id));
 const seen=new Set();return rows.filter(p=>{const k=String(p?.id||'');if(!k||seen.has(k))return false;seen.add(k);return true});
};
if(typeof v115CreativeItems==='function')v113Items=function(cfg){return v08Mode()==='creative'?v115CreativeItems(cfg):(cfg?.products||[])};

/* Selecting an archive may be followed immediately by Binder/Offline/Open. Do not
   let any of those screens render the previous collection while hydration runs. */
const v117FinalSelectSetBase=selectSet;
selectSet=function(setId){
 const sid=String(setId||'');const result=v117FinalSelectSetBase(sid);
 if(typeof v112Entry==='function'&&v112Entry(sid)&&!(typeof v112Unavailable==='function'&&v112Unavailable(sid)))v117EnsureSet(sid).then(ok=>{if(ok&&state.activeSet===sid){try{renderHome();renderBinder();updateStats()}catch(e){console.warn('V1.1.7 hydrated render',sid,e)}}});
 return result;
};

const v117FinalRenderBinderBase=renderBinder;
renderBinder=function(){
 const sid=String(state.activeSet||''),needs=typeof v112Entry==='function'&&v112Entry(sid)&&!(typeof v112Unavailable==='function'&&v112Unavailable(sid))&&typeof v112CatalogReady==='function'&&!v112CatalogReady(sid);
 if(!needs)return v117FinalRenderBinderBase();
 const title=$('#binderTitle'),grid=$('#pocketGrid');if(title)title.textContent=`${SETS?.[sid]?.name||sid} — chargement…`;if(grid)grid.innerHTML='<div class="binder-locked"><div>⋯</div><strong>Chargement du catalogue local…</strong><p>Lecture des cartes depuis l’APK.</p></div>';
 v117EnsureSet(sid).then(ok=>{if(ok&&state.activeSet===sid)v117FinalRenderBinderBase();else if(!ok)toast(`Impossible de charger ${SETS?.[sid]?.name||sid}`)});return;
};

/* Fix the exact legacy toast reported on 1999 sets: hydrate packaged JSON first,
   then let the old offline manifest/downloader operate on the now-ready set. */
if(typeof v05DownloadOffline==='function'){
 const v117FinalOfflineBase=v05DownloadOffline;
 v05DownloadOffline=async function(setId){
  const sid=String(setId||'');if(typeof v112Entry==='function'&&v112Entry(sid)){
   if(typeof v112Unavailable==='function'&&v112Unavailable(sid))return toast(`${SETS?.[sid]?.name||sid} : aucune donnée carte exploitable dans la source française.`);
   const ok=await v117EnsureSet(sid);if(!ok)return toast(`Impossible de charger les données embarquées de ${SETS?.[sid]?.name||sid}.`);
  }
  return v117FinalOfflineBase(sid);
 };
}

/* Product cards with unknown internal contents remain legitimate collectibles,
   but the shop copy must not suggest that they can be opened. */
const v117FinalRenderProductsBase=renderProducts;
renderProducts=function(){
 const r=v117FinalRenderProductsBase();
 document.querySelectorAll('#productGrid [data-product]').forEach(card=>{
  const id=card.dataset.product,p=productById(id);if(!p)return;
  if(p.v115Verified&&p.mode==='sealed'&&!p.verifiedContents){const copy=card.querySelector('.product-copy p');if(copy)copy.textContent='Produit scellé de collection · contenu interne non simulé';}
 });
 return r;
};

/* Neutral artwork for the simulator binder. This is deliberately not branded as
   an official Pokémon product. */
const v117FinalStyle=document.createElement('style');v117FinalStyle.textContent=`
.product[data-product^="v117-generic-binder-"] .product-photo-wrap{background:linear-gradient(145deg,#111c2a,#0a111b);position:relative}.product[data-product^="v117-generic-binder-"] .product-photo-wrap:after{content:'▤';font-size:58px;color:#94a5ba;position:absolute;inset:0;display:grid;place-items:center}.product[data-product^="v117-generic-binder-"] .product-photo{visibility:hidden}
`;
document.head.appendChild(v117FinalStyle);
setTimeout(()=>{try{if($('#shop')?.classList.contains('active'))renderProducts();if($('#binder')?.classList.contains('active'))renderBinder()}catch(e){console.warn('V1.1.7 final refresh',e)}},220);
window.__voxV117FinalReady=true;
