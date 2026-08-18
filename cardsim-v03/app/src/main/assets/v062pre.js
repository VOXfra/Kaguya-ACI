'use strict';

// V0.6.2: native save mirror restore + fully embedded Eevee Heroes metadata.
(function v062RestoreNativeMirror(){
 try{
  const nativeJson=window.VOXNative?.getMirroredSave?.();
  if(!nativeJson)return;
  const native=JSON.parse(nativeJson),local=JSON.parse(localStorage.getItem(V06_STORAGE)||'null');
  const nt=Number(native.lastSavedAt||native.migrationInfo?.at||0),lt=Number(local?.lastSavedAt||local?.migrationInfo?.at||0);
  if(!local||nt>=lt){localStorage.setItem(V06_STORAGE,nativeJson);localStorage.setItem(V06_BACKUP,nativeJson);}
 }catch(e){console.warn('V0.6.2 native restore skipped',e)}
})();

const v062SaveBase=save;
save=function(){
 v062SaveBase();
 try{const j=localStorage.getItem(V06_STORAGE);if(j)window.VOXNative?.mirrorSave?.(j)}catch(e){console.warn('V0.6.2 native mirror',e)}
};

const v062FetchSetDataBase=fetchSetData;
fetchSetData=async function(setId){
 if(setId!=='s6a')return v062FetchSetDataBase(setId);
 try{
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
  if(items.length!==101)throw new Error(`embedded Eevee dataset ${items.length}/101`);
  const rarity={},map={'Common':'jp_common','Uncommon':'jp_uncommon','Rare':'jp_rare','Double Rare':'jp_rr','Triple Rare':'jp_rrr','Super Rare':'jp_sr','Hyper Rare':'jp_hr','Ultra Rare':'jp_ur'};
  for(const c of items)rarity[cardNo(c)]=map[c.rarity]||'unknown';
  const counts={};for(const r of Object.values(rarity))counts[r]=(counts[r]||0)+1;
  for(const k of ['jp_common','jp_uncommon','jp_rare','jp_rr','jp_rrr','jp_sr','jp_hr','jp_ur'])if(!(counts[k]>0))throw new Error(`missing Eevee rarity pool ${k}`);
  state.sets.s6a={id:'s6a',name:'Eevee Heroes',logo:'img/eevee_logo',cards:items};
  state.meta.s6a={rarity,raw:items,counts};state.metaReady.s6a=true;
 }catch(e){console.error('V0.6.2 Eevee init failed',e);state.metaReady.s6a=false;state.sets.s6a=state.sets.s6a||{id:'s6a',name:'Eevee Heroes',logo:'img/eevee_logo',cards:[]};}
};
