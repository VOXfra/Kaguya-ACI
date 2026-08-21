'use strict';
/* VOX Card Sim V1.1.6 — derniers correctifs de collation.

   1. Quelques entrées TCGdex appartiennent à une série physique mais ne sont pas
      des extensions à booster aléatoire : Bienvenue à Kalos (xy0), Wizards Black
      Star Promos (basep) et W Promotional (wp). Elles restent dans le catalogue
      de cartes mais ne doivent jamais recevoir un générateur de booster.
   2. Célébrations est un mini-set de quatre cartes où des doublons du set principal
      peuvent réellement coexister. On autorise donc le tirage avec remise pour CE
      booster uniquement, sans relâcher l'unicité des autres familles.
*/
(function(){
 try{
  if(typeof V116_DATA==='object'&&V116_DATA?.sets){
   for(const sid of ['xy0','basep','wp'])delete V116_DATA.sets[sid];
  }
 }catch(e){console.warn('V1.1.6 non-booster exclusion',e)}

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
   const dep=v116DependencyCards(profile),c=dep.length?pick(dep):null;
   out.push(c?v116Wrap(c,c.setId||profile.dependencies?.[0]||setId,'Classic Collection','holo'):direct(base,'Holo 3'));
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
