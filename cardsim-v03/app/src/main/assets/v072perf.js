'use strict';

// V0.7.2 performance layer. Loaded after v07fix.js.

// ---------- O(1) CARD LOOKUPS / RARITY POOLS ----------
const v072CardIndexes=new Map();
function v072SetIndex(setId){
 const cards=cardsFor(setId);
 let idx=v072CardIndexes.get(setId);
 if(!idx||idx.cards!==cards||idx.length!==cards.length){
  const byId=new Map(),byNo=new Map();
  for(const c of cards){byId.set(c.id,c);byNo.set(cardNo(c),c)}
  idx={cards,length:cards.length,byId,byNo};
  v072CardIndexes.set(setId,idx);
 }
 return idx;
}
cardById=function(setId,id){return v072SetIndex(setId).byId.get(id)||null};
getCard=function(setId,n){return v072SetIndex(setId).byNo.get(Number(n))||null};

const v072PoolIndexes=new Map();
function v072Pools(setId){
 const cards=cardsFor(setId),rarity=state.meta[setId]?.rarity;
 let idx=v072PoolIndexes.get(setId);
 if(!idx||idx.cards!==cards||idx.rarity!==rarity){
  const pools=new Map();
  for(const c of cards){
   const r=rarity?.[cardNo(c)]||'unknown';
   if(!pools.has(r))pools.set(r,[]);
   pools.get(r).push(c);
  }
  idx={cards,rarity,pools};v072PoolIndexes.set(setId,idx);
 }
 return idx.pools;
}
pool=function(setId,key){return v072Pools(setId).get(key)||[]};
reversePool=function(setId){return[...pool(setId,'common'),...pool(setId,'uncommon'),...pool(setId,'rare')]};
if(typeof v06Pool==='function')v06Pool=function(setId,key){return v072Pools(setId).get(key)||[]};

// ---------- SINGLE-PASS BINDER RECONCILIATION ----------
reconcileBinder=function(setId){
 const cardGroups=new Map(),energyGroups=new Map(),owns=!!state.binderOwned?.[setId];
 for(const ins of state.instances||[]){
  if(ins.setId!==setId||ins.status!=='owned')continue;
  if(ins.isEnergy){
   const k=`${ins.energyType}|${ins.variant||'normal'}`;
   if(!energyGroups.has(k))energyGroups.set(k,[]);
   energyGroups.get(k).push(ins);
  }else if(ins.cardId){
   if(!cardGroups.has(ins.cardId))cardGroups.set(ins.cardId,[]);
   cardGroups.get(ins.cardId).push(ins);
  }
 }
 const age=x=>Number(x.openedAt||x.acquiredAt||0);
 for(const [cardId,arr] of cardGroups){
  if(!owns){
   for(const ins of arr){ins.location='inventory';ins.binderSlot=null}
   continue;
  }
  let chosen=arr[0];
  for(const ins of arr)if(age(ins)<age(chosen))chosen=ins;
  const c=cardById(setId,cardId);
  for(const ins of arr){
   if(ins===chosen){ins.location='binder';ins.binderSlot=c?cardNo(c)-1:ins.binderSlot}
   else if(ins.location==='binder'){ins.location='inventory';ins.binderSlot=null}
  }
 }
 for(const arr of energyGroups.values()){
  const existing=arr.find(x=>x.energyKeeper);let keeper=existing||arr[0];
  if(!existing)for(const ins of arr)if(age(ins)<age(keeper))keeper=ins;
  for(const ins of arr)ins.energyKeeper=ins===keeper;
  const slot=owns&&typeof v062EnergySlot==='function'?v062EnergySlot(setId,keeper.energyType,keeper.variant):null;
  if(slot!==null){keeper.location='binder-energy';keeper.binderSlot=slot}
  else{keeper.location='inventory';keeper.binderSlot=null}
  for(const ins of arr)if(ins!==keeper&&ins.location==='binder-energy'){ins.location='inventory';ins.binderSlot=null}
 }
};

let v072BinderTickCache=null,v072BinderTickQueued=false;
function v072BinderTickIndex(setId){
 if(v072BinderTickCache?.setId===setId)return v072BinderTickCache;
 const cards=new Map(),energies=new Map();
 for(const ins of state.instances||[]){
  if(ins.setId!==setId||ins.status!=='owned')continue;
  if(ins.location==='binder'&&ins.cardId)cards.set(ins.cardId,ins);
  if(ins.isEnergy&&ins.energyKeeper)energies.set(`${ins.energyType}|${ins.variant||'normal'}`,ins);
 }
 v072BinderTickCache={setId,cards,energies};
 if(!v072BinderTickQueued){
  v072BinderTickQueued=true;
  queueMicrotask(()=>{v072BinderTickCache=null;v072BinderTickQueued=false});
 }
 return v072BinderTickCache;
}
binderInstance=function(cardId,setId){return v072BinderTickIndex(setId).cards.get(cardId)||null};
if(typeof v062EnergyKeeper==='function')v062EnergyKeeper=function(setId,energyType,variant){return v072BinderTickIndex(setId).energies.get(`${energyType}|${variant||'normal'}`)||null};

// ---------- ONE SERIALIZATION PER SAVE ----------
const v072LegacySave=save;
save=function(){
 try{
  const d=v06Serializable();
  d.version=7;d.schemaVersion=7;
  d.onlineProcessedSellerTrades=Array.isArray(state.onlineProcessedSellerTrades)?state.onlineProcessedSellerTrades.slice(-400):[];
  d.onlineProcessedBuyerTrades=Array.isArray(state.onlineProcessedBuyerTrades)?state.onlineProcessedBuyerTrades.slice(-400):[];
  d.onlineCloudEnabled=state.onlineCloudEnabled!==false;
  d.lastSavedAt=Date.now();
  const json=JSON.stringify(d);
  localStorage.setItem(V06_STORAGE,json);
  localStorage.setItem(V06_BACKUP,json);
  try{window.VOXNative?.mirrorSave?.(json)}catch{}
  try{clearTimeout(v07ProfileTimer);v07ProfileTimer=setTimeout(v07PublishPublicProfile,2400)}catch{}
 }catch(e){
  console.warn('V0.7.2 optimized save fallback',e);
  v072LegacySave();
 }
};

let v072SaveTimer=0;
function v072ScheduleSave(delay=650){
 clearTimeout(v072SaveTimer);
 v072SaveTimer=setTimeout(()=>{v072SaveTimer=0;save()},delay);
}
function v072FlushScheduledSave(){
 if(!v072SaveTimer)return;
 clearTimeout(v072SaveTimer);v072SaveTimer=0;save();
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)v072FlushScheduledSave()},{passive:true});
window.addEventListener('pagehide',v072FlushScheduledSave,{passive:true});

// ---------- CHEAPER STATS ----------
function v072Text(sel,value){const el=$(sel);if(el&&el.textContent!==String(value))el.textContent=String(value)}
updateStats=function(){
 const setId=state.activeSet,cfg=SETS[setId],seen=new Set();let inv=0,active=0;
 for(const x of state.instances||[]){
  if(x.setId!==setId||x.isEnergy||x.status==='sold'||!x.cardId)continue;
  seen.add(x.cardId);
  if(x.status==='owned'&&x.location==='inventory')inv++;
 }
 for(const l of state.listings||[])if(l.status==='active')active++;
 v072Text('#wallet',money(state.wallet));v072Text('#uniqueStat',`${seen.size} / ${cfg.total}`);
 v072Text('#duplicateStat',inv);v072Text('#boosterStat',stockQty(boosterSku(setId)));v072Text('#listingStat',active);
};

let v072ProfileStatsAt=0,v072ProfileStatsValue=null;
v06ProfileStats=function(){
 const now=performance.now();
 if(v072ProfileStatsValue&&now-v072ProfileStatsAt<350)return v072ProfileStatsValue;
 let revenue=0,saleUnits=0,obtained=(state.instances||[]).length,value=0,active=0;const unique=new Set();
 for(const s of state.sales||[]){revenue+=Number(s.total??s.price??0);saleUnits+=Number(s.units||1)}
 for(const ins of state.instances||[]){
  if(ins.status==='sold'||ins.isEnergy||!ins.cardId)continue;
  unique.add(`${ins.setId}|${ins.cardId}`);
  const c=cardById(ins.setId,ins.cardId);if(c)value+=v05ValueForInstance(ins,c);
 }
 for(const l of state.listings||[])if(l.status==='active'&&listingRemaining(l)>0)active++;
 v072ProfileStatsAt=now;
 return v072ProfileStatsValue={sales:saleUnits,revenue,obtained,unique:unique.size,value,active};
};

// ---------- USE SMALL SCANS WHILE CONNECTED ----------
const v072CardImgBase=cardImg;
cardImg=function(c,q='high'){
 if(q==='low'&&navigator.onLine){
  try{if(typeof v05BaseCardImg==='function')return v05BaseCardImg(c,'low')}catch{}
 }
 return v072CardImgBase(c,q);
};

// ---------- LAZY / PROGRESSIVE INVENTORY ----------
let v072InventoryObserver=null;
function v072InventoryCardNode(r){
 const {arr,ins,c,value}=r,e=document.createElement('div');
 e.className='inventory-card panel';
 e.innerHTML=`<img loading="lazy" decoding="async" src="${cardImg(c,'low')}" alt="${escapeHtml(c.name)}"><div class="inventory-card-copy"><strong>${escapeHtml(c.name)}</strong><span>${escapeHtml(setName(ins.setId))} · #${c.localId} · ${ins.variant==='reverse'?'Reverse':RARITY_LABEL[rarityFor(ins.setId,cardNo(c))]||''}</span><small>${value>0?`Dernière valeur connue : ${money(value)}`:'Valeur non mémorisée'}</small><b>×${arr.length}</b></div><div class="row-actions"><button class="secondary small inspect">Voir</button><button class="primary small sell">Vendre</button></div>`;
 e.querySelector('.inspect').onclick=()=>openCardModal(c,ins);
 e.querySelector('.sell').onclick=async()=>{let base=value||v4FallbackBase(rarityFor(ins.setId,cardNo(c)));try{base=cardmarketBaseline(await getCardDetail(c),ins)||base}catch{}openSellCardGroup(c,arr,base)};
 return e;
}
function v072EnergyNode(arr){
 const x=arr[0],en=ENERGY.find(e=>e.name===x.energyType),cosmos=x.variant==='cosmos',e=document.createElement('div');
 e.className='inventory-card panel energy-row';
 e.innerHTML=`<img loading="lazy" decoding="async" src="${en?.thumb||x.imageSmall||en?.image||''}" alt="Énergie"><div class="inventory-card-copy"><strong>Énergie ${escapeHtml(x.energyType)}</strong><span>${cosmos?'Cosmos Holo':'Énergie de base'}</span><b>×${arr.length}</b></div><div class="energy-sell-actions"><button class="primary small">Vendre</button></div>`;
 e.querySelector('button').onclick=()=>v061SellEnergyGroup(arr);
 return e;
}
renderCardInventory=function(out){
 v072InventoryObserver?.disconnect();v072InventoryObserver=null;
 const groups=new Map(),energyGroups=new Map();
 for(const ins of state.instances||[]){
  if(ins.status!=='owned'||ins.location!=='inventory')continue;
  if(ins.isEnergy){
   const k=`${ins.energyType}|${ins.variant||'normal'}`;if(!energyGroups.has(k))energyGroups.set(k,[]);energyGroups.get(k).push(ins);
  }else if(ins.cardId){
   const k=`${ins.setId}|${ins.cardId}|${ins.variant}|${ins.condition}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(ins);
  }
 }
 const rows=[];
 for(const arr of groups.values()){
  const ins=arr[0],c=cardById(ins.setId,ins.cardId);
  if(c)rows.push({arr,ins,c,value:v05ValueForInstance(ins,c),qty:arr.length,no:cardNo(c),setId:ins.setId});
 }
 const setOrder=new Map(Object.keys(SETS).map((id,i)=>[id,i]));
 rows.sort((a,b)=>{switch(state.inventorySort){
  case'valueDesc':return b.value-a.value||b.no-a.no;
  case'valueAsc':return(a.value||1e12)-(b.value||1e12)||a.no-b.no;
  case'qtyDesc':return b.qty-a.qty||a.no-b.no;
  case'qtyAsc':return a.qty-b.qty||a.no-b.no;
  case'numberDesc':return(setOrder.get(a.setId)||0)-(setOrder.get(b.setId)||0)||b.no-a.no;
  default:return(setOrder.get(a.setId)||0)-(setOrder.get(b.setId)||0)||a.no-b.no;
 }});
 const energyRows=[...energyGroups.values()];
 let sellableUnits=rows.reduce((n,r)=>n+r.arr.length,0);
 for(const arr of energyRows)sellableUnits+=arr.filter(x=>!x.energyKeeper).length;
 out.innerHTML=`<div class="inventory-sort"><span>Trier</span><select id="inventorySortSelect">${['valueDesc','valueAsc','qtyDesc','qtyAsc','numberAsc','numberDesc'].map(v=>`<option value="${v}" ${state.inventorySort===v?'selected':''}>${v05SortLabel(v)}</option>`).join('')}</select>${sellableUnits?`<button id="sellAllInventoryCards" class="secondary small sell-all-cards">Tout vendre (${sellableUnits})</button>`:''}</div>${rows.length||energyRows.length?'<div class="inventory-grid"></div><div class="inventory-load-sentinel" aria-hidden="true"></div>':'<div class="empty-state panel">Aucun double pour le moment.</div>'}`;
 const sort=out.querySelector('#inventorySortSelect');if(sort)sort.onchange=e=>{state.inventorySort=e.target.value;save();renderCardInventory(out)};
 const all=rows.map(r=>()=>v072InventoryCardNode(r)).concat(energyRows.map(arr=>()=>v072EnergyNode(arr)));
 const grid=out.querySelector('.inventory-grid'),sentinel=out.querySelector('.inventory-load-sentinel');if(!grid)return;
 let cursor=0;const batch=28;
 const append=()=>{
  const frag=document.createDocumentFragment(),end=Math.min(all.length,cursor+batch);
  for(;cursor<end;cursor++)frag.appendChild(all[cursor]());
  grid.appendChild(frag);
  if(cursor>=all.length){v072InventoryObserver?.disconnect();sentinel?.remove()}
 };
 append();
 if(cursor<all.length&&sentinel&&'IntersectionObserver'in window){
  v072InventoryObserver=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting))append()},{rootMargin:'650px 0px'});
  v072InventoryObserver.observe(sentinel);
 }else if(cursor<all.length){
  const pump=()=>{if(cursor>=all.length)return;append();setTimeout(pump,16)};setTimeout(pump,16);
 }
 const sellAll=out.querySelector('#sellAllInventoryCards');if(sellAll)sellAll.onclick=v07ConfirmSellAll;
};

// ---------- DECODED BOOSTER IMAGES + ONE ACTIVE HOLO ONLY ----------
let v072PreloadedFor=null;
const v072DecodedImages=new Map();
preloadOne=function(url){
 if(!url)return Promise.resolve();
 const cached=v072DecodedImages.get(url);if(cached?.complete&&cached.naturalWidth>0)return Promise.resolve();
 return new Promise(resolve=>{
  const im=new Image();im.decoding='sync';im.loading='eager';try{im.fetchPriority='high'}catch{}
  let done=false;const finish=()=>{if(done)return;done=true;v072DecodedImages.set(url,im);try{imageCache.set(url,'done')}catch{}resolve()};
  im.onload=finish;im.onerror=finish;im.src=url;
  if(im.decode)im.decode().then(finish).catch(()=>{});
 });
};
preloadPack=function(cards){
 if(v072PreloadedFor!==cards){v072PreloadedFor=cards;v072DecodedImages.clear()}
 return Promise.allSettled(cards.map(c=>preloadOne(imageUrlForOpening(c))));
};

function v072ActivateHolo(el){
 if(!el||el.dataset.holoReady==='1'||!el.dataset.holoType)return;
 el.dataset.holoReady='1';
 v05AddHoloLayers(el,el.dataset.holoType);
 el.classList.remove('v05-holo');el.classList.add('v072-holo');
}
makeCardElement=function(c,depth){
 const el=document.createElement('div');el.className='reveal-card stable-card';el.dataset.depth=String(depth);el.style.zIndex=String(30-depth);
 const url=imageUrlForOpening(c),cached=v072DecodedImages.get(url),im=cached?cached.cloneNode(false):new Image();
 im.src=url;im.alt=c.name;im.draggable=false;im.decoding='sync';im.loading='eager';try{im.fetchPriority='high'}catch{};el.appendChild(im);
 const type=v05HoloType(c);if(type)el.dataset.holoType=type;if(depth===0)v072ActivateHolo(el);
 if(c.kind==='energy'&&c.foil){const badge=document.createElement('span');badge.className='cosmos-badge';badge.textContent='COSMOS HOLO';el.appendChild(badge)}
 return el;
};
promoteStack=function(){
 const stack=$('#cardStack'),children=[...stack.querySelectorAll('.stable-card')];
 for(const el of children){
  const d=Number(el.dataset.depth);if(d<=0)continue;
  const nd=d-1;el.dataset.depth=String(nd);el.style.zIndex=String(30-nd);el.style.transition='transform .22s ease, filter .22s ease';
  if(nd===0)v072ActivateHolo(el);
 }
 appendDepthCard(2);setupTopSwipe();
};

let v072SwipeRaf=0;
setupTopSwipe=function(){
 const top=$('#cardStack .stable-card[data-depth="0"]');if(!top)return;
 let sx=0,dx=0,drag=false,rect=null,lastX=0,lastY=0;
 const paint=()=>{
  v072SwipeRaf=0;if(!drag)return;
  const px=rect?clamp((lastX-rect.left)/rect.width*100,0,100):50,py=rect?clamp((lastY-rect.top)/rect.height*100,0,100):50;
  top.style.setProperty('--hx',`${px}%`);top.style.setProperty('--hy',`${py}%`);top.style.setProperty('--hrot',`${dx*.04}deg`);
  top.style.transition='none';top.style.transform=`translate3d(${dx}px,0,0) rotate(${dx*.035}deg)`;
 };
 top.onpointerdown=e=>{drag=true;sx=e.clientX;dx=0;lastX=e.clientX;lastY=e.clientY;rect=top.getBoundingClientRect();top.setPointerCapture?.(e.pointerId)};
 top.onpointermove=e=>{if(!drag)return;dx=e.clientX-sx;lastX=e.clientX;lastY=e.clientY;if(!v072SwipeRaf)v072SwipeRaf=requestAnimationFrame(paint)};
 const end=(cancel=false)=>{if(!drag)return;drag=false;if(v072SwipeRaf){cancelAnimationFrame(v072SwipeRaf);v072SwipeRaf=0}completeSwipe(top,cancel?0:dx,true)};
 top.onpointerup=()=>end(false);top.onpointercancel=()=>end(true);
};

let v072OrientationRaf=0,v072Orientation=null;
window.addEventListener('deviceorientation',e=>{
 if(e.gamma==null||!$('#opening')?.classList.contains('active')||$('#revealStage')?.classList.contains('hidden'))return;
 v072Orientation={gamma:e.gamma,beta:e.beta};
 if(v072OrientationRaf)return;
 v072OrientationRaf=requestAnimationFrame(()=>{
  v072OrientationRaf=0;const top=$('#cardStack .stable-card[data-depth="0"].v072-holo'),o=v072Orientation;if(!top||!o)return;
  top.style.setProperty('--hx',`${clamp(50+o.gamma*1.1,5,95)}%`);
  top.style.setProperty('--hy',`${clamp(50+(o.beta-45)*.65,5,95)}%`);
 });
},{passive:true});

// Energy V0.6.2 used to save once here and again in completeSwipe.
addEnergyInstance=function(c){
 state.instances.push({id:uid('ENERGY'),setId:c.setId,cardId:c.id,energyType:c.energyType,variant:c.foil?'cosmos':'normal',condition:'MT',openedAt:Date.now(),status:'owned',location:'inventory',isEnergy:true,imageLarge:c.imageLarge,imageSmall:c.imageSmall});
 vibrate(6);reconcileBinder(c.setId);
};

completeSwipe=function(top,dx,wasDragging){
 if(!wasDragging)return;
 if(Math.abs(dx)<=70){top.style.transition='transform .18s ease';top.style.transform='';return}
 const o=state.currentOpening;if(!o)return;
 top.style.pointerEvents='none';top.style.transition='transform .26s cubic-bezier(.2,.8,.2,1),opacity .24s';
 top.style.transform=`translate3d(${dx<0?'-145%':'145%'},0,0) rotate(${dx<0?-13:13}deg)`;top.style.opacity='.98';
 const c=o.cards[o.reveal];if(c.kind==='card')addCardInstance(c);else addEnergyInstance(c);o.reveal++;
 v072ProfileStatsValue=null;v072ScheduleSave(650);
 setTimeout(()=>{top.remove();if(o.reveal>=o.cards.length)finishPack();else{$('#revealIndex').textContent=o.reveal+1;promoteStack()}},270);
};

const v072FinishPackBase=finishPack;
finishPack=function(){
 if(v072SaveTimer){clearTimeout(v072SaveTimer);v072SaveTimer=0}
 v072ProfileStatsValue=null;
 return v072FinishPackBase();
};

// Load performance CSS last.
if(!document.querySelector('link[data-v072-perf]')){
 const l=document.createElement('link');l.rel='stylesheet';l.href='v072perf.css';l.dataset.v072Perf='1';document.head.appendChild(l);
}

setTimeout(()=>{try{updateStats();if(state.inventoryTab==='cards'&&$('#inventory')?.classList.contains('active'))renderInventory()}catch(e){console.warn('V0.7.2 perf refresh',e)}},0);
