'use strict';

// ---------- MODAL STACKING ----------
const v061Style=document.createElement('style');
v061Style.textContent=`
#marketModal{z-index:100!important}
#sellModal{z-index:160!important}
#sellerProfileModal{z-index:180!important}
#resetModal{z-index:190!important}
#sellModal .modal-backdrop,#sellerProfileModal .modal-backdrop{backdrop-filter:blur(12px)}
.product-pack-art:after,.sealed-pack:after,.tear-strip,.foil-noise{display:none!important}
.sealed-pack{width:min(52vw,220px)!important;aspect-ratio:.47!important;background:#090d13!important;border-radius:9px!important;box-shadow:0 28px 65px #000b!important}
.sealed-pack>img{width:100%!important;height:100%!important;object-fit:contain!important;background:transparent!important}
.set-logo.jp-eevee-logo{width:190px!important;max-height:88px!important;object-fit:contain!important}
.energy-sell-actions{margin-left:auto;display:flex;flex-direction:column;gap:7px}
.energy-sell-actions button{min-width:82px}
.binder-product-img{object-fit:contain!important;padding:6px}
`;
document.head.appendChild(v061Style);

// ---------- REAL BINDER PRODUCTS ----------
const V061_BINDERS={
 'sv03.5':{name:'Classeur 151 officiel — 9 poches',subtitle:'Classeur 151 · jusqu’à 360 cartes',image:'img/binder_151.jpg',capacity:360,pages:40},
 'sv03':{name:'Portfolio Dracaufeu — Flammes Obsidiennes',subtitle:'Portfolio Ultra PRO · 9 poches · jusqu’à 252 cartes',image:'img/binder_obsidian.webp',capacity:252,pages:28},
 'sv02':{name:'Portfolio Évolutions à Paldea — 9 poches',subtitle:'Portfolio Ultra PRO · jusqu’à 252 cartes',image:'img/binder_paldea.png',capacity:252,pages:28},
 's6a':{name:'Collection File Eevee Heroes — 9 poches',subtitle:'Collection File japonais · 10 recharges · 180 cartes',image:'img/binder_eevee.jpg',capacity:180,pages:20}
};
for(const [sid,spec] of Object.entries(V061_BINDERS)){
 const p=SETS[sid]?.products?.find(x=>x.mode==='binderUnlock');
 if(p)Object.assign(p,{name:spec.name,subtitle:spec.subtitle,image:spec.image,binderCapacity:spec.capacity,binderPages:spec.pages});
}

const v061RenderProductsBase=renderProducts;
renderProducts=function(){v061RenderProductsBase();document.querySelectorAll('.product-photo').forEach(img=>{if(String(img.src).includes('binder_'))img.classList.add('binder-product-img')})};

// Eevee Heroes did not have a normal TCGdex logo in V0.6. Use the bundled real set logo.
const v061RenderHomeBase=renderHome;
renderHome=function(){v061RenderHomeBase();if(state.activeSet==='s6a'){const logo=$('#setLogo');if(logo){logo.src='img/eevee_logo.png';logo.classList.add('jp-eevee-logo')}}else $('#setLogo')?.classList.remove('jp-eevee-logo')};

// Binder metadata follows the physical product capacity rather than always claiming 360.
const v061RenderBinderBase=renderBinder;
renderBinder=function(){
 v061RenderBinderBase();
 const sid=state.activeSet,spec=V061_BINDERS[sid];
 if(!spec||!state.binderOwned[sid])return;
 $('#binderMetaName').textContent=spec.name;
 $('#binderMetaCount').textContent=`${spec.capacity} emplacements physiques`;
 $('#pageTotal').textContent=spec.pages;
 const p=state.pageBySet[sid]||0;
 if(p>=spec.pages){state.pageBySet[sid]=Math.max(0,spec.pages-1);save();v061RenderBinderBase();$('#binderMetaName').textContent=spec.name;$('#binderMetaCount').textContent=`${spec.capacity} emplacements physiques`;$('#pageTotal').textContent=spec.pages;}
};
const v061NextPageBase=$('#nextPage')?.onclick;
if($('#nextPage'))$('#nextPage').onclick=()=>{const sid=state.activeSet,spec=V061_BINDERS[sid];if(spec&&state.binderOwned[sid]&&(state.pageBySet[sid]||0)>=spec.pages-1)return;v061NextPageBase?.()};

// ---------- ENERGY CARDS CAN BE SOLD ----------
const v061AssetKeyBase=v4AssetKey;
v4AssetKey=function(a){if(a?.type==='energy')return`energy:${a.energyType}:${a.variant||'normal'}`;return v061AssetKeyBase(a)};
const v061ListingKeyBase=v4ListingKey;
v4ListingKey=function(l){if(l?.type==='energy')return l.assetKey||`energy:${l.energyType}:${l.variant||'normal'}`;return v061ListingKeyBase(l)};
const v061ListingRemainingBase=listingRemaining;
listingRemaining=function(l){if(l?.type==='energy')return l.remainingIds?.length||0;return v061ListingRemainingBase(l)};
const v061OfferConditionsBase=v4OfferConditions;
v4OfferConditions=function(asset){if(asset?.type==='energy')return['MT','NM','NM','EX'];return v061OfferConditionsBase(asset)};
const v061OfferQuantityBase=v4OfferQuantity;
v4OfferQuantity=function(asset){if(asset?.type==='energy')return Math.max(1,Math.floor(rnd(1,9)));return v061OfferQuantityBase(asset)};

function v061EnergyBook(ins){
 const en=ENERGY.find(e=>e.name===ins.energyType),cosmos=ins.variant==='cosmos';
 const base=cosmos?1.15:.06;
 return v4EnsureBook({type:'energy',energyType:ins.energyType,variant:ins.variant||'normal',label:`Énergie ${ins.energyType}${cosmos?' · Cosmos Holo':''}`,rarity:cosmos?'rare':'common',image:en?.thumb||ins.imageSmall||''},base);
}
const v061BookForListingBase=v4BookForListing;
v4BookForListing=function(l){if(l?.type==='energy'){const fake={energyType:l.energyType,variant:l.variant};return v061EnergyBook(fake)}return v061BookForListingBase(l)};

const v061CreateListingBase=createListing;
createListing=function(x){
 if(x.type!=='energy')return v061CreateListingBase(x);
 const ids=(x.availableIds||[]).slice(0,x.qty),valid=ids.map(id=>state.instances.find(i=>i.id===id&&i.status==='owned'&&i.isEnergy)).filter(Boolean);
 if(!valid.length)return toast('Aucune énergie disponible');
 for(const ins of valid){ins.status='listed';ins.location='listed'}
 state.listings.push({id:uid('LIST'),type:'energy',energyType:x.energyType,variant:x.variant,condition:x.condition||'MT',label:x.label,rarity:x.rarity||'common',marketBase:x.marketBase,assetKey:x.assetKey,ask:x.ask,instanceIds:valid.map(i=>i.id),remainingIds:valid.map(i=>i.id),status:'active',createdAt:Date.now(),lastTick:Date.now()});
 save();renderInventory();updateStats();toast('Énergie mise en vente');
};

const v061CancelListingBase=cancelListing;
cancelListing=function(id){
 const l=state.listings.find(x=>x.id===id&&x.status==='active');
 if(!l||l.type!=='energy')return v061CancelListingBase(id);
 l.status='cancelled';
 for(const iid of l.remainingIds||[]){const ins=state.instances.find(x=>x.id===iid);if(ins){ins.status='owned';ins.location='inventory'}}
 l.remainingIds=[];save();renderInventory();updateStats();toast('Annonce retirée');
};

const v061CompleteOrderBase=completeOrder;
completeOrder=function(l,units){
 if(l?.type!=='energy')return v061CompleteOrderBase(l,units);
 const before=listingRemaining(l);units=clamp(Number(units)||1,1,before);const ids=l.remainingIds.splice(0,units);for(const id of ids){const ins=state.instances.find(x=>x.id===id);if(ins)ins.status='sold'}
 const sold=ids.length,revenue=l.ask*sold;state.wallet+=revenue;state.sales.push({id:uid('ORDER'),at:Date.now(),label:l.label,units:sold,unitPrice:l.ask,total:revenue,type:'energy',purchaseCost:null,profit:null});if(!l.remainingIds.length){l.status='sold';l.soldAt=Date.now()}if(state.notificationsEnabled)try{window.VOXNative?.notifySale?.(l.label,sold,revenue)}catch{}save();renderInventory();updateStats();renderSaleFeed();
};

function v061SellEnergyGroup(arr){
 const owned=arr.filter(x=>x.status==='owned'&&x.isEnergy);if(!owned.length)return;v06RequireProfile(()=>{
  const ins=owned[0],book=v061EnergyBook(ins),offers=v4BookOffers(book).filter(o=>!o.mine),lowest=offers[0]?.price||book.base;
  showSell({type:'energy',availableIds:owned.map(x=>x.id),energyType:ins.energyType,variant:ins.variant||'normal',label:book.asset.label,condition:'MT',marketBase:book.base,rarity:book.asset.rarity,assetKey:book.key,book,suggested:Math.max(.02,lowest),maxQty:owned.length});
 });
}

const v061RenderCardInventoryBase=renderCardInventory;
renderCardInventory=function(out){
 v061RenderCardInventoryBase(out);
 const energies=state.instances.filter(x=>x.status==='owned'&&x.location==='inventory'&&x.isEnergy),groups=new Map();
 for(const x of energies){const k=`${x.energyType}|${x.variant||'normal'}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x)}
 for(const arr of groups.values()){
  const x=arr[0],label=`Énergie ${x.energyType}`,cosmos=x.variant==='cosmos';
  const candidates=[...out.querySelectorAll('.inventory-card')].filter(el=>el.querySelector('strong')?.textContent.trim()===label && (el.textContent.includes('Cosmos Holo')===cosmos));
  const el=candidates[0];if(!el||el.querySelector('.energy-sell-actions'))continue;
  const actions=document.createElement('div');actions.className='energy-sell-actions';actions.innerHTML='<button class="primary small">Vendre</button>';actions.querySelector('button').onclick=()=>v061SellEnergyGroup(arr);el.appendChild(actions);
 }
};

// Keep visible screens in sync after the hotfix has loaded.
setTimeout(()=>{try{renderHome();renderProducts();renderBinder();if(state.inventoryTab==='cards')renderInventory()}catch(e){console.warn('v0.6.1 refresh',e)}},250);
