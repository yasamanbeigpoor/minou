// Speech: recorded native-French audio for everything in the lessons, and the browser's
// speech recognition for speaking practice.
//
// Every French word and sentence the app can say is recorded ahead of time with a neural
// French voice (tools/build_audio.py writes audio/*.mp3 and audio/index.json). Anything not
// recorded, such as the learner's own name, falls back to the browser's voice, but only when
// the device has a real French voice; otherwise it stays silent rather than mispronounce.
import { get } from './store.js';

const key = (t) => String(t).normalize('NFC').replace(/\s+/g, ' ').trim();

let index = null;
const ready = fetch('audio/index.json', { cache: 'no-cache' })
  .then((r) => (r.ok ? r.json() : {}))
  .then((j) => (index = j))
  .catch(() => (index = {}));

let current = null;
let frVoice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const v = speechSynthesis.getVoices().filter((x) => /^fr/i.test(x.lang));
  frVoice = v.find((x) => /fr[-_]FR/i.test(x.lang)) || v[0] || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

export function stopSpeaking() {
  if (current) { current.pause(); current = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

export const hasRecording = (text) => !!(index && index[key(text)]);

export async function speak(text, { slow = false } = {}) {
  if (!text) return;
  if (!index) await ready;
  stopSpeaking();
  const rate = (get().settings.rate || 0.9) / 0.9;
  const file = index[key(text)];
  if (file) {
    return new Promise((resolve) => {
      const a = new Audio(`audio/${file}`);
      a.playbackRate = slow ? Math.max(0.5, 0.65 * rate) : rate;
      a.preservesPitch = true;
      current = a;
      a.onended = a.onerror = () => resolve();
      a.play().catch(() => resolve());
    });
  }
  return browserVoice(text, slow);
}

function browserVoice(text, slow) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window) || !frVoice) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = frVoice;
    u.lang = frVoice.lang;
    const base = get().settings.rate || 0.9;
    u.rate = slow ? Math.max(0.5, base * 0.6) : base;
    u.onend = u.onerror = () => resolve();
    speechSynthesis.speak(u);
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
