'use strict';
/* VOX Card Sim V1.1.5 — aucun produit fictif en Créatif.

   V1.1.4 gardait toutes les collections visibles en fabriquant un « Pack créatif »
   lorsque le catalogue historique n'avait aucun packaging. C'était utile comme
   accès technique, mais faux en tant qu'article de boutique.

   V1.1.5 sépare définitivement les deux notions :
   - toutes les collections physiques restent navigables en mode Créatif ;
   - seuls des produits scellés réellement référencés sont achetables ;
   - les variantes de boosters vérifiées ont leur véritable visuel ;
   - si aucune source ne documente de produit pour une collection, la boutique le
     dit explicitement et n'invente rien.
*/
const V115_VERSION='1.1.5';
const V115_DATA=window.V115_SEALED_CATALOG||{schema:115,sets:{},stats:{}};
const V115_PRODUCTS=new Map();
for(const [sid,rows] of Object.entries(V115_DATA.sets||{}))for(const raw of rows||[]){
 const p={...raw,setId:raw.setId||sid,price:0,creativeOnly:true,shopHidden:true,marketHidden:true,v115Verified:true};
 V115_PRODUCTS.set(String(p.id),p);
}

function v115CatalogSets(){
 try{return typeof v114CatalogSets==='function'?v114CatalogSets():Object.values(SETS||{})}catch{return Object.values(SETS||{})}
}
function v115TrustedExisting(p,cfg){
 if(!p||p.retiredCatalog||p.eventEdition||p.v114Virtual)return false;
 const img=String(p.image||'');
 /* Les références 2026 avec visuels locaux ont été vérifiées manuellement. */
 if(img.includes('img/v109/'))return true;
 /* Les quelques catalogues historiques antérieurs à l'import universel étaient
    saisis comme vrais produits, contrairement aux produits génériques V1.0.5. */
 if(['sv03.5','sv03','sv02','s6a'].includes(String(cfg?.id||'')))return true;
 /* Un binder auto-généré à partir d'un simple logo n'est pas un produit physique
    vérifié et ne doit pas réapparaître comme faux article. */
 return false;
}
function v115ImportedItems(setId){return [...(V115_DATA.sets?.[setId]||[])].map(x=>V115_PRODUCTS.get(String(x.id))).filter(Boolean)}
function v115CreativeItems(cfg){
 if(!cfg)return[];
 const out=[];
 for(const p of cfg.products||[])if(v115TrustedExisting(p,cfg))out.push(p);
 for(const p of v115ImportedItems(cfg.id))out.push(p);
 const seen=new Set();
 return out.filter(p=>{const key=p.v115Verified?`src:${p.id}`:`old:${p.id}`;if(seen.has(key))return false;seen.add(key);return true});
}

/* Toutes les collections restent dans le sélecteur, même celles qui n'ont aucun
   produit vérifié. C'est l'article fictif qui disparaît, pas la collection. */
v113Sets=function(){return v115CatalogSets()};
v113Items=function(cfg){return v115CreativeItems(cfg)};
v113Years=function(){return [...new Set(v113Sets().map(v113Year).filter(Boolean))].sort((a,b)=>b-a)};

const v115ProductByIdBase=productById;
productById=function(id){return V115_PRODUCTS.get(String(id))||v115ProductByIdBase(id)};

function v115PackArtFromStock(setId){
 const sku=boosterSku(setId);try{v06LotNormalize(sku)}catch{}
 const lot=(state.stockLots?.[sku]||[]).find(x=>Number(x?.qty)>0&&x?.v115PackArt);return String(lot?.v115PackArt||'');
}
function v115DefaultPackArt(setId){
 const p=v115ImportedItems(setId).find(x=>x?.mode==='loose'&&x?.image);return String(p?.image||'');
}

/* Les boosters importés gardent l'artwork réellement choisi dans leur lot. */
const v115BuyProductBase=buyProduct;
buyProduct=function(setId,productId){
 const p=V115_PRODUCTS.get(String(productId));
 if(v08Mode()!=='creative'||!p)return v115BuyProductBase(setId,productId);
 const sid=p.setId||setId;if(!SETS?.[sid])return;
 if(p.mode==='loose'){
  const sku=boosterSku(sid),qty=Math.max(1,Number(p.qty)||1);try{v06LotNormalize(sku)}catch{}
  addStock(sku,qty);state.stockLots??={};state.stockLots[sku]??=[];state.stockLots[sku].push({qty,unitCost:0,source:'creative-v115',at:Date.now(),sealedCondition:'Neuf',v115ProductId:p.id,v115PackArt:p.image||''});
 }else{
  v06AddLot(sealedSku(p.id),1,0,'creative-v115');
 }
 save();renderProducts();renderInventory();renderBinder();updateStats();toast(`${p.name} ajouté`);
};

/* Capture l'art du lot avant que le pipeline historique ne consomme le booster. */
const v115StartBoosterBase=startBooster;
startBooster=async function(setId=state.activeSet){
 const art=v115PackArtFromStock(setId),before=state.currentOpening?.id||null;
 const r=await v115StartBoosterBase(setId),o=state.currentOpening;
 if(o&&o.id!==before&&o.setId===setId){o.v115PackArt=art||v115DefaultPackArt(setId);save()}
 return r;
};
const v115OpeningPackImageBase=openingPackImage;
openingPackImage=function(setId){return state.currentOpening?.v115PackArt||v115DefaultPackArt(setId)||v115OpeningPackImageBase(setId)};

/* Un produit dont le nombre de boosters n'est pas explicitement documenté reste
   collectionnable mais ne peut pas être détruit par le bouton Ouvrir. */
const v115OpenSealedBase=openSealedSku;
openSealedSku=function(sku){
 const p=productForSku(sku);if(p?.v115Verified&&p.mode==='sealed'&&!p.verifiedContents)return toast('Contenu non vérifié : le produit reste scellé');
 return v115OpenSealedBase(sku);
};

/* V1.1.3 fournit le rendu complet. On ajoute uniquement l'état vide explicite afin
   qu'une collection sans produit documenté ne ressemble jamais à un bug. */
const v115RenderProductsBase=renderProducts;
renderProducts=function(){
 const r=v115RenderProductsBase();if(v08Mode()!=='creative')return r;
 const sid=typeof v113CreativeShopSet==='function'?v113CreativeShopSet():state.activeSet,cfg=SETS?.[sid],grid=$('#productGrid');
 if(grid&&cfg&&!v115CreativeItems(cfg).length){
  grid.innerHTML=`<div class="empty-state panel v115-no-product"><strong>Aucun produit physique vérifié</strong><p>${escapeHtml(cfg.name)} reste disponible dans le catalogue, mais aucune source produit fiable n'est encore associée à cette collection. Aucun article fictif n'est créé.</p></div>`;
 }
 return r;
};

/* Les vieux objets V1.1.4 restent éventuellement en mémoire dans une sauvegarde,
   mais ils ne sont plus proposés ni recréés. */
try{if(typeof V114_VIRTUAL_PRODUCTS!=='undefined')for(const [id,p] of V114_VIRTUAL_PRODUCTS)if(p?.v114Virtual&&String(id).startsWith('v114-creative-pack-'))V114_VIRTUAL_PRODUCTS.delete(id)}catch{}

const v115Style=document.createElement('style');v115Style.textContent=`
.v115-no-product{padding:22px}.v115-no-product strong{display:block;font-size:18px;margin-bottom:8px}.v115-no-product p{margin:0;color:#8f9caf;line-height:1.55}
`;
document.head.appendChild(v115Style);

setTimeout(()=>{try{if(v08Mode()==='creative'){v113RenderCreativeSwitch();if($('#shop')?.classList.contains('active'))renderProducts()}}catch(e){console.warn('V1.1.5 creative refresh',e)}},140);
window.__voxV115Ready=true;
