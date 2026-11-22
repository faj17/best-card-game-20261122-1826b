// The card pool: 20 original designs in four elements. Minions stay on
// the table and fight; spells resolve at once. Every card shows its cost,
// its values and its element by colour AND by shape, never by text alone.
export const CARD_DEFS = [
  // Ember — fast, aggressive, burns.
  { id: 'ember-imp', name: 'Ember Imp', element: 'ember', kind: 'minion', cost: 1, attack: 2, health: 1, text: 'Quick and cruel.' },
  { id: 'cinder-wolf', name: 'Cinder Wolf', element: 'ember', kind: 'minion', cost: 2, attack: 3, health: 2, text: 'Hunts in pairs.' },
  { id: 'flame-dancer', name: 'Flame Dancer', element: 'ember', kind: 'minion', cost: 3, attack: 4, health: 3, text: 'Dances in flame.' },
  { id: 'ash-phoenix', name: 'Ash Phoenix', element: 'ember', kind: 'minion', cost: 5, attack: 6, health: 5, text: 'Falls, then rises.' },
  { id: 'fireball', name: 'Fireball', element: 'ember', kind: 'spell', cost: 2, damage: 3, text: 'Deal 3 damage.' },
  { id: 'wildfire', name: 'Wildfire', element: 'ember', kind: 'spell', cost: 4, damage: 2, text: 'Burns all foes: 2.' },
  // Tide — control, card flow, healing.
  { id: 'tide-sprite', name: 'Tide Sprite', element: 'tide', kind: 'minion', cost: 1, attack: 1, health: 3, text: 'Slippery as rain.' },
  { id: 'reef-guard', name: 'Reef Guard', element: 'tide', kind: 'minion', cost: 2, attack: 2, health: 4, text: 'Guard.' },
  { id: 'deep-serpent', name: 'Deep Serpent', element: 'tide', kind: 'minion', cost: 4, attack: 5, health: 5, text: 'Ancient and deep.' },
  { id: 'tidal-surge', name: 'Tidal Surge', element: 'tide', kind: 'spell', cost: 3, damage: 4, text: 'Deal 4 damage.' },
  { id: 'spring-rain', name: 'Spring Rain', element: 'tide', kind: 'spell', cost: 2, heal: 6, text: 'Restore 6 life.' },
  { id: 'low-tide', name: 'Low Tide', element: 'tide', kind: 'spell', cost: 1, draw: 2, text: 'Draw 2 cards.' },
  // Gale — cheap, wide, draws into combos.
  { id: 'gale-moth', name: 'Gale Moth', element: 'gale', kind: 'minion', cost: 1, attack: 1, health: 2, text: 'Rides every gust.' },
  { id: 'thorn-fox', name: 'Thorn Fox', element: 'gale', kind: 'minion', cost: 2, attack: 3, health: 2, text: 'Quick bite, gone.' },
  { id: 'storm-hawk', name: 'Storm Hawk', element: 'gale', kind: 'minion', cost: 3, attack: 4, health: 4, text: 'Death from above.' },
  { id: 'gust', name: 'Gust', element: 'gale', kind: 'spell', cost: 1, damage: 2, text: 'Deal 2 damage.' },
  { id: 'tailwind', name: 'Tailwind', element: 'gale', kind: 'spell', cost: 2, draw: 2, text: 'Draw 2 cards.' },
  // Stone — tough, guards, slow finishers.
  { id: 'pebble-golem', name: 'Pebble Golem', element: 'stone', kind: 'minion', cost: 2, attack: 2, health: 5, text: 'Guard.' },
  { id: 'granite-bear', name: 'Granite Bear', element: 'stone', kind: 'minion', cost: 4, attack: 5, health: 6, text: 'Stone that walks.' },
  { id: 'quake', name: 'Quake', element: 'stone', kind: 'spell', cost: 3, damage: 3, text: 'Shakes all foes: 3.' },
];

export const GUARD_IDS = new Set(['reef-guard', 'pebble-golem']);

export function defOf(id) {
  return CARD_DEFS.find((c) => c.id === id);
}

/** A 30-card deck: two copies of most designs, one of the heavy finishers. */
export function buildDeck(rng) {
  const deck = [];
  for (const def of CARD_DEFS) {
    const copies = def.cost >= 5 ? 1 : 2;
    for (let i = 0; i < copies; i += 1) deck.push(def.id);
  }
  // Shuffle with the seeded random, then keep the first 30 so every
  // element stays represented instead of trimming by definition order.
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck.slice(0, 30);
}

let uid = 1;
/** A live card instance: a definition plus its current attack/health. */
export function makeCard(defId) {
  const def = defOf(defId);
  return {
    uid: uid += 1,
    defId,
    name: def.name,
    element: def.element,
    kind: def.kind,
    cost: def.cost,
    attack: def.attack ?? 0,
    health: def.health ?? 0,
    maxHealth: def.health ?? 0,
    damage: def.damage ?? 0,
    heal: def.heal ?? 0,
    draw: def.draw ?? 0,
    text: def.text,
    canAttack: false,
    justPlayed: false,
  };
}
