'use strict';

/* V1.1.0 Master Set layer. Generic binder keeps the validated V0.9.3 renderer/page-turn. */
const V110_MASTER=window.V110_MASTER_VARIANTS||{};
function v110MasterData(setId){return V110_MASTER?.[setId]||null}
function v110MasterSupported(setId){const d=v110MasterData(setId);return !!d?.supported&&d.cards&&Object.keys(d.cards).length>0}
function v110VariantsFor(setId,c){const d=v110MasterData(setId),key=String(c?.localId||cardNo(c)).padStart(3,'0'),a=d?.cards?.[key];return Array.isArray(a)?a.filter(v=>['normal','holo','reverse'].includes(v)):[]}
function v110MasterSlots(setId){const out=[];if(!v110MasterSupported(setId))return out;for(const c of cardsFor(setId))for(const variant of v110VariantsFor(setId,c))out.push({cardId:c.id,localId:String(c.localId||cardNo(c)).padStart(3,'0'),variant,c});return out}
function v110GenericNeed(setId){return Math.max(1,Number(v090RequiredBinders(setId))||1)}
function v110TotalBinders(setId){return Math.max(0,Number(v090BinderCount(setId))||0)}
function v110GenericCount(setId){return Math.min(v110TotalBinders(setId),v110GenericNeed(setId))}
function v110MasterCount(setId){return Math.max(0,v110TotalBinders(setId)-v110GenericNeed(setId))}
function v110MasterCapacity(setId){const s=v090BinderSpec(setId);return s?s.capacity*v110MasterCount(setId):0}
function v110MasterPages(setId){const s=v090BinderSpec(setId);return s?s.pages*v110MasterCount(setId):0}
function v110MasterNeed(setId){const s=v090BinderSpec(setId),n=v110MasterSlots(setId).length;return s&&n?Math.ceil(n/s.capacity):0}

/* Extra physical binders belong to Master; they must not create blank Generic pages. */
const v110BinderCapacityBase=v090BinderCapacity,v110BinderPagesBase=v090BinderPages;
v090BinderCapacity=function(setId){const s=v090BinderSpec(setId);return s?s.capacity*v110GenericCount(setId):v110BinderCapacityBase(setId)};
v090BinderPages=function(setId){const s=v090BinderSpec(setId);return s?s.pages*v110GenericCount(setId):v110BinderPagesBase(setId)};

function v110VariantOf(ins,c,setId){if(ins?.variant==='reverse')return'reverse';if(ins?.variant==='holo')return'holo';const r=rarityFor(setId,cardNo(c));return['rare','double','ir','ur','sir','hr','mhr','jp_rare','jp_rr','jp_rrr','jp_sr','jp_hr','jp_ur'].includes(r)?'holo':'normal'}
let v110MasterIndexCache=new Map();
function v110InvalidateMaster(setId=null){if(setId)v110MasterIndexCache.delete(setId);else v110MasterIndexCache.clear();try{v093InvalidateBinder?.(setId)}catch{}}
function v110MasterIndex(setId){const arr=state.instances||[];let x=v110MasterIndexCache.get(setId);if(x&&x.ref===arr&&x.len===arr.length)return x.map;const map=new Map();for(const ins of arr)if(ins?.setId===setId&&ins.status==='owned'&&ins.location==='master-binder'&&Number.isInteger(ins.masterSlot))map.set(ins.masterSlot,ins);v110MasterIndexCache.set(setId,{ref:arr,len:arr.length,map});return map}

const v110ReconcileGenericBase=reconcileBinder;
function v110ReconcileMaster(setId){
 const cfg=SETS[setId];if(!cfg)return;
 /* Graded slabs never enter a physical binder. Hide them from the legacy reconciler. */
 const held=[];for(const ins of state.instances||[])if(ins?.setId===setId&&ins.graded&&ins.status==='owned'){held.push(ins);ins.status='v110-graded-hold'}
 try{v110ReconcileGenericBase(setId)}finally{for(const ins of held){ins.status='owned';ins.location='inventory';ins.binderSlot=null;ins.masterSlot=null}}
 const cap=v110MasterCapacity(setId),slots=v110MasterSlots(setId),groups=new Map(),used=new Set();
 for(const ins of state.instances||[]){if(ins?.setId!==setId||ins.status!=='owned'||ins.isEnergy||ins.graded||!ins.cardId)continue;if(ins.location==='binder')used.add(ins.id);if(!groups.has(ins.cardId))groups.set(ins.cardId,[]);groups.get(ins.cardId).push(ins);if(ins.location==='master-binder'){ins.location='inventory';ins.masterSlot=null}}
 const age=x=>Number(x.openedAt||x.acquiredAt||0);for(const arr of groups.values())arr.sort((a,b)=>age(a)-age(b));
 for(let i=0;i<slots.length&&i<cap;i++){const s=slots[i],arr=groups.get(s.cardId)||[],pick=arr.find(x=>!used.has(x.id)&&x.location!=='binder'&&v110VariantOf(x,s.c,setId)===s.variant);if(!pick)continue;pick.location='master-binder';pick.masterSlot=i;pick.binderSlot=null;used.add(pick.id)}
 v110InvalidateMaster(setId);try{v081RebuildInstanceIndexes?.()}catch{}
}
window.v110ReconcileMaster=v110ReconcileMaster;
reconcileBinder=v110ReconcileMaster;
for(const sid of Object.keys(SETS))try{v110ReconcileMaster(sid)}catch(e){console.warn('V1.1 master migration',sid,e)}

function v110MasterProgress(setId){const slots=v110MasterSlots(setId),cap=Math.min(slots.length,v110MasterCapacity(setId)),map=v110MasterIndex(setId);let filled=0;for(let i=0;i<cap;i++)if(map.has(i))filled++;return{filled,total:slots.length,capacity:v110MasterCapacity(setId),physical:v110MasterCount(setId)}}
function v110CheckMasterReward(setId){if(!v110MasterSupported(setId)||state.masterRewards?.[setId])return false;const p=v110MasterProgress(setId);if(!p.total||p.capacity<p.total||p.filled<p.total)return false;state.masterRewards[setId]=Date.now();v110AddXp(25,'Master Set complété',false);if(v08Mode()!=='creative')state.wallet+=5000;const gift=v110GiveRandomBooster('master-complete');save();toast(`Master Set ${setName(setId)} complété · +25 XP${v08Mode()==='creative'?'':' · +5 000 €'} · booster ${setName(gift)}`);return true}
window.v110CheckMasterReward=v110CheckMasterReward;

function v110View(setId){return state.masterBinderView?.[setId]==='master'&&v110MasterSupported(setId)?'master':'generic'}
function v110MasterPage(setId){return Math.max(0,Number(state.masterPageBySet?.[setId])||0)}
function v110SetMasterPage(setId,p){state.masterPageBySet??={};state.masterPageBySet[setId]=Math.max(0,p)}
function v110EnsureTabs(){const shell=$('#binderShell');if(!shell)return null;let box=$('#v110BinderTabs');if(!box){box=document.createElement('div');box.id='v110BinderTabs';box.className='v110-binder-tabs';shell.parentNode.insertBefore(box,shell)}return box}
function v110RenderTabs(setId){const box=v110EnsureTabs();if(!box)return;const supported=v110MasterSupported(setId),view=v110View(setId),p=supported?v110MasterProgress(setId):null;box.innerHTML=`<button class="${view==='generic'?'active':''}" data-v110-view="generic">${escapeHtml(setName(setId))} · Générique</button><button class="${view==='master'?'active':''}" data-v110-view="master" ${supported?'':'disabled'}>${escapeHtml(setName(setId))} · Master Set${supported?` <small>${p.filled}/${p.total}</small>`:' <small>indisponible</small>'}</button>`;box.querySelectorAll('[data-v110-view]').forEach(b=>b.onclick=()=>{if(b.disabled)return;state.masterBinderView[setId]=b.dataset.v110View;if(b.dataset.v110View==='master')v110SetMasterPage(setId,0);save();renderBinder()})}
function v110MasterToolbar(setId){const total=v110TotalBinders(setId),need=v110GenericNeed(setId),mc=v110MasterCount(setId),mn=v110MasterNeed(setId),spec=v090BinderSpec(setId),bar=v090EnsureBinderToolbar();if(!bar)return;bar.innerHTML=`<div><strong>${mc} / ${mn} classeur${mn!==1?'s':''} Master</strong><span>${mc*(spec?.capacity||0)} emplacements Master · commence après les ${need} classeur${need>1?'s':''} Générique · ${total} physique${total!==1?'s':''} au total</span></div><button id="v110AddMasterBinder" class="secondary small">${mc?'Acheter un autre':'Acheter le classeur Master'}</button>`;bar.querySelector('#v110AddMasterBinder').onclick=()=>v090BuyBinder(setId)}
function v110DecorateGeneric(setId){v110RenderTabs(setId);const bar=$('#v090BinderToolbar');if(bar){const need=v110GenericNeed(setId),gc=v110GenericCount(setId),total=v110TotalBinders(setId),span=bar.querySelector('span'),strong=bar.querySelector('strong');if(strong)strong.textContent=`${gc} / ${need} classeur${need>1?'s':''} Générique`;if(span)span.textContent=`${v090BinderCapacity(setId)} emplacements Générique · ${Math.max(0,total-need)} classeur(s) Master`}}

function v110RenderMasterBinder(){
 const sid=state.activeSet,cfg=SETS[sid],spec=v090BinderSpec(sid),slots=v110MasterSlots(sid),count=v110MasterCount(sid),cap=v110MasterCapacity(sid),pages=v110MasterPages(sid);if(!cfg||!spec)return;
 v110RenderTabs(sid);v110MasterToolbar(sid);$('#binderTitle').textContent=`${cfg.name} — Master Set`;const prev=$('#prevPage'),next=$('#nextPage'),g=$('#pocketGrid'),prog=v110MasterProgress(sid);
 if(!count){$('#binderMetaName').textContent='Sous-classeur Master verrouillé';$('#binderMetaCount').textContent=`${slots.length} variantes documentées · achète un classeur après le Générique`;$('#pageNum').textContent='—';$('#pageTotal').textContent='—';g.innerHTML=`<div class="binder-locked"><div>✦</div><strong>Master Set</strong><p>Le Générique utilise d’abord ${v110GenericNeed(sid)} classeur(s). Le suivant devient automatiquement le sous-classeur Master.</p><button id="v110BuyMaster" class="primary">Acheter un classeur supplémentaire</button></div>`;g.querySelector('#v110BuyMaster').onclick=()=>v090BuyBinder(sid);if(prev)prev.disabled=true;if(next)next.disabled=true;return}
 let page=clamp(v110MasterPage(sid),0,Math.max(0,pages-1));v110SetMasterPage(sid,page);$('#binderMetaName').textContent=`Master Set · ${prog.filled}/${prog.total}`;$('#binderMetaCount').textContent=`${cap} emplacements · Normal / Holo / Reverse réellement existantes`;$('#pageNum').textContent=page+1;$('#pageTotal').textContent=pages;if(prev)prev.disabled=page<=0;if(next)next.disabled=page>=pages-1;g.innerHTML='';const index=v110MasterIndex(sid),start=page*9;
 for(let i=0;i<9;i++){const n=start+i,e=document.createElement('div');e.className='pocket v110-master-pocket';if(n<slots.length&&n<cap){const s=slots[n],ins=index.get(n);e.dataset.variant=s.variant;if(ins){const im=new Image();im.loading='lazy';im.decoding='async';im.src=cardImg(s.c,'low');im.alt=s.c.name;im.onclick=()=>openCardModal(s.c,ins);e.appendChild(im)}else e.classList.add('empty','unknown');e.insertAdjacentHTML('beforeend',`<span class="pocket-number">#${escapeHtml(s.localId)} · ${s.variant==='reverse'?'REVERSE':s.variant==='holo'?'HOLO':'NORMAL'}</span>`)}else{e.classList.add('empty','spare');e.innerHTML='<span>LIBRE</span>'}g.appendChild(e)}v110CheckMasterReward(sid)
}

/* Generic rendering and its animation stay untouched. */
const v110RenderBinderBase=renderBinder;
renderBinder=function(){const sid=state.activeSet;if(v110View(sid)!=='master'){const r=v110RenderBinderBase();v110DecorateGeneric(sid);return r}v110ReconcileMaster(sid);v110RenderMasterBinder();requestAnimationFrame(()=>{try{v08BindBinderGestures()}catch{}})};

const v110CanTurnBase=v08BinderCanTurn;
v08BinderCanTurn=function(dir){if(v110View(state.activeSet)!=='master')return v110CanTurnBase(dir);const p=v110MasterPage(state.activeSet),max=Math.max(0,v110MasterPages(state.activeSet)-1);return v110MasterCount(state.activeSet)>0&&(dir>0?p<max:p>0)};
const v110TurnBase=v08TurnBinder;
v08TurnBinder=function(dir,startAngle=0){
 if(v110View(state.activeSet)!=='master')return v110TurnBase(dir,startAngle);
 if(v08BinderBusy||!v08BinderCanTurn(dir))return;const page=$('#binderShell .binder-page');if(!page)return;v08BinderBusy=true;const sheet=v08CreateTurnSheet(page,dir,startAngle);try{v093PrepareTurnSheet?.(sheet);v093ResetLivePage?.(page)}catch{}const sid=state.activeSet,next=clamp(v110MasterPage(sid)+dir,0,Math.max(0,v110MasterPages(sid)-1));v110SetMasterPage(sid,next);const end=dir>0?-178:178,duration=(typeof v088BatteryOn==='function'&&v088BatteryOn())?180:330;let done=false,rendered=false;
 const renderNext=()=>{if(rendered)return;rendered=true;v110RenderMasterBinder();try{v093ResetLivePage?.($('#binderShell .binder-page'))}catch{}};
 const clean=()=>{if(done)return;done=true;renderNext();try{sheet.remove()}catch{}v08BinderBusy=false;v08BinderDrag=null;try{v08BindBinderGestures()}catch{}};
 try{const anim=sheet.animate([{transform:`rotateY(${startAngle}deg)`},{transform:`rotateY(${end}deg)`}],{duration,easing:'cubic-bezier(.22,.72,.16,1)',fill:'forwards'});requestAnimationFrame(()=>requestAnimationFrame(renderNext));anim.onfinish=clean;anim.oncancel=clean;setTimeout(clean,duration+220)}catch(e){console.warn('V1.1 master page turn',e);clean()}
};

const v110MasterStyle=document.createElement('style');v110MasterStyle.textContent=`
.v110-binder-tabs{display:flex;gap:8px;margin:10px 0 12px}.v110-binder-tabs button{flex:1;border:1px solid #2b3849;background:#111923;color:#aeb9c8;border-radius:12px;padding:10px 8px;font-weight:850;font-size:10px}.v110-binder-tabs button.active{border-color:#e2b342;color:#ffd664;background:#241d0d}.v110-binder-tabs small{display:block;font-size:8px;margin-top:3px;opacity:.8}.v110-master-pocket[data-variant="reverse"]{box-shadow:inset 0 0 0 1px rgba(129,213,255,.25)}.v110-master-pocket[data-variant="holo"]{box-shadow:inset 0 0 0 1px rgba(255,220,130,.28)}
`;document.head.appendChild(v110MasterStyle);
if($('#binder')?.classList.contains('active'))renderBinder();window.__voxV110MasterReady=true;
