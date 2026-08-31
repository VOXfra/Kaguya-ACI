'use strict';
/* V1.2.2 economy bridge.
   Cardmarket trend prices already include scarcity/age. Do not apply the archive
   multiplier a second time to a product with a real Cardmarket price. The archive
   multiplier remains a fallback only when no public market price exists. */
(function v122CardmarketEconomy(){
 if(typeof v121PreparePrice!=='function')return;
 const basePrepare=v121PreparePrice;
 window.v121PreparePrice=function(p,cfg){
  if(!p?.v122CardmarketVerified)return basePrepare(p,cfg);
  const cm=Number(p.marketTrend),stored=Number(p.v121RetailBasePrice),raw=Number(p.price);
  const market=[cm,stored,raw].find(x=>Number.isFinite(x)&&x>0.01);
  if(!market)return basePrepare(p,cfg);
  p.v121RetailBasePrice=Number(market.toFixed(2));
  p.v121AgeMultiplier=1;
  p.v122UsesDirectCardmarketPrice=true;
  if(v08Mode()!=='creative')p.price=p.v121RetailBasePrice;
  return Number(p.price)||p.v121RetailBasePrice;
 };
})();
window.__voxV122EconomyReady=true;
