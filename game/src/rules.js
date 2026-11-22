// The rules engine of Ember Pact — pure logic, no DOM, no sound.
// The browser table and the node balance sim both drive the same functions,
// so a duel you can click through is the same duel the sim can replay.
//
// A duel state:
//   { seed, turn, active, phase, winner, log[], sides: { you, rook } }
// A side:
//   { life, mana, manaMax, fatigue, deck[], hand[], board[], played: {element: n}, chimed: {element: bool} }
// A board minion:
//   { uid, cardId, attack, health, maxHealth, guard, ready }
import { TUNING, manaForTurn } from './tuning.js';
import { CARD_BY_ID, buildDeckList } from './decklist.js';
import { makeRng, shuffleDeck } from './rng.js';

let uidCounter = 1;

function freshSide(deckIds) {
  return {
    life: TUNING.START_LIFE,
    mana: 0,
    manaMax: 0,
    fatigue: 0,
    deck: deckIds,
    hand: [],
    board: [],
    played: { ember: 0, tide: 0, gale: 0, stone: 0 },
    chimed: { ember: false, tide: false, gale: false, stone: false },
  };
}

export function newDuel(seed) {
  const rng = makeRng(seed);
  const state = {
    seed,
    rng,
    turn: 1,
    active: 'you',
    phase: 'play',
    winner: null,
    log: [],
    sides: {
      you: freshSide(shuffleDeck(buildDeckList(), rng)),
      rook: freshSide(shuffleDeck(buildDeckList(), rng)),
    },
  };
  drawCards(state, 'you', TUNING.START_HAND);
  drawCards(state, 'rook', TUNING.START_HAND);
  beginTurn(state, 'you');
  return state;
}

export function otherSide(who) {
  return who === 'you' ? 'rook' : 'you';
}

export function sideName(who) {
  return who === 'you' ? 'You' : 'Rook';
}

// --- drawing ----------------------------------------------------------------

export function drawCards(state, who, count) {
  const side = state.sides[who];
  const drawn = [];
  for (let i = 0; i < count; i += 1) {
    if (side.deck.length === 0) {
      side.fatigue += TUNING.FATIGUE_STEP;
      side.life -= side.fatigue;
      state.log.push(`${sideName(who)} takes ${side.fatigue} fatigue damage (empty deck).`);
      continue;
    }
    const id = side.deck.pop();
    if (side.hand.length >= TUNING.MAX_HAND) {
      state.log.push(`${sideName(who)}'s hand is full — ${CARD_BY_ID[id].name} burns away.`);
      continue;
    }
    side.hand.push(id);
    drawn.push(id);
  }
  return drawn;
}

// --- turns ------------------------------------------------------------------

export function beginTurn(state, who) {
  const side = state.sides[who];
  side.manaMax = manaForTurn(state.turn);
  side.mana = side.manaMax;
  side.played = { ember: 0, tide: 0, gale: 0, stone: 0 };
  side.chimed = { ember: false, tide: false, gale: false, stone: false };
  for (const m of side.board) m.ready = true;
  drawCards(state, who, 1);
  state.log.push(`${sideName(who)} begins turn ${state.turn} with ${side.mana} mana.`);
}

export function endTurn(state) {
  if (state.phase !== 'play') return { ok: false, events: [] };
  const next = otherSide(state.active);
  if (next === 'you') state.turn += 1;
  state.active = next;
  beginTurn(state, next);
  settle(state);
  return { ok: true, events: [{ type: 'turn', who: next }] };
}

// --- playing cards ----------------------------------------------------------

function summonMinion(state, who, card) {
  const side = state.sides[who];
  const minion = {
    uid: uidCounter++,
    cardId: card.id,
    attack: card.attack,
    health: card.health,
    maxHealth: card.health,
    guard: !!card.guard,
    ready: false,
  };
  side.board.push(minion);
  return minion;
}

function hurtMinion(state, who, target, amount, events) {
  const foe = state.sides[otherSide(who)];
  const minion = foe.board[target.index];
  if (!minion) return false;
  minion.health -= amount;
  events.push({ type: 'hurt', who: otherSide(who), uid: minion.uid, amount });
  return true;
}

function hurtHero(state, who, amount, events) {
  const foe = state.sides[otherSide(who)];
  foe.life -= amount;
  events.push({ type: 'hurtHero', who: otherSide(who), amount });
}

function resolveSpell(state, who, card, target, events) {
  const side = state.sides[who];
  const foe = state.sides[otherSide(who)];
  const fx = card.effect;
  switch (fx.type) {
    case 'hurtMinion': {
      if (!target || target.kind !== 'minion') return false;
      return hurtMinion(state, who, target, fx.amount, events);
    }
    case 'hurtAny': {
      if (!target) return false;
      if (target.kind === 'hero') { hurtHero(state, who, fx.amount, events); return true; }
      return hurtMinion(state, who, target, fx.amount, events);
    }
    case 'hurtAllEnemyMinions': {
      for (let i = foe.board.length - 1; i >= 0; i -= 1) {
        foe.board[i].health -= fx.amount;
        events.push({ type: 'hurt', who: otherSide(who), uid: foe.board[i].uid, amount: fx.amount });
      }
      return true;
    }
    case 'hurtAllMinions': {
      for (const w of ['you', 'rook']) {
        for (const m of state.sides[w].board) {
          m.health -= fx.amount;
          events.push({ type: 'hurt', who: w, uid: m.uid, amount: fx.amount });
        }
      }
      return true;
    }
    case 'storm': {
      hurtHero(state, who, fx.hero, events);
      for (const m of foe.board) {
        m.health -= fx.minions;
        events.push({ type: 'hurt', who: otherSide(who), uid: m.uid, amount: fx.minions });
      }
      return true;
    }
    case 'mend': {
      side.life = Math.min(TUNING.START_LIFE, side.life + fx.amount);
      events.push({ type: 'heal', who, amount: fx.amount });
      return true;
    }
    case 'draw': {
      drawCards(state, who, fx.amount);
      events.push({ type: 'draw', who, amount: fx.amount });
      return true;
    }
    case 'strengthen': {
      if (!target || target.kind !== 'minion' || target.side !== who) return false;
      const m = side.board[target.index];
      if (!m) return false;
      m.attack += fx.attack;
      m.health += fx.health;
      m.maxHealth += fx.health;
      events.push({ type: 'buff', who, uid: m.uid });
      return true;
    }
    default:
      return false;
  }
}

function resolveOnPlay(state, who, card, minion, events) {
  if (!card.effect) return;
  const foe = state.sides[otherSide(who)];
  if (card.effect.type === 'draw') {
    drawCards(state, who, card.effect.amount);
    events.push({ type: 'draw', who, amount: card.effect.amount });
  } else if (card.effect.type === 'pingAllEnemyMinions') {
    for (const m of foe.board) {
      m.health -= card.effect.amount;
      events.push({ type: 'hurt', who: otherSide(who), uid: m.uid, amount: card.effect.amount });
    }
  }
}

// Resonance: the second card of one element played in a turn wakes that
// element — every friendly minion of it gains +1 attack. Once per element
// per turn.
function checkResonance(state, who, element, events) {
  const side = state.sides[who];
  side.played[element] += 1;
  if (side.played[element] === 2 && !side.chimed[element]) {
    side.chimed[element] = true;
    for (const m of side.board) {
      if (CARD_BY_ID[m.cardId].element === element) m.attack += 1;
    }
    events.push({ type: 'resonance', who, element });
    state.log.push(`${sideName(who)} wakes Resonance — ${element} minions +1 attack!`);
  }
}

export function playCard(state, who, handIndex, target) {
  const side = state.sides[who];
  const events = [];
  if (state.phase !== 'play' || state.active !== who) return { ok: false, events };
  const id = side.hand[handIndex];
  if (id === undefined) return { ok: false, events };
  const card = CARD_BY_ID[id];
  if (card.cost > side.mana) return { ok: false, events };
  if (card.kind === 'minion' && side.board.length >= TUNING.MAX_BOARD) return { ok: false, events };

  // Resolve first; only spend the card and mana on success.
  let minion = null;
  if (card.kind === 'minion') {
    minion = summonMinion(state, who, card);
    events.push({ type: 'summon', who, uid: minion.uid });
    resolveOnPlay(state, who, card, minion, events);
  } else {
    const ok = resolveSpell(state, who, card, target, events);
    if (!ok) {
      // Roll back a summon that never happened (spells summon nothing).
      return { ok: false, events: [] };
    }
    events.push({ type: 'spell', who, cardId: card.id });
  }

  side.hand.splice(handIndex, 1);
  side.mana -= card.cost;
  checkResonance(state, who, card.element, events);
  state.log.push(`${sideName(who)} plays ${card.name}.`);
  settle(state);
  return { ok: true, events, minion };
}

// --- combat -----------------------------------------------------------------

export function legalTargets(state, who) {
  const foe = state.sides[otherSide(who)];
  const guards = foe.board.map((m, i) => ({ m, i })).filter(({ m }) => m.guard);
  const targets = [];
  if (guards.length > 0) {
    for (const { i } of guards) targets.push({ kind: 'minion', side: otherSide(who), index: i });
  } else {
    for (let i = 0; i < foe.board.length; i += 1) {
      targets.push({ kind: 'minion', side: otherSide(who), index: i });
    }
    targets.push({ kind: 'hero' });
  }
  return targets;
}

export function attackWith(state, who, boardIndex, target) {
  const events = [];
  if (state.phase !== 'play' || state.active !== who) return { ok: false, events };
  const side = state.sides[who];
  const foe = state.sides[otherSide(who)];
  const attacker = side.board[boardIndex];
  if (!attacker || !attacker.ready) return { ok: false, events };
  const legal = legalTargets(state, who);
  const match = legal.find((t) => t.kind === target.kind && (t.kind === 'hero' || t.index === target.index));
  if (!match) return { ok: false, events };

  attacker.ready = false;
  if (target.kind === 'hero') {
    foe.life -= attacker.attack;
    events.push({ type: 'strikeHero', who: otherSide(who), amount: attacker.attack, uid: attacker.uid });
    state.log.push(`${CARD_BY_ID[attacker.cardId].name} hits ${sideName(otherSide(who))} for ${attacker.attack}.`);
  } else {
    const defender = foe.board[target.index];
    defender.health -= attacker.attack;
    attacker.health -= defender.attack;
    events.push({ type: 'clash', who: otherSide(who), uid: defender.uid, amount: attacker.attack });
    events.push({ type: 'clash', who, uid: attacker.uid, amount: defender.attack });
    state.log.push(`${CARD_BY_ID[attacker.cardId].name} trades with ${CARD_BY_ID[defender.cardId].name}.`);
  }
  settle(state);
  return { ok: true, events };
}

// --- cleanup ----------------------------------------------------------------

export function settle(state) {
  for (const w of ['you', 'rook']) {
    const side = state.sides[w];
    const before = side.board.length;
    side.board = side.board.filter((m) => m.health > 0);
    if (side.board.length < before) state.log.push(`${sideName(w)} loses a minion.`);
  }
  if (state.phase === 'play') {
    if (state.sides.rook.life <= 0 && state.sides.you.life <= 0) {
      state.phase = 'won';
      state.winner = 'you';
      state.log.push('Both heroes fall — you take the pact.');
    } else if (state.sides.rook.life <= 0) {
      state.phase = 'won';
      state.winner = 'you';
      state.log.push('Rook the Ashen Warden falls. VICTORY!');
    } else if (state.sides.you.life <= 0) {
      state.phase = 'lost';
      state.winner = 'rook';
      state.log.push('Your ember gutters out. DEFEAT.');
    }
  }
}

export function handCardIds(state, who) {
  return state.sides[who].hand.slice();
}

export function affordableHand(state, who) {
  const side = state.sides[who];
  return side.hand.map((id, i) => ({ id, index: i, affordable: CARD_BY_ID[id].cost <= side.mana }));
}
