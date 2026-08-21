'use strict';
const API='https://api.tcgdex.net/v2/fr';
const SET_ID='sv03.5';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const money=n=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(n)||0);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rnd=(a,b)=>a+Math.random()*(b-a);
const uid=p=>`${p}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
const cardNo=c=>Number.parseInt(c?.localId,10)||0;
const cardImg=(c,q='low')=>c?.image?`${c.image}/${q}.webp`:'';
const pick=a=>a[Math.floor(Math.random()*a.length)];
const shuffle=a=>{const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x};

// Exact 151 rarity pools. The English 151 set has 66 commons, 62 uncommons, 25 rares and 12 double rares.
const COMMON=new Set([1,4,7,10,11,13,14,16,17,19,21,23,25,27,29,32,35,37,39,41,43,46,48,50,52,54,56,58,60,61,63,66,69,70,72,74,77,79,81,83,84,86,88,90,92,96,98,100,102,104,108,109,111,114,116,118,120,125,126,129,133,137,147,152,153,154]);
const UNCOMMON=new Set([2,5,8,12,18,20,22,28,30,31,33,36,42,44,47,49,51,53,55,57,59,62,64,67,71,73,75,78,80,82,87,89,91,93,95,97,99,103,106,107,112,117,119,123,127,128,131,138,140,143,148,155,156,157,158,159,160,161,162,163,164,165]);
const RARE=new Set([15,26,34,45,68,85,94,101,105,110,113,121,122,130,132,134,135,136,139,141,142,144,146,149,150]);
const DOUBLE_RARE=new Set([3,6,9,24,38,40,65,76,115,124,145,151]);
const IR=new Set(Array.from({length:16},(_,i)=>166+i));
const UR=new Set(Array.from({length:16},(_,i)=>182+i));
const SIR=new Set(Array.from({length:7},(_,i)=>198+i));
const HR=new Set([205,206,207]);
const REVERSE_POOL=new Set([...COMMON,...UNCOMMON,...RARE]);
const DEMIGOD_LINES=[[166,167,198],[168,169,199],[170,171,200]];
const ENERGY_TYPES=['Plante','Feu','Eau','Électrique','Psy','Combat','Obscurité','Métal'];
const RARITY_LABEL={common:'Commune',uncommon:'Peu commune',rare:'Rare',double:'Double rare',ir:'Illustration rare',ur:'Ultra rare',sir:'Illustration spéciale rare',hr:'Hyper rare'};

// Measured 151 rates from a large TCGplayer sample; not manufacturer guarantees.
const RATES={foilEnergy:.2483,double:.1328,ur:.0644,ir:.0850,sir:.0311,hr:.0194,demigod:.001};

const PRODUCTS=[
 {id:'loose',name:'Booster 151',subtitle:'Booster à l’unité',packs:1,price:5.99,kind:'Booster',accent:'BOOSTER'},
 {id:'bundle6',name:'Lot de 6 boosters 151',subtitle:'Booster Bundle',packs:6,price:35.94,kind:'Booster Bundle',accent:'×6'},
 {id:'binder4',name:'Collection classeur 151',subtitle:'Classeur 9 poches + 4 boosters',packs:4,price:44.99,kind:'Binder Collection',accent:'CLASSEUR'},
 {id:'etb9',name:'Coffret Dresseur d’élite 151',subtitle:'ETB + 9 boosters',packs:9,price:59.99,kind:'Elite Trainer Box',accent:'ETB'},
 {id:'upc16',name:'Collection Ultra-Premium 151',subtitle:'UPC + 16 boosters',packs:16,price:139.99,kind:'Ultra-Premium Collection',accent:'UPC'}
];

const state={
 version:2,playerId:null,set:null,cards:[],wallet:250,instances:[],sealed:[],listings:[],sales:[],packs:0,
 currentPack:[],reveal:0,page:0,queue:0,trick:0,inventoryTab:'cards',lastMarketTick:Date.now(),marketShift:{},priceCache:{}
};

function save(){localStorage.setItem('voxCardSimV02',JSON.stringify({version:2,playerId:state.playerId,wallet:state.wallet,instances:state.instances,sealed:state.sealed,listings:state.listings,sales:state.sales,packs:state.packs,queue:state.queue,lastMarketTick:state.lastMarketTick,marketShift:state.marketShift,priceCache:state.priceCache}));}
function load(){
 try{
  const s=JSON.parse(localStorage.getItem('voxCardSimV02')||'null');
  if(s){Object.assign(state,{playerId:s.playerId||uid('PLAYER'),wallet:s.wallet??250,instances:s.instances||[],sealed:s.sealed||[],listings:s.listings||[],sales:s.sales||[],packs:s.packs||0,queue:s.queue||0,lastMarketTick:s.lastMarketTick||Date.now(),marketShift:s.marketShift||{},priceCache:s.priceCache||{}});return;}
  const old=JSON.parse(localStorage.getItem('voxCardSimV01')||'null');
  state.playerId=uid('PLAYER');
  if(old){state.wallet=old.wallet??250;state.packs=old.packs||0;state.instances=(old.instances||[]).map(x=>({...x,condition:'MT',variant:'normal',location:'inventory',binderSlot:null,status:'owned'}));}
 }catch{state.playerId=uid('PLAYER')}
}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1800)}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]))}
function rarityFor(n){if(COMMON.has(n))return'common';if(UNCOMMON.has(n))return'uncommon';if(RARE.has(n))return'rare';if(DOUBLE_RARE.has(n))return'double';if(IR.has(n))return'ir';if(UR.has(n))return'ur';if(SIR.has(n))return'sir';if(HR.has(n))return'hr';return'unknown'}
function isFoilVariant(ins,c){return ins?.variant==='reverse'||ins?.variant==='holo'||['rare','double','ir','ur','sir','hr'].includes(rarityFor(cardNo(c)))}
function ownedInstances(cardId){return state.instances.filter(x=>x.cardId===cardId&&x.status!=='sold')}
function binderInstance(cardId){return state.instances.find(x=>x.cardId===cardId&&x.status==='owned'&&x.location==='binder')}
function inventoryInstances(){return state.instances.filter(x=>x.status==='owned'&&x.location==='inventory')}
function listingForInstance(id){return state.listings.find(x=>x.instanceId===id&&x.status==='active')}

function nav(id){$$('.screen').forEach(x=>x.classList.toggle('active',x.id===id));$$('.bottom-nav [data-go]').forEach(x=>x.classList.toggle('active',x.dataset.go===id));window.scrollTo({top:0,behavior:'smooth'});if(id==='binder')renderBinder();if(id==='inventory')renderInventory();updateStats();}
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.go)));

async function initData(){
 try{
  const r=await fetch(`${API}/sets/${SET_ID}`);if(!r.ok)throw new Error(r.status);state.set=await r.json();state.cards=[...(state.set.cards||[])].sort((a,b)=>cardNo(a)-cardNo(b));
  const logo=state.set.logo?`${state.set.logo}.webp`:'';$('#setLogo').src=logo;$('#packLogo').src=logo;
 }catch(e){console.error(e);state.cards=Array.from({length:207},(_,i)=>({id:`sv03.5-${i+1}`,localId:String(i+1),name:`Carte #${String(i+1).padStart(3,'0')}`,image:`https://assets.tcgdex.net/fr/sv/sv03.5/${i+1}`}));toast('TCGdex indisponible : mode hors ligne partiel');}
 reconcileBinder();renderHero();renderProducts();renderBinder();renderInventory();updateStats();processMarket(true);save();
}
function renderHero(){const box=$('#heroStack');box.innerHTML='';[199,202,173].forEach(n=>{const c=getCard(n);if(c){const im=new Image();im.src=cardImg(c,'low');box.appendChild(im)}})}
function getCard(n){return state.cards.find(c=>cardNo(c)===Number(n))}
function updateStats(){
 const unique=new Set(state.instances.filter(x=>x.status!=='sold'&&!x.isEnergy&&x.cardId).map(x=>x.cardId)).size;
 const duplicates=inventoryInstances().filter(x=>!x.isEnergy).length;
 $('#wallet').textContent=money(state.wallet);$('#uniqueStat').textContent=`${unique} / 207`;$('#duplicateStat').textContent=duplicates;$('#packStat').textContent=state.packs;$('#listingStat').textContent=state.listings.filter(x=>x.status==='active').length;renderSaleFeed();
}
function renderSaleFeed(){const b=$('#saleFeed');const last=state.sales.slice(-3).reverse();b.innerHTML=last.length?`<strong>Dernières ventes</strong>${last.map(s=>`<div><span>${escapeHtml(s.label)}</span><b>${money(s.price)}</b></div>`).join('')}`:`<strong>Marché</strong><p>Aucune vente pour le moment.</p>`}

