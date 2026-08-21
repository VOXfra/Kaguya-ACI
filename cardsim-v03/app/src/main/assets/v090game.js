'use strict';

/* VOX Card Sim V0.9.0
   Physical multi-binders, Nuit Noire endgame set and safe performance cleanup. */
const V090_VERSION='0.9.0';
const V090_ENDGAME_SET='me05';
const V090_PREREQ_SETS=['sv03.5','sv03','sv02','s6a'];
const V090_PRICE_DATE='2026-08-19';
const V090_PITCH_LOGO='https://assets.tcgdex.net/fr/me/me05/logo.webp';

function v090SetUnlocked(setId){return setId!==V090_ENDGAME_SET||!!state.endgameUnlocks?.[V090_ENDGAME_SET]}
function v090VisibleSets(){return Object.values(SETS).filter(s=>v090SetUnlocked(s.id))}
function v090VisibleSetIds(){return v090VisibleSets().map(s=>s.id)}
function v090CompletionCount(setId){let n=0,p=setId+'|';for(const k of Object.keys(state.discoveredCards||{}))if(k.startsWith(p))n++;return n}
function v090SetComplete(setId){return v090CompletionCount(setId)>=Number(SETS[setId]?.total||Infinity)}
function v090PrereqProgress(){return V090_PREREQ_SETS.filter(v090SetComplete).length}

/* ---------- ENDGAME SET ---------- */
SETS.me05={
 id:'me05',name:'Nuit Noire',longName:'Méga-Évolution — Nuit Noire',series:'MÉGA-ÉVOLUTION',total:120,official:84,hero:[116,120,117],foilEnergy:0,demigod:0,endgame:true,releaseDate:'2026-07-17',
 rates:{double:.2102,ur:.0830,ir:.1101,sir:.0125,mhr:.0009},
 products:[
  {id:'pbl-booster',setId:'me05',name:'Booster Nuit Noire',subtitle:'1 booster libre · 10 cartes + Énergie',kind:'Booster',price:4.51,marketTrend:4.51,mode:'loose',qty:1,image:V090_PITCH_LOGO},
  {id:'pbl-lot6',setId:'me05',name:'Lot de 6 boosters Nuit Noire',subtitle:'6 boosters ajoutés au même stock',kind:'Lot de boosters',price:27.06,marketTrend:4.51,mode:'loose',qty:6,image:V090_PITCH_LOGO},
  {id:'pbl-etb',setId:'me05',name:'Coffret Dresseur d’élite Nuit Noire',subtitle:'Produit scellé · 9 boosters',kind:'ETB',price:59.84,marketTrend:59.84,mode:'sealed',opens:9,image:V090_PITCH_LOGO},
  {id:'pbl-display',setId:'me05',name:'Display Nuit Noire',subtitle:'Boîte scellée · 36 boosters',kind:'Booster Box',price:170.85,marketTrend:170.85,mode:'sealed',opens:36,image:V090_PITCH_LOGO},
  {id:'pbl-build',setId:'me05',name:'Boîtier Stratégies et Combats Nuit Noire',subtitle:'Produit scellé · 4 boosters',kind:'Build & Battle',price:37.76,marketTrend:37.76,mode:'sealed',opens:4,image:V090_PITCH_LOGO},
  {id:'binder-me05',setId:'me05',name:'Portfolio Nuit Noire — 9 poches',subtitle:'Classeur physique · 252 cartes',kind:'Classeur',price:19.99,mode:'binderUnlock',qty:1,image:V090_PITCH_LOGO}
 ]
};
EXPECTED_RARITIES.me05={total:120,common:37,uncommon:26,rare:11,double:10,ir:11,ur:18,sir:6,mhr:1};
RARITY_LABEL.mhr='Méga Hyper Rare';
if(typeof V061_BINDERS!=='undefined')V061_BINDERS.me05={name:'Portfolio Nuit Noire — 9 poches',subtitle:'Portfolio 9 poches · jusqu’à 252 cartes',image:V090_PITCH_LOGO,capacity:252,pages:28};

state.endgameUnlocks=state.endgameUnlocks&&typeof state.endgameUnlocks==='object'?state.endgameUnlocks:{};
state.pageBySet=state.pageBySet&&typeof state.pageBySet==='object'?state.pageBySet:{};state.pageBySet.me05=Math.max(0,Number(state.pageBySet.me05)||0);
const v090SerializableBase=v08Serializable;
v08Serializable=function(){const d=v090SerializableBase();d.endgameUnlocks=state.endgameUnlocks;return d};
const v090FreshSaveBase=v08FreshSave;
v08FreshSave=function(mode){const d=v090FreshSaveBase(mode);d.endgameUnlocks={};d.pageBySet={...(d.pageBySet||{}),me05:0};return d};

/* ---------- EMBEDDED NUIT NOIRE DATA ---------- */
function v090RarityKey(r){
 const k=String(r||'').trim().toLocaleLowerCase('fr-FR');
 return ({'common':'common','commune':'common','uncommon':'uncommon','peu commune':'uncommon','rare':'rare','double rare':'double','illustration rare':'ir','ultra rare':'ur','special illustration rare':'sir','illustration spéciale rare':'sir','illustration speciale rare':'sir','mega hyper rare':'mhr','méga hyper rare':'mhr'}[k]||'unknown');
}
function v090SeedPrice(c){const cm=c?.pricing?.cardmarket||{},v=[cm.trend,cm.avg30,cm.avg7,cm.avg,cm.low].map(Number).find(x=>x>0);if(!v)return;state.lastKnownEstimates??={};state.lastKnownEstimates[c.id]={standard:v,reverse:null,updated:cm.updated||V090_PRICE_DATE,fetchedAt:Date.now(),source:'tcgdex-me05-embed'}}
function v090LoadPitchBlackData(){
 const b=window.V090_PITCH_BLACK_DATA;if(!b||!Array.isArray(b.cards)||b.cards.length!==120){console.warn('V0.9 Nuit Noire embedded data unavailable');return false}
 const cards=b.cards.map(x=>({...x,id:x.id||`me05-${x.localId}`,localId:String(x.localId||'').padStart(3,'0'),imageSmall:x.imageSmall||x.image||'',imageLarge:x.imageLarge||x.image||''})).sort((a,b)=>cardNo(a)-cardNo(b)),rarity={},counts={};
 for(const c of cards){const r=c.rarityKey||v090RarityKey(c.rarity);rarity[cardNo(c)]=r;counts[r]=(counts[r]||0)+1;v090SeedPrice(c)}
 for(const [k,v] of Object.entries(EXPECTED_RARITIES.me05))if(k!=='total'&&counts[k]!==v)throw new Error(`Nuit Noire rarity ${k} ${counts[k]||0}/${v}`);
 const set=b.set||{};state.sets.me05={...set,id:'me05',name:'Nuit Noire',logo:set.logo||'https://assets.tcgdex.net/fr/me/me05/logo',cards};state.meta.me05={rarity,raw:cards,counts};state.metaReady.me05=true;return true;
}
try{v090LoadPitchBlackData()}catch(e){console.error('V0.9 Nuit Noire data',e);state.metaReady.me05=false}

/* ---------- ENDGAME UNLOCK ---------- */
let v090UnlockBusy=false;
function v090MaybeUnlock(showToast=true){
 if(state.endgameUnlocks.me05)return true;if(v090PrereqProgress()<V090_PREREQ_SETS.length)return false;
 state.endgameUnlocks.me05=Date.now();if(!v090UnlockBusy){v090UnlockBusy=true;save();if(showToast)setTimeout(()=>toast('Nouvelle collection débloquée : Nuit Noire'),80);setTimeout(()=>{v090UnlockBusy=false;try{renderSetSwitches();renderHome();renderProducts();renderSettings();if(!$('#marketModal')?.classList.contains('hidden'))renderMarket()}catch{}},120)}return true;
}
v090MaybeUnlock(false);
const v090DiscoverBase=v08Discover;
v08Discover=function(setId,cardId,cardObj=null){const fresh=v090DiscoverBase(setId,cardId,cardObj);if(fresh&&V090_PREREQ_SETS.includes(setId))v090MaybeUnlock(true);return fresh};

selectSet=function(setId){if(!SETS[setId])return;if(!v090SetUnlocked(setId))return toast('Nuit Noire se débloque après les quatre collections précédentes');state.activeSet=setId;save();renderSetSwitches();renderHome();renderProducts();renderBinder();updateStats()};
renderSetSwitches=function(){if(!v090SetUnlocked(state.activeSet))state.activeSet='sv03.5';const visible=v090VisibleSets();$$('[data-set-switch]').forEach(box=>{box.innerHTML=visible.map(s=>`<button class="${state.activeSet===s.id?'active':''}" data-set="${s.id}">${escapeHtml(s.name)}</button>`).join('');box.querySelectorAll('button').forEach(b=>b.onclick=()=>selectSet(b.dataset.set))})};

/* Locked sets are excluded from official random rotation and daily drops. */
v08HourInfo=function(now=Date.now()){const ids=v090VisibleSetIds(),day=Math.floor(now/V08_DAY),hourIndex=Math.floor(now/V08_HOUR),hour=hourIndex%24,cycle=Math.floor(hour/Math.max(1,ids.length)),order=v08SeededShuffle(ids,day*101+cycle*7919);return{setId:order[hour%ids.length]||ids[0],next:(hourIndex+1)*V08_HOUR,day,hour}};
v08DailyEvent=function(now=Date.now()){const day=Math.floor(now/V08_DAY),id=`event-${day}`,start=day*V08_DAY,end=start+V08_DAY,old=state.eventCatalog[id];if(old&&v090SetUnlocked(old.setId))return old;const ids=v090VisibleSetIds(),sid=ids[v08Hash32(day*31337)%ids.length],cfg=SETS[sid],base=cfg.products.find(p=>p.mode==='loose'&&p.qty===1)||cfg.products[0],p={id,setId:sid,name:`Édition limitée du jour — ${cfg.name}`,subtitle:'Drop exclusif 24 h · 6 boosters · limite 1',kind:'ÉDITION LIMITÉE',price:Number((Math.max(29.99,(base.price||5.99)*6.6)).toFixed(2)),mode:'sealed',opens:6,image:base.image,eventEdition:true,eventStart:start,eventEnd:end,eventDay:day};state.eventCatalog[id]=p;return p};

/* ---------- PHYSICAL MULTI-BINDERS ---------- */
function v090BinderProduct(setId){return SETS[setId]?.products?.find(p=>p.mode==='binderUnlock')||null}
function v090BinderSku(setId){const p=v090BinderProduct(setId);return p?sealedSku(p.id):''}
function v090BinderCount(setId){const sku=v090BinderSku(setId);return sku?stockQty(sku):0}
function v090BinderSpec(setId){return typeof V061_BINDERS!=='undefined'?V061_BINDERS[setId]:null}
function v090BinderCapacity(setId){const s=v090BinderSpec(setId);return s?s.capacity*v090BinderCount(setId):0}
function v090BinderPages(setId){const s=v090BinderSpec(setId);return s?s.pages*v090BinderCount(setId):0}
function v090SyncBinderOwned(setId){state.binderOwned??={};state.binderOwned[setId]=v090BinderCount(setId)>0;return state.binderOwned[setId]}
function v090MigrateBinderObjects(){const mode=v08Mode(),key=`voxCardSimV090_binders_${mode}`;if(localStorage.getItem(key)==='1'){for(const sid of Object.keys(SETS))v090SyncBinderOwned(sid);return}for(const sid of Object.keys(SETS)){const had=!!state.binderOwned?.[sid],p=v090BinderProduct(sid);if(had&&p&&v090BinderCount(sid)<=0)v06AddLot(sealedSku(p.id),1,null,'migration-classeur-v090');v090SyncBinderOwned(sid)}localStorage.setItem(key,'1')}
v090MigrateBinderObjects();

reconcileBinder=function(setId){
 const capacity=v090BinderCapacity(setId),owns=capacity>0,cardGroups=new Map(),energyGroups=new Map();v090SyncBinderOwned(setId);
 for(const ins of state.instances||[]){if(ins?.setId!==setId||ins.status!=='owned')continue;if(ins.isEnergy){const k=`${ins.energyType}|${ins.variant||'normal'}`;if(!energyGroups.has(k))energyGroups.set(k,[]);energyGroups.get(k).push(ins)}else if(ins.cardId){if(!cardGroups.has(ins.cardId))cardGroups.set(ins.cardId,[]);cardGroups.get(ins.cardId).push(ins)}}
 const age=x=>Number(x.openedAt||x.acquiredAt||0);
 for(const [cardId,arr] of cardGroups){let chosen=arr[0];for(const x of arr)if(age(x)<age(chosen))chosen=x;const c=cardById(setId,cardId),slot=c?cardNo(c)-1:null,can=owns&&slot!==null&&slot>=0&&slot<capacity;for(const ins of arr){if(ins===chosen&&can){ins.location='binder';ins.binderSlot=slot}else{ins.location='inventory';ins.binderSlot=null}}}
 for(const arr of energyGroups.values()){let keeper=arr.find(x=>x.energyKeeper)||arr[0];for(const x of arr)if(age(x)<age(keeper))keeper=x;for(const x of arr)x.energyKeeper=x===keeper;const slot=owns&&typeof v062EnergySlot==='function'?v062EnergySlot(setId,keeper.energyType,keeper.variant):null;if(slot!==null&&slot!==undefined&&slot<capacity){keeper.location='binder-energy';keeper.binderSlot=slot}else{keeper.location='inventory';keeper.binderSlot=null}for(const x of arr)if(x!==keeper){x.location='inventory';x.binderSlot=null}}
};
if(typeof v062EnergySlot==='function')v062EnergySlot=function(setId,energyType,variant){const cfg=SETS[setId],capacity=v090BinderCapacity(setId);if(!cfg||capacity<=0)return null;const typeIndex=ENERGY.map(e=>e.name).indexOf(energyType);if(typeIndex<0)return null;const slot=cfg.total+(variant==='cosmos'?8:0)+typeIndex;return slot<capacity?slot:null};

const v090AddCardBase=addCardInstance;
addCardInstance=function(c){v090SyncBinderOwned(c.setId||state.currentOpening?.setId||state.activeSet);const ins=v090AddCardBase(c);if(ins?.location==='binder'&&Number(ins.binderSlot)>=v090BinderCapacity(ins.setId)){ins.location='inventory';ins.binderSlot=null}return ins};
const v090ReceiveCardBase=v4ReceiveCard;
v4ReceiveCard=function(asset,condition,qty,unitPrice=null,sellerName=''){v090SyncBinderOwned(asset.setId);const r=v090ReceiveCardBase(asset,condition,qty,unitPrice,sellerName);reconcileBinder(asset.setId);return r};

function v090RequiredBinders(setId){const spec=v090BinderSpec(setId),cfg=SETS[setId];return spec&&cfg?Math.max(1,Math.ceil((cfg.total+16)/spec.capacity)):1}
function v090EnsureBinderToolbar(){const shell=$('#binderShell');if(!shell)return null;let box=$('#v090BinderToolbar');if(!box){box=document.createElement('div');box.id='v090BinderToolbar';box.className='panel v090-binder-toolbar';shell.parentNode.insertBefore(box,shell)}return box}
function v090BuyBinder(setId){
 const p=v090BinderProduct(setId);if(!p||!v090SetUnlocked(setId))return;const mode=v08Mode();
 if(mode!=='creative'&&setId!==v08ActiveShopSet())return toast('Ce classeur sera disponible quand cette collection reviendra dans la boutique');
 if(mode!=='creative'&&typeof v088HourlyRemaining==='function'&&v088HourlyRemaining(p)<=0)return toast('Rupture de stock · réassort à la prochaine rotation');
 if(mode!=='creative'&&state.wallet<p.price)return toast('Solde insuffisant');if(mode!=='creative')state.wallet-=p.price;
 v06AddLot(sealedSku(p.id),1,mode==='creative'?0:p.price,mode==='creative'?'creative':'boutique-classeur');
 if(mode!=='creative'&&typeof v088LimitedRetail==='function'&&v088LimitedRetail(p)){const key=v088StockKey(p);state.storeHourlyPurchases[key]=v088HourlyBought(p)+1;v088PruneStockLedger()}
 v090SyncBinderOwned(setId);reconcileBinder(setId);save();renderBinder();renderProducts();renderInventory();updateStats();toast(`${p.name} ajouté · ${v090BinderCount(setId)} classeur(s)`);
}
const v090BuyProductBase=buyProduct;
buyProduct=function(setId,productId){const p=productById(productId);if(!p)return;if(p.mode==='binderUnlock')return v090BuyBinder(setId);if(setId==='me05'&&!v090SetUnlocked('me05'))return toast('Nuit Noire est encore verrouillée');return v090BuyProductBase(setId,productId)};

const v090RenderProductsBase=renderProducts;
renderProducts=function(){const r=v090RenderProductsBase(),grid=$('#productGrid');if(!grid)return r;for(const article of grid.querySelectorAll('[data-product]')){const p=productById(article.dataset.product);if(!p||p.mode!=='binderUnlock')continue;const btn=article.querySelector('button'),copy=article.querySelector('.product-copy'),count=v090BinderCount(p.setId),spec=v090BinderSpec(p.setId);let info=copy?.querySelector('.v090-binder-stock');if(copy&&!info){info=document.createElement('small');info.className='v090-binder-stock';copy.insertBefore(info,btn)}if(info)info.textContent=`Possédé : ×${count}${spec?` · capacité actuelle ${count*spec.capacity}`:''}`;const out=typeof v088HourlyRemaining==='function'&&v08Mode()!=='creative'&&v088HourlyRemaining(p)<=0;if(btn&&!out){btn.disabled=false;btn.className='primary';btn.textContent=count?'Acheter un autre':'Acheter';btn.onclick=()=>v090BuyBinder(p.setId)}}return r};

function v090RenderBinderCore(){
 const sid=state.activeSet,cfg=SETS[sid],spec=v090BinderSpec(sid);if(!cfg||!spec)return;const count=v090BinderCount(sid),capacity=spec.capacity*count,pages=spec.pages*count,toolbar=v090EnsureBinderToolbar();v090SyncBinderOwned(sid);
 if(toolbar){const need=v090RequiredBinders(sid),missing=Math.max(0,cfg.total-capacity);toolbar.innerHTML=`<div><strong>${count} classeur${count!==1?'s':''} physique${count!==1?'s':''}</strong><span>${capacity} emplacements${missing?` · ${missing} carte(s) de set dépassent encore la capacité`:''}</span></div><button id="v090AddBinder" class="secondary small">${count?'Acheter un autre':'Acheter le classeur'}</button>`;toolbar.querySelector('#v090AddBinder').onclick=()=>v090BuyBinder(sid);toolbar.classList.toggle('capacity-ok',count>=need)}
 $('#binderTitle').textContent=`Classeur ${cfg.name}`;const prev=$('#prevPage'),next=$('#nextPage'),g=$('#pocketGrid');
 if(!count){$('#binderMetaName').textContent='Aucun classeur physique';$('#binderMetaCount').textContent='Achète un classeur pour ranger automatiquement la première copie';$('#pageNum').textContent='—';$('#pageTotal').textContent='—';g.innerHTML='<div class="binder-locked"><div>▤</div><strong>Classeur non possédé</strong><p>Les cartes restent dans l’inventaire tant qu’aucun classeur n’est disponible.</p><button id="v090BuyBinderLocked" class="primary">Acheter le classeur</button></div>';g.querySelector('#v090BuyBinderLocked').onclick=()=>v090BuyBinder(sid);if(prev)prev.disabled=true;if(next)next.disabled=true;return}
 let page=clamp(Number(state.pageBySet[sid])||0,0,Math.max(0,pages-1));state.pageBySet[sid]=page;const volume=Math.floor(page/spec.pages)+1;
 $('#binderMetaName').textContent=`${spec.name} · Volume ${volume}/${count}`;$('#binderMetaCount').textContent=`${capacity} emplacements physiques · ${cfg.total} cartes de set`;$('#pageNum').textContent=page+1;$('#pageTotal').textContent=pages;if(prev)prev.disabled=page<=0;if(next)next.disabled=page>=pages-1;
 g.innerHTML='';const start=page*9,energyTypes=ENERGY.map(e=>e.name);
 for(let i=0;i<9;i++){const slot=start+i,e=document.createElement('div');e.className='pocket';if(slot<cfg.total){const c=getCard(sid,slot+1),ins=c?binderInstance(c.id,sid):null;if(ins&&c){const im=new Image();im.loading='lazy';im.decoding='async';im.src=cardImg(c,'low');im.alt=c.name;im.onclick=()=>openCardModal(c,ins);e.appendChild(im);const b=document.createElement('span');b.className='pocket-number';b.textContent=`#${String(slot+1).padStart(3,'0')}`;e.appendChild(b)}else{e.classList.add('empty','unknown');e.innerHTML=`<span>#${String(slot+1).padStart(3,'0')}</span>`}}else if(slot<cfg.total+16&&slot<capacity){const off=slot-cfg.total,variant=off>=8?'cosmos':'normal',type=energyTypes[off%8],ins=typeof v062EnergyKeeper==='function'?v062EnergyKeeper(sid,type,variant):null,en=ENERGY.find(x=>x.name===type);e.className='pocket energy-pocket'+(ins?'':' empty');if(ins){const im=new Image();im.loading='lazy';im.decoding='async';im.src=en?.thumb||ins.imageSmall||'';im.alt=`Énergie ${type}`;e.appendChild(im)}const b=document.createElement('span');b.className='pocket-number energy-label';b.textContent=`${variant==='cosmos'?'COSMOS · ':''}${type}`;e.appendChild(b)}else{e.classList.add('empty','spare');e.innerHTML='<span>LIBRE</span>'}g.appendChild(e)}
}
renderBinder=function(){v090RenderBinderCore();requestAnimationFrame(()=>{try{v08BindBinderGestures()}catch{}})};
if(typeof v08BinderPages==='function')v08BinderPages=function(setId){return v090BinderPages(setId)};
if(typeof v08BinderCanTurn==='function')v08BinderCanTurn=function(dir){const sid=state.activeSet,p=Number(state.pageBySet?.[sid]||0),max=v090BinderPages(sid)-1;return v090BinderCount(sid)>0&&(dir>0?p<max:p>0)};
if(typeof v08TurnBinder==='function')v08TurnBinder=function(dir,startAngle=0){if(v08BinderBusy||!v08BinderCanTurn(dir))return;const page=$('#binderShell .binder-page');if(!page)return;v08BinderBusy=true;const sheet=v08CreateTurnSheet(page,dir,startAngle),sid=state.activeSet;state.pageBySet[sid]=clamp((state.pageBySet[sid]||0)+dir,0,v090BinderPages(sid)-1);v090RenderBinderCore();vibrate(8);const end=dir>0?-178:178,anim=sheet.animate([{transform:`rotateY(${startAngle}deg)`,filter:'brightness(1)'},{offset:.52,filter:'brightness(.72)'},{transform:`rotateY(${end}deg)`,filter:'brightness(.9)'}],{duration:420,easing:'cubic-bezier(.22,.72,.16,1)',fill:'forwards'});anim.onfinish=anim.oncancel=()=>{sheet.remove();v08BinderBusy=false;v08BindBinderGestures()}};

const v090OpenSealedBase=openSealedSku;
openSealedSku=function(sku){const p=productForSku(sku);if(!p||stockQty(sku)<=0)return;if(p.mode==='binderUnlock')return toast('Ce classeur est déjà un objet utilisable : il ne s’ouvre pas');if(p.id==='151-binder'){const bp=v090BinderProduct('sv03.5');if(bp)v06AddLot(sealedSku(bp.id),1,null,'collection-classeur-151')}const r=v090OpenSealedBase(sku);v090SyncBinderOwned(p.setId);reconcileBinder(p.setId);save();renderBinder();return r};

renderSealedInventory=function(out){const rows=Object.entries(state.stock).filter(([sku,q])=>sku.startsWith('SEALED:')&&q>0);if(!rows.length){out.innerHTML='<div class="empty-state panel">Aucun produit scellé ou classeur.</div>';return}out.innerHTML='';for(const[sku,qty]of rows){const p=productForSku(sku);if(!p)continue;const binder=p.mode==='binderUnlock',spec=binder?v090BinderSpec(p.setId):null,e=document.createElement('div');e.className='sealed-row panel stock-row'+(binder?' v090-binder-item':'');e.innerHTML=`<img loading="lazy" decoding="async" class="stock-thumb" src="${p.image||''}" alt="${escapeHtml(p.name)}"><div class="stock-copy"><strong>${escapeHtml(p.name)}</strong><span>${binder?`Classeur physique · ${spec?.capacity||'?'} emplacements`:`Scellé · ${p.opens||0} boosters à l'ouverture`}</span><b>×${qty}</b></div><div class="row-actions">${binder?'':`<button class="primary open">Ouvrir 1</button>`}<button class="secondary sell">Vendre</button></div>`;e.querySelector('.open')?.addEventListener('click',()=>openSealedSku(sku));e.querySelector('.sell').onclick=()=>openSellStock({type:'sealed',sku,setId:p.setId,productId:p.id,label:p.name,available:qty,unitBase:Number(p.marketTrend||p.price||1)*1.04,rarity:binder?'rare':(p.opens>=16?'sir':p.opens>=9?'ur':'rare')});out.appendChild(e)}};

/* Binders are also marketplace assets. */
const v090MarketAssetsBase=v08MarketAssets;
v08MarketAssets=function(query){let arr=v090MarketAssetsBase(query);if(!v090SetUnlocked('me05'))arr=arr.filter(a=>a.setId!=='me05');const parts=v08QueryParts(query),category=state.marketCategory||'all',setFilter=state.marketSetFilter||'all';if(category==='all'||category==='sealed')for(const s of v090VisibleSets()){if(setFilter!=='all'&&setFilter!==s.id)continue;const p=v090BinderProduct(s.id);if(!p)continue;const a={type:'sealed',setId:s.id,productId:p.id,label:p.name,image:p.image||'',subtitle:'Classeur physique',rarity:'sealed'},score=v08AssetSearchScore(a,parts);if(score<0)continue;a.reference=v08AssetReference(a);a.trend=0;arr.push(a)}const seen=new Set();arr=arr.filter(a=>{const k=`${a.type}|${a.setId}|${a.cardId||a.productId||''}`;if(seen.has(k))return false;seen.add(k);return true});const min=state.marketMinPrice===''?null:Number(state.marketMinPrice),max=state.marketMaxPrice===''?null:Number(state.marketMaxPrice);arr=arr.filter(a=>(min===null||a.reference>=min)&&(max===null||a.reference<=max));switch(state.marketSort){case'priceAsc':arr.sort((a,b)=>a.reference-b.reference||(b.score||0)-(a.score||0));break;case'priceDesc':arr.sort((a,b)=>b.reference-a.reference||(b.score||0)-(a.score||0));break;case'name':arr.sort((a,b)=>String(a.label).localeCompare(String(b.label),'fr'));break;case'number':arr.sort((a,b)=>(a.type==='card'?cardNo(cardById(a.setId,a.cardId)):9999)-(b.type==='card'?cardNo(cardById(b.setId,b.cardId)):9999));break;default:arr.sort((a,b)=>(b.score||0)-(a.score||0))}return arr};
v08MarketSetOptions=function(){return`<option value="all">Toutes les extensions</option>${v090VisibleSets().map(s=>`<option value="${s.id}" ${state.marketSetFilter===s.id?'selected':''}>${escapeHtml(s.name)}</option>`).join('')}`};
const v090RarityOptionsBase=v08RarityOptions;
v08RarityOptions=function(){const s=v090RarityOptionsBase();return s.includes('value="mhr"')?s:s+`<option value="mhr" ${state.marketRarity==='mhr'?'selected':''}>Méga Hyper Rare</option>`};

/* ---------- NUIT NOIRE BOOSTERS ---------- */
const v090GeneratePackBase=generatePack;
generatePack=function(setId){if(setId!=='me05')return v090GeneratePackBase(setId);if(!v090SetUnlocked('me05'))throw new Error('me05-locked');if(!state.metaReady.me05)throw new Error('me05-metadata-not-ready');const commons=pool('me05','common'),uncommons=pool('me05','uncommon'),reverses=[...commons,...uncommons,...pool('me05','rare')],rares=pool('me05','rare'),dr=pool('me05','double'),irs=pool('me05','ir'),urs=pool('me05','ur'),sirs=pool('me05','sir'),mhrs=pool('me05','mhr');if(commons.length<4||uncommons.length<3||!rares.length||!dr.length)throw new Error('me05-rarity-pools-incomplete');const out=[];uniquePicks(commons,4).forEach(c=>out.push(wrapCard(c,'me05','Commune','normal')));uniquePicks(uncommons,3).forEach(c=>out.push(wrapCard(c,'me05','Peu commune','normal')));const r1=pick(reverses);out.push(wrapCard(r1,'me05','Reverse 1','reverse'));const x=Math.random();let r2;if(x<.0009&&mhrs.length)r2=wrapCard(pick(mhrs),'me05','Méga Hyper Rare','holo');else if(x<.0134&&sirs.length)r2=wrapCard(pick(sirs),'me05','SIR','holo');else if(x<.1235&&irs.length)r2=wrapCard(pick(irs),'me05','Illustration Rare','holo');else r2=wrapCard(pick(reverses.filter(c=>c.id!==r1?.id))||pick(reverses),'me05','Reverse 2','reverse');out.push(r2);const y=Math.random();let r3;if(y<.083&&urs.length)r3=wrapCard(pick(urs),'me05','Ultra Rare','holo');else if(y<.2932&&dr.length)r3=wrapCard(pick(dr),'me05','Double Rare','holo');else r3=wrapCard(pick(rares),'me05','Rare Holo','holo');out.push(r3);out.push(energyCard('me05'));return out};
const v090CardVariantBase=v4CardVariant;
v4CardVariant=function(ins,c,setId){if(setId==='me05'&&['double','ir','ur','sir','mhr'].includes(rarityFor(setId,cardNo(c))))return'holo';return v090CardVariantBase(ins,c,setId)};
const v090FallbackBase=v4FallbackBase;v4FallbackBase=function(r){return r==='mhr'?150:v090FallbackBase(r)};
const v090SupplyBase=v4RaritySupply;v4RaritySupply=function(r,type){return type==='card'&&r==='mhr'?1:v090SupplyBase(r,type)};

/* Offline: embedded metadata + remotely cached scans/prices. */
const v090OfflineManifestBase=v05OfflineManifest;
v05OfflineManifest=function(setId){if(setId!=='me05')return v090OfflineManifestBase(setId);if(!v090SetUnlocked('me05'))throw new Error('me05-locked');const cards=cardsFor('me05');if(cards.length!==120)throw new Error(`me05-not-ready-${cards.length}`);const urls=new Set([`${API}/sets/me05`]);for(const c of cards){const img=String(v05BaseCardImg(c,'high')||'');if(/^https:\/\//i.test(img))urls.add(img);urls.add(`${API}/cards/${c.id}`)}return [...urls]};
function v090RefreshOfflineRow(){const sec=$('#settingsModal .offline-settings');if(!sec)return;const row=sec.querySelector('[data-offline-set="me05"]');if(!v090SetUnlocked('me05')){row?.remove();return}if(row)return;const div=document.createElement('div');div.className='offline-row';div.dataset.offlineSet='me05';div.innerHTML='<div><strong>Nuit Noire</strong><small class="offline-status">Vérification…</small></div><button class="secondary small">Télécharger</button>';div.querySelector('button').onclick=()=>v05DownloadOffline('me05');sec.appendChild(div);v05RefreshOfflinePanel()}
const v090RenderSettingsBase=renderSettings;
renderSettings=function(){const r=v090RenderSettingsBase();v090RefreshOfflineRow();return r};

/* ---------- HOME PROGRESSION ---------- */
const v090RenderHomeBase=renderHome;
renderHome=function(){const r=v090RenderHomeBase(),home=$('#home');if(!home)return r;home.querySelector('.v090-endgame')?.remove();const box=document.createElement('div');box.className='panel v090-endgame';if(v090SetUnlocked('me05'))box.innerHTML='<div><span>COLLECTION ENDGAME</span><strong>Nuit Noire débloquée</strong><small>Elle participe désormais aux rotations de la boutique.</small></div><button class="secondary small">Voir</button>';else{const p=v090PrereqProgress();box.innerHTML=`<div><span>COLLECTION ENDGAME</span><strong>Nuit Noire · ${p}/${V090_PREREQ_SETS.length}</strong><small>Complète les quatre collections précédentes pour la débloquer.</small></div><button class="secondary small" disabled>Verrouillée</button>`}box.querySelector('button:not([disabled])')?.addEventListener('click',()=>selectSet('me05'));home.querySelector('.stats-grid')?.after(box);return r};

/* ---------- PERFORMANCE PASS ---------- */
let v090BinderRendering=false,v090BinderSaveTimer=0;
const v090SaveBase=save;
save=function(){if(v090BinderRendering){clearTimeout(v090BinderSaveTimer);v090BinderSaveTimer=setTimeout(()=>{v090BinderSaveTimer=0;v090SaveBase()},350);return}return v090SaveBase()};
const v090RenderBinderPerf=renderBinder;
renderBinder=function(){v090BinderRendering=true;try{return v090RenderBinderPerf()}finally{v090BinderRendering=false}};
const v090ProcessMarketBase=processMarket;
processMarket=function(initial=false){if(document.hidden&&!initial)return;return v090ProcessMarketBase(initial)};
let v090CompactScheduled=false;
function v090CompactState(){if(state.currentOpening?.phase==='reveal')return;const activeIds=new Set();for(const l of state.listings||[])if(l.status==='active')for(const id of l.remainingIds||[])activeIds.add(id);if((state.instances?.length||0)>2500)state.instances=state.instances.filter(x=>x.status!=='sold'||activeIds.has(x.id));if((state.listings?.length||0)>1600){const active=state.listings.filter(x=>x.status==='active'),inactive=state.listings.filter(x=>x.status!=='active').sort((a,b)=>(b.soldAt||b.createdAt||0)-(a.soldAt||a.createdAt||0)).slice(0,700);state.listings=[...active,...inactive]}if((state.sales?.length||0)>3500)state.sales=state.sales.slice(-3500);if(state.priceCache&&Object.keys(state.priceCache).length>260)state.priceCache=Object.fromEntries(Object.entries(state.priceCache).sort((a,b)=>(b[1]?.fetchedAt||0)-(a[1]?.fetchedAt||0)).slice(0,260));if(state.marketBooks&&Object.keys(state.marketBooks).length>500)state.marketBooks=Object.fromEntries(Object.entries(state.marketBooks).sort((a,b)=>(b[1]?.lastTouched||0)-(a[1]?.lastTouched||0)).slice(0,500));v081RebuildInstanceIndexes();v090SaveBase()}
function v090ScheduleCompaction(){if(v090CompactScheduled)return;v090CompactScheduled=true;const run=()=>{v090CompactScheduled=false;try{v090CompactState()}catch(e){console.warn('V0.9 compaction',e)}};if('requestIdleCallback'in window)requestIdleCallback(run,{timeout:5000});else setTimeout(run,1800)}
document.addEventListener('visibilitychange',()=>{if(document.hidden)v090ScheduleCompaction()},{passive:true});setTimeout(v090ScheduleCompaction,4500);
const v090LazyObserver=new MutationObserver(records=>{for(const rec of records)for(const n of rec.addedNodes){if(!(n instanceof HTMLElement))continue;const own=n.matches?.('img')?[n]:[],nested=n.querySelectorAll?Array.from(n.querySelectorAll('img')):[];for(const img of [...own,...nested]){if(img.closest('#cardStack,#packStage'))continue;img.loading='lazy';img.decoding='async'}}});try{v090LazyObserver.observe(document.body,{childList:true,subtree:true})}catch{}

const v090Style=document.createElement('style');v090Style.textContent=`
.v090-binder-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 15px;margin:0 0 10px}.v090-binder-toolbar div{min-width:0}.v090-binder-toolbar strong,.v090-binder-toolbar span{display:block}.v090-binder-toolbar span{font-size:10px;color:var(--muted);margin-top:3px;line-height:1.4}.v090-binder-toolbar.capacity-ok span{color:#9db4a2}.v090-binder-stock{display:block;color:#98a8ba;margin:-4px 0 9px}.v090-binder-item{border-color:#35485f}.v090-endgame{margin-top:10px;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:12px}.v090-endgame span,.v090-endgame strong,.v090-endgame small{display:block}.v090-endgame span{font-size:9px;font-weight:900;letter-spacing:.13em;color:var(--accent)}.v090-endgame strong{margin-top:3px}.v090-endgame small{color:var(--muted);font-size:10px;margin-top:3px}.inventory-card,.market-result,.sealed-row{content-visibility:auto;contain-intrinsic-size:120px}@media(max-width:520px){.v090-binder-toolbar{align-items:flex-start}.v090-binder-toolbar button{flex:none}.v090-endgame{align-items:flex-start}}
`;document.head.appendChild(v090Style);

for(const sid of Object.keys(SETS)){v090SyncBinderOwned(sid);reconcileBinder(sid)}if(!v090SetUnlocked(state.activeSet))state.activeSet='sv03.5';renderSetSwitches();renderHome();renderBinder();renderInventory();renderSettings();updateStats();save();window.__voxV090Ready=true;
