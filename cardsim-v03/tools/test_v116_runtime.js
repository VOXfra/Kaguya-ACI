'use strict';
/* Test Node du moteur V1.1.6 contre les vrais JSON générés par la release.
   Aucun DOM ni réseau : on charge exactement les cartes qui seront embarquées
   dans l'APK puis on ouvre plusieurs boosters de chaque profil exploitable. */
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const A=path.join(ROOT,'app','src','main','assets');

global.window=global;
global.V116_COLLATION_PROFILES=JSON.parse(fs.readFileSync(path.join(A,'v116_collation_profiles.json'),'utf8'));
global.state={metaReady:{},sets:{},currentOpening:null,activeSet:null};
global.clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
global.pick=a=>a[Math.floor(Math.random()*a.length)];
global.cardsFor=id=>state.sets[id]?.cards||[];
global.wrapCard=(c,setId,slot,variant)=>({...c,setId,slot,variant,kind:'card'});
global.energyCard=setId=>({id:`ENERGY-${setId}-${Math.random()}`,setId,localId:'E',name:'Énergie de base',kind:'energy',variant:'normal'});
global.generatePack=setId=>{throw new Error(`legacy-generatePack-called:${setId}`)};
global.startBooster=async()=>{};

function loadSet(id){
 if(state.metaReady[id])return true;
 const file=path.join(A,'catalog','fr',`${id}.json`);if(!fs.existsSync(file))return false;
 const data=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!(data.cards||[]).length)return false;
 state.sets[id]={cards:data.cards.map(c=>({...c,setId:id}))};state.metaReady[id]=true;return true;
}
global.v111HydrateSet=async id=>loadSet(id);
vm.runInThisContext(fs.readFileSync(path.join(A,'v116fix.js'),'utf8'),{filename:'v116fix.js'});

const NON_RANDOM_PRODUCTS=new Set(['xy0','basep','wp']);
const failures=[];let tested=0,packs=0;
for(const [sid,profile] of Object.entries(V116_COLLATION_PROFILES.sets||{})){
 if(profile.confidence==='structure-only'||NON_RANDOM_PRODUCTS.has(sid))continue;
 try{
  if(!loadSet(sid))throw new Error('catalogue sans cartes');
  for(const dep of profile.dependencies||[])if(!loadSet(dep))throw new Error(`dépendance absente ${dep}`);
  for(let i=0;i<40;i++){
   const pack=generatePack(sid);packs++;
   if(pack.length!==Number(profile.cardCount))throw new Error(`longueur ${pack.length}/${profile.cardCount}`);
   const ids=pack.filter(c=>c.kind==='card').map(c=>c.id);
   if(new Set(ids).size!==ids.length)throw new Error('carte dupliquée dans un booster');
  }
  tested++;
 }catch(e){failures.push(`${sid} [${profile.family}] : ${e.message||e}`)}
}

// Les POP ont bien 2 cartes physiquement, mais aucun taux exact suffisamment
// documenté : le moteur doit refuser de simuler un faux tirage.
for(const sid of ['pop1','pop2','pop3','pop4','pop7','pop9']){
 const p=V116_COLLATION_PROFILES.sets?.[sid];if(!p)continue;loadSet(sid);
 let blocked=false;try{generatePack(sid)}catch(e){blocked=String(e.message||e).includes('collation-rates-undocumented')}
 if(!blocked)failures.push(`${sid}: ouverture POP non documentée non bloquée`);
}

if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`V1.1.6 runtime : ${tested} profils exercés · ${packs} boosters valides · POP non inventés`);
