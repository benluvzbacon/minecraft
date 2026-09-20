import { CHUNK_W, CHUNK_H, CHUNK_D, SEA_LEVEL } from './config.js';
import { ID } from './blocks.js';
import { getNoise } from './noise.js';
import { hash2, hash3, hashInt } from './utils.js';

export function sampleHeight(x, z, noise) {
  const continent = noise.fbm2(x * 0.0032, z * 0.0032, 5);
  const hills = noise.fbm2(x * 0.018, z * 0.018, 4);
  const detail = noise.perlin2(x * 0.06, z * 0.06);
  const ridge = 1 - Math.abs(noise.fbm2(x * 0.007 + 40, z * 0.007 - 12, 3));

  let h = SEA_LEVEL + continent * 14 + hills * 7 + detail * 2.2;

  if (continent > 0.22) {
    const t = (continent - 0.22) / 0.78;
    h += t * t * ridge * 28;
  }
  if (continent < -0.12) {
    const t = (-0.12 - continent);
    h -= t * 18;
  }

  return Math.max(2, Math.min(CHUNK_H - 2, h));
}

export function isBeach(height, continent) {
  return height < SEA_LEVEL + 2.4 && height > SEA_LEVEL - 3 && continent < 0.18;
}

function treeAt(wx, wz, seed, noise) {
  const h = sampleHeight(wx, wz, noise);
  if (h < SEA_LEVEL + 1) return null;
  const continent = noise.fbm2(wx * 0.0032, wz * 0.0032, 5);
  if (continent < -0.05) return null;
  if (h > SEA_LEVEL + 22) return null;
  const n = hash2(wx, wz, seed ^ 0x51ed);
  if (n > 0.034) return null;
  const density = noise.perlin2(wx * 0.03 + 9, wz * 0.03 - 4);
  if (density < -0.15) return null;
  const trunkH = 4 + (hashInt(wx, wz, 7, seed) % 3);
  return { h: Math.floor(h), trunkH };
}

function oreAt(x, y, z, seed) {
  const n = hash3(x, y, z, seed ^ 0x0e91);
  if (y <= 36 && n < 0.0075) return ID.IRON_ORE;
  if (y <= 52 && n < 0.018) return ID.COAL_ORE;
  return 0;
}

function caveCarve(x, y, z, surface, noise) {
  if (y <= 2 || y >= surface - 2) return false;
  if (y > SEA_LEVEL && surface < SEA_LEVEL + 1) return false;
  const n1 = noise.perlin3(x * 0.05, y * 0.07, z * 0.05);
  const n2 = noise.perlin3(x * 0.09 + 20, y * 0.09, z * 0.09 - 8);
  if (Math.abs(n1) < 0.072 && y < 48) return true;
  if (n2 > 0.58 && y < surface - 4 && y > 5) return true;
  return false;
}

export function generateChunk(chunk, seed) {
  const noise = getNoise(seed);
  const ox = chunk.cx * CHUNK_W;
  const oz = chunk.cz * CHUNK_D;
  const blocks = chunk.blocks;

  const heights = new Float32Array((CHUNK_W + 6) * (CHUNK_D + 6));
  for (let z = -3; z < CHUNK_D + 3; z++) {
    for (let x = -3; x < CHUNK_W + 3; x++) {
      heights[(x + 3) + (z + 3) * (CHUNK_W + 6)] = sampleHeight(ox + x, oz + z, noise);
    }
  }

  for (let z = 0; z < CHUNK_D; z++) {
    for (let x = 0; x < CHUNK_W; x++) {
      const wx = ox + x;
      const wz = oz + z;
      const surface = heights[(x + 3) + (z + 3) * (CHUNK_W + 6)];
      const topY = Math.floor(surface);
      const continent = noise.fbm2(wx * 0.0032, wz * 0.0032, 5);
      const beach = isBeach(surface, continent);

      for (let y = 0; y < CHUNK_H; y++) {
        let id = ID.AIR;
        if (y === 0) {
          id = ID.BEDROCK;
        } else if (y === 1 && hash3(wx, y, wz, seed) < 0.6) {
          id = ID.BEDROCK;
        } else if (y > topY) {
          if (y <= SEA_LEVEL) id = ID.WATER;
          else id = ID.AIR;
        } else {
          const depth = topY - y;
          if (y <= topY && y > topY - 1) {
            if (topY < SEA_LEVEL - 1) id = ID.SAND;
            else if (beach) id = ID.SAND;
            else id = ID.GRASS;
          } else if (depth < 4) {
            if (beach || topY < SEA_LEVEL) id = ID.SAND;
            else id = ID.DIRT;
          } else {
            id = ID.STONE;
            const gravelN = hash3(wx, y, wz, seed ^ 19);
            if (gravelN < 0.03 && depth > 6) id = ID.GRAVEL;
            const ore = oreAt(wx, y, wz, seed);
            if (ore && id === ID.STONE) id = ore;
          }
          if (id !== ID.BEDROCK && caveCarve(wx, y, wz, topY, noise)) {
            id = y <= SEA_LEVEL && topY < SEA_LEVEL ? ID.WATER : ID.AIR;
          }
        }
        blocks[x + z * CHUNK_W + y * CHUNK_W * CHUNK_D] = id;
      }
    }
  }

  for (let z = -2; z < CHUNK_D + 2; z++) {
    for (let x = -2; x < CHUNK_W + 2; x++) {
      const wx = ox + x;
      const wz = oz + z;
      const tree = treeAt(wx, wz, seed, noise);
      if (!tree) continue;
      const baseY = tree.h;
      const th = tree.trunkH;
      for (let ty = 1; ty <= th; ty++) {
        const y = baseY + ty;
        placeIfLocal(chunk, x, y, z, ID.LOG);
      }
      const top = baseY + th;
      for (let ly = -2; ly <= 2; ly++) {
        const rad = ly >= 1 ? 1 : 2;
        for (let lz = -rad; lz <= rad; lz++) {
          for (let lx = -rad; lx <= rad; lx++) {
            if (Math.abs(lx) === rad && Math.abs(lz) === rad && hash3(wx + lx, top + ly, wz + lz, seed) < 0.45) continue;
            if (lx === 0 && lz === 0 && ly <= 0) continue;
            const yy = top + ly;
            if (yy <= baseY) continue;
            const cx = x + lx, cz = z + lz;
            if (cx < 0 || cz < 0 || cx >= CHUNK_W || cz >= CHUNK_D) continue;
            if (yy < 0 || yy >= CHUNK_H) continue;
            const i = cx + cz * CHUNK_W + yy * CHUNK_W * CHUNK_D;
            if (blocks[i] === ID.AIR) blocks[i] = ID.LEAVES;
          }
        }
      }
    }
  }

  chunk.generated = true;
  chunk.rebuildHeightMap();
  chunk.dirty = true;
}

function placeIfLocal(chunk, x, y, z, id) {
  if (x < 0 || z < 0 || x >= CHUNK_W || z >= CHUNK_D) return;
  if (y < 0 || y >= CHUNK_H) return;
  const i = x + z * CHUNK_W + y * CHUNK_W * CHUNK_D;
  if (chunk.blocks[i] === ID.AIR || chunk.blocks[i] === ID.LEAVES) {
    chunk.blocks[i] = id;
  }
}

export function findSpawn(seed) {
  const noise = getNoise(seed);
  for (let r = 0; r < 64; r++) {
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2 + r * 0.55;
      const x = Math.round(Math.cos(ang) * r * 4);
      const z = Math.round(Math.sin(ang) * r * 4);
      const raw = sampleHeight(x, z, noise);
      const h = Math.floor(raw);
      const continent = noise.fbm2(x * 0.0032, z * 0.0032, 5);
      if (h >= SEA_LEVEL + 2 && h < SEA_LEVEL + 14 && continent > 0.02) {
        return { x: x + 0.5, y: h + 1.02, z: z + 0.5 };
      }
    }
  }
  const h = Math.floor(sampleHeight(0, 0, noise));
  return { x: 0.5, y: Math.max(SEA_LEVEL, h) + 2, z: 0.5 };
}
