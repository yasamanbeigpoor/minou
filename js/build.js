// Builds the step list for each kind of lesson.
import { DB, GRAMMAR_RULES, itemsOf, mainModules } from './data.js';
import { get } from './store.js';
import { prioritize } from './srs.js';
import { shuffle, sample, pick } from './util.js';
import { range } from './numbers.js';
import {
  vocabQ, matchQ, sentenceQ, grammarQ, exerciseQ, readingQ, passageStep, numberQ, numberTable, questionFor,
  letterQ, trapQ, accentQ, spellQ, spellOut,
} from './questions.js';

const vid = (m, id) => `${m.key}:v:${id}`;
const SKILL_ROTATION = ['writing', 'listening', 'speaking', 'reading'];

export function buildNode(node) {
  const m = node.mod;
  switch (node.type) {
    case 'words': return buildWords(m, node.items.map((id) => vid(m, id)));
    case 'grammar': return buildGrammar(m);
    case 'exercises': return (m.exercises || []).map((x) => exerciseQ(`${m.key}:x:${x.id}`));
    case 'reading': return buildReading(m);
    case 'listen': return buildListen(m);
    case 'numbers': return withChant(m.numberChant, buildNumbers(m.numbers[0], m.numbers[1], true), 1);
    case 'checkpoint': return buildCheckpoint(m);
    case 'review': return buildReview(mainModules().slice(0, m.index), 18);
    case 'letters': return node.id === 'a-m' ? withChant(m.chant, buildLetters(m, [...node.letters]), 0) : buildLetters(m, [...node.letters]);
    case 'letter-traps': return buildTraps(m);
    case 'accents': return buildAccents(m);
    case 'spell': return buildSpell(m);
    default: return [];
  }
}

function buildLetters(m, letters) {
  const id = (L) => `${m.key}:l:${L}`;
  const steps = [];
  letters.forEach((L, i) => {
    steps.push(letterQ(id(L), 'intro'));
    if (i > 0 && i % 2 === 0) steps.push(letterQ(id(letters[i - 1]), 'hear-letter'));
  });
  const practice = shuffle(letters).map((L, i) =>
    letterQ(id(L), ['hear-letter', 'letter-name', 'say-letter', 'hear-letter'][i % 4]));
  // Finish with two spelling challenges using only these letters where possible.
  const words = (m.spellWords || []).filter((w) => [...stripAcc(w).toUpperCase()].every((ch) => letters.includes(ch)));
  const spells = sample(words.length >= 2 ? words : m.spellWords || [], 2).map((w) => spellQ(`${m.key}:w:${w}`));
  return [...steps, ...practice, ...spells];
}

const stripAcc = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe');

function buildTraps(m) {
  const steps = [{ kind: 'teach', title: 'English speakers mix these up', body:
    'Some French letter names sound like <i>other</i> English letters. <b>G</b> is “zhay” and <b>J</b> is “zhee”, the opposite of English. <b>E</b> is “uh” and <b>I</b> is “ee”. <b>U</b> has no English twin: say “ee” with round lips.',
  examples: (m.traps || []).slice(0, 4).flat().filter((v, i, a) => a.indexOf(v) === i).map((L) => {
    const x = m.letters.find((y) => y.l === L);
    return { fr: x.say, en: `${L}: ${x.hint}` };
  }) }];
  const traps = m.traps || [];
  for (let r = 0; r < 2; r++) shuffle(traps).forEach((p) => steps.push(trapQ(m, p)));
  return steps;
}

function buildAccents(m) {
  const id = (a) => `${m.key}:a:${a.id}`;
  const acc = m.accents || [];
  const steps = acc.map((a) => accentQ(id(a), 'intro'));
  const practice = shuffle([...acc.map((a) => accentQ(id(a), 'name')), ...acc.map((a) => accentQ(id(a), 'word')),
    ...sample(acc, 3).map((a) => accentQ(id(a), 'hear'))]);
  const spells = sample((m.spellWords || []).filter((w) => /[éèêçëà]/.test(w)), 2).map((w) => spellQ(`${m.key}:w:${w}`));
  return [...steps, ...practice, ...spells];
}

function buildSpell(m) {
  const ids = shuffle((m.spellWords || []).map((w) => `${m.key}:w:${w}`));
  const name = (get().settings.name || '').trim();
  const steps = [{ kind: 'teach', title: 'Épelle !', body:
    'Minou will spell a word one letter at a time, accents included: <b>m, e accent grave, r, e</b> spells <b>mère</b>. Use the turtle to hear it slowly. All the words come from your lessons.' }];
  ids.slice(0, 10).forEach((id) => steps.push(spellQ(id)));
  ids.slice(10, 12).forEach((id) => steps.push(spellQ(id, 'speak')));
  if (/^[a-zà-ÿ' -]{2,20}$/i.test(name)) {
    steps.push({ kind: 'speak', skill: 'speaking', say: 'Épelle ton prénom !', sub: 'Spell your own name out loud. You’ll need it in class!',
      fr: spellOut(name, m), en: `Spell: ${name}`, digits: name, showDigits: true, selfCheck: true, label: name });
  }
  return steps;
}

function buildWords(m, ids) {
  const steps = [];
  ids.forEach((id, i) => {
    steps.push(vocabQ(id, 'intro'));
    if (i > 0) steps.push(vocabQ(ids[i - 1], i % 2 ? 'fr-en' : 'listen-pick'));
  });
  steps.push(vocabQ(ids[ids.length - 1], 'en-fr'));
  steps.push(matchQ(sample(ids, 5)));
  const practice = shuffle(ids).map((id, i) => {
    const skill = SKILL_ROTATION[i % SKILL_ROTATION.length];
    if (skill === 'reading') return vocabQ(id, 'gender');
    if (skill === 'writing') return vocabQ(id, 'write');
    if (skill === 'listening') return vocabQ(id, i % 3 ? 'listen-type' : 'listen-pick');
    return vocabQ(id, 'speak');
  });
  return [...steps, ...practice];
}

function buildGrammar(m) {
  const g = m.grammar;
  const gid = (r) => `${m.key}:g:${r}`;
  const tricks = g.tricks || {};
  const teachTricks = [tricks.mon, tricks.sonsa, tricks.vowel, null];
  const teach = g.teach.map((t, i) => ({ kind: 'teach', ...t, trick: teachTricks[i] }));
  return [
    teach[0],
    grammarQ(gid('mon'), { type: false }), grammarQ(gid('ma'), { type: false }), grammarQ(gid('mes'), { type: false }),
    grammarQ(gid('notre'), { type: false }), grammarQ(gid('leur'), { type: false }),
    teach[1],
    grammarQ(gid('sonsa')), grammarQ(gid('sonsa')), grammarQ(gid('sonsa')),
    teach[2],
    grammarQ(gid('vowel'), { type: false }), grammarQ(gid('vowel'), { type: true }), grammarQ(gid('vowel'), { type: false }),
    teach[3],
    g.chant ? { kind: 'passage', say: 'Chante avec moi !', sub: 'A little chant to remember all six. Tap Listen to all.', passage: { ...g.chant, showEn: true } } : null,
    ...['mes enfants', 'mon oncle', 'mes filles'].map((p) => ({
      kind: 'speak', skill: 'speaking', say: 'Fais la liaison !', sub: 'Say it, linking the sounds where needed.',
      fr: p, en: p === 'mes filles' ? 'no liaison here' : 'link the sounds', itemId: gid('vowel'), label: p,
    })),
    ...shuffle(['mon', 'ma', 'mes', 'vowel', 'notre', 'leur'].map((r) => grammarQ(gid(r), { type: true }))),
  ].filter(Boolean);
}

function buildReading(m) {
  const steps = [];
  for (const r of m.readings || []) {
    steps.push(passageStep(r));
    r.questions.forEach((_, qi) => steps.push(readingQ(`${m.key}:r:${r.id}:${qi}`)));
  }
  return steps;
}

function buildListen(m) {
  const ids = shuffle((m.sentences || []).map((s) => `${m.key}:s:${s.id}`));
  const plan = ['listen-bank', 'bank', 'speak', 'listen-mean', 'dictation', 'listen-bank', 'speak', 'bank',
    'write-sentence', 'speak', 'listen-bank', 'dictation', 'speak', 'bank'];
  return plan.map((k, i) => sentenceQ(ids[i % ids.length], k));
}

// Insert a sing-along passage (a traditional rhyme or Minou's chant) at position `at`.
function withChant(chant, steps, at) {
  if (!chant) return steps;
  const step = { kind: 'passage', say: 'Chante avec moi !', sub: 'Tap a line to hear it, or play them all. Say it along with Minou.',
    passage: { ...chant, showEn: true } };
  return [...steps.slice(0, at), step, ...steps.slice(at)];
}

export function buildNumbers(a, b, withTable) {
  const fresh = range(a, b);
  const earlier = a > 0 ? range(0, a - 1) : [];
  const pool = [...earlier, ...fresh];
  const pickN = () => (earlier.length && Math.random() < 0.3 ? pick(earlier) : pick(fresh));
  const kinds = ['num-read', 'num-listen', 'num-word', 'num-write', 'num-speak', 'num-listen', 'num-read',
    'num-write', 'num-listen', 'num-speak', 'num-word', 'num-listen', 'num-write', 'num-read'];
  const steps = withTable ? [numberTable(a, b)] : [];
  kinds.forEach((k) => steps.push(numberQ(`num:${pickN()}`, k, pool)));
  return steps;
}

function buildCheckpoint(m) {
  const items = itemsOf([m]);
  const by = (t) => items.filter((it) => it.type === t).map((it) => it.id);
  const steps = [
    ...sample(by('vocab'), 6).map((id, i) => questionFor(id, SKILL_ROTATION[i % 4])),
    ...sample(by('grammar'), 4).map((id) => grammarQ(id)),
    ...sample(by('exercise'), 3).map((id) => exerciseQ(id)),
    ...sample(by('sentence'), 4).map((id, i) => questionFor(id, SKILL_ROTATION[(i + 1) % 4])),
    ...sample(by('number'), 3).map((id) => questionFor(id)),
  ];
  return shuffle(steps.filter(Boolean));
}

// Mixed review across modules, weighted toward what's due or was missed, balanced across skills.
export function buildReview(mods, n = 18) {
  if (!mods.length) return [];
  const { cards } = get();
  const ids = itemsOf(mods).filter((it) => it.type !== 'reading').map((it) => it.id);
  const seen = ids.filter((id) => cards[id]);
  const ordered = prioritize(seen.length >= n ? seen : ids, cards);
  return ordered.slice(0, n).map((id, i) => questionFor(id, SKILL_ROTATION[i % 4])).filter(Boolean);
}

export function buildWeak(limit = 15) {
  const weak = get().weak;
  const ids = Object.keys(weak).filter((id) => DB.items[id])
    .sort((a, b) => weak[b].misses - weak[a].misses).slice(0, limit);
  return shuffle(ids).map((id, i) => questionFor(id, SKILL_ROTATION[i % 4])).filter(Boolean);
}

export function buildExam(mods, n = 25) {
  const items = itemsOf(mods);
  const by = (t) => shuffle(items.filter((it) => it.type === t).map((it) => it.id));
  const vocab = by('vocab'), sent = by('sentence'), gram = by('grammar'), ex = by('exercise'), read = by('reading'), num = by('number');
  const steps = [
    ...vocab.slice(0, 8).map((id, i) => questionFor(id, SKILL_ROTATION[i % 4])),
    ...gram.slice(0, 4).map((id) => grammarQ(id)),
    ...ex.slice(0, 3).map((id) => exerciseQ(id)),
    ...read.slice(0, 3).map((id) => readingQ(id)),
    ...sent.slice(0, 4).map((id, i) => questionFor(id, SKILL_ROTATION[i % 4])),
    ...num.slice(0, 3).map((id) => questionFor(id)),
  ].filter(Boolean);
  return shuffle(steps).slice(0, n);
}

export const dueCount = (mods) => {
  const now = Date.now();
  const { cards } = get();
  return itemsOf(mods).filter((it) => cards[it.id] && cards[it.id].due <= now).length;
};

export { GRAMMAR_RULES };
