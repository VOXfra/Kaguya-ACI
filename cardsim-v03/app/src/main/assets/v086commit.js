'use strict';

/* V0.8.6 — make mode changes and resets commit atomically across WebView reload/pagehide. */
let v086TransitionLocked=false;
const v086SaveBase=save;
save=function(){
 if(v086TransitionLocked||window.__voxCommitTransition)return;
 return v086SaveBase();
};
function v086LockTransition(){
 v086TransitionLocked=true;window.__voxCommitTransition=true;
 try{if(typeof v072SaveTimer!=='undefined'&&v072SaveTimer){clearTimeout(v072SaveTimer);v072SaveTimer=0}}catch{}
}
function v086Reload(delay=120){setTimeout(()=>location.reload(),delay)}
function v086WriteSlot(mode,json){
 localStorage.setItem(V084_MODE_META,mode);
 localStorage.setItem(V084_SLOT_PREFIX+mode,json);
 localStorage.setItem(V06_STORAGE,json);
 localStorage.setItem(V06_BACKUP,json);
}

/* MODE SWITCH: lock BEFORE writing the destination slot so pagehide cannot restore the old mode. */
v08SwitchMode=function(mode){
 if(!V084_VALID_MODES.has(mode)||mode===v084ActiveMode())return;
 const current=v084ActiveMode();state.gameMode=current;
 /* Persist the current slot before entering the atomic transition. */
 v086SaveBase();
 let json=localStorage.getItem(V084_SLOT_PREFIX+mode);
 if(!json){const fresh=v08FreshSave(mode);fresh.gameMode=mode;fresh.lastSavedAt=Date.now();json=JSON.stringify(fresh)}
 try{
  const d=JSON.parse(json);d.gameMode=mode;d.version=Math.max(8,Number(d.version)||0);d.schemaVersion=Math.max(8,Number(d.schemaVersion)||0);d.lastSavedAt=Number(d.lastSavedAt)||Date.now();json=JSON.stringify(d);
 }catch{const d=v08FreshSave(mode);d.gameMode=mode;d.lastSavedAt=Date.now();json=JSON.stringify(d)}
 v086LockTransition();
 state.gameMode=mode;
 v086WriteSlot(mode,json);
 try{VOXOnline?.setCloudWritesEnabled?.(false)}catch{}
 toast(`Mode ${V08_MODES[mode].label} validé`);
 v086Reload(180);
};

/* NORMAL RESET: same atomic rule. Realistic cloud reset still uses the verified nonce flow. */
v06ResetConfirm=function(){
 const mode=v084ActiveMode(),m=$('#sellModal');m.classList.remove('hidden');const google=typeof v07Auth==='function'?(v07Auth()||{}):{};
 $('#sellContent').innerHTML=`<span class="tag danger-tag">DANGER</span><h2>Réinitialiser le mode ${V08_MODES[mode].label} ?</h2><p>${mode==='realistic'&&google.signedIn&&!google.anonymous?'La progression locale ET la sauvegarde liée à ton compte Google seront remplacées par une partie neuve.':'Seule cette progression sera effacée. Les deux autres modes et tes amis restent intacts.'}</p><label class="profile-field">Tape RESET pour confirmer<input id="resetWord" autocomplete="off" autocapitalize="characters" spellcheck="false"></label><button id="resetFinal" class="danger-button" disabled>Effacer ce mode</button><small id="resetCloudState"></small>`;
 const inp=$('#resetWord'),btn=$('#resetFinal'),status=$('#resetCloudState');
 const sync=()=>{btn.disabled=inp.value.trim().toUpperCase()!=='RESET'};inp.oninput=sync;inp.onkeyup=sync;
 btn.onclick=()=>{
  if(inp.value.trim().toUpperCase()!=='RESET')return;btn.disabled=true;inp.disabled=true;
  const freshObj=v08FreshSave(mode),now=Date.now();freshObj.friends=[...(state.friends||[])];freshObj.friendRequestsOut=[...(state.friendRequestsOut||[])];freshObj.friendDeclined=[...(state.friendDeclined||[])];freshObj.lastSavedAt=now;
  if(mode==='realistic'){freshObj.onlineCloudEnabled=true;freshObj.v08ResetNonce=`RESET-${now}-${Math.random().toString(36).slice(2,10)}`}
  const fresh=JSON.stringify(freshObj);
  v086LockTransition();state.gameMode=mode;v086WriteSlot(mode,fresh);try{VOXNative?.mirrorSave?.(fresh)}catch{}
  if(mode!=='realistic'){
   status.textContent='Progression effacée.';toast(`Mode ${V08_MODES[mode].label} réinitialisé`);v086Reload(180);return;
  }
  const marker={mode:'realistic',nonce:freshObj.v08ResetNonce,json:fresh,startedAt:now};localStorage.setItem(V082_RESET_MARKER,JSON.stringify(marker));status.textContent='Remplacement de la sauvegarde Google…';
  if(typeof v082PushReset==='function'&&v082PushReset(marker))return;
  status.textContent='Reset local validé · synchronisation Google en attente.';toast('Reset local validé · cloud en attente');
 };
};

/* Cloud verification may finish later. Keep the transition lock through the final reload. */
if(typeof v082FinishReset==='function'){
 v082FinishReset=function(marker){
  if(v082ResetFinishing)return;v082ResetFinishing=true;v086LockTransition();
  v082WriteResetLocally(marker);localStorage.removeItem(V082_RESET_MARKER);v082SetResetStatus('Progression réinitialisée et sauvegardée');toast('Progression réinitialisée · cloud Google remplacé');v086Reload(180);
 };
}

/* FORCE RESET: preserve cards + 1000 EUR, but commit the new state atomically. */
v084StartForceReset=function(){
 const mode=v084ActiveMode(),m=$('#sellModal');m.classList.remove('hidden'),kept=v084KeptCards().length;
 $('#sellContent').innerHTML=`<span class="tag danger-tag">RÉPARATION</span><h2>Force Reset · ${V08_MODES[mode].label}</h2><p>Cette opération conserve <strong>${kept} carte(s)</strong>, remet le solde à <strong>1 000 €</strong> et efface le reste de la progression de ce mode.</p><p>Les réglages, amis et ton identité de compte restent conservés.</p><label class="profile-field">Tape FORCE pour confirmer<input id="forceResetWord" autocomplete="off" autocapitalize="characters" spellcheck="false"></label><button id="forceResetFinal" class="danger-button" disabled>Force Reset</button><small id="forceResetState"></small>`;
 const inp=$('#forceResetWord'),btn=$('#forceResetFinal'),status=$('#forceResetState');const sync=()=>{btn.disabled=inp.value.trim().toUpperCase()!=='FORCE'};inp.oninput=sync;inp.onkeyup=sync;
 btn.onclick=()=>{
  if(inp.value.trim().toUpperCase()!=='FORCE')return;btn.disabled=true;inp.disabled=true;
  const d=v084BuildForceReset(mode),now=Date.now();if(mode==='realistic'){d.onlineCloudEnabled=true;d.v08ResetNonce=`FORCE-${now}-${Math.random().toString(36).slice(2,10)}`;d.lastSavedAt=now}
  const json=JSON.stringify(d);v086LockTransition();state.gameMode=mode;v086WriteSlot(mode,json);try{VOXNative?.mirrorSave?.(json)}catch{}
  if(mode==='realistic'){
   const marker={mode:'realistic',nonce:d.v08ResetNonce,json,startedAt:now};localStorage.setItem(V082_RESET_MARKER,JSON.stringify(marker));status.textContent='Force Reset validé · remplacement du cloud Google…';if(typeof v082PushReset==='function'&&v082PushReset(marker))return;toast('Force Reset local validé · cloud en attente');return;
  }
  try{VOXOnline?.setCloudWritesEnabled?.(false)}catch{};status.textContent='Progression réparée.';toast(`${V08_MODES[mode].label} réparé · ${d.instances.length} cartes · 1 000 €`);v086Reload(180);
 };
};

/* Existing settings panels may have been created before this layer loaded: rebind them explicitly. */
function v086RebindSettingsActions(){
 document.querySelectorAll('[data-v08-mode]').forEach(b=>b.onclick=()=>v08SwitchMode(b.dataset.v08Mode));
 const reset=$('#resetProgressBtn');if(reset)reset.onclick=v06ResetConfirm;
 const force=$('#v084ForceResetBtn');if(force)force.onclick=v084StartForceReset;
}
const v086RenderSettingsBase=renderSettings;
renderSettings=function(){const r=v086RenderSettingsBase();v086RebindSettingsActions();return r};
setTimeout(v086RebindSettingsActions,250);
window.__voxV086CommitReady=true;
