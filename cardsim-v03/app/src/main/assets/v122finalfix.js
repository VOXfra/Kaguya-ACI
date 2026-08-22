'use strict';
/* Final glue for V1.2.2.
   v121RenderShopSwitch() is called directly by the V1.2.1 renderProducts function,
   so point it at the new dropdown renderer after every historical layer is loaded. */
(function v122FinalGlue(){
 if(typeof v122RenderSelector==='function'){
  window.v121RenderShopSwitch=function(box=$('#shop [data-set-switch]')){if(box)v122RenderSelector(box)};
  window.renderSetSwitches=function(){$$('[data-set-switch]').forEach(v122RenderSelector)};
 }
 try{renderSetSwitches()}catch(e){console.warn('V1.2.2 dropdown repaint',e)}
 try{if($('#shop')?.classList.contains('active'))renderProducts()}catch(e){console.warn('V1.2.2 shop repaint',e)}
})();
window.__voxV122FinalReady=true;
