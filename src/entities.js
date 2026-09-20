import * as THREE from 'three';
import { ID } from './blocks.js';
import { hash2 } from './utils.js';

class Mob {
  constructor(kind, x, y, z) {
    this.kind = kind;
    this.x = x; this.y = y; this.z = z;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = Math.random() * Math.PI * 2;
    this.w = kind === 'brute' ? 0.7 : 0.65;
    this.h = kind === 'brute' ? 1.6 : 0.85;
    this.health = kind === 'brute' ? 12 : 6;
    this.onGround = false;
    this.timer = Math.random() * 2;
    this.speed = kind === 'brute' ? 2.6 : 1.4;
    this.dead = false;
    this.hurtCd = 0;
    this.mesh = null;
    this.age = 0;
  }

  aabb() {
    const hw = this.w / 2;
    return {
      minX: this.x - hw, maxX: this.x + hw,
      minY: this.y, maxY: this.y + this.h,
      minZ: this.z - hw, maxZ: this.z + hw,
    };
  }

  hurt(n) {
    this.health -= n;
    if (this.health <= 0) this.dead = true;
  }
}

function makeCritter() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xc48a5a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x5a3a22 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.4), mat);
  body.position.y = 0.4;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), mat);
  head.position.set(0.4, 0.48, 0);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.2), dark);
  snout.position.set(0.56, 0.42, 0);
  g.add(body, head, snout);
  for (const [lx, lz] of [[-0.2, -0.14], [-0.2, 0.14], [0.2, -0.14], [0.2, 0.14]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.12), dark);
    leg.position.set(lx, 0.14, lz);
    g.add(leg);
  }
  return g;
}

function makeBrute() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x4a7a4a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2a3a2a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.3), mat);
  body.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), mat);
  head.position.y = 1.5;
  const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.08), new THREE.MeshLambertMaterial({ color: 0xffee88 }));
  eyes.position.set(0, 1.52, 0.22);
  g.add(body, head, eyes);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.16), mat);
    arm.position.set(s * 0.38, 0.9, 0);
    g.add(arm);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), dark);
    leg.position.set(s * 0.14, 0.28, 0);
    g.add(leg);
  }
  return g;
}

export class EntitySystem {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.mobs = [];
    this.spawnTimer = 2;
    this.maxPassive = 8;
    this.maxHostile = 5;
  }

  spawn(kind, x, y, z) {
    const m = new Mob(kind, x, y, z);
    m.mesh = kind === 'brute' ? makeBrute() : makeCritter();
    this.scene.add(m.mesh);
    this.mobs.push(m);
    return m;
  }

  remove(m) {
    if (m.mesh) this.scene.remove(m.mesh);
    this.mobs = this.mobs.filter((x) => x !== m);
  }

  clear() {
    for (const m of this.mobs) if (m.mesh) this.scene.remove(m.mesh);
    this.mobs = [];
  }

  trySpawn(player, isNight) {
    const passive = this.mobs.filter((m) => m.kind === 'critter').length;
    const hostile = this.mobs.filter((m) => m.kind === 'brute').length;
    const kind = isNight && hostile < this.maxHostile && Math.random() < 0.55
      ? 'brute'
      : (passive < this.maxPassive ? 'critter' : null);
    if (!kind) return;
    if (kind === 'brute' && !isNight) return;
    const ang = Math.random() * Math.PI * 2;
    const dist = 10 + Math.random() * 18;
    const x = Math.floor(player.x + Math.cos(ang) * dist);
    const z = Math.floor(player.z + Math.sin(ang) * dist);
    const h = this.world.getHeight(x, z);
    const y = h + 1;
    const ground = this.world.getBlock(x, h, z);
    if (ground !== ID.GRASS && ground !== ID.DIRT && ground !== ID.SAND) return;
    if (this.world.getBlock(x, y, z) !== ID.AIR) return;
    if (Math.hypot(x - player.x, z - player.z) < 8) return;
    this.spawn(kind, x + 0.5, y, z + 0.5);
  }

  update(dt, player, isNight) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 4 + Math.random() * 4;
      this.trySpawn(player, isNight);
    }

    for (const m of [...this.mobs]) {
      m.age += dt;
      m.hurtCd = Math.max(0, m.hurtCd - dt);
      if (m.dead || m.health <= 0) {
        if (this.onDeath) this.onDeath(m);
        this.remove(m);
        continue;
      }
      const dist = Math.hypot(m.x - player.x, m.z - player.z);
      if (dist > 64) {
        this.remove(m);
        continue;
      }

      m.timer -= dt;
      if (m.kind === 'brute' && dist < 22 && !player.dead) {
        const ang = Math.atan2(player.x - m.x, player.z - m.z);
        m.yaw = ang;
        m.vx = Math.sin(m.yaw) * m.speed;
        m.vz = Math.cos(m.yaw) * m.speed;
        if (dist < 1.3 && m.hurtCd <= 0) {
          player.hurt(3, 'mob');
          m.hurtCd = 1.2;
        }
      } else {
        if (m.timer <= 0) {
          m.timer = 1.5 + Math.random() * 3;
          if (Math.random() < 0.35) {
            m.vx = 0; m.vz = 0;
          } else {
            m.yaw = Math.random() * Math.PI * 2;
            m.vx = Math.sin(m.yaw) * m.speed;
            m.vz = Math.cos(m.yaw) * m.speed;
          }
        }
        if (m.kind === 'critter' && dist < 4 && !player.dead) {
          const ang = Math.atan2(m.x - player.x, m.z - player.z);
          m.yaw = ang;
          m.vx = Math.sin(m.yaw) * (m.speed + 1);
          m.vz = Math.cos(m.yaw) * (m.speed + 1);
        }
      }

      m.vy -= 28 * dt;
      if (m.vy < -40) m.vy = -40;
      this.move(m, 'x', m.vx * dt);
      this.move(m, 'z', m.vz * dt);
      m.onGround = false;
      this.move(m, 'y', m.vy * dt);
      if (m.onGround && (m.vx || m.vz) && this.blockedAhead(m)) {
        m.vy = 7.5;
        m.onGround = false;
      }

      if (m.mesh) {
        m.mesh.position.set(m.x, m.y, m.z);
        m.mesh.rotation.y = m.yaw;
      }
    }
  }

  blockedAhead(m) {
    const nx = m.x + Math.sin(m.yaw) * 0.6;
    const nz = m.z + Math.cos(m.yaw) * 0.6;
    return this.world.isSolidAt(nx, m.y + 0.5, nz) && !this.world.isSolidAt(nx, m.y + 1.5, nz);
  }

  move(m, axis, delta) {
    if (!delta) return;
    m[axis] += delta;
    const box = m.aabb();
    const x0 = Math.floor(box.minX), y0 = Math.floor(box.minY), z0 = Math.floor(box.minZ);
    const x1 = Math.floor(box.maxX - 1e-6), y1 = Math.floor(box.maxY - 1e-6), z1 = Math.floor(box.maxZ - 1e-6);
    const hw = m.w / 2;
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (!this.world.isSolidAt(x, y, z)) continue;
          const b = { minX: x, maxX: x + 1, minY: y, maxY: y + 1, minZ: z, maxZ: z + 1 };
          if (box.minX >= b.maxX || box.maxX <= b.minX || box.minY >= b.maxY || box.maxY <= b.minY || box.minZ >= b.maxZ || box.maxZ <= b.minZ) continue;
          if (axis === 'x') {
            m.x = delta > 0 ? b.minX - hw : b.maxX + hw;
            m.vx = 0;
            box.minX = m.x - hw; box.maxX = m.x + hw;
          } else if (axis === 'z') {
            m.z = delta > 0 ? b.minZ - hw : b.maxZ + hw;
            m.vz = 0;
            box.minZ = m.z - hw; box.maxZ = m.z + hw;
          } else {
            if (delta > 0) { m.y = b.minY - m.h; m.vy = 0; }
            else { m.y = b.maxY; m.vy = 0; m.onGround = true; }
            box.minY = m.y; box.maxY = m.y + m.h;
          }
        }
      }
    }
  }

  hitByRay(origin, dir, maxDist) {
    if (!dir) return null;
    let best = null, bestT = maxDist;
    for (const m of this.mobs) {
      const box = m.aabb();
      const t = rayAabb(origin, dir, box);
      if (t != null && t < bestT && t > 0) {
        bestT = t;
        best = m;
      }
    }
    return best;
  }
}

function rayAabb(o, d, b) {
  let tmin = 0, tmax = 20;
  for (const axis of ['x', 'y', 'z']) {
    const min = b['min' + axis.toUpperCase()];
    const max = b['max' + axis.toUpperCase()];
    const origin = o[axis];
    const dir = d[axis];
    if (Math.abs(dir) < 1e-8) {
      if (origin < min || origin > max) return null;
      continue;
    }
    let t1 = (min - origin) / dir;
    let t2 = (max - origin) / dir;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}

export { hash2 };
