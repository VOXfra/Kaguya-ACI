'use strict';
/* V1.0.9 — charge la couche de correction après la V1.0.8 sans modifier l'ordre
   historique des scripts validés. Le sélecteur de mode de secours V1.0.8 reste
   donc disponible pendant tout le démarrage. Le hotfix R2 est chargé uniquement
   après v109fix.js afin de corriger le changement de mode et les packs hors ligne
   historiques sans perturber l'ordre déjà validé. */
(function v109Boot(){
 let tries=0;
 const loadHotfix=()=>{if(window.__voxV109HotfixLoadStarted)return;window.__voxV109HotfixLoadStarted=true;const h=document.createElement('script');h.src='v109hotfix.js';h.onerror=e=>{window.__voxV109HotfixLoadStarted=false;console.error('VOX V1.0.9 hotfix R2 load failed',e)};document.body.appendChild(h)};
 const load=()=>{if(window.__voxV109LoadStarted)return;window.__voxV109LoadStarted=true;const s=document.createElement('script');s.src='v109fix.js';s.onload=loadHotfix;s.onerror=e=>{window.__voxV109LoadStarted=false;console.error('VOX V1.0.9 final layer load failed',e)};document.body.appendChild(s)};
 const wait=()=>{if(window.__voxV108Ready)return load();if(++tries<800)return setTimeout(wait,25);console.error('VOX V1.0.9: V1.0.8 readiness timeout')};
 window.addEventListener('load',()=>setTimeout(wait,0));
})();
window.__voxV109BootReady=true;
