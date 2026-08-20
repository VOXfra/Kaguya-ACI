'use strict';
/* V1.0.6 local product artwork for the large 2024-2026 catalog.
   The V1.0.5 generator used the set logo as every product image. This layer
   replaces only those generated catalog products with lightweight inline SVG
   packaging, so booster / lot / ETB / display / binder are visually distinct
   and remain available offline without extra HTTP requests. */
const V106_PRODUCT_ART_VERSION='1.0.6';

function v106XmlText(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))}
function v106ArtHash(s){let h=2166136261;for(const ch of String(s||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function v106ArtPalette(setId){const h=v106ArtHash(setId)%360,h2=(h+58+(v106ArtHash(setId+'x')%45))%360;return{a:`hsl(${h} 72% 43%)`,b:`hsl(${h2} 76% 58%)`,dark:`hsl(${h} 42% 13%)`,light:`hsl(${h2} 86% 78%)`}}
function v106ArtLines(name){const words=String(name||'COLLECTION').toUpperCase().split(/\s+/).filter(Boolean),lines=[''];for(const w of words){const i=lines.length-1;if((lines[i]+' '+w).trim().length>18&&lines.length<3)lines.push(w);else lines[i]=(lines[i]+' '+w).trim()}return lines.slice(0,3)}
function v106SvgText(lines,y,size=24){return lines.map((x,i)=>`<text x="180" y="${y+i*(size+5)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${size}" font-weight="900" fill="white" stroke="rgba(0,0,0,.42)" stroke-width="1">${v106XmlText(x)}</text>`).join('')}
function v106ProductType(p){const k=String(p?.kind||'').toLowerCase();if(p?.eventEdition)return'limited';if(p?.mode==='binderUnlock'||k.includes('classeur')||k.includes('portfolio'))return'binder';if(p?.mode==='loose'&&Number(p?.qty||1)>1)return'lot';if(p?.mode==='loose')return'booster';if(k.includes('etb')||k.includes('dresseur'))return'etb';if(k.includes('display')||k.includes('booster box')||Number(p?.opens)>=30)return'display';if(Number(p?.opens)>=4)return'box';return'sealed'}
function v106ProductSvg(setId,setName,p){
 const pal=v106ArtPalette(setId),type=v106ProductType(p),lines=v106ArtLines(setName),title=v106SvgText(lines,type==='binder'?270:220,type==='binder'?22:20);
 const defs=`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${pal.a}"/><stop offset="1" stop-color="${pal.b}"/></linearGradient><linearGradient id="foil" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#fff" stop-opacity=".48"/><stop offset=".35" stop-color="#fff" stop-opacity=".06"/><stop offset=".7" stop-color="#fff" stop-opacity=".34"/><stop offset="1" stop-color="#fff" stop-opacity=".04"/></linearGradient><filter id="sh"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-opacity=".35"/></filter></defs>`;
 let art='';
 if(type==='booster')art=`<g filter="url(#sh)"><path d="M105 52 L255 52 268 83 255 422 105 422 92 83Z" fill="url(#g)" stroke="${pal.light}" stroke-width="4"/><path d="M96 83H264M104 393H256" stroke="white" stroke-opacity=".55" stroke-width="8"/><path d="M116 72l14 8 14-8 14 8 14-8 14 8 14-8 14 8 14-8 14 8" fill="none" stroke="white" stroke-opacity=".5" stroke-width="3"/><rect x="106" y="102" width="148" height="245" rx="18" fill="${pal.dark}" fill-opacity=".32"/><path d="M116 110L242 337" stroke="url(#foil)" stroke-width="38" opacity=".7"/>${title}<text x="180" y="365" text-anchor="middle" font-family="Arial" font-size="18" font-weight="800" fill="white">BOOSTER</text></g>`;
 else if(type==='lot')art=`<g filter="url(#sh)"><g transform="translate(4 24) rotate(-8 150 235)"><path d="M85 70H205L216 94 205 390H85L74 94Z" fill="${pal.a}" stroke="${pal.light}" stroke-width="3"/></g><g transform="translate(70 5) rotate(8 150 235)"><path d="M85 70H205L216 94 205 390H85L74 94Z" fill="${pal.b}" stroke="${pal.light}" stroke-width="3"/></g><path d="M105 55H255L266 82 255 408H105L94 82Z" fill="url(#g)" stroke="white" stroke-opacity=".72" stroke-width="4"/><rect x="112" y="110" width="136" height="210" rx="16" fill="${pal.dark}" fill-opacity=".3"/>${title}<circle cx="245" cy="350" r="42" fill="${pal.dark}" stroke="white" stroke-width="3"/><text x="245" y="359" text-anchor="middle" font-family="Arial" font-size="27" font-weight="900" fill="white">×${Math.max(2,Number(p?.qty)||6)}</text></g>`;
 else if(type==='etb')art=`<g filter="url(#sh)"><rect x="70" y="90" width="220" height="300" rx="18" fill="url(#g)" stroke="${pal.light}" stroke-width="4"/><path d="M70 138H290" stroke="white" stroke-opacity=".6" stroke-width="5"/><rect x="86" y="154" width="188" height="170" rx="14" fill="${pal.dark}" fill-opacity=".34"/>${title}<text x="180" y="352" text-anchor="middle" font-family="Arial" font-size="17" font-weight="900" fill="white">COFFRET DRESSEUR D’ÉLITE</text></g>`;
 else if(type==='display')art=`<g filter="url(#sh)"><path d="M52 178L92 112H268L308 178V374H52Z" fill="url(#g)" stroke="${pal.light}" stroke-width="4"/><path d="M52 178H308L282 236H78Z" fill="${pal.dark}" fill-opacity=".5"/><g opacity=".92">${[0,1,2,3,4,5].map(i=>`<rect x="${82+i*34}" y="125" width="28" height="122" rx="5" fill="${i%2?pal.b:pal.a}" stroke="white" stroke-opacity=".55"/>`).join('')}</g><rect x="72" y="246" width="216" height="94" rx="12" fill="${pal.dark}" fill-opacity=".33"/>${v106SvgText(lines,274,18)}<text x="180" y="361" text-anchor="middle" font-family="Arial" font-size="19" font-weight="900" fill="white">DISPLAY · ${Number(p?.opens)||36} BOOSTERS</text></g>`;
 else if(type==='binder')art=`<g filter="url(#sh)"><rect x="74" y="54" width="226" height="360" rx="20" fill="url(#g)" stroke="${pal.light}" stroke-width="4"/><rect x="74" y="54" width="34" height="360" rx="17" fill="${pal.dark}" fill-opacity=".62"/><circle cx="91" cy="98" r="5" fill="white" fill-opacity=".45"/><circle cx="91" cy="370" r="5" fill="white" fill-opacity=".45"/><rect x="126" y="104" width="148" height="208" rx="16" fill="${pal.dark}" fill-opacity=".28"/>${title}<text x="190" y="348" text-anchor="middle" font-family="Arial" font-size="18" font-weight="900" fill="white">CLASSEUR 9 POCHES</text></g>`;
 else if(type==='limited')art=`<g filter="url(#sh)"><path d="M58 124H302L286 389H74Z" fill="url(#g)" stroke="#ffd45d" stroke-width="5"/><path d="M58 124L92 78H268L302 124Z" fill="${pal.dark}" stroke="#ffd45d" stroke-width="4"/><rect x="88" y="160" width="184" height="150" rx="18" fill="${pal.dark}" fill-opacity=".34"/>${title}<rect x="118" y="331" width="124" height="38" rx="19" fill="#f7bf39"/><text x="180" y="356" text-anchor="middle" font-family="Arial" font-size="17" font-weight="900" fill="#151515">ÉDITION LIMITÉE</text></g>`;
 else art=`<g filter="url(#sh)"><rect x="62" y="98" width="236" height="292" rx="18" fill="url(#g)" stroke="${pal.light}" stroke-width="4"/><rect x="80" y="128" width="200" height="176" rx="16" fill="${pal.dark}" fill-opacity=".32"/>${title}<text x="180" y="346" text-anchor="middle" font-family="Arial" font-size="18" font-weight="900" fill="white">PRODUIT SCELLÉ · ${Number(p?.opens)||''} BOOSTERS</text></g>`;
 return`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480">${defs}${art}</svg>`;
}
function v106ProductArt(setId,setName,p){try{return`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(v106ProductSvg(setId,setName,p))}`}catch{return String(p?.image||'')}}
function v106ApplyProductArt(){
 let changed=0;
 for(const s of Object.values(SETS||{})){
  if(!s?.v105Catalog)continue;
  for(const p of s.products||[]){p.image=v106ProductArt(s.id,s.name,p);p.v106LocalArt=true;changed++}
  const binder=(s.products||[]).find(p=>p.mode==='binderUnlock');if(binder&&typeof V061_BINDERS!=='undefined'&&V061_BINDERS[s.id])V061_BINDERS[s.id].image=binder.image;
 }
 for(const p of Object.values(state.eventCatalog||{})){
  if(!SETS[p?.setId]?.v105Catalog)continue;p.image=v106ProductArt(p.setId,SETS[p.setId].name,p);p.v106LocalArt=true;changed++;
 }
 try{v106MarketIndex=null;v106InvalidateMarket?.()}catch{}
 window.__voxV106ProductArtCount=changed;
 try{if($('#shop')?.classList.contains('active'))renderProducts()}catch{}
 try{if(!$('#marketModal')?.classList.contains('hidden')&&state.marketTab==='buy')v4RenderBuyHome()}catch{}
 return changed;
}
v106ApplyProductArt();
window.__voxV106ProductArtReady=true;
