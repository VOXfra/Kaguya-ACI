'use strict';
/* V1.0.6 shop-art repair. New catalog products must never use a set logo as a product photo. */
const V106_SHOP_ART_VERSION='1.0.6';

const V106_PRODUCT_ART={
 'me02.5-booster':'https://pokecard.store/a/l/fr/cdn/shop/files/booster-me2-5-heros-transcendants-pokemon-fr-mega-evolution-me02-5-694597df3d8e4_580x%402x.jpg?v=1773138916',
 'me02.5-lot6':'https://lootboxjeux.fr/cdn/shop/files/ME2-5_Bundle_FR.webp?v=1774695267&width=640',
 'me02.5-etb':'https://www.destocktcg.fr/assets/uploads/products/etb-heros-transcendants-coffret-dresseur-delite-pokemon-fr-me2-5-6920c6bc4d1eb.jpg',
 'me03-booster':'https://www.pikastore.fr/img/p/6/0/6/4/1/60641.jpg',
 'me03-lot6':'https://www.pokezenith.com/1226-large_default/pokemon-bundle-de-6-boosters-me03-equilibre-parfait.jpg',
 'me03-etb':'https://www.comptoir-tcg.fr/cdn/shop/files/etb-equilibre-parfait-coffret-dresseur-delite-pokemon-fr-me03-me3-69a1c9477a52e.jpg?v=1773936847&width=1445',
 'me03-display':'https://kuro-star.com/cdn/shop/files/ME03-Display1site.webp?v=1772416349&width=416',
 'me04-booster':'https://bmstores.fr/1035304-large_default/booster-pokemon-me04.jpg',
 'me04-lot6':'https://cdn1.philibertnet.com/857453-thickbox_default/pokemon-me04-chaos-ascendant-bundle-6-boosters-0196214140356.jpg',
 'me04-etb':'https://www.destocktcg.fr/assets/uploads/products/coffret-dresseur-delite-pokemon-chaos-ascendant-etb-mega-evolution-me04-me4-69d76624c4008.jpg',
 'me04-display':'https://www.pokezenith.com/img/p/1/4/2/1/1421.jpg',
 'pbl-booster':'https://www.dracaugames.com/cdn/shop/files/booster-me05-mega-evolution-nuit-noire-pokemon-fr-me5-6a03178a4a6ba.webp?v=1781603695&width=1214',
 'pbl-lot6':'https://www.destocktcg.fr/assets/uploads/products/bundle-me05-lot-de-6-boosters-nuit-noire-pokemon-fr-mega-evolution-me5-6a031a8a49231.jpg',
 'pbl-etb':'https://www.bcd-jeux.fr/85783-large_default/pokemon-me05-nuit-noire-etb-zarude-pokemon.jpg',
 'pbl-display':'https://cdn1.philibertnet.com/864878/pokemon-me05-nuit-noire-boite-de-36-boosters-2100001360900.jpg'
};

function v106BinderArt(setName){
 const name=String(setName||'Collection').replace(/[&<>"']/g,'');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="900" viewBox="0 0 720 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#172435"/><stop offset="1" stop-color="#07101a"/></linearGradient><linearGradient id="s" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#e5aa29"/><stop offset=".5" stop-color="#ffd766"/><stop offset="1" stop-color="#d08b10"/></linearGradient></defs><rect width="720" height="900" rx="52" fill="#09121d"/><rect x="46" y="36" width="628" height="828" rx="45" fill="url(#g)" stroke="#31445c" stroke-width="7"/><rect x="73" y="60" width="38" height="780" rx="19" fill="#050a10"/><rect x="131" y="94" width="501" height="650" rx="35" fill="#101d2c" stroke="#253a51" stroke-width="5"/><rect x="165" y="133" width="433" height="8" rx="4" fill="url(#s)"/><text x="165" y="222" fill="#f3f6fa" font-family="Arial,sans-serif" font-size="42" font-weight="700">CLASSEUR 9 POCHES</text><text x="165" y="282" fill="#ffd15a" font-family="Arial,sans-serif" font-size="28" font-weight="700">${name.slice(0,30)}</text><g fill="none" stroke="#344a62" stroke-width="4"><rect x="168" y="350" width="125" height="172" rx="13"/><rect x="318" y="350" width="125" height="172" rx="13"/><rect x="468" y="350" width="125" height="172" rx="13"/><rect x="168" y="545" width="125" height="172" rx="13"/><rect x="318" y="545" width="125" height="172" rx="13"/><rect x="468" y="545" width="125" height="172" rx="13"/></g><text x="165" y="798" fill="#91a2b6" font-family="Arial,sans-serif" font-size="24">Portfolio physique · VOX Card Sim</text></svg>`;
 return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
}

function v106GenericProductArt(p,setName){
 if(p?.mode==='binderUnlock')return v106BinderArt(setName);
 const kind=String(p?.kind||'Produit').toUpperCase(),name=String(setName||'Collection').replace(/[&<>"']/g,'');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="900" viewBox="0 0 720 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#17283d"/><stop offset="1" stop-color="#080f18"/></linearGradient></defs><rect width="720" height="900" rx="50" fill="#08111b"/><rect x="70" y="70" width="580" height="760" rx="40" fill="url(#g)" stroke="#304861" stroke-width="6"/><text x="110" y="190" fill="#ffd15a" font-family="Arial,sans-serif" font-size="31" font-weight="700">${kind.slice(0,25)}</text><text x="110" y="265" fill="#f4f7fa" font-family="Arial,sans-serif" font-size="38" font-weight="700">${name.slice(0,26)}</text><path d="M140 390h440v290H140z" fill="#0b1724" stroke="#425a72" stroke-width="5"/><path d="M185 435h350v200H185z" fill="#122438"/><path d="M215 475h290v12H215zm0 42h250v12H215zm0 42h275v12H215z" fill="#4d6680"/><text x="110" y="765" fill="#91a4b9" font-family="Arial,sans-serif" font-size="24">Visuel produit indisponible</text></svg>`;
 return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
}

function v106RepairShopArt(){
 for(const s of Object.values(SETS))for(const p of (s.products||[])){
  const exact=V106_PRODUCT_ART[p.id];
  if(exact)p.image=exact;
  else if(p.mode==='binderUnlock'&&(p.id.startsWith('binder-')||p.id==='binder-me05'))p.image=v106BinderArt(s.name);
  else if(p.v105GeneratedProduct)p.image=v106GenericProductArt(p,s.name);
 }
 // Existing V1.0.5-generated products did not carry a marker. Mark the catalog products now.
 for(const sid of Object.keys(window.V105_CATALOG?.sets||{})){
  const s=SETS[sid];if(!s)continue;
  for(const p of (s.products||[])){
   p.v105GeneratedProduct=true;
   if(V106_PRODUCT_ART[p.id])p.image=V106_PRODUCT_ART[p.id];
   else if(p.mode==='binderUnlock')p.image=v106BinderArt(s.name);
   else if(!/^https:\/\//i.test(String(p.image||''))||String(p.image||'').includes('/logo'))p.image=v106GenericProductArt(p,s.name);
  }
 }
 // Nuit Noire predates V1.0.5 but must follow the same product-art rule.
 const night=SETS.me05;if(night)for(const p of (night.products||[])){
  if(V106_PRODUCT_ART[p.id])p.image=V106_PRODUCT_ART[p.id];
  else if(p.mode==='binderUnlock')p.image=v106BinderArt(night.name);
  else if(p.id==='pbl-build')p.image=v106GenericProductArt(p,night.name);
 }
 try{v106MarketIndex=null;v106MarketCache?.clear?.()}catch{}
}

v106RepairShopArt();

// Daily six-booster drop should visually be a six-booster product, never a set logo.
const v106DailyEventArtBase=v08DailyEvent;
v08DailyEvent=function(now=Date.now()){
 const p=v106DailyEventArtBase(now);if(!p)return p;
 const s=SETS[p.setId],bundle=s?.products?.find(x=>x.mode==='loose'&&Number(x.qty)===6),booster=s?.products?.find(x=>x.mode==='loose'&&Number(x.qty)===1);
 p.image=bundle?.image||booster?.image||v106GenericProductArt(p,s?.name||'Collection');return p;
};
for(const p of Object.values(state.eventCatalog||{})){
 if(!p?.eventEdition)continue;const s=SETS[p.setId],bundle=s?.products?.find(x=>x.mode==='loose'&&Number(x.qty)===6),booster=s?.products?.find(x=>x.mode==='loose'&&Number(x.qty)===1);p.image=bundle?.image||booster?.image||v106GenericProductArt(p,s?.name||'Collection');
}

// Replace a failed remote product photo with a product-shaped local visual, never the set logo.
function v106WireShopImageFallbacks(){
 const root=$('#shop');if(!root)return;
 for(const img of root.querySelectorAll('img')){
  if(img.dataset.v106Fallback==='1')continue;img.dataset.v106Fallback='1';
  img.addEventListener('error',()=>{const card=img.closest('[data-product]'),p=productById(card?.dataset?.product||'');if(p)img.src=v106GenericProductArt(p,setName(p.setId))},{once:true});
 }
}
const v106ShopArtRenderBase=renderProducts;
renderProducts=function(){const r=v106ShopArtRenderBase();v106RepairShopArt();v106WireShopImageFallbacks();return r};
if($('#shop')?.classList.contains('active'))renderProducts();
try{v081PersistSoon?.(1200)}catch{}
window.__voxV106ShopArtReady=true;
