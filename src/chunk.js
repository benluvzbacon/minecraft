import { CHUNK_W, CHUNK_H, CHUNK_D } from './config.js';
import { ID } from './blocks.js';

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_W * CHUNK_H * CHUNK_D);
    this.heightMap = new Uint8Array(CHUNK_W * CHUNK_D);
    this.generated = false;
    this.dirty = true;
    this.modified = false;
    this.mesh = null;
    this.waterMesh = null;
    this.key = cx + ',' + cz;
  }

  index(x, y, z) {
    return x + z * CHUNK_W + y * CHUNK_W * CHUNK_D;
  }

  get(x, y, z) {
    if (y < 0 || y >= CHUNK_H || x < 0 || x >= CHUNK_W || z < 0 || z >= CHUNK_D) return ID.AIR;
    return this.blocks[this.index(x, y, z)];
  }

  set(x, y, z, id) {
    if (y < 0 || y >= CHUNK_H || x < 0 || x >= CHUNK_W || z < 0 || z >= CHUNK_D) return false;
    const i = this.index(x, y, z);
    if (this.blocks[i] === id) return false;
    this.blocks[i] = id;
    this.dirty = true;
    return true;
  }

  rebuildHeightMap() {
    const { blocks, heightMap } = this;
    for (let z = 0; z < CHUNK_D; z++) {
      for (let x = 0; x < CHUNK_W; x++) {
        let h = 0;
        for (let y = CHUNK_H - 1; y >= 0; y--) {
          const id = blocks[x + z * CHUNK_W + y * CHUNK_W * CHUNK_D];
          if (id !== ID.AIR && id !== ID.WATER && id !== ID.LEAVES) {
            h = y;
            break;
          }
        }
        heightMap[x + z * CHUNK_W] = h;
      }
    }
  }

  getHeight(x, z) {
    if (x < 0 || x >= CHUNK_W || z < 0 || z >= CHUNK_D) return 0;
    return this.heightMap[x + z * CHUNK_W];
  }
}

export function chunkKey(cx, cz) {
  return cx + ',' + cz;
}
