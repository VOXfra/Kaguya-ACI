'use strict';
/* Sun & Moon possède neuf énergies de base tirables, dont l'Énergie Fée.
   Le pool global historique de Card Sim vient de SVE et n'en contient que huit.
   Ce correctif complète uniquement la famille sm11 ; Sword & Shield conserve
   huit types dans le slot booster, conformément à sa distribution. */
(function(){
 if(typeof v117EnergyEra!=='function'||typeof v117EnergyPath!=='function'||typeof energyCard!=='function')return;
 const previous=energyCard;
 energyCard=function(setId=state.currentOpening?.setId||state.activeSet){
  const sid=String(setId||''),era=v117EnergyEra(sid);if(era!=='sm')return previous(sid);
  const types=[...ENERGY.map(e=>({name:e.name})),{name:'Fée'}],i=Math.floor(Math.random()*types.length),e=types[i],path=v117EnergyPath(sid,i),foil=Math.random()<Number(SETS?.[sid]?.foilEnergy||0);
  return{id:`v117-energy-sm-${i+1}`,setId:sid,localId:'E',name:`Énergie de base — ${e.name}`,kind:'energy',energyType:e.name,foil,variant:foil?'cosmos':'normal',image:path,imageLarge:path,imageSmall:path,slot:'Énergie',energyYear:v117SetYear(sid),v117EraEnergy:true};
 };
 window.__voxV117EnergyHotfixReady=true;
})();
