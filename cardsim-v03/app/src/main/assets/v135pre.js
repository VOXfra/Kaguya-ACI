'use strict';
/* VOX Card Sim V1.2.15 — native save backend preloader.
   Loaded immediately before V1.2.11. It migrates the three authoritative slots,
   manual checkpoints and local rollback copies out of WebView localStorage into
   Android private files, then transparently proxies historical V1.2 code to that
   native backend. Large compatibility duplicates are discarded after migration. */
(function v135Pre(){
 const MODES=['realistic','ludic','creative'];
 const SLOT='voxCardSimV131_slot_',MANUAL='voxCardSimV131_manual_',PREV='voxCardSimV134_previous_';
 const ACTIVE='voxCardSimV131_activeMode';
 if(!window.VOXOffline||typeof VOXOffline.readLocalSave!=='function'||typeof VOXOffline.writeLocalSave!=='function'){
  console.warn('V1.2.15 native save backend unavailable; keeping localStorage fallback');return;
 }
 const proto=Storage.prototype,rawGet=proto.getItem,rawSet=proto.setItem,rawRemove=proto.removeItem;
 const getRaw=k=>{try{return rawGet.call(localStorage,k)}catch{return null}};
 const valid=(raw,mode)=>{try{const d=JSON.parse(raw||'null');return!!(d&&typeof d==='object'&&Array.isArray(d.instances)&&(!d.gameMode||d.gameMode===mode))}catch{return false}};
 const nativeRead=(mode,kind)=>{try{return String(VOXOffline.readLocalSave(mode,kind)||'')}catch{return''}};
 const nativeWrite=(mode,kind,raw)=>{try{return!!VOXOffline.writeLocalSave(mode,kind,raw)}catch{return false}};
 const parseMode=raw=>{try{const d=JSON.parse(raw||'null');return String(d?.gameMode||'')}catch{return''}};
 const current=String(getRaw(ACTIVE)||getRaw('voxCardSimV08_activeMode')||getRaw('voxCardSimV127_mode')||'realistic');
 const active=MODES.includes(current)?current:'realistic';

 /* Migrate before deleting anything. Existing V1.2.11 slots always win. */
 for(const mode of MODES){
  let n=nativeRead(mode,'slot');
  if(!valid(n,mode)){
   const candidates=[getRaw(SLOT+mode),getRaw('voxCardSimV08_slot_'+mode)];
   const campaign=getRaw(mode==='creative'?'voxCardSimV127_sandbox':'voxCardSimV127_campaign');
   if(campaign&&parseMode(campaign)===mode)candidates.push(campaign);
   const shared=getRaw('voxCardSimV06');if(shared&&parseMode(shared)===mode)candidates.push(shared);
   const oldPrev=getRaw(PREV+mode);if(oldPrev)candidates.push(oldPrev);
   n=candidates.find(x=>valid(x,mode))||'';
   if(n&&!nativeWrite(mode,'slot',n))console.error('V1.2.15 migration failed',mode,'slot');
  }
  const manual=getRaw(MANUAL+mode);if(manual&&valid(manual,mode)&&!nativeRead(mode,'manual'))nativeWrite(mode,'manual',manual);
  const prev=getRaw(PREV+mode);if(prev&&valid(prev,mode)&&!nativeRead(mode,'previous'))nativeWrite(mode,'previous',prev);
 }

 function decodeKey(key){
  key=String(key||'');
  for(const [prefix,kind] of [[SLOT,'slot'],[MANUAL,'manual'],[PREV,'previous']]){
   if(key.startsWith(prefix)){const mode=key.slice(prefix.length);if(MODES.includes(mode))return{mode,kind}}
  }
  return null;
 }
 function redundantCompat(key){
  key=String(key||'');
  return key==='voxCardSimV06_backup'||key==='voxCardSimV127_campaign'||key==='voxCardSimV127_sandbox'||key==='voxCardSimV127_previous'||key.startsWith('voxCardSimV08_slot_');
 }

 /* Clear physical duplicates only after all three native copies exist. */
 for(const mode of MODES){for(const key of [SLOT+mode,MANUAL+mode,PREV+mode,'voxCardSimV08_slot_'+mode])try{rawRemove.call(localStorage,key)}catch{}}
 for(const key of ['voxCardSimV06_backup','voxCardSimV127_campaign','voxCardSimV127_sandbox','voxCardSimV127_previous'])try{rawRemove.call(localStorage,key)}catch{}

 /* Keep a single shared compatibility copy for the very old boot path. */
 const activeRaw=nativeRead(active,'slot');
 if(valid(activeRaw,active)){
  try{rawRemove.call(localStorage,'voxCardSimV06');rawSet.call(localStorage,'voxCardSimV06',activeRaw)}catch(e){console.warn('V1.2.15 legacy boot staging skipped',e)}
 }
 try{rawSet.call(localStorage,ACTIVE,active);rawSet.call(localStorage,'voxCardSimV08_activeMode',active);rawSet.call(localStorage,'voxCardSimV127_mode',active)}catch{}

 /* From this point on, historical code can keep using its old key names. The
    actual slot/manual/previous bytes live in Android files. */
 proto.getItem=function(key){
  if(this===localStorage){const d=decodeKey(key);if(d){const n=nativeRead(d.mode,d.kind);return n||null}}
  return rawGet.call(this,key);
 };
 proto.setItem=function(key,value){
  if(this===localStorage){
   const d=decodeKey(key);if(d){if(!nativeWrite(d.mode,d.kind,String(value)))throw new Error('native-save-write-failed');return}
   if(redundantCompat(key))return;
  }
  return rawSet.call(this,key,String(value));
 };
 proto.removeItem=function(key){
  if(this===localStorage){const d=decodeKey(key);if(d){try{VOXOffline.deleteLocalSave(d.mode,d.kind)}catch{};return}if(redundantCompat(key))return}
  return rawRemove.call(this,key);
 };
 window.__voxV135NativeStorage={version:'1.2.15-native-files',active,read:nativeRead,write:nativeWrite};
 window.__voxV135PreReady=true;
})();
