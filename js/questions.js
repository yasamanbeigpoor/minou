// Turns content items into questions. Each question carries the skill it trains.
import { DB } from './data.js';
import { shuffle, sample, pick } from './util.js';
import { frNumber, range, NUMBER_TRICKS } from './numbers.js';
import { faNumber, faWord, prNumber, prWord } from './fa.js';

const vocabOf = (mod) => (mod.vocab || []);

// ---------- Vocabulary ----------

function distractors(item, pool, field, n = 3) {
  const same = pool.filter((v) => v.id !== item.id && v[field] !== item[field]);
  const sameGender = same.filter((v) => v.g === item.g);
  const picked = sample(sameGender.length >= n ? sameGender : same, n);
  return picked.map((v) => v[field]);
}

const genderWord = { m: 'masculine', f: 'feminine' };

export function vocabQ(itemId, kind) {
  const it = DB.items[itemId];
  const v = it.data;
  const pool = vocabOf(it.mod);
  const base = { itemId, label: it.label, answerFa: v.fa, answerPr: v.pr, trick: v.trick };
  switch (kind) {
    case 'intro':
      return { ...base, kind: 'intro', fr: v.fr, en: v.en, tip: v.tip, g: v.g, fa: v.fa, pr: v.pr };
    case 'fr-en':
      return { ...base, kind: 'mcq', skill: 'reading', say: 'Que veut dire… ?', sub: 'What does this mean?',
        big: v.fr, bigFa: v.fa, bigPr: v.pr, speakBig: v.fr, options: shuffle([v.en, ...distractors(v, pool, 'en')]), answer: v.en,
        reveal: `${v.fr} = ${v.en}`, speakAnswer: v.fr };
    case 'en-fr':
      return { ...base, kind: 'mcq', skill: 'reading', say: 'Comment dit-on… ?', sub: 'How do you say this in French?',
        big: v.en, options: shuffle([v.fr, ...distractors(v, pool, 'fr')]), answer: v.fr, optionsFr: true,
        reveal: `${v.en} = ${v.fr}`, speakAnswer: v.fr };
    case 'listen-pick':
      return { ...base, kind: 'mcq', skill: 'listening', say: 'Écoute bien !', sub: 'Listen. What does it mean?',
        audio: v.fr, options: shuffle([v.en, ...distractors(v, pool, 'en')]), answer: v.en,
        reveal: `${v.fr} = ${v.en}`, speakAnswer: v.fr };
    case 'listen-type':
      return { ...base, kind: 'type', skill: 'listening', say: 'Écris ce que tu entends.', sub: 'Type what you hear, with the article.',
        audio: v.fr, answers: [v.fr], needArticle: true, reveal: `${v.fr} (${v.en})`, speakAnswer: v.fr };
    case 'write':
      return { ...base, kind: 'type', skill: 'writing', say: 'En français, s’il te plaît !',
        sub: v.noun ? 'Type it in French, with le, la, l’ or les.' : 'Type it in French.',
        big: v.en, answers: [v.fr, ...(v.alts || [])], needArticle: !!v.noun, reveal: v.fr, speakAnswer: v.fr };
    case 'gender': {
      if (v.g !== 'm' && v.g !== 'f') return vocabQ(itemId, 'en-fr');
      const vowel = /^[aeiouyhéèêàâîôû]/i.test(v.noun);
      if (vowel) {
        return { ...base, kind: 'mcq', skill: 'reading', say: 'Masculin ou féminin ?', sub: `L' hides it. Is “${v.noun}” masculine or feminine?`,
          big: v.noun, speakBig: v.fr, options: ['masculine', 'feminine'], answer: genderWord[v.g], keepOrder: true,
          reveal: `${v.noun} is ${genderWord[v.g]}.`,
          explain: v.g === 'm' ? `Masculine: un ${v.noun}, mon ${v.noun}.` : `Feminine: une ${v.noun}. Still mon ${v.noun}, because of the vowel.`,
          speakAnswer: v.fr };
      }
      return { ...base, kind: 'mcq', skill: 'reading', say: 'Le ou la ?', sub: 'Pick the right article.',
        big: v.noun, speakBig: v.noun, options: ['le', 'la'], answer: v.g === 'm' ? 'le' : 'la', keepOrder: true, optionsFr: true,
        reveal: `${v.fr} (${genderWord[v.g]})`, speakAnswer: v.fr };
    }
    case 'speak':
      return { ...base, kind: 'speak', skill: 'speaking', say: 'À toi de parler !', sub: 'Tap the mic and say it in French.',
        fr: v.fr, en: v.en, fa: v.fa, pr: v.pr };
  }
}

export function matchQ(itemIds) {
  const pairs = itemIds.slice(0, 5).map((id) => {
    const v = DB.items[id].data;
    return { id, fr: v.fr, en: v.en };
  });
  return { kind: 'match', skill: 'reading', say: 'Trouve les paires !', sub: 'Tap the matching pairs.', pairs };
}

// ---------- Sentences ----------

function sentenceTiles(s, mod) {
  const words = s.fr.replace(/([.!?])$/, '').split(' ');
  // Distractors: swap a possessive or add a family word that isn't in the sentence.
  const POSS = ['mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'notre', 'nos', 'leur', 'leurs', 'votre', 'vos'];
  const extra = [];
  const lower = words.map((w) => w.toLowerCase());
  const owned = lower.find((w) => POSS.includes(w));
  if (owned) {
    const alt = sample(POSS.filter((p) => p !== owned && p[0] === owned[0]), 1)[0] || pick(POSS.filter((p) => p !== owned));
    extra.push(alt);
  }
  // Distractor words: nouns from the module, or single words from its other sentences.
  let nouns = (mod.vocab || []).map((v) => v.noun).filter((n) => n && !lower.includes(n) && !n.includes('-'));
  if (!nouns.length) {
    nouns = [...new Set((mod.sentences || []).flatMap((x) => x.fr.replace(/[.!?]$/, '').split(' ')))]
      .filter((w) => !lower.includes(w.toLowerCase()) && w.length > 2);
  }
  extra.push(...sample(nouns, owned ? 1 : 2));
  return shuffle([...words, ...extra]);
}

export function sentenceQ(itemId, kind) {
  const it = DB.items[itemId];
  const s = it.data;
  const base = { itemId, label: it.label, answerFa: s.fa, answerPr: s.pr };
  const answers = [s.fr, ...(s.alts || [])];
  switch (kind) {
    case 'bank':
      return { ...base, kind: 'bank', skill: 'writing', say: 'Traduis cette phrase.', sub: 'Build the sentence in French.',
        big: s.en, tiles: sentenceTiles(s, it.mod), answers, reveal: s.fr, speakAnswer: s.fr };
    case 'listen-bank':
      return { ...base, kind: 'bank', skill: 'listening', say: 'Écoute et construis.', sub: 'Tap the words you hear.',
        audio: s.fr, tiles: sentenceTiles(s, it.mod), answers: [s.fr], reveal: `${s.fr} (${s.en})`, speakAnswer: s.fr };
    case 'write-sentence':
      return { ...base, kind: 'type', skill: 'writing', say: 'Écris en français.', sub: 'Type the whole sentence.',
        big: s.en, answers, reveal: s.fr, speakAnswer: s.fr, long: true };
    case 'dictation':
      return { ...base, kind: 'type', skill: 'listening', say: 'Dictée !', sub: 'Type the sentence you hear.',
        audio: s.fr, answers: [s.fr], reveal: `${s.fr} (${s.en})`, speakAnswer: s.fr, long: true };
    case 'listen-mean': {
      const others = sample((it.mod.sentences || []).filter((x) => x.id !== s.id), 2).map((x) => x.en);
      return { ...base, kind: 'mcq', skill: 'listening', say: 'Qu’est-ce que tu entends ?', sub: 'Listen. Pick the meaning.',
        audio: s.fr, options: shuffle([s.en, ...others]), answer: s.en, reveal: `${s.fr} = ${s.en}`, speakAnswer: s.fr };
    }
    case 'speak':
      return { ...base, kind: 'speak', skill: 'speaking', say: 'Lis à voix haute.', sub: 'Tap the mic and read it aloud.',
        fr: s.fr, en: s.en, fa: s.fa, pr: s.pr };
  }
}

// ---------- Grammar: possessive adjectives ----------

const PERSONS = {
  my: { en: 'my', f: ['mon', 'ma', 'mes'] },
  your: { en: 'your (tu)', f: ['ton', 'ta', 'tes'] },
  his: { en: 'his', f: ['son', 'sa', 'ses'] },
  her: { en: 'her', f: ['son', 'sa', 'ses'] },
  our: { en: 'our', f: ['notre', 'notre', 'nos'] },
  yourv: { en: 'your (vous)', f: ['votre', 'votre', 'vos'] },
  their: { en: 'their', f: ['leur', 'leur', 'leurs'] },
};

const isVowel = (w) => /^[aeiouyhéèêàâîôû]/i.test(w);

function nounPool(mod) {
  const g = mod.grammar || {};
  const fromVocab = (mod.vocab || [])
    .filter((v) => v.g !== 'pl')
    .map((v) => ({ noun: v.noun, pl: v.pl, g: v.g === 'mf' ? 'm' : v.g, en: v.en.split(/[;(]/)[0].trim() }));
  return [...fromVocab, ...(g.extraNouns || [])];
}

const OWNERS = [
  { name: 'Marc', p: 'his' }, { name: 'Julie', p: 'her' }, { name: 'Victor', p: 'his' },
  { name: 'Madame Martin', p: 'her' }, { name: 'Sami', p: 'his' }, { name: 'Léa', p: 'her' },
];

function form(personKey, noun, plural) {
  const p = PERSONS[personKey].f;
  if (plural) return p[2];
  if (noun.g === 'f' && !isVowel(noun.noun)) return p[1];
  return p[0];
}

function why(personKey, noun, plural, ownerName) {
  const f = form(personKey, noun, plural);
  const word = plural ? noun.pl : noun.noun;
  if (plural) return `${word} is plural, so ${f}.`;
  if (['our', 'yourv', 'their'].includes(personKey)) return `${word} is singular, so ${f} (no s).`;
  if (noun.g === 'f' && isVowel(noun.noun)) return `${word} is feminine, but it starts with a vowel, so ${f}.`;
  const g = noun.g === 'f' ? 'feminine' : 'masculine';
  if (ownerName) return `It agrees with ${word} (${g}), not with ${ownerName}. So ${f}.`;
  return `${word} is ${g}, so ${f}.`;
}

export function grammarQ(itemId, opts = {}) {
  const it = DB.items[itemId];
  const rule = it.data.rule;
  const pool = nounPool(it.mod);
  const masc = pool.filter((n) => n.g === 'm');
  const femC = pool.filter((n) => n.g === 'f' && !isVowel(n.noun));
  const femV = pool.filter((n) => n.g === 'f' && isVowel(n.noun));
  let person, noun, plural = false, owner = null;
  const basic = ['my', 'your', 'his', 'her'];

  switch (rule) {
    case 'mon': person = pick(basic); noun = pick(masc.filter((n) => !isVowel(n.noun))); break;
    case 'ma': person = pick(basic); noun = pick(femC); break;
    case 'mes': person = pick(basic); noun = pick(pool.filter((n) => n.pl !== n.noun)); plural = true; break;
    case 'vowel': person = pick(basic); noun = pick(femV); break;
    case 'sonsa': {
      owner = pick(OWNERS);
      person = owner.p;
      // Owned thing of the opposite gender to the owner makes the point.
      noun = pick(owner.p === 'his' ? femC : masc.filter((n) => !isVowel(n.noun)));
      break;
    }
    case 'notre': person = pick(['our', 'yourv']); noun = pick(pool); plural = Math.random() < 0.5 && noun.pl !== noun.noun; break;
    case 'leur': person = 'their'; noun = pick(pool); plural = Math.random() < 0.5 && noun.pl !== noun.noun; break;
  }

  const answer = form(person, noun, plural);
  const word = plural ? noun.pl : noun.noun;
  const nounEn = plural ? pluralEn(noun.en) : noun.en;
  const explain = why(person, noun, plural, owner && owner.name);
  const base = { itemId, label: it.label, skill: 'writing', reveal: `${answer} ${word}`, explain, speakAnswer: `${answer} ${word}`,
    trick: (it.mod.grammar.tricks || {})[rule], answerFa: faWord(answer), answerPr: prWord(answer) };

  const asType = opts.type ?? Math.random() < 0.3;
  if (asType && !owner) {
    return { ...base, kind: 'type', say: 'Écris en français.', sub: 'Possessive + noun.',
      big: `${PERSONS[person].en} ${nounEn}`, answers: [`${answer} ${word}`] };
  }
  const options = [...new Set(PERSONS[person].f)];
  const prompt = owner
    ? { big: `${owner.name} → ___ ${word}`, sub: `${owner.name}'s ${nounEn}. Pick the possessive.` }
    : { big: `___ ${word}`, sub: `${PERSONS[person].en} ${nounEn}` };
  return { ...base, kind: 'mcq', skill: 'reading', say: 'Complète !', ...prompt, options, answer, keepOrder: true, optionsFr: true };
}

function pluralEn(en) {
  const irregular = { child: 'children', 'friend (female)': 'friends (female)', 'friend (male)': 'friends (male)' };
  if (irregular[en]) return irregular[en];
  return en.replace(/^(\S+)/, (w) => (w.endsWith('s') ? w : w + 's'));
}

// ---------- Textbook exercises ----------

export function exerciseQ(itemId) {
  const it = DB.items[itemId];
  const x = it.data;
  const tricks = it.grammar?.tricks || it.mod.grammar?.tricks || {};
  const base = { itemId, label: it.label, explain: x.why, tag: x.set, trick: x.trick || tricks[x.rule], answerFa: faWord(x.answer), answerPr: prWord(x.answer) };
  if (x.type === 'listen-digits') {
    return { ...base, kind: 'type', skill: 'listening', say: 'Écoute et écris les chiffres.', sub: x.set === 'Practice' ? 'Listen and type the number in digits.' : `${x.set}. Listen and type the digits.`,
      audio: x.say, answers: [x.answer], numeric: true, reveal: `${x.en} = ${x.say}`, speakAnswer: x.say, explain: x.why };
  }
  if (x.type === 'speak') {
    const digits = /^[\d .]+$/.test(x.en || '');
    return { ...base, kind: 'speak', skill: 'speaking', say: digits ? 'Lis le numéro à voix haute.' : 'À toi de parler !',
      sub: digits ? `${x.set}. Read it in pairs, then compare with Minou.` : 'Tap the mic and say it.',
      fr: x.fr, en: x.en, digits: digits ? x.en : undefined, showDigits: digits, selfCheck: digits, label: x.fr };
  }
  const filled = x.text.includes('___') ? x.text.replace('___', x.answer) : x.answer;
  if (x.type === 'type') {
    return { ...base, kind: 'type', skill: 'writing', say: 'Complète la phrase.', sub: x.set === 'Practice' ? 'Type the missing word.' : x.set,
      text: x.text, en: x.en, answers: x.accept || [x.answer], caseless: true, reveal: filled, short: true };
  }
  if (x.type === 'sentence') {
    return { ...base, kind: 'type', skill: 'writing', say: /^Say it in French/.test(x.text) ? 'Écris en français.' : 'Réécris la phrase.', sub: x.set === 'Practice' ? 'Type the whole sentence.' : x.set,
      text: x.text, en: x.en, answers: x.accept || [x.answer], reveal: x.answer, speakAnswer: x.answer, long: true };
  }
  return { ...base, kind: 'mcq', skill: 'reading', say: x.text.includes('___') ? 'Complète la phrase.' : 'Choisis la bonne réponse.',
    sub: x.set === 'Practice' ? 'Pick the right answer.' : x.set,
    text: x.text, en: x.en, options: x.options, answer: x.answer, keepOrder: true, optionsFr: true, reveal: filled,
    speakAnswer: filled.replace(/^—\s*/, '').replace(/\s*\([^)]*\)\s*$/, '').replace(/^[\d.]+\s*=\s*/, '') };
}

// ---------- Reading ----------

export function readingQ(itemId) {
  const it = DB.items[itemId];
  const { reading, q } = it.data;
  return { itemId, label: it.label, kind: 'mcq', skill: 'reading', say: 'Lis et réponds.', sub: q.hint,
    passage: reading, big: q.q, speakBig: q.q, options: shuffle(q.options), answer: q.answer, optionsFr: true, optionsEn: q.optionsEn,
    reveal: q.optionsEn ? `${q.answer} (${q.optionsEn[q.answer]})` : q.answer };
}

export function passageStep(reading) {
  return { kind: 'passage', say: 'Lis l’histoire.', sub: 'Tap a line to hear it. Tap the eye to see English.', passage: reading };
}

// ---------- Numbers ----------

export function numberQ(itemId, kind, poolNs) {
  const n = DB.items[itemId].data.n;
  const word = frNumber(n);
  const others = sample(poolNs.filter((x) => x !== n), 3);
  const base = { itemId, label: `${n} = ${word}`, reveal: `${n} = ${word}`, speakAnswer: word, answerFa: faNumber(n), answerPr: prNumber(n), trick: NUMBER_TRICKS[n] };
  switch (kind) {
    case 'num-listen':
      return { ...base, kind: 'type', skill: 'listening', say: 'Quel nombre ?', sub: 'Listen and type the number in digits.',
        audio: word, answers: [String(n)], numeric: true };
    case 'num-read':
      return { ...base, kind: 'mcq', skill: 'reading', say: 'Comment dit-on… ?', sub: 'Pick the French word.',
        big: String(n), options: shuffle([word, ...others.map(frNumber)]), answer: word, optionsFr: true, hero: true };
    case 'num-word':
      return { ...base, kind: 'mcq', skill: 'reading', say: 'C’est quel nombre ?', sub: 'Pick the digits.',
        big: word, speakBig: word, options: shuffle([n, ...others].map(String)), answer: String(n) };
    case 'num-write':
      return { ...base, kind: 'type', skill: 'writing', say: 'Écris le nombre.', sub: 'Spell it out in French.',
        big: String(n), answers: [word], hero: true };
    case 'num-speak':
      return { ...base, kind: 'speak', skill: 'speaking', say: 'Dis le nombre !', sub: 'Tap the mic and say it.',
        fr: word, en: String(n), digits: String(n), showDigits: true, fa: faNumber(n), pr: prNumber(n) };
  }
}

export function numberTable(a, b, extra = {}) {
  return { kind: 'numbers', say: 'Les nombres !', sub: 'Tap each number to hear it.', nums: range(a, b), ...extra };
}

export function numberList(nums, extra = {}) {
  return { kind: 'numbers', say: 'Les nombres !', sub: 'Tap each number to hear it.', nums, ...extra };
}

// ---------- Alphabet ----------

const CONFUSE = [['E', 'I', 'U', 'O'], ['G', 'J'], ['B', 'D', 'P', 'T', 'V', 'C'], ['M', 'N', 'L'], ['K', 'Q', 'C'],
  ['X', 'S', 'Z'], ['W', 'V'], ['Y', 'I'], ['H', 'A'], ['R', 'L']];

function letterDistractors(L, all, n = 3) {
  const near = [...new Set(CONFUSE.filter((g) => g.includes(L)).flat())].filter((x) => x !== L && all.includes(x));
  const rest = all.filter((x) => x !== L && !near.includes(x));
  return [...shuffle(near), ...shuffle(rest)].slice(0, n);
}

const lettersOf = (mod) => (mod.letters || []).map((x) => x.l);
const sayOf = (mod, L) => (mod.letters || []).find((x) => x.l === L)?.say || L;

// Spoken spelling: letters and accents by their French names, with pauses.
export function spellOut(word, mod) {
  const ACC = { â: 'a accent circonflexe', é: 'e accent aigu', è: 'e accent grave', ê: 'e accent circonflexe', ë: 'e tréma', à: 'a accent grave',
    ç: 'c cédille', ï: 'i tréma', î: 'i accent circonflexe', ô: 'o accent circonflexe', û: 'u accent circonflexe', ù: 'u accent grave' };
  return [...word.toLowerCase()].map((ch) => {
    if (ch === 'œ') return 'o e dans l’o';
    if (ch === '-') return 'trait d’union';
    return ACC[ch] || sayOf(mod, ch.toUpperCase());
  }).join(' ; ');
}

export function letterQ(itemId, kind) {
  const it = DB.items[itemId];
  const x = it.data;
  const all = lettersOf(it.mod);
  const base = { itemId, label: it.label, reveal: `${x.l} is said “${x.say}”`, speakAnswer: x.say, explain: x.hint, trick: x.trick, answerFa: x.fa, answerPr: x.pr };
  switch (kind) {
    case 'intro':
      return { ...base, kind: 'letter', letter: x.l, say: x.say, hint: x.hint, word: x.word, wordEn: x.wordEn, fa: x.fa, pr: x.pr };
    case 'hear-letter':
      return { ...base, kind: 'mcq', skill: 'listening', say: 'Quelle lettre ?', sub: 'Listen. Which letter is it?',
        audio: x.say, options: shuffle([x.l, ...letterDistractors(x.l, all)]), answer: x.l, letters: true };
    case 'letter-name': {
      const opts = shuffle([x.l, ...letterDistractors(x.l, all)]).map((L) => sayOf(it.mod, L));
      return { ...base, kind: 'mcq', skill: 'reading', say: 'Comment ça se dit ?', sub: 'How is this letter said?',
        big: x.l, hero: true, options: opts, answer: x.say, optionsFr: true };
    }
    case 'say-letter':
      return { ...base, kind: 'speak', skill: 'speaking', say: 'Dis la lettre !', sub: 'Say it out loud, then compare with Minou.',
        fr: x.say, en: x.hint, digits: x.l, showDigits: true, selfCheck: true, fa: x.fa, pr: x.pr };
  }
}

export function trapQ(mod, pair) {
  const [a, b] = shuffle(pair);
  const xa = (mod.letters || []).find((x) => x.l === a);
  const itemId = `${mod.key}:l:${a}`;
  return { itemId, label: `${a} = ${xa.say}`, kind: 'mcq', skill: 'listening', say: `${pair[0]} ou ${pair[1]} ?`,
    sub: 'Listen carefully. Which one did Minou say?', audio: xa.say, options: pair.slice(), answer: a, keepOrder: true, letters: true,
    reveal: `${a} is said “${xa.say}”`, explain: xa.hint, speakAnswer: xa.say, trick: xa.trick, answerFa: xa.fa, answerPr: xa.pr };
}

export function accentQ(itemId, kind) {
  const it = DB.items[itemId];
  const a = it.data;
  const others = (it.mod.accents || []).filter((x) => x.id !== a.id);
  const base = { itemId, label: it.label, reveal: `${a.mark} = ${a.name}`, explain: a.hint, speakAnswer: a.name, trick: a.trick, answerFa: a.fa, answerPr: a.pr };
  switch (kind) {
    case 'intro':
      return { ...base, kind: 'accent', mark: a.mark, name: a.name, hint: a.hint, words: a.words, wordsEn: a.wordsEn, fa: a.fa, pr: a.pr };
    case 'name':
      return { ...base, kind: 'mcq', skill: 'reading', say: 'Comment s’appelle cet accent ?', sub: 'Name this accent.',
        big: a.mark, hero: true, options: shuffle([a.name, ...sample(others, 2).map((o) => o.name)]), answer: a.name, optionsFr: true };
    case 'hear':
      return { ...base, kind: 'mcq', skill: 'listening', say: 'Écoute bien !', sub: 'Which mark did Minou name?',
        audio: a.name, options: shuffle([a.mark, ...sample(others, 3).map((o) => o.mark)]), answer: a.mark, letters: true };
    case 'word': {
      const w = pick(a.words);
      const plain = w.replace(a.mark, a.mark.normalize('NFD')[0]);
      if (plain === w) return accentQ(itemId, 'name');
      return { ...base, kind: 'type', skill: 'writing', say: 'Ajoute l’accent !', sub: `Type “${plain}” with the right accent.`,
        big: plain, audio: w, answers: [w], strictAccents: true, reveal: w, speakAnswer: w };
    }
    case 'spot': {
      // Hear a word, pick the right spelling among versions with the accent swapped.
      const w = pick(a.words);
      const variants = [...new Set((a.swap || []).map((x) => w.replace(a.mark, x)))].filter((v) => v !== w);
      if (!variants.length) return accentQ(itemId, 'name');
      const en = a.wordsEn?.[w];
      return { ...base, kind: 'mcq', skill: 'listening', say: 'Quelle orthographe ?', sub: 'Listen. Which spelling is right?',
        audio: w, options: shuffle([w, ...variants.slice(0, 3)]), answer: w, optionsFr: true, letters: w.length <= 3,
        reveal: en ? `${w} (${en})` : w, speakAnswer: w };
    }
  }
}

export function spellQ(itemId, kind = 'listen') {
  const it = DB.items[itemId];
  const w = it.data.word;
  const en = (it.mod.spellEn || {})[w];
  const base = { itemId, label: w, reveal: en ? `${w} (${en})` : w, speakAnswer: w };
  if (kind === 'speak') {
    return { ...base, kind: 'speak', skill: 'speaking', say: 'Épelle ce mot !', sub: 'Spell it out loud, letter by letter, then compare.',
      fr: spellOut(w, it.mod), en: `Spell: ${w}`, digits: w, showDigits: true, selfCheck: true };
  }
  return { ...base, kind: 'type', skill: 'listening', say: 'Quel mot ?', sub: 'Minou spells a word letter by letter. Type it.',
    audio: spellOut(w, it.mod), answers: [w], strictAccents: true, spelling: true };
}

// ---------- Generic: any item, any skill ----------

const KINDS = {
  vocab: { reading: ['fr-en', 'en-fr', 'gender'], writing: ['write'], listening: ['listen-pick', 'listen-type'], speaking: ['speak'] },
  sentence: { reading: ['listen-mean'], writing: ['bank', 'write-sentence'], listening: ['listen-bank', 'dictation'], speaking: ['speak'] },
  number: { reading: ['num-read', 'num-word'], writing: ['num-write'], listening: ['num-listen'], speaking: ['num-speak'] },
};

export function questionFor(itemId, skill) {
  const it = DB.items[itemId];
  if (!it) return null;
  if (it.type === 'grammar') return grammarQ(itemId);
  if (it.type === 'exercise') return exerciseQ(itemId);
  if (it.type === 'reading') return readingQ(itemId);
  if (it.type === 'letter') return letterQ(itemId, skill === 'reading' ? 'letter-name' : skill === 'speaking' ? 'say-letter' : 'hear-letter');
  if (it.type === 'accent') return accentQ(itemId, skill === 'writing' ? 'word' : skill === 'listening' ? pick(['hear', 'spot']) : 'name');
  if (it.type === 'spell') return spellQ(itemId, skill === 'speaking' ? 'speak' : 'listen');
  const table = KINDS[it.type];
  const skills = Object.keys(table);
  const s = skill && table[skill] ? skill : pick(skills);
  const kind = pick(table[s]);
  if (it.type === 'vocab') return vocabQ(itemId, kind);
  if (it.type === 'sentence') return sentenceQ(itemId, kind);
  if (it.type === 'number') {
    const pool = Object.values(DB.items).filter((x) => x.type === 'number').map((x) => x.data.n);
    return numberQ(itemId, kind, pool.length >= 4 ? pool : range(0, 10));
  }
}
