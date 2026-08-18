'use strict';

// Supply-side price discovery: when competing stock dries up, the remaining
// player listing increasingly anchors the reference used by new NPC offers.
v4NpcDemand=function(book,steps){
 const a=book.asset,rarity=a.rarity||'rare',baseDemand=a.type==='card'?({common:.020,uncommon:.023,rare:.03,double:.04,ir:.05,ur:.055,sir:.065,hr:.06}[rarity]||.035):.04;
 for(let s=0;s<steps;s++){
  const offers=book.offers.filter(o=>o.quantity>0).sort((x,y)=>(x.price/v4ConditionMultiplier(x.condition))-(y.price/v4ConditionMultiplier(y.condition)));
  for(let i=0;i<Math.min(4,offers.length);i++){
   const o=offers[i],rankPenalty=Math.exp(-i*.55),ratio=o.price/Math.max(.02,book.base*v4ConditionMultiplier(o.condition));
   const p=baseDemand*rankPenalty*Math.exp(-Math.max(0,ratio-1)*2.2);
   if(Math.random()<p)o.quantity=Math.max(0,o.quantity-(o.quantity>2&&Math.random()<.18?2:1));
  }
 }
 const target=v4RaritySupply(rarity,a.type),alive=book.offers.filter(o=>o.quantity>0).length,age=Date.now()-(book.lastSupplyAt||0),interval=a.type==='card'&&['sir','hr'].includes(rarity)?45*60e3:18*60e3;
 const own=state.listings.filter(l=>l.status==='active'&&v4ListingKey(l)===book.key&&listingRemaining(l)>0);
 if(own.length&&alive<Math.max(1,target*.45)){
  const anchor=Math.min(...own.map(l=>l.ask/Math.max(.65,v4ConditionMultiplier(l.condition))));
  const scarcity=clamp(1-(alive/Math.max(1,target)),0,1),rarityWeight=['sir','hr','ur'].includes(rarity)?.55:.28,influence=scarcity*rarityWeight;
  book.base=Math.max(.02,book.base*(1-influence)+anchor*influence);
 }
 if(alive<Math.max(1,target*.35)&&age>interval)v4GenerateNpcOffers(book,Math.max(1,Math.floor(target*.35)));
};
