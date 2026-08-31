'use strict';
/* VOX Card Sim V1.1.6 — moteur de collation audité par époque.

   La V1.1.5 possédait les bons catalogues de cartes/produits, mais la plupart des
   boosters importés tombaient encore sur generatePack() moderne (4 communes,
   3 peu communes, deux slots reverse/hit, rare, énergie). V1.1.6 remplace cette
   hypothèse par un profil explicite pour chaque extension à booster documentée.

   Principe d'intégrité :
   - le nombre et l'ordre des slots suivent la famille physique du booster ;
   - les raretés viennent des métadonnées TCGdex enrichies, jamais du numéro de carte ;
   - les taux exacts sont utilisés seulement lorsqu'un profil les documente ;
   - un profil `structure-only` (POP) est bloqué plutôt que de fabriquer un taux ;
   - si un pool indispensable manque dans la source, l'ouverture échoue proprement.
*/
const V116_VERSION='1.1.6';
const V116_DATA=window.V116_COLLATION_PROFILES||{schema:116,language:'fr',sets:{},stats:{}};

function v116Profile(setId){return V116_DATA.sets?.[setId]||null}
function v116Norm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,' ').replace(/[^a-z0-9.]+/g,' ').trim().replace(/\s+/g,' ')}
function v116Raw(c){return v116Norm(c?.rarityRaw||c?.rarity||'')}
function v116Local(c){return String(c?.localId||'')}
function v116Variants(c){return Array.isArray(c?.variants)?c.variants:[]}
function v116Cards(setId){return (cardsFor(setId)||[]).filter(Boolean)}
function v116Used(out,c){return out.some(x=>x?.id===c?.id)}
function v116Available(pool,out){return (pool||[]).filter(c=>c&&!v116Used(out,c))}
function v116Pick(pool,out,label){const a=v116Available(pool,out);if(!a.length)throw new Error(`collation-pool-empty:${label}`);return pick(a)}
function v116Wrap(c,setId,slot,variant='normal'){if(!c)throw new Error(`collation-null:${slot}`);return wrapCard(c,setId,slot,variant)}
function v116Push(out,pool,setId,slot,variant='normal'){const c=v116Pick(pool,out,slot);out.push(v116Wrap(c,setId,slot,variant));return c}
function v116PushN(out,pool,n,setId,slot,variant='normal'){for(let i=0;i<n;i++)v116Push(out,pool,setId,`${slot} ${i+1}`,variant)}

/* Classification tolérante EN/FR. L'import V1.1.6 privilégie les labels anglais
   pour les anciennes époques (plus précis), mais les synonymes français restent
   acceptés afin que les sauvegardes/catalogues déjà présents ne cassent pas. */
function v116IsCommon(c){const r=v116Raw(c);return (r==='common'||r==='commune'||r.includes(' common'))&&!r.includes('uncommon')&&!r.includes('peu commune')}
function v116IsUncommon(c){const r=v116Raw(c);return r.includes('uncommon')||r.includes('peu commune')}
function v116IsMHR(c){const r=v116Raw(c);return r.includes('mega hyper')||r.includes('mega hyper rare')}
function v116IsSIR(c){const r=v116Raw(c);return r.includes('special illustration')||r.includes('illustration speciale')||r.includes('black white rare')}
function v116IsIR(c){const r=v116Raw(c);return !v116IsSIR(c)&&(r.includes('illustration rare')||r==='illustration rare')}
function v116IsDouble(c){const r=v116Raw(c);return r.includes('double rare')}
function v116IsACE(c){return v116Raw(c).includes('ace spec')}
function v116IsShinyUltra(c){const r=v116Raw(c);return r.includes('shiny ultra')}
function v116IsShiny(c){const r=v116Raw(c);return r.includes('shiny')&&!v116IsShinyUltra(c)}
function v116IsRadiant(c){const r=v116Raw(c);return r.includes('radiant')||r.includes('radieuse')}
function v116IsAmazing(c){const r=v116Raw(c);return r.includes('amazing')||r.includes('magnifique')}
function v116IsPrism(c){return v116Raw(c).includes('prism')}
function v116IsRainbow(c){return v116Raw(c).includes('rainbow')||v116Raw(c).includes('arc en ciel')}
function v116IsLVX(c){const r=v116Raw(c);return r.includes('lv.x')||r.includes('lv x')}
function v116IsPrime(c){return v116Raw(c).includes('prime')}
function v116IsLegend(c){const r=v116Raw(c);return r.includes('legend')||r.includes('legende')}
function v116IsGoldStar(c){const r=v116Raw(c);return r.includes('gold star')||r.includes('holo star')||r.includes('etoile d or')}
function v116IsShining(c){const r=v116Raw(c);return r.includes('shining')&&!r.includes('shiny')}
function v116IsGX(c){return /(^| )gx($| )/.test(v116Raw(c))}
function v116IsVMAX(c){return v116Raw(c).includes('vmax')}
function v116IsVSTAR(c){return v116Raw(c).includes('vstar')}
function v116IsV(c){const r=v116Raw(c);return /(^| )v($| )/.test(r)&&!v116IsVMAX(c)&&!v116IsVSTAR(c)}
function v116IsEX(c){const r=v116Raw(c);return /(^| )ex($| )/.test(r)||r.includes('pokemon ex')}
function v116IsSecret(c){const r=v116Raw(c);return r.includes('secret')||r.includes('hyper rare')||r.includes('gold rare')||r.includes('rare secret')}
function v116IsUltra(c){const r=v116Raw(c);return r.includes('ultra rare')&&!v116IsShinyUltra(c)&&!v116IsMHR(c)}
function v116IsHolo(c){const r=v116Raw(c);return (r.includes('holo')||r.includes('holograph'))&&!v116IsEX(c)&&!v116IsGX(c)&&!v116IsV(c)&&!v116IsVMAX(c)&&!v116IsVSTAR(c)&&!v116IsLVX(c)&&!v116IsGoldStar(c)}
function v116IsEnergyCard(c){const n=v116Norm(c?.name);return n.includes('energy')||n.includes('energie')}
function v116IsPlainRare(c){
 const r=v116Raw(c);if(!r.includes('rare')&&r!=='rare')return false;
 return ![v116IsHolo,v116IsEX,v116IsGX,v116IsV,v116IsVMAX,v116IsVSTAR,v116IsLVX,v116IsPrime,v116IsLegend,v116IsGoldStar,v116IsShining,v116IsUltra,v116IsSecret,v116IsRainbow,v116IsRadiant,v116IsAmazing,v116IsPrism,v116IsIR,v116IsSIR,v116IsDouble,v116IsMHR,v116IsACE,v116IsShiny,v116IsShinyUltra].some(fn=>fn(c));
}
function v116ReverseEligible(c){return v116Variants(c).includes('reverse')||v116IsCommon(c)||v116IsUncommon(c)||v116IsPlainRare(c)||v116IsHolo(c)}

function v116Pools(setId){
 const all=v116Cards(setId),by=fn=>all.filter(fn);
 return{
  all,common:by(v116IsCommon),uncommon:by(v116IsUncommon),rare:by(v116IsPlainRare),holo:by(v116IsHolo),
  ex:by(v116IsEX),gx:by(v116IsGX),v:by(v116IsV),vmax:by(v116IsVMAX),vstar:by(v116IsVSTAR),
  ultra:by(v116IsUltra),secret:by(v116IsSecret),rainbow:by(v116IsRainbow),lvx:by(v116IsLVX),
  prime:by(v116IsPrime),legend:by(v116IsLegend),goldStar:by(v116IsGoldStar),shining:by(v116IsShining),
  prism:by(v116IsPrism),amazing:by(v116IsAmazing),radiant:by(v116IsRadiant),
  ir:by(v116IsIR),sir:by(v116IsSIR),double:by(v116IsDouble),mhr:by(v116IsMHR),ace:by(v116IsACE),
  shiny:by(v116IsShiny),shinyUltra:by(v116IsShinyUltra),reverse:all.filter(v116ReverseEligible)
 };
}

/* Chaque `rate` est interprété comme probabilité absolue du slot. Les branches
   sans pool réel sont ignorées ; la probabilité résiduelle revient au fallback.
   Cela évite d'inventer une carte d'une rareté absente du set. */
function v116Weighted(out,setId,items,fallback,slot,fallbackVariant='normal'){
 let x=Math.random(),acc=0;
 for(const item of items){const rate=clamp(Number(item?.rate)||0,0,1),pool=item?.pool||[];if(!rate||!pool.length)continue;acc+=rate;if(x<acc){const c=v116Pick(pool,out,slot);return v116Wrap(c,setId,`${slot} — ${item.label}`,item.variant||'holo')}}
 const pool=fallback||[];const c=v116Pick(pool,out,slot);return v116Wrap(c,setId,slot,fallbackVariant);
}
function v116Reverse(out,p,setId,slot='Reverse'){
 const pool=p.reverse.length?p.reverse:[...p.common,...p.uncommon,...p.rare,...p.holo];return v116Wrap(v116Pick(pool,out,slot),setId,slot,'reverse');
}
function v116NormalRarePool(p){return p.rare.length?p.rare:(p.holo.length?p.holo:[...p.common,...p.uncommon])}
function v116HoloFallback(p){return p.holo.length?p.holo:v116NormalRarePool(p)}
function v116Validate(pack,profile,setId){
 if(!Array.isArray(pack)||pack.length!==Number(profile.cardCount))throw new Error(`collation-count:${setId}:${pack?.length||0}/${profile.cardCount}`);
 if(pack.some(x=>!x||!x.id))throw new Error(`collation-null-card:${setId}`);
 return pack;
}

function v116Wotc(setId,profile){
 const p=v116Pools(setId),out=[];v116PushN(out,p.common,7,setId,'Commune');
 const r=profile.rates||{};out.push(v116Weighted(out,setId,[
  {label:'Shining',rate:r.shining,pool:p.shining},{label:'Secrète',rate:r.secret,pool:p.secret},
  {label:'Holo',rate:r.holo,pool:p.holo}
 ],v116NormalRarePool(p),'Rare'));
 v116PushN(out,p.uncommon,3,setId,'Peu commune');return out;
}
function v116Ecard(setId,profile){
 const p=v116Pools(setId),out=[];v116PushN(out,p.common,5,setId,'Commune');out.push(v116Reverse(out,p,setId));
 const r=profile.rates||{};out.push(v116Weighted(out,setId,[{label:'Secrète/Crystal',rate:r.secret,pool:p.secret},{label:'Holo',rate:r.holo,pool:p.holo}],v116NormalRarePool(p),'Rare'));
 v116PushN(out,p.uncommon,2,setId,'Peu commune');return out;
}
function v116EX(setId,profile){
 const p=v116Pools(setId),out=[];v116PushN(out,p.common,5,setId,'Commune');out.push(v116Reverse(out,p,setId));const r=profile.rates||{};
 const baseHolo=Math.max(0,Number(r.holo||0)-Number(r.ex||0)-Number(r.secret||0)-Number(r.goldStar||0));
 out.push(v116Weighted(out,setId,[
  {label:'Gold Star',rate:r.goldStar,pool:p.goldStar},{label:'Secrète',rate:r.secret,pool:p.secret},
  {label:'Pokémon-ex',rate:r.ex,pool:p.ex},{label:'Holo',rate:baseHolo,pool:p.holo}
 ],v116NormalRarePool(p),'Rare'));v116PushN(out,p.uncommon,2,setId,'Peu commune');return out;
}
function v116DP(setId,profile){
 const p=v116Pools(setId),out=[];v116PushN(out,p.common,5,setId,'Commune');out.push(v116Reverse(out,p,setId));const r=profile.rates||{};
 out.push(v116Weighted(out,setId,[{label:'LV.X',rate:r.lvx,pool:p.lvx},{label:'Holo',rate:r.holo,pool:p.holo}],v116NormalRarePool(p),'Rare'));
 v116PushN(out,p.uncommon,3,setId,'Peu commune');return out;
}
function v116HGSS(setId,profile){
 const p=v116Pools(setId),out=[];v116PushN(out,p.common,5,setId,'Commune');out.push(v116Reverse(out,p,setId));const r=profile.rates||{};
 out.push(v116Weighted(out,setId,[
  {label:'Shining',rate:r.shining,pool:p.shining},{label:'Secrète',rate:r.secret,pool:p.secret},
  {label:'LÉGENDE',rate:r.legend,pool:p.legend},{label:'Prime',rate:r.prime,pool:p.prime},{label:'Holo',rate:r.holo,pool:p.holo}
 ],v116NormalRarePool(p),'Rare'));v116PushN(out,p.uncommon,3,setId,'Peu commune');return out;
}
function v116BWXY(setId,profile){
 const p=v116Pools(setId),out=[];v116PushN(out,p.common,5,setId,'Commune');out.push(v116Reverse(out,p,setId));const r=profile.rates||{};
 out.push(v116Weighted(out,setId,[
  {label:'Secrète',rate:r.secret,pool:p.secret},{label:'Ultra Rare',rate:r.ultra,pool:p.ultra},
  {label:'Pokémon-EX',rate:r.ex,pool:p.ex},{label:'Holo',rate:r.holo,pool:p.holo}
 ],v116NormalRarePool(p),'Rare'));v116PushN(out,p.uncommon,3,setId,'Peu commune');return out;
}

function v116DependencyCards(profile){
 const rows=[];for(const id of profile.dependencies||[])for(const c of cardsFor(id)||[])rows.push({...c,setId:id});return rows;
}
function v116DependencyPick(out,profile,label){const a=v116DependencyCards(profile).filter(c=>!v116Used(out,c));if(!a.length)return null;const c=pick(a);return v116Wrap(c,c.setId||profile.setId,label,'holo')}
function v116SM(setId,profile){
 const p=v116Pools(setId),out=[],r=profile.rates||{};v116PushN(out,p.common,5,setId,'Commune');
 let reverse=null,x=Math.random();
 if(r.shiny&&x<r.shiny){reverse=v116DependencyPick(out,profile,'Reverse — Shiny Vault')}
 else if(r.character&&x<r.shiny+r.character&&p.secret.length){reverse=v116Wrap(v116Pick(p.secret,out,'Character'),setId,'Reverse — Character Rare','holo')}
 else if(r.prism&&x<r.shiny+r.character+r.prism&&p.prism.length){reverse=v116Wrap(v116Pick(p.prism,out,'Prism'),setId,'Reverse — Prism Star','holo')}
 if(!reverse)reverse=v116Reverse(out,p,setId);out.push(reverse);
 out.push(v116Weighted(out,setId,[
  {label:'Secrète',rate:r.secret,pool:p.secret},{label:'Rainbow',rate:r.rainbow,pool:p.rainbow},
  {label:'Ultra Rare',rate:r.ultra,pool:p.ultra},{label:'GX',rate:r.gx,pool:p.gx},{label:'Shining',rate:r.shining,pool:p.shining},
  {label:'Holo',rate:r.holo,pool:p.holo}
 ],v116NormalRarePool(p),'Rare'));
 v116PushN(out,p.uncommon,3,setId,'Peu commune');out.push(energyCard(setId));return out;
}
function v116SWSH(setId,profile){
 const p=v116Pools(setId),out=[],r=profile.rates||{};v116PushN(out,p.common,5,setId,'Commune');
 let reverse=null,x=Math.random(),depRate=Number(r.shiny||r.tg||r.gallery||0);
 if(depRate&&x<depRate)reverse=v116DependencyPick(out,profile,r.shiny?'Reverse — Shiny Vault':(r.gallery?'Reverse — Galerie de Galar':'Reverse — Galerie des Dresseurs'));
 else if(r.amazing&&x<depRate+Number(r.amazing)&&p.amazing.length)reverse=v116Wrap(v116Pick(p.amazing,out,'Amazing'),setId,'Reverse — Amazing Rare','holo');
 else if(r.radiant&&x<depRate+Number(r.amazing||0)+Number(r.radiant)&&p.radiant.length)reverse=v116Wrap(v116Pick(p.radiant,out,'Radiant'),setId,'Reverse — Radiant Rare','holo');
 if(!reverse)reverse=v116Reverse(out,p,setId);out.push(reverse);
 out.push(v116Weighted(out,setId,[
  {label:'Secrète',rate:r.secret,pool:p.secret},{label:'Rainbow',rate:r.rainbow,pool:p.rainbow},
  {label:'Ultra Rare',rate:r.ultra,pool:p.ultra},{label:'VMAX',rate:r.vmax,pool:p.vmax},
  {label:'VSTAR',rate:r.vstar,pool:p.vstar},{label:'V',rate:r.v,pool:p.v},{label:'Holo',rate:r.holo,pool:p.holo}
 ],v116NormalRarePool(p),'Rare'));
 v116PushN(out,p.uncommon,3,setId,'Peu commune');out.push(energyCard(setId));return out;
}
function v116SV(setId,profile){
 const p=v116Pools(setId),out=[],r=profile.rates||{};v116PushN(out,p.common,4,setId,'Commune');v116PushN(out,p.uncommon,3,setId,'Peu commune');
 out.push(v116Weighted(out,setId,[
  {label:'Shiny Ultra Rare',rate:r.shinyUltra,pool:p.shinyUltra},{label:'Shiny Rare',rate:r.shiny,pool:p.shiny},
  {label:'ACE SPEC',rate:r.ace,pool:p.ace}
 ],p.reverse,'Foil 1','reverse'));
 out.push(v116Weighted(out,setId,[
  {label:'Méga Hyper Rare',rate:r.mhr,pool:p.mhr},{label:'Hyper Rare',rate:r.hr,pool:p.secret},
  {label:'Illustration spéciale rare',rate:r.sir,pool:p.sir},{label:'Illustration rare',rate:r.ir,pool:p.ir}
 ],p.reverse,'Foil 2','reverse'));
 out.push(v116Weighted(out,setId,[
  {label:'Ultra Rare',rate:r.ultra,pool:p.ultra},{label:'Double Rare',rate:r.double,pool:p.double}
 ],v116HoloFallback(p),'Rare garantie','holo'));
 const e=energyCard(setId);if(Number(r.foilEnergy||0)>0&&Math.random()<Number(r.foilEnergy))e.foil=true,e.variant='cosmos';out.push(e);return out;
}

function v116DoubleCrisis(setId,profile){
 const p=v116Pools(setId),out=[],r=profile.rates||{};v116PushN(out,p.common,3,setId,'Commune');out.push(v116Reverse(out,p,setId));
 out.push(v116Weighted(out,setId,[{label:'Ultra Rare',rate:r.ultra,pool:p.ultra}],v116HoloFallback(p),'Rare Holo','holo'));v116PushN(out,p.uncommon,2,setId,'Peu commune');return out;
}
function v116DragonVault(setId){const p=v116Pools(setId),out=[];for(let i=0;i<5;i++)v116Push(out,p.all,setId,`Holo ${i+1}`,'holo');return out}
function v116Detective(setId,profile){
 const p=v116Pools(setId),out=[],r=profile.rates||{};v116PushN(out,p.common,3,setId,'Holo commune','holo');
 out.push(v116Weighted(out,setId,[{label:'Ultra Rare',rate:r.ultra,pool:p.ultra}],v116HoloFallback(p),'Holo rare','holo'));return out;
}
function v116Generations(setId){
 const p=v116Pools(setId),out=[],core=p.all.filter(c=>!/^rc/i.test(v116Local(c))),rc=p.all.filter(c=>/^rc/i.test(v116Local(c)));
 if(rc.length<2)throw new Error('collation-generations-rc-missing');
 const cp=fn=>core.filter(fn),common=cp(v116IsCommon),uncommon=cp(v116IsUncommon),energy=core.filter(v116IsEnergyCard);
 v116PushN(out,common,3,setId,'Commune');v116PushN(out,uncommon,2,setId,'Peu commune');
 const coreP={...p,all:core,common,uncommon,rare:cp(v116IsPlainRare),holo:cp(v116IsHolo),reverse:core.filter(v116ReverseEligible)};
 out.push(v116Reverse(out,coreP,setId));
 out.push(v116Weighted(out,setId,[
  {label:'Ultra Rare',rate:1/45,pool:cp(v116IsUltra)},{label:'Pokémon-EX',rate:1/4.9,pool:cp(v116IsEX)},
  {label:'Holo',rate:1/9.5,pool:coreP.holo}
 ],v116NormalRarePool(coreP),'Rare'));
 /* Les mesures Generations donnent ~1 énergie tous les 1,1 boosters. Le slot
    restant est alors une commune du set principal. */
 if(energy.length&&Math.random()<1/1.1)v116Push(out,energy,setId,'Énergie','normal');else v116Push(out,common,setId,'Commune 4','normal');
 const rcCommon=rc.filter(v116IsCommon),rcUncommon=rc.filter(v116IsUncommon),rcUltra=rc.filter(v116IsUltra),rcEX=rc.filter(v116IsEX);
 v116Push(out,rcCommon.length?rcCommon:rc,setId,'Radiant Collection — Commune','holo');
 out.push(v116Weighted(out,setId,[
  {label:'RC Ultra Rare',rate:1/5,pool:rcUltra},{label:'RC Pokémon-EX',rate:1/12.5,pool:rcEX},
  {label:'RC Peu commune',rate:1/1.4,pool:rcUncommon}
 ],rcUncommon.length?rcUncommon:rc,'Radiant Collection','holo'));
 return out;
}
function v116Celebrations(setId,profile){
 const p=v116Pools(setId),out=[],r=profile.rates||{},base=p.all;v116PushN(out,base,2,setId,'Holo','holo');
 let third=null;if(Math.random()<Number(r.classic||0))third=v116DependencyPick(out,profile,'Classic Collection');if(!third)v116Push(out,base,setId,'Holo 3','holo');else out.push(third);
 out.push(v116Weighted(out,setId,[{label:'VMAX',rate:r.vmax,pool:p.vmax},{label:'Ultra Rare',rate:r.ultra,pool:p.ultra},{label:'V',rate:r.v,pool:p.v},{label:'Holo',rate:r.holo,pool:p.holo}],base,'Dernière Holo','holo'));return out;
}

function v116BuildPack(setId,profile){
 if(profile.confidence==='structure-only')throw new Error(`collation-rates-undocumented:${setId}`);
 switch(profile.family){
  case'wotc11':return v116Wotc(setId,profile);case'ecard9':return v116Ecard(setId,profile);case'ex9':return v116EX(setId,profile);
  case'dp10':return v116DP(setId,profile);case'hgss10':return v116HGSS(setId,profile);case'bwxy10':return v116BWXY(setId,profile);
  case'sm11':return v116SM(setId,profile);case'swsh11':return v116SWSH(setId,profile);case'sv11':return v116SV(setId,profile);
  case'double-crisis7':return v116DoubleCrisis(setId,profile);case'dragon-vault5':return v116DragonVault(setId);
  case'detective4':return v116Detective(setId,profile);case'generations10':return v116Generations(setId);case'celebrations4':return v116Celebrations(setId,profile);
  default:throw new Error(`collation-family-unsupported:${profile.family}`);
 }
}

const v116GeneratePackBase=generatePack;
generatePack=function(setId){
 const profile=v116Profile(setId);if(!profile)return v116GeneratePackBase(setId);if(!state.metaReady?.[setId]||!v116Cards(setId).length)throw new Error(`collation-data-not-ready:${setId}`);
 return v116Validate(v116BuildPack(setId,profile),profile,setId);
};

/* Les sous-collections (Classic Collection, Shiny Vault, TG/GG) ne sont chargées
   que lorsqu'un booster parent en a besoin. On garde ainsi l'optimisation RAM de
   V1.1 tout en garantissant que le slot insert possède réellement son pool. */
const v116StartBoosterBase=startBooster;
startBooster=async function(setId=state.activeSet){
 const profile=v116Profile(setId);if(profile?.dependencies?.length&&typeof v111HydrateSet==='function')for(const dep of profile.dependencies){const ok=await v111HydrateSet(dep);if(!ok)throw new Error(`collation-dependency-not-ready:${dep}`)}
 return v116StartBoosterBase(setId);
};

/* Outil de diagnostic manuel : ne touche ni au portefeuille ni au stock. */
window.v116AuditPack=function(setId,n=10000){
 const profile=v116Profile(setId);if(!profile)throw new Error('profil absent');n=clamp(Number(n)||10000,1,100000);const lengths={},rarities={};
 for(let i=0;i<n;i++){const pack=generatePack(setId);lengths[pack.length]=(lengths[pack.length]||0)+1;for(const c of pack){const k=v116Raw(c)||c.rarityKey||'unknown';rarities[k]=(rarities[k]||0)+1}}
 return{setId,n,profile:{family:profile.family,confidence:profile.confidence,cardCount:profile.cardCount,physicalOrder:profile.physicalOrder},lengths,rarities};
};

window.__voxV116Ready=true;
