'use strict';

// Japanese cards use their own foil families.
const v06VariantBase=v4CardVariant;
v4CardVariant=function(ins,c,setId){if(setId==='s6a'){const r=rarityFor(setId,cardNo(c));return ['jp_rare','jp_rr','jp_rrr','jp_sr','jp_hr','jp_ur'].includes(r)?'holo':'normal'}return v06VariantBase(ins,c,setId)};

// Eevee Heroes box collation: empirical box data is used for rarity counts.
v06BuildEeveeBoxPlan=function(){const p=Array(30).fill('none'),put=(kind,count)=>{for(let k=0;k<count;k++){let i;do{i=Math.floor(Math.random()*30)}while(p[i]!=='none');p[i]=kind}};put('rr',Math.random()<.2?5:4);put('rrr',Math.random()<.2?3:2);const premium=Math.random()<.10?2:1;for(let k=0;k<premium;k++){const y=Math.random()*110;put(y<45?'sr':y<75?'sa':y<95?'hr':y<100?'hrsa':'ur',1)}put('r',Math.random()<.5?8:7);return shuffle(p)};
v06GenerateEeveePack=function(){const plan=(state.jpPackPlans.s6a?.length?state.jpPackPlans.s6a.shift():v06LooseEeveePlan()),cs=uniquePicks(v06Pool('s6a','jp_common'),3),u=pick(v06Pool('s6a','jp_uncommon'));const out=[...cs.map(c=>wrapCard(c,'s6a','Commune','normal')),wrapCard(u,'s6a','Peu commune','normal')];let hit=null;if(plan==='r')hit=pick(v06Pool('s6a','jp_rare'));else if(plan==='rr')hit=pick(v06Pool('s6a','jp_rr'));else if(plan==='rrr')hit=pick(v06Pool('s6a','jp_rrr'));else if(['sr','sa','hr','hrsa','ur'].includes(plan))hit=v06EeveeSecret(plan);else hit=pick(v06Pool('s6a','jp_uncommon'));if(!hit)hit=pick(cardsFor('s6a'));out.push(wrapCard(hit,'s6a',plan==='none'?'Peu commune':plan.toUpperCase(),['r','rr','rrr','sr','sa','hr','hrsa','ur'].includes(plan)?'holo':'normal'));return out};

// Eevee Heroes offline pack uses the embedded Japanese data source instead of a TCGdex set endpoint.
const v06OfflineManifestBase=v05OfflineManifest;
v05OfflineManifest=function(setId){if(setId!=='s6a')return v06OfflineManifestBase(setId);if(!state.metaReady.s6a||cardsFor('s6a').length!==101)throw new Error('eevee-not-ready');const urls=new Set([V06_EEVEE_DATA]);for(const p of SETS.s6a.products)if(p.image)urls.add(p.image);for(const c of cardsFor('s6a')){if(c.images?.large)urls.add(c.images.large);if(c.images?.small)urls.add(c.images.small)}return [...urls]};
const v06HydrateBase=v05HydratePrices;
v05HydratePrices=async function(setId,statusEl){if(setId!=='s6a')return v06HydrateBase(setId,statusEl);if(statusEl)statusEl.textContent='Eevee Heroes hors ligne prêt · scans japonais mémorisés';save()};

// Exact cancellation for cost-tracked stacked products (avoid restoring quantity twice).
cancelListing=function(id){const l=state.listings.find(x=>x.id===id&&x.status==='active');if(!l)return;l.status='cancelled';if(l.type==='card'){for(const iid of l.remainingIds||[]){const ins=state.instances.find(x=>x.id===iid);if(ins){ins.status='owned';ins.location='inventory'}}l.remainingIds=[]}else{const qty=l.remaining||0,costs=(l.costUnits||[]).slice(0,qty);l.remaining=0;l.costUnits=[];for(const c of costs)v06AddLot(l.sku,1,c,'annonce_retiree')}reconcileBinder(l.setId);save();renderInventory();renderBinder();updateStats();toast('Annonce retirée')};

// Products whose exact contents are not modelled must never be consumed by a fake opening.
const v06OpenSealedBase=openSealedSku;
openSealedSku=function(sku){const p=productForSku(sku);if(p&&(!Number.isFinite(Number(p.opens))||Number(p.opens)<=0))return toast('Contenu non modélisé : ce produit reste scellé');return v06OpenSealedBase(sku)};

// The V0.4 hard-coded VOX card was never a user-created profile.
const legacyName=String(state.sellerProfile?.displayName||'').trim().toLowerCase(),legacyHandle=String(state.sellerProfile?.handle||'').trim().toLowerCase();if(!state.profileLegacyPrompted&&(legacyName==='vox'||legacyHandle==='vox'||legacyHandle==='vo')){state.sellerProfile=null;state.profileLegacyPrompted=true;save()}

// Eevee Heroes has no TCGdex logo endpoint; do not show a broken image.
const v06RenderHomeBase=renderHome;
renderHome=function(){v06RenderHomeBase();const logo=$('#setLogo');if(state.activeSet==='s6a'){logo.style.display='none'}else logo.style.display='block'};

// Notifications are opt-in. Turning them on from settings requests Android permission.
if(typeof state.notificationsEnabled!=='boolean')state.notificationsEnabled=false;
try{VOXNative?.setSaleNotifications?.(!!state.notificationsEnabled)}catch{}

// Open market tabs with explicit event delegation as an extra guard against WebView click quirks.
$('#marketContent')?.addEventListener('click',e=>{const t=e.target.closest?.('[data-mtab]');if(!t)return;e.preventDefault();state.marketTab=t.dataset.mtab;save();renderMarket()});

// Current Japanese set should be selectable in market/offline UI immediately after its data load.
setTimeout(()=>{try{renderSetSwitches();renderHome();if(!$('#marketModal').classList.contains('hidden'))renderMarket();v05RefreshOfflinePanel()}catch(e){console.warn(e)}},1100);
