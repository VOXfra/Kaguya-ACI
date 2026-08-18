'use strict';

/* Final V0.8 integration guards. */
const V08_SOCIAL_KEY='voxCardSimV08_social';
try{const s=JSON.parse(localStorage.getItem(V08_SOCIAL_KEY)||'null');if(s){state.friends=Array.isArray(s.friends)?s.friends:state.friends;state.friendRequestsOut=Array.isArray(s.friendRequestsOut)?s.friendRequestsOut:state.friendRequestsOut;state.friendDeclined=Array.isArray(s.friendDeclined)?s.friendDeclined:state.friendDeclined}else localStorage.setItem(V08_SOCIAL_KEY,JSON.stringify({friends:state.friends,friendRequestsOut:state.friendRequestsOut,friendDeclined:state.friendDeclined}))}catch{}
const v08PublishFriendsLocalBase=v08PublishFriends;
v08PublishFriends=function(){try{localStorage.setItem(V08_SOCIAL_KEY,JSON.stringify({friends:state.friends,friendRequestsOut:state.friendRequestsOut,friendDeclined:state.friendDeclined}))}catch{}return v08PublishFriendsLocalBase()};

/* Creative really means no selling, no listings and no money. */
const v08SellCardGuardBase=openSellCardGroup;
openSellCardGroup=function(...args){if(v08Mode()==='creative')return toast('Le mode Créatif n’utilise pas de marketplace');return v08SellCardGuardBase(...args)};
const v08SellStockGuardBase=openSellStock;
openSellStock=function(...args){if(v08Mode()==='creative')return toast('Le mode Créatif n’utilise pas de marketplace');return v08SellStockGuardBase(...args)};
function v08CreativeInventoryGuards(out){if(v08Mode()!=='creative'||!out)return;out.querySelectorAll('.sell,.sell-all-cards,.energy-sell-actions,[id="sellAllInventoryCards"]').forEach(x=>x.remove());const tab=document.querySelector('.inventory-tabs [data-inv="listings"]');if(tab)tab.classList.add('hidden')}
const v08RenderCardInventoryGuardBase=renderCardInventory;renderCardInventory=function(out){v08RenderCardInventoryGuardBase(out);v08CreativeInventoryGuards(out)};
const v08RenderBoosterInventoryGuardBase=renderBoosterInventory;renderBoosterInventory=function(out){v08RenderBoosterInventoryGuardBase(out);v08CreativeInventoryGuards(out)};
const v08RenderSealedInventoryGuardBase=renderSealedInventory;renderSealedInventory=function(out){v08RenderSealedInventoryGuardBase(out);v08CreativeInventoryGuards(out)};
const v08RenderInventoryGuardBase=renderInventory;renderInventory=function(){if(v08Mode()==='creative'&&state.inventoryTab==='listings')state.inventoryTab='cards';v08RenderInventoryGuardBase();v08CreativeInventoryGuards($('#inventoryContent'));const tab=document.querySelector('.inventory-tabs [data-inv="listings"]');if(tab)tab.classList.toggle('hidden',v08Mode()==='creative')};

/* Event editions have a deliberately tiny secondary supply. */
const v08SealedBookBase=v4SealedBook;
v4SealedBook=function(productId){const b=v08SealedBookBase(productId),p=productById(productId);if(b&&p?.eventEdition){b.asset.eventEdition=true;b.asset.eventEnd=p.eventEnd;b.asset.productId=p.id;b.asset.setId=p.setId;const anchor=Math.max(.02,p.price*1.08);b.base=clamp(Number(b.base)||anchor,anchor*.9,anchor*1.7);const live=b.offers.filter(x=>x.quantity>0).sort((a,c)=>a.price-c.price);for(const x of live.slice(3))x.quantity=0}return b};
function v08RetailAnchor(l,book){if(l.type==='card'||l.type==='energy')return Math.max(.02,Number(book?.base||l.marketBase||l.ask||1));if(l.type==='booster'){const p=SETS[l.setId]?.products?.find(x=>x.mode==='loose'&&x.qty===1);return Math.max(.02,Number(p?.marketTrend||p?.price||book?.base||l.marketBase||1)*1.04)}const p=productById(l.productId||String(l.sku||'').replace('SEALED:',''));return Math.max(.02,Number(p?.marketTrend||p?.price||book?.base||l.marketBase||1)*(p?.eventEdition?1.08:1.04))}
const v08NpcDemandStable=function(book,steps){
 const a=book.asset,rarity=a.rarity||'rare';if(a.type==='booster'){const p=SETS[a.setId]?.products?.find(x=>x.mode==='loose'&&x.qty===1),anchor=Number(p?.marketTrend||p?.price||book.base||1)*1.04;book.base=clamp(Number(book.base)||anchor,anchor*.88,anchor*1.7)}else if(a.type==='sealed'){const p=productById(a.productId),anchor=Number(p?.marketTrend||p?.price||book.base||1)*(p?.eventEdition?1.08:1.04);book.base=clamp(Number(book.base)||anchor,anchor*.88,anchor*(p?.eventEdition?1.7:1.65))}
 const baseDemand=a.type==='card'?({common:.018,uncommon:.021,rare:.028,double:.036,ir:.045,ur:.05,sir:.058,hr:.055,jp_sr:.055,jp_hr:.06,jp_ur:.055}[rarity]||.03):.034;for(let s=0;s<steps;s++){const offers=book.offers.filter(o=>o.quantity>0).sort((x,y)=>(x.price/v4ConditionMultiplier(x.condition))-(y.price/v4ConditionMultiplier(y.condition)));for(let i=0;i<Math.min(4,offers.length);i++){const o=offers[i],ratio=o.price/Math.max(.02,book.base*v4ConditionMultiplier(o.condition)),p=baseDemand*Math.exp(-i*.6)*Math.exp(-Math.max(0,ratio-1)*3.2);if(Math.random()<p)o.quantity=Math.max(0,o.quantity-1)}}const target=a.eventEdition?3:v4RaritySupply(rarity,a.type),alive=book.offers.filter(o=>o.quantity>0).length,age=Date.now()-(book.lastSupplyAt||0),interval=a.eventEdition?4*V08_HOUR:(a.type==='card'&&['sir','hr','jp_hr'].includes(rarity)?55*60000:24*60000);if(alive<Math.max(1,target*.3)&&age>interval)v4GenerateNpcOffers(book,Math.max(1,Math.floor(target*.25)))};
v08NpcDemand=v08NpcDemandStable;v4NpcDemand=v08NpcDemandStable;

v08CompleteOrder=function(l,units){
 const remain=listingRemaining(l);units=clamp(Number(units)||1,1,remain);if(!units)return 0;let actual=units;
 if(l.type==='card'||l.type==='energy'){const ids=(l.remainingIds||[]).splice(0,units);actual=ids.length;for(const id of ids){const ins=state.instances.find(x=>x.id===id);if(ins)ins.status='sold'}if(l.type==='card'){const shift=state.marketShift[l.cardId]||1,saleRatio=l.ask/Math.max(.02,l.marketBase);state.marketShift[l.cardId]=clamp(shift*.92+Math.min(saleRatio,2.2)*.08,.65,2.1)}}else l.remaining=Math.max(0,(Number(l.remaining)||0)-units);
 const total=l.ask*actual;state.wallet+=total;state.sales.push({id:uid('ORDER'),at:Date.now(),label:l.label,units:actual,unitPrice:l.ask,total,type:l.type});if(state.sellerProfile)state.sellerProfile.completedSales=(state.sellerProfile.completedSales||0)+actual;if(listingRemaining(l)<=0){l.status='sold';l.soldAt=Date.now()}if(l.setId)reconcileBinder(l.setId);if(state.notificationsEnabled)try{VOXNative?.notifySale?.(l.label,actual,total)}catch{}v08SaleBatch.units+=actual;v08SaleBatch.revenue+=total;v08ScheduleSaleCommit(l);return actual
};
completeOrder=v08CompleteOrder;
v4UserListingDemand=function(l,steps){
 if(l.status!=='active'||listingRemaining(l)<=0)return;const book=v4BookForListing(l);if(!book)return,anchor=v08RetailAnchor(l,book);const cap=anchor*v08DemandCapRatio(l,book)*v4ConditionMultiplier(l.condition);if(l.ask>cap)return;for(let k=0;k<steps&&l.status==='active';k++){const rivals=v4BookOffers(book).filter(o=>!o.mine&&o.quantity>0),ourEff=l.ask/v4ConditionMultiplier(l.condition),better=rivals.filter(o=>(o.price/v4ConditionMultiplier(o.condition))<ourEff).length,ratio=l.ask/anchor;let p=demandRate(l.rarity)*Math.exp(-better*.55)*Math.exp(-Math.max(0,ratio-1)*5.2);if(ratio<=1)p*=1.12;if(!rivals.length)p*=1.14;if(!v08RetailAvailableForListing(l)&&l.type!=='card'&&l.type!=='energy')p*=1.17;if(Math.random()<p){v08CompleteOrder(l,desiredGroupSize(l));if(listingRemaining(l)<=0)break}}
};
/* Never publish energy or non-realistic listings to the human market. */
const v08PublishListingGuardBase=v07PublishListing;
v07PublishListing=function(l){if(v08Mode()!=='realistic'||l?.type==='energy')return;return v08PublishListingGuardBase(l)};

/* Home communicates which game the player is actually in. */
const v08RenderHomeFinalBase=renderHome;
renderHome=function(){v08RenderHomeFinalBase();let box=$('#v08GameStatus');if(box)box.remove();box=document.createElement('div');box.id='v08GameStatus';box.className='v08-game-status panel';const mode=v08Mode();if(mode==='ludic'){const total=v08DiscoveryCount(),to20=20-(total%20||20),boost=state.ludicRewards.boosterCount||0,toLucky=10-(boost%10||10);box.innerHTML=`<div><span>MODE LUDIQUE</span><strong>${total} cartes découvertes</strong></div><div><small>Prochaine prime</small><b>${to20} carte(s)</b></div><div><small>Booster Chance</small><b>${state.luckyPacks} en stock · ${toLucky} booster(s)</b></div>`}else if(mode==='creative')box.innerHTML='<div><span>MODE CRÉATIF</span><strong>Collection libre</strong></div><div><small>Argent</small><b>Illimité</b></div><div><small>Marketplace</small><b>Désactivé</b></div>';else{const i=v08HourInfo();box.innerHTML=`<div><span>MODE RÉALISTE</span><strong>${escapeHtml(setName(i.setId))} en boutique</strong></div><div><small>Rotation</small><b>${v08Countdown(i.next)}</b></div><div><small>Marché joueurs</small><b>Actif</b></div>`}const stats=$('#home .stats-grid');stats?.after(box)};

setTimeout(()=>{try{renderHome();renderInventory();v07PublishPublicProfile()}catch(e){console.warn('V0.8 final integration',e)}},260);
