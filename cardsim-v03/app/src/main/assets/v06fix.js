'use strict';

// Japanese cards use their own foil families.
const v06VariantBase=v4CardVariant;
v4CardVariant=function(ins,c,setId){if(setId==='s6a'){const r=rarityFor(setId,cardNo(c));return ['jp_rare','jp_rr','jp_rrr','jp_sr','jp_hr','jp_ur'].includes(r)?'holo':'normal'}return v06VariantBase(ins,c,setId)};

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
