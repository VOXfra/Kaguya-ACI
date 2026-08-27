package fr.voxterra.client.hud;

import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.minecraft.client.Minecraft;

/**
 * Minimal immersion HUD owned by VoxTerra rather than a generic HUD mod.
 *
 * Design rules for Foundation 0.1.0:
 * - the crosshair is absent by default;
 * - the vanilla hotbar is rendered by Minecraft itself, at full opacity;
 * - the hotbar is only revealed briefly when the selected slot changes or
 *   while the player is actively using an item.
 *
 * Keeping the original vanilla hotbar renderer is deliberate: VoxTerra only
 * controls its visibility and never applies alpha to item sprites. This avoids
 * the transparent-item failure seen with stacked HUD/render mods.
 */
public final class FoundationHud {
    private static final long HOTBAR_REVEAL_NANOS = 2_200_000_000L;

    private static int lastSelectedSlot = -1;
    private static long hotbarVisibleUntilNanos = 0L;

    private FoundationHud() {
    }

    public static void initialize() {
        HudElementRegistry.replaceElement(VanillaHudElements.HOTBAR, original -> (graphics, tracker) -> {
            if (shouldShowHotbar()) {
                original.render(graphics, tracker);
            }
        });

        HudElementRegistry.replaceElement(VanillaHudElements.CROSSHAIR, original -> (graphics, tracker) -> {
            // Intentionally empty. Contextual interaction feedback will be
            // implemented by VoxTerra itself rather than a permanent reticle.
        });

        ClientTickEvents.END_CLIENT_TICK.register(FoundationHud::tick);
    }

    private static void tick(Minecraft client) {
        if (client.player == null) {
            lastSelectedSlot = -1;
            hotbarVisibleUntilNanos = 0L;
            return;
        }

        int selectedSlot = client.player.getInventory().getSelectedSlot();
        if (selectedSlot != lastSelectedSlot) {
            lastSelectedSlot = selectedSlot;
            revealHotbar();
        }

        if (client.player.isUsingItem()) {
            revealHotbar();
        }
    }

    private static boolean shouldShowHotbar() {
        Minecraft client = Minecraft.getInstance();
        return client.player == null || System.nanoTime() <= hotbarVisibleUntilNanos;
    }

    private static void revealHotbar() {
        hotbarVisibleUntilNanos = System.nanoTime() + HOTBAR_REVEAL_NANOS;
    }
}
