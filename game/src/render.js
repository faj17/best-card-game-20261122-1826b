// Every pixel of the table: the felt, the heroes, the hands, the cards and
// the title / win / loss screens. Cards are drawn, never loaded: each
// element has a colour AND a shape, so suits read at thumbnail size.
import { CARD_H, CARD_W, ELEMENTS, FIELD, FONT, LAYOUT, MANA_MAX, PALETTE } from './config.js';
import { GUARD_IDS } from './cards.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, size, color, align = 'center', weight = '600') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

/** The element glyph: flame, drop, leaf or peak — drawn, never an emoji. */
export function drawGlyph(ctx, glyph, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  if (glyph === 'flame') {
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.7, -s * 0.2, s * 0.55, s * 0.5, s * 0.2, s * 0.7);
    ctx.bezierCurveTo(s * 0.5, s * 0.4, 0, s * 0.2, -s * 0.25, s * 0.55);
    ctx.bezierCurveTo(-s * 0.6, s * 0.3, -s * 0.55, -s * 0.3, 0, -s);
  } else if (glyph === 'drop') {
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.75, -s * 0.1, s * 0.6, s * 0.7, 0, s * 0.7);
    ctx.bezierCurveTo(-s * 0.6, s * 0.7, -s * 0.75, -s * 0.1, 0, -s);
  } else if (glyph === 'leaf') {
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.9, -s * 0.3, s * 0.7, s * 0.8, 0, s);
    ctx.bezierCurveTo(-s * 0.7, s * 0.8, -s * 0.9, -s * 0.3, 0, -s);
    ctx.moveTo(0, -s * 0.8);
    ctx.lineTo(0, s * 0.9);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = Math.max(1, s * 0.08);
    ctx.stroke();
  } else {
    ctx.moveTo(-s, s * 0.7);
    ctx.lineTo(-s * 0.25, -s * 0.7);
    ctx.lineTo(s * 0.15, -s * 0.1);
    ctx.lineTo(s * 0.55, -s * 0.55);
    ctx.lineTo(s, s * 0.7);
  }
  ctx.fill();
  ctx.restore();
}

export function handCardRect(index, count) {
  const gap = 10;
  const total = count * CARD_W + (count - 1) * gap;
  const x0 = (FIELD.width - total) / 2;
  return { x: x0 + index * (CARD_W + gap), y: LAYOUT.playerHandY, w: CARD_W, h: CARD_H };
}

export function boardCardRect(side, index, count) {
  const gap = 12;
  const total = count * CARD_W + (count - 1) * gap;
  const x0 = (FIELD.width - total) / 2;
  const y = side === 'enemy' ? LAYOUT.enemyBoardY : LAYOUT.playerBoardY;
  return { x: x0 + index * (CARD_W + gap), y, w: CARD_W, h: CARD_H };
}

export function endTurnRect() {
  return { x: 1120, y: 330, w: 140, h: 52 };
}

export function heroRect(side) {
  // Both heroes stack in the left column, clear of the centred boards.
  return side === 'enemy' ? { x: 16, y: 14, w: 230, h: 80 } : { x: 16, y: 102, w: 230, h: 80 };
}

function hitTest(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fitCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = FIELD.width * dpr;
    canvas.height = FIELD.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fitCanvas();

  function drawCardBack(x, y, w, h) {
    rr(ctx, x, y, w, h, 10);
    ctx.fillStyle = '#3a2b1f';
    ctx.fill();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    rr(ctx, x + 8, y + 8, w - 16, h - 16, 6);
    ctx.strokeStyle = 'rgba(242,201,76,0.5)';
    ctx.stroke();
    drawGlyph(ctx, 'flame', x + w / 2, y + h / 2, 22, PALETTE.gold);
  }

  function drawCard(card, x, y, opts = {}) {
    const el = ELEMENTS[card.element];
    const playable = opts.playable ?? false;
    const selected = opts.selected ?? false;
    const ready = opts.ready ?? false;
    const dim = opts.dim ?? false;
    ctx.save();
    if (dim) ctx.globalAlpha = 0.45;
    // Shadow + body.
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    rr(ctx, x + 4, y + 5, CARD_W, CARD_H, 12);
    ctx.fill();
    if (ready) {
      ctx.strokeStyle = '#7dff9e';
      ctx.lineWidth = 4;
      rr(ctx, x - 3, y - 3, CARD_W + 6, CARD_H + 6, 14);
      ctx.stroke();
    }
    if (selected) {
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 4;
      rr(ctx, x - 4, y - 4, CARD_W + 8, CARD_H + 8, 14);
      ctx.stroke();
    }
    rr(ctx, x, y, CARD_W, CARD_H, 12);
    ctx.fillStyle = '#f7f2e6';
    ctx.fill();
    ctx.strokeStyle = playable ? PALETTE.gold : el.color;
    ctx.lineWidth = playable ? 3 : 2;
    ctx.stroke();
    // Element band with glyph + name.
    rr(ctx, x, y, CARD_W, 52, 12);
    ctx.fillStyle = el.color;
    ctx.fill();
    ctx.fillRect(x, y + 40, CARD_W, 12);
    drawGlyph(ctx, el.glyph, x + 24, y + 27, 12, '#fff');
    // Name starts right of the glyph, sized to fit the band.
    const nameSize = card.name.length > 10 ? 11 : 13;
    text(ctx, card.name.toUpperCase(), x + 42, y + 27, nameSize, '#fff', 'left', '800');
    // Art panel: big glyph on the element colour.
    rr(ctx, x + 12, y + 58, CARD_W - 24, 78, 8);
    ctx.fillStyle = el.dark;
    ctx.fill();
    drawGlyph(ctx, el.glyph, x + CARD_W / 2, y + 97, 26, el.color);
    // Mana cost gem, drawn after the art panel so it sits on top.
    ctx.beginPath();
    ctx.arc(x + 20, y + 66, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#2f7fc1';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, String(card.cost), x + 20, y + 67, 18, '#fff', 'center', '800');
    // Rules text: one short line under the art panel.
    ctx.fillStyle = '#3a3128';
    ctx.font = `500 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    wrapText(card.text, x + CARD_W / 2, y + 150, CARD_W - 20, 14);
    if (card.kind === 'minion') {
      // Attack / health pips.
      ctx.beginPath();
      ctx.arc(x + 26, y + CARD_H - 14, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#c0392b';
      ctx.fill();
      text(ctx, String(card.attack), x + 26, y + CARD_H - 13, 15, '#fff', 'center', '800');
      ctx.beginPath();
      ctx.arc(x + CARD_W - 26, y + CARD_H - 14, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#2e7d32';
      ctx.fill();
      text(ctx, String(card.health), x + CARD_W - 26, y + CARD_H - 13, 15, '#fff', 'center', '800');
      if (GUARD_IDS.has(card.defId)) {
        text(ctx, 'GUARD', x + CARD_W / 2, y + CARD_H - 14, 11, '#6d4d15', 'center', '800');
      }
    } else {
      const label = card.damage ? `DEAL ${card.damage}` : card.heal ? `HEAL ${card.heal}` : `DRAW ${card.draw}`;
      text(ctx, label, x + CARD_W / 2, y + CARD_H - 14, 13, '#2f7fc1', 'center', '800');
    }
    ctx.restore();
  }

  function wrapText(str, x, y, maxW, lineH) {
    const words = str.split(' ');
    let line = '';
    let ly = y - 6;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, ly);
        line = word;
        ly += lineH;
      } else line = test;
    }
    ctx.fillText(line, x, ly);
  }

  function drawHero(side, game) {
    const s = side === 'enemy' ? game.enemy : game.player;
    const r = heroRect(side);
    const isEnemy = side === 'enemy';
    rr(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    ctx.strokeStyle = isEnemy ? '#e74c3c' : '#4db2ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Portrait: Rook's mask vs the player's ember sigil.
    ctx.beginPath();
    ctx.arc(r.x + 32, r.y + 30, 22, 0, Math.PI * 2);
    ctx.fillStyle = isEnemy ? '#3d1a1a' : '#12344d';
    ctx.fill();
    ctx.strokeStyle = isEnemy ? '#e74c3c' : '#4db2ff';
    ctx.stroke();
    if (isEnemy) {
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.moveTo(r.x + 22, r.y + 24);
      ctx.lineTo(r.x + 32, r.y + 38);
      ctx.lineTo(r.x + 42, r.y + 24);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(r.x + 22, r.y + 40, 20, 3);
    } else drawGlyph(ctx, 'flame', r.x + 32, r.y + 30, 13, '#ff8a5c');
    text(ctx, isEnemy ? 'ROOK' : 'YOU', r.x + 62, r.y + 18, 16, PALETTE.text, 'left', '800');
    text(ctx, isEnemy ? 'The Ashen Warden' : 'Ember Warden', r.x + 62, r.y + 36, 11, PALETTE.muted, 'left');
    // Life bar: 30 pips as a bar with a number — always readable.
    const barX = r.x + 62;
    const barY = r.y + 50;
    const barW = 150;
    rr(ctx, barX, barY, barW, 16, 8);
    ctx.fillStyle = '#3a0d0d';
    ctx.fill();
    rr(ctx, barX, barY, Math.max(0, (s.hp / s.maxHp) * barW), 16, 8);
    ctx.fillStyle = s.hp <= 10 ? '#ff5a4e' : '#58c96b';
    ctx.fill();
    text(ctx, `${Math.max(0, s.hp)} / ${s.maxHp} LIFE`, barX + barW / 2, barY + 9, 12, '#fff', 'center', '800');
    text(ctx, isEnemy ? `Hand ${s.hand.length}  •  Deck ${s.deck.length}` : `Deck ${s.deck.length}  •  Turn ${game.turn}`, r.x + 14, r.y + 72, 11, PALETTE.muted, 'left');
  }

  function drawMana(game) {
    // Bottom-left strip, below the hand (hand cards end at y=674).
    const x0 = 16;
    const y = 706;
    text(ctx, 'MANA', x0, y, 12, PALETTE.mana, 'left', '800');
    for (let i = 0; i < MANA_MAX; i += 1) {
      ctx.beginPath();
      ctx.arc(x0 + 56 + i * 22, y, 9, 0, Math.PI * 2);
      ctx.fillStyle = i < game.player.mana ? '#58c4ff' : 'rgba(88,196,255,0.18)';
      ctx.fill();
      ctx.strokeStyle = '#9fdcff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    text(ctx, `${game.player.mana}/${game.player.manaCap}`, x0 + 56 + MANA_MAX * 22 + 8, y, 15, PALETTE.text, 'left', '800');
  }

  function drawTable(game, ui) {
    // Felt + wood rim.
    ctx.fillStyle = PALETTE.wood;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    rr(ctx, 10, 10, FIELD.width - 20, FIELD.height - 20, 28);
    ctx.fillStyle = PALETTE.felt;
    ctx.fill();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 3;
    rr(ctx, 10, 10, FIELD.width - 20, FIELD.height - 20, 28);
    ctx.stroke();
    // Centre line between the boards.
    ctx.strokeStyle = 'rgba(242,201,76,0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(260, 319);
    ctx.lineTo(1260, 319);
    ctx.stroke();
    ctx.setLineDash([]);
    drawHero('enemy', game);
    drawHero('player', game);
    // Enemy hand: card backs, fanned.
    const backs = game.enemy.hand.length;
    for (let i = 0; i < backs; i += 1) {
      drawCardBack(560 + i * 34, 18, 52, 72);
    }
    // Boards.
    game.enemy.board.forEach((m, i) => {
      const r = boardCardRect('enemy', i, game.enemy.board.length);
      drawCard(m, r.x, r.y, { ready: false });
    });
    game.player.board.forEach((m, i) => {
      const r = boardCardRect('player', i, game.player.board.length);
      const ready = game.turnOwner === 'player' && m.canAttack && game.phase === 'play';
      drawCard(m, r.x, r.y, { ready, selected: ui.armed === m });
    });
    // Player hand.
    game.player.hand.forEach((c, i) => {
      const r = handCardRect(i, game.player.hand.length);
      const playable = game.turnOwner === 'player' && c.cost <= game.player.mana && game.phase === 'play';
      const lift = ui.hoverHand === i ? -14 : playable ? -6 : 0;
      drawCard(c, r.x, r.y + lift, { playable, selected: ui.selectedHand === i });
    });
    // End Turn button.
    const b = endTurnRect();
    const myTurn = game.turnOwner === 'player' && game.phase === 'play';
    rr(ctx, b.x, b.y, b.w, b.h, 10);
    ctx.fillStyle = myTurn ? PALETTE.gold : '#5a5346';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, myTurn ? 'END TURN' : 'ROOK…', b.x + b.w / 2, b.y + b.h / 2 + 1, 16, myTurn ? '#231a08' : '#ddd', 'center', '800');
    text(ctx, 'Space', b.x + b.w / 2, b.y + b.h - 12, 10, myTurn ? '#5a4a1a' : '#999', 'center');
    // Resonance banner: top-centre strip, clear of the boards.
    if (game.resonance) {
      const el = ELEMENTS[game.resonance.element];
      rr(ctx, 440, 96, 400, 34, 17);
      ctx.fillStyle = el.color;
      ctx.fill();
      drawGlyph(ctx, el.glyph, 470, 113, 11, '#fff');
      text(ctx, `${el.name.toUpperCase()} RESONANCE!  +1 ATTACK`, 650, 114, 16, '#fff', 'center', '800');
    }
    // AI intent line: what Rook is about to do, so it can be countered.
    // Only while the duel is live — the win/loss screen has its own text.
    if (game.aiPlan && game.turnOwner === 'enemy' && game.phase === 'play') {
      text(ctx, game.aiPlan.kind === 'play'
        ? `Rook plays ${game.aiPlan.card}…`
        : `Rook attacks with ${game.aiPlan.card} → ${game.aiPlan.target}`,
      640, 316, 15, '#ffd9d0', 'center', '600');
    }
    // Log + score, in the free left column below the heroes.
    ctx.textAlign = 'left';
    game.log.slice(-2).forEach((line, i) => {
      text(ctx, line, 16, 210 + i * 18, 12, PALETTE.muted, 'left');
    });
    text(ctx, `Damage dealt ${game.stats.damageDealt}   •   Cards played ${game.stats.cardsPlayed}   •   Resonance ${game.stats.resonance}`,
      16, 250, 12, PALETTE.muted, 'left');
    drawMana(game);
    // Hint when a minion is armed.
    if (ui.armed) {
      text(ctx, 'Choose a target: an enemy minion, or Rook himself — click your minion again to stand down.',
        640, 316, 13, PALETTE.gold, 'center', '600');
    }
  }

  function drawTitle(game) {
    ctx.fillStyle = '#0e1a14';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Ember glow.
    const g = ctx.createRadialGradient(640, 300, 40, 640, 300, 520);
    g.addColorStop(0, 'rgba(255,107,74,0.35)');
    g.addColorStop(1, 'rgba(14,26,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    drawGlyph(ctx, 'flame', 640, 150, 54, '#ff6b4a');
    text(ctx, 'EMBER PACT', 640, 250, 84, PALETTE.gold, 'center', '900');
    text(ctx, 'A duel of elemental cards against Rook, the Ashen Warden', 640, 310, 20, PALETTE.text, 'center');
    text(ctx, 'Play minions, chain two cards of one element for Resonance (+1 attack),', 640, 352, 16, PALETTE.muted, 'center');
    text(ctx, 'and bring Rook from 30 life to 0. Beware his Guards — they must be faced first.', 640, 376, 16, PALETTE.muted, 'center');
    // Element legend.
    Object.values(ELEMENTS).forEach((el, i) => {
      const x = 400 + i * 160;
      drawGlyph(ctx, el.glyph, x, 440, 20, el.color);
      text(ctx, el.name.toUpperCase(), x, 478, 15, el.color, 'center', '800');
    });
    rr(ctx, 490, 520, 300, 56, 12);
    ctx.fillStyle = PALETTE.gold;
    ctx.fill();
    text(ctx, 'CLICK OR PRESS ENTER', 640, 549, 18, '#231a08', 'center', '800');
    text(ctx, 'Mouse to play • Keys 1-7 select a card • Space ends the turn', 640, 610, 13, PALETTE.muted, 'center');
    text(ctx, 'An original game — its own cards, art, sounds and names.', 640, 640, 12, PALETTE.muted, 'center');
  }

  function drawOver(game) {
    drawTable(game, { armed: null, hoverHand: -1, selectedHand: -1 });
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const won = game.winner === 'player';
    const draw = game.winner === 'draw';
    text(ctx, draw ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT', 640, 260, 88, won ? PALETTE.gold : draw ? '#ddd' : '#ff5a4e', 'center', '900');
    text(ctx, draw ? 'Both wardens fall together.'
      : won ? 'Rook falls. The pact is yours — the embers bow to you.'
      : 'Rook claims the pact. The embers dim… for now.', 640, 330, 20, PALETTE.text, 'center');
    text(ctx, `Turns ${game.turn}   •   Damage dealt ${game.stats.damageDealt}   •   Cards played ${game.stats.cardsPlayed}   •   Resonance ${game.stats.resonance}`,
      640, 380, 16, PALETTE.muted, 'center');
    text(ctx, 'Click or press Enter to play again', 640, 440, 16, PALETTE.gold, 'center', '600');
  }

  return {
    draw(game, screen, ui) {
      ctx.clearRect(0, 0, FIELD.width, FIELD.height);
      if (screen === SCREEN_TITLE) drawTitle(game);
      else if (screen === SCREEN_OVER) drawOver(game);
      else drawTable(game, ui);
    },
    hitTest,
    handCardRect,
    boardCardRect,
    endTurnRect,
    heroRect,
  };
}
