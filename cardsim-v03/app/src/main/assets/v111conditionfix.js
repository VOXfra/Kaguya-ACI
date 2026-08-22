'use strict';

/* Intégration finale de la qualité des scellés avec les wrappers V0.8/V1.1 déjà
   chargés : conserve Booster Chance, garde-fous Créatif et usure visible en modal. */
(function(){
 const baseBooster=renderBoosterInventory;
 renderBoosterInventory=function(out){
  baseBooster(out);
  if(v08Mode()==='ludic'&&state.luckyPacks>0&&!out.querySelector('.v08-lucky-row')){
   const e=document.createElement('div');e.className='sealed-row panel stock-row v08-lucky-row';e.innerHTML=`<div class="v08-lucky-pack">★</div><div class="stock-copy"><strong>Booster Chance</strong><span>Récompense ludique · 1 carte Rare ou mieux</span><b>×${state.luckyPacks}</b></div><div class="row-actions"><button class="primary">Ouvrir</button></div>`;e.querySelector('button').onclick=()=>v08OpenLuckyPack(state.activeSet);out.prepend(e);
  }
  try{v08CreativeInventoryGuards?.(out)}catch{}
 };
 const baseSealed=renderSealedInventory;
 renderSealedInventory=function(out){baseSealed(out);try{v08CreativeInventoryGuards?.(out)}catch{}};

 /* Les anciennes sauvegardes contiennent encore « Scellé ». Elles sont migrées
    vers « Neuf » une fois, sans toucher aux nouvelles qualités du Marketplace. */
 for(const b of Object.values(state.marketBooks||{}))if(['booster','sealed'].includes(b?.asset?.type))for(const o of b.offers||[])if(o.condition==='Scellé')o.condition='Neuf';
 for(const l of state.listings||[])if(['booster','sealed'].includes(l?.type)&&l.condition==='Scellé')l.condition='Neuf';

 if(typeof v110ApplyConditionVisual==='function'){
  const baseVisual=v110ApplyConditionVisual;
  v110ApplyConditionVisual=function(visual,ins,c){
   const r=baseVisual(visual,ins,c);if(!visual||!ins||ins.isEnergy)return r;
   visual.querySelectorAll('.v111-modal-damage').forEach(x=>x.remove());
   const score=Number(ins.conditionScore||v110ConditionScore(ins.conditionDetail)||100),severity=clamp((100-score)/52,0,1),flags=ins.damageFlags||{};
   if(severity>.07){const l=document.createElement('div');l.className='v111-pack-damage v111-modal-damage';l.style.setProperty('--damage',String(severity));l.classList.toggle('crease',!!flags.crease);l.classList.toggle('moisture',!!flags.moisture);l.classList.toggle('scratch',!!flags.scratch);l.classList.toggle('whitening',!!flags.whitening||severity>.22);visual.appendChild(l)}return r;
  };
 }

 save();
})();
window.__voxV111ConditionFixReady=true;
