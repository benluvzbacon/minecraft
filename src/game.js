import * as THREE from 'three';
import { CHUNK_W, CHUNK_D, HOTBAR_SIZE } from './config.js';
import { ID, getItem } from './blocks.js';
import { World, raycast } from './world.js';
import { Player } from './player.js';
import { Inventory, makeStack } from './inventory.js';
import { EntitySystem } from './entities.js';
import { Sky } from './sky.js';
import { UI } from './ui.js';
import { AudioSys } from './audio.js';
import { createAtlasTexture, preloadIcons } from './textures.js';
import { getSettings, setSettings } from './settings.js';
import { saveWorld, loadWorld, deleteWorld, packModifications, unpackModifications } from './save.js';
import { findSpawn } from './terrain.js';
import { uuid, chunkCoord } from './utils.js';
import { breakTime } from './blocks.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('gl');
    this.ui = new UI();
    this.audio = new AudioSys();
    this.settings = getSettings();
    this.state = 'menu';
    this.worldId = null;
    this.worldName = 'New World';
    this.debug = false;
    this.pointerLocked = false;
    this.rightLook = false;
    this.fps = 0;
    this.frames = 0;
    this.fpsT = 0;
    this.last = performance.now();
    this.autosaveT = 0;
    this.outline = null;
    this.breakOverlay = null;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = !!this.settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, innerWidth / innerHeight, 0.08, 260);
    this.sky = new Sky(this.scene, this.renderer);
    this.sky.setShadows(!!this.settings.shadows);
    this.sky.setRenderFog(this.settings.renderDistance);

    const atlas = createAtlasTexture();
    this.atlas = atlas;
    this.materials = {
      solid: new THREE.MeshLambertMaterial({
        map: atlas.texture,
        vertexColors: true,
        alphaTest: 0.15,
      }),
      water: new THREE.MeshLambertMaterial({
        map: atlas.texture,
        vertexColors: true,
        transparent: true,
        opacity: 0.62,
        depthWrite: true,
      }),
      shadows: !!this.settings.shadows,
    };

    this.world = null;
    this.player = null;
    this.inventory = null;
    this.entities = null;

    this.bindEvents();
    this.bindMenu();
    this.applySettingsToForm();
    preloadIcons();
    this.ui.show('title-screen');
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  bindEvents() {
    addEventListener('resize', () => this.resize());
    addEventListener('keydown', (e) => this.onKey(e, true));
    addEventListener('keyup', (e) => this.onKey(e, false));
    addEventListener('blur', () => this.player?.keys.clear());
    addEventListener('mousemove', (e) => this.onMouseMove(e));
    addEventListener('mousedown', (e) => this.onMouseDown(e));
    addEventListener('mouseup', (e) => this.onMouseUp(e));
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });
    this.canvas.addEventListener('click', () => {
      if (this.state === 'playing') this.requestLock();
    });
  }

  requestLock() {
    const p = this.canvas.requestPointerLock?.();
    if (p && p.catch) p.catch(() => {});
  }

  bindMenu() {
    document.getElementById('btn-new').onclick = () => {
      this.audio.ui();
      this.ui.show('new-world-screen');
      document.getElementById('world-name').value = 'World ' + Math.floor(Math.random() * 90 + 10);
      document.getElementById('world-seed').value = '';
    };
    document.getElementById('btn-load').onclick = () => {
      this.audio.ui();
      this.ui.show('load-world-screen');
      this.ui.populateWorldList((id) => this.loadExisting(id), (id) => deleteWorld(id));
    };
    document.getElementById('btn-settings').onclick = () => {
      this.audio.ui();
      this.settingsBack = 'title-screen';
      this.ui.show('settings-screen');
    };
    document.getElementById('btn-create-world').onclick = () => this.createWorldFromForm();
    document.getElementById('btn-new-cancel').onclick = () => this.ui.show('title-screen');
    document.getElementById('btn-load-back').onclick = () => this.ui.show('title-screen');
    document.getElementById('btn-settings-back').onclick = () => {
      this.saveSettingsFromForm();
      this.ui.show(this.settingsBack || 'title-screen');
    };
    document.getElementById('btn-resume').onclick = () => this.resume();
    document.getElementById('btn-pause-settings').onclick = () => {
      this.settingsBack = 'pause-screen';
      this.ui.show('settings-screen');
    };
    document.getElementById('btn-save').onclick = () => this.save(true);
    document.getElementById('btn-quit-menu').onclick = () => this.quitToMenu();
    document.getElementById('btn-respawn').onclick = () => {
      this.player.respawn();
      this.state = 'playing';
      this.ui.hideScreens();
      this.ui.setHudVisible(true);
      this.requestLock();
    };
    document.getElementById('btn-death-quit').onclick = () => this.quitToMenu();

    document.getElementById('hotbar').addEventListener('mousedown', (e) => {
      const slot = e.target.closest('.slot');
      if (!slot || !this.inventory) return;
      const i = Number(slot.dataset.i);
      if (Number.isFinite(i)) this.inventory.selected = i;
      e.stopPropagation();
      e.preventDefault();
    });

    const inv = document.getElementById('inventory-screen');
    inv.addEventListener('mousedown', (e) => {
      const slot = e.target.closest('.slot');
      if (!slot || !this.inventory) return;
      e.preventDefault();
      e.stopPropagation();
      const right = e.button === 2;
      const kind = slot.dataset.kind;
      const i = Number(slot.dataset.i);
      if (kind === 'inv') this.inventory.clickSlot(i, right);
      else if (kind === 'craft') this.inventory.clickCraft(i, right);
      else if (kind === 'result') this.inventory.clickResult();
      this.ui.renderInventory(this.inventory);
      this.ui.renderHotbar(this.inventory);
      this.audio.ui();
    });
  }

  applySettingsToForm() {
    const s = this.settings;
    document.getElementById('set-sens').value = s.sensitivity;
    document.getElementById('set-rd').value = s.renderDistance;
    document.getElementById('set-fov').value = s.fov;
    document.getElementById('set-quality').value = s.quality;
    document.getElementById('set-vol').value = s.volume;
    document.getElementById('set-inverty').checked = s.invertY;
  }

  saveSettingsFromForm() {
    const quality = document.getElementById('set-quality').value;
    const shadows = quality === 'high';
    this.settings = setSettings({
      sensitivity: Number(document.getElementById('set-sens').value),
      renderDistance: Number(document.getElementById('set-rd').value),
      fov: Number(document.getElementById('set-fov').value),
      quality,
      volume: Number(document.getElementById('set-vol').value),
      invertY: document.getElementById('set-inverty').checked,
      shadows,
    });
    this.applyRuntimeSettings();
  }

  applyRuntimeSettings() {
    const s = this.settings;
    this.audio.setVolume(s.volume);
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
    this.sky.setRenderFog(s.renderDistance);
    this.sky.setShadows(!!s.shadows);
    this.renderer.shadowMap.enabled = !!s.shadows;
    this.materials.shadows = !!s.shadows;
    if (this.player) {
      this.player.sensitivity = s.sensitivity;
      this.player.invertY = s.invertY;
    }
    if (this.world) this.world.renderDistance = s.renderDistance;
  }

  createWorldFromForm() {
    const name = document.getElementById('world-name').value.trim() || 'New World';
    const seedStr = document.getElementById('world-seed').value.trim();
    const seed = seedStr === '' ? (Math.random() * 0x7fffffff) | 0 : toSeed(seedStr);
    this.startWorld({
      id: uuid(),
      name,
      seed,
      time: 0.22,
      player: null,
      inventory: null,
      mods: {},
    });
  }

  async loadExisting(id) {
    const data = await loadWorld(id);
    if (!data) {
      this.ui.toast('Could not load world.');
      return;
    }
    this.startWorld(data);
  }

  startWorld(data) {
    this.teardownWorld();
    this.worldId = data.id;
    this.worldName = data.name || 'World';
    this.inventory = new Inventory();
    if (data.inventory) this.inventory.deserialize(data.inventory);

    this.world = new World(data.seed, this.scene, this.materials);
    this.world.renderDistance = this.settings.renderDistance;
    this.world.mods = unpackModifications(data.mods);

    this.player = new Player(this.world, this.camera, this.inventory, this.audio);
    this.player.sensitivity = this.settings.sensitivity;
    this.player.invertY = this.settings.invertY;
    this.entities = new EntitySystem(this.world, this.scene);
    this.entities.onDeath = (m) => {
      if (m.kind === 'critter') {
        this.inventory.add(ID.BERRIES, 1 + ((Math.random() * 2) | 0));
        this.ui.toast('Berries!');
      }
    };

    const spawn = data.player ? null : findSpawn(data.seed);
    if (data.player) this.player.deserialize(data.player);
    else this.player.setSpawn(spawn.x, spawn.y, spawn.z);

    this.sky.time = data.time ?? 0.22;
    this.makeOutline();

    this.ui.show('loading-screen');
    this.ui.setHudVisible(false);
    this.state = 'loading';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.finishLoad());
    });
  }

  finishLoad() {
    const p = this.player;
    this.world.forceGenerateAround(p.x, p.z, 2);
    this.settlePlayer();
    this.player.updateCamera();
    this.state = 'playing';
    this.ui.hideScreens();
    this.ui.setHudVisible(true);
    this.ui.renderHotbar(this.inventory);
    this.ui.renderHearts(this.player.health, this.player.hunger);
    this.ui.toast('Welcome to ' + this.worldName);
    this.requestLock();
    this.save(false);
  }

  settlePlayer() {
    const p = this.player;
    for (let i = 0; i < 40; i++) {
      if (!p.overlapsSolid(p.aabb())) break;
      p.y += 1;
    }
    for (let i = 0; i < 80; i++) {
      const below = p.aabb();
      below.minY -= 0.08; below.maxY -= 0.08;
      if (p.overlapsSolid(below)) break;
      p.y -= 0.08;
    }
    p.spawn = { x: p.x, y: p.y, z: p.z };
    p.fallStart = p.y;
  }

  makeOutline() {
    if (this.outline) {
      this.scene.remove(this.outline);
      this.scene.remove(this.breakOverlay);
    }
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
    this.outline = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x111111 }));
    this.outline.visible = false;
    this.scene.add(this.outline);
    this.breakOverlay = new THREE.Mesh(
      new THREE.BoxGeometry(1.01, 1.01, 1.01),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.breakOverlay.visible = false;
    this.scene.add(this.breakOverlay);
  }

  teardownWorld() {
    if (this.entities) this.entities.clear();
    if (this.world) this.world.dispose();
    this.world = null;
    this.player = null;
    this.entities = null;
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    document.exitPointerLock?.();
    this.ui.show('pause-screen');
    this.save(false);
  }

  resume() {
    this.state = 'playing';
    this.ui.hideScreens();
    this.ui.setHudVisible(true);
    this.requestLock();
  }

  openInventory() {
    this.state = 'inventory';
    document.exitPointerLock?.();
    this.ui.show('inventory-screen');
    this.ui.setHudVisible(true);
    this.ui.renderInventory(this.inventory);
  }

  closeInventory() {
    if (this.inventory?.cursor) {
      this.inventory.add(this.inventory.cursor.id, this.inventory.cursor.count);
      this.inventory.cursor = null;
    }
    this.state = 'playing';
    this.ui.hideScreens();
    this.ui.setHudVisible(true);
    this.ui.renderHotbar(this.inventory);
    this.requestLock();
  }

  quitToMenu() {
    this.save(false);
    document.exitPointerLock?.();
    this.teardownWorld();
    this.state = 'menu';
    this.ui.setHudVisible(false);
    this.ui.show('title-screen');
  }

  async save(toast) {
    if (!this.world || !this.player) return;
    const data = {
      id: this.worldId,
      name: this.worldName,
      seed: this.world.seed,
      time: this.sky.time,
      player: this.player.serialize(),
      inventory: this.inventory.serialize(),
      mods: packModifications(this.world.mods),
    };
    await saveWorld(this.worldId, data);
    if (toast) this.ui.toast('World saved.');
  }

  onKey(e, down) {
    if (e.repeat && down) {
      if (this.player) this.player.keys.add(e.code);
      return;
    }
    if (down && e.code === 'Escape') {
      e.preventDefault();
      if (this.state === 'inventory') this.closeInventory();
      else if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
      return;
    }
    if (down && (e.code === 'KeyE' || e.code === 'Tab')) {
      e.preventDefault();
      if (this.state === 'playing') { this.openInventory(); return; }
      if (this.state === 'inventory') { this.closeInventory(); return; }
    }
    if (this.state === 'playing' && this.player) {
      if (down) {
        if (e.code === 'F3') { this.debug = !this.debug; return; }
        if (e.code === 'KeyQ') {
          const s = this.inventory.takeSelected(1);
          if (s) this.ui.toast('Dropped ' + (getItem(s.id)?.name || 'item'));
        }
        if (e.code === 'F8') {
          this.player.flying = !this.player.flying;
          this.ui.toast(this.player.flying ? 'Flight on' : 'Flight off');
        }
        const num = e.code.match(/^Digit([1-9])$/);
        if (num) this.inventory.selected = Number(num[1]) - 1;
      }
      if (down) this.player.keys.add(e.code);
      else this.player.keys.delete(e.code);
    } else if (this.player && !down) {
      this.player.keys.delete(e.code);
    }
  }

  onMouseMove(e) {
    this.ui.moveCursor(e.clientX, e.clientY);
    if (this.state !== 'playing' || !this.player) return;
    if (this.pointerLocked || this.rightLook) {
      this.player.lookDelta(e.movementX || 0, e.movementY || 0);
    }
  }

  onMouseDown(e) {
    this.audio.ensure();
    if (this.state !== 'playing' || !this.player) return;
    if (e.button === 0) this.player.mouse.left = true;
    if (e.button === 2) {
      this.player.mouse.right = true;
      if (!this.pointerLocked) this.rightLook = true;
    }
    if (e.button === 1) this.player.mouse.middle = true;
  }

  onMouseUp(e) {
    if (!this.player) return;
    if (e.button === 0) this.player.mouse.left = false;
    if (e.button === 2) {
      this.player.mouse.right = false;
      this.rightLook = false;
    }
    if (e.button === 1) this.player.mouse.middle = false;
  }

  onWheel(e) {
    if (this.state !== 'playing' || !this.inventory) return;
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    this.inventory.selected = (this.inventory.selected + dir + HOTBAR_SIZE) % HOTBAR_SIZE;
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  loop(now) {
    try {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.frames++;
      this.fpsT += dt;
      if (this.fpsT >= 0.5) {
        this.fps = Math.round(this.frames / this.fpsT);
        this.frames = 0;
        this.fpsT = 0;
      }

      if (this.state === 'playing' || this.state === 'paused' || this.state === 'inventory' || this.state === 'dead') {
        this.tick(dt);
      }
      if (this.world) this.renderer.render(this.scene, this.camera);
      this.ui.update(dt);
    } catch (err) {
      console.error('Frame error:', err);
      this.ui.toast('Error: ' + (err?.message || err), 4);
    }
    requestAnimationFrame(this.loop);
  }

  tick(dt) {
    const playing = this.state === 'playing';
    if (playing) {
      this.sky.update(dt, this.player);
      this.world.updateStreaming(this.player.x, this.player.z);
      this.player.update(dt, true);
      this.entities.update(dt, this.player, this.sky.isNight());
      const info = this.player.interact(dt, this.entities);
      this.updateOutline(info);
      if (this.player.dead && this.state === 'playing') {
        this.state = 'dead';
        document.exitPointerLock?.();
        this.ui.show('death-screen');
      }
      this.autosaveT += dt;
      if (this.autosaveT > 45) {
        this.autosaveT = 0;
        this.save(false);
      }
    } else if (this.player) {
      this.player.updateCamera();
    }

    this.ui.renderHotbar(this.inventory);
    this.ui.renderHearts(this.player.health, this.player.hunger);
    this.ui.flashHurt(this.player.hurtFlash > 0);
    if (this.state === 'inventory') this.ui.renderInventory(this.inventory);

    const hit = this.player.targetBlock();
    let look = 'none';
    if (hit.hit) {
      const b = getItem(hit.id);
      look = `${b?.name || hit.id} (${hit.x}, ${hit.y}, ${hit.z})`;
    }
    this.ui.renderDebug({
      fps: this.fps,
      x: this.player.x, y: this.player.y, z: this.player.z,
      cx: chunkCoord(this.player.x, CHUNK_W),
      cz: chunkCoord(this.player.z, CHUNK_D),
      look,
      seed: this.world.seed,
      loaded: this.world.generatedCount(),
      meshes: this.world.loadedCount(),
      time: this.sky.time.toFixed(3),
    }, this.debug);
  }

  updateOutline(info) {
    const hit = info && info.target;
    if (hit && hit.hit) {
      this.outline.visible = true;
      this.outline.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      if (this.player.breakTarget && this.player.mouse.left) {
        const tool = this.inventory.selectedStack();
        const need = breakTime(hit.id, tool);
        const p = need === Infinity ? 0 : this.player.breakTime / need;
        this.breakOverlay.visible = p > 0.02;
        this.breakOverlay.position.copy(this.outline.position);
        this.breakOverlay.material.opacity = p * 0.45;
        this.ui.setBreak(p);
      } else {
        this.breakOverlay.visible = false;
        this.ui.setBreak(null);
      }
    } else {
      this.outline.visible = false;
      this.breakOverlay.visible = false;
      this.ui.setBreak(null);
    }
  }
}

function toSeed(str) {
  if (/^-?\d+$/.test(str)) return Number(str) | 0;
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

export { raycast };
