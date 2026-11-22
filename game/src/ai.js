// Rook, the Ashen Warden: a readable opponent. It plays its most valuable
// affordable card first, keeps one card back when it can, then attacks with
// its ready minions — biggest threats first, guards before heroes, and it
// never hides what it is about to do: the plan is exposed as `game.aiPlan`
// so the renderer can draw its intent and the player can counter it.
import { attack, canPlay, playCard } from './engine.js';
import { GUARD_IDS } from './cards.js';

/** Value a card by what it does, so the AI prefers plays that matter. */
function valueCard(card) {
  if (card.kind === 'minion') return card.attack * 2 + card.health + (GUARD_IDS.has(card.defId) ? 1 : 0);
  if (card.damage) return card.damage * 2;
  if (card.heal) return 2;
  if (card.draw) return 3;
  return 1;
}

/** One AI step: play one card or make one attack. Returns what it did. */
export function aiStep(game) {
  const side = game.enemy;
  const foe = game.player;
  // Play the best affordable card (cheapest tie-break keeps mana for more).
  let best = null;
  let bestValue = -1;
  for (const card of side.hand) {
    if (!canPlay(game, side, card)) continue;
    const v = valueCard(card) - card.cost * 0.5;
    if (v > bestValue) {
      bestValue = v;
      best = card;
    }
  }
  if (best) {
    game.aiPlan = { kind: 'play', card: best.name };
    playCard(game, side, best);
    return { did: 'play', card: best.name };
  }
  // Attack with the strongest ready minion: guards first, then the weakest
  // enemy minion it can kill, else the hero face.
  const ready = side.board.filter((m) => m.canAttack);
  if (ready.length > 0) {
    ready.sort((a, b) => b.attack - a.attack);
    const attacker = ready[0];
    const guards = foe.board.filter((m) => GUARD_IDS.has(m.defId));
    let target = foe;
    if (guards.length > 0) target = guards[0];
    else {
      const killable = foe.board
        .filter((m) => m.health <= attacker.attack)
        .sort((a, b) => b.attack - a.attack);
      if (killable.length > 0) target = killable[0];
      else if (foe.board.length > 0 && attacker.attack >= 4) {
        target = [...foe.board].sort((a, b) => b.attack - a.attack)[0];
      }
    }
    game.aiPlan = { kind: 'attack', card: attacker.name, target: target === foe ? 'you' : target.name };
    attack(game, side, attacker, target);
    return { did: 'attack', card: attacker.name, target: target === foe ? 'you' : target.name };
  }
  game.aiPlan = null;
  return { did: 'done' };
}

/** Has the AI anything left to do this turn? */
export function aiHasMoves(game) {
  const side = game.enemy;
  if (side.hand.some((c) => canPlay(game, side, c))) return true;
  return side.board.some((m) => m.canAttack);
}
