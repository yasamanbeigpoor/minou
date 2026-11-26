// Progress for the current learner (Yasaman or Abrisham). It's kept in this browser so the
// app works offline, and saved online (js/sync.js) so it follows each learner to any device.
import { todayKey, daysBetween } from './util.js';
import { review } from './srs.js';
import { LEARNERS, pull, push, merge } from './sync.js';

const LEGACY_KEY = 'minou.v1';           // progress from before there were two learners
const LEARNER_KEY = 'minou.learner';
const TEST = typeof window !== 'undefined' && !!window.__MINOU_TEST__;
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage full or blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

let learner = TEST ? 'test' : (LEARNERS[ls.get(LEARNER_KEY)] ? ls.get(LEARNER_KEY) : null);
const keyFor = (name) => (name === 'test' ? LEGACY_KEY : `minou.v1.${name}`);
let KEY = learner ? keyFor(learner) : null;

const fresh = () => ({
  xp: 0,
  days: {},            // 'YYYY-MM-DD' -> lessons finished that day
  streak: { count: 0, last: null },
  done: {},            // nodeKey -> { best, stars, times }
  cards: {},           // itemId -> FSRS card
  skills: { reading: [0, 0], writing: [0, 0], listening: [0, 0], speaking: [0, 0] },
  weak: {},            // itemId -> { misses, last, label }
  exams: [],           // { date, score, total, bySkill }
  settings: { sound: true, rate: 0.9, voice: '', goal: 60, speakOff: false },
});

let state = load();

function fill(s) {
  const base = fresh();
  return { ...base, ...s, settings: { ...base.settings, ...(s.settings || {}) },
    skills: { ...base.skills, ...(s.skills || {}) } };
}

function load() {
  try {
    const raw = KEY && ls.get(KEY);
    return raw ? fill(JSON.parse(raw)) : fresh();
  } catch {
    return fresh();
  }
}

export function save({ touch = true } = {}) {
  if (!KEY) return;
  if (touch) state.savedAt = Date.now();
  ls.set(KEY, JSON.stringify(state));
  if (touch) schedulePush();
}

// ----- Learners and online saving -----

export const learners = LEARNERS;
export const currentLearner = () => learner;
export const syncState = { status: 'idle', at: null, error: null };   // shown on the Me tab

// Choose who is learning on this device. Progress from before learners existed is given to
// the first learner picked here, once.
export function setLearner(name) {
  if (!LEARNERS[name]) return;
  learner = name;
  KEY = keyFor(name);
  ls.set(LEARNER_KEY, name);
  let raw = ls.get(KEY);
  const legacy = ls.get(LEGACY_KEY);
  if (!raw && legacy) {
    raw = legacy;
    ls.set(KEY, legacy);
    ls.set(`${LEGACY_KEY}.moved-to-${name}`, legacy);
    ls.del(LEGACY_KEY);
  }
  state = load();
  // Progress saved before online saving existed has no timestamp; mark it so it's merged, not replaced.
  if (raw && !state.savedAt) state.savedAt = 1;
  state.settings.name = LEARNERS[name];
  save({ touch: false });
}

let pushTimer = null;
function schedulePush() {
  if (!learner || TEST) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushNow(), 1500);
}

export async function pushNow({ keepalive = false } = {}) {
  if (!learner || TEST || !state.savedAt) return;
  clearTimeout(pushTimer);
  try {
    syncState.status = 'saving';
    await push(learner, state, { keepalive });
    Object.assign(syncState, { status: 'saved', at: Date.now(), error: null });
  } catch (e) {
    Object.assign(syncState, { status: 'offline', error: e.message });
  }
}

// Bring in progress saved from other devices and send back anything new from this one.
// Resolves true when the progress on screen changed.
export async function syncNow() {
  if (!learner || TEST) return false;
  const who = learner;
  try {
    syncState.status = 'loading';
    const remote = await pull(who);
    if (who !== learner) return false;
    const before = JSON.stringify(state);
    const merged = fill(merge(state, remote ? fill(remote) : null));
    merged.settings.name = LEARNERS[who];
    state = merged;
    save({ touch: false });
    const changed = JSON.stringify(state) !== before;
    if (!remote || JSON.stringify(remote) !== JSON.stringify(state)) await push(who, state);
    Object.assign(syncState, { status: 'saved', at: Date.now(), error: null });
    return changed;
  } catch (e) {
    Object.assign(syncState, { status: 'offline', error: e.message });
    return false;
  }
}

if (typeof document !== 'undefined' && !TEST) {
  // Save right away when the app is closed or hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pushTimer) pushNow({ keepalive: true });
  });
  addEventListener('online', () => syncNow());
}

export const get = () => state;

// Record that the learner practised today (drives the streak).
export function markActive() {
  const t = todayKey();
  state.days[t] = (state.days[t] || 0) + 1;
  touchStreak();
  save();
}

function touchStreak() {
  const t = todayKey();
  const { last } = state.streak;
  if (last === t) return;
  state.streak.count = last && daysBetween(last, t) === 1 ? state.streak.count + 1 : 1;
  state.streak.last = t;
}

// Streak shown to the user: broken if the last active day was before yesterday.
export function streakNow() {
  const { last, count } = state.streak;
  if (!last) return 0;
  return daysBetween(last, todayKey()) <= 1 ? count : 0;
}


export function record(itemId, grade, skill, label) {
  state.cards[itemId] = review(state.cards[itemId], grade);
  if (skill && state.skills[skill]) {
    state.skills[skill][1] += 1;
    if (grade > 1) state.skills[skill][0] += 1;
  }
  if (grade === 1) {
    const w = state.weak[itemId] || { misses: 0 };
    state.weak[itemId] = { misses: w.misses + 1, last: Date.now(), label: label || w.label || itemId };
  } else if (state.weak[itemId] && grade >= 3) {
    // Two clean answers in a row clear a weak spot.
    const w = state.weak[itemId];
    w.cleared = (w.cleared || 0) + 1;
    if (w.cleared >= 2) delete state.weak[itemId];
  }
  save();
}

export function finishNode(key, accuracy) {
  const stars = accuracy >= 0.9 ? 3 : accuracy >= 0.7 ? 2 : 1;
  const prev = state.done[key] || { best: 0, stars: 0, times: 0 };
  state.done[key] = { best: Math.max(prev.best, accuracy), stars: Math.max(prev.stars, stars), times: prev.times + 1 };
  save();
  return stars;
}

export const isDone = (key) => !!state.done[key];

export function setSetting(k, v) {
  state.settings[k] = v;
  save();
}

export function addExam(result) {
  state.exams.unshift(result);
  state.exams = state.exams.slice(0, 20);
  save();
}

export function exportJSON() {
  return JSON.stringify(state);
}

export function importJSON(text) {
  const s = JSON.parse(text);
  if (!s || typeof s !== 'object' || !('cards' in s)) throw new Error('This file is not a Minou backup.');
  const settings = state.settings;
  state = fill(merge(state, fill({ ...s, savedAt: s.savedAt || 1 })));
  state.settings = settings;
  save();
}

// Erases this learner's progress here and online. Older copies on other devices are
// ignored from now on, so the erase sticks everywhere.
export async function resetAll() {
  const settings = state.settings;
  state = fresh();
  state.settings = settings;
  state.resetAt = Date.now();
  save();
  await pushNow();
}
