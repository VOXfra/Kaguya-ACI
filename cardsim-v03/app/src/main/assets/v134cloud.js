'use strict';
/* V1.2.14 — Firestore is a backup vault, never a sync authority. */
const V134C_MODES=['realistic','ludic','creative'];
const V134C_LAST='voxCardSimV134_lastCloudBackup';
const V134C_HOUR=3600000;
let V134C_BUSY=false,V134C_RESTORE_AFTER_LOAD=false,V134C_TIMEOUT=0;

function v134cParse(raw){try{return raw?JSON.parse(raw):null}catch{return null}}
function v134cAuth(){try{return typeof v07Auth==='function'?v07Auth():v134cParse(VOXOnline?.authState?.())||{}}catch{return{}}}
function v134cSlot(mode){return v134cParse(localStorage.getItem(v131SlotKey(mode)))}
function v134cBundle(){
 const slots={},manual={};let newest=0;
 for(const mode of V134C_MODES){const d=v134cSlot(mode);if(d){slots[mode]=d;newest=Math.max(newest,Number(d.lastSavedAt)||0)}const m=v134cParse(localStorage.getItem(v131ManualKey(mode)));if(m)manual[mode]=m}
 const now=Date.now();return{kind:'vox-card-sim-backup',backupVersion:134,schemaVersion:134,lastSavedAt:now,createdAt:now,newestLocalSave:newest,activeMode:v134Mode(),slots,manual};
}
function v134cAccept(payload){
 window.__voxV134CloudPayload=payload||{exists:false};
 if(state?.online)state.online.cloudStatus=payload?.exists?'Backup disponible':'Aucun backup cloud';
 try{v134cRender()}catch{}
 if(V134C_RESTORE_AFTER_LOAD){V134C_RESTORE_AFTER_LOAD=false;setTimeout(v134cOpenRestore,0)}
}
try{v07ResolveCloud=v134cAccept}catch{}
try{v07ApplyCloudSave=json=>v134cAccept({exists:true,json,saveTime:Number(v134cParse(json)?.lastSavedAt)||0})}catch{}
try{v07KeepLocalCloud=()=>{try{VOXOnline?.setCloudWritesEnabled?.(false)}catch{};return true}}catch{}
try{v07EnableCloudWrites=()=>{try{VOXOnline?.setCloudWritesEnabled?.(false)}catch{};if(state?.online)state.online.cloudStatus='Backup uniquement'}}catch{}
window.addEventListener('vox-v134-cloud-loaded',e=>v134cAccept(e.detail||{exists:false}));
window.addEventListener('vox-v134-cloud-saved',()=>{
 if(!V134C_BUSY)return;V134C_BUSY=false;clearTimeout(V134C_TIMEOUT);localStorage.setItem(V134C_LAST,String(Date.now()));if(state?.online)state.online.cloudStatus='Backup cloud à jour';try{v134cRender()}catch{}
});

function v134cBackup(manual=false){
 if(V134C_BUSY)return false;const a=v134cAuth();if(!a?.signedIn){if(manual)toast('Backup cloud indisponible · compte non connecté');return false}
 try{
  if(typeof v132FlushAutoSave==='function')v132FlushAutoSave('cloud-backup-local');
  const bundle=v134cBundle();if(!Object.keys(bundle.slots).length)throw new Error('no-local-save');const json=JSON.stringify(bundle);
  V134C_BUSY=true;VOXOnline.setCloudWritesEnabled(true);VOXOnline.queueCloudSave(json);VOXOnline.flushCloudSave();VOXOnline.setCloudWritesEnabled(false);
  clearTimeout(V134C_TIMEOUT);V134C_TIMEOUT=setTimeout(()=>{if(V134C_BUSY){V134C_BUSY=false;if(state?.online)state.online.cloudStatus='Backup à réessayer';try{v134cRender()}catch{}}},30000);
  if(state?.online)state.online.cloudStatus='Backup en cours…';if(manual)toast('Backup cloud envoyé');v134cRender();return true;
 }catch(e){V134C_BUSY=false;try{VOXOnline?.setCloudWritesEnabled?.(false)}catch{};console.warn('V1.2.14 cloud backup',e);if(manual)toast('Backup cloud impossible');return false}
}
function v134cMaybeBackup(){
 const last=Number(localStorage.getItem(V134C_LAST))||0;if(Date.now()-last<V134C_HOUR)return false;
 const newest=V134C_MODES.reduce((n,m)=>Math.max(n,Number(v134cSlot(m)?.lastSavedAt)||0),0);if(newest<=last)return false;return v134cBackup(false);
}
window.v134BackupNow=()=>v134cBackup(true);

function v134cStats(d){if(!d)return'—';const cards=Object.keys(d.discoveredCards||{}).length,binders=Object.values(d.binderOwned||{}).filter(Boolean).length,wallet=d.gameMode==='creative'?'∞':money(Number(d.wallet)||0);return`${wallet} · ${cards} cartes · ${binders} classeurs`}
function v134cRestore(slots,modes,manual={}){
 const active=v134Mode();try{
  for(const mode of modes){const d=slots?.[mode];if(!d)continue;if(String(d.gameMode||mode)!==mode)throw new Error('mode-mismatch');const current=localStorage.getItem(v131SlotKey(mode));if(current)localStorage.setItem(V134_PREVIOUS_PREFIX+mode,current);v134WriteSlot(mode,JSON.stringify(d),false);if(manual?.[mode])localStorage.setItem(v131ManualKey(mode),JSON.stringify(manual[mode]));try{v132WriteSummary?.(mode,d)}catch{}}
  const d=v134cSlot(active);if(d){v131Apply(d,active);v134Compat(active,JSON.stringify(d))}toast('Backup restauré localement');setTimeout(()=>location.reload(),150);return true
 }catch(e){console.error('V1.2.14 cloud restore',e);toast('Restauration annulée · partie locale conservée');return false}
}
function v134cOpenRestore(){
 const p=window.__voxV134CloudPayload;if(!p?.exists||!p.json){V134C_RESTORE_AFTER_LOAD=true;try{VOXOnline.requestCloudSave();toast('Lecture du backup cloud…')}catch{V134C_RESTORE_AFTER_LOAD=false;toast('Cloud indisponible')}return}
 const obj=v134cParse(p.json);if(!obj)return toast('Backup cloud illisible');const m=$('#sellModal'),out=$('#sellContent');m.classList.remove('hidden');
 if(obj.kind==='vox-card-sim-backup'&&obj.slots){const date=new Date(Number(obj.createdAt||p.saveTime)||Date.now()).toLocaleString('fr-FR');out.innerHTML=`<span class="tag">BACKUP CLOUD</span><h2>Restaurer</h2><p>Backup du <strong>${escapeHtml(date)}</strong>. Rien n'est restauré sans ton clic.</p><div class="v134-cloud-list">${V134C_MODES.map(mode=>obj.slots[mode]?`<button class="panel" data-v134-cloud-mode="${mode}"><strong>${escapeHtml(V08_MODES?.[mode]?.label||mode)}</strong><span>${escapeHtml(v134cStats(obj.slots[mode]))}</span></button>`:'').join('')}</div><button id="v134CloudAll" class="danger-button">Restaurer les 3 parties</button><small>L'état local actuel est gardé comme copie de secours avant remplacement.</small>`;out.querySelectorAll('[data-v134-cloud-mode]').forEach(b=>b.onclick=()=>v134cRestore(obj.slots,[b.dataset.v134CloudMode],obj.manual||{}));$('#v134CloudAll').onclick=()=>v134cRestore(obj.slots,V134C_MODES.filter(x=>obj.slots[x]),obj.manual||{});return}
 const mode=V134C_MODES.includes(String(obj.gameMode))?String(obj.gameMode):null;if(!mode){out.innerHTML='<h2>Backup incompatible</h2><p>Cette ancienne copie ne peut pas être associée avec certitude à une partie.</p>';return}out.innerHTML=`<span class="tag">ANCIEN BACKUP</span><h2>${escapeHtml(V08_MODES?.[mode]?.label||mode)}</h2><p>${escapeHtml(v134cStats(obj))}</p><button id="v134CloudLegacy" class="danger-button">Restaurer cette partie</button>`;$('#v134CloudLegacy').onclick=()=>v134cRestore({[mode]:obj},[mode],{});
}
window.v134OpenCloudRestore=v134cOpenRestore;

function v134cRender(){
 const card=$('#settingsModal .modal-card');if(!card)return;$('#v07OnlinePanel')?.remove();$('#v134CloudPanel')?.remove();const a=v134cAuth(),last=Number(localStorage.getItem(V134C_LAST))||0,box=document.createElement('div');box.id='v134CloudPanel';box.className='online-settings panel';const who=a?.signedIn?(a.anonymous?'Compte temporaire Firebase':(a.email||a.displayName||'Compte Google')):'Non connecté',when=last?new Date(last).toLocaleString('fr-FR'):'Jamais';box.innerHTML=`<div class="backup-head"><strong>Sauvegardes</strong><span>${escapeHtml(who)}</span></div><p><strong>Le téléphone est la source principale.</strong> Le cloud est uniquement une copie de secours.</p><div class="v134-cloud-meta"><span>Backup automatique</span><b>Toutes les heures</b><span>Dernier backup</span><b>${escapeHtml(when)}</b></div><div class="backup-actions"><button id="v134CloudNow" class="primary">Backup maintenant</button><button id="v134CloudRestore" class="secondary">Restaurer depuis le cloud</button></div><small>Le backup contient les trois parties séparées. Il ne peut jamais remplacer une partie automatiquement.</small>`;const anchor=$('#v131SavePanel')||$('#v122SaveSettings');anchor?anchor.after(box):card.appendChild(box);$('#v134CloudNow').onclick=()=>v134cBackup(true);$('#v134CloudRestore').onclick=v134cOpenRestore;
}
const v134cSettingsBase=renderSettings;renderSettings=function(){const r=v134cSettingsBase();v134cRender();return r};
(function(){if($('#v134CloudStyle'))return;const s=document.createElement('style');s.id='v134CloudStyle';s.textContent=`.v134-cloud-meta{display:grid;grid-template-columns:1fr auto;gap:5px 12px;margin:12px 0;padding:11px;border:1px solid #29364a;border-radius:12px}.v134-cloud-meta span{color:#8d99ac;font-size:11px}.v134-cloud-meta b{font-size:11px}.v134-cloud-list{display:grid;gap:8px;margin:12px 0}.v134-cloud-list button{text-align:left;color:inherit;padding:12px}.v134-cloud-list strong,.v134-cloud-list span{display:block}.v134-cloud-list span{margin-top:4px;color:#8d99ac;font-size:11px}`;document.head.appendChild(s)})();
try{VOXOnline?.setCloudWritesEnabled?.(false)}catch{};try{v134cRender()}catch{};setInterval(v134cMaybeBackup,60000);setTimeout(v134cMaybeBackup,2500);document.addEventListener('visibilitychange',()=>{if(document.hidden)v134cMaybeBackup()},{passive:true});window.__voxV134CloudReady=true;
