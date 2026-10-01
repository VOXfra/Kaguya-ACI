#include "dakar_menu_bootstrap.hpp"
namespace dakar {
namespace {
const std::vector<std::string_view> kMenuAssets={
"Dakar2Game/Plugins/Game/DakarGame/Content/Game/B_GameInstance.uasset",
"Dakar2Game/Plugins/Game/DakarGame/Content/Levels/L_DakarStart.umap",
"Dakar2Game/Plugins/Game/DakarGame/Content/Levels/L_DakarMenu.umap",
"Dakar2Game/Plugins/Game/DakarGame/Content/Levels/L_DakarLobby.umap",
"Dakar2Game/Plugins/Game/DakarGame/Content/Levels/L_DakarPodium.umap",
"Dakar2Game/Plugins/Game/DakarGame/Content/Game/Intro/BP_GameIntroController.uasset",
"Dakar2Game/Plugins/Game/DakarGame/Content/UMG2/MainMenu/B_NewMainMenu.uasset",
"Dakar2Game/Plugins/Game/DakarGame/Content/UMG2/Mainmenu.uasset",
"Dakar2Game/Plugins/Game/DakarGame/Content/UMG2/B_LoadingMenu.uasset",
"Dakar2Game/Content/Bink/bnk_DKR_GameIntro2.uasset",
"Dakar2Game/Content/Bink/bnk_Dakar_LoadingScreen.uasset"};
const std::vector<std::string_view> kBootModules={
"DakarGame","BmCore","BmGameFramework","BmLoading","BmOnline","BmRawInput","FMODStudio","OnlineSubsystem","OnlineSubsystemEOS","OnlineSubsystemUtils","BinkMediaPlayer","PhysXVehicles","BmPhysXHeightField","BmNavigationSystem","BmCharacter","BmItem","BmCustomization","BmRoadNetwork","BmTrafficSystem","BmShaders","BmSky"};
void add(std::vector<std::string>& b,bool ok,const char* id){if(!ok)b.emplace_back(id);}
}
const std::vector<std::string_view>& MenuBootstrapContract::menu_assets(){return kMenuAssets;}
const std::vector<std::string_view>& MenuBootstrapContract::boot_modules(){return kBootModules;}
std::string_view MenuBootstrapContract::stage_name(MenuBootStage s) noexcept {
 switch(s){
 case MenuBootStage::HostPreconstruction:return "HOST_PRECONSTRUCTION";
 case MenuBootStage::Ps5ImageMapped:return "PS5_IMAGE_MAPPED";
 case MenuBootStage::ExactImportsResolved:return "EXACT_IMPORTS_RESOLVED";
 case MenuBootStage::TlsReady:return "TLS_READY";
 case MenuBootStage::InitializersComplete:return "INITIALIZERS_COMPLETE";
 case MenuBootStage::RootEntered:return "ROOT_ENTERED";
 case MenuBootStage::FirstPresent:return "FIRST_PRESENT";
 case MenuBootStage::MenuLevelRequested:return "MENU_LEVEL_REQUESTED";
 case MenuBootStage::MenuInteractive:return "MENU_INTERACTIVE";
 } return "UNKNOWN";
}
MenuBootstrapAssessment MenuBootstrapContract::assess(const MenuBootstrapEvidence& e){
 MenuBootstrapAssessment o;
 o.host_preconstruction_ready=e.host_substrate_ready&&e.pc_menu_anchors_complete&&e.pc_boot_modules_complete;
 add(o.blockers,e.host_substrate_ready,"host_substrate"); add(o.blockers,e.pc_menu_anchors_complete,"pc_menu_anchors"); add(o.blockers,e.pc_boot_modules_complete,"pc_boot_modules");
 if(!o.host_preconstruction_ready)return o;
 add(o.blockers,e.real_ps5_eboot_plaintext,"ps5_eboot_plaintext"); if(!e.real_ps5_eboot_plaintext)return o;
 add(o.blockers,e.ps5_image_mapped,"ps5_image_mapped"); if(!e.ps5_image_mapped)return o; o.highest_stage=MenuBootStage::Ps5ImageMapped;
 add(o.blockers,e.ps5_exact_imports_resolved,"ps5_exact_imports"); add(o.blockers,e.ps5_exact_module_set_ready,"ps5_exact_module_set"); if(!e.ps5_exact_imports_resolved||!e.ps5_exact_module_set_ready)return o; o.highest_stage=MenuBootStage::ExactImportsResolved;
 add(o.blockers,e.ps5_tls_ready,"ps5_tls"); if(!e.ps5_tls_ready)return o; o.highest_stage=MenuBootStage::TlsReady;
 add(o.blockers,e.ps5_initializers_complete,"ps5_initializers"); if(!e.ps5_initializers_complete)return o; o.highest_stage=MenuBootStage::InitializersComplete;
 o.real_guest_entry_allowed=true; add(o.blockers,e.ps5_root_entered,"ps5_root_entry"); if(!e.ps5_root_entered)return o; o.highest_stage=MenuBootStage::RootEntered;
 add(o.blockers,e.ps5_agc_payload_ready,"ps5_agc_payload"); add(o.blockers,e.first_present_observed,"first_present"); if(!e.ps5_agc_payload_ready||!e.first_present_observed)return o; o.highest_stage=MenuBootStage::FirstPresent;
 add(o.blockers,e.menu_level_requested,"L_DakarMenu_requested"); if(!e.menu_level_requested)return o; o.highest_stage=MenuBootStage::MenuLevelRequested; o.menu_target_reached=true;
 add(o.blockers,e.menu_interactive_observed,"menu_interactive_input"); if(!e.menu_interactive_observed)return o; o.highest_stage=MenuBootStage::MenuInteractive; o.menu_interactive_proven=true; return o;
}
std::size_t MenuBootstrapTracker::rank(MenuBootStage s) noexcept { return static_cast<std::size_t>(s); }
bool MenuBootstrapTracker::advance(MenuBootStage s,std::string* e){
 auto w=rank(s),h=rank(current_); if(w<h){if(e)*e="menu bootstrap stage regression";return false;} if(w>h+1){if(e)*e="menu bootstrap stage skip";return false;} if(w==h)return true; current_=s;history_.push_back(s);return true;
}
}