'use strict';

// V0.6.3: one authoritative set loader. No chained runtime fetch overrides.
fetchSetData=async function(setId){
 try{
  if(setId==='s6a'){
   const raw=window.V062_EEVEE_DATA;
   if(!Array.isArray(raw))throw new Error('embedded Eevee dataset missing');
   const byNumber=new Map();
   for(const x of raw){
    if(!x||!x.number||x.number==='N/A')continue;
    const n=Number.parseInt(String(x.number),10);
    if(!Number.isFinite(n)||n<1||n>101)continue;
    byNumber.set(n,{...x,id:`s6a-${n}`,localId:String(n).padStart(3,'0'),image:null,imageSmall:x.images?.small||'',imageLarge:x.images?.large||x.images?.small||''});
   }
   const items=[...byNumber.values()].sort((a,b)=>cardNo(a)-cardNo(b));
   if(items.length!==101)throw new Error(`Eevee embedded count ${items.length}/101`);
   const rarity={},jpMap={'Common':'jp_common','Uncommon':'jp_uncommon','Rare':'jp_rare','Double Rare':'jp_rr','Triple Rare':'jp_rrr','Super Rare':'jp_sr','Hyper Rare':'jp_hr','Ultra Rare':'jp_ur'};
   for(const c of items)rarity[cardNo(c)]=jpMap[c.rarity]||'unknown';
   const counts={};for(const r of Object.values(rarity))counts[r]=(counts[r]||0)+1;
   for(const k of ['jp_common','jp_uncommon','jp_rare','jp_rr','jp_rrr','jp_sr','jp_hr','jp_ur'])if(!(counts[k]>0))throw new Error(`Eevee missing pool ${k}`);
   state.sets[setId]={id:setId,name:'Eevee Heroes',logo:'img/eevee_logo',cards:items};
   state.meta[setId]={rarity,raw:items,counts};state.metaReady[setId]=true;return;
  }
  const bundle=window.V063_STANDARD_DATA?.[setId],cfg=SETS[setId];
  if(!cfg||!bundle||!bundle.set||!Array.isArray(bundle.raw))throw new Error(`embedded standard set missing ${setId}`);
  const set=(typeof structuredClone==='function')?structuredClone(bundle.set):JSON.parse(JSON.stringify(bundle.set));
  set.cards=[...(set.cards||[])].sort((a,b)=>cardNo(a)-cardNo(b));
  if(set.cards.length!==cfg.total)throw new Error(`${setId} card count ${set.cards.length}/${cfg.total}`);
  const rarity={};for(const c of bundle.raw){const n=Number.parseInt(c.number,10);if(Number.isFinite(n))rarity[n]=RARITY_NORMALIZE[c.rarity]||'unknown'}
  const exp=EXPECTED_RARITIES[setId]||{total:cfg.total},counts={};for(const v of Object.values(rarity))counts[v]=(counts[v]||0)+1;
  if(bundle.raw.length!==exp.total)throw new Error(`${setId} metadata count ${bundle.raw.length}/${exp.total}`);
  for(const [k,v] of Object.entries(exp))if(k!=='total'&&counts[k]!==v)throw new Error(`${setId} rarity ${k} ${counts[k]||0}/${v}`);
  for(const k of ['common','uncommon','rare'])if(!(counts[k]>0))throw new Error(`${setId} missing base pool ${k}`);
  state.sets[setId]=set;state.meta[setId]={rarity,raw:bundle.raw,counts};state.metaReady[setId]=true;
 }catch(e){console.error('V0.6.3 embedded set load failed',setId,e);state.metaReady[setId]=false;const cfg=SETS[setId];state.sets[setId]=state.sets[setId]||{id:setId,name:cfg?.name||setId,cards:[]}}
};

function voxLoadScript(src,next){const s=document.createElement('script');s.src=src;s.onload=()=>next?.();s.onerror=e=>console.error('VOX layer load failed',src,e);document.body.appendChild(s)}
window.addEventListener('load',()=>{
 if(window.__voxV07Loaded)return;window.__voxV07Loaded=true;
 voxLoadScript('v07online.js',()=>voxLoadScript('v07fix.js',()=>voxLoadScript('v072perf.js',()=>voxLoadScript('v08core.js',()=>voxLoadScript('v08market.js',()=>voxLoadScript('v08binder.js',()=>voxLoadScript('v08friends.js',()=>voxLoadScript('v08final.js'))))))));
});
