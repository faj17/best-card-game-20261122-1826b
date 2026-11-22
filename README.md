# Ember Pact

A duel of elemental cards against Rook, the Ashen Warden — a complete,
original card game for the make.fun best-card-game bounty.

[![make.fun](https://make.fun/badge.svg)](https://make.fun/bounty/best-card-game-20261122-1826)
[![bounty](https://make.fun/bounty/best-card-game-20261122-1826/badge.svg)](https://make.fun/bounty/best-card-game-20261122-1826)

## Play

Open `game/index.html` in a desktop browser (or `node serve.ts` and visit
http://localhost:8080). No network, no build step.

- Both wardens start at 30 life. Mana grows by 1 each turn, up to 10.
- Play minions onto your side of the table, or cast spells. Click a hand
  card to play it (keys 1-7 work too); click one of your ready minions,
  then an enemy minion or Rook himself, to strike. Space ends the turn.
- **Resonance:** play two cards of one element in a single turn and every
  friendly minion of that element gains +1 attack.
- **Guard** minions (Reef Guard, Pebble Golem) must be faced before any
  other target. Minions cannot attack the turn they are played.
- Rook announces each move before he makes it, so his choices can be read
  and countered. Reduce him to 0 life to win.

## Files

- `game/src/config.js` — tuning, elements, palette, layout
- `game/src/cards.js` — the 20-card pool and the 30-card deck
- `game/src/engine.js` — turns, mana, combat, Resonance, win/loss
- `game/src/ai.js` — Rook's readable opponent logic
- `game/src/render.js` — canvas table, cards, HUD, title/win/loss screens
- `game/src/input.js` — mouse + keyboard
- `game/src/audio.js` — synthesised WebAudio sounds, no files
- `game/src/shots.js` — deterministic staged screenshots (?shot=)
- `game/src/main.js` — boot, loop, click handling, Rook's turn pacing
- `main.ts` — hand-in program (copies game/ + screenshots/, writes dossier.json)

## Screenshots

`shots.json` lists the four staged scenes, all real renders of the game's
own code: the mid-duel table (cover), the title screen, the win screen and
the loss screen.

## License

MIT — see `LICENSE`.
