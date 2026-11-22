// The card pool of Ember Pact: 20 unique cards, five per element.
// Every card is an original name, art glyph and line of text.
// A minion carries attack/health; a spell carries an effect object the
// rules engine knows how to resolve. `guard` minions must be attacked first.
export const CARDS = [
  // ---- Ember: fast, fragile, burns things down ----
  { id: 'cinder-pup', name: 'Cinder Pup', element: 'ember', kind: 'minion', cost: 1, attack: 2, health: 1, text: 'A spark that learned to bite.' },
  { id: 'spark-moth', name: 'Spark Moth', element: 'ember', kind: 'minion', cost: 2, attack: 3, health: 2, text: 'It lands, and the wick catches.' },
  { id: 'flame-lash', name: 'Flame Lash', element: 'ember', kind: 'spell', cost: 2, text: 'Deal 3 damage to a minion.', effect: { type: 'hurtMinion', amount: 3 } },
  { id: 'ash-phoenix', name: 'Ash Phoenix', element: 'ember', kind: 'minion', cost: 5, attack: 5, health: 5, text: 'When played, deal 1 damage to every enemy minion.', effect: { type: 'pingAllEnemyMinions', amount: 1 } },
  { id: 'wildfire', name: 'Wildfire', element: 'ember', kind: 'spell', cost: 4, text: 'Deal 2 damage to every enemy minion.', effect: { type: 'hurtAllEnemyMinions', amount: 2 } },

  // ---- Tide: patient, heals, draws, outlasts ----
  { id: 'mist-carp', name: 'Mist Carp', element: 'tide', kind: 'minion', cost: 1, attack: 1, health: 3, text: 'It swims where the river forgets.' },
  { id: 'coral-bulwark', name: 'Coral Bulwark', element: 'tide', kind: 'minion', cost: 2, attack: 0, health: 5, guard: true, text: 'Guard. The reef does not move.' },
  { id: 'soothing-rain', name: 'Soothing Rain', element: 'tide', kind: 'spell', cost: 2, text: 'Restore 6 life to your hero.', effect: { type: 'mend', amount: 6 } },
  { id: 'tidecaller', name: 'Tidecaller', element: 'tide', kind: 'minion', cost: 3, attack: 2, health: 4, text: 'When played, draw a card.', effect: { type: 'draw', amount: 1 } },
  { id: 'deep-current', name: 'Deep Current', element: 'tide', kind: 'spell', cost: 3, text: 'Deal 3 damage to any target.', effect: { type: 'hurtAny', amount: 3 } },

  // ---- Gale: quick strikes, card flow, wide damage ----
  { id: 'breeze-fox', name: 'Breeze Fox', element: 'gale', kind: 'minion', cost: 2, attack: 3, health: 1, text: 'Gone before the grass bends back.' },
  { id: 'storm-kite', name: 'Storm Kite', element: 'gale', kind: 'minion', cost: 3, attack: 4, health: 2, text: 'It rides the wind it makes.' },
  { id: 'tailwind', name: 'Tailwind', element: 'gale', kind: 'spell', cost: 1, text: 'Draw 2 cards.', effect: { type: 'draw', amount: 2 } },
  { id: 'thorn-vine', name: 'Thorn Vine', element: 'gale', kind: 'minion', cost: 2, attack: 2, health: 3, guard: true, text: 'Guard. Step carefully.' },
  { id: 'cyclone', name: 'Cyclone', element: 'gale', kind: 'spell', cost: 4, text: 'Deal 2 damage to the enemy hero and 1 to each enemy minion.', effect: { type: 'storm', hero: 2, minions: 1 } },

  // ---- Stone: slow, heavy, immovable ----
  { id: 'pebble-golem', name: 'Pebble Golem', element: 'stone', kind: 'minion', cost: 2, attack: 1, health: 4, guard: true, text: 'Guard. Small stones, long patience.' },
  { id: 'granite-brute', name: 'Granite Brute', element: 'stone', kind: 'minion', cost: 4, attack: 4, health: 5, text: 'It does not hurry. It arrives.' },
  { id: 'quake', name: 'Quake', element: 'stone', kind: 'spell', cost: 3, text: 'Deal 2 damage to every minion.', effect: { type: 'hurtAllMinions', amount: 2 } },
  { id: 'mountains-gift', name: "Mountain's Gift", element: 'stone', kind: 'spell', cost: 2, text: 'Give a friendly minion +2 attack and +2 health.', effect: { type: 'strengthen', attack: 2, health: 2 } },
  { id: 'stalwart', name: 'Stalwart', element: 'stone', kind: 'minion', cost: 5, attack: 6, health: 6, text: 'The mountain, standing up.' },
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

// A 30-card deck: every unique card once, plus ten extra copies of the
// cheap workhorses so early turns always have something to play.
export const DECK_RECIPE = [
  ...CARDS.map((c) => [c.id, 1]),
  ['cinder-pup', 1], ['mist-carp', 1], ['breeze-fox', 1], ['pebble-golem', 1],
  ['spark-moth', 1], ['coral-bulwark', 1], ['thorn-vine', 1], ['tailwind', 1],
  ['flame-lash', 1], ['granite-brute', 1],
];

export function buildDeckList() {
  const ids = [];
  for (const [id, count] of DECK_RECIPE) {
    for (let i = 0; i < count; i += 1) ids.push(id);
  }
  return ids;
}
