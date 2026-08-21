'use strict';

// V0.5 content + persistence layer, loaded before V0.3/V0.4 bootstraps.
SETS['sv02']={
 id:'sv02',metaFile:'sv2.json',name:'Évolutions à Paldea',longName:'Écarlate et Violet — Évolutions à Paldea',series:'ÉCARLATE ET VIOLET',total:279,official:193,
 hero:[203,269,211],foilEnergy:0,demigod:0,
 rates:{double:.1372,ur:.0664,ir:.0770,sir:.0317,hr:.0176},
 products:[
  {id:'pal-booster',name:'Booster Évolutions à Paldea',subtitle:'1 booster libre',kind:'Booster',price:5.99,mode:'loose',qty:1,image:'https://cdn11.bigcommerce.com/s-ua4dd/images/stencil/original/products/67400/435919/Copy_of_Website_Image_Template9999-1180__39568.1755636663.png'},
  {id:'pal-lot6',name:'Lot de 6 boosters Évolutions à Paldea',subtitle:'6 boosters ajoutés au même stock',kind:'Lot de boosters',price:35.94,mode:'loose',qty:6,image:'https://cdn11.bigcommerce.com/s-ua4dd/images/stencil/original/products/67400/435914/Copy_of_Website_Image_Template9999-1182__50528.1755636663.png'},
  {id:'pal-etb',name:'Coffret Dresseur d’élite Évolutions à Paldea',subtitle:'Produit scellé · 9 boosters',kind:'ETB',price:54.99,mode:'sealed',opens:9,image:'https://hanabitradingco.ca/cdn/shop/files/paldeaevolvedetb.jpg?v=1757455080'},
  {id:'pal-display',name:'Display Évolutions à Paldea',subtitle:'Boîte scellée · 36 boosters',kind:'Booster Box',price:159.99,mode:'sealed',opens:36,image:'https://i5.walmartimages.com/asr/648fca66-e4f0-4c79-ac5d-4d678b7d6455.71599d1666716fc51ac4a05d4814a6a9.jpeg?odnBg=FFFFFF&odnHeight=612&odnWidth=612'}
 ]
};
EXPECTED_RARITIES['sv02']={total:279};

const V05_STORAGE='voxCardSimV05';
const V05_BACKUP='voxCardSimV05_backup';
const oldLoadV04=load;

state.version=5;
state.schemaVersion=5;
state.sellerProfile=state.sellerProfile||null;
state.inventorySort=state.inventorySort||'numberAsc';
state.lastKnownEstimates=state.lastKnownEstimates||{};
state.offlinePackMeta=state.offlinePackMeta||{};
state.marketSetFilter=state.marketSetFilter||'all';

function serializableV05(){
 return {
  version:5,schemaVersion:5,playerId:state.playerId,activeSet:state.activeSet,wallet:state.wallet,
  instances:state.instances,stock:state.stock,listings:state.listings,sales:state.sales,purchases:state.purchases,
  packsOpened:state.packsOpened,settings:state.settings,currentOpening:state.currentOpening,inventoryTab:state.inventoryTab,
  inventorySort:state.inventorySort,pageBySet:state.pageBySet,lastMarketTick:state.lastMarketTick,marketShift:state.marketShift,
  priceCache:state.priceCache,lastKnownEstimates:state.lastKnownEstimates,marketBooks:state.marketBooks,marketSellers:state.marketSellers,
  marketTab:state.marketTab,marketQuery:state.marketQuery,marketSetFilter:state.marketSetFilter,migrationInfo:state.migrationInfo,
  sellerProfile:state.sellerProfile,offlinePackMeta:state.offlinePackMeta,lastSavedAt:Date.now()
 };
}

save=function(){
 try{
  const json=JSON.stringify(serializableV05());
  localStorage.setItem(V05_STORAGE,json);localStorage.setItem(V05_BACKUP,json);
 }catch(e){
  console.error('V0.5 save failed',e);
  try{
   state.priceCache=Object.fromEntries(Object.entries(state.priceCache||{}).sort((a,b)=>(b[1]?.fetchedAt||0)-(a[1]?.fetchedAt||0)).slice(0,60));
   state.marketBooks=Object.fromEntries(Object.entries(state.marketBooks||{}).sort((a,b)=>(b[1]?.lastTouched||0)-(a[1]?.lastTouched||0)).slice(0,150));
   const json=JSON.stringify(serializableV05());localStorage.setItem(V05_STORAGE,json);localStorage.setItem(V05_BACKUP,json);
  }catch(e2){console.error('V0.5 emergency save failed',e2)}
 }
};

function normalizeV05(){
 state.version=5;state.schemaVersion=5;
 state.activeSet=SETS[state.activeSet]?state.activeSet:'sv03.5';
 state.inventorySort=['valueDesc','valueAsc','qtyDesc','qtyAsc','numberAsc','numberDesc'].includes(state.inventorySort)?state.inventorySort:'numberAsc';
 state.lastKnownEstimates=state.lastKnownEstimates&&typeof state.lastKnownEstimates==='object'?state.lastKnownEstimates:{};
 state.offlinePackMeta=state.offlinePackMeta&&typeof state.offlinePackMeta==='object'?state.offlinePackMeta:{};
 state.sellerProfile=state.sellerProfile&&typeof state.sellerProfile==='object'&&String(state.sellerProfile.handle||'').trim()?state.sellerProfile:null;
 state.pageBySet={'sv03.5':0,'sv03':0,'sv02':0,...(state.pageBySet||{})};
 state.marketSetFilter=['all','sv03.5','sv03','sv02'].includes(state.marketSetFilter)?state.marketSetFilter:'all';
 for(const ins of state.instances||[]){ins.condition=ins.condition||'MT';ins.setId=ins.setId||'sv03.5';}
}

load=function(){
 let data=null,source=null;
 try{data=JSON.parse(localStorage.getItem(V05_STORAGE)||'null');if(data)source='v0.5'}catch{}
 if(!data){try{data=JSON.parse(localStorage.getItem(V05_BACKUP)||'null');if(data)source='v0.5 backup'}catch{}}
 if(data)Object.assign(state,data);
 else{oldLoadV04();source='v0.4';}
 normalizeV05();
 if(source==='v0.4'||state.schemaVersion<5)state.migrationInfo={from:'0.4',to:'0.5',at:Date.now()};
 save();
};

window.addEventListener('pagehide',()=>save());
