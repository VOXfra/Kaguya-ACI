'use strict';
/* VOX Card Sim V1.0.6 — generated product artwork for catalog sets. */
const V106_SHOP_VISUAL_VERSION='1.0.6';

function v106SvgEsc(s){return String(s||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c))}
function v106ProductVisual(product,setCfg){
 if(!product||!setCfg)return'';
 const label=v106SvgEsc(setCfg.name),kind=v106SvgEsc(product.kind||'Produit'),name=v106SvgEsc(product.name||'');
 const mode=product.mode||'',opens=Number(product.opens||0),qty=Number(product.qty||0);
 let shape='PACK',sub='BOOSTER';
 if(mode==='binderUnlock'){shape='BINDER';sub='9 POCHES'}
 else if(/display|booster box/i.test(product.kind||product.name||'')||opens>=30){shape='BOX';sub=`${opens||36} BOOSTERS`}
 else if(/etb|trainer/i.test(product.kind||product.name||'')||opens>=8){shape='ETB';sub=`${opens||9} BOOSTERS`}
 else if(product.eventEdition){shape='LIMITED';sub=`${opens||qty||6} BOOSTERS`}
 else if(mode==='sealed'){shape='SEALED';sub=opens?`${opens} BOOSTERS`:'SCELLÉ'}
 else if(mode==='loose'&&qty>1){shape='PACK';sub=`LOT ×${qty}`}
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="920" viewBox="0 0 720 920"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#172131"/><stop offset="1" stop-color="#080d14"/></linearGradient><linearGradient id="a" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#ffd465"/><stop offset="1" stop-color="#eba91d"/></linearGradient></defs><rect width="720" height="920" rx="54" fill="url(#g)"/><rect x="28" y="28" width="664" height="864" rx="42" fill="none" stroke="#34445d" stroke-width="3"/><text x="360" y="108" fill="#f5c451" font-family="Arial,sans-serif" font-size="28" font-weight="700" text-anchor="middle" letter-spacing="5">VOX CARD SIM</text><text x="360" y="170" fill="#fff" font-family="Arial,sans-serif" font-size="34" font-weight="700" text-anchor="middle">${label}</text><rect x="145" y="245" width="430" height="405" rx="${shape==='PACK'?28:48}" fill="#111b29" stroke="#f5c451" stroke-width="5"/><rect x="185" y="300" width="350" height="88" rx="18" fill="url(#a)"/><text x="360" y="356" fill="#121212" font-family="Arial,sans-serif" font-size="34" font-weight="800" text-anchor="middle">${shape}</text><text x="360" y="465" fill="#fff" font-family="Arial,sans-serif" font-size="42" font-weight="800" text-anchor="middle">${sub}</text><text x="360" y="535" fill="#a9b5c6" font-family="Arial,sans-serif" font-size="25" font-weight="600" text-anchor="middle">${kind}</text><text x="360" y="715" fill="#f7f8fb" font-family="Arial,sans-serif" font-size="27" font-weight="700" text-anchor="middle">${name.slice(0,34)}</text><text x="360" y="760" fill="#8794a8" font-family="Arial,sans-serif" font-size="20" text-anchor="middle">Visuel produit — ${sub}</text></svg>`;
 return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
}

function v106ApplyGeneratedProductVisuals(){
 let changed=0;
 for(const s of Object.values(SETS)){
  if(!s?.v105Catalog)continue;
  for(const p of s.products||[]){p.image=v106ProductVisual(p,s);p.v106GeneratedVisual=true;changed++}
 }
 if(state.eventCatalog)for(const p of Object.values(state.eventCatalog)){if(p?.setId&&SETS[p.setId]?.v105Catalog){p.image=v106ProductVisual(p,SETS[p.setId]);p.v106GeneratedVisual=true;changed++}}
 try{v106MarketIndex=null;v106InvalidateMarket?.()}catch{}
 return changed;
}
window.__voxV106ProductVisualCount=v106ApplyGeneratedProductVisuals();
