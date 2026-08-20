'use strict';
/* Concatenated into the generated catalog embed during release builds. */
const v105PackBase=generatePack;
generatePack=function(setId){
 const d=window.V105_CATALOG?.sets?.[setId];
 if(!d||d.availability!=='retail')return v105PackBase(setId);
 if(!state.metaReady[setId])throw new Error('v105-metadata-not-ready');
 const cfg=SETS[setId],commons=pool(setId,'common'),uncommons=pool(setId,'uncommon'),rares=pool(setId,'rare'),dr=pool(setId,'double'),irs=pool(setId,'ir'),urs=pool(setId,'ur'),sirs=pool(setId,'sir'),hrs=pool(setId,'hr'),mhrs=pool(setId,'mhr'),reverses=[...commons,...uncommons,...rares];
 if(commons.length<4||uncommons.length<3||!rares.length)throw new Error(`v105-rarity-pools-incomplete-${setId}`);
 const out=[];uniquePicks(commons,4).forEach(c=>out.push(wrapCard(c,setId,'Commune','normal')));uniquePicks(uncommons,3).forEach(c=>out.push(wrapCard(c,setId,'Peu commune','normal')));
 const r1=pick(reverses);out.push(wrapCard(r1,setId,'Reverse 1','reverse'));
 const x=Math.random(),rm=Number(cfg.rates?.mhr)||0,rh=Number(cfg.rates?.hr)||0,rs=Number(cfg.rates?.sir)||0,ri=Number(cfg.rates?.ir)||0;let r2;
 if(x<rm&&mhrs.length)r2=wrapCard(pick(mhrs),setId,'Méga Hyper Rare','holo');
 else if(x<rm+rh&&hrs.length)r2=wrapCard(pick(hrs),setId,'Hyper Rare','holo');
 else if(x<rm+rh+rs&&sirs.length)r2=wrapCard(pick(sirs),setId,'SIR','holo');
 else if(x<rm+rh+rs+ri&&irs.length)r2=wrapCard(pick(irs),setId,'Illustration Rare','holo');
 else r2=wrapCard(pick(reverses.filter(c=>c.id!==r1?.id))||pick(reverses),setId,'Reverse 2','reverse');out.push(r2);
 const y=Math.random(),ru=Number(cfg.rates?.ur)||0,rd=Number(cfg.rates?.double)||0;let r3;
 if(y<ru&&urs.length)r3=wrapCard(pick(urs),setId,'Ultra Rare','holo');
 else if(y<ru+rd&&dr.length)r3=wrapCard(pick(dr),setId,'Double Rare','holo');
 else r3=wrapCard(pick(rares),setId,'Rare Holo','holo');out.push(r3);out.push(energyCard(setId));return out;
};

/* v105_catalog_embed.js is evaluated immediately before v105catalog.js. Wait for
   registration, then load the additive V1.0.6 layer last so it cannot be
   overwritten by the V1.0.5 catalog hooks. */
(function v106LoadAfterCatalog(){
 let tries=0;
 const wait=()=>{
  if(window.__voxV106LoaderStarted)return;
  if(typeof v105RegisterCatalog==='function'&&SETS?.me04&&SETS?.me05){
   window.__voxV106LoaderStarted=true;
   const s=document.createElement('script');s.src='v106fix.js';
   s.onerror=e=>console.error('VOX V1.0.6 load failed',e);document.body.appendChild(s);return;
  }
  if(++tries<250)setTimeout(wait,20);else console.error('VOX V1.0.6 catalog wait timeout');
 };
 setTimeout(wait,0);
})();
