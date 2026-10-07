import { Game } from './Game.js';

const game = new Game(document.getElementById('game'));
window.__game = game;
game.start().catch((err) => {
  console.error(err);
  const status = document.getElementById('loading-status');
  if (status) status.textContent = `Failed to start: ${err.message}`;
});
