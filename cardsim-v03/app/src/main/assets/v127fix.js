'use strict';
/* VOX Card Sim V1.2.7 — unified campaign difficulty + non-destructive persistence.
   Realistic/Ludic share one campaign. Creative remains an isolated sandbox.
   Legacy V0.8 per-mode slots are migration sources only, never authoritative. */
const V127_VERSION='1.2.7-save-unification';
const V127_CAMPAIGN_KEY='voxCardSimV127_campaign';
const V127_SANDBOX_KEY='voxCardSimV127_sandbox';
const V127_PREVIOUS_KEY='voxCardSimV127_previous';
const V127_MIGRATION_KEY='voxCardSimV127_migrated';
const V127_MODE_KEY='voxCardSimV127_mode';
const V127_CAMPAIGN_MODES=new Set(['realistic','ludic']);
const V127_ALL_MODES=new Set(['realistic','ludic','creative']);
let V127_SWITCHING=false;

function v127JsonParse(raw){try{return raw?JSON.parse(raw):null}catch{return null}}
function v127Clone(v){try{return JSON.parse(JSON.stringify(v))}catch{return null}}
function v127Read(key){return v127JsonParse(localStorage.getItem(key))}
function v127Write(key,obj){try{localStorage.setItem(key,JSON.stringify(obj));return true}catch(e){console.warn('V1.2.7 write',key,e);return false}}
function v127Mode(){const m=String(state?.gameMode||localStorage.getItem(V127_MODE_KEY)||localStorage.getItem(V084_MODE_META)||'realistic');return V127_ALL_MODES.has(m)?m:'realistic'}
function v127CampaignMode(){const m=v127Mode();return V127_CAMPAIGN_MODES.has(m)?m:'realistic'}
function v127CompletedCount(d){return Object.keys(d?.ludicRewards?.completedSets||{}).length}
function v127DiscoveredCount(d){return Object.keys(d?.discoveredCards||{}).length}
function v127BinderCount(d){return Object.values(d?.binderOwned||{}).filter(Boolean).length}
function v127StockCount(d){return Object.values(d?.stock||{}).reduce((n,v)=>n+Math.max(0,Number(v)||0),0)}
function v127ProgressScore(d){
 if(!d||typeof d!=='object')return -1;
 const wallet=Math.max(0,Number(d.wallet)||0),cards=Array.isArray(d.instances)?d.instances.filter(x=>x&&x.status!=='sold').length:0;
 const discovered=v127DiscoveredCount(d),completed=v127CompletedCount(d),binders=v127BinderCount(d),stock=v127StockCount(d),purchases=Array.isArray(d.purchases)?d.purchases.length:0;
 return wallet+cards*6+discovered*18+completed*5000+binders*600+stock*20+purchases*4;
}
function v127LegacyCandidates(){
 const keys=[V06_STORAGE,V06_BACKUP,V084_SLOT_PREFIX+'realistic',V084_SLOT_PREFIX+'ludic'];
 const out=[];
 for(const key of keys){const d=v127Read(key);if(!d||d.gameMode==='creative')continue;out.push({key,data:d,score:v127ProgressScore(d),at:Number(d.lastSavedAt)||0})}
 const live=v127Clone(state);if(live&&live.gameMode!=='creative')out.push({key:'live',data:live,score:v127ProgressScore(live),at:Number(live.lastSavedAt)||Date.now()});
 return out.sort((a,b)=>b.score-a.score||b.at-a.at);
}
function v127RepairProgress(d){
 if(!d||typeof d!=='object')return d;
 d.instances=Array.isArray(d.instances)?d.instances:[];
 d.discoveredCards=d.discoveredCards&&typeof d.discoveredCards==='object'?d.discoveredCards:{};
 for(const x of d.instances){if(x&&!x.isEnergy&&x.setId&&x.cardId&&x.status!=='sold')d.discoveredCards[`${x.setId}|${x.cardId}`]=Number(d.discoveredCards[`${x.setId}|${x.cardId}`]||x.acquiredAt||x.openedAt||Date.now())}
 d.ludicRewards=d.ludicRewards&&typeof d.ludicRewards==='object'?d.ludicRewards:{twentyMilestone:0,completedSets:{},boosterCount:0,totalBonus:0};
 d.ludicRewards.completedSets=d.ludicRewards.completedSets&&typeof d.ludicRewards.completedSets==='object'?d.ludicRewards.completedSets:{};
 const counts={};for(const k of Object.keys(d.discoveredCards)){const p=k.indexOf('|');if(p>0){const sid=k.slice(0,p);counts[sid]=(counts[sid]||0)+1}}
 try{for(const [sid,n] of Object.entries(counts)){const total=Number(SETS?.[sid]?.total)||Infinity;if(n>=total&&!d.ludicRewards.completedSets[sid])d.ludicRewards.completedSets[sid]=Date.now()}}catch{}
 d.binderOwned=d.binderOwned&&typeof d.binderOwned==='object'?d.binderOwned:{};
 d.stock=d.stock&&typeof d.stock==='object'?d.stock:{};d.stockLots=d.stockLots&&typeof d.stockLots==='object'?d.stockLots:{};
 d.wallet=Number.isFinite(Number(d.wallet))?Number(d.wallet):250;return d;
}
function v127Snapshot(mode=v127Mode()){
 let d=null;try{d=typeof v08Serializable==='function'?v08Serializable():v127Clone(state)}catch{d=v127Clone(state)}
 d=v127RepairProgress(d||{});d.gameMode=mode;d.version=Math.max(127,Number(d.version)||0);d.schemaVersion=Math.max(127,Number(d.schemaVersion)||0);d.lastSavedAt=Date.now();return d;
}
function v127Apply(d,mode){
 if(!d)return false;const x=v127RepairProgress(v127Clone(d));if(!x)return false;x.gameMode=mode;
 Object.assign(state,x);state.gameMode=mode;
 if(!SETS?.[state.activeSet]){const first=Object.keys(SETS||{})[0];if(first)state.activeSet=first}
 localStorage.setItem(V127_MODE_KEY,mode);localStorage.setItem(V084_MODE_META,mode);return true;
}
function v127WriteCompatibility(d,space){
 const mode=d.gameMode||v127Mode(),json=JSON.stringify(d);
 localStorage.setItem(V06_STORAGE,json);localStorage.setItem(V06_BACKUP,json);localStorage.setItem(V084_MODE_META,mode);localStorage.setItem(V127_MODE_KEY,mode);
 if(space==='campaign'){
  const r={...d,gameMode:'realistic'},l={...d,gameMode:'ludic'};
  localStorage.setItem(V084_SLOT_PREFIX+'realistic',JSON.stringify(r));localStorage.setItem(V084_SLOT_PREFIX+'ludic',JSON.stringify(l));
 }else localStorage.setItem(V084_SLOT_PREFIX+'creative',json);
 try{if(mode==='realistic')VOXNative?.mirrorSave?.(json)}catch{}
}
function v127Commit(reason='auto',manual=false){
 const mode=v127Mode(),space=mode==='creative'?'sandbox':'campaign',key=space==='sandbox'?V127_SANDBOX_KEY:V127_CAMPAIGN_KEY,d=v127Snapshot(mode);
 if(manual){const prev=v127Read(key);if(prev)v127Write(V127_PREVIOUS_KEY,{space,reason:'manual',savedAt:Date.now(),data:prev})}
 v127Write(key,d);v127WriteCompatibility(d,space);state.__v122Dirty=false;state.__v127LastSaveReason=reason;state.__v127LastSavedAt=d.lastSavedAt;try{v122UpdateSaveUi?.()}catch{};return d;
}

/* One-time migration. Prefer actual progression over a newer accidental blank/reset slot. */
(function v127Migrate(){
 if(localStorage.getItem(V127_MIGRATION_KEY)==='1')return;
 const candidates=v127LegacyCandidates(),current=v127Clone(state),best=candidates[0]?.data||current||v08FreshSave?.('realistic');
 if(best){
  const repaired=v127RepairProgress(v127Clone(best));repaired.gameMode=V127_CAMPAIGN_MODES.has(best.gameMode)?best.gameMode:'realistic';
  if(current&&v127ProgressScore(current)<v127ProgressScore(repaired))v127Write(V127_PREVIOUS_KEY,{space:'campaign',reason:'pre-migration-current',savedAt:Date.now(),data:current});
  v127Write(V127_CAMPAIGN_KEY,repaired);
 }
 const legacyCreative=v127Read(V084_SLOT_PREFIX+'creative');if(legacyCreative)v127Write(V127_SANDBOX_KEY,v127RepairProgress(legacyCreative));
 localStorage.setItem(V127_MIGRATION_KEY,'1');
})();

/* Make V1.2.7 authoritative immediately after legacy layers have loaded. */
(function v127Activate(){
 const requested=localStorage.getItem(V127_MODE_KEY)||localStorage.getItem(V084_MODE_META)||'realistic',mode=V127_ALL_MODES.has(requested)?requested:'realistic';
 let d=mode==='creative'?v127Read(V127_SANDBOX_KEY):v127Read(V127_CAMPAIGN_KEY);
 if(!d&&mode==='creative'){d=typeof v08FreshSave==='function'?v08FreshSave('creative'):v127Clone(state);v127Write(V127_SANDBOX_KEY,d)}
 if(d)v127Apply(d,mode);v127Commit('v127-activate',false);
})();

/* Save wrappers: manual save always commits the unified slot and keeps one rollback snapshot. */
const v127SaveBase=save;
save=function(){
 const auto=typeof v122AutoSaveEnabled==='function'?v122AutoSaveEnabled():true;
 if(!auto){state.__v122Dirty=true;try{v122UpdateSaveUi?.()}catch{};return null}
 let r=null;try{r=v127SaveBase()}catch(e){console.warn('V1.2.7 legacy save',e)}
 v127Commit('auto',false);return r;
};
if(typeof v122ForceSave==='function'){
 const v127ForceBase=v122ForceSave;
 window.v122ForceSave=function(){let r=null;try{r=v127ForceBase()}catch(e){console.warn('V1.2.7 force base',e)}v127Commit('checkpoint',false);return r};
}
if(typeof v122Checkpoint==='function'){
 const v127CheckpointBase=v122Checkpoint;
 window.v122Checkpoint=function(reason='modification'){const r=v127CheckpointBase(reason);if(typeof v122AutoSaveEnabled!=='function'||v122AutoSaveEnabled())v127Commit(reason,false);return r};
}
window.v122ManualSave=function(){v127Commit('manual',true);try{toast('Partie sauvegardée · point de restauration créé')}catch{}};

function v127SwitchMode(mode){
 if(!V127_ALL_MODES.has(mode)||mode===v127Mode()||V127_SWITCHING)return;
 V127_SWITCHING=true;try{
  const from=v127Mode();
  v127Commit('mode-switch',false);
  if(from==='creative'||mode==='creative'){
   let target=mode==='creative'?v127Read(V127_SANDBOX_KEY):v127Read(V127_CAMPAIGN_KEY);
   if(!target&&mode==='creative'){target=typeof v08FreshSave==='function'?v08FreshSave('creative'):{wallet:0,instances:[],stock:{},binderOwned:{}};v127Write(V127_SANDBOX_KEY,target)}
   if(target)v127Apply(target,mode);
  }else state.gameMode=mode;
  state.gameMode=mode;localStorage.setItem(V127_MODE_KEY,mode);localStorage.setItem(V084_MODE_META,mode);v127Commit('mode-switch-target',false);
  try{VOXOnline?.setCloudWritesEnabled?.(mode==='realistic'&&state.onlineCloudEnabled!==false)}catch{}
  try{renderHome();renderProducts();renderInventory();renderBinder();renderSetSwitches();renderSettings();updateStats();v08RefreshModePill?.()}catch(e){console.warn('V1.2.7 mode render',e)}
  try{toast(mode==='creative'?'Créatif · bac à sable séparé':`Difficulté ${V08_MODES[mode]?.label||mode} · progression conservée`)}catch{}
 }finally{setTimeout(()=>{V127_SWITCHING=false},80)}
}
window.v08SwitchMode=v127SwitchMode;

function v127RestorePrevious(){
 const wrap=v127Read(V127_PREVIOUS_KEY);if(!wrap?.data)return toast?.('Aucun point de restauration disponible');
 const targetSpace=v127Mode()==='creative'?'sandbox':'campaign';if(wrap.space!==targetSpace)return toast?.('Le point disponible appartient à une autre partie');
 const current=v127Snapshot(v127Mode());v127Write(V127_PREVIOUS_KEY,{space:targetSpace,reason:'swap',savedAt:Date.now(),data:current});
 v127Apply(wrap.data,v127Mode());v127Commit('restore-previous',false);try{renderHome();renderProducts();renderInventory();renderBinder();renderSettings();updateStats();toast('Sauvegarde précédente restaurée')}catch{}
}
window.v127RestorePrevious=v127RestorePrevious;

/* One mode UI. Legacy intro + old duplicated mode/reset panels are deliberately removed. */
function v127ModeUi(){
 document.querySelector('#v08ModeIntro')?.remove();localStorage.setItem('voxCardSimV08_introDone','1');
 document.querySelectorAll('#v08ModeSettings,.v08-mode-settings,#v084ForceResetPanel').forEach(x=>x.remove());
 const card=$('#settingsModal .modal-card');if(!card)return;let sec=$('#v127ModeSettings');if(sec)sec.remove();sec=document.createElement('div');sec.id='v127ModeSettings';sec.className='v127-mode-settings';
 const mode=v127Mode(),creative=mode==='creative';
 sec.innerHTML=`<div class="v127-head"><div><span class="tag">MODE DE JEU</span><h3>${creative?'Créatif':`Campagne · ${V08_MODES[mode]?.label||mode}`}</h3></div><small>${creative?'Bac à sable indépendant':'Une seule progression, difficulté modifiable à tout moment'}</small></div><div class="v127-difficulty"><button data-v127-mode="realistic" class="${mode==='realistic'?'active':''}"><strong>Réaliste</strong><span>Économie stricte · marché complet</span></button><button data-v127-mode="ludic" class="${mode==='ludic'?'active':''}"><strong>Ludique</strong><span>Même partie · bonus de progression</span></button></div><button data-v127-mode="creative" class="v127-creative ${creative?'active':''}"><span><strong>Créatif</strong><small>Inventaire libre dans une sauvegarde séparée pour ne jamais polluer la campagne.</small></span><b>${creative?'ACTIF':'OUVRIR'}</b></button>`;
 const savePanel=$('#v122SaveSettings');if(savePanel)card.insertBefore(sec,savePanel);else card.appendChild(sec);sec.querySelectorAll('[data-v127-mode]').forEach(b=>b.onclick=()=>v127SwitchMode(b.dataset.v127Mode));
}
function v127SaveUi(){
 const card=$('#settingsModal .modal-card');if(!card)return;let old=$('#v127SaveGuard');if(old)old.remove();const box=document.createElement('div');box.id='v127SaveGuard';box.className='v127-save-guard';
 const d=v127Mode()==='creative'?v127Read(V127_SANDBOX_KEY):v127Read(V127_CAMPAIGN_KEY),prev=v127Read(V127_PREVIOUS_KEY),wallet=Number(d?.wallet)||0,completed=v127CompletedCount(d),cards=v127DiscoveredCount(d);
 box.innerHTML=`<div><strong>Sauvegarde protégée</strong><small>${v127Mode()==='creative'?'Bac à sable':'Campagne'} · ${money(wallet)} · ${cards} carte${cards>1?'s':''} découverte${cards>1?'s':''} · ${completed} classeur${completed>1?'s':''} complété${completed>1?'s':''}</small></div><button id="v127RestorePrevious" class="secondary" ${prev?.data?'':'disabled'}>Restaurer la précédente</button>`;
 const savePanel=$('#v122SaveSettings');if(savePanel)savePanel.after(box);else card.appendChild(box);$('#v127RestorePrevious').onclick=v127RestorePrevious;
 const manual=$('#v122SaveNow');if(manual)manual.onclick=()=>window.v122ManualSave();
}
const v127RenderSettingsBase=renderSettings;
renderSettings=function(){const r=v127RenderSettingsBase();v127ModeUi();v127SaveUi();return r};

(function v127Style(){if($('#v127Style'))return;const s=document.createElement('style');s.id='v127Style';s.textContent=`
.v127-mode-settings,.v127-save-guard{margin-top:16px;padding:16px;border:1px solid #29364a;border-radius:18px;background:linear-gradient(145deg,#111a27,#0d141f)}.v127-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.v127-head h3{margin:7px 0 0}.v127-head>small{max-width:48%;text-align:right;color:#8e9aad;line-height:1.35}.v127-difficulty{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px}.v127-difficulty button,.v127-creative{border:1px solid #2c394d;background:#101824;color:#f1f4f8;border-radius:14px;padding:12px;text-align:left}.v127-difficulty button{display:flex;flex-direction:column;gap:3px}.v127-difficulty button span,.v127-creative small{font-size:11px;color:#8f9bad;line-height:1.35}.v127-difficulty button.active,.v127-creative.active{border-color:#f5be45;box-shadow:0 0 0 1px #f5be4530 inset}.v127-creative{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:9px}.v127-creative span{display:flex;flex-direction:column;gap:3px}.v127-creative b{font-size:10px;letter-spacing:.08em;color:#f5be45}.v127-save-guard{display:flex;align-items:center;justify-content:space-between;gap:12px}.v127-save-guard>div{display:flex;flex-direction:column;gap:4px}.v127-save-guard small{color:#8f9bad;line-height:1.4}.v127-save-guard button{white-space:nowrap}@media(max-width:520px){.v127-head{display:block}.v127-head>small{display:block;max-width:none;text-align:left;margin-top:6px}.v127-difficulty{grid-template-columns:1fr}.v127-save-guard{align-items:stretch;flex-direction:column}.v127-save-guard button{width:100%}}
`;document.head.appendChild(s)})();

try{v127ModeUi();v127SaveUi();v08RefreshModePill?.();updateStats();renderHome();renderProducts();renderInventory();renderBinder()}catch(e){console.warn('V1.2.7 initial render',e)}
window.__voxV127Ready=true;
