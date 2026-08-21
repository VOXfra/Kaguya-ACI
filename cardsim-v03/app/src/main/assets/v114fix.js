'use strict';
/* VOX Card Sim V1.1.4 — toutes les collections en Créatif + pile d'ouverture stable.

   Deux régressions étaient encore visibles sur Android :
   1. V1.1.3 ne listait en Créatif que les collections possédant déjà un `products[]`
      historique. Les shells importés automatiquement par V1.1 ont volontairement
      `products:[]`, donc une grande partie des 200 collections restait invisible.
   2. Le renderer holo V0.5 ajoute la classe `.v05-holo`, dont l'ancien CSS remet
      `position:relative`. Cela écrase `.reveal-card{position:absolute}` et une carte
      holo/reverse peut sortir de la pile et pousser les cartes suivantes vers le bas.

   V1.1.4 ne fabrique aucun produit historique : quand une collection n'a aucun
   booster physique vérifié, le mode Créatif reçoit uniquement un « Pack créatif »
   explicitement identifié comme produit de simulation. Il donne accès à la collection
   sans laisser croire qu'un booster officiel précis a existé. */
const V114_VERSION='1.1.4';
const V114_VIRTUAL_PRODUCTS=new Map();

function v114CatalogEntry(setId){
 try{return typeof v112Entry==='function'?v112Entry(setId):(V111_ENTRY_BY_ID?.get?.(setId)||null)}catch{return null}
}
function v114CatalogSets(){
 const ids=(V111_INDEX?.sets||[]).map(x=>x?.id).filter(Boolean),seen=new Set(),out=[];
 for(const id of ids){if(seen.has(id))continue;seen.add(id);const cfg=SETS?.[id];if(cfg)out.push(cfg)}
 /* Garde-fou debug/web : si l'index n'est pas chargé, on ne perd pas les sets natifs. */
 if(!out.length)for(const cfg of Object.values(SETS||{})){if(cfg?.id&&!seen.has(cfg.id)){seen.add(cfg.id);out.push(cfg)}}
 return out.sort((a,b)=>(v113Year?.(b)||0)-(v113Year?.(a)||0)||String(b.releaseDate||'').localeCompare(String(a.releaseDate||''))||String(a.name||'').localeCompare(String(b.name||''),'fr'));
}
function v114SafeId(x){return String(x||'').replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'pack'}
function v114VirtualProduct(raw){V114_VIRTUAL_PRODUCTS.set(raw.id,raw);return raw}
function v114BoosterImage(b){return String(b?.artwork_front||b?.artworkFront||b?.logo||'').trim()}
function v114ExistingItems(cfg){
 return (cfg?.products||[]).filter(p=>p&&!p.retiredCatalog&&!p.eventEdition);
}
function v114CreativeItems(cfg){
 if(!cfg)return[];
 const real=v114ExistingItems(cfg),items=[...real],entry=v114CatalogEntry(cfg.id),hasLoose=real.some(p=>p.mode==='loose'&&Number(p.qty||1)>0);
 /* Certains sets TCGdex exposent leurs artworks de boosters. On peut les proposer
    en Créatif sans les faire fuiter au Marketplace ou à la boutique Réaliste. */
 if(!hasLoose&&Array.isArray(entry?.boosters)&&entry.boosters.length){
  for(const [i,b] of entry.boosters.entries()){
   const id=`v114-booster-${v114SafeId(cfg.id)}-${v114SafeId(b?.id||i)}`;
   items.push(v114VirtualProduct({id,setId:cfg.id,name:String(b?.name||`Booster ${cfg.name}`),subtitle:'Mode Créatif · booster référencé par la source du catalogue',kind:'BOOSTER',price:0,mode:'loose',qty:1,image:v114BoosterImage(b),creativeOnly:true,shopHidden:true,marketHidden:true,v114Virtual:true,v114SourceBooster:true}));
  }
 }
 /* La majorité des anciennes collections n'ont aucun packaging structuré dans
    TCGdex. On offre donc un pack de simulation clairement nommé — jamais un faux
    display/ETB/booster officiel inventé. */
 if(!items.some(p=>p.mode==='loose'&&Number(p.qty||1)>0)){
  const id=`v114-creative-pack-${v114SafeId(cfg.id)}`;
  items.unshift(v114VirtualProduct({id,setId:cfg.id,name:`Pack créatif — ${cfg.name}`,subtitle:'Produit de simulation · accès libre aux cartes de cette collection',kind:'PACK CRÉATIF',price:0,mode:'loose',qty:1,image:'',creativeOnly:true,shopHidden:true,marketHidden:true,v114Virtual:true}));
 }
 return items;
}

/* V1.1.3 appelait v113Sets()/v113Items() partout. En remplaçant ces deux helpers,
   son UI année/collection et son achat à coût nul couvrent maintenant les 200 IDs. */
v113Items=function(cfg){return v114CreativeItems(cfg)};
v113Sets=function(){return v114CatalogSets()};
v113Years=function(){return [...new Set(v113Sets().map(v113Year).filter(Boolean))].sort((a,b)=>b-a)};

/* productById doit connaître les packs virtuels au moment du clic « Ajouter ». */
const v114ProductByIdBase=productById;
productById=function(id){return V114_VIRTUAL_PRODUCTS.get(String(id))||v114ProductByIdBase(id)};

/* Une collection chargée paresseusement peut être achetée avant d'avoir été visitée
   sur l'accueil. On hydrate le JSON canonique juste avant la première ouverture. */
const v114StartBoosterBase=startBooster;
startBooster=async function(setId=state.activeSet){
 const entry=v114CatalogEntry(setId);
 if(entry&&typeof v112CatalogReady==='function'&&!v112CatalogReady(setId)){
  const ok=await v111HydrateSet(setId);if(!ok)return toast(`Impossible de charger ${SETS?.[setId]?.name||setId}`);
 }
 return v114StartBoosterBase(setId);
};

/* ---------- PILE DE CARTES ----------
   `.v05-holo{position:relative}` écrasait la position absolue des reveal-card.
   Le style inline est volontaire : il est plus fort que toutes les vieilles feuilles
   et protège aussi les futures couches holo/dégâts qui ajoutent des classes. */
const v114MakeCardElementBase=makeCardElement;
makeCardElement=function(c,depth){
 const el=v114MakeCardElementBase(c,depth);
 el.style.position='absolute';el.style.inset='0';el.style.width='100%';el.style.height='100%';el.style.margin='0';el.style.display='block';
 return el;
};
const v114Style=document.createElement('style');v114Style.textContent=`
#cardStack.card-stack>.reveal-card,#cardStack.card-stack>.reveal-card.v05-holo{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;margin:0!important;display:block!important}
#cardStack.card-stack{overflow:visible!important;isolation:isolate}
`;
document.head.appendChild(v114Style);

/* Une ouverture commencée sur la 1.1.3 est réparée dès le lancement de la 1.1.4. */
setTimeout(()=>{
 try{
  if(v08Mode()==='creative'){v113RenderCreativeSwitch();if($('#shop')?.classList.contains('active'))renderProducts()}
  if(state.currentOpening?.phase==='reveal'&&$('#revealStage')&&!$('#revealStage').classList.contains('hidden'))renderStack();
 }catch(e){console.warn('V1.1.4 refresh',e)}
},120);
window.__voxV114Ready=true;
