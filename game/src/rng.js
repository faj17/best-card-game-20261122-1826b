// Deterministic randomness for Ember Pact. The whole duel — shuffles,
// draws, the Warden's picks — runs off one seeded generator, so a given
// seed always replays the same game. The browser and the node sim share it.

// Mulberry32: small, fast, and good enough for shuffling a 30-card deck.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher–Yates using the supplied generator; returns a new array.
export function shuffleDeck(cards, rng) {
  const out = cards.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// Pick one element of an array at random.
export function pickOne(list, rng) {
  return list[Math.floor(rng() * list.length)];
}
