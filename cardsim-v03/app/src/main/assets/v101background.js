'use strict';

/* VOX Card Sim V1.0.1 — inactive-mode market continuity + Creative duplicate cleanup. */
const V101_VERSION='1.0.1';
const V101_SLOT_PREFIX='voxCardSimV08_slot_';
const V101_MODE_LABEL={realistic:'Réaliste',ludic:'Ludique',creative:'Créatif'};
const V101_MARKET_STEP=15000,V101_MAX_STEPS=240,V101_BACKGROUND_SCAN=30000,V101_RECEIPT_SCAN=60000;

function v101ReadSlot(mode){
 try{const raw=localStorage.getItem(V101_SLOT_PREFIX+mode);if(!raw)return null;const d=JSON.parse(raw);return d&&typeof d==='object'?d:null}catch(e){console.warn('V1.0.1 slot read',mode,e);return null}
}
function v101WriteSlot(mode,d){
 if(!d||typeof d!=='object')return;d.gameMode=mode;d.version=Math.max(10,Number(d.version)||0);d.schemaVersion=Math.max(10,Number(d.schemaVersion)||0);d.lastSavedAt=Date.now();
 try{localStorage.setItem(V101_SLOT_PREFIX+mode,JSON.stringify(d))}catch(e){console.warn('V1.0.1 slot write',mode,e)}
}
function v101Remaining(l){
 if(Array.isArray(l?.remainingIds))return l.remainingIds.length;if(Number.isFinite(Number(l?.remaining)))return Math.max(0,Math.floor(Number(l.remaining)));if(Number.isFinite(Number(l?.quantity)))return Math.max(0,Math.floor(Number(l.quantity)));return 0;
}
function v101ConditionPower(c){
 const m=/^PSA\s*(10|[1-9])$/i.exec(String(c||''));if(m)return({10:2.35,9:1.50,8:1.20,7:1,6:.85,5:.72,4:.60,3:.49,2:.40,1:.32})[Number(m[1])]||1;return({MT:1.09,NM:1,EX:.82,GD:.66,'Scellé':1}[c]||1);
}
function v101DemandRate(r,type){
 if(type!=='card'&&type!=='energy')return .034;return({common:.035,uncommon:.04,rare:.055,double:.07,ir:.085,ur:.09,sir:.11,hr:.12,mhr:.12,jp_common:.035,jp_uncommon:.04,jp_rare:.055,jp_rr:.07,jp_rrr:.08,jp_sr:.10,jp_hr:.115,jp_ur:.105}[r]||.06);
}
function v101PriceCap(r,type){
 if(type!=='card'&&type!=='energy')return 1.65;return({common:1.35,uncommon:1.42,rare:1.55,double:1.75,ir:2,ur:2.2,sir:2.6,hr:2.75,mhr:3,jp_common:1.35,jp_uncommon:1.42,jp_rare:1.55,jp_rr:1.75,jp_rrr:1.9,jp_sr:2.35,jp_hr:2.7,jp_ur:2.45}[r]||1.7);
}
function v101BookFor(slot,l){return slot?.marketBooks?.[l?.assetKey]||null}
function v101BetterOffers(slot,l){
 const b=v101BookFor(slot,l);if(!b||!Array.isArray(b.offers))return 0;const own=(Number(l.ask)||0)/v101ConditionPower(l.condition),now=Date.now();let n=0;
 for(const o of b.offers){if(!(Number(o.quantity)>0)||Number(o.createdAt)>now+60000)continue;const eff=Number(o.price||0)/v101ConditionPower(o.condition);if(eff>0&&eff<own)n++}return n;
}
function v101InstanceIndex(slot){const m=new Map();for(const x of slot.instances||[])if(x?.id)m.set(x.id,x);return m}
function v101ConsumeListing(slot,l,requested,byId,onlineTradeTotal=null){
 let remain=v101Remaining(l);if(remain<=0)return null;const units=Math.max(1,Math.min(Math.floor(Number(requested)||1),remain));let actual=units;
 if(l.type==='card'||l.type==='energy'){
  const ids=Array.isArray(l.remainingIds)?l.remainingIds.splice(0,units):[];actual=ids.length;
  if(!actual&&Array.isArray(l.instanceIds)){const candidates=l.instanceIds.map(id=>byId.get(id)).filter(x=>x&&x.status==='listed').slice(0,units);actual=candidates.length;for(const ins of candidates){ins.status='sold';ins.location='sold'}}
  else for(const id of ids){const ins=byId.get(id);if(ins){ins.status='sold';ins.location='sold';ins.binderSlot=null;ins.masterSlot=null}}
 }else{const cur=Number.isFinite(Number(l.remaining))?Number(l.remaining):remain;l.remaining=Math.max(0,cur-units);actual=units}
 if(actual<=0)return null;const unit=Number(l.ask||0),total=Number.isFinite(Number(onlineTradeTotal))?Number(onlineTradeTotal):unit*actual;slot.wallet=Number(slot.wallet||0)+total;slot.sales=Array.isArray(slot.sales)?slot.sales:[];
 slot.sales.push({id:`BG-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,at:Date.now(),label:l.label||'Article',units:actual,unitPrice:unit,total,type:l.type,background:true});if(slot.sales.length>4000)slot.sales.splice(0,slot.sales.length-4000);
 if(slot.sellerProfile){slot.sellerProfile.completedSales=Number(slot.sellerProfile.completedSales||0)+actual;slot.sellerProfile.revenue=Number(slot.sellerProfile.revenue||0)+total}if(v101Remaining(l)<=0){l.status='sold';l.soldAt=Date.now()}return{units:actual,total,label:l.label||'Article'};
}
function v101NotifyMode(mode,units,total,label='Ventes'){if(!(units>0))return;try{VOXNative?.notifySale?.(`${V101_MODE_LABEL[mode]||mode} · ${label}`,units,total)}catch{}}
function v101ProcessInactiveSlot(mode,notify=true){
 if(mode==='creative'||mode===v08Mode())return null;const slot=v101ReadSlot(mode);if(!slot)return null;const now=Date.now(),last=Number(slot.lastMarketTick)||now,elapsed=Math.min(Math.max(0,now-last),6*3600000),raw=Math.floor(elapsed/V101_MARKET_STEP),steps=Math.min(V101_MAX_STEPS,raw);if(steps<=0)return null;
 const byId=v101InstanceIndex(slot),listings=(slot.listings||[]).filter(l=>l?.status==='active'&&v101Remaining(l)>0);let units=0,total=0,lastLabel='Ventes';
 for(const l of listings){
  /* Published Realistic listings stay server-authoritative while another mode is selected. */
  if(mode==='realistic'&&l.remoteId)continue;const base=Math.max(.02,Number(l.marketBase||l.ask||1)),ask=Math.max(.02,Number(l.ask)||base),ratio=ask/base;if(ratio>v101PriceCap(l.rarity,l.type))continue;
  const better=v101BetterOffers(slot,l),cond=v101ConditionPower(l.condition);let p=v101DemandRate(l.rarity,l.type)*Math.exp(-better*.55)*Math.exp(-Math.max(0,ratio-1)*5.2)*Math.max(.55,Math.min(1.35,cond));if(ratio<=1)p*=1.12;p=Math.max(0,Math.min(.32,p));
  for(let k=0;k<steps&&l.status==='active'&&v101Remaining(l)>0;k++){if(Math.random()>=p)continue;const maxGroup=Math.min(v101Remaining(l),(l.type==='card'||l.type==='energy')?1:3),want=maxGroup>1&&Math.random()<.22?1+Math.floor(Math.random()*maxGroup):1;const s=v101ConsumeListing(slot,l,want,byId);if(s){units+=s.units;total+=s.total;lastLabel=s.label}}
 }
 slot.lastMarketTick=now;v101WriteSlot(mode,slot);if(units&&notify&&slot.notificationsEnabled!==false)v101NotifyMode(mode,units,total,units===1?lastLabel:'Ventes groupées');return{units,total};
}
function v101ProcessInactiveSlots(notify=true){for(const mode of ['realistic','ludic'])try{v101ProcessInactiveSlot(mode,notify)}catch(e){console.warn('V1.0.1 background market',mode,e)}}
function v101RealisticHasRemoteListings(){const d=v101ReadSlot('realistic');return !!d&&(d.listings||[]).some(l=>l?.status==='active'&&l.remoteId&&v101Remaining(l)>0)}
function v101ApplyInactiveRealisticTrades(trades){
 if(v08Mode()==='realistic'||!Array.isArray(trades)||!trades.length)return false;const slot=v101ReadSlot('realistic');if(!slot)return true;slot.onlineProcessedSellerTrades=Array.isArray(slot.onlineProcessedSellerTrades)?slot.onlineProcessedSellerTrades:[];
 const done=new Set(slot.onlineProcessedSellerTrades),byId=v101InstanceIndex(slot),byListing=new Map((slot.listings||[]).map(l=>[l.id,l]));let units=0,total=0,lastLabel='Vente online',changed=false;
 for(const t of trades){
  const id=t?.tradeId;if(!id||done.has(id))continue;const qty=Math.max(1,Number(t.quantity)||1),tradeTotal=Number(t.total)||Number(t.unitPrice||0)*qty,l=byListing.get(t.localListingId);let s=null;
  if(l&&v101Remaining(l)>0)s=v101ConsumeListing(slot,l,Math.min(qty,v101Remaining(l)),byId,tradeTotal);else{slot.wallet=Number(slot.wallet||0)+tradeTotal;slot.sales=Array.isArray(slot.sales)?slot.sales:[];slot.sales.push({id:`REMOTE-${id}`,tradeId:id,online:true,background:true,at:Date.now(),label:t.label||'Article',units:qty,unitPrice:Number(t.unitPrice)||0,total:tradeTotal,type:t.itemType||'remote'});if(slot.sellerProfile){slot.sellerProfile.completedSales=Number(slot.sellerProfile.completedSales||0)+qty;slot.sellerProfile.revenue=Number(slot.sellerProfile.revenue||0)+tradeTotal}s={units:qty,total:tradeTotal,label:t.label||'Article'}}
  done.add(id);slot.onlineProcessedSellerTrades.push(id);changed=true;units+=s?.units||0;total+=s?.total||0;lastLabel=s?.label||lastLabel;
 }
 if(slot.onlineProcessedSellerTrades.length>400)slot.onlineProcessedSellerTrades.splice(0,slot.onlineProcessedSellerTrades.length-400);if(slot.sales?.length>4000)slot.sales.splice(0,slot.sales.length-4000);if(changed){v101WriteSlot('realistic',slot);if(units&&slot.notificationsEnabled!==false)v101NotifyMode('realistic',units,total,units===1?lastLabel:'Ventes online')}return true;
}

/* Route seller receipts to the Realistic slot instead of the currently displayed Ludic/Creative slot. */
const v101OnlineEventBase=window.voxOnlineEvent;
window.voxOnlineEvent=function(type,payload){if(v08Mode()!=='realistic'&&type==='sellerTrades'&&Array.isArray(payload?.trades)){v101ApplyInactiveRealisticTrades(payload.trades);return}return v101OnlineEventBase?.(type,payload)};
function v101PollRealisticReceipts(){if(v08Mode()==='realistic'||!v101RealisticHasRemoteListings())return;try{if(v07Auth?.().signedIn)VOXOnline?.fetchReceipts?.()}catch(e){console.warn('V1.0.1 receipt poll',e)}}

/* ---------- CREATIVE: DELETE ONLY TRUE REDUNDANT COPIES ---------- */
function v101CardVariant(ins,c){try{return v100InstanceVariant(ins,c,ins.setId)}catch{}if(ins?.variant==='reverse')return'reverse';if(ins?.variant==='holo')return'holo';return'normal'}
function v101CreativeDuplicateIds(){
 if(v08Mode()!=='creative')return[];const remove=[],groups=new Map(),energyGroups=new Map();
 for(const ins of state.instances||[]){if(ins?.status!=='owned'||ins.graded)continue;if(ins.isEnergy){const k=`${ins.setId}|${ins.energyType}|${ins.variant||'normal'}`;if(!energyGroups.has(k))energyGroups.set(k,[]);energyGroups.get(k).push(ins);continue}if(!ins.cardId||!ins.setId)continue;const k=`${ins.setId}|${ins.cardId}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(ins)}
 const priority=x=>x.location==='binder'?0:x.location==='master-binder'?1:x.location==='inventory'?2:3,age=x=>Number(x.openedAt||x.acquiredAt||0);
 for(const arr of groups.values()){
  arr.sort((a,b)=>priority(a)-priority(b)||age(a)-age(b));const first=arr[0],c=cardById(first.setId,first.cardId);if(!c)continue;const documented=(typeof v100MasterSupported==='function'&&v100MasterSupported(first.setId))?v100VariantsFor(first.setId,c):[],keep=new Set();
  if(documented.length){for(const v of documented){const x=arr.find(ins=>!keep.has(ins.id)&&v101CardVariant(ins,c)===v);if(x)keep.add(x.id)}const generic=arr.find(ins=>!keep.has(ins.id)&&ins.location==='binder')||arr.find(ins=>!keep.has(ins.id));if(generic)keep.add(generic.id)}else keep.add(arr[0].id);
  for(const ins of arr)if(ins.location==='inventory'&&!keep.has(ins.id))remove.push(ins.id);
 }
 for(const arr of energyGroups.values()){arr.sort((a,b)=>priority(a)-priority(b)||age(a)-age(b));const keep=arr.find(x=>x.energyKeeper)||arr[0];for(const ins of arr)if(ins.location==='inventory'&&ins!==keep)remove.push(ins.id)}return remove;
}
function v101DeleteCreativeDuplicates(){
 if(v08Mode()!=='creative')return;const ids=v101CreativeDuplicateIds();if(!ids.length)return toast('Aucun doublon inutile à supprimer');const remove=new Set(ids),sets=new Set((state.instances||[]).filter(x=>remove.has(x.id)).map(x=>x.setId).filter(Boolean));state.instances=(state.instances||[]).filter(x=>!remove.has(x.id));
 try{v081RebuildInstanceIndexes?.()}catch{}try{v100InvalidateMaster?.()}catch{}for(const sid of sets)try{v100ReconcileBinders?.(sid)}catch{}save();renderInventory();if($('#binder')?.classList.contains('active'))renderBinder();updateStats();toast(`${ids.length} doublon${ids.length>1?'s':''} supprimé${ids.length>1?'s':''}`);
}
function v101ConfirmCreativeDuplicates(){
 if(v08Mode()!=='creative')return;const ids=v101CreativeDuplicateIds();if(!ids.length)return toast('Aucun doublon inutile à supprimer');const m=$('#sellModal');if(!m)return v101DeleteCreativeDuplicates();m.classList.remove('hidden');
 $('#sellContent').innerHTML=`<span class="tag">MODE CRÉATIF</span><h2>Supprimer les doublons ?</h2><p><strong>${ids.length}</strong> exemplaire${ids.length>1?'s':''} redondant${ids.length>1?'s':''} seront supprimé${ids.length>1?'s':''} définitivement.</p><p class="market-warning">Les cartes nécessaires au classeur Générique, aux variantes du Master Set, les énergies gardiennes et toutes les cartes gradées sont conservées.</p><button id="v101DeleteDuplicatesNow" class="danger-button">Supprimer ${ids.length} doublon${ids.length>1?'s':''}</button><button id="v101CancelDuplicates" class="secondary">Annuler</button>`;
 $('#v101DeleteDuplicatesNow').onclick=()=>{m.classList.add('hidden');v101DeleteCreativeDuplicates()};$('#v101CancelDuplicates').onclick=()=>m.classList.add('hidden');
}
const v101RenderCardInventoryBase=renderCardInventory;
renderCardInventory=function(out){const r=v101RenderCardInventoryBase(out);if(v08Mode()==='creative'&&out&&!out.querySelector('#v101DeleteDuplicates')){const ids=v101CreativeDuplicateIds(),b=document.createElement('button');b.id='v101DeleteDuplicates';b.className='secondary small';b.textContent=`Supprimer les doublons${ids.length?` (${ids.length})`:''}`;b.disabled=!ids.length;b.onclick=v101ConfirmCreativeDuplicates;const bar=out.querySelector('.inventory-sort');if(bar)bar.appendChild(b);else out.prepend(b)}return r};

/* Run inactive economies without swapping the global state object. */
const v101SwitchModeBase=v08SwitchMode;
v08SwitchMode=function(mode){try{v101ProcessInactiveSlots(true)}catch{}return v101SwitchModeBase(mode)};
setTimeout(()=>{try{v101ProcessInactiveSlots(true);v101PollRealisticReceipts()}catch(e){console.warn('V1.0.1 startup',e)}},1200);
setInterval(()=>{try{v101ProcessInactiveSlots(true)}catch{}},V101_BACKGROUND_SCAN);
setInterval(()=>{try{v101PollRealisticReceipts()}catch{}},V101_RECEIPT_SCAN);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){try{v101ProcessInactiveSlots(true);v101PollRealisticReceipts()}catch{}}},{passive:true});
window.VOXBackgroundModes={version:V101_VERSION,process:()=>v101ProcessInactiveSlots(true),creativeDuplicates:v101CreativeDuplicateIds};
window.__voxV101Ready=true;
