// French number words, 0–999 (standard French: soixante-dix, quatre-vingts).

const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const TENS = { 20: 'vingt', 30: 'trente', 40: 'quarante', 50: 'cinquante', 60: 'soixante' };

export function frNumber(n) {
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
  return r ? head + ' ' + frNumber(r) : head;
}

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
