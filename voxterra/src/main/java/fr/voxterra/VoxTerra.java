package fr.voxterra;

import net.fabricmc.api.ModInitializer;
import net.minecraft.resources.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Common entry point for VoxTerra Foundation.
 *
 * World generation and seasons are intentionally not owned here anymore:
 * the modpack delegates those large systems to Lithosphere and Serene Seasons.
 * VoxTerra owns custom gameplay and immersion glue instead.
 */
public final class VoxTerra implements ModInitializer {
    public static final String MOD_ID = "voxterra";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    @Override
    public void onInitialize() {
        LOGGER.info("VoxTerra Foundation 0.1.0 initialized");
    }

    public static Identifier id(String path) {
        return Identifier.fromNamespaceAndPath(MOD_ID, path);
    }
}
