'use strict';
/* V1.2.x : charge les couches historiques, le catalogue canonique, les produits,
   la collation 1.1.6, puis les correctifs d'intégrité et de progression.
   La séquence est volontairement déclarative : ajouter une couche ne dépend plus
   d'une longue chaîne de callbacks fragile aux parenthèses. */
(function v111Boot(){
 let tries=0;
 const layers=[
  'v111fix.js','v111catalogfix.js','v111condition.js','v111conditionfix.js','v111perf.js',
  'v112fix.js','v113fix.js','v114fix.js','v115fix.js','v116_collation_profiles.js',
  'v116fix.js','v116hotfix.js','v116basefix.js','v117_energy_catalog.js','v117fix.js',
  'v117energyfix.js','v117finalfix.js','v120fix.js','v121fix.js','v122fix.js','v122economyfix.js','v122finalfix.js','v123fix.js','v124fix.js','v125fix.js','v126fix.js','v127fix.js','v128fix.js'
 ];
 const add=(src,done)=>{
  const s=document.createElement('script');s.src=src;
  s.onload=()=>done?.();
  s.onerror=e=>console.error('VOX V1.2 layer failed',src,e);
  document.body.appendChild(s);
 };
 const load=()=>{
  if(window.__voxV111LoadStarted)return;window.__voxV111LoadStarted=true;
  const next=i=>{if(i>=layers.length)return;add(layers[i],()=>next(i+1))};
  next(0);
 };
 const wait=()=>{
  if(window.__voxV109HotfixR3Ready)return load();
  if(++tries<900)return setTimeout(wait,25);
  console.error('VOX V1.2: V1.0.9 R3 readiness timeout');
 };
 window.addEventListener('load',()=>setTimeout(wait,0));
})();
window.__voxV111BootReady=true;
