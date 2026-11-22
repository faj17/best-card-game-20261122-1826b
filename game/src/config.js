// Ember Pact — every tuning number, colour and layout constant in one
// place. The table is a fixed 1280x720 logical area; the renderer scales
// it to the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

export const PLAYER_HP = 30;
export const ENEMY_HP = 30;
export const HAND_START = 4;
export const HAND_MAX = 7;
export const BOARD_MAX = 5;
export const MANA_MAX = 10;
export const DECK_SIZE = 30;

/** A card costs mana; a minion also brings attack and health to the table. */
export const ELEMENTS = {
  ember: { name: 'Ember', color: '#ff6b4a', dark: '#8f2d18', glyph: 'flame' },
  tide: { name: 'Tide', color: '#4db2ff', dark: '#174a73', glyph: 'drop' },
  gale: { name: 'Gale', color: '#6fd68a', dark: '#1f5c33', glyph: 'leaf' },
  stone: { name: 'Stone', color: '#e8b34b', dark: '#6d4d15', glyph: 'peak' },
};

export const PALETTE = {
  felt: '#1d4d33',
  feltDark: '#143626',
  feltLight: '#276645',
  wood: '#4a2f1d',
  woodLight: '#6b4426',
  gold: '#f2c94c',
  panel: '#101820',
  panelEdge: '#2c3e50',
  text: '#f4efe4',
  muted: '#a8b2a0',
  red: '#ff5a4e',
  mana: '#58c4ff',
  enemy: '#c0392b',
  ally: '#2e86c1',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const CARD_W = 132;
export const CARD_H = 176;

/** Card art is drawn, never loaded: each element has a shape + a colour. */
export const LAYOUT = {
  enemyHandY: 8,
  enemyBoardY: 132,
  playerBoardY: 330,
  playerHandY: 516,
  boardTop: 124,
  boardBottom: 560,
};
