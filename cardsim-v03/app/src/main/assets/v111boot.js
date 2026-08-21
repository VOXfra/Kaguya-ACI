'use strict';
/* V1.1.0 : la couche finale attend les hotfixes 1.0.9 avant de modifier les
   téléchargements, les classeurs ou les états physiques. Cela évite de recréer
   les problèmes d'ordre de chargement rencontrés sur les versions précédentes. */
(function v111Boot(){
 let tries=0;
 const load=()=>{
  if(window.__voxV111LoadStarted)return;
  window.__voxV111LoadStarted=true;
  const s=document.createElement('script');s.src='v111fix.js';
  s.onerror=e=>{window.__voxV111LoadStarted=false;console.error('VOX V1.1 final layer failed',e)};
  document.body.appendChild(s);
 };
 const wait=()=>{
  if(window.__voxV109HotfixR3Ready)return load();
  if(++tries<900)return setTimeout(wait,25);
  console.error('VOX V1.1: V1.0.9 R3 readiness timeout');
 };
 window.addEventListener('load',()=>setTimeout(wait,0));
})();
window.__voxV111BootReady=true;
