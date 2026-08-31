'use strict';

// ---------- PALDEA EVOLVED PACK: USE THE SOURCE IMAGE'S NATURAL RATIO ----------
const v07FixRenderOpeningBase=renderOpening;
renderOpening=function(){
 v07FixRenderOpeningBase();
 const sid=state.currentOpening?.setId||state.activeSet;
 const stage=$('#packStage');if(stage)stage.dataset.setId=sid||'';
};
try{renderOpening()}catch{}

// ---------- SELL ALL INVENTORY CARDS ----------
function v07SellableInventoryGroups(){
 const groups=new Map();
 for(const ins of state.instances||[]){
  if(ins.status!=='owned'||ins.location!=='inventory')continue;
  if(ins.isEnergy&&ins.energyKeeper)continue;
  const key=ins.isEnergy?`E|${ins.setId}|${ins.energyType}|${ins.variant||'normal'}|${ins.condition||'MT'}`:`C|${ins.setId}|${ins.cardId}|${ins.variant||'normal'}|${ins.condition||'MT'}`;
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(ins);
 }
 return [...groups.values()];
}
function v07ReferenceForCard(c,ins){
 const snap=state.lastKnownEstimates?.[c.id]||{},r=rarityFor(ins.setId,cardNo(c));
 const remembered=ins.variant==='reverse'?(snap.reverse||snap.standard):(snap.standard||snap.reverse);
 const base=Math.max(.02,Number(remembered)||v4FallbackBase(r));
 return Math.max(.02,base*(state.marketShift?.[c.id]||1));
}
function v07BatchListInventory(){
 const groups=v07SellableInventoryGroups();if(!groups.length)return toast('Aucune carte vendable dans l’inventaire');
 const created=[];const touched=new Set();
 for(const arr of groups){
  const ins=arr[0];
  if(ins.isEnergy){
   const book=v061EnergyBook(ins),ask=Math.max(.02,book.base*v4ConditionMultiplier(ins.condition||'MT'));
   for(const x of arr){x.status='listed';x.location='listed';x.binderSlot=null}
   const l={id:uid('LIST'),type:'energy',setId:ins.setId,energyType:ins.energyType,variant:ins.variant||'normal',condition:ins.condition||'MT',label:book.asset.label,rarity:book.asset.rarity,marketBase:book.base,assetKey:book.key,ask,instanceIds:arr.map(x=>x.id),remainingIds:arr.map(x=>x.id),status:'active',createdAt:Date.now(),lastTick:Date.now()};
   state.listings.push(l);created.push(l);touched.add(ins.setId);continue;
  }
  const c=cardById(ins.setId,ins.cardId);if(!c)continue;
  const r=rarityFor(ins.setId,cardNo(c)),variant=v4VariantKey(ins.variant),base=v07ReferenceForCard(c,ins),book=v4EnsureBook({type:'card',setId:ins.setId,cardId:c.id,localId:c.localId,label:`${c.name} #${c.localId}${variant==='reverse'?' Reverse':''}`,rarity:r,variant,image:cardImg(c,'low')},base),ask=Math.max(.02,book.base*v4ConditionMultiplier(ins.condition||'MT'));
  for(const x of arr){x.status='listed';x.location='listed';x.binderSlot=null}
  const l={id:uid('LIST'),type:'card',setId:ins.setId,cardId:c.id,variant,condition:ins.condition||'MT',label:book.asset.label,rarity:r,marketBase:book.base,assetKey:book.key,ask,instanceIds:arr.map(x=>x.id),remainingIds:arr.map(x=>x.id),status:'active',createdAt:Date.now(),lastTick:Date.now()};
  state.listings.push(l);created.push(l);touched.add(ins.setId);
 }
 for(const sid of touched)reconcileBinder(sid);save();renderInventory();renderBinder();updateStats();v07PublishPublicProfile?.();
 for(const l of created)try{v07PublishListing?.(l)}catch{}
 toast(`${created.length} annonce(s) publiée(s)`);
}
function v07ConfirmSellAll(){
 const groups=v07SellableInventoryGroups(),units=groups.reduce((n,a)=>n+a.length,0);if(!units)return toast('Aucune carte vendable dans l’inventaire');
 v06RequireProfile(()=>{
  const m=$('#sellModal');m.classList.remove('hidden');$('#sellContent').innerHTML=`<span class="tag">VENTE RAPIDE</span><h2>Tout vendre ?</h2><p>${units} carte(s) de l’inventaire seront mises en vente, regroupées par carte, variante et état.</p><div class="panel bulk-sell-note"><strong>Prix automatiques</strong><span>Chaque annonce utilisera le dernier prix mémorisé du marché. Si aucun prix n'est disponible, le barème de rareté du simulateur sera utilisé.</span></div><p>Les cartes rangées dans les classeurs et les Énergies réservées à la collection ne seront pas touchées.</p><button id="confirmSellAllCards" class="danger-button">Mettre les ${units} carte(s) en vente</button>`;
  $('#confirmSellAllCards').onclick=()=>{m.classList.add('hidden');v07BatchListInventory()};
 });
}
const v07FixRenderCardInventoryBase=renderCardInventory;
renderCardInventory=function(out){
 v07FixRenderCardInventoryBase(out);
 const groups=v07SellableInventoryGroups(),units=groups.reduce((n,a)=>n+a.length,0);if(!units)return;
 const sort=out.querySelector('.inventory-sort');if(!sort||out.querySelector('#sellAllInventoryCards'))return;
 const b=document.createElement('button');b.id='sellAllInventoryCards';b.className='secondary small sell-all-cards';b.textContent=`Tout vendre (${units})`;b.onclick=v07ConfirmSellAll;sort.appendChild(b);
};

// ---------- HARD RESET: LOCALSTORAGE + NATIVE MIRROR + CLOUD SNAPSHOT ----------
function v07FreshSave(){
 const now=Date.now();return{
  version:7,schemaVersion:7,playerId:state.playerId||uid('PLAYER'),activeSet:'sv03.5',wallet:250,
  instances:[],stock:{},listings:[],sales:[],purchases:[],packsOpened:{},settings:{cardTrickEnabled:false,cardTrickCount:0},currentOpening:null,inventoryTab:'cards',inventorySort:'numberAsc',pageBySet:{'sv03.5':0,'sv03':0,'sv02':0,'s6a':0},lastMarketTick:now,marketShift:{},priceCache:{},lastKnownEstimates:{},marketBooks:{},marketSellers:state.marketSellers||{},marketTab:'buy',marketQuery:'',marketSetFilter:'all',sellerProfile:null,offlinePackMeta:state.offlinePackMeta||{},binderOwned:{},stockLots:{},priceHistory:{},publicCards:[],notificationsEnabled:false,jpPackPlans:{},profileLegacyPrompted:true,onlineProcessedSellerTrades:[],onlineProcessedBuyerTrades:[],onlineCloudEnabled:true,lastSavedAt:now
 };
}
function v07HardReset(){
 const fresh=v07FreshSave(),json=JSON.stringify(fresh);
 // Cancel already-published player listings before forgetting their IDs.
 for(const l of state.listings||[])if(l.remoteId&&l.status==='active')try{VOXOnline?.cancelListing?.(l.remoteId)}catch{}
 // Hide the old public profile immediately. The next profile is created by the user again.
 try{VOXOnline?.publishProfile?.(JSON.stringify({handle:'',displayName:'',avatar:'',rating:100,completedSales:0,revenue:0,collectionValue:0,cardsObtained:0,uniqueCards:0,activeListings:0,publicCards:[],joinedAt:Date.now(),lastSeen:Date.now()}))}catch{}
 // Replace both Android mirror and cloud save with the fresh game before reload.
 try{VOXNative?.mirrorSave?.(json)}catch{}
 try{VOXOnline?.setCloudWritesEnabled?.(true);VOXOnline?.queueCloudSave?.(json);VOXOnline?.flushCloudSave?.()}catch{}
 for(const k of Object.keys(localStorage))if(k.startsWith('voxCardSim'))localStorage.removeItem(k);
 localStorage.setItem(V06_STORAGE,json);localStorage.setItem(V06_BACKUP,json);
 toast('Progression réinitialisée · redémarrage…');setTimeout(()=>location.reload(),900);
}
v06ResetConfirm=function(){
 const m=$('#sellModal');m.classList.remove('hidden');$('#sellContent').innerHTML=`<span class="tag danger-tag">DANGER</span><h2>Réinitialiser toute la progression ?</h2><p>Le solde reviendra à 250 €, l'inventaire, les cartes, classeurs, annonces, historique, statistiques et profil vendeur seront vidés. Le compte Firebase reste associé pour pouvoir continuer à utiliser le online.</p><label class="profile-field">Tape RESET pour confirmer<input id="resetWord" autocomplete="off" autocapitalize="characters"></label><button id="resetFinal" class="danger-button" disabled>Effacer définitivement</button>`;const inp=$('#resetWord'),btn=$('#resetFinal');inp.oninput=()=>btn.disabled=inp.value.trim().toUpperCase()!=='RESET';btn.onclick=()=>{if(inp.value.trim().toUpperCase()!=='RESET')return;btn.disabled=true;v07HardReset()};
};

// Refresh the currently visible inventory after this layer is loaded.
setTimeout(()=>{try{if(state.inventoryTab==='cards')renderInventory();if($('#opening').classList.contains('active'))renderOpening()}catch(e){console.warn('V0.7 fixes',e)}},200);
