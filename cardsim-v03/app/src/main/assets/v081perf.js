'use strict';

/* VOX Card Sim V0.8.1 — large collection / marketplace performance pass.
   Goals: no synchronous 1k+ card stalls, no per-card save/reconcile, bounded online writes. */

const V081_VERSION='0.8.1';

// ---------- SAVE COALESCING (only when a hot path explicitly asks for it) ----------
const v081SaveBase=save;
let v081SaveTimer=0,v081DeferNextSave=false;
function v081PersistNow(){
 if(v081SaveTimer){clearTimeout(v081SaveTimer);v081SaveTimer=0}
 return v081SaveBase();
}
function v081PersistSoon(delay=320){
 clearTimeout(v081SaveTimer);
 v081SaveTimer=setTimeout(()=>{v081SaveTimer=0;v081SaveBase()},delay);
}
save=function(){
 if(v081DeferNextSave){v081DeferNextSave=false;v081PersistSoon();return}
 return v081PersistNow();
};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&v081SaveTimer)v081PersistNow()},{passive:true});
window.addEventListener('pagehide',()=>{if(v081SaveTimer)v081PersistNow()},{passive:true});

// ---------- O(1) INSTANCE / OWNERSHIP INDEXES ----------
let v081InstancesRef=null,v081InstancesLen=-1,v081ById=new Map(),v081LiveCardCount=new Map(),v081EnergyKeepers=new Set();
function v081CardKey(setId,cardId){return `${setId}|${cardId}`}
function v081EnergyKey(setId,type,variant){return `${setId}|${type}|${variant||'normal'}`}
function v081RebuildInstanceIndexes(){
 v081ById=new Map();v081LiveCardCount=new Map();v081EnergyKeepers=new Set();
 for(const ins of state.instances||[]){
  if(ins?.id)v081ById.set(ins.id,ins);
  if(ins?.status!=='sold'&&!ins?.isEnergy&&ins?.setId&&ins?.cardId){const k=v081CardKey(ins.setId,ins.cardId);v081LiveCardCount.set(k,(v081LiveCardCount.get(k)||0)+1)}
  if(ins?.status==='owned'&&ins?.isEnergy&&ins?.energyKeeper)v081EnergyKeepers.add(v081EnergyKey(ins.setId,ins.energyType,ins.variant));
 }
 v081InstancesRef=state.instances;v081InstancesLen=state.instances?.length||0;
}
function v081EnsureInstanceIndexes(){if(v081InstancesRef!==state.instances||v081InstancesLen!==(state.instances?.length||0))v081RebuildInstanceIndexes()}
function v081RegisterInstance(ins){
 v081ById.set(ins.id,ins);v081InstancesRef=state.instances;v081InstancesLen=state.instances.length;
 if(!ins.isEnergy&&ins.setId&&ins.cardId&&ins.status!=='sold'){const k=v081CardKey(ins.setId,ins.cardId);v081LiveCardCount.set(k,(v081LiveCardCount.get(k)||0)+1)}
 if(ins.isEnergy&&ins.energyKeeper&&ins.status==='owned')v081EnergyKeepers.add(v081EnergyKey(ins.setId,ins.energyType,ins.variant));
}
function v081MarkCardSold(ins){
 if(!ins||ins.status==='sold')return;ins.status='sold';
 if(!ins.isEnergy&&ins.setId&&ins.cardId){const k=v081CardKey(ins.setId,ins.cardId),n=Math.max(0,(v081LiveCardCount.get(k)||1)-1);if(n)v081LiveCardCount.set(k,n);else v081LiveCardCount.delete(k)}
}
v081RebuildInstanceIndexes();

// ---------- BOOSTER ACQUISITION WITHOUT FULL-SAVE HITCHES ----------
addCardInstance=function(c){
 const setId=c.setId||state.currentOpening?.setId||state.activeSet;v081EnsureInstanceIndexes();
 const first=!!state.binderOwned?.[setId]&&!v081LiveCardCount.has(v081CardKey(setId,c.id));
 if(typeof v08Discover==='function')v08Discover(setId,c.id,c);
 const now=Date.now(),ins={id:uid('CARD'),setId,cardId:c.id,variant:c.variant||'normal',condition:'MT',openedAt:now,acquiredAt:now,source:'booster',purchasePrice:null,sourcePackCost:state.currentOpening?.boosterCost??null,status:'owned',location:first?'binder':'inventory',binderSlot:first?cardNo(c)-1:null};
 state.instances.push(ins);v081RegisterInstance(ins);v081PersistSoon(520);
 const r=rarityFor(setId,cardNo(c));try{vibrate(['ir','ur','sir','hr','jp_sr','jp_hr','jp_ur'].includes(r)?[16,28,22]:8)}catch{}
 // The reveal handler calls save() immediately afterwards; make that write coalesced.
 v081DeferNextSave=true;
 return ins;
};

addEnergyInstance=function(c){
 const setId=c.setId||state.currentOpening?.setId||state.activeSet,variant=c.foil?'cosmos':(c.variant||'normal'),key=v081EnergyKey(setId,c.energyType,variant);v081EnsureInstanceIndexes();
 const keeper=!v081EnergyKeepers.has(key),slot=keeper&&state.binderOwned?.[setId]&&typeof v062EnergySlot==='function'?v062EnergySlot(setId,c.energyType,variant):null,now=Date.now();
 const ins={id:uid('ENERGY'),setId,cardId:null,energyType:c.energyType,variant,condition:'MT',openedAt:now,acquiredAt:now,source:'booster',purchasePrice:null,sourcePackCost:state.currentOpening?.boosterCost??null,status:'owned',location:slot!==null&&slot!==undefined?'binder-energy':'inventory',binderSlot:slot!==null&&slot!==undefined?slot:null,isEnergy:true,energyKeeper:keeper};
 state.instances.push(ins);v081RegisterInstance(ins);if(keeper)v081EnergyKeepers.add(key);v081PersistSoon(520);v081DeferNextSave=true;return ins;
};

// Marketplace multi-card receipts used to scan the whole collection for every copy.
v4ReceiveCard=function(asset,condition,qty,unitPrice=null,sellerName=''){
 const c=cardById(asset.setId,asset.cardId);if(!c)return;v081EnsureInstanceIndexes();if(typeof v08Discover==='function')v08Discover(asset.setId,asset.cardId,null);
 for(let i=0;i<qty;i++){
  const first=!!state.binderOwned?.[asset.setId]&&!v081LiveCardCount.has(v081CardKey(asset.setId,c.id)),variant=asset.variant==='reverse'?'reverse':v4CardVariant(null,c,asset.setId),now=Date.now();
  const ins={id:uid('CARD'),setId:asset.setId,cardId:c.id,variant,condition,acquiredAt:now,openedAt:null,source:'market',purchasePrice:unitPrice,sellerName,status:'owned',location:first?'binder':'inventory',binderSlot:first?cardNo(c)-1:null};
  state.instances.push(ins);v081RegisterInstance(ins);
 }
};

// ---------- BOUNDED ONLINE LISTING PUBLICATION ----------
const v081PublishListingNow=v07PublishListing;
let v081PublishQueue=[],v081PublishQueued=new Set(),v081PublishTimer=0;
function v081QueueRemoteListing(l){
 if(v08Mode()!=='realistic'||!l||l.type==='energy'||l.status!=='active'||listingRemaining(l)<=0||l.remoteId)return;
 if(v081PublishQueued.has(l.id))return;v081PublishQueued.add(l.id);v081PublishQueue.push(l);v081PumpRemoteListings();
}
function v081PumpRemoteListings(){
 if(v081PublishTimer||!v081PublishQueue.length)return;
 v081PublishTimer=setTimeout(()=>{
  v081PublishTimer=0;const l=v081PublishQueue.shift();if(l)v081PublishQueued.delete(l.id);
  if(l&&l.status==='active'&&!l.remoteId&&listingRemaining(l)>0){try{v081DeferNextSave=true;v081PublishListingNow(l)}catch(e){console.warn('V0.8.1 listing publish',e)}}
  if(v081PublishQueue.length)v081PumpRemoteListings();else{v081PersistSoon(450);setTimeout(()=>{try{v07PublishPublicProfile()}catch{}},500)}
 },110);
}
v07PublishListing=function(l){v081QueueRemoteListing(l)};
v07SyncListings=function(){
 if(v08Mode()!=='realistic'||!v07Auth()?.signedIn)return;
 for(const l of state.listings||[])if(l.status==='active'&&listingRemaining(l)>0)v081QueueRemoteListing(l);
 try{VOXOnline?.fetchOwnListings?.();VOXOnline?.fetchReceipts?.()}catch{}
};

// listingPublished used to serialize the entire save once per remote listing.
const v081OnlineEventBase=window.voxOnlineEvent;
window.voxOnlineEvent=function(type,payload){
 try{
  if(type==='listingPublished'){
   const l=v081FindListing(payload?.localListingId);if(l){l.remoteId=payload.remoteId;if(l.status!=='active'||listingRemaining(l)<=0)v081QueueRemoteUpdate(l);v081PersistSoon(500)}return;
  }
  if(type==='sellerTrades'&&Array.isArray(payload?.trades)){
   for(const t of payload.trades)v081ApplySellerTrade(t);return;
  }
 }catch(e){console.warn('V0.8.1 online event',type,e)}
 return v081OnlineEventBase?.(type,payload);
};

// ---------- RESPONSIVE "TOUT VENDRE" ----------
let v081BulkListBusy=false;
function v081BuildInventoryListing(arr){
 const ins=arr[0];if(!ins)return null;
 if(ins.isEnergy){
  const book=v061EnergyBook(ins),ask=Math.max(.02,book.base*v4ConditionMultiplier(ins.condition||'MT'));
  for(const x of arr){x.status='listed';x.location='listed';x.binderSlot=null}
  return{id:uid('LIST'),type:'energy',setId:ins.setId,energyType:ins.energyType,variant:ins.variant||'normal',condition:ins.condition||'MT',label:book.asset.label,rarity:book.asset.rarity,marketBase:book.base,assetKey:book.key,ask,instanceIds:arr.map(x=>x.id),remainingIds:arr.map(x=>x.id),status:'active',createdAt:Date.now(),lastTick:Date.now()};
 }
 const c=cardById(ins.setId,ins.cardId);if(!c)return null;
 const r=rarityFor(ins.setId,cardNo(c)),variant=v4VariantKey(ins.variant),base=v07ReferenceForCard(c,ins),book=v4EnsureBook({type:'card',setId:ins.setId,cardId:c.id,localId:c.localId,label:`${c.name} #${c.localId}${variant==='reverse'?' Reverse':''}`,rarity:r,variant,image:cardImg(c,'low')},base),ask=Math.max(.02,book.base*v4ConditionMultiplier(ins.condition||'MT'));
 for(const x of arr){x.status='listed';x.location='listed';x.binderSlot=null}
 return{id:uid('LIST'),type:'card',setId:ins.setId,cardId:c.id,variant,condition:ins.condition||'MT',label:book.asset.label,rarity:r,marketBase:book.base,assetKey:book.key,ask,instanceIds:arr.map(x=>x.id),remainingIds:arr.map(x=>x.id),status:'active',createdAt:Date.now(),lastTick:Date.now()};
}
v07BatchListInventory=function(){
 if(v08Mode()==='creative')return toast('Le mode Créatif n’utilise pas de marketplace');
 if(v081BulkListBusy)return toast('Une vente de masse est déjà en préparation');
 const groups=v07SellableInventoryGroups();if(!groups.length)return toast('Aucune carte vendable dans l’inventaire');
 const units=groups.reduce((n,a)=>n+a.length,0),created=[];let cursor=0;v081BulkListBusy=true;toast(`Préparation de ${units} carte(s)…`);
 const pump=()=>{
  const started=performance.now();let done=0;
  while(cursor<groups.length&&done<18&&performance.now()-started<7){const l=v081BuildInventoryListing(groups[cursor++]);if(l){state.listings.push(l);created.push(l)}done++}
  if(cursor<groups.length){setTimeout(pump,0);return}
  v081BulkListBusy=false;v081PersistNow();if($('#inventory')?.classList.contains('active'))renderInventory();updateStats();
  for(const l of created)v081QueueRemoteListing(l);setTimeout(()=>{try{v07PublishPublicProfile()}catch{}},700);
  toast(`${units} carte(s) · ${created.length} annonce(s) préparée(s)`);
 };
 setTimeout(pump,0);
};

// ---------- SALE BATCHING: NO find(), reconcileBinder(), save(), render() PER SALE ----------
let v081SaleTimer=0,v081SaleTouchedRemote=new Set(),v081PendingSales=new Map(),v081NotifyUnits=0,v081NotifyRevenue=0;
let v081ListingsRef=null,v081ListingsLen=-1,v081ListingById=new Map();
function v081EnsureListingIndex(){if(v081ListingsRef===state.listings&&v081ListingsLen===(state.listings?.length||0))return;v081ListingById=new Map((state.listings||[]).map(l=>[l.id,l]));v081ListingsRef=state.listings;v081ListingsLen=state.listings?.length||0}
function v081FindListing(id){v081EnsureListingIndex();return v081ListingById.get(id)||null}
let v081RemoteUpdateQueue=[],v081RemoteUpdateQueued=new Set(),v081RemoteUpdateTimer=0;
function v081QueueRemoteUpdate(l){
 if(v08Mode()!=='realistic'||!l?.remoteId||v081RemoteUpdateQueued.has(l.id))return;
 v081RemoteUpdateQueued.add(l.id);v081RemoteUpdateQueue.push(l);v081PumpRemoteUpdates();
}
function v081PumpRemoteUpdates(){
 if(v081RemoteUpdateTimer||!v081RemoteUpdateQueue.length)return;
 v081RemoteUpdateTimer=setTimeout(()=>{
  v081RemoteUpdateTimer=0;const l=v081RemoteUpdateQueue.shift();if(l)v081RemoteUpdateQueued.delete(l.id);
  if(l?.remoteId)try{VOXOnline?.updateOwnListing?.(l.remoteId,listingRemaining(l),l.status)}catch{}
  if(v081RemoteUpdateQueue.length)v081PumpRemoteUpdates();else setTimeout(()=>{try{v07PublishPublicProfile()}catch{}},450);
 },85);
}
function v081RecordSale(l,actual,total){
 const k=l.id,cur=v081PendingSales.get(k)||{id:uid('ORDER'),at:Date.now(),label:l.label,units:0,unitPrice:l.ask,total:0,type:l.type};cur.units+=actual;cur.total+=total;cur.at=Date.now();v081PendingSales.set(k,cur);
 v081NotifyUnits+=actual;v081NotifyRevenue+=total;
}
function v081FlushSales(){
 v081SaleTimer=0;
 if(v081PendingSales.size){for(const s of v081PendingSales.values())state.sales.push(s);v081PendingSales.clear()}
 if(state.sales.length>4000)state.sales.splice(0,state.sales.length-4000);
 v081PersistNow();
 if($('#inventory')?.classList.contains('active'))renderInventory();updateStats();if($('#home')?.classList.contains('active'))renderSaleFeed();
 if(v081NotifyUnits){toast(`${v081NotifyUnits} vente(s) · +${money(v081NotifyRevenue)}`);if(state.notificationsEnabled)try{VOXNative?.notifySale?.('Ventes groupées',v081NotifyUnits,v081NotifyRevenue)}catch{}}
 v081NotifyUnits=0;v081NotifyRevenue=0;
 for(const l of v081SaleTouchedRemote)if(l)v081QueueRemoteUpdate(l);v081SaleTouchedRemote.clear();
}
v08ScheduleSaleCommit=function(l){
 if(l?.remoteId)v081SaleTouchedRemote.add(l);if(v081MarketBusy)return;clearTimeout(v081SaleTimer);v081SaleTimer=setTimeout(v081FlushSales,520);
};
v08CompleteOrder=function(l,units){
 const remain=listingRemaining(l);units=clamp(Number(units)||1,1,remain);if(!units)return 0;v081EnsureInstanceIndexes();let actual=units;
 if(l.type==='card'||l.type==='energy'){
  const ids=(l.remainingIds||[]).splice(0,units);actual=ids.length;
  for(const id of ids){const ins=v081ById.get(id);if(ins)v081MarkCardSold(ins)}
  if(l.type==='card'){const shift=state.marketShift[l.cardId]||1,saleRatio=l.ask/Math.max(.02,l.marketBase);state.marketShift[l.cardId]=clamp(shift*.92+Math.min(saleRatio,2.2)*.08,.65,2.1)}
 }else l.remaining=Math.max(0,(Number(l.remaining)||0)-units);
 if(!actual)return 0;const total=l.ask*actual;state.wallet+=total;if(state.sellerProfile)state.sellerProfile.completedSales=(state.sellerProfile.completedSales||0)+actual;
 if(listingRemaining(l)<=0){l.status='sold';l.soldAt=Date.now()}
 v081RecordSale(l,actual,total);v08ScheduleSaleCommit(l);return actual;
};
completeOrder=v08CompleteOrder;

// Online receipts used to force another full save/profile/notification for every seller trade.
function v081ApplySellerTrade(t){
 const id=t?.tradeId;if(!id)return;
 if(state.onlineProcessedSellerTrades.includes(id)){try{VOXOnline?.ackTrade?.(id,'seller')}catch{}return}
 const qty=Math.max(1,Number(t.quantity)||1),l=v081FindListing(t.localListingId),total=Number(t.total)||Number(t.unitPrice||0)*qty;
 if(l&&listingRemaining(l)>0)v08CompleteOrder(l,Math.min(qty,listingRemaining(l)));
 else{state.wallet+=total;const fake={id:`REMOTE-${id}`,label:t.label||'Article',ask:Number(t.unitPrice)||0,type:t.itemType||'remote',remoteId:''};v081RecordSale(fake,qty,total);clearTimeout(v081SaleTimer);v081SaleTimer=setTimeout(v081FlushSales,520)}
 state.onlineProcessedSellerTrades.push(id);if(state.onlineProcessedSellerTrades.length>400)state.onlineProcessedSellerTrades.splice(0,state.onlineProcessedSellerTrades.length-400);try{VOXOnline?.ackTrade?.(id,'seller')}catch{}
}

// ---------- TIME-SLICED MARKET CATCH-UP ----------
let v081MarketBusy=false;
processMarket=function(initial=false){
 if(v081MarketBusy)return;const now=Date.now(),elapsed=Math.min(now-state.lastMarketTick,6*V08_HOUR),rawSteps=Math.max(initial?1:0,Math.floor(elapsed/15000));if(rawSteps<=0)return;
 // One hour of discrete simulation is enough for catch-up; beyond that we prefer a responsive app to millions of loops.
 const steps=Math.min(rawSteps,240),jobs=[];for(const b of Object.values(state.marketBooks||{}))jobs.push({kind:'book',value:b,left:steps});for(const l of state.listings||[])if(l.status==='active')jobs.push({kind:'listing',value:l,left:steps});
 state.lastMarketTick=now;v081MarketBusy=true;let index=0;
 const pump=()=>{
  const started=performance.now();
  while(index<jobs.length&&performance.now()-started<7){const j=jobs[index],n=Math.min(8,j.left);if(j.kind==='book')v08NpcDemand(j.value,n);else v4UserListingDemand(j.value,n);j.left-=n;if(j.left<=0||j.value?.status==='sold')index++}
  if(index<jobs.length){setTimeout(pump,0);return}v081MarketBusy=false;v081PersistSoon(450);if(v081NotifyUnits)clearTimeout(v081SaleTimer),v081SaleTimer=setTimeout(v081FlushSales,300);
 };
 setTimeout(pump,0);
};

window.VOXPerf={version:V081_VERSION,instanceCount:()=>state.instances?.length||0,pendingListingPublishes:()=>v081PublishQueue.length,pendingRemoteUpdates:()=>v081RemoteUpdateQueue.length,marketBusy:()=>v081MarketBusy,bulkListBusy:()=>v081BulkListBusy};
window.__voxV081PerfReady=true;
