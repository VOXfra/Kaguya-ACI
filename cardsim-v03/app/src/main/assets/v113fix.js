'use strict';
/* VOX Card Sim V1.1.3 — boutique Créative réellement sans restrictions.
   Le mode Créatif promet depuis V0.8 « argent illimité, tous les produits disponibles ».
   Les couches V1.0.8/V1.0.9 avaient ensuite réintroduit les règles Réaliste dans la
   boutique : uniquement 2026, archives Marketplace et certains SKU shopHidden.
   Cette couche restaure le contrat du mode Créatif sans modifier Réaliste/Ludique. */
const V113_VERSION='1.1.3';
const V113_SHOP_SET_KEY='voxCardSimV113_creativeShopSet';
const V113_SHOP_YEAR_KEY='voxCardSimV113_creativeShopYear';

function v113Year(cfg){
 try{if(typeof v111CatalogYear==='function')return v111CatalogYear(cfg)}catch{}
 try{if(typeof v111Year==='function')return v111Year(cfg)}catch{}
 try{if(typeof v107SetYear==='function')return v107SetYear(cfg)}catch{}
 const y=Number(cfg?.releaseYear)||Number(String(cfg?.releaseDate||'').slice(0,4));
 return Number.isFinite(y)?y:null;
}
function v113Items(cfg){
 /* shopHidden signifie « pas vendu dans la boutique normale » : en Créatif il est
    volontairement ignoré. retiredCatalog reste exclu car il désigne un faux/ancien
    SKU conservé uniquement pour la compatibilité des sauvegardes. */
 return (cfg?.products||[]).filter(p=>p&&!p.retiredCatalog&&!p.eventEdition);
}
function v113Sets(){
 return Object.values(SETS||{}).filter(cfg=>v113Items(cfg).length>0).sort((a,b)=>(v113Year(b)||0)-(v113Year(a)||0)||String(b.releaseDate||'').localeCompare(String(a.releaseDate||''))||String(a.name||'').localeCompare(String(b.name||''),'fr'));
}
function v113Years(){return [...new Set(v113Sets().map(v113Year).filter(Boolean))].sort((a,b)=>b-a)}
function v113YearFilter(){
 const raw=localStorage.getItem(V113_SHOP_YEAR_KEY)||'all';
 return raw==='all'||v113Years().includes(Number(raw))?raw:'all';
}
function v113CreativeShopSet(){
 const sets=v113Sets(),ids=sets.map(s=>s.id);let id=localStorage.getItem(V113_SHOP_SET_KEY);
 const year=v113YearFilter(),visible=year==='all'?sets:sets.filter(s=>v113Year(s)===Number(year));
 if(!ids.includes(id)||!visible.some(s=>s.id===id)){
  id=visible.some(s=>s.id===state.activeSet)?state.activeSet:(visible[0]?.id||sets[0]?.id||null);
 }
 if(id)localStorage.setItem(V113_SHOP_SET_KEY,id);return id;
}
function v113SetCreativeYear(value){
 const year=value==='all'?'all':String(Number(value));localStorage.setItem(V113_SHOP_YEAR_KEY,year);
 const sets=v113Sets(),visible=year==='all'?sets:sets.filter(s=>v113Year(s)===Number(year));
 if(visible.length)localStorage.setItem(V113_SHOP_SET_KEY,visible[0].id);
 renderProducts();
}
function v113SelectCreativeSet(id){
 if(!v113Sets().some(s=>s.id===id))return;localStorage.setItem(V113_SHOP_SET_KEY,id);renderProducts();
}
function v113RenderCreativeSwitch(){
 if(v08Mode()!=='creative')return;
 const box=$('#shop [data-set-switch]');if(!box)return;
 const sets=v113Sets(),year=v113YearFilter(),active=v113CreativeShopSet(),visible=year==='all'?sets:sets.filter(s=>v113Year(s)===Number(year));
 box.classList.remove('hidden');
 box.innerHTML=`<div class="v113-shop-head"><div><span>MODE CRÉATIF</span><strong>Tous les articles du catalogue</strong></div><small>Archives incluses · aucun stock · aucun prix</small></div><div class="v107-year-row v113-year-row"><button class="${year==='all'?'active':''}" data-v113-year="all">Tous</button>${v113Years().map(y=>`<button class="${String(year)===String(y)?'active':''}" data-v113-year="${y}">${y}</button>`).join('')}</div><div class="v107-set-row v113-set-row">${visible.map(s=>`<button class="${s.id===active?'active':''}" data-v113-set="${escapeHtml(s.id)}">${escapeHtml(s.name||s.id)}</button>`).join('')}</div>`;
 box.querySelectorAll('[data-v113-year]').forEach(b=>b.onclick=()=>v113SetCreativeYear(b.dataset.v113Year));
 box.querySelectorAll('[data-v113-set]').forEach(b=>b.onclick=()=>v113SelectCreativeSet(b.dataset.v113Set));
 requestAnimationFrame(()=>{try{box.querySelector('[data-v113-set].active')?.scrollIntoView({block:'nearest',inline:'center'})}catch{}});
}

/* La V1.0.9 impose 2026 dans renderProducts(). En Créatif on remplace ce rendu
   complètement ; les autres modes continuent d'utiliser exactement le chemin 1.1.2. */
const v113RenderProductsBase=renderProducts;
renderProducts=function(){
 if(v08Mode()!=='creative')return v113RenderProductsBase();
 const grid=$('#productGrid'),shop=$('#shop');if(!grid)return;
 try{v109Patch2026Art?.()}catch{}
 shop?.querySelector('.v08-shop-banner')?.remove();shop?.querySelector('.v109-shop-banner')?.remove();shop?.querySelector('.v113-shop-banner')?.remove();
 v113RenderCreativeSwitch();
 const sid=v113CreativeShopSet(),cfg=sid?SETS?.[sid]:null;
 if(!cfg){grid.innerHTML='<div class="empty-state panel">Aucun article physique n’est encore défini dans le catalogue.</div>';return}
 const items=v113Items(cfg),title=shop?.querySelector('.section-title');
 if(title){const banner=document.createElement('div');banner.className='v113-shop-banner panel';banner.innerHTML=`<div><span>CATALOGUE LIBRE</span><strong>${escapeHtml(cfg.name)}</strong></div><div><small>${v113Year(cfg)||'Archive'}</small><b>${items.length} article${items.length>1?'s':''}</b></div>`;title.after(banner)}
 grid.innerHTML=items.map(p=>v08ProductCard(p,SETS[p.setId]||cfg,p.mode==='binderUnlock'&&!!state.binderOwned?.[p.setId],true)).join('');
 for(const article of grid.querySelectorAll('[data-product]')){
  const p=productById(article.dataset.product),btn=article.querySelector('button');if(!p||!btn||btn.disabled)continue;btn.textContent='Ajouter';btn.onclick=()=>buyProduct(p.setId||cfg.id,p.id);
 }
 for(const [i,img] of [...grid.querySelectorAll('img')].entries()){img.loading=i<3?'eager':'lazy';img.decoding='async'}
};

/* Bypass explicite des verrous V1.0.8 (archive/shopHidden) en Créatif. On reprend
   le comportement Créatif originel de V0.8 : coût nul, quantité illimitée et pas de
   ledger de stock. Réaliste/Ludique délèguent au pipeline existant inchangé. */
const v113BuyProductBase=buyProduct;
buyProduct=function(setId,productId){
 if(v08Mode()!=='creative')return v113BuyProductBase(setId,productId);
 const p=productById(productId),sid=p?.setId||setId,cfg=SETS?.[sid];if(!p||!cfg)return;
 if(p.retiredCatalog)return toast('Cet ancien SKU est retiré du catalogue');
 if(p.mode==='binderUnlock'){
  state.binderOwned=state.binderOwned||{};state.binderOwned[sid]=true;try{reconcileBinder(sid)}catch{}
 }else if(p.mode==='loose'){
  v06AddLot(boosterSku(sid),Math.max(1,Number(p.qty)||1),0,'creative');
 }else{
  v06AddLot(sealedSku(p.id),1,0,'creative');
 }
 save();renderProducts();renderInventory();renderBinder();updateStats();return toast(`${p.name} ajouté`);
};

/* Toute reconstruction globale des sélecteurs par V1.1.2 est suivie du sélecteur
   Créatif, sinon v109RenderShopSwitch() pourrait remettre visuellement « 2026 ». */
const v113RenderSetSwitchesBase=renderSetSwitches;
renderSetSwitches=function(){const r=v113RenderSetSwitchesBase();if(v08Mode()==='creative')v113RenderCreativeSwitch();return r};

const v113Style=document.createElement('style');v113Style.textContent=`
.v113-shop-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;padding:2px 1px 9px}.v113-shop-head>div{display:flex;flex-direction:column;gap:2px}.v113-shop-head span{font-size:9px;letter-spacing:1.5px;font-weight:900;color:#f2be40}.v113-shop-head strong{font-size:12px;color:#eef3fa}.v113-shop-head small{font-size:9px;color:#8f9caf;text-align:right}.v113-year-row{display:flex!important}.v113-shop-banner{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:13px 15px;margin:12px 0 16px}.v113-shop-banner>div{display:flex;flex-direction:column;gap:3px}.v113-shop-banner span,.v113-shop-banner small{font-size:10px;letter-spacing:1px;color:#8f9caf}.v113-shop-banner strong,.v113-shop-banner b{color:#f3c653}
`;
document.head.appendChild(v113Style);

setTimeout(()=>{try{if(v08Mode()==='creative'){v113RenderCreativeSwitch();if($('#shop')?.classList.contains('active'))renderProducts()}}catch(e){console.warn('V1.1.3 creative shop refresh',e)}},100);
window.__voxV113Ready=true;
