'use strict';
/* VOX Card Sim V1.2.14 — local authority, early guard.
   Runs synchronously before the historical V0.3 load(). The V1.2.11 per-mode
   local slot is staged into compatibility keys first, so legacy boot code never
   starts from an older shared save. Cloud payloads are buffered only: they can
   never auto-apply or trigger a reload. */
(function v134Early(){
 const MODES=new Set(['realistic','ludic','creative']);
 const active=String(localStorage.getItem('voxCardSimV131_activeMode')||localStorage.getItem('voxCardSimV08_activeMode')||'realistic');
 const mode=MODES.has(active)?active:'realistic';
 const slotKey='voxCardSimV131_slot_'+mode;
 let raw=localStorage.getItem(slotKey);
 const valid=(s)=>{try{const d=JSON.parse(s||'null');return!!(d&&typeof d==='object'&&Array.isArray(d.instances)&&(!d.gameMode||d.gameMode===mode))}catch{return false}};
 if(!valid(raw)){
  const prev=localStorage.getItem('voxCardSimV134_previous_'+mode);
  if(valid(prev)){raw=prev;try{localStorage.setItem(slotKey,prev)}catch{}}
 }
 if(!valid(raw)){
  try{
   const nativeRaw=window.VOXNative?.getMirroredSave?.();
   if(valid(nativeRaw)){raw=nativeRaw;localStorage.setItem(slotKey,nativeRaw)}
  }catch{}
 }
 if(valid(raw)){
  try{
   localStorage.setItem('voxCardSimV06',raw);
   localStorage.setItem('voxCardSimV06_backup',raw);
   localStorage.setItem('voxCardSimV08_slot_'+mode,raw);
   localStorage.setItem('voxCardSimV08_activeMode',mode);
   localStorage.setItem('voxCardSimV127_mode',mode);
  }catch(e){console.warn('V1.2.14 early local stage',e)}
 }
 try{window.VOXOnline?.setCloudWritesEnabled?.(false)}catch{}

 /* OnlineBridge may emit cloudLoaded before late V1.2 layers exist. Keep a stable
    dispatcher in front of every handler assigned by historical scripts. */
 let assigned=null;
 const dispatch=function(type,payload){
  if(type==='cloudLoaded'){
   window.__voxV134CloudPayload=payload||{exists:false};
   try{window.dispatchEvent(new CustomEvent('vox-v134-cloud-loaded',{detail:window.__voxV134CloudPayload}))}catch{}
   return;
  }
  if(type==='cloudSaved'){
   try{window.dispatchEvent(new CustomEvent('vox-v134-cloud-saved',{detail:payload||{}}))}catch{}
  }
  if(type==='auth')try{window.VOXOnline?.setCloudWritesEnabled?.(false)}catch{}
  if(typeof assigned==='function')return assigned(type,payload);
 };
 try{
  Object.defineProperty(window,'voxOnlineEvent',{
   configurable:true,
   enumerable:true,
   get(){return dispatch},
   set(fn){assigned=typeof fn==='function'?fn:null;window.__voxV134LegacyOnlineHandler=assigned}
  });
 }catch(e){console.warn('V1.2.14 online guard',e)}
 window.__voxV134EarlyReady=true;
})();
