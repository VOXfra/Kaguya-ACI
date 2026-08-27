package fr.voxterra.client;

import net.fabricmc.api.ClientModInitializer;

public final class VoxTerraClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        // Seasonal rendering hooks are intentionally kept client-side and isolated here.
    }
}
