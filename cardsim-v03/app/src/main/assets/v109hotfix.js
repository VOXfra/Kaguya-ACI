'use strict';

/* V1.0.9 hotfix R2 — changement de mode atomique + packs hors ligne historiques.
   Cette couche est chargée après v109fix.js pour corriger deux régressions observées
   sur Android sans toucher aux sauvegardes existantes. */
const V109HF_LEGACY_OFFLINE=new Set(['sv03.5','sv03','sv02','s6a']);

/* ---------- CHANGEMENT DE MODE ----------
   Le bug venait du reload : le slot cible était bien écrit, mais state.gameMode
   restait sur le mode source. Le listener pagehide appelait alors save() et pouvait
   réécrire le mode source juste avant le rechargement. On charge donc aussi le slot
   cible dans l'état vivant avant reload ; tout save tardif réécrit le bon slot. */
window.v108BootSwitchMode=function(mode){
 const valid=typeof V108_BOOT_MODES==='object'&&!!V108_BOOT_MODES[mode];
 const current=typeof v108BootMode==='function'?v108BootMode():(typeof v084ActiveMode==='function'?v084ActiveMode():'realistic');
 if(!valid||mode===current)return;
 try{if(typeof state!=='undefined'){state.gameMode=current;if(typeof save==='function')save()}}catch(e){console.warn('V1.0.9 R2 save source mode',e)}
 let json;try{json=v108BootTargetJson(mode)}catch{json=JSON.stringify(v108BootFreshTarget(mode))}
 let target;try{target=JSON.parse(json)}catch{target=v108BootFreshTarget(mode);json=JSON.stringify(target)}
 target.gameMode=mode;target.version=Math.max(8,Number(target.version)||0);target.schemaVersion=Math.max(8,Number(target.schemaVersion)||0);target.lastSavedAt=Date.now();json=JSON.stringify(target);
 window.__voxModeSwitchInFlight={from:current,to:mode,at:Date.now()};
 localStorage.setItem('voxCardSimV08_activeMode',mode);
 localStorage.setItem('voxCardSimV08_slot_'+mode,json);
 localStorage.setItem('voxCardSimV06',json);
 localStorage.setItem('voxCardSimV06_backup',json);
 localStorage.setItem('voxCardSimV108_modeSwitch',JSON.stringify({mode,from:current,at:Date.now(),version:'1.0.9-r2'}));
 try{if(typeof state!=='undefined'){Object.assign(state,target);state.gameMode=mode}}catch(e){console.warn('V1.0.9 R2 apply target slot',e)}
 try{window.VOXOnline?.setCloudWritesEnabled?.(false)}catch{}
 try{const buttons=document.querySelectorAll('#v108BootModeSettings button,#v108ModeSettings button');for(const b of buttons)b.disabled=true}catch{}
 setTimeout(()=>location.reload(),180);
};

/* ---------- PACKS HORS LIGNE 2021/2023 ---------- */
function v109HFLegacyReady(setId){
 const cfg=SETS?.[setId];if(!cfg)return false;
 try{return cardsFor(setId).length===Number(cfg.total)}catch{return false}
}
async function v109HFEnsureLegacyData(setId){
 if(!V109HF_LEGACY_OFFLINE.has(setId))return true;
 if(v109HFLegacyReady(setId))return true;
 try{await fetchSetData(setId)}catch(e){console.warn('V1.0.9 R2 legacy hydrate',setId,e)}
 return v109HFLegacyReady(setId);
}
function v109HFRemote(out,url){const u=String(url||'').trim();if(/^https:\/\//i.test(u))out.add(u)}
function v109HFLegacyManifest(setId){
 const cfg=SETS?.[setId],cards=cardsFor(setId);if(!cfg||cards.length!==Number(cfg.total))throw new Error(`legacy-not-ready-${setId}-${cards.length}/${cfg?.total||0}`);
 const urls=new Set();
 for(const c of cards){
  let u='';try{u=v05BaseCardImg(c,'high')}catch{}
  v109HFRemote(urls,u);
 }
 for(const e of ENERGY||[]){v109HFRemote(urls,e.image);v109HFRemote(urls,e.thumb)}
 if(!urls.size)throw new Error(`legacy-empty-manifest-${setId}`);
 return [...urls];
}
const v109HFOfflineManifestBase=v05OfflineManifest;
v05OfflineManifest=function(setId){
 if(V109HF_LEGACY_OFFLINE.has(setId))return v109HFLegacyManifest(setId);
 return v109HFOfflineManifestBase(setId);
};

const v109HFDownloadOfflineBase=v05DownloadOffline;
v05DownloadOffline=async function(setId){
 if(V109HF_LEGACY_OFFLINE.has(setId)){
  const ready=await v109HFEnsureLegacyData(setId);
  if(!ready){
   const row=document.querySelector?.(`[data-offline-set="${setId}"]`),status=row?.querySelector?.('.offline-status'),btn=row?.querySelector?.('button');
   if(status)status.textContent='Données embarquées indisponibles · réessaie après redémarrage';if(btn)btn.disabled=false;
   return toast('Impossible de préparer les données embarquées de cette collection');
  }
 }
 return v109HFDownloadOfflineBase(setId);
};

/* Les anciens manifests ajoutaient META_BASE/undefined, les fiches API et des
   photos de produits qui ne sont pas nécessaires au pack de scans. Le nouveau
   manifest historique ne contient que les scans et les énergies réellement utiles. */
setTimeout(()=>{try{v05RefreshOfflinePanel?.();v108InstallModePanel?.();v08RefreshModePill?.()}catch(e){console.warn('V1.0.9 R2 refresh',e)}},80);
window.__voxV109HotfixR2Ready=true;
