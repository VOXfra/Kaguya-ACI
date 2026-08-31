'use strict';
/* V1.1.4 est référencé directement par index.html avec un nom inédit. Ce garde-fou
   contourne donc un ancien v111boot éventuellement conservé par WebView après une
   mise à jour de l'APK. Il répare immédiatement la pile de cartes puis s'assure que
   les couches Créatif 1.1.3/1.1.4 finissent réellement par être chargées.

   V1.2.3 : le vieux initData() V0.3 démarrait encore ici un chargement réseau de
   toutes les collections historiques avant que le catalogue Android local prenne
   la main. Sur une connexion faible, l'utilisateur pouvait donc rester avec l'état
   visuel/fonctionnel historique pendant plusieurs secondes. On conserve la fonction
   pour diagnostic, mais son appel final dans v03c devient un no-op. La couche
   v123fix.js fera ensuite le vrai démarrage depuis les JSON embarqués dans l'APK. */
(function v114Early(){
 if(typeof initData==='function'&&!window.__voxV123LegacyInitData){
  window.__voxV123LegacyInitData=initData;
  initData=async function(){window.__voxV123DeferredInit=true;return true};
 }
 const style=document.createElement('style');style.textContent=`
 #cardStack.card-stack>.reveal-card,#cardStack.card-stack>.reveal-card.v05-holo{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;margin:0!important;display:block!important}
 #cardStack.card-stack{position:relative!important;overflow:visible!important}
 `;document.head.appendChild(style);
 let loading113=false,loading114=false,tries=0;
 const add=(src,done)=>{const s=document.createElement('script');s.src=src;s.onload=()=>done?.();s.onerror=e=>console.error('VOX V1.1.4 early load failed',src,e);document.body.appendChild(s)};
 const tick=()=>{
  if(window.__voxV114Ready)return;
  if(window.__voxV113Ready&&!loading114){loading114=true;add('v114fix.js');return}
  if(window.__voxV112Ready&&!window.__voxV113Ready&&!loading113){loading113=true;add('v113fix.js',()=>{loading113=false;tick()});return}
  if(++tries<1200)setTimeout(tick,25);else console.error('VOX V1.1.4: couches V1.1 indisponibles après 30 s');
 };
 window.addEventListener('load',()=>setTimeout(tick,0));
})();
window.__voxV114EarlyReady=true;
