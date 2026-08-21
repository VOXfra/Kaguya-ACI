'use strict';

// Preserve seller reputation/history when editing identity fields.
const v05CreateSellerProfileBase=v05CreateSellerProfile;
v05CreateSellerProfile=function(after=null){
 const previous=state.sellerProfile?{...state.sellerProfile}:null;
 v05CreateSellerProfileBase(after);
 if(!previous)return;
 const btn=document.querySelector('#saveSellerProfile');
 if(!btn)return;
 const original=btn.onclick;
 btn.onclick=()=>{
  original?.();
  if(state.sellerProfile){
   state.sellerProfile.rating=previous.rating??100;
   state.sellerProfile.completedSales=previous.completedSales??0;
   state.sellerProfile.createdAt=previous.createdAt??Date.now();
   save();
   if(state.marketTab==='sell'&&!document.querySelector('#marketModal')?.classList.contains('hidden'))renderMarket();
  }
 };
};

// Re-render the visible collection once native offline markers are known.
setTimeout(()=>{
 try{v05RefreshOfflinePanel();renderHome();renderBinder();if(state.inventoryTab==='cards')renderInventory()}catch(e){console.warn(e)}
},900);
