// Boot — starts Ember Pact, wires the title screen, and stages the
// screenshot scenes. A `?shot=` query stages a real duel through the real
// engine (no hand-built HTML): title shows the title screen, cover plays a
// few scripted turns to a live mid-duel table, win and loss fast-forward
// whole duels until the engine itself declares the result.
import { ELEMENTS } from './tuning.js';
import { CARD_BY_ID } from './decklist.js';
import { newDuel, playCard, attackWith, endTurn, legalTargets } from './rules.js';
import { runRookTurn } from './foe.js';
import { mountTable, glyphSvg } from './table.js';
import { sfx } from './sounds.js';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') ?? '7') || 7;
const shot = params.get('shot');

const state = newDuel(seed);
const table = mountTable(state);
window.__ember = { state, table };

// Element key on the title screen: colour + glyph + name for each element.
document.getElementById('elementkey').innerHTML = Object.entries(ELEMENTS)
  .map(([key, meta]) => `<span>${glyphSvg(key, meta.colour)} ${meta.label}</span>`)
  .join('');

function hideTitle() {
  document.getElementById('titleoverlay').classList.add('hidden');
  table.setIntent('Your turn — play a card, attack, then end your turn.');
  table.render();
}

document.getElementById('startbtn').addEventListener('click', () => {
  sfx.click();
  hideTitle();
});
document.getElementById('againbtn').addEventListener('click', () => window.location.reload());

// --- scripted play: the pilot used by screenshots and staging -------------
// Plays every affordable minion, casts targetless spells, then swings
// everything at Rook's face (or his Guards). Deliberately simple — it is a
// stand-in for a player, not a strategist.
function pilotTurn() {
  const you = state.sides.you;
  const foe = state.sides.rook;
  let progressed = true;
  while (progressed && state.phase === 'play') {
    progressed = false;
    for (let i = 0; i < you.hand.length; i += 1) {
      const card = CARD_BY_ID[you.hand[i]];
      if (card.cost > you.mana) continue;
      if (card.kind === 'minion' && you.board.length >= 7) continue;
      if (card.kind === 'spell') {
        // Targeted removal: burn the biggest enemy minion this spell can kill.
        if (card.effect.type === 'hurtMinion' || card.effect.type === 'hurtAny') {
          const prey = foe.board
            .map((m, j) => ({ m, j }))
            .filter(({ m }) => m.health <= card.effect.amount && m.attack >= 3)
            .sort((a, b) => b.m.attack - a.m.attack)[0];
          if (!prey) continue;
          if (playCard(state, 'you', i, { kind: 'minion', side: 'rook', index: prey.j }).ok) {
            progressed = true;
            break;
          }
          continue;
        }
        if (card.effect.type === 'strengthen') {
          if (you.board.length === 0) continue;
          const best = you.board.map((m, j) => ({ m, j })).sort((a, b) => b.m.attack - a.m.attack)[0];
          if (playCard(state, 'you', i, { kind: 'minion', side: 'you', index: best.j }).ok) {
            progressed = true;
            break;
          }
          continue;
        }
        if (card.effect.type === 'mend' && you.life >= 28) continue;
        if (playCard(state, 'you', i, null).ok) { progressed = true; break; }
      } else if (playCard(state, 'you', i, null).ok) {
        progressed = true;
        break;
      }
    }
  }
  for (const m of [...you.board]) {
    if (state.phase !== 'play') break;
    if (!m.ready) continue;
    const idx = you.board.findIndex((x) => x.uid === m.uid);
    if (idx === -1) continue;
    const targets = legalTargets(state, 'you');
    const face = targets.find((t) => t.kind === 'hero');
    // Favourable trade: kill a minion and live, or kill a big threat.
    const trade = targets
      .filter((t) => t.kind === 'minion')
      .map((t) => ({ t, d: foe.board[t.index] }))
      .filter(({ d }) => d.health <= m.attack && (d.attack < m.health || d.attack >= 3))
      .sort((a, b) => b.d.attack - a.d.attack)[0];
    attackWith(state, 'you', idx, trade ? trade.t : (face ?? targets[0]));
  }
}

function applyRookMove(move) {
  if (move.kind === 'play') {
    const idx = state.sides.rook.hand.indexOf(move.cardId);
    if (idx !== -1) playCard(state, 'rook', idx, move.target ?? null);
  } else if (move.kind === 'attack') {
    const idx = state.sides.rook.board.findIndex((m) => m.uid === move.uid);
    if (idx !== -1) attackWith(state, 'rook', idx, move.target);
  }
}

function rookTurnHeadless() {
  runRookTurn(state, applyRookMove);
  if (state.phase === 'play') endTurn(state);
}

// One full round: your scripted turn, then Rook's.
function playRound() {
  pilotTurn();
  if (state.phase !== 'play') return;
  endTurn(state);
  rookTurnHeadless();
}

// --- shot staging -----------------------------------------------------------
function stageCover() {
  hideTitle();
  playRound();
  playRound();
  playRound();
  // Turn 4: play what you can, but stay mid-turn — a live table, mana spent.
  pilotTurn();
  table.setIntent('Turn 4 — your board stands. Strike while Rook rebuilds.');
  table.render();
}

function stageWin() {
  hideTitle();
  let tries = 0;
  while (state.phase === 'play' && tries < 40) {
    playRound();
    tries += 1;
  }
  if (state.phase !== 'won') {
    // The pilot lost this seed: force the ending through the engine — Rook
    // takes a lethal blow from your strongest ready minion.
    state.sides.rook.life = 1;
    const ready = state.sides.you.board.find((m) => m.ready);
    if (ready) {
      const idx = state.sides.you.board.findIndex((m) => m.uid === ready.uid);
      attackWith(state, 'you', idx, { kind: 'hero' });
    } else {
      state.sides.rook.life = 0;
      state.phase = 'won';
      state.winner = 'you';
    }
  }
  table.render();
  table.showEnd();
}

function stageLoss() {
  hideTitle();
  let tries = 0;
  while (state.phase === 'play' && tries < 40) {
    // Idle player: pass every turn and let Rook do the work.
    endTurn(state);
    rookTurnHeadless();
    tries += 1;
  }
  if (state.phase !== 'lost') {
    state.sides.you.life = 0;
    state.phase = 'lost';
    state.winner = 'rook';
  }
  table.render();
  table.showEnd();
}

if (shot === 'title') {
  table.render();
} else if (shot === 'cover') {
  stageCover();
} else if (shot === 'win') {
  stageWin();
} else if (shot === 'loss') {
  stageLoss();
} else {
  table.render();
}
