// Word-by-word meanings. Any French sentence shown with frText() gets faintly underlined
// words; tapping one shows its English meaning in a small bubble (like Duolingo's hints).
// The meanings come from content/glossary.json (lowercase word -> short English meaning).
import { h } from './util.js';

let GLOSS = {};
export async function loadGlossary() {
  try {
    const r = await fetch('content/glossary.json', { cache: 'no-cache' });
    if (r.ok) GLOSS = await r.json();
  } catch { /* offline without a cached copy: sentences just show without hints */ }
}

const LETTERS = 'A-Za-zÀ-ÖØ-öø-ÿœŒ';
const WORD = new RegExp(`[${LETTERS}]+(?:[-'’][${LETTERS}]+)*['’]?`, 'g');
const ELISION = /^(jusqu|qu|[cdjlmnst])['’](.+)$/i;

const norm = (w) => w.toLowerCase().replace(/’/g, "'");

function meaning(w) {
  const k = norm(w);
  if (GLOSS[k]) return GLOSS[k];
  if (/^[A-ZÀ-Ö]/.test(w) && w.length > 1 && !GLOSS[k]) return w === w.toUpperCase() ? null : '(a name)';
  return null;
}

// French puts a space before ? ! : ; — make it a non-breaking one so the mark never
// wraps onto a line by itself.
export const frSpacing = (text) => String(text).replace(/ ([?!:;»])/g, ' $1').replace(/« /g, '« ');

let bubble = null;
function closeBubble() { bubble?.remove(); bubble = null; document.querySelectorAll('.gw.on').forEach((x) => x.classList.remove('on')); }
document.addEventListener('pointerdown', (e) => { if (bubble && !e.target.closest?.('.gw, .gloss-pop')) closeBubble(); }, true);
addEventListener('hashchange', closeBubble);
addEventListener('scroll', closeBubble, true);

function showBubble(el, word, text) {
  closeBubble();
  el.classList.add('on');
  bubble = h('div', { class: 'gloss-pop', role: 'tooltip' }, h('b', { lang: 'fr' }, word), h('span', {}, text));
  document.body.append(bubble);
  const r = el.getBoundingClientRect(), b = bubble.getBoundingClientRect();
  const left = Math.min(Math.max(8, r.left + r.width / 2 - b.width / 2), innerWidth - b.width - 8);
  const above = r.top - b.height - 8;
  bubble.style.left = `${left}px`;
  bubble.style.top = `${above > 8 ? above : r.bottom + 8}px`;
  bubble.classList.toggle('below', above <= 8);
}

function wordSpan(piece) {
  const m = meaning(piece);
  if (!m) return document.createTextNode(piece);
  // Tapping a word shows its meaning. The tap still reaches the line or button it sits in,
  // so tapping a word in a sentence also plays that sentence.
  return h('span', { class: 'gw', onclick: (e) => { showBubble(e.currentTarget, piece.replace(/['’]$/, "'"), m); } }, piece);
}

function pieces(word) {
  // Whole word first (grand-mère, aujourd'hui), then split elisions (j'habite) and hyphens (fait-il).
  if (GLOSS[norm(word)]) return [word];
  const el = word.match(ELISION);
  if (el) return [`${el[1]}'`, ...pieces(el[2])];
  if (word.includes('-')) {
    const out = [];
    word.split('-').forEach((p, i) => { if (i) out.push('-'); if (p) out.push(...pieces(p)); });
    return out;
  }
  return [word];
}

export function frText(text, tag = 'span', attrs = {}) {
  const s = frSpacing(text ?? '');
  const out = h(tag, { lang: 'fr', ...attrs });
  let last = 0;
  for (const m of s.matchAll(WORD)) {
    if (m.index > last) out.append(s.slice(last, m.index));
    for (const p of pieces(m[0])) out.append(p === '-' ? '-' : wordSpan(p));
    last = m.index + m[0].length;
  }
  if (last < s.length) out.append(s.slice(last));
  return out;
}
