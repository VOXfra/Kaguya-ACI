'use strict';

const API='https://api.tcgdex.net/v2/fr';
const META_BASE='https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const money=n=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(n)||0);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rnd=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a?.length?a[Math.floor(Math.random()*a.length)]:null;
const shuffle=a=>{const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x};
const uid=p=>`${p}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const cardNo=c=>Number.parseInt(c?.localId??c?.number,10)||0;
let cardImg=(c,q='high')=>c?.image?`${c.image}/${q}.webp`:(q==='low'?(c?.images?.small||c?.imageSmall||''):(c?.images?.large||c?.imageLarge||c?.images?.small||''));

const ENERGY=[
 {n:1,name:'Plante'},{n:2,name:'Feu'},{n:3,name:'Eau'},{n:4,name:'Électrique'},
 {n:5,name:'Psy'},{n:6,name:'Combat'},{n:7,name:'Obscurité'},{n:8,name:'Métal'}
].map(x=>({...x,id:`sve-${x.n}`,image:`https://images.pokemontcg.io/sve/${x.n}_hires.png`,thumb:`https://images.pokemontcg.io/sve/${x.n}.png`}));

const SETS={
 'sv03.5':{
  id:'sv03.5',metaFile:'sv3pt5.json',name:'151',longName:'Écarlate et Violet — 151',series:'ÉCARLATE ET VIOLET',total:207,official:165,
  hero:[199,202,173],foilEnergy:.2483,demigod:.001,
  rates:{double:.1328,ur:.0644,ir:.0850,sir:.0311,hr:.0194},
  demigodLines:[[166,167,198],[168,169,199],[170,171,200]],
  products:[
   {id:'151-booster',name:'Booster 151',subtitle:'1 booster libre',kind:'Booster',price:5.99,mode:'loose',qty:1,image:'https://www.gamersgauntlet.net/cdn/shop/files/504467_in_1000x1000_57800706-0e47-421d-a968-4fabd164c145_771x1000.jpg?v=1724779164'},
   {id:'151-lot6',name:'Lot de 6 boosters 151',subtitle:'6 boosters ajoutés au même stock',kind:'Lot de boosters',price:35.94,mode:'loose',qty:6,image:'https://www.gamersgauntlet.net/cdn/shop/files/504467_in_1000x1000_57800706-0e47-421d-a968-4fabd164c145_771x1000.jpg?v=1724779164'},
   {id:'151-bundle',name:'Booster Bundle 151',subtitle:'Produit scellé · contient 6 boosters',kind:'Booster Bundle',price:39.99,mode:'sealed',opens:6,image:'https://www.gamersgauntlet.net/cdn/shop/files/502000_771x1000.webp?v=1692724812'},
   {id:'151-binder',name:'Collection Classeur 151',subtitle:'Produit scellé · classeur + 4 boosters',kind:'Binder Collection',price:44.99,mode:'sealed',opens:4,image:'https://www.gamersgauntlet.net/cdn/shop/files/502004_771x1000.webp?v=1692725092'},
   {id:'151-etb',name:'Coffret Dresseur d’élite 151',subtitle:'Produit scellé · 9 boosters',kind:'ETB',price:59.99,mode:'sealed',opens:9,image:'https://www.gamersgauntlet.net/cdn/shop/files/503313_771x1000.webp?v=1692724622'},
   {id:'151-upc',name:'Collection Ultra-Premium 151',subtitle:'Produit scellé · 16 boosters',kind:'UPC',price:139.99,mode:'sealed',opens:16,image:'https://www.gamersgauntlet.net/cdn/shop/files/502005_771x1000.webp?v=1692725409'}
  ]
 },
 'sv03':{
  id:'sv03',metaFile:'sv3.json',name:'Flammes Obsidiennes',longName:'Écarlate et Violet — Flammes Obsidiennes',series:'ÉCARLATE ET VIOLET',total:230,official:197,
  hero:[223,215,228],foilEnergy:0,demigod:0,
  rates:{double:.1361,ur:.0663,ir:.0760,sir:.0313,hr:.0192},
  products:[
   {id:'obs-booster',name:'Booster Flammes Obsidiennes',subtitle:'1 booster libre',kind:'Booster',price:5.99,mode:'loose',qty:1,image:'https://www.gamersgauntlet.net/cdn/shop/files/501256_in_1000x1000_558628e9-20e4-4d0d-b559-7040bcb40a8d_771x1000.jpg?v=1739301415'},
   {id:'obs-lot6',name:'Lot de 6 boosters',subtitle:'6 boosters ajoutés au même stock',kind:'Lot de boosters',price:35.94,mode:'loose',qty:6,image:'https://www.gamersgauntlet.net/cdn/shop/files/501256_in_1000x1000_558628e9-20e4-4d0d-b559-7040bcb40a8d_771x1000.jpg?v=1739301415'},
   {id:'obs-bundle',name:'Booster Bundle Flammes Obsidiennes',subtitle:'Produit scellé · contient 6 boosters',kind:'Booster Bundle',price:37.99,mode:'sealed',opens:6,image:'https://www.gamersgauntlet.net/cdn/shop/files/501263_771x1000.webp?v=1691425820'},
   {id:'obs-etb',name:'Coffret Dresseur d’élite',subtitle:'Produit scellé · 9 boosters',kind:'ETB',price:54.99,mode:'sealed',opens:9,image:'https://www.gamersgauntlet.net/cdn/shop/files/501264_771x1000.webp?v=1689959428'},
   {id:'obs-display',name:'Display 36 boosters',subtitle:'Boîte scellée · 36 boosters',kind:'Booster Box',price:159.99,mode:'sealed',opens:36,image:'https://www.gamersgauntlet.net/cdn/shop/files/501257_771x1000.webp?v=1689959059'}
  ]
 }
};

const RARITY_LABEL={common:'Commune',uncommon:'Peu commune',rare:'Rare',double:'Double rare',ir:'Illustration rare',ur:'Ultra rare',sir:'Illustration spéciale rare',hr:'Hyper rare'};
const EXPECTED_RARITIES={
 'sv03.5':{total:207,common:66,uncommon:62,rare:25,double:12,ir:16,ur:16,sir:7,hr:3},
 'sv03':{total:230,double:21,ir:12,ur:12,sir:6,hr:3}
};
const RARITY_NORMALIZE={'Common':'common','Uncommon':'uncommon','Rare':'rare','Double Rare':'double','Illustration Rare':'ir','Ultra Rare':'ur','Special Illustration Rare':'sir','Hyper Rare':'hr'};

const state={
 version:3,playerId:null,activeSet:'sv03.5',sets:{},meta:{},metaReady:{},wallet:250,instances:[],stock:{},listings:[],sales:[],packsOpened:{},
 settings:{cardTrickEnabled:false,cardTrickCount:0},currentOpening:null,inventoryTab:'cards',pageBySet:{'sv03.5':0,'sv03':0},lastMarketTick:Date.now(),marketShift:{},priceCache:{}
};
let preloadPromise=null;
const imageCache=new Map();

function boosterSku(setId){return `BOOSTER:${setId}`}
function sealedSku(productId){return `SEALED:${productId}`}
function stockQty(sku){return Math.max(0,Number(state.stock[sku])||0)}
function addStock(sku,n){state.stock[sku]=Math.max(0,stockQty(sku)+Number(n||0));if(state.stock[sku]===0)delete state.stock[sku]}
function productById(id){for(const s of Object.values(SETS)){const p=s.products.find(x=>x.id===id);if(p)return{...p,setId:s.id}}return null}
function productForSku(sku){if(!sku?.startsWith('SEALED:'))return null;return productById(sku.slice(7))}
function currentSet(){return SETS[state.activeSet]}
function cardsFor(setId){return state.sets[setId]?.cards||[]}
function getCard(setId,n){return cardsFor(setId).find(c=>cardNo(c)===Number(n))||null}
function cardById(setId,id){return cardsFor(setId).find(c=>c.id===id)||null}
function setName(setId){return SETS[setId]?.name||setId}
function rarityFor(setId,n){return state.meta[setId]?.rarity?.[Number(n)]||'unknown'}
function isFoilVariant(ins,c){return ins?.variant==='reverse'||ins?.variant==='holo'||['rare','double','ir','ur','sir','hr'].includes(rarityFor(ins?.setId||state.activeSet,cardNo(c)))}

function save(){
 const safe={version:3,playerId:state.playerId,activeSet:state.activeSet,wallet:state.wallet,instances:state.instances,stock:state.stock,listings:state.listings,sales:state.sales,packsOpened:state.packsOpened,settings:state.settings,currentOpening:state.currentOpening,inventoryTab:state.inventoryTab,pageBySet:state.pageBySet,lastMarketTick:state.lastMarketTick,marketShift:state.marketShift,priceCache:state.priceCache};
 localStorage.setItem('voxCardSimV03',JSON.stringify(safe));
}
function load(){
 try{
  const s=JSON.parse(localStorage.getItem('voxCardSimV03')||'null');
  if(s){Object.assign(state,s);state.settings={cardTrickEnabled:false,cardTrickCount:0,...(s.settings||{})};state.stock=s.stock||{};state.pageBySet={'sv03.5':0,'sv03':0,...(s.pageBySet||{})};return;}
  const old=JSON.parse(localStorage.getItem('voxCardSimV02')||'null');
  state.playerId=uid('PLAYER');
  if(old){
   state.wallet=old.wallet??250;
   state.instances=(old.instances||[]).map(x=>({...x,setId:x.setId||'sv03.5'}));
   state.packsOpened['sv03.5']=old.packs||0;
   if(old.queue)addStock(boosterSku('sv03.5'),old.queue);
   for(const x of old.sealed||[]){if(x.status!=='owned')continue;if(x.productId==='loose')addStock(boosterSku('sv03.5'),1);else if(x.productId==='bundle6')addStock(boosterSku('sv03.5'),6);else{const map={binder4:'151-binder',etb9:'151-etb',upc16:'151-upc'};if(map[x.productId])addStock(sealedSku(map[x.productId]),1)}}
  }
 }catch(e){console.error(e);state.playerId=uid('PLAYER')}
 if(!state.playerId)state.playerId=uid('PLAYER');
}

function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),1800)}
function vibrate(p=8){try{navigator.vibrate?.(p)}catch{}}

async function fetchSetData(setId){
 const cfg=SETS[setId];
 try{
  const [sr,mr]=await Promise.all([fetch(`${API}/sets/${cfg.id}`),fetch(`${META_BASE}/${cfg.metaFile}`)]);
  if(!sr.ok)throw new Error(`TCGdex ${sr.status}`);if(!mr.ok)throw new Error(`meta ${mr.status}`);
  const set=await sr.json(),raw=await mr.json();
  set.cards=[...(set.cards||[])].sort((a,b)=>cardNo(a)-cardNo(b));if(set.cards.length!==cfg.total)throw new Error(`card count ${set.cards.length}/${cfg.total}`);state.sets[setId]=set;
  const rarity={};for(const c of raw){const n=Number.parseInt(c.number,10);if(Number.isFinite(n))rarity[n]=RARITY_NORMALIZE[c.rarity]||'unknown'}
  const exp=EXPECTED_RARITIES[setId],counts={};for(const v of Object.values(rarity))counts[v]=(counts[v]||0)+1;
  const valid=raw.length===exp.total&&Object.entries(exp).every(([k,v])=>k==='total'||counts[k]===v);
  if(!valid)throw new Error(`rarity validation failed ${setId}: ${JSON.stringify(counts)}`);
  state.meta[setId]={rarity,raw,counts};state.metaReady[setId]=true;
 }catch(e){
  console.error('set load',setId,e);state.metaReady[setId]=false;
  if(!state.sets[setId])state.sets[setId]={id:setId,name:cfg.name,cards:[]};
 }
}
async function initData(){
 await Promise.all(Object.keys(SETS).map(fetchSetData));
 for(const setId of Object.keys(SETS))reconcileBinder(setId);
 renderAll();processMarket(true);
 if(state.currentOpening){preloadPromise=preloadPack(state.currentOpening.cards);renderOpening();}
 save();
}

function nav(id){
 if(id!=='opening'&&state.currentOpening?.phase==='summary'){state.currentOpening=null;save();}
 $$('.screen').forEach(x=>x.classList.toggle('active',x.id===id));$$('.bottom-nav [data-go]').forEach(x=>x.classList.toggle('active',x.dataset.go===id));
 if(id==='home')renderHome();if(id==='shop')renderProducts();if(id==='binder')renderBinder();if(id==='inventory')renderInventory();if(id==='opening')renderOpening();window.scrollTo({top:0,behavior:'smooth'});
}
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.go)));
$('#leaveOpening').onclick=()=>nav('home');

function selectSet(setId){if(!SETS[setId])return;state.activeSet=setId;save();renderSetSwitches();renderHome();renderProducts();renderBinder();updateStats();}
function renderSetSwitches(){
 $$('[data-set-switch]').forEach(box=>{box.innerHTML=Object.values(SETS).map(s=>`<button class="${state.activeSet===s.id?'active':''}" data-set="${s.id}">${escapeHtml(s.name)}</button>`).join('');box.querySelectorAll('button').forEach(b=>b.onclick=()=>selectSet(b.dataset.set));});
}

function renderAll(){renderSetSwitches();renderHome();renderProducts();renderBinder();renderInventory();renderSettings();updateStats();}
function renderHome(){
 const cfg=currentSet(),set=state.sets[cfg.id];$('#seriesTag').textContent=cfg.series;$('#setLogo').src=set?.logo?`${set.logo}.webp`:'';$('#setLogo').alt=cfg.name;
 $('#heroText').textContent=`${cfg.longName} · ${cfg.total} cartes de set, exemplaires individuels et marché simulé.`;
 const box=$('#heroStack');box.innerHTML='';for(const n of cfg.hero){const c=getCard(cfg.id,n);if(c){const im=new Image();im.src=cardImg(c,'low');im.alt='';box.appendChild(im)}}
 const resume=state.currentOpening&&state.currentOpening.phase!=='summary';$('#resumeOpening').classList.toggle('hidden',!resume);if(resume)$('#resumeLabel').textContent=`${setName(state.currentOpening.setId)} · carte ${Math.min(state.currentOpening.reveal+1,state.currentOpening.cards.length)}/${state.currentOpening.cards.length}`;
 updateStats();renderSaleFeed();
}
function updateStats(){
 const setId=state.activeSet,cfg=SETS[setId];const live=state.instances.filter(x=>x.status!=='sold'&&!x.isEnergy&&x.setId===setId);const unique=new Set(live.map(x=>x.cardId)).size;const inv=state.instances.filter(x=>x.status==='owned'&&!x.isEnergy&&x.setId===setId&&x.location==='inventory').length;
 $('#wallet').textContent=money(state.wallet);$('#uniqueStat').textContent=`${unique} / ${cfg.total}`;$('#duplicateStat').textContent=inv;$('#boosterStat').textContent=stockQty(boosterSku(setId));$('#listingStat').textContent=state.listings.filter(x=>x.status==='active').length;
}
function renderSaleFeed(){const b=$('#saleFeed'),last=state.sales.slice(-3).reverse();b.innerHTML=last.length?`<strong>Dernières commandes</strong>${last.map(s=>`<div><span>${escapeHtml(s.label)}${s.units>1?` ×${s.units}`:''}</span><b>${money(s.total??s.price)}</b></div>`).join('')}`:`<strong>Marché</strong><p>Aucune vente pour le moment.</p>`}
