'use strict';
/* V1.1.0 : attend les hotfixes 1.0.9, puis charge dans l'ordre le catalogue,
   l'état physique et la passe performance. L'ordre est volontaire : les deux
   dernières couches doivent surcharger les vieux comportements V0.x. */
(function v111Boot(){
 let tries=0;
 const add=(src,done)=>{const s=document.createElement('script');s.src=src;s.onload=()=>done?.();s.onerror=e=>console.error('VOX V1.1 layer failed',src,e);document.body.appendChild(s)};
 const load=()=>{
  if(window.__voxV111LoadStarted)return;window.__voxV111LoadStarted=true;
  add('v111fix.js',()=>add('v111condition.js',()=>add('v111perf.js')));
 };
 const wait=()=>{if(window.__voxV109HotfixR3Ready)return load();if(++tries<900)return setTimeout(wait,25);console.error('VOX V1.1: V1.0.9 R3 readiness timeout')};
 window.addEventListener('load',()=>setTimeout(wait,0));
})();
window.__voxV111BootReady=true;
