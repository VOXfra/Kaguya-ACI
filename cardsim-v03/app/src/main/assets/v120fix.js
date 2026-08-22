'use strict';
/* VOX Card Sim V1.2.0 — consolidation finale + correctif boutique.
   V1.1.7 gère déjà les vraies énergies locales par sous-époque ; cette couche ne
   les remplace pas. Elle durcit la boutique, l'accès aux classeurs et les vieux
   lots de boosters.

   Correctif binder-only : un classeur (physique ou générique) ne suffit jamais à
   faire apparaître une collection dans le sélecteur Boutique. Une collection n'y
   apparaît que si elle possède au moins un vrai produit non-classeur utilisable :
   booster canonique, produit scellé ouvrable/accessoire vérifié, ou ancien SKU
   explicitement approuvé. Les classeurs physiques restent visibles en complément
   quand la collection possède déjà un tel produit. Le rangement reste achetable
   depuis l'écran Classeur pour toutes les collections du catalogue. */
const V120_VERSION='1.2.0';

function v120IsStorageBinder(p){
 return !!p&&(p.v117GenericBinder||p.v117StorageBinder||p.mode==='binderUnlock');
}
function v120IsPhysicalBinder(p){
 return !!p&&!v120IsStorageBinder(p)&&p.contentKind==='binder';
}
function v120IsCoreShopProduct(p){
 if(!p||v120IsStorageBinder(p)||v120IsPhysicalBinder(p))return false;
 if(!p.v115Verified)return true;
 return p.v120ShopVerified===true;
}
function v120DedupeProducts(rows){
 const seen=new Set();return (rows||[]).filter(p=>{const id=String(p?.id||'');if(!id||seen.has(id))return false;seen.add(id);return true});
}

if(typeof v115CreativeItems==='function'){
 const v120CreativeItemsBase=v115CreativeItems;
 function v120CreativeRows(cfg){return (v120CreativeItemsBase(cfg)||[]).filter(Boolean)}
 function v120CoreItems(cfg){return v120CreativeRows(cfg).filter(v120IsCoreShopProduct)}
 v115CreativeItems=function(cfg){
  const rows=v120CreativeRows(cfg),core=rows.filter(v120IsCoreShopProduct);
  if(!core.length)return[];
  /* Un vrai portfolio documenté peut accompagner les produits de l'extension,
     mais il ne rend jamais une extension éligible à lui seul. */
  const physicalBinders=rows.filter(v120IsPhysicalBinder);
  return v120DedupeProducts([...core,...physicalBinders]);
 };
 v113Items=function(cfg){return v08Mode()==='creative'?v115CreativeItems(cfg):(cfg?.products||[])};

 /* V1.1.5 rendait volontairement toutes les collections visibles et V1.1.7 leur
    ajoutait un classeur de simulateur. C'est ce qui créait les pages « classeur
    uniquement ». Le sélecteur Boutique est désormais fondé sur les vrais produits
    non-classeurs, sans retirer la collection du reste du jeu. */
 v113Sets=function(){
  const sets=typeof v115CatalogSets==='function'?v115CatalogSets():Object.values(SETS||{});
  return (sets||[]).filter(cfg=>v120CoreItems(cfg).length>0).sort((a,b)=>(v113Year(b)||0)-(v113Year(a)||0)||String(b.releaseDate||'').localeCompare(String(a.releaseDate||''))||String(a.name||'').localeCompare(String(b.name||''),'fr'));
 };
 v113Years=function(){return [...new Set(v113Sets().map(v113Year).filter(Boolean))].sort((a,b)=>b-a)};
}

function v120BinderOwned(setId){return !!state.binderOwned?.[setId]}
function v120BinderProduct(setId){return typeof v117BinderProduct==='function'?v117BinderProduct(setId):null}
function v120EnsureBinderAction(){
 const root=$('#binder'),sid=state.activeSet;if(!root||!sid)return;
 root.querySelector('.v120-binder-action')?.remove();if(v120BinderOwned(sid))return;
 const p=v120BinderProduct(sid);if(!p)return;
 const box=document.createElement('div');box.className='v120-binder-action panel';
 box.innerHTML=`<div><span class="tag">RANGEMENT</span><strong>${escapeHtml(p.name)}</strong><small>Classeur de rangement du simulateur, disponible même si cette extension n'avait aucun portfolio officiel.</small></div><button class="primary">${v08Mode()==='creative'?'Ajouter':'Acheter · '+money(p.price)}</button>`;
 box.querySelector('button').onclick=()=>buyProduct(sid,p.id);
 const anchor=root.querySelector('.section-title')||root.firstElementChild;anchor?.after(box);
}
const v120RenderBinderBase=renderBinder;
renderBinder=function(){const r=v120RenderBinderBase();v120EnsureBinderAction();return r};

function v120NormalizeBoosterLots(){
 for(const lots of Object.values(state.stockLots||{}))for(const lot of lots||[]){delete lot.v115PackArt;delete lot.v115ProductId;delete lot.packArt;delete lot.artwork}
}
function v120RepairPendingOpening(){
 const o=state.currentOpening;if(!o||o.phase!=='sealed')return;if(o.v115PackArt){delete o.v115PackArt;delete o.packArt}
}
setTimeout(()=>{
 try{v120NormalizeBoosterLots();v120RepairPendingOpening();save();if(v08Mode()==='creative'&&typeof v113RenderCreativeSwitch==='function')v113RenderCreativeSwitch();if($('#shop')?.classList.contains('active'))renderProducts();if($('#binder')?.classList.contains('active'))renderBinder()}
 catch(e){console.warn('V1.2.0 integrity refresh',e)}
},240);

const v120Style=document.createElement('style');v120Style.textContent=`
.v120-binder-action{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;padding:14px 15px;margin:10px 0 16px}.v120-binder-action>div{display:flex;flex-direction:column;gap:4px}.v120-binder-action strong{color:#eef3fa}.v120-binder-action small{color:#8f9caf;line-height:1.4;max-width:620px}.v120-binder-action button{white-space:nowrap}
`;
document.head.appendChild(v120Style);
window.__voxV120Ready=true;
