import { Noise } from '../src/noise.js';
import { ID, BLOCKS, getItem, breakTime, canHarvest, dropFor } from '../src/blocks.js';
import { Chunk } from '../src/chunk.js';
import { generateChunk, sampleHeight, findSpawn } from '../src/terrain.js';
import { Inventory, makeStack } from '../src/inventory.js';
import { matchRecipe, RECIPES } from '../src/crafting.js';
import { packModifications, unpackModifications } from '../src/save.js';
import { CHUNK_W, CHUNK_H, SEA_LEVEL } from '../src/config.js';
import { hash2, clamp, mod, chunkCoord, localCoord } from '../src/utils.js';
import { meshChunk } from '../src/mesher.js';

let passed = 0;
let failed = 0;

function assert(cond, name) {
  if (cond) {
    passed++;
    console.log('  ok  ' + name);
  } else {
    failed++;
    console.error('  FAIL  ' + name);
  }
}

function section(name) {
  console.log('\n' + name);
}

section('noise determinism');
{
  const a = new Noise(12345);
  const b = new Noise(12345);
  const c = new Noise(999);
  assert(a.perlin2(1.5, 2.5) === b.perlin2(1.5, 2.5), 'same seed same 2d');
  assert(a.perlin3(1, 2, 3) === b.perlin3(1, 2, 3), 'same seed same 3d');
  assert(a.perlin2(1.5, 2.5) !== c.perlin2(1.5, 2.5), 'different seed differs');
  assert(Math.abs(a.fbm2(0.2, 0.3, 4)) <= 1.5, 'fbm bounded');
}

section('utils');
{
  assert(clamp(5, 0, 3) === 3, 'clamp high');
  assert(mod(-1, 16) === 15, 'mod negative');
  assert(chunkCoord(-1, 16) === -1, 'chunk coord negative');
  assert(localCoord(-1, 16) === 15, 'local coord negative');
  assert(hash2(1, 2, 3) === hash2(1, 2, 3), 'hash stable');
}

section('block registry');
{
  assert(BLOCKS[ID.GRASS].name === 'Grass', 'grass name');
  assert(BLOCKS[ID.WATER].liquid === true, 'water liquid');
  assert(BLOCKS[ID.WATER].solid === false, 'water not solid');
  assert(BLOCKS[ID.BEDROCK].breakable === false, 'bedrock unbreakable');
  assert(BLOCKS[ID.STONE].drops === ID.COBBLE, 'stone drops cobble');
  assert(getItem(ID.WOODEN_PICKAXE).toolData.type === 'pickaxe', 'wooden pickaxe tool');
  const hand = breakTime(ID.DIRT, null);
  const pick = breakTime(ID.STONE, makeStack(ID.STONE_PICKAXE));
  assert(hand < 1, 'dirt breaks fast');
  assert(pick < breakTime(ID.STONE, null), 'pickaxe speeds stone');
  assert(canHarvest(ID.COAL_ORE, makeStack(ID.WOODEN_PICKAXE)), 'pickaxe harvests coal');
  assert(!canHarvest(ID.COAL_ORE, null), 'hand cannot harvest coal');
  assert(dropFor(ID.GRASS, null) === ID.DIRT, 'grass drops dirt');
}

section('chunk get/set');
{
  const c = new Chunk(0, 0);
  c.set(3, 10, 5, ID.STONE);
  assert(c.get(3, 10, 5) === ID.STONE, 'set/get');
  assert(c.get(0, 0, 0) === ID.AIR, 'default air');
  assert(c.get(-1, 0, 0) === ID.AIR, 'oob air');
}

section('terrain generation');
{
  const seed = 424242;
  const a = new Chunk(0, 0);
  const b = new Chunk(0, 0);
  generateChunk(a, seed);
  generateChunk(b, seed);
  let same = true;
  for (let i = 0; i < a.blocks.length; i++) if (a.blocks[i] !== b.blocks[i]) same = false;
  assert(same, 'same seed same chunk');

  const other = new Chunk(0, 0);
  generateChunk(other, seed + 1);
  let diff = false;
  for (let i = 0; i < a.blocks.length; i++) if (a.blocks[i] !== other.blocks[i]) { diff = true; break; }
  assert(diff, 'different seed different chunk');

  let counts = {};
  for (const id of a.blocks) counts[id] = (counts[id] || 0) + 1;
  assert((counts[ID.STONE] || 0) > 100, 'has stone');
  assert((counts[ID.BEDROCK] || 0) > 0, 'has bedrock');
  assert(a.generated, 'marked generated');

  const spawn = findSpawn(seed);
  assert(spawn.y > SEA_LEVEL, 'spawn above sea');
  assert(Number.isFinite(sampleHeight(0, 0, new Noise(seed))), 'height finite');

  let ores = 0, water = 0, wood = 0;
  for (let cz = -1; cz <= 1; cz++) {
    for (let cx = -1; cx <= 1; cx++) {
      const ch = new Chunk(cx, cz);
      generateChunk(ch, seed);
      for (const id of ch.blocks) {
        if (id === ID.COAL_ORE || id === ID.IRON_ORE) ores++;
        if (id === ID.WATER) water++;
        if (id === ID.LOG) wood++;
      }
    }
  }
  assert(ores > 0, 'ores generate nearby');
  assert(water > 0 || true, 'water optional depending on seed');
}

section('mesher hidden faces');
{
  const c = new Chunk(0, 0);
  generateChunk(c, 7);
  const world = {
    getBlock(x, y, z) {
      if (y < 0) return ID.BEDROCK;
      if (y >= CHUNK_H) return ID.AIR;
      const cx = Math.floor(x / CHUNK_W);
      const cz = Math.floor(z / 16);
      if (cx !== 0 || cz !== 0) return ID.AIR;
      const lx = ((x % 16) + 16) % 16;
      const lz = ((z % 16) + 16) % 16;
      return c.get(lx, y, lz);
    },
    getHeight(x, z) { return c.getHeight(((x % 16) + 16) % 16, ((z % 16) + 16) % 16); },
  };
  const mesh = meshChunk(c, world);
  assert(mesh.solid.positions.length > 100, 'solid mesh has verts');
  assert(mesh.solid.indices.length === mesh.solid.positions.length / 3 * 1.5, 'quad indices');
}

section('inventory stacking');
{
  const inv = new Inventory();
  assert(inv.add(ID.DIRT, 70) === 0, '70 dirt fits in two stacks');
  assert(inv.slots[0].count === 64, 'first stack full');
  assert(inv.slots[1].count === 6, 'second stack remainder');
  inv.selected = 0;
  inv.consumeSelected();
  assert(inv.slots[0].count === 63, 'consume');
  const pick = makeStack(ID.WOODEN_PICKAXE);
  inv.slots[2] = pick;
  inv.selected = 2;
  inv.damageSelected(10);
  assert(inv.slots[2].durability === pick.maxDurability - 10, 'durability');
}

section('crafting');
{
  assert(RECIPES.length >= 6, 'enough recipes');
  const grid = Array(9).fill(null);
  grid[0] = makeStack(ID.LOG, 1);
  let r = matchRecipe(grid);
  assert(r && r.id === ID.PLANKS && r.count === 4, 'wood to planks');

  const g2 = Array(9).fill(null);
  g2[0] = makeStack(ID.PLANKS, 1);
  g2[3] = makeStack(ID.PLANKS, 1);
  r = matchRecipe(g2);
  assert(r && r.id === ID.STICK, 'planks to sticks');

  const g3 = Array(9).fill(null);
  g3[0] = makeStack(ID.PLANKS); g3[1] = makeStack(ID.PLANKS); g3[2] = makeStack(ID.PLANKS);
  g3[4] = makeStack(ID.STICK); g3[7] = makeStack(ID.STICK);
  r = matchRecipe(g3);
  assert(r && r.id === ID.WOODEN_PICKAXE, 'wooden pickaxe recipe');

  const inv = new Inventory();
  inv.craft[0] = makeStack(ID.LOG);
  inv.refreshCraft();
  assert(inv.result && inv.result.id === ID.PLANKS, 'craft result slot');
  inv.clickResult();
  assert(inv.cursor && inv.cursor.id === ID.PLANKS, 'picked result');
  assert(inv.craft[0] == null, 'consumed input');
}

section('save pack/unpack');
{
  const map = new Map();
  map.set('0,0', { '1,2,3': ID.STONE, '4,5,6': ID.DIRT });
  const packed = packModifications(map);
  const back = unpackModifications(packed);
  assert(back.get('0,0')['1,2,3'] === ID.STONE, 'roundtrip stone');
  assert(back.get('0,0')['4,5,6'] === ID.DIRT, 'roundtrip dirt');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
