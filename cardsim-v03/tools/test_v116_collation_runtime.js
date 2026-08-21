'use strict';
/* Test de release V1.1.6.
   Charge les vrais JSON générés par l'importeur puis exécute le moteur de collation
   sans DOM. L'objectif est de détecter avant l'APK : pool de rareté vide, mauvaise
   longueur de booster, dépendance de sous-collection absente ou retour au vieux
   générateur générique pour un produit booster vérifié. */
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..');
const A=path.join(ROOT,'app','src','main','assets');
const index=JSON.parse(fs.readFileSync(path.join(A,'v111_collection_index.json'),'utf8'));
const profiles=JSON.parse(fs.readFileSync(path.join(A,'v116_collation_profiles.json'),'utf8'));
const sealed=JSON.parse(fs.readFileSync(path.join(A,'v115_sealed_catalog.json'),'utf8'));

const cards=new Map();
for(const row of index.sets||[]){
  const file=path.join(A,'catalog','fr',row.file);
  const payload=JSON.parse(fs.readFileSync(file,'utf8'));
  cards.set(row.id,payload.cards||[]);
}

const verifiedBoosterSets=new Set();
for(const [sid,rows] of Object.entries(sealed.sets||{})){
  if((rows||[]).some(p=>p&&p.mode==='loose'))verifiedBoosterSets.add(sid);
}
for(const sid of verifiedBoosterSets){
  if(!profiles.sets?.[sid])throw new Error(`Produit booster vérifié sans profil V1.1.6: ${sid}`);
}

let fallbackCalls=0;
const state={metaReady:{},currentOpening:null};
for(const sid of cards.keys())state.metaReady[sid]=true;

const ctx={
  console,
  window:null,
  state,
  Math,
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  pick:a=>a&&a.length?a[Math.floor(Math.random()*a.length)]:null,
  cardsFor:sid=>cards.get(sid)||[],
  wrapCard:(c,setId,slot,variant)=>({...c,setId,slot,variant,kind:'card'}),
  energyCard:setId=>({id:`ENERGY-${setId}-${Math.random()}`,setId,localId:'E',name:'Énergie de base',kind:'energy',variant:'normal',slot:'Énergie'}),
  generatePack:setId=>{fallbackCalls++;throw new Error(`fallback-generatePack:${setId}`)},
  startBooster:async()=>null,
  v111HydrateSet:async sid=>cards.has(sid),
  save:()=>{},
};
ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(A,'v116fix.js'),'utf8'),ctx,{filename:'v116fix.js'});

const failures=[];
let tested=0,packs=0;
for(const [sid,profile] of Object.entries(profiles.sets||{})){
  if(profile.confidence==='structure-only')continue;
  if(!(cards.get(sid)||[]).length){failures.push(`${sid}: aucune carte source`);continue;}
  for(const dep of profile.dependencies||[]){
    if(!(cards.get(dep)||[]).length)failures.push(`${sid}: dépendance absente ${dep}`);
  }
  if(failures.length)continue;
  tested++;
  try{
    // 250 générations par set font passer des dizaines de milliers de boosters
    // dans le vrai moteur sans rendre la CI excessivement lente.
    for(let i=0;i<250;i++){
      const pack=ctx.generatePack(sid);
      packs++;
      if(pack.length!==Number(profile.cardCount))throw new Error(`longueur ${pack.length}/${profile.cardCount}`);
      if(pack.some(c=>!c||!c.id))throw new Error('carte nulle/sans id');
    }
  }catch(e){failures.push(`${sid}: ${e&&e.message||e}`)}
}

if(fallbackCalls)failures.push(`ancien générateur appelé ${fallbackCalls} fois`);
if(tested<90)failures.push(`seulement ${tested} profils exécutables`);
if(packs<20000)failures.push(`seulement ${packs} boosters testés`);
if(failures.length){
  console.error('ÉCHECS COLLATION V1.1.6');
  for(const f of failures)console.error(' -',f);
  process.exit(1);
}
console.log(`V1.1.6 runtime OK : ${tested} profils · ${packs} boosters · 0 fallback générique`);
console.log(`Boosters produits vérifiés couverts : ${verifiedBoosterSets.size}/${verifiedBoosterSets.size}`);
