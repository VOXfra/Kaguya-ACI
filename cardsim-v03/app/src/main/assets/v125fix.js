'use strict';
/* VOX Card Sim V1.2.5 — panneau hors ligne autoritaire.
   L'ancien panneau V1.1 pouvait être reconstruit après V1.2.4 et remettre ses
   boutons "partial" en disabled. Cette couche reprend le rendu final, rebinde les
   actions après chaque mutation DOM et rend les téléchargements stagnants relançables. */
const V125_VERSION='1.2.5-offline-panel';
const V125_PROGRESS=new Map();
let V125_PANEL_TIMER=0;

function v125Entry(id){try{return typeof v111Entry==='function'?v111Entry(id):null}catch{return null}}
function v125Status(id){try{return typeof v111NativeStatus==='function'?v111NativeStatus(id):{}}catch{return{}}}
function v125FormatBytes(v){try{return typeof v05FormatBytes==='function'?v05FormatBytes(v):`${(Number(v||0)/1048576).toFixed(1)} Mo`}catch{return''}}
function v125SourceMissing(entry){return Math.max(0,Number(entry?.missingScans)||0)}
function v125SourceCards(entry){return Math.max(0,Number(entry?.cards)||Number(entry?.total)||0)}
function v125AllScansMissing(entry){const c=v125SourceCards(entry),m=v125SourceMissing(entry);return c>0&&m>=c}
function v125ObserveProgress(id,s){
 const now=Date.now(),done=Number(s?.done)||0,total=Number(s?.total)||0,state=String(s?.state||'');
 let p=V125_PROGRESS.get(id);
 if(!p||p.done!==done||p.total!==total||p.state!==state){p={done,total,state,changedAt:now};V125_PROGRESS.set(id,p)}
 return now-p.changedAt;
}
function v125RunDownload(id,force=false){
 const entry=v125Entry(id);if(!entry)return toast('Collection introuvable dans le catalogue local');
 try{VOXOffline?.requestNotificationPermission?.()}catch{}
 if(window.VOXOffline){
  VOXOffline.downloadPack(id,'[]',!!force);
  V125_PROGRESS.delete(id);
  v125SchedulePanel(150);
  return;
 }
 try{return v05DownloadOffline?.(id)}catch{return toast('Téléchargement Android indisponible')}
}

function v125PaintRow(row){
 const id=row?.dataset?.offlineSet;if(!id)return;
 const entry=v125Entry(id),s=v125Status(id),txt=row.querySelector('.offline-status'),btn=row.querySelector('button');if(!entry||!txt||!btn)return;
 const state=String(s.state||'idle'),done=Math.max(0,Number(s.done)||0),total=Math.max(0,Number(s.total)||0),failed=Math.max(0,Number(s.failed)||0),missing=v125SourceMissing(entry),stagnantFor=v125ObserveProgress(id,s);
 btn.disabled=false;btn.onclick=e=>{e.preventDefault();v125RunDownload(id,state==='installed'&&!failed)};
 row.classList.remove('v125-stalled');

 if(state==='queued'){
  if(stagnantFor>15000){txt.textContent='File d’attente sans progression · tu peux relancer';btn.textContent='Relancer';row.classList.add('v125-stalled')}
  else{txt.textContent='En attente du réseau…';btn.textContent='Relancer'}
  return;
 }
 if(state==='running'){
  const n=Number(s.attempted)||done;
  if(stagnantFor>20000){txt.textContent=`Téléchargement sans progression · ${n}/${total||'…'}${failed?` · ${failed} échec(s)`:''}`;btn.textContent='Relancer';row.classList.add('v125-stalled')}
  else{txt.textContent=`Téléchargement · ${n}/${total||'…'}${failed?` · ${failed} à compléter`:''}`;btn.textContent='Relancer'}
  return;
 }
 if(state==='installed'){
  txt.textContent=`Disponible hors ligne · ${v125FormatBytes(s.bytes)}${s.completedAt?` · ${new Date(s.completedAt).toLocaleDateString('fr-FR')}`:''}`;
  btn.textContent='Réinstaller';return;
 }
 if(state==='partial'){
  const note=String(s.error||'').trim();
  txt.textContent=`Disponible hors ligne · partiel${done||total?` · ${done}/${total}`:''}${note?` · ${note}`:(missing?` · ${missing} scan(s) absent(s) de la source`:'')}`;
  btn.textContent=failed>0?'Compléter':'Revérifier les scans';return;
 }
 if(state==='error'){
  txt.textContent=`Téléchargement interrompu · ${String(s.error||'réessaie').trim()}`;btn.textContent='Réessayer';return;
 }

 // Aucun ancien statut "catalogue source incomplet · téléchargement bloqué" ne
 // doit survivre. Même 100 % de scans absents reste un catalogue local valide.
 if(v125AllScansMissing(entry)){
  txt.textContent=`Catalogue local disponible · aucun des ${v125SourceCards(entry)} scans n’est fourni par la source actuelle`;
  btn.textContent='Revérifier la source';return;
 }
 if(missing>0){
  txt.textContent=`Source partielle · ${missing} scan(s) absent(s) · les autres sont téléchargeables`;
  btn.textContent='Télécharger ce qui existe';return;
 }
 txt.textContent='Non téléchargée';btn.textContent='Télécharger';
}

function v125PatchPanel(){
 const card=document.querySelector('#settingsModal .modal-card');if(!card)return;
 card.querySelectorAll('[data-offline-set]').forEach(v125PaintRow);
 const bulk=document.querySelector('#v111BulkState');
 if(bulk){
  try{const b=typeof v111BulkStatus==='function'?v111BulkStatus():{};if(b.running&&Number(b.done)===0)bulk.textContent='File globale démarrée · préparation du premier téléchargement…'}catch{}
 }
}
function v125SchedulePanel(delay=100){clearTimeout(V125_PANEL_TIMER);V125_PANEL_TIMER=setTimeout(()=>{v125PatchPanel();if(!document.querySelector('#settingsModal')?.classList.contains('hidden'))v125SchedulePanel(1500)},delay)}

/* Le wrapper est important : même si V1.1 reconstruit tout le HTML plus tard, on
   repeint les lignes juste après et on remplace leurs onclick par le chemin V1.2.5. */
if(typeof v111RebuildOfflinePanel==='function'){
 const V125_REBUILD_BASE=v111RebuildOfflinePanel;
 v111RebuildOfflinePanel=function(...args){const r=V125_REBUILD_BASE.apply(this,args);setTimeout(v125PatchPanel,0);return r};
}
if(typeof v111SetStatusText==='function')v111SetStatusText=function(id,row){v125PaintRow(row)};
if(typeof v111DownloadOne==='function')v111DownloadOne=function(id,force=false){return v125RunDownload(id,force)};

const settingsCard=document.querySelector('#settingsModal .modal-card');
if(settingsCard){
 const obs=new MutationObserver(()=>v125SchedulePanel(0));
 obs.observe(settingsCard,{childList:true,subtree:true});
}
document.querySelector('#settingsBtn')?.addEventListener('click',()=>v125SchedulePanel(0));
window.addEventListener('online',()=>v125SchedulePanel(100),{passive:true});
window.addEventListener('offline',()=>v125SchedulePanel(100),{passive:true});
v125SchedulePanel(0);
window.__voxV125Ready=true;
