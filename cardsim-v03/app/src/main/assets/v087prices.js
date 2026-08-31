'use strict';

/* V0.8.7 — Eevee Heroes: audited per-card EUR reference snapshot.
   Base-set cards 001-069: current market snapshot converted to EUR on 2026-08-19.
   Secret cards 070-101: European market references captured per card.
   This layer is intentionally authoritative over the old rarity-only JP fallbacks. */
const V087_EEVEE_PRICE_DATE='2026-08-19';
const V087_EEVEE_PRICE_SOURCE='Marché EU + marché international, snapshot 19/08/2026';
const V087_EEVEE_EUR=[
 null,
 0.14,1.23,2.36,0.08,0.09,0.18,0.09,0.11,0.10,0.25,
 1.36,0.11,0.15,0.25,1.33,0.22,0.09,0.12,0.28,0.15,
 0.40,0.09,0.16,1.23,2.49,0.31,0.28,0.20,0.16,1.15,
 0.10,0.13,0.07,0.09,1.26,0.17,0.14,0.10,0.22,1.58,
 4.28,0.13,0.13,0.21,0.13,0.09,2.99,7.19,0.11,0.22,
 0.13,0.25,0.14,0.28,0.14,0.15,0.25,0.35,0.13,0.10,
 0.10,0.12,0.12,0.09,0.10,0.08,0.09,0.14,0.14,
 5.21,69.70,14.70,75.29,18.66,75.08,10.89,69.71,7.69,47.84,
 8.29,107.88,12.74,77.32,27.85,251.11,9.48,1.17,28.55,309.74,
 14.42,401.61,18.24,443.17,17.43,1504.41,4.97,1.67,6.59,2.28,
 2.76,9.48
];
if(V087_EEVEE_EUR.length!==102)throw new Error(`V0.8.7 Eevee price table length ${V087_EEVEE_EUR.length-1}/101`);

function v087IsEeveeCard(c,setId=null){return setId==='s6a'||String(c?.id||'').startsWith('s6a-')}
function v087EeveeAnchor(c){const n=cardNo(c),p=Number(V087_EEVEE_EUR[n]);return n>=1&&n<=101&&p>0?p:0}
function v087EeveeReference(c,shifted=true){
 const anchor=v087EeveeAnchor(c);if(!(anchor>0))return 0;
 if(!shifted)return anchor;
 const shift=clamp(Number(state.marketShift?.[c.id])||1,.80,1.25);
 return Number((anchor*shift).toFixed(2));
}
function v087SnapshotEntry(c){const p=v087EeveeAnchor(c);return p>0?{standard:p,reverse:null,updated:V087_EEVEE_PRICE_DATE,fetchedAt:Date.now(),source:'v087-eevee-audited'}:null}

/* Sealed references from the same market pass. */
function v087ApplySealedReferences(){
 const cfg=SETS.s6a;if(!cfg)return;
 const values={
  'eevee-booster':{price:9.96,marketTrend:9.96},
  'eevee-lot6':{price:59.76,marketTrend:9.96},
  'eevee-box':{price:283.72,marketTrend:283.72},
  'eevee-vmax':{price:190.25,marketTrend:190.25}
 };
 for(const p of cfg.products||[]){const v=values[p.id];if(v)Object.assign(p,v)}
}
v087ApplySealedReferences();

/* Inventory value must use the same reference as the marketplace. */
const v087ValueForInstanceBase=v05ValueForInstance;
window.v05ValueForInstance=function(ins,c){
 if(v087IsEeveeCard(c,ins?.setId)){
  const p=v087EeveeReference(c,true);return p*v4ConditionMultiplier(ins?.condition||'MT');
 }
 return v087ValueForInstanceBase(ins,c);
};

/* Marketplace catalogue/reference: ignore stale rarity fallback and stale pre-V0.8.7 books. */
const v087CardReferenceBase=v08CardReference;
window.v08CardReference=function(c,setId,variant='standard'){
 if(setId==='s6a')return v087EeveeReference(c,true);
 return v087CardReferenceBase(c,setId,variant);
};

/* Opening a card book must anchor directly to the per-card audited reference. */
const v087CardBookBase=v4CardBook;
window.v4CardBook=async function(c,setId,variant='standard'){
 if(setId!=='s6a')return v087CardBookBase(c,setId,variant);
 const r=rarityFor(setId,cardNo(c)),base=v087EeveeReference(c,true);
 const book=v4EnsureBook({type:'card',setId,cardId:c.id,localId:c.localId,label:`${c.name} #${c.localId}`,rarity:r,variant:'standard',image:cardImg(c,'low')},base);
 book.base=Math.max(.02,base);book.asset.variant='standard';return book;
};

const v087BookForListingBase=v4BookForListing;
window.v4BookForListing=function(l){
 if(l?.type==='card'&&l.setId==='s6a'){
  const c=cardById('s6a',l.cardId);if(c)l.marketBase=v087EeveeReference(c,true);
 }
 const b=v087BookForListingBase(l);
 if(b?.asset?.type==='card'&&b.asset.setId==='s6a'){
  const c=cardById('s6a',b.asset.cardId);if(c)b.base=v087EeveeReference(c,true);
 }
 return b;
};

/* Eevee offline price hydration now really hydrates a bundled price snapshot. */
const v087HydratePricesBase=v05HydratePrices;
window.v05HydratePrices=async function(setId,statusEl){
 if(setId!=='s6a')return v087HydratePricesBase(setId,statusEl);
 v087SeedPriceSnapshot(false);save();
 if(statusEl)statusEl.textContent=`Hors ligne prêt · 101 cartes + prix marché du ${new Date(V087_EEVEE_PRICE_DATE+'T12:00:00').toLocaleDateString('fr-FR')}`;
};
const v087PriceDateBase=v05PriceDate;
window.v05PriceDate=function(detail,c){if(v087IsEeveeCard(c))return V087_EEVEE_PRICE_DATE;return v087PriceDateBase(detail,c)};

/* Show the origin/date in the market book without changing its existing DA. */
const v087OpenBookBase=v4OpenBook;
window.v4OpenBook=function(book){
 const r=v087OpenBookBase(book);
 if(book?.asset?.type==='card'&&book.asset.setId==='s6a'){
  const head=$('#marketContent .market-asset-head div');
  if(head&&!head.querySelector('.v087-price-source')){
   const s=document.createElement('small');s.className='v087-price-source';s.textContent=`Référence ${V087_EEVEE_PRICE_DATE.split('-').reverse().join('/')} · snapshot marché`;head.appendChild(s);
  }
 }
 return r;
};

function v087SeedPriceSnapshot(migrateBooks=true){
 if(!state.lastKnownEstimates||typeof state.lastKnownEstimates!=='object')state.lastKnownEstimates={};
 if(!state.marketShift||typeof state.marketShift!=='object')state.marketShift={};
 const cards=cardsFor('s6a');if(cards.length!==101)return false;
 for(const c of cards){const e=v087SnapshotEntry(c);if(e)state.lastKnownEstimates[c.id]=e}
 const migrationKey=`voxCardSimV087_eevee_prices_${typeof v08Mode==='function'?v08Mode():'realistic'}`;
 const needsMigration=localStorage.getItem(migrationKey)!==V087_EEVEE_PRICE_DATE;
 if(migrateBooks&&needsMigration){
  /* Old local scarcity shifts were learned from the broken rarity prices; discard only Eevee ones. */
  for(const c of cards)state.marketShift[c.id]=1;
  for(const [key,b] of Object.entries(state.marketBooks||{})){
   if(!key.startsWith('card:s6a:'))continue;
   const c=cardById('s6a',b?.asset?.cardId);if(!c)continue;
   b.base=v087EeveeAnchor(c);b.offers=[];b.lastSupplyAt=0;b.lastTouched=Date.now();
   try{v4GenerateNpcOffers(b)}catch(e){console.warn('V0.8.7 Eevee offer rebuild',e)}
  }
  for(const l of state.listings||[]){if(l?.type==='card'&&l.setId==='s6a'){const c=cardById('s6a',l.cardId);if(c)l.marketBase=v087EeveeAnchor(c)}}
  localStorage.setItem(migrationKey,V087_EEVEE_PRICE_DATE);
 }
 return true;
}

/* Metadata is normally ready before this layer; retry briefly on a cold WebView just in case. */
(function v087BootPrices(attempt=0){
 if(v087SeedPriceSnapshot(true)){save();try{renderInventory();if(state.marketTab==='buy')v4RenderBuyHome();updateStats()}catch{};return}
 if(attempt<20)setTimeout(()=>v087BootPrices(attempt+1),150);
})(0);

window.__voxV087PricesReady=true;
