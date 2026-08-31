'use strict';

/* VOX Card Sim V0.8.0 — game modes, progression, rotating shop and sane NPC demand. */
const V08_MODE_META='voxCardSimV08_activeMode';
const V08_SLOT_PREFIX='voxCardSimV08_slot_';
const V08_MODES={
 realistic:{label:'Réaliste',desc:'Économie stricte, marketplace joueurs + NPC, aucune récompense artificielle.'},
 ludic:{label:'Ludique',desc:'Économie séparée, récompenses de progression et Boosters Chance. Marché NPC uniquement.'},
 creative:{label:'Créatif',desc:'Argent illimité, tous les produits disponibles, aucun marketplace.'}
};
const V08_HOUR=3600000,V08_DAY=86400000;
function v08Mode(){return V08_MODES[state.gameMode]?state.gameMode:'realistic'}
function v08SlotKey(mode){return V08_SLOT_PREFIX+(V08_MODES[mode]?mode:'realistic')}
function v08Hash32(x){x=(Number(x)||0)|0;x=Math.imul(x^(x>>>16),0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return(x^(x>>>16))>>>0}
function v08SeededShuffle(arr,seed){const a=[...arr];let s=v08Hash32(seed);for(let i=a.length-1;i>0;i--){s=v08Hash32(s+i*2654435761);const j=s%(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
function v08HourInfo(now=Date.now()){const ids=Object.keys(SETS),day=Math.floor(now/V08_DAY),hourIndex=Math.floor(now/V08_HOUR),hour=hourIndex%24,cycle=Math.floor(hour/Math.max(1,ids.length)),order=v08SeededShuffle(ids,day*101+cycle*7919);return{setId:order[hour%ids.length]||ids[0],next:(hourIndex+1)*V08_HOUR,day,hour}}
function v08ActiveShopSet(){return v08HourInfo().setId}
function v08Countdown(ts){const m=Math.max(0,Math.ceil((ts-Date.now())/60000));return m>=60?`${Math.floor(m/60)} h ${m%60} min`:`${m} min`}

/* ---------- MODE MIGRATION / SEPARATE LOCAL SAVES ---------- */
const v08MetaBefore=localStorage.getItem(V08_MODE_META);
let v08InitialMode=v08MetaBefore||state.gameMode||'realistic';if(!V08_MODES[v08InitialMode])v08InitialMode='realistic';
if(!v08MetaBefore){
 const old=localStorage.getItem(V06_STORAGE);
 if(old&&!localStorage.getItem(v08SlotKey('realistic')))localStorage.setItem(v08SlotKey('realistic'),old);
 localStorage.setItem(V08_MODE_META,'realistic');v08InitialMode='realistic';
}
state.gameMode=V08_MODES[state.gameMode]?state.gameMode:v08InitialMode;
state.discoveredCards=state.discoveredCards&&typeof state.discoveredCards==='object'?state.discoveredCards:{};
if(!Object.keys(state.discoveredCards).length)for(const x of state.instances||[])if(!x.isEnergy&&x.setId&&x.cardId)state.discoveredCards[`${x.setId}|${x.cardId}`]=Number(x.acquiredAt||x.openedAt||Date.now());
state.ludicRewards=state.ludicRewards&&typeof state.ludicRewards==='object'?state.ludicRewards:{twentyMilestone:0,completedSets:{},boosterCount:0,totalBonus:0};
state.ludicRewards.completedSets=state.ludicRewards.completedSets||{};
state.luckyPacks=Math.max(0,Number(state.luckyPacks)||0);
state.dailyDropBought=state.dailyDropBought&&typeof state.dailyDropBought==='object'?state.dailyDropBought:{};
state.eventCatalog=state.eventCatalog&&typeof state.eventCatalog==='object'?state.eventCatalog:{};
state.friends=Array.isArray(state.friends)?state.friends:[];state.friendRequestsOut=Array.isArray(state.friendRequestsOut)?state.friendRequestsOut:[];state.friendDeclined=Array.isArray(state.friendDeclined)?state.friendDeclined:[];
state.marketCategory=state.marketCategory||'all';state.marketRarity=state.marketRarity||'all';state.marketSort=state.marketSort||'relevance';state.marketMinPrice=state.marketMinPrice??'';state.marketMaxPrice=state.marketMaxPrice??'';state.marketPage=Math.max(1,Number(state.marketPage)||1);

function v08Serializable(){
 const d=v06Serializable();d.version=8;d.schemaVersion=8;d.gameMode=v08Mode();
 d.onlineProcessedSellerTrades=Array.isArray(state.onlineProcessedSellerTrades)?state.onlineProcessedSellerTrades.slice(-400):[];d.onlineProcessedBuyerTrades=Array.isArray(state.onlineProcessedBuyerTrades)?state.onlineProcessedBuyerTrades.slice(-400):[];d.onlineCloudEnabled=state.onlineCloudEnabled!==false;
 for(const k of ['discoveredCards','ludicRewards','luckyPacks','dailyDropBought','eventCatalog','friends','friendRequestsOut','friendDeclined','marketCategory','marketRarity','marketSort','marketMinPrice','marketMaxPrice','marketPage'])d[k]=state[k];
 d.lastSavedAt=Date.now();return d;
}
const v08SaveFallback=save;
save=function(){
 try{
  const d=v08Serializable(),json=JSON.stringify(d),mode=v08Mode();
  localStorage.setItem(V06_STORAGE,json);localStorage.setItem(V06_BACKUP,json);localStorage.setItem(v08SlotKey(mode),json);localStorage.setItem(V08_MODE_META,mode);
  if(mode==='realistic'){
   try{window.VOXOnline?.setCloudWritesEnabled?.(state.onlineCloudEnabled!==false)}catch{}
   try{window.VOXNative?.mirrorSave?.(json)}catch{}
  }else try{window.VOXOnline?.setCloudWritesEnabled?.(false)}catch{}
  try{clearTimeout(v07ProfileTimer);v07ProfileTimer=setTimeout(v07PublishPublicProfile,30000)}catch{}
 }catch(e){console.warn('V0.8 save fallback',e);v08SaveFallback()}
};
function v08FreshSave(mode){
 const d=typeof v07FreshSave==='function'?v07FreshSave():{version:8,schemaVersion:8,playerId:state.playerId||uid('PLAYER'),activeSet:'sv03.5',wallet:250,instances:[],stock:{},listings:[],sales:[],purchases:[],packsOpened:{},settings:{cardTrickEnabled:false,cardTrickCount:0},currentOpening:null,inventoryTab:'cards',inventorySort:'numberAsc',pageBySet:{'sv03.5':0,'sv03':0,'sv02':0,'s6a':0},lastMarketTick:Date.now(),marketShift:{},priceCache:{},lastKnownEstimates:{},marketBooks:{},marketSellers:[],marketTab:'buy',marketQuery:'',marketSetFilter:'all',binderOwned:{},stockLots:{},priceHistory:{},publicCards:[],jpPackPlans:{}};
 d.version=8;d.schemaVersion=8;d.gameMode=mode;d.wallet=mode==='creative'?0:250;d.discoveredCards={};d.ludicRewards={twentyMilestone:0,completedSets:{},boosterCount:0,totalBonus:0};d.luckyPacks=0;d.dailyDropBought={};d.eventCatalog={};d.friends=[...(state.friends||[])];d.friendRequestsOut=[...(state.friendRequestsOut||[])];d.friendDeclined=[...(state.friendDeclined||[])];d.marketCategory='all';d.marketRarity='all';d.marketSort='relevance';d.marketMinPrice='';d.marketMaxPrice='';d.marketPage=1;
 if(state.sellerProfile&&!state.sellerProfile.legacyAuto)d.sellerProfile={...state.sellerProfile};return d;
}
function v08SwitchMode(mode){
 if(!V08_MODES[mode]||mode===v08Mode())return;save();let json=localStorage.getItem(v08SlotKey(mode));if(!json)json=JSON.stringify(v08FreshSave(mode));
 try{const d=JSON.parse(json);d.gameMode=mode;d.version=8;d.schemaVersion=8;json=JSON.stringify(d)}catch{json=JSON.stringify(v08FreshSave(mode))}
 localStorage.setItem(V08_MODE_META,mode);localStorage.setItem(V06_STORAGE,json);localStorage.setItem(V06_BACKUP,json);localStorage.setItem(v08SlotKey(mode),json);toast(`Mode ${V08_MODES[mode].label}…`);setTimeout(()=>location.reload(),420);
}

/* ---------- FIRST ACQUISITION / NEW BADGE / LUDIC REWARDS ---------- */
function v08DiscoveryCount(){return Object.keys(state.discoveredCards||{}).length}
function v08SetDiscoveryCount(setId){let n=0;for(const k of Object.keys(state.discoveredCards||{}))if(k.startsWith(setId+'|'))n++;return n}
function v08RewardCheck(setId){
 if(v08Mode()!=='ludic')return;
 const total=v08DiscoveryCount(),milestone=Math.floor(total/20);
 if(milestone>(state.ludicRewards.twentyMilestone||0)){
  const diff=milestone-(state.ludicRewards.twentyMilestone||0),gain=diff*100;state.wallet+=gain;state.ludicRewards.totalBonus=(state.ludicRewards.totalBonus||0)+gain;state.ludicRewards.twentyMilestone=milestone;setTimeout(()=>toast(`Progression : +${money(gain)} · ${milestone*20} cartes découvertes`),320);
 }
 const cfg=SETS[setId];if(cfg&&v08SetDiscoveryCount(setId)>=cfg.total&&!state.ludicRewards.completedSets[setId]){state.ludicRewards.completedSets[setId]=Date.now();state.wallet+=1000;state.ludicRewards.totalBonus=(state.ludicRewards.totalBonus||0)+1000;setTimeout(()=>toast(`Collection ${setName(setId)} complète : +1 000 €`),650)}
}
function v08Discover(setId,cardId,cardObj=null){const key=`${setId}|${cardId}`;if(state.discoveredCards[key])return false;state.discoveredCards[key]=Date.now();if(cardObj)cardObj.v08New=true;v08RewardCheck(setId);return true}
const v08AddCardBase=addCardInstance;
addCardInstance=function(c){v08Discover(c.setId,c.id,c);return v08AddCardBase(c)};
const v08ReceiveCardBase=v4ReceiveCard;
v4ReceiveCard=function(asset,condition,qty,unitPrice=null,sellerName=''){v08Discover(asset.setId,asset.cardId,null);return v08ReceiveCardBase(asset,condition,qty,unitPrice,sellerName)};
const v08PackSummaryBase=renderPackSummary;
renderPackSummary=function(){
 const o=state.currentOpening;if(!o)return v08PackSummaryBase();const sum=$('#summaryCards');if(!sum)return v08PackSummaryBase();sum.innerHTML='';
 for(const c of o.cards){const wrap=document.createElement('div');wrap.className='v08-summary-card';const im=new Image();im.loading='lazy';im.decoding='async';im.src=c.kind==='energy'?c.imageSmall:cardImg(c,'low');im.alt=c.name;wrap.appendChild(im);if(c.v08New){const star=document.createElement('span');star.className='v08-new-star';star.textContent='NEW';wrap.appendChild(star)}sum.appendChild(wrap)}
 $('#openAnotherPack').classList.toggle('hidden',stockQty(boosterSku(o.setId))<=0);$('#packSummary').classList.remove('hidden');
};

function v08LuckyPool(setId){
 const jp=!!SETS[setId]?.japanese,keys=jp?['jp_rare','jp_rr','jp_rrr','jp_sr','jp_hr','jp_ur']:['rare','double','ir','ur','sir','hr'],out=[];for(const k of keys)out.push(...pool(setId,k));return out;
}
function v08OpenLuckyPack(setId=state.activeSet){
 if(v08Mode()!=='ludic'||state.luckyPacks<=0)return;const a=v08LuckyPool(setId);if(!a.length)return toast('Pool Rare+ indisponible');const c=pick(a),card=wrapCard(c,setId,'Booster Chance','holo');state.luckyPacks--;state.currentOpening={id:uid('LUCKY'),setId,cards:[card],reveal:0,phase:'sealed',startedAt:Date.now(),counted:true,isLucky:true};save();preloadPromise=preloadPack([card]);nav('opening');
}
const v08OpeningPackImageBase=openingPackImage;
openingPackImage=function(setId){if(state.currentOpening?.isLucky)return v08OpeningPackImageBase(setId);return v08OpeningPackImageBase(setId)};
const v08FinishPackBase=finishPack;
finishPack=function(){
 const o=state.currentOpening,eligible=v08Mode()==='ludic'&&o&&!o.counted&&!o.isLucky;v08FinishPackBase();
 if(eligible){state.ludicRewards.boosterCount=(state.ludicRewards.boosterCount||0)+1;if(state.ludicRewards.boosterCount%10===0){state.luckyPacks++;toast('Booster Chance gagné · 1 carte Rare ou mieux')}save();renderInventory()}
};
const v08RenderBoosterInventoryBase=renderBoosterInventory;
renderBoosterInventory=function(out){v08RenderBoosterInventoryBase(out);if(v08Mode()==='ludic'&&state.luckyPacks>0){const e=document.createElement('div');e.className='sealed-row panel stock-row v08-lucky-row';e.innerHTML=`<div class="v08-lucky-pack">★</div><div class="stock-copy"><strong>Booster Chance</strong><span>Récompense ludique · 1 carte Rare ou mieux</span><b>×${state.luckyPacks}</b></div><div class="row-actions"><button class="primary">Ouvrir</button></div>`;e.querySelector('button').onclick=()=>v08OpenLuckyPack(state.activeSet);out.prepend(e)}};

/* ---------- ROTATING RETAIL SHOP + DAILY LIMITED DROP ---------- */
const v08ProductByIdBase=productById;
productById=function(id){return state.eventCatalog?.[id]||v08ProductByIdBase(id)};
function v08DailyEvent(now=Date.now()){
 const day=Math.floor(now/V08_DAY),id=`event-${day}`,start=day*V08_DAY,end=start+V08_DAY;
 if(state.eventCatalog[id])return state.eventCatalog[id];const ids=Object.keys(SETS),sid=ids[v08Hash32(day*31337)%ids.length],cfg=SETS[sid],base=cfg.products.find(p=>p.mode==='loose'&&p.qty===1)||cfg.products[0];
 const p={id,setId:sid,name:`Édition limitée du jour — ${cfg.name}`,subtitle:'Drop exclusif 24 h · 6 boosters · limite 1',kind:'ÉDITION LIMITÉE',price:Number((Math.max(29.99,(base.price||5.99)*6.6)).toFixed(2)),mode:'sealed',opens:6,image:base.image,eventEdition:true,eventStart:start,eventEnd:end,eventDay:day};state.eventCatalog[id]=p;return p;
}
function v08CanSellEvent(p){return!p?.eventEdition||Date.now()>=Number(p.eventEnd||0)}
const v08OpenSellStockBase=openSellStock;
openSellStock=function(x){const p=x.productId?productById(x.productId):productForSku(x.sku);if(p?.eventEdition&&!v08CanSellEvent(p))return toast(`Édition verrouillée · revente dans ${v08Countdown(p.eventEnd)}`);return v08OpenSellStockBase(x)};

function v08ProductCard(p,cfg,owned=false,creative=false){
 const detail=p.mode==='loose'?`${p.qty} booster${p.qty>1?'s':''}`:p.mode==='binderUnlock'?(owned?'Classeur possédé':'Débloque le classeur'):(p.opens?`Scellé · ${p.opens} boosters`:'Produit scellé');const visual=p.image?`<img class="product-photo" src="${p.image}" alt="${escapeHtml(p.name)}">`:'<div class="binder-product-icon">▤</div>';
 return`<article class="product panel real-product ${p.eventEdition?'v08-event-product':''}" data-product="${p.id}"><div class="product-photo-wrap">${visual}${p.eventEdition?'<span class="v08-event-ribbon">24 H</span>':''}</div><div class="product-copy"><span class="tag">${escapeHtml(p.kind)}</span><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(detail)}</p><strong>${creative?'LIBRE':money(p.price)}</strong><button class="${owned?'secondary':'primary'}" ${owned?'disabled':''}>${owned?'Possédé':creative?'Ajouter':'Acheter'}</button></div></article>`
}
const v08RenderProductsBase=renderProducts;
renderProducts=function(){
 const mode=v08Mode(),grid=$('#productGrid'),shop=$('#shop');if(!grid)return;
 shop?.querySelector('.v08-shop-banner')?.remove();
 if(mode==='creative'){shop?.querySelector('.set-switch')?.classList.remove('hidden');v08RenderProductsBase();for(const b of grid.querySelectorAll('button:not([disabled])'))b.textContent='Ajouter';return}
 const info=v08HourInfo(),cfg=SETS[info.setId],event=v08DailyEvent(),bought=!!state.dailyDropBought[event.id];shop?.querySelector('.set-switch')?.classList.add('hidden');const title=shop?.querySelector('.section-title');if(title){const banner=document.createElement('div');banner.className='v08-shop-banner panel';banner.innerHTML=`<div><span>COLLECTION DE L’HEURE</span><strong>${escapeHtml(cfg.name)}</strong></div><div><small>Rotation dans</small><b id="v08RotationLeft">${v08Countdown(info.next)}</b></div>`;title.after(banner)}
 const items=[...cfg.products,event];grid.innerHTML=items.map(p=>v08ProductCard(p,cfg,p.mode==='binderUnlock'&&state.binderOwned[cfg.id],false)).join('');for(const e of grid.querySelectorAll('[data-product]')){const p=productById(e.dataset.product),btn=e.querySelector('button');if(p?.eventEdition&&bought){btn.disabled=true;btn.textContent='Déjà obtenu'}else btn.onclick=()=>buyProduct(p.setId,p.id)}
};
const v08BuyProductBase=buyProduct;
buyProduct=function(setId,productId){
 const mode=v08Mode(),p=productById(productId);if(!p)return;
 if(mode==='creative'){
  if(p.mode==='binderUnlock'){state.binderOwned[p.setId]=true;reconcileBinder(p.setId)}else if(p.mode==='loose')v06AddLot(boosterSku(p.setId),p.qty,0,'creative');else v06AddLot(sealedSku(p.id),1,0,'creative');save();renderProducts();renderInventory();renderBinder();updateStats();return toast(`${p.name} ajouté`)
 }
 if(p.eventEdition){if(Date.now()>=p.eventEnd)return toast('Ce drop est terminé');if(state.dailyDropBought[p.id])return toast('Limite de 1 exemplaire atteinte');if(state.wallet<p.price)return toast('Solde insuffisant');state.wallet-=p.price;state.dailyDropBought[p.id]=Date.now();v06AddLot(sealedSku(p.id),1,p.price,'drop_limite');save();renderProducts();renderInventory();updateStats();return toast('Édition limitée ajoutée à l’inventaire')}
 if(setId!==v08ActiveShopSet())return toast('Cette collection n’est pas disponible pendant cette rotation');return v08BuyProductBase(setId,productId)
};
setInterval(()=>{if($('#shop')?.classList.contains('active')){const e=$('#v08RotationLeft');if(e)e.textContent=v08Countdown(v08HourInfo().next);const info=v08HourInfo();if(Number($('#shop')?.dataset.v08Hour||-1)!==info.hour){$('#shop').dataset.v08Hour=String(info.hour);renderProducts()}}},30000);

/* ---------- CREATIVE MODE ---------- */
const v08UpdateStatsBase=updateStats;
updateStats=function(){v08UpdateStatsBase();if(v08Mode()==='creative'){const w=$('#wallet');if(w)w.textContent='∞';const label=w?.previousElementSibling;if(label)label.textContent='Créatif'}};
const v08MarketNav=$('#marketNav');
if(v08MarketNav)v08MarketNav.addEventListener('click',e=>{if(v08Mode()==='creative'){e.stopImmediatePropagation();state.marketTab='players';renderMarket();$('#marketModal').classList.remove('hidden')}},true);

/* ---------- REALISTIC NPC DEMAND + BATCHED SALE UPDATES ---------- */
function v08RetailAvailableForListing(l){if(l.type==='card')return false;const p=l.type==='booster'?SETS[l.setId]?.products?.find(x=>x.mode==='loose'&&x.qty===1):productById(l.productId||String(l.sku||'').replace('SEALED:',''));if(p?.eventEdition)return Date.now()<p.eventEnd;return l.setId===v08ActiveShopSet()}
function v08DemandCapRatio(l,book){
 if(l.type==='card')return({common:1.12,uncommon:1.15,rare:1.22,double:1.32,ir:1.48,ur:1.58,sir:1.9,hr:2.0,jp_sr:1.8,jp_hr:2.1,jp_ur:1.8}[l.rarity]||1.35);
 const p=l.type==='booster'?null:productById(l.productId||String(l.sku||'').replace('SEALED:',''));if(p?.eventEdition)return Date.now()<p.eventEnd?1.02:2.6;return v08RetailAvailableForListing(l)?1.18:1.75;
}
function v08NpcDemand(book,steps){
 const a=book.asset,rarity=a.rarity||'rare',baseDemand=a.type==='card'?({common:.018,uncommon:.021,rare:.028,double:.036,ir:.045,ur:.05,sir:.058,hr:.055,jp_sr:.055,jp_hr:.06,jp_ur:.055}[rarity]||.03):.034;
 for(let s=0;s<steps;s++){const offers=book.offers.filter(o=>o.quantity>0).sort((x,y)=>(x.price/v4ConditionMultiplier(x.condition))-(y.price/v4ConditionMultiplier(y.condition)));for(let i=0;i<Math.min(4,offers.length);i++){const o=offers[i],ratio=o.price/Math.max(.02,book.base*v4ConditionMultiplier(o.condition)),p=baseDemand*Math.exp(-i*.6)*Math.exp(-Math.max(0,ratio-1)*3);if(Math.random()<p)o.quantity=Math.max(0,o.quantity-1)}}
 const target=a.eventEdition?3:v4RaritySupply(rarity,a.type),alive=book.offers.filter(o=>o.quantity>0).length,age=Date.now()-(book.lastSupplyAt||0),interval=a.eventEdition?4*V08_HOUR:(a.type==='card'&&['sir','hr','jp_hr'].includes(rarity)?55*60000:24*60000);if(alive<Math.max(1,target*.3)&&age>interval)v4GenerateNpcOffers(book,Math.max(1,Math.floor(target*.25)));
}
v4NpcDemand=v08NpcDemand;
let v08SaleBatch={units:0,revenue:0,dirty:new Set()},v08SaleSaveTimer=0,v08RemoteTimer=0;
function v08ScheduleSaleCommit(l){
 if(l)v08SaleBatch.dirty.add(l.id);clearTimeout(v08SaleSaveTimer);v08SaleSaveTimer=setTimeout(()=>{v08SaleSaveTimer=0;save();if($('#inventory')?.classList.contains('active'))renderInventory();if($('#binder')?.classList.contains('active'))renderBinder();updateStats();if($('#home')?.classList.contains('active'))renderSaleFeed();if(v08SaleBatch.units)toast(`${v08SaleBatch.units} vente(s) · +${money(v08SaleBatch.revenue)}`);v08SaleBatch.units=0;v08SaleBatch.revenue=0},500);
 if(v08Mode()==='realistic'&&l?.remoteId){clearTimeout(v08RemoteTimer);v08RemoteTimer=setTimeout(()=>{v08RemoteTimer=0;for(const id of v08SaleBatch.dirty){const x=state.listings.find(y=>y.id===id);if(x?.remoteId)try{VOXOnline?.updateOwnListing?.(x.remoteId,listingRemaining(x),x.status)}catch{}}v08SaleBatch.dirty.clear();try{v07PublishPublicProfile()}catch{}},2200)}
}
function v08CompleteOrder(l,units){
 const remain=listingRemaining(l);units=clamp(units,1,remain);if(!units)return 0;let actual=units;
 if(l.type==='card'){const ids=l.remainingIds.splice(0,units);actual=ids.length;for(const id of ids){const ins=state.instances.find(x=>x.id===id);if(ins)ins.status='sold'}const shift=state.marketShift[l.cardId]||1,saleRatio=l.ask/Math.max(.02,l.marketBase);state.marketShift[l.cardId]=clamp(shift*.92+Math.min(saleRatio,2.2)*.08,.65,2.1)}else l.remaining=Math.max(0,l.remaining-units);
 const total=l.ask*actual;state.wallet+=total;state.sales.push({id:uid('ORDER'),at:Date.now(),label:l.label,units:actual,unitPrice:l.ask,total});if(state.sellerProfile)state.sellerProfile.completedSales=(state.sellerProfile.completedSales||0)+actual;if(listingRemaining(l)<=0){l.status='sold';l.soldAt=Date.now()}reconcileBinder(l.setId);v08SaleBatch.units+=actual;v08SaleBatch.revenue+=total;v08ScheduleSaleCommit(l);return actual;
}
completeOrder=v08CompleteOrder;
v4UserListingDemand=function(l,steps){
 if(l.status!=='active'||listingRemaining(l)<=0)return;const book=v4BookForListing(l);if(!book)return;const cap=Math.max(.02,book.base*v08DemandCapRatio(l,book)*v4ConditionMultiplier(l.condition));if(l.ask>cap)return;
 for(let k=0;k<steps&&l.status==='active';k++){const rivals=v4BookOffers(book).filter(o=>!o.mine&&o.quantity>0),ourEff=l.ask/v4ConditionMultiplier(l.condition),better=rivals.filter(o=>(o.price/v4ConditionMultiplier(o.condition))<ourEff).length,ratio=l.ask/Math.max(.02,book.base);let p=demandRate(l.rarity)*Math.exp(-better*.55)*Math.exp(-Math.max(0,ratio-1)*4.8);if(ratio<=1)p*=1.12;if(!rivals.length)p*=1.16;if(!v08RetailAvailableForListing(l)&&l.type!=='card')p*=1.18;if(Math.random()<p){v08CompleteOrder(l,desiredGroupSize(l));if(listingRemaining(l)<=0)break}}
};
processMarket=function(initial=false){const now=Date.now(),elapsed=Math.min(now-state.lastMarketTick,6*V08_HOUR),steps=Math.max(initial?1:0,Math.floor(elapsed/15000));if(steps<=0)return;for(const book of Object.values(state.marketBooks||{}))v08NpcDemand(book,steps);for(const l of state.listings.filter(x=>x.status==='active'))v4UserListingDemand(l,steps);state.lastMarketTick=now;v08ScheduleSaleCommit(null)};

/* Human marketplace only exists in Realistic mode. */
const v08PublishListingBase=v07PublishListing;
v07PublishListing=function(l){if(v08Mode()!=='realistic')return;return v08PublishListingBase(l)};
const v08SyncListingsBase=v07SyncListings;
v07SyncListings=function(){if(v08Mode()!=='realistic')return;return v08SyncListingsBase()};
const v08BookOffersOnlineBase=v4BookOffers;
v4BookOffers=function(book){if(v08Mode()==='realistic')return v08BookOffersOnlineBase(book);return v07BookOffersBase(book)};
const v08OpenBookOnlineBase=v4OpenBook;
v4OpenBook=function(book){if(v08Mode()==='realistic')return v08OpenBookOnlineBase(book);if(!book)return;book.lastTouched=Date.now();save();v07RenderBook(book)};

/* ---------- SETTINGS: MODE SWITCHER + RESET CURRENT MODE ---------- */
function v08InjectModeSettings(){
 const card=$('#settingsModal .modal-card');if(!card||$('#v08ModeSettings'))return;const sec=document.createElement('div');sec.id='v08ModeSettings';sec.className='v08-mode-settings panel';sec.innerHTML=`<span class="tag">MODE DE JEU</span><h3>${V08_MODES[v08Mode()].label}</h3><p>Chaque mode possède sa propre progression. Le marché des vrais joueurs est réservé au mode Réaliste.</p><div class="v08-mode-grid">${Object.entries(V08_MODES).map(([id,m])=>`<button data-v08-mode="${id}" class="${id===v08Mode()?'active':''}"><strong>${m.label}</strong><span>${m.desc}</span></button>`).join('')}</div>`;card.appendChild(sec);sec.querySelectorAll('[data-v08-mode]').forEach(b=>b.onclick=()=>v08SwitchMode(b.dataset.v08Mode));
}
const v08RenderSettingsBase=renderSettings;
renderSettings=function(){v08RenderSettingsBase();v08InjectModeSettings()};
v06ResetConfirm=function(){const mode=v08Mode(),m=$('#sellModal');m.classList.remove('hidden');$('#sellContent').innerHTML=`<span class="tag danger-tag">DANGER</span><h2>Réinitialiser le mode ${V08_MODES[mode].label} ?</h2><p>Seule cette progression sera effacée. Les deux autres modes restent intacts.</p><label class="profile-field">Tape RESET pour confirmer<input id="resetWord" autocomplete="off"></label><button id="resetFinal" class="danger-button" disabled>Effacer ce mode</button>`;const inp=$('#resetWord'),btn=$('#resetFinal');inp.oninput=()=>btn.disabled=inp.value.trim().toUpperCase()!=='RESET';btn.onclick=()=>{if(inp.value.trim().toUpperCase()!=='RESET')return;const fresh=JSON.stringify(v08FreshSave(mode));localStorage.setItem(v08SlotKey(mode),fresh);localStorage.setItem(V06_STORAGE,fresh);localStorage.setItem(V06_BACKUP,fresh);if(mode==='realistic')try{VOXNative?.mirrorSave?.(fresh)}catch{}location.reload()}};

const v08Css=document.createElement('link');v08Css.rel='stylesheet';v08Css.href='v08.css';document.head.appendChild(v08Css);
setTimeout(()=>{try{renderSettings();renderProducts();updateStats();save()}catch(e){console.warn('V0.8 core init',e)}},150);
