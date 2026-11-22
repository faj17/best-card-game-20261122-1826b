// Boot and the one loop: the table is drawn every frame; clicks and keys
// drive the player's turn, and Rook answers one step at a time so the
// player can read each move. ?seed=N fixes the deal. ?shot=title|battle|
// win|loss (with &seed=N) stages that scene instead of running the loop,
// paints it twice and sets window.__shotReady for a screenshot.
import { createGame, endTurn, playCard, attack, snapshot } from './engine.js';
import { createRandom } from './random.js';
import { aiStep, aiHasMoves } from './ai.js';
import { createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { sfx } from './audio.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);

function makeGame(s) {
  return createGame(createRandom(s));
}

function runShot(name) {
  const { game, screen } = stageShot(name, makeGame);
  window.__game = game;
  window.__snapshot = () => snapshot(game);
  let painted = 0;
  function paint() {
    renderer.draw(game, screen, { armed: null, hoverHand: -1, selectedHand: -1 });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let game = makeGame(seed);
  let screen = SCREEN_TITLE;
  let selectedHand = -1;
  let armed = null;
  let aiTimer = 0;
  let lastResonance = null;

  window.__game = game;
  window.__snapshot = () => snapshot(game);
  Object.defineProperty(window, '__phase', { get: () => screen });

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    game = makeGame(Math.floor(Math.random() * 4294967296));
    window.__game = game;
    screen = SCREEN_PLAY;
    game.phase = 'play';
    selectedHand = -1;
    armed = null;
    announce('Playing. Your turn — play a card, then strike.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (game.winner === 'player') sfx.win();
    else if (game.winner === 'enemy') sfx.lose();
    announce(game.winner === 'player' ? 'Victory! Rook falls.'
      : game.winner === 'enemy' ? 'Defeat. Rook claims the pact.' : 'Draw. Both fall.');
  }

  function pointIn(rect, x, y) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  function handleClick(x, y) {
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      startGame();
      return;
    }
    if (game.phase !== 'play' || game.turnOwner !== 'player') return;
    // End Turn button.
    const b = renderer.endTurnRect();
    if (pointIn(b, x, y)) {
      selectedHand = -1;
      armed = null;
      sfx.turn();
      endTurn(game);
      return;
    }
    // Hand cards: play the clicked one.
    for (let i = 0; i < game.player.hand.length; i += 1) {
      const r = renderer.handCardRect(i, game.player.hand.length);
      if (pointIn(r, x, y)) {
        const card = game.player.hand[i];
        if (playCard(game, game.player, card)) {
          if (card.kind === 'minion') sfx.play();
          else if (card.heal) sfx.heal();
          else sfx.hit();
          if (game.resonance && game.resonance !== lastResonance) {
            lastResonance = game.resonance;
            sfx.resonance();
          }
          selectedHand = -1;
        }
        if (game.phase === 'over') endGame();
        return;
      }
    }
    // Own board minion: arm it (or stand it down).
    for (let i = 0; i < game.player.board.length; i += 1) {
      const m = game.player.board[i];
      const r = renderer.boardCardRect('player', i, game.player.board.length);
      if (pointIn(r, x, y)) {
        armed = armed === m ? null : (m.canAttack ? m : null);
        return;
      }
    }
    // Armed minion + a target: strike.
    if (armed) {
      for (let i = 0; i < game.enemy.board.length; i += 1) {
        const m = game.enemy.board[i];
        const r = renderer.boardCardRect('enemy', i, game.enemy.board.length);
        if (pointIn(r, x, y)) {
          if (attack(game, game.player, armed, m)) sfx.hit();
          armed = null;
          if (game.phase === 'over') endGame();
          return;
        }
      }
      const hero = renderer.heroRect('enemy');
      if (pointIn(hero, x, y)) {
        if (attack(game, game.player, armed, game.enemy)) sfx.hit();
        armed = null;
        if (game.phase === 'over') endGame();
      }
    }
  }

  function handleKeys() {
    for (const code of input.takeKeys()) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
        if (code === 'Enter' || code === 'Space') startGame();
        continue;
      }
      if (code === 'Space') {
        if (game.turnOwner === 'player') {
          armed = null;
          sfx.turn();
          endTurn(game);
        }
        continue;
      }
      const n = Number.parseInt(code.replace('Digit', ''), 10);
      if (Number.isInteger(n) && n >= 1 && n <= game.player.hand.length) {
        const card = game.player.hand[n - 1];
        if (playCard(game, game.player, card)) sfx.play();
        if (game.phase === 'over') endGame();
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    handleKeys();
    for (const click of input.takeClicks()) handleClick(click.x, click.y);
    // Rook's turn: one step every 650 ms so each move reads.
    if (screen === SCREEN_PLAY && game.phase === 'play' && game.turnOwner === 'enemy') {
      aiTimer += 16;
      if (aiTimer >= 650) {
        aiTimer = 0;
        const step = aiStep(game);
        if (step.did === 'play') sfx.play();
        if (step.did === 'attack') sfx.hit();
        if (game.phase === 'over') endGame();
        else if (!aiHasMoves(game)) endTurn(game);
      }
    } else aiTimer = 0;
    // Hover lift for hand cards.
    let hoverHand = -1;
    if (screen === SCREEN_PLAY && game.turnOwner === 'player') {
      for (let i = 0; i < game.player.hand.length; i += 1) {
        const r = renderer.handCardRect(i, game.player.hand.length);
        if (pointIn(r, input.mouse.x, input.mouse.y)) hoverHand = i;
      }
    }
    renderer.draw(game, screen, { armed, hoverHand, selectedHand });
  }

  announce('Ember Pact. Click or press Enter to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
