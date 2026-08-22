'use strict';

// ---------- ENERGY KEEPERS IN BINDERS ----------
const V062_ENERGY_TYPES=ENERGY.map(e=>e.name);
function v062EnergySlot(setId,energyType,variant){
 const cfg=SETS[setId],spec=typeof V061_BINDERS!=='undefined'?V061_BINDERS[setId]:null;
 if(!cfg||!spec)return null;
 const typeIndex=V062_ENERGY_TYPES.indexOf(energyType);if(typeIndex<0)return null;
 const offset=(variant==='cosmos'?8:0)+typeIndex,slot=cfg.total+offset;
 return slot<spec.capacity?slot:null;
}
function v062EnergyKeeper(setId,energyType,variant){return state.instances.find(x=>x.setId===setId&&x.isEnergy&&x.status==='owned'&&x.energyType===energyType&&(x.variant||'normal')===(variant||'normal')&&x.energyKeeper)}

const v062ReconcileBinderBase=reconcileBinder;
reconcileBinder=function(setId){
 v062ReconcileBinderBase(setId);
 const groups=new Map();
 state.instances.filter(x=>x.setId===setId&&x.isEnergy&&x.status==='owned').sort((a,b)=>(a.openedAt||a.acquiredAt||0)-(b.openedAt||b.acquiredAt||0)).forEach(ins=>{
  const key=`${ins.energyType}|${ins.variant||'normal'}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(ins);
 });
 for(const arr of groups.values()){
  let keeper=arr.find(x=>x.energyKeeper)||arr[0];
  for(const ins of arr)ins.energyKeeper=ins===keeper;
  const slot=state.binderOwned?.[setId]?v062EnergySlot(setId,keeper.energyType,keeper.variant):null;
  if(slot!==null){keeper.location='binder-energy';keeper.binderSlot=slot;}
  else{keeper.location='inventory';keeper.binderSlot=null;}
  for(const ins of arr)if(ins!==keeper&&ins.location==='binder-energy'){ins.location='inventory';ins.binderSlot=null;}
 }
};

const v062AddEnergyBase=addEnergyInstance;
addEnergyInstance=function(c){v062AddEnergyBase(c);reconcileBinder(c.setId);save()};

const v062RenderBinderBase=renderBinder;
renderBinder=function(){
 v062RenderBinderBase();
 const sid=state.activeSet,cfg=SETS[sid],spec=typeof V061_BINDERS!=='undefined'?V061_BINDERS[sid]:null;
 if(!cfg||!spec||!state.binderOwned?.[sid])return;
 const page=state.pageBySet[sid]||0,start=page*9,pockets=[...$('#pocketGrid').children];
 pockets.forEach((el,i)=>{
  const slot=start+i;if(slot<cfg.total||slot>=cfg.total+16||slot>=spec.capacity)return;
  const offset=slot-cfg.total,variant=offset>=8?'cosmos':'normal',type=V062_ENERGY_TYPES[offset%8];
  const ins=v062EnergyKeeper(sid,type,variant),en=ENERGY.find(e=>e.name===type);
  el.className='pocket energy-pocket'+(ins?'':' empty');el.innerHTML='';
  if(ins){const im=new Image();im.src=en?.thumb||ins.imageSmall||'';im.alt=`Énergie ${type}`;el.appendChild(im);}
  const b=document.createElement('span');b.className='pocket-number energy-label';b.textContent=`${variant==='cosmos'?'COSMOS · ':''}${type}`;el.appendChild(b);
 });
};

// Never sell the last reserved basic energy by accident.
if(typeof v061SellEnergyGroup==='function'){
 const v062SellEnergyBase=v061SellEnergyGroup;
 v061SellEnergyGroup=function(arr){
  const sellable=arr.filter(x=>!x.energyKeeper&&x.status==='owned');
  if(!sellable.length)return toast('Le dernier exemplaire est réservé pour ta collection');
  return v062SellEnergyBase(sellable);
 };
}

// Reconcile existing V0.6/V0.6.1 energy cards after migration.
for(const sid of Object.keys(SETS))reconcileBinder(sid);

// ---------- BACKUP UI / EXPORT / IMPORT ----------
function v062CurrentSaveJson(){try{save();return localStorage.getItem(V06_STORAGE)||JSON.stringify(v06Serializable())}catch{return ''}}
function v062InjectBackupControls(){
 const card=$('#settingsModal .modal-card');if(!card||$('#v062BackupPanel'))return;
 const box=document.createElement('div');box.id='v062BackupPanel';box.className='backup-panel';box.innerHTML=`<div class="backup-head"><strong>Sauvegarde</strong><span>Protection locale + Android Auto Backup</span></div><p>La progression est copiée dans un fichier interne dédié aux sauvegardes Android. Les scans hors ligne ne sont pas sauvegardés et pourront être retéléchargés.</p><div class="backup-actions"><button id="exportVoxSave" class="secondary">Exporter</button><button id="importVoxSave" class="secondary">Importer</button></div><small>Auto Backup dépend du système Android et n'est pas instantané. L'export manuel reste la copie de sécurité la plus sûre.</small>`;
 card.appendChild(box);
 $('#exportVoxSave').onclick=()=>{const j=v062CurrentSaveJson();if(!j)return toast('Aucune sauvegarde à exporter');if(!window.VOXNative?.exportSave)return toast('Export indisponible sur ce build');window.VOXNative.exportSave(j)};
 $('#importVoxSave').onclick=()=>{if(!window.VOXNative?.importSave)return toast('Import indisponible sur ce build');window.VOXNative.importSave()};
}
const v062RenderSettingsBase=renderSettings;
renderSettings=function(){v062RenderSettingsBase();v062InjectBackupControls()};
window.voxNativeSaveResult=function(kind,ok,message){toast(message||(ok?'Terminé':'Erreur'))};
window.voxImportSave=function(json){
 try{
  const d=JSON.parse(json);if(!confirm('Importer cette sauvegarde ? La progression actuelle sera remplacée.'))return;
  const v=Number(d.version||d.schemaVersion||0);
  if(v>=6){localStorage.setItem(V06_STORAGE,json);localStorage.setItem(V06_BACKUP,json)}
  else if(v===5)localStorage.setItem('voxCardSimV05',json);
  else if(v===4)localStorage.setItem('voxCardSimV04',json);
  else if(v===3)localStorage.setItem('voxCardSimV03',json);
  else throw new Error('Version de sauvegarde non reconnue');
  try{window.VOXNative?.mirrorSave?.(json)}catch{}
  toast('Sauvegarde importée · redémarrage…');setTimeout(()=>location.reload(),650);
 }catch(e){toast(`Import impossible : ${e.message||e}`)}
};

// Add backup controls even if Settings was already rendered before this hotfix loaded.
setTimeout(()=>{try{reconcileBinder(state.activeSet);renderBinder();renderInventory();renderSettings();save()}catch(e){console.warn('V0.6.2 refresh',e)}},300);
