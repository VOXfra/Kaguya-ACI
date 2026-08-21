'use strict';
/* V1.1.5 : attend les hotfixes 1.0.9, charge les couches 1.1 historiques puis
   applique le catalogue canonique, la boutique Créative, la pile stable et enfin
   le catalogue de produits physiques vérifiés sans aucun Pack créatif fictif. */
(function v111Boot(){
 let tries=0;
 const add=(src,done)=>{const s=document.createElement('script');s.src=src;s.onload=()=>done?.();s.onerror=e=>console.error('VOX V1.1 layer failed',src,e);document.body.appendChild(s)};
 const load=()=>{
  if(window.__voxV111LoadStarted)return;window.__voxV111LoadStarted=true;
  add('v111fix.js',()=>add('v111catalogfix.js',()=>add('v111condition.js',()=>add('v111conditionfix.js',()=>add('v111perf.js',()=>add('v112fix.js',()=>add('v113fix.js',()=>add('v114fix.js',()=>add('v115fix.js')))))))));
 };
 const wait=()=>{if(window.__voxV109HotfixR3Ready)return load();if(++tries<900)return setTimeout(wait,25);console.error('VOX V1.1: V1.0.9 R3 readiness timeout')};
 window.addEventListener('load',()=>setTimeout(wait,0));
})();
window.__voxV111BootReady=true;
