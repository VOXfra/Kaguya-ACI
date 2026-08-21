'use strict';

/* VOX Card Sim V1.0.8 — boutique 2026 uniquement, offres Archives rares,
   produits 2026 réels et garde-fou de changement de mode. Cette couche reste
   additive pour préserver les sauvegardes V1.0.7. */
const V108_VERSION='1.0.8';
const V108_RETAIL_YEAR=2026;
const V108_ARCHIVE_ONE_DAY_IN=8;
const V108_EVENT_SCHEMA=108;
const V108_MODE_SWITCH_MARKER='voxCardSimV108_modeSwitch';

function v108SetYear(s){
 try{if(typeof v107SetYear==='function')return v107SetYear(s)}catch{}
 const y=Number(s?.releaseYear)||Number(String(s?.releaseDate||'').slice(0,4));
 return Number.isFinite(y)&&y>2000?y:null;
}
function v108RetailIds(){return Object.values(SETS||{}).filter(s=>v108SetYear(s)===V108_RETAIL_YEAR&&(!window.v090SetUnlocked||v090SetUnlocked(s.id))).map(s=>s.id)}
function v108ArchiveIds(){return Object.values(SETS||{}).filter(s=>{const y=v108SetYear(s);return y&&y<V108_RETAIL_YEAR}).map(s=>s.id)}
function v108SeedIndex(seed,len){return len?Number(v08Hash32(seed)%len):0}
function v108ArchiveDay(day){const ids=v108ArchiveIds();return!!ids.length&&v08Hash32(day*92821+108)%V108_ARCHIVE_ONE_DAY_IN===0}
function v108FindProduct(setId,id){return SETS[setId]?.products?.find(p=>p.id===id)||null}
function v108PatchProduct(setId,id,patch){const p=v108FindProduct(setId,id);if(p)Object.assign(p,patch);return p}
function v108UnitProduct(cfg){return cfg?.products?.find(p=>p.mode==='loose'&&Number(p.qty)===1)||null}
function v108BundleProduct(cfg){return cfg?.products?.find(p=>Number(p.opens)===6&&/bundle|lot de boosters/i.test(String(p.kind||p.name||'')))||cfg?.products?.find(p=>p.mode==='loose'&&Number(p.qty)===6)||null}

/* ---------- PRODUITS 2026 : vrais visuels et emballages cohérents ---------- */
const V108_OPENING_PACK_ART={
 'me02.5':'https://www.hamacards.com/wp-content/uploads/booster_me2.5_2.webp',
 'me03':'https://www.mondes-fantastiques.com/43376-large_default/pokemon-equilibre-parfait-booster.jpg',
 'me04':'https://www.bcd-jeux.fr/83735-pdt_771/pokemon-me04-chaos-ascendant-booster-a-l-unite-pokemon.jpg',
 'me05':'https://www.agorajeux.com/57889-large_default/pokemon-me05-booster-nuit-noire.jpg'
};
const V108_BINDER_ART={
 'me02.5':'https://ultrapro.com/cdn/shop/files/16823_9PktPort_PKM_ME2-Spread.png?v=1770245317&width=900',
 'me03':'https://ultrapro.com/cdn/shop/files/16724_Port_9PKT_PKM_ME03_Spread_8c227ea2-7b85-4064-8d1e-6e6e501a5665.jpg?v=1775585796&width=900',
 'me04':'https://ultrapro.com/cdn/shop/files/16726_Port_9PKT_PKM_ME04_Spread.png?v=1781223280&width=900',
 'me05':'https://ultrapro.com/cdn/shop/files/16922_9PKTPort_PKM_ME05_Spread.png?v=1784320169&width=900'
};
const V108_BINDER_NAMES={
 'me02.5':'Portfolio Héros Transcendants — 9 poches',
 'me03':'Portfolio Équilibre Parfait — 9 poches',
 'me04':'Portfolio Chaos Ascendant — 9 poches',
 'me05':'Portfolio Nuit Noire — 9 poches'
};

function v108Apply2026Products(){
 /* Héros Transcendants est un set spécial : pas de display 36 boosters ni de
    booster unitaire en vente normale. On conserve ces SKU uniquement pour la
    compatibilité des anciennes sauvegardes et le marché secondaire. */
 v108PatchProduct('me02.5','me02.5-booster',{shopHidden:true,image:V108_OPENING_PACK_ART['me02.5']});
 v108PatchProduct('me02.5','me02.5-lot6',{name:'Bundle de 6 boosters Héros Transcendants',subtitle:'Produit scellé · 6 boosters à l’ouverture',kind:'Booster Bundle',mode:'sealed',opens:6,qty:undefined});
 v108PatchProduct('me02.5','me02.5-display',{shopHidden:true,marketHidden:true,retiredCatalog:true});

 for(const sid of ['me03','me04']){
  const id=`${sid}-lot6`;v108PatchProduct(sid,id,{name:`Bundle de 6 boosters ${SETS[sid]?.name||sid}`,subtitle:'Produit scellé · 6 boosters à l’ouverture',kind:'Booster Bundle',mode:'sealed',opens:6,qty:undefined});
 }
 v108PatchProduct('me05','pbl-lot6',{name:'Bundle de 6 boosters Nuit Noire',subtitle:'Produit scellé · 6 boosters à l’ouverture',kind:'Booster Bundle',mode:'sealed',opens:6,qty:undefined});

 for(const sid of Object.keys(V108_BINDER_ART)){
  const s=SETS[sid];if(!s)continue;const p=s.products?.find(x=>x.mode==='binderUnlock');if(!p)continue;
  Object.assign(p,{name:V108_BINDER_NAMES[sid],subtitle:'Portfolio Ultra PRO officiel · 9 poches · jusqu’à 252 cartes',kind:'Classeur',price:15.99,image:V108_BINDER_ART[sid],binderCapacity:252,binderPages:28,v108OfficialBinder:true});
  if(typeof V061_BINDERS!=='undefined')V061_BINDERS[sid]={name:p.name,subtitle:p.subtitle,image:p.image,capacity:252,pages:28};
 }
 /* Le booster utilisé pendant l'ouverture est indépendant de la photo de vente. */
 for(const [sid,url] of Object.entries(V108_OPENING_PACK_ART)){const p=v108UnitProduct(SETS[sid]);if(p)p.packArt=url}
}
v108Apply2026Products();

const v108OpeningPackImageBase=openingPackImage;
openingPackImage=function(setId){const p=v108UnitProduct(SETS[setId]);return p?.packArt||V108_OPENING_PACK_ART[setId]||v108OpeningPackImageBase(setId)};

/* Le faux display Héros Transcendants reste résolvable pour les anciennes saves,
   mais il ne doit plus apparaître comme un produit réel dans le Marketplace. */
const v108MarketAssetsBase=v08MarketAssets;
v08MarketAssets=function(query){const arr=v108MarketAssetsBase(query);return Array.isArray(arr)?arr.filter(a=>a.type!=='sealed'||!productById(a.productId)?.marketHidden):arr};

/* Les scans dédiés à l'ouverture doivent aussi faire partie du pack hors-ligne.
   V1.0.7 ne connaissait que product.image et aurait sinon oublié packArt. */
const v108OfflineManifestBase=v05OfflineManifest;
v05OfflineManifest=function(setId){
 const arr=v108OfflineManifestBase(setId)||[],pack=V108_OPENING_PACK_ART[setId];
 return pack&&!arr.includes(pack)?[...arr,pack]:arr;
};

/* ---------- BOUTIQUE : rotation normale exclusivement 2026 ---------- */
v08HourInfo=function(now=Date.now()){
 const ids=v108RetailIds(),step=typeof V105_ROTATION_MS==='number'?V105_ROTATION_MS:15*60*1000,slot=Math.floor(now/step),day=Math.floor(now/V08_DAY);
 if(!ids.length)return{setId:'me05',next:(slot+1)*step,day,hour:0,slot};
 const within=Math.floor((now%V08_DAY)/step),cycle=Math.floor(within/ids.length),order=v08SeededShuffle(ids,day*101+cycle*7919);
 return{setId:order[within%ids.length]||ids[0],next:(slot+1)*step,day,hour:within,slot};
};

/* Une offre Archive n'apparaît qu'environ un jour sur huit. Les autres jours,
   l'offre quotidienne reste sur une collection 2026. */
v08DailyEvent=function(now=Date.now()){
 const day=Math.floor(now/V08_DAY),id=`event-${day}`,start=day*V08_DAY,end=start+V08_DAY,old=state.eventCatalog?.[id];
 if(old?.v108EventSchema===V108_EVENT_SCHEMA)return old;
 const archive=v108ArchiveDay(day),ids=archive?v108ArchiveIds():v108RetailIds();if(!ids.length)return null;
 const sid=ids[v108SeedIndex(day*31337+(archive?8108:1080),ids.length)],cfg=SETS[sid];if(!cfg)return null;
 const unit=v108UnitProduct(cfg),bundle=v108BundleProduct(cfg),price=Number((Math.max(29.99,(Number(unit?.marketTrend||unit?.price)||5.99)*6.6)).toFixed(2));
 const p={id,setId:sid,name:archive?`Retour Archive — ${cfg.name}`:`Édition limitée du jour — ${cfg.name}`,subtitle:archive?'Retour exceptionnel 24 h · 6 boosters · limite 1':'Drop exclusif 24 h · 6 boosters · limite 1',kind:archive?'OFFRE ARCHIVE':'ÉDITION LIMITÉE',price,mode:'sealed',opens:6,image:bundle?.image||unit?.image||'',eventEdition:true,eventStart:start,eventEnd:end,eventDay:day,v108EventSchema:V108_EVENT_SCHEMA,v108Archive:archive};
 if(!p.image&&typeof v106GeneratedArt==='function')p.image=v106GeneratedArt(sid,cfg.name,{...p,kind:'Lot de boosters',qty:6,mode:'loose'});
 state.eventCatalog??={};state.eventCatalog[id]=p;return p;
};

/* Même en Créatif, une collection antérieure à 2026 n'expose pas librement ses
   boosters/scellés. Le classeur reste accessible pour ranger les cartes obtenues
   via Marketplace ou offre Archive. Les produits 2026 retirés du catalogue réel
   (ex. faux display ME2.5) sont également masqués. */
const v108RenderProductsBase=renderProducts;
renderProducts=function(){
 const sid=state.activeSet,cfg=SETS[sid];if(!cfg)return v108RenderProductsBase();
 const archive=v08Mode()==='creative'&&v108SetYear(cfg)!==V108_RETAIL_YEAR,all=cfg.products||[],allowed=archive?all.filter(p=>p.mode==='binderUnlock'):all.filter(p=>!p.shopHidden);cfg.products=allowed;
 let r;try{r=v108RenderProductsBase()}finally{cfg.products=all}
 const grid=$('#productGrid');if(archive&&grid&&!grid.querySelector('.v108-archive-note'))grid.insertAdjacentHTML('afterbegin',`<div class="panel v108-archive-note"><strong>Collection Archive</strong><span>Les boosters et produits scellés de ${escapeHtml(cfg.name)} ne sont pas en libre accès. Ils passent par le Marketplace ou par les rares offres Archive du jour.</span></div>`);
 return r;
};

const v108BuyProductBase=buyProduct;
buyProduct=function(setId,productId){
 const p=productById(productId),cfg=SETS[setId];if(!p||!cfg)return v108BuyProductBase(setId,productId);
 if(p.shopHidden)return toast('Ce produit n’est pas vendu directement dans la boutique');
 if(v108SetYear(cfg)!==V108_RETAIL_YEAR&&!p.eventEdition&&p.mode!=='binderUnlock')return toast('Collection Archive · produit disponible via Marketplace ou offre du jour');
 return v108BuyProductBase(setId,productId);
};

/* ---------- MODE DE JEU : le sélecteur reste toujours disponible ---------- */
function v108Mode(){try{return typeof v084ActiveMode==='function'?v084ActiveMode():v08Mode()}catch{return'realistic'}}
function v108InstallModePanel(){
 const card=$('#settingsModal .modal-card');if(!card)return;$('#v108BootModeSettings')?.remove();$('#v08ModeSettings')?.remove();$('#v108ModeSettings')?.remove();
 const current=v108Mode(),sec=document.createElement('div');sec.id='v108ModeSettings';sec.className='v08-mode-settings panel';
 sec.innerHTML=`<span class="tag">MODE DE JEU</span><h3>${escapeHtml(V08_MODES[current]?.label||current)}</h3><p>Chaque mode garde sa propre progression. Le changement de mode recharge toujours l'interface actuelle avant de rouvrir les réglages.</p><div class="v08-mode-grid">${Object.entries(V08_MODES).map(([id,m])=>`<button data-v108-mode="${id}" class="${id===current?'active':''}"><strong>${escapeHtml(m.label)}</strong><span>${escapeHtml(m.desc)}</span></button>`).join('')}</div>`;
 card.appendChild(sec);sec.querySelectorAll('[data-v108-mode]').forEach(b=>b.onclick=()=>v08SwitchMode(b.dataset.v108Mode));
}
const v108RenderSettingsBase=renderSettings;
renderSettings=function(){const r=v108RenderSettingsBase();v108InstallModePanel();return r};
v08SwitchMode=function(mode){if(!V08_MODES[mode]||mode===v108Mode())return;try{state.gameMode=v108Mode();save()}catch(e){console.warn('V1.0.8 save before mode switch',e)}if(typeof window.v108BootSwitchMode==='function')return window.v108BootSwitchMode(mode);return toast('Changement de mode indisponible · redémarre l’application')};
const v108SettingsBtn=$('#settingsBtn');if(v108SettingsBtn)v108SettingsBtn.addEventListener('click',()=>setTimeout(()=>{try{v108InstallModePanel()}catch{}},0));
try{const m=JSON.parse(localStorage.getItem(V108_MODE_SWITCH_MARKER)||'null');if(m?.mode===v108Mode())localStorage.removeItem(V108_MODE_SWITCH_MARKER)}catch{}

const v108Style=document.createElement('style');v108Style.textContent=`
.v108-archive-note{grid-column:1/-1;display:flex;flex-direction:column;gap:5px;padding:14px 16px;border-color:#4b3d22}.v108-archive-note strong{color:#ffd05a}.v108-archive-note span{font-size:12px;line-height:1.45;color:#9aa6b8}
#sealedPack>img#packArt{object-fit:cover!important;object-position:center!important;background:transparent!important}
.binder-product-img,.product-photo[src*="ultrapro.com/cdn/shop/files/"]{object-fit:contain!important;background:transparent!important;padding:4px}
#v108ModeSettings{margin-top:14px}#v108ModeSettings .v08-mode-grid{display:grid;gap:8px;margin-top:10px}#v108ModeSettings .v08-mode-grid button{display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:4px;padding:12px;border:1px solid #2d394a;border-radius:12px;background:#101720;color:#f4f6fa}#v108ModeSettings .v08-mode-grid button.active{border-color:#efb93c;box-shadow:0 0 0 1px #efb93c33 inset}#v108ModeSettings .v08-mode-grid span{font-size:11px;line-height:1.35;color:#929eaf}
`;
document.head.appendChild(v108Style);

setTimeout(()=>{try{v108Apply2026Products();v108InstallModePanel();renderProducts();v08RefreshModePill?.()}catch(e){console.warn('V1.0.8 final refresh',e)}},120);
window.__voxV108Ready=true;
