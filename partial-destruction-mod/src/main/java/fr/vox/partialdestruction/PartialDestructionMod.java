package fr.vox.partialdestruction;

import com.mojang.logging.LogUtils;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.BaseEntityBlock;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.RenderShape;
import net.minecraft.world.level.block.SoundType;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.BlockStateProperties;
import net.minecraft.world.level.block.state.properties.DirectionProperty;
import net.minecraft.world.level.block.state.properties.IntegerProperty;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.HitResult;
import net.minecraft.world.phys.shapes.CollisionContext;
import net.minecraft.world.phys.shapes.Shapes;
import net.minecraft.world.phys.shapes.VoxelShape;
import net.minecraftforge.event.level.BlockEvent;
import net.minecraftforge.eventbus.api.IEventBus;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;
import org.jetbrains.annotations.Nullable;
import org.slf4j.Logger;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Mod(PartialDestructionMod.MOD_ID)
public final class PartialDestructionMod {
    public static final String MOD_ID = "partialdestruction";
    public static final Logger LOGGER = LogUtils.getLogger();

    private static final DeferredRegister<Block> BLOCKS = DeferredRegister.create(ForgeRegistries.BLOCKS, MOD_ID);
    private static final DeferredRegister<BlockEntityType<?>> BLOCK_ENTITIES = DeferredRegister.create(ForgeRegistries.BLOCK_ENTITY_TYPES, MOD_ID);

    public static final RegistryObject<PartialBlock> PARTIAL_BLOCK = BLOCKS.register("partial_block", () ->
        new PartialBlock(BlockBehaviour.Properties.of()
            // Prototype stages must themselves be breakable, because each completed
            // mining action advances one physical destruction stage.
            .strength(0.20F, 6.0F)
            .sound(SoundType.STONE)
            .noOcclusion())
    );

    public static final RegistryObject<BlockEntityType<PartialBlockEntity>> PARTIAL_BLOCK_ENTITY = BLOCK_ENTITIES.register("partial_block", () ->
        BlockEntityType.Builder.of(PartialBlockEntity::new, PARTIAL_BLOCK.get()).build(null)
    );

    public PartialDestructionMod() {
        IEventBus modBus = FMLJavaModLoadingContext.get().getModEventBus();
        BLOCKS.register(modBus);
        BLOCK_ENTITIES.register(modBus);
        LOGGER.info("[Partial Destruction] Forge 1.20.1 v0.2.0 loaded");
    }

    /**
     * Using BreakEvent is intentionally more conservative than the old LeftClickBlock
     * prototype. Forge fires this when the server is actually about to remove the
     * block, after Minecraft/TFC has already handled mining speed and tool checks.
     */
    @Mod.EventBusSubscriber(modid = MOD_ID, bus = Mod.EventBusSubscriber.Bus.FORGE)
    public static final class PartialMiningEvents {
        private static final Set<String> FINAL_BREAK_BYPASS = ConcurrentHashMap.newKeySet();

        @SubscribeEvent
        public static void onBreak(BlockEvent.BreakEvent event) {
            if (!(event.getLevel() instanceof ServerLevel level)) {
                return;
            }

            Player rawPlayer = event.getPlayer();
            if (!(rawPlayer instanceof ServerPlayer player) || player.isCreative()) {
                return;
            }

            BlockPos pos = event.getPos();
            String bypassKey = key(level, pos);

            // The final stage restores the real original block and asks vanilla to
            // destroy it normally. That nested break must be allowed through once.
            if (FINAL_BREAK_BYPASS.remove(bypassKey)) {
                LOGGER.debug("[Partial Destruction] Allowing final vanilla break at {}", pos);
                return;
            }

            BlockState state = level.getBlockState(pos);

            if (state.is(PARTIAL_BLOCK.get())) {
                event.setCanceled(true);
                advancePartialBlock(level, pos, state, player, bypassKey);
                return;
            }

            if (!isSupported(state)) {
                return;
            }

            event.setCanceled(true);
            Direction face = resolveHitFace(player, pos);
            beginPartialBlock(level, pos, state, face);
            LOGGER.info("[Partial Destruction] Started {} at {} from {}", blockId(state), pos, face);
        }

        private static void beginPartialBlock(ServerLevel level, BlockPos pos, BlockState originalState, Direction face) {
            ResourceLocation originalId = ForgeRegistries.BLOCKS.getKey(originalState.getBlock());
            if (originalId == null) {
                return;
            }

            BlockState partialState = PARTIAL_BLOCK.get().defaultBlockState()
                .setValue(PartialBlock.FACE, face)
                .setValue(PartialBlock.STAGE, 1);

            level.setBlock(pos, partialState, Block.UPDATE_ALL);
            BlockEntity blockEntity = level.getBlockEntity(pos);
            if (blockEntity instanceof PartialBlockEntity partialEntity) {
                partialEntity.setOriginalBlock(originalId);
            } else {
                LOGGER.error("[Partial Destruction] Missing block entity after creating partial block at {}", pos);
            }
        }

        private static void advancePartialBlock(ServerLevel level, BlockPos pos, BlockState state, ServerPlayer player, String bypassKey) {
            int stage = state.getValue(PartialBlock.STAGE);
            BlockEntity blockEntity = level.getBlockEntity(pos);
            ResourceLocation originalId = new ResourceLocation("minecraft", "stone");
            if (blockEntity instanceof PartialBlockEntity partialEntity) {
                originalId = partialEntity.getOriginalBlock();
            }

            if (stage < 7) {
                level.setBlock(pos, state.setValue(PartialBlock.STAGE, stage + 1), Block.UPDATE_ALL);
                // setBlock on the same BaseEntityBlock should retain its BE, but make
                // the original id explicit so the prototype survives edge cases.
                BlockEntity after = level.getBlockEntity(pos);
                if (after instanceof PartialBlockEntity partialEntity) {
                    partialEntity.setOriginalBlock(originalId);
                }
                LOGGER.debug("[Partial Destruction] Advanced {} to stage {} at {}", originalId, stage + 1, pos);
                return;
            }

            Block originalBlock = ForgeRegistries.BLOCKS.getValue(originalId);
            if (originalBlock == null || originalBlock == PARTIAL_BLOCK.get()) {
                originalBlock = net.minecraft.world.level.block.Blocks.STONE;
            }

            // Restore the real block and perform ONE ordinary vanilla/Forge break.
            // The bypass key prevents our handler from intercepting this nested break.
            level.setBlock(pos, originalBlock.defaultBlockState(), Block.UPDATE_ALL);
            FINAL_BREAK_BYPASS.add(bypassKey);
            boolean destroyed = player.gameMode.destroyBlock(pos);
            if (!destroyed) {
                FINAL_BREAK_BYPASS.remove(bypassKey);
                LOGGER.warn("[Partial Destruction] Final vanilla break was rejected at {}", pos);
            } else {
                LOGGER.info("[Partial Destruction] Finished {} at {}", originalId, pos);
            }
        }

        private static Direction resolveHitFace(ServerPlayer player, BlockPos target) {
            // BreakEvent itself does not carry the hit face. Ray trace from the
            // player's current eye position at the instant the break completes.
            HitResult hit = player.pick(6.0D, 0.0F, false);
            if (hit instanceof BlockHitResult blockHit && blockHit.getBlockPos().equals(target)) {
                return blockHit.getDirection();
            }
            return Direction.NORTH;
        }

        private static boolean isSupported(BlockState state) {
            ResourceLocation id = ForgeRegistries.BLOCKS.getKey(state.getBlock());
            if (id == null) {
                return false;
            }

            if (id.getNamespace().equals("minecraft")) {
                String path = id.getPath();
                return path.equals("stone")
                    || path.equals("cobblestone")
                    || path.equals("deepslate")
                    || path.equals("cobbled_deepslate");
            }

            if (id.getNamespace().equals("tfc")) {
                String path = id.getPath();
                return path.startsWith("rock/raw/")
                    || path.startsWith("rock/hardened/")
                    || path.startsWith("rock/cobble/");
            }

            return false;
        }

        private static String key(ServerLevel level, BlockPos pos) {
            return level.dimension().location() + ":" + pos.asLong();
        }

        private static String blockId(BlockState state) {
            ResourceLocation id = ForgeRegistries.BLOCKS.getKey(state.getBlock());
            return id == null ? "unknown" : id.toString();
        }
    }

    public static final class PartialBlock extends BaseEntityBlock {
        public static final DirectionProperty FACE = BlockStateProperties.FACING;
        public static final IntegerProperty STAGE = IntegerProperty.create("stage", 1, 7);
        private static final EnumMap<Direction, VoxelShape[]> SHAPES = buildShapes();

        public PartialBlock(Properties properties) {
            super(properties);
            registerDefaultState(stateDefinition.any()
                .setValue(FACE, Direction.NORTH)
                .setValue(STAGE, 1));
        }

        @Override
        protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
            builder.add(FACE, STAGE);
        }

        @Override
        public RenderShape getRenderShape(BlockState state) {
            return RenderShape.MODEL;
        }

        @Override
        public VoxelShape getShape(BlockState state, BlockGetter level, BlockPos pos, CollisionContext context) {
            return SHAPES.get(state.getValue(FACE))[state.getValue(STAGE) - 1];
        }

        @Override
        public VoxelShape getCollisionShape(BlockState state, BlockGetter level, BlockPos pos, CollisionContext context) {
            return getShape(state, level, pos, context);
        }

        @Override
        public VoxelShape getOcclusionShape(BlockState state, BlockGetter level, BlockPos pos) {
            return Shapes.empty();
        }

        @Nullable
        @Override
        public BlockEntity newBlockEntity(BlockPos pos, BlockState state) {
            return new PartialBlockEntity(pos, state);
        }

        private static EnumMap<Direction, VoxelShape[]> buildShapes() {
            EnumMap<Direction, VoxelShape[]> result = new EnumMap<>(Direction.class);
            for (Direction direction : Direction.values()) {
                VoxelShape[] stages = new VoxelShape[7];
                List<Cell> cells = new ArrayList<>();
                for (int x = 0; x < 4; x++) {
                    for (int y = 0; y < 4; y++) {
                        for (int z = 0; z < 4; z++) {
                            cells.add(new Cell(x, y, z, scoreCell(direction, x, y, z)));
                        }
                    }
                }
                cells.sort(Comparator.comparingDouble(Cell::score));

                for (int stage = 1; stage <= 7; stage++) {
                    Set<Integer> removed = new HashSet<>();
                    for (int i = 0; i < stage * 8; i++) {
                        Cell c = cells.get(i);
                        removed.add(encode(c.x(), c.y(), c.z()));
                    }

                    VoxelShape shape = Shapes.empty();
                    for (int x = 0; x < 4; x++) {
                        for (int y = 0; y < 4; y++) {
                            for (int z = 0; z < 4; z++) {
                                if (!removed.contains(encode(x, y, z))) {
                                    shape = Shapes.or(shape, Block.box(
                                        x * 4.0D, y * 4.0D, z * 4.0D,
                                        (x + 1) * 4.0D, (y + 1) * 4.0D, (z + 1) * 4.0D
                                    ));
                                }
                            }
                        }
                    }
                    stages[stage - 1] = shape.optimize();
                }
                result.put(direction, stages);
            }
            return result;
        }

        private static int encode(int x, int y, int z) {
            return x * 16 + y * 4 + z;
        }

        private static double scoreCell(Direction face, int x, int y, int z) {
            double cx = (x + 0.5D) / 4.0D;
            double cy = (y + 0.5D) / 4.0D;
            double cz = (z + 0.5D) / 4.0D;

            int depth;
            double radial;
            switch (face) {
                case NORTH -> {
                    depth = z;
                    radial = square(cx - 0.5D) + square(cy - 0.5D);
                }
                case SOUTH -> {
                    depth = 3 - z;
                    radial = square(cx - 0.5D) + square(cy - 0.5D);
                }
                case WEST -> {
                    depth = x;
                    radial = square(cz - 0.5D) + square(cy - 0.5D);
                }
                case EAST -> {
                    depth = 3 - x;
                    radial = square(cz - 0.5D) + square(cy - 0.5D);
                }
                case DOWN -> {
                    depth = y;
                    radial = square(cx - 0.5D) + square(cz - 0.5D);
                }
                case UP -> {
                    depth = 3 - y;
                    radial = square(cx - 0.5D) + square(cz - 0.5D);
                }
                default -> throw new IllegalStateException("Unexpected direction " + face);
            }
            return depth * 100.0D + radial * 10.0D + (x + y + z) * 0.001D;
        }

        private static double square(double value) {
            return value * value;
        }

        private record Cell(int x, int y, int z, double score) {}
    }

    public static final class PartialBlockEntity extends BlockEntity {
        private ResourceLocation originalBlock = new ResourceLocation("minecraft", "stone");

        public PartialBlockEntity(BlockPos pos, BlockState state) {
            super(PARTIAL_BLOCK_ENTITY.get(), pos, state);
        }

        public ResourceLocation getOriginalBlock() {
            return originalBlock;
        }

        public void setOriginalBlock(ResourceLocation originalBlock) {
            this.originalBlock = originalBlock;
            setChanged();
        }

        @Override
        protected void saveAdditional(CompoundTag tag) {
            super.saveAdditional(tag);
            tag.putString("OriginalBlock", originalBlock.toString());
        }

        @Override
        public void load(CompoundTag tag) {
            super.load(tag);
            if (tag.contains("OriginalBlock")) {
                ResourceLocation parsed = ResourceLocation.tryParse(tag.getString("OriginalBlock"));
                if (parsed != null) {
                    originalBlock = parsed;
                }
            }
        }
    }
}
