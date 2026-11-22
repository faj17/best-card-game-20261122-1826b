// Sounds are synthesised in WebAudio — no audio files, no network. Every
// call is guarded: in a headless browser or before any gesture the context
// may not exist, and the game must play on silently.
let ctx = null;
let muted = false;

function audio() {
  if (muted) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq, dur, type, gain, when = 0) {
  const ac = audio();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ac.currentTime + when);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + when + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(ac.currentTime + when);
    osc.stop(ac.currentTime + when + dur);
  } catch {
    // Sound is garnish; never let it break the game.
  }
}

export const sfx = {
  play: () => tone(520, 0.08, 'triangle', 0.12),
  draw: () => tone(740, 0.06, 'sine', 0.08),
  hit: () => { tone(180, 0.15, 'sawtooth', 0.14); tone(90, 0.2, 'square', 0.08, 0.02); },
  heal: () => { tone(660, 0.12, 'sine', 0.1); tone(880, 0.18, 'sine', 0.1, 0.09); },
  resonance: () => { tone(523, 0.1, 'triangle', 0.12); tone(659, 0.1, 'triangle', 0.12, 0.08); tone(784, 0.22, 'triangle', 0.14, 0.16); },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.14, i * 0.12)); },
  lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sine', 0.12, i * 0.14)); },
  turn: () => tone(440, 0.07, 'sine', 0.08),
  toggleMute: () => { muted = !muted; return muted; },
};
