import * as THREE from 'three';
import { CHUNK_W, CHUNK_H, CHUNK_D } from './config.js';
import { ID, isSolid, isLiquid, isOpaque } from './blocks.js';
import { Chunk, chunkKey } from './chunk.js';
import { generateChunk } from './terrain.js';
import { meshChunk, toTyped } from './mesher.js';
import { chunkCoord, localCoord } from './utils.js';

export class World {
  constructor(seed, scene, materials) {
    this.seed = seed | 0;
    this.scene = scene;
    this.materials = materials;
    this.chunks = new Map();
    this.mods = new Map();
    this.genQueue = [];
    this.meshQueue = [];
    this.renderDistance = 5;
    this.maxGenPerFrame = 3;
    this.maxMeshPerFrame = 3;
    this.loadedMeshes = 0;
  }

  applyMods(chunk) {
    const rec = this.mods.get(chunk.key);
    if (!rec) return;
    for (const [k, id] of Object.entries(rec)) {
      const [x, y, z] = k.split(',').map(Number);
      chunk.set(x, y, z, id);
    }
    chunk.rebuildHeightMap();
  }

  recordMod(wx, wy, wz, id) {
    const cx = chunkCoord(wx, CHUNK_W);
    const cz = chunkCoord(wz, CHUNK_D);
    const lx = localCoord(wx, CHUNK_W);
    const lz = localCoord(wz, CHUNK_D);
    const key = chunkKey(cx, cz);
    let rec = this.mods.get(key);
    if (!rec) {
      rec = {};
      this.mods.set(key, rec);
    }
    rec[lx + ',' + wy + ',' + lz] = id;
  }

  getChunk(cx, cz, create = false) {
    const key = chunkKey(cx, cz);
    let c = this.chunks.get(key);
    if (!c && create) {
      c = new Chunk(cx, cz);
      this.chunks.set(key, c);
    }
    return c || null;
  }

  getBlock(x, y, z) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (y < 0) return ID.BEDROCK;
    if (y >= CHUNK_H) return ID.AIR;
    const cx = chunkCoord(x, CHUNK_W);
    const cz = chunkCoord(z, CHUNK_D);
    const chunk = this.getChunk(cx, cz);
    if (!chunk || !chunk.generated) return ID.AIR;
    return chunk.get(localCoord(x, CHUNK_W), y, localCoord(z, CHUNK_D));
  }

  isSolidAt(x, y, z) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (y < 0) return true;
    if (y >= CHUNK_H) return false;
    const cx = chunkCoord(x, CHUNK_W);
    const cz = chunkCoord(z, CHUNK_D);
    const chunk = this.getChunk(cx, cz);
    if (!chunk || !chunk.generated) return true;
    return isSolid(chunk.get(localCoord(x, CHUNK_W), y, localCoord(z, CHUNK_D)));
  }

  isLiquidAt(x, y, z) {
    return isLiquid(this.getBlock(x, y, z));
  }

  getHeight(x, z) {
    x = Math.floor(x);
    z = Math.floor(z);
    const cx = chunkCoord(x, CHUNK_W);
    const cz = chunkCoord(z, CHUNK_D);
    const chunk = this.getChunk(cx, cz);
    if (!chunk || !chunk.generated) return SEA_FALLBACK;
    return chunk.getHeight(localCoord(x, CHUNK_W), localCoord(z, CHUNK_D));
  }

  setBlock(x, y, z, id) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (y < 0 || y >= CHUNK_H) return false;
    const cx = chunkCoord(x, CHUNK_W);
    const cz = chunkCoord(z, CHUNK_D);
    const chunk = this.getChunk(cx, cz, true);
    if (!chunk.generated) {
      generateChunk(chunk, this.seed);
      this.applyMods(chunk);
    }
    const lx = localCoord(x, CHUNK_W);
    const lz = localCoord(z, CHUNK_D);
    if (!chunk.set(lx, y, lz, id)) return false;
    chunk.modified = true;
    chunk.rebuildHeightMap();
    this.recordMod(x, y, z, id);
    this.markDirty(cx, cz, lx, lz);
    return true;
  }

  markDirty(cx, cz, lx, lz) {
    const c = this.getChunk(cx, cz);
    if (c) c.dirty = true;
    if (lx === 0) {
      const n = this.getChunk(cx - 1, cz);
      if (n) n.dirty = true;
    }
    if (lx === CHUNK_W - 1) {
      const n = this.getChunk(cx + 1, cz);
      if (n) n.dirty = true;
    }
    if (lz === 0) {
      const n = this.getChunk(cx, cz - 1);
      if (n) n.dirty = true;
    }
    if (lz === CHUNK_D - 1) {
      const n = this.getChunk(cx, cz + 1);
      if (n) n.dirty = true;
    }
  }

  desiredChunks(px, pz) {
    const pcx = chunkCoord(px, CHUNK_W);
    const pcz = chunkCoord(pz, CHUNK_D);
    const r = this.renderDistance;
    const list = [];
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > r * r + 1) continue;
        list.push({ cx: pcx + dx, cz: pcz + dz, d2 });
      }
    }
    list.sort((a, b) => a.d2 - b.d2);
    return list;
  }

  updateStreaming(px, pz) {
    const needed = this.desiredChunks(px, pz);
    const needSet = new Set(needed.map((c) => chunkKey(c.cx, c.cz)));

    for (const [key, chunk] of this.chunks) {
      if (!needSet.has(key)) {
        this.unloadMesh(chunk);
        if (!chunk.modified && !this.mods.has(key)) {
          this.chunks.delete(key);
        }
      }
    }

    for (const { cx, cz } of needed) {
      let chunk = this.getChunk(cx, cz, true);
      if (!chunk.generated) {
        this.genQueue.push(chunk);
      } else if (chunk.dirty || !chunk.mesh) {
        this.meshQueue.push(chunk);
      }
    }

    this.genQueue = this.genQueue.filter((c) => needSet.has(c.key) && !c.generated);
    this.meshQueue = this.meshQueue.filter((c) => needSet.has(c.key) && c.generated && (c.dirty || !c.mesh));

    let gen = 0;
    while (gen < this.maxGenPerFrame && this.genQueue.length) {
      const chunk = this.genQueue.shift();
      if (chunk.generated) continue;
      generateChunk(chunk, this.seed);
      this.applyMods(chunk);
      chunk.dirty = true;
      this.meshQueue.unshift(chunk);
      this.invalidateNeighbors(chunk.cx, chunk.cz);
      gen++;
    }

    let mesh = 0;
    while (mesh < this.maxMeshPerFrame && this.meshQueue.length) {
      const chunk = this.meshQueue.shift();
      if (!chunk.generated) continue;
      if (!chunk.dirty && chunk.mesh) continue;
      this.buildMesh(chunk);
      mesh++;
    }
  }

  buildMesh(chunk) {
    this.unloadMesh(chunk);
    const raw = meshChunk(chunk, this);
    const solid = toTyped(raw.solid);
    const water = toTyped(raw.water);
    if (solid) {
      const geo = makeGeo(solid);
      chunk.mesh = new THREE.Mesh(geo, this.materials.solid);
      chunk.mesh.castShadow = false;
      chunk.mesh.receiveShadow = this.materials.shadows;
      chunk.mesh.matrixAutoUpdate = false;
      chunk.mesh.updateMatrix();
      chunk.mesh.frustumCulled = true;
      this.scene.add(chunk.mesh);
    }
    if (water) {
      const geo = makeGeo(water);
      chunk.waterMesh = new THREE.Mesh(geo, this.materials.water);
      chunk.waterMesh.matrixAutoUpdate = false;
      chunk.waterMesh.updateMatrix();
      this.scene.add(chunk.waterMesh);
    }
    chunk.dirty = false;
    this.loadedMeshes++;
  }

  unloadMesh(chunk) {
    if (chunk.mesh) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }
    if (chunk.waterMesh) {
      this.scene.remove(chunk.waterMesh);
      chunk.waterMesh.geometry.dispose();
      chunk.waterMesh = null;
    }
  }

  dispose() {
    for (const chunk of this.chunks.values()) this.unloadMesh(chunk);
    this.chunks.clear();
  }

  loadedCount() {
    let n = 0;
    for (const c of this.chunks.values()) if (c.mesh || c.waterMesh) n++;
    return n;
  }

  generatedCount() {
    let n = 0;
    for (const c of this.chunks.values()) if (c.generated) n++;
    return n;
  }

  forceGenerateAround(px, pz, radius = 2) {
    const pcx = chunkCoord(px, CHUNK_W);
    const pcz = chunkCoord(pz, CHUNK_D);
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const chunk = this.getChunk(pcx + dx, pcz + dz, true);
        if (!chunk.generated) {
          generateChunk(chunk, this.seed);
          this.applyMods(chunk);
        }
        if (chunk.dirty || !chunk.mesh) this.buildMesh(chunk);
      }
    }
  }
}

const SEA_FALLBACK = 32;

function makeGeo(data) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geo.computeBoundingSphere();
  return geo;
}

export function raycast(world, origin, dir, maxDist = 5.5) {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  const dx = dir.x, dy = dir.y, dz = dir.z;
  const stepX = dx >= 0 ? 1 : -1;
  const stepY = dy >= 0 ? 1 : -1;
  const stepZ = dz >= 0 ? 1 : -1;
  const tDeltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
  const tDeltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
  const tDeltaZ = dz === 0 ? Infinity : Math.abs(1 / dz);
  const frac = (v, step) => (step > 0 ? 1 - (v - Math.floor(v)) : v - Math.floor(v));
  let tMaxX = tDeltaX * frac(origin.x, stepX);
  let tMaxY = tDeltaY * frac(origin.y, stepY);
  let tMaxZ = tDeltaZ * frac(origin.z, stepZ);
  let px = x, py = y, pz = z;
  let t = 0;
  const maxSteps = Math.ceil(maxDist * 3) + 2;
  for (let i = 0; i < maxSteps; i++) {
    const id = world.getBlock(x, y, z);
    if (id !== ID.AIR) {
      return {
        hit: true,
        x, y, z, id,
        nx: px - x,
        ny: py - y,
        nz: pz - z,
        px, py, pz,
        dist: t,
      };
    }
    px = x; py = y; pz = z;
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      t = tMaxX;
      x += stepX;
      tMaxX += tDeltaX;
    } else if (tMaxY < tMaxZ) {
      t = tMaxY;
      y += stepY;
      tMaxY += tDeltaY;
    } else {
      t = tMaxZ;
      z += stepZ;
      tMaxZ += tDeltaZ;
    }
    if (t > maxDist) break;
  }
  return { hit: false };
}

export { isSolid, isLiquid, isOpaque, chunkCoord };
