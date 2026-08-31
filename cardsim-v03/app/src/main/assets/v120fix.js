'use strict';
/* VOX Card Sim V1.2.0 — consolidation finale + navigation/progression boutique.

   Cette couche finale remplace les derniers vestiges de la rotation historique :
   - recherche globale de collection par nom/année (accueil + classeur), accents tolérés ;
   - Accueil -> Boutique conserve exactement la collection sélectionnée ;
   - boutique Réaliste/Ludique organisée par années déblocables via l'XP collectionneur ;
   - 2026 est disponible immédiatement, puis 2025, 2024... ;
   - les archives deviennent progressivement plus chères (+18 % linéaire par année) ;
   - aucune collection n'est éligible au shop uniquement grâce à un classeur ;
   - Creative conserve son catalogue libre et gratuit.
*/
const V120_VERSION='1.2.0';
const V120_CURRENT_YEAR=2026;
const V120_YEAR_XP_STEP=15;
const V120_ARCHIVE_PRICE_PER_YEAR=.18;
const V120_COLLECTION_SEARCH_PLACEHOLDER='Rechercher une collection…';
let V120_COLLECTION_QUERY='';
let V120_SHOP_QUERY='';

function v120CatalogYear(cfg){
 try{if(typeof v111CatalogYear==='function')return Number(v111CatalogYear(cfg))||null}catch{}
 try{if(typeof v107SetYear==='function')return Number(v107SetYear(cfg))||null}catch{}
 const y=Number(cfg?.releaseYear)||Number(String(cfg?.releaseDate||'').slice(0,4));return Number.isFinite(y)&&y>1900?y:null;
}
function v120NormalizeText(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’'`´]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function v120SetSearchText(cfg){
 const name=String(cfg?.name||''),long=String(cfg?.longName||''),series=String(cfg?.series||''),id=String(cfg?.id||''),year=v120CatalogYear(cfg)||'';let text=`${name} ${long} ${series} ${id} ${year}`;
 if(/mcdonald/i.test(text))text+=' mcdo macdo';return v120NormalizeText(text);
}
function v120AllSets(){return Object.values(SETS||{}).filter(Boolean).sort((a,b)=>(v120CatalogYear(b)||0)-(v120CatalogYear(a)||0)||String(b.releaseDate||'').localeCompare(String(a.releaseDate||''))||String(a.name||'').localeCompare(String(b.name||''),'fr'))}
function v120AllYears(){const years=[...new Set(v120AllSets().map(v120CatalogYear).filter(Boolean))].sort((a,b)=>b-a);return years.length?years:[V120_CURRENT_YEAR]}
function v120MatchesSet(cfg,q){const words=v120NormalizeText(q).split(' ').filter(Boolean);if(!words.length)return true;const hay=v120SetSearchText(cfg);return words.every(w=>hay.includes(w))}

function v120IsStorageBinder(p){return !!p&&(p.v117GenericBinder||p.v117StorageBinder||p.mode==='binderUnlock')}
function v120IsPhysicalBinder(p){return !!p&&!v120IsStorageBinder(p)&&p.contentKind==='binder'}
function v120IsCoreShopProduct(p){
 if(!p||v120IsStorageBinder(p)||v120IsPhysicalBinder(p)||p.retiredCatalog||p.eventEdition||p.v114Virtual)return false;
 if(!p.v115Verified)return true;return p.v120ShopVerified===true;
}
function v120DedupeProducts(rows){const seen=new Set();return (rows||[]).filter(p=>{const id=String(p?.id||'');if(!id||seen.has(id))return false;seen.add(id);return true})}
const v120CreativeItemsBase=typeof v115CreativeItems==='function'?v115CreativeItems:null;
function v120CreativeRows(cfg){return v120CreativeItemsBase?(v120CreativeItemsBase(cfg)||[]).filter(Boolean):(cfg?.products||[]).filter(Boolean)}
function v120CoreItems(cfg){return v120CreativeRows(cfg).filter(v120IsCoreShopProduct)}
function v120ShopItems(cfg){const rows=v120CreativeRows(cfg),core=rows.filter(v120IsCoreShopProduct);if(!core.length)return[];return v120DedupeProducts([...core,...rows.filter(v120IsPhysicalBinder)])}
function v120ShopEligibleSets(year=null){return v120AllSets().filter(cfg=>(year==null||v120CatalogYear(cfg)===Number(year))&&v120CoreItems(cfg).length>0)}
if(v120CreativeItemsBase){
 v115CreativeItems=function(cfg){return v120ShopItems(cfg)};
 v113Items=function(cfg){return v08Mode()==='creative'?v115CreativeItems(cfg):(cfg?.products||[])};
 v113Sets=function(){return v120ShopEligibleSets()};
 v113Years=function(){return [...new Set(v113Sets().map(v120CatalogYear).filter(Boolean))].sort((a,b)=>b-a)};
}

function v120PopulateCollectionResults(box,query){
 const row=box?.querySelector('.v120-set-results');if(!row)return;
 const selected=typeof v107YearFilter==='function'?v107YearFilter():'all',q=String(query||'').trim();let sets=v120AllSets();
 if(q)sets=sets.filter(s=>v120MatchesSet(s,q));else if(selected!=='all')sets=sets.filter(s=>v120CatalogYear(s)===Number(selected));
 row.innerHTML=sets.map(s=>`<button class="${state.activeSet===s.id?'active':''}" data-v120-set="${escapeHtml(s.id)}"><span>${escapeHtml(s.name||s.id)}</span>${q?`<small>${v120CatalogYear(s)||''}</small>`:''}</button>`).join('');
 row.querySelectorAll('[data-v120-set]').forEach(b=>b.onclick=()=>selectSet(b.dataset.v120Set));const count=box.querySelector('.v120-search-count');if(count)count.textContent=q?`${sets.length} résultat${sets.length>1?'s':''} · toutes années`:'';
}
function v120EnhanceCollectionBox(box){
 if(!box||box.closest('#shop'))return;const yearRow=box.querySelector('.v107-year-row'),oldSetRow=box.querySelector('.v107-set-row');if(!yearRow||!oldSetRow)return;oldSetRow.classList.add('v120-set-results');
 if(!box.querySelector('.v120-collection-search')){
  const search=document.createElement('div');search.className='v120-collection-search';search.innerHTML=`<div class="v120-search-field"><span>⌕</span><input type="search" autocomplete="off" spellcheck="false" placeholder="${V120_COLLECTION_SEARCH_PLACEHOLDER}" value="${escapeHtml(V120_COLLECTION_QUERY)}"><button type="button" aria-label="Effacer">×</button></div><small class="v120-search-count"></small>`;yearRow.before(search);
  const input=search.querySelector('input'),clear=search.querySelector('button');input.oninput=()=>{V120_COLLECTION_QUERY=input.value;v120PopulateCollectionResults(box,V120_COLLECTION_QUERY)};clear.onclick=()=>{input.value='';V120_COLLECTION_QUERY='';v120PopulateCollectionResults(box,'');input.focus()};
 }
 v120PopulateCollectionResults(box,V120_COLLECTION_QUERY);
}
const v120RenderSetSwitchesBase=renderSetSwitches;
renderSetSwitches=function(){const r=v120RenderSetSwitchesBase();$$('[data-set-switch]').forEach(v120EnhanceCollectionBox);if(v08Mode()==='creative'){try{v113RenderCreativeSwitch?.()}catch{}}else v120RenderShopSwitch();try{v111DecorateCollectionUpdates?.()}catch{}return r};

function v120YearDistance(year){return Math.max(0,V120_CURRENT_YEAR-Number(year||V120_CURRENT_YEAR))}
function v120YearXpRequirement(year){const n=v120YearDistance(year);return V120_YEAR_XP_STEP*n*(n+1)/2}
function v120CollectorXp(){return Math.max(0,Number(state.collectorXpEarned)||0)}
function v120YearUnlocked(year){return v08Mode()==='creative'||v120CollectorXp()+1e-9>=v120YearXpRequirement(year)}
function v120OldestUnlockedYear(){const years=v120AllYears();let oldest=years[0]||V120_CURRENT_YEAR;for(const y of years)if(v120YearUnlocked(y))oldest=Math.min(oldest,y);return oldest}
function v120NextLockedYear(){return v120AllYears().find(y=>!v120YearUnlocked(y))||null}
function v120PriceMultiplier(year){return 1+v120YearDistance(year)*V120_ARCHIVE_PRICE_PER_YEAR}
function v120ProductBasePrice(p){
 const direct=Number(p?.price)||Number(p?.marketTrend)||0;if(direct>0)return direct;const qty=Math.max(1,Number(p?.qty)||1),opens=Math.max(0,Number(p?.opens)||0);
 if(p?.mode==='loose')return 5.49*qty;if(v120IsStorageBinder(p)||v120IsPhysicalBinder(p))return 19.99;if(opens>0){const discount=opens>=24?.86:opens>=9?.89:opens>=6?.92:.97;return Math.max(12.99,5.49*opens*discount+3.5)}if(p?.contentKind==='accessory')return 24.99;return 29.99;
}
function v120RetailPrice(p,cfg=SETS?.[p?.setId]){return Number((v120ProductBasePrice(p)*v120PriceMultiplier(v120CatalogYear(cfg)||V120_CURRENT_YEAR)).toFixed(2))}
function v120DisplayProduct(p,cfg){return {...p,price:v120RetailPrice(p,cfg)}}

const V120_SHOP_SET_PREFIX='voxCardSimV120_shopSet_';
const V120_SHOP_YEAR_PREFIX='voxCardSimV120_shopYear_';
function v120ShopSetKey(){return V120_SHOP_SET_PREFIX+v08Mode()}
function v120ShopYearKey(){return V120_SHOP_YEAR_PREFIX+v08Mode()}
function v120StoredShopSet(){return localStorage.getItem(v120ShopSetKey())||''}
function v120StoredShopYear(){const y=Number(localStorage.getItem(v120ShopYearKey()));return v120AllYears().includes(y)?y:null}
function v120SetShopTarget(setId,forceYear=true){const cfg=SETS?.[setId];if(!cfg)return false;localStorage.setItem(v120ShopSetKey(),String(setId));const y=v120CatalogYear(cfg);if(forceYear&&y)localStorage.setItem(v120ShopYearKey(),String(y));return true}
function v120SelectedShopYear(){const stored=v120StoredShopYear();if(stored)return stored;const sid=v120StoredShopSet(),cfg=SETS?.[sid],y=v120CatalogYear(cfg);return y||V120_CURRENT_YEAR}
function v120SelectedShopSet(){const sid=v120StoredShopSet(),year=v120SelectedShopYear();if(sid&&SETS?.[sid]&&v120CatalogYear(SETS[sid])===year)return sid;const pick=v120ShopEligibleSets(year)[0]||v120AllSets().find(s=>v120CatalogYear(s)===year)||null;if(pick)v120SetShopTarget(pick.id,false);return pick?.id||null}
function v120SelectShopYear(year){const y=Number(year);if(!v120AllYears().includes(y))return;localStorage.setItem(v120ShopYearKey(),String(y));const pick=v120ShopEligibleSets(y)[0]||v120AllSets().find(s=>v120CatalogYear(s)===y);if(pick)localStorage.setItem(v120ShopSetKey(),pick.id);V120_SHOP_QUERY='';renderProducts()}
function v120SelectShopSet(setId){if(!SETS?.[setId])return;v120SetShopTarget(setId,true);renderProducts()}
function v120ShopSearchResults(q){return v120AllSets().filter(s=>v120MatchesSet(s,q)).slice(0,60)}
function v120ShopYearButtons(activeYear){return v120AllYears().map(y=>{const locked=!v120YearUnlocked(y),req=v120YearXpRequirement(y);return `<button class="${y===activeYear?'active':''} ${locked?'locked':''}" data-v120-shop-year="${y}" title="${locked?`${req} XP requis`:'Année débloquée'}">${locked?'🔒 ':''}${y}</button>`}).join('')}
function v120ShopSetButtons(activeYear,activeSet,query){
 const q=String(query||'').trim();let sets=q?v120ShopSearchResults(q):v120ShopEligibleSets(activeYear);if(!q&&activeSet&&SETS?.[activeSet]&&v120CatalogYear(SETS[activeSet])===activeYear&&!sets.some(s=>s.id===activeSet))sets=[SETS[activeSet],...sets];
 return sets.map(s=>{const y=v120CatalogYear(s),locked=!v120YearUnlocked(y),has=v120CoreItems(s).length>0;return `<button class="${s.id===activeSet?'active':''} ${locked?'locked':''} ${has?'':'no-products'}" data-v120-shop-set="${escapeHtml(s.id)}"><span>${escapeHtml(s.name||s.id)}</span>${q?`<small>${y||''}${locked?' · 🔒':''}${!has?' · cartes seules':''}</small>`:''}</button>`}).join('');
}
function v120RenderShopSwitch(){
 const box=$('#shop [data-set-switch]');if(!box||v08Mode()==='creative')return;const year=v120SelectedShopYear(),active=v120SelectedShopSet(),xp=v120CollectorXp(),next=v120NextLockedYear();box.classList.remove('hidden');
 box.innerHTML=`<div class="v120-shop-head"><div><span>PROGRESSION BOUTIQUE</span><strong>Archives par année</strong></div><small>${next?`${xp.toFixed(1)} / ${v120YearXpRequirement(next)} XP · prochain : ${next}`:'Toutes les années débloquées'}</small></div><div class="v120-search-field v120-shop-search"><span>⌕</span><input type="search" autocomplete="off" spellcheck="false" placeholder="Rechercher une collection…" value="${escapeHtml(V120_SHOP_QUERY)}"><button type="button" aria-label="Effacer">×</button></div><div class="v107-year-row v120-shop-years">${v120ShopYearButtons(year)}</div><div class="v107-set-row v120-shop-sets">${v120ShopSetButtons(year,active,V120_SHOP_QUERY)}</div>`;
 box.querySelectorAll('[data-v120-shop-year]').forEach(b=>b.onclick=()=>v120SelectShopYear(b.dataset.v120ShopYear));box.querySelectorAll('[data-v120-shop-set]').forEach(b=>b.onclick=()=>v120SelectShopSet(b.dataset.v120ShopSet));
 const input=box.querySelector('.v120-shop-search input'),clear=box.querySelector('.v120-shop-search button'),row=box.querySelector('.v120-shop-sets');const repaint=()=>{row.innerHTML=v120ShopSetButtons(v120SelectedShopYear(),v120SelectedShopSet(),V120_SHOP_QUERY);row.querySelectorAll('[data-v120-shop-set]').forEach(b=>b.onclick=()=>v120SelectShopSet(b.dataset.v120ShopSet))};input.oninput=()=>{V120_SHOP_QUERY=input.value;repaint()};clear.onclick=()=>{input.value='';V120_SHOP_QUERY='';repaint();input.focus()};
}
function v120DecorateStock(grid){
 if(!grid)return;for(const article of grid.querySelectorAll('[data-product]')){const p=productById(article.dataset.product),copy=article.querySelector('.product-copy'),btn=article.querySelector('button');if(!p||!copy||!btn)continue;copy.querySelector('.v088-stock-line')?.remove();
  if(typeof v088UnlimitedRetail==='function'&&v088UnlimitedRetail(p)){const line=document.createElement('div');line.className='v088-stock-line';line.innerHTML='<span class="v088-stock-badge unlimited">STOCK CONTINU</span><span>Disponible sans quota</span>';copy.insertBefore(line,btn);continue}
  if(typeof v088LimitedRetail!=='function'||!v088LimitedRetail(p))continue;const cap=v088HourlyCap(p),remaining=v088HourlyRemaining(p),line=document.createElement('div');line.className=`v088-stock-line ${remaining<=0?'out':remaining<=1?'low':''}`;line.innerHTML=remaining<=0?'<span class="v088-stock-badge out">RUPTURE</span><b>Réassort à l’heure suivante</b>':`<span class="v088-stock-badge">RÉASSORT HORAIRE</span><b>${remaining} / ${cap} restant${remaining>1?'s':''}</b>`;copy.insertBefore(line,btn);if(remaining<=0){btn.disabled=true;btn.textContent='Rupture de stock'}
 }
}

const v120RenderProductsBase=renderProducts;
renderProducts=function(){
 if(v08Mode()==='creative')return v120RenderProductsBase();const grid=$('#productGrid'),shop=$('#shop');if(!grid)return;try{v109Patch2026Art?.()}catch{}
 shop?.querySelector('.v08-shop-banner')?.remove();shop?.querySelector('.v109-shop-banner')?.remove();shop?.querySelector('.v113-shop-banner')?.remove();shop?.querySelector('.v120-shop-banner')?.remove();v120RenderShopSwitch();
 const sid=v120SelectedShopSet(),cfg=sid?SETS?.[sid]:null,year=cfg?v120CatalogYear(cfg):v120SelectedShopYear(),title=shop?.querySelector('.section-title');if(!cfg){grid.innerHTML='<div class="empty-state panel">Aucune collection disponible pour cette année.</div>';return}
 const unlocked=v120YearUnlocked(year),req=v120YearXpRequirement(year),items=v120ShopItems(cfg),mul=v120PriceMultiplier(year);if(title){const banner=document.createElement('div');banner.className='v120-shop-banner panel';banner.innerHTML=`<div><span>${unlocked?'BOUTIQUE DÉBLOQUÉE':'ARCHIVES VERROUILLÉES'}</span><strong>${escapeHtml(cfg.name)}</strong></div><div><small>${year||'Archive'}${year<V120_CURRENT_YEAR?` · prix ×${mul.toFixed(2)}`:''}</small><b>${unlocked?`${items.length} produit${items.length>1?'s':''}`:`${v120CollectorXp().toFixed(1)} / ${req} XP`}</b></div>`;title.after(banner)}
 if(!unlocked){grid.innerHTML=`<div class="empty-state panel v120-year-lock"><strong>${year} est encore verrouillée</strong><p>Continue à ouvrir, classer et grader des cartes pour atteindre ${req} XP collectionneur cumulés. Aucun changement horaire : une année débloquée le reste définitivement.</p></div>`;return}
 if(!items.length){grid.innerHTML=`<div class="empty-state panel v120-no-products"><strong>Aucun produit physique vérifié</strong><p>${escapeHtml(cfg.name)} est bien présente dans le catalogue de cartes, mais aucun booster ou produit scellé exploitable n'est actuellement associé à cette collection. Elle reste accessible depuis l’Accueil et le Classeur.</p></div>`;return}
 const shown=items.map(p=>v120DisplayProduct(p,cfg));grid.innerHTML=shown.map(p=>v08ProductCard(p,cfg,false,false)).join('');for(const article of grid.querySelectorAll('[data-product]')){const p=productById(article.dataset.product),btn=article.querySelector('button');if(!p||!btn)continue;btn.onclick=()=>buyProduct(sid,p.id)}v120DecorateStock(grid);for(const [i,img] of [...grid.querySelectorAll('img')].entries()){img.loading=i<3?'eager':'lazy';img.decoding='async'}
};

v08ActiveShopSet=function(){return v120SelectedShopSet()||state.activeSet};
if(typeof v109ShopIds==='function')v109ShopIds=function(){return v120ShopEligibleSets(v120SelectedShopYear()).map(s=>s.id)};
if(typeof v109ShopSet==='function')v109ShopSet=function(){return v120SelectedShopSet()};
if(typeof v109SelectShopSet==='function')v109SelectShopSet=function(id){return v120SelectShopSet(id)};
if(typeof v109RenderShopSwitch==='function')v109RenderShopSwitch=function(){return v120RenderShopSwitch()};

const v120BuyProductBase=buyProduct;
function v120IsProgressionProduct(setId,productId){return v120ShopItems(SETS?.[setId]).some(p=>String(p.id)===String(productId))}
function v120RecordHourlyPurchase(p){if(typeof v088LimitedRetail!=='function'||!v088LimitedRetail(p)||typeof v088StockKey!=='function')return;state.storeHourlyPurchases??={};const key=v088StockKey(p);state.storeHourlyPurchases[key]=(typeof v088HourlyBought==='function'?v088HourlyBought(p):Number(state.storeHourlyPurchases[key])||0)+1;try{v088PruneStockLedger?.()}catch{}}
function v120BuyProgressionProduct(setId,productId){
 const cfg=SETS?.[setId],p=productById(productId);if(!cfg||!p)return;const year=v120CatalogYear(cfg);if(!v120YearUnlocked(year))return toast(`${year} est verrouillée · ${v120YearXpRequirement(year)} XP requis`);
 if(typeof v088LimitedRetail==='function'&&v088LimitedRetail(p)&&typeof v088HourlyRemaining==='function'&&v088HourlyRemaining(p)<=0){renderProducts();return toast('Rupture de stock · réassort à l’heure suivante')}
 const price=v120RetailPrice(p,cfg);if(Number(state.wallet)<price)return toast('Solde insuffisant');state.wallet-=price;
 if(p.mode==='binderUnlock'){if(state.binderOwned?.[setId]){state.wallet+=price;return toast('Classeur déjà possédé')}state.binderOwned??={};state.binderOwned[setId]=true;try{reconcileBinder(setId)}catch{}}
 else if(p.mode==='loose'){const qty=Math.max(1,Number(p.qty)||1);v06AddLot(boosterSku(setId),qty,price/qty,'boutique-archive')}else v06AddLot(sealedSku(p.id),1,price,'boutique-archive');
 v120RecordHourlyPurchase(p);save();renderProducts();renderInventory();renderBinder();updateStats();toast(p.mode==='loose'?`+${Math.max(1,Number(p.qty)||1)} booster${Number(p.qty)>1?'s':''} ${setName(setId)} · ${money(price)}`:`${p.name} ajouté · ${money(price)}`);
}
buyProduct=function(setId,productId){if(v08Mode()==='creative'||!v120IsProgressionProduct(setId,productId))return v120BuyProductBase(setId,productId);return v120BuyProgressionProduct(setId,productId)};

$$('[data-go="shop"]').forEach(btn=>btn.addEventListener('click',()=>{if(btn.closest('#home')||btn.closest('#binder'))v120SetShopTarget(state.activeSet,true)},true));
if(typeof v110AddXp==='function'){const v120AddXpBase=v110AddXp;v110AddXp=function(...args){const before=v120OldestUnlockedYear(),r=v120AddXpBase(...args),after=v120OldestUnlockedYear();if(v08Mode()!=='creative'&&after<before)setTimeout(()=>toast(`Archives ${after} débloquées dans la boutique`),80);return r}}

function v120BinderOwned(setId){return !!state.binderOwned?.[setId]}
function v120BinderProduct(setId){return typeof v117BinderProduct==='function'?v117BinderProduct(setId):null}
function v120EnsureBinderAction(){const root=$('#binder'),sid=state.activeSet;if(!root||!sid)return;root.querySelector('.v120-binder-action')?.remove();if(v120BinderOwned(sid))return;const p=v120BinderProduct(sid);if(!p)return;const box=document.createElement('div');box.className='v120-binder-action panel';box.innerHTML=`<div><span class="tag">RANGEMENT</span><strong>${escapeHtml(p.name)}</strong><small>Classeur de rangement du simulateur, disponible même si cette extension n'avait aucun portfolio officiel.</small></div><button class="primary">${v08Mode()==='creative'?'Ajouter':'Acheter · '+money(p.price)}</button>`;box.querySelector('button').onclick=()=>buyProduct(sid,p.id);const anchor=root.querySelector('.section-title')||root.firstElementChild;anchor?.after(box)}
const v120RenderBinderBase=renderBinder;renderBinder=function(){const r=v120RenderBinderBase();v120EnsureBinderAction();return r};
function v120NormalizeBoosterLots(){for(const lots of Object.values(state.stockLots||{}))for(const lot of lots||[]){delete lot.v115PackArt;delete lot.v115ProductId;delete lot.packArt;delete lot.artwork}}
function v120RepairPendingOpening(){const o=state.currentOpening;if(!o||o.phase!=='sealed')return;if(o.v115PackArt){delete o.v115PackArt;delete o.packArt}}

const v120Style=document.createElement('style');v120Style.textContent=`
.v120-collection-search{display:flex;align-items:center;gap:9px;margin:8px 0 6px}.v120-search-field{min-width:0;flex:1;display:flex;align-items:center;gap:8px;border:1px solid #263447;background:#0d141e;border-radius:13px;padding:8px 10px}.v120-search-field>span{color:#7f8da1;font-size:18px}.v120-search-field input{min-width:0;flex:1;background:transparent;border:0;outline:0;color:#eef3fa;font:inherit;font-size:12px}.v120-search-field input::placeholder{color:#6f7d90}.v120-search-field button{border:0;background:transparent;color:#8997aa;font-size:18px;padding:0 3px}.v120-search-count{color:#7f8da1;font-size:9px;white-space:nowrap}.v120-set-results button,.v120-shop-sets button{display:inline-flex!important;align-items:center;gap:7px}.v120-set-results button small,.v120-shop-sets button small{font-size:8px;opacity:.7}.v120-shop-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:2px 1px 9px}.v120-shop-head>div{display:flex;flex-direction:column;gap:2px}.v120-shop-head span{font-size:9px;letter-spacing:1.5px;font-weight:900;color:#f2be40}.v120-shop-head strong{font-size:12px;color:#eef3fa}.v120-shop-head small{font-size:9px;color:#8f9caf;text-align:right}.v120-shop-search{margin-bottom:9px}#shop .v120-shop-years{display:flex!important}.v120-shop-years button.locked,.v120-shop-sets button.locked{opacity:.56}.v120-shop-sets button.no-products{border-style:dashed}.v120-shop-banner{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:13px 15px;margin:12px 0 16px}.v120-shop-banner>div{display:flex;flex-direction:column;gap:3px}.v120-shop-banner span,.v120-shop-banner small{font-size:10px;letter-spacing:1px;color:#8f9caf}.v120-shop-banner strong,.v120-shop-banner b{color:#f3c653}.v120-year-lock,.v120-no-products{grid-column:1/-1;padding:22px}.v120-year-lock strong,.v120-no-products strong{display:block;font-size:18px;margin-bottom:8px}.v120-year-lock p,.v120-no-products p{margin:0;color:#8f9caf;line-height:1.55}.v120-binder-action{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;padding:14px 15px;margin:10px 0 16px}.v120-binder-action>div{display:flex;flex-direction:column;gap:4px}.v120-binder-action strong{color:#eef3fa}.v120-binder-action small{color:#8f9caf;line-height:1.4;max-width:620px}.v120-binder-action button{white-space:nowrap}
`;document.head.appendChild(v120Style);
setTimeout(()=>{try{v120NormalizeBoosterLots();v120RepairPendingOpening();save();renderSetSwitches();if($('#shop')?.classList.contains('active'))renderProducts();if($('#binder')?.classList.contains('active'))renderBinder()}catch(e){console.warn('V1.2.0 final refresh',e)}},260);
window.__voxV120Ready=true;
