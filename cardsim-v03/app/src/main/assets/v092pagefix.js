'use strict';

/* VOX Card Sim V0.9.2 — binder page-turn cleanup.
   V0.9 replaced v08TurnBinder but forgot to clear the real .binder-page
   transform left by the drag gesture before rendering the next page. */
const V092_VERSION='0.9.2';

function v092ResetRealBinderPage(page){
 if(!page)return;
 page.style.transition='none';
 page.style.transform='';
 page.style.transformOrigin='';
 page.style.filter='';
 page.style.willChange='';
}

function v092CleanupTurn(sheet){
 try{sheet?.remove()}catch{}
 const page=$('#binderShell .binder-page');
 v092ResetRealBinderPage(page);
 v08BinderBusy=false;
 v08BinderDrag=null;
 try{v08BindBinderGestures()}catch{}
}

v08TurnBinder=function(dir,startAngle=0){
 if(v08BinderBusy||!v08BinderCanTurn(dir))return;
 const page=$('#binderShell .binder-page');if(!page)return;
 v08BinderBusy=true;
 const sheet=v08CreateTurnSheet(page,dir,startAngle);

 /* Critical fix: the real page is the element that was rotated during drag.
    Reset it BEFORE v090RenderBinderCore swaps the pocket contents. */
 v092ResetRealBinderPage(page);
 // Force WebView to commit the reset before content changes.
 void page.offsetWidth;

 const sid=state.activeSet;
 state.pageBySet[sid]=clamp((state.pageBySet[sid]||0)+dir,0,v090BinderPages(sid)-1);
 v090RenderBinderCore();
 const livePage=$('#binderShell .binder-page');
 v092ResetRealBinderPage(livePage);
 vibrate(8);

 const end=dir>0?-178:178;
 let done=false;
 const cleanup=()=>{if(done)return;done=true;v092CleanupTurn(sheet)};
 try{
  const anim=sheet.animate([
   {transform:`rotateY(${startAngle}deg)`,filter:'brightness(1)'},
   {offset:.52,filter:'brightness(.72)'},
   {transform:`rotateY(${end}deg)`,filter:'brightness(.9)'}
  ],{duration:420,easing:'cubic-bezier(.22,.72,.16,1)',fill:'forwards'});
  anim.onfinish=cleanup;
  anim.oncancel=cleanup;
 }catch(e){
  console.warn('V0.9.2 binder animation fallback',e);
  cleanup();
  return;
 }
 // Android WebView can occasionally skip finish/cancel callbacks.
 setTimeout(cleanup,700);
};

/* Also make aborted drags incapable of leaving the real page rotated. */
const v092CancelDragBase=v08CancelBinderDrag;
v08CancelBinderDrag=function(page){
 if(!page)return;
 try{return v092CancelDragBase(page)}finally{
  setTimeout(()=>v092ResetRealBinderPage(page),230);
 }
};

/* Repair a page that was already stuck before this layer loaded. */
requestAnimationFrame(()=>v092ResetRealBinderPage($('#binderShell .binder-page')));
window.__voxV092PageFixReady=true;
