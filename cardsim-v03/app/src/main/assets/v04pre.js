'use strict';

// V0.4 persistence layer. This script is loaded after the V0.3 core objects but
// before V0.3 bootstraps, so the existing UI automatically uses the migrated state.
const V04_STORAGE='voxCardSimV04';
const V04_BACKUP='voxCardSimV04_backup';
const V03_STORAGE='voxCardSimV03';
const oldLoadV03=load;

state.version=4;
state.schemaVersion=4;
state.marketBooks=state.marketBooks||{};
state.marketSellers=state.marketSellers||[];
state.purchases=state.purchases||[];
state.marketTab=state.marketTab||'buy';
state.marketQuery=state.marketQuery||'';
state.marketSetFilter=state.marketSetFilter||'all';
state.migrationInfo=state.migrationInfo||null;

function serializableV04(){
 return {
  version:4,schemaVersion:4,playerId:state.playerId,activeSet:state.activeSet,wallet:state.wallet,
  instances:state.instances,stock:state.stock,listings:state.listings,sales:state.sales,purchases:state.purchases,
  packsOpened:state.packsOpened,settings:state.settings,currentOpening:state.currentOpening,inventoryTab:state.inventoryTab,
  pageBySet:state.pageBySet,lastMarketTick:state.lastMarketTick,marketShift:state.marketShift,priceCache:state.priceCache,
  marketBooks:state.marketBooks,marketSellers:state.marketSellers,marketTab:state.marketTab,marketQuery:state.marketQuery,
  marketSetFilter:state.marketSetFilter,migrationInfo:state.migrationInfo,lastSavedAt:Date.now()
 };
}

save=function(){
 try{
  const json=JSON.stringify(serializableV04());
  localStorage.setItem(V04_STORAGE,json);
  localStorage.setItem(V04_BACKUP,json);
 }catch(e){
  console.error('V0.4 save failed',e);
  // Price details are re-fetchable; prune them before sacrificing progression data.
  try{
   const entries=Object.entries(state.priceCache||{}).sort((a,b)=>(b[1]?.fetchedAt||0)-(a[1]?.fetchedAt||0)).slice(0,24);
   state.priceCache=Object.fromEntries(entries);
   const books=Object.entries(state.marketBooks||{}).sort((a,b)=>(b[1]?.lastTouched||0)-(a[1]?.lastTouched||0)).slice(0,80);
   state.marketBooks=Object.fromEntries(books);
   const json=JSON.stringify(serializableV04());
   localStorage.setItem(V04_STORAGE,json);localStorage.setItem(V04_BACKUP,json);
  }catch(e2){console.error('V0.4 emergency save failed',e2)}
 }
};

function normalizeV04State(){
 state.version=4;state.schemaVersion=4;
 state.playerId=state.playerId||uid('PLAYER');
 state.activeSet=SETS[state.activeSet]?state.activeSet:'sv03.5';
 state.wallet=Number.isFinite(Number(state.wallet))?Number(state.wallet):250;
 state.instances=Array.isArray(state.instances)?state.instances:[];
 state.stock=state.stock&&typeof state.stock==='object'?state.stock:{};
 state.listings=Array.isArray(state.listings)?state.listings:[];
 state.sales=Array.isArray(state.sales)?state.sales:[];
 state.purchases=Array.isArray(state.purchases)?state.purchases:[];
 state.packsOpened=state.packsOpened&&typeof state.packsOpened==='object'?state.packsOpened:{};
 state.settings={cardTrickEnabled:false,cardTrickCount:0,...(state.settings||{})};
 state.pageBySet={'sv03.5':0,'sv03':0,...(state.pageBySet||{})};
 state.marketShift=state.marketShift&&typeof state.marketShift==='object'?state.marketShift:{};
 state.priceCache=state.priceCache&&typeof state.priceCache==='object'?state.priceCache:{};
 state.marketBooks=state.marketBooks&&typeof state.marketBooks==='object'?state.marketBooks:{};
 state.marketSellers=Array.isArray(state.marketSellers)?state.marketSellers:[];
 state.marketTab=['buy','sell','history'].includes(state.marketTab)?state.marketTab:'buy';
 state.marketQuery=String(state.marketQuery||'');
 state.marketSetFilter=['all','sv03.5','sv03'].includes(state.marketSetFilter)?state.marketSetFilter:'all';
 state.lastMarketTick=Number(state.lastMarketTick)||Date.now();
 for(const ins of state.instances){ins.setId=ins.setId||'sv03.5';ins.condition=ins.condition||'MT';ins.status=ins.status||'owned';}
}

load=function(){
 let source=null,data=null;
 try{data=JSON.parse(localStorage.getItem(V04_STORAGE)||'null');if(data)source='v0.4'}catch{}
 if(!data){try{data=JSON.parse(localStorage.getItem(V04_BACKUP)||'null');if(data)source='v0.4 backup'}catch{}}
 if(!data){
  try{data=JSON.parse(localStorage.getItem(V03_STORAGE)||'null');if(data)source='v0.3'}catch{}
 }
 if(data){Object.assign(state,data);}
 else{oldLoadV03();source='fresh';}
 normalizeV04State();
 if(source==='v0.3')state.migrationInfo={from:'0.3',to:'0.4',at:Date.now()};
 else if(!state.migrationInfo)state.migrationInfo={from:source==='fresh'?'fresh':source,to:'0.4',at:Date.now()};
 save();
};

window.addEventListener('pagehide',()=>save());
window.addEventListener('beforeunload',()=>save());
