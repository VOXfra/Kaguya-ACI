'use strict';
/* VOX Card Sim V1.2.0 — consolidation finale.
   V1.1.7 gère déjà les vraies énergies locales par sous-époque ; cette couche ne
   les remplace pas. Elle durcit uniquement la boutique, l'accès aux classeurs et
   les vieux lots de boosters. */
const V120_VERSION='1.2.0';

/* ---------- BOUTIQUE : ne plus présenter les scellés inconnus comme exploitables ---------- */
if(typeof v115CreativeItems==='function'){
 const v120CreativeItemsBase=v115CreativeItems;
 v115CreativeItems=function(cfg){
  return (v120CreativeItemsBase(cfg)||[]).filter(p=>{
   if(!p)return false;
   if(p.v117GenericBinder||p.v117StorageBinder||p.v117CanonicalBooster)return true;
   /* Les produits historiques codés/validés manuellement ne sont pas des imports
      V1.1.5 et restent disponibles. Pour les imports automatiques, la validation
      V1.2.0 est obligatoire. */
   if(!p.v115Verified)return true;
   return p.v120ShopVerified===true;
  });
 };
 v113Items=function(cfg){return v08Mode()==='creative'?v115CreativeItems(cfg):(cfg?.products||[])};
}

/* ---------- CLASSEUR GÉNÉRIQUE : toujours obtenable ---------- */
function v120BinderOwned(setId){return !!state.binderOwned?.[setId]}
function v120BinderProduct(setId){
 if(typeof v117BinderProduct==='function')return v117BinderProduct(setId);
 return null;
}
function v120EnsureBinderAction(){
 const root=$('#binder'),sid=state.activeSet;if(!root||!sid)return;
 root.querySelector('.v120-binder-action')?.remove();
 if(v120BinderOwned(sid))return;
 const p=v120BinderProduct(sid);if(!p)return;
 const box=document.createElement('div');box.className='v120-binder-action panel';
 box.innerHTML=`<div><span class="tag">RANGEMENT</span><strong>${escapeHtml(p.name)}</strong><small>Classeur de rangement du simulateur, disponible même si cette extension n'avait aucun portfolio officiel.</small></div><button class="primary">${v08Mode()==='creative'?'Ajouter':'Acheter · '+money(p.price)}</button>`;
 box.querySelector('button').onclick=()=>buyProduct(sid,p.id);
 const anchor=root.querySelector('.section-title')||root.firstElementChild;anchor?.after(box);
}
const v120RenderBinderBase=renderBinder;
renderBinder=function(){const r=v120RenderBinderBase();v120EnsureBinderAction();return r};

/* ---------- BOOSTERS : un lot = une extension, jamais un artwork ---------- */
function v120NormalizeBoosterLots(){
 for(const lots of Object.values(state.stockLots||{}))for(const lot of lots||[]){delete lot.v115PackArt;delete lot.v115ProductId;delete lot.packArt;delete lot.artwork}
}

/* Les fonctions V1.1.7 choisissent déjà `artworks[]` au moment de l'ouverture.
   Ce garde-fou retire aussi une éventuelle image figée d'une ouverture sauvegardée
   avant la migration tant que le booster n'a pas encore été déchiré. */
function v120RepairPendingOpening(){
 const o=state.currentOpening;if(!o||o.phase!=='sealed')return;
 if(o.v115PackArt){delete o.v115PackArt;delete o.packArt}
}

setTimeout(()=>{
 try{
  v120NormalizeBoosterLots();v120RepairPendingOpening();save();
  if($('#shop')?.classList.contains('active'))renderProducts();
  if($('#binder')?.classList.contains('active'))renderBinder();
 }catch(e){console.warn('V1.2.0 integrity refresh',e)}
},240);

const v120Style=document.createElement('style');v120Style.textContent=`
.v120-binder-action{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;padding:14px 15px;margin:10px 0 16px}.v120-binder-action>div{display:flex;flex-direction:column;gap:4px}.v120-binder-action strong{color:#eef3fa}.v120-binder-action small{color:#8f9caf;line-height:1.4;max-width:620px}.v120-binder-action button{white-space:nowrap}
`;
document.head.appendChild(v120Style);
window.__voxV120Ready=true;
