'use strict';

/* V0.8.4 — select the requested game-mode slot BEFORE the legacy V0.6 loader runs.
   This prevents the shared V06 key and Google cloud from deciding the active progression. */
const V084_BOOT_META='voxCardSimV08_activeMode';
const V084_BOOT_PREFIX='voxCardSimV08_slot_';
const V084_BOOT_MODES=new Set(['realistic','ludic','creative']);
function v084BootFresh(mode,legacy={}){
 const now=Date.now();
 return {
  version:8,schemaVersion:8,gameMode:mode,playerId:legacy.playerId||`PLAYER-${now}-${Math.random().toString(36).slice(2,9)}`,
  activeSet:'sv03.5',wallet:mode==='creative'?0:250,instances:[],stock:{},listings:[],sales:[],purchases:[],packsOpened:{},
  settings:legacy.settings||{cardTrickEnabled:false,cardTrickCount:0},currentOpening:null,inventoryTab:'cards',inventorySort:'numberAsc',
  pageBySet:{'sv03.5':0,'sv03':0,'sv02':0,'s6a':0},lastMarketTick:now,marketShift:{},priceCache:{},lastKnownEstimates:{},
  marketBooks:{},marketSellers:[],marketTab:'buy',marketQuery:'',marketSetFilter:'all',binderOwned:{},stockLots:{},priceHistory:{},
  publicCards:[],jpPackPlans:{},sellerProfile:null,offlinePackMeta:legacy.offlinePackMeta||{},notificationsEnabled:legacy.notificationsEnabled!==false,
  discoveredCards:{},ludicRewards:{twentyMilestone:0,completedSets:{},boosterCount:0,totalBonus:0},luckyPacks:0,dailyDropBought:{},eventCatalog:{},
  friends:[],friendRequestsOut:[],friendDeclined:[],marketCategory:'all',marketRarity:'all',marketSort:'relevance',marketMinPrice:'',marketMaxPrice:'',marketPage:1,
  onlineProcessedSellerTrades:[],onlineProcessedBuyerTrades:[],onlineCloudEnabled:true,lastSavedAt:now
 };
}
(function v084PrepareModeBeforeLoad(){
 let legacy={};try{legacy=JSON.parse(localStorage.getItem('voxCardSimV06')||'{}')||{}}catch{}
 let mode=localStorage.getItem(V084_BOOT_META);
 if(!V084_BOOT_MODES.has(mode)){
  mode='realistic';localStorage.setItem(V084_BOOT_META,mode);
  const old=localStorage.getItem('voxCardSimV06');if(old&&!localStorage.getItem(V084_BOOT_PREFIX+'realistic'))localStorage.setItem(V084_BOOT_PREFIX+'realistic',old);
 }
 let json=localStorage.getItem(V084_BOOT_PREFIX+mode);
 if(!json){const fresh=v084BootFresh(mode,legacy);json=JSON.stringify(fresh);localStorage.setItem(V084_BOOT_PREFIX+mode,json)}
 try{
  const d=JSON.parse(json);d.gameMode=mode;d.version=Math.max(8,Number(d.version)||0);d.schemaVersion=Math.max(8,Number(d.schemaVersion)||0);json=JSON.stringify(d);
 }catch{json=JSON.stringify(v084BootFresh(mode,legacy));localStorage.setItem(V084_BOOT_PREFIX+mode,json)}
 localStorage.setItem('voxCardSimV06',json);localStorage.setItem('voxCardSimV06_backup',json);localStorage.setItem(V084_BOOT_PREFIX+mode,json);localStorage.setItem(V084_BOOT_META,mode);
 try{state.gameMode=mode}catch{}
 window.__voxBootGameMode=mode;
 if(mode!=='realistic')try{window.VOXOnline?.setCloudWritesEnabled?.(false)}catch{}
})();

function v084InstallEarlyOnlineGuard(){
 if(window.__voxV084EarlyOnlineGuard)return;window.__voxV084EarlyOnlineGuard=true;
 const active=()=>{const m=localStorage.getItem(V084_BOOT_META);return V084_BOOT_MODES.has(m)?m:'realistic'};
 const blocked=new Set(['cloudLoaded','cloudSaved','listingPublished','listings','ownListings','purchaseCommitted','buyerTrades','sellerTrades']);
 const eventBase=window.voxOnlineEvent;
 window.voxOnlineEvent=function(type,payload){if(active()!=='realistic'&&blocked.has(type))return;return eventBase?.(type,payload)};
 if(typeof v07ResolveCloud==='function'){const base=v07ResolveCloud;v07ResolveCloud=function(payload){if(active()!=='realistic')return;return base(payload)}}
 if(typeof v07SyncListings==='function'){const base=v07SyncListings;v07SyncListings=function(){if(active()!=='realistic')return;return base()}}
 if(typeof v07PublishPublicProfile==='function'){const base=v07PublishPublicProfile;v07PublishPublicProfile=function(){if(active()!=='realistic')return;return base()}}
 if(active()!=='realistic')try{window.VOXOnline?.setCloudWritesEnabled?.(false)}catch{}
}

fetchSetData=async function(setId){
 try{
  if(setId==='s6a'){
   const raw=window.V062_EEVEE_DATA;if(!Array.isArray(raw))throw new Error('embedded Eevee dataset missing');
   const byNumber=new Map();for(const x of raw){if(!x||!x.number||x.number==='N/A')continue;const n=Number.parseInt(String(x.number),10);if(!Number.isFinite(n)||n<1||n>101)continue;byNumber.set(n,{...x,id:`s6a-${n}`,localId:String(n).padStart(3,'0'),image:null,imageSmall:x.images?.small||'',imageLarge:x.images?.large||x.images?.small||''})}
   const items=[...byNumber.values()].sort((a,b)=>cardNo(a)-cardNo(b));if(items.length!==101)throw new Error(`Eevee embedded count ${items.length}/101`);
   const rarity={},jpMap={'Common':'jp_common','Uncommon':'jp_uncommon','Rare':'jp_rare','Double Rare':'jp_rr','Triple Rare':'jp_rrr','Super Rare':'jp_sr','Hyper Rare':'jp_hr','Ultra Rare':'jp_ur'};for(const c of items)rarity[cardNo(c)]=jpMap[c.rarity]||'unknown';
   const counts={};for(const r of Object.values(rarity))counts[r]=(counts[r]||0)+1;for(const k of ['jp_common','jp_uncommon','jp_rare','jp_rr','jp_rrr','jp_sr','jp_hr','jp_ur'])if(!(counts[k]>0))throw new Error(`Eevee missing pool ${k}`);
   state.sets[setId]={id:setId,name:'Eevee Heroes',logo:'img/eevee_logo',cards:items};state.meta[setId]={rarity,raw:items,counts};state.metaReady[setId]=true;return;
  }
  const bundle=window.V063_STANDARD_DATA?.[setId],cfg=SETS[setId];if(!cfg||!bundle||!bundle.set||!Array.isArray(bundle.raw))throw new Error(`embedded standard set missing ${setId}`);
  const set=(typeof structuredClone==='function')?structuredClone(bundle.set):JSON.parse(JSON.stringify(bundle.set));set.cards=[...(set.cards||[])].sort((a,b)=>cardNo(a)-cardNo(b));if(set.cards.length!==cfg.total)throw new Error(`${setId} card count ${set.cards.length}/${cfg.total}`);
  const rarity={};for(const c of bundle.raw){const n=Number.parseInt(c.number,10);if(Number.isFinite(n))rarity[n]=RARITY_NORMALIZE[c.rarity]||'unknown'}
  const exp=EXPECTED_RARITIES[setId]||{total:cfg.total},counts={};for(const v of Object.values(rarity))counts[v]=(counts[v]||0)+1;if(bundle.raw.length!==exp.total)throw new Error(`${setId} metadata count ${bundle.raw.length}/${exp.total}`);for(const [k,v] of Object.entries(exp))if(k!=='total'&&counts[k]!==v)throw new Error(`${setId} rarity ${k} ${counts[k]||0}/${v}`);for(const k of ['common','uncommon','rare'])if(!(counts[k]>0))throw new Error(`${setId} missing base pool ${k}`);
  state.sets[setId]=set;state.meta[setId]={rarity,raw:bundle.raw,counts};state.metaReady[setId]=true;
 }catch(e){console.error('V0.6.3 embedded set load failed',setId,e);state.metaReady[setId]=false;const cfg=SETS[setId];state.sets[setId]=state.sets[setId]||{id:setId,name:cfg?.name||setId,cards:[]}}
};

function voxLoadScript(src,next){const s=document.createElement('script');s.src=src;s.onload=()=>next?.();s.onerror=e=>console.error('VOX layer load failed',src,e);document.body.appendChild(s)}
function voxLoadScripts(files,index=0){if(index>=files.length)return;const src=files[index];voxLoadScript(src,()=>{if(src==='v07online.js')v084InstallEarlyOnlineGuard();voxLoadScripts(files,index+1)})}
window.addEventListener('load',()=>{
 if(window.__voxV07Loaded)return;window.__voxV07Loaded=true;
 voxLoadScripts(['v07online.js','v07fix.js','v072perf.js','v08core.js','v08market.js','v08binder.js','v08friends.js','v08final.js','v08ui.js','v08safety.js','v081perf.js','v082reset.js','v083offline.js','v084mode.js','v085ux.js','v086commit.js','v087prices.js','v088powerstock.js','pitch_black_embed.js','v090game.js','v091energy.js','v092pagefix.js','v093perf.js','master_variants_embed.js','v110core.js','v110master.js','v110background.js']);
});
