'use strict';

/* V0.8.2: make progression reset authoritative while Google/Firebase cloud sync is active. */
const V082_RESET_MARKER='voxCardSimV08_cloudResetPending';
let v082ResetPushTimer=0,v082ResetVerifyTimer=0,v082ResetFinishing=false;

function v082ReadResetMarker(){
 try{const raw=localStorage.getItem(V082_RESET_MARKER);if(!raw)return null;const m=JSON.parse(raw);if(!m||m.mode!=='realistic'||!m.nonce||!m.json)return null;return m}catch{return null}
}
function v082SetResetStatus(text){
 try{state.online.cloudStatus=text;v07RefreshOnlinePanel()}catch{}
}
function v082WriteResetLocally(marker){
 if(!marker?.json)return;
 localStorage.setItem(v08SlotKey(marker.mode),marker.json);
 localStorage.setItem(V06_STORAGE,marker.json);
 localStorage.setItem(V06_BACKUP,marker.json);
 localStorage.setItem(V08_MODE_META,marker.mode);
 try{window.VOXNative?.mirrorSave?.(marker.json)}catch{}
}
function v082AuthState(){
 try{return JSON.parse(window.VOXOnline?.authState?.()||'{}')}catch{return{}}
}
function v082PushReset(marker=v082ReadResetMarker()){
 if(!marker||!window.VOXOnline)return false;
 const auth=v082AuthState();if(!auth?.signedIn)return false;
 v082WriteResetLocally(marker);
 try{
  /* Replace any queued normal save with the reset payload, then flush it immediately. */
  VOXOnline.setCloudWritesEnabled(false);
  VOXOnline.queueCloudSave(marker.json);
  VOXOnline.setCloudWritesEnabled(true);
  VOXOnline.flushCloudSave();
  v082SetResetStatus('Réinitialisation cloud en cours…');
  return true;
 }catch(e){console.warn('V0.8.2 cloud reset push',e);return false}
}
function v082ScheduleResetPush(delay=120){
 clearTimeout(v082ResetPushTimer);v082ResetPushTimer=setTimeout(()=>{v082ResetPushTimer=0;v082PushReset()},delay)
}
function v082CloudContainsReset(payload,marker){
 if(!payload?.exists||!marker)return false;
 try{const d=JSON.parse(payload.json||'{}');return d.v08ResetNonce===marker.nonce&&Number(d.lastSavedAt||0)>=Number(marker.startedAt||0)}catch{return false}
}
function v082FinishReset(marker){
 if(v082ResetFinishing)return;v082ResetFinishing=true;
 v082WriteResetLocally(marker);
 localStorage.removeItem(V082_RESET_MARKER);
 v082SetResetStatus('Progression réinitialisée et sauvegardée');
 toast('Progression réinitialisée · cloud Google remplacé');
 setTimeout(()=>location.reload(),500);
}

/* v07online owns the native event bridge. Wrap it so stale cloud data can never win a reset. */
const v082OnlineEventBase=window.voxOnlineEvent;
window.voxOnlineEvent=function(type,payload){
 const marker=v082ReadResetMarker();
 if(marker){
  if(type==='cloudLoaded'){
   if(v082CloudContainsReset(payload,marker)){v082FinishReset(marker);return}
   /* This is the old Google save (or no save yet). Never apply it over the local reset. */
   v082SetResetStatus('Ancienne sauvegarde cloud ignorée · remplacement…');
   v082ScheduleResetPush(80);return;
  }
  if(type==='cloudSaved'){
   try{v082OnlineEventBase?.(type,payload)}catch{}
   v082SetResetStatus('Reset envoyé · vérification Google…');
   clearTimeout(v082ResetVerifyTimer);v082ResetVerifyTimer=setTimeout(()=>{v082ResetVerifyTimer=0;try{VOXOnline?.requestCloudSave?.()}catch{}},180);
   return;
  }
  if(type==='auth'){
   const r=v082OnlineEventBase?.(type,payload);
   if(payload?.signedIn)v082ScheduleResetPush(60);
   return r;
  }
 }
 return v082OnlineEventBase?.(type,payload);
};

/* Replace the V0.8 reset dialog. Realistic mode is not considered reset until cloud verification succeeds. */
v06ResetConfirm=function(){
 const mode=v08Mode(),m=$('#sellModal');m.classList.remove('hidden');
 const google=v07Auth?.()||{};
 $('#sellContent').innerHTML=`<span class="tag danger-tag">DANGER</span><h2>Réinitialiser le mode ${V08_MODES[mode].label} ?</h2><p>${mode==='realistic'&&google.signedIn&&!google.anonymous?'La progression locale ET la sauvegarde liée à ton compte Google seront remplacées par une partie neuve.':'Seule cette progression sera effacée. Les deux autres modes et tes amis restent intacts.'}</p><label class="profile-field">Tape RESET pour confirmer<input id="resetWord" autocomplete="off"></label><button id="resetFinal" class="danger-button" disabled>Effacer ce mode</button><small id="resetCloudState"></small>`;
 const inp=$('#resetWord'),btn=$('#resetFinal'),status=$('#resetCloudState');
 inp.oninput=()=>btn.disabled=inp.value.trim().toUpperCase()!=='RESET';
 btn.onclick=()=>{
  if(inp.value.trim().toUpperCase()!=='RESET')return;btn.disabled=true;inp.disabled=true;
  const freshObj=v08FreshSave(mode),now=Date.now();
  freshObj.friends=[...(state.friends||[])];freshObj.friendRequestsOut=[...(state.friendRequestsOut||[])];freshObj.friendDeclined=[...(state.friendDeclined||[])];
  freshObj.lastSavedAt=now;
  if(mode==='realistic'){
   freshObj.onlineCloudEnabled=true;
   freshObj.v08ResetNonce=`RESET-${now}-${Math.random().toString(36).slice(2,10)}`;
  }
  const fresh=JSON.stringify(freshObj);
  localStorage.setItem(v08SlotKey(mode),fresh);localStorage.setItem(V06_STORAGE,fresh);localStorage.setItem(V06_BACKUP,fresh);localStorage.setItem(V08_MODE_META,mode);
  try{window.VOXNative?.mirrorSave?.(fresh)}catch{}
  if(mode!=='realistic'){
   status.textContent='Progression effacée.';toast(`Mode ${V08_MODES[mode].label} réinitialisé`);setTimeout(()=>location.reload(),450);return;
  }
  const marker={mode,nonce:freshObj.v08ResetNonce,json:fresh,startedAt:now};localStorage.setItem(V082_RESET_MARKER,JSON.stringify(marker));
  status.textContent='Remplacement de la sauvegarde Google…';
  if(!v082PushReset(marker)){
   status.textContent='Reset local effectué. Le cloud sera remplacé dès que la connexion Firebase revient.';
   toast('Reset local effectué · synchronisation cloud en attente');
  }
 };
};

/* Recover safely if the app was closed halfway through a cloud reset. */
const v082PendingAtLoad=v082ReadResetMarker();
if(v082PendingAtLoad){v082WriteResetLocally(v082PendingAtLoad);v082SetResetStatus('Réinitialisation cloud à terminer…');v082ScheduleResetPush(250)}
window.__voxV082ResetReady=true;
