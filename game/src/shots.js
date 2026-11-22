// The screenshot scenes behind ?shot=title|battle|win|loss. Each one plays
// the real rules forward from a fresh game for a fixed script, so the frame
// is what a real game looks like and the same seed always gives the same
// frame. No state is edited by hand: every card is played and every blow
// struck through the engine's own playCard / attack / endTurn.
import { endTurn, playCard, attack } from './engine.js';
import { aiStep } from './ai.js';
import { GUARD_IDS } from './cards.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** The player's autopilot: play affordable cards (Resonance pairs first), then strike. */
function playerPilot(game) {
  let played = true;
  while (played) {
    played = false;
    const hand = [...game.player.hand].sort((a, b) => {
      const ra = (game.resonancePlayed[a.element] ?? 0) > 0 ? 0 : 1;
      const rb = (game.resonancePlayed[b.element] ?? 0) > 0 ? 0 : 1;
      return ra - rb || a.cost - b.cost;
    });
    for (const card of hand) {
      if (playCard(game, game.player, card)) { played = true; break; }
    }
  }
  for (const m of [...game.player.board]) {
    if (!m.canAttack) continue;
    const guards = game.enemy.board.filter((x) => GUARD_IDS.has(x.defId));
    const target = guards.length > 0 ? guards[0]
      : game.enemy.board.length > 0 && m.attack < 4
        ? [...game.enemy.board].sort((a, b) => a.health - b.health)[0]
        : game.enemy;
    attack(game, game.player, m, target);
    if (game.phase === 'over') return;
  }
}

/** The AI's real turn, one step at a time, as the live game runs it. */
function enemyTurn(game) {
  for (let i = 0; i < 30; i += 1) {
    const step = aiStep(game);
    if (step.did === 'done' || game.phase === 'over') break;
  }
}

/** Play full turns until `stop` says enough, or the game ends. */
function playTurns(game, playerFn, maxTurns, stop) {
  for (let t = 0; t < maxTurns && game.phase !== 'over'; t += 1) {
    if (game.turnOwner === 'player') {
      playerFn(game);
      if (game.phase === 'over' || (stop && stop(game))) break;
      endTurn(game);
    } else {
      enemyTurn(game);
      if (game.phase === 'over' || (stop && stop(game))) break;
      endTurn(game);
    }
  }
}

/**
 * Set the named scene and return the game plus the screen to draw over it.
 * `makeGame(seed)` builds a fresh seeded game (injected so shots stay pure).
 */
export function stageShot(name, makeGame) {
  if (name === 'title') {
    const game = makeGame(7);
    return { game, screen: SCREEN_TITLE };
  }
  if (name === 'battle') {
    // Six turns in: both boards populated, hands full, life totals dented.
    const game = makeGame(7);
    game.phase = 'play';
    playTurns(game, playerPilot, 14, (g) => g.turn >= 6 && g.turnOwner === 'player'
      && g.player.board.length >= 1 && g.enemy.board.length >= 1);
    return { game, screen: SCREEN_PLAY };
  }
  if (name === 'win') {
    // Rook plays timidly (one card a turn, never strikes the hero) while the
    // player pilots well: try seeds in order until one ends in victory.
    for (let seed = 1; seed <= 40; seed += 1) {
      const game = makeGame(seed);
      game.phase = 'play';
      const timid = (g) => {
        const c = g.enemy.hand.find((x) => x.cost <= g.enemy.mana && g.enemy.board.length < 5);
        if (c) playCard(g, g.enemy, c);
        for (const m of [...g.enemy.board]) {
          if (m.canAttack && g.player.board.length > 0) attack(g, g.enemy, m, g.player.board[0]);
        }
      };
      for (let t = 0; t < 60 && game.phase !== 'over'; t += 1) {
        if (game.turnOwner === 'player') { playerPilot(game); if (game.phase !== 'over') endTurn(game); }
        else { timid(game); if (game.phase !== 'over') endTurn(game); }
      }
      if (game.winner === 'player') return { game, screen: SCREEN_OVER };
    }
    // Fallback: the best-fought game still shows the table mid-duel.
    const game = makeGame(3);
    game.phase = 'play';
    playTurns(game, playerPilot, 12, null);
    return { game, screen: SCREEN_PLAY };
  }
  // loss: the player never plays a card; Rook's real AI closes the game.
  for (let seed = 1; seed <= 40; seed += 1) {
    const game = makeGame(seed);
    game.phase = 'play';
    playTurns(game, () => {}, 60, null);
    if (game.winner === 'enemy') return { game, screen: SCREEN_OVER };
  }
  const game = makeGame(3);
  game.phase = 'play';
  playTurns(game, () => {}, 12, null);
  return { game, screen: SCREEN_PLAY };
}
