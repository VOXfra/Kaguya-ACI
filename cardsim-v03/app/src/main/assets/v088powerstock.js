'use strict';

/* V0.8.8 — Eevee offline repair, low-power mode and hourly official-store stock. */
const V088_BATTERY_KEY='voxCardSimV088_batterySaver';
const V088_STOCK_VERSION=1;

state.settings=state.settings&&typeof state.settings==='object'?state.settings:{};
state.storeHourlyPurchases=state.storeHourlyPurchases&&typeof state.storeHourlyPurchases==='object'?state.storeHourlyPurchases:{};
try{
 const stored=localStorage.getItem(V088_BATTERY_KEY);
 if(stored!==null)state.settings.batterySaver=stored==='1';
 else if(typeof state.settings.batterySaver!=='boolean')state.settings.batterySaver=false;
}catch{if(typeof state.settings.batterySaver!=='boolean')state.settings.batterySaver=false}

/* ---------- OFFLINE: S6A DATA/PRICES ARE EMBEDDED, ONLY 101 SCANS NEED HTTP ---------- */
const v088OfflineManifestBase=v05OfflineManifest;
v05OfflineManifest=function(setId){
 if(setId!=='s6a')return v088OfflineManifestBase(setId);
 const cards=cardsFor('s6a');
 if(!state.metaReady?.s6a||cards.length!==101)throw new Error(`eevee-not-ready-${cards.length}`);
 const urls=new Set();
 for(const c of cards){
  const raw=String((typeof v05BaseCardImg==='function'?v05BaseCardImg(c,'high'):cardImg(c,'high'))||'').trim();
  if(/^https:\/\//i.test(raw))urls.add(raw);
 }
 if(urls.size!==101)throw new Error(`eevee-scan-manifest-${urls.size}/101`);
 return [...urls];
};

/* ---------- BATTERY SAVER ---------- */
function v088BatteryOn(){return !!state.settings?.batterySaver}
function v088ApplyBatteryMode(){
 const on=v088BatteryOn();document.documentElement.classList.toggle('v088-battery',on);
 try{localStorage.setItem(V088_BATTERY_KEY,on?'1':'0')}catch{}
}

const v088VibrateBase=vibrate;
vibrate=function(pattern=8){if(v088BatteryOn())return;return v088VibrateBase(pattern)};

/* DeviceOrientation is the hottest continuous JS path while a holo card is visible.
   A capture listener prevents the existing gyro renderer from receiving events in low-power mode. */
window.addEventListener('deviceorientation',e=>{if(v088BatteryOn())e.stopImmediatePropagation()},true);

/* Keep the market alive, but avoid four complete save/render passes per minute in low-power mode. */
const v088ProcessMarketBase=processMarket;
let v088LastMarketRun=0;
processMarket=function(initial=false){
 if(!v088BatteryOn()||initial)return v088ProcessMarketBase(initial);
 const now=Date.now();if(now-v088LastMarketRun<60000)return;
 v088LastMarketRun=now;return v088ProcessMarketBase(false);
};

function v088InjectBatterySetting(){
 const card=$('#settingsModal .modal-card');if(!card)return;
 let box=card.querySelector('.v088-battery-block');
 if(!box){
  box=document.createElement('div');box.className='v088-battery-block';
  box.innerHTML=`<div class="settings-divider"></div><span class="tag">BATTERIE</span><div class="setting-row"><div><strong>Économie de batterie</strong><small>Réduit les effets holo/gyro, les animations continues, les flous et la fréquence des traitements du marché. Le gameplay reste identique.</small></div><label class="switch"><input id="v088BatterySaver" type="checkbox"><span></span></label></div>`;
  const offline=card.querySelector('.offline-settings');if(offline)card.insertBefore(box,offline);else card.appendChild(box);
 }
 const input=box.querySelector('#v088BatterySaver');if(input){input.checked=v088BatteryOn();input.onchange=()=>{state.settings.batterySaver=!!input.checked;v088ApplyBatteryMode();save();toast(input.checked?'Économie de batterie activée':'Économie de batterie désactivée')}}
}
const v088RenderSettingsBase=renderSettings;
renderSettings=function(){const r=v088RenderSettingsBase();v088InjectBatterySetting();v088ApplyBatteryMode();return r};

const v088Style=document.createElement('style');
v088Style.textContent=`
.v088-battery-block .setting-row{margin-top:10px}.v088-battery-block .setting-row small{display:block;color:var(--muted);font-size:10px;line-height:1.45;margin-top:4px;max-width:330px}
html.v088-battery .foil-noise,html.v088-battery .gesture-hint,html.v088-battery .v05-holo .holo-spectrum{animation:none!important}
html.v088-battery .v05-holo .holo-spectrum{filter:none!important;opacity:.48!important}
html.v088-battery .topbar,html.v088-battery .bottom-nav,html.v088-battery .modal-backdrop{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
html.v088-battery .panel,html.v088-battery .reveal-card,html.v088-battery .sealed-pack,html.v088-battery .modal-visual img{box-shadow:none!important}
.v088-stock-line{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:-5px 0 10px;font-size:10px;color:#9eabbb}.v088-stock-line b{color:#dce4ef}.v088-stock-line.low b{color:#ffd36a}.v088-stock-line.out b{color:#ff7d7d}.v088-stock-badge{display:inline-flex;border:1px solid #344358;border-radius:999px;padding:4px 8px;font-size:9px;font-weight:850;letter-spacing:.04em}.v088-stock-badge.out{border-color:#743b44;color:#ff9292;background:#34171d}.v088-stock-badge.unlimited{color:#9cc9a9;border-color:#355744}
`;
document.head.appendChild(v088Style);
v088ApplyBatteryMode();

/* ---------- HOURLY OFFICIAL STORE STOCK ---------- */
function v088StringHash(text){let h=2166136261>>>0;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function v088HourIndex(now=Date.now()){return Math.floor(now/V08_HOUR)}
function v088UnlimitedRetail(p){return !!p&&p.mode==='loose'&&(Number(p.qty)===1||Number(p.qty)===6)}
function v088LimitedRetail(p){return !!p&&!p.eventEdition&&!v088UnlimitedRetail(p)&&(p.mode==='sealed'||p.mode==='binderUnlock')}
function v088StockKey(p,hour=v088HourIndex()){return `${v08Mode()}|${hour}|${p.setId}|${p.id}`}
function v088StockBand(p){
 if(p.mode==='binderUnlock')return{min:4,max:8,zero:0};
 const opens=Math.max(0,Number(p.opens)||0),kind=String(p.kind||'').toLowerCase();
 if(opens>=30||kind.includes('display')||kind.includes('booster box'))return{min:1,max:3,zero:20};
 if(opens>=16||kind.includes('ultra-premium')||kind.includes('upc'))return{min:1,max:2,zero:18};
 if(opens>=9||kind.includes('etb')||kind.includes('dresseur'))return{min:2,max:5,zero:12};
 if(opens>=6||kind.includes('bundle'))return{min:3,max:7,zero:9};
 return{min:2,max:6,zero:10};
}
function v088HourlyCap(p,hour=v088HourIndex()){
 if(!v088LimitedRetail(p))return Infinity;
 const band=v088StockBand(p),seed=v088StringHash(`${V088_STOCK_VERSION}|${hour}|${p.setId}|${p.id}`);
 if(band.zero&&seed%100<band.zero)return 0;
 return band.min+(v088StringHash(`${seed}|cap`)%(band.max-band.min+1));
}
function v088HourlyBought(p,hour=v088HourIndex()){return Math.max(0,Number(state.storeHourlyPurchases[v088StockKey(p,hour)])||0)}
function v088HourlyRemaining(p,hour=v088HourIndex()){const cap=v088HourlyCap(p,hour);return Number.isFinite(cap)?Math.max(0,cap-v088HourlyBought(p,hour)):Infinity}
function v088PruneStockLedger(){
 const current=v088HourIndex();for(const k of Object.keys(state.storeHourlyPurchases||{})){const bits=k.split('|'),h=Number(bits[1]);if(Number.isFinite(h)&&h<current-2)delete state.storeHourlyPurchases[k]}
}
v088PruneStockLedger();

const v088SerializableBase=v08Serializable;
v08Serializable=function(){const d=v088SerializableBase();d.storeHourlyPurchases=state.storeHourlyPurchases;return d};
const v088FreshSaveBase=v08FreshSave;
v08FreshSave=function(mode){const d=v088FreshSaveBase(mode);d.storeHourlyPurchases={};return d};

function v088PurchaseCount(p){
 if(p.mode==='binderUnlock')return state.binderOwned?.[p.setId]?1:0;
 if(p.mode==='sealed')return stockQty(sealedSku(p.id));
 return 0;
}

const v088BuyProductBase=buyProduct;
buyProduct=function(setId,productId){
 const p=productById(productId),mode=v08Mode();if(!p)return;
 const limited=mode!=='creative'&&v088LimitedRetail(p);
 if(limited&&v088HourlyRemaining(p)<=0){renderProducts();return toast('Rupture de stock · réassort à la prochaine rotation')}
 const before=limited?v088PurchaseCount(p):0,result=v088BuyProductBase(setId,productId),after=limited?v088PurchaseCount(p):before;
 if(limited&&after>before){
  const key=v088StockKey(p);state.storeHourlyPurchases[key]=v088HourlyBought(p)+(after-before);v088PruneStockLedger();save();renderProducts();
 }
 return result;
};

const v088RenderProductsBase=renderProducts;
renderProducts=function(){
 const r=v088RenderProductsBase(),mode=v08Mode(),grid=$('#productGrid');if(!grid||mode==='creative')return r;
 for(const article of grid.querySelectorAll('[data-product]')){
  const p=productById(article.dataset.product);if(!p||p.eventEdition)continue;
  const copy=article.querySelector('.product-copy'),btn=article.querySelector('button');if(!copy||!btn)continue;
  copy.querySelector('.v088-stock-line')?.remove();
  if(v088UnlimitedRetail(p)){
   const line=document.createElement('div');line.className='v088-stock-line';line.innerHTML='<span class="v088-stock-badge unlimited">STOCK ILLIMITÉ</span><span>Pas de limite horaire</span>';copy.insertBefore(line,btn);continue;
  }
  if(!v088LimitedRetail(p))continue;
  const cap=v088HourlyCap(p),remaining=v088HourlyRemaining(p),line=document.createElement('div');line.className=`v088-stock-line ${remaining<=0?'out':remaining<=1?'low':''}`;
  line.innerHTML=remaining<=0?'<span class="v088-stock-badge out">RUPTURE DE STOCK</span><b>Réassort prochaine rotation</b>':`<span class="v088-stock-badge">STOCK HORAIRE</span><b>${remaining} / ${cap} restant${remaining>1?'s':''}</b>`;
  copy.insertBefore(line,btn);
  if(remaining<=0&&!btn.disabled){btn.disabled=true;btn.textContent='Rupture de stock'}
 }
 return r;
};

/* Refresh the shop when the stock hour rolls over even if the set happens to be unchanged. */
let v088RenderedHour=v088HourIndex();
setInterval(()=>{const h=v088HourIndex();if(h!==v088RenderedHour){v088RenderedHour=h;v088PruneStockLedger();if($('#shop')?.classList.contains('active'))renderProducts()}},30000);

renderSettings();
if($('#shop')?.classList.contains('active'))renderProducts();
window.__voxV088PowerStockReady=true;
