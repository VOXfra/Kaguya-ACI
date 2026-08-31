'use strict';

/* VOX Card Sim V0.9.1 — physical energy pages for every collection.
   Energy slots are part of binder capacity instead of being appended after
   the complete numbered set, which made large sets (notably Paldea) unable
   to store/display their keeper energies in a single physical binder. */
const V091_VERSION='0.9.1';

function v091HasCosmos(setId){
 const cfg=SETS[setId];
 if(Number(cfg?.foilEnergy)>0)return true;
 return (state.instances||[]).some(x=>x?.setId===setId&&x.isEnergy&&x.status!=='sold'&&(x.variant||'normal')==='cosmos');
}
function v091EnergyVariants(setId){return v091HasCosmos(setId)?['normal','cosmos']:['normal']}
function v091EnergySlotCount(setId){return ENERGY.length*v091EnergyVariants(setId).length}
function v091NumberedCapacity(setId){return Math.max(0,v090BinderCapacity(setId)-v091EnergySlotCount(setId))}
function v091NumberedSlots(setId){return Math.min(Number(SETS[setId]?.total)||0,v091NumberedCapacity(setId))}
function v091EnergyStart(setId){return v091NumberedSlots(setId)}

/* A keeper energy always has a physical slot as soon as at least one binder
   exists. Normal energy gets eight reserved pockets in all sets; Cosmos gets
   another eight only for sets that can actually produce/own Cosmos energy. */
v062EnergySlot=function(setId,energyType,variant){
 const capacity=v090BinderCapacity(setId);if(capacity<=0)return null;
 const typeIndex=ENERGY.findIndex(e=>e.name===energyType);if(typeIndex<0)return null;
 const variants=v091EnergyVariants(setId),v=variant==='cosmos'?'cosmos':'normal',variantIndex=variants.indexOf(v);if(variantIndex<0)return null;
 const slot=v091EnergyStart(setId)+(variantIndex*ENERGY.length)+typeIndex;
 return slot<capacity?slot:null;
};

/* Reconcile both numbered cards and energies against the real physical
   layout. Numbered cards never overwrite the reserved energy pockets. */
reconcileBinder=function(setId){
 const capacity=v090BinderCapacity(setId),numberedSlots=v091NumberedSlots(setId),owns=capacity>0,cardGroups=new Map(),energyGroups=new Map();v090SyncBinderOwned(setId);
 for(const ins of state.instances||[]){
  if(ins?.setId!==setId||ins.status!=='owned')continue;
  if(ins.isEnergy){const k=`${ins.energyType}|${ins.variant||'normal'}`;if(!energyGroups.has(k))energyGroups.set(k,[]);energyGroups.get(k).push(ins)}
  else if(ins.cardId){if(!cardGroups.has(ins.cardId))cardGroups.set(ins.cardId,[]);cardGroups.get(ins.cardId).push(ins)}
 }
 const age=x=>Number(x.openedAt||x.acquiredAt||0);
 for(const [cardId,arr] of cardGroups){
  let chosen=arr[0];for(const x of arr)if(age(x)<age(chosen))chosen=x;
  const c=cardById(setId,cardId),slot=c?cardNo(c)-1:null,can=owns&&slot!==null&&slot>=0&&slot<numberedSlots;
  for(const ins of arr){if(ins===chosen&&can){ins.location='binder';ins.binderSlot=slot}else{ins.location='inventory';ins.binderSlot=null}}
 }
 for(const arr of energyGroups.values()){
  let keeper=arr.find(x=>x.energyKeeper)||arr[0];for(const x of arr)if(age(x)<age(keeper))keeper=x;
  for(const x of arr)x.energyKeeper=x===keeper;
  const slot=owns?v062EnergySlot(setId,keeper.energyType,keeper.variant):null;
  if(slot!==null&&slot!==undefined){keeper.location='binder-energy';keeper.binderSlot=slot}else{keeper.location='inventory';keeper.binderSlot=null}
  for(const x of arr)if(x!==keeper){x.location='inventory';x.binderSlot=null}
 }
};

/* One binder must have enough room for the numbered set plus the energy
   section. Large sets therefore correctly request a second physical binder. */
v090RequiredBinders=function(setId){const spec=v090BinderSpec(setId),cfg=SETS[setId];return spec&&cfg?Math.max(1,Math.ceil((Number(cfg.total||0)+v091EnergySlotCount(setId))/spec.capacity)):1};

/* Re-render the physical page with an explicit numbered-card region followed
   by the energy region. With one Paldea binder this means #001–#244 + 8
   energy pockets; buying binder 2 expands numbered storage to the full 279. */
v090RenderBinderCore=function(){
 const sid=state.activeSet,cfg=SETS[sid],spec=v090BinderSpec(sid);if(!cfg||!spec)return;
 const count=v090BinderCount(sid),capacity=spec.capacity*count,pages=spec.pages*count,toolbar=v090EnsureBinderToolbar();v090SyncBinderOwned(sid);
 const numberedSlots=v091NumberedSlots(sid),energyStart=v091EnergyStart(sid),energyVariants=v091EnergyVariants(sid),energyCount=v091EnergySlotCount(sid);
 if(toolbar){
  const need=v090RequiredBinders(sid),missing=Math.max(0,Number(cfg.total||0)-numberedSlots);
  toolbar.innerHTML=`<div><strong>${count} classeur${count!==1?'s':''} physique${count!==1?'s':''}</strong><span>${capacity} emplacements · ${energyCount} réservé${energyCount!==1?'s':''} aux énergies${missing?` · ${missing} carte(s) numérotée(s) dépassent encore la capacité`:''}</span></div><button id="v090AddBinder" class="secondary small">${count?'Acheter un autre':'Acheter le classeur'}</button>`;
  toolbar.querySelector('#v090AddBinder').onclick=()=>v090BuyBinder(sid);toolbar.classList.toggle('capacity-ok',count>=need);
 }
 $('#binderTitle').textContent=`Classeur ${cfg.name}`;const prev=$('#prevPage'),next=$('#nextPage'),g=$('#pocketGrid');
 if(!count){
  $('#binderMetaName').textContent='Aucun classeur physique';$('#binderMetaCount').textContent='Achète un classeur pour ranger automatiquement la première copie';$('#pageNum').textContent='—';$('#pageTotal').textContent='—';
  g.innerHTML='<div class="binder-locked"><div>▤</div><strong>Classeur non possédé</strong><p>Les cartes et les énergies restent dans l’inventaire tant qu’aucun classeur n’est disponible.</p><button id="v090BuyBinderLocked" class="primary">Acheter le classeur</button></div>';
  g.querySelector('#v090BuyBinderLocked').onclick=()=>v090BuyBinder(sid);if(prev)prev.disabled=true;if(next)next.disabled=true;return;
 }
 let page=clamp(Number(state.pageBySet[sid])||0,0,Math.max(0,pages-1));state.pageBySet[sid]=page;const volume=Math.floor(page/spec.pages)+1;
 $('#binderMetaName').textContent=`${spec.name} · Volume ${volume}/${count}`;$('#binderMetaCount').textContent=`${capacity} emplacements physiques · ${cfg.total} cartes de set · ${energyCount} cases énergie`;$('#pageNum').textContent=page+1;$('#pageTotal').textContent=pages;if(prev)prev.disabled=page<=0;if(next)next.disabled=page>=pages-1;
 g.innerHTML='';const start=page*9;
 for(let i=0;i<9;i++){
  const slot=start+i,e=document.createElement('div');e.className='pocket';
  if(slot<numberedSlots){
   const c=getCard(sid,slot+1),ins=c?binderInstance(c.id,sid):null;
   if(ins&&c){const im=new Image();im.loading='lazy';im.decoding='async';im.src=cardImg(c,'low');im.alt=c.name;im.onclick=()=>openCardModal(c,ins);e.appendChild(im);const b=document.createElement('span');b.className='pocket-number';b.textContent=`#${String(slot+1).padStart(3,'0')}`;e.appendChild(b)}
   else{e.classList.add('empty','unknown');e.innerHTML=`<span>#${String(slot+1).padStart(3,'0')}</span>`}
  }else if(slot>=energyStart&&slot<energyStart+energyCount){
   const off=slot-energyStart,variantIndex=Math.floor(off/ENERGY.length),typeIndex=off%ENERGY.length,variant=energyVariants[variantIndex]||'normal',type=ENERGY[typeIndex]?.name,ins=type&&typeof v062EnergyKeeper==='function'?v062EnergyKeeper(sid,type,variant):null,en=ENERGY[typeIndex];
   e.className='pocket energy-pocket'+(ins?'':' empty');
   if(ins){const im=new Image();im.loading='lazy';im.decoding='async';im.src=en?.thumb||ins.imageSmall||'';im.alt=`Énergie ${type}`;e.appendChild(im)}
   const b=document.createElement('span');b.className='pocket-number energy-label';b.textContent=`${variant==='cosmos'?'COSMOS · ':''}${type||'Énergie'}`;e.appendChild(b);
  }else{e.classList.add('empty','spare');e.innerHTML='<span>LIBRE</span>'}
  g.appendChild(e);
 }
};

/* Card acquisition remains O(1): only correct the just-created instance if
   its numbered slot is currently outside the physical numbered-card region. */
const v091AddCardBase=addCardInstance;
addCardInstance=function(c){const ins=v091AddCardBase(c);if(ins&&!ins.isEnergy&&ins.location==='binder'&&Number(ins.binderSlot)>=v091NumberedSlots(ins.setId)){ins.location='inventory';ins.binderSlot=null}return ins};

/* Existing saves are repaired immediately. This promotes the oldest keeper of
   every owned energy type into the appropriate binder without duplicating it. */
for(const sid of Object.keys(SETS))try{reconcileBinder(sid)}catch(e){console.warn('V0.9.1 energy reconcile',sid,e)}
try{v081RebuildInstanceIndexes?.()}catch{}
v081PersistSoon?.(350);
if($('#binder')?.classList.contains('active'))renderBinder();
if($('#inventory')?.classList.contains('active'))renderInventory();
window.__voxV091EnergyReady=true;
