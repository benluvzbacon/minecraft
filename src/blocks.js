export const ID = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  GRAVEL: 5,
  LOG: 6,
  LEAVES: 7,
  WATER: 8,
  COAL_ORE: 9,
  IRON_ORE: 10,
  BEDROCK: 11,
  PLANKS: 12,
  COBBLE: 13,
  STICK: 100,
  WOODEN_PICKAXE: 101,
  STONE_PICKAXE: 102,
  WOODEN_AXE: 103,
  STONE_AXE: 104,
  BERRIES: 105,
};

const BLOCK_DEFAULTS = {
  solid: true,
  opaque: true,
  breakable: true,
  transparent: false,
  liquid: false,
  hardness: 1,
  tool: null,
  requiresTool: false,
  drops: null,
  stack: 64,
  isBlock: true,
  isItem: false,
  faces: { all: 0 },
  color: 0xffffff,
};

function block(def) {
  const b = { ...BLOCK_DEFAULTS, ...def };
  if (b.drops == null && b.isBlock) b.drops = b.id;
  return b;
}

export const BLOCKS = [];
export const ITEMS = {};

function register(def) {
  const b = block(def);
  BLOCKS[b.id] = b;
  ITEMS[b.id] = b;
  return b;
}

register({
  id: ID.AIR,
  name: 'Air',
  solid: false,
  opaque: false,
  breakable: false,
  transparent: true,
  isBlock: true,
  hardness: 0,
  drops: 0,
  stack: 0,
  faces: { all: 0 },
});

register({
  id: ID.GRASS,
  name: 'Grass',
  hardness: 0.45,
  tool: 'shovel',
  drops: ID.DIRT,
  faces: { top: 0, side: 1, bottom: 2 },
  color: 0x5aae3a,
});

register({
  id: ID.DIRT,
  name: 'Dirt',
  hardness: 0.4,
  tool: 'shovel',
  faces: { all: 2 },
  color: 0x8a5a32,
});

register({
  id: ID.STONE,
  name: 'Stone',
  hardness: 1.5,
  tool: 'pickaxe',
  requiresTool: false,
  drops: ID.COBBLE,
  faces: { all: 3 },
  color: 0x7a7a7a,
});

register({
  id: ID.SAND,
  name: 'Sand',
  hardness: 0.4,
  tool: 'shovel',
  faces: { all: 4 },
  color: 0xd8c27a,
});

register({
  id: ID.GRAVEL,
  name: 'Gravel',
  hardness: 0.5,
  tool: 'shovel',
  faces: { all: 5 },
  color: 0x8b8680,
});

register({
  id: ID.LOG,
  name: 'Wood',
  hardness: 0.9,
  tool: 'axe',
  faces: { top: 7, bottom: 7, side: 6 },
  color: 0x7a4e2a,
});

register({
  id: ID.LEAVES,
  name: 'Leaves',
  hardness: 0.2,
  opaque: false,
  transparent: true,
  solid: true,
  tool: 'axe',
  drops: 0,
  dropChance: 0.18,
  dropAlt: ID.BERRIES,
  faces: { all: 8 },
  color: 0x3d8c3a,
});

register({
  id: ID.WATER,
  name: 'Water',
  solid: false,
  opaque: false,
  transparent: true,
  liquid: true,
  breakable: true,
  hardness: 0.25,
  faces: { all: 9 },
  color: 0x3a7bd5,
});

register({
  id: ID.COAL_ORE,
  name: 'Coal Ore',
  hardness: 2.2,
  tool: 'pickaxe',
  requiresTool: true,
  faces: { all: 10 },
  color: 0x4a4a4a,
});

register({
  id: ID.IRON_ORE,
  name: 'Iron Ore',
  hardness: 2.6,
  tool: 'pickaxe',
  requiresTool: true,
  minTier: 1,
  faces: { all: 11 },
  color: 0xb07a5a,
});

register({
  id: ID.BEDROCK,
  name: 'Bedrock',
  breakable: false,
  hardness: 999,
  faces: { all: 12 },
  color: 0x333333,
});

register({
  id: ID.PLANKS,
  name: 'Planks',
  hardness: 0.7,
  tool: 'axe',
  faces: { all: 13 },
  color: 0xc4a05a,
});

register({
  id: ID.COBBLE,
  name: 'Cobblestone',
  hardness: 1.5,
  tool: 'pickaxe',
  faces: { all: 14 },
  color: 0x6b6b6b,
});

function item(def) {
  const it = {
    solid: false,
    opaque: false,
    breakable: false,
    transparent: true,
    liquid: false,
    hardness: 0,
    isBlock: false,
    isItem: true,
    stack: 64,
    tool: null,
    faces: { all: 0 },
    ...def,
  };
  ITEMS[it.id] = it;
  return it;
}

item({
  id: ID.STICK,
  name: 'Stick',
  stack: 64,
  icon: 'stick',
  color: 0x8b5a2b,
});

item({
  id: ID.BERRIES,
  name: 'Berries',
  stack: 64,
  icon: 'berries',
  color: 0xcc3344,
  food: 4,
});

item({
  id: ID.WOODEN_PICKAXE,
  name: 'Wooden Pickaxe',
  stack: 1,
  icon: 'pickaxe',
  color: 0xc4a05a,
  toolData: { type: 'pickaxe', tier: 1, speed: 2.2, durability: 80 },
});

item({
  id: ID.STONE_PICKAXE,
  name: 'Stone Pickaxe',
  stack: 1,
  icon: 'pickaxe',
  color: 0x8a8a8a,
  toolData: { type: 'pickaxe', tier: 2, speed: 4.0, durability: 180 },
});

item({
  id: ID.WOODEN_AXE,
  name: 'Wooden Axe',
  stack: 1,
  icon: 'axe',
  color: 0xc4a05a,
  toolData: { type: 'axe', tier: 1, speed: 2.2, durability: 80 },
});

item({
  id: ID.STONE_AXE,
  name: 'Stone Axe',
  stack: 1,
  icon: 'axe',
  color: 0x8a8a8a,
  toolData: { type: 'axe', tier: 2, speed: 4.0, durability: 180 },
});

export function getItem(id) {
  return ITEMS[id] || BLOCKS[id] || null;
}

export function isSolid(id) {
  const b = BLOCKS[id];
  return !!(b && b.solid);
}

export function isOpaque(id) {
  const b = BLOCKS[id];
  return !!(b && b.opaque);
}

export function isLiquid(id) {
  const b = BLOCKS[id];
  return !!(b && b.liquid);
}

export function faceTile(id, face) {
  const b = BLOCKS[id];
  if (!b) return 0;
  const f = b.faces;
  if (face === 'top') return f.top ?? f.all ?? 0;
  if (face === 'bottom') return f.bottom ?? f.all ?? 0;
  return f.side ?? f.all ?? 0;
}

export function breakTime(blockId, toolItem) {
  const b = BLOCKS[blockId];
  if (!b || !b.breakable) return Infinity;
  let t = b.hardness;
  const td = toolItem && getItem(toolItem.id) && getItem(toolItem.id).toolData;
  if (td && b.tool && td.type === b.tool) {
    t /= td.speed;
  } else if (b.tool === 'pickaxe' && b.requiresTool) {
    t *= 3.5;
  }
  return Math.max(0.08, t);
}

export function canHarvest(blockId, toolItem) {
  const b = BLOCKS[blockId];
  if (!b) return false;
  if (!b.requiresTool) return true;
  const td = toolItem && getItem(toolItem.id) && getItem(toolItem.id).toolData;
  if (!td) return false;
  if (b.tool && td.type !== b.tool) return false;
  const min = b.minTier || 1;
  return td.tier >= min;
}

export function dropFor(blockId, toolItem) {
  const b = BLOCKS[blockId];
  if (!b) return 0;
  if (!canHarvest(blockId, toolItem)) return 0;
  if (b.dropChance != null) {
    if (Math.random() > b.dropChance) return 0;
    return b.dropAlt ?? b.drops ?? 0;
  }
  return b.drops ?? blockId;
}

export const PLACEABLE_BLOCKS = [
  ID.GRASS, ID.DIRT, ID.STONE, ID.SAND, ID.GRAVEL, ID.LOG, ID.LEAVES,
  ID.WATER, ID.COAL_ORE, ID.IRON_ORE, ID.PLANKS, ID.COBBLE,
];
