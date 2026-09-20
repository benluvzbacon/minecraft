// Minimal headless DOM/canvas/localStorage for booting the game in Node.
// Only implements what the game actually touches.

const SCREEN_IDS = [
  'title-screen', 'new-world-screen', 'load-world-screen', 'settings-screen',
  'pause-screen', 'inventory-screen', 'death-screen', 'loading-screen',
];

class ClassList {
  constructor(el) { this.el = el; }
  get set() { return new Set(this.el.className.split(/\s+/).filter(Boolean)); }
  add(...names) { const s = this.set; names.forEach((n) => s.add(n)); this.el.className = [...s].join(' '); }
  remove(...names) { const s = this.set; names.forEach((n) => s.delete(n)); this.el.className = [...s].join(' '); }
  toggle(name, force) {
    const s = this.set;
    const want = force === undefined ? !s.has(name) : force;
    if (want) s.add(name); else s.delete(name);
    this.el.className = [...s].join(' ');
    return want;
  }
  contains(name) { return this.set.has(name); }
}

class Fake2DContext {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000';
    this.strokeStyle = '#000';
    this.lineWidth = 1;
    this.globalAlpha = 1;
    this.imageSmoothingEnabled = true;
    this.ops = 0;
  }
  fillRect() { this.ops++; }
  strokeRect() { this.ops++; }
  clearRect() { this.ops++; }
  drawImage() { this.ops++; }
  beginPath() { this.ops++; }
  moveTo() { this.ops++; }
  lineTo() { this.ops++; }
  stroke() { this.ops++; }
  fill() { this.ops++; }
}

export class FakeElement {
  constructor(tag = 'div', id = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.className = '';
    this.children = [];
    this.parent = null;
    this.dataset = {};
    this.style = { setProperty() {}, left: '', top: '', width: '' };
    this.value = '';
    this.type = '';
    this.checked = false;
    this.textContent = '';
    this.draggable = false;
    this.onclick = null;
    this._innerHTML = '';
    this._listeners = new Map();
    this.classList = new ClassList(this);
    if (tag === 'canvas') {
      this.width = 300;
      this.height = 150;
    }
  }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) { this._innerHTML = v; if (v === '' || v === '<p class="muted">No saved worlds yet.</p>') this.children.length = 0; }
  appendChild(child) {
    if (child && typeof child === 'object') {
      child.parent = this;
      this.children.push(child);
    }
    return child;
  }
  removeChild(child) {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    return child;
  }
  addEventListener(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(fn);
  }
  removeEventListener(type, fn) {
    const arr = this._listeners.get(type) || [];
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  }
  dispatch(type, ev = {}) {
    ev.type = type;
    ev.target = ev.target || this;
    ev.preventDefault = ev.preventDefault || (() => {});
    ev.stopPropagation = ev.stopPropagation || (() => {});
    for (const fn of this._listeners.get(type) || []) fn(ev);
    if (this.onclick && type === 'click') this.onclick(ev);
  }
  click() { this.dispatch('click', { target: this }); }
  closest(sel) {
    const cls = sel.replace('.', '');
    let el = this;
    while (el) {
      if (el.classList && el.classList.contains(cls)) return el;
      el = el.parent;
    }
    return null;
  }
  getContext(kind) {
    if (kind === '2d') {
      if (!this._ctx) this._ctx = new Fake2DContext(this);
      return this._ctx;
    }
    return null;
  }
  toDataURL() { return 'data:image/png;base64,ZmFrZQ=='; }
  requestPointerLock() { return undefined; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  focus() {}
}

export function installFakeDOM() {
  const elements = new Map();
  const el = (id) => {
    if (!elements.has(id)) elements.set(id, new FakeElement('div', id));
    return elements.get(id);
  };
  for (const id of SCREEN_IDS) el(id);

  const document = {
    getElementById: (id) => el(id),
    createElement: (tag) => new FakeElement(tag),
    querySelectorAll: (sel) => {
      if (sel === '.screen') return SCREEN_IDS.map((id) => el(id));
      return [];
    },
    querySelector: (sel) => (sel === '.menu-panel' ? el('menu-panel') : null),
    addEventListener() {},
    removeEventListener() {},
    pointerLockElement: null,
    exitPointerLock() {},
    body: new FakeElement('body'),
  };

  const rafQueue = [];
  let t = 0;
  const requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length; };

  const storage = new Map();
  const localStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear(),
  };

  globalThis.document = document;
  globalThis.window = globalThis;
  globalThis.innerWidth = 1280;
  globalThis.innerHeight = 720;
  globalThis.devicePixelRatio = 1;
  globalThis.requestAnimationFrame = requestAnimationFrame;
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  globalThis.localStorage = localStorage;
  if (!globalThis.AudioContext) globalThis.AudioContext = undefined;

  return {
    elements,
    el,
    document,
    localStorage,
    pump(dt = 16.7) {
      t += dt;
      const queue = rafQueue.splice(0, rafQueue.length);
      for (const cb of queue) cb(t);
    },
    get now() { return t; },
  };
}
