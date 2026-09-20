import { HOTBAR_SIZE, INV_SIZE } from './config.js';
import { getItem, ID } from './blocks.js';
import { matchRecipe } from './crafting.js';

export function makeStack(id, count = 1, durability = null) {
  if (!id) return null;
  const item = getItem(id);
  if (!item) return null;
  const stack = { id, count: Math.max(1, count) };
  if (item.toolData) {
    stack.durability = durability == null ? item.toolData.durability : durability;
    stack.maxDurability = item.toolData.durability;
  }
  return stack;
}

export function cloneStack(s) {
  if (!s) return null;
  const c = { id: s.id, count: s.count };
  if (s.durability != null) {
    c.durability = s.durability;
    c.maxDurability = s.maxDurability;
  }
  return c;
}

export function stacksMatch(a, b) {
  if (!a || !b) return false;
  if (a.id !== b.id) return false;
  if (a.durability != null || b.durability != null) return false;
  return true;
}

export class Inventory {
  constructor() {
    this.slots = new Array(INV_SIZE).fill(null);
    this.craft = new Array(9).fill(null);
    this.result = null;
    this.cursor = null;
    this.selected = 0;
  }

  hotbar(i) {
    return this.slots[i] || null;
  }

  selectedStack() {
    return this.slots[this.selected] || null;
  }

  add(id, count = 1) {
    const item = getItem(id);
    if (!item) return count;
    const max = item.stack || 64;
    if (item.toolData) {
      for (let i = 0; i < INV_SIZE && count > 0; i++) {
        if (!this.slots[i]) {
          this.slots[i] = makeStack(id, 1);
          count--;
        }
      }
      return count;
    }
    for (let i = 0; i < INV_SIZE && count > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < max) {
        const space = max - s.count;
        const n = Math.min(space, count);
        s.count += n;
        count -= n;
      }
    }
    for (let i = 0; i < INV_SIZE && count > 0; i++) {
      if (!this.slots[i]) {
        const n = Math.min(max, count);
        this.slots[i] = makeStack(id, n);
        count -= n;
      }
    }
    return count;
  }

  takeSelected(n = 1) {
    const s = this.slots[this.selected];
    if (!s) return null;
    const take = Math.min(n, s.count);
    s.count -= take;
    const out = makeStack(s.id, take, s.durability);
    if (s.count <= 0) this.slots[this.selected] = null;
    return out;
  }

  consumeSelected() {
    const s = this.slots[this.selected];
    if (!s) return false;
    const item = getItem(s.id);
    if (item && item.toolData) return true;
    s.count--;
    if (s.count <= 0) this.slots[this.selected] = null;
    return true;
  }

  damageSelected(amount = 1) {
    const s = this.slots[this.selected];
    if (!s || s.durability == null) return;
    s.durability -= amount;
    if (s.durability <= 0) this.slots[this.selected] = null;
  }

  clickSlot(index, right) {
    if (index < 0 || index >= INV_SIZE) return;
    this._click(this.slots, index, right);
  }

  clickCraft(index, right) {
    if (index < 0 || index >= 9) return;
    this._click(this.craft, index, right);
    this.refreshCraft();
  }

  clickResult() {
    if (!this.result) return;
    if (this.cursor) {
      if (!stacksMatch(this.cursor, this.result)) return;
      const item = getItem(this.cursor.id);
      const max = item.stack || 64;
      if (this.cursor.count + this.result.count > max) return;
      this.cursor.count += this.result.count;
    } else {
      this.cursor = cloneStack(this.result);
    }
    this.consumeCraftInputs();
    this.refreshCraft();
  }

  _click(arr, index, right) {
    const slot = arr[index];
    const cur = this.cursor;
    if (!cur && !slot) return;
    if (!cur && slot) {
      if (right && slot.count > 1) {
        const half = Math.ceil(slot.count / 2);
        this.cursor = makeStack(slot.id, half, slot.durability);
        slot.count -= half;
        if (slot.count <= 0) arr[index] = null;
      } else {
        this.cursor = slot;
        arr[index] = null;
      }
      return;
    }
    if (cur && !slot) {
      if (right) {
        arr[index] = makeStack(cur.id, 1, cur.durability);
        cur.count--;
        if (cur.count <= 0) this.cursor = null;
      } else {
        arr[index] = cur;
        this.cursor = null;
      }
      return;
    }
    if (stacksMatch(cur, slot)) {
      const item = getItem(slot.id);
      const max = item.stack || 64;
      if (right) {
        if (slot.count < max) {
          slot.count++;
          cur.count--;
          if (cur.count <= 0) this.cursor = null;
        }
      } else {
        const space = max - slot.count;
        const n = Math.min(space, cur.count);
        slot.count += n;
        cur.count -= n;
        if (cur.count <= 0) this.cursor = null;
      }
    } else {
      arr[index] = cur;
      this.cursor = slot;
    }
  }

  refreshCraft() {
    const recipe = matchRecipe(this.craft);
    this.result = recipe ? makeStack(recipe.id, recipe.count) : null;
  }

  consumeCraftInputs() {
    for (let i = 0; i < 9; i++) {
      const s = this.craft[i];
      if (!s) continue;
      s.count--;
      if (s.count <= 0) this.craft[i] = null;
    }
  }

  dropCursor() {
    const c = this.cursor;
    this.cursor = null;
    return c;
  }

  serialize() {
    return {
      slots: this.slots.map(ser),
      craft: this.craft.map(ser),
      selected: this.selected,
    };
  }

  deserialize(data) {
    if (!data) return;
    this.slots = (data.slots || []).map(des);
    while (this.slots.length < INV_SIZE) this.slots.push(null);
    this.craft = (data.craft || []).map(des);
    while (this.craft.length < 9) this.craft.push(null);
    this.selected = data.selected || 0;
    this.cursor = null;
    this.refreshCraft();
  }
}

function ser(s) {
  return s ? { id: s.id, count: s.count, durability: s.durability, maxDurability: s.maxDurability } : null;
}
function des(s) {
  if (!s) return null;
  return { id: s.id, count: s.count, durability: s.durability, maxDurability: s.maxDurability };
}

export { HOTBAR_SIZE };
