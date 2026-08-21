'use strict';

/* VOX Card Sim V1.0.6 — market objects, offline catalog repair, lighter market UI. */
const V106_VERSION='1.0.6';

/* ---------- NUIT NOIRE IS A NORMAL 2026 BASE SET ---------- */
if(SETS.me05){SETS.me05.endgame=false;SETS.me05.baseSet=true;}
state.endgameUnlocks=state.endgameUnlocks&&typeof state.endgameUnlocks==='object'?state.endgameUnlocks:{};
if(!state.endgameUnlocks.me05)state.endgameUnlocks.me05=Date.now();
v090SetUnlocked=function(){return true};
v090VisibleSets=function(){return Object.values(SETS)};
v090VisibleSetIds=function(){return Object.keys(SETS)};
try{v081PersistSoon?.(1400)}catch{}

/* ---------- OFFLINE PACKS: EMBEDDED METADATA, DOWNLOAD ONLY REAL ASSETS ---------- */
function v106Remote(u){u=String(u||'').trim();return /^https:\/\//i.test(u)?u:''}
function v106HighScan(c,setId){
 if(setId==='me05'&&typeof v093Me05Image==='function')return v093Me05Image(c,'high');
 let u=String(c?.imageLarge||'').trim();if(/^https:\/\//i.test(u))return u;
 let base=String(c?.image||c?.imageSmall||'').trim();
 if(!base)return'';
 base=base.replace(/\/(?:high|low)\.(?:webp|png|jpe?g)$/i,'').replace(/\.(?:webp|png|jpe?g)$/i,'');
 return /^https:\/\//i.test(base)?`${base}/high.webp`:'';
}
function v106EmbeddedSet(setId){return setId==='me05'||!!SETS[setId]?.v105Catalog}
const v106OfflineManifestBase=v05OfflineManifest;
v05OfflineManifest=function(setId){
 if(!v106EmbeddedSet(setId))return v106OfflineManifestBase(setId);
 const cfg=SETS[setId],cards=cardsFor(setId);if(!cfg||!cards.length||cards.length!==cfg.total)throw new Error(`v106-offline-not-ready-${setId}-${cards.length}`);
 const urls=new Set(),scans=new Set();
 for(const c of cards){const u=v106Remote(v106HighScan(c,setId));if(u){urls.add(u);scans.add(u)}}
 if(scans.size!==cards.length)throw new Error(`v106-offline-scans-${setId}-${scans.size}/${cards.length}`);
 const logo=String(state.sets?.[setId]?.logo||'');if(v106Remote(logo))urls.add(/\.(webp|png|jpe?g)(\?|$)/i.test(logo)?logo:`${logo}.webp`);
 for(const p of cfg.products||[]){const u=v106Remote(p.image);if(u)urls.add(u)}
 for(const e of ENERGY||[]){for(const x of [e.image,e.thumb]){const u=v106Remote(x);if(u)urls.add(u)}}
 return [...urls];
};

const v106HydratePricesBase=v05HydratePrices;
v05HydratePrices=async function(setId,statusEl){
 if(!v106EmbeddedSet(setId))return v106HydratePricesBase(setId,statusEl);
 const cards=cardsFor(setId);state.lastKnownEstimates=state.lastKnownEstimates||{};
 if(setId!=='me05')for(const c of cards){
  let std=0,rev=0;
  try{std=Number(v105EmbeddedPrice(c,'standard'))||0;rev=Number(v105EmbeddedPrice(c,'reverse'))||0}catch{}
  if(std||rev)state.lastKnownEstimates[c.id]={standard:std||rev||null,reverse:rev||null,updated:null,fetchedAt:Date.now(),source:'embedded-v106'};
 }
 if(statusEl)statusEl.textContent=`Hors ligne prêt · ${cards.length} cartes + prix embarqués`;
 try{v081PersistSoon?.(500)}catch{try{v072ScheduleSave?.(500)}catch{}}
};

function v106EnsureOfflineRows(){
 const sec=$('#settingsModal .offline-settings');if(!sec)return;
 for(const s of Object.values(SETS)){
  if(sec.querySelector(`[data-offline-set="${CSS.escape(s.id)}"]`))continue;
  const row=document.createElement('div');row.className='offline-row';row.dataset.offlineSet=s.id;
  row.innerHTML=`<div><strong>${escapeHtml(s.name)}</strong><small class="offline-status">Vérification…</small></div><button class="secondary small">Télécharger</button>`;
  row.querySelector('button').onclick=()=>v05DownloadOffline(s.id);sec.appendChild(row);
 }
}
v05RefreshOfflinePanel=function(){
 document.querySelectorAll('[data-offline-set]').forEach(row=>{
  const id=row.dataset.offlineSet,s=v05NativePackStatus(id),status=row.querySelector('.offline-status'),btn=row.querySelector('button');
  if(!status||!btn)return;
  if(s.installed){status.textContent=`Disponible hors ligne · ${v05FormatBytes(s.bytes)}${s.completedAt?` · ${new Date(s.completedAt).toLocaleDateString('fr-FR')}`:''}`;btn.textContent='Mettre à jour'}
  else{status.textContent='Non téléchargée';btn.textContent='Télécharger'}
 });
 try{v081PersistSoon?.(1600)}catch{}
};
const v106RenderSettingsBase=renderSettings;
renderSettings=function(){const r=v106RenderSettingsBase();v106EnsureOfflineRows();try{v05RefreshOfflinePanel()}catch(e){console.warn('V1.0.6 offline panel',e)}return r};

/* ---------- MARKETPLACE: ONE INDEX, NO FULL 3K-CARD REBUILD PER KEYSTROKE ---------- */
let v106MarketIndex=null;const v106MarketCache=new Map();
function v106Norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-FR').trim()}
function v106CardBaseReference(c,setId){
 if(c?.v105Embedded&&typeof v105EmbeddedPrice==='function'){const n=Number(v105EmbeddedPrice(c,'standard'));if(n>0)return n}
 const snap=state.lastKnownEstimates?.[c?.id]||{},n=Number(snap.standard||snap.reverse);return n>0?n:Number(v4FallbackBase(rarityFor(setId,cardNo(c)))||1);
}
function v106ProductReference(p){return Math.max(.02,Number(p?.marketTrend||p?.price||1)*1.04)}
function v106AssetImage(a){
 if(a.type==='card'){
  const c=cardById(a.setId,a.cardId);if(!c)return'';
  const u=String(c.imageSmall||c.image||'');if(/\.(webp|png|jpe?g)(\?|$)/i.test(u)||/\/(?:low|high)\.webp$/i.test(u))return u;
  if(/^https:\/\//i.test(u))return`${u}/low.webp`;
  try{return cardImg(c,'low')}catch{return''}
 }
 return a._image||'';
}
function v106BuildMarketIndex(){
 const out=[];
 for(const s of Object.values(SETS)){
  const setText=v106Norm(s.name);
  const loose=(s.products||[]).find(p=>p.mode==='loose'&&Number(p.qty)===1);
  if(loose)out.push({type:'booster',category:'booster',setId:s.id,label:`Booster ${s.name}`,subtitle:'Booster à l’unité',rarity:'sealed',_image:loose.image||'',_base:v106ProductReference(loose),_text:v106Norm(`booster ${s.name} ${s.series||''}`),_no:0});
  for(const p of s.products||[]){
   if(p.eventEdition||p.mode==='loose')continue;
   if(p.mode!=='sealed'&&p.mode!=='binderUnlock')continue;
   const object=p.mode==='binderUnlock';
   out.push({type:'sealed',category:object?'object':'sealed',marketKind:object?'object':'sealed',setId:s.id,productId:p.id,label:p.name,subtitle:object?'Classeur / objet physique':(p.kind||'Produit scellé'),rarity:'sealed',_image:p.image||'',_base:v106ProductReference(p),_text:v106Norm(`${p.name} ${p.kind||''} ${s.name} ${object?'classeur objet portfolio':''}`),_no:0});
  }
  for(const c of cardsFor(s.id)){
   const r=rarityFor(s.id,cardNo(c)),lid=String(c.localId||'');
   out.push({type:'card',category:'card',setId:s.id,cardId:c.id,label:c.name,subtitle:`${s.name} · #${lid} · ${v08RarityLabel(r)}`,localId:lid,rarity:r,variant:'standard',_base:v106CardBaseReference(c,s.id),_text:v106Norm(`${c.name} ${s.name} ${lid} #${lid} ${v08RarityLabel(r)}`),_name:v106Norm(c.name),_setText:setText,_no:cardNo(c)});
  }
 }
 for(const p of Object.values(state.eventCatalog||{})){
  if(!p?.eventEdition||Date.now()<Number(p.eventEnd||0))continue;
  out.push({type:'sealed',category:'sealed',setId:p.setId,productId:p.id,label:p.name,subtitle:'Édition limitée · marché secondaire',rarity:'event',_image:p.image||'',_base:v106ProductReference(p),_text:v106Norm(`${p.name} édition limitée ${setName(p.setId)}`),_no:0});
 }
 v106MarketIndex=out;v106MarketCache.clear();return out;
}
function v106InvalidateMarket(){v106MarketCache.clear()}
function v106FastReference(a){return Math.max(.02,Number(a._base||1)*(a.type==='card'?(state.marketShift?.[a.cardId]||1):1))}
function v106MarketAssets(query){
 const q=v106Norm(query),setFilter=state.marketSetFilter||'all',cat=state.marketCategory||'all',rarity=state.marketRarity||'all',min=state.marketMinPrice===''?null:Number(state.marketMinPrice),max=state.marketMaxPrice===''?null:Number(state.marketMaxPrice),sort=state.marketSort||'relevance';
 const key=[q,setFilter,cat,rarity,state.marketMinPrice,state.marketMaxPrice,sort].join('|');if(v106MarketCache.has(key))return v106MarketCache.get(key);
 const exactNum=q.match(/^#?0*(\d{1,4})$/),tokens=q&&!exactNum?q.split(/\s+/).filter(Boolean):[];let arr=[];
 for(const a of (v106MarketIndex||v106BuildMarketIndex())){
  if(setFilter!=='all'&&a.setId!==setFilter)continue;
  if(cat!=='all'&&a.category!==cat)continue;
  if((cat==='all'||cat==='card')&&rarity!=='all'&&a.type==='card'&&a.rarity!==rarity)continue;
  if(q){
   if(exactNum){if(a.type!=='card'||a._no!==Number(exactNum[1]))continue}
   else if(!tokens.every(t=>a._text.includes(t)))continue;
  }
  const ref=v106FastReference(a);if(min!==null&&Number.isFinite(min)&&ref<min)continue;if(max!==null&&Number.isFinite(max)&&ref>max)continue;
  let score=0;if(q){if(a._name===q)score=100;else if(a._name?.startsWith(q))score=80;else if(a._text.includes(q))score=60;else score=40}
  arr.push({...a,reference:ref,trend:a.type==='card'?v08AssetTrend(a):0,score});
 }
 switch(sort){
  case'priceAsc':arr.sort((a,b)=>a.reference-b.reference||b.score-a.score);break;
  case'priceDesc':arr.sort((a,b)=>b.reference-a.reference||b.score-a.score);break;
  case'trendUp':arr.sort((a,b)=>(b.trend||0)-(a.trend||0)||b.score-a.score);break;
  case'trendDown':arr.sort((a,b)=>(a.trend||0)-(b.trend||0)||b.score-a.score);break;
  case'name':arr.sort((a,b)=>String(a.label).localeCompare(String(b.label),'fr'));break;
  case'number':arr.sort((a,b)=>(a.type==='card'?a._no:99999)-(b.type==='card'?b._no:99999)||String(a.label).localeCompare(String(b.label),'fr'));break;
  default:arr.sort((a,b)=>b.score-a.score||Object.keys(SETS).indexOf(a.setId)-Object.keys(SETS).indexOf(b.setId)||(a.category==='booster'?-3:a.category==='object'?-2:a.category==='sealed'?-1:a._no)-(b.category==='booster'?-3:b.category==='object'?-2:b.category==='sealed'?-1:b._no));
 }
 if(v106MarketCache.size>12)v106MarketCache.delete(v106MarketCache.keys().next().value);v106MarketCache.set(key,arr);return arr;
}
v08MarketAssets=v106MarketAssets;v4MarketAssetResults=v106MarketAssets;

const v106SealedBookBase=v4SealedBook;
v4SealedBook=function(productId){const b=v106SealedBookBase(productId),p=productById(productId);if(b&&p?.mode==='binderUnlock'){b.asset.marketKind='object';b.asset.rarity='rare';b.asset.label=p.name;b.asset.image=p.image||b.asset.image}return b};
const v106OpenBookBase=v4OpenBook;
v4OpenBook=function(book){const r=v106OpenBookBase(book);if(book?.asset?.marketKind==='object'){const el=$('#marketContent .market-asset-head span');if(el)el.textContent='OBJET / CLASSEUR'}return r};

function v106PersistMarketPrefs(){try{v081PersistSoon?.(1200)}catch{try{v072ScheduleSave?.(1200)}catch{}}}
function v106ResultHtml(a,i){const trend=a.trend||0,t=trend>.005?`▲ +${(trend*100).toFixed(1)}%`:trend<-.005?`▼ ${(trend*100).toFixed(1)}%`:'—',img=v106AssetImage(a);return`<button class="market-result v08-market-result" data-market-result="${i}"><img loading="lazy" decoding="async" src="${img}" alt=""><div><strong>${escapeHtml(a.label)}</strong><span>${escapeHtml(a.subtitle||'')}</span><small>Réf. ${money(a.reference)} · Tendance ${t}</small></div><b>Offres ›</b></button>`}
v4RenderBuyHome=function(){
 const out=$('#marketContent');if(!out)return;if(v08Mode()==='creative'){state.marketTab='players';return v07RenderPlayers()}
 const all=v106MarketAssets(state.marketQuery),pages=Math.max(1,Math.ceil(all.length/V08_MARKET_PAGE_SIZE));state.marketPage=clamp(state.marketPage||1,1,pages);const start=(state.marketPage-1)*V08_MARKET_PAGE_SIZE,results=all.slice(start,start+V08_MARKET_PAGE_SIZE),real=v08Mode()==='realistic';
 out.innerHTML=`<div class="market-tabs"><button data-mtab="buy" class="active">Acheter</button><button data-mtab="sell">Mes ventes</button><button data-mtab="history">Historique</button><button data-mtab="players">Joueurs</button></div>${!real?'<div class="online-banner panel"><strong>Mode Ludique</strong><span>Marché NPC isolé du marché Réaliste des joueurs.</span></div>':''}<div class="market-search v08-market-search"><input id="marketSearchInput" placeholder="Nom, n° de carte, classeur, objet…" value="${escapeHtml(state.marketQuery)}"><div class="v08-filter-grid"><select id="v08MarketSet">${v08MarketSetOptions()}</select><select id="v08MarketCategory"><option value="all">Toutes catégories</option><option value="card" ${state.marketCategory==='card'?'selected':''}>Cartes</option><option value="booster" ${state.marketCategory==='booster'?'selected':''}>Boosters</option><option value="sealed" ${state.marketCategory==='sealed'?'selected':''}>Produits scellés</option><option value="object" ${state.marketCategory==='object'?'selected':''}>Objets / classeurs</option></select><select id="v08MarketRarity" ${state.marketCategory!=='all'&&state.marketCategory!=='card'?'disabled':''}>${v08RarityOptions()}</select><select id="v08MarketSort"><option value="relevance">Pertinence</option><option value="number" ${state.marketSort==='number'?'selected':''}>N° collection</option><option value="name" ${state.marketSort==='name'?'selected':''}>Nom A → Z</option><option value="priceAsc" ${state.marketSort==='priceAsc'?'selected':''}>Prix ↑</option><option value="priceDesc" ${state.marketSort==='priceDesc'?'selected':''}>Prix ↓</option><option value="trendUp" ${state.marketSort==='trendUp'?'selected':''}>Tendance ↑</option><option value="trendDown" ${state.marketSort==='trendDown'?'selected':''}>Tendance ↓</option></select></div><div class="v08-price-range"><label>Prix min.<input id="v08MinPrice" type="number" min="0" step="0.01" value="${escapeHtml(state.marketMinPrice)}"></label><label>Prix max.<input id="v08MaxPrice" type="number" min="0" step="0.01" value="${escapeHtml(state.marketMaxPrice)}"></label></div></div><div class="v08-result-count"><strong>${all.length} article(s)</strong><span>Page ${state.marketPage}/${pages}</span></div><div class="market-result-list">${results.map(v106ResultHtml).join('')||'<div class="empty-state panel">Aucun résultat avec ces filtres.</div>'}</div><div class="v08-pagination"><button id="v08PrevMarket" class="secondary" ${state.marketPage<=1?'disabled':''}>← Précédent</button><button id="v08NextMarket" class="secondary" ${state.marketPage>=pages?'disabled':''}>Suivant →</button></div>`;
 const rerender=()=>{state.marketPage=1;v106PersistMarketPrefs();v4RenderBuyHome()};
 $('#marketSearchInput').oninput=e=>{state.marketQuery=e.target.value;clearTimeout(v4RenderBuyHome.t);v4RenderBuyHome.t=setTimeout(rerender,220)};
 $('#v08MarketSet').onchange=e=>{state.marketSetFilter=e.target.value;rerender()};$('#v08MarketCategory').onchange=e=>{state.marketCategory=e.target.value;rerender()};$('#v08MarketRarity').onchange=e=>{state.marketRarity=e.target.value;rerender()};$('#v08MarketSort').onchange=e=>{state.marketSort=e.target.value;rerender()};
 for(const id of ['v08MinPrice','v08MaxPrice'])$('#'+id).oninput=e=>{state[id==='v08MinPrice'?'marketMinPrice':'marketMaxPrice']=e.target.value;clearTimeout(v4RenderBuyHome.p);v4RenderBuyHome.p=setTimeout(rerender,300)};
 $('#v08PrevMarket').onclick=()=>{state.marketPage--;v106PersistMarketPrefs();v4RenderBuyHome()};$('#v08NextMarket').onclick=()=>{state.marketPage++;v106PersistMarketPrefs();v4RenderBuyHome()};
 out.querySelectorAll('[data-market-result]').forEach(b=>b.onclick=async()=>{const a=results[Number(b.dataset.marketResult)];if(!a)return;if(a.type==='card'){const c=cardById(a.setId,a.cardId);if(c)await v4OpenCardAsset(c,a.setId)}else if(a.type==='booster')v4OpenBook(v4BoosterBook(a.setId));else v4OpenBook(v4SealedBook(a.productId))});
 v06WireTabs(out);out.querySelectorAll('[data-mtab="players"]').forEach(b=>b.onclick=()=>{state.marketTab='players';v106PersistMarketPrefs();renderMarket()});
};

const v106ExecuteBuyBase=v4ExecuteBuy;v4ExecuteBuy=function(...args){const r=v106ExecuteBuyBase(...args);v106InvalidateMarket();return r};
const v106CompleteOrderBase=completeOrder;completeOrder=function(...args){const r=v106CompleteOrderBase(...args);v106InvalidateMarket();return r};

/* Build the cheap search index outside the first interactive frame. */
const v106Warm=()=>{try{v106BuildMarketIndex()}catch(e){console.warn('V1.0.6 market index',e)}};
if('requestIdleCallback'in window)requestIdleCallback(v106Warm,{timeout:1800});else setTimeout(v106Warm,650);

const v106Style=document.createElement('style');v106Style.textContent=`
#marketContent .market-result-list{content-visibility:auto;contain-intrinsic-size:900px}
#marketContent .market-result{contain:layout paint style}
#marketContent .market-result img{content-visibility:auto}
.offline-settings .offline-row{contain:layout style}
`;
document.head.appendChild(v106Style);

if(!$('#settingsModal')?.classList.contains('hidden'))renderSettings();
if(!$('#marketModal')?.classList.contains('hidden'))renderMarket();
try{renderSetSwitches();if($('#shop')?.classList.contains('active'))renderProducts()}catch{}
window.__voxV106Ready=true;
