'use strict';

/* V0.8.3 — offline pack manifest fix.
   Bundled APK assets (img/..., file://..., data:...) must never be sent to the HTTP downloader. */
function v083RemoteUrl(url){
 const s=String(url||'').trim();
 return /^https:\/\//i.test(s)?s:'';
}
function v083AddRemote(set,url){const u=v083RemoteUrl(url);if(u)set.add(u)}

v05OfflineManifest=function(setId){
 const cfg=SETS[setId],set=state.sets[setId];
 if(!cfg||!set||cardsFor(setId).length!==cfg.total)throw new Error('set-not-ready');
 const urls=new Set();
 v083AddRemote(urls,`${API}/sets/${cfg.id}`);
 v083AddRemote(urls,`${META_BASE}/${cfg.metaFile}`);
 if(set.logo)v083AddRemote(urls,`${set.logo}.webp`);
 for(const p of cfg.products||[])v083AddRemote(urls,p.image);
 for(const e of ENERGY||[]){v083AddRemote(urls,e.image);v083AddRemote(urls,e.thumb)}
 for(const c of cardsFor(setId)){
  v083AddRemote(urls,v05BaseCardImg(c,'high'));
  v083AddRemote(urls,`${API}/cards/${c.id}`);
 }
 return [...urls];
};

const v083DownloadOfflineBase=v05DownloadOffline;
v05DownloadOffline=async function(setId){
 try{
  const urls=v05OfflineManifest(setId);
  if(!urls.length)return toast('Aucune ressource réseau à télécharger pour cette collection');
 }catch(e){return toast('Les données de cette collection ne sont pas encore chargées')}
 return v083DownloadOfflineBase(setId);
};

window.__voxV083OfflineReady=true;
