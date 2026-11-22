// Synthesised sound for Ember Pact — no audio files, no network.
// Every effect is a few WebAudio oscillators shaped by a gain envelope.
// The context is created on the first user gesture, so browsers allow it.
let ctx = null;
let muted = false;

export function setMuted(value) {
  muted = value;
}

export function isMuted() {
  return muted;
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, seconds, type, volume, when = 0, slideTo = null) {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + when;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + seconds);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + seconds + 0.05);
}

export const sfx = {
  click() { tone(660, 0.06, 'triangle', 0.12); },
  deal() { tone(520, 0.09, 'sine', 0.14, 0, 340); },
  summon() { tone(220, 0.18, 'sawtooth', 0.10, 0, 440); tone(330, 0.14, 'triangle', 0.10, 0.05); },
  spell() { tone(880, 0.22, 'sine', 0.14, 0, 220); tone(1320, 0.16, 'sine', 0.08, 0.06); },
  clash() { tone(160, 0.12, 'square', 0.14, 0, 90); tone(90, 0.16, 'sawtooth', 0.12, 0.02); },
  hurt() { tone(300, 0.14, 'sawtooth', 0.12, 0, 140); },
  heal() { tone(523, 0.16, 'sine', 0.12); tone(784, 0.22, 'sine', 0.10, 0.08); },
  draw() { tone(740, 0.07, 'sine', 0.10); tone(988, 0.07, 'sine', 0.08, 0.05); },
  resonance() { tone(392, 0.12, 'triangle', 0.14); tone(523, 0.12, 'triangle', 0.14, 0.09); tone(659, 0.2, 'triangle', 0.14, 0.18); },
  turn() { tone(440, 0.1, 'triangle', 0.10); tone(587, 0.14, 'triangle', 0.10, 0.08); },
  victory() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.34, 'triangle', 0.16, i * 0.14));
    tone(1319, 0.6, 'sine', 0.12, 0.56);
  },
  defeat() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.08, i * 0.2));
  },
};

// Play the sound that matches an engine event.
export function playEvent(event) {
  switch (event.type) {
    case 'summon': sfx.summon(); break;
    case 'spell': sfx.spell(); break;
    case 'clash': sfx.clash(); break;
    case 'strikeHero':
    case 'hurt': sfx.hurt(); break;
    case 'heal': sfx.heal(); break;
    case 'draw': sfx.draw(); break;
    case 'resonance': sfx.resonance(); break;
    case 'turn': sfx.turn(); break;
    default: break;
  }
}
