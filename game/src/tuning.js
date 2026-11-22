// Tuning knobs for Ember Pact — one place for every number the rules use.
// Changing a number here re-balances the whole duel without touching logic.
export const TUNING = {
  START_LIFE: 30,
  START_HAND: 4,
  MAX_HAND: 8,
  MAX_MANA: 10,
  MAX_BOARD: 7,
  FATIGUE_STEP: 1,
  WIN_LIFE: 0,
};

// The four elements. Each one has a colour AND a glyph shape, so a card's
// element is readable by colour and by shape, never by text alone.
export const ELEMENTS = {
  ember: { label: 'Ember', colour: '#e2482a', pale: '#f7c9b8', dark: '#7a1e0d', glyph: 'flame' },
  tide: { label: 'Tide', colour: '#2a7fd4', pale: '#bcdcf7', dark: '#0d3f73', glyph: 'drop' },
  gale: { label: 'Gale', colour: '#3f9e4d', pale: '#c2e8c6', dark: '#14501f', glyph: 'leaf' },
  stone: { label: 'Stone', colour: '#8a7a5f', pale: '#e3dcc9', dark: '#4a3f2c', glyph: 'peak' },
};

export const ELEMENT_ORDER = ['ember', 'tide', 'gale', 'stone'];

// Mana a player has on a given turn number (turns count from 1).
export function manaForTurn(turn) {
  return Math.min(turn, TUNING.MAX_MANA);
}
