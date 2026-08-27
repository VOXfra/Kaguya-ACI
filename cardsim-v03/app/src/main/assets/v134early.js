'use strict';
/* VOX Card Sim V1.2.15 — early native-save migration and cloud guard.
   Before any historical gameplay script runs, copy every recoverable mode slot,
   manual checkpoint and rollback copy into Android private files. Only after a
   verified native copy exists are redundant large localStorage keys removed. */
(function v134Early(){
 const MODES=['realistic','ludic','creative'];
 const ACTIVE='voxCardSimV131_activeMode',SLOT='voxCardSimV131_slot_',MANUAL='voxCardSimV131_manual_',PREV='voxCardSimV134_previous_';
 const activeRaw=String(localStorage.getItem(ACTIVE)||localStorage.getItem('voxCardSimV08_activeMode')||localStorage.getItem('voxCardSimV127_mode')||'realistic');
 const active=MODES.includes(activeRaw)?activeRaw:'realistic';
 const valid=(raw,mode)=>{try{const d=JSON.parse(raw||'null');return!!(d&&typeof d==='object'&&Array.isArray(d.instances)&&(!d.gameMode||d.gameMode===mode))}catch{return false}};
 const parsedMode=raw=>{try{return String(JSON.parse(raw||'null')?.gameMode||'')}catch{return''}};
 const nativeReady=!!(window.VOXOffline&&typeof VOXOffline.readLocalSave==='function'&&typeof VOXOffline.writeLocalSave==='function');
 const nread=(mode,kind)=>{try{return nativeReady?String(VOXOffline.readLocalSave(mode,kind)||''):''}catch{return''}};
 const nwrite=(mode,kind,raw)=>{try{return nativeReady&&!!VOXOffline.writeLocalSave(mode,kind,raw)}catch{return false}};

 if(nativeReady){
  for(const mode of MODES){
   let slot=nread(mode,'slot');
   if(!valid(slot,mode)){
    const candidates=[localStorage.getItem(SLOT+mode),localStorage.getItem('voxCardSimV08_slot_'+mode)];
    const compat=localStorage.getItem(mode==='creative'?'voxCardSimV127_sandbox':'voxCardSimV127_campaign');
    if(compat&&parsedMode(compat)===mode)candidates.push(compat);
    const shared=localStorage.getItem('voxCardSimV06');if(shared&&parsedMode(shared)===mode)candidates.push(shared);
    const previous=localStorage.getItem(PREV+mode);if(previous)candidates.push(previous);
    slot=candidates.find(x=>valid(x,mode))||'';
    if(slot&&!nwrite(mode,'slot',slot))console.error('V1.2.15 early slot migration failed',mode);
   }
   const manual=localStorage.getItem(MANUAL+mode);if(manual&&valid(manual,mode)&&!nread(mode,'manual'))nwrite(mode,'manual',manual);
   const previous=localStorage.getItem(PREV+mode);if(previous&&valid(previous,mode)&&!nread(mode,'previous'))nwrite(mode,'previous',previous);
  }

  /* Do not remove a legacy slot unless the corresponding native slot is readable. */
  for(const mode of MODES){
   if(valid(nread(mode,'slot'),mode)){
    for(const key of [SLOT+mode,'voxCardSimV08_slot_'+mode])try{localStorage.removeItem(key)}catch{}
   }
   if(nread(mode,'manual'))try{localStorage.removeItem(MANUAL+mode)}catch{}
   if(nread(mode,'previous'))try{localStorage.removeItem(PREV+mode)}catch{}
  }
  for(const key of ['voxCardSimV06_backup','voxCardSimV127_campaign','voxCardSimV127_sandbox','voxCardSimV127_previous'])try{localStorage.removeItem(key)}catch{}

  /* One compatibility copy is enough for the old V0.x loader. V1.2.11 will use
     the native proxy before it becomes authoritative. */
  const current=nread(active,'slot');
  if(valid(current,active)){
   try{localStorage.removeItem('voxCardSimV06');localStorage.setItem('voxCardSimV06',current)}catch(e){console.warn('V1.2.15 V0 compatibility copy skipped',e)}
  }
 }else {
  /* Browser/dev fallback: retain the previous localStorage-only staging behavior. */
  let raw=localStorage.getItem(SLOT+active);
  if(!valid(raw,active)){const prev=localStorage.getItem(PREV+active);if(valid(prev,active))raw=prev}
  if(valid(raw,active))try{localStorage.setItem('voxCardSimV06',raw)}catch{}
 }
 try{localStorage.setItem(ACTIVE,active);localStorage.setItem('voxCardSimV08_activeMode',active);localStorage.setItem('voxCardSimV127_mode',active)}catch{}
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
 }catch(e){console.warn('V1.2.15 online guard',e)}
 window.__voxV134EarlyReady=true;
})();
