import { SAVE_DB, SAVE_VERSION } from './config.js';

const LS_WORLDS = 'voxel-world-list';
const LS_PREFIX = 'voxel-world-save-';
const LS_SETTINGS = 'voxel-world-settings';

function idbOpen() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const req = indexedDB.open(SAVE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('worlds')) db.createObjectStore('worlds');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function idbSet(key, value) {
  const db = await idbOpen();
  if (!db) {
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
  return new Promise((resolve) => {
    const tx = db.transaction('worlds', 'readwrite');
    tx.objectStore('worlds').put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

async function idbGet(key) {
  const db = await idbOpen();
  if (!db) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  return new Promise((resolve) => {
    const tx = db.transaction('worlds', 'readonly');
    const req = tx.objectStore('worlds').get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

async function idbDel(key) {
  const db = await idbOpen();
  if (!db) {
    localStorage.removeItem(LS_PREFIX + key);
    return;
  }
  return new Promise((resolve) => {
    const tx = db.transaction('worlds', 'readwrite');
    tx.objectStore('worlds').delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export function listWorlds() {
  try {
    const raw = localStorage.getItem(LS_WORLDS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeList(list) {
  localStorage.setItem(LS_WORLDS, JSON.stringify(list));
}

export async function saveWorldMeta(meta) {
  const list = listWorlds();
  const i = list.findIndex((w) => w.id === meta.id);
  const entry = { ...meta, lastPlayed: Date.now() };
  if (i >= 0) list[i] = { ...list[i], ...entry };
  else list.unshift(entry);
  writeList(list);
}

export async function saveWorld(id, data) {
  data.version = SAVE_VERSION;
  data.savedAt = Date.now();
  await idbSet(id, data);
  await saveWorldMeta({
    id,
    name: data.name,
    seed: data.seed,
    lastPlayed: data.savedAt,
  });
  return true;
}

export async function loadWorld(id) {
  return idbGet(id);
}

export async function deleteWorld(id) {
  await idbDel(id);
  writeList(listWorlds().filter((w) => w.id !== id));
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSettings(s) {
  localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
}

export function packModifications(map) {
  const out = {};
  for (const [key, rec] of map.entries()) {
    const arr = [];
    for (const [k, id] of Object.entries(rec)) {
      const [x, y, z] = k.split(',').map(Number);
      arr.push(x, y, z, id);
    }
    out[key] = arr;
  }
  return out;
}

export function unpackModifications(obj) {
  const map = new Map();
  if (!obj) return map;
  for (const [key, arr] of Object.entries(obj)) {
    const rec = {};
    for (let i = 0; i < arr.length; i += 4) {
      rec[arr[i] + ',' + arr[i + 1] + ',' + arr[i + 2]] = arr[i + 3];
    }
    map.set(key, rec);
  }
  return map;
}
