'use strict';
/* VOX Card Sim V1.2.17 — progression authority.
   Fixes two regressions left by the V1.2.16 Master Set remake:
   - the V1.0.4 XP mapper collapsed the advertised 100 XP Master reward to 12 XP;
   - archive year gates are re-anchored to the V1.2.1 chronological curve.
   Existing V1.2.16 Master rewards are compensated once (+88 XP each). */
const V137_VERSION='1.2.17-progression-authority';
const V137_MASTER_XP=100;
const V137_LEGACY_MASTER_XP=12;
const V137_BASE_YEAR=2026;

function v137Round(n){return Math.round((Number(n)||0)*100)/100}
function v137Mode(){try{return typeof v131Mode==='function'?v131Mode():(typeof v08Mode==='function'?v08Mode():String(state?.gameMode||'realistic'))}catch{return String(state?.gameMode||'realistic')}}
function v137Ensure(){
 state.v137MasterXpRepair=state.v137MasterXpRepair&&typeof state.v137MasterXpRepair==='object'?state.v137MasterXpRepair:{};
 state.collectorXp=Math.max(0,Number(state.collectorXp)||0);
 state.collectorXpEarned=Math.max(state.collectorXp,Number(state.collectorXpEarned)||0);
}
function v137AddExactXp(amount,reason='',notify=false){
 v137Ensure();if(v137Mode()==='creative')return 0;
 const gain=Math.max(0,Number(amount)||0);if(!gain)return 0;
 state.collectorXp=v137Round(state.collectorXp+gain);
 state.collectorXpEarned=v137Round(state.collectorXpEarned+gain);
 if(notify&&reason)try{toast(`+${gain.toFixed(2)} XP · ${reason}`)}catch{}
 return gain;
}
function v137RecentUnmarkedMaster(){
 v137Ensure();const now=Date.now();
 return Object.entries(state.v136MasterRewards||{})
  .filter(([sid,at])=>!state.v137MasterXpRepair[sid]&&Number(at)>0&&Math.abs(now-Number(at))<10000)
  .sort((a,b)=>Number(b[1])-Number(a[1]))[0]?.[0]||null;
}

/* V1.0.4 intentionally remaps common XP events, but a V1.2.16 Master reward is an
   explicit absolute reward. Keep the mapper for every other reason. */
if(typeof v110AddXp==='function'){
 const v137XpBase=v110AddXp;
 v110AddXp=function(amount,reason='',notify=false){
  if(reason==='Master Set complété'){
   const gain=v137AddExactXp(amount,reason,notify),sid=v137RecentUnmarkedMaster();
   if(sid)state.v137MasterXpRepair[sid]={at:Date.now(),credit:Number(amount)||0,kind:'native-v137'};
   return gain;
  }
  return v137XpBase(amount,reason,notify);
 };
}

/* Persist the repair ledger so an already compensated Master can never receive the
   migration delta twice. */
v137Ensure();
try{
 const v137SerializableBase=v08Serializable;
 v08Serializable=function(){const d=v137SerializableBase();d.v137MasterXpRepair=state.v137MasterXpRepair;d.version=Math.max(137,Number(d.version)||0);d.schemaVersion=Math.max(137,Number(d.schemaVersion)||0);return d};
 const v137FreshBase=v08FreshSave;
 v08FreshSave=function(mode){const d=v137FreshBase(mode);d.v137MasterXpRepair={};d.version=Math.max(137,Number(d.version)||0);d.schemaVersion=Math.max(137,Number(d.schemaVersion)||0);return d};
}catch(e){console.warn('V1.2.17 persistence hook',e)}

/* Every Master completed on V1.2.16 was credited 12 XP because of v104's reason
   mapper. Restore the missing 88 exactly once per rewarded set. */
function v137RepairExistingMasters(){
 v137Ensure();if(v137Mode()==='creative')return 0;
 let repaired=0,delta=0;
 for(const [sid,at] of Object.entries(state.v136MasterRewards||{})){
  if(state.v137MasterXpRepair[sid])continue;
  const add=V137_MASTER_XP-V137_LEGACY_MASTER_XP;
  if(add>0){v137AddExactXp(add,'Correction Master Set',false);delta+=add}
  state.v137MasterXpRepair[sid]={at:Date.now(),rewardedAt:Number(at)||0,credit:add,kind:'v136-12-to-100'};repaired++;
 }
 if(repaired){
  try{if(typeof v131Commit==='function')v131Commit('v137-master-xp-repair',false);else save()}catch(e){console.warn('V1.2.17 repair save',e)}
  setTimeout(()=>{try{toast(`Progression corrigée · +${delta} XP Master Set`)}catch{}},450);
 }
 return repaired;
}

/* Chronological archive progression. 2022 must require 40 career XP:
   age=4 => 2 * 4 * 5 = 40. A 100 XP Master therefore unlocks it comfortably. */
function v137YearThreshold(year){
 const y=Number(year),age=Math.max(0,V137_BASE_YEAR-(Number.isFinite(y)?y:V137_BASE_YEAR));
 return age<=0?0:Math.round(2*age*(age+1));
}
function v137CareerXp(){return Math.max(0,Number(state.collectorXpEarned)||0)}
function v137YearUnlocked(year){
 if(v137Mode()==='creative')return true;
 const y=Number(year);return!Number.isFinite(y)||y>=V137_BASE_YEAR||v137CareerXp()>=v137YearThreshold(y);
}
try{v121YearThreshold=v137YearThreshold;v121CareerXp=v137CareerXp;v121YearUnlocked=v137YearUnlocked}catch(e){console.warn('V1.2.17 archive gate hook',e)}
try{if(typeof v126Unlocked==='function')v126Unlocked=s=>v137YearUnlocked(typeof v126Year==='function'?v126Year(s):Number(s?.releaseYear)||Number(String(s?.releaseDate||'').slice(0,4)))}catch{}

/* Refresh all places that can display a stale lock/XP value. */
function v137Refresh(){
 try{renderSetSwitches?.()}catch{}
 try{if($('#shop')?.classList.contains('active'))renderProducts?.()}catch{}
 try{if($('#home')?.classList.contains('active'))renderHome?.()}catch{}
 try{updateStats?.()}catch{}
}
v137RepairExistingMasters();
setTimeout(v137Refresh,80);
window.__voxV137Ready=true;
