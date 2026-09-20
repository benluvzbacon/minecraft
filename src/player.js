import * as THREE from 'three';
import {
  GRAVITY, JUMP_SPEED, WALK_SPEED, SPRINT_SPEED, SWIM_SPEED,
  TERMINAL_VELOCITY, PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_EYE, REACH,
  MAX_HEALTH, MAX_HUNGER, CHUNK_H,
} from './config.js';
import { ID, getItem, isSolid, breakTime, dropFor } from './blocks.js';
import { raycast } from './world.js';
import { clamp } from './utils.js';

export class Player {
  constructor(world, camera, inventory, audio) {
    this.world = world;
    this.camera = camera;
    this.inventory = inventory;
    this.audio = audio;
    this.x = 0.5;
    this.y = 40;
    this.z = 0.5;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.inWater = false;
    this.health = MAX_HEALTH;
    this.hunger = MAX_HUNGER;
    this.spawn = { x: 0.5, y: 40, z: 0.5 };
    this.dead = false;
    this.fallStart = 40;
    this.keys = new Set();
    this.mouse = { left: false, right: false, middle: false };
    this.breakTime = 0;
    this.breakTarget = null;
    this.placeCooldown = 0;
    this.punchCooldown = 0;
    this.invuln = 0;
    this.stepTimer = 0;
    this.sensitivity = 0.0022;
    this.invertY = false;
    this.flying = false;
    this.look = { x: 0, y: 0, z: -1 };
    this.hurtFlash = 0;
    this.hungerTimer = 0;
    this.bob = 0;
  }

  setSpawn(x, y, z) {
    this.spawn = { x, y, z };
    this.x = x;
    this.y = y;
    this.z = z;
    this.fallStart = y;
  }

  aabb(x = this.x, y = this.y, z = this.z) {
    const hw = PLAYER_WIDTH / 2;
    return {
      minX: x - hw, maxX: x + hw,
      minY: y, maxY: y + PLAYER_HEIGHT,
      minZ: z - hw, maxZ: z + hw,
    };
  }

  overlapsSolid(box) {
    const x0 = Math.floor(box.minX);
    const y0 = Math.floor(box.minY);
    const z0 = Math.floor(box.minZ);
    const x1 = Math.floor(box.maxX - 1e-6);
    const y1 = Math.floor(box.maxY - 1e-6);
    const z1 = Math.floor(box.maxZ - 1e-6);
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (this.world.isSolidAt(x, y, z)) return true;
        }
      }
    }
    return false;
  }

  moveAxis(axis, delta) {
    if (delta === 0) return;
    this[axis] += delta;
    const box = this.aabb();
    const x0 = Math.floor(box.minX);
    const y0 = Math.floor(box.minY);
    const z0 = Math.floor(box.minZ);
    const x1 = Math.floor(box.maxX - 1e-6);
    const y1 = Math.floor(box.maxY - 1e-6);
    const z1 = Math.floor(box.maxZ - 1e-6);
    const hw = PLAYER_WIDTH / 2;
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (!this.world.isSolidAt(x, y, z)) continue;
          const b = { minX: x, maxX: x + 1, minY: y, maxY: y + 1, minZ: z, maxZ: z + 1 };
          if (box.minX >= b.maxX || box.maxX <= b.minX ||
              box.minY >= b.maxY || box.maxY <= b.minY ||
              box.minZ >= b.maxZ || box.maxZ <= b.minZ) continue;
          if (axis === 'x') {
            if (delta > 0) this.x = b.minX - hw;
            else this.x = b.maxX + hw;
            this.vx = 0;
            box.minX = this.x - hw; box.maxX = this.x + hw;
          } else if (axis === 'z') {
            if (delta > 0) this.z = b.minZ - hw;
            else this.z = b.maxZ + hw;
            this.vz = 0;
            box.minZ = this.z - hw; box.maxZ = this.z + hw;
          } else {
            if (delta > 0) {
              this.y = b.minY - PLAYER_HEIGHT;
              this.vy = 0;
            } else {
              this.y = b.maxY;
              this.vy = 0;
              this.onGround = true;
            }
            box.minY = this.y; box.maxY = this.y + PLAYER_HEIGHT;
          }
        }
      }
    }
  }

  lookDelta(mx, my) {
    this.yaw -= mx * this.sensitivity;
    const inv = this.invertY ? -1 : 1;
    this.pitch -= my * this.sensitivity * inv;
    this.pitch = clamp(this.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
  }

  updateCamera() {
    const eye = this.y + PLAYER_EYE + Math.sin(this.bob) * (this.onGround ? 0.04 : 0);
    this.camera.position.set(this.x, eye, this.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.getWorldDirection(this._dir || (this._dir = new THREE.Vector3()));
    this.look.x = this._dir.x;
    this.look.y = this._dir.y;
    this.look.z = this._dir.z;
  }

  update(dt, canMove) {
    if (this.dead) {
      this.updateCamera();
      return;
    }
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);

    this.inWater = this.world.isLiquidAt(this.x, this.y + 0.9, this.z) ||
      this.world.isLiquidAt(this.x, this.y + 0.3, this.z);

    if (canMove) this.applyInput(dt);
    else {
      this.vx *= 0.6;
      this.vz *= 0.6;
    }

    if (this.flying) {
      this.vy *= 0.85;
    } else if (this.inWater) {
      this.vy -= GRAVITY * 0.22 * dt;
      this.vy *= 0.92;
      if (this.vy < -6) this.vy = -6;
    } else {
      this.vy -= GRAVITY * dt;
      if (this.vy < -TERMINAL_VELOCITY) this.vy = -TERMINAL_VELOCITY;
    }

    this.onGround = false;
    const wasGround = this.onGround;
    const steps = Math.max(1, Math.ceil(dt / 0.016));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.moveAxis('x', this.vx * sdt);
      this.moveAxis('z', this.vz * sdt);
      this.moveAxis('y', this.vy * sdt);
    }

    if (this.onGround) {
      if (!this.inWater) {
        const fallen = this.fallStart - this.y;
        if (fallen > 3.4) {
          this.hurt(Math.floor(fallen - 3), 'fall');
        }
      }
      this.fallStart = this.y;
    } else if (this.vy > 0.1) {
      this.fallStart = this.y;
    }

    if (this.y < -8) {
      this.hurt(4, 'void');
      this.y = this.spawn.y;
      this.x = this.spawn.x;
      this.z = this.spawn.z;
      this.vx = this.vy = this.vz = 0;
    }

    const moving = Math.hypot(this.vx, this.vz) > 0.4 && this.onGround;
    if (moving) {
      this.bob += dt * 10;
      this.stepTimer += dt;
      if (this.stepTimer > 0.42) {
        this.stepTimer = 0;
        this.audio.step();
      }
    } else {
      this.stepTimer = 0;
      this.bob *= 0.9;
    }

    this.hungerTimer += dt;
    if (this.hungerTimer > 18) {
      this.hungerTimer = 0;
      if (this.hunger > 0) this.hunger--;
    }
    if (this.hunger >= 16 && this.health < MAX_HEALTH) {
      this._regen = (this._regen || 0) + dt;
      if (this._regen > 4) {
        this._regen = 0;
        this.health = Math.min(MAX_HEALTH, this.health + 1);
      }
    }

    this.updateCamera();
    if (this.y > CHUNK_H + 20) this.y = CHUNK_H + 20;
  }

  applyInput(dt) {
    let ix = 0, iz = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) iz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) iz += 1;
    if (this.keys.has('KeyA')) ix -= 1;
    if (this.keys.has('KeyD')) ix += 1;
    if (this.keys.has('ArrowLeft')) this.yaw += 1.6 * dt;
    if (this.keys.has('ArrowRight')) this.yaw -= 1.6 * dt;
    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    if (sprint && (ix || iz)) {
      this.hungerTimer += dt * 0.6;
    }
    let speed = sprint ? SPRINT_SPEED : WALK_SPEED;
    if (this.inWater) speed = SWIM_SPEED;
    if (this.flying) speed = 12;
    if (ix && iz) {
      ix *= 0.7071;
      iz *= 0.7071;
    }
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // Camera yaw basis (three.js, rotation.y = yaw, default facing -Z):
    //   horizontal forward = (-sin, -cos), horizontal right = (cos, -sin)
    // W sets iz = -1 (forward), S iz = +1, D ix = +1 (right), A ix = -1.
    const wishX = ix * cos + iz * sin;
    const wishZ = iz * cos - ix * sin;
    this.vx = wishX * speed;
    this.vz = wishZ * speed;

    if (this.flying) {
      if (this.keys.has('Space')) this.vy = 8;
      else if (this.keys.has('KeyC') || this.keys.has('ControlLeft')) this.vy = -8;
      else this.vy *= 0.8;
    } else if (this.inWater) {
      if (this.keys.has('Space')) this.vy += 18 * dt;
    } else if (this.keys.has('Space') && this.onGround) {
      this.vy = JUMP_SPEED;
      this.onGround = false;
      this.audio.jump();
    }
  }

  hurt(amount, _reason) {
    if (amount <= 0 || this.invuln > 0 || this.dead) return;
    this.health -= amount;
    this.invuln = 0.7;
    this.hurtFlash = 0.35;
    this.audio.hurt();
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.audio.death();
    }
  }

  respawn() {
    this.dead = false;
    this.health = MAX_HEALTH;
    this.hunger = MAX_HUNGER;
    this.x = this.spawn.x;
    this.y = this.spawn.y;
    this.z = this.spawn.z;
    this.vx = this.vy = this.vz = 0;
    this.fallStart = this.y;
    this.invuln = 1;
  }

  targetBlock() {
    const origin = this.camera.position;
    const dir = this._dir || new THREE.Vector3(0, 0, -1);
    return raycast(this.world, origin, dir, REACH);
  }

  interact(dt, entities) {
    if (this.dead) return null;
    const hit = this.targetBlock();
    if (this.mouse.middle && hit.hit) {
      this.pickBlock(hit.id);
      this.mouse.middle = false;
    }
    if (this.mouse.left) {
      if (this.punchCooldown <= 0 && entities) {
        const e = entities.hitByRay(this.camera.position, this._dir, REACH);
        if (e) {
          const dist = Math.hypot(e.x - this.x, (e.y + e.h * 0.5) - (this.y + PLAYER_EYE), e.z - this.z);
          if (!hit.hit || dist <= (hit.dist ?? REACH) + 0.15) {
            e.hurt(4);
            this.punchCooldown = 0.4;
            this.breakTime = 0;
            this.breakTarget = null;
            return { type: 'punch', entity: e, target: hit };
          }
        }
      }
      if (hit.hit) {
        const key = hit.x + ',' + hit.y + ',' + hit.z;
        if (!this.breakTarget || this.breakTarget.key !== key) {
          this.breakTarget = { ...hit, key };
          this.breakTime = 0;
        }
        const tool = this.inventory.selectedStack();
        const need = breakTime(hit.id, tool);
        if (need === Infinity) {
          this.breakTime = 0;
        } else {
          this.breakTime += dt;
          if (this.breakTime >= need) {
            this.breakBlock(hit);
            this.breakTime = 0;
            this.breakTarget = null;
          }
        }
      } else {
        this.breakTime = 0;
        this.breakTarget = null;
      }
    } else {
      this.breakTime = 0;
      this.breakTarget = null;
    }

    if (this.mouse.right && this.placeCooldown <= 0) {
      const stack = this.inventory.selectedStack();
      const item = stack && getItem(stack.id);
      if (item && item.food) {
        if (this.eatIfFood()) this.placeCooldown = 0.3;
      } else if (hit.hit) {
        this.placeBlock(hit);
        this.placeCooldown = 0.18;
      }
    }
    return { type: 'look', target: hit };
  }

  eatIfFood() {
    const stack = this.inventory.selectedStack();
    if (!stack) return false;
    const item = getItem(stack.id);
    if (!item || !item.food) return false;
    if (this.hunger >= MAX_HUNGER && this.health >= MAX_HEALTH) return false;
    this.hunger = Math.min(MAX_HUNGER, this.hunger + item.food);
    this.health = Math.min(MAX_HEALTH, this.health + Math.ceil(item.food / 2));
    this.inventory.consumeSelected();
    this.audio.ui();
    return true;
  }

  breakBlock(hit) {
    const def = getItem(hit.id);
    if (!def || !def.breakable) return;
    const tool = this.inventory.selectedStack();
    const drop = dropFor(hit.id, tool);
    this.world.setBlock(hit.x, hit.y, hit.z, ID.AIR);
    if (drop) {
      const left = this.inventory.add(drop, 1);
      if (left > 0 && this._onDrop) this._onDrop(drop, hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    }
    if (tool && getItem(tool.id)?.toolData) this.inventory.damageSelected(1);
    this.audio.break();
  }

  placeBlock(hit) {
    const stack = this.inventory.selectedStack();
    if (!stack) return;
    const item = getItem(stack.id);
    if (!item || !item.isBlock) return;
    const px = hit.x + hit.nx;
    const py = hit.y + hit.ny;
    const pz = hit.z + hit.nz;
    if (py < 0 || py >= CHUNK_H) return;
    const existing = this.world.getBlock(px, py, pz);
    if (existing !== ID.AIR && existing !== ID.WATER) return;
    const box = {
      minX: px, maxX: px + 1,
      minY: py, maxY: py + 1,
      minZ: pz, maxZ: pz + 1,
    };
    const me = this.aabb();
    if (me.minX < box.maxX && me.maxX > box.minX &&
        me.minY < box.maxY && me.maxY > box.minY &&
        me.minZ < box.maxZ && me.maxZ > box.minZ) return;
    this.world.setBlock(px, py, pz, stack.id);
    this.inventory.consumeSelected();
    this.audio.place();
  }

  pickBlock(id) {
    if (!id || id === ID.AIR || id === ID.BEDROCK) return;
    for (let i = 0; i < 9; i++) {
      if (this.inventory.slots[i] && this.inventory.slots[i].id === id) {
        this.inventory.selected = i;
        return;
      }
    }
  }

  serialize() {
    return {
      x: this.x, y: this.y, z: this.z,
      yaw: this.yaw, pitch: this.pitch,
      health: this.health, hunger: this.hunger,
      spawn: this.spawn,
    };
  }

  deserialize(d) {
    if (!d) return;
    this.x = d.x; this.y = d.y; this.z = d.z;
    this.yaw = d.yaw || 0;
    this.pitch = d.pitch || 0;
    this.health = d.health ?? MAX_HEALTH;
    this.hunger = d.hunger ?? MAX_HUNGER;
    if (d.spawn) this.spawn = d.spawn;
    this.fallStart = this.y;
    this.dead = this.health <= 0;
  }
}
