// Pronunciation helpers: an English sound-it-out spelling and a Persian-script reading.
// Each has its own toggle in settings. The app itself stays in English.
import { h } from './util.js';
import { get } from './store.js';

const FA_UNITS = ['زِرو', 'اَن', 'دُ', 'تروا', 'کاتر', 'سَنک', 'سیس', 'سِت', 'ویت', 'نُف', 'دیس',
  'اُنز', 'دوز', 'ترِز', 'کاتُرز', 'کَنز', 'سِز', 'دیسِت', 'دیزویت', 'دیزنُف'];
const FA_TENS = { 20: 'وَن', 30: 'ترانت', 40: 'کارانت', 50: 'سَنکانت', 60: 'سواسانت' };
const EN_UNITS = ['zay-ROH', 'uhn', 'duh', 'TRWAH', 'KAH-truh', 'SANK', 'SEESS', 'SET', 'WEET', 'NUHF', 'DEESS',
  'OHNZ', 'DOOZ', 'TREZ', 'kah-TORZ', 'KANZ', 'SEZ', 'dee-SET', 'dee-ZWEET', 'deez-NUHF'];
const EN_TENS = { 20: 'VAN', 30: 'TRAHNT', 40: 'kah-RAHNT', 50: 'san-KAHNT', 60: 'swah-SAHNT' };

function compose2(n, U, T, et, join) {
  const fa = U === FA_UNITS;
  if (n < 20) return U[n];
  if (n < 70) {
    const t = Math.floor(n / 10) * 10, u = n % 10;
    if (!u) return T[t];
    return T[t] + (u === 1 ? `${et}${U[1]}` : join + U[u]);
  }
  if (n < 80) return T[60] + (n === 71 ? `${et}${U[11]}` : join + U[n - 60]);
  if (n === 80) return fa ? 'کاتر وَن' : 'KAH-truh VAN';
  return (fa ? 'کاتر وَن ' : 'KAH-truh-van-') + U[n - 80];
}

function compose3(n, U, T, et, join) {
  const fa = U === FA_UNITS;
  if (n < 100) return compose2(n, U, T, et, join);
  const c = Math.floor(n / 100), r = n % 100;
  const cent = fa ? 'سان' : 'SAHN';
  const head = c === 1 ? cent : `${compose2(c, U, T, et, join)} ${cent}`;
  return r ? `${head} ${compose2(r, U, T, et, join)}` : head;
}

function compose(n, U, T, et, join) {
  const fa = U === FA_UNITS;
  if (n < 1000) return compose3(n, U, T, et, join);
  const words = fa ? { 1e9: ['میلیار', 'میلیار'], 1e6: ['میلیُن', 'میلیُن'], 1e3: 'میل' } : { 1e9: ['meel-YAR', 'meel-YAR'], 1e6: ['meel-YOHN', 'meel-YOHN'], 1e3: 'MEEL' };
  const parts = [];
  let rest = n;
  for (const size of [1e9, 1e6]) {
    const k = Math.floor(rest / size);
    if (k) { parts.push(`${compose3(k, U, T, et, join)} ${words[size][0]}`); rest %= size; }
  }
  const th = Math.floor(rest / 1000);
  if (th) { parts.push(th === 1 ? words[1e3] : `${compose3(th, U, T, et, join)} ${words[1e3]}`); rest %= 1000; }
  if (rest) parts.push(compose3(rest, U, T, et, join));
  return parts.join(' ');
}

export const faNumber = (n) => compose(n, FA_UNITS, FA_TENS, ' اِ ', '‌');
export const prNumber = (n) => compose(n, EN_UNITS, EN_TENS, ' ay ', '-');

const FA_WORDS = { mon: 'مُن', ma: 'ما', mes: 'مِ', ton: 'تُن', ta: 'تا', tes: 'تِ', son: 'سُن', sa: 'سا', ses: 'سِ',
  notre: 'نُتر', nos: 'نو', votre: 'وُتر', vos: 'وو', leur: 'لُر', leurs: 'لُر', le: 'لُ', la: 'لا', les: 'لِ' };
const PR_WORDS = { mon: 'mohn', ma: 'mah', mes: 'may', ton: 'tohn', ta: 'tah', tes: 'tay', son: 'sohn', sa: 'sah', ses: 'say',
  notre: 'NOH-truh', nos: 'noh', votre: 'VOH-truh', vos: 'voh', leur: 'luhr', leurs: 'luhr', le: 'luh', la: 'lah', les: 'lay' };
export const faWord = (w) => FA_WORDS[String(w).toLowerCase()] || null;
export const prWord = (w) => PR_WORDS[String(w).toLowerCase()] || null;

export const prOn = () => get().settings.pron !== false;
export const faOn = () => !!get().settings.persian;

// Visibility is driven by classes on <html>, so toggling never re-renders a lesson.
export function applyPronClasses() {
  document.documentElement.classList.toggle('no-pr', !prOn());
  document.documentElement.classList.toggle('no-fa', !faOn());
}

// Pronunciation lines under a piece of French (both rendered; CSS hides the ones switched off).
export function pron(pr, fa, cls = '') {
  const kids = [];
  if (pr) kids.push(h('span', { class: 'pr', lang: 'en' }, pr));
  if (fa) kids.push(h('span', { class: 'fa', lang: 'fa', dir: 'rtl' }, fa));
  return kids.length ? h('span', { class: `pron ${cls}` }, ...kids) : null;
}
