'use strict';

/* VOX Card Sim V1.1.0 — condition physique cohérente.
   Le véritable état d'une carte reste caché tant qu'elle n'est pas gradée.
   Les défauts visibles sont rendus sur la carte, sans score ni catégorie chiffrée.
   Les boosters/scellés du Marketplace possèdent en revanche un état annoncé qui
   influence leur prix et les dégâts possibles sur leur contenu. */
const V111_SEALED_CONDITIONS=['Neuf','Très bon','Usé','Abîmé','Très abîmé'];
const V111_SEALED_LEVEL={'Neuf':0,'Très bon':1,'Usé':2,'Abîmé':3,'Très abîmé':4};
let v111IncomingLotCondition=null,v111ParentSealedCondition=null,v111PreferredPackCondition=null;

function v111SealedCondition(x){return V111_SEALED_CONDITIONS.includes(String(x||''))?String(x):'Neuf'}
function v111ConditionLevel(x){return V111_SEALED_LEVEL[v111SealedCondition(x)]||0}
function v111ConditionLabel(score){score=Number(score)||0;return score>=96.5?'MT':score>=89?'NM':score>=77?'EX':score>=64?'GD':score>=46?'PL':'PO'}
function v111ConditionTemplate(category,id){
 const base={MT:98,NM:93,EX:83,GD:69,PL:55,PO:39}[category]??93;
 const spread={MT:2.2,NM:5,EX:8,GD:11,PL:14,PO:18}[category]??5;
 const val=s=>clamp(base+(v110Rand(id,s)-.5)*spread,18,100);
 return{surface:val('surface'),corners:val('corners'),edges:val('edges'),back:val('back'),centering:clamp(base+5+(v110Rand(id,'centering')-.5)*spread,38,100)};
}

/* Les gestes brusques doivent désormais pouvoir réellement marquer une carte.
   L'atout Main légère réduit les dégâts de manipulation uniquement : il ne peut
   pas réparer un booster qui était déjà écrasé avant l'ouverture. */
v110RawCondition=v111ConditionLabel;
v110ConditionTemplate=v111ConditionTemplate;
v110NewCondition=function(id,metrics){
 const r=s=>v110Rand(id,s),d={surface:96+r('s')*4,corners:96+r('c')*4,edges:96+r('e')*4,back:96+r('b')*4,centering:87+r('z')*13};
 const gentle=state.collectorSkills?.gentle?0.52:1,incoming=clamp(Number(metrics?.incoming)||0,0,1)*gentle,outgoing=clamp(Number(metrics?.outgoing)||0,0,1)*gentle;
 const hit=Math.max(incoming,outgoing),combo=incoming+outgoing;
 d.surface-=combo*(2.5+r('ds')*8.5);d.corners-=hit*(4+r('dc')*13);d.edges-=combo*(3+r('de')*10);d.back-=outgoing*(2+r('db')*8);
 if(hit>.72&&r('fast-crease')<.18){d.surface-=8+r('crease-s')*12;d.corners-=5+r('crease-c')*9}
 for(const k of Object.keys(d))d[k]=clamp(d[k],18,100);
 if(state.collectorSkills?.safe){const score=v110ConditionScore(d);if(score<82){const add=82-score;for(const k of ['surface','corners','edges','back'])d[k]=clamp(d[k]+add*1.18,18,100)}}
 return d;
};

/* Marketplace : états annoncés des cartes plus larges et vrais états des produits
   scellés. Les doublons dans les tableaux servent de pondération réaliste. */
const v111OfferConditionsBase=v4OfferConditions;
v4OfferConditions=function(asset){
 if(asset?.type==='booster'||asset?.type==='sealed')return['Neuf','Neuf','Neuf','Neuf','Très bon','Très bon','Usé','Usé','Abîmé','Très abîmé'];
 if(asset?.type==='card')return['MT','NM','NM','NM','EX','EX','GD','PL','PO'];
 return v111OfferConditionsBase(asset);
};
const v111ConditionMultiplierBase=v4ConditionMultiplier;
v4ConditionMultiplier=function(c){
 const own={'Neuf':1,'Très bon':.91,'Usé':.76,'Abîmé':.56,'Très abîmé':.36,PL:.47,PO:.27,'Non gradée':.90};
 return Object.prototype.hasOwnProperty.call(own,c)?own[c]:v111ConditionMultiplierBase(c);
};
if(typeof v110ConditionPower==='function'){
 const base=v110ConditionPower;v110ConditionPower=function(c){const m={'Neuf':1,'Très bon':.91,'Usé':.76,'Abîmé':.56,'Très abîmé':.36,PL:.47,PO:.27,'Non gradée':.90};return Object.prototype.hasOwnProperty.call(m,c)?m[c]:base(c)};
}
if(typeof conditionPower==='function'){
 const base=conditionPower;conditionPower=function(c){const m={'Neuf':1,'Très bon':.91,'Usé':.76,'Abîmé':.56,'Très abîmé':.36,PL:.47,PO:.27,'Non gradée':.90};return Object.prototype.hasOwnProperty.call(m,c)?m[c]:base(c)};
}

function v111LotCondition(lot){return v111SealedCondition(lot?.sealedCondition||lot?.condition||'Neuf')}
function v111PrioritizeLot(sku,condition){
 try{v06LotNormalize(sku)}catch{}
 const lots=state.stockLots?.[sku];if(!Array.isArray(lots)||!lots.length)return;
 const wanted=v111SealedCondition(condition),yes=[],no=[];for(const l of lots)(v111LotCondition(l)===wanted?yes:no).push(l);state.stockLots[sku]=[...yes,...no];
}
function v111PeekLotCondition(sku){
 try{v06LotNormalize(sku)}catch{}
 const l=(state.stockLots?.[sku]||[]).find(x=>Number(x?.qty)>0);return v111LotCondition(l);
}
function v111DerivedPackCondition(parent,seed){
 const level=v111ConditionLevel(parent),r=v110Rand(seed,'child-pack');let n=level;
 if(level===0)n=r<.92?0:1;
 else if(level===1)n=r<.12?0:r<.84?1:2;
 else if(level===2)n=r<.18?1:r<.82?2:3;
 else if(level===3)n=r<.18?2:r<.78?3:4;
 else n=r<.24?3:4;
 return V111_SEALED_CONDITIONS[n];
}

/* Chaque lot garde désormais sa qualité. Les achats Marketplace ne fusionnent
   jamais deux qualités différentes dans un même lot. */
const v111AddLotBase=v06AddLot;
v06AddLot=function(sku,qty,unitCost=null,source='shop'){
 const incoming=(source==='market'&&v111IncomingLotCondition)?v111SealedCondition(v111IncomingLotCondition):
  (source==='ouverture_scelle'&&v111ParentSealedCondition?v111DerivedPackCondition(v111ParentSealedCondition,`${sku}|${Date.now()}|${stockQty(sku)}`):null);
 if(incoming&&(String(sku).startsWith('BOOSTER:')||String(sku).startsWith('SEALED:'))){
  v06LotNormalize(sku);addStock(sku,qty);state.stockLots[sku].push({qty,unitCost:Number.isFinite(unitCost)?unitCost:null,source,at:Date.now(),sealedCondition:incoming});return;
 }
 return v111AddLotBase(sku,qty,unitCost,source);
};
const v111ExecuteBuyBase=v4ExecuteBuy;
v4ExecuteBuy=function(book,offer,qty){
 const sealed=book?.asset?.type==='booster'||book?.asset?.type==='sealed';if(sealed)v111IncomingLotCondition=v111SealedCondition(offer?.condition);
 try{return v111ExecuteBuyBase(book,offer,qty)}finally{v111IncomingLotCondition=null}
};

const v111OpenSealedBase=openSealedSku;
openSealedSku=function(sku){
 if(v111PreferredPackCondition)v111PrioritizeLot(sku,v111PreferredPackCondition);
 const condition=v111PeekLotCondition(sku);v111ParentSealedCondition=condition;
 try{return v111OpenSealedBase(sku)}finally{v111ParentSealedCondition=null;v111PreferredPackCondition=null}
};

function v111DamagePlan(packCondition,openingId,index,total){
 const level=v111ConditionLevel(packCondition),seed=`${openingId}|${index}|${packCondition}`,r=s=>v110Rand(seed,s),base=[.015,.12,.34,.61,.84][level]||.015;
 const edge=(index===0||index===total-1)?1.18:(index===1||index===total-2?1.06:.92),severity=clamp(base*(.64+r('var')*.72)*edge,0,1);
 return{severity:Number(severity.toFixed(4)),crease:level>=3&&r('crease')<(level===4?.62:.24),moisture:level>=2&&r('moist')<(level===4?.28:level===3?.13:.035),scratch:severity>.13&&r('scratch')<(.22+severity*.48),whitening:severity>.09&&r('white')<(.30+severity*.55)};
}
function v111ApplyDamageToDetail(d,plan,id){
 if(!d||!plan)return d;const r=s=>v110Rand(id,s),s=clamp(Number(plan.severity)||0,0,1);
 d.surface-=s*(6+r('ps')*13);d.corners-=s*(9+r('pc')*20);d.edges-=s*(8+r('pe')*18);d.back-=s*(6+r('pb')*15);
 if(plan.scratch)d.surface-=3+r('scratch-extra')*8;
 if(plan.whitening){d.edges-=4+r('white-e')*10;d.corners-=2+r('white-c')*8}
 if(plan.crease){d.surface-=12+r('crease-s')*17;d.corners-=7+r('crease-c')*13;d.back-=5+r('crease-b')*12}
 if(plan.moisture){d.surface-=7+r('moist-s')*13;d.back-=8+r('moist-b')*15;d.edges-=4+r('moist-e')*10}
 for(const k of Object.keys(d))d[k]=clamp(d[k],12,100);return d;
}

/* Capture la qualité du booster AVANT que l'ancien code ne consomme le lot. */
const v111StartBoosterBase=startBooster;
startBooster=async function(setId=state.activeSet){
 const before=state.currentOpening?.id||null,sku=boosterSku(setId);if(v111PreferredPackCondition)v111PrioritizeLot(sku,v111PreferredPackCondition);const condition=v111PeekLotCondition(sku);v111PreferredPackCondition=null;
 const r=await v111StartBoosterBase(setId),o=state.currentOpening;
 if(o&&o.id!==before&&o.setId===setId){o.packCondition=condition;o.cards?.forEach((c,i)=>{if(c?.kind==='card')c.v111Damage=v111DamagePlan(condition,o.id,i,o.cards.length)});save()}
 return r;
};

/* L'exemplaire reçoit les dégâts préparés pour SA carte. Le code historique ne
   renvoyait pas toujours l'instance créée : on la retrouve donc par delta. */
const v111AddCardInstanceBase=addCardInstance;
addCardInstance=function(c){
 const before=state.instances.length,r=v111AddCardInstanceBase(c),ins=state.instances.slice(before).find(x=>x&&!x.isEnergy&&x.cardId===c.id&&x.setId===c.setId)||r;
 if(ins&&!ins.isEnergy){
  const plan=c?.v111Damage||v111DamagePlan(state.currentOpening?.packCondition||'Neuf',state.currentOpening?.id||ins.id,state.currentOpening?.reveal||0,state.currentOpening?.cards?.length||11);
  ins.packCondition=state.currentOpening?.packCondition||'Neuf';ins.damageFlags={crease:!!plan.crease,moisture:!!plan.moisture,scratch:!!plan.scratch,whitening:!!plan.whitening};
  const base=v110NewCondition(ins.id,typeof v110Handling!=='undefined'?v110Handling:null);ins.conditionDetail=v111ApplyDamageToDetail(base,plan,ins.id);v110NormalizeCondition(ins);
 }
 return ins||r;
};

/* Les défauts sont visibles pendant l'ouverture, sans jamais afficher un grade. */
function v111AddPackDamageLayer(el,plan){
 if(!el||!plan||Number(plan.severity)<.07)return;const l=document.createElement('div');l.className='v111-pack-damage';l.style.setProperty('--damage',String(plan.severity));l.classList.toggle('crease',!!plan.crease);l.classList.toggle('moisture',!!plan.moisture);l.classList.toggle('scratch',!!plan.scratch);l.classList.toggle('whitening',!!plan.whitening);el.appendChild(l);
}
const v111MakeCardBase=makeCardElement;
makeCardElement=function(c,depth){const el=v111MakeCardBase(c,depth);if(c?.kind==='card')v111AddPackDamageLayer(el,c.v111Damage);return el};

/* Après grading seulement : les catégories et scores internes deviennent lisibles. */
function v111ScrubUngradedModal(ins){
 if(!ins||ins.graded)return;const info=$('#modalInfo');info?.querySelectorAll('.v110-condition-card').forEach(x=>x.remove());
 if(info)for(const p of info.querySelectorAll('p'))if(/Exemplaire\s*:/i.test(p.textContent||''))p.textContent=`Exemplaire : ${ins.id} · état non gradé`;
 const actions=$('#modalActions');if(actions)for(const small of actions.querySelectorAll('small'))small.textContent=small.textContent.replace(/\s*·?\s*État\s*:\s*(MT|NM|EX|GD|PL|PO)/gi,'').replace(/État de ton exemplaire\s*:\s*[^.]+\.?/gi,'État exact masqué avant grading.');
}
const v111OpenCardModalBase=openCardModal;
openCardModal=function(c,ins){const r=v111OpenCardModalBase(c,ins);v111ScrubUngradedModal(ins);return r};
const v111EstimateBase=estimateCard;
estimateCard=async function(c,ins){const r=await v111EstimateBase(c,ins);v111ScrubUngradedModal(ins);return r};

v110OpenGradingSubmit=function(ins){
 v110EnsureGradingSubmit();if(!ins||ins.graded)return;const c=cardById(ins.setId,ins.cardId),m=$('#v110GradingSubmitModal');m.dataset.instance=ins.id;
 $('#v110GradeCardName').innerHTML=`<div class="notice"><strong>${escapeHtml(c?.name||'Carte')} #${escapeHtml(c?.localId||'')}</strong><br>État exact masqué · le grading révélera la note.</div>`;
 $('#v110GradeServices').innerHTML=Object.entries(V110_GRADING_SERVICES).map(([id,s],i)=>`<label class="v110-service"><input type="radio" name="v110service" value="${id}" ${i===0?'checked':''}><strong>${s.label} · ${v08Mode()==='creative'?'GRATUIT':money(v110GradePrice(id))}</strong><small>Retour estimé : ${v110FormatWait(s.wait)}</small></label>`).join('');
 $('#v110ConfirmGrade').onclick=()=>v110SubmitGrading(ins,m.querySelector('input[name="v110service"]:checked')?.value||'value');m.classList.remove('hidden');
};

/* Avant grading, les totaux ne doivent pas trahir le multiplicateur exact caché. */
const v111ValueBase=v05ValueForInstance;
v05ValueForInstance=function(ins,c){if(!ins||ins.graded)return v111ValueBase(ins,c);const old=ins.condition;try{ins.condition='NM';return v111ValueBase(ins,c)}finally{ins.condition=old}};

/* Inventaire : les boosters/scellés sont séparés par qualité afin qu'un booster
   abîmé ne soit jamais confondu avec un booster neuf au moment de l'ouvrir. */
function v111LotGroups(sku){
 v06LotNormalize(sku);const m=new Map();for(const l of state.stockLots?.[sku]||[]){const q=Math.max(0,Number(l.qty)||0);if(!q)continue;const c=v111LotCondition(l),x=m.get(c)||{condition:c,qty:0,costs:[]};x.qty+=q;if(Number.isFinite(l.unitCost))for(let i=0;i<q;i++)x.costs.push(l.unitCost);m.set(c,x)}return [...m.values()].sort((a,b)=>v111ConditionLevel(a.condition)-v111ConditionLevel(b.condition));
}
renderBoosterInventory=function(out){
 const rows=[];for(const s of Object.values(SETS)){const sku=boosterSku(s.id);if(stockQty(sku)<=0)continue;for(const g of v111LotGroups(sku))rows.push({set:s,sku,...g})}
 if(!rows.length){out.innerHTML='<div class="empty-state panel">Aucun booster libre en stock.</div>';return}out.innerHTML='';
 for(const r of rows){const p=r.set.products?.find(x=>x.mode==='loose'&&Number(x.qty)===1)||r.set.products?.[0],e=document.createElement('div');e.className='sealed-row panel stock-row';e.innerHTML=`<img class="stock-thumb" loading="lazy" decoding="async" src="${p?.image||''}" alt="Booster"><div class="stock-copy"><strong>Booster ${escapeHtml(r.set.name)}</strong><span>État du booster : <b>${escapeHtml(r.condition)}</b></span><b>×${r.qty}</b></div><div class="row-actions"><button class="primary open">Ouvrir</button><button class="secondary sell">Vendre</button></div>`;e.querySelector('.open').onclick=()=>{v111PreferredPackCondition=r.condition;startBooster(r.set.id)};e.querySelector('.sell').onclick=()=>{v111PrioritizeLot(r.sku,r.condition);openSellStock({type:'booster',sku:r.sku,setId:r.set.id,label:`Booster ${r.set.name}`,available:r.qty,unitBase:Number(p?.price||5.99)*v4ConditionMultiplier(r.condition),rarity:'rare',v111Condition:r.condition})};out.appendChild(e)}
};
renderSealedInventory=function(out){
 const rows=[];for(const [sku,q] of Object.entries(state.stock||{})){if(!sku.startsWith('SEALED:')||q<=0)continue;const p=productForSku(sku);if(!p)continue;for(const g of v111LotGroups(sku))rows.push({sku,p,...g})}
 if(!rows.length){out.innerHTML='<div class="empty-state panel">Aucun produit scellé.</div>';return}out.innerHTML='';
 for(const r of rows){const e=document.createElement('div');e.className='sealed-row panel stock-row';e.innerHTML=`<img class="stock-thumb" loading="lazy" decoding="async" src="${r.p.image||''}" alt="${escapeHtml(r.p.name)}"><div class="stock-copy"><strong>${escapeHtml(r.p.name)}</strong><span>${r.p.opens||0} boosters · état <b>${escapeHtml(r.condition)}</b></span><b>×${r.qty}</b></div><div class="row-actions"><button class="primary open">Ouvrir 1</button><button class="secondary sell">Vendre</button></div>`;e.querySelector('.open').onclick=()=>{v111PreferredPackCondition=r.condition;v111PrioritizeLot(r.sku,r.condition);openSealedSku(r.sku)};e.querySelector('.sell').onclick=()=>{v111PrioritizeLot(r.sku,r.condition);openSellStock({type:'sealed',sku:r.sku,setId:r.p.setId,productId:r.p.id,label:r.p.name,available:r.qty,unitBase:Number(r.p.price||1)*v4ConditionMultiplier(r.condition),rarity:r.p.opens>=16?'sir':r.p.opens>=9?'ur':'rare',v111Condition:r.condition})};out.appendChild(e)}
};

const v111ConditionStyle=document.createElement('style');v111ConditionStyle.textContent=`
.reveal-card,.modal-visual{position:relative}.v111-pack-damage{position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:8;opacity:calc(.18 + var(--damage,0)*.72);box-shadow:inset 0 0 calc(2px + var(--damage,0)*8px) rgba(238,235,220,calc(var(--damage,0)*.62));background:linear-gradient(92deg,transparent 0 4%,rgba(255,255,255,calc(var(--damage,0)*.09)) 4.5%,transparent 6% 94%,rgba(245,242,224,calc(var(--damage,0)*.13)) 95%,transparent 97%)}
.v111-pack-damage.whitening{box-shadow:inset 0 0 calc(2px + var(--damage,0)*10px) rgba(245,242,220,calc(.16 + var(--damage,0)*.65))}.v111-pack-damage.scratch{background:repeating-linear-gradient(112deg,transparent 0 31px,rgba(255,255,255,calc(var(--damage,0)*.22)) 32px,transparent 33px 69px)}.v111-pack-damage.crease:after{content:'';position:absolute;left:-2%;right:-2%;top:48%;height:2px;transform:rotate(-7deg);background:rgba(230,224,205,calc(.25 + var(--damage,0)*.55));box-shadow:0 1px 2px rgba(20,20,20,.25)}.v111-pack-damage.moisture:before{content:'';position:absolute;inset:6% 4%;background:radial-gradient(ellipse at 68% 72%,rgba(125,112,83,calc(var(--damage,0)*.15)),transparent 46%);mix-blend-mode:multiply}
.v111-update-badge{color:#62e58a!important}.stock-copy span b{color:#d8e0ec}.inventory-card,.stock-row,.market-result{content-visibility:auto;contain-intrinsic-size:96px}.product{content-visibility:auto;contain-intrinsic-size:340px}
`;
document.head.appendChild(v111ConditionStyle);

window.__voxV111ConditionReady=true;
