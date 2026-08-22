'use strict';
/* V1.1.7 : charge les couches historiques, le catalogue canonique, les produits
   physiques, le moteur de collation 1.1.6 puis la couche d'intégrité 1.1.7.
   V1.1.7 répare le rangement générique, l'artwork aléatoire des boosters, le
   chargement des archives et la provenance visuelle des énergies. */
(function v111Boot(){
 let tries=0;
 const add=(src,done)=>{const s=document.createElement('script');s.src=src;s.onload=()=>done?.();s.onerror=e=>console.error('VOX V1.1 layer failed',src,e);document.body.appendChild(s)};
 const load=()=>{
  if(window.__voxV111LoadStarted)return;window.__voxV111LoadStarted=true;
  add('v111fix.js',()=>add('v111catalogfix.js',()=>add('v111condition.js',()=>add('v111conditionfix.js',()=>add('v111perf.js',()=>add('v112fix.js',()=>add('v113fix.js',()=>add('v114fix.js',()=>add('v115fix.js',()=>add('v116_collation_profiles.js',()=>add('v116fix.js',()=>add('v116hotfix.js',()=>add('v117fix.js')))))))))))));
 };
 const wait=()=>{if(window.__voxV109HotfixR3Ready)return load();if(++tries<900)return setTimeout(wait,25);console.error('VOX V1.1: V1.0.9 R3 readiness timeout')};
 window.addEventListener('load',()=>setTimeout(wait,0));
})();
window.__voxV111BootReady=true;