'use strict';
/* VOX Card Sim V1.2.8 — unified-campaign Ludic baseline guard.
   Changing difficulty must never retroactively pay rewards for progress earned
   before Ludic became active. Existing Ludic reward state is preserved. */
const V128_VERSION='1.2.8-ludic-baseline';

function v128DiscoveryCount(){return Object.keys(state?.discoveredCards||{}).length}
function v128CompletedNow(){
 const counts={};
 for(const key of Object.keys(state?.discoveredCards||{})){
  const p=key.indexOf('|');if(p<=0)continue;const sid=key.slice(0,p);counts[sid]=(counts[sid]||0)+1;
 }
 const out={};
 for(const [sid,n] of Object.entries(counts)){
  const total=Number(SETS?.[sid]?.total)||Infinity;if(n>=total)out[sid]=Date.now();
 }
 return out;
}
function v128SeedLudicBaseline(){
 if(state?.gameMode!=='ludic'||state.v128LudicBaselineInitialized)return false;
 state.ludicRewards=state.ludicRewards&&typeof state.ludicRewards==='object'?state.ludicRewards:{twentyMilestone:0,completedSets:{},boosterCount:0,totalBonus:0};
 state.ludicRewards.completedSets=state.ludicRewards.completedSets&&typeof state.ludicRewards.completedSets==='object'?state.ludicRewards.completedSets:{};
 state.ludicRewards.twentyMilestone=Math.max(Number(state.ludicRewards.twentyMilestone)||0,Math.floor(v128DiscoveryCount()/20));
 for(const [sid,at] of Object.entries(v128CompletedNow()))if(!state.ludicRewards.completedSets[sid])state.ludicRewards.completedSets[sid]=at;
 state.v128LudicBaselineInitialized=true;
 try{typeof v127Commit==='function'&&v127Commit('ludic-baseline',false)}catch(e){console.warn('V1.2.8 baseline save',e)}
 return true;
}

/* Preserve the same campaign while changing difficulty and seed the baseline only
   after the unified V1.2.7 switch has applied the destination mode. */
if(typeof window.v08SwitchMode==='function'&&!window.v08SwitchMode.__v128Wrapped){
 const v128SwitchBase=window.v08SwitchMode;
 window.v08SwitchMode=function(mode){
  const r=v128SwitchBase(mode);
  if(mode==='ludic')v128SeedLudicBaseline();
  return r;
 };
 window.v08SwitchMode.__v128Wrapped=true;
}

/* A migrated save that was already Ludic gets its current progress marked as the
   baseline once. This prevents the first new discovery after an update from paying
   historical milestones again. */
v128SeedLudicBaseline();

/* Native mirror is a local safety copy, not the Realistic online economy. Keep an
   up-to-date device mirror for the unified campaign even while Ludic is selected. */
function v128MirrorCampaign(){
 if(state?.gameMode==='creative')return;
 try{const d=typeof v127Snapshot==='function'?v127Snapshot(state.gameMode):null;if(d)VOXNative?.mirrorSave?.(JSON.stringify(d))}catch(e){console.warn('V1.2.8 native mirror',e)}
}
const v128SaveBase=save;
save=function(){const r=v128SaveBase();v128MirrorCampaign();return r};
window.addEventListener('pagehide',v128MirrorCampaign);

window.__voxV128Ready=true;
