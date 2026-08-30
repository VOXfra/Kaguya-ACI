'use strict';
/* VOX Card Sim V1.2.16 — reveal remake + Collection/Master Set remake.
   - Collection binder = numbered/official checklist only.
   - Master binder = documented holo/reverse variants + secret/rare cards beyond the official checklist.
   - High-rarity pulls get cinematic reveal effects and synthesized SFX.
*/
const V136_VERSION='1.2.16-reveal-master-remake';
const V136_MODES=['realistic','ludic','creative'];
const V136_MASTER_REWARD_EUR=10000;
const V136_MASTER_REWARD_XP=100;
const V136_MASTER_REWARD_PACKS=5;
const V136_SLOT_CACHE=new Map();
let V136_AUDIO=null,V136_MASTER_REWARD_BUSY=false;

/* ---------- CHECKLISTS ---------- */
function v136OfficialCount(setId){
 const cfg=SETS?.[setId]||{},live=state?.sets?.[setId]||{},cards=cardsFor(setId)||[];
 const fromCard=cards.map(c=>Number(c?.set?.cardCount?.official||c?.set?.official||0)).find(n=>n>0);
 const n=[cfg.official,cfg.officialTotal,cfg.printedTotal,live?.cardCount?.official,live?.official,fromCard,cfg.total]
  .map(Number).find(x=>Number.isFinite(x)&&x>0);
 return Math.max(1,Math.floor(n||cards.length||1));
}
function v136NormalSlots(setId){
 const cards=cardsFor(setId)||[],official=v136OfficialCount(setId),cached=V136_SLOT_CACHE.get('N:'+setId);
 if(cached&&cached.ref===cards&&cached.len===cards.length&&cached.official===official)return cached.slots;
 const slots=cards.filter(c=>{const n=cardNo(c);return n>0&&n<=official}).sort((a,b)=>cardNo(a)-cardNo(b));
 V136_SLOT_CACHE.set('N:'+setId,{ref:cards,len:cards.length,official,slots});return slots;
}
const v136LegacyVariantsFor=typeof v110VariantsFor==='function'?v110VariantsFor:null;
function v136RawVariants(c){
 const out=new Set();
 try{
  const v=typeof v116Variants==='function'?v116Variants(c):c?.variants;
  if(Array.isArray(v))for(const x of v)out.add(String(x).toLowerCase());
  else if(v&&typeof v==='object')for(const [k,val] of Object.entries(v))if(val)out.add(String(k).toLowerCase());
 }catch{}
 return out;
}
function v136DocumentedVariants(setId,c){
 const out=new Set();
 try{for(const v of (v136LegacyVariantsFor?.(setId,c)||[]))out.add(String(v).toLowerCase())}catch{}
 for(const v of v136RawVariants(c)){
  if(v==='normal'||v==='holo'||v==='reverse'||v==='reverseholo'||v==='reverse-holo')out.add(v.startsWith('reverse')?'reverse':v);
 }
 return [...out].filter(v=>['normal','holo','reverse'].includes(v));
}
function v136Rarity(setId,c){try{return String(rarityFor(setId,cardNo(c))||c?.rarityKey||c?.rarity||'unknown').toLowerCase()}catch{return'unknown'}}
function v136PremiumRarity(r){
 return ['double','ir','ur','sir','hr','mhr','rare holo','rare holo ex','rare holo gx','rare holo v','rare holo vmax','rare holo vstar',
  'jp_rare','jp_rr','jp_rrr','jp_sr','jp_hr','jp_ur'].includes(String(r||'').toLowerCase());
}
function v136PreferredVariant(setId,c){
 const vars=v136DocumentedVariants(setId,c),r=v136Rarity(setId,c);
 if(vars.includes('holo'))return'holo';
 if(vars.includes('reverse')&&!vars.includes('normal'))return'reverse';
 return v136PremiumRarity(r)||['rare','double','ir','ur','sir','hr','mhr'].includes(r)?'holo':'normal';
}
function v136MasterSlots(setId){
 const cards=cardsFor(setId)||[],official=v136OfficialCount(setId),cached=V136_SLOT_CACHE.get('M:'+setId);
 if(cached&&cached.ref===cards&&cached.len===cards.length&&cached.official===official)return cached.slots;
 const slots=[],seen=new Set(),push=(c,variant,kind)=>{
  const key=`${c.id}|${variant}`;if(seen.has(key))return;seen.add(key);
  slots.push({cardId:c.id,localId:String(c.localId||cardNo(c)).padStart(3,'0'),variant,c,kind,rarity:v136Rarity(setId,c)});
 };
 for(const c of [...cards].sort((a,b)=>cardNo(a)-cardNo(b))){
  const n=cardNo(c),vars=v136DocumentedVariants(setId,c);
  if(n>0&&n<=official){
   /* The regular binder already owns the normal checklist. Master adds only real foil variants. */
   if(vars.includes('holo'))push(c,'holo','foil');
   if(vars.includes('reverse'))push(c,'reverse','foil');
  }else if(n>official){
   /* Secret/illustration/ultra cards are unique checklist entries, not duplicates of Collection. */
   const nonNormal=vars.filter(v=>v!=='normal');
   if(nonNormal.length){for(const v of nonNormal)push(c,v,'secret')}
   else push(c,v136PreferredVariant(setId,c),'secret');
  }
 }
 V136_SLOT_CACHE.set('M:'+setId,{ref:cards,len:cards.length,official,slots});return slots;
}
function v136MasterSupported(setId){return v136MasterSlots(setId).length>0}
function v136GenericNeed(setId){const s=v090BinderSpec?.(setId),n=v136NormalSlots(setId).length;return s&&n?Math.max(1,Math.ceil(n/s.capacity)):1}
function v136MasterNeed(setId){const s=v090BinderSpec?.(setId),n=v136MasterSlots(setId).length;return s&&n?Math.max(1,Math.ceil(n/s.capacity)):0}

/* Replace V1.1's old "normal+holo+reverse copy of everything" checklist. */
try{v110MasterSlots=v136MasterSlots}catch{}
try{v110MasterSupported=v136MasterSupported}catch{}
try{v110GenericNeed=v136GenericNeed}catch{}
try{v110MasterNeed=v136MasterNeed}catch{}
try{
 v110MasterPages=function(setId){const n=v136MasterSlots(setId).length,cap=v110MasterCapacity(setId);return cap>0?Math.ceil(Math.min(n,cap)/9):0};
}catch{}

/* ---------- PHYSICAL PLACEMENT ---------- */
function v136InstanceVariant(ins,c,setId){
 if(ins?.variant==='reverse')return'reverse';
 if(ins?.variant==='holo'||ins?.foil===true)return'holo';
 const vars=v136DocumentedVariants(setId,c),r=v136Rarity(setId,c);
 if(vars.includes('holo')&&!vars.includes('normal'))return'holo';
 if(v136PremiumRarity(r)||['rare','double','ir','ur','sir','hr','mhr'].includes(r))return'holo';
 return'normal';
}
function v136ReconcileSet(setId){
 if(!SETS?.[setId])return;
 const normal=v136NormalSlots(setId),master=v136MasterSlots(setId);
 const normalCap=(typeof v090BinderCapacity==='function'?v090BinderCapacity(setId):0)||0;
 const masterCap=(typeof v110MasterCapacity==='function'?v110MasterCapacity(setId):0)||0;
 const groups=new Map(),used=new Set(),all=state.instances||[];
 for(const ins of all){
  if(ins?.setId!==setId||ins.status!=='owned'||ins.isEnergy||ins.graded||!ins.cardId)continue;
  if(!groups.has(ins.cardId))groups.set(ins.cardId,[]);
  groups.get(ins.cardId).push(ins);
  if(ins.location==='binder'||ins.location==='master-binder'){ins.location='inventory';ins.binderSlot=null;ins.masterSlot=null}
 }
 const age=x=>Number(x.openedAt||x.acquiredAt||0);
 for(const arr of groups.values())arr.sort((a,b)=>age(a)-age(b));
 for(let i=0;i<normal.length&&i<normalCap;i++){
  const c=normal[i],arr=groups.get(c.id)||[];
  /* Prefer a plain copy for Collection so a real foil remains available for Master. */
  let pick=arr.find(x=>!used.has(x.id)&&v136InstanceVariant(x,c,setId)==='normal');
  if(!pick)pick=arr.find(x=>!used.has(x.id));
  if(!pick)continue;pick.location='binder';pick.binderSlot=i;pick.masterSlot=null;used.add(pick.id);
 }
 for(let i=0;i<master.length&&i<masterCap;i++){
  const s=master[i],arr=groups.get(s.cardId)||[];
  const pick=arr.find(x=>!used.has(x.id)&&v136InstanceVariant(x,s.c,setId)===s.variant);
  if(!pick)continue;pick.location='master-binder';pick.masterSlot=i;pick.binderSlot=null;used.add(pick.id);
 }
 try{v090SyncBinderOwned?.(setId)}catch{}
 try{v110InvalidateMaster?.(setId)}catch{}
 try{v081RebuildInstanceIndexes?.()}catch{}
}
reconcileBinder=v136ReconcileSet;
try{v110ReconcileMaster=v136ReconcileSet;window.v110ReconcileMaster=v136ReconcileSet}catch{}

/* ---------- PROGRESS / COMPLETION ---------- */
function v136DiscoveredNormal(setId){
 const wanted=new Set(v136NormalSlots(setId).map(c=>c.id)),prefix=setId+'|';let n=0;
 for(const key of Object.keys(state.discoveredCards||{}))if(key.startsWith(prefix)&&wanted.has(key.slice(prefix.length)))n++;
 return n;
}
function v136NormalComplete(setId){const total=v136NormalSlots(setId).length;return total>0&&v136DiscoveredNormal(setId)>=total}
function v136PhysicalProgress(setId,view){
 const slots=view==='master'?v136MasterSlots(setId):v136NormalSlots(setId),loc=view==='master'?'master-binder':'binder',field=view==='master'?'masterSlot':'binderSlot';
 const map=new Map();for(const ins of state.instances||[])if(ins?.setId===setId&&ins.status==='owned'&&ins.location===loc&&Number.isInteger(ins[field]))map.set(ins[field],ins);
 let filled=0;for(let i=0;i<slots.length;i++)if(map.has(i))filled++;
 return{filled,total:slots.length,map};
}
try{
 v090CompletionCount=v136DiscoveredNormal;
 v090SetComplete=v136NormalComplete;
}catch{}
try{
 v08SetDiscoveryCount=v136DiscoveredNormal;
 v08RewardCheck=function(setId){
  if(v08Mode()!=='ludic')return;
  const total=v08DiscoveryCount(),milestone=Math.floor(total/20);
  if(milestone>(state.ludicRewards.twentyMilestone||0)){
   const diff=milestone-(state.ludicRewards.twentyMilestone||0),gain=diff*100;
   state.wallet+=gain;state.ludicRewards.totalBonus=(state.ludicRewards.totalBonus||0)+gain;state.ludicRewards.twentyMilestone=milestone;
   setTimeout(()=>toast(`Progression : +${money(gain)} · ${milestone*20} cartes découvertes`),320);
  }
  const target=v136NormalSlots(setId).length;
  if(target&&v136DiscoveredNormal(setId)>=target&&!state.ludicRewards.completedSets[setId]){
   state.ludicRewards.completedSets[setId]=Date.now();state.wallet+=1000;state.ludicRewards.totalBonus=(state.ludicRewards.totalBonus||0)+1000;
   setTimeout(()=>toast(`Collection ${setName(setId)} complète : +1 000 € · Master Set débloqué`),650);
  }
 };
}catch{}

/* New reward namespace: players who finished the old duplicate master can still earn the remade one once. */
state.v136MasterRewards=state.v136MasterRewards&&typeof state.v136MasterRewards==='object'?state.v136MasterRewards:{};
try{
 const v136SerializableBase=v08Serializable;
 v08Serializable=function(){const d=v136SerializableBase();d.v136MasterRewards=state.v136MasterRewards;d.version=Math.max(136,Number(d.version)||0);d.schemaVersion=Math.max(136,Number(d.schemaVersion)||0);return d};
 const v136FreshBase=v08FreshSave;
 v08FreshSave=function(mode){const d=v136FreshBase(mode);d.v136MasterRewards={};d.version=Math.max(136,Number(d.version)||0);d.schemaVersion=Math.max(136,Number(d.schemaVersion)||0);return d};
}catch{}

function v136MasterComplete(setId){
 const p=v136PhysicalProgress(setId,'master'),cap=typeof v110MasterCapacity==='function'?v110MasterCapacity(setId):0;
 return p.total>0&&cap>=p.total&&p.filled>=p.total&&v136NormalComplete(setId);
}
function v136GiveMasterBoosters(n){
 const names=[];for(let i=0;i<n;i++){try{const sid=v110GiveRandomBooster?.('v136-master-complete');if(sid)names.push(setName(sid))}catch{}}
 return names;
}
function v136CheckMasterReward(setId){
 if(V136_MASTER_REWARD_BUSY||state.v136MasterRewards?.[setId]||!v136MasterComplete(setId))return false;
 V136_MASTER_REWARD_BUSY=true;
 try{
  state.v136MasterRewards[setId]=Date.now();
  try{v110AddXp?.(V136_MASTER_REWARD_XP,'Master Set complété',false)}catch{}
  if(v08Mode()!=='creative')state.wallet+=V136_MASTER_REWARD_EUR;
  v136GiveMasterBoosters(V136_MASTER_REWARD_PACKS);
  try{v122Checkpoint?.('master-set-complete')}catch{try{save()}catch{}}
  v136MasterFanfare(setId);
  setTimeout(()=>toast(`MASTER SET ${setName(setId)} · +${V136_MASTER_REWARD_XP} XP${v08Mode()==='creative'?'':` · +${money(V136_MASTER_REWARD_EUR)}`} · ${V136_MASTER_REWARD_PACKS} boosters`),350);
  setTimeout(()=>{V136_MASTER_REWARD_BUSY=false},1800);return true;
 }catch(e){V136_MASTER_REWARD_BUSY=false;console.warn('V1.2.16 master reward',e);return false}
}
try{v110CheckMasterReward=v136CheckMasterReward;window.v110CheckMasterReward=v136CheckMasterReward}catch{}

/* ---------- BINDER UI ---------- */
function v136View(setId){return state.masterBinderView?.[setId]==='master'&&v136MasterSupported(setId)?'master':'generic'}
function v136SetView(setId,view){state.masterBinderView??={};state.masterBinderView[setId]=view==='master'?'master':'generic'}
function v136GenericPage(setId){return Math.max(0,Number(state.pageBySet?.[setId])||0)}
function v136SetGenericPage(setId,p){state.pageBySet??={};state.pageBySet[setId]=Math.max(0,Number(p)||0)}
function v136MasterPage(setId){return Math.max(0,Number(state.masterPageBySet?.[setId])||0)}
function v136SetMasterPage(setId,p){state.masterPageBySet??={};state.masterPageBySet[setId]=Math.max(0,Number(p)||0)}
function v136CollectionPages(setId){const cap=typeof v090BinderCapacity==='function'?v090BinderCapacity(setId):0;return cap>0?Math.ceil(Math.min(v136NormalSlots(setId).length,cap)/9):0}
function v136MasterPages(setId){const cap=typeof v110MasterCapacity==='function'?v110MasterCapacity(setId):0;return cap>0?Math.ceil(Math.min(v136MasterSlots(setId).length,cap)/9):0}
function v136VariantLabel(v){return v==='reverse'?'REVERSE':v==='holo'?'HOLO':'RARE+'}
function v136EnsureTabs(){
 const shell=$('#binderShell');if(!shell)return null;let box=$('#v136BinderTabs');
 if(!box){document.querySelector('#v110BinderTabs')?.remove();box=document.createElement('div');box.id='v136BinderTabs';box.className='v136-binder-tabs';shell.parentNode.insertBefore(box,shell)}
 return box;
}
function v136RenderTabs(setId){
 const box=v136EnsureTabs();if(!box)return;const view=v136View(setId),np=v136PhysicalProgress(setId,'generic'),mp=v136PhysicalProgress(setId,'master');
 box.innerHTML=`<button class="${view==='generic'?'active':''}" data-v136-view="generic"><b>COLLECTION</b><span>${np.filled}/${np.total} · cartes numérotées</span></button>
 <button class="${view==='master'?'active master':''}" data-v136-view="master" ${v136MasterSupported(setId)?'':'disabled'}><b>MASTER SET</b><span>${v136MasterSupported(setId)?`${mp.filled}/${mp.total} · holo, reverse & raretés+`:'Aucune variante documentée'}</span></button>`;
 box.querySelectorAll('[data-v136-view]').forEach(b=>b.onclick=()=>{if(b.disabled)return;v136SetView(setId,b.dataset.v136View);if(b.dataset.v136View==='master')v136SetMasterPage(setId,0);try{save()}catch{};renderBinder()});
}
function v136Toolbar(setId,view){
 const bar=v090EnsureBinderToolbar?.();if(!bar)return;const total=Number(v090BinderCount?.(setId)||0),gn=v136GenericNeed(setId),mn=v136MasterNeed(setId),mc=Math.max(0,total-gn);
 if(view==='generic'){
  const p=v136PhysicalProgress(setId,'generic'),complete=v136NormalComplete(setId);
  bar.innerHTML=`<div><strong>Collection · ${p.filled}/${p.total}</strong><span>${v136OfficialCount(setId)} cartes officielles${complete?' · ✓ collection complète':' · les secrets/SIR ne sont pas requis'}</span></div>${total<gn?'<button id="v136BuyBinder" class="primary small">Acheter le classeur</button>':''}`;
 }else{
  const p=v136PhysicalProgress(setId,'master'),rewarded=!!state.v136MasterRewards?.[setId];
  bar.innerHTML=`<div><strong>Master Set · ${p.filled}/${p.total}</strong><span>Holo/reverse réellement existantes + cartes secrètes · ${mc}/${mn} classeur Master</span><em>${rewarded?'✓ Récompense obtenue':`Récompense : ${money(V136_MASTER_REWARD_EUR)} + ${V136_MASTER_REWARD_XP} XP + ${V136_MASTER_REWARD_PACKS} boosters`}</em></div>${mc<mn?'<button id="v136BuyBinder" class="primary small">Acheter le classeur Master</button>':''}`;
 }
 const buy=bar.querySelector('#v136BuyBinder');if(buy)buy.onclick=()=>v090BuyBinder(setId);
}
function v136Locked(grid,title,text,button){
 grid.innerHTML=`<div class="binder-locked v136-locked"><div>✦</div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p><button id="v136LockedBuy" class="primary">${escapeHtml(button)}</button></div>`;
 grid.querySelector('#v136LockedBuy').onclick=()=>v090BuyBinder(state.activeSet);
}
function v136RenderPockets(setId,view,page){
 const slots=view==='master'?v136MasterSlots(setId):v136NormalSlots(setId),prog=v136PhysicalProgress(setId,view),grid=$('#pocketGrid'),start=page*9;
 grid.innerHTML='';
 for(let i=0;i<9;i++){
  const idx=start+i,e=document.createElement('div');e.className='pocket v136-pocket';
  if(idx<slots.length){
   const s=slots[idx],c=view==='master'?s.c:s,ins=prog.map.get(idx);
   if(view==='master'){e.dataset.variant=s.variant;e.dataset.rarity=s.rarity||''}
   if(ins){const im=new Image();im.loading='lazy';im.decoding='async';im.src=cardImg(c,'low');im.alt=c.name||'';im.onclick=()=>openCardModal(c,ins);e.appendChild(im)}
   else e.classList.add('empty','unknown');
   const label=view==='master'?`#${escapeHtml(s.localId)} · ${v136VariantLabel(s.variant)}`:`#${escapeHtml(String(c.localId||cardNo(c)).padStart(3,'0'))}`;
   e.insertAdjacentHTML('beforeend',`<span class="pocket-number">${label}</span>`);
  }else{e.classList.add('empty','spare');e.innerHTML='<span>LIBRE</span>'}
  grid.appendChild(e);
 }
}
function v136WirePageButtons(setId,view,pages,page){
 const prev=$('#prevPage'),next=$('#nextPage');if(!prev||!next)return;
 prev.disabled=page<=0;next.disabled=page>=pages-1;
 prev.onclick=()=>{if(prev.disabled)return;if(view==='master')v136SetMasterPage(setId,page-1);else v136SetGenericPage(setId,page-1);renderBinder()};
 next.onclick=()=>{if(next.disabled)return;if(view==='master')v136SetMasterPage(setId,page+1);else v136SetGenericPage(setId,page+1);renderBinder()};
}
function v136RenderCollection(setId){
 const cfg=SETS[setId],count=Number(v090BinderCount?.(setId)||0),need=v136GenericNeed(setId),slots=v136NormalSlots(setId),grid=$('#pocketGrid');
 v136RenderTabs(setId);v136Toolbar(setId,'generic');$('#binderTitle').textContent=`${cfg.name} — Collection`;
 if(count<need){
  $('#binderMetaName').textContent='Classeur Collection';$('#binderMetaCount').textContent=`${slots.length} cartes officielles`;$('#pageNum').textContent='—';$('#pageTotal').textContent='—';
  v136Locked(grid,'Collection','Un exemplaire de chaque carte numérotée. Les cartes secrètes et SIR ne bloquent plus la complétion.','Acheter le classeur');
  v136WirePageButtons(setId,'generic',0,0);return;
 }
 const pages=Math.max(1,v136CollectionPages(setId)),page=clamp(v136GenericPage(setId),0,pages-1);v136SetGenericPage(setId,page);
 const p=v136PhysicalProgress(setId,'generic');$('#binderMetaName').textContent=`Collection · ${p.filled}/${p.total}`;$('#binderMetaCount').textContent='Checklist officielle · 1 exemplaire par carte';$('#pageNum').textContent=page+1;$('#pageTotal').textContent=pages;
 v136RenderPockets(setId,'generic',page);v136WirePageButtons(setId,'generic',pages,page);
}
function v136RenderMaster(setId){
 const cfg=SETS[setId],slots=v136MasterSlots(setId),count=Number(v090BinderCount?.(setId)||0),gn=v136GenericNeed(setId),mn=v136MasterNeed(setId),mc=Math.max(0,count-gn),grid=$('#pocketGrid');
 v136RenderTabs(setId);v136Toolbar(setId,'master');$('#binderTitle').textContent=`${cfg.name} — Master Set`;
 if(mc<mn){
  $('#binderMetaName').textContent='Master Set verrouillé';$('#binderMetaCount').textContent=`${slots.length} emplacements premium documentés`;$('#pageNum').textContent='—';$('#pageTotal').textContent='—';
  v136Locked(grid,'Master Set','Deuxième classeur : holo/reverse lorsqu’elles existent, puis Illustration Rare, Ultra Rare, SIR, Hyper Rare et cartes secrètes.','Acheter le classeur Master');
  v136WirePageButtons(setId,'master',0,0);return;
 }
 const pages=Math.max(1,v136MasterPages(setId)),page=clamp(v136MasterPage(setId),0,pages-1);v136SetMasterPage(setId,page);
 const p=v136PhysicalProgress(setId,'master');$('#binderMetaName').textContent=`Master Set · ${p.filled}/${p.total}`;$('#binderMetaCount').textContent='Foils documentées + raretés au-dessus de la collection';$('#pageNum').textContent=page+1;$('#pageTotal').textContent=pages;
 v136RenderPockets(setId,'master',page);v136WirePageButtons(setId,'master',pages,page);v136CheckMasterReward(setId);
}
function v136RenderBinder(){
 const sid=state.activeSet,cfg=SETS?.[sid];if(!cfg)return;
 try{
  if(typeof v117NeedsHydration==='function'&&v117NeedsHydration(sid)){
   const g=$('#pocketGrid');if(g)g.innerHTML='<div class="binder-locked"><div>↻</div><strong>Chargement de la collection…</strong></div>';
   v117EnsureSet(sid).then(()=>{V136_SLOT_CACHE.delete('N:'+sid);V136_SLOT_CACHE.delete('M:'+sid);renderBinder()}).catch(e=>console.warn('V1.2.16 binder hydration',e));return;
  }
 }catch{}
 v136ReconcileSet(sid);
 if(v136View(sid)==='master')v136RenderMaster(sid);else v136RenderCollection(sid);
 requestAnimationFrame(()=>{try{v08BindBinderGestures?.()}catch{}});
}
renderBinder=v136RenderBinder;
try{v110RenderMasterBinder=()=>v136RenderMaster(state.activeSet)}catch{}
try{
 v08BinderCanTurn=function(dir){
  const sid=state.activeSet,master=v136View(sid)==='master',p=master?v136MasterPage(sid):v136GenericPage(sid),max=Math.max(0,(master?v136MasterPages(sid):v136CollectionPages(sid))-1);
  return dir>0?p<max:p>0;
 };
}catch{}

/* ---------- AUDIO ---------- */
function v136AudioEnabled(){return state?.settings?.sfxEnabled!==false}
function v136WowEnabled(){return state?.settings?.wowAnimations!==false&&!matchMedia?.('(prefers-reduced-motion: reduce)')?.matches}
function v136Audio(){
 if(!v136AudioEnabled())return null;
 try{
  if(!V136_AUDIO){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;V136_AUDIO=new C()}
  if(V136_AUDIO.state==='suspended')V136_AUDIO.resume().catch(()=>{});
  return V136_AUDIO;
 }catch{return null}
}
function v136Tone(freq,dur=.08,gain=.035,type='sine',delay=0,to=null){
 const a=v136Audio();if(!a)return;const t=a.currentTime+delay,o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(to)o.frequency.exponentialRampToValueAtTime(Math.max(20,to),t+dur);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(a.destination);o.start(t);o.stop(t+dur+.03);
}
function v136Noise(dur=.12,gain=.018,delay=0){
 const a=v136Audio();if(!a)return;const len=Math.max(1,Math.floor(a.sampleRate*dur)),b=a.createBuffer(1,len,a.sampleRate),d=b.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
 const s=a.createBufferSource(),g=a.createGain(),t=a.currentTime+delay;s.buffer=b;g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.connect(g).connect(a.destination);s.start(t);
}
function v136Sfx(kind){
 if(!v136AudioEnabled())return;
 if(kind==='tear'){v136Noise(.18,.025);v136Tone(120,.16,.022,'sawtooth',0,65);return}
 if(kind==='card'){v136Tone(520,.045,.018,'sine');return}
 if(kind==='holo'){v136Tone(660,.12,.024,'sine');v136Tone(990,.18,.018,'sine',.07);return}
 if(kind==='ir'){v136Tone(190,.18,.034,'triangle',0,95);v136Tone(660,.18,.025,'sine',.08);v136Tone(880,.24,.02,'sine',.16);return}
 if(kind==='ultra'){v136Noise(.09,.025);v136Tone(110,.25,.045,'sine',0,55);v136Tone(740,.20,.028,'triangle',.08);v136Tone(1110,.30,.02,'sine',.17);return}
 if(kind==='sir'){v136Noise(.16,.035);v136Tone(84,.42,.06,'sine',0,42);[440,554,659,880,1108].forEach((f,i)=>v136Tone(f,.22,.03,'sine',.10+i*.085));v136Tone(1320,.55,.018,'sine',.46,1760);return}
 if(kind==='master'){v136Tone(110,.35,.05,'sine',0,55);[523,659,784,1047,1319].forEach((f,i)=>v136Tone(f,.32,.032,'triangle',.12+i*.11));v136Noise(.18,.022,.50)}
}
document.addEventListener('pointerdown',()=>v136Audio(),{capture:true,once:true,passive:true});

/* ---------- CINEMATIC REVEALS ---------- */
function v136Tier(c){
 if(!c||c.kind==='energy')return'card';const r=v136Rarity(c.setId||state.currentOpening?.setId,c);
 if(['sir','hr','mhr','jp_hr','jp_ur'].includes(r))return'sir';
 if(['ur','jp_sr'].includes(r))return'ultra';
 if(['ir','double','jp_rr','jp_rrr'].includes(r))return'ir';
 if(r==='rare'||String(c.variant||'').toLowerCase()==='holo'||c.foil)return'holo';
 return'card';
}
function v136Burst(tier,c){
 if(!v136WowEnabled()||tier==='card')return;
 document.querySelector('.v136-celebration')?.remove();
 const e=document.createElement('div');e.className=`v136-celebration ${tier}`;
 const label=tier==='sir'?'SIR / HIT MAJEUR':tier==='ultra'?'ULTRA RARE':tier==='ir'?'RARE PULL':'HOLOGRAPHIQUE';
 e.innerHTML=`<div class="v136-rays"></div><div class="v136-hit-label">${label}<small>${escapeHtml(c?.name||'')}</small></div><div class="v136-particles"></div>`;
 const p=e.querySelector('.v136-particles'),count=tier==='sir'?34:tier==='ultra'?24:14;
 for(let i=0;i<count;i++){const s=document.createElement('i'),a=(Math.PI*2*i/count)+(Math.random()-.5)*.3,r=90+Math.random()*(tier==='sir'?260:170);s.style.setProperty('--x',`${Math.cos(a)*r}px`);s.style.setProperty('--y',`${Math.sin(a)*r}px`);s.style.setProperty('--d',`${Math.random()*.28}s`);p.appendChild(s)}
 document.body.appendChild(e);setTimeout(()=>e.classList.add('show'),10);setTimeout(()=>e.remove(),tier==='sir'?1800:1200);
}
function v136CelebrateTop(top){
 const o=state.currentOpening,c=o?.cards?.[o.reveal];if(!top||!c||top.dataset.v136Seen==='1')return;
 top.dataset.v136Seen='1';const tier=v136Tier(c);top.dataset.v136Tier=tier;top.classList.add('v136-'+tier);
 if(tier==='card'){v136Sfx('card');return}
 v136Burst(tier,c);v136Sfx(tier);try{vibrate(tier==='sir'?[24,35,35,45,55]:tier==='ultra'?[18,25,28]:[12,18,18])}catch{}
 const lock=tier==='sir'?950:tier==='ultra'?560:tier==='ir'?360:180;
 top.dataset.v136LockUntil=String(performance.now()+lock);
}
const v136MakeCardBase=makeCardElement;
makeCardElement=function(c,depth){const el=v136MakeCardBase(c,depth);try{const tier=v136Tier(c);el.dataset.v136Tier=tier;el.classList.add('v136-'+tier)}catch{}return el};
const v136SetupSwipeBase=setupTopSwipe;
setupTopSwipe=function(){
 const r=v136SetupSwipeBase();const top=$('#cardStack .stable-card[data-depth="0"]');if(!top)return r;v136CelebrateTop(top);
 if(top.dataset.v136Guard!=='1'){top.dataset.v136Guard='1';const down=top.onpointerdown;top.onpointerdown=function(e){if(performance.now()<Number(top.dataset.v136LockUntil||0)){e.preventDefault();e.stopPropagation();return}return down?.call(this,e)}}
 return r;
};
try{
 const v136TearBase=tearPack;
 tearPack=async function(){v136Sfx('tear');return v136TearBase.apply(this,arguments)};
}catch{}

/* Full-screen master completion treatment. */
function v136MasterFanfare(setId){
 v136Sfx('master');try{vibrate([35,35,55,40,80])}catch{}
 if(!v136WowEnabled())return;document.querySelector('.v136-master-complete')?.remove();const e=document.createElement('div');e.className='v136-master-complete';
 e.innerHTML=`<div class="v136-master-crown">✦</div><span>MASTER SET COMPLET</span><h2>${escapeHtml(setName(setId))}</h2><strong>+${money(V136_MASTER_REWARD_EUR)} · +${V136_MASTER_REWARD_XP} XP · ${V136_MASTER_REWARD_PACKS} BOOSTERS</strong>`;
 document.body.appendChild(e);requestAnimationFrame(()=>e.classList.add('show'));setTimeout(()=>e.remove(),2800);
}

/* ---------- SETTINGS ---------- */
function v136RenderEffectsSettings(){
 const card=$('#settingsModal .modal-card');if(!card)return;$('#v136EffectsSettings')?.remove();const box=document.createElement('div');box.id='v136EffectsSettings';box.className='v136-effects panel';
 box.innerHTML=`<div><strong>Ouvertures cinématiques</strong><small>Effets WOW pour holo, IR, Ultra Rare, SIR et raretés supérieures.</small></div>
 <label class="switch"><input id="v136WowToggle" type="checkbox" ${state.settings?.wowAnimations!==false?'checked':''}><span></span></label>
 <div><strong>Effets sonores</strong><small>Impacts, scintillements, ouverture du booster et fanfare Master Set.</small></div>
 <label class="switch"><input id="v136SfxToggle" type="checkbox" ${v136AudioEnabled()?'checked':''}><span></span></label>`;
 const anchor=$('#v122SaveSettings')||$('#v131SavePanel')||$('#v134CloudPanel');anchor?card.insertBefore(box,anchor):card.appendChild(box);
 $('#v136WowToggle').onchange=e=>{state.settings??={};state.settings.wowAnimations=!!e.target.checked;save()};
 $('#v136SfxToggle').onchange=e=>{state.settings??={};state.settings.sfxEnabled=!!e.target.checked;if(e.target.checked)v136Audio();save()};
}
try{
 const v136SettingsBase=renderSettings;renderSettings=function(){const r=v136SettingsBase();v136RenderEffectsSettings();return r};
}catch{}

/* ---------- STYLE ---------- */
(function(){
 if($('#v136Style'))return;const s=document.createElement('style');s.id='v136Style';s.textContent=`
.v136-binder-tabs{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:12px 0}
.v136-binder-tabs button{min-height:64px;border:1px solid #2a3749;border-radius:14px;background:#101722;color:#eef3f9;text-align:left;padding:11px 13px}
.v136-binder-tabs button b,.v136-binder-tabs button span{display:block}.v136-binder-tabs button b{font-size:12px;letter-spacing:.8px}.v136-binder-tabs button span{font-size:10px;color:#8d9aae;margin-top:5px}
.v136-binder-tabs button.active{border-color:#e8b83f;background:linear-gradient(145deg,#221d11,#151c29);box-shadow:0 0 0 1px #e8b83f44 inset}
.v136-binder-tabs button.master.active{box-shadow:0 0 24px #e8b83f22,0 0 0 1px #e8b83f44 inset}
.v090-binder-toolbar em{display:block;font-style:normal;color:#f1bd43;font-size:10px;margin-top:5px}.v136-pocket[data-variant="holo"]{box-shadow:inset 0 0 0 1px #ffd97966,0 0 15px #ffe8a015}.v136-pocket[data-variant="reverse"]{box-shadow:inset 0 0 0 1px #8fdfff66,0 0 15px #7ee8ff15}
.v136-effects{display:grid;grid-template-columns:1fr auto;gap:14px 12px;align-items:center;margin-top:16px}.v136-effects strong,.v136-effects small{display:block}.v136-effects small{margin-top:4px;color:#8d99ab;line-height:1.35}
.reveal-card[data-depth="0"].v136-holo{animation:v136CardIn .42s cubic-bezier(.2,.8,.2,1);box-shadow:0 0 30px #d8f6ff33}
.reveal-card[data-depth="0"].v136-ir{animation:v136CardIn .52s cubic-bezier(.12,.9,.18,1);box-shadow:0 0 42px #7ee8ff55}
.reveal-card[data-depth="0"].v136-ultra{animation:v136CardIn .65s cubic-bezier(.1,.9,.15,1);box-shadow:0 0 52px #ffd05266}
.reveal-card[data-depth="0"].v136-sir{animation:v136SirIn .95s cubic-bezier(.1,.75,.08,1);box-shadow:0 0 24px #fff,0 0 70px #f2b84f88,0 0 120px #78cfff44;z-index:30}
.reveal-card[data-depth="0"].v136-holo::after,.reveal-card[data-depth="0"].v136-ir::after,.reveal-card[data-depth="0"].v136-ultra::after,.reveal-card[data-depth="0"].v136-sir::after{content:"";position:absolute;inset:-2px;border-radius:inherit;pointer-events:none;background:linear-gradient(115deg,transparent 20%,#ffffff55 42%,#8fe8ff44 50%,#ffd26744 58%,transparent 78%);mix-blend-mode:screen;transform:translateX(-130%);animation:v136Shine 1.35s ease-out .08s}
.v136-celebration{position:fixed;inset:0;z-index:9990;pointer-events:none;overflow:hidden;background:radial-gradient(circle at 50% 47%,#ffffff00 0,#05080ddd 70%);opacity:0;transition:opacity .15s}.v136-celebration.show{opacity:1}.v136-celebration.holo{background:radial-gradient(circle,#aeeeff22,transparent 60%)}.v136-celebration.ir{background:radial-gradient(circle,#50dfff33,#05080d99 72%)}.v136-celebration.ultra{background:radial-gradient(circle,#ffd35b3d,#05080dbb 72%)}.v136-celebration.sir{background:radial-gradient(circle at 50% 46%,#fff3 0,#f6bd4a35 22%,#5dcfff18 43%,#03050add 78%)}
.v136-rays{position:absolute;width:120vmax;height:120vmax;left:50%;top:50%;transform:translate(-50%,-50%);background:repeating-conic-gradient(from 0deg,#fff0 0 8deg,#fff2 9deg 10deg,#fff0 11deg 19deg);animation:v136Spin 7s linear infinite}
.v136-hit-label{position:absolute;left:50%;top:12%;transform:translateX(-50%) translateY(-12px) scale(.92);font-size:clamp(18px,5vw,38px);font-weight:1000;letter-spacing:2.5px;color:#fff;text-shadow:0 0 18px #fff,0 0 38px #f0b942;opacity:0;animation:v136Label .6s cubic-bezier(.12,.9,.18,1) .14s forwards;text-align:center;white-space:nowrap}.v136-hit-label small{display:block;font-size:11px;letter-spacing:.5px;color:#dce7f5;margin-top:5px;text-shadow:0 2px 8px #000}
.v136-particles{position:absolute;left:50%;top:48%}.v136-particles i{position:absolute;width:5px;height:5px;border-radius:50%;background:#fff;box-shadow:0 0 9px #fff,0 0 16px #ffd65e;opacity:0;animation:v136Particle .95s ease-out var(--d) forwards}
.v136-master-complete{position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;pointer-events:none;background:radial-gradient(circle,#f8d36633 0,#07090ef5 62%);opacity:0;transform:scale(1.06);transition:.28s}.v136-master-complete.show{opacity:1;transform:scale(1)}.v136-master-crown{font-size:76px;color:#ffd459;text-shadow:0 0 30px #ffe48c;animation:v136Crown 1s ease-in-out infinite alternate}.v136-master-complete span{font-size:13px;font-weight:1000;letter-spacing:4px;color:#ffd459}.v136-master-complete h2{font-size:clamp(30px,8vw,58px);margin:10px 20px;color:#fff}.v136-master-complete strong{font-size:13px;color:#f7d978}
@keyframes v136CardIn{0%{transform:scale(.9) translateY(18px);filter:brightness(.45) saturate(.6)}65%{transform:scale(1.035) translateY(-4px);filter:brightness(1.25) saturate(1.25)}100%{transform:none;filter:none}}
@keyframes v136SirIn{0%{transform:scale(.78) translateY(24px);filter:brightness(.08) saturate(.25);opacity:.35}45%{filter:brightness(1.8) saturate(1.45);opacity:1}72%{transform:scale(1.055) translateY(-5px)}100%{transform:none;filter:none}}
@keyframes v136Shine{0%{transform:translateX(-130%)}100%{transform:translateX(130%)}}
@keyframes v136Spin{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes v136Particle{0%{opacity:0;transform:translate(0,0) scale(.2)}20%{opacity:1}100%{opacity:0;transform:translate(var(--x),var(--y)) scale(1.25)}}
@keyframes v136Label{to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
@keyframes v136Crown{from{transform:scale(.96) rotate(-4deg)}to{transform:scale(1.08) rotate(4deg)}}
@media(max-width:520px){.v136-binder-tabs{grid-template-columns:1fr}.v136-hit-label{top:10%}}
@media(prefers-reduced-motion:reduce){.v136-celebration,.v136-master-complete{display:none!important}.reveal-card[data-depth="0"]{animation:none!important}}
`;document.head.appendChild(s);
})();

try{if($('#binder')?.classList.contains('active'))renderBinder()}catch{}
window.__voxV136Ready=true;
