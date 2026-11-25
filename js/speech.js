// Text-to-speech and speech recognition, both built into the browser.
import { get } from './store.js';

let voices = [];
let chosen = null;

function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  voices = speechSynthesis.getVoices().filter((v) => /^fr/i.test(v.lang));
  const pref = get().settings.voice;
  const ranked = (v) =>
    (v.name === pref ? 100 : 0) +
    (/fr[-_]FR/i.test(v.lang) ? 10 : 0) +
    (/google|amélie|amelie|thomas|audrey|marie|natural|neural|premium|enhanced/i.test(v.name) ? 5 : 0) +
    (v.localService ? 1 : 0);
  chosen = voices.slice().sort((a, b) => ranked(b) - ranked(a))[0] || null;
}

if ('speechSynthesis' in window) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}

export const ttsSupported = () => 'speechSynthesis' in window;
export const frenchVoices = () => voices;
export const refreshVoice = loadVoices;

export function speak(text, { slow = false } = {}) {
  return new Promise((resolve) => {
    if (!ttsSupported() || !text) return resolve();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = chosen ? chosen.lang : 'fr-FR';
    if (chosen) u.voice = chosen;
    const base = get().settings.rate || 0.9;
    u.rate = slow ? Math.max(0.5, base * 0.6) : base;
    u.onend = u.onerror = () => resolve();
    speechSynthesis.speak(u);
    // Some browsers never fire onend; don't hang the UI.
    setTimeout(resolve, 600 + text.length * 120);
  });
}

const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
export const sttSupported = () => !!Rec;

// Listen once. Resolves with a list of transcripts (best first), or rejects with a readable message.
export function listen({ onStart } = {}) {
  return new Promise((resolve, reject) => {
    if (!Rec) return reject(new Error('Speech recognition isn’t available in this browser. Use Chrome or Safari.'));
    const r = new Rec();
    r.lang = 'fr-FR';
    r.interimResults = false;
    r.maxAlternatives = 5;
    let done = false;
    r.onstart = () => onStart && onStart();
    r.onresult = (e) => {
      done = true;
      const alts = Array.from(e.results[0]).map((a) => a.transcript);
      resolve(alts);
    };
    r.onerror = (e) => {
      done = true;
      const msg = {
        'not-allowed': 'Microphone access is blocked. Allow the mic for this site, then try again.',
        'no-speech': 'Minou didn’t hear anything. Tap the mic and speak a little louder.',
        'audio-capture': 'No microphone found.',
        network: 'Speech recognition needs an internet connection.',
      }[e.error] || 'Couldn’t catch that. Try again.';
      reject(new Error(msg));
    };
    r.onend = () => { if (!done) reject(new Error('Minou didn’t hear anything. Tap the mic and try again.')); };
    try { r.start(); } catch { reject(new Error('The mic is busy. Try again in a second.')); }
  });
}
