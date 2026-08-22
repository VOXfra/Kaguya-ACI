'use strict';
/* V1.2.0 : charge les couches historiques, le catalogue canonique, les produits,
   la collation 1.1.6, puis les correctifs d'intégrité 1.1.7 et 1.2.0. */
(function v111Boot(){
 let tries=0;
 const add=(src,done)=>{const s=document.createElement('script');s.src=src;s.onload=()=>done?.();s.onerror=e=>console.error('VOX V1.2 layer failed',src,e);document.body.appendChild(s)};
 const load=()=>{
  if(window.__voxV111LoadStarted)return;window.__voxV111LoadStarted=true;
  add('v111fix.js',()=>add('v111catalogfix.js',()=>add('v111condition.js',()=>add('v111conditionfix.js',()=>add('v111perf.js',()=>add('v112fix.js',()=>add('v113fix.js',()=>add('v114fix.js',()=>add('v115fix.js',()=>add('v116_collation_profiles.js',()=>add('v116fix.js',()=>add('v116hotfix.js',()=>add('v116basefix.js',()=>add('v117_energy_catalog.js',()=>add('v117fix.js',()=>add('v117energyfix.js',()=>add('v117finalfix.js',()=>add('v120fix.js')))))))))))))))))));
 };
 const wait=()=>{if(window.__voxV109HotfixR3Ready)return load();if(++tries<900)return setTimeout(wait,25);console.error('VOX V1.2: V1.0.9 R3 readiness timeout')};
 window.addEventListener('load',()=>setTimeout(wait,0));
})();
window.__voxV111BootReady=true;
