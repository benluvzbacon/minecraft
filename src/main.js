import { Game } from './game.js';

window.addEventListener('error', (e) => {
  console.error(e.error || e.message);
});

try {
  const game = new Game();
  window.game = game;
} catch (err) {
  console.error(err);
  const panel = document.querySelector('.menu-panel') || document.body;
  panel.innerHTML = `<h2>Failed to start</h2><p>${String(err && err.message ? err.message : err)}</p><p>This game needs a browser with WebGL enabled.</p>`;
}
