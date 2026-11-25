// Spaced repetition based on FSRS-4.5 (the scheduler used by Anki).
// Grades: 1 = again (wrong), 2 = hard (right with a slip), 3 = good, 4 = easy.

const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367,
  1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const DAY = 86400000;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const initD = (g) => clamp(W[4] - (g - 3) * W[5], 1, 10);

export function retrievability(card, now = Date.now()) {
  if (!card || !card.reps) return 0;
  const t = Math.max(0, (now - card.last) / DAY);
  return Math.pow(1 + FACTOR * t / card.s, DECAY);
}

export function review(card, grade, now = Date.now()) {
  const c = card ? { ...card } : { reps: 0, lapses: 0 };
  if (!c.reps) {
    c.s = W[grade - 1];
    c.d = initD(grade);
  } else {
    const r = retrievability(c, now);
    let d = c.d - W[6] * (grade - 3);
    d = W[7] * initD(3) + (1 - W[7]) * d;
    c.d = clamp(d, 1, 10);
    if (grade === 1) {
      c.s = W[11] * Math.pow(c.d, -W[12]) * (Math.pow(c.s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
      c.lapses = (c.lapses || 0) + 1;
    } else {
      const hard = grade === 2 ? W[15] : 1;
      const easy = grade === 4 ? W[16] : 1;
      c.s = c.s * (Math.exp(W[8]) * (11 - c.d) * Math.pow(c.s, -W[9]) *
        (Math.exp(W[10] * (1 - r)) - 1) * hard * easy + 1);
    }
  }
  c.s = Math.max(0.1, c.s);
  c.reps += 1;
  c.last = now;
  c.lastGrade = grade;
  // With 90% target retention, the interval in days equals stability.
  // Missed items come back within ten minutes so a review can pick them up the same day.
  c.due = grade === 1 ? now + 10 * 60000 : now + Math.max(0.5, c.s) * DAY;
  return c;
}

// Order items for a review: overdue first, then the ones most likely to be forgotten.
export function prioritize(ids, cards, now = Date.now()) {
  return ids
    .map((id) => {
      const c = cards[id];
      const r = c && c.reps ? retrievability(c, now) : 0.5;
      const overdue = c && c.due && c.due <= now ? 1 : 0;
      const weak = c && c.lastGrade === 1 ? 1 : 0;
      return { id, score: overdue * 2 + weak + (1 - r) + Math.random() * 0.15 };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.id);
}
