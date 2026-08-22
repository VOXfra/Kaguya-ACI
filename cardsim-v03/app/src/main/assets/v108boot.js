'use strict';

/* VOX Card Sim V1.0.8 — garde-fou chargé de façon synchrone.
   Son rôle est volontairement réduit : même si une couche dynamique plus récente
   échoue à se charger, le menu Réglages conserve toujours un sélecteur de mode. */
const V108_BOOT_SWITCH_MARKER='voxCardSimV108_modeSwitch';
const V108_BOOT_MODES={
 realistic:{label:'Réaliste'},
 ludic:{label:'Ludique'},
 creative:{label:'Créatif'}
};

function v108BootMode(){
 const m=localStorage.getItem('voxCardSimV08_activeMode');
 return V108_BOOT_MODES[m]?m:'realistic';
}
function v108BootFreshTarget(mode){
 let legacy={};try{legacy=JSON.parse(localStorage.getItem('voxCardSimV06')||'{}')||{}}catch{}
 try{if(typeof v084BootFresh==='function')return v084BootFresh(mode,legacy)}catch{}
 const now=Date.now();return{version:8,schemaVersion:8,gameMode:mode,playerId:legacy.playerId||`PLAYER-${now}-${Math.random().toString(36).slice(2,9)}`,activeSet:'sv03.5',wallet:mode==='creative'?0:250,instances:[],stock:{},listings:[],sales:[],purchases:[],packsOpened:{},settings:legacy.settings||{cardTrickEnabled:false,cardTrickCount:0},currentOpening:null,inventoryTab:'cards',inventorySort:'numberAsc',pageBySet:{},lastMarketTick:now,marketShift:{},priceCache:{},lastKnownEstimates:{},marketBooks:{},marketSellers:[],marketTab:'buy',marketQuery:'',marketSetFilter:'all',binderOwned:{},stockLots:{},priceHistory:{},publicCards:[],jpPackPlans:{},sellerProfile:null,offlinePackMeta:legacy.offlinePackMeta||{},notificationsEnabled:legacy.notificationsEnabled!==false,discoveredCards:{},ludicRewards:{twentyMilestone:0,completedSets:{},boosterCount:0,totalBonus:0},luckyPacks:0,dailyDropBought:{},eventCatalog:{},friends:[],friendRequestsOut:[],friendDeclined:[],marketCategory:'all',marketRarity:'all',marketSort:'relevance',marketMinPrice:'',marketMaxPrice:'',marketPage:1,onlineProcessedSellerTrades:[],onlineProcessedBuyerTrades:[],onlineCloudEnabled:true,lastSavedAt:now};
}
function v108BootTargetJson(mode){
 let json=localStorage.getItem('voxCardSimV08_slot_'+mode);
 if(!json)json=JSON.stringify(v108BootFreshTarget(mode));
 try{
  const d=JSON.parse(json);if(!d||typeof d!=='object'||!Array.isArray(d.instances))throw new Error('slot invalide');
  d.gameMode=mode;d.version=Math.max(8,Number(d.version)||0);d.schemaVersion=Math.max(8,Number(d.schemaVersion)||0);d.lastSavedAt=Number(d.lastSavedAt)||Date.now();return JSON.stringify(d);
 }catch{return JSON.stringify(v108BootFreshTarget(mode))}
}

window.v108BootSwitchMode=function(mode){
 if(!V108_BOOT_MODES[mode]||mode===v108BootMode())return;
 try{if(typeof state!=='undefined'){state.gameMode=v108BootMode();if(typeof save==='function')save()}}catch(e){console.warn('V1.0.8 boot save',e)}
 const json=v108BootTargetJson(mode),marker={mode,at:Date.now(),version:'1.0.8'};
 localStorage.setItem('voxCardSimV08_activeMode',mode);
 localStorage.setItem('voxCardSimV08_slot_'+mode,json);
 localStorage.setItem('voxCardSimV06',json);
 localStorage.setItem('voxCardSimV06_backup',json);
 localStorage.setItem(V108_BOOT_SWITCH_MARKER,JSON.stringify(marker));
 try{window.VOXOnline?.setCloudWritesEnabled?.(false)}catch{}
 const buttons=document.querySelectorAll('#v108BootModeSettings button,#v108ModeSettings button');for(const b of buttons)b.disabled=true;
 setTimeout(()=>location.reload(),140);
};

function v108BootInjectModeFallback(){
 const card=document.querySelector('#settingsModal .modal-card');if(!card||document.querySelector('#v108ModeSettings'))return;
 let sec=document.querySelector('#v108BootModeSettings');if(sec){const title=sec.querySelector('h3');if(title)title.textContent=V108_BOOT_MODES[v108BootMode()].label;return}
 const current=v108BootMode();sec=document.createElement('div');sec.id='v108BootModeSettings';sec.style.cssText='margin-top:14px;padding:14px;border:1px solid #2d394a;border-radius:13px;background:#101720';
 sec.innerHTML=`<span style="font-size:10px;font-weight:900;letter-spacing:.8px;color:#efb93c">MODE DE JEU</span><h3 style="margin:7px 0 10px">${V108_BOOT_MODES[current].label}</h3><p style="font-size:11px;line-height:1.45;color:#929eaf">Sélecteur de secours V1.0.8. Il reste disponible même si l’interface complète n’a pas fini de se charger.</p><div style="display:grid;gap:8px">${Object.entries(V108_BOOT_MODES).map(([id,m])=>`<button type="button" data-v108-boot-mode="${id}" style="padding:11px;border:1px solid ${id===current?'#efb93c':'#2d394a'};border-radius:11px;background:#0d141e;color:#f4f6fa;text-align:left;font-weight:800">${m.label}</button>`).join('')}</div>`;
 card.appendChild(sec);sec.querySelectorAll('[data-v108-boot-mode]').forEach(b=>b.onclick=()=>window.v108BootSwitchMode(b.dataset.v108BootMode));
}

/* Le bouton Réglages peut être utilisé immédiatement après un changement de mode :
   on réinjecte donc le sélecteur à chaque ouverture, sans attendre les couches async. */
const v108BootSettings=document.getElementById('settingsBtn');if(v108BootSettings)v108BootSettings.addEventListener('click',()=>setTimeout(v108BootInjectModeFallback,0));
setTimeout(v108BootInjectModeFallback,0);

/* La couche fonctionnelle V1.0.8 se charge après V1.0.7. Le polling évite de
   modifier l'ordre historique des dizaines de scripts déjà validés. */
(function v108BootLoadFinal(){let tries=0;const load=()=>{if(window.__voxV108LoadStarted)return;window.__voxV108LoadStarted=true;const s=document.createElement('script');s.src='v108fix.js';s.onerror=e=>{window.__voxV108LoadStarted=false;console.error('VOX V1.0.8 final layer load failed',e)};document.body.appendChild(s)};const wait=()=>{if(window.__voxV107Ready)return load();if(++tries<600)return setTimeout(wait,25);console.error('VOX V1.0.8: V1.0.7 readiness timeout; fallback mode selector remains active')};window.addEventListener('load',()=>setTimeout(wait,0))})();
window.__voxV108BootReady=true;
