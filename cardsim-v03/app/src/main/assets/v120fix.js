'use strict';
/* VOX Card Sim V1.2.0 — couche de consolidation.
   - le classeur générique est toujours obtenable, même sans portfolio officiel ;
   - la boutique ne présente plus comme « vérifié » un scellé dont le contenu est
     encore inconnu ;
   - les artworks d'un booster restent des variantes d'ouverture, jamais des SKU ;
   - les énergies utilisent un visuel de la même série/époque lorsqu'il est vérifié,
     sinon le placeholder neutre V1.1.7 est conservé plutôt qu'une mauvaise année. */
const V120_VERSION='1.2.0';
const V120_ENERGY=window.V120_ENERGY_CATALOG||{schema:120,sets:{},stats:{}};

/* ---------- BOUTIQUE : uniquement les références simulables proprement ---------- */
if(typeof v115CreativeItems==='function'){
 const v120CreativeItemsBase=v115CreativeItems;
 v115CreativeItems=function(cfg){
  return (v120CreativeItemsBase(cfg)||[]).filter(p=>{
   if(!p)return false;
   if(p.v117GenericBinder||p.v117CanonicalBooster)return true;
   /* Les anciennes références locales vérifiées manuellement ne viennent pas du
      catalogue V1.1.5 et restent autorisées. */
   if(!p.v115Verified)return true;
   return p.v120ShopVerified===true;
  });
 };
 v113Items=function(cfg){return v115CreativeItems(cfg)};
}

/* ---------- CLASSEUR GÉNÉRIQUE : accès depuis l'écran Classeur ---------- */
function v120BinderOwned(setId){return !!state.binderOwned?.[setId]}
function v120EnsureBinderAction(){
 const root=$('#binder'),sid=state.activeSet;if(!root||!sid)return;
 root.querySelector('.v120-binder-action')?.remove();
 if(v120BinderOwned(sid))return;
 const p=typeof v117BinderProduct==='function'?v117BinderProduct(sid):null;if(!p)return;
 const box=document.createElement('div');box.className='v120-binder-action panel';
 box.innerHTML=`<div><span class="tag">RANGEMENT</span><strong>${escapeHtml(p.name)}</strong><small>Un classeur générique du simulateur est disponible même lorsqu'aucun portfolio officiel n'a été commercialisé avec cette extension.</small></div><button class="primary">${v08Mode()==='creative'?'Ajouter':'Acheter · '+money(p.price)}</button>`;
 box.querySelector('button').onclick=()=>buyProduct(sid,p.id);
 const anchor=root.querySelector('.section-title')||root.firstElementChild;anchor?.after(box);
}

/* ---------- ÉNERGIES PAR ÉPOQUE ---------- */
function v120NormEnergy(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]+/g,'')}
function v120EnergyRows(setId){return V120_ENERGY.sets?.[setId]?.energies||[]}
function v120EnergyFor(setId,type){
 const want=v120NormEnergy(type),aliases={plante:'plante',grass:'plante',feu:'feu',fire:'feu',eau:'eau',water:'eau',electrique:'electrique',lightning:'electrique',psy:'psy',psychic:'psy',combat:'combat',fighting:'combat',obscurite:'obscurite',darkness:'obscurite',metal:'metal',fee:'fee',fairy:'fee'};
 const key=aliases[want]||want;
 return v120EnergyRows(setId).find(x=>(aliases[v120NormEnergy(x?.type)]||v120NormEnergy(x?.type))===key)||null;
}
const v120EnergyCardBase=energyCard;
energyCard=function(setId=state.currentOpening?.setId||state.activeSet){
 const sid=String(setId||state.activeSet||''),c=v120EnergyCardBase(sid);if(!c)return c;
 const src=v120EnergyFor(sid,c.energyType||c.name);
 if(src){
  c.id=src.id||c.id;c.imageLarge=src.imageLarge||src.imageSmall||'';c.imageSmall=src.imageSmall||src.imageLarge||'';
  c.v120EraEnergy=true;c.energySourceSet=V120_ENERGY.sets?.[sid]?.sourceSet||'';c.energySourceYear=V120_ENERGY.sets?.[sid]?.sourceYear||null;
 }else{
  c.imageLarge='';c.imageSmall='';c.v120EraEnergy=false;
 }
 return c;
};
function v120RepairEnergyCard(c,setId){
 if(!c||c.kind!=='energy')return c;const sid=String(setId||c.setId||state.activeSet||''),src=v120EnergyFor(sid,c.energyType||c.name);
 if(src){c.setId=sid;c.imageLarge=src.imageLarge||src.imageSmall||'';c.imageSmall=src.imageSmall||src.imageLarge||'';c.v120EraEnergy=true;c.energySourceSet=V120_ENERGY.sets?.[sid]?.sourceSet||'';c.energySourceYear=V120_ENERGY.sets?.[sid]?.sourceYear||null}
 else{c.imageLarge='';c.imageSmall='';c.v120EraEnergy=false}
 return c;
}
function v120RepairPersistedEnergies(){
 const o=state.currentOpening;if(o?.cards)for(const c of o.cards)v120RepairEnergyCard(c,o.setId);
 for(const ins of state.instances||[]){
  if(!ins?.isEnergy)continue;const src=v120EnergyFor(ins.setId||state.activeSet,ins.energyType||ins.name);
  if(src){ins.imageLarge=src.imageLarge||src.imageSmall||'';ins.imageSmall=src.imageSmall||src.imageLarge||'';ins.v120EraEnergy=true;ins.energySourceSet=V120_ENERGY.sets?.[ins.setId]?.sourceSet||''}
  else{ins.imageLarge='';ins.imageSmall='';ins.v120EraEnergy=false}
 }
}

/* V1.1.7 remplaçait toujours les énergies du classeur par une tuile neutre. Si
   V1.2.0 connaît réellement le scan de cette époque, on l'affiche. */
function v120DecorateEnergyPockets(){
 const sid=state.activeSet;
 for(const pocket of document.querySelectorAll('#pocketGrid .energy-pocket')){
  const label=pocket.querySelector('.energy-label')?.textContent||pocket.textContent||'';
  const src=v120EnergyFor(sid,label);if(!src)continue;
  pocket.querySelector('.v117-energy-art')?.remove();let img=pocket.querySelector('img.v120-energy-scan');
  if(!img){img=document.createElement('img');img.className='v120-energy-scan';img.alt=label;pocket.insertBefore(img,pocket.firstChild)}
  img.src=src.imageSmall||src.imageLarge;
 }
}

/* ---------- RENDUS / MIGRATION ---------- */
const v120RenderBinderBase=renderBinder;
renderBinder=function(){const r=v120RenderBinderBase();v120EnsureBinderAction();v120DecorateEnergyPockets();return r};

/* Les vieux lots V1.1.5 pouvaient mémoriser un artwork particulier. On le supprime
   des lots : V1.1.7 choisit désormais le wrapper à chaque ouverture. */
function v120NormalizeBoosterLots(){
 for(const lots of Object.values(state.stockLots||{}))for(const lot of lots||[]){delete lot.v115PackArt;delete lot.v115ProductId}
}

setTimeout(()=>{
 try{
  v120NormalizeBoosterLots();v120RepairPersistedEnergies();save();
  if($('#shop')?.classList.contains('active'))renderProducts();
  if($('#binder')?.classList.contains('active'))renderBinder();
  if($('#opening')?.classList.contains('active'))renderOpening();
 }catch(e){console.warn('V1.2.0 integrity refresh',e)}
},220);

const v120Style=document.createElement('style');v120Style.textContent=`
.v120-binder-action{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;padding:14px 15px;margin:10px 0 16px}.v120-binder-action>div{display:flex;flex-direction:column;gap:4px}.v120-binder-action strong{color:#eef3fa}.v120-binder-action small{color:#8f9caf;line-height:1.4;max-width:620px}.v120-binder-action button{white-space:nowrap}.v120-energy-scan{display:block;width:100%;height:100%;object-fit:contain;border-radius:8px}
`;
document.head.appendChild(v120Style);
window.__voxV120Ready=true;
