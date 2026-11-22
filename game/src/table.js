// The table — DOM rendering and mouse/keyboard input for Ember Pact.
// Rebuilds the visible table from the engine state after every move, so
// what you see is always exactly what the rules say. Clicks go through
// the same engine functions the sim uses; nothing here keeps its own copy
// of life, mana or board.
import { CARD_BY_ID } from './decklist.js';
import { ELEMENTS } from './tuning.js';
import {
  affordableHand, attackWith, endTurn, legalTargets, playCard,
} from './rules.js';
import { nextRookMove } from './foe.js';
import { playEvent, setMuted, isMuted, sfx } from './sounds.js';

// ---- element glyphs: drawn shapes, one per element ----
const GLYPHS = {
  flame: '<path d="M12 2 C14 6 18 8 18 13 A6 6 0 1 1 6 13 C6 10 8 8 9 6 C10 8 11 9 12 9 C12 6 12 4 12 2 Z" fill="COLOR"/>',
  drop: '<path d="M12 2 C12 2 5 11 5 15 A7 7 0 1 0 19 15 C19 11 12 2 12 2 Z" fill="COLOR"/>',
  leaf: '<path d="M20 4 C10 4 4 10 4 18 C4 18 12 20 17 13 C20 9 20 4 20 4 Z M7 17 C9 12 13 8 18 6" stroke="COLOR" stroke-width="1.6" fill="COLOR" fill-opacity="0.35"/>',
  peak: '<path d="M2 20 L9 6 L13 13 L16 8 L22 20 Z" fill="COLOR"/>',
};

export function glyphSvg(element, colour) {
  const kind = ELEMENTS[element].glyph;
  const inner = GLYPHS[kind].replaceAll('COLOR', colour);
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
}

function el(tag, cls, html) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

function spellNeedsTarget(card) {
  if (card.kind !== 'spell' || !card.effect) return false;
  return ['hurtMinion', 'hurtAny', 'strengthen'].includes(card.effect.type);
}

function spellTargets(state, card) {
  const fx = card.effect.type;
  const out = [];
  if (fx === 'hurtMinion' || fx === 'hurtAny') {
    state.sides.rook.board.forEach((_, i) => out.push({ kind: 'minion', side: 'rook', index: i }));
    if (fx === 'hurtAny') out.push({ kind: 'hero' });
  } else if (fx === 'strengthen') {
    state.sides.you.board.forEach((_, i) => out.push({ kind: 'minion', side: 'you', index: i }));
  }
  return out;
}

export function mountTable(state) {
  const root = document.getElementById('table');
  const ui = {
    selectedHand: -1,
    attackerUid: null,
    targeting: null, // { handIndex, targets }
    busy: false,
    lastEvents: [],
  };

  // ----- card element -------------------------------------------------------
  function cardNode(cardId, opts = {}) {
    const card = CARD_BY_ID[cardId];
    const meta = ELEMENTS[card.element];
    const node = el('div', 'card' + (opts.onboard ? ' onboard' : ''));
    node.dataset.cardId = cardId;
    node.innerHTML = `
      <div class="band" style="background:${meta.colour}"></div>
      <div class="cost">${card.cost}</div>
      <div class="glyph">${glyphSvg(card.element, meta.colour)}</div>
      <h3>${card.name}</h3>
      <div class="art">${glyphSvg(card.element, meta.colour)}</div>
      <div class="text">${card.text}</div>
      ${card.guard ? '<div class="guardtag">🛡 GUARD</div>' : ''}
      ${card.kind === 'minion'
        ? `<div class="stats"><span class="atk">${opts.attack ?? card.attack}</span><span class="hp">${opts.health ?? card.health}</span></div>`
        : '<div class="kind">Spell</div>'}
    `;
    return node;
  }

  function minionNode(minion, who) {
    const node = cardNode(minion.cardId, { onboard: true, attack: minion.attack, health: minion.health });
    if (who === 'you' && minion.ready && state.active === 'you' && !ui.busy) node.classList.add('ready');
    if (who === 'you' && !minion.ready) node.classList.add('sick');
    if (ui.attackerUid === minion.uid) node.classList.add('selected');
    node.dataset.uid = minion.uid;
    return node;
  }

  // ----- full render --------------------------------------------------------
  function render() {
    const you = state.sides.you;
    const rook = state.sides.rook;

    document.getElementById('rooklife').textContent = `${Math.max(0, rook.life)} / 30`;
    document.getElementById('rooklifebar').style.width = `${Math.max(0, rook.life) / 30 * 100}%`;
    document.getElementById('yourlife').textContent = `${Math.max(0, you.life)} / 30`;
    document.getElementById('yourlifebar').style.width = `${Math.max(0, you.life) / 30 * 100}%`;

    const crystals = document.getElementById('crystals');
    crystals.innerHTML = '';
    for (let i = 0; i < 10; i += 1) {
      const dot = el('i', i < you.mana ? 'full' : '');
      crystals.appendChild(dot);
    }
    document.getElementById('turninfo').textContent =
      `Turn ${state.turn} · ${state.active === 'you' ? 'Your move' : "Rook's move"} · Deck ${you.deck.length}`;

    // Resonance tracker: how many cards of each element you have played
    // this turn — a second one wakes that element's Resonance.
    const res = document.getElementById('resonance');
    res.innerHTML = '';
    for (const key of Object.keys(ELEMENTS)) {
      const n = you.played[key] ?? 0;
      const awake = you.chimed[key];
      const pip = el('span', 'pip' + (awake ? ' awake' : n > 0 ? ' warm' : ''),
        `${glyphSvg(key, awake ? '#2b1c08' : ELEMENTS[key].colour)}×${n}`);
      pip.title = `${ELEMENTS[key].label}: ${n} played this turn${awake ? ' — Resonance awake!' : ''}`;
      res.appendChild(pip);
    }

    const rookHand = document.getElementById('rookhand');
    rookHand.innerHTML = '<span class="rowlabel">Rook\'s hand</span>';
    for (let i = 0; i < rook.hand.length; i += 1) {
      rookHand.appendChild(el('div', 'cardback', '🔥'));
    }
    rookHand.appendChild(el('span', 'count', `${rook.hand.length} cards`));

    const rookBoard = document.getElementById('rookboard');
    rookBoard.innerHTML = '';
    rookBoard.classList.toggle('empty', rook.board.length === 0);
    for (const m of rook.board) rookBoard.appendChild(minionNode(m, 'rook'));

    const yourBoard = document.getElementById('yourboard');
    yourBoard.innerHTML = '';
    yourBoard.classList.toggle('empty', you.board.length === 0);
    for (const m of you.board) yourBoard.appendChild(minionNode(m, 'you'));

    const hand = document.getElementById('yourhand');
    hand.innerHTML = '<span class="rowlabel">Your hand</span>';
    const afford = affordableHand(state, 'you');
    you.hand.forEach((id, i) => {
      const node = cardNode(id);
      const canPlay = afford[i].affordable && state.active === 'you' && !ui.busy && state.phase === 'play';
      if (canPlay) node.classList.add('playable');
      else if (state.active === 'you') node.classList.add('cant');
      if (ui.selectedHand === i) node.classList.add('selected');
      node.dataset.handIndex = i;
      hand.appendChild(node);
    });

    const last = state.log[state.log.length - 1] ?? '';
    document.getElementById('logline').textContent = last;
    document.getElementById('endturn').disabled = state.active !== 'you' || ui.busy || state.phase !== 'play';
  }

  function banner(text, ms = 1600) {
    const b = document.getElementById('banner');
    b.textContent = text;
    b.classList.add('show');
    setTimeout(() => b.classList.remove('show'), ms);
  }

  function setIntent(text) {
    document.getElementById('intent').textContent = text;
  }

  function showEnd() {
    const overlay = document.getElementById('endoverlay');
    const title = document.getElementById('endtitle');
    const stats = document.getElementById('endstats');
    const won = state.winner === 'you';
    title.textContent = won ? 'VICTORY' : 'DEFEAT';
    title.className = won ? 'win' : 'lose';
    document.getElementById('endsub').textContent = won
      ? 'Rook the Ashen Warden bows — the pact is yours.'
      : 'Your ember gutters out. Rook keeps the pact… this time.';
    stats.innerHTML = `Turns played: <b>${state.turn}</b><br>` +
      `Your life: <b>${Math.max(0, state.sides.you.life)}</b> &nbsp;·&nbsp; Rook's life: <b>${Math.max(0, state.sides.rook.life)}</b><br>` +
      `Cards left in your deck: <b>${state.sides.you.deck.length}</b>`;
    overlay.classList.remove('hidden');
    if (won) sfx.victory(); else sfx.defeat();
  }

  function afterEvents(events) {
    for (const e of events) {
      playEvent(e);
      if (e.type === 'resonance') {
        const name = ELEMENTS[e.element].label;
        banner(`✦ ${name} Resonance! +1 attack ✦`);
      }
    }
    render();
    if (state.phase === 'won' || state.phase === 'lost') {
      setTimeout(showEnd, 700);
    }
  }

  function clearSelection() {
    ui.selectedHand = -1;
    ui.attackerUid = null;
    ui.targeting = null;
  }

  // ----- input ---------------------------------------------------------------
  function onHandClick(node) {
    if (ui.busy || state.active !== 'you' || state.phase !== 'play') return;
    const i = Number(node.dataset.handIndex);
    const card = CARD_BY_ID[state.sides.you.hand[i]];
    if (!card) return;
    if (card.cost > state.sides.you.mana) {
      setIntent(`${card.name} costs ${card.cost} mana — you have ${state.sides.you.mana}.`);
      return;
    }
    clearSelection();
    if (card.kind === 'spell' && spellNeedsTarget(card)) {
      ui.selectedHand = i;
      ui.targeting = { handIndex: i, targets: spellTargets(state, card) };
      setIntent(`Choose a target for ${card.name} — click a glowing card or hero.`);
      sfx.click();
      render();
      return;
    }
    const result = playCard(state, 'you', i, null);
    if (result.ok) {
      sfx.click();
      afterEvents(result.events);
      setIntent(`You played ${card.name}.`);
    }
  }

  function onBoardClick(node, who) {
    if (ui.busy || state.active !== 'you' || state.phase !== 'play') return;
    const uid = Number(node.dataset.uid);

    // Finishing a targeted spell.
    if (ui.targeting) {
      const t = ui.targeting.targets.find((x) => x.kind === 'minion' && x.side === who
        && state.sides[who].board[x.index]?.uid === uid);
      if (t) {
        const i = ui.targeting.handIndex;
        const card = CARD_BY_ID[state.sides.you.hand[i]];
        const result = playCard(state, 'you', i, t);
        clearSelection();
        if (result.ok) afterEvents(result.events);
        setIntent(`You cast ${card.name}.`);
        return;
      }
      clearSelection();
      render();
      return;
    }

    if (who !== 'you') {
      // Attacking an enemy minion with the selected attacker.
      if (ui.attackerUid !== null) {
        const atkIdx = state.sides.you.board.findIndex((m) => m.uid === ui.attackerUid);
        const defIdx = state.sides.rook.board.findIndex((m) => m.uid === uid);
        const result = attackWith(state, 'you', atkIdx, { kind: 'minion', index: defIdx });
        clearSelection();
        if (result.ok) afterEvents(result.events);
        else setIntent('That minion is shielded by a Guard — face the Guard first.');
      }
      return;
    }

    // Selecting one of your own minions to attack with.
    const minion = state.sides.you.board.find((m) => m.uid === uid);
    if (!minion) return;
    if (!minion.ready) {
      setIntent(`${CARD_BY_ID[minion.cardId].name} just arrived — it cannot attack yet (summoning sickness).`);
      return;
    }
    ui.attackerUid = ui.attackerUid === uid ? null : uid;
    if (ui.attackerUid !== null) {
      const targets = legalTargets(state, 'you');
      const names = targets.map((t) => (t.kind === 'hero' ? 'Rook himself' : CARD_BY_ID[state.sides.rook.board[t.index].cardId].name));
      setIntent(`${CARD_BY_ID[minion.cardId].name} is ready — strike ${names.join(' or ')}.`);
    } else {
      setIntent('Choose a card to play, or a minion to attack with.');
    }
    sfx.click();
    render();
  }

  function onHeroClick(who) {
    if (ui.busy || state.active !== 'you' || state.phase !== 'play') return;
    if (ui.targeting) {
      const t = ui.targeting.targets.find((x) => x.kind === 'hero');
      if (t && who === 'rook') {
        const i = ui.targeting.handIndex;
        const card = CARD_BY_ID[state.sides.you.hand[i]];
        const result = playCard(state, 'you', i, { kind: 'hero' });
        clearSelection();
        if (result.ok) afterEvents(result.events);
        setIntent(`You cast ${card.name}.`);
        return;
      }
      clearSelection();
      render();
      return;
    }
    if (who === 'rook' && ui.attackerUid !== null) {
      const atkIdx = state.sides.you.board.findIndex((m) => m.uid === ui.attackerUid);
      const result = attackWith(state, 'you', atkIdx, { kind: 'hero' });
      clearSelection();
      if (result.ok) afterEvents(result.events);
      else setIntent('A Guard stands in the way — face the Guard first.');
    }
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function runRookTurn() {
    ui.busy = true;
    clearSelection();
    render();
    for (let step = 0; step < 60; step += 1) {
      if (state.phase !== 'play') break;
      const move = nextRookMove(state);
      if (!move || move.kind === 'end') {
        setIntent('Rook ends his turn.');
        break;
      }
      setIntent(move.describe);
      await sleep(750);
      if (move.kind === 'play') {
        const idx = state.sides.rook.hand.indexOf(move.cardId);
        if (idx === -1) continue;
        const result = playCard(state, 'rook', idx, move.target ?? null);
        if (result.ok) afterEvents(result.events);
      } else if (move.kind === 'attack') {
        const idx = state.sides.rook.board.findIndex((m) => m.uid === move.uid);
        if (idx === -1) continue;
        const result = attackWith(state, 'rook', idx, move.target);
        if (result.ok) afterEvents(result.events);
      }
      if (state.phase !== 'play') break;
      await sleep(250);
    }
    ui.busy = false;
    if (state.phase === 'play') {
      endTurn(state);
      sfx.turn();
      setIntent('Your turn — play a card, attack, then end your turn.');
      render();
    }
  }

  async function onEndTurn() {
    if (ui.busy || state.active !== 'you' || state.phase !== 'play') return;
    clearSelection();
    setIntent('Rook takes his turn…');
    endTurn(state);
    sfx.turn();
    render();
    await sleep(450);
    await runRookTurn();
  }

  // ----- wiring --------------------------------------------------------------
  document.getElementById('yourhand').addEventListener('click', (e) => {
    const node = e.target.closest('.card');
    if (node) onHandClick(node);
  });
  document.getElementById('yourboard').addEventListener('click', (e) => {
    const node = e.target.closest('.card');
    if (node) onBoardClick(node, 'you');
  });
  document.getElementById('rookboard').addEventListener('click', (e) => {
    const node = e.target.closest('.card');
    if (node) onBoardClick(node, 'rook');
  });
  document.getElementById('rookhero').addEventListener('click', () => onHeroClick('rook'));
  document.getElementById('yourhero').addEventListener('click', () => onHeroClick('you'));
  document.getElementById('endturn').addEventListener('click', onEndTurn);
  document.getElementById('soundbtn').addEventListener('click', (e) => {
    setMuted(!isMuted());
    e.currentTarget.textContent = isMuted() ? '🔇 Sound off' : '🔊 Sound on';
  });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      onEndTurn();
    }
    if (e.key === 'Escape') {
      clearSelection();
      render();
    }
    const n = Number(e.key);
    if (n >= 1 && n <= 9) {
      const node = document.querySelector(`#yourhand .card[data-hand-index="${n - 1}"]`);
      if (node) onHandClick(node);
    }
  });

  return {
    render,
    banner,
    setIntent,
    showEnd,
    afterEvents,
    runRookTurn,
    onEndTurn,
    clearSelection,
    get busy() { return ui.busy; },
  };
}
