#include <ps5native/graphics_presentation.hpp>

#ifdef _WIN32
#include <ps5native/win32_d3d12_graphics_backend.hpp>
#endif

#include <iostream>
#include <memory>

namespace {
#ifdef _WIN32
bool check(bool condition, const char* line) {
    std::cout << line << (condition ? "PASS" : "FAIL") << '\n';
    return condition;
}
#endif
} // namespace

int main() {
#ifndef _WIN32
    std::cout << "Win32 D3D12 presentation backend available: no\n";
    return 77;
#else
    auto backend = std::make_shared<ps5native::Win32D3D12GraphicsBackend>();
    bool ok = check(
        backend->presentation_available(),
        "Win32 D3D12 presentation backend available: ");
    if (!ok) {
        return 1;
    }

    ps5native::GraphicsPresentationSurface presentation(backend);
    ps5native::GraphicsError error{};

    ps5native::GraphicsPresentationDesc desc{};
    desc.width = 320;
    desc.height = 180;
    desc.buffer_count = 2;
    desc.format = ps5native::GraphicsTextureFormat::Rgba8Unorm;
    desc.visible = true;
    desc.frame_latency_waitable = false;
    desc.max_frame_latency = 1;
    desc.title = "PS5NativeCore v14.6.1 D3D12 Present Probe";

    const auto surface = presentation.create(desc, &error);
    ok &= check(
        surface.has_value() && error == ps5native::GraphicsError::None,
        "Graphics Win32 HWND + DXGI flip-model swapchain create: ");
    if (!surface) {
        return 1;
    }

    const auto initial = presentation.info(*surface, &error);
    ok &= check(
        initial &&
        initial->desc.width == 320 &&
        initial->desc.height == 180 &&
        initial->desc.buffer_count == 2 &&
        initial->current_back_buffer < 2 &&
        initial->present_count == 0,
        "Graphics swapchain back-buffer inventory/current-index: ");

    ok &= check(
        presentation.clear_and_present(*surface, 0.08f, 0.16f, 0.75f, 1.0f, 5000) ==
            ps5native::GraphicsError::None &&
        presentation.clear_and_present(*surface, 0.75f, 0.12f, 0.08f, 1.0f, 5000) ==
            ps5native::GraphicsError::None &&
        presentation.clear_and_present(*surface, 0.08f, 0.70f, 0.18f, 1.0f, 5000) ==
            ps5native::GraphicsError::None,
        "Graphics D3D12 PRESENT->RENDER_TARGET clear->PRESENT frames: ");

    const auto after_frames = presentation.info(*surface, &error);
    ok &= check(
        after_frames &&
        after_frames->present_count == 3 &&
        after_frames->current_back_buffer < after_frames->desc.buffer_count,
        "Graphics DXGI Present/frame-count progression: ");

    ok &= check(
        presentation.resize(*surface, 400, 225, 5000) ==
            ps5native::GraphicsError::None &&
        presentation.clear_and_present(*surface, 0.18f, 0.10f, 0.42f, 1.0f, 5000) ==
            ps5native::GraphicsError::None,
        "Graphics DXGI ResizeBuffers + post-resize present: ");

    const auto resized = presentation.info(*surface, &error);
    ok &= check(
        resized &&
        resized->desc.width == 400 &&
        resized->desc.height == 225 &&
        resized->present_count == 4,
        "Graphics presentation metadata after resize: ");

    auto invalid_format_desc = desc;
    invalid_format_desc.format = ps5native::GraphicsTextureFormat::D32Float;
    invalid_format_desc.visible = false;
    invalid_format_desc.title = "invalid";
    const auto invalid_format = presentation.create(invalid_format_desc, &error);
    const bool invalid_format_guard = !invalid_format &&
        error == ps5native::GraphicsError::InvalidArgument;
    const bool invalid_clear_guard =
        presentation.clear_and_present(*surface, -0.1f, 0.0f, 0.0f, 1.0f, 5000) ==
        ps5native::GraphicsError::InvalidArgument;
    ok &= check(
        invalid_format_guard && invalid_clear_guard,
        "Graphics presentation format/color argument guards: ");

    const auto old_surface = *surface;
    ok &= presentation.destroy(*surface) == ps5native::GraphicsError::None;
    const bool stale_rejected =
        presentation.clear_and_present(old_surface, 0.0f, 0.0f, 0.0f, 1.0f, 5000) ==
            ps5native::GraphicsError::InvalidHandle &&
        !presentation.info(old_surface, &error).has_value() &&
        error == ps5native::GraphicsError::InvalidHandle;

    auto replacement_desc = desc;
    replacement_desc.visible = false;
    replacement_desc.title = "PS5NativeCore v6.2.1 generation reuse";
    const auto replacement = presentation.create(replacement_desc, &error);
    const bool generation_reuse = replacement && *replacement != old_surface;
    ok &= check(
        stale_rejected && generation_reuse,
        "Graphics presentation stale-generation rejection/reuse: ");

    if (replacement) {
        ok &= presentation.clear_and_present(
            *replacement, 0.02f, 0.02f, 0.02f, 1.0f, 5000) ==
            ps5native::GraphicsError::None;
        ok &= presentation.destroy(*replacement) == ps5native::GraphicsError::None;
    }

    ok &= check(
        presentation.count() == 0,
        "Graphics presentation lifecycle cleanup: ");

    ok &= check(
        true,
        "No PS5/AGC presentation ABI or flip semantics claimed: ");

    ok &= check(
        ok,
        "Platform D3D12 graphics v6.2.1 presentation groundwork: ");

    if (!ok) {
        return 1;
    }

    std::cout << "GRAPHICS_PRESENTATION_V62_VERIFICATION_OK\n";
    return 0;
#endif
}
