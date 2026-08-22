'use strict';

/* V0.8 tactile binder: real drag gesture + 3D page turn. */
const v08RenderBinderBase=renderBinder;
let v08BinderBusy=false,v08BinderDrag=null;
function v08BinderPages(setId){return V061_BINDERS?.[setId]?.pages||40}
function v08BinderCanTurn(dir){const sid=state.activeSet,p=Number(state.pageBySet?.[sid]||0),max=v08BinderPages(sid)-1;return!!state.binderOwned?.[sid]&&(dir>0?p<max:p>0)}
function v08StripIds(root){root.removeAttribute?.('id');root.querySelectorAll?.('[id]').forEach(x=>x.removeAttribute('id'))}
function v08CreateTurnSheet(page,dir,startAngle=0){
 const shell=$('#binderShell'),sheet=document.createElement('div'),front=page.cloneNode(true),back=document.createElement('div');v08StripIds(front);sheet.className='v08-turn-sheet';front.classList.add('v08-turn-front');back.className='v08-turn-back';back.innerHTML='<div class="v08-page-back-grid">'+Array.from({length:9},()=>'<i></i>').join('')+'</div>';sheet.append(front,back);sheet.style.transformOrigin=dir>0?'left center':'right center';sheet.style.transform=`rotateY(${startAngle}deg)`;shell.appendChild(sheet);return sheet;
}
function v08TurnBinder(dir,startAngle=0){
 if(v08BinderBusy||!v08BinderCanTurn(dir))return;const page=$('#binderShell .binder-page');if(!page)return;v08BinderBusy=true;const sheet=v08CreateTurnSheet(page,dir,startAngle);page.style.transform='';page.style.transition='';const sid=state.activeSet;state.pageBySet[sid]=clamp((state.pageBySet[sid]||0)+dir,0,v08BinderPages(sid)-1);v08RenderBinderBase();vibrate(8);
 const end=dir>0?-178:178,anim=sheet.animate([{transform:`rotateY(${startAngle}deg)`,filter:'brightness(1)'},{offset:.52,filter:'brightness(.72)'},{transform:`rotateY(${end}deg)`,filter:'brightness(.9)'}],{duration:420,easing:'cubic-bezier(.22,.72,.16,1)',fill:'forwards'});anim.onfinish=()=>{sheet.remove();v08BinderBusy=false;v08BindBinderGestures()};anim.oncancel=()=>{sheet.remove();v08BinderBusy=false;v08BindBinderGestures()};
}
function v08CancelBinderDrag(page){if(!page)return;page.style.transition='transform 180ms cubic-bezier(.22,.72,.16,1)';page.style.transform='rotateY(0deg)';setTimeout(()=>{page.style.transition='';page.style.transform=''},190)}
function v08BindBinderGestures(){
 const shell=$('#binderShell'),page=shell?.querySelector('.binder-page'),prev=$('#prevPage'),next=$('#nextPage');if(!shell||!page)return;
 if(prev)prev.onclick=()=>v08TurnBinder(-1,0);if(next)next.onclick=()=>v08TurnBinder(1,0);
 shell.onpointerdown=e=>{if(v08BinderBusy||!state.binderOwned?.[state.activeSet])return;v08BinderDrag={id:e.pointerId,x:e.clientX,dx:0};try{shell.setPointerCapture(e.pointerId)}catch{}page.style.transition='none'};
 shell.onpointermove=e=>{if(!v08BinderDrag||v08BinderDrag.id!==e.pointerId||v08BinderBusy)return;const dx=e.clientX-v08BinderDrag.x;v08BinderDrag.dx=dx;const dir=dx<0?1:-1;if(!v08BinderCanTurn(dir)){page.style.transform=`translateX(${dx*.08}px)`;return}const progress=clamp(Math.abs(dx)/Math.max(140,shell.clientWidth*.42),0,.62),angle=(dir>0?-1:1)*progress*92;page.style.transformOrigin=dir>0?'left center':'right center';page.style.transform=`rotateY(${angle}deg) translateZ(1px)`};
 const finish=e=>{if(!v08BinderDrag)return;const dx=v08BinderDrag.dx;v08BinderDrag=null;const dir=dx<0?1:-1,threshold=Math.max(54,shell.clientWidth*.12);if(Math.abs(dx)>=threshold&&v08BinderCanTurn(dir)){const progress=clamp(Math.abs(dx)/Math.max(140,shell.clientWidth*.42),0,.62),angle=(dir>0?-1:1)*progress*92;v08TurnBinder(dir,angle)}else v08CancelBinderDrag(page)};
 shell.onpointerup=finish;shell.onpointercancel=()=>{v08BinderDrag=null;v08CancelBinderDrag(page)};
}
renderBinder=function(){v08RenderBinderBase();requestAnimationFrame(v08BindBinderGestures)};
setTimeout(()=>{try{renderBinder()}catch(e){console.warn('V0.8 binder',e)}},220);
