'use strict';

/* VOX Card Sim V1.0.5 — 2024/2025 legacy catalog + 2026 retail rotation. */
const V105_VERSION='1.0.5';
const V105_DATA=window.V105_CATALOG||{sets:{},rotation2026:[]};
const V105_ROTATION_MS=15*60*1000;
const V105_LEGACY_YEARS=new Set([2024,2025]);

function v105LogoUrl(u){u=String(u||'');if(!u)return'';return /\.(webp|png|jpe?g)(\?|$)/i.test(u)?u:u+'.webp'}
function v105CardUrls(c){
 const out=[],add=u=>{u=String(u||'');if(u&&!out.includes(u))out.push(u)};
 for(const u of c?.images||[])add(u);add(c?.imageSmall);add(c?.imageLarge);
 const base=String(c?.image||'');if(base){if(/\.(webp|png|jpe?g)(\?|$)/i.test(base))add(base);else{add(base+'/low.webp');add(base+'/high.webp');add(base)}}
 const sid=c?.setId||'',lid=String(c?.localId||'').padStart(3,'0');
 if(sid&&lid){const series=sid.startsWith('me')?'me':sid.startsWith('sv')?'sv':'';if(series){const b=`https://assets.tcgdex.net/fr/${series}/${sid}/${lid}`;add(b+'/low.webp');add(b+'/high.webp')}}
 return out;
}
function v105RarityCounts(cards){const x={};for(const c of cards)x[c.rarityKey]=(x[c.rarityKey]||0)+1;return x}
function v105Has(cards,key){return cards.some(c=>c.rarityKey===key)}
function v105Rates(cards){return{double:v105Has(cards,'double')?.18:0,ur:v105Has(cards,'ur')?.065:0,ir:v105Has(cards,'ir')?.09:0,sir:v105Has(cards,'sir')?.018:0,hr:v105Has(cards,'hr')?.006:0,mhr:v105Has(cards,'mhr')?.001:0}}
function v105Products(d){
 const logo=v105LogoUrl(d.logo),binder={id:`binder-${d.id}`,setId:d.id,name:`Classeur 9 poches — ${d.name}`,subtitle:'Classeur physique de cette collection',kind:'Classeur',price:19.99,mode:'binderUnlock',qty:1,image:logo};
 if(d.availability==='legacy')return[binder];
 const unit=5.99;return[
  {id:`${d.id}-booster`,setId:d.id,name:`Booster ${d.name}`,subtitle:'1 booster libre',kind:'Booster',price:unit,marketTrend:unit,mode:'loose',qty:1,image:logo},
  {id:`${d.id}-lot6`,setId:d.id,name:`Lot de 6 boosters ${d.name}`,subtitle:'6 boosters ajoutés au stock',kind:'Lot de boosters',price:Number((unit*6).toFixed(2)),marketTrend:unit,mode:'loose',qty:6,image:logo},
  {id:`${d.id}-etb`,setId:d.id,name:`Coffret Dresseur d’élite ${d.name}`,subtitle:'Produit scellé · 9 boosters',kind:'ETB',price:59.99,marketTrend:59.99,mode:'sealed',opens:9,image:logo},
  {id:`${d.id}-display`,setId:d.id,name:`Display ${d.name}`,subtitle:'Boîte scellée · 36 boosters',kind:'Booster Box',price:179.99,marketTrend:179.99,mode:'sealed',opens:36,image:logo},binder
 ];
}

function v105RegisterCatalog(){
 if(!V105_DATA?.sets)return;
 window.V110_MASTER_VARIANTS=window.V110_MASTER_VARIANTS||{};
 for(const [sid,d] of Object.entries(V105_DATA.sets)){
  const cards=(d.cards||[]).map(x=>{const urls=v105CardUrls({...x,setId:sid});return{...x,setId:sid,v105Embedded:true,imageSmall:urls[0]||'',imageLarge:urls.find(u=>u.includes('/high.webp'))||urls[1]||urls[0]||'',images:urls}});
  const counts=v105RarityCounts(cards),rates=v105Rates(cards),hero=cards.slice(-3).map(c=>Number.parseInt(c.localId,10)).filter(Number.isFinite);
  SETS[sid]={id:sid,name:d.name,longName:d.name,series:sid.startsWith('me')?'MÉGA-ÉVOLUTION':'ÉCARLATE ET VIOLET',total:d.total,official:d.official,hero,foilEnergy:0,demigod:0,releaseDate:d.releaseDate,releaseYear:d.year,legacyMarketplaceOnly:d.availability==='legacy',v105Catalog:true,rates,products:v105Products(d)};
  EXPECTED_RARITIES[sid]={total:d.total};
  state.sets[sid]={id:sid,name:d.name,logo:d.logo||'',cards};
  const rarity={};for(const c of cards){const n=Number.parseInt(c.localId,10);if(Number.isFinite(n))rarity[n]=c.rarityKey||'rare'}
  state.meta[sid]={rarity,raw:cards,counts};state.metaReady[sid]=true;
  state.pageBySet??={};state.pageBySet[sid]=Math.max(0,Number(state.pageBySet[sid])||0);
  if(typeof V061_BINDERS!=='undefined')V061_BINDERS[sid]={name:`Portfolio ${d.name} — 9 poches`,subtitle:'Portfolio 9 poches · 252 cartes par classeur',image:v105LogoUrl(d.logo),capacity:252,pages:28};
  window.V110_MASTER_VARIANTS[sid]={supported:true,source:'TCGdex variants',cards:{...(d.master||{})}};
 }
 for(const [k,l] of Object.entries({common:'Commune',uncommon:'Peu commune',rare:'Rare',double:'Double Rare',ir:'Illustration Rare',ur:'Ultra Rare',sir:'Illustration spéciale rare',hr:'Hyper Rare',mhr:'Méga Hyper Rare'}))RARITY_LABEL[k]=RARITY_LABEL[k]||l;
 for(const sid of Object.keys(V105_DATA.sets))try{reconcileBinder(sid)}catch(e){console.warn('V1.0.5 binder catalog',sid,e)}
 try{v081RebuildInstanceIndexes?.()}catch{}
}
v105RegisterCatalog();

/* Embedded cards never need a network detail call for pricing/variants. */
const v105GetCardDetailBase=getCardDetail;
getCardDetail=async function(c){if(c?.v105Embedded)return c;return v105GetCardDetailBase(c)};
const v105FetchSetDataBase=fetchSetData;
fetchSetData=async function(setId){if(V105_DATA.sets?.[setId]){state.metaReady[setId]=true;return}return v105FetchSetDataBase(setId)};

/* ---------- 2026 RETAIL: 15 MINUTES ---------- */
function v105RetailIds(){return(V105_DATA.rotation2026||[]).filter(id=>SETS[id]&&(!window.v090SetUnlocked||v090SetUnlocked(id)))}
v08HourInfo=function(now=Date.now()){
 const ids=v105RetailIds();if(!ids.length)return{setId:'me05',next:now+V105_ROTATION_MS,day:Math.floor(now/V08_DAY),hour:0};
 const slot=Math.floor(now/V105_ROTATION_MS),day=Math.floor(now/V08_DAY),within=Math.floor((now%V08_DAY)/V105_ROTATION_MS),cycle=Math.floor(within/ids.length),order=v08SeededShuffle(ids,day*101+cycle*7919),idx=within%ids.length;
 return{setId:order[idx]||ids[0],next:(slot+1)*V105_ROTATION_MS,day,hour:within,slot};
};
v08DailyEvent=function(now=Date.now()){
 const day=Math.floor(now/V08_DAY),id=`event-${day}`,start=day*V08_DAY,end=start+V08_DAY,old=state.eventCatalog[id];if(old&&v105RetailIds().includes(old.setId))return old;
 const ids=v105RetailIds(),sid=ids[v08Hash32(day*31337)%Math.max(1,ids.length)]||ids[0],cfg=SETS[sid];if(!cfg)return null;const base=cfg.products.find(p=>p.mode==='loose'&&p.qty===1)||cfg.products[0];
 const p={id,setId:sid,name:`Édition limitée du jour — ${cfg.name}`,subtitle:'Drop exclusif 24 h · 6 boosters · limite 1',kind:'ÉDITION LIMITÉE',price:Number((Math.max(29.99,(base.price||5.99)*6.6)).toFixed(2)),mode:'sealed',opens:6,image:base.image,eventEdition:true,eventStart:start,eventEnd:end,eventDay:day};state.eventCatalog[id]=p;return p;
};
const v105RenderProductsBase=renderProducts;
renderProducts=function(){const r=v105RenderProductsBase();const b=$('#shop .v08-shop-banner');if(b){const s=b.querySelector('span');if(s)s.textContent='COLLECTION · ROTATION 15 MIN';const small=b.querySelector('small');if(small)small.textContent='Prochaine rotation dans'}return r};

/* Legacy sets have no retail boosters, but their physical binder stays purchasable. */
const v105BuyBinderBase=v090BuyBinder;
v090BuyBinder=function(setId){
 const cfg=SETS[setId];if(!cfg?.legacyMarketplaceOnly)return v105BuyBinderBase(setId);
 const p=v090BinderProduct(setId),mode=v08Mode();if(!p)return;if(mode!=='creative'&&state.wallet<p.price)return toast('Solde insuffisant');if(mode!=='creative')state.wallet-=p.price;
 v06AddLot(sealedSku(p.id),1,mode==='creative'?0:p.price,mode==='creative'?'creative':'classeur-legacy');v090SyncBinderOwned(setId);reconcileBinder(setId);save();renderBinder();renderProducts();renderInventory();updateStats();toast(`${p.name} ajouté · ${v090BinderCount(setId)} classeur(s)`);
};

/* ---------- LEGACY NPC MARKET SUPPLY ---------- */
function v105LegacySet(setId){return!!SETS[setId]?.legacyMarketplaceOnly}
function v105CardSupplyTier(asset){const c=asset?.type==='card'?cardById(asset.setId,asset.cardId):null;return c?.supplyTier||({common:'common',uncommon:'uncommon',rare:'rare',double:'double',ir:'ir',ur:'ur',sir:'sir',hr:'hr',mhr:'mhr'}[asset?.rarity]||'rare')}
const V105_SUPPLY_BANDS={common:[140,220],uncommon:[80,150],rare:[35,80],double:[15,35],ace:[8,20],ir:[5,15],shiny:[4,12],ur:[3,8],shiny_ur:[2,5],sir:[1,4],hr:[1,3],mhr:[1,2],bwr:[1,2]};
function v105LegacyStockTarget(asset,now=Date.now()){
 const tier=v105CardSupplyTier(asset),band=V105_SUPPLY_BANDS[tier]||V105_SUPPLY_BANDS.rare,day=Math.floor(now/V08_DAY),h=v08Hash32(v08Hash32(day+17)^v08Hash32(String(asset.cardId||'').split('').reduce((s,ch)=>s+ch.charCodeAt(0),0))),span=band[1]-band[0]+1;return band[0]+(h%span);
}
function v105LegacyOfferCount(asset,target){const tier=v105CardSupplyTier(asset);if(['mhr','bwr','hr'].includes(tier))return Math.min(target,2);if(['sir','shiny_ur','ur'].includes(tier))return Math.min(target,3);if(['ir','shiny','ace','double'].includes(tier))return Math.min(target,5);return Math.min(target,8)}
const v105GenerateNpcBase=v4GenerateNpcOffers;
v4GenerateNpcOffers=function(book,count=null){
 const a=book?.asset;if(!a||a.type!=='card'||!v105LegacySet(a.setId))return v105GenerateNpcBase(book,count);
 v4EnsureSellers();book.offers=Array.isArray(book.offers)?book.offers.filter(o=>o&&o.quantity>0):[];const target=v105LegacyStockTarget(a),current=book.offers.reduce((s,o)=>s+Math.max(0,Number(o.quantity)||0),0),missing=Math.max(0,target-current);if(!missing){book.lastSupplyAt=Date.now();book.lastTouched=Date.now();return}
 const desired=v105LegacyOfferCount(a,target),used=new Set(book.offers.map(o=>o.sellerId)),candidates=shuffle(state.marketSellers).filter(s=>!used.has(s.id));while(book.offers.length<desired&&candidates.length){const seller=candidates.shift(),condition=pick(v4OfferConditions(a)),tier=v105CardSupplyTier(a),scarce=['sir','hr','mhr','bwr','shiny_ur'].includes(tier),spread=scarce?rnd(.94,1.34):rnd(.88,1.17),ratingNudge=1+(seller.rating-98)*.003,price=Math.max(.02,book.base*v4ConditionMultiplier(condition)*spread*ratingNudge);book.offers.push({id:uid('OFFER'),sellerId:seller.id,condition,price:Number(price.toFixed(2)),quantity:0,createdAt:Date.now(),updatedAt:Date.now()})}
 const receivers=book.offers.length?book.offers:[];if(!receivers.length)return v105GenerateNpcBase(book,1);let left=missing;for(let i=0;i<receivers.length;i++){const slots=receivers.length-i,q=i===receivers.length-1?left:Math.max(1,Math.floor(left/slots));receivers[i].quantity+=q;receivers[i].updatedAt=Date.now();left-=q;if(left<=0)break}book.lastSupplyAt=Date.now();book.lastTouched=Date.now();
};

const v105FallbackBase=v4FallbackBase;
v4FallbackBase=function(r){return({common:.18,uncommon:.28,rare:.75,double:2.5,ir:7.5,ur:10,sir:28,hr:18,mhr:55}[r]||v105FallbackBase(r))};
function v105EmbeddedPrice(c,variant='standard'){
 if(!c?.v105Embedded)return 0;try{const x=cardmarketBaseline(c,{setId:c.setId,variant:variant==='reverse'?'reverse':'normal'});if(Number(x)>0)return Number(x)}catch{}
 const cm=c?.pricing?.cardmarket||{},keys=variant==='reverse'?['trend-reverse','avg30-reverse','avg-reverse','trend','avg30','avg','low']:['trend','avg30','avg','low','trend-holo','avg30-holo'];for(const k of keys){const n=Number(cm[k]);if(n>0)return n}return v4FallbackBase(c.rarityKey||'rare');
}
const v105CardReferenceBase=v08CardReference;
v08CardReference=function(c,setId,variant='standard'){if(c?.v105Embedded)return v105EmbeddedPrice(c,variant)*(state.marketShift?.[c.id]||1);return v105CardReferenceBase(c,setId,variant)};
const v105CardBookBase=v4CardBook;
v4CardBook=async function(c,setId,variant='standard'){
 if(!c?.v105Embedded)return v105CardBookBase(c,setId,variant);const r=rarityFor(setId,cardNo(c)),base=v105EmbeddedPrice(c,variant)*(state.marketShift?.[c.id]||1);return v4EnsureBook({type:'card',setId,cardId:c.id,localId:c.localId,label:`${c.name} #${c.localId}`,rarity:r,variant,image:v105CardUrls(c)[0]||cardImg(c,'low')},Math.max(.02,base));
};

/* ---------- RECAP IMAGE RELIABILITY ---------- */
function v105SummaryCandidates(c){if(c?.kind==='energy'){const a=[];for(const u of [c.imageSmall,c.imageLarge,c.image])if(u&&!a.includes(u))a.push(u);return a}const a=[];try{const u=cardImg(c,'low');if(u)a.push(u)}catch{}for(const u of v105CardUrls(c))if(u&&!a.includes(u))a.push(u);try{const u=cardImg(c,'high');if(u&&!a.includes(u))a.push(u)}catch{}return a}
function v105SummaryImage(c,wrap){const urls=v105SummaryCandidates(c),im=new Image();im.loading='eager';im.decoding='async';try{im.fetchPriority='high'}catch{}im.alt=c.name||'Carte';let i=0;const next=()=>{if(i<urls.length){im.src=urls[i++];return}im.remove();wrap.classList.add('v105-summary-fallback');wrap.insertAdjacentHTML('afterbegin',`<span><b>${escapeHtml(c.name||'Carte')}</b><small>#${escapeHtml(c.localId||'—')}</small></span>`)};im.onerror=next;next();wrap.appendChild(im)}
renderPackSummary=function(){
 const o=state.currentOpening;if(!o)return;const sum=$('#summaryCards');if(!sum)return;sum.innerHTML='';for(const c of o.cards){const wrap=document.createElement('div');wrap.className='v08-summary-card';v105SummaryImage(c,wrap);if(c.v08New){const star=document.createElement('span');star.className='v08-new-star';star.textContent='NEW';wrap.appendChild(star)}sum.appendChild(wrap)}$('#openAnotherPack').classList.toggle('hidden',stockQty(boosterSku(o.setId))<=0);$('#packSummary').classList.remove('hidden');
};

/* Many sets stay usable on mobile without turning the header into several rows. */
const v105Style=document.createElement('style');v105Style.textContent=`
[data-set-switch],.set-switch{overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;flex-wrap:nowrap!important;-webkit-overflow-scrolling:touch}[data-set-switch]::-webkit-scrollbar,.set-switch::-webkit-scrollbar{display:none}[data-set-switch]>button,.set-switch>button{flex:0 0 auto}.v105-summary-fallback{min-height:124px;border-radius:8px;background:linear-gradient(145deg,#111a25,#090e15);border:1px solid #263446;display:grid;place-items:center;text-align:center;padding:8px}.v105-summary-fallback>span{display:grid;gap:4px;color:#eef3fa;font-size:11px}.v105-summary-fallback small{color:#8996a8}
`;document.head.appendChild(v105Style);

try{if(!SETS[state.activeSet])state.activeSet=v105RetailIds()[0]||'sv03.5';renderSetSwitches();renderHome();renderProducts();if(!$('#marketModal')?.classList.contains('hidden'))renderMarket()}catch(e){console.warn('V1.0.5 initial refresh',e)}
window.__voxV105Ready=true;
