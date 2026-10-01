#include "dakar_menu_bootstrap.hpp"
#include <iostream>
#include <string>
int main(){
 using namespace dakar;
 if(MenuBootstrapContract::menu_assets().size()!=11)return 10;
 if(MenuBootstrapContract::boot_modules().size()!=21)return 11;
 MenuBootstrapEvidence pre{}; pre.host_substrate_ready=true; pre.pc_menu_anchors_complete=true; pre.pc_boot_modules_complete=true;
 auto b=MenuBootstrapContract::assess(pre);
 if(!b.host_preconstruction_ready||b.real_guest_entry_allowed)return 12;
 if(b.blockers.empty()||b.blockers.back()!="ps5_eboot_plaintext")return 13;
 MenuBootstrapEvidence e{}; e.host_substrate_ready=true;e.pc_menu_anchors_complete=true;e.pc_boot_modules_complete=true;e.real_ps5_eboot_plaintext=true;e.ps5_image_mapped=true;e.ps5_exact_imports_resolved=true;e.ps5_exact_module_set_ready=true;e.ps5_tls_ready=true;e.ps5_initializers_complete=true;e.ps5_root_entered=true;e.ps5_agc_payload_ready=true;e.first_present_observed=true;e.menu_level_requested=true;
 auto m=MenuBootstrapContract::assess(e); if(!m.menu_target_reached||m.menu_interactive_proven)return 14;
 e.menu_interactive_observed=true; auto i=MenuBootstrapContract::assess(e); if(!i.menu_interactive_proven||!i.blockers.empty())return 15;
 MenuBootstrapTracker t;std::string err;
 if(!t.advance(MenuBootStage::Ps5ImageMapped,&err))return 16;
 if(t.advance(MenuBootStage::TlsReady,&err)||err!="menu bootstrap stage skip")return 17;
 if(!t.advance(MenuBootStage::ExactImportsResolved,&err))return 18;
 if(!t.advance(MenuBootStage::TlsReady,&err))return 19;
 if(!t.advance(MenuBootStage::InitializersComplete,&err))return 20;
 if(!t.advance(MenuBootStage::RootEntered,&err))return 21;
 if(!t.advance(MenuBootStage::FirstPresent,&err))return 22;
 if(!t.advance(MenuBootStage::MenuLevelRequested,&err))return 23;
 if(!t.advance(MenuBootStage::MenuInteractive,&err))return 24;
 if(t.history().size()!=9)return 25;
 std::cout<<"V203_DAKAR_MENU_BOOTSTRAP_RUNTIME_OK\n"; return 0;
}