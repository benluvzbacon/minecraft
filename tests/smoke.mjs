// Headless boot test: runs the real Game with a fake DOM + no-op WebGL
// renderer to catch runtime errors that curl/tests can't reach.
// Run: npm run smoke
import { installFakeDOM } from './fake-dom.mjs';

const dom = installFakeDOM();

const { Game } = await import('../src/game.js');
const { ID } = await import('../src/blocks.js');

let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; console.log('  ok  ' + label); }
  else { failed++; console.log('  FAIL ' + label); }
}
function section(name) { console.log('\n' + name); }

section('boot');
let game;
try {
  game = new Game();
  ok(game instanceof Game, 'Game constructor');
} catch (err) {
  console.error('BOOT ERROR:', err);
  process.exit(1);
}
ok(game.state === 'menu', 'starts at menu');
ok(!dom.el('title-screen').classList.contains('hidden'), 'title screen visible');

section('create world');
dom.el('world-name').value = 'Smoke Test';
dom.el('world-seed').value = '12345';
let worldId = null;
try {
  await game.createWorldFromForm();
  ok(game.state === 'loading' || game.state === 'playing', 'world creation started');
  worldId = game.worldId;
  ok(!!worldId, 'world id assigned');
} catch (err) {
  console.error('CREATE ERROR:', err);
  process.exit(1);
}

// pump frames: two nested rAFs start finishLoad, then the loop runs
for (let i = 0; i < 400; i++) dom.pump(16.7);
ok(game.state === 'playing', 'reached playing state (got ' + game.state + ')');
ok(game.world.generatedCount() >= 25, 'chunks generated: ' + game.world.generatedCount());
ok(game.world.loadedCount() >= 25, 'chunk meshes built: ' + game.world.loadedCount());
ok(game.player.y > 1 && game.player.y < 80, 'player y sane: ' + game.player.y.toFixed(2));
ok(game.player.onGround, 'player settled on ground');

section('movement follows view');
// Fly (no gravity/collision) and check W/A/S/D match the camera heading at
// several yaws — catches wish-direction math that doesn't match camera yaw.
{
  const baseX = game.player.x, baseZ = game.player.z;
  game.player.flying = true;
  game.player.y = 60;
  game.player.pitch = 0;
  const yaws = [0, Math.PI / 2, Math.PI, -Math.PI / 3, 2.5, -2.9];
  const dirs = [
    ['KeyW', 1, 'forward'], ['KeyS', -1, 'back'], ['KeyD', 1, 'right'], ['KeyA', -1, 'left'],
  ];
  for (const yaw of yaws) {
    game.player.yaw = yaw;
    game.player.updateCamera();
    const f = { x: game.player.look.x, z: game.player.look.z };
    const r = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    for (const [key, sign, name] of dirs) {
      game.player.x = baseX; game.player.z = baseZ;
      game.player.vx = game.player.vz = 0;
      game.player.keys.add(key);
      for (let i = 0; i < 20; i++) dom.pump(16.7);
      game.player.keys.delete(key);
      const dx = game.player.x - baseX, dz = game.player.z - baseZ;
      const len = Math.hypot(dx, dz);
      const basis = name === 'forward' || name === 'back' ? f : r;
      const expect = name === 'back' || name === 'left' ? -1 : 1;
      const dot = len > 0.1 ? (dx / len) * basis.x * expect + (dz / len) * basis.z * expect : -1;
      ok(dot > 0.98, `${name} matches view at yaw ${yaw.toFixed(2)} (dot ${dot.toFixed(3)})`);
    }
  }
  game.player.flying = false;
  game.player.vx = game.player.vz = game.player.vy = 0;
  game.player.respawn();
  for (let i = 0; i < 120; i++) dom.pump(16.7);
  ok(game.player.onGround, 'player re-settled on ground');
}

section('movement + interaction');
const startX = game.player.x, startZ = game.player.z;
game.player.keys.add('KeyW');
for (let i = 0; i < 120; i++) dom.pump(16.7);
game.player.keys.delete('KeyW');
const moved = Math.hypot(game.player.x - startX, game.player.z - startZ);
ok(moved > 1, 'walking moves player: ' + moved.toFixed(2) + ' blocks');

// aim down and hold left mouse until a block breaks
game.player.pitch = -1.4;
game.player.mouse.left = true;
let frames = 0;
const invTotal = () => game.inventory.slots.filter(Boolean).reduce((n, s) => n + s.count, 0);
const before = invTotal();
while (frames < 400 && invTotal() === before) {
  dom.pump(16.7);
  frames++;
}
game.player.mouse.left = false;
ok(invTotal() > before, 'block broken and collected in ' + (frames * 0.0167).toFixed(1) + 's');
const invCount = invTotal();

// place it back
game.player.pitch = -1.2;
game.player.mouse.left = false;
game.inventory.selected = 0;
game.player.mouse.right = true;
for (let i = 0; i < 30; i++) dom.pump(16.7);
game.player.mouse.right = false;
ok(true, 'place attempt ran without throwing');

section('inventory + pause + death-free tick');
game.onKey({ code: 'KeyE', preventDefault() {} }, true);
ok(game.state === 'inventory', 'E opens inventory');
for (let i = 0; i < 10; i++) dom.pump(16.7);
game.onKey({ code: 'Escape', preventDefault() {} }, true);
ok(game.state === 'playing', 'Esc closes inventory');
game.onKey({ code: 'Escape', preventDefault() {} }, true);
ok(game.state === 'paused', 'Esc pauses');
for (let i = 0; i < 10; i++) dom.pump(16.7);
game.onKey({ code: 'Escape', preventDefault() {} }, true);
ok(game.state === 'playing', 'Esc resumes');
for (let i = 0; i < 60; i++) dom.pump(16.7);

section('save + load');
const invAtSave = invTotal();
await game.save(true);
const savedPos = { x: game.player.x, y: game.player.y, z: game.player.z };
game.quitToMenu();
ok(game.state === 'menu', 'quit to menu');
await game.loadExisting(worldId);
for (let i = 0; i < 10; i++) dom.pump(16.7);
ok(game.state === 'playing', 'reload reached playing (got ' + game.state + ')');
const dx = Math.abs(game.player.x - savedPos.x) + Math.abs(game.player.z - savedPos.z);
ok(dx < 2, 'position restored (drift ' + dx.toFixed(2) + ')');
const invAfter = game.inventory.slots.filter(Boolean).reduce((n, s) => n + s.count, 0);
ok(invAfter === invAtSave, 'inventory restored (' + invAfter + ' items)');

section('fresh world has empty inventory');
game.quitToMenu();
dom.el('world-name').value = 'Fresh';
dom.el('world-seed').value = '777';
await game.createWorldFromForm();
for (let i = 0; i < 400; i++) dom.pump(16.7);
ok(game.state === 'playing', 'fresh world playable');
const freshCount = game.inventory.slots.filter(Boolean).reduce((n, s) => n + s.count, 0);
ok(freshCount === 0, 'no starter items (' + freshCount + ')');

section('night + entities + long run');
game.sky.time = 0.75; // night
for (let i = 0; i < 600; i++) dom.pump(16.7);
ok(game.state === 'playing' || game.state === 'dead', 'survived/undeAD long run (state ' + game.state + ')');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
