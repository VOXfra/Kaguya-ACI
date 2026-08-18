'use strict';

// V0.6.1: Eevee Heroes metadata is bundled into the APK at build time.
const V061_EEVEE_LOCAL='eevee_heroes.json';
const v061FetchSetDataBase=fetchSetData;

fetchSetData=async function(setId){
 if(setId!=='s6a')return v061FetchSetDataBase(setId);
 try{
  const r=await fetch(V061_EEVEE_LOCAL,{cache:'no-store'});
  if(!r.ok)throw new Error(`local Eevee dataset HTTP ${r.status}`);
  const raw=await r.json();
  const numbered=raw.filter(x=>x&&x.number&&x.number!=='N/A');
  const byNumber=new Map();
  for(const x of numbered){
   const n=Number.parseInt(String(x.number),10);
   if(!Number.isFinite(n)||n<1||n>101)continue;
   byNumber.set(n,{...x,id:`s6a-${n}`,localId:String(n).padStart(3,'0'),image:null,imageSmall:x.images?.small||'',imageLarge:x.images?.large||x.images?.small||''});
  }
  const items=[...byNumber.values()].sort((a,b)=>cardNo(a)-cardNo(b));
  if(items.length!==101)throw new Error(`Eevee dataset ${items.length}/101`);
  const rarity={};
  const map={'Common':'jp_common','Uncommon':'jp_uncommon','Rare':'jp_rare','Double Rare':'jp_rr','Triple Rare':'jp_rrr','Super Rare':'jp_sr','Hyper Rare':'jp_hr','Ultra Rare':'jp_ur'};
  for(const c of items)rarity[cardNo(c)]=map[c.rarity]||'unknown';
  const required=['jp_common','jp_uncommon','jp_rare','jp_rr','jp_rrr','jp_sr','jp_hr','jp_ur'];
  const counts={};for(const v of Object.values(rarity))counts[v]=(counts[v]||0)+1;
  if(required.some(k=>!(counts[k]>0)))throw new Error(`Eevee rarity pools incomplete ${JSON.stringify(counts)}`);
  state.sets.s6a={id:'s6a',name:'Eevee Heroes',logo:'img/eevee_logo',cards:items};
  state.meta.s6a={rarity,raw:items,counts};
  state.metaReady.s6a=true;
 }catch(e){
  console.error('V0.6.1 local Eevee load failed',e);
  state.metaReady.s6a=false;
  state.sets.s6a=state.sets.s6a||{id:'s6a',name:'Eevee Heroes',logo:'img/eevee_logo',cards:[]};
 }
};

// Product art that is bundled into the APK as well.
if(SETS.s6a){
 SETS.s6a.products.forEach(p=>{
  if(p.id==='eevee-booster'||p.id==='eevee-lot6')p.image='img/eevee_booster.jpg';
  if(p.id==='eevee-box')p.image='img/eevee_box.jpg';
 });
}
