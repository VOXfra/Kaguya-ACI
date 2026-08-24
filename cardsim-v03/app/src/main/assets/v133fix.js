'use strict';
/* VOX Card Sim V1.2.13 — Ludic marketplace authority.
   Ludic has a simulated NPC marketplace. Real-player tabs/network offers belong
   to Realistic only. Keep the old online layer for Realistic, but never route a
   Ludic market click through its Players renderer. */
const V133_VERSION='1.2.13-ludic-market';

function v133Mode(){
 try{return typeof v131Mode==='function'?v131Mode():(typeof v08Mode==='function'?v08Mode():String(state?.gameMode||'realistic'))}catch{return String(state?.gameMode||'realistic')}
}
function v133LudicTab(){
 const t=String(state?.marketTab||'buy');return t==='sell'||t==='history'?t:'buy';
}
function v133RenderLudicMarket(){
 if(v133Mode()!=='ludic')return false;
 try{v4EnsureSellers?.()}catch{}
 state.marketTab=v133LudicTab();
 const title=$('#marketModal .section-title');
 if(title)title.innerHTML='<span>MARKETPLACE</span><h2>Marché des collectionneurs</h2><p>Mode Ludique · marché simulé avec vendeurs NPC uniquement.</p>';
 try{
  if(state.marketTab==='sell')v4RenderSellHome();
  else if(state.marketTab==='history')v4RenderHistory();
  else v4RenderBuyHome();
 }catch(e){
  console.error('V1.2.13 Ludic market render',e);
  const out=$('#marketContent');if(out)out.innerHTML='<div class="empty-state panel">Le marché n’a pas pu être chargé. Réessaie.</div>';
 }
 return true;
}

/* renderMarket is called by the market tabs themselves. Once Ludic is open, keep
   every tab transition on the NPC-only path instead of falling back to V0.7 online. */
const v133RenderMarketBase=renderMarket;
renderMarket=function(){if(v133Mode()==='ludic')return v133RenderLudicMarket();return v133RenderMarketBase.apply(this,arguments)};

/* v07RenderBook calls v07AddPlayersTab() when returning from an offer book. That
   tab must never be injected outside Realistic. */
if(typeof v07AddPlayersTab==='function'){
 const v133PlayersTabBase=v07AddPlayersTab;
 v07AddPlayersTab=function(){if(v133Mode()!=='realistic')return;return v133PlayersTabBase.apply(this,arguments)};
}

function v133OpenLudicMarket(e){
 if(v133Mode()!=='ludic')return;
 e?.preventDefault?.();e?.stopPropagation?.();e?.stopImmediatePropagation?.();
 state.marketTab=v133LudicTab();
 try{processMarket?.(false)}catch(err){console.warn('V1.2.13 market tick',err)}
 v133RenderLudicMarket();
 $('#marketModal')?.classList.remove('hidden');
}
const v133MarketNav=$('#marketNav');
if(v133MarketNav)v133MarketNav.addEventListener('click',v133OpenLudicMarket,true);

/* A stale Players tab can be persisted from a Realistic session. Normalise it as
   soon as Ludic becomes active, even before the first market click. */
if(v133Mode()==='ludic'&&String(state.marketTab)==='players')state.marketTab='buy';
window.__voxV133Ready=true;
