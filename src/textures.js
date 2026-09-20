import * as THREE from 'three';
import { ID, getItem, BLOCKS } from './blocks.js';
import { hash2 } from './utils.js';

export const ATLAS_COLS = 8;
export const TILE_PX = 16;
export const ATLAS_PX = ATLAS_COLS * TILE_PX;

function px(ctx, x, y, r, g, b, a = 255) {
  ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},${a / 255})`;
  ctx.fillRect(x, y, 1, 1);
}

function noiseFill(ctx, ox, oy, base, vary, seed) {
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const n = hash2(x + ox * 17, y + oy * 31, seed) * 2 - 1;
      px(ctx, ox + x, oy + y,
        base[0] + n * vary[0],
        base[1] + n * vary[1],
        base[2] + n * vary[2]);
    }
  }
}

function speckle(ctx, ox, oy, color, chance, seed) {
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      if (hash2(x, y, seed) < chance) {
        px(ctx, ox + x, oy + y, color[0], color[1], color[2]);
      }
    }
  }
}

function tileOrigin(index) {
  return [(index % ATLAS_COLS) * TILE_PX, Math.floor(index / ATLAS_COLS) * TILE_PX];
}

export function generateAtlasCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_PX;
  canvas.height = ATLAS_PX;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#ff00ff';
  ctx.fillRect(0, 0, ATLAS_PX, ATLAS_PX);

  // 0 grass top
  let [ox, oy] = tileOrigin(0);
  noiseFill(ctx, ox, oy, [74, 158, 58], [18, 22, 14], 11);
  speckle(ctx, ox, oy, [52, 122, 40], 0.12, 12);
  speckle(ctx, ox, oy, [120, 190, 70], 0.08, 13);

  // 1 grass side
  [ox, oy] = tileOrigin(1);
  noiseFill(ctx, ox, oy, [138, 90, 50], [16, 12, 8], 21);
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const n = hash2(x, y, 22) * 2 - 1;
      px(ctx, ox + x, oy + y, 74 + n * 16, 148 + n * 18, 52 + n * 12);
    }
  }
  for (let x = 0; x < TILE_PX; x++) {
    if (hash2(x, 5, 23) > 0.4) px(ctx, ox + x, oy + 4, 90, 140, 50);
  }

  // 2 dirt
  [ox, oy] = tileOrigin(2);
  noiseFill(ctx, ox, oy, [138, 90, 50], [18, 14, 10], 31);
  speckle(ctx, ox, oy, [90, 58, 32], 0.08, 32);

  // 3 stone
  [ox, oy] = tileOrigin(3);
  noiseFill(ctx, ox, oy, [122, 122, 126], [14, 14, 14], 41);
  speckle(ctx, ox, oy, [90, 90, 94], 0.1, 42);
  speckle(ctx, ox, oy, [150, 150, 154], 0.06, 43);

  // 4 sand
  [ox, oy] = tileOrigin(4);
  noiseFill(ctx, ox, oy, [214, 196, 122], [16, 14, 10], 51);
  speckle(ctx, ox, oy, [196, 176, 100], 0.1, 52);

  // 5 gravel
  [ox, oy] = tileOrigin(5);
  noiseFill(ctx, ox, oy, [130, 126, 120], [22, 20, 18], 61);
  speckle(ctx, ox, oy, [90, 88, 84], 0.16, 62);
  speckle(ctx, ox, oy, [170, 164, 150], 0.1, 63);

  // 6 log side
  [ox, oy] = tileOrigin(6);
  noiseFill(ctx, ox, oy, [118, 74, 38], [12, 10, 8], 71);
  for (let x = 2; x < TILE_PX; x += 4) {
    for (let y = 0; y < TILE_PX; y++) {
      px(ctx, ox + x, oy + y, 86, 52, 26);
      if (x + 1 < TILE_PX) px(ctx, ox + x + 1, oy + y, 100, 62, 30);
    }
  }

  // 7 log top
  [ox, oy] = tileOrigin(7);
  noiseFill(ctx, ox, oy, [150, 110, 62], [10, 8, 6], 81);
  ctx.strokeStyle = 'rgba(90,55,25,0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.strokeRect(ox + 3, oy + 3, 10, 10);
  ctx.strokeRect(ox + 6, oy + 6, 4, 4);

  // 8 leaves (true holes for alphaTest)
  [ox, oy] = tileOrigin(8);
  ctx.clearRect(ox, oy, TILE_PX, TILE_PX);
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const n = hash2(x, y, 91);
      if (n < 0.22) continue;
      const g = 90 + n * 50;
      px(ctx, ox + x, oy + y, 40 + n * 20, g, 40);
    }
  }

  // 9 water
  [ox, oy] = tileOrigin(9);
  noiseFill(ctx, ox, oy, [46, 110, 196], [20, 24, 18], 101);
  for (let y = 4; y < TILE_PX; y += 5) {
    for (let x = 0; x < TILE_PX; x++) {
      px(ctx, ox + x, oy + y, 80, 160, 220, 180);
    }
  }

  // 10 coal ore
  [ox, oy] = tileOrigin(10);
  noiseFill(ctx, ox, oy, [122, 122, 126], [14, 14, 14], 111);
  speckle(ctx, ox, oy, [20, 20, 22], 0.18, 112);
  speckle(ctx, ox, oy, [40, 40, 42], 0.1, 113);

  // 11 iron ore
  [ox, oy] = tileOrigin(11);
  noiseFill(ctx, ox, oy, [122, 122, 126], [14, 14, 14], 121);
  speckle(ctx, ox, oy, [196, 150, 120], 0.16, 122);
  speckle(ctx, ox, oy, [160, 110, 80], 0.08, 123);

  // 12 bedrock
  [ox, oy] = tileOrigin(12);
  noiseFill(ctx, ox, oy, [42, 42, 46], [16, 16, 16], 131);
  speckle(ctx, ox, oy, [20, 20, 22], 0.2, 132);
  speckle(ctx, ox, oy, [70, 70, 74], 0.1, 133);

  // 13 planks
  [ox, oy] = tileOrigin(13);
  noiseFill(ctx, ox, oy, [188, 148, 78], [12, 10, 8], 141);
  for (let y = 0; y < TILE_PX; y++) {
    if (y % 4 === 3) {
      for (let x = 0; x < TILE_PX; x++) px(ctx, ox + x, oy + y, 140, 100, 50);
    }
  }
  for (let x = 8; x < 9; x++) {
    for (let y = 0; y < 8; y++) px(ctx, ox + x, oy + y, 150, 110, 55);
  }

  // 14 cobble
  [ox, oy] = tileOrigin(14);
  noiseFill(ctx, ox, oy, [110, 110, 114], [18, 18, 18], 151);
  ctx.strokeStyle = 'rgba(70,70,74,0.8)';
  ctx.strokeRect(ox + 1, oy + 1, 6, 6);
  ctx.strokeRect(ox + 8, oy + 2, 6, 5);
  ctx.strokeRect(ox + 3, oy + 9, 7, 5);

  // 15 crack overlay
  [ox, oy] = tileOrigin(15);
  ctx.clearRect(ox, oy, TILE_PX, TILE_PX);
  ctx.strokeStyle = 'rgba(20,20,20,0.85)';
  ctx.beginPath();
  ctx.moveTo(ox + 3, oy + 1);
  ctx.lineTo(ox + 8, oy + 8);
  ctx.lineTo(ox + 4, oy + 14);
  ctx.moveTo(ox + 12, oy + 2);
  ctx.lineTo(ox + 9, oy + 9);
  ctx.stroke();

  return canvas;
}

export function createAtlasTexture() {
  const canvas = generateAtlasCanvas();
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return { texture: tex, canvas };
}

const iconCache = new Map();

function drawTool(ctx, kind, color) {
  ctx.clearRect(0, 0, 32, 32);
  ctx.imageSmoothingEnabled = false;
  const [r, g, b] = color;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  if (kind === 'pickaxe') {
    ctx.fillStyle = '#8b5a2b';
    for (let i = 8; i < 26; i++) ctx.fillRect(i, i, 3, 3);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(6, 4, 18, 6);
    ctx.fillRect(18, 6, 6, 10);
  } else if (kind === 'axe') {
    ctx.fillStyle = '#8b5a2b';
    for (let i = 8; i < 26; i++) ctx.fillRect(i, i, 3, 3);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(4, 4, 14, 12);
    ctx.fillRect(4, 4, 16, 6);
  } else if (kind === 'stick') {
    ctx.fillStyle = '#8b5a2b';
    for (let i = 6; i < 26; i++) ctx.fillRect(i, i, 4, 4);
  } else if (kind === 'berries') {
    ctx.fillStyle = '#3d8c3a';
    ctx.fillRect(10, 18, 12, 8);
    ctx.fillStyle = '#cc3344';
    ctx.fillRect(8, 10, 6, 6);
    ctx.fillRect(16, 8, 6, 6);
    ctx.fillRect(12, 14, 6, 6);
    ctx.fillStyle = '#f0d0d0';
    ctx.fillRect(9, 11, 2, 2);
  }
}

export function itemIcon(id) {
  if (iconCache.has(id)) return iconCache.get(id);
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const item = getItem(id);
  if (!item) {
    iconCache.set(id, canvas.toDataURL());
    return iconCache.get(id);
  }
  if (item.isItem) {
    const c = item.color || 0xffffff;
    const rgb = [(c >> 16) & 255, (c >> 8) & 255, c & 255];
    drawTool(ctx, item.icon, rgb);
  } else {
    const atlas = generateAtlasCanvas();
    const faces = item.faces || { all: 0 };
    const top = faces.top ?? faces.all ?? 0;
    const side = faces.side ?? faces.all ?? 0;
    const [tx, ty] = tileOrigin(top);
    const [sx, sy] = tileOrigin(side);
    // isometric-ish cube
    ctx.drawImage(atlas, sx, sy, 16, 16, 6, 12, 20, 16);
    ctx.globalAlpha = 0.95;
    ctx.drawImage(atlas, tx, ty, 16, 16, 6, 4, 20, 14);
    ctx.globalAlpha = 1;
  }
  const url = canvas.toDataURL();
  iconCache.set(id, url);
  return url;
}

export function preloadIcons() {
  for (const id of Object.keys(BLOCKS)) itemIcon(Number(id));
  itemIcon(ID.STICK);
  itemIcon(ID.WOODEN_PICKAXE);
  itemIcon(ID.STONE_PICKAXE);
  itemIcon(ID.WOODEN_AXE);
  itemIcon(ID.STONE_AXE);
  itemIcon(ID.BERRIES);
}
