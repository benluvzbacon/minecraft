import { getItem, ID } from './blocks.js';
import { itemIcon } from './textures.js';
import { INV_SIZE, HOTBAR_SIZE, MAX_HEALTH, MAX_HUNGER } from './config.js';
import { listWorlds } from './save.js';

export class UI {
  constructor() {
    this.root = document.getElementById('ui');
    this.cursorEl = document.getElementById('cursor-item');
    this.messageTimer = 0;
  }

  show(id) {
    document.querySelectorAll('.screen').forEach((el) => el.classList.add('hidden'));
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  }

  hideScreens() {
    document.querySelectorAll('.screen').forEach((el) => el.classList.add('hidden'));
  }

  setHudVisible(v) {
    document.getElementById('hud').classList.toggle('hidden', !v);
  }

  toast(msg, time = 2.2) {
    const el = document.getElementById('message');
    el.textContent = msg;
    el.classList.remove('hidden');
    this.messageTimer = time;
  }

  update(dt) {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) document.getElementById('message').classList.add('hidden');
    }
  }

  renderHotbar(inv) {
    const bar = document.getElementById('hotbar');
    if (bar.children.length !== HOTBAR_SIZE) {
      bar.innerHTML = '';
      for (let i = 0; i < HOTBAR_SIZE; i++) {
        const s = document.createElement('div');
        s.className = 'slot';
        s.dataset.i = i;
        bar.appendChild(s);
      }
    }
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = bar.children[i];
      slot.classList.toggle('selected', i === inv.selected);
      fillSlot(slot, inv.slots[i]);
    }
    const held = inv.selectedStack();
    const nameEl = document.getElementById('held-name');
    nameEl.textContent = held ? (getItem(held.id)?.name || '') : '';
  }

  renderHearts(health, hunger) {
    const h = document.getElementById('hearts');
    const g = document.getElementById('hunger');
    const hearts = MAX_HEALTH / 2;
    if (h.children.length !== hearts) {
      h.innerHTML = '';
      g.innerHTML = '';
      for (let i = 0; i < hearts; i++) {
        h.appendChild(Object.assign(document.createElement('span'), { className: 'pip heart' }));
        g.appendChild(Object.assign(document.createElement('span'), { className: 'pip food' }));
      }
    }
    for (let i = 0; i < hearts; i++) {
      const v = health - i * 2;
      h.children[i].className = 'pip heart ' + (v >= 2 ? 'full' : v === 1 ? 'half' : 'empty');
      const f = hunger - i * 2;
      g.children[i].className = 'pip food ' + (f >= 2 ? 'full' : f === 1 ? 'half' : 'empty');
    }
  }

  renderInventory(inv) {
    const grid = document.getElementById('inv-grid');
    if (grid.children.length !== 27) {
      grid.innerHTML = '';
      for (let i = 9; i < INV_SIZE; i++) {
        const s = document.createElement('div');
        s.className = 'slot';
        s.dataset.kind = 'inv';
        s.dataset.i = i;
        grid.appendChild(s);
      }
    }
    for (let i = 0; i < 27; i++) fillSlot(grid.children[i], inv.slots[i + 9]);

    const hot = document.getElementById('inv-hotbar');
    if (hot.children.length !== 9) {
      hot.innerHTML = '';
      for (let i = 0; i < 9; i++) {
        const s = document.createElement('div');
        s.className = 'slot';
        s.dataset.kind = 'inv';
        s.dataset.i = i;
        hot.appendChild(s);
      }
    }
    for (let i = 0; i < 9; i++) fillSlot(hot.children[i], inv.slots[i]);

    const craft = document.getElementById('craft-grid');
    if (craft.children.length !== 9) {
      craft.innerHTML = '';
      for (let i = 0; i < 9; i++) {
        const s = document.createElement('div');
        s.className = 'slot';
        s.dataset.kind = 'craft';
        s.dataset.i = i;
        craft.appendChild(s);
      }
    }
    for (let i = 0; i < 9; i++) fillSlot(craft.children[i], inv.craft[i]);

    const res = document.getElementById('craft-result');
    res.dataset.kind = 'result';
    fillSlot(res, inv.result);
    this.renderCursor(inv);
  }

  renderCursor(inv) {
    const el = this.cursorEl;
    if (!inv.cursor) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    fillSlot(el, inv.cursor);
  }

  moveCursor(x, y) {
    this.cursorEl.style.left = x + 12 + 'px';
    this.cursorEl.style.top = y + 12 + 'px';
  }

  renderDebug(info, on) {
    const el = document.getElementById('debug');
    el.classList.toggle('hidden', !on);
    if (!on) return;
    el.textContent =
      `Voxel World\n` +
      `FPS: ${info.fps}\n` +
      `XYZ: ${info.x.toFixed(2)} / ${info.y.toFixed(2)} / ${info.z.toFixed(2)}\n` +
      `Chunk: ${info.cx} ${info.cz}\n` +
      `Looking: ${info.look}\n` +
      `Seed: ${info.seed}\n` +
      `Loaded chunks: ${info.loaded}\n` +
      `Time: ${info.time}\n` +
      `Mem meshes: ${info.meshes}`;
  }

  setBreak(progress) {
    const wrap = document.getElementById('break-bar');
    const fill = document.getElementById('break-bar-fill');
    if (progress == null || progress <= 0) {
      wrap.classList.add('hidden');
      return;
    }
    wrap.classList.remove('hidden');
    fill.style.width = Math.min(100, progress * 100) + '%';
  }

  flashHurt(on) {
    document.getElementById('hurt-vignette').classList.toggle('on', on);
  }

  populateWorldList(onLoad, onDelete) {
    const list = document.getElementById('world-list');
    const worlds = listWorlds();
    list.innerHTML = '';
    if (!worlds.length) {
      list.innerHTML = '<p class="muted">No saved worlds yet.</p>';
      return;
    }
    for (const w of worlds) {
      const row = document.createElement('div');
      row.className = 'world-row';
      const date = w.lastPlayed ? new Date(w.lastPlayed).toLocaleString() : '';
      row.innerHTML = `<div><strong>${escapeHtml(w.name)}</strong><div class="muted">Seed ${w.seed} · ${date}</div></div>`;
      const play = document.createElement('button');
      play.textContent = 'Play';
      play.addEventListener('click', () => onLoad(w.id));
      const del = document.createElement('button');
      del.className = 'danger';
      del.textContent = 'Delete';
      del.addEventListener('click', () => { onDelete(w.id); this.populateWorldList(onLoad, onDelete); });
      row.appendChild(play);
      row.appendChild(del);
      list.appendChild(row);
    }
  }
}

function fillSlot(el, stack) {
  el.innerHTML = '';
  if (!stack) return;
  const img = document.createElement('img');
  img.src = itemIcon(stack.id);
  img.draggable = false;
  el.appendChild(img);
  if (stack.count > 1) {
    const n = document.createElement('span');
    n.className = 'count';
    n.textContent = stack.count;
    el.appendChild(n);
  }
  if (stack.durability != null && stack.maxDurability) {
    const bar = document.createElement('div');
    bar.className = 'durability';
    const pct = stack.durability / stack.maxDurability;
    bar.style.setProperty('--pct', pct);
    bar.classList.toggle('low', pct < 0.25);
    el.appendChild(bar);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export { ID };
