'use strict';
/* VOX Card Sim 1.2.0 — collation Set de Base 1999.

   Les boosters Base Set Unlimited étudiés contiennent 11 cartes : 5 communes,
   2 Énergies de base communes, 3 peu communes et 1 rare (la rare devient holo
   selon le taux du profil). Les six Basic Energy sont les cartes 97–102 du set.

   Jungle/Fossile/Team Rocket restent sur la collation WOTC 7 communes + 3 unco
   + 1 rare : ce correctif ne change donc QUE base1 et ne transforme pas une
   énergie d'une autre époque en carte du booster.
*/
(function(){
 if(typeof v116Wotc!=='function')return;
 const base=v116Wotc;
 const BASIC_IDS=new Set(['97','98','99','100','101','102']);
 v116Wotc=function(setId,profile){
  if(setId!=='base1')return base(setId,profile);
  const p=v116Pools(setId),out=[],r=profile.rates||{};
  const energy=p.common.filter(c=>BASIC_IDS.has(String(c?.localId||'')));
  const common=p.common.filter(c=>!BASIC_IDS.has(String(c?.localId||'')));
  if(energy.length<6||common.length<5)throw new Error(`collation-base1-pools:${common.length}/${energy.length}`);
  v116PushN(out,common,5,setId,'Commune');
  v116PushN(out,energy,2,setId,'Énergie de base');
  out.push(v116Weighted(out,setId,[
   {label:'Secrète',rate:r.secret,pool:p.secret},
   {label:'Holo',rate:r.holo,pool:p.holo}
  ],v116NormalRarePool(p),'Rare'));
  v116PushN(out,p.uncommon,3,setId,'Peu commune');
  return out;
 };
 window.__voxV116BaseFixReady=true;
})();
