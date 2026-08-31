'use strict';
/* VOX Card Sim V1.2.15 — final native-save/UI guard. */
const V135_VERSION='1.2.15-native-save-files';
function v135RenderAuthoritativeSettings(){
 try{
  document.querySelectorAll('#v08ModeIntro,#v08ModeSettings,.v08-mode-settings,#v084ForceResetPanel,#v127ModeSettings,#v127SaveGuard,#v129ModeSettings,#v130ModeSettings').forEach(x=>x.remove());
  if(typeof v131RenderModeSettings==='function')v131RenderModeSettings();
  if(typeof v131RenderSavePanel==='function')v131RenderSavePanel();
  if(typeof v134cRender==='function')v134cRender();
  const panel=document.querySelector('#v131SavePanel');
  if(panel&&!panel.querySelector('.v135-storage-note')){
   const n=document.createElement('small');n.className='v135-storage-note';n.textContent='Stockage principal : fichier privé Android · sauvegardes séparées par mode';panel.appendChild(n);
  }
 }catch(e){console.warn('V1.2.15 settings guard',e)}
}
try{
 const base=renderSettings;
 renderSettings=function(){const r=base();v135RenderAuthoritativeSettings();return r};
}catch{}
const settingsBtn=document.getElementById('settingsBtn');if(settingsBtn)settingsBtn.addEventListener('click',()=>setTimeout(v135RenderAuthoritativeSettings,0));
setTimeout(v135RenderAuthoritativeSettings,0);
(function(){if(document.getElementById('v135Style'))return;const s=document.createElement('style');s.id='v135Style';s.textContent='.v135-storage-note{display:block;margin-top:8px;color:#7f8ca0;font-size:10px;line-height:1.4}';document.head.appendChild(s)})();
window.__voxV135Ready=true;
