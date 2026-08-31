'use strict';
/* V1.0.7 memory cleanup. Do not prebuild the 3k-card marketplace index at boot. */
const V106_MEMORY_VERSION='1.0.7';

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
  const data=window.V105_CATALOG;if(!data?.sets)return;let released=0;
  for(const d of Object.values(data.sets)){if(Array.isArray(d.cards)){released+=d.cards.length;d.cards=[]}}
  window.__voxV106ReleasedCatalogCards=released;
 }catch(e){console.warn('V1.0.7 raw catalog cleanup',e)}
}

/* The marketplace index is intentionally NOT built here anymore. v106MarketAssets
   will build it lazily the first time the marketplace actually needs it. */
function v106WarmAndRelease(){v106ReleaseRawCatalog()}
if('requestIdleCallback'in window)requestIdleCallback(v106WarmAndRelease,{timeout:2200});else setTimeout(v106WarmAndRelease,900);

if(!$('#settingsModal')?.classList.contains('hidden')){v106EnsureOfflineRows();try{v05RefreshOfflinePanel()}catch{}}
window.__voxV106MemoryReady=true;
