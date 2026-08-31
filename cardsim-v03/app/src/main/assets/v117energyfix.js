'use strict';
/* V1.2.0 — énergies de base correspondant réellement à l'époque du booster.
   Les fichiers sont générés au build dans v117_energy_catalog.js et embarqués
   localement. Aucune énergie SVE moderne ne doit contaminer SM/SWSH/Méga. */
const V117_ENERGY_DATA=window.V117_ENERGY_CATALOG||{eras:{}};

function v117EnergyEra(setId){
 const sid=String(setId||''),entry=(typeof v112Entry==='function'?v112Entry(sid):null),cfg=SETS?.[sid]||{},date=String(entry?.releaseDate||cfg.releaseDate||'');
 if(/^me/i.test(sid)||/mega/i.test(String(entry?.seriesId||'')))return'mega';
 if(/^sv/i.test(sid)){
  if(date>='2025-07-18')return'sv2025';
  if(date>='2024-09-13')return'sv2024';
  return'sv2023';
 }
 if(/^swsh/i.test(sid))return date>='2022-02-25'?'swsh2022':'swsh2020';
 if(/^sm/i.test(sid))return date>='2019-02-01'?'sm2019':'sm2017';
 return'';
}
function v117EnergyRows(setId){const era=v117EnergyEra(setId);return Array.isArray(V117_ENERGY_DATA.eras?.[era])?V117_ENERGY_DATA.eras[era]:[]}
function v117EnergyTypeFrench(name){
 const n=String(name||'').toLocaleLowerCase('fr-FR'),aliases={grass:'Plante',plante:'Plante',fire:'Feu',feu:'Feu',water:'Eau',eau:'Eau',lightning:'Électrique','électrique':'Électrique',electrique:'Électrique',psychic:'Psy',psy:'Psy',fighting:'Combat',combat:'Combat',darkness:'Obscurité','obscurité':'Obscurité',obscurite:'Obscurité',metal:'Métal','métal':'Métal',metallic:'Métal',fairy:'Fée','fée':'Fée',fee:'Fée'};
 return aliases[n]||name;
}
function v117EnergyAsset(setId,type){const wanted=v117EnergyTypeFrench(type),rows=v117EnergyRows(setId);return rows.find(x=>x?.name===wanted)||null}

const v117EnergyCardFallback=energyCard;
energyCard=function(setId=state.currentOpening?.setId||state.activeSet){
 const sid=String(setId||state.currentOpening?.setId||state.activeSet||''),rows=v117EnergyRows(sid);
 if(!rows.length)return v117EnergyCardFallback(sid);
 const src=pick(rows),foil=Math.random()<Number(SETS?.[sid]?.foilEnergy||0),year=Number((typeof v112Entry==='function'?v112Entry(sid)?.year:null)||String(SETS?.[sid]?.releaseDate||'').slice(0,4)||0);
 return{id:`${src.id}-${uid('ENERGY')}`,setId:sid,localId:'E',name:`Énergie ${src.name} de base`,kind:'energy',isEnergy:true,energyType:src.name,energyYear:year||null,foil,variant:foil?'cosmos':'normal',rarityKey:'energy',image:src.image,imageSmall:src.image,imageLarge:src.image,slot:'Énergie',v117EraEnergy:true};
};

function v117RestoreBinderEnergyArt(){
 const sid=state.activeSet,year=Number((typeof v112Entry==='function'?v112Entry(sid)?.year:null)||String(SETS?.[sid]?.releaseDate||'').slice(0,4)||0);
 for(const pocket of document.querySelectorAll('#pocketGrid .energy-pocket')){
  const text=(pocket.querySelector('.energy-label')?.textContent||pocket.querySelector('.v117-energy-art strong')?.textContent||'').replace(/^COSMOS\s*·\s*/i,'').trim(),src=v117EnergyAsset(sid,text);
  if(!src?.image)continue;
  pocket.querySelector('.v117-energy-art')?.remove();pocket.querySelector('img')?.remove();
  const im=new Image();im.loading='lazy';im.decoding='async';im.src=src.image;im.alt=`Énergie ${src.name} de base ${year||''}`;im.className='v117-energy-real';pocket.insertBefore(im,pocket.firstChild);
 }
}
const v117EnergyRenderBinderBase=renderBinder;
renderBinder=function(){const r=v117EnergyRenderBinderBase();v117RestoreBinderEnergyArt();return r};

/* Répare aussi une ouverture restaurée depuis une sauvegarde plus ancienne. */
function v117RepairOpeningEnergy(){
 const o=state.currentOpening;if(!o?.setId||!Array.isArray(o.cards))return;
 const rows=v117EnergyRows(o.setId);if(!rows.length)return;
 for(const c of o.cards){
  if(c?.kind!=='energy'&&!c?.isEnergy)continue;
  const src=v117EnergyAsset(o.setId,c.energyType||c.name)||pick(rows);if(!src)continue;
  c.setId=o.setId;c.energyType=src.name;c.name=`Énergie ${src.name} de base`;c.image=c.imageSmall=c.imageLarge=src.image;c.v117EraEnergy=true;
 }
}
/* Il n'existe pas de fonction renderReveal dans le runtime historique : les deux
   points d'entrée réels sont renderOpening() et renderStack(). */
const v117EnergyRenderOpeningBase=renderOpening;
renderOpening=function(){v117RepairOpeningEnergy();return v117EnergyRenderOpeningBase()};
const v117EnergyRenderStackBase=renderStack;
renderStack=function(){v117RepairOpeningEnergy();return v117EnergyRenderStackBase()};

const v117EnergyStyle=document.createElement('style');v117EnergyStyle.textContent=`
#pocketGrid .energy-pocket .v117-energy-real{width:100%;height:100%;object-fit:contain;border-radius:9px;display:block}.energy-card img{object-fit:contain!important}
`;document.head.appendChild(v117EnergyStyle);
window.__voxV117EnergyReady=true;
