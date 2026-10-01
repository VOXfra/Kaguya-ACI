#pragma once
#include <cstddef>
#include <string>
#include <string_view>
#include <vector>
namespace dakar {
enum class MenuBootStage { HostPreconstruction, Ps5ImageMapped, ExactImportsResolved, TlsReady, InitializersComplete, RootEntered, FirstPresent, MenuLevelRequested, MenuInteractive };
struct MenuBootstrapEvidence {
 bool host_substrate_ready{}; bool pc_menu_anchors_complete{}; bool pc_boot_modules_complete{};
 bool real_ps5_eboot_plaintext{}; bool ps5_image_mapped{}; bool ps5_exact_imports_resolved{}; bool ps5_exact_module_set_ready{};
 bool ps5_tls_ready{}; bool ps5_initializers_complete{}; bool ps5_root_entered{}; bool ps5_agc_payload_ready{};
 bool first_present_observed{}; bool menu_level_requested{}; bool menu_interactive_observed{};
};
struct MenuBootstrapAssessment {
 MenuBootStage highest_stage{MenuBootStage::HostPreconstruction}; bool host_preconstruction_ready{}; bool real_guest_entry_allowed{};
 bool menu_target_reached{}; bool menu_interactive_proven{}; std::vector<std::string> blockers;
};
class MenuBootstrapContract {
public:
 static const std::vector<std::string_view>& menu_assets();
 static const std::vector<std::string_view>& boot_modules();
 static MenuBootstrapAssessment assess(const MenuBootstrapEvidence& evidence);
 static std::string_view stage_name(MenuBootStage stage) noexcept;
};
class MenuBootstrapTracker {
public:
 bool advance(MenuBootStage stage, std::string* error=nullptr);
 MenuBootStage current() const noexcept { return current_; }
 const std::vector<MenuBootStage>& history() const noexcept { return history_; }
private:
 static std::size_t rank(MenuBootStage stage) noexcept;
 MenuBootStage current_{MenuBootStage::HostPreconstruction};
 std::vector<MenuBootStage> history_{MenuBootStage::HostPreconstruction};
};
}
