'use strict';

/* V1.0.4 — long-form tiered collector progression. Additive over the validated V1.0.3/V0.9.3 base. */
const V104_PROGRESSION_SCHEMA=2;
const V104_TIER_GATES={1:0,2:50,3:160,4:400,5:850};
const V104_BRANCH_LABELS={care:'Manipulation',grading:'Grading',rewards:'Récompenses',collection:'Collection'};
const V104_SKILLS={
 care1:{tier:1,branch:'care',cost:30,label:'Gestes propres I',desc:'Réduit de 10 % les dégâts dus aux swipes rapides.'},
 grading1:{tier:1,branch:'grading',cost:35,label:'Dossier soigné I',desc:'Réduit de 5 % le prix du grading.'},
 rewards1:{tier:1,branch:'rewards',cost:40,label:'Coup de pouce I',desc:'Reçois immédiatement 1 booster aléatoire.'},
 collection1:{tier:1,branch:'collection',cost:35,label:'Collectionneur I',desc:'Les Master Sets terminés rapportent 10 % d’argent supplémentaire.'},

 care2:{tier:2,branch:'care',cost:85,label:'Gestes propres II',desc:'Réduit de 20 % les dégâts et garantit au moins 70/100 sur une nouvelle carte.',requires:'care1'},
 grading2:{tier:2,branch:'grading',cost:95,label:'Dossier soigné II',desc:'Réduit de 10 % le prix du grading.',requires:'grading1'},
 rewards2:{tier:2,branch:'rewards',cost:110,label:'Coup de pouce II',desc:'Reçois immédiatement 2 boosters aléatoires.',requires:'rewards1'},
 collection2:{tier:2,branch:'collection',cost:90,label:'Collectionneur II',desc:'Les Master Sets terminés rapportent 25 % d’argent supplémentaire.',requires:'collection1'},

 care3:{tier:3,branch:'care',cost:190,label:'Manipulation experte I',desc:'Réduit de 32 % les dégâts et garantit au moins 76/100.',requires:'care2'},
 grading3:{tier:3,branch:'grading',cost:210,label:'Expert grading I',desc:'Réduit de 15 % le prix et de 5 % le délai du grading.',requires:'grading2'},
 rewards3:{tier:3,branch:'rewards',cost:240,label:'Approvisionnement I',desc:'1 booster aléatoire toutes les 8 h, avec 2 cadeaux hors-ligne maximum.',requires:'rewards2'},
 collection3:{tier:3,branch:'collection',cost:200,label:'Collectionneur expert I',desc:'Les Master Sets terminés rapportent 50 % d’argent supplémentaire.',requires:'collection2'},

 care4:{tier:4,branch:'care',cost:420,label:'Manipulation experte II',desc:'Réduit de 48 % les dégâts et garantit au moins 82/100.',requires:'care3'},
 grading4:{tier:4,branch:'grading',cost:460,label:'Expert grading II',desc:'Réduit de 20 % le prix et de 12 % le délai du grading.',requires:'grading3'},
 rewards4:{tier:4,branch:'rewards',cost:520,label:'Approvisionnement II',desc:'Le booster périodique passe à toutes les 5 h, avec 3 cadeaux hors-ligne maximum.',requires:'rewards3'},
 collection4:{tier:4,branch:'collection',cost:440,label:'Maître collectionneur I',desc:'Master Set : +75 % d’argent et 1 booster bonus supplémentaire.',requires:'collection3'},

 care5:{tier:5,branch:'care',cost:900,label:'Main de conservateur',desc:'Réduit de 62 % les dégâts et garantit au moins 88/100.',requires:'care4'},
 grading5:{tier:5,branch:'grading',cost:980,label:'Grader vétéran',desc:'Réduit de 30 % le prix et de 25 % le délai du grading.',requires:'grading4'},
 rewards5:{tier:5,branch:'rewards',cost:1100,label:'Approvisionnement premium',desc:'Le booster périodique passe à toutes les 3 h, avec 4 cadeaux hors-ligne maximum.',requires:'rewards4'},
 collection5:{tier:5,branch:'collection',cost:940,label:'Maître collectionneur II',desc:'Master Set : argent doublé et 2 boosters bonus supplémentaires.',requires:'collection4'}
};
const V104_OLD_SKILL_COST={safe:5,gift:10,gentle:20,grading:35,periodic:50};

function v104Round(n){return Math.round((Number(n)||0)*100)/100}
function v104CareerTier(){const xp=Math.max(0,Number(state.collectorXpEarned)||0);let tier=1;for(const t of [2,3,4,5])if(xp>=V104_TIER_GATES[t])tier=t;return tier}
function v104TierOpen(tier){return (Number(state.collectorXpEarned)||0)>=V104_TIER_GATES[tier]}
function v104BranchLevel(branch){let n=0;for(let i=1;i<=5;i++)if(state.collectorSkills?.[`${branch}${i}`])n=i;return n}
function v104SkillCount(){return Object.keys(V104_SKILLS).filter(id=>state.collectorSkills?.[id]).length}
function v104EnsureProgression(){
 state.collectorXp=Math.max(0,Number(state.collectorXp)||0);
 state.collectorXpEarned=Math.max(state.collectorXp,Number(state.collectorXpEarned)||0);
 state.collectorSkills=state.collectorSkills&&typeof state.collectorSkills==='object'?state.collectorSkills:{};
 if(Number(state.progressionSchema||0)>=V104_PROGRESSION_SCHEMA)return false;
 const old=state.collectorSkills||{};let spent=0;for(const [id,cost] of Object.entries(V104_OLD_SKILL_COST))if(old[id])spent+=cost;
 const legacyPool=Math.max(0,Number(state.collectorXp)||0)+spent;
 const legacyEarned=Math.max(Number(state.collectorXpEarned)||0,legacyPool);
 state.collectorXp=v104Round(legacyPool*.40);
 state.collectorXpEarned=v104Round(Math.max(state.collectorXp,legacyEarned*.40));
 state.collectorSkills={};
 state.progressionSchema=V104_PROGRESSION_SCHEMA;
 state.lastPeriodicBoosterAt=Date.now();
 try{save()}catch{}
 setTimeout(()=>{try{toast(`Progression rééquilibrée · ${state.collectorXp.toFixed(2)} XP disponibles`)}catch{}},300);
 return true;
}
v104EnsureProgression();

/* Persistence for the new progression schema. */
const v104SerializableBase=v08Serializable;
v08Serializable=function(){const d=v104SerializableBase();d.progressionSchema=V104_PROGRESSION_SCHEMA;return d};
const v104FreshBase=v08FreshSave;
v08FreshSave=function(mode){const d=v104FreshBase(mode);d.progressionSchema=V104_PROGRESSION_SCHEMA;d.collectorXp=0;d.collectorXpEarned=0;d.collectorSkills={};return d};
if(typeof v084BuildForceReset==='function'){
 const v104ForceBase=v084BuildForceReset;
 v084BuildForceReset=function(mode){const d=v104ForceBase(mode);d.progressionSchema=V104_PROGRESSION_SCHEMA;d.collectorXp=0;d.collectorXpEarned=0;d.collectorSkills={};return d};
}

/* XP economy: Creative cannot farm progression; the other modes use the same slower curve. */
v110AddXp=function(amount,reason='',notify=false){
 v104EnsureProgression();if(v08Mode()==='creative')return 0;
 let gain=0;switch(reason){case'Nouvelle carte':gain=.08;break;case'Booster ouvert':gain=.30;break;case'Carte gradée':gain=.75;break;case'Master Set complété':gain=12;break;default:gain=Math.max(0,(Number(amount)||0)*.25)}
 if(gain<=0)return 0;state.collectorXp=v104Round(state.collectorXp+gain);state.collectorXpEarned=v104Round(state.collectorXpEarned+gain);if(notify&&reason)toast(`+${gain.toFixed(2)} XP · ${reason}`);return gain
};

function v104GiveBoosters(count,source){const names=[];for(let i=0;i<count;i++){const sid=v110GiveRandomBooster(source);if(sid)names.push(setName(sid))}return names}
function v104PeriodicConfig(){const lvl=v104BranchLevel('rewards');if(lvl>=5)return{ms:3*60*60*1000,cap:4};if(lvl>=4)return{ms:5*60*60*1000,cap:3};if(lvl>=3)return{ms:8*60*60*1000,cap:2};return null}
function v104GradeConfig(){const lvl=v104BranchLevel('grading'),discount=[0,.05,.10,.15,.20,.30][lvl]||0,wait=[0,0,0,.05,.12,.25][lvl]||0;return{lvl,discount,wait}}
function v104CareConfig(){const lvl=v104BranchLevel('care'),damage=[1,.90,.80,.68,.52,.38][lvl]||1,floor=[0,0,70,76,82,88][lvl]||0;return{lvl,damage,floor}}
function v104CollectionConfig(){const lvl=v104BranchLevel('collection'),cash=[1,1.10,1.25,1.50,1.75,2][lvl]||1,extra=[0,0,0,0,1,2][lvl]||0;return{lvl,cash,extra}}

v110BuySkill=function(id){
 v104EnsureProgression();const s=V104_SKILLS[id];if(!s||state.collectorSkills[id])return;
 if(!v104TierOpen(s.tier))return toast(`Palier ${s.tier} verrouillé · ${V104_TIER_GATES[s.tier]} XP carrière requis`);
 if(s.requires&&!state.collectorSkills[s.requires])return toast('Atout précédent de cette branche requis');
 if(state.collectorXp<s.cost)return toast(`Pas assez d’XP · ${s.cost} requis`);
 state.collectorXp=v104Round(state.collectorXp-s.cost);state.collectorSkills[id]=Date.now();
 if(id==='rewards1'){const n=v104GiveBoosters(1,'skill-reward-1');toast(`Booster cadeau · ${n[0]||'reçu'}`)}
 else if(id==='rewards2'){v104GiveBoosters(2,'skill-reward-2');toast('2 boosters cadeaux reçus')}
 if(id==='rewards3'||id==='rewards4'||id==='rewards5')state.lastPeriodicBoosterAt=Date.now();
 save();v110RenderProgression();renderInventory();updateStats();
};

v110CheckPeriodicGift=function(show=true){
 v104EnsureProgression();const cfg=v104PeriodicConfig();if(!cfg)return 0;const now=Date.now(),last=Math.min(now,Math.max(0,Number(state.lastPeriodicBoosterAt)||now)),due=Math.min(cfg.cap,Math.floor((now-last)/cfg.ms));if(due<=0)return 0;v104GiveBoosters(due,'skill-periodic-v104');state.lastPeriodicBoosterAt=last+due*cfg.ms;save();if(show)toast(`${due} booster${due>1?'s':''} de progression reçu${due>1?'s':''}`);return due
};

/* Progressive handling protection replaces the old all-or-nothing safe/gentle flags. */
v110NewCondition=function(id,metrics){
 const r=s=>v110Rand(id,s),d={surface:96.5+r('s')*3.5,corners:96+r('c')*4,edges:96+r('e')*4,back:96.5+r('b')*3.5,centering:89+r('z')*11},cfg=v104CareConfig(),incoming=clamp(metrics?.incoming||0,0,1)*cfg.damage,outgoing=clamp(metrics?.outgoing||0,0,1)*cfg.damage;
 d.surface-=incoming*(1+r('ds')*2.7);d.corners-=incoming*(.5+r('dc')*1.8);d.back-=outgoing*(.8+r('db')*3);d.edges-=outgoing*(.6+r('de')*2.2);d.corners-=outgoing*(.2+r('dco'));for(const k of Object.keys(d))d[k]=clamp(d[k],35,100);
 if(cfg.floor>0){for(let pass=0;pass<3;pass++){const score=v110ConditionScore(d);if(score>=cfg.floor)break;const bump=(cfg.floor-score)*1.25;for(const k of ['surface','corners','edges','back'])d[k]=clamp(d[k]+bump,35,100)}}
 return d
};

/* Progressive grading discount + turnaround time. */
v110GradePrice=function(service){const s=V110_GRADING_SERVICES[service]||V110_GRADING_SERVICES.value,cfg=v104GradeConfig();return Number((s.price*(1-cfg.discount)).toFixed(2))};
function v104GradeWait(service){const s=V110_GRADING_SERVICES[service]||V110_GRADING_SERVICES.value,cfg=v104GradeConfig();return Math.round(s.wait*(1-cfg.wait))}
v110SubmitGrading=function(ins,service){if(!ins||ins.status!=='owned'||ins.isEnergy||ins.graded)return toast('Cette carte ne peut pas être envoyée au grading');const s=V110_GRADING_SERVICES[service];if(!s)return;const cost=v110GradePrice(service),wait=v104GradeWait(service);if(v08Mode()!=='creative'&&state.wallet<cost)return toast('Solde insuffisant');if(v08Mode()!=='creative')state.wallet-=cost;const now=Date.now(),job={id:uid('GRADE'),instanceId:ins.id,setId:ins.setId,cardId:ins.cardId,service,label:s.label,cost,submittedAt:now,returnAt:now+wait,status:'pending'};state.gradingQueue.push(job);ins.status='grading';ins.location='grading';ins.binderSlot=null;ins.masterSlot=null;save();$('#v110GradingSubmitModal')?.classList.add('hidden');$('#cardModal')?.classList.add('hidden');renderBinder();renderInventory();updateStats();toast(`Carte envoyée · retour estimé ${v110FormatWait(wait)}`)};
v110OpenGradingSubmit=function(ins){v110EnsureGradingSubmit();v110NormalizeCondition(ins);const c=cardById(ins.setId,ins.cardId),m=$('#v110GradingSubmitModal');m.dataset.instance=ins.id;$('#v110GradeCardName').innerHTML=`<div class="notice"><strong>${escapeHtml(c?.name||'Carte')} #${escapeHtml(c?.localId||'')}</strong><br>État brut ${escapeHtml(ins.condition)} · ${Number(ins.conditionScore||v110ConditionScore(ins.conditionDetail)).toFixed(1)}/100</div>`;$('#v110GradeServices').innerHTML=Object.entries(V110_GRADING_SERVICES).map(([id,s],i)=>`<label class="v110-service"><input type="radio" name="v110service" value="${id}" ${i===0?'checked':''}><strong>${s.label} · ${v08Mode()==='creative'?'GRATUIT':money(v110GradePrice(id))}</strong><small>Retour estimé : ${v110FormatWait(v104GradeWait(id))}</small></label>`).join('');$('#v110ConfirmGrade').onclick=()=>v110SubmitGrading(ins,m.querySelector('input[name="v110service"]:checked')?.value||'value');m.classList.remove('hidden')};

/* Master completion reward scales with the Collection branch but XP stays scarce. */
v110CheckMasterReward=function(setId){if(!v110MasterSupported(setId)||state.masterRewards?.[setId])return false;const p=v110MasterProgress(setId);if(!p.total||p.capacity<p.total||p.filled<p.total)return false;state.masterRewards[setId]=Date.now();const xp=v110AddXp(12,'Master Set complété',false),cfg=v104CollectionConfig(),cash=Math.round(5000*cfg.cash);if(v08Mode()!=='creative')state.wallet+=cash;const gifts=v104GiveBoosters(1+cfg.extra,'master-complete-v104');save();toast(`Master Set ${setName(setId)} complété · +${xp.toFixed(2)} XP${v08Mode()==='creative'?'':` · +${cash.toLocaleString('fr-FR')} €`} · ${gifts.length} booster${gifts.length>1?'s':''}`);return true};
window.v110CheckMasterReward=v110CheckMasterReward;

/* Tiered progression UI. */
function v104Roman(t){return['','I','II','III','IV','V'][t]||String(t)}
v110RenderProgression=function(){
 v104EnsureProgression();v110EnsureProgressionModal();const out=$('#v110ProgressionContent'),career=v104CareerTier();let html=`<div class="panel v104-xp-head"><div><strong>${state.collectorXp.toFixed(2)} XP disponibles</strong><small>${state.collectorXpEarned.toFixed(2)} XP carrière · Palier ${v104Roman(career)}/V</small></div><span>${v104SkillCount()}/20 atouts</span></div>`;
 for(let tier=1;tier<=5;tier++){const open=v104TierOpen(tier),gate=V104_TIER_GATES[tier],next=tier<5?V104_TIER_GATES[tier+1]:null;html+=`<section class="v104-tier ${open?'':'locked'}"><div class="v104-tier-head"><div><span>PALIER ${v104Roman(tier)}</span><strong>${open?'Débloqué':`${gate} XP carrière requis`}</strong></div>${open&&next?`<small>Palier suivant : ${Math.max(0,next-state.collectorXpEarned).toFixed(1)} XP</small>`:''}</div><div class="v110-skill-grid">`;
  for(const [id,s] of Object.entries(V104_SKILLS).filter(([,x])=>x.tier===tier)){const owned=!!state.collectorSkills[id],branchLocked=s.requires&&!state.collectorSkills[s.requires],disabled=owned||!open||branchLocked||state.collectorXp<s.cost;html+=`<div class="v110-skill ${owned?'owned':''} ${(!open||branchLocked)?'locked':''}"><div class="v104-branch">${escapeHtml(V104_BRANCH_LABELS[s.branch])}</div><div class="v110-skill-head"><strong>${escapeHtml(s.label)}</strong><b>${owned?'ACQUIS':s.cost+' XP'}</b></div><p>${escapeHtml(s.desc)}</p><button data-v104-skill="${id}" class="${owned?'secondary':'primary'} small" ${disabled?'disabled':''}>${owned?'Débloqué':!open?'Palier verrouillé':branchLocked?'Atout précédent requis':state.collectorXp<s.cost?'XP insuffisante':'Débloquer'}</button></div>`}
  html+='</div></section>';
 }
 out.innerHTML=html;out.querySelectorAll('[data-v104-skill]').forEach(b=>b.onclick=()=>v110BuySkill(b.dataset.v104Skill));
};

const v104InjectHomeBase=v110InjectHomeTools;
v110InjectHomeTools=function(){v104EnsureProgression();v104InjectHomeBase();const b=$('#v110ProgressBtn');if(b){const t=v104CareerTier();b.innerHTML=`<strong>Progression · ${state.collectorXp.toFixed(2)} XP</strong><span>Palier ${v104Roman(t)}/V · ${v104SkillCount()}/20 atouts</span>`}};

const v104Style=document.createElement('style');v104Style.textContent=`
#v110ProgressionContent{color:#f4f7fb}.v104-xp-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;background:#111923;border-color:#2b3849}.v104-xp-head>div{display:flex;flex-direction:column;gap:4px}.v104-xp-head strong{color:#f4f7fb}.v104-xp-head small{color:#9eacbe}.v104-xp-head>span{color:#ffd664;font-weight:900;white-space:nowrap}.v104-tier{margin:14px 0 20px;padding-top:4px}.v104-tier.locked{opacity:.62}.v104-tier-head{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin:0 2px 9px;border-bottom:1px solid #2b3849;padding-bottom:8px}.v104-tier-head>div{display:flex;align-items:center;gap:10px}.v104-tier-head span{color:#ffd664;font-size:11px;font-weight:950;letter-spacing:.08em}.v104-tier-head strong,.v104-tier-head small{color:#b9c4d2;font-size:10px}.v104-branch{display:inline-flex;width:max-content;border:1px solid #334357;background:#111923;color:#9fb0c5;border-radius:999px;padding:3px 7px;font-size:8px;font-weight:900;letter-spacing:.04em;margin-bottom:7px}.v110-skill p{color:#b9c4d2}.v110-skill-head strong{color:#f4f7fb}.v110-skill-head b{color:#ffd664}.v110-skill.owned{border-color:#665328;background:#1d190f}.v110-skill.locked{filter:none}
`;document.head.appendChild(v104Style);

setTimeout(()=>{try{v104EnsureProgression();if($('#home')?.classList.contains('active'))renderHome()}catch(e){console.warn('V1.0.4 progression init',e)}},250);
window.__voxV104ProgressionReady=true;
