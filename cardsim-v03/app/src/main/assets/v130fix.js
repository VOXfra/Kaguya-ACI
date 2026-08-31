'use strict';
/* VOX Card Sim V1.2.10 — difficulty is metadata, not a save-slot identity.
   Realistic <-> Ludic changes only the rules applied to the SAME campaign.
   Validation protects actual progression instead of requiring campaign.gameMode
   to mirror the selected difficulty. Legacy mode/reset UI is removed for good. */
const V130_VERSION='1.2.10-difficulty-metadata';
const V130_VALID=new Set(['realistic','ludic','creative']);
let V130_SWITCHING=false;

function v130Parse(raw){try{return raw?JSON.parse(raw):null}catch{return null}}
function v130Clone(x){try{return JSON.parse(JSON.stringify(x))}catch{return null}}
function v130Read(key){return v130Parse(localStorage.getItem(key))}
function v130Mode(){
 const m=String(localStorage.getItem('voxCardSimV127_mode')||state?.gameMode||localStorage.getItem('voxCardSimV08_activeMode')||'realistic');
 return V130_VALID.has(m)?m:'realistic';
}
function v130SetMode(mode){
 localStorage.setItem('voxCardSimV127_mode',mode);
 localStorage.setItem('voxCardSimV08_activeMode',mode);
 state.gameMode=mode;
}
function v130OwnedCards(d){return Array.isArray(d?.instances)?d.instances.filter(x=>x&&x.status!=='sold').length:0}
function v130Discovered(d){return Object.keys(d?.discoveredCards||{}).length}
function v130Binders(d){return Object.values(d?.binderOwned||{}).filter(Boolean).length}
function v130Stock(d){return Object.values(d?.stock||{}).reduce((n,v)=>n+Math.max(0,Number(v)||0),0)}
function v130Fingerprint(d){return{
 wallet:Number(d?.wallet)||0,
 cards:v130OwnedCards(d),
 discovered:v130Discovered(d),
 binders:v130Binders(d),
 stock:v130Stock(d)
}}
function v130SameProgress(a,b){
 const x=v130Fingerprint(a),y=v130Fingerprint(b);
 return Math.abs(x.wallet-y.wallet)<0.001&&x.cards===y.cards&&x.discovered===y.discovered&&x.binders===y.binders&&x.stock===y.stock;
}
function v130Snapshot(mode){
 let d=null;try{d=typeof v127Snapshot==='function'?v127Snapshot(mode):v130Clone(state)}catch{d=v130Clone(state)}
 d=d||{};d.gameMode=mode;d.lastSavedAt=Date.now();return d;
}
function v130WriteCampaign(d,mode){
 const x=v130Clone(d)||{};x.gameMode=mode;x.lastSavedAt=Date.now();
 localStorage.setItem('voxCardSimV127_campaign',JSON.stringify(x));
 try{if(typeof v127WriteCompatibility==='function')v127WriteCompatibility(x,'campaign')}catch(e){console.warn('V1.2.10 compatibility',e)}
 return x;
}
function v130WriteSandbox(d){
 const x=v130Clone(d)||{};x.gameMode='creative';x.lastSavedAt=Date.now();
 localStorage.setItem('voxCardSimV127_sandbox',JSON.stringify(x));
 try{if(typeof v127WriteCompatibility==='function')v127WriteCompatibility(x,'sandbox')}catch(e){console.warn('V1.2.10 sandbox compatibility',e)}
 return x;
}
function v130Apply(d,mode){
 if(typeof v127Apply==='function')return v127Apply(d,mode);
 if(d)Object.assign(state,v130Clone(d));state.gameMode=mode;return true;
}
function v130FreshCreative(){
 try{if(typeof v08FreshSave==='function')return v08FreshSave('creative')}catch{}
 return {version:130,schemaVersion:130,gameMode:'creative',wallet:0,instances:[],stock:{},stockLots:{},binderOwned:{},discoveredCards:{},lastSavedAt:Date.now()};
}
function v130RestoreOnFailure(sourceMode,campaign,sandbox){
 try{
  if(campaign)localStorage.setItem('voxCardSimV127_campaign',JSON.stringify(campaign));
  if(sandbox)localStorage.setItem('voxCardSimV127_sandbox',JSON.stringify(sandbox));
  const target=sourceMode==='creative'?sandbox:campaign;if(target)v130Apply(target,sourceMode);
  v130SetMode(sourceMode);
 }catch(e){console.error('V1.2.10 restore failure',e)}
}
function v130SwitchMode(mode){
 mode=String(mode||'');if(!V130_VALID.has(mode)||V130_SWITCHING)return false;
 const current=v130Mode();if(mode===current){try{toast(`${V08_MODES?.[mode]?.label||mode} déjà actif`)}catch{};return true}
 V130_SWITCHING=true;
 let sourceCampaign=null,sourceSandbox=null;
 try{
  /* Commit current state before leaving it, independent of autosave preference. */
  if(current==='creative'){
   sourceSandbox=v130Snapshot('creative');v130WriteSandbox(sourceSandbox);
   sourceCampaign=v130Read('voxCardSimV127_campaign');
  }else{
   try{if(typeof v127Commit==='function')v127Commit('v130-mode-source',false)}catch(e){console.warn('V1.2.10 source commit',e)}
   sourceCampaign=v130Read('voxCardSimV127_campaign')||v130Snapshot(current);
   sourceSandbox=v130Read('voxCardSimV127_sandbox');
  }

  if(current!=='creative'&&mode!=='creative'){
   /* SAME campaign: do not load another slot and do not judge success from the
      gameMode field stored inside the campaign object. */
   const before=v130Clone(sourceCampaign)||v130Snapshot(current);
   v130Apply(before,mode);v130SetMode(mode);
   if(mode==='ludic')try{v128SeedLudicBaseline?.()}catch(e){console.warn('V1.2.10 Ludic baseline',e)}
   const after=v130Snapshot(mode);
   if(!v130SameProgress(before,after))throw new Error('campaign-progress-changed');
   v130WriteCampaign(after,mode);v130SetMode(mode);
  }else if(mode==='creative'){
   let sandbox=sourceSandbox||v130FreshCreative();v130Apply(sandbox,'creative');v130SetMode('creative');v130WriteSandbox(v130Snapshot('creative'));
  }else {
   let campaign=sourceCampaign||v130Read('voxCardSimV127_campaign');
   if(!campaign)throw new Error('campaign-missing');
   v130Apply(campaign,mode);v130SetMode(mode);
   if(mode==='ludic')try{v128SeedLudicBaseline?.()}catch(e){console.warn('V1.2.10 Ludic baseline',e)}
   v130WriteCampaign(v130Snapshot(mode),mode);v130SetMode(mode);
  }

  /* The authoritative success condition is the difficulty marker. */
  if(localStorage.getItem('voxCardSimV127_mode')!==mode)throw new Error('difficulty-marker-write-failed');
  try{VOXOnline?.setCloudWritesEnabled?.(mode==='realistic'&&state.onlineCloudEnabled!==false)}catch{}
  try{if(mode!=='creative')v128MirrorCampaign?.()}catch{}
  try{toast(mode==='creative'?'Créatif activé · campagne protégée':`${V08_MODES?.[mode]?.label||mode} activé · même campagne`)}catch{}
  setTimeout(()=>location.reload(),120);
  return true;
 }catch(e){
  console.error('V1.2.10 mode switch',e);v130RestoreOnFailure(current,sourceCampaign,sourceSandbox);V130_SWITCHING=false;
  try{toast('Changement annulé · progression protégée')}catch{}
  return false;
 }
}
window.v130SwitchMode=v130SwitchMode;window.v129SwitchMode=v130SwitchMode;window.v08SwitchMode=v130SwitchMode;

/* Capture every historical mode control before its legacy handler can run. */
document.addEventListener('click',e=>{
 const b=e.target?.closest?.('[data-v130-mode],[data-v129-mode],[data-v127-mode],[data-v08-mode]');if(!b)return;
 const mode=b.dataset.v130Mode||b.dataset.v129Mode||b.dataset.v127Mode||b.dataset.v08Mode;if(!V130_VALID.has(mode))return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();v130SwitchMode(mode);
},true);

function v130RemoveLegacy(){
 document.querySelectorAll('#v08ModeIntro,#v08ModeSettings,.v08-mode-settings,#v084ForceResetPanel,#v127ModeSettings,#v129ModeSettings,#v130ModeSettings').forEach(x=>x.remove());
}
function v130RenderModeSettings(){
 const card=$('#settingsModal .modal-card');if(!card)return;v130RemoveLegacy();
 const mode=v130Mode(),sec=document.createElement('div');sec.id='v130ModeSettings';sec.className='v130-mode-settings';
 sec.innerHTML=`<div class="v130-head"><div><span class="tag">MODE DE JEU</span><h3>${mode==='creative'?'Créatif':`Campagne · ${V08_MODES?.[mode]?.label||mode}`}</h3></div><small>${mode==='creative'?'Bac à sable séparé':'Même sauvegarde · difficulté modifiable librement'}</small></div><div class="v130-grid"><button type="button" data-v130-mode="realistic" class="${mode==='realistic'?'active':''}"><strong>Réaliste</strong><span>Économie stricte · marché complet</span></button><button type="button" data-v130-mode="ludic" class="${mode==='ludic'?'active':''}"><strong>Ludique</strong><span>Même campagne · bonus de progression</span></button><button type="button" data-v130-mode="creative" class="creative ${mode==='creative'?'active':''}"><strong>Créatif</strong><span>Bac à sable séparé · campagne protégée</span></button></div>`;
 const save=$('#v122SaveSettings');if(save)card.insertBefore(sec,save);else card.appendChild(sec);
}
const v130RenderSettingsBase=renderSettings;
renderSettings=function(){const r=v130RenderSettingsBase();v130RenderModeSettings();return r};

/* Old wrappers can append Force Reset after a render. Remove it whenever it reappears. */
const v130Observer=new MutationObserver(()=>{
 document.querySelectorAll('#v084ForceResetPanel,#v08ModeSettings,.v08-mode-settings,#v127ModeSettings,#v129ModeSettings').forEach(x=>x.remove());
});
try{v130Observer.observe(document.body,{childList:true,subtree:true})}catch{}

(function(){if($('#v130Style'))return;const s=document.createElement('style');s.id='v130Style';s.textContent=`
.v130-mode-settings{margin-top:16px;padding:16px;border:1px solid #29364a;border-radius:18px;background:linear-gradient(145deg,#111a27,#0d141f)}.v130-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.v130-head h3{margin:7px 0 0}.v130-head small{max-width:48%;text-align:right;color:#8e9aad;line-height:1.4}.v130-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px}.v130-grid button{min-height:72px;padding:12px 13px;border:1px solid #2d394a;border-radius:14px;background:#101720;color:#eef2f8;display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:4px}.v130-grid button span{font-size:11px;color:#929eaf;line-height:1.35}.v130-grid button.active{border-color:#efb93c;box-shadow:0 0 0 1px #efb93c33 inset;background:#182234}.v130-grid button.creative{grid-column:1/-1}@media(max-width:520px){.v130-head{display:block}.v130-head small{display:block;max-width:none;text-align:left;margin-top:7px}.v130-grid{grid-template-columns:1fr}.v130-grid button.creative{grid-column:auto}}
`;document.head.appendChild(s)})();
try{v130RenderModeSettings();v08RefreshModePill?.()}catch{}
window.__voxV130Ready=true;
