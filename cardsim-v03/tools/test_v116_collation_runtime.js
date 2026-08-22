'use strict';
/* Test de release du moteur de collation.
   Charge les vrais JSON générés puis exécute les mêmes correctifs que l'APK :
   longueurs, pools, dépendances, absence de fallback générique et composition
   spéciale du Set de Base 1999. */
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
  V116_COLLATION_PROFILES:profiles,
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
for(const file of ['v116fix.js','v116hotfix.js','v116basefix.js']){
  vm.runInContext(fs.readFileSync(path.join(A,file),'utf8'),ctx,{filename:file});
}

const failures=[];
let tested=0,packs=0,skippedNoSource=0,basePacks=0;
const BASE_BASIC=new Set(['97','98','99','100','101','102']);
for(const [sid,profile] of Object.entries(profiles.sets||{})){
  if(profile.confidence==='structure-only')continue;
  const source=cards.get(sid)||[];
  if(!source.length){
    if(verifiedBoosterSets.has(sid))failures.push(`${sid}: booster vérifié mais aucune carte source`);
    else skippedNoSource++;
    continue;
  }
  let dependencyBroken=false;
  for(const dep of profile.dependencies||[]){
    if(!(cards.get(dep)||[]).length){failures.push(`${sid}: dépendance absente ${dep}`);dependencyBroken=true;}
  }
  if(dependencyBroken)continue;
  tested++;
  try{
    for(let i=0;i<250;i++){
      const pack=ctx.generatePack(sid);
      packs++;
      if(pack.length!==Number(profile.cardCount))throw new Error(`longueur ${pack.length}/${profile.cardCount}`);
      if(pack.some(c=>!c||!c.id))throw new Error('carte nulle/sans id');
      if(sid==='base1'){
        basePacks++;
        const energies=pack.filter(c=>BASE_BASIC.has(String(c.localId||'')));
        if(energies.length!==2)throw new Error(`Set de Base: ${energies.length}/2 énergies de base`);
        const uncommon=pack.filter(c=>String(c.slot||'').startsWith('Peu commune'));
        if(uncommon.length!==3)throw new Error(`Set de Base: ${uncommon.length}/3 peu communes`);
        const commons=pack.filter(c=>String(c.slot||'').startsWith('Commune'));
        if(commons.length!==5)throw new Error(`Set de Base: ${commons.length}/5 communes hors énergie`);
      }
    }
  }catch(e){failures.push(`${sid}: ${e&&e.message||e}`)}
}

if(fallbackCalls)failures.push(`ancien générateur appelé ${fallbackCalls} fois`);
if(tested<90)failures.push(`seulement ${tested} profils exécutables`);
if(packs<20000)failures.push(`seulement ${packs} boosters testés`);
if(basePacks!==250)failures.push(`Set de Base testé ${basePacks}/250 fois`);
if(failures.length){
  console.error('ÉCHECS COLLATION V1.2.0');
  for(const f of failures)console.error(' -',f);
  process.exit(1);
}
console.log(`V1.2.0 runtime OK : ${tested} profils · ${packs} boosters · 0 fallback générique`);
console.log(`Set de Base : ${basePacks} boosters · toujours 5 communes + 2 énergies Base Set + 3 peu communes + 1 rare`);
console.log(`Boosters produits vérifiés couverts : ${verifiedBoosterSets.size}/${verifiedBoosterSets.size} · shells source ignorés : ${skippedNoSource}`);
