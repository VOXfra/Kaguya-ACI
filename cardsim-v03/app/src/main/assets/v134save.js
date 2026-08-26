'use strict';
/* V1.2.14 — local saves are the only gameplay authority. */
const V134_VERSION='1.2.14-local-authority';
const V134_PREVIOUS_PREFIX='voxCardSimV134_previous_';
const V134_REV_PREFIX='voxCardSimV134_revision_';

function v134Mode(){try{return v131Mode()}catch{return String(state?.gameMode||'realistic')}}
function v134Parse(raw){try{return raw?JSON.parse(raw):null}catch{return null}}
function v134NextRevision(mode){const key=V134_REV_PREFIX+mode,n=(Number(localStorage.getItem(key))||0)+1;localStorage.setItem(key,String(n));return n}
function v134Snapshot(mode=v134Mode(),reason='auto'){
 let d=null;try{d=typeof v132Snapshot==='function'?v132Snapshot(mode):v131Snapshot(mode)}catch{d=v131Snapshot(mode)}
 d.gameMode=mode;d.version=Math.max(134,Number(d.version)||0);d.schemaVersion=Math.max(134,Number(d.schemaVersion)||0);d.lastSavedAt=Date.now();
 d.v134={revision:v134NextRevision(mode),reason:String(reason||'auto'),savedAt:d.lastSavedAt,authority:'local'};return d;
}
function v134WriteSlot(mode,json,keepPrevious=false){
 JSON.parse(json);const key=v131SlotKey(mode),old=localStorage.getItem(key);
 localStorage.setItem(key,json);
 if(localStorage.getItem(key)!==json)throw new Error('local-write-verification-failed');
 if(keepPrevious&&old&&old!==json)try{localStorage.setItem(V134_PREVIOUS_PREFIX+mode,old)}catch(e){console.warn('V1.2.14 rollback copy',e)}
 return true;
}
function v134Compat(mode,json){
 try{
  localStorage.setItem('voxCardSimV06',json);localStorage.setItem('voxCardSimV06_backup',json);localStorage.setItem('voxCardSimV08_slot_'+mode,json);
  localStorage.setItem('voxCardSimV08_activeMode',mode);localStorage.setItem('voxCardSimV127_mode',mode);
  if(mode==='creative')localStorage.setItem('voxCardSimV127_sandbox',json);else localStorage.setItem('voxCardSimV127_campaign',json);
 }catch(e){console.warn('V1.2.14 compat',e)}
 try{VOXOnline?.setCloudWritesEnabled?.(false)}catch{}
 try{VOXNative?.mirrorSave?.(json)}catch{}
}
function v134Commit(reason='auto',manual=false,compat=null){
 try{v132CancelQueuedSave?.()}catch{}
 const mode=v134Mode(),critical=manual||reason!=='auto',d=v134Snapshot(mode,reason),json=JSON.stringify(d);
 v134WriteSlot(mode,json,critical);
 if(manual)localStorage.setItem(v131ManualKey(mode),json);
 try{v132WriteSummary?.(mode,d)}catch{}
 if(compat===true||(compat===null&&critical))v134Compat(mode,json);
 state.__v122Dirty=false;state.__v131LastSaveReason=reason;state.__v131LastSavedAt=d.lastSavedAt;try{v122UpdateSaveUi?.()}catch{};return d;
}
function v134StageCompatibility(mode,d){const x=d||v131Read(v131SlotKey(mode));if(!x)return null;v134Compat(mode,JSON.stringify({...x,gameMode:mode}));return x}

try{v132Commit=v134Commit}catch{}
try{v131Commit=v134Commit}catch{}
try{v132StageCompatibility=v134StageCompatibility}catch{}
try{v131StageCompatibility=v134StageCompatibility}catch{}
save=function(){return typeof v132QueueAutoSave==='function'?v132QueueAutoSave(420):v134Commit('auto',false,false)};
window.v122ForceSave=function(){return v134Commit('checkpoint',false,true)};
window.v122Checkpoint=function(reason='modification'){
 const auto=typeof v122AutoSaveEnabled==='function'?v122AutoSaveEnabled():true;
 if(!auto){state.__v122Dirty=true;state.__v122DirtyReason=reason;try{v122UpdateSaveUi?.()}catch{};return null}
 return v134Commit(String(reason||'checkpoint'),false,true);
};
window.v122ManualSave=function(){
 try{const d=v134Commit('manual',true,true);toast(`Sauvegardé localement · ${V08_MODES?.[d.gameMode]?.label||d.gameMode}`);try{v131RenderSavePanel?.()}catch{};return d}
 catch(e){console.error('V1.2.14 manual save',e);toast('Échec de la sauvegarde locale · partie précédente conservée');return null}
};
window.v131RestoreManual=function(){
 const mode=v134Mode(),raw=localStorage.getItem(v131ManualKey(mode)),d=v134Parse(raw);if(!d)return toast('Aucune sauvegarde manuelle pour ce mode'),false;
 try{if(String(d.gameMode||mode)!==mode)throw new Error('manual-mode-mismatch');const current=localStorage.getItem(v131SlotKey(mode));if(current)localStorage.setItem(V134_PREVIOUS_PREFIX+mode,current);v134WriteSlot(mode,raw,false);v131Apply(d,mode);v134Compat(mode,raw);toast('Point manuel restauré');setTimeout(()=>location.reload(),120);return true}
 catch(e){console.error('V1.2.14 manual restore',e);toast('Point manuel invalide · partie actuelle conservée');return false}
};
try{VOXOnline?.setCloudWritesEnabled?.(false)}catch{}
window.__voxV134Ready=true;
