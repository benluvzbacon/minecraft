import { ID, getItem } from './blocks.js';

export const RECIPES = [
  {
    id: 'planks',
    shapeless: true,
    input: [{ id: ID.LOG, count: 1 }],
    output: { id: ID.PLANKS, count: 4 },
  },
  {
    id: 'sticks',
    pattern: ['P', 'P'],
    keys: { P: ID.PLANKS },
    output: { id: ID.STICK, count: 4 },
  },
  {
    id: 'wooden_pickaxe',
    pattern: ['PPP', ' S ', ' S '],
    keys: { P: ID.PLANKS, S: ID.STICK },
    output: { id: ID.WOODEN_PICKAXE, count: 1 },
  },
  {
    id: 'stone_pickaxe',
    pattern: ['CCC', ' S ', ' S '],
    keys: { C: ID.COBBLE, S: ID.STICK },
    output: { id: ID.STONE_PICKAXE, count: 1 },
  },
  {
    id: 'wooden_axe',
    pattern: ['PP ', 'PS ', ' S '],
    keys: { P: ID.PLANKS, S: ID.STICK },
    output: { id: ID.WOODEN_AXE, count: 1 },
  },
  {
    id: 'wooden_axe_mirror',
    pattern: [' PP', ' SP', ' S '],
    keys: { P: ID.PLANKS, S: ID.STICK },
    output: { id: ID.WOODEN_AXE, count: 1 },
  },
  {
    id: 'stone_axe',
    pattern: ['CC ', 'CS ', ' S '],
    keys: { C: ID.COBBLE, S: ID.STICK },
    output: { id: ID.STONE_AXE, count: 1 },
  },
  {
    id: 'stone_axe_mirror',
    pattern: [' CC', ' SC', ' S '],
    keys: { C: ID.COBBLE, S: ID.STICK },
    output: { id: ID.STONE_AXE, count: 1 },
  },
];

function gridToIds(grid) {
  return grid.map((s) => (s ? s.id : 0));
}

function shapelessMatch(recipe, ids) {
  const need = recipe.input.map((i) => ({ ...i }));
  const used = ids.filter((id) => id);
  if (used.length !== need.reduce((a, b) => a + b.count, 0)) return false;
  for (const id of used) {
    const n = need.find((x) => x.id === id && x.count > 0);
    if (!n) return false;
    n.count--;
  }
  return need.every((n) => n.count === 0);
}

function shapedMatch(recipe, ids) {
  const rows = recipe.pattern;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const pat = [];
  for (let y = 0; y < h; y++) {
    const row = rows[y].padEnd(w, ' ');
    pat.push(row);
  }
  for (let oy = 0; oy <= 3 - h; oy++) {
    for (let ox = 0; ox <= 3 - w; ox++) {
      let ok = true;
      for (let y = 0; y < 3 && ok; y++) {
        for (let x = 0; x < 3 && ok; x++) {
          const id = ids[x + y * 3];
          const inPat = y >= oy && y < oy + h && x >= ox && x < ox + w;
          const ch = inPat ? pat[y - oy][x - ox] : ' ';
          if (ch === ' ') {
            if (id) ok = false;
          } else {
            const want = recipe.keys[ch];
            if (id !== want) ok = false;
          }
        }
      }
      if (ok) return true;
    }
  }
  return false;
}

export function matchRecipe(grid) {
  const ids = gridToIds(grid);
  if (ids.every((id) => !id)) return null;
  for (const r of RECIPES) {
    const ok = r.shapeless ? shapelessMatch(r, ids) : shapedMatch(r, ids);
    if (ok) return { id: r.output.id, count: r.output.count };
  }
  return null;
}

export function recipeOutputName(id) {
  const it = getItem(id);
  return it ? it.name : 'Unknown';
}
