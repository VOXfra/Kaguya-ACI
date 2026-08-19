'use strict';

/* V1.0.1 runtime hardening: null must mean "use listing price", not a zero-value remote total. */
const v101ConsumeListingBase=v101ConsumeListing;
v101ConsumeListing=function(slot,l,requested,byId,onlineTradeTotal=null){
 const explicit=(onlineTradeTotal===null||onlineTradeTotal===undefined)?Number.NaN:onlineTradeTotal;
 return v101ConsumeListingBase(slot,l,requested,byId,explicit);
};
window.__voxV101RuntimeReady=true;
