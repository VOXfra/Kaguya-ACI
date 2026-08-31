'use strict';
/* VOX Card Sim V1.2.9 — authoritative mode switch.
   The legacy V0.8/V0.8.6 handlers are still present for compatibility, but no
   longer get a chance to own a user click. Every visible mode control goes
   through this one transition and Realistic/Ludic always keep the same campaign. */
const V129_VERSION='1.2.9-mode-switch-authority';
const V129_VALID_MODES=new Set(['realistic','ludic','creative']);
let V129_SWITCHING=false;

function v129Read(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function v129Mode(){
 const m=String(state?.gameMode||localStorage.getItem('voxCardSimV127_mode')||localStorage.getItem('voxCardSimV08_activeMode')||'realistic');
 return V129_VALID_MODES.has(m)?m:'realistic';
}
function v129Fresh(mode){
 try{if(typeof v08FreshSave==='function')return v08FreshSave(mode)}catch{}
 return {version:129,schemaVersion:129,gameMode:mode,wallet:mode==='creative'?0:250,instances:[],stock:{},stockLots:{},binderOwned:{},discoveredCards:{},ludicRewards:{twentyMilestone:0,completedSets:{},boosterCount:0,totalBonus:0},lastSavedAt:Date.now()};
}
function v129Apply(data,mode){
 if(typeof v127Apply==='function'&&data)return v127Apply(data,mode);
 if(data)Object.assign(state,JSON.parse(JSON.stringify(data)));
 state.gameMode=mode;return true;
}
function v129Commit(reason){
 if(typeof v127Commit==='function')return v127Commit(reason,false);
 try{save()}catch{}
 return null;
}
function v129PersistMode(mode){
 localStorage.setItem('voxCardSimV127_mode',mode);
 localStorage.setItem('voxCardSimV08_activeMode',mode);
 state.gameMode=mode;
}
function v129TargetSnapshot(mode,current){
 if(mode==='creative'){
  let d=v129Read('voxCardSimV127_sandbox');
  if(!d){d=v129Fresh('creative');try{localStorage.setItem('voxCardSimV127_sandbox',JSON.stringify(d))}catch{}}
  return d;
 }
 if(current==='creative'){
  let d=v129Read('voxCardSimV127_campaign');
  if(!d){d=v129Fresh(mode);try{localStorage.setItem('voxCardSimV127_campaign',JSON.stringify(d))}catch{}}
  return d;
 }
 return null;
}
function v129SwitchMode(mode){
 mode=String(mode||'');if(!V129_VALID_MODES.has(mode))return false;
 const current=v129Mode();
 if(mode===current){try{toast(`Mode ${V08_MODES?.[mode]?.label||mode} déjà actif`)}catch{};return true}
 if(V129_SWITCHING)return false;V129_SWITCHING=true;
 try{
  /* Save the source explicitly, even when autosave is disabled. A mode change is
     a persistence boundary, not a cosmetic preference. */
  v129Commit('mode-switch-source');
  const target=v129TargetSnapshot(mode,current);
  if(target)v129Apply(target,mode);else state.gameMode=mode;
  v129PersistMode(mode);

  /* Entering Ludic must seed its reward baseline before the target snapshot is
     committed, otherwise existing campaign progress could be rewarded again. */
  if(mode==='ludic')try{if(typeof v128SeedLudicBaseline==='function')v128SeedLudicBaseline()}catch(e){console.warn('V1.2.9 ludic baseline',e)}
  v129Commit('mode-switch-target');

  const key=mode==='creative'?'voxCardSimV127_sandbox':'voxCardSimV127_campaign';
  const persisted=v129Read(key);
  if(!persisted||String(persisted.gameMode)!==mode)throw new Error(`mode-persist-failed:${mode}`);

  try{VOXOnline?.setCloudWritesEnabled?.(mode==='realistic'&&state.onlineCloudEnabled!==false)}catch{}
  try{toast(mode==='creative'?'Créatif activé · bac à sable séparé':`${V08_MODES?.[mode]?.label||mode} activé · campagne conservée`)}catch{}
  setTimeout(()=>location.reload(),140);
  /* Safety unlock only matters if Android somehow suppresses reload. */
  setTimeout(()=>{V129_SWITCHING=false;try{v129RenderModeSettings()}catch{}},1800);
  return true;
 }catch(e){
  console.error('V1.2.9 mode switch',e);V129_SWITCHING=false;
  try{toast('Impossible de changer de mode · sauvegarde inchangée')}catch{}
  return false;
 }
}
window.v129SwitchMode=v129SwitchMode;
window.v08SwitchMode=v129SwitchMode;

/* Capture phase is deliberate: old data-v08-mode/data-v127-mode onclick handlers
   are stopped before they can overwrite the unified campaign transition. */
document.addEventListener('click',e=>{
 const b=e.target?.closest?.('[data-v129-mode],[data-v127-mode],[data-v08-mode]');if(!b)return;
 const mode=b.dataset.v129Mode||b.dataset.v127Mode||b.dataset.v08Mode;if(!V129_VALID_MODES.has(mode))return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();v129SwitchMode(mode);
},true);

function v129RenderModeSettings(){
 const card=$('#settingsModal .modal-card');if(!card)return;
 document.querySelectorAll('#v08ModeSettings,.v08-mode-settings,#v127ModeSettings,#v129ModeSettings').forEach(x=>x.remove());
 const mode=v129Mode(),sec=document.createElement('div');sec.id='v129ModeSettings';sec.className='v129-mode-settings';
 sec.innerHTML=`<div class="v129-mode-head"><div><span class="tag">MODE DE JEU</span><h3>${mode==='creative'?'Créatif':`Campagne · ${V08_MODES?.[mode]?.label||mode}`}</h3></div><small>Réaliste et Ludique utilisent exactement la même sauvegarde.</small></div><div class="v129-mode-grid"><button type="button" data-v129-mode="realistic" class="${mode==='realistic'?'active':''}"><strong>Réaliste</strong><span>Économie stricte · marché complet</span></button><button type="button" data-v129-mode="ludic" class="${mode==='ludic'?'active':''}"><strong>Ludique</strong><span>Même campagne · bonus de progression</span></button><button type="button" data-v129-mode="creative" class="creative ${mode==='creative'?'active':''}"><strong>Créatif</strong><span>Bac à sable séparé · progression de campagne protégée</span></button></div>`;
 const save=$('#v122SaveSettings');if(save)card.insertBefore(sec,save);else card.appendChild(sec);
}
const v129RenderSettingsBase=renderSettings;
renderSettings=function(){const r=v129RenderSettingsBase();v129RenderModeSettings();return r};

(function v129Style(){
 if($('#v129Style'))return;const s=document.createElement('style');s.id='v129Style';s.textContent=`
 .v129-mode-settings{margin-top:16px;padding:16px;border:1px solid #29364a;border-radius:18px;background:linear-gradient(145deg,#111a27,#0d141f)}
 .v129-mode-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}.v129-mode-head h3{margin:7px 0 0}.v129-mode-head small{max-width:50%;text-align:right;color:#8e9aad;line-height:1.4}
 .v129-mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px}.v129-mode-grid button{min-height:72px;padding:12px 13px;border:1px solid #2d394a;border-radius:14px;background:#101720;color:#eef2f8;display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:4px}.v129-mode-grid button span{font-size:11px;color:#929eaf;line-height:1.35}.v129-mode-grid button.active{border-color:#efb93c;box-shadow:0 0 0 1px #efb93c33 inset;background:#182234}.v129-mode-grid button.creative{grid-column:1/-1}
 @media(max-width:520px){.v129-mode-head{display:block}.v129-mode-head small{display:block;max-width:none;text-align:left;margin-top:7px}.v129-mode-grid{grid-template-columns:1fr}.v129-mode-grid button.creative{grid-column:auto}}
 `;document.head.appendChild(s)
})();

try{v129RenderModeSettings();v08RefreshModePill?.()}catch{}
window.__voxV129Ready=true;
