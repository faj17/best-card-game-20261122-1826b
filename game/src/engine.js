// The rules, with no drawing in them: turns, mana, draws, playing cards,
// combat, Resonance and the win/loss condition. The renderer and the
// screenshot stager both read this state; the AI drives it through the
// same playCard/attack functions a human click uses.
import {
  BOARD_MAX, ENEMY_HP, HAND_MAX, HAND_START, MANA_MAX, PLAYER_HP,
} from './config.js';
import { GUARD_IDS, buildDeck, makeCard } from './cards.js';

export const PHASE_TITLE = 'title';
export const PHASE_PLAY = 'play';
export const PHASE_OVER = 'over';

export const EVENT_NONE = 0;
export const EVENT_OVER = 1 << 0;
export const EVENT_PLAYED = 1 << 1;

function newSide(hp, deck) {
  return {
    hp, maxHp: hp, mana: 0, manaCap: 0,
    deck, hand: [], board: [], fatigue: 0,
  };
}

export function createGame(rng) {
  const game = {
    rng,
    phase: PHASE_TITLE,
    turn: 0,
    turnOwner: 'player',
    log: [],
    stats: { cardsPlayed: 0, damageDealt: 0, damageTaken: 0, resonance: 0 },
    resonance: null, // { element, turn } while the banner shows
    resonancePlayed: {}, // element -> cards played this turn
    winner: null,
    player: null,
    enemy: null,
    aiThinking: false,
    aiPlan: null,
  };
  resetGame(game);
  return game;
}

export function resetGame(game) {
  game.player = newSide(PLAYER_HP, buildDeck(game.rng));
  game.enemy = newSide(ENEMY_HP, buildDeck(game.rng));
  game.turn = 1;
  game.turnOwner = 'player';
  game.log = ['The pact is sealed. Rook awaits.'];
  game.stats = { cardsPlayed: 0, damageDealt: 0, damageTaken: 0, resonance: 0 };
  game.resonance = null;
  game.resonancePlayed = {};
  game.winner = null;
  game.phase = PHASE_TITLE;
  game.aiThinking = false;
  game.aiPlan = null;
  for (let i = 0; i < HAND_START; i += 1) {
    drawCard(game, game.player);
    drawCard(game, game.enemy);
  }
  startTurn(game, game.player);
}

function drawCard(game, side) {
  if (side.hand.length >= HAND_MAX) return null;
  if (side.deck.length === 0) {
    side.fatigue += 1;
    side.hp -= side.fatigue;
    game.log.push(`${side === game.player ? 'You' : 'Rook'} fade: ${side.fatigue} fatigue.`);
    checkOver(game);
    return null;
  }
  const card = makeCard(side.deck.pop());
  side.hand.push(card);
  return card;
}

function startTurn(game, side) {
  side.manaCap = Math.min(MANA_MAX, side.manaCap + 1);
  side.mana = side.manaCap;
  for (const m of side.board) m.canAttack = true;
  drawCard(game, side);
  game.resonancePlayed = {};
}

/** End the current side's turn and hand over to the other side. */
export function endTurn(game) {
  if (game.phase !== PHASE_PLAY) return;
  if (game.turnOwner === 'player') {
    game.turnOwner = 'enemy';
    game.log.push('Rook takes the turn.');
    startTurn(game, game.enemy);
  } else {
    game.turnOwner = 'player';
    game.turn += 1;
    game.log.push(`Turn ${game.turn} — your move.`);
    startTurn(game, game.player);
  }
}

/** Can this side play this card from its hand right now? */
export function canPlay(game, side, card) {
  if (game.phase !== PHASE_PLAY) return false;
  if ((side === game.player ? 'player' : 'enemy') !== game.turnOwner) return false;
  if (card.cost > side.mana) return false;
  if (card.kind === 'minion' && side.board.length >= BOARD_MAX) return false;
  return true;
}

/** Play a card from a hand. Returns true when it resolved. */
export function playCard(game, side, card) {
  if (!canPlay(game, side, card)) return false;
  const idx = side.hand.indexOf(card);
  if (idx === -1) return false;
  side.hand.splice(idx, 1);
  side.mana -= card.cost;
  const isPlayer = side === game.player;
  game.stats.cardsPlayed += isPlayer ? 1 : 0;

  // Resonance: the second card of an element in one turn empowers every
  // friendly minion of that element with +1 attack for the rest of the game.
  const played = (game.resonancePlayed[card.element] ?? 0) + 1;
  game.resonancePlayed[card.element] = played;
  if (played === 2) {
    for (const m of side.board) if (m.element === card.element) m.attack += 1;
    game.resonance = { element: card.element, turn: game.turn };
    if (isPlayer) game.stats.resonance += 1;
    game.log.push(`${card.element} RESONANCE! +1 attack to all ${card.element} minions.`);
  }

  if (card.kind === 'minion') {
    card.canAttack = false; // summoning sickness: it strikes next turn
    card.justPlayed = true;
    side.board.push(card);
    game.log.push(`${isPlayer ? 'You play' : 'Rook plays'} ${card.name} (${card.attack}/${card.health}).`);
  } else {
    resolveSpell(game, side, card);
  }
  return true;
}

function resolveSpell(game, side, card) {
  const foe = side === game.player ? game.enemy : game.player;
  const isPlayer = side === game.player;
  if (card.damage) {
    if (card.defId === 'wildfire' || card.defId === 'quake') {
      for (const m of [...foe.board]) hurtMinion(game, foe, m, card.damage);
      hurtHero(game, foe, card.damage);
      game.log.push(`${card.name} scorches everything for ${card.damage}.`);
    } else {
      hurtHero(game, foe, card.damage);
      game.log.push(`${card.name} hits ${isPlayer ? 'Rook' : 'you'} for ${card.damage}.`);
    }
  }
  if (card.heal) {
    side.hp = Math.min(side.maxHp, side.hp + card.heal);
    game.log.push(`${isPlayer ? 'You' : 'Rook'} recover ${card.heal} life.`);
  }
  if (card.draw) {
    for (let i = 0; i < card.draw; i += 1) drawCard(game, side);
    game.log.push(`${isPlayer ? 'You' : 'Rook'} draw ${card.draw}.`);
  }
  checkOver(game);
}

function hurtMinion(game, side, minion, amount) {
  minion.health -= amount;
  if (minion.health <= 0) {
    const idx = side.board.indexOf(minion);
    if (idx !== -1) side.board.splice(idx, 1);
    game.log.push(`${minion.name} falls.`);
  }
}

function hurtHero(game, side, amount) {
  side.hp -= amount;
  if (side === game.enemy) game.stats.damageDealt += amount;
  else game.stats.damageTaken += amount;
  checkOver(game);
}

/** Minion attacks: another minion (both trade blows) or the hero face. */
export function attack(game, side, attacker, target) {
  if (game.phase !== PHASE_PLAY) return false;
  if (!attacker.canAttack) return false;
  const foe = side === game.player ? game.enemy : game.player;
  const guards = foe.board.filter((m) => GUARD_IDS.has(m.defId));
  if (target !== foe && guards.length > 0 && !GUARD_IDS.has(target.defId)) return false;
  attacker.canAttack = false;
  if (target === foe) {
    hurtHero(game, foe, attacker.attack);
    game.log.push(`${attacker.name} strikes ${foe === game.enemy ? 'Rook' : 'you'} for ${attacker.attack}.`);
  } else {
    hurtMinion(game, foe, target, attacker.attack);
    hurtMinion(game, side, attacker, target.attack);
    game.log.push(`${attacker.name} trades with ${target.name}.`);
  }
  checkOver(game);
  return true;
}

function checkOver(game) {
  if (game.phase === PHASE_OVER) return;
  if (game.enemy.hp <= 0 && game.player.hp <= 0) {
    game.winner = 'draw';
  } else if (game.enemy.hp <= 0) {
    game.winner = 'player';
  } else if (game.player.hp <= 0) {
    game.winner = 'enemy';
  } else return;
  game.phase = PHASE_OVER;
  game.log.push(game.winner === 'player' ? 'Rook falls. The pact is yours!'
    : game.winner === 'enemy' ? 'Rook claims the pact.' : 'Both fall together.');
}

/** Snapshot the numbers the HUD and the playtest read. */
export function snapshot(game) {
  return {
    phase: game.phase,
    turn: game.turn,
    turnOwner: game.turnOwner,
    playerHp: game.player.hp,
    enemyHp: game.enemy.hp,
    playerMana: game.player.mana,
    playerManaCap: game.player.manaCap,
    playerHand: game.player.hand.length,
    enemyHand: game.enemy.hand.length,
    playerBoard: game.player.board.map((m) => `${m.name} ${m.attack}/${m.health}`),
    enemyBoard: game.enemy.board.map((m) => `${m.name} ${m.attack}/${m.health}`),
    winner: game.winner,
    log: game.log.slice(-3),
  };
}
