'use strict';
/* V1.0.6 memory cleanup, loaded after v106fix.js. */
const V106_MEMORY_VERSION='1.0.6';

/* Do not rely on CSS.escape for dotted TCG set IDs on older Android WebViews. */
v106EnsureOfflineRows=function(){
 const sec=$('#settingsModal .offline-settings');if(!sec)return;
 const existing=new Set([...sec.querySelectorAll('[data-offline-set]')].map(r=>r.dataset.offlineSet));
 for(const s of Object.values(SETS)){
  if(existing.has(s.id))continue;
  const row=document.createElement('div');row.className='offline-row';row.dataset.offlineSet=s.id;
  row.innerHTML=`<div><strong>${escapeHtml(s.name)}</strong><small class="offline-status">Vérification…</small></div><button class="secondary small">Télécharger</button>`;
  row.querySelector('button').onclick=()=>v05DownloadOffline(s.id);sec.appendChild(row);existing.add(s.id);
 }
};

function v106ReleaseRawCatalog(){
 try{
  /* v105RegisterCatalog already made the runtime card objects. The generator's
     source arrays are a second copy and are never needed again by pack collation. */
  const data=window.V105_CATALOG;
  if(!data?.sets)return;
  let released=0;
  for(const d of Object.values(data.sets)){
   if(Array.isArray(d.cards)){released+=d.cards.length;d.cards=[]}
  }
  window.__voxV106ReleasedCatalogCards=released;
 }catch(e){console.warn('V1.0.6 raw catalog cleanup',e)}
}

function v106WarmAndRelease(){
 try{v106BuildMarketIndex()}catch(e){console.warn('V1.0.6 market warmup',e)}
 v106ReleaseRawCatalog();
}
if('requestIdleCallback'in window)requestIdleCallback(v106WarmAndRelease,{timeout:2200});else setTimeout(v106WarmAndRelease,900);

if(!$('#settingsModal')?.classList.contains('hidden')){v106EnsureOfflineRows();try{v05RefreshOfflinePanel()}catch{}}
window.__voxV106MemoryReady=true;
