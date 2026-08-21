'use strict';
/* VOX Card Sim V1.1.6 — correctif ciblé Célébrations.

   Le moteur V1.1.6 interdit volontairement les doublons dans les boosters
   classiques pour éviter des collations impossibles. Célébrations est un cas
   particulier : son mini-set principal est distribué en boosters de quatre cartes
   et une même carte du set principal peut apparaître plusieurs fois dans un pack.
   Le verrou global d'unicité vidait donc parfois le dernier pool.

   On ne relâche PAS l'unicité des autres extensions. Seule cette fonction utilise
   des tirages avec remise, conformément à la nature du booster Célébrations.
*/
(function(){
 if(typeof v116Celebrations!=='function')return;
 v116Celebrations=function(setId,profile){
  const p=v116Pools(setId),out=[],r=profile.rates||{},base=p.all.filter(Boolean);
  if(!base.length)throw new Error('collation-celebrations-empty');

  const direct=(pool,slot,variant='holo')=>{
   const src=(pool&&pool.length)?pool:base,c=pick(src);
   if(!c)throw new Error(`collation-pool-empty:${slot}`);
   return v116Wrap(c,setId,slot,variant);
  };
  const weighted=(items,fallback,slot)=>{
   const x=Math.random();let acc=0;
   for(const item of items){
    const rate=clamp(Number(item?.rate)||0,0,1),pool=item?.pool||[];
    if(!rate||!pool.length)continue;
    acc+=rate;
    if(x<acc)return direct(pool,`${slot} — ${item.label}`,'holo');
   }
   return direct(fallback,slot,'holo');
  };

  out.push(direct(base,'Holo 1'));
  out.push(direct(base,'Holo 2'));
  if(Math.random()<Number(r.classic||0)){
   const dep=v116DependencyCards(profile);
   out.push(dep.length?v116Wrap(pick(dep),pick(dep)?.setId||profile.dependencies?.[0]||setId,'Classic Collection','holo'):direct(base,'Holo 3'));
  }else out.push(direct(base,'Holo 3'));

  out.push(weighted([
   {label:'VMAX',rate:r.vmax,pool:p.vmax},
   {label:'Ultra Rare',rate:r.ultra,pool:p.ultra},
   {label:'V',rate:r.v,pool:p.v},
   {label:'Holo',rate:r.holo,pool:p.holo}
  ],base,'Dernière Holo'));
  return out;
 };
 window.__voxV116HotfixReady=true;
})();
