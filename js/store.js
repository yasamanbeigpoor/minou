// Progress saved in this browser (localStorage), with export/import for moving devices.
import { todayKey, daysBetween } from './util.js';
import { review } from './srs.js';

const KEY = 'minou.v1';

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

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const base = fresh();
    const s = JSON.parse(raw);
    return { ...base, ...s, settings: { ...base.settings, ...(s.settings || {}) },
      skills: { ...base.skills, ...(s.skills || {}) } };
  } catch {
    return fresh();
  }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
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
  localStorage.setItem(KEY, text);
  state = load();
}

export function resetAll() {
  state = fresh();
  save();
}
