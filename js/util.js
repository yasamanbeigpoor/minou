// Small helpers shared across the app.

export const $ = (sel, root = document) => root.querySelector(sel);

export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function sample(arr, n, exclude = []) {
  return shuffle(arr.filter((x) => !exclude.includes(x))).slice(0, n);
}

// Lowercase, unify apostrophes and ligatures, drop punctuation and extra spaces.
export function clean(s) {
  return String(s)
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[.,!?;:«»"“”…()\-–—]/g, ' ')
    .replace(/\s*'\s*/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

const ARTICLES = /^(le|la|les|l'|un|une|des)\s*/;

// Compare a typed French answer with accepted answers.
// Returns { ok, grade, note } where grade is 3 (clean), 2 (accepted with a slip) or 1 (wrong).
export function checkFrench(input, answers, { needArticle = false } = {}) {
  const typed = clean(input);
  if (!typed) return { ok: false, grade: 1 };
  const list = answers.map(clean);

  if (list.includes(typed)) return { ok: true, grade: 3 };

  const bare = (s) => stripAccents(s);
  for (let i = 0; i < list.length; i++) {
    if (bare(list[i]) === bare(typed)) {
      return { ok: true, grade: 2, note: `Watch the accents: ${answers[i]}` };
    }
  }

  if (needArticle) {
    for (let i = 0; i < list.length; i++) {
      const noArt = list[i].replace(ARTICLES, '');
      if (bare(noArt) === bare(typed)) {
        return { ok: true, grade: 2, note: `Remember the article: ${answers[i]}` };
      }
    }
  }

  for (let i = 0; i < list.length; i++) {
    const target = bare(list[i]);
    const d = levenshtein(bare(typed), target);
    const allowed = target.length >= 12 ? 2 : target.length >= 5 ? 1 : 0;
    if (d > 0 && d <= allowed) {
      return { ok: true, grade: 2, note: `Small typo. It's: ${answers[i]}` };
    }
  }
  return { ok: false, grade: 1 };
}

// Loose similarity for speech recognition results (0..1).
export function similarity(a, b) {
  const x = stripAccents(clean(a)), y = stripAccents(clean(b));
  if (!x || !y) return 0;
  const d = levenshtein(x, y);
  return 1 - d / Math.max(x.length, y.length);
}

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function daysBetween(a, b) {
  const da = new Date(a + 'T00:00:00'), db = new Date(b + 'T00:00:00');
  return Math.round((db - da) / 86400000);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
