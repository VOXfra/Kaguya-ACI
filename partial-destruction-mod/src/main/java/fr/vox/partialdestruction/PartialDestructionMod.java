package fr.vox.partialdestruction;

import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.resources.ResourceLocation;
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
import net.minecraft.world.phys.shapes.CollisionContext;
import net.minecraft.world.phys.shapes.Shapes;
import net.minecraft.world.phys.shapes.VoxelShape;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.event.entity.player.PlayerInteractEvent;
import net.minecraftforge.eventbus.api.IEventBus;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;

import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Mod(PartialDestructionMod.MOD_ID)
public final class PartialDestructionMod {
    public static final String MOD_ID = "partialdestruction";

    private static final DeferredRegister<Block> BLOCKS = DeferredRegister.create(ForgeRegistries.BLOCKS, MOD_ID);
    private static final DeferredRegister<BlockEntityType<?>> BLOCK_ENTITIES = DeferredRegister.create(ForgeRegistries.BLOCK_ENTITY_TYPES, MOD_ID);

    public static final RegistryObject<PartialBlock> PARTIAL_BLOCK = BLOCKS.register("partial_block", () ->
        new PartialBlock(BlockBehaviour.Properties.of()
            .strength(-1.0F, 3_600_000.0F)
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
        MinecraftForge.EVENT_BUS.register(PartialMiningEvents.class);
    }

    public static final class PartialMiningEvents {
        @SubscribeEvent
        public static void onLeftClickBlock(PlayerInteractEvent.LeftClickBlock event) {
            Player player = event.getEntity();
            if (player.isCreative()) {
                return;
            }

            Level level = event.getLevel();
            BlockPos pos = event.getPos();
            BlockState state = level.getBlockState(pos);
            boolean partial = state.is(PARTIAL_BLOCK.get());
            boolean supported = isSupported(state);

            if (!partial && !supported) {
                return;
            }

            // Let the client send its normal START_DESTROY packet. The server is authoritative
            // and replaces the block immediately, which then syncs back to the client.
            if (level.isClientSide) {
                return;
            }

            event.setCanceled(true);
            if (event.getAction() != PlayerInteractEvent.LeftClickBlock.Action.START) {
                return;
            }

            if (!(player instanceof ServerPlayer serverPlayer)) {
                return;
            }

            if (partial) {
                advancePartialBlock(level, pos, state, serverPlayer);
            } else {
                beginPartialBlock(level, pos, state, event.getFace());
            }
        }

        private static void beginPartialBlock(Level level, BlockPos pos, BlockState originalState, @Nullable Direction face) {
            ResourceLocation originalId = ForgeRegistries.BLOCKS.getKey(originalState.getBlock());
            if (originalId == null) {
                return;
            }

            Direction hitFace = face == null ? Direction.NORTH : face;
            BlockState partialState = PARTIAL_BLOCK.get().defaultBlockState()
                .setValue(PartialBlock.FACE, hitFace)
                .setValue(PartialBlock.STAGE, 1);

            level.setBlock(pos, partialState, 3);
            BlockEntity blockEntity = level.getBlockEntity(pos);
            if (blockEntity instanceof PartialBlockEntity partialEntity) {
                partialEntity.setOriginalBlock(originalId);
            }
        }

        private static void advancePartialBlock(Level level, BlockPos pos, BlockState state, ServerPlayer player) {
            int stage = state.getValue(PartialBlock.STAGE);
            if (stage < 7) {
                level.setBlock(pos, state.setValue(PartialBlock.STAGE, stage + 1), 3);
                return;
            }

            ResourceLocation originalId = new ResourceLocation("minecraft", "stone");
            BlockEntity blockEntity = level.getBlockEntity(pos);
            if (blockEntity instanceof PartialBlockEntity partialEntity) {
                originalId = partialEntity.getOriginalBlock();
            }

            Block originalBlock = ForgeRegistries.BLOCKS.getValue(originalId);
            if (originalBlock == null || originalBlock == PARTIAL_BLOCK.get()) {
                originalBlock = net.minecraft.world.level.block.Blocks.STONE;
            }

            // Restore the real block first, then let vanilla/Forge perform the final break.
            // This means the final drop path, held tool and ordinary break events are used.
            level.setBlock(pos, originalBlock.defaultBlockState(), 3);
            player.gameMode.destroyBlock(pos);
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
            return getShape(state, level, pos, CollisionContext.empty());
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
