// French number words (standard French: soixante-dix, quatre-vingts).

const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const TENS = { 20: 'vingt', 30: 'trente', 40: 'quarante', 50: 'cinquante', 60: 'soixante' };

function under1000(n) {
  if (n < 20) return UNITS[n];
  if (n < 70) {
    const t = Math.floor(n / 10) * 10, u = n % 10;
    if (!u) return TENS[t];
    return TENS[t] + (u === 1 ? ' et un' : '-' + UNITS[u]);
  }
  if (n < 80) return n === 71 ? 'soixante et onze' : 'soixante-' + UNITS[n - 60];
  if (n < 100) {
    if (n === 80) return 'quatre-vingts';
    return 'quatre-vingt-' + UNITS[n - 80];
  }
  const c = Math.floor(n / 100), r = n % 100;
  const head = c === 1 ? 'cent' : UNITS[c] + (r ? ' cent' : ' cents');
  return r ? head + ' ' + under1000(r) : head;
}

// French number words for any whole number up to the billions, with the textbook's spelling rules:
// "cents" loses its s before another number (deux cent un), "mille" never takes an s,
// "quatre-vingts" loses its s before another number, and million / milliard do take an s.
export function frNumber(n) {
  if (n < 1000) return under1000(n);
  const parts = [];
  const big = [[1e9, 'milliard'], [1e6, 'million']];
  let rest = n;
  for (const [size, word] of big) {
    const k = Math.floor(rest / size);
    if (k) { parts.push(`${under1000(k)} ${word}${k > 1 ? 's' : ''}`); rest %= size; }
  }
  const th = Math.floor(rest / 1000);
  if (th) {
    // In "deux cents mille" the s is dropped too: deux cent mille; quatre-vingt mille.
    const w = th === 1 ? 'mille' : `${under1000(th).replace(/cents$/, 'cent').replace(/vingts$/, 'vingt')} mille`;
    parts.push(w);
    rest %= 1000;
  }
  if (rest) parts.push(under1000(rest));
  return parts.join(' ');
}

// Years before 2000 can also be said in hundreds: 1998 = dix-neuf cent quatre-vingt-dix-huit.
export function frYearHundreds(y) {
  const c = Math.floor(y / 100), r = y % 100;
  return `${under1000(c)} cent${r ? ' ' + under1000(r) : 's'}`;
}

// Written the French way: a period between thousands (1.000.000).
export const frDigits = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Pronunciation notes for the tricky ones.
export const NUMBER_TIPS = {
  5: 'Cinq: say the q, “sank”.',
  6: 'Six alone sounds like “seess”.',
  7: 'Sept: the p is silent, “set”.',
  8: 'Huit: “weet”. No liaison before it: le huit.',
  9: 'Neuf: “nuhf”.',
  10: 'Dix alone sounds like “deess”.',
  21: 'Et un: 21, 31, 41, 51, 61 use “et”.',
  70: 'Soixante-dix = sixty-ten.',
  80: 'Quatre-vingts = four twenties.',
  90: 'Quatre-vingt-dix = four twenties and ten.',
};

export const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// Memory hooks for the first numbers.
export const NUMBER_TRICKS = {
  0: 'Zéro: same as English, just say it the French way.',
  1: 'Un: a unicorn has one (un) horn.',
  2: 'Deux: like “duo”, but stop at “duh”.',
  3: 'Trois: like a trio. Say “trwa”.',
  4: 'Quatre: four quarters (quatre) in a dollar.',
  5: 'Cinq: five ships sank. Say the q: “sank”.',
  6: 'Six and dix rhyme: “seess”, “deess”.',
  7: 'Sept: the p is asleep. Say “set”.',
  8: 'Huit sounds like “wheat”: eight loaves of wheat.',
  9: 'Neuf also means “new”. Nine is the new one.',
  10: 'Dix: ten, like a decade (déc-, dix).',
  11: 'Onze: rhymes with bronze.',
  12: 'Douze: a dozen.',
  15: 'Quinze: quinceañera, the 15th birthday.',
  16: 'Seize: after 16, French starts building: dix-sept = ten-seven.',
  20: 'Vingt: the g and t are silent. Say “van”.',
};
