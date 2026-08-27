package fr.voxterra.client;

import fr.voxterra.client.hud.FoundationHud;
import net.fabricmc.api.ClientModInitializer;

public final class VoxTerraClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        FoundationHud.initialize();
    }
}
