'use strict';
/* VOX Card Sim V1.2.1 — navigation catalogue + progression chronologique.
   - recherche instantanée par nom dans les sélecteurs de collection ;
   - l'accueil et la boutique partagent toujours la même collection active ;
   - suppression de la rotation de collections : la boutique reste sur le set choisi ;
   - progression des archives par année, de 2026 vers les années plus anciennes ;
   - prix de boutique croissants avec l'ancienneté, sans toucher au mode Créatif ;
   - les collections sans produit vérifié restent visibles, mais n'affichent plus
     un classeur générique comme faux contenu de boutique. */
const V121_VERSION='1.2.1-hotfix';
const V121_BASE_YEAR=2026;
const V121_SHOP_YEAR_KEY='voxCardSimV121_shopYear';
const V121_START_MIGRATION='voxCardSimV121_start_';
let V121_COLLECTION_QUERY='';
let V121_SHOP_QUERY='';
let V121_ARCHIVE_PURCHASE_SET='';

function v121Year(cfg){
 try{if(typeof v107SetYear==='function')return v107SetYear(cfg)}catch{}
 const y=Number(cfg?.releaseYear)||Number(cfg?.year)||Number(String(cfg?.releaseDate||'').slice(0,4));
 return Number.isFinite(y)&&y>1990?y:null;
}
function v121Norm(value){
 return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-FR').replace(/[^a-z0-9]+/g,' ').trim();
}
function v121AllSets(){
 return Object.values(SETS||{}).filter(Boolean).sort((a,b)=>(v121Year(b)||0)-(v121Year(a)||0)||String(b.releaseDate||'').localeCompare(String(a.releaseDate||''))||String(a.name||'').localeCompare(String(b.name||''),'fr'));
}
function v121Years(){return [...new Set(v121AllSets().map(v121Year).filter(Boolean))].sort((a,b)=>b-a)}
function v121Match(cfg,query){
 const q=v121Norm(query);if(!q)return true;
 const hay=v121Norm([cfg?.name,cfg?.longName,cfg?.series,cfg?.seriesName,cfg?.id].filter(Boolean).join(' '));
 return q.split(/\s+/).every(x=>hay.includes(x));
}
function v121CareerXp(){return Math.max(0,Number(state.collectorXpEarned)||0)}
function v121YearThreshold(year){
 const age=Math.max(0,V121_BASE_YEAR-Number(year||V121_BASE_YEAR));
 return age<=0?0:Math.round(2*age*(age+1));
}
function v121YearUnlocked(year){
 if(v08Mode()==='creative')return true;
 const y=Number(year);return !Number.isFinite(y)||y>=V121_BASE_YEAR||v121CareerXp()>=v121YearThreshold(y);
}
function v121OldestUnlockedYear(){
 const ys=v121Years().filter(v121YearUnlocked);return ys.length?Math.min(...ys):V121_BASE_YEAR;
}
function v121NextArchiveYear(){
 return v121Years().filter(y=>y<V121_BASE_YEAR&&!v121YearUnlocked(y)).sort((a,b)=>b-a)[0]||null;
}
function v121DefaultSet(){
 const a=v121AllSets().filter(s=>v121Year(s)===V121_BASE_YEAR);return a[0]?.id||v121AllSets()[0]?.id||state.activeSet;
}

/* Nuit Noire n'est plus un verrou endgame isolé : la progression se fait désormais
   par année. Toutes les collections 2026 font donc partie du point de départ. */
if(typeof v090SetUnlocked==='function')v090SetUnlocked=function(){return true};
if(typeof v090VisibleSets==='function')v090VisibleSets=function(){return v121AllSets()};
if(typeof v090VisibleSetIds==='function')v090VisibleSetIds=function(){return v121AllSets().map(s=>s.id)};

/* Nouveau départ : une sauvegarde réellement vierge commence sur la collection 2026
   la plus récente. Les sauvegardes déjà jouées ne sont jamais déplacées de force. */
try{
 const key=V121_START_MIGRATION+(typeof v08Mode==='function'?v08Mode():'slot');
 if(localStorage.getItem(key)!=='1'){
  const opened=Object.values(state.packsOpened||{}).reduce((n,v)=>n+(Number(v)||0),0),played=(state.instances||[]).length>0||opened>0||(state.purchases||[]).length>0||v121CareerXp()>0;
  if(!played){const id=v121DefaultSet();if(id&&SETS?.[id])state.activeSet=id}
  localStorage.setItem(key,'1');try{save()}catch{}
 }
}catch{}
if(typeof v08FreshSave==='function'){
 const v121FreshBase=v08FreshSave;v08FreshSave=function(mode){const d=v121FreshBase(mode),id=v121DefaultSet();if(id)d.activeSet=id;return d};
}
if(typeof v084BuildForceReset==='function'){
 const v121ForceBase=v084BuildForceReset;v084BuildForceReset=function(mode){const d=v121ForceBase(mode),id=v121DefaultSet();if(id)d.activeSet=id;return d};
}

/* ---------- PRODUITS ET PRIX D'ARCHIVE ---------- */
function v121IsStorageBinder(p){return!!p&&(p.v117GenericBinder||p.v117StorageBinder||(p.mode==='binderUnlock'&&!p.v108OfficialBinder&&!p.v117PhysicalSourceId))}
function v121IsPhysicalBinder(p){return!!p&&!v121IsStorageBinder(p)&&(p.contentKind==='binder'||p.v108OfficialBinder||p.v117PhysicalSourceId)}
function v121ImportedRows(setId){try{return typeof v115ImportedItems==='function'?v115ImportedItems(setId):[]}catch{return[]}}
function v121ShopItems(cfg){
 if(!cfg)return[];const rows=[];
 for(const p of cfg.products||[]){
  if(!p||p.retiredCatalog||p.eventEdition||p.v114Virtual||p.marketHidden||p.shopHidden)continue;
  if(v121IsStorageBinder(p))continue;
  const year=v121Year(cfg);
  if(year===V121_BASE_YEAR||p.v109BundledArt||p.v108OfficialBinder||(typeof v115TrustedExisting==='function'&&v115TrustedExisting(p,cfg)))rows.push(p);
 }
 for(const p of v121ImportedRows(cfg.id)){
  if(!p||p.retiredCatalog||p.eventEdition||v121IsStorageBinder(p))continue;
  if(v121IsPhysicalBinder(p)||p.v120ShopVerified===true||(!p.v115Verified&&p.mode!=='binderUnlock'))rows.push(p);
 }
 const seen=new Set();return rows.filter(p=>{const id=String(p?.id||'');if(!id||seen.has(id))return false;seen.add(id);return true});
}
function v121BaseRetailPrice(p){
 if(!p)return 0;
 const known=Number(p.v121RetailBasePrice);if(Number.isFinite(known)&&known>0)return known;
 const source=[Number(p.price),Number(p.marketTrend)].find(x=>Number.isFinite(x)&&x>0.01);if(source)return source;
 const opens=Math.max(0,Number(p.opens)||0),qty=Math.max(1,Number(p.qty)||1),type=String(p.type||p.kind||'').toLocaleLowerCase('fr-FR');
 if(p.mode==='loose'||type.includes('booster_pack')||/^booster\b/i.test(String(p.kind||'')))return 5.99*qty;
 if(type.includes('booster_box')||type.includes('display')||opens>=30)return 179.99;
 if(type.includes('elite trainer')||type==='etb'||type.includes('dresseur'))return 59.99;
 if(type.includes('booster_bundle')||type.includes('bundle')||opens===6)return 35.99;
 if(type.includes('blister'))return opens>=3?19.99:8.49;
 if(v121IsPhysicalBinder(p)||p.contentKind==='accessory')return 19.99;
 if(opens>0)return Math.max(12.99,opens*7.49+7.5);
 return 24.99;
}
function v121AgeMultiplier(year){const age=Math.max(0,V121_BASE_YEAR-Number(year||V121_BASE_YEAR));return age?Math.min(24,Math.pow(1.12,age)):1}
function v121PreparePrice(p,cfg){
 if(!p)return 0;if(!Number.isFinite(Number(p.v121RetailBasePrice))||Number(p.v121RetailBasePrice)<=0)p.v121RetailBasePrice=Number(v121BaseRetailPrice(p).toFixed(2));
 const mult=v121AgeMultiplier(v121Year(cfg));p.v121AgeMultiplier=mult;
 if(v08Mode()!=='creative')p.price=Number((p.v121RetailBasePrice*mult).toFixed(2));
 return Number(p.price)||0;
}

/* ---------- RECHERCHE / NAVIGATION COLLECTION ---------- */
function v121CollectionYearFilter(){
 try{const raw=typeof v107YearFilter==='function'?v107YearFilter():'all';return raw}catch{return'all'}
}
function v121CollectionRows(box){
 const row=box.querySelector('.v107-set-row'),count=box.querySelector('.v121-result-count');if(!row)return;
 const year=v121CollectionYearFilter(),q=V121_COLLECTION_QUERY,all=v121AllSets(),visible=all.filter(s=>v121Match(s,q)&&(q||year==='all'||v121Year(s)===Number(year)));
 row.innerHTML=visible.map(s=>`<button class="${state.activeSet===s.id?'active':''}" data-set="${escapeHtml(s.id)}">${escapeHtml(s.name||s.id)}</button>`).join('')||'<span class="v121-no-result">Aucune collection trouvée</span>';
 row.querySelectorAll('[data-set]').forEach(b=>b.onclick=()=>selectSet(b.dataset.set));if(count)count.textContent=`${visible.length} résultat${visible.length>1?'s':''}`;
}
function v121RenderCollectionBox(box){
 const selected=v121CollectionYearFilter(),years=v121Years();
 box.innerHTML=`<label class="v121-search"><span>⌕</span><input type="search" autocomplete="off" spellcheck="false" placeholder="Rechercher une collection…" value="${escapeHtml(V121_COLLECTION_QUERY)}"><small class="v121-result-count"></small></label><div class="v107-year-row"><button class="${selected==='all'?'active':''}" data-year="all">Tous</button>${years.map(y=>`<button class="${String(selected)===String(y)?'active':''}" data-year="${y}">${y}</button>`).join('')}</div><div class="v107-set-row"></div>`;
 const input=box.querySelector('input');input.oninput=()=>{V121_COLLECTION_QUERY=input.value;v121CollectionRows(box)};
 box.querySelectorAll('[data-year]').forEach(b=>b.onclick=()=>{V121_COLLECTION_QUERY='';if(typeof v107SetYearFilter==='function')v107SetYearFilter(b.dataset.year);else{localStorage.setItem('voxCardSimV107_collectionYear',String(b.dataset.year));renderSetSwitches()}});
 v121CollectionRows(box);
}

function v121ShopYearFilter(){
 const active=v121Year(SETS?.[state.activeSet]),raw=localStorage.getItem(V121_SHOP_YEAR_KEY);const n=Number(raw);return Number.isFinite(n)&&v121Years().includes(n)?n:(active||V121_BASE_YEAR);
}
function v121SelectShopSet(id){
 if(!SETS?.[id])return;state.activeSet=id;const y=v121Year(SETS[id]);if(y)localStorage.setItem(V121_SHOP_YEAR_KEY,String(y));try{save()}catch{};V121_SHOP_QUERY='';renderSetSwitches();renderHome();renderProducts();renderBinder();updateStats();
}
function v121ShopRows(box){
 const row=box.querySelector('.v107-set-row'),count=box.querySelector('.v121-result-count');if(!row)return;
 const year=v121ShopYearFilter(),q=V121_SHOP_QUERY,sets=v121AllSets(),visible=sets.filter(s=>v121Match(s,q)&&(q||v121Year(s)===year));
 row.innerHTML=visible.map(s=>{const y=v121Year(s),locked=!v121YearUnlocked(y),has=v121ShopItems(s).length>0;return`<button class="${state.activeSet===s.id?'active':''} ${locked?'v121-locked':''} ${has?'':'v121-no-products'}" data-v121-shop-set="${escapeHtml(s.id)}">${locked?'🔒 ':''}${escapeHtml(s.name||s.id)}</button>`}).join('')||'<span class="v121-no-result">Aucune collection trouvée</span>';
 row.querySelectorAll('[data-v121-shop-set]').forEach(b=>b.onclick=()=>v121SelectShopSet(b.dataset.v121ShopSet));if(count)count.textContent=`${visible.length} résultat${visible.length>1?'s':''}`;
}
function v121RenderShopSwitch(box=$('#shop [data-set-switch]')){
 if(!box)return;const year=v121ShopYearFilter(),years=v121Years();
 box.classList.remove('hidden');box.innerHTML=`<label class="v121-search"><span>⌕</span><input type="search" autocomplete="off" spellcheck="false" placeholder="Rechercher une collection…" value="${escapeHtml(V121_SHOP_QUERY)}"><small class="v121-result-count"></small></label><div class="v107-year-row v121-shop-years">${years.map(y=>`<button class="${year===y?'active':''} ${v121YearUnlocked(y)?'':'v121-locked'}" data-v121-shop-year="${y}">${v121YearUnlocked(y)?'':'🔒 '}${y}</button>`).join('')}</div><div class="v107-set-row"></div>`;
 const input=box.querySelector('input');input.oninput=()=>{V121_SHOP_QUERY=input.value;v121ShopRows(box)};
 box.querySelectorAll('[data-v121-shop-year]').forEach(b=>b.onclick=()=>{const y=Number(b.dataset.v121ShopYear);localStorage.setItem(V121_SHOP_YEAR_KEY,String(y));V121_SHOP_QUERY='';const first=v121AllSets().find(s=>v121Year(s)===y);if(first)state.activeSet=first.id;try{save()}catch{};renderSetSwitches();renderHome();renderProducts();renderBinder();updateStats()});
 v121ShopRows(box);
}

renderSetSwitches=function(){
 $$('[data-set-switch]').forEach(box=>{if(box.closest('#shop'))v121RenderShopSwitch(box);else v121RenderCollectionBox(box)});
};

/* ---------- BOUTIQUE SANS ROTATION ---------- */
if(typeof v08ActiveShopSet==='function')v08ActiveShopSet=function(){return state.activeSet};
if(typeof v08HourInfo==='function')v08HourInfo=function(now=Date.now()){const h=Math.floor(now/(typeof V08_HOUR==='number'?V08_HOUR:3600000));return{setId:state.activeSet,next:(h+1)*(typeof V08_HOUR==='number'?V08_HOUR:3600000),day:Math.floor(now/(typeof V08_DAY==='number'?V08_DAY:86400000)),hour:h,slot:h}};

function v121DecorateStock(grid){
 if(!grid||v08Mode()==='creative'||typeof v088LimitedRetail!=='function')return;
 for(const article of grid.querySelectorAll('[data-product]')){
  const p=productById(article.dataset.product),copy=article.querySelector('.product-copy'),btn=article.querySelector('button');if(!p||!copy||!btn)continue;
  copy.querySelector('.v088-stock-line')?.remove();
  if(typeof v088UnlimitedRetail==='function'&&v088UnlimitedRetail(p)){const line=document.createElement('div');line.className='v088-stock-line';line.innerHTML='<span class="v088-stock-badge unlimited">STOCK ILLIMITÉ</span><span>Disponible en continu</span>';copy.insertBefore(line,btn);continue}
  if(!v088LimitedRetail(p))continue;const cap=v088HourlyCap(p),remaining=v088HourlyRemaining(p),line=document.createElement('div');line.className=`v088-stock-line ${remaining<=0?'out':remaining<=1?'low':''}`;
  line.innerHTML=remaining<=0?'<span class="v088-stock-badge out">RUPTURE DE STOCK</span><b>Réassort au prochain créneau</b>':`<span class="v088-stock-badge">RÉASSORT HORAIRE</span><b>${remaining} / ${cap} restant${remaining>1?'s':''}</b>`;copy.insertBefore(line,btn);if(remaining<=0){btn.disabled=true;btn.textContent='Rupture de stock'}
 }
}
renderProducts=function(){
 const grid=$('#productGrid'),shop=$('#shop');if(!grid)return;v121RenderShopSwitch();
 shop?.querySelectorAll('.v08-shop-banner,.v109-shop-banner,.v113-shop-banner,.v121-shop-banner').forEach(x=>x.remove());
 const cfg=SETS?.[state.activeSet],year=v121Year(cfg),creative=v08Mode()==='creative',unlocked=v121YearUnlocked(year),items=v121ShopItems(cfg);if(!cfg){grid.innerHTML='<div class="empty-state panel">Aucune collection sélectionnée.</div>';return}
 for(const p of items)v121PreparePrice(p,cfg);
 const next=v121NextArchiveYear(),title=shop?.querySelector('.section-title');if(title){const threshold=v121YearThreshold(year),banner=document.createElement('div');banner.className=`v121-shop-banner panel ${unlocked?'':'locked'}`;banner.innerHTML=`<div><span>${creative?'CATALOGUE LIBRE':unlocked?'ANNÉE DÉBLOQUÉE':'ANNÉE VERROUILLÉE'}</span><strong>${escapeHtml(cfg.name)} · ${year||'Archive'}</strong></div><div><small>${creative?'Tous les millésimes disponibles':unlocked?(next?`${v121CareerXp().toFixed(1)} XP · prochain : ${next}`:'Toutes les archives débloquées'):`${v121CareerXp().toFixed(1)} / ${threshold} XP`}</small><b>${items.length} produit${items.length>1?'s':''}</b></div>`;title.after(banner)}
 if(!items.length){grid.innerHTML=`<div class="empty-state panel v121-empty-products"><strong>Aucun produit physique vérifié</strong><p>${escapeHtml(cfg.name)} reste entièrement visible dans le catalogue et le classeur, mais aucun booster/scellé suffisamment documenté n'est associé à cette collection. Aucun faux produit n'est généré.</p></div>`;return}
 grid.innerHTML=items.map(p=>v08ProductCard(p,cfg,p.mode==='binderUnlock'&&!!state.binderOwned?.[p.setId],creative)).join('');
 for(const article of grid.querySelectorAll('[data-product]')){
  const p=productById(article.dataset.product),btn=article.querySelector('button'),copy=article.querySelector('.product-copy');if(!p||!btn)continue;
  if(!creative&&year<V121_BASE_YEAR&&copy){const mult=Number(p.v121AgeMultiplier)||1,small=document.createElement('small');small.className='v121-archive-price';small.textContent=`Archive ${year} · ancienneté ×${mult.toFixed(2)}`;copy.insertBefore(small,btn)}
  if(!creative&&!unlocked){btn.disabled=true;btn.textContent=`Débloqué à ${v121YearThreshold(year)} XP`;continue}
  if(!btn.disabled)btn.onclick=()=>buyProduct(p.setId||cfg.id,p.id);
 }
 v121DecorateStock(grid);for(const [i,img] of [...grid.querySelectorAll('img')].entries()){img.loading=i<2?'eager':'lazy';img.decoding='async'}
};

/* Les vieux wrappers vérifient encore « année 2026 » et l'ancien set de rotation.
   On leur présente temporairement la collection achetée comme le set retail courant,
   uniquement pendant l'achat déjà autorisé par la progression V1.2.1. */
const v121V108SetYearBase=typeof v108SetYear==='function'?v108SetYear:null;
if(v121V108SetYearBase)v108SetYear=function(cfg){if(V121_ARCHIVE_PURCHASE_SET&&cfg?.id===V121_ARCHIVE_PURCHASE_SET)return V121_BASE_YEAR;return v121V108SetYearBase(cfg)};
const v121BuyBase=buyProduct;
buyProduct=function(setId,productId){
 const p=productById(productId),cfg=SETS?.[setId];if(!p||!cfg)return;
 if(p.v117StorageBinder)return v121BuyBase(setId,productId);
 const creative=v08Mode()==='creative',year=v121Year(cfg),approved=v121ShopItems(cfg).some(x=>String(x.id)===String(productId));if(!approved)return toast('Ce produit n’est pas disponible dans la boutique');
 if(!creative&&!v121YearUnlocked(year))return toast(`${year} se débloque à ${v121YearThreshold(year)} XP carrière`);
 v121PreparePrice(p,cfg);
 if(!creative&&typeof v088LimitedRetail==='function'&&v088LimitedRetail(p)&&typeof v088HourlyRemaining==='function'&&v088HourlyRemaining(p)<=0){renderProducts();return toast('Rupture de stock · réassort au prochain créneau')}
 const oldHidden=p.shopHidden,oldCreative=p.creativeOnly;V121_ARCHIVE_PURCHASE_SET=setId;p.shopHidden=false;p.creativeOnly=false;
 try{return v121BuyBase(setId,productId)}finally{V121_ARCHIVE_PURCHASE_SET='';p.shopHidden=oldHidden;p.creativeOnly=oldCreative}
};

/* Le bouton classeur direct ne doit plus parler de rotation non plus. */
if(typeof v090BuyBinder==='function'){
 const v121BuyBinderBase=v090BuyBinder;v090BuyBinder=function(setId){const p=typeof v090BinderProduct==='function'?v090BinderProduct(setId):null;if(v08Mode()!=='creative'&&p&&typeof v088HourlyRemaining==='function'&&v088HourlyRemaining(p)<=0)return toast('Rupture de stock · réassort au prochain créneau');return v121BuyBinderBase(setId)};
}

/* Accueil -> Boutique : la collection active est l'unique source de vérité. */
const v121NavBase=nav;
nav=function(id){if(id==='shop'){const y=v121Year(SETS?.[state.activeSet]);if(y)localStorage.setItem(V121_SHOP_YEAR_KEY,String(y))}return v121NavBase(id)};

/* Progression visible sur l'accueil et suppression de l'ancien encart endgame. */
const v121RenderHomeBase=renderHome;
renderHome=function(){
 const r=v121RenderHomeBase();const home=$('#home');if(!home)return r;home.querySelector('.v090-endgame')?.remove();home.querySelector('.v121-archive-progress')?.remove();
 const creative=v08Mode()==='creative',next=v121NextArchiveYear(),box=document.createElement('div');box.className='panel v121-archive-progress';
 if(creative)box.innerHTML='<div><span>CATALOGUE</span><strong>Toutes les années débloquées</strong><small>Le mode Créatif ignore la progression chronologique.</small></div>';
 else if(next){const req=v121YearThreshold(next);box.innerHTML=`<div><span>PROGRESSION DES ARCHIVES</span><strong>Disponible jusqu’en ${v121OldestUnlockedYear()}</strong><small>${v121CareerXp().toFixed(1)} / ${req} XP pour débloquer ${next}</small></div><button class="secondary small">Voir la boutique</button>`;box.querySelector('button').onclick=()=>nav('shop')}
 else box.innerHTML='<div><span>PROGRESSION DES ARCHIVES</span><strong>Toutes les années débloquées</strong><small>Le catalogue historique complet est accessible en boutique.</small></div>';
 home.querySelector('.stats-grid')?.after(box);return r;
};

const v121Style=document.createElement('style');v121Style.textContent=`
.v121-search{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px;border:1px solid #2b394d;background:#101824;border-radius:13px;padding:9px 12px;margin:2px 0 9px}.v121-search>span{font-size:18px;color:#f3c653}.v121-search input{min-width:0;border:0;outline:0;background:transparent;color:#eef3fa;font:inherit;font-size:13px}.v121-search input::placeholder{color:#718096}.v121-search small{font-size:9px;color:#78869a;white-space:nowrap}.v121-no-result{padding:9px 3px;color:#7f8da0;font-size:11px}.v107-set-row button.v121-locked,.v121-shop-years button.v121-locked{opacity:.56}.v107-set-row button.v121-no-products{border-style:dashed}.v121-shop-banner{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:13px 15px;margin:12px 0 16px}.v121-shop-banner>div{display:flex;flex-direction:column;gap:3px}.v121-shop-banner span,.v121-shop-banner small{font-size:10px;letter-spacing:.8px;color:#8f9caf}.v121-shop-banner strong,.v121-shop-banner b{color:#f3c653}.v121-shop-banner.locked{border-color:#5e4930}.v121-shop-banner.locked strong{color:#d5a94a}.v121-archive-price{display:block;margin:-4px 0 9px;color:#a38a58;font-size:9px;font-weight:750}.v121-empty-products{padding:22px}.v121-empty-products strong{display:block;font-size:18px;margin-bottom:8px}.v121-empty-products p{margin:0;color:#8f9caf;line-height:1.55}.v121-archive-progress{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:13px 15px;margin-top:12px}.v121-archive-progress>div{display:flex;flex-direction:column;gap:3px}.v121-archive-progress span{font-size:9px;letter-spacing:1.4px;font-weight:900;color:#f2be40}.v121-archive-progress strong{color:#eef3fa}.v121-archive-progress small{color:#8f9caf;line-height:1.4}
`;
document.head.appendChild(v121Style);

setTimeout(()=>{try{renderSetSwitches();renderHome();if($('#shop')?.classList.contains('active'))renderProducts()}catch(e){console.warn('V1.2.1 navigation/progression refresh',e)}},300);
window.__voxV121Ready=true;
