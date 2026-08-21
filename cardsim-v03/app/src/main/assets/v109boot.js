'use strict';
/* V1.0.9 — charge la couche de correction après la V1.0.8 sans modifier l'ordre
   historique des scripts validés. Le sélecteur de mode de secours V1.0.8 reste
   donc disponible pendant tout le démarrage. */
(function v109Boot(){
 let tries=0;
 const load=()=>{if(window.__voxV109LoadStarted)return;window.__voxV109LoadStarted=true;const s=document.createElement('script');s.src='v109fix.js';s.onerror=e=>{window.__voxV109LoadStarted=false;console.error('VOX V1.0.9 final layer load failed',e)};document.body.appendChild(s)};
 const wait=()=>{if(window.__voxV108Ready)return load();if(++tries<800)return setTimeout(wait,25);console.error('VOX V1.0.9: V1.0.8 readiness timeout')};
 window.addEventListener('load',()=>setTimeout(wait,0));
})();
window.__voxV109BootReady=true;
