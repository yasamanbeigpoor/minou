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

let pending = null;   // resolves the speak() promise that is playing now

export function stopSpeaking() {
  if (current) { current.pause(); current = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (pending) { const done = pending; pending = null; done(); }
}

// "Listen to all": plays a list of lines one after another. Any other sound, or stopAll(),
// ends the run. onEnd is called once when the run finishes or is stopped.
let allRun = 0;
let running = false;
export async function speakAll(texts, onEnd) {
  const my = ++allRun;
  running = true;
  for (const t of texts) {
    if (my !== allRun) break;
    await speak(t, { keepAll: true });
  }
  if (my === allRun) { allRun++; running = false; }
  onEnd?.();
}
// Stops a "Listen to all" run if one is playing; other sounds are left alone.
export function stopAll() {
  if (!running) return;
  running = false;
  allRun++;
  stopSpeaking();
}

export const hasRecording = (text) => !!(index && index[key(text)]);

export async function speak(text, { slow = false, keepAll = false } = {}) {
  if (!keepAll) { allRun++; running = false; }
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
      const done = () => { if (pending === done) pending = null; resolve(); };
      pending = done;
      a.onended = a.onerror = done;
      a.play().catch(done);
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
    const done = () => { if (pending === done) pending = null; resolve(); };
    pending = done;
    u.onend = u.onerror = done;
    speechSynthesis.speak(u);
    setTimeout(done, 600 + text.length * 120);
  });
}

const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
export const sttSupported = () => !!Rec;

// Listen once. Resolves with a list of transcripts (best first), or rejects with a readable message.
// Safari (especially the home-screen app) sometimes never ends a recognition on its own, so:
// interim results are kept and used if the mic stops without a final result, listening stops by
// itself after 7 seconds, stopListening() ends it early, and a stuck mic is given up after a grace period.
let active = null;
export function stopListening() { active?.finish(); }
// Throw away a listen that's in progress (for example when the card changes).
export function cancelListening() { active?.abort(); }

export function listen({ onStart } = {}) {
  return new Promise((resolve, reject) => {
    if (!Rec) return reject(new Error('Speech recognition isn’t available in this browser. Use Chrome or Safari.'));
    if (active) active.abort();
    const r = new Rec();
    r.lang = 'fr-FR';
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 5;
    let settled = false, latest = null, timer = null, grace = null;
    const end = (fn, val) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer); clearTimeout(grace);
      if (active === ctl) active = null;
      try { r.abort(); } catch {}
      fn(val);
    };
    const giveBack = () => latest?.length
      ? end(resolve, latest)
      : end(reject, new Error('Minou didn’t hear anything. Tap the mic and try again, or use the buttons below.'));
    const ctl = {
      // Stop listening and use what was heard so far.
      finish() {
        try { r.stop(); } catch {}
        clearTimeout(grace);
        grace = setTimeout(giveBack, 1500);
      },
      abort() { end(reject, new Error('Stopped.')); },
    };
    active = ctl;
    r.onstart = () => {
      onStart && onStart();
      timer = setTimeout(() => ctl.finish(), 7000);
    };
    r.onresult = (e) => {
      const res = e.results[e.results.length - 1];
      latest = Array.from(res).map((a) => a.transcript).filter(Boolean);
      if (res.isFinal) end(resolve, latest);
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return giveBack();
      const msg = {
        'not-allowed': 'Microphone access is blocked. Allow the mic for this site, then try again.',
        'service-not-allowed': 'Speech recognition is turned off on this device. Use the buttons below instead.',
        'audio-capture': 'No microphone found.',
        network: 'Speech recognition needs an internet connection.',
      }[e.error] || 'Couldn’t catch that. Try again.';
      end(reject, new Error(msg));
    };
    r.onend = () => giveBack();
    try { r.start(); } catch { end(reject, new Error('The mic is busy. Try again in a second.')); }
    // If the mic never even starts, don't leave the card hanging.
    setTimeout(() => { if (!settled && !timer) end(reject, new Error('The mic didn’t start. Use the buttons below instead.')); }, 5000);
  });
}
