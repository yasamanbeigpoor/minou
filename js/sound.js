// Little synthesized sound effects (no audio files to download).
import { get } from './store.js';

let ctx;
const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

function tone(freq, start, dur, { type = 'sine', gain = 0.12 } = {}) {
  const c = ac();
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

const on = () => get().settings.sound;

export const sfx = {
  correct() { if (!on()) return; tone(784, 0, 0.12, { type: 'triangle' }); tone(1175, 0.08, 0.22, { type: 'triangle' }); },
  wrong() { if (!on()) return; tone(220, 0, 0.18, { type: 'sawtooth', gain: 0.05 }); tone(196, 0.12, 0.22, { type: 'sawtooth', gain: 0.05 }); },
  tap() { if (!on()) return; tone(660, 0, 0.05, { gain: 0.05 }); },
  done() {
    if (!on()) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.3, { type: 'triangle', gain: 0.1 }));
  },
  meow() {
    if (!on()) return;
    const c = ac(), o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = 'triangle';
    o.frequency.setValueAtTime(700, t);
    o.frequency.linearRampToValueAtTime(1100, t + 0.12);
    o.frequency.linearRampToValueAtTime(600, t + 0.4);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + 0.5);
  },
};
