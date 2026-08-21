'use strict';

/* VOX Card Sim V1.0.9 — correction stricte de la boutique et des ressources 2026.
   - La boutique n'affiche et ne vend directement que les collections 2026.
   - Le choix de collection dans la boutique pilote réellement les produits affichés.
   - Les visuels 2026 sont embarqués dans l'APK afin d'éviter les photos externes
     cassées, les mauvais détourages et les erreurs hors-ligne.
   - Les anciennes collections restent réservées au Marketplace / offres Archive. */
const V109_VERSION='1.0.9';
const V109_SHOP_SET_KEY='voxCardSimV109_shopSet2026';

const V109_LOCAL_ART={
 'me02.5':{pack:'img/v109/me025_booster.png',bundle:'img/v109/me025_bundle.webp',etb:'img/v109/me025_etb.jpg',binder:'img/v109/me025_binder.png'},
 'me03':{pack:'img/v109/me03_booster.jpg',bundle:'img/v109/me03_bundle.jpg',etb:'img/v109/me03_etb.jpg',display:'img/v109/me03_display.webp',binder:'img/v109/me03_binder.jpg'},
 'me04':{pack:'img/v109/me04_booster.png',bundle:'img/v109/me04_bundle.jpg',etb:'img/v109/me04_etb.jpg',display:'img/v109/me04_display.jpg',binder:'img/v109/me04_binder.png'},
 'me05':{pack:'img/v109/me05_booster.jpg',bundle:'img/v109/me05_bundle.jpg',etb:'img/v109/me05_etb.jpg',display:'img/v109/me05_display.jpg',build:'img/v109/me05_build.png',binder:'img/v109/me05_binder.png'}
};

function v109ShopIds(){
 const ids=typeof v108RetailIds==='function'?v108RetailIds():Object.values(SETS||{}).filter(s=>Number(String(s.releaseDate||'').slice(0,4))===2026).map(s=>s.id);
 return ids.filter(id=>SETS[id]);
}
function v109ShopSet(){
 const ids=v109ShopIds();let id=localStorage.getItem(V109_SHOP_SET_KEY);
 if(!ids.includes(id))id=ids.includes(state.activeSet)?state.activeSet:(ids[0]||null);
 if(id)localStorage.setItem(V109_SHOP_SET_KEY,id);return id;
}
function v109SelectShopSet(id){if(!v109ShopIds().includes(id))return;localStorage.setItem(V109_SHOP_SET_KEY,id);renderProducts();v109RenderShopSwitch()}
function v109RenderShopSwitch(){
 const box=$('#shop [data-set-switch]');if(!box)return;
 const ids=v109ShopIds(),active=v109ShopSet();box.classList.remove('hidden');
 box.innerHTML=`<div class="v109-shop-head"><span>COLLECTIONS 2026</span><button id="v109OpenArchiveMarket" type="button">Archives · Marketplace ↗</button></div><div class="v107-set-row v109-shop-row">${ids.map(id=>`<button class="${id===active?'active':''}" data-v109-shop-set="${id}">${escapeHtml(SETS[id].name)}</button>`).join('')}</div>`;
 box.querySelectorAll('[data-v109-shop-set]').forEach(b=>b.onclick=()=>v109SelectShopSet(b.dataset.v109ShopSet));
 const archive=box.querySelector('#v109OpenArchiveMarket');if(archive)archive.onclick=()=>{state.marketSetFilter='all';state.marketTab='buy';save();renderMarket();$('#marketModal')?.classList.remove('hidden')};
}

function v109Patch2026Art(){
 const patch=(sid,id,key)=>{const p=SETS[sid]?.products?.find(x=>x.id===id),url=V109_LOCAL_ART[sid]?.[key];if(p&&url){p.image=url;p.v109BundledArt=true}};
 for(const sid of Object.keys(V109_LOCAL_ART)){
  const cfg=SETS[sid];if(!cfg)continue;const art=V109_LOCAL_ART[sid];
  const unit=cfg.products?.find(p=>p.mode==='loose'&&Number(p.qty)===1);if(unit){unit.image=art.pack;unit.packArt=art.pack;unit.v109BundledArt=true}
  const binder=cfg.products?.find(p=>p.mode==='binderUnlock');if(binder&&art.binder){binder.image=art.binder;binder.v109BundledArt=true;if(typeof V061_BINDERS!=='undefined'&&V061_BINDERS[sid])V061_BINDERS[sid].image=art.binder}
 }
 patch('me02.5','me02.5-lot6','bundle');patch('me02.5','me02.5-etb','etb');
 patch('me03','me03-lot6','bundle');patch('me03','me03-etb','etb');patch('me03','me03-display','display');
 patch('me04','me04-lot6','bundle');patch('me04','me04-etb','etb');patch('me04','me04-display','display');
 patch('me05','pbl-lot6','bundle');patch('me05','pbl-etb','etb');patch('me05','pbl-display','display');patch('me05','pbl-build','build');
}
v109Patch2026Art();

/* L'ouverture utilise le vrai sachet de l'extension choisie et jamais la photo
   de la collection actuellement mise en avant par une rotation. */
const v109OpeningPackImageBase=openingPackImage;
openingPackImage=function(setId){return V109_LOCAL_ART[setId]?.pack||v109OpeningPackImageBase(setId)};

function v109ProductItems(cfg){return (cfg?.products||[]).filter(p=>!p.shopHidden)}
function v109DecorateStock(grid){
 if(!grid||v08Mode()==='creative')return;
 for(const article of grid.querySelectorAll('[data-product]')){
  const p=productById(article.dataset.product),copy=article.querySelector('.product-copy'),btn=article.querySelector('button');if(!p||!copy||!btn||p.eventEdition)continue;
  copy.querySelector('.v088-stock-line')?.remove();
  if(typeof v088UnlimitedRetail==='function'&&v088UnlimitedRetail(p)){
   const line=document.createElement('div');line.className='v088-stock-line';line.innerHTML='<span class="v088-stock-badge unlimited">STOCK ILLIMITÉ</span><span>Pas de limite horaire</span>';copy.insertBefore(line,btn);continue;
  }
  if(typeof v088LimitedRetail!=='function'||!v088LimitedRetail(p))continue;
  const cap=v088HourlyCap(p),remaining=v088HourlyRemaining(p),line=document.createElement('div');line.className=`v088-stock-line ${remaining<=0?'out':remaining<=1?'low':''}`;
  line.innerHTML=remaining<=0?'<span class="v088-stock-badge out">RUPTURE DE STOCK</span><b>Réassort prochain créneau</b>':`<span class="v088-stock-badge">STOCK HORAIRE</span><b>${remaining} / ${cap} restant${remaining>1?'s':''}</b>`;copy.insertBefore(line,btn);
  if(remaining<=0&&!btn.disabled){btn.disabled=true;btn.textContent='Rupture de stock'}
 }
}

/* Le rendu V0.8 ignorait le set cliqué hors mode Créatif et réaffichait toujours
   la collection de rotation. V1.0.9 possède donc son rendu de boutique dédié. */
renderProducts=function(){
 const grid=$('#productGrid'),shop=$('#shop');if(!grid)return;
 v109Patch2026Art();v109RenderShopSwitch();shop?.querySelector('.v08-shop-banner')?.remove();shop?.querySelector('.v109-shop-banner')?.remove();
 const sid=v109ShopSet(),cfg=sid?SETS[sid]:null;if(!cfg){grid.innerHTML='<div class="empty-state panel">Aucune collection 2026 disponible.</div>';return}
 const creative=v08Mode()==='creative',items=v109ProductItems(cfg),event=typeof v08DailyEvent==='function'?v08DailyEvent():null,eventBought=event?!!state.dailyDropBought?.[event.id]:false;
 const title=shop?.querySelector('.section-title');if(title){const banner=document.createElement('div');banner.className='v109-shop-banner panel';banner.innerHTML=`<div><span>BOUTIQUE 2026</span><strong>${escapeHtml(cfg.name)}</strong></div><div><small>Accès direct</small><b>${items.length} produit${items.length>1?'s':''}</b></div>`;title.after(banner)}
 const shown=[...items];if(event)shown.push(event);
 grid.innerHTML=shown.map(p=>v08ProductCard(p,SETS[p.setId]||cfg,p.mode==='binderUnlock'&&!!state.binderOwned?.[p.setId],creative)).join('');
 for(const article of grid.querySelectorAll('[data-product]')){
  const p=productById(article.dataset.product),btn=article.querySelector('button');if(!p||!btn)continue;
  if(p.eventEdition&&eventBought){btn.disabled=true;btn.textContent='Déjà obtenu'}else btn.onclick=()=>buyProduct(p.setId,p.id);
 }
 v109DecorateStock(grid);
 for(const [i,im] of [...grid.querySelectorAll('img')].entries()){im.loading=i<2?'eager':'lazy';im.decoding='async'}
};

/* Les menus collection/binder gardent la navigation complète par année. Seul le
   sélecteur de la boutique est remplacé par la liste 2026 afin qu'une archive ne
   puisse plus sembler achetable directement. */
const v109RenderSetSwitchesBase=renderSetSwitches;
renderSetSwitches=function(){const r=v109RenderSetSwitchesBase();v109RenderShopSwitch();return r};

/* Les données, prix et produits Nuit Noire sont déjà embarqués. Le vieux manifeste
   V0.5 ajoutait encore META_BASE/undefined, les fiches API et des photos produits
   distantes : autant de téléchargements inutiles et fragiles. V1.0.9 construit donc
   un manifeste ME05 minimal : logo + scans non embarqués + énergies. Les 15 scans
   FR absents de TCGdex sont épinglés dans l'APK au build et ont une imageSmall locale. */
const v109OfflineManifestBase=v05OfflineManifest;
function v109Https(out,u){u=String(u||'').trim();if(/^https:\/\//i.test(u))out.add(u)}
v05OfflineManifest=function(setId){
 if(setId==='me05'){
  const cfg=SETS.me05,set=state.sets.me05,cards=cardsFor('me05');if(!cfg||!set||cards.length!==120)throw new Error(`me05-not-ready-${cards.length}`);
  const urls=new Set(),logo=String(set.logo||'').trim();if(logo)v109Https(urls,/\.(webp|png|jpe?g)(\?|$)/i.test(logo)?logo:logo+'.webp');
  for(const c of cards){
   const base=String(c?.image||'').trim();if(base)v109Https(urls,/\.(webp|png|jpe?g)(\?|$)/i.test(base)?base:base+'/low.webp');
   else v109Https(urls,c?.imageSmall||c?.imageLarge||'');
  }
  for(const e of ENERGY||[]){v109Https(urls,e.image);v109Https(urls,e.thumb)}
  return [...urls];
 }
 let arr=v109OfflineManifestBase(setId)||[];const old=typeof V108_OPENING_PACK_ART==='object'?new Set(Object.values(V108_OPENING_PACK_ART)):new Set();
 arr=arr.filter(u=>/^https:\/\//i.test(String(u||''))&&!old.has(u));return [...new Set(arr)];
};

const v109Style=document.createElement('style');v109Style.textContent=`
#shop .v107-year-row{display:none!important}.v109-shop-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 1px 8px}.v109-shop-head>span{font-size:10px;letter-spacing:1.6px;font-weight:900;color:#f2be40}.v109-shop-head>button{border:0;background:transparent;color:#98a5b8;font-size:10px;font-weight:800;padding:7px}.v109-shop-row{padding-bottom:5px!important}.v109-shop-banner{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:13px 15px;margin:12px 0 16px}.v109-shop-banner>div{display:flex;flex-direction:column;gap:3px}.v109-shop-banner span,.v109-shop-banner small{font-size:10px;letter-spacing:1px;color:#8f9caf}.v109-shop-banner strong,.v109-shop-banner b{color:#f3c653}.product-photo[src^="img/v109/"],#packArt[src^="img/v109/"]{object-fit:contain!important;background:transparent!important}
`;
document.head.appendChild(v109Style);

setTimeout(()=>{try{v109Patch2026Art();v109RenderShopSwitch();if($('#shop')?.classList.contains('active'))renderProducts()}catch(e){console.warn('V1.0.9 refresh',e)}},160);
window.__voxV109Ready=true;
