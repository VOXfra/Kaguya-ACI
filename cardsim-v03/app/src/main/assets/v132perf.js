'use strict';
/* VOX Card Sim V1.2.12 — performance consolidation.
   Keep the V1.2.11 three-slot save model unchanged, but remove the avoidable
   synchronous work introduced by compatibility layers: repeated deep clones,
   repeated JSON.stringify calls, duplicated localStorage writes, broad DOM
   observers and unconditional offline-panel redraws. */
const V132_VERSION='1.2.12-performance-consolidation';
const V132_SUMMARY_PREFIX='voxCardSimV132_summary_';
let V132_SAVE_TIMER=0,V132_SAVE_IDLE=0,V132_PENDING_SAVE=false;
let V132_LAST_SAVE_MS=0,V132_LAST_SAVE_BYTES=0,V132_SAVE_COUNT=0;

function v132AutoEnabled(){try{return typeof v122AutoSaveEnabled==='function'?v122AutoSaveEnabled():true}catch{return true}}
function v132CancelQueuedSave(){
 if(V132_SAVE_TIMER){clearTimeout(V132_SAVE_TIMER);V132_SAVE_TIMER=0}
 if(V132_SAVE_IDLE&&'cancelIdleCallback'in window){try{cancelIdleCallback(V132_SAVE_IDLE)}catch{}V132_SAVE_IDLE=0}
 V132_PENDING_SAVE=false;
}
function v132Snapshot(mode=v131Mode()){
 let d=null;
 try{d=typeof v08Serializable==='function'?v08Serializable():null}catch(e){console.warn('V1.2.12 serializer fallback',e)}
 if(!d)d={...state};
 /* Fields added after V0.8 are copied by reference here. JSON.stringify below is
    the single deep traversal; JSON.parse(JSON.stringify(...)) before it would
    merely traverse the same large save a second time. */
 for(const k of ['offlinePackMeta','v122BonusBoosterLog','v128LudicBaselineInitialized','notificationsEnabled','friends','friendRequestsOut','friendDeclined']){
  if(state?.[k]!==undefined)d[k]=state[k];
 }
 d.gameMode=mode;d.version=Math.max(132,Number(d.version)||0);d.schemaVersion=Math.max(132,Number(d.schemaVersion)||0);d.lastSavedAt=Date.now();
 d.instances=Array.isArray(d.instances)?d.instances:[];
 d.stock=d.stock&&typeof d.stock==='object'?d.stock:{};
 d.stockLots=d.stockLots&&typeof d.stockLots==='object'?d.stockLots:{};
 d.binderOwned=d.binderOwned&&typeof d.binderOwned==='object'?d.binderOwned:{};
 d.discoveredCards=d.discoveredCards&&typeof d.discoveredCards==='object'?d.discoveredCards:{};
 d.ludicRewards=d.ludicRewards&&typeof d.ludicRewards==='object'?d.ludicRewards:{twentyMilestone:0,completedSets:{},boosterCount:0,totalBonus:0};
 d.ludicRewards.completedSets=d.ludicRewards.completedSets&&typeof d.ludicRewards.completedSets==='object'?d.ludicRewards.completedSets:{};
 d.wallet=Number.isFinite(Number(d.wallet))?Number(d.wallet):(mode==='creative'?0:250);
 return d;
}
function v132Summary(d,mode=d?.gameMode||v131Mode()){
 return{mode,wallet:Number(d?.wallet)||0,discovered:Object.keys(d?.discoveredCards||{}).length,binders:Object.values(d?.binderOwned||{}).filter(Boolean).length,completed:Object.keys(d?.ludicRewards?.completedSets||{}).length,lastSavedAt:Number(d?.lastSavedAt)||Date.now()};
}
function v132WriteSummary(mode,d){try{localStorage.setItem(V132_SUMMARY_PREFIX+mode,JSON.stringify(v132Summary(d,mode)))}catch{}}
function v132ReadSummary(mode){try{return JSON.parse(localStorage.getItem(V132_SUMMARY_PREFIX+mode)||'null')}catch{return null}}
function v132WriteCompatJson(mode,json){
 /* Compatibility keys are only needed at durability boundaries. The V1.2.11
    slot remains authoritative on every autosave. Reuse the SAME serialized
    string instead of repairing/cloning/stringifying four more times. */
 localStorage.setItem('voxCardSimV06',json);
 localStorage.setItem('voxCardSimV06_backup',json);
 localStorage.setItem('voxCardSimV08_slot_'+mode,json);
 localStorage.setItem('voxCardSimV08_activeMode',mode);
 localStorage.setItem('voxCardSimV127_mode',mode);
 if(mode==='creative')localStorage.setItem('voxCardSimV127_sandbox',json);else localStorage.setItem('voxCardSimV127_campaign',json);
 try{VOXOnline?.setCloudWritesEnabled?.(mode==='realistic'&&state.onlineCloudEnabled!==false)}catch{}
 try{if(mode==='realistic')VOXNative?.mirrorSave?.(json)}catch{}
}
function v132Commit(reason='auto',manual=false,compat=null){
 v132CancelQueuedSave();
 const mode=v131Mode(),started=performance.now(),d=v132Snapshot(mode),json=JSON.stringify(d);
 localStorage.setItem(v131SlotKey(mode),json);
 if(manual)localStorage.setItem(v131ManualKey(mode),json);
 v132WriteSummary(mode,d);
 const durable=compat===null?(manual||reason!=='auto'):!!compat;
 if(durable)v132WriteCompatJson(mode,json);
 state.__v122Dirty=false;state.__v131LastSaveReason=reason;state.__v131LastSavedAt=d.lastSavedAt;
 V132_LAST_SAVE_MS=performance.now()-started;V132_LAST_SAVE_BYTES=json.length;V132_SAVE_COUNT++;
 try{v122UpdateSaveUi?.()}catch{}
 return d;
}
function v132StageCompatibility(mode,d){
 const x=d&&typeof d==='object'?{...d,gameMode:mode,lastSavedAt:Number(d.lastSavedAt)||Date.now()}:v132Snapshot(mode);
 const json=JSON.stringify(x);v132WriteCompatJson(mode,json);v132WriteSummary(mode,x);return x;
}
function v132QueueAutoSave(delay=420){
 if(!v132AutoEnabled()){state.__v122Dirty=true;try{v122UpdateSaveUi?.()}catch{};return null}
 V132_PENDING_SAVE=true;clearTimeout(V132_SAVE_TIMER);V132_SAVE_TIMER=setTimeout(()=>{
  V132_SAVE_TIMER=0;
  const run=()=>{V132_SAVE_IDLE=0;if(V132_PENDING_SAVE)v132Commit('auto',false,false)};
  if('requestIdleCallback'in window)V132_SAVE_IDLE=requestIdleCallback(run,{timeout:1100});else setTimeout(run,0);
 },Math.max(120,Number(delay)||420));return null;
}
function v132FlushAutoSave(reason='flush'){
 if(!V132_PENDING_SAVE)return null;
 if(!v132AutoEnabled()){v132CancelQueuedSave();return null}
 return v132Commit(reason,false,true);
}

/* Make the optimized writer authoritative for all late V1.2 code. Generic save()
   is coalesced. Explicit checkpoints/manual saves/mode switches stay immediate. */
try{v131Commit=v132Commit}catch{}
try{v131StageCompatibility=v132StageCompatibility}catch{}
save=function(){return v132QueueAutoSave(420)};
window.v122ForceSave=function(){return v132Commit('checkpoint',false,true)};
window.v122Checkpoint=function(reason='modification'){
 if(!v132AutoEnabled()){state.__v122Dirty=true;state.__v122DirtyReason=reason;try{v122UpdateSaveUi?.()}catch{};return null}
 return v132Commit(String(reason||'checkpoint'),false,true);
};
window.v122ManualSave=function(){
 const d=v132Commit('manual',true,true);try{toast(`Sauvegarde manuelle ${V08_MODES?.[d.gameMode]?.label||d.gameMode} créée`)}catch{};try{v131RenderSavePanel()}catch{};return d;
};
document.addEventListener('visibilitychange',()=>{if(document.hidden)v132FlushAutoSave('visibility')},{passive:true});
window.addEventListener('pagehide',()=>v132FlushAutoSave('pagehide'),{passive:true});

/* The final settings renderer already removes every legacy mode panel after its
   base render. These subtree-wide observers were therefore doing a full selector
   scan after practically every DOM mutation in inventory/opening/settings. */
try{v130Observer.disconnect()}catch{}
try{v131Observer.disconnect()}catch{}

/* Settings mode cards used to parse all three full save files every render. Keep
   a tiny summary alongside each slot and parse a full slot only once if a summary
   has not been generated yet. */
try{
 v131Stats=function(mode){
  let s=v132ReadSummary(mode);
  if(!s){const d=v131Read(v131SlotKey(mode));if(!d)return'Nouvelle partie';s=v132Summary(d,mode);v132WriteSummary(mode,d)}
  const wallet=mode==='creative'?'∞':(typeof money==='function'?money(Number(s.wallet)||0):`${(Number(s.wallet)||0).toFixed(2)} €`);
  return`${wallet} · ${Number(s.discovered)||0} cartes · ${Number(s.binders)||0} classeurs`;
 };
}catch{}
/* The save panel only needs to know whether a manual point exists; parsing a large
   JSON blob just to enable a button is wasted work. */
try{
 v131RenderSavePanel=function(){
  const card=$('#settingsModal .modal-card');if(!card)return;document.querySelector('#v131SavePanel')?.remove();const mode=v131Mode(),hasManual=localStorage.getItem(v131ManualKey(mode))!==null,box=document.createElement('div');box.id='v131SavePanel';box.className='v131-save-panel';
  box.innerHTML=`<div><strong>Sauvegarde · ${escapeHtml(V08_MODES?.[mode]?.label||mode)}</strong><small>Auto et manuel concernent uniquement cette partie.</small></div><button id="v131RestoreManual" class="secondary" ${hasManual?'':'disabled'}>${hasManual?'Restaurer le point manuel':'Aucun point manuel'}</button>`;
  const saveBox=$('#v122SaveSettings');if(saveBox)saveBox.after(box);else card.appendChild(box);const manualBtn=$('#v122SaveNow');if(manualBtn)manualBtn.onclick=()=>window.v122ManualSave();const restore=$('#v131RestoreManual');if(restore)restore.onclick=()=>window.v131RestoreManual();
 };
}catch{}

/* V1.2.6 rebuilt every offline row every two seconds even when not one byte of
   progress had changed. Keep the poll for Android WorkManager, but only repaint on
   an actual status transition. */
let V132_OFFLINE_SIG='';
function v132OfflineSignature(sec=document.querySelector('.offline-settings.v126-off')){
 if(!sec||$('#settingsModal')?.classList.contains('hidden'))return'';
 const parts=[];for(const row of sec.querySelectorAll('[data-oid]')){const id=row.dataset.oid,s=v126Status(id)||{};parts.push(`${id}:${s.state||''}:${Number(s.done)||0}:${Number(s.attempted)||0}:${Number(s.failed)||0}:${Number(s.bytes)||0}:${s.installed?1:0}`)}
 try{const b=v111BulkStatus?.()||{};parts.push(`B:${b.running?1:0}:${Number(b.done)||0}:${Number(b.total)||0}:${Number(b.failed)||0}:${Number(b.finishedAt)||0}`)}catch{}
 return parts.join('|');
}
function v132InstallOfflinePoll(sec=document.querySelector('.offline-settings.v126-off')){
 try{clearInterval(V126_OFF_TIMER)}catch{};if(!sec)return;V132_OFFLINE_SIG=v132OfflineSignature(sec);
 try{V126_OFF_TIMER=setInterval(()=>{if($('#settingsModal')?.classList.contains('hidden'))return;const sig=v132OfflineSignature(sec);if(sig===V132_OFFLINE_SIG)return;V132_OFFLINE_SIG=sig;v126OffRows(sec);v126Bulk(sec)},2500)}catch{}
}
try{
 const v132OfflineRebuildBase=v126RebuildOfflinePanel;
 v126RebuildOfflinePanel=function(force=true){const r=v132OfflineRebuildBase(force);v132InstallOfflinePoll(document.querySelector('.offline-settings.v126-off'));return r};
 clearInterval(V126_OFF_TIMER);v132InstallOfflinePoll();
}catch{}

/* Cleanup is useful, but doing a full protected-set scan 1.8 s after every tap to
   another tab can create a delayed hitch on very large collections. Keep it idle
   and give interactions more room. */
try{
 const v132CleanupBase=v111ScheduleCleanup;
 v111ScheduleCleanup=function(delay=3600){return v132CleanupBase(Math.max(3600,Number(delay)||0))};
}catch{}

(function v132Styles(){if($('#v132PerfStyle'))return;const s=document.createElement('style');s.id='v132PerfStyle';s.textContent=`
.v126-off-row,.v126-item{content-visibility:auto;contain-intrinsic-size:58px}.v126-off-list,.v126-list{contain:layout style}.inventory-grid{contain:layout style}.market-result-list{contain:layout style}
`;
document.head.appendChild(s)})();

window.VOXPerf={
 version:V132_VERSION,
 snapshot:()=>({lastSaveMs:Number(V132_LAST_SAVE_MS.toFixed(2)),lastSaveKiB:Number((V132_LAST_SAVE_BYTES/1024).toFixed(1)),saveCount:V132_SAVE_COUNT,pendingSave:V132_PENDING_SAVE,instances:(state.instances||[]).length,loadedSets:Object.values(state.sets||{}).filter(x=>Array.isArray(x?.cards)&&x.cards.length).length})
};
try{const d=v131Read(v131SlotKey(v131Mode()));if(d)v132WriteSummary(v131Mode(),d)}catch{}
window.__voxV132PerfReady=true;
