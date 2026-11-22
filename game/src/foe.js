// Rook the Ashen Warden — the opponent's mind.
// Rook thinks one move at a time: `nextRookMove` looks at the live board and
// returns a single move plus the sentence Rook says before he makes it, so
// his choices can be read and countered. The table shows the sentence, waits
// a beat, then applies the move. The node sim calls the same function in a
// tight loop with no waiting.
import { CARD_BY_ID } from './decklist.js';
import { affordableHand, legalTargets, otherSide } from './rules.js';

function handIndexOf(state, who, cardId) {
  return state.sides[who].hand.indexOf(cardId);
}

function boardIndexOfUid(state, who, uid) {
  return state.sides[who].board.findIndex((m) => m.uid === uid);
}

// Is this spell worth casting right now, and at what target?
function spellPlan(state, card) {
  const you = state.sides.you;
  const rook = state.sides.rook;
  const fx = card.effect;
  switch (fx.type) {
    case 'hurtMinion': {
      // Burn the strongest enemy minion this spell can kill.
      const killable = you.board
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => m.health <= fx.amount)
        .sort((a, b) => b.m.attack - a.m.attack)[0];
      if (killable) return { kind: 'minion', side: 'you', index: killable.i };
      return null;
    }
    case 'hurtAny': {
      const killable = you.board
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => m.health <= fx.amount)
        .sort((a, b) => b.m.attack - a.m.attack)[0];
      if (killable) return { kind: 'minion', side: 'you', index: killable.i };
      if (you.life <= fx.amount) return { kind: 'hero' };
      return null;
    }
    case 'hurtAllEnemyMinions':
      return you.board.length >= 2 ? {} : null;
    case 'hurtAllMinions':
      return you.board.length >= 2 && rook.board.length <= 1 ? {} : null;
    case 'storm':
      return you.board.length >= 1 || you.life <= 6 ? {} : null;
    case 'mend':
      return rook.life <= 20 ? {} : null;
    case 'draw':
      return rook.hand.length <= 4 ? {} : null;
    case 'strengthen': {
      if (rook.board.length === 0) return null;
      const best = rook.board
        .map((m, i) => ({ m, i }))
        .sort((a, b) => b.m.attack - a.m.attack)[0];
      return { kind: 'minion', side: 'rook', index: best.i };
    }
    default:
      return null;
  }
}

function describePlay(card, target) {
  if (card.kind === 'spell') {
    if (target && target.kind === 'minion' && target.side === 'you') return `Rook casts ${card.name} at your minion.`;
    if (target && target.kind === 'hero') return `Rook casts ${card.name} straight at you.`;
    if (target && target.kind === 'minion') return `Rook casts ${card.name} on his own minion.`;
    return `Rook casts ${card.name}.`;
  }
  return `Rook summons ${card.name}.`;
}

// One move. Returns null when Rook has nothing left to do.
export function nextRookMove(state) {
  const rook = state.sides.rook;
  const you = state.sides.you;

  // 1. Play cards: minions first (best attack per mana), then useful spells.
  const affordable = affordableHand(state, 'rook').filter((c) => c.affordable);
  const minions = affordable
    .map((c) => ({ ...c, card: CARD_BY_ID[c.id] }))
    .filter((c) => c.card.kind === 'minion' && rook.board.length < 7)
    .sort((a, b) => b.card.attack / b.card.cost - a.card.attack / a.card.cost);
  if (minions.length > 0) {
    const pick = minions[0];
    return {
      kind: 'play',
      cardId: pick.id,
      target: null,
      describe: describePlay(pick.card, null),
      handIndex: pick.index,
    };
  }
  for (const entry of affordable) {
    const card = CARD_BY_ID[entry.id];
    if (card.kind !== 'spell') continue;
    const target = spellPlan(state, card);
    if (target === null) continue;
    return {
      kind: 'play',
      cardId: entry.id,
      target: target.kind ? target : null,
      describe: describePlay(card, target.kind ? target : null),
      handIndex: entry.index,
    };
  }

  // 2. Attack with every ready minion: guards first, then a kill if it is
  // free, otherwise straight at your face.
  const ready = rook.board.filter((m) => m.ready);
  if (ready.length > 0) {
    const attacker = ready.sort((a, b) => b.attack - a.attack)[0];
    const targets = legalTargets(state, 'rook');
    const guards = targets.filter((t) => t.kind === 'minion');
    let target;
    if (guards.length > 0) {
      const guard = guards
        .map((t) => ({ t, m: you.board[t.index] }))
        .sort((a, b) => b.m.attack - a.m.attack)[0];
      target = guard.t;
    } else {
      const killable = targets
        .filter((t) => t.kind === 'minion' && you.board[t.index].health <= attacker.attack)
        .sort((a, b) => you.board[b.index].attack - you.board[a.index].attack)[0];
      target = killable ?? { kind: 'hero' };
    }
    const targetName = target.kind === 'hero'
      ? 'your hero'
      : CARD_BY_ID[you.board[target.index].cardId].name;
    return {
      kind: 'attack',
      uid: attacker.uid,
      target,
      describe: `Rook's ${CARD_BY_ID[attacker.cardId].name} strikes ${targetName}.`,
      boardIndex: boardIndexOfUid(state, 'rook', attacker.uid),
    };
  }

  return { kind: 'end', describe: 'Rook ends his turn.' };
}

// Headless driver for the balance sim: run Rook's whole turn at once.
export function runRookTurn(state, apply) {
  const intents = [];
  for (let guard = 0; guard < 60; guard += 1) {
    const move = nextRookMove(state);
    if (!move || move.kind === 'end') {
      intents.push('Rook ends his turn.');
      break;
    }
    intents.push(move.describe);
    apply(move);
    if (state.phase !== 'play') break;
  }
  return intents;
}

export { handIndexOf };
