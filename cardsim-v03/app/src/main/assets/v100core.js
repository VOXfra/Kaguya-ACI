'use strict';

/* VOX Card Sim V1.0.0 — Master Sets, physical condition, grading and collector progression. */
const V100_VERSION='1.0.0';
const V100_MASTER=window.V100_MASTER_VARIANTS||{};
const V100_GRADING_SERVICES={
 value:{label:'Value',price:32.99,wait:90*60*1000},
 regular:{label:'Regular',price:79.99,wait:30*60*1000},
 express:{label:'Express',price:149.99,wait:8*60*1000}
};
const V100_SKILLS={
 safe:{cost:5,label:'Qualité sûre',desc:'Une nouvelle carte ne peut plus tomber sous un état global de 82/100.'},
 gift:{cost:10,label:'Booster cadeau',desc:'Reçois immédiatement un booster aléatoire.',requires:'safe'},
 gentle:{cost:20,label:'Main légère',desc:'Les dégâts liés aux gestes rapides sont réduits de 45 %.',requires:'safe'},
 grading:{cost:35,label:'Expert grading',desc:'Réduit de 15 % le prix de chaque envoi au grading.'},
 periodic:{cost:50,label:'Booster régulier',desc:'Un booster aléatoire offert toutes les 2 heures, avec 3 cadeaux hors-ligne maximum.',requires:'gift'}
};
const V100_PERIODIC_MS=2*60*60*1000;

state.masterBinderView=state.masterBinderView&&typeof state.masterBinderView==='object'?state.masterBinderView:{};
state.masterPageBySet=state.masterPageBySet&&typeof state.masterPageBySet==='object'?state.masterPageBySet:{};
state.masterRewards=state.masterRewards&&typeof state.masterRewards==='object'?state.masterRewards:{};
state.collectorXp=Math.max(0,Number(state.collectorXp)||0);
state.collectorXpEarned=Math.max(state.collectorXp,Number(state.collectorXpEarned)||0);
state.collectorSkills=state.collectorSkills&&typeof state.collectorSkills==='object'?state.collectorSkills:{};
state.gradingQueue=Array.isArray(state.gradingQueue)?state.gradingQueue:[];
state.gradingHistory=Array.isArray(state.gradingHistory)?state.gradingHistory:[];
state.lastPeriodicBoosterAt=Math.max(0,Number(state.lastPeriodicBoosterAt)||Date.now());

/* ---------- PERSISTENCE / SAFE MIGRATION ---------- */
const v100SerializableBase=v08Serializable;
v08Serializable=function(){
 const d=v100SerializableBase();
 for(const k of ['masterBinderView','masterPageBySet','masterRewards','collectorXp','collectorXpEarned','collectorSkills','gradingQueue','gradingHistory','lastPeriodicBoosterAt'])d[k]=state[k];
 d.version=10;d.schemaVersion=10;return d;
};
const v100FreshSaveBase=v08FreshSave;
v08FreshSave=function(mode){
 const d=v100FreshSaveBase(mode);d.version=10;d.schemaVersion=10;d.masterBinderView={};d.masterPageBySet={};d.masterRewards={};d.collectorXp=0;d.collectorXpEarned=0;d.collectorSkills={};d.gradingQueue=[];d.gradingHistory=[];d.lastPeriodicBoosterAt=Date.now();return d;
};

function v100Hash(text){let h=2166136261>>>0;for(const ch of String(text||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function v100Rand01(seed,salt=''){return (v100Hash(`${seed}|${salt}`)%100000)/100000}
function v100ConditionTemplate(category,id){
 const base={MT:98,NM:93,EX:83,GD:70}[category]??93,spread=category==='MT'?2.1:category==='NM'?4:category==='EX'?7:10;
 const val=s=>clamp(base+(v100Rand01(id,s)-.5)*spread,35,100);
 return{surface:val('surface'),corners:val('corners'),edges:val('edges'),back:val('back'),centering:clamp(base+2+(v100Rand01(id,'centering')-.5)*spread,45,100)};
}
function v100ConditionScore(d){if(!d)return 0;return d.surface*.28+d.corners*.22+d.edges*.22+d.back*.18+d.centering*.10}
function v100RawCondition(score){return score>=96.5?'MT':score>=89?'NM':score>=77?'EX':'GD'}
function v100NormalizeCondition(ins){
 if(!ins||ins.isEnergy||ins.graded||ins.status==='grading')return;
 if(!ins.conditionDetail)ins.conditionDetail=v100ConditionTemplate(['MT','NM','EX','GD'].includes(ins.condition)?ins.condition:'NM',ins.id);
 const score=v100ConditionScore(ins.conditionDetail);ins.conditionScore=Number(score.toFixed(2));ins.condition=v100RawCondition(score);
}
for(const ins of state.instances||[])v100NormalizeCondition(ins);

/* ---------- XP / SKILLS ---------- */
function v100AddXp(amount,reason='',silent=false){amount=Number(amount)||0;if(amount<=0)return;state.collectorXp=Number((state.collectorXp+amount).toFixed(2));state.collectorXpEarned=Number((state.collectorXpEarned+amount).toFixed(2));if(!silent&&reason)toast(`+${amount} XP · ${reason}`)}
function v100UnlockedSets(){try{return typeof v090VisibleSetIds==='function'?v090VisibleSetIds():Object.keys(SETS)}catch{return Object.keys(SETS)}}
function v100GiveRandomBooster(source='progression'){
 const ids=v100UnlockedSets().filter(id=>SETS[id]);if(!ids.length)return null;const sid=ids[Math.floor(Math.random()*ids.length)],sku=boosterSku(sid);v06AddLot(sku,1,0,source);return sid;
}
function v100CanBuySkill(id){const s=V100_SKILLS[id];return !!s&&!state.collectorSkills[id]&&(!s.requires||state.collectorSkills[s.requires])&&state.collectorXp>=s.cost}
function v100BuySkill(id){
 const s=V100_SKILLS[id];if(!s||state.collectorSkills[id])return;if(s.requires&&!state.collectorSkills[s.requires])return toast('Atout précédent requis');if(state.collectorXp<s.cost)return toast('Pas assez d’XP');
 state.collectorXp=Number((state.collectorXp-s.cost).toFixed(2));state.collectorSkills[id]=Date.now();if(id==='gift'){const sid=v100GiveRandomBooster('skill-gift');toast(`Booster cadeau · ${setName(sid)}`)}if(id==='periodic')state.lastPeriodicBoosterAt=Date.now();save();v100RenderProgression();renderInventory();updateStats();
}
function v100CheckPeriodicGift(show=true){
 if(!state.collectorSkills.periodic)return 0;const now=Date.now(),last=Math.min(now,Math.max(0,Number(state.lastPeriodicBoosterAt)||now)),due=Math.min(3,Math.floor((now-last)/V100_PERIODIC_MS));if(due<=0)return 0;
 for(let i=0;i<due;i++)v100GiveRandomBooster('skill-periodic');state.lastPeriodicBoosterAt=last+due*V100_PERIODIC_MS;save();if(show)toast(`${due} booster${due>1?'s':''} de progression reçu${due>1?'s':''}`);return due;
}

const v100DiscoverBase=v08Discover;
v08Discover=function(setId,cardId,cardObj=null){const fresh=v100DiscoverBase(setId,cardId,cardObj);if(fresh)v100AddXp(.25,'Nouvelle carte',true);return fresh};
const v100FinishPackBase=finishPack;
finishPack=function(){const o=state.currentOpening,award=!!o&&!o._v100XpAwarded;const r=v100FinishPackBase();if(award){o._v100XpAwarded=true;v100AddXp(1,'Booster ouvert',true);try{v100ReconcileBinders(o.setId);v100CheckMasterReward(o.setId)}catch(e){console.warn('V1 finish reconcile',e)}save()}return r};
