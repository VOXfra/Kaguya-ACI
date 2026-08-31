'use strict';
/* VOX Card Sim V1.2.11 — three independent save slots.
   Realistic, Ludic and Creative are three different games. The settings screen is
   shared, but switching mode always saves the source slot then loads the target.
   No inventory, wallet, binder or discovery data is ever copied between modes. */
const V131_VERSION='1.2.11-independent-mode-saves';
const V131_MODES=['realistic','ludic','creative'];
const V131_VALID=new Set(V131_MODES);
const V131_SLOT_PREFIX='voxCardSimV131_slot_';
const V131_MANUAL_PREFIX='voxCardSimV131_manual_';
const V131_ACTIVE='voxCardSimV131_activeMode';
const V131_MIGRATED='voxCardSimV131_migrated_v1';
let V131_SWITCHING=false;

function v131Parse(raw){try{return raw?JSON.parse(raw):null}catch{return null}}
function v131Clone(x){try{return JSON.parse(JSON.stringify(x))}catch{return null}}
function v131Read(key){return v131Parse(localStorage.getItem(key))}
function v131Write(key,data){try{localStorage.setItem(key,JSON.stringify(data));return true}catch(e){console.warn('V1.2.11 write',key,e);return false}}
function v131SlotKey(mode){return V131_SLOT_PREFIX+mode}
function v131ManualKey(mode){return V131_MANUAL_PREFIX+mode}
function v131Mode(){
 const m=String(localStorage.getItem(V131_ACTIVE)||localStorage.getItem('voxCardSimV127_mode')||localStorage.getItem('voxCardSimV08_activeMode')||state?.gameMode||'realistic');
 return V131_VALID.has(m)?m:'realistic';
}
function v131SetMode(mode){
 localStorage.setItem(V131_ACTIVE,mode);localStorage.setItem('voxCardSimV127_mode',mode);localStorage.setItem('voxCardSimV08_activeMode',mode);state.gameMode=mode;
}
function v131Repair(d,mode){
 d=v131Clone(d)||{};d.gameMode=mode;d.version=Math.max(131,Number(d.version)||0);d.schemaVersion=Math.max(131,Number(d.schemaVersion)||0);
 d.instances=Array.isArray(d.instances)?d.instances:[];d.stock=d.stock&&typeof d.stock==='object'?d.stock:{};d.stockLots=d.stockLots&&typeof d.stockLots==='object'?d.stockLots:{};
 d.binderOwned=d.binderOwned&&typeof d.binderOwned==='object'?d.binderOwned:{};d.discoveredCards=d.discoveredCards&&typeof d.discoveredCards==='object'?d.discoveredCards:{};
 for(const x of d.instances)if(x&&!x.isEnergy&&x.status!=='sold'&&x.setId&&x.cardId){const k=`${x.setId}|${x.cardId}`;if(!d.discoveredCards[k])d.discoveredCards[k]=Number(x.acquiredAt||x.openedAt||Date.now())}
 d.ludicRewards=d.ludicRewards&&typeof d.ludicRewards==='object'?d.ludicRewards:{twentyMilestone:0,completedSets:{},boosterCount:0,totalBonus:0};
 d.ludicRewards.completedSets=d.ludicRewards.completedSets&&typeof d.ludicRewards.completedSets==='object'?d.ludicRewards.completedSets:{};
 if(mode==='ludic'){
  const counts={};for(const key of Object.keys(d.discoveredCards)){const p=key.indexOf('|');if(p>0){const sid=key.slice(0,p);counts[sid]=(counts[sid]||0)+1}}
  try{for(const [sid,n] of Object.entries(counts)){const total=Number(SETS?.[sid]?.total)||Infinity;if(n>=total&&!d.ludicRewards.completedSets[sid])d.ludicRewards.completedSets[sid]=Date.now()}}catch{}
 }
 d.wallet=Number.isFinite(Number(d.wallet))?Number(d.wallet):(mode==='creative'?0:250);d.lastSavedAt=Number(d.lastSavedAt)||Date.now();return d;
}
function v131Fresh(mode){
 let d=null;try{d=typeof v08FreshSave==='function'?v08FreshSave(mode):null}catch{}
 if(!d)d={wallet:mode==='creative'?0:250,instances:[],stock:{},stockLots:{},binderOwned:{},discoveredCards:{},ludicRewards:{twentyMilestone:0,completedSets:{},boosterCount:0,totalBonus:0},settings:{}};
 return v131Repair(d,mode);
}
function v131Snapshot(mode=v131Mode()){
 let d=null;
 try{d=typeof v08Serializable==='function'?v08Serializable():null}catch{}
 if(!d)d=v131Clone(state)||{};
 /* Preserve newer persisted fields that older serializers do not know about. */
 for(const k of ['offlinePackMeta','v122BonusBoosterLog','v128LudicBaselineInitialized','notificationsEnabled','friends','friendRequestsOut','friendDeclined'])if(state?.[k]!==undefined)d[k]=v131Clone(state[k]);
 d.lastSavedAt=Date.now();return v131Repair(d,mode);
}
function v131Owned(d){return Array.isArray(d?.instances)?d.instances.filter(x=>x&&x.status!=='sold').length:0}
function v131Discovered(d){return Object.keys(d?.discoveredCards||{}).length}
function v131Binders(d){return Object.values(d?.binderOwned||{}).filter(Boolean).length}
function v131Completed(d){return Object.keys(d?.ludicRewards?.completedSets||{}).length}
function v131Stock(d){return Object.values(d?.stock||{}).reduce((n,v)=>n+Math.max(0,Number(v)||0),0)}
function v131Score(d){
 if(!d||typeof d!=='object')return -1;return Math.max(0,Number(d.wallet)||0)+v131Owned(d)*7+v131Discovered(d)*20+v131Binders(d)*700+v131Completed(d)*5000+v131Stock(d)*15+(Array.isArray(d.purchases)?d.purchases.length*3:0);
}
function v131Equivalent(a,b){
 if(!a||!b)return false;
 const ids=x=>(x.instances||[]).filter(i=>i&&i.status!=='sold').map(i=>String(i.uid||i.instanceId||`${i.setId}|${i.cardId}`)).sort().slice(0,2000).join(',');
 return Math.abs((Number(a.wallet)||0)-(Number(b.wallet)||0))<.001&&v131Owned(a)===v131Owned(b)&&v131Discovered(a)===v131Discovered(b)&&v131Binders(a)===v131Binders(b)&&v131Stock(a)===v131Stock(b)&&ids(a)===ids(b);
}
function v131Candidate(out,key,data,mode,allowMissingMode=false){
 if(!data||typeof data!=='object')return;const gm=String(data.gameMode||'');if(gm&&gm!==mode)return;if(!gm&&!allowMissingMode)return;
 out.push({key,data:v131Repair(data,mode),score:v131Score(data),at:Number(data.lastSavedAt)||0});
}
function v131LegacyCandidates(mode){
 const out=[];const own=v131Read(v131SlotKey(mode));if(own)v131Candidate(out,v131SlotKey(mode),own,mode,true);
 const legacy=v131Read('voxCardSimV08_slot_'+mode);if(legacy)v131Candidate(out,'v08-'+mode,legacy,mode,true);
 const campaign=v131Read('voxCardSimV127_campaign'),sandbox=v131Read('voxCardSimV127_sandbox'),previous=v131Read('voxCardSimV127_previous');
 if(mode==='creative'){if(sandbox)v131Candidate(out,'v127-sandbox',sandbox,'creative',true)}
 else if(campaign){const gm=String(campaign.gameMode||localStorage.getItem('voxCardSimV127_mode')||'');if(gm===mode)v131Candidate(out,'v127-campaign',campaign,mode,true)}
 if(previous?.data&&String(previous.data.gameMode||'')===mode)v131Candidate(out,'v127-previous',previous.data,mode,true);
 const v06=v131Read('voxCardSimV06'),bak=v131Read('voxCardSimV06_backup');
 if(mode==='realistic'){
  if(v06&&(!v06.gameMode||v06.gameMode==='realistic'))v131Candidate(out,'v06',v06,mode,true);
  if(bak&&(!bak.gameMode||bak.gameMode==='realistic'))v131Candidate(out,'v06-backup',bak,mode,true);
 }else{
  if(v06?.gameMode===mode)v131Candidate(out,'v06',v06,mode,true);if(bak?.gameMode===mode)v131Candidate(out,'v06-backup',bak,mode,true);
 }
 const live=v131Clone(state);if(live&&String(live.gameMode||'')===mode)v131Candidate(out,'live',live,mode,true);
 return out.sort((a,b)=>b.score-a.score||b.at-a.at);
}
function v131Migrate(){
 if(localStorage.getItem(V131_MIGRATED)==='1')return;
 const legacyR=v131Read('voxCardSimV08_slot_realistic'),legacyL=v131Read('voxCardSimV08_slot_ludic'),campaign=v131Read('voxCardSimV127_campaign');
 const unifiedDuplicate=legacyR&&legacyL&&Number(legacyR.schemaVersion)>=127&&Number(legacyL.schemaVersion)>=127&&v131Equivalent(legacyR,legacyL);
 const campaignOwner=String(campaign?.gameMode||localStorage.getItem('voxCardSimV127_mode')||localStorage.getItem('voxCardSimV08_activeMode')||'realistic');
 for(const mode of V131_MODES){
  let candidates=v131LegacyCandidates(mode);
  /* V1.2.7-1.2.10 deliberately cloned one campaign into both legacy slots.
     Never mistake that clone for a genuine second save. */
  if(unifiedDuplicate&&(mode==='realistic'||mode==='ludic')&&mode!==campaignOwner)candidates=candidates.filter(x=>x.key!==('v08-'+mode));
  const best=candidates[0]?.data||v131Fresh(mode);v131Write(v131SlotKey(mode),v131Repair(best,mode));
 }
 const requested=String(localStorage.getItem('voxCardSimV127_mode')||localStorage.getItem('voxCardSimV08_activeMode')||state?.gameMode||'realistic');
 localStorage.setItem(V131_ACTIVE,V131_VALID.has(requested)?requested:'realistic');localStorage.setItem(V131_MIGRATED,'1');
}
function v131StageCompatibility(mode,d){
 const x=v131Repair(d,mode),json=JSON.stringify(x);
 localStorage.setItem('voxCardSimV06',json);localStorage.setItem('voxCardSimV06_backup',json);localStorage.setItem('voxCardSimV08_slot_'+mode,json);
 localStorage.setItem('voxCardSimV08_activeMode',mode);localStorage.setItem('voxCardSimV127_mode',mode);
 /* These keys exist only so earlier compatibility layers boot into the currently
    selected save. They are never authoritative after V1.2.11 loads. */
 if(mode==='creative')localStorage.setItem('voxCardSimV127_sandbox',json);else localStorage.setItem('voxCardSimV127_campaign',json);
 try{VOXOnline?.setCloudWritesEnabled?.(mode==='realistic'&&state.onlineCloudEnabled!==false)}catch{}
 try{if(mode==='realistic')VOXNative?.mirrorSave?.(json)}catch{}
}
function v131Apply(d,mode){
 const x=v131Repair(d||v131Fresh(mode),mode);Object.assign(state,v131Clone(x));state.gameMode=mode;v131SetMode(mode);return x;
}
function v131Commit(reason='auto',manual=false){
 const mode=v131Mode(),d=v131Snapshot(mode),key=v131SlotKey(mode);
 v131Write(key,d);if(manual)v131Write(v131ManualKey(mode),d);v131StageCompatibility(mode,d);
 state.__v122Dirty=false;state.__v131LastSaveReason=reason;state.__v131LastSavedAt=d.lastSavedAt;try{v122UpdateSaveUi?.()}catch{};return d;
}

/* One-time recovery, then V1.2.11 becomes the only authority. */
v131Migrate();
(function v131Activate(){const mode=v131Mode(),d=v131Read(v131SlotKey(mode))||v131Fresh(mode);v131Apply(d,mode);v131Commit('v131-activate',false)})();

/* Autosave/manual save target ONLY the active slot. */
save=function(){
 const auto=typeof v122AutoSaveEnabled==='function'?v122AutoSaveEnabled():true;if(!auto){state.__v122Dirty=true;try{v122UpdateSaveUi?.()}catch{};return null}
 return v131Commit('auto',false);
};
window.v122ForceSave=function(){return v131Commit('checkpoint',false)};
window.v122Checkpoint=function(reason='modification'){
 const auto=typeof v122AutoSaveEnabled==='function'?v122AutoSaveEnabled():true;if(auto)return v131Commit(reason,false);state.__v122Dirty=true;state.__v122DirtyReason=reason;try{v122UpdateSaveUi?.()}catch{};return null;
};
window.v122ManualSave=function(){const d=v131Commit('manual',true);try{toast(`Sauvegarde manuelle ${V08_MODES?.[d.gameMode]?.label||d.gameMode} créée`)}catch{};try{v131RenderSavePanel()}catch{};return d};
window.v131RestoreManual=function(){
 const mode=v131Mode(),manual=v131Read(v131ManualKey(mode));if(!manual){try{toast('Aucune sauvegarde manuelle pour ce mode')}catch{};return false}
 const current=v131Snapshot(mode);v131Write(v131SlotKey(mode),v131Repair(manual,mode));v131Write(v131ManualKey(mode),current);v131Apply(manual,mode);v131StageCompatibility(mode,manual);try{toast('Sauvegarde manuelle restaurée')}catch{};setTimeout(()=>location.reload(),120);return true;
};

function v131SwitchMode(mode){
 mode=String(mode||'');if(!V131_VALID.has(mode)||V131_SWITCHING)return false;const current=v131Mode();if(mode===current){try{toast(`${V08_MODES?.[mode]?.label||mode} déjà actif`)}catch{};return true}
 V131_SWITCHING=true;try{
  /* Mode changes always create a durable source save, even with autosave off. */
  v131Commit('mode-switch-source',false);
  const target=v131Read(v131SlotKey(mode))||v131Fresh(mode);v131Apply(target,mode);v131StageCompatibility(mode,target);v131SetMode(mode);
  try{toast(`${V08_MODES?.[mode]?.label||mode} chargé · partie indépendante`)}catch{};setTimeout(()=>location.reload(),120);return true;
 }catch(e){console.error('V1.2.11 mode switch',e);V131_SWITCHING=false;try{toast('Impossible de charger cette partie · partie actuelle conservée')}catch{};return false}
}
window.v131SwitchMode=v131SwitchMode;window.v130SwitchMode=v131SwitchMode;window.v129SwitchMode=v131SwitchMode;window.v08SwitchMode=v131SwitchMode;

function v131Stats(mode){const d=v131Read(v131SlotKey(mode));if(!d)return'Nouvelle partie';const wallet=mode==='creative'?'∞':(typeof money==='function'?money(Number(d.wallet)||0):`${(Number(d.wallet)||0).toFixed(2)} €`);return`${wallet} · ${v131Discovered(d)} cartes · ${v131Binders(d)} classeurs`}
function v131RemoveLegacy(){document.querySelectorAll('#v08ModeIntro,#v08ModeSettings,.v08-mode-settings,#v084ForceResetPanel,#v127ModeSettings,#v127SaveGuard,#v129ModeSettings,#v130ModeSettings,#v131ModeSettings').forEach(x=>x.remove())}
function v131RenderModeSettings(){
 const card=$('#settingsModal .modal-card');if(!card)return;v131RemoveLegacy();const mode=v131Mode(),sec=document.createElement('div');sec.id='v131ModeSettings';sec.className='v131-mode-settings';
 sec.innerHTML=`<div class="v131-head"><div><span class="tag">MODE DE JEU</span><h3>${V08_MODES?.[mode]?.label||mode}</h3></div><small>3 parties totalement indépendantes</small></div><p class="v131-note">Changer de mode sauvegarde la partie actuelle puis charge l'autre. Argent, cartes, classeurs et progression ne sont jamais mélangés.</p><div class="v131-grid">${V131_MODES.map(m=>`<button type="button" data-v131-mode="${m}" class="${m===mode?'active':''}"><strong>${V08_MODES?.[m]?.label||m}</strong><span>${m==='realistic'?'Économie stricte · marché complet':m==='ludic'?'Récompenses et progression ludique':'Bac à sable · argent illimité'}</span><small>${escapeHtml(v131Stats(m))}</small></button>`).join('')}</div>`;
 const save=$('#v122SaveSettings');if(save)card.insertBefore(sec,save);else card.appendChild(sec);sec.querySelectorAll('[data-v131-mode]').forEach(b=>b.onclick=()=>v131SwitchMode(b.dataset.v131Mode));
}
function v131RenderSavePanel(){
 const card=$('#settingsModal .modal-card');if(!card)return;document.querySelector('#v131SavePanel')?.remove();const mode=v131Mode(),manual=v131Read(v131ManualKey(mode)),box=document.createElement('div');box.id='v131SavePanel';box.className='v131-save-panel';
 box.innerHTML=`<div><strong>Sauvegarde · ${escapeHtml(V08_MODES?.[mode]?.label||mode)}</strong><small>Auto et manuel concernent uniquement cette partie.</small></div><button id="v131RestoreManual" class="secondary" ${manual?'':'disabled'}>${manual?'Restaurer le point manuel':'Aucun point manuel'}</button>`;
 const save=$('#v122SaveSettings');if(save)save.after(box);else card.appendChild(box);const manualBtn=$('#v122SaveNow');if(manualBtn)manualBtn.onclick=()=>window.v122ManualSave();const restore=$('#v131RestoreManual');if(restore)restore.onclick=()=>window.v131RestoreManual();
}
const v131RenderSettingsBase=renderSettings;
renderSettings=function(){const r=v131RenderSettingsBase();v131RenderModeSettings();v131RenderSavePanel();return r};

/* Only V1.2.11 controls are allowed to survive in Settings. */
const v131Observer=new MutationObserver(()=>{document.querySelectorAll('#v084ForceResetPanel,#v08ModeSettings,.v08-mode-settings,#v127ModeSettings,#v127SaveGuard,#v129ModeSettings,#v130ModeSettings').forEach(x=>x.remove())});
try{v131Observer.observe(document.body,{childList:true,subtree:true})}catch{}

(function(){if($('#v131Style'))return;const s=document.createElement('style');s.id='v131Style';s.textContent=`
.v131-mode-settings,.v131-save-panel{margin-top:16px;padding:16px;border:1px solid #29364a;border-radius:18px;background:linear-gradient(145deg,#111a27,#0d141f)}.v131-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.v131-head h3{margin:7px 0 0}.v131-head small,.v131-note,.v131-save-panel small{color:#8e9aad;line-height:1.4}.v131-note{margin:10px 0 0;font-size:12px}.v131-grid{display:grid;gap:9px;margin-top:14px}.v131-grid button{min-height:80px;padding:12px 13px;border:1px solid #2d394a;border-radius:14px;background:#101720;color:#eef2f8;display:grid;grid-template-columns:1fr auto;align-items:center;text-align:left;gap:4px 12px}.v131-grid button strong{font-size:16px}.v131-grid button span{font-size:11px;color:#929eaf}.v131-grid button small{grid-column:2;grid-row:1/3;color:#f0bd49;text-align:right;white-space:nowrap}.v131-grid button.active{border-color:#efb93c;box-shadow:0 0 0 1px #efb93c33 inset;background:#182234}.v131-save-panel{display:flex;align-items:center;justify-content:space-between;gap:14px}.v131-save-panel>div{display:flex;flex-direction:column;gap:4px}@media(max-width:520px){.v131-head{display:block}.v131-head>small{display:block;margin-top:6px}.v131-grid button{grid-template-columns:1fr}.v131-grid button small{grid-column:1;grid-row:auto;text-align:left}.v131-save-panel{align-items:stretch;flex-direction:column}}
`;document.head.appendChild(s)})();
try{v131RenderModeSettings();v131RenderSavePanel();v08RefreshModePill?.()}catch{}
window.__voxV131Ready=true;
