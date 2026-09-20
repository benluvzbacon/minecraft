import { CHUNK_W, CHUNK_H, CHUNK_D } from './config.js';
import { ID, BLOCKS, isOpaque, faceTile } from './blocks.js';

const FACES = [
  { // +Y top
    dir: [0, 1, 0],
    corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]],
    shade: 1.0,
    name: 'top',
  },
  { // -Y bottom
    dir: [0, -1, 0],
    corners: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]],
    shade: 0.48,
    name: 'bottom',
  },
  { // +X
    dir: [1, 0, 0],
    corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]],
    shade: 0.78,
    name: 'side',
  },
  { // -X
    dir: [-1, 0, 0],
    corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]],
    shade: 0.78,
    name: 'side',
  },
  { // +Z
    dir: [0, 0, 1],
    corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]],
    shade: 0.66,
    name: 'side',
  },
  { // -Z
    dir: [0, 0, -1],
    corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]],
    shade: 0.62,
    name: 'side',
  },
];

const ATLAS_COLS = 8;
const TILE = 1 / ATLAS_COLS;
const PAD = 0.5 / (ATLAS_COLS * 16);

function shouldRender(id, nid) {
  if (id === ID.AIR) return false;
  const b = BLOCKS[id];
  const n = BLOCKS[nid] || BLOCKS[ID.AIR];
  if (id === ID.WATER) {
    return nid !== ID.WATER && !n.opaque;
  }
  if (b.opaque) {
    return !n.opaque;
  }
  return nid === ID.AIR || nid === ID.WATER || (n && !n.opaque && nid !== id);
}

function pushQuad(buf, x, y, z, face, tile, light) {
  const { positions, normals, uvs, colors, indices } = buf;
  const v = positions.length / 3;
  const [dx, dy, dz] = face.dir;
  const shade = face.shade * light;
  const col = shade;
  const u0 = (tile % ATLAS_COLS) * TILE + PAD;
  const v0 = Math.floor(tile / ATLAS_COLS) * TILE + PAD;
  const u1 = u0 + TILE - PAD * 2;
  const v1 = v0 + TILE - PAD * 2;
  const uv = [[u0, v1], [u0, v0], [u1, v0], [u1, v1]];

  for (let i = 0; i < 4; i++) {
    const c = face.corners[i];
    positions.push(x + c[0], y + c[1], z + c[2]);
    normals.push(dx, dy, dz);
    uvs.push(uv[i][0], 1 - uv[i][1]);
    colors.push(col, col, col);
  }
  indices.push(v, v + 1, v + 2, v, v + 2, v + 3);
}

export function meshChunk(chunk, world) {
  const solid = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
  const water = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
  const ox = chunk.cx * CHUNK_W;
  const oz = chunk.cz * CHUNK_D;
  const blocks = chunk.blocks;

  for (let y = 0; y < CHUNK_H; y++) {
    for (let z = 0; z < CHUNK_D; z++) {
      for (let x = 0; x < CHUNK_W; x++) {
        const id = blocks[x + z * CHUNK_W + y * CHUNK_W * CHUNK_D];
        if (id === ID.AIR) continue;
        const buf = id === ID.WATER ? water : solid;
        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nx = x + face.dir[0];
          const ny = y + face.dir[1];
          const nz = z + face.dir[2];
          let nid;
          if (ny < 0) nid = ID.BEDROCK;
          else if (ny >= CHUNK_H) nid = ID.AIR;
          else if (nx >= 0 && nx < CHUNK_W && nz >= 0 && nz < CHUNK_D) {
            nid = blocks[nx + nz * CHUNK_W + ny * CHUNK_W * CHUNK_D];
          } else {
            nid = world.getBlock(ox + nx, ny, oz + nz);
          }
          if (!shouldRender(id, nid)) continue;
          const tile = faceTile(id, face.name);
          const airX = ox + nx;
          const airZ = oz + nz;
          const airY = ny;
          const surface = world.getHeight(airX, airZ);
          let light = airY > surface ? 1 : 0.28;
          if (id === ID.WATER) light = Math.max(light, 0.55);
          if (id === ID.LEAVES) light = Math.max(light, 0.7);
          pushQuad(buf, ox + x, y, oz + z, face, tile, light);
        }
      }
    }
  }

  return { solid, water };
}

export function toTyped(buf) {
  if (!buf.positions.length) return null;
  return {
    positions: new Float32Array(buf.positions),
    normals: new Float32Array(buf.normals),
    uvs: new Float32Array(buf.uvs),
    colors: new Float32Array(buf.colors),
    indices: buf.positions.length / 3 > 65535
      ? new Uint32Array(buf.indices)
      : new Uint16Array(buf.indices),
  };
}
