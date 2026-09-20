# Voxel World

A playable **Minecraft-inspired voxel sandbox** built from scratch for the browser. Explore a procedurally generated 3D world, break and place blocks, craft tools, survive the night, and save your world.

This is original work with original textures and sounds. It does **not** use Minecraft assets.

## Technology

- **JavaScript (ES modules)**
- **Three.js** for WebGL rendering
- **Vite** as the dev server / bundler
- Chunked voxel world with hidden-face mesh building
- IndexedDB / localStorage for world persistence

## Requirements

- Node.js 18+ (20 or 22 recommended)
- A modern browser with WebGL (Chrome, Firefox, Edge, Safari)

## Installation

```bash
cd minecraft
npm install
```

## How to launch

```bash
npm start
```

Then open the URL Vite prints (typically `http://localhost:5173`).

Production build:

```bash
npm run build
npm run preview
```

Unit tests (world gen, inventory, crafting, saves):

```bash
npm test
```

## Controls

| Input | Action |
| --- | --- |
| W A S D | Move |
| Space | Jump (swim up in water) |
| Shift | Sprint |
| Mouse | Look (click the world to lock the pointer) |
| Hold right mouse | Look without pointer lock |
| Arrow keys | Look / move fallback |
| Left click | Break block / punch mob |
| Right click | Place selected block |
| Middle click | Pick block in hotbar |
| 1–9 | Select hotbar slot |
| Mouse wheel | Cycle hotbar |
| E or Tab | Open / close inventory |
| Q | Drop one item |
| Esc | Pause / close menus |
| F3 | Debug overlay (FPS, XYZ, chunk, seed) |
| F8 | Toggle flight (debug) |

If pointer lock is blocked (for example inside an iframe), hold **right mouse button** and move the mouse to look around.

## Gameplay

- **New World** generates terrain from a seed (blank seed = random).
- **Load World** restores a previous save, including player position, inventory, time of day, and edited blocks.
- Break grass, dirt, stone, wood, ores, and more. Broken blocks go into your inventory.
- Craft in the 3×3 grid (open with **E**):
  - 1 wood → 4 planks
  - 2 planks (vertical) → 4 sticks
  - 3 planks + 2 sticks → wooden pickaxe
  - 3 cobblestone + 2 sticks → stone pickaxe
  - Similar patterns for wooden / stone axes
- Tools speed up the matching blocks and wear out with use.
- Health and hunger are shown above the hotbar. Falling too far hurts. Eat berries (right click) to restore hunger and some health — critters drop them, and leaves sometimes do too. Night can spawn hostile brutes.
- Worlds autosave about every 45 seconds, and when you pause or quit to the menu.

## Project architecture

```
src/
  main.js          Entry point
  game.js          Loop, input, menus, save/load orchestration
  config.js        Tunable constants
  utils.js         Math / hashing helpers
  blocks.js        Block & item registry
  noise.js         Seeded Perlin / FBM noise
  chunk.js         16×80×16 chunk storage
  terrain.js       Deterministic terrain, caves, ores, trees
  mesher.js        Hidden-face voxel meshing
  world.js         Chunk streaming, block access, raycast
  textures.js      Original procedural texture atlas & icons
  player.js        FPS controller, physics, mining/placing
  inventory.js     Hotbar, stacks, drag/click
  crafting.js      Data-driven recipes
  entities.js      Passive critters & hostile brutes
  sky.js           Day/night, sun/moon, clouds, fog
  audio.js         Generated UI / world sounds
  save.js          IndexedDB world persistence
  settings.js      Sensitivity, FOV, render distance, quality
  ui.js            HUD, inventory, menus
  style.css        HUD and menu styling
tests/run.mjs      Headless tests for core systems
```

Chunks load and unload around the player. Only visible faces are meshed. Neighboring chunks remesh when a block on the border changes. Unmodified generated terrain is not stored; only the seed plus your edits are saved.

## Known limitations

- Fluid is voxel water (transparent, swimable) rather than a full flowing-liquid sim.
- Sand and gravel do not fall.
- No smelting, chests, or redstone.
- Hostile mobs are simple wandering / chasing cubes.
- Shadow maps are optional (Settings → Graphics → High) and cost performance.
- Very high render distance on low-end GPUs may hitch while new chunks mesh.

## Future features

- Chests, furnaces, and a crafting table block
- More biomes, flowers, and animals
- Better cave networks and underground biomes
- Multiplayer
- Mobile touch controls
