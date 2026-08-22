'use strict';

/* VOX Card Sim V0.9.3 — opening/binder performance + Nuit Noire asset repair. */
const V093_VERSION='0.9.3';

/* ---------- NUIT NOIRE: CANONICAL IMAGE URLS + SELF-REPAIR ---------- */
function v093Me05Base(c){
 let s=String(c?.image||c?.imageLarge||c?.imageSmall||'').trim();
 if(!s&&c?.localId)s=`https://assets.tcgdex.net/fr/me/me05/${String(c.localId).padStart(3,'0')}`;
 s=s.replace(/\/(?:high|low)\.(?:webp|png|jpg)$/i,'').replace(/\.(?:webp|png|jpg)$/i,'');
 return s;
}
function v093Me05Image(c,q='high'){
 const base=v093Me05Base(c);if(!base)return'';
 const quality=q==='low'?'low':'high';
 // Offline packs cache the high scan; reuse it for thumbnails while offline.
 const installed=!!state.offlinePackMeta?.me05?.installed;
 return `${base}/${installed?'high':quality}.webp`;
}
const v093CardImgBase=cardImg;
cardImg=function(c,q='high'){
 if(String(c?.id||'').startsWith('me05-'))return v093Me05Image(c,q);
 return v093CardImgBase(c,q);
};

function v093RepairMe05Data(){
 const bundle=window.V090_PITCH_BLACK_DATA;
 if(!bundle||!Array.isArray(bundle.cards)||bundle.cards.length!==120)return false;
 const current=cardsFor('me05');
 if(current.length!==120){
  try{if(typeof v090LoadPitchBlackData==='function'&&!v090LoadPitchBlackData())return false}catch(e){console.warn('V0.9.3 Nuit Noire reload',e);return false}
 }
 const cards=cardsFor('me05');if(cards.length!==120)return false;
 for(const c of cards){
  const base=v093Me05Base(c);if(!base)continue;
  c.image=base;c.imageSmall=`${base}/low.webp`;c.imageLarge=`${base}/high.webp`;
 }
 try{v072CardIndexes?.delete?.('me05');v072PoolIndexes?.delete?.('me05')}catch{}
 state.metaReady.me05=!!state.meta?.me05&&cards.length===120;
 return state.metaReady.me05;
}
v093RepairMe05Data();

/* Nuit Noire metadata + prices are embedded in the APK. Download only assets
   that WebView actually needs offline instead of 121 redundant API requests. */
const v093OfflineManifestBase=v05OfflineManifest;
v05OfflineManifest=function(setId){
 if(setId!=='me05')return v093OfflineManifestBase(setId);
 if(!v090SetUnlocked('me05'))throw new Error('me05-locked');
 if(!v093RepairMe05Data())throw new Error('me05-not-ready');
 const cards=cardsFor('me05'),urls=new Set();
 for(const c of cards){const u=v093Me05Image(c,'high');if(/^https:\/\//i.test(u))urls.add(u)}
 if(urls.size!==120)throw new Error(`me05-scan-manifest-${urls.size}/120`);
 const logo=String(state.sets?.me05?.logo||V090_PITCH_LOGO||'');if(/^https:\/\//i.test(logo))urls.add(/\.(webp|png|jpg)$/i.test(logo)?logo:`${logo}.webp`);
 for(const e of ENERGY||[]){for(const u of [e.image,e.thumb])if(/^https:\/\//i.test(String(u||'')))urls.add(u)}
 return [...urls];
};

const v093HydratePricesBase=v05HydratePrices;
v05HydratePrices=async function(setId,statusEl){
 if(setId!=='me05')return v093HydratePricesBase(setId,statusEl);
 v093RepairMe05Data();
 // v090SeedPrice already copied Cardmarket snapshots from the embedded dataset.
 if(statusEl)statusEl.textContent=`Hors ligne prêt · 120 cartes + prix embarqués`;
 save();
};

function v093EnsureMe05OfflineRow(){
 const sec=$('#settingsModal .offline-settings');if(!sec||!v090SetUnlocked('me05'))return;
 let row=sec.querySelector('[data-offline-set="me05"]');
 if(!row){
  row=document.createElement('div');row.className='offline-row';row.dataset.offlineSet='me05';
  row.innerHTML='<div><strong>Nuit Noire</strong><small class="offline-status">Vérification…</small></div><button class="secondary small">Télécharger</button>';
  row.querySelector('button').onclick=()=>v05DownloadOffline('me05');sec.appendChild(row);
 }
}
const v093RenderSettingsBase=renderSettings;
renderSettings=function(){const r=v093RenderSettingsBase();v093EnsureMe05OfflineRow();try{v05RefreshOfflinePanel()}catch{}return r};

/* ---------- OPENING: DO NOT SERIALIZE THE WHOLE SAVE BETWEEN CARDS ---------- */
let v093RevealPersistTimer=0,v093RevealIdleId=0;
function v093CancelRevealPersist(){
 clearTimeout(v093RevealPersistTimer);v093RevealPersistTimer=0;
 if(v093RevealIdleId&&'cancelIdleCallback'in window)try{cancelIdleCallback(v093RevealIdleId)}catch{}
 v093RevealIdleId=0;
}
function v093FlushRevealPersist(){
 v093CancelRevealPersist();
 try{return v081SaveBase()}catch(e){console.warn('V0.9.3 reveal save',e);try{return save()}catch{}}
}
function v093QueueRevealPersist(delay=2600){
 v093CancelRevealPersist();
 v093RevealPersistTimer=setTimeout(()=>{
  v093RevealPersistTimer=0;
  const run=()=>{v093RevealIdleId=0;if(state.currentOpening?.phase==='reveal')try{v081SaveBase()}catch(e){console.warn('V0.9.3 idle reveal save',e)}};
  if('requestIdleCallback'in window)v093RevealIdleId=requestIdleCallback(run,{timeout:1800});else setTimeout(run,80);
 },Math.max(1800,Number(delay)||2600));
}
const v093PersistSoonBase=v081PersistSoon;
v081PersistSoon=function(delay=320){
 if(state.currentOpening?.phase==='reveal'){v093QueueRevealPersist(Math.max(2600,delay));return}
 return v093PersistSoonBase(delay);
};
const v093ScheduleSaveBase=v072ScheduleSave;
v072ScheduleSave=function(delay=650){
 if(state.currentOpening?.phase==='reveal'){v093QueueRevealPersist(2800);return}
 return v093ScheduleSaveBase(delay);
};
const v093FinishPackBase=finishPack;
finishPack=function(){
 v093CancelRevealPersist();
 const r=v093FinishPackBase();
 // finishPack's own save is authoritative; no delayed reveal write may follow it.
 return r;
};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&v093RevealPersistTimer)v093FlushRevealPersist()},{passive:true});
window.addEventListener('pagehide',()=>{if(v093RevealPersistTimer)v093FlushRevealPersist()},{passive:true});

/* ---------- BINDER: PERSISTENT O(1) LOOKUPS WHILE FLIPPING ---------- */
const v093BinderIndexes=new Map();
function v093InvalidateBinder(setId=null){if(setId)v093BinderIndexes.delete(setId);else v093BinderIndexes.clear()}
function v093BinderIndex(setId){
 const now=performance.now(),arr=state.instances||[];let x=v093BinderIndexes.get(setId);
 if(x&&x.instances===arr&&x.length===arr.length&&now-x.at<4000)return x;
 const cards=new Map(),energies=new Map();
 for(const ins of arr){
  if(ins?.setId!==setId||ins.status!=='owned')continue;
  if(ins.location==='binder'&&ins.cardId)cards.set(ins.cardId,ins);
  if(ins.isEnergy&&ins.energyKeeper&&ins.location==='binder-energy')energies.set(`${ins.energyType}|${ins.variant||'normal'}`,ins);
 }
 x={instances:arr,length:arr.length,at:now,cards,energies};v093BinderIndexes.set(setId,x);return x;
}
binderInstance=function(cardId,setId){return v093BinderIndex(setId).cards.get(cardId)||null};
v062EnergyKeeper=function(setId,energyType,variant){return v093BinderIndex(setId).energies.get(`${energyType}|${variant||'normal'}`)||null};

const v093ReconcileBase=reconcileBinder;
reconcileBinder=function(setId){const r=v093ReconcileBase(setId);v093InvalidateBinder(setId);return r};
const v093AddCardBase=addCardInstance;
addCardInstance=function(c){const r=v093AddCardBase(c);v093InvalidateBinder(r?.setId||c?.setId||state.activeSet);return r};
const v093AddEnergyBase=addEnergyInstance;
addEnergyInstance=function(c){const r=v093AddEnergyBase(c);v093InvalidateBinder(c?.setId||state.activeSet);return r};
const v093ReceiveCardBase=v4ReceiveCard;
v4ReceiveCard=function(...args){const r=v093ReceiveCardBase(...args);v093InvalidateBinder(args[0]?.setId);return r};

/* ---------- BINDER TURN: COMPOSITOR-ONLY ANIMATION ---------- */
function v093PrepareTurnSheet(sheet){
 if(!sheet)return;sheet.style.willChange='transform';sheet.style.contain='layout paint style';sheet.style.backfaceVisibility='hidden';sheet.style.webkitBackfaceVisibility='hidden';
 for(const el of sheet.querySelectorAll('.v08-turn-front,.v08-turn-back')){el.style.backfaceVisibility='hidden';el.style.webkitBackfaceVisibility='hidden'}
}
function v093ResetLivePage(page){if(!page)return;page.style.transition='none';page.style.transform='';page.style.transformOrigin='';page.style.filter='';page.style.willChange=''}

v08TurnBinder=function(dir,startAngle=0){
 if(v08BinderBusy||!v08BinderCanTurn(dir))return;
 const page=$('#binderShell .binder-page');if(!page)return;
 v08BinderBusy=true;
 const sheet=v08CreateTurnSheet(page,dir,startAngle);v093PrepareTurnSheet(sheet);
 v093ResetLivePage(page);
 const sid=state.activeSet,next=clamp((state.pageBySet[sid]||0)+dir,0,v090BinderPages(sid)-1);
 state.pageBySet[sid]=next;
 const end=dir>0?-178:178,duration=(typeof v088BatteryOn==='function'&&v088BatteryOn())?180:330;let cleaned=false,rendered=false;
 const renderNext=()=>{if(rendered)return;rendered=true;try{v090RenderBinderCore();v093ResetLivePage($('#binderShell .binder-page'))}catch(e){console.warn('V0.9.3 binder render',e)}};
 const cleanup=()=>{if(cleaned)return;cleaned=true;renderNext();try{sheet.remove()}catch{}v093ResetLivePage($('#binderShell .binder-page'));v08BinderBusy=false;v08BinderDrag=null;try{v08BindBinderGestures()}catch{}};
 try{
  const anim=sheet.animate([{transform:`rotateY(${startAngle}deg)`},{transform:`rotateY(${end}deg)`}],{duration,easing:'cubic-bezier(.22,.72,.16,1)',fill:'forwards'});
  // Let the compositor start the turn first; build the next page one frame later underneath it.
  requestAnimationFrame(()=>requestAnimationFrame(renderNext));
  anim.onfinish=cleanup;anim.oncancel=cleanup;setTimeout(cleanup,duration+220);
 }catch(e){console.warn('V0.9.3 binder animation fallback',e);cleanup()}
};

/* Keep drag itself transform-only. The expensive page content is untouched until release. */
const v093BindGesturesBase=v08BindBinderGestures;
v08BindBinderGestures=function(){
 v093BindGesturesBase();
 const page=$('#binderShell .binder-page');if(page){page.style.willChange='transform';page.style.backfaceVisibility='hidden';page.style.webkitBackfaceVisibility='hidden'}
};

/* Low-power mode: turn sheets never need filter/backdrop work. */
const v093Style=document.createElement('style');v093Style.textContent=`
.v08-turn-sheet{will-change:transform;contain:layout paint style!important;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.v08-turn-sheet .v08-turn-front,.v08-turn-sheet .v08-turn-back{backface-visibility:hidden;-webkit-backface-visibility:hidden}
html.v088-battery .v08-turn-sheet{box-shadow:none!important}
`;
document.head.appendChild(v093Style);

/* Repair current UI after the late-loaded layer arrives. */
if(v090SetUnlocked('me05'))v093RepairMe05Data();
if($('#binder')?.classList.contains('active'))renderBinder();
if(!$('#settingsModal')?.classList.contains('hidden'))renderSettings();
window.__voxV093Ready=true;
