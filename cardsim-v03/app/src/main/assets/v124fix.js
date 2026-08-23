'use strict';
/* VOX Card Sim V1.2.4 — téléchargements hors ligne tolérants.
   Une collection partielle n'est plus bloquée : on télécharge ce qui existe.
   Une poignée de scans/CDN en erreur ne transforme plus tout le pack en échec. */
const V124_VERSION='1.2.4-offline-downloads';

function v124Entry(id){try{return typeof v111Entry==='function'?v111Entry(id):null}catch{return null}}
function v124Status(id){try{return typeof v111NativeStatus==='function'?v111NativeStatus(id):{}}catch{return{}}}
function v124HashMismatch(id,s=v124Status(id)){
 const hash=String(v124Entry(id)?.contentHash||SETS?.[id]?.v111CatalogHash||'');
 return !!(s?.installed&&hash&&s.catalogHash!==hash);
}

/* Un téléchargement partiel avec erreurs réseau est réessayable. Un set simplement
   incomplet côté source reste utilisable hors ligne sans boucle de mise à jour. */
v111NeedsUpdate=function(id,status=v124Status(id)){
 return v124HashMismatch(id,status)||Number(status?.failed||0)>0;
};

v111DownloadOne=function(id,force=false){
 const entry=v124Entry(id),s=v124Status(id);
 if(!entry)return toast('Collection introuvable dans le catalogue local');
 const status=String(entry.status||'ready').toLowerCase();
 if(status==='failed'||status==='error')return toast('Catalogue local invalide pour cette collection');
 try{VOXOffline?.requestNotificationPermission?.()}catch{}
 if(window.VOXOffline){
  /* En état partiel/erreur on ne force pas les fichiers déjà présents : seuls les
     manquants sont retentés. Le force explicite reste réservé à une réinstallation
     d'un pack complet ou à un nouveau hash de catalogue. */
  const retrying=String(s.state||'')==='partial'||String(s.state||'')==='error'||Number(s.failed||0)>0;
  const nativeForce=!retrying&&(!!force||v124HashMismatch(id,s));
  VOXOffline.downloadPack(id,'[]',nativeForce);
  try{v111ScheduleOfflineRefresh?.(200)}catch{}
  return;
 }
 return typeof v05DownloadOffline==='function'?v05DownloadOffline(id):toast('Téléchargement Android indisponible');
};

v111SetStatusText=function(id,row){
 const s=v124Status(id),statusEl=row.querySelector('.offline-status'),btn=row.querySelector('button'),entry=v124Entry(id);
 if(!statusEl||!btn)return;
 const stateName=String(s.state||'');
 const update=v124HashMismatch(id,s)||Number(s.failed||0)>0;
 row.classList.toggle('v111-update-available',update);
 let badge=row.querySelector('.v111-update-badge');
 if(update&&!badge){badge=document.createElement('span');badge.className='v111-update-badge';badge.textContent='● À COMPLÉTER';row.querySelector('div')?.appendChild(badge)}
 else if(!update&&badge)badge.remove();

 if(stateName==='queued'||stateName==='running'){
  const done=Number(s.done)||0,total=Number(s.total)||0,failed=Number(s.failed)||0;
  statusEl.textContent=stateName==='queued'?'En attente…':`Téléchargement · ${done}/${total||'…'}${failed?` · ${failed} à réessayer`:''}`;
  btn.disabled=true;btn.textContent='En cours';return;
 }
 btn.disabled=false;

 if(stateName==='installed'){
  statusEl.textContent=`Disponible hors ligne · ${typeof v05FormatBytes==='function'?v05FormatBytes(s.bytes):Math.round((Number(s.bytes)||0)/1048576)+' Mo'}${s.completedAt?` · ${new Date(s.completedAt).toLocaleDateString('fr-FR')}`:''}`;
  btn.textContent=v124HashMismatch(id,s)?'Mettre à jour':'Réinstaller';return;
 }
 if(stateName==='partial'){
  const done=Number(s.done)||0,total=Number(s.total)||0,failed=Number(s.failed)||0;
  const note=String(s.error||'').trim();
  statusEl.textContent=`Disponible hors ligne · partiel · ${done}/${total}${failed?` · ${failed} à réessayer`:''}${note?` · ${note}`:''}`;
  btn.textContent=failed>0?'Compléter':'Réinstaller les scans disponibles';return;
 }
 if(stateName==='error'){
  const note=String(s.error||'Erreur réseau').trim();
  statusEl.textContent=`Téléchargement interrompu · ${note}`;
  btn.textContent='Réessayer';return;
 }

 const sourcePartial=String(entry?.status||'').toLowerCase()==='partial';
 if(sourcePartial){
  statusEl.textContent='Source incomplète · les scans disponibles restent téléchargeables';
  btn.textContent='Télécharger les scans disponibles';
 }else{
  statusEl.textContent='Non téléchargée';btn.textContent='Télécharger';
 }
};

/* Rafraîchit le panneau immédiatement : l'ancienne couche pouvait avoir laissé des
   boutons disabled sur les collections partial avant l'arrivée de ce correctif. */
function v124RefreshPanel(){
 try{
  document.querySelectorAll('[data-offline-set]').forEach(row=>v111SetStatusText(row.dataset.offlineSet,row));
 }catch(e){console.warn('V1.2.4 offline panel refresh',e)}
}
setTimeout(v124RefreshPanel,0);
window.addEventListener('online',()=>setTimeout(v124RefreshPanel,100),{passive:true});
window.__voxV124Ready=true;
