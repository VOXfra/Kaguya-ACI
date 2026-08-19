'use strict';

/* VOX Card Sim V0.8.5 — mobile input focus, visible next card, direct binder purchase. */

/* ---------- MARKETPLACE: NEVER DESTROY THE FOCUSED INPUT WHILE TYPING ---------- */
let v085MarketInputTimer=0;
function v085OpenMarketAsset(a){
 if(!a)return;
 if(a.type==='card'){
  const c=cardById(a.setId,a.cardId);if(c)v4OpenCardAsset(c,a.setId);
 }else if(a.type==='booster')v4OpenBook(v4BoosterBook(a.setId));
 else v4OpenBook(v4SealedBook(a.productId));
}
function v085RefreshMarketRows(){
 if(v08Mode()==='creative')return;
 const out=$('#marketContent'),list=out?.querySelector('.market-result-list'),count=out?.querySelector('.v08-result-count'),pager=out?.querySelector('.v08-pagination');
 if(!out||!list||!count||!pager)return;
 const all=v08MarketAssets(state.marketQuery),pages=Math.max(1,Math.ceil(all.length/V08_MARKET_PAGE_SIZE));
 state.marketPage=clamp(state.marketPage||1,1,pages);
 const start=(state.marketPage-1)*V08_MARKET_PAGE_SIZE,results=all.slice(start,start+V08_MARKET_PAGE_SIZE);
 count.innerHTML=`<strong>${all.length} article(s)</strong><span>Page ${state.marketPage}/${pages}</span>`;
 list.innerHTML=results.map(v08MarketResultHtml).join('')||'<div class="empty-state panel">Aucun résultat avec ces filtres.</div>';
 const prev=pager.querySelector('#v08PrevMarket'),next=pager.querySelector('#v08NextMarket');
 if(prev){prev.disabled=state.marketPage<=1;prev.onclick=()=>{state.marketPage--;save();v085RefreshMarketRows()}}
 if(next){next.disabled=state.marketPage>=pages;next.onclick=()=>{state.marketPage++;save();v085RefreshMarketRows()}}
 list.querySelectorAll('[data-market-result]').forEach(b=>b.onclick=()=>v085OpenMarketAsset(results[Number(b.dataset.marketResult)]));
}
function v085InstallStableMarketInputs(){
 const search=$('#marketSearchInput');
 if(search){
  search.oninput=e=>{
   state.marketQuery=e.target.value;state.marketPage=1;
   clearTimeout(v085MarketInputTimer);v085MarketInputTimer=setTimeout(()=>{v085RefreshMarketRows();try{v072ScheduleSave?.(500)}catch{}},90);
  };
 }
 for(const id of ['v08MinPrice','v08MaxPrice']){
  const input=$('#'+id);if(!input)continue;
  input.oninput=e=>{
   state[id==='v08MinPrice'?'marketMinPrice':'marketMaxPrice']=e.target.value;state.marketPage=1;
   clearTimeout(v085MarketInputTimer);v085MarketInputTimer=setTimeout(()=>{v085RefreshMarketRows();try{v072ScheduleSave?.(500)}catch{}},120);
  };
 }
}
const v085RenderBuyHomeBase=v4RenderBuyHome;
v4RenderBuyHome=function(){const r=v085RenderBuyHomeBase();v085InstallStableMarketInputs();return r};

/* ---------- BOOSTER: THE NEXT CARD IS VISIBLY UNDER THE CURRENT CARD ---------- */
const v085Style=document.createElement('style');
v085Style.textContent=`
.card-stack{overflow:visible!important}
.stable-card[data-depth="0"]{transform:translate3d(0,0,0) scale(1)!important}
.stable-card[data-depth="1"]{transform:translate3d(8px,12px,0) scale(.975)!important;filter:brightness(.96)!important;opacity:1!important}
.stable-card[data-depth="2"]{transform:translate3d(14px,22px,0) scale(.95)!important;filter:brightness(.80)!important;opacity:1!important}
.stable-card[data-depth]:not([data-depth="0"]){pointer-events:none}
`;
document.head.appendChild(v085Style);

let v085SwipeRaf=0;
setupTopSwipe=function(){
 const stack=$('#cardStack'),top=stack?.querySelector('.stable-card[data-depth="0"]');if(!top)return;
 const next=stack.querySelector('.stable-card[data-depth="1"]');
 let sx=0,dx=0,drag=false,rect=null,lastX=0,lastY=0;
 const paint=()=>{
  v085SwipeRaf=0;if(!drag)return;
  const progress=clamp(Math.abs(dx)/150,0,1);
  top.style.transition='none';top.style.transform=`translate3d(${dx}px,0,0) rotate(${dx*.035}deg)`;
  const px=rect?clamp((lastX-rect.left)/rect.width*100,0,100):50,py=rect?clamp((lastY-rect.top)/rect.height*100,0,100):50;
  top.style.setProperty('--shine-x',`${px}%`);top.style.setProperty('--shine-y',`${py}%`);top.style.setProperty('--shine',`${50+dx*.18}%`);
  if(next){next.style.transition='transform .05s linear,filter .05s linear';next.style.transform=`translate3d(${8*(1-progress)}px,${12*(1-progress)}px,0) scale(${.975+.025*progress})`;next.style.filter=`brightness(${.96+.04*progress})`}
 };
 const restoreNext=()=>{if(next){next.style.transition='transform .18s ease,filter .18s ease';next.style.transform='';next.style.filter=''}};
 top.onpointerdown=e=>{drag=true;sx=e.clientX;dx=0;lastX=e.clientX;lastY=e.clientY;rect=top.getBoundingClientRect();top.setPointerCapture?.(e.pointerId)};
 top.onpointermove=e=>{if(!drag)return;dx=e.clientX-sx;lastX=e.clientX;lastY=e.clientY;if(!v085SwipeRaf)v085SwipeRaf=requestAnimationFrame(paint)};
 top.onpointerup=()=>{const was=drag;drag=false;if(v085SwipeRaf){cancelAnimationFrame(v085SwipeRaf);v085SwipeRaf=0}restoreNext();completeSwipe(top,dx,was)};
 top.onpointercancel=()=>{const was=drag;drag=false;if(v085SwipeRaf){cancelAnimationFrame(v085SwipeRaf);v085SwipeRaf=0}restoreNext();completeSwipe(top,0,was)};
};

/* ---------- BINDER: BUY IT DIRECTLY FROM THE BINDER SCREEN ---------- */
function v085WireBinderPurchase(){
 const sid=state.activeSet;if(state.binderOwned?.[sid])return;
 const grid=$('#pocketGrid');if(!grid)return;
 const product=SETS[sid]?.products?.find(p=>p.mode==='binderUnlock');if(!product)return;
 const btn=grid.querySelector('#buyBinderFromBinder')||grid.querySelector('button');if(!btn)return;
 btn.id='buyBinderFromBinder';btn.textContent=v08Mode()==='creative'?'Ajouter le classeur':`Acheter · ${money(product.price)}`;
 btn.onclick=()=>buyProduct(sid,product.id);
}
const v085RenderBinderBase=renderBinder;
renderBinder=function(){const r=v085RenderBinderBase();v085WireBinderPurchase();return r};
setTimeout(()=>{try{v085WireBinderPurchase();if(state.marketTab==='buy')v085InstallStableMarketInputs()}catch(e){console.warn('V0.8.5 UX refresh',e)}},220);
window.__voxV085Ready=true;
