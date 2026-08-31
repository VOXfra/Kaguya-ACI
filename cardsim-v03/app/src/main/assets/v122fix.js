'use strict';
/* VOX Card Sim V1.2.2 — persistence, bonus inventory and compact collection picker.
   Loaded after V1.2.1 so this layer owns the final UI/persistence contracts. */
const V122_VERSION='1.2.2-hotfix';
const V122_AUTOSAVE_KEY='voxCardSimV122_autosave';
const V122_AUTOSAVE_DEFAULT=true;
let V122_FORCE_SAVE=false;
let V122_SAVE_BASE=save;

function v122AutoSaveEnabled(){
 const raw=localStorage.getItem(V122_AUTOSAVE_KEY);
 return raw===null?V122_AUTOSAVE_DEFAULT:raw!=='0';
}
function v122SetAutoSave(enabled){
 const value=!!enabled;
 // Commit the exact state at the moment the preference changes, so disabling
 // autosave never silently throws away the state the player is looking at.
 v122ForceSave();
 localStorage.setItem(V122_AUTOSAVE_KEY,value?'1':'0');
 if(value)v122ForceSave();
 v122UpdateSaveUi();
}
function v122ForceSave(){
 V122_FORCE_SAVE=true;
 try{const r=V122_SAVE_BASE();state.__v122Dirty=false;return r}
 finally{V122_FORCE_SAVE=false;v122UpdateSaveUi()}
}
function v122Checkpoint(reason=''){
 if(v122AutoSaveEnabled())return v122ForceSave();
 state.__v122Dirty=true;state.__v122DirtyReason=reason||state.__v122DirtyReason||'modification';v122UpdateSaveUi();return null;
}
save=function(){
 if(V122_FORCE_SAVE||v122AutoSaveEnabled())return v122ForceSave();
 state.__v122Dirty=true;v122UpdateSaveUi();return null;
};
window.v122ManualSave=()=>{v122ForceSave();try{toast('Partie sauvegardée')}catch{}};
window.addEventListener('beforeunload',()=>{if(v122AutoSaveEnabled())try{v122ForceSave()}catch{}});

function v122EnsureSaveSettings(){
 const modal=$('#settingsModal .modal-card');if(!modal||$('#v122SaveSettings'))return;
 const section=document.createElement('div');section.id='v122SaveSettings';section.className='v122-save-settings';
 section.innerHTML=`<div class="setting-row"><div><strong>Sauvegarde automatique</strong><small>Sauvegarde après chaque achat, ouverture et modification importante.</small></div><label class="switch"><input id="v122AutoSave" type="checkbox"><span></span></label></div><div class="v122-save-actions"><button id="v122SaveNow" class="secondary">Sauvegarder maintenant</button><small id="v122SaveStatus"></small></div>`;
 modal.appendChild(section);
 $('#v122AutoSave').onchange=e=>v122SetAutoSave(e.target.checked);
 $('#v122SaveNow').onclick=()=>window.v122ManualSave();
 v122UpdateSaveUi();
}
function v122UpdateSaveUi(){
 const cb=$('#v122AutoSave'),status=$('#v122SaveStatus');if(cb)cb.checked=v122AutoSaveEnabled();
 if(status)status.textContent=v122AutoSaveEnabled()?'Auto · sauvegarde active':state.__v122Dirty?'Auto désactivée · modifications non sauvegardées':'Auto désactivée · état sauvegardé';
}
v122EnsureSaveSettings();
$('#settingsBtn')?.addEventListener('click',()=>setTimeout(()=>{v122EnsureSaveSettings();v122UpdateSaveUi()},0));

/* ---------- CHECKPOINTS EXPLICITES ---------- */
function v122WrapCheckpoint(name,reason){
 const base=window[name];if(typeof base!=='function'||base.__v122Wrapped)return;
 const wrapped=function(...args){
  const result=base.apply(this,args);
  if(result&&typeof result.then==='function')return result.finally(()=>v122Checkpoint(reason));
  v122Checkpoint(reason);return result;
 };
 wrapped.__v122Wrapped=true;wrapped.__v122Base=base;window[name]=wrapped;
}
for(const [name,reason] of [['buyProduct','achat boutique'],['finishPack','booster ouvert'],['startBooster','booster commencé'],['v4ReceiveCard','achat marché']])v122WrapCheckpoint(name,reason);

/* Reward boosters are normal inventory objects. Some historical paths returned a
   set id even when their lot mutation was later shadowed by another compatibility
   layer. Audit the stock delta and repair only when no booster was actually added. */
if(typeof v110GiveRandomBooster==='function'&&!v110GiveRandomBooster.__v122Wrapped){
 const v122GiftBase=v110GiveRandomBooster;
 v110GiveRandomBooster=function(source='progression'){
  const before={...(state.stock||{})},sid=v122GiftBase(source);if(!sid||!SETS?.[sid])return sid;
  const sku=boosterSku(sid),oldQty=Math.max(0,Number(before[sku])||0),now=Math.max(0,Number(stockQty(sku))||0);
  if(now<=oldQty&&typeof v06AddLot==='function')v06AddLot(sku,1,null,String(source||'bonus'));
  state.v122BonusBoosterLog=Array.isArray(state.v122BonusBoosterLog)?state.v122BonusBoosterLog:[];
  state.v122BonusBoosterLog.push({at:Date.now(),setId:sid,source:String(source||'bonus')});
  if(state.v122BonusBoosterLog.length>80)state.v122BonusBoosterLog.splice(0,state.v122BonusBoosterLog.length-80);
  v122Checkpoint('booster bonus');
  if($('#inventory')?.classList.contains('active'))try{renderInventory()}catch{}
  return sid;
 };
 v110GiveRandomBooster.__v122Wrapped=true;
}

/* Booster Chance is intentionally a special one-card pack, but it must still be
   visible in the Boosters inventory whenever the counter is non-zero. */
if(typeof renderBoosterInventory==='function'&&!renderBoosterInventory.__v122Wrapped){
 const v122BoosterInvBase=renderBoosterInventory;
 renderBoosterInventory=function(out){
  const r=v122BoosterInvBase(out);
  if(v08Mode()==='ludic'&&Number(state.luckyPacks)>0&&out&&!out.querySelector('.v08-lucky-row')){
   const e=document.createElement('div');e.className='sealed-row panel stock-row v08-lucky-row';
   e.innerHTML=`<div class="v08-lucky-pack">★</div><div class="stock-copy"><strong>Booster Chance</strong><span>Booster bonus ludique · 1 carte Rare ou mieux</span><b>×${Math.max(0,Number(state.luckyPacks)||0)}</b></div><div class="row-actions"><button class="primary">Ouvrir</button></div>`;
   e.querySelector('button').onclick=()=>v08OpenLuckyPack(state.activeSet);out.prepend(e);
  }
  return r;
 };
 renderBoosterInventory.__v122Wrapped=true;
}

/* A real Binder Collection is no longer treated as a generic storage binder. When
   such a sealed Cardmarket product is opened it grants the binder it physically
   contains, while keeping booster contents conservative unless documented. */
if(typeof openSealedSku==='function'&&!openSealedSku.__v122Wrapped){
 const v122OpenSealedBase=openSealedSku;
 openSealedSku=function(sku){
  const p=productForSku(sku),before=Math.max(0,Number(stockQty(sku))||0),r=v122OpenSealedBase(sku),after=Math.max(0,Number(stockQty(sku))||0);
  if(p?.grantsBinder&&before>after&&p.setId){state.binderOwned=state.binderOwned||{};state.binderOwned[p.setId]=true;try{reconcileBinder(p.setId)}catch{};try{renderBinder()}catch{}}
  v122Checkpoint('produit scellé ouvert');return r;
 };
 openSealedSku.__v122Wrapped=true;
}

/* ---------- MENU DÉROULANT DES COLLECTIONS ---------- */
function v122Norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-FR').replace(/[^a-z0-9]+/g,' ').trim()}
function v122Year(cfg){try{return typeof v121Year==='function'?v121Year(cfg):Number(String(cfg?.releaseDate||'').slice(0,4))}catch{return Number(String(cfg?.releaseDate||'').slice(0,4))}}
function v122AllSets(){try{return typeof v121AllSets==='function'?v121AllSets():Object.values(SETS||{})}catch{return Object.values(SETS||{})}}
function v122Products(cfg){try{return typeof v121ShopItems==='function'?v121ShopItems(cfg):cfg?.products||[]}catch{return cfg?.products||[]}}
function v122Unlocked(year){try{return typeof v121YearUnlocked==='function'?v121YearUnlocked(year):true}catch{return true}}
function v122SelectorLabel(cfg,isShop){
 const y=v122Year(cfg),count=isShop?v122Products(cfg).length:null;
 return `<span><small>${isShop?'COLLECTION BOUTIQUE':'COLLECTION'}</small><strong>${escapeHtml(cfg?.name||cfg?.id||'Choisir')}</strong></span><span class="v122-select-meta">${y||''}${isShop?` · ${count} produit${count>1?'s':''}`:''}<b>⌄</b></span>`;
}
function v122SelectSet(id,isShop,box){
 const cfg=SETS?.[id];if(!cfg)return;
 box.classList.remove('v122-open');
 if(isShop&&typeof v121SelectShopSet==='function')return v121SelectShopSet(id);
 try{selectSet(id)}catch{state.activeSet=id;try{save()}catch{};try{renderHome();renderProducts();renderBinder();updateStats()}catch{}}
}
function v122RenderSelector(box){
 if(!box)return;const isShop=!!box.closest('#shop'),active=SETS?.[state.activeSet]||v122AllSets()[0];
 box.className='set-switch v122-selector';
 box.innerHTML=`<button type="button" class="v122-select-trigger">${v122SelectorLabel(active,isShop)}</button><div class="v122-select-panel"><div class="v122-select-tools"><label>⌕<input type="search" autocomplete="off" spellcheck="false" placeholder="Rechercher une collection…"></label><select class="v122-year-filter" aria-label="Filtrer par année"><option value="all">Toutes les années</option>${[...new Set(v122AllSets().map(v122Year).filter(Boolean))].sort((a,b)=>b-a).map(y=>`<option value="${y}" ${y===v122Year(active)?'selected':''}>${y}${v122Unlocked(y)?'':' · verrouillée'}</option>`).join('')}</select></div><div class="v122-select-list"></div></div>`;
 const trigger=box.querySelector('.v122-select-trigger'),input=box.querySelector('input'),year=box.querySelector('select'),list=box.querySelector('.v122-select-list');
 const draw=()=>{
  const q=v122Norm(input.value),yf=year.value;
  const rows=v122AllSets().filter(s=>{const hay=v122Norm([s.name,s.longName,s.series,s.seriesName,s.id].filter(Boolean).join(' '));return(!q||q.split(/\s+/).every(x=>hay.includes(x)))&&(q||yf==='all'||String(v122Year(s))===yf)});
  list.innerHTML=rows.map(s=>{const y=v122Year(s),locked=isShop&&!v122Unlocked(y),count=isShop?v122Products(s).length:0;return `<button type="button" class="v122-option ${s.id===state.activeSet?'active':''} ${locked?'locked':''}" data-v122-set="${escapeHtml(s.id)}"><span><strong>${escapeHtml(s.name||s.id)}</strong><small>${escapeHtml(s.seriesName||s.series||'')}${isShop?` · ${count} produit${count>1?'s':''}`:''}</small></span><em>${locked?'🔒 ':''}${y||''}</em></button>`}).join('')||'<div class="v122-no-result">Aucune collection trouvée</div>';
  list.querySelectorAll('[data-v122-set]').forEach(b=>b.onclick=e=>{e.preventDefault();v122SelectSet(b.dataset.v122Set,isShop,box)});
 };
 trigger.onclick=e=>{e.preventDefault();e.stopPropagation();const open=!box.classList.contains('v122-open');document.querySelectorAll('.v122-selector.v122-open').forEach(x=>x.classList.remove('v122-open'));box.classList.toggle('v122-open',open);if(open){setTimeout(()=>input.focus(),0);draw()}};
 input.oninput=()=>{if(input.value)year.value='all';draw()};year.onchange=draw;draw();
}
renderSetSwitches=function(){$$('[data-set-switch]').forEach(v122RenderSelector)};
document.addEventListener('click',e=>{if(!e.target.closest('.v122-selector'))document.querySelectorAll('.v122-selector.v122-open').forEach(x=>x.classList.remove('v122-open'))});

/* Repaint immediately because V1.2.1 may already have rendered its chip rows. */
try{renderSetSwitches()}catch{}

(function v122Styles(){
 if($('#v122Styles'))return;const s=document.createElement('style');s.id='v122Styles';s.textContent=`
 .v122-save-settings{margin-top:18px;padding-top:14px;border-top:1px solid #273143}.v122-save-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px}.v122-save-actions button{flex:1;min-width:180px}.v122-save-actions small{color:#8f9aad}
 .v122-selector{position:relative;z-index:18;margin-bottom:18px}.v122-select-trigger{width:100%;min-height:74px;border:1px solid #28364a;background:linear-gradient(145deg,#111a27,#0d141f);border-radius:20px;padding:14px 18px;color:#f5f7fb;display:flex;justify-content:space-between;align-items:center;gap:14px;text-align:left;box-shadow:0 12px 30px rgba(0,0,0,.18)}.v122-select-trigger span:first-child{display:flex;flex-direction:column;min-width:0}.v122-select-trigger small{font-size:11px;letter-spacing:.14em;color:#8490a4;font-weight:800}.v122-select-trigger strong{font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v122-select-meta{color:#f8c34a;font-size:13px;white-space:nowrap}.v122-select-meta b{font-size:20px;margin-left:7px;display:inline-block;transition:transform .18s}.v122-open .v122-select-meta b{transform:rotate(180deg)}
 .v122-select-panel{display:none;position:absolute;left:0;right:0;top:calc(100% + 8px);background:#0d141f;border:1px solid #2a384c;border-radius:20px;box-shadow:0 22px 60px rgba(0,0,0,.55);overflow:hidden;z-index:80}.v122-open .v122-select-panel{display:block}.v122-select-tools{padding:12px;border-bottom:1px solid #243044;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px}.v122-select-tools label{display:flex;align-items:center;gap:8px;background:#101a28;border:1px solid #2b3a50;border-radius:13px;padding:0 12px;color:#f2bd48}.v122-select-tools input{width:100%;min-width:0;background:transparent;border:0;outline:0;color:#f5f7fb;padding:12px 0;font-size:14px}.v122-year-filter{background:#101a28;border:1px solid #2b3a50;color:#d9e0eb;border-radius:13px;padding:0 11px;max-width:150px}.v122-select-list{max-height:min(52vh,460px);overflow:auto;padding:8px}.v122-option{width:100%;border:0;background:transparent;color:#dce3ee;border-radius:13px;padding:11px 12px;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left}.v122-option:hover,.v122-option:focus{background:#172335}.v122-option.active{background:#1d2a3d;box-shadow:inset 3px 0 #f5bd42}.v122-option.locked{opacity:.68}.v122-option span{display:flex;flex-direction:column;min-width:0}.v122-option strong{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v122-option small{font-size:11px;color:#8490a4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v122-option em{font-style:normal;color:#f0bd49;font-size:12px;white-space:nowrap}.v122-no-result{padding:24px;text-align:center;color:#8793a6}
 @media(max-width:620px){.v122-select-trigger{min-height:68px;padding:12px 14px;border-radius:17px}.v122-select-trigger strong{font-size:16px}.v122-select-tools{grid-template-columns:1fr}.v122-year-filter{height:42px;max-width:none}.v122-select-list{max-height:48vh}}
 `;document.head.appendChild(s)})();

window.__voxV122Ready=true;
